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
/// @dev Each catalogue is one ERC-1155 token id. Supply per id is minted
///      once, entirely to address(this) (the pool). `releaseFromPool`
///      is the only way tokens leave the pool, and only the owner
///      (the platform's deployer key) can call it.
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

    /// @notice Platform fee on every paid primary purchase through buy(), in
    ///         basis points of the payment (200 bps = 2.00%), deducted from
    ///         it: the buyer pays the listed price and receives every token,
    ///         and payoutRecipient receives the price less the fee (§2.72).
    ///         A constant, so the rate cannot change under anyone.
    uint256 public constant PRIMARY_FEE_BPS = 200;
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

    event CatalogueMinted(uint256 indexed tokenId, string slug, uint256 supply, uint256 pricePerToken, string title, string artist);
    event TokensReleased(uint256 indexed tokenId, address indexed to, uint256 amount);
    event TokensPurchased(uint256 indexed tokenId, address indexed buyer, uint256 amount, uint256 paid);
    event PayoutRecipientUpdated(address indexed previous, address indexed next);
    event EscrowContractUpdated(address indexed previous, address indexed next);
    event TrackAudioUriUpdated(uint256 indexed tokenId, string uri);
    event CatalogueFunding(uint256 indexed tokenId, uint256 requestedFunding, uint256 pricePerToken, uint256 effectiveFunding, address payout);
    event PrimaryFeeRetained(uint256 indexed tokenId, address indexed buyer, uint256 fee);
    event FeesWithdrawn(address indexed recipient, uint256 amount);
    event FeeRecipientUpdated(address indexed previous, address indexed next);

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
    function setEscrowContract(address next) external onlyOwner {
        emit EscrowContractUpdated(escrowContract, next);
        escrowContract = next;
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
    ///         contract-wide payoutRecipient.
    function mintCatalogue(
        uint256 tokenId,
        string calldata slug,
        uint256 supply,
        uint256 fundingAmount,
        string calldata title,
        string calldata artist,
        address payout
    ) external onlyOwner {
        require(totalSupplyOf[tokenId] == 0, "HumfiverseCatalogueToken: already minted");
        require(supply > 0, "HumfiverseCatalogueToken: supply must be > 0");
        uint256 price = fundingAmount / supply;
        require(fundingAmount == 0 || price > 0, "HumfiverseCatalogueToken: funding too small for this supply");
        totalSupplyOf[tokenId] = supply;
        catalogueSlug[tokenId] = slug;
        pricePerToken[tokenId] = price;
        payoutOf[tokenId] = payout;
        trackTitle[tokenId] = title;
        artistName[tokenId] = artist;
        _mint(address(this), tokenId, supply, "");
        emit CatalogueMinted(tokenId, slug, supply, price, title, artist);
        emit CatalogueFunding(tokenId, fundingAmount, price, price * supply, payout);
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
    ///         the 2% primary fee, deducted from the payment and accrued here
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
        require(releasedOf[tokenId] + amount <= totalSupplyOf[tokenId], "HumfiverseCatalogueToken: exceeds supply");
        releasedOf[tokenId] += amount;
        _safeTransferFrom(address(this), to, tokenId, amount, "");
    }

    /// @notice Owner-only: links tokenId to its uploaded track's IPFS URI —
    ///         see trackAudioUri above. Requires the token to already be
    ///         minted, same as this contract's other per-token setters
    ///         implicitly assume (there's nothing to link audio to
    ///         otherwise).
    function setTrackAudioUri(uint256 tokenId, string calldata uri) external onlyOwner {
        require(totalSupplyOf[tokenId] > 0, "HumfiverseCatalogueToken: unknown token id");
        trackAudioUri[tokenId] = uri;
        emit TrackAudioUriUpdated(tokenId, uri);
    }

    function setPayoutRecipient(address next) external onlyOwner {
        require(next != address(0), "HumfiverseCatalogueToken: zero address");
        emit PayoutRecipientUpdated(payoutRecipient, next);
        payoutRecipient = next;
    }

    /// @notice Convenience view: how many tokens of `tokenId` remain unsold in the pool.
    function poolBalance(uint256 tokenId) external view returns (uint256) {
        return balanceOf(address(this), tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, ERC1155Holder) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
