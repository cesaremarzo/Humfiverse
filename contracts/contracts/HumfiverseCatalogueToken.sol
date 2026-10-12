// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title HumfiverseCatalogueToken
/// @notice TESTNET DEMO CONTRACT — not audited, not for real funds, not a
///         security offering. Mints a fixed supply of tokens for each
///         fictional demo catalogue (see planning docs / docs/index.html
///         ASSETS) and holds them in the contract's own balance as the
///         "platform pool" until released to a buyer address by the
///         owner. This mirrors the mock ASSETS.tokensSold /
///         ASSETS.tokensTotal split in the site's frontend — it does NOT
///         implement KYC/AML, payment, transfer restrictions, or any of
///         the compliance layer described in planning/legal-regulatory-notes.md.
///         A real offering would need a permissioned/whitelisted transfer
///         standard (ERC-3643-style) per technical-architecture.md §2.4,
///         not this plain ERC-1155.
///
///         Royalties (§2.92, §2.101): whoever holds the income a catalogue
///         earns deposits it with depositRoyalties, the platform's 1% for
///         running the distribution is deducted, and every token of that id
///         earns the same share of the rest — including the tokens still in the
///         pool, whose share belongs to the token's payout wallet (the
///         artist kept that part of the income by not selling it). Holders
///         pull their share with claimRoyalties; nothing is pushed, so a
///         wallet that cannot receive cannot block a deposit.
///
///         A deposit pays for the time since the previous one (§2.110): each
///         holder's share is the tokens they held multiplied by how long they
///         held them in that window, over every outstanding token times the
///         window's length. A buyer who arrives a minute before a deposit
///         earns a minute's worth of it, not a full share — so buying the
///         pool just ahead of a large deposit no longer takes the income the
///         artist's unsold tokens earned all quarter. A seller keeps what its
///         tokens earned while it held them. There is still no snapshot to
///         take and no list of holders to walk: each account carries its
///         own running total, settled on every transfer.
/// @dev Each catalogue is one ERC-1155 token id. Supply per id is minted
///      once, entirely to address(this) (the pool). `releaseFromPool`
///      and `buy` are the only ways tokens leave the pool.
///
///      Roles (phase 2): `owner()` is meant to be a multisig and keeps
///      every power that moves value or rewires the contract; `operator`
///      is the backend's key and can only mint a new catalogue, link its
///      audio once and clear that link (§2.110). The owner can do all of it.
contract HumfiverseCatalogueToken is ERC1155, Ownable, ERC1155Holder, ReentrancyGuard {
    using SafeERC20 for IERC20;

    string public constant NAME = "Humfiverse Catalogue Tokens (Testnet Demo)";

    /// @notice catalogue slug (matches the id used in docs/index.html ASSETS / server/seed-data.js)
    mapping(uint256 => string) public catalogueSlug;
    /// @notice track title and artist name, written on mint so they're
    ///         readable directly on-chain (a verified explorer decodes both
    ///         the CatalogueMinted event and these view functions), not
    ///         only in the off-chain database — see
    ///         planning/technical-architecture.md §2.24.
    mapping(uint256 => string) public trackTitle;
    mapping(uint256 => string) public artistName;
    /// @notice IPFS URI (`ipfs://<cid>`) for the actual uploaded track audio
    ///         file, e.g. `ipfs://Qm...` — set separately from mint via
    ///         setTrackAudioUri, not a mintCatalogue parameter, since the
    ///         upload (to IPFS, off-chain) and the mint are two independent
    ///         steps that can each fail on their own (§2.43). Empty string
    ///         means no audio has been linked yet. Surfaced in the ERC-1155
    ///         metadata JSON's `animation_url` field (server.js) so wallets/
    ///         marketplaces that support it can play the track directly —
    ///         but the on-chain value here is the source of truth, not that
    ///         JSON, matching this contract's existing pattern for
    ///         trackTitle/artistName (§2.24).
    mapping(uint256 => string) public trackAudioUri;
    /// @notice total minted supply for a given token id
    mapping(uint256 => uint256) public totalSupplyOf;
    /// @notice cumulative amount released from the pool for a given token id
    mapping(uint256 => uint256) public releasedOf;
    /// @notice fixed primary-sale price, in paymentToken base units (USDC:
    ///         1e6 = $1) per token — 0 means "not for
    ///         public sale" (owner-only releaseFromPool still works either way).
    ///         Never set directly (§2.79): mintCatalogue derives it from the
    ///         funding the artist asks for and the supply they choose, and no
    ///         function changes it afterwards, so every token of an id costs
    ///         the same as every other.
    ///         Deliberately a flat price, not a bonding curve or any other
    ///         automatically-updating mechanism — see
    ///         planning/legal-regulatory-notes.md §7.8 on why dynamic pricing
    ///         is a real MTF/OTF-authorization question this project isn't
    ///         answering by writing contract code.
    mapping(uint256 => uint256) public pricePerToken;

    /// @notice The stablecoin every price and payment is denominated in —
    ///         USDC (6 decimals) — fixed at deployment (§2.73). Prices,
    ///         payouts and fees are exact integers of its base unit, so a
    ///         dollar amount to the cent never needs rounding.
    IERC20 public immutable paymentToken;

    /// @notice where primary-sale proceeds go for a token minted without its
    ///         own recipient. Defaults to the deployer.
    address public payoutRecipient;

    /// @notice tokenId => who receives that token's primary-sale proceeds —
    ///         the artist's wallet, set at mint (§2.79). Before this every
    ///         sale paid the single contract-wide payoutRecipient, the
    ///         platform's own wallet (§2.68).
    mapping(uint256 => address) public payoutOf;

    /// @notice tokenId => a payout wallet proposed by the current one and not
    ///         yet accepted (§2.117). Only the artist moves their own payout:
    ///         nobody else — the owner included — can redirect it, so a lost
    ///         key stays lost, but a wallet that must be replaced (compromised,
    ///         blocked by the stablecoin issuer) no longer freezes the token.
    mapping(uint256 => address) public pendingPayoutOf;

    /// @notice tokenId => whether buy() sells it directly (§2.81). False for a
    ///         token whose funding is released by milestones: its only way to
    ///         market is its escrow campaign's contribute(). Set at mint and
    ///         never changed, so there is no window — not even the blocks
    ///         between the mint and the campaign's creation — in which a
    ///         purchase can skip the escrow, pay the artist directly, and
    ///         leave the campaign with fewer tokens than its goal needs.
    mapping(uint256 => bool) public directSaleOf;

    /// @notice The human-readable part of a mint, grouped so mintCatalogue's
    ///         parameters fit the EVM stack once it gained the payout and
    ///         direct-sale arguments (§2.81).
    struct CatalogueText {
        string slug;
        string title;
        string artist;
    }

    /// @notice Platform fee on every paid primary purchase through buy(), in
    ///         basis points of the payment (600 bps = 6.00%), deducted from
    ///         it: the buyer pays the listed price and receives every token,
    ///         and payoutRecipient receives the price less the fee (§2.72,
    ///         §2.101).
    ///
    ///         Higher than the escrow's 2% contribution fee on purpose, and
    ///         not an inconsistency (§2.101): buy() sells a catalogue that
    ///         already earns, with no milestones to release, so this is the
    ///         whole of what the platform ever charges on that raise. An
    ///         escrow campaign charges 2% on arrival and 3% again on each
    ///         tranche it releases — 4.94% of a goal that sells out and
    ///         releases in full. The two paths are priced as a whole, not
    ///         rate by rate.
    ///
    ///         A constant, so the rate cannot change under anyone.
    uint256 public constant PRIMARY_FEE_BPS = 600;

    /// @notice Platform fee on every royalty deposit, in basis points of the
    ///         amount deposited (100 bps = 1.00%), deducted from it before it
    ///         is shared out (§2.101): the depositor sends what the catalogue
    ///         earned, the holders share 99% of it, and the 1% is what the
    ///         platform charges for administering the distribution — the
    ///         per-token accounting, the statement reference, the claims.
    ///
    ///         Charged on the whole deposit, the pool's share included, so
    ///         the rate does not depend on how much of a catalogue has been
    ///         sold: an artist depositing on a catalogue that is mostly
    ///         unsold pays 1% on the part that comes back to their own payout
    ///         wallet too. Making it depend on the sold fraction would price
    ///         the same service differently every deposit.
    ///
    ///         A constant, for the same reason as the fees above.
    uint256 public constant ROYALTY_FEE_BPS = 100;
    /// @notice Where withdrawFees() sends accrued fees. Defaults to the deployer.
    address public feeRecipient;
    /// @notice Fees retained from primary purchases and not yet withdrawn.
    uint256 public accruedFees;
    /// @notice Every fee ever retained, withdrawn or not — never decreases.
    uint256 public totalFeesCollected;

    /// @notice the one other contract, besides the owner, allowed to call
    ///         releaseFromPool — HumfiverseMilestoneEscrow, so a real
    ///         preproduction contribution can release tokens atomically in
    ///         the same transaction, exactly like buy() does for catalogue
    ///         purchases, instead of needing a second, backend-signed
    ///         transaction afterward. Owner-settable so this contract can be
    ///         deployed first and linked to the escrow after (deploy order:
    ///         this contract, then the escrow with this address, then
    ///         setEscrowContract(escrowAddress)).
    address public escrowContract;

    /// @notice Escrows that were linked before the current one (§2.110).
    ///         They can no longer release tokens, but they can still burn
    ///         them for a refund and close a cancelled campaign's pool, so
    ///         relinking the token to a new escrow never strands the refunds
    ///         of a campaign cancelled on the old one.
    mapping(address => bool) public retiredEscrow;

    /// @notice tokenId => no more tokens may leave the pool (§2.110). Set by
    ///         the escrow when it cancels the token's campaign: refunds are
    ///         shared over the tokens sold at that moment, and a token
    ///         released afterwards — by anyone, the owner included — would
    ///         claim a share that belongs to someone who paid.
    mapping(uint256 => bool) public poolClosed;

    event CatalogueMinted(uint256 indexed tokenId, string slug, uint256 supply, uint256 pricePerToken, string title, string artist);
    event TokensReleased(uint256 indexed tokenId, address indexed to, uint256 amount);
    event TokensPurchased(uint256 indexed tokenId, address indexed buyer, uint256 amount, uint256 paid);
    event PayoutRecipientUpdated(address indexed previous, address indexed next);
    event EscrowContractUpdated(address indexed previous, address indexed next);
    event TrackAudioUriUpdated(uint256 indexed tokenId, string uri);
    event CatalogueFunding(uint256 indexed tokenId, uint256 requestedFunding, uint256 pricePerToken, uint256 effectiveFunding, address payout, bool directSale);
    event PrimaryFeeRetained(uint256 indexed tokenId, address indexed buyer, uint256 fee);
    event FeesWithdrawn(address indexed recipient, uint256 amount);
    event FeeRecipientUpdated(address indexed previous, address indexed next);
    event OperatorUpdated(address indexed previous, address indexed next);
    event TokensBurned(uint256 indexed tokenId, address indexed holder, uint256 amount);
    /// @param distributed what the holders share — the deposit less ROYALTY_FEE_BPS.
    event RoyaltiesDeposited(uint256 indexed tokenId, address indexed depositor, uint256 distributed, bytes32 statementRef);
    event RoyaltyFeeRetained(uint256 indexed tokenId, address indexed depositor, uint256 fee);
    event RoyaltiesClaimed(uint256 indexed tokenId, address indexed holder, address indexed paidTo, uint256 amount);
    event RetiredEscrowRevoked(address indexed escrow);
    event PoolClosed(uint256 indexed tokenId);
    event PayoutProposed(uint256 indexed tokenId, address indexed current, address indexed next);
    event PayoutChanged(uint256 indexed tokenId, address indexed previous, address indexed next);

    /// @notice The backend's key: may mint a catalogue, link its audio once
    ///         and clear that link, nothing else. Zero means only the owner can.
    address public operator;

    /// @notice tokenId => tokens destroyed by a refund (§2.92). Outstanding
    ///         supply, the basis royalties are shared over, is
    ///         totalSupplyOf - burnedOf.
    mapping(uint256 => uint256) public burnedOf;

    /// @dev Fixed-point scale of the royalty rates. Remainders are carried,
    ///      not dropped: per token id on deposit, per holder on claim, so
    ///      every base unit deposited is eventually claimable.
    uint256 private constant ROYALTY_PRECISION = 1e18;

    /// @dev One closed window: the time between two deposits (or the mint
    ///      and the first deposit). `rate` is what one token held for one
    ///      second of it earned, times 1e18; `cumulative` is royaltyPerToken
    ///      once it closed; `end` is the deposit's timestamp.
    struct RoyaltyWindow {
        uint256 rate;
        uint256 cumulative;
        uint64 end;
    }
    /// @dev One holder's running total for one token id. `partialSeconds`
    ///      is tokens × seconds held in window `window`, not yet priced
    ///      because that window was still open at `lastTime`.
    struct RoyaltyAccount {
        uint256 owedScaled;
        uint256 partialSeconds;
        uint64 lastTime;
        uint32 window;
    }

    /// @notice tokenId => what one token held from mint through the last
    ///         deposit earned, times 1e18. Only ever grows.
    mapping(uint256 => uint256) public royaltyPerToken;
    /// @notice tokenId => deposits so far: the index of the open window.
    mapping(uint256 => uint32) public royaltyWindowCount;
    /// @notice tokenId => when the open window began (the last deposit, or the mint).
    mapping(uint256 => uint64) public royaltyWindowStart;
    mapping(uint256 => mapping(uint32 => RoyaltyWindow)) private royaltyWindows;
    /// @dev tokenId => outstanding tokens × seconds in the open window, up to
    ///      supplyCheckpoint. Outstanding supply moves only on mint and burn.
    mapping(uint256 => uint256) private windowSupplySeconds;
    mapping(uint256 => uint64) private supplyCheckpoint;
    /// @dev tokenId => the part of the last deposits smaller than one
    ///      second's rate across the window, added to the next deposit.
    mapping(uint256 => uint256) private royaltyRemainder;
    mapping(uint256 => mapping(address => RoyaltyAccount)) private royaltyAccounts;
    /// @notice tokenId => every royalty shared out for it, net of
    ///         ROYALTY_FEE_BPS — not what was deposited (§2.101). This is the
    ///         figure that makes `totalRoyaltiesDistributed -
    ///         totalRoyaltiesClaimed` exactly what is still claimable; a gross
    ///         total would leave a permanent, unclaimable difference on every
    ///         screen that shows the two side by side.
    mapping(uint256 => uint256) public totalRoyaltiesDistributed;
    /// @notice tokenId => every royalty claimed for it.
    mapping(uint256 => uint256) public totalRoyaltiesClaimed;

    /// @dev The original deploy used a placeholder `.example` domain here —
    ///      a reserved TLD (RFC 2606) that never resolves — so wallets could
    ///      never actually load a token's name/image/balance display. This
    ///      constructor now points at the real backend endpoint from the
    ///      start (§2.36); `setURI` below exists for future corrections
    ///      without needing another redeploy.
    constructor(address _paymentToken)
        ERC1155("https://humfiverse-api.onrender.com/api/token-metadata/{id}.json")
        Ownable(msg.sender)
    {
        require(_paymentToken != address(0), "HumfiverseCatalogueToken: zero payment token");
        paymentToken = IERC20(_paymentToken);
        payoutRecipient = msg.sender;
        feeRecipient = msg.sender;
    }

    /// @notice Owner-only: repoints the ERC-1155 metadata base URI (the
    ///         template every wallet substitutes {id} into to fetch a
    ///         token's name/image/description) — e.g. if the backend's own
    ///         URL ever changes. See the constructor note above for why
    ///         this exists.
    function setURI(string calldata newuri) external onlyOwner {
        _setURI(newuri);
    }

    /// @notice Owner-only: authorizes HumfiverseMilestoneEscrow (or unsets
    ///         it, passing address(0)) to call releaseFromPool — see the
    ///         escrowContract field above.
    ///         The escrow it replaces is kept as retiredEscrow, so refunds of
    ///         campaigns cancelled there still work (§2.110).
    function setEscrowContract(address next) external onlyOwner {
        emit EscrowContractUpdated(escrowContract, next);
        if (escrowContract != address(0) && escrowContract != next) retiredEscrow[escrowContract] = true;
        retiredEscrow[next] = false;
        escrowContract = next;
    }

    /// @notice Owner-only: takes refund powers away from a retired escrow —
    ///         for an address linked by mistake, never for one with refunds
    ///         still owed.
    function revokeRetiredEscrow(address escrow) external onlyOwner {
        retiredEscrow[escrow] = false;
        emit RetiredEscrowRevoked(escrow);
    }

    modifier onlyAnyEscrow() {
        require(
            (msg.sender == escrowContract && escrowContract != address(0)) || retiredEscrow[msg.sender],
            "HumfiverseCatalogueToken: not authorized"
        );
        _;
    }

    /// @notice Owner-only: sets (or, with address(0), removes) the operator.
    function setOperator(address next) external onlyOwner {
        emit OperatorUpdated(operator, next);
        operator = next;
    }

    modifier onlyOwnerOrOperator() {
        require(msg.sender == owner() || (operator != address(0) && msg.sender == operator), "HumfiverseCatalogueToken: not authorized");
        _;
    }

    modifier onlyOwnerOrEscrow() {
        require(msg.sender == owner() || msg.sender == escrowContract, "HumfiverseCatalogueToken: not authorized");
        _;
    }

    /// @notice Mints the full supply for a catalogue into the platform pool
    ///         (this contract's own balance). Can only be called once per id.
    ///
    ///         The artist chooses two numbers (§2.79): how many tokens exist
    ///         (`supply`) and how much they are asking investors for
    ///         (`fundingAmount`, in paymentToken base units). The contract
    ///         derives the one price that gives every token the same value:
    ///         `fundingAmount / supply`, rounded down to the base unit. When
    ///         that does not divide exactly the raise is the price times the
    ///         supply — at most `supply - 1` millionths of a dollar short —
    ///         and `fundingOf` reports that effective figure.
    ///
    ///         `fundingAmount == 0` mints without opening public sale;
    ///         releaseFromPool remains available regardless. `payout`
    ///         receives this token's sale proceeds; zero falls back to the
    ///         contract-wide payoutRecipient. `directSale` opens buy(); pass
    ///         false when the token will be sold through an escrow campaign.
    function mintCatalogue(
        uint256 tokenId,
        CatalogueText calldata text,
        uint256 supply,
        uint256 fundingAmount,
        address payout,
        bool directSale
    ) external onlyOwnerOrOperator {
        require(totalSupplyOf[tokenId] == 0, "HumfiverseCatalogueToken: already minted");
        require(supply > 0, "HumfiverseCatalogueToken: supply must be > 0");
        uint256 price = fundingAmount / supply;
        require(fundingAmount == 0 || price > 0, "HumfiverseCatalogueToken: funding too small for this supply");
        totalSupplyOf[tokenId] = supply;
        pricePerToken[tokenId] = price;
        payoutOf[tokenId] = payout;
        directSaleOf[tokenId] = directSale;
        catalogueSlug[tokenId] = text.slug;
        trackTitle[tokenId] = text.title;
        artistName[tokenId] = text.artist;
        // The first royalty window opens now, with nothing yet outstanding.
        royaltyWindowStart[tokenId] = uint64(block.timestamp);
        supplyCheckpoint[tokenId] = uint64(block.timestamp);
        _mint(address(this), tokenId, supply, "");
        emit CatalogueMinted(tokenId, text.slug, supply, price, text.title, text.artist);
        emit CatalogueFunding(tokenId, fundingAmount, price, price * supply, payout, directSale);
    }

    /// @notice What selling every token of `tokenId` raises: price times
    ///         supply, the figure an escrow campaign on this token aims for.
    function fundingOf(uint256 tokenId) public view returns (uint256) {
        return pricePerToken[tokenId] * totalSupplyOf[tokenId];
    }

    /// @notice Releases `amount` tokens of `tokenId` from the platform pool
    ///         to `to` — the on-chain analogue of a token purchase clearing.
    ///         Callable by the owner (e.g. off-chain/fiat purchases settled
    ///         by the platform) or by the linked escrow contract, which
    ///         calls this from inside its own contribute() so a
    ///         preproduction contribution releases tokens in the same
    ///         transaction as a catalogue buy() does. No payment logic
    ///         here — the caller is trusted to have already collected
    ///         payment (buy()'s own paid path, or the escrow's
    ///         contribute()).
    function releaseFromPool(address to, uint256 tokenId, uint256 amount) external onlyOwnerOrEscrow {
        require(to != address(0), "HumfiverseCatalogueToken: zero address");
        _release(to, tokenId, amount);
        emit TokensReleased(tokenId, to, amount);
    }

    /// @notice Public, paid first-purchase path: buy `amount` tokens of
    ///         `tokenId` at its fixed `pricePerToken`, paying exactly
    ///         `amount * pricePerToken` in paymentToken. Reverts if the catalogue has no
    ///         price set (not open for public sale). This is always a first
    ///         purchase — it only ever moves tokens out of the platform pool,
    ///         same as releaseFromPool, so it carries no resale fee (see
    ///         HumfiverseMarketplace.sol for the resale path). It does carry
    ///         the 6% primary fee, deducted from the payment and accrued here
    ///         rather than pushed, so a fee recipient that cannot receive cannot
    ///         block a purchase. releaseFromPool, which takes no payment,
    ///         carries none.
    ///
    ///         Paid in paymentToken: the buyer must first approve this
    ///         contract for `amount * pricePerToken`. The payout moves straight
    ///         from the buyer to the token's payout wallet; only the fee is
    ///         held here.
    function buy(uint256 tokenId, uint256 amount) external nonReentrant {
        uint256 price = pricePerToken[tokenId];
        require(price > 0, "HumfiverseCatalogueToken: not for sale");
        require(directSaleOf[tokenId], "HumfiverseCatalogueToken: sold only through its escrow campaign");
        uint256 cost = amount * price;

        uint256 fee = (cost * PRIMARY_FEE_BPS) / 10_000;
        accruedFees += fee;
        totalFeesCollected += fee;

        _release(msg.sender, tokenId, amount);

        address recipient = payoutOf[tokenId] == address(0) ? payoutRecipient : payoutOf[tokenId];
        paymentToken.safeTransferFrom(msg.sender, recipient, cost - fee);
        if (fee > 0) paymentToken.safeTransferFrom(msg.sender, address(this), fee);

        emit TokensReleased(tokenId, msg.sender, amount);
        emit TokensPurchased(tokenId, msg.sender, amount, cost);
        emit PrimaryFeeRetained(tokenId, msg.sender, fee);
    }

    /// @notice Sends every accrued fee to feeRecipient. Callable by anyone:
    ///         the destination is fixed, so the caller decides only when.
    function withdrawFees() external nonReentrant {
        uint256 amount = accruedFees;
        require(amount > 0, "HumfiverseCatalogueToken: no fees to withdraw");
        accruedFees = 0;
        paymentToken.safeTransfer(feeRecipient, amount);
        emit FeesWithdrawn(feeRecipient, amount);
    }

    function setFeeRecipient(address next) external onlyOwner {
        require(next != address(0), "HumfiverseCatalogueToken: zero address");
        emit FeeRecipientUpdated(feeRecipient, next);
        feeRecipient = next;
    }

    function _release(address to, uint256 tokenId, uint256 amount) private {
        require(!poolClosed[tokenId], "HumfiverseCatalogueToken: pool closed");
        require(releasedOf[tokenId] + amount <= totalSupplyOf[tokenId], "HumfiverseCatalogueToken: exceeds supply");
        releasedOf[tokenId] += amount;
        _safeTransferFrom(address(this), to, tokenId, amount, "");
    }

    /// @notice Links tokenId to its uploaded track's IPFS URI — see
    ///         trackAudioUri above. Requires the token to already be minted
    ///         (there's nothing to link audio to otherwise).
    ///
    ///         The operator may link audio only where none is linked, and may
    ///         always clear it (a takedown, §2.105). Replacing one track with
    ///         another under holders who already bought it is the owner's
    ///         alone (§2.110): with the operator's key on a server, a stolen
    ///         key could otherwise swap every catalogue's audio at once.
    function setTrackAudioUri(uint256 tokenId, string calldata uri) external onlyOwnerOrOperator {
        require(totalSupplyOf[tokenId] > 0, "HumfiverseCatalogueToken: unknown token id");
        require(
            msg.sender == owner() || bytes(trackAudioUri[tokenId]).length == 0 || bytes(uri).length == 0,
            "HumfiverseCatalogueToken: only the owner replaces linked audio"
        );
        trackAudioUri[tokenId] = uri;
        emit TrackAudioUriUpdated(tokenId, uri);
    }

    /// @notice The token's current payout wallet proposes `next` (§2.117);
    ///         address(0) withdraws a proposal. Nothing changes until `next`
    ///         accepts, so a mistyped address cannot take the payouts.
    function proposePayout(uint256 tokenId, address next) external {
        address current = payoutOf[tokenId];
        require(current != address(0) && msg.sender == current, "HumfiverseCatalogueToken: not the payout wallet");
        require(next != current, "HumfiverseCatalogueToken: already the payout wallet");
        pendingPayoutOf[tokenId] = next;
        emit PayoutProposed(tokenId, current, next);
    }

    /// @notice The proposed wallet takes over the token's sales proceeds and
    ///         the pool's royalty share, unclaimed ones included.
    function acceptPayout(uint256 tokenId) external {
        require(msg.sender != address(0) && msg.sender == pendingPayoutOf[tokenId], "HumfiverseCatalogueToken: not the proposed payout wallet");
        address previous = payoutOf[tokenId];
        payoutOf[tokenId] = msg.sender;
        delete pendingPayoutOf[tokenId];
        emit PayoutChanged(tokenId, previous, msg.sender);
    }

    function setPayoutRecipient(address next) external onlyOwner {
        require(next != address(0), "HumfiverseCatalogueToken: zero address");
        emit PayoutRecipientUpdated(payoutRecipient, next);
        payoutRecipient = next;
    }

    /// @notice Escrow-only: destroys `amount` of `holder`'s tokens as they
    ///         hand them back for a refund (§2.92). The escrow calls this only
    ///         from refund(), for the caller's own tokens, so no approval is
    ///         asked of the holder. Royalties the tokens earned before the
    ///         burn stay claimable.
    ///         A retired escrow may still call this (§2.110).
    function burnForRefund(address holder, uint256 tokenId, uint256 amount) external onlyAnyEscrow {
        require(amount > 0, "HumfiverseCatalogueToken: zero amount");
        // Burn before counting it: the royalty bookkeeping in _update reads
        // the outstanding supply as it was before this burn.
        _burn(holder, tokenId, amount);
        burnedOf[tokenId] += amount;
        emit TokensBurned(tokenId, holder, amount);
    }

    /// @notice Escrow-only: stops any further token leaving `tokenId`'s
    ///         pool, called when its campaign is cancelled (§2.110).
    function closePool(uint256 tokenId) external onlyAnyEscrow {
        poolClosed[tokenId] = true;
        emit PoolClosed(tokenId);
    }

    /// @notice Tokens of `tokenId` that exist: minted less burned, pool included.
    function outstandingSupply(uint256 tokenId) public view returns (uint256) {
        return totalSupplyOf[tokenId] - burnedOf[tokenId];
    }

    // --- royalties (§2.92) ---

    /// @notice Deposits `amount` of paymentToken as royalty income of
    ///         `tokenId`, shared over the time since the previous deposit (or
    ///         the mint): each holder by tokens × seconds held in that window
    ///         (§2.110). Two deposits in the same second are refused, since
    ///         the second would pay for a window no one held anything in.
    ///         Callable by anyone — the royalty administrator, the
    ///         artist, the platform: it only gives money away, and the
    ///         contract cannot know whether the amount matches what the
    ///         catalogue really earned. `statementRef` ties the deposit to
    ///         the statement it pays (e.g. a hash of it); the contract only
    ///         records it. The depositor approves this contract first.
    ///
    ///         ROYALTY_FEE_BPS (1%) is deducted from `amount` before it is
    ///         shared (§2.101), the same way every other fee in this project
    ///         is deducted rather than added: the depositor sends what the
    ///         catalogue earned and the holders share the rest. The fee joins
    ///         the same accruedFees as the primary fee and leaves only through
    ///         withdrawFees().
    function depositRoyalties(uint256 tokenId, uint256 amount, bytes32 statementRef) external nonReentrant {
        require(amount > 0, "HumfiverseCatalogueToken: zero amount");
        require(totalSupplyOf[tokenId] > 0, "HumfiverseCatalogueToken: no outstanding tokens");
        uint64 nowTs = uint64(block.timestamp);
        uint256 supplySeconds =
            windowSupplySeconds[tokenId] + outstandingSupply(tokenId) * (nowTs - supplyCheckpoint[tokenId]);
        require(supplySeconds > 0, "HumfiverseCatalogueToken: nothing held since the last deposit");

        // Rounded down, so a deposit under a hundred base units pays no fee
        // and is shared whole; there is no amount above zero the fee can
        // swallow entirely, so nothing needs guarding against here.
        uint256 fee = (amount * ROYALTY_FEE_BPS) / 10_000;
        uint256 distributed = amount - fee;
        accruedFees += fee;
        totalFeesCollected += fee;

        // Close the open window at this rate. Every holder's tokens × seconds
        // in it add up to supplySeconds exactly, so rate × supplySeconds is
        // what all of them can ever claim from it — never more than deposited.
        uint256 scaled = distributed * ROYALTY_PRECISION + royaltyRemainder[tokenId];
        uint256 rate = scaled / supplySeconds;
        royaltyRemainder[tokenId] = scaled - rate * supplySeconds;
        uint32 n = royaltyWindowCount[tokenId];
        uint256 cumulative = royaltyPerToken[tokenId] + rate * (nowTs - royaltyWindowStart[tokenId]);
        royaltyWindows[tokenId][n] = RoyaltyWindow({rate: rate, cumulative: cumulative, end: nowTs});
        royaltyPerToken[tokenId] = cumulative;
        royaltyWindowCount[tokenId] = n + 1;
        royaltyWindowStart[tokenId] = nowTs;
        windowSupplySeconds[tokenId] = 0;
        supplyCheckpoint[tokenId] = nowTs;
        totalRoyaltiesDistributed[tokenId] += distributed;

        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        emit RoyaltiesDeposited(tokenId, msg.sender, distributed, statementRef);
        emit RoyaltyFeeRetained(tokenId, msg.sender, fee);
    }

    /// @notice Royalties of `tokenId` that `holder` can claim now, to the base
    ///         unit: what deposits so far paid for the time it held. Time held
    ///         since the last deposit is paid by the next one.
    function claimableRoyalties(uint256 tokenId, address holder) public view returns (uint256) {
        return _accrued(tokenId, holder).owedScaled / ROYALTY_PRECISION;
    }

    /// @notice Pays `holder` everything it has earned on `tokenIds`.
    ///         Callable by anyone, for anyone: the money only ever goes to
    ///         the holder, so the caller chooses when, never where — the
    ///         platform can push payouts, and a holder can always pull.
    ///         The pool's share is paid by claimPoolRoyalties instead.
    function claimRoyalties(address holder, uint256[] calldata tokenIds) external nonReentrant {
        require(holder != address(0) && holder != address(this), "HumfiverseCatalogueToken: bad holder");
        uint256 total;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 paid = _takeRoyalties(tokenIds[i], holder);
            if (paid > 0) emit RoyaltiesClaimed(tokenIds[i], holder, holder, paid);
            total += paid;
        }
        require(total > 0, "HumfiverseCatalogueToken: nothing to claim");
        paymentToken.safeTransfer(holder, total);
    }

    /// @notice Pays the share earned by `tokenId`'s unsold tokens to that
    ///         token's payout wallet (else payoutRecipient). Callable by
    ///         anyone, for the same reason as claimRoyalties.
    function claimPoolRoyalties(uint256 tokenId) external nonReentrant {
        uint256 paid = _takeRoyalties(tokenId, address(this));
        require(paid > 0, "HumfiverseCatalogueToken: nothing to claim");
        address to = payoutOf[tokenId] == address(0) ? payoutRecipient : payoutOf[tokenId];
        emit RoyaltiesClaimed(tokenId, address(this), to, paid);
        paymentToken.safeTransfer(to, paid);
    }

    function _takeRoyalties(uint256 tokenId, address holder) private returns (uint256 paid) {
        _settleRoyalties(tokenId, holder);
        RoyaltyAccount storage a = royaltyAccounts[tokenId][holder];
        paid = a.owedScaled / ROYALTY_PRECISION;
        a.owedScaled = a.owedScaled % ROYALTY_PRECISION;
        totalRoyaltiesClaimed[tokenId] += paid;
    }

    /// @dev `account`'s running total brought up to now at its current
    ///      balance, which has not changed since `lastTime`: the window it
    ///      was last in is finished and priced if a deposit has closed it,
    ///      every whole window after that is paid at royaltyPerToken's
    ///      growth, and the open window's seconds are counted, unpriced.
    function _accrued(uint256 tokenId, address account) private view returns (RoyaltyAccount memory a) {
        a = royaltyAccounts[tokenId][account];
        uint32 n = royaltyWindowCount[tokenId];
        uint64 nowTs = uint64(block.timestamp);
        if (a.lastTime == 0) {
            // Never seen: it has held nothing until now.
            a.window = n;
            a.lastTime = nowTs;
            return a;
        }
        uint256 balance = balanceOf(account, tokenId);
        if (a.window < n) {
            RoyaltyWindow storage w = royaltyWindows[tokenId][a.window];
            a.owedScaled += (a.partialSeconds + balance * (w.end - a.lastTime)) * w.rate;
            a.owedScaled += balance * (royaltyPerToken[tokenId] - w.cumulative);
            a.partialSeconds = balance * (nowTs - royaltyWindowStart[tokenId]);
            a.window = n;
        } else {
            a.partialSeconds += balance * (nowTs - a.lastTime);
        }
        a.lastTime = nowTs;
    }

    /// @dev Must run before `account`'s balance changes.
    function _settleRoyalties(uint256 tokenId, address account) private {
        royaltyAccounts[tokenId][account] = _accrued(tokenId, account);
    }

    /// @dev Outstanding tokens × seconds since the checkpoint, added to the
    ///      open window. Must run before the outstanding supply changes.
    function _accrueSupplySeconds(uint256 tokenId) private {
        uint64 nowTs = uint64(block.timestamp);
        windowSupplySeconds[tokenId] += outstandingSupply(tokenId) * (nowTs - supplyCheckpoint[tokenId]);
        supplyCheckpoint[tokenId] = nowTs;
    }

    /// @dev Every mint, transfer and burn passes here: settle both sides at
    ///      their old balances, and the supply's seconds on a mint or a
    ///      burn, then move the tokens.
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override {
        for (uint256 i = 0; i < ids.length; i++) {
            if (from == address(0) || to == address(0)) _accrueSupplySeconds(ids[i]);
            if (from != address(0)) _settleRoyalties(ids[i], from);
            if (to != address(0)) _settleRoyalties(ids[i], to);
        }
        super._update(from, to, ids, values);
    }

    /// @notice Convenience view: how many tokens of `tokenId` remain unsold in the pool.
    function poolBalance(uint256 tokenId) external view returns (uint256) {
        return balanceOf(address(this), tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, ERC1155Holder) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
