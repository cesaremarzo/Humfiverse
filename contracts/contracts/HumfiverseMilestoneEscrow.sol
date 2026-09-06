// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./HumfiverseCatalogueToken.sol";

/// @title HumfiverseMilestoneEscrow
/// @notice TESTNET DEMO CONTRACT — not audited, not for real funds, not a
///         security offering. Pre-production financing escrow: contributed
///         ETH sits in this contract, never reaching the artist directly,
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
/// @dev Campaigns and studios are created/registered by the platform
///      (onlyOwner), mirroring how HumfiverseCatalogueToken.mintCatalogue
///      is triggered by the backend after a user completes the onboarding
///      wizard, not called directly from an artist's own wallet.
contract HumfiverseMilestoneEscrow is Ownable, ReentrancyGuard {
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
        uint256 fundingGoal; // wei
        uint256 raised; // wei
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

    uint256 private nextCampaignId = 1;
    uint256 private nextStudioId = 1;

    mapping(uint256 => Campaign) public campaigns;
    /// @notice campaignId => the HumfiverseCatalogueToken token id this
    ///         campaign's contributions release from, set once at
    ///         createCampaign and never changed.
    mapping(uint256 => uint256) public campaignTokenId;
    mapping(uint256 => Milestone[]) private campaignMilestones;
    mapping(uint256 => mapping(address => uint256)) public contributions; // campaignId => contributor => wei contributed
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

    constructor(address _catalogueToken) Ownable(msg.sender) {
        require(_catalogueToken != address(0), "HumfiverseMilestoneEscrow: zero token address");
        catalogueToken = HumfiverseCatalogueToken(_catalogueToken);
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

    function createCampaign(
        address artist,
        uint256 fundingGoal,
        uint256 studioId,
        uint256 deadline,
        string calldata assetId,
        uint256 tokenId,
        string[] calldata milestoneNames,
        uint16[] calldata milestoneBps,
        Payee[] calldata milestonePayees
    ) external onlyOwner returns (uint256 campaignId) {
        require(artist != address(0), "HumfiverseMilestoneEscrow: zero artist");
        require(fundingGoal > 0, "HumfiverseMilestoneEscrow: goal must be > 0");
        require(bytes(assetId).length > 0, "HumfiverseMilestoneEscrow: assetId required");
        require(campaignIdByAssetId[assetId] == 0, "HumfiverseMilestoneEscrow: asset already has a campaign");
        // The token must already be minted (backend mints on upload, before
        // creating the campaign — same order the frontend now awaits) so
        // contribute() below always has a real pool to release from.
        require(catalogueToken.totalSupplyOf(tokenId) > 0, "HumfiverseMilestoneEscrow: unknown token id");
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

    /// @notice Contributes ETH to a campaign and, in the same transaction,
    ///         releases the matching quantity of tokens from the linked
    ///         catalogue pool straight to the contributor — the same
    ///         atomicity a catalogue buy() already has, unified here rather
    ///         than requiring a second, backend-signed release afterward
    ///         (the earlier design; see planning/technical-architecture.md
    ///         §2.34/§2.42). qty = msg.value / pricePerToken, floored —
    ///         same integer-division "dust" behavior the backend used to
    ///         compute this off-chain. If the token has no price set
    ///         (pricePerToken == 0), or the division floors to 0, the ETH
    ///         is still recorded normally and no tokens are released.
    ///
    ///         Known limitation, carried over unchanged from the prior
    ///         design (accepted, not fixed here): if a campaign is later
    ///         cancelled and refunded, this doesn't claw back tokens
    ///         already released for that contribution — the contributor
    ///         could end up with both a partial ETH refund and the tokens.
    function contribute(uint256 campaignId) external payable nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(c.artist != address(0), "HumfiverseMilestoneEscrow: unknown campaign");
        require(c.status == CampaignStatus.ACTIVE, "HumfiverseMilestoneEscrow: not active");
        require(msg.value > 0, "HumfiverseMilestoneEscrow: zero contribution");
        require(c.deadline == 0 || block.timestamp <= c.deadline, "HumfiverseMilestoneEscrow: campaign ended");

        c.raised += msg.value;
        contributions[campaignId][msg.sender] += msg.value;
        emit Contributed(campaignId, msg.sender, msg.value, c.raised);

        uint256 tokenId = campaignTokenId[campaignId];
        uint256 price = catalogueToken.pricePerToken(tokenId);
        if (price > 0) {
            uint256 qty = msg.value / price;
            if (qty > 0) {
                catalogueToken.releaseFromPool(msg.sender, tokenId, qty);
            }
        }
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
    ///         studio-commitment milestone, otherwise to the artist.
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

        uint256 amount = (c.fundingGoal * m.bps) / 10_000;
        if (c.raised < amount) return; // not enough raised yet — releases once it is, on the next confirming call

        m.released = true;
        c.releasedBps += m.bps;

        address payee = m.payee == Payee.STUDIO ? studios[c.studioId].wallet : c.artist;
        (bool sent, ) = payable(payee).call{value: amount}("");
        require(sent, "HumfiverseMilestoneEscrow: payout failed");

        emit MilestoneConfirmed(campaignId, milestoneIndex, payee, amount);
    }

    /// @notice Owner-only: stop taking new contributions and open the
    ///         refund path for whatever wasn't already released.
    function cancelCampaign(uint256 campaignId) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        require(c.status == CampaignStatus.ACTIVE, "HumfiverseMilestoneEscrow: not active");
        c.status = CampaignStatus.CANCELLED;
        emit CampaignCancelled(campaignId);
    }

    /// @notice Pro-rata refund of the unreleased remainder — per
    ///         technical-architecture.md §2.7, contributors are made whole
    ///         only for the share of the goal that was never released to a
    ///         confirmed milestone, not a full clawback of tranches already
    ///         spent on milestones genuinely delivered.
    function refund(uint256 campaignId) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(c.status == CampaignStatus.CANCELLED, "HumfiverseMilestoneEscrow: not cancelled");
        uint256 contributed = contributions[campaignId][msg.sender];
        require(contributed > 0, "HumfiverseMilestoneEscrow: nothing to refund");

        contributions[campaignId][msg.sender] = 0;
        uint256 unreleasedBps = 10_000 - c.releasedBps;
        uint256 amount = (contributed * unreleasedBps) / 10_000;

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "HumfiverseMilestoneEscrow: refund failed");

        emit Refunded(campaignId, msg.sender, amount);
    }

    function getMilestones(uint256 campaignId) external view returns (Milestone[] memory) {
        return campaignMilestones[campaignId];
    }
}
