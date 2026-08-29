// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
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
///         Business rule: the platform automatically retains 1% of the
///         *tokens* on every secondary trade (not 1% of the sale
///         proceeds) — see `PLATFORM_FEE_BPS`.
/// @dev Non-custodial listings: a seller keeps holding (and can still use
///      or transfer) their tokens after listing; nothing moves until a
///      buyer actually purchases. The seller must
///      `setApprovalForAll(marketplace, true)` on the token contract first
///      — the standard NFT-marketplace listing pattern. Payment is native
///      testnet ETH pushed straight through at purchase time (no pooled
///      custody, no stablecoin/fiat rail), consistent with this repo's
///      testnet-only on-chain layer (see technical-architecture.md §2.10).
contract HumfiverseMarketplace is Ownable, ReentrancyGuard {
    /// @notice Platform fee on every secondary trade, in basis points of the
    ///         token amount (100 bps = 1.00%). Applied to the *token
    ///         quantity* being exchanged, not the payment currency — an
    ///         integer token count means sales of fewer than 100 tokens
    ///         round the fee down to 0. That's an accepted consequence of
    ///         "1% of the tokens", not a bug.
    uint256 public constant PLATFORM_FEE_BPS = 100;
    uint256 private constant BPS_DENOMINATOR = 10_000;

    struct Listing {
        address seller;
        address token; // ERC-1155 contract address
        uint256 tokenId;
        uint256 amount; // remaining amount available for sale
        uint256 pricePerToken; // wei per token
        bool active;
    }

    uint256 private nextListingId = 1;
    mapping(uint256 => Listing) public listings;

    /// @notice Where the platform's retained token fee is sent. Defaults to the deployer.
    address public feeRecipient;

    event Listed(uint256 indexed listingId, address indexed seller, address indexed token, uint256 tokenId, uint256 amount, uint256 pricePerToken);
    event ListingCancelled(uint256 indexed listingId, uint256 amountReturned);
    event Purchased(uint256 indexed listingId, address indexed buyer, uint256 amount, uint256 platformFeeTokens, uint256 paidWei);
    event FeeRecipientUpdated(address indexed previous, address indexed next);

    constructor(address initialFeeRecipient) Ownable(msg.sender) {
        feeRecipient = initialFeeRecipient == address(0) ? msg.sender : initialFeeRecipient;
    }

    /// @notice List `amount` of `tokenId` (from ERC-1155 contract `token`)
    ///         for sale at `pricePerToken` wei each. The caller must already
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
    ///         `amount * pricePerToken` wei. 1% of `amount` (rounded down)
    ///         is diverted to `feeRecipient` instead of the buyer — the
    ///         seller is paid in full for everything sold, the platform's
    ///         cut comes out of what the buyer receives, not the seller's
    ///         proceeds.
    function buyListing(uint256 listingId, uint256 amount) external payable nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "HumfiverseMarketplace: not active");
        require(amount > 0 && amount <= listing.amount, "HumfiverseMarketplace: bad amount");

        uint256 cost = amount * listing.pricePerToken;
        require(msg.value == cost, "HumfiverseMarketplace: wrong payment");

        uint256 fee = (amount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 toBuyer = amount - fee;
        address seller = listing.seller;
        address token = listing.token;
        uint256 tokenId = listing.tokenId;

        // Effects before interactions: shrink (or close) the listing first.
        listing.amount -= amount;
        if (listing.amount == 0) listing.active = false;

        IERC1155(token).safeTransferFrom(seller, msg.sender, tokenId, toBuyer, "");
        if (fee > 0) {
            IERC1155(token).safeTransferFrom(seller, feeRecipient, tokenId, fee, "");
        }

        (bool sent, ) = payable(seller).call{value: cost}("");
        require(sent, "HumfiverseMarketplace: payment to seller failed");

        emit Purchased(listingId, msg.sender, amount, fee, cost);
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
