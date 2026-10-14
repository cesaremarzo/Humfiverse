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
///
///         Cancelling and refunds (phase 2, §2.92): only the owner cancels,
///         and a campaign whose milestones are all released can be cancelled
///         only on a legal ground (unlawful content, third-party rights,
///         false artist warranties), recorded on chain with the hash of the
///         written decision. What was unreleased at cancellation is shared
///         over the tokens sold at that moment, and whoever holds them
///         claims it by handing the tokens back to be burned — a resale
///         buyer included, and nobody keeps both the money and the token.
///         Raise deadline and minimum (§2.114): every campaign has a date
///         by which at least `minRaiseOf` must be raised, both fixed at
///         creation from what the artist signed. Until the minimum is in, no
///         tranche is released. If the date passes below it, the campaign has
///         failed — by rule, with nobody deciding: contributions and
///         confirmations stop, and the first refund settles it and opens
///         refunds for every holder. Once the minimum is reached the date no
///         longer matters, and the campaign ends as before: by selling out,
///         by releasing every milestone, or by cancellation.
///         Studios are verified, not declared (§2.110): only the owner
///         registers one, after checking off chain who runs it, because a
///         studio the artist names is too often a second wallet of the
///         artist's own — two confirmations from one person. A campaign
///         with no studio stays possible, and there the artist's word alone
///         releases each tranche; that is disclosed, not prevented.
///         Milestone kinds (§2.119): the artist may make the first milestone
///         an ADVANCE, paid to the artist as soon as the raise covers it, with
///         no confirmation — the contract already knows the money is in, so a
///         studio signature there attested nothing. A RELEASE milestone (the
///         track is out) still needs both confirmations, and the artist's
///         carries a link to the published track, kept on chain.
/// @dev Campaigns are created by the platform (the owner or the operator,
///      the backend's key), mirroring how HumfiverseCatalogueToken.mintCatalogue
///      is triggered by the backend after a user completes the onboarding
///      wizard, not called directly from an artist's own wallet. A campaign's
///      artist must be its token's payout wallet, and a token has at most
///      one campaign (§2.110).
contract HumfiverseMilestoneEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Payee {
        ARTIST,
        STUDIO
    }
    enum CampaignStatus {
        ACTIVE,
        CANCELLED,
        FAILED // §2.114: past its raise deadline below its minimum, settled
    }
    /// @notice Why a campaign was cancelled. Every cancellation names a
    ///         ground and the hash of the written decision (§2.116): NONE is
    ///         kept only so the existing numbers stay put, and is refused.
    ///         ABANDONED is the way out for a project that stopped after its
    ///         minimum was raised, and only once nothing has moved for
    ///         ABANDON_AFTER.
    enum CancelGround {
        NONE,
        UNLAWFUL_CONTENT,
        THIRD_PARTY_RIGHTS,
        FALSE_WARRANTIES,
        ABANDONED
    }

    /// @notice §2.119. STANDARD: artist and studio confirm. ADVANCE: first
    ///         milestone only, paid to the artist, released by the raise
    ///         alone. RELEASE: artist and studio confirm, and the artist's
    ///         confirmation names the published track.
    enum MilestoneKind {
        STANDARD,
        ADVANCE,
        RELEASE
    }

    struct Milestone {
        string name;
        uint16 bps; // share of fundingGoal this tranche represents, out of 10,000
        Payee payee;
        bool released;
        MilestoneKind kind;
        string link; // RELEASE: the published track, set by the artist's confirmation
    }

    struct Campaign {
        address artist;
        uint256 studioId; // 0 = no studio required for this campaign
        uint256 fundingGoal; // paymentToken base units (USDC: 1e6 = $1)
        uint256 raised; // credited to the campaign, net of the contribution fee
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

    /// @notice The backend's key: may create campaigns and deactivate a
    ///         studio. It cannot register, rename or reactivate a studio
    ///         (§2.110), cancel, change fees or move funds. Zero means only
    ///         the owner can.
    address public operator;

    /// @notice campaignId => the ground it was cancelled on.
    mapping(uint256 => CancelGround) public cancelGroundOf;
    /// @notice campaignId => unreleased money still to be refunded. Set at
    ///         cancellation to raised - released, reduced by each refund.
    mapping(uint256 => uint256) public refundPoolOf;
    /// @notice campaignId => tokens that can still claim refundPoolOf. Set at
    ///         cancellation to the tokens sold and not burned, reduced by each
    ///         refund, so the last token takes any rounding remainder.
    mapping(uint256 => uint256) public refundTokensOf;

    /// @notice §2.114: campaignId => unix time by which the minimum must be
    ///         raised. Set once at creation.
    mapping(uint256 => uint64) public raiseDeadlineOf;
    /// @notice §2.114: campaignId => the minimum, in paymentToken base units
    ///         credited (net of the contribution fee, like `raised`) — the
    ///         artist's percentage of fundingTargetOf, so X% means X% of the
    ///         tokens sold.
    mapping(uint256 => uint256) public minRaiseOf;

    /// @notice Longest raise period a campaign may set.
    uint256 public constant MAX_RAISE_PERIOD = 365 days;

    /// @notice §2.116: how long a campaign must go without progress — its
    ///         minimum reached or a tranche released — before it can be
    ///         cancelled as abandoned.
    uint256 public constant ABANDON_AFTER = 180 days;
    /// @notice campaignId => when the campaign last made progress: the moment
    ///         its minimum was reached, then each release. 0 before the minimum.
    mapping(uint256 => uint256) public lastProgressAt;
    /// @notice campaignId => an artist wallet proposed by the current one and
    ///         not yet accepted (§2.117). It must already be the token's payout
    ///         wallet when it accepts, so the campaign and the token never pay
    ///         two different wallets.
    mapping(uint256 => address) public pendingArtistOf;

    uint256 private nextCampaignId = 1;
    uint256 private nextStudioId = 1;

    mapping(uint256 => Campaign) public campaigns;
    /// @notice campaignId => the HumfiverseCatalogueToken token id this
    ///         campaign's contributions release from, set once at
    ///         createCampaign and never changed.
    mapping(uint256 => uint256) public campaignTokenId;
    mapping(uint256 => Milestone[]) private campaignMilestones;
    /// @notice campaignId => contributor => amount credited. A record of who
    ///         paid what; since phase 2 refunds follow tokens held, not this.
    mapping(uint256 => mapping(address => uint256)) public contributions;
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
    /// @notice tokenId => its campaign, 0 = none (§2.110). Refunds are
    ///         shared over every token of the id that left the pool, so two
    ///         campaigns on one token would pay each other's contributors.
    mapping(uint256 => uint256) public campaignIdByTokenId;

    event StudioRegistered(uint256 indexed studioId, address indexed wallet, string name);
    event StudioActiveSet(uint256 indexed studioId, bool active);
    event StudioRenamed(uint256 indexed studioId, string previousName, string newName);
    event CampaignCreated(uint256 indexed campaignId, address indexed artist, uint256 fundingGoal, uint256 studioId, string assetId);
    event Contributed(uint256 indexed campaignId, address indexed contributor, uint256 amount, uint256 totalRaised);
    event MilestoneConfirmedByArtist(uint256 indexed campaignId, uint256 indexed milestoneIndex);
    event MilestoneConfirmedByStudio(uint256 indexed campaignId, uint256 indexed milestoneIndex);
    event MilestoneConfirmed(uint256 indexed campaignId, uint256 indexed milestoneIndex, address indexed payee, uint256 amount);
    event ReleaseLinkSet(uint256 indexed campaignId, uint256 indexed milestoneIndex, string link);
    event CampaignCancelled(uint256 indexed campaignId, CancelGround ground, bytes32 decisionHash, uint256 refundPool, uint256 refundTokens);
    event Refunded(uint256 indexed campaignId, address indexed holder, uint256 tokensBurned, uint256 amount);
    event RaiseTermsSet(uint256 indexed campaignId, uint64 raiseDeadline, uint256 minRaise);
    event CampaignFailed(uint256 indexed campaignId, uint256 refundPool, uint256 refundTokens);
    event ArtistProposed(uint256 indexed campaignId, address indexed current, address indexed next);
    event ArtistChanged(uint256 indexed campaignId, address indexed previous, address indexed next);
    event OperatorUpdated(address indexed previous, address indexed next);
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

    /// @notice Owner-only: sets (or, with address(0), removes) the operator.
    function setOperator(address next) external onlyOwner {
        emit OperatorUpdated(operator, next);
        operator = next;
    }

    modifier onlyOwnerOrOperator() {
        require(msg.sender == owner() || (operator != address(0) && msg.sender == operator), "HumfiverseMilestoneEscrow: not authorized");
        _;
    }

    // --- studio registry (verified by the owner, §2.110) ---

    /// @notice Owner-only: adds a studio once it has been checked off chain
    ///         that `wallet` belongs to a real studio, run by someone other
    ///         than the artists who will name it.
    function registerStudio(address wallet, string calldata name) external onlyOwner returns (uint256 studioId) {
        require(wallet != address(0), "HumfiverseMilestoneEscrow: zero address");
        studioId = nextStudioId++;
        studios[studioId] = Studio({name: name, wallet: wallet, active: true});
        emit StudioRegistered(studioId, wallet, name);
    }

    /// @notice The owner may switch a studio either way; the operator may
    ///         only switch one off, the safe direction, so a doubt about a
    ///         studio can stop new campaigns without waiting for the Safe.
    function setStudioActive(uint256 studioId, bool active) external onlyOwnerOrOperator {
        require(studios[studioId].wallet != address(0), "HumfiverseMilestoneEscrow: unknown studio");
        require(!active || msg.sender == owner(), "HumfiverseMilestoneEscrow: only the owner activates a studio");
        studios[studioId].active = active;
        emit StudioActiveSet(studioId, active);
    }

    /// @notice Corrects a studio's on-chain name after registration — an
    ///         admin fix for a genuine mistake (e.g. a wrong name registered
    ///         for a wallet that was then reused for a different campaign),
    ///         not a way to silently rewrite history for an active dispute.
    ///         Every campaign already pointing at this studioId picks up
    ///         the new name immediately, since campaigns store a studioId,
    ///         not a name. Owner-only, like registration: the name is part
    ///         of what was verified.
    function renameStudio(uint256 studioId, string calldata name) external onlyOwner {
        require(studios[studioId].wallet != address(0), "HumfiverseMilestoneEscrow: unknown studio");
        emit StudioRenamed(studioId, studios[studioId].name, name);
        studios[studioId].name = name;
    }

    // --- campaign lifecycle ---

    /// @notice The goal is not a parameter (§2.79): it is the linked token's
    ///         price times its supply, so a campaign always aims for exactly
    ///         what selling every token raises — never more tokens than the
    ///         goal pays for, never a goal the tokens cannot reach. The raise
    ///         deadline and the minimum, as a share of that goal in bps, are
    ///         (§2.114).
    function createCampaign(
        address artist,
        uint256 studioId,
        string calldata assetId,
        uint256 tokenId,
        string[] calldata milestoneNames,
        uint16[] calldata milestoneBps,
        Payee[] calldata milestonePayees,
        MilestoneKind[] calldata milestoneKinds,
        uint64 raiseDeadline,
        uint16 minRaiseBps
    ) external onlyOwnerOrOperator returns (uint256 campaignId) {
        require(raiseDeadline > block.timestamp, "HumfiverseMilestoneEscrow: raise deadline must be in the future");
        require(raiseDeadline <= block.timestamp + MAX_RAISE_PERIOD, "HumfiverseMilestoneEscrow: raise deadline too far");
        require(minRaiseBps > 0 && minRaiseBps <= 10_000, "HumfiverseMilestoneEscrow: minimum out of range");
        require(artist != address(0), "HumfiverseMilestoneEscrow: zero artist");
        require(bytes(assetId).length > 0, "HumfiverseMilestoneEscrow: assetId required");
        require(campaignIdByAssetId[assetId] == 0, "HumfiverseMilestoneEscrow: asset already has a campaign");
        // The token must already be minted (backend mints on upload, before
        // creating the campaign — same order the frontend now awaits) so
        // contribute() below always has a real pool to release from.
        require(catalogueToken.totalSupplyOf(tokenId) > 0, "HumfiverseMilestoneEscrow: unknown token id");
        require(campaignIdByTokenId[tokenId] == 0, "HumfiverseMilestoneEscrow: token already has a campaign");
        // §2.110: the artist is whoever the token pays — the wallet that
        // signed the launch — not a free argument the operator's key could
        // point anywhere, e.g. at a campaign for someone else's fresh token.
        require(artist == catalogueToken.payoutOf(tokenId), "HumfiverseMilestoneEscrow: artist is not the token's payout wallet");
        uint256 fundingGoal = catalogueToken.fundingOf(tokenId);
        require(fundingGoal > 0, "HumfiverseMilestoneEscrow: token is not for sale");
        // §2.81: the goal is every token's value, so every token must still be
        // unsold and unsellable outside this campaign.
        require(!catalogueToken.directSaleOf(tokenId), "HumfiverseMilestoneEscrow: token is on direct sale");
        require(catalogueToken.releasedOf(tokenId) == 0, "HumfiverseMilestoneEscrow: tokens already sold outside the escrow");
        require(
            milestoneNames.length == milestoneBps.length &&
                milestoneNames.length == milestonePayees.length &&
                milestoneNames.length == milestoneKinds.length,
            "HumfiverseMilestoneEscrow: length mismatch"
        );
        require(milestoneNames.length > 0, "HumfiverseMilestoneEscrow: no milestones");
        if (studioId != 0) {
            require(studios[studioId].active, "HumfiverseMilestoneEscrow: studio not active");
            // §2.89: a milestone releases on two independent confirmations,
            // which one wallet in both roles would give alone.
            require(studios[studioId].wallet != artist, "HumfiverseMilestoneEscrow: studio wallet is the artist");
        }

        uint256 totalBps;
        for (uint256 i = 0; i < milestoneBps.length; i++) {
            totalBps += milestoneBps[i];
            if (milestonePayees[i] == Payee.STUDIO) {
                require(studioId != 0, "HumfiverseMilestoneEscrow: studio milestone needs a studio");
            }
            // §2.119: an advance is the artist's money up front, so it comes
            // first — every later milestone waits for it anyway.
            if (milestoneKinds[i] == MilestoneKind.ADVANCE) {
                require(i == 0, "HumfiverseMilestoneEscrow: only the first milestone can be an advance");
                require(milestonePayees[i] == Payee.ARTIST, "HumfiverseMilestoneEscrow: an advance is paid to the artist");
            }
        }
        require(totalBps == 10_000, "HumfiverseMilestoneEscrow: bps must total 10000");

        campaignId = nextCampaignId++;
        campaigns[campaignId] = Campaign({
            artist: artist,
            studioId: studioId,
            fundingGoal: fundingGoal,
            raised: 0,
            status: CampaignStatus.ACTIVE,
            releasedBps: 0,
            assetId: assetId
        });
        campaignIdByAssetId[assetId] = campaignId;
        campaignIdByTokenId[tokenId] = campaignId;
        campaignTokenId[campaignId] = tokenId;
        for (uint256 i = 0; i < milestoneNames.length; i++) {
            campaignMilestones[campaignId].push(
                Milestone({
                    name: milestoneNames[i],
                    bps: milestoneBps[i],
                    payee: milestonePayees[i],
                    released: false,
                    kind: milestoneKinds[i],
                    link: ""
                })
            );
        }
        raiseDeadlineOf[campaignId] = raiseDeadline;
        minRaiseOf[campaignId] = (fundingTargetOf(campaignId) * minRaiseBps) / 10_000;
        emit CampaignCreated(campaignId, artist, fundingGoal, studioId, assetId);
        emit RaiseTermsSet(campaignId, raiseDeadline, minRaiseOf[campaignId]);
    }

    /// @notice The campaign's artist proposes a new wallet (§2.117);
    ///         address(0) withdraws a proposal. Nobody else can move it.
    function proposeArtist(uint256 campaignId, address next) external {
        Campaign storage c = campaigns[campaignId];
        require(c.artist != address(0) && msg.sender == c.artist, "HumfiverseMilestoneEscrow: not this campaign's artist");
        require(next != c.artist, "HumfiverseMilestoneEscrow: already the artist");
        pendingArtistOf[campaignId] = next;
        emit ArtistProposed(campaignId, c.artist, next);
    }

    /// @notice The proposed wallet becomes the artist — confirming milestones
    ///         and receiving the artist's tranches — once it is the token's
    ///         payout wallet too, and is not the studio.
    function acceptArtist(uint256 campaignId) external {
        Campaign storage c = campaigns[campaignId];
        require(msg.sender != address(0) && msg.sender == pendingArtistOf[campaignId], "HumfiverseMilestoneEscrow: not the proposed artist");
        require(msg.sender == catalogueToken.payoutOf(campaignTokenId[campaignId]), "HumfiverseMilestoneEscrow: move the token's payout first");
        if (c.studioId != 0) require(studios[c.studioId].wallet != msg.sender, "HumfiverseMilestoneEscrow: studio wallet is the artist");
        address previous = c.artist;
        c.artist = msg.sender;
        delete pendingArtistOf[campaignId];
        emit ArtistChanged(campaignId, previous, msg.sender);
    }

    /// @notice §2.114: the minimum is in. It stays in: `raised` never falls.
    function minRaiseReached(uint256 campaignId) public view returns (bool) {
        return campaigns[campaignId].raised >= minRaiseOf[campaignId];
    }

    /// @notice §2.114: past the raise deadline below the minimum — failed by
    ///         rule, whether or not a refund has settled it yet.
    function raiseFailed(uint256 campaignId) public view returns (bool) {
        Campaign storage c = campaigns[campaignId];
        if (c.status == CampaignStatus.FAILED) return true;
        return c.status == CampaignStatus.ACTIVE && c.artist != address(0) && block.timestamp > raiseDeadlineOf[campaignId] && !minRaiseReached(campaignId);
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
    ///         Paid in paymentToken: the contributor approves this contract for
    ///         `amount` first.
    function contribute(uint256 campaignId, uint256 amount) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(c.artist != address(0), "HumfiverseMilestoneEscrow: unknown campaign");
        require(c.status == CampaignStatus.ACTIVE, "HumfiverseMilestoneEscrow: not active");
        require(!raiseFailed(campaignId), "HumfiverseMilestoneEscrow: raise failed");
        require(amount > 0, "HumfiverseMilestoneEscrow: zero contribution");
        uint256 tokenId = campaignTokenId[campaignId];
        uint256 price = catalogueToken.pricePerToken(tokenId);
        // §2.79: a contribution buys whole tokens at the one price every token
        // of this campaign has. Anything else would be money that buys no
        // token — or, spread across contributors, tokens of unequal value.
        require(amount % price == 0, "HumfiverseMilestoneEscrow: amount must buy whole tokens");

        paymentToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 fee = (amount * CONTRIBUTION_FEE_BPS) / 10_000;
        uint256 credited = amount - fee;
        bool wasBelowMinimum = !minRaiseReached(campaignId);
        c.raised += credited;
        if (wasBelowMinimum && minRaiseReached(campaignId)) lastProgressAt[campaignId] = block.timestamp;
        contributions[campaignId][msg.sender] += credited;
        accruedFees += fee;
        totalFeesCollected += fee;
        campaignFeesCollected[campaignId] += fee;
        emit ContributionFeeRetained(campaignId, msg.sender, fee);
        emit Contributed(campaignId, msg.sender, credited, c.raised);

        // Tokens for the whole amount sent: the fee is the platform's share of
        // the price, not a smaller purchase.
        catalogueToken.releaseFromPool(msg.sender, tokenId, amount / price);

        // §2.119: only a contribution can cover an advance, so this is the one
        // place it needs checking; _tryRelease does nothing until it is covered.
        if (campaignMilestones[campaignId][0].kind == MilestoneKind.ADVANCE) _tryRelease(campaignId, 0);
    }

    /// @notice The artist attests a milestone was genuinely met. Combined
    ///         with confirmMilestoneAsStudio below, this is the *only* path
    ///         to releasing a tranche — see the contract-level note on why
    ///         Humfiverse deliberately has no confirmation power of its own
    ///         (§2.27). If the campaign has no studio (studioId == 0), the
    ///         artist's confirmation alone is sufficient, since there's no
    ///         second party to attest against.
    function confirmMilestoneAsArtist(uint256 campaignId, uint256 milestoneIndex) external nonReentrant {
        require(msg.sender == campaigns[campaignId].artist, "HumfiverseMilestoneEscrow: not this campaign's artist");
        Milestone storage m = _confirmable(campaignId, milestoneIndex);
        require(m.kind != MilestoneKind.RELEASE, "HumfiverseMilestoneEscrow: a release needs the track's link");
        artistConfirmed[campaignId][milestoneIndex] = true;
        emit MilestoneConfirmedByArtist(campaignId, milestoneIndex);
        _tryRelease(campaignId, milestoneIndex);
    }

    /// @notice §2.119: the artist confirms a RELEASE milestone by naming the
    ///         published track. The link stays on chain with the milestone;
    ///         confirming again before the release replaces it. The studio
    ///         still confirms separately, as on every milestone.
    function confirmReleaseAsArtist(uint256 campaignId, uint256 milestoneIndex, string calldata link) external nonReentrant {
        require(msg.sender == campaigns[campaignId].artist, "HumfiverseMilestoneEscrow: not this campaign's artist");
        Milestone storage m = _confirmable(campaignId, milestoneIndex);
        require(m.kind == MilestoneKind.RELEASE, "HumfiverseMilestoneEscrow: not a release milestone");
        require(bytes(link).length > 0 && bytes(link).length <= 512, "HumfiverseMilestoneEscrow: link required");
        m.link = link;
        artistConfirmed[campaignId][milestoneIndex] = true;
        emit ReleaseLinkSet(campaignId, milestoneIndex, link);
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
        _confirmable(campaignId, milestoneIndex);
        studioConfirmed[campaignId][milestoneIndex] = true;
        emit MilestoneConfirmedByStudio(campaignId, milestoneIndex);
        _tryRelease(campaignId, milestoneIndex);
    }

    /// @notice The checks both sides' confirmations share. An ADVANCE is not
    ///         confirmed by anyone: the raise releases it (§2.119).
    function _confirmable(uint256 campaignId, uint256 milestoneIndex) private view returns (Milestone storage m) {
        require(campaigns[campaignId].status == CampaignStatus.ACTIVE, "HumfiverseMilestoneEscrow: not active");
        require(!raiseFailed(campaignId), "HumfiverseMilestoneEscrow: raise failed");
        require(milestoneIndex < campaignMilestones[campaignId].length, "HumfiverseMilestoneEscrow: bad index");
        m = campaignMilestones[campaignId][milestoneIndex];
        require(!m.released, "HumfiverseMilestoneEscrow: already released");
        require(m.kind != MilestoneKind.ADVANCE, "HumfiverseMilestoneEscrow: an advance releases on funding");
        _requirePreviousReleased(campaignId, milestoneIndex);
    }

    /// @notice Tranches release in the order the artist set them at campaign
    ///         creation (§2.96): a milestone cannot be confirmed until the one
    ///         before it is released, however much has been raised. Without
    ///         this, the cumulative funding gate in _tryRelease let a later
    ///         milestone jump ahead of an earlier one that was not delivered.
    function _requirePreviousReleased(uint256 campaignId, uint256 milestoneIndex) private view {
        require(
            milestoneIndex == 0 || campaignMilestones[campaignId][milestoneIndex - 1].released,
            "HumfiverseMilestoneEscrow: previous milestone not released"
        );
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
    ///         on a single party's say-so, Humfiverse's included. An ADVANCE
    ///         (§2.119) is released on nobody's say-so: by the raise alone. If the two
    ///         sides never agree, this simply never runs — the funds stay in
    ///         the contract indefinitely (no arbitration/timeout here).
    function _tryRelease(uint256 campaignId, uint256 milestoneIndex) private {
        Campaign storage c = campaigns[campaignId];
        if (c.status != CampaignStatus.ACTIVE) return;
        Milestone[] storage milestones = campaignMilestones[campaignId];
        if (milestoneIndex >= milestones.length) return;
        Milestone storage m = milestones[milestoneIndex];
        if (m.released) return;

        if (m.kind != MilestoneKind.ADVANCE) {
            bool studioSideDone = c.studioId == 0 || studioConfirmed[campaignId][milestoneIndex];
            if (!(artistConfirmed[campaignId][milestoneIndex] && studioSideDone)) return;
        }

        // §2.114: nothing leaves before the minimum is in.
        if (!minRaiseReached(campaignId)) return;
        uint256 target = fundingTargetOf(campaignId);
        // Not enough raised yet — releases once it is, on the next confirming call.
        if (c.raised < (target * (c.releasedBps + m.bps)) / 10_000) return;

        uint256 amount = (target * m.bps) / 10_000;
        uint256 fee = (amount * MILESTONE_FEE_BPS) / 10_000;
        uint256 payout = amount - fee;

        m.released = true;
        c.releasedBps += m.bps;
        lastProgressAt[campaignId] = block.timestamp;
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

    /// @notice Owner-only: stops contributions and releases, and opens
    ///         refunds of whatever was not released. Always on a ground, with
    ///         `decisionHash`, the hash of the written, reasoned decision kept
    ///         off chain (§2.116). The three legal grounds work at any time,
    ///         a fully released campaign included, for the takedown that goes
    ///         with them. ABANDONED needs the minimum reached, something still
    ///         unreleased, and ABANDON_AFTER without progress.
    function cancelCampaign(uint256 campaignId, CancelGround ground, bytes32 decisionHash) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        require(c.artist != address(0), "HumfiverseMilestoneEscrow: unknown campaign");
        require(c.status == CampaignStatus.ACTIVE, "HumfiverseMilestoneEscrow: not active");
        // §2.114: a failed raise refunds by rule; a cancellation would only
        // relabel it as someone's decision.
        require(!raiseFailed(campaignId), "HumfiverseMilestoneEscrow: raise failed, refunds are open");
        require(ground != CancelGround.NONE, "HumfiverseMilestoneEscrow: a cancellation needs a ground");
        require(decisionHash != bytes32(0), "HumfiverseMilestoneEscrow: a cancellation needs a decision hash");
        if (ground == CancelGround.ABANDONED) {
            require(minRaiseReached(campaignId), "HumfiverseMilestoneEscrow: below the minimum the deadline decides");
            require(c.releasedBps < 10_000, "HumfiverseMilestoneEscrow: fully released, nothing abandoned");
            require(block.timestamp >= lastProgressAt[campaignId] + ABANDON_AFTER, "HumfiverseMilestoneEscrow: not abandoned yet");
        }

        uint256 tokenId = campaignTokenId[campaignId];
        c.status = CampaignStatus.CANCELLED;
        cancelGroundOf[campaignId] = ground;
        refundPoolOf[campaignId] = c.raised - campaignReleased[campaignId];
        // Sold tokens: everything that left the pool, less anything burned.
        // The pool closes here, so this count cannot grow under the refunds.
        refundTokensOf[campaignId] = catalogueToken.releasedOf(tokenId) - catalogueToken.burnedOf(tokenId);
        catalogueToken.closePool(tokenId);
        emit CampaignCancelled(campaignId, ground, decisionHash, refundPoolOf[campaignId], refundTokensOf[campaignId]);
    }

    /// @notice Hands back `tokens` of a cancelled campaign's token, which are
    ///         burned, for their share of what was unreleased at cancellation
    ///         (§2.92). Per technical-architecture.md §2.7 holders are made
    ///         whole only for money never released to a confirmed milestone;
    ///         the contribution fee is never refunded. Each refund pays
    ///         refundPool × tokens / refundTokens and takes both down, so the
    ///         rate stays the same for everyone and the last token takes any
    ///         rounding remainder. Royalties the tokens earned before the burn
    ///         stay claimable on the token contract.
    ///         A failed raise (§2.114) refunds the same way: the first refund
    ///         after the deadline settles it — status FAILED, pool and token
    ///         count fixed, token pool closed — so nobody has to trigger it.
    function refund(uint256 campaignId, uint256 tokens) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        if (c.status == CampaignStatus.ACTIVE && raiseFailed(campaignId)) _settleFailed(campaignId);
        require(c.status == CampaignStatus.CANCELLED || c.status == CampaignStatus.FAILED, "HumfiverseMilestoneEscrow: not refundable");
        require(tokens > 0, "HumfiverseMilestoneEscrow: zero tokens");
        uint256 remainingTokens = refundTokensOf[campaignId];
        require(tokens <= remainingTokens, "HumfiverseMilestoneEscrow: more tokens than refundable");

        uint256 amount = (refundPoolOf[campaignId] * tokens) / remainingTokens;
        require(amount > 0, "HumfiverseMilestoneEscrow: nothing to refund");
        refundPoolOf[campaignId] -= amount;
        refundTokensOf[campaignId] = remainingTokens - tokens;

        // Reverts unless the caller holds the tokens.
        catalogueToken.burnForRefund(msg.sender, campaignTokenId[campaignId], tokens);
        paymentToken.safeTransfer(msg.sender, amount);

        emit Refunded(campaignId, msg.sender, tokens, amount);
    }

    /// @notice §2.114: fixes a failed raise's refund pool and token count,
    ///         exactly as cancelCampaign does, and closes the token pool.
    ///         Nothing was released (no tranche leaves below the minimum), so
    ///         the pool is everything raised.
    function _settleFailed(uint256 campaignId) private {
        Campaign storage c = campaigns[campaignId];
        uint256 tokenId = campaignTokenId[campaignId];
        c.status = CampaignStatus.FAILED;
        refundPoolOf[campaignId] = c.raised - campaignReleased[campaignId];
        refundTokensOf[campaignId] = catalogueToken.releasedOf(tokenId) - catalogueToken.burnedOf(tokenId);
        catalogueToken.closePool(tokenId);
        emit CampaignFailed(campaignId, refundPoolOf[campaignId], refundTokensOf[campaignId]);
    }

    /// @notice What `tokens` would refund right now; 0 if not refundable.
    ///         For a failed raise not yet settled, what settling would give.
    function refundQuote(uint256 campaignId, uint256 tokens) external view returns (uint256) {
        Campaign storage c = campaigns[campaignId];
        uint256 pool;
        uint256 remainingTokens;
        if (c.status == CampaignStatus.CANCELLED || c.status == CampaignStatus.FAILED) {
            pool = refundPoolOf[campaignId];
            remainingTokens = refundTokensOf[campaignId];
        } else if (raiseFailed(campaignId)) {
            uint256 tokenId = campaignTokenId[campaignId];
            pool = c.raised - campaignReleased[campaignId];
            remainingTokens = catalogueToken.releasedOf(tokenId) - catalogueToken.burnedOf(tokenId);
        } else {
            return 0;
        }
        if (tokens == 0 || tokens > remainingTokens) return 0;
        return (pool * tokens) / remainingTokens;
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
