// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title HumfiverseMilestoneEscrow
/// @notice TESTNET DEMO CONTRACT — not audited, not for real funds, not a
///         security offering. Pre-production financing escrow: contributed
///         ETH sits in this contract, never reaching the artist directly,
///         until Humfiverse (the contract owner) confirms each milestone
///         was genuinely met — see planning/technical-architecture.md §2.7
///         and legal-regulatory-notes.md §4 on why this is an "attested"
///         (platform-confirmed) design, not a trustless one, and why that's
///         an honest tradeoff to state rather than overstate decentralization.
///
///         The "book the studio" milestone is where the guarantor role
///         becomes concrete rather than just a promise: its tranche is paid
///         straight to the chosen studio's registered wallet, never to the
///         artist. The artist commits to recording at that studio when the
///         campaign is created; the contract — not the artist's discretion —
///         is what makes sure the money earmarked for that actually gets
///         there.
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

    uint256 private nextCampaignId = 1;
    uint256 private nextStudioId = 1;

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => Milestone[]) private campaignMilestones;
    mapping(uint256 => mapping(address => uint256)) public contributions; // campaignId => contributor => wei contributed
    mapping(uint256 => Studio) public studios;
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
    event MilestoneConfirmed(uint256 indexed campaignId, uint256 indexed milestoneIndex, address indexed payee, uint256 amount);
    event CampaignCancelled(uint256 indexed campaignId);
    event Refunded(uint256 indexed campaignId, address indexed contributor, uint256 amount);

    constructor() Ownable(msg.sender) {}

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
        string[] calldata milestoneNames,
        uint16[] calldata milestoneBps,
        Payee[] calldata milestonePayees
    ) external onlyOwner returns (uint256 campaignId) {
        require(artist != address(0), "HumfiverseMilestoneEscrow: zero artist");
        require(fundingGoal > 0, "HumfiverseMilestoneEscrow: goal must be > 0");
        require(bytes(assetId).length > 0, "HumfiverseMilestoneEscrow: assetId required");
        require(campaignIdByAssetId[assetId] == 0, "HumfiverseMilestoneEscrow: asset already has a campaign");
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
        for (uint256 i = 0; i < milestoneNames.length; i++) {
            campaignMilestones[campaignId].push(
                Milestone({name: milestoneNames[i], bps: milestoneBps[i], payee: milestonePayees[i], released: false})
            );
        }
        emit CampaignCreated(campaignId, artist, fundingGoal, studioId, deadline, assetId);
    }

    function contribute(uint256 campaignId) external payable nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(c.artist != address(0), "HumfiverseMilestoneEscrow: unknown campaign");
        require(c.status == CampaignStatus.ACTIVE, "HumfiverseMilestoneEscrow: not active");
        require(msg.value > 0, "HumfiverseMilestoneEscrow: zero contribution");
        require(c.deadline == 0 || block.timestamp <= c.deadline, "HumfiverseMilestoneEscrow: campaign ended");

        c.raised += msg.value;
        contributions[campaignId][msg.sender] += msg.value;
        emit Contributed(campaignId, msg.sender, msg.value, c.raised);
    }

    /// @notice Owner-only: Humfiverse confirms a milestone was genuinely met
    ///         and releases its tranche — to the studio's wallet if this is
    ///         the studio-commitment milestone, otherwise to the artist.
    ///         Reverts if the campaign hasn't raised enough yet to cover
    ///         this milestone's share of the goal.
    function confirmMilestone(uint256 campaignId, uint256 milestoneIndex) external onlyOwner nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(c.status == CampaignStatus.ACTIVE, "HumfiverseMilestoneEscrow: not active");
        Milestone[] storage milestones = campaignMilestones[campaignId];
        require(milestoneIndex < milestones.length, "HumfiverseMilestoneEscrow: bad index");
        Milestone storage m = milestones[milestoneIndex];
        require(!m.released, "HumfiverseMilestoneEscrow: already released");

        uint256 amount = (c.fundingGoal * m.bps) / 10_000;
        require(c.raised >= amount, "HumfiverseMilestoneEscrow: not enough raised for this tranche");

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
