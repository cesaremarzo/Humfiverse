// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./HumfiverseCatalogueToken.sol";

/// @title HumfiverseMilestoneEscrow
/// @notice TESTNET DEMO CONTRACT — not audited, not for real funds, not a
///         security offering. Pre-production financing escrow: contributed
///         USDC sits in this contract, never reaching the artist directly,
///         until a milestone is released — see
///         planning/technical-architecture.md §2.7/§2.27 and
///         legal-regulatory-notes.md §4/§7.3 on why this design deliberately
///         gives Humfiverse no discretionary say over whether a milestone
///         was met: release requires both the artist and the studio to
///         confirm it independently (§2.27). Humfiverse can register
///         studios and create campaigns (administrative/custodial acts, not
///         judgment calls on performance) but cannot itself release a
///         tranche — this was a deliberate change from an earlier version
///         where Humfiverse alone confirmed milestones, made specifically
///         to strengthen the argument that this vehicle isn't "actively
///         managed" for AIFMD purposes. If artist and studio disagree, the
///         milestone's funds simply stay locked — there is intentionally no
///         arbitration or timeout escape hatch here; that's a real
///         limitation to flag, not an oversight.
///
///         The "book the studio" milestone is where the guarantor role
///         becomes concrete rather than just a promise: its tranche is paid
///         straight to the chosen studio's registered wallet, never to the
///         artist. The artist commits to recording at that studio when the
///         campaign is created; the contract — not anyone's discretion — is
///         what makes sure the money earmarked for that actually gets
///         there, and only once both sides agree it happened.
///
///         Business rule (§2.72), two fees:
///         - `CONTRIBUTION_FEE_BPS` (2%) of every contribution, deducted from
///           it on arrival. The contributor receives tokens for the full
///           amount they sent; the campaign is credited the other 98%. This
///           fee is not refunded if the campaign is later cancelled.
///         - `MILESTONE_FEE_BPS` (3%) of every tranche as it is released.
///         Because a sold-out campaign therefore holds 98% of its goal,
///         tranches are sized against `fundingTargetOf` — the goal less the
///         contribution fee — not the goal itself, or the last milestone
///         could never be covered. Across a campaign that sells out and
///         releases everything, the platform receives 2% + 3% of 98% = 4.94%
///         of the goal. Both fees accrue inside this contract and leave only
///         through withdrawFees() — never pushed during a release — because a
///         fee recipient that could not receive would otherwise block every
///         milestone, handing Humfiverse exactly the veto over releases that
///         §2.27 was written to remove.
/// @dev Campaigns and studios are created/registered by the platform
///      (onlyOwner), mirroring how HumfiverseCatalogueToken.mintCatalogue
///      is triggered by the backend after a user completes the onboarding
///      wizard, not called directly from an artist's own wallet.
contract HumfiverseMilestoneEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Payee {
        ARTIST,
        STUDIO
    }
    enum CampaignStatus {
        ACTIVE,
        CANCELLED
    }

    struct Milestone {
        string name;
        uint16 bps; // share of fundingGoal this tranche represents, out of 10,000
        Payee payee;
        bool released;
    }

    struct Campaign {
        address artist;
        uint256 studioId; // 0 = no studio required for this campaign
        uint256 fundingGoal; // paymentToken base units (USDC: 1e6 = $1)
        uint256 raised; // credited to the campaign, net of the contribution fee
        uint256 deadline; // unix timestamp; 0 = no deadline
        CampaignStatus status;
        uint256 releasedBps; // cumulative bps released so far
        string assetId; // the platform's asset id (e.g. "glass-horizon") this
        // campaign belongs to — stored on-chain, not just in the backend's
        // local index, so the asset<->campaign link survives even if that
        // index is lost (see planning/technical-architecture.md §2.18: the
        // backend's SQLite mirror isn't guaranteed to persist across a
        // redeploy on the current hosting plan, the chain always is).
    }

    struct Studio {
        string name;
        address wallet;
        bool active;
    }

    /// @notice The linked HumfiverseCatalogueToken — every preproduction
    ///         campaign's pledged supply lives there too (same unified
    ///         mint-at-creation flow as catalogue assets), so contribute()
    ///         below can release the contributor's matching tokens directly
    ///         from that pool, atomically, in the same transaction as the
    ///         contribution itself. Requires this contract's address to be
    ///         authorized there via HumfiverseCatalogueToken.setEscrowContract
    ///         after deploy — see that contract's escrowContract field.
    HumfiverseCatalogueToken public immutable catalogueToken;

    /// @notice The stablecoin contributions, payouts, refunds and fees move
    ///         in — the linked token's own paymentToken, so a price and the
    ///         payment for it can never be in different currencies (§2.73).
    IERC20 public immutable paymentToken;

    /// @notice Platform fee on every contribution, in basis points of the
    ///         amount sent (200 bps = 2.00%). Constants, not setters: the rate
    ///         a contributor funded under cannot be changed afterward.
    uint16 public constant CONTRIBUTION_FEE_BPS = 200;
    /// @notice Platform fee on every released tranche (300 bps = 3.00%).
    uint16 public constant MILESTONE_FEE_BPS = 300;

    /// @notice Where withdrawFees() sends accrued fees. Defaults to the deployer.
    address public feeRecipient;
    /// @notice Fees retained from released tranches and not yet withdrawn.
    uint256 public accruedFees;
    /// @notice Every fee ever retained, withdrawn or not — never decreases.
    uint256 public totalFeesCollected;
    /// @notice campaignId => fees retained from that campaign, both kinds.
    mapping(uint256 => uint256) public campaignFeesCollected;
    /// @notice campaignId => amount paid out of the campaign by released
    ///         tranches, fee included. What refunds are measured against.
    mapping(uint256 => uint256) public campaignReleased;

    uint256 private nextCampaignId = 1;
    uint256 private nextStudioId = 1;

    mapping(uint256 => Campaign) public campaigns;
    /// @notice campaignId => the HumfiverseCatalogueToken token id this
    ///         campaign's contributions release from, set once at
    ///         createCampaign and never changed.
    mapping(uint256 => uint256) public campaignTokenId;
    mapping(uint256 => Milestone[]) private campaignMilestones;
    mapping(uint256 => mapping(address => uint256)) public contributions; // campaignId => contributor => amount credited
    mapping(uint256 => Studio) public studios;
    /// @notice Dual sign-off state (§2.27): campaignId => milestoneIndex =>
    ///         confirmed. A milestone releases only once both are true — see
    ///         confirmMilestoneAsArtist/confirmMilestoneAsStudio below.
    mapping(uint256 => mapping(uint256 => bool)) public artistConfirmed;
    mapping(uint256 => mapping(uint256 => bool)) public studioConfirmed;
    /// @notice O(1) on-chain lookup from the platform's asset id straight to
    ///         its campaign id — the piece that makes this contract itself
    ///         the source of truth for the asset<->campaign link, not just
    ///         an off-chain index of it. 0 = no campaign for this asset id.
    mapping(string => uint256) public campaignIdByAssetId;

    event StudioRegistered(uint256 indexed studioId, address indexed wallet, string name);
    event StudioActiveSet(uint256 indexed studioId, bool active);
    event StudioRenamed(uint256 indexed studioId, string previousName, string newName);
    event CampaignCreated(uint256 indexed campaignId, address indexed artist, uint256 fundingGoal, uint256 studioId, uint256 deadline, string assetId);
    event Contributed(uint256 indexed campaignId, address indexed contributor, uint256 amount, uint256 totalRaised);
    event MilestoneConfirmedByArtist(uint256 indexed campaignId, uint256 indexed milestoneIndex);
    event MilestoneConfirmedByStudio(uint256 indexed campaignId, uint256 indexed milestoneIndex);
    event MilestoneConfirmed(uint256 indexed campaignId, uint256 indexed milestoneIndex, address indexed payee, uint256 amount);
    event CampaignCancelled(uint256 indexed campaignId);
    event Refunded(uint256 indexed campaignId, address indexed contributor, uint256 amount);
    event ContributionFeeRetained(uint256 indexed campaignId, address indexed contributor, uint256 fee);
    event PlatformFeeRetained(uint256 indexed campaignId, uint256 indexed milestoneIndex, uint256 fee);
    event FeesWithdrawn(address indexed recipient, uint256 amount);
    event FeeRecipientUpdated(address indexed previous, address indexed next);

    constructor(address _catalogueToken, address _feeRecipient) Ownable(msg.sender) {
        require(_catalogueToken != address(0), "HumfiverseMilestoneEscrow: zero token address");
        catalogueToken = HumfiverseCatalogueToken(_catalogueToken);
        paymentToken = HumfiverseCatalogueToken(_catalogueToken).paymentToken();
        feeRecipient = _feeRecipient == address(0) ? msg.sender : _feeRecipient;
    }

    // --- studio registry (platform-curated for this pilot) ---

    function registerStudio(address wallet, string calldata name) external onlyOwner returns (uint256 studioId) {
        require(wallet != address(0), "HumfiverseMilestoneEscrow: zero address");
        studioId = nextStudioId++;
        studios[studioId] = Studio({name: name, wallet: wallet, active: true});
        emit StudioRegistered(studioId, wallet, name);
    }

    function setStudioActive(uint256 studioId, bool active) external onlyOwner {
        require(studios[studioId].wallet != address(0), "HumfiverseMilestoneEscrow: unknown studio");
        studios[studioId].active = active;
        emit StudioActiveSet(studioId, active);
    }

    /// @notice Corrects a studio's on-chain name after registration — an
    ///         admin fix for a genuine mistake (e.g. a wrong name registered
    ///         for a wallet that was then reused for a different campaign),
    ///         not a way to silently rewrite history for an active dispute.
    ///         Every campaign already pointing at this studioId picks up
    ///         the new name immediately, since campaigns store a studioId,
    ///         not a name.
    function renameStudio(uint256 studioId, string calldata name) external onlyOwner {
        require(studios[studioId].wallet != address(0), "HumfiverseMilestoneEscrow: unknown studio");
        emit StudioRenamed(studioId, studios[studioId].name, name);
        studios[studioId].name = name;
    }

    // --- campaign lifecycle ---

    /// @notice The goal is not a parameter (§2.79): it is the linked token's
    ///         price times its supply, so a campaign always aims for exactly
    ///         what selling every token raises — never more tokens than the
    ///         goal pays for, never a goal the tokens cannot reach.
    function createCampaign(
        address artist,
        uint256 studioId,
        uint256 deadline,
        string calldata assetId,
        uint256 tokenId,
        string[] calldata milestoneNames,
        uint16[] calldata milestoneBps,
        Payee[] calldata milestonePayees
    ) external onlyOwner returns (uint256 campaignId) {
        require(artist != address(0), "HumfiverseMilestoneEscrow: zero artist");
        require(bytes(assetId).length > 0, "HumfiverseMilestoneEscrow: assetId required");
        require(campaignIdByAssetId[assetId] == 0, "HumfiverseMilestoneEscrow: asset already has a campaign");
        // The token must already be minted (backend mints on upload, before
        // creating the campaign — same order the frontend now awaits) so
        // contribute() below always has a real pool to release from.
        require(catalogueToken.totalSupplyOf(tokenId) > 0, "HumfiverseMilestoneEscrow: unknown token id");
        uint256 fundingGoal = catalogueToken.fundingOf(tokenId);
        require(fundingGoal > 0, "HumfiverseMilestoneEscrow: token is not for sale");
        require(
            milestoneNames.length == milestoneBps.length && milestoneNames.length == milestonePayees.length,
            "HumfiverseMilestoneEscrow: length mismatch"
        );
        require(milestoneNames.length > 0, "HumfiverseMilestoneEscrow: no milestones");
        if (studioId != 0) {
            require(studios[studioId].active, "HumfiverseMilestoneEscrow: studio not active");
        }

        uint256 totalBps;
        for (uint256 i = 0; i < milestoneBps.length; i++) {
            totalBps += milestoneBps[i];
            if (milestonePayees[i] == Payee.STUDIO) {
                require(studioId != 0, "HumfiverseMilestoneEscrow: studio milestone needs a studio");
            }
        }
        require(totalBps == 10_000, "HumfiverseMilestoneEscrow: bps must total 10000");

        campaignId = nextCampaignId++;
        campaigns[campaignId] = Campaign({
            artist: artist,
            studioId: studioId,
            fundingGoal: fundingGoal,
            raised: 0,
            deadline: deadline,
            status: CampaignStatus.ACTIVE,
            releasedBps: 0,
            assetId: assetId
        });
        campaignIdByAssetId[assetId] = campaignId;
        campaignTokenId[campaignId] = tokenId;
        for (uint256 i = 0; i < milestoneNames.length; i++) {
            campaignMilestones[campaignId].push(
                Milestone({name: milestoneNames[i], bps: milestoneBps[i], payee: milestonePayees[i], released: false})
            );
        }
        emit CampaignCreated(campaignId, artist, fundingGoal, studioId, deadline, assetId);
    }

    /// @notice Contributes USDC to a campaign and, in the same transaction,
    ///         releases the matching quantity of tokens from the linked
    ///         catalogue pool straight to the contributor — the same
    ///         atomicity a catalogue buy() already has, unified here rather
    ///         than requiring a second, backend-signed release afterward
    ///         (the earlier design; see planning/technical-architecture.md
    ///         §2.34/§2.42). The amount must be a whole number of tokens at
    ///         the token's price (§2.79); it used to be floored, so a payment
    ///         that did not divide exactly was kept without buying anything.
    ///
    ///         Known limitation, carried over unchanged from the prior
    ///         design (accepted, not fixed here): if a campaign is later
    ///         cancelled and refunded, this doesn't claw back tokens
    ///         already released for that contribution — the contributor
    ///         could end up with both a partial refund and the tokens.
    ///
    ///         Paid in paymentToken: the contributor approves this contract for
    ///         `amount` first.
    function contribute(uint256 campaignId, uint256 amount) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(c.artist != address(0), "HumfiverseMilestoneEscrow: unknown campaign");
        require(c.status == CampaignStatus.ACTIVE, "HumfiverseMilestoneEscrow: not active");
        require(amount > 0, "HumfiverseMilestoneEscrow: zero contribution");
        require(c.deadline == 0 || block.timestamp <= c.deadline, "HumfiverseMilestoneEscrow: campaign ended");
        uint256 tokenId = campaignTokenId[campaignId];
        uint256 price = catalogueToken.pricePerToken(tokenId);
        // §2.79: a contribution buys whole tokens at the one price every token
        // of this campaign has. Anything else would be money that buys no
        // token — or, spread across contributors, tokens of unequal value.
        require(amount % price == 0, "HumfiverseMilestoneEscrow: amount must buy whole tokens");

        paymentToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 fee = (amount * CONTRIBUTION_FEE_BPS) / 10_000;
        uint256 credited = amount - fee;
        c.raised += credited;
        contributions[campaignId][msg.sender] += credited;
        accruedFees += fee;
        totalFeesCollected += fee;
        campaignFeesCollected[campaignId] += fee;
        emit ContributionFeeRetained(campaignId, msg.sender, fee);
        emit Contributed(campaignId, msg.sender, credited, c.raised);

        // Tokens for the whole amount sent: the fee is the platform's share of
        // the price, not a smaller purchase.
        catalogueToken.releaseFromPool(msg.sender, tokenId, amount / price);
    }

    /// @notice The artist attests a milestone was genuinely met. Combined
    ///         with confirmMilestoneAsStudio below, this is the *only* path
    ///         to releasing a tranche — see the contract-level note on why
    ///         Humfiverse deliberately has no confirmation power of its own
    ///         (§2.27). If the campaign has no studio (studioId == 0), the
    ///         artist's confirmation alone is sufficient, since there's no
    ///         second party to attest against.
    function confirmMilestoneAsArtist(uint256 campaignId, uint256 milestoneIndex) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(msg.sender == c.artist, "HumfiverseMilestoneEscrow: not this campaign's artist");
        require(c.status == CampaignStatus.ACTIVE, "HumfiverseMilestoneEscrow: not active");
        require(milestoneIndex < campaignMilestones[campaignId].length, "HumfiverseMilestoneEscrow: bad index");
        require(!campaignMilestones[campaignId][milestoneIndex].released, "HumfiverseMilestoneEscrow: already released");
        artistConfirmed[campaignId][milestoneIndex] = true;
        emit MilestoneConfirmedByArtist(campaignId, milestoneIndex);
        _tryRelease(campaignId, milestoneIndex);
    }

    /// @notice The studio attests a milestone was genuinely met — see
    ///         confirmMilestoneAsArtist above; a milestone needs both to
    ///         release, full stop, on every milestone (not only the one
    ///         paid to the studio) — the point is agreement on what was
    ///         actually produced, not just who gets paid for it.
    function confirmMilestoneAsStudio(uint256 campaignId, uint256 milestoneIndex) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(c.studioId != 0, "HumfiverseMilestoneEscrow: campaign has no studio");
        require(msg.sender == studios[c.studioId].wallet, "HumfiverseMilestoneEscrow: not this campaign's studio");
        require(c.status == CampaignStatus.ACTIVE, "HumfiverseMilestoneEscrow: not active");
        require(milestoneIndex < campaignMilestones[campaignId].length, "HumfiverseMilestoneEscrow: bad index");
        require(!campaignMilestones[campaignId][milestoneIndex].released, "HumfiverseMilestoneEscrow: already released");
        studioConfirmed[campaignId][milestoneIndex] = true;
        emit MilestoneConfirmedByStudio(campaignId, milestoneIndex);
        _tryRelease(campaignId, milestoneIndex);
    }

    /// @notice Releases a milestone's tranche once both required
    ///         confirmations are in — to the studio's wallet if this is the
    ///         studio-commitment milestone, otherwise to the artist, less the
    ///         platform fee, which stays here as accruedFees.
    ///
    ///         The funding check is cumulative: everything released so far
    ///         plus this tranche must be covered by what the campaign raised.
    ///         It used to compare the tranche alone against `raised`, so a
    ///         campaign that raised 50% could release its 40% and then its
    ///         30% tranche, paying out 70% of the goal and taking the
    ///         difference from other campaigns' contributions — and, since
    ///         fees accrue in this same balance, from the platform's fees.
    ///         Deliberately private and side-effect-only: there is no public
    ///         function anywhere in this contract that releases a milestone
    ///         on a single party's say-so, Humfiverse's included. If the two
    ///         sides never agree, this simply never runs — the funds stay in
    ///         the contract indefinitely (no arbitration/timeout here).
    function _tryRelease(uint256 campaignId, uint256 milestoneIndex) private {
        Campaign storage c = campaigns[campaignId];
        if (c.status != CampaignStatus.ACTIVE) return;
        Milestone[] storage milestones = campaignMilestones[campaignId];
        if (milestoneIndex >= milestones.length) return;
        Milestone storage m = milestones[milestoneIndex];
        if (m.released) return;

        bool studioSideDone = c.studioId == 0 || studioConfirmed[campaignId][milestoneIndex];
        if (!(artistConfirmed[campaignId][milestoneIndex] && studioSideDone)) return;

        uint256 target = fundingTargetOf(campaignId);
        // Not enough raised yet — releases once it is, on the next confirming call.
        if (c.raised < (target * (c.releasedBps + m.bps)) / 10_000) return;

        uint256 amount = (target * m.bps) / 10_000;
        uint256 fee = (amount * MILESTONE_FEE_BPS) / 10_000;
        uint256 payout = amount - fee;

        m.released = true;
        c.releasedBps += m.bps;
        campaignReleased[campaignId] += amount;
        accruedFees += fee;
        totalFeesCollected += fee;
        campaignFeesCollected[campaignId] += fee;

        address payee = m.payee == Payee.STUDIO ? studios[c.studioId].wallet : c.artist;
        paymentToken.safeTransfer(payee, payout);

        emit PlatformFeeRetained(campaignId, milestoneIndex, fee);
        emit MilestoneConfirmed(campaignId, milestoneIndex, payee, payout);
    }

    /// @notice Sends every accrued fee to feeRecipient. Callable by anyone:
    ///         the destination is fixed, so the caller decides only when the
    ///         transfer happens, never where it goes.
    function withdrawFees() external nonReentrant {
        uint256 amount = accruedFees;
        require(amount > 0, "HumfiverseMilestoneEscrow: no fees to withdraw");
        accruedFees = 0;
        paymentToken.safeTransfer(feeRecipient, amount);
        emit FeesWithdrawn(feeRecipient, amount);
    }

    function setFeeRecipient(address next) external onlyOwner {
        require(next != address(0), "HumfiverseMilestoneEscrow: zero address");
        emit FeeRecipientUpdated(feeRecipient, next);
        feeRecipient = next;
    }

    /// @notice Owner-only: stop taking new contributions and open the
    ///         refund path for whatever wasn't already released.
    function cancelCampaign(uint256 campaignId) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        require(c.status == CampaignStatus.ACTIVE, "HumfiverseMilestoneEscrow: not active");
        c.status = CampaignStatus.CANCELLED;
        emit CampaignCancelled(campaignId);
    }

    /// @notice Pro-rata refund of what the campaign still holds — per
    ///         technical-architecture.md §2.7, contributors are made whole
    ///         only for money never released to a confirmed milestone, not a
    ///         clawback of tranches spent on milestones genuinely delivered.
    ///         The contribution fee is not refunded: `contributions` records
    ///         only what was credited to the campaign.
    ///
    ///         Each contributor receives their share of `raised - released`.
    ///         It used to be `contributed × unreleasedBps`, which is only
    ///         correct when the campaign raised exactly its target: a campaign
    ///         that raised half of a $10,000 goal and released 20% ($2,000)
    ///         promised refunds of $4,000 against $3,000 remaining, and paid
    ///         the difference from other campaigns (§2.72).
    function refund(uint256 campaignId) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(c.status == CampaignStatus.CANCELLED, "HumfiverseMilestoneEscrow: not cancelled");
        uint256 contributed = contributions[campaignId][msg.sender];
        require(contributed > 0, "HumfiverseMilestoneEscrow: nothing to refund");

        contributions[campaignId][msg.sender] = 0;
        uint256 amount = (contributed * (c.raised - campaignReleased[campaignId])) / c.raised;

        paymentToken.safeTransfer(msg.sender, amount);

        emit Refunded(campaignId, msg.sender, amount);
    }

    /// @notice What a campaign can actually hold once sold out — its goal
    ///         less the contribution fee — and the basis every tranche is
    ///         sized against.
    function fundingTargetOf(uint256 campaignId) public view returns (uint256) {
        return (campaigns[campaignId].fundingGoal * (10_000 - CONTRIBUTION_FEE_BPS)) / 10_000;
    }

    function getMilestones(uint256 campaignId) external view returns (Milestone[] memory) {
        return campaignMilestones[campaignId];
    }
}
