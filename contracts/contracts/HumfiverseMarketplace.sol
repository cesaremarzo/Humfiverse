// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title HumfiverseMarketplace
/// @notice TESTNET DEMO CONTRACT — not audited, not for real funds, not a
///         security offering. Peer-to-peer secondary-market exchange for
///         HumfiverseCatalogueToken (or any IERC1155) holdings.
///
///         This is deliberately a separate contract from
///         HumfiverseCatalogueToken's `releaseFromPool`: that function is
///         the *only* path for a first purchase (platform pool → buyer,
///         owner-gated, fee-free). This contract only ever moves tokens a
///         seller already holds — so every trade here is, by construction,
///         a secondary sale, and the business rule ("first purchase is
///         fee-free, every subsequent platform-mediated sale is not") falls
///         out of the two contracts' separation rather than needing a
///         "have they bought before?" check anywhere.
///
///         Business rule: the platform retains 1% of the *payment* on every
///         secondary trade — see `PLATFORM_FEE_BPS`. The buyer receives
///         every token they paid for and the seller receives 99% of the
///         price. (The first deployment took 1% of the tokens instead, which
///         rounded to nothing on any trade under 100 tokens.) The fee
///         accrues in this contract and leaves through withdrawFees(), so a
///         fee recipient that cannot receive can never block a trade.
/// @dev Non-custodial listings: a seller keeps holding (and can still use
///      or transfer) their tokens after listing; nothing moves until a
///      buyer actually purchases. The seller must
///      `setApprovalForAll(marketplace, true)` on the token contract first
///      — the standard NFT-marketplace listing pattern. Payment is native
///      USDC (paymentToken) moved straight from buyer to seller at purchase time (no pooled
///      custody, no stablecoin/fiat rail), consistent with this repo's
///      testnet-only on-chain layer (see technical-architecture.md §2.10).
contract HumfiverseMarketplace is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Platform fee on every secondary trade, in basis points of the
    ///         payment (100 bps = 1.00%), rounded down to the base unit.
    uint256 public constant PLATFORM_FEE_BPS = 100;
    uint256 private constant BPS_DENOMINATOR = 10_000;

    struct Listing {
        address seller;
        address token; // ERC-1155 contract address
        uint256 tokenId;
        uint256 amount; // remaining amount available for sale
        uint256 pricePerToken; // paymentToken base units per token (USDC: 1e6 = $1)
        bool active;
    }

    uint256 private nextListingId = 1;
    mapping(uint256 => Listing) public listings;

    /// @notice The stablecoin resale payments are made in (USDC, §2.73).
    IERC20 public immutable paymentToken;

    /// @notice Where withdrawFees() sends accrued fees. Defaults to the deployer.
    address public feeRecipient;
    /// @notice Fees retained from trades and not yet withdrawn, in paymentToken base units.
    uint256 public accruedFees;
    /// @notice Every fee ever retained, withdrawn or not — never decreases.
    uint256 public totalFeesCollected;

    event Listed(uint256 indexed listingId, address indexed seller, address indexed token, uint256 tokenId, uint256 amount, uint256 pricePerToken);
    event ListingCancelled(uint256 indexed listingId, uint256 amountReturned);
    event Purchased(uint256 indexed listingId, address indexed buyer, uint256 amount, uint256 platformFee, uint256 paid);
    event FeesWithdrawn(address indexed recipient, uint256 amount);
    event FeeRecipientUpdated(address indexed previous, address indexed next);

    constructor(address _paymentToken, address initialFeeRecipient) Ownable(msg.sender) {
        require(_paymentToken != address(0), "HumfiverseMarketplace: zero payment token");
        paymentToken = IERC20(_paymentToken);
        feeRecipient = initialFeeRecipient == address(0) ? msg.sender : initialFeeRecipient;
    }

    /// @notice List `amount` of `tokenId` (from ERC-1155 contract `token`)
    ///         for sale at `pricePerToken` paymentToken base units each. The caller must already
    ///         hold at least `amount` and have approved this contract via
    ///         `setApprovalForAll` on `token`.
    function list(address token, uint256 tokenId, uint256 amount, uint256 pricePerToken) external returns (uint256 listingId) {
        require(amount > 0, "HumfiverseMarketplace: amount must be > 0");
        require(pricePerToken > 0, "HumfiverseMarketplace: price must be > 0");
        require(IERC1155(token).balanceOf(msg.sender, tokenId) >= amount, "HumfiverseMarketplace: insufficient balance");
        require(IERC1155(token).isApprovedForAll(msg.sender, address(this)), "HumfiverseMarketplace: marketplace not approved");

        listingId = nextListingId++;
        listings[listingId] = Listing({
            seller: msg.sender,
            token: token,
            tokenId: tokenId,
            amount: amount,
            pricePerToken: pricePerToken,
            active: true
        });
        emit Listed(listingId, msg.sender, token, tokenId, amount, pricePerToken);
    }

    /// @notice Cancel a listing. Only the seller may cancel — tokens never
    ///         left their wallet, so there's nothing to return on-chain.
    function cancelListing(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        require(listing.active, "HumfiverseMarketplace: not active");
        require(listing.seller == msg.sender, "HumfiverseMarketplace: not seller");
        uint256 remaining = listing.amount;
        listing.active = false;
        listing.amount = 0;
        emit ListingCancelled(listingId, remaining);
    }

    /// @notice Buy `amount` tokens from `listingId`, paying exactly
    ///         `amount * pricePerToken` in paymentToken (approve it first). The buyer receives all `amount`
    ///         tokens; the seller receives the payment less 1%, which stays
    ///         here as accruedFees.
    function buyListing(uint256 listingId, uint256 amount) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "HumfiverseMarketplace: not active");
        require(amount > 0 && amount <= listing.amount, "HumfiverseMarketplace: bad amount");

        uint256 cost = amount * listing.pricePerToken;

        uint256 fee = (cost * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        address seller = listing.seller;
        address token = listing.token;
        uint256 tokenId = listing.tokenId;

        // Effects before interactions: shrink (or close) the listing first.
        listing.amount -= amount;
        if (listing.amount == 0) listing.active = false;
        accruedFees += fee;
        totalFeesCollected += fee;

        IERC1155(token).safeTransferFrom(seller, msg.sender, tokenId, amount, "");

        paymentToken.safeTransferFrom(msg.sender, seller, cost - fee);
        if (fee > 0) paymentToken.safeTransferFrom(msg.sender, address(this), fee);

        emit Purchased(listingId, msg.sender, amount, fee, cost);
    }

    /// @notice Sends every accrued fee to feeRecipient. Callable by anyone:
    ///         the destination is fixed, so the caller decides only when the
    ///         transfer happens, never where it goes.
    function withdrawFees() external nonReentrant {
        uint256 amount = accruedFees;
        require(amount > 0, "HumfiverseMarketplace: no fees to withdraw");
        accruedFees = 0;
        paymentToken.safeTransfer(feeRecipient, amount);
        emit FeesWithdrawn(feeRecipient, amount);
    }

    function setFeeRecipient(address next) external onlyOwner {
        require(next != address(0), "HumfiverseMarketplace: zero address");
        emit FeeRecipientUpdated(feeRecipient, next);
        feeRecipient = next;
    }

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }
}
