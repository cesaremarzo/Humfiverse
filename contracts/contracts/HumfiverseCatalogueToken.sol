// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
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
    /// @notice total minted supply for a given token id
    mapping(uint256 => uint256) public totalSupplyOf;
    /// @notice cumulative amount released from the pool for a given token id
    mapping(uint256 => uint256) public releasedOf;
    /// @notice fixed primary-sale price, in wei per token — 0 means "not for
    ///         public sale" (owner-only releaseFromPool still works either way).
    ///         Deliberately a flat price, not a bonding curve or any other
    ///         automatically-updating mechanism — see
    ///         planning/legal-regulatory-notes.md §7.8 on why dynamic pricing
    ///         is a real MTF/OTF-authorization question this project isn't
    ///         answering by writing contract code.
    mapping(uint256 => uint256) public pricePerToken;

    /// @notice where primary-sale ETH proceeds go. Defaults to the deployer.
    address public payoutRecipient;

    event CatalogueMinted(uint256 indexed tokenId, string slug, uint256 supply, uint256 priceWeiPerToken, string title, string artist);
    event TokensReleased(uint256 indexed tokenId, address indexed to, uint256 amount);
    event TokensPurchased(uint256 indexed tokenId, address indexed buyer, uint256 amount, uint256 paidWei);
    event PriceUpdated(uint256 indexed tokenId, uint256 previousPriceWei, uint256 newPriceWei);
    event PayoutRecipientUpdated(address indexed previous, address indexed next);

    constructor()
        ERC1155("https://humfiverse.example/api/token-metadata/{id}.json")
        Ownable(msg.sender)
    {
        payoutRecipient = msg.sender;
    }

    /// @notice Mints the full supply for a catalogue into the platform pool
    ///         (this contract's own balance), at a fixed primary-sale price.
    ///         Can only be called once per id. `priceWeiPerToken == 0` mints
    ///         the catalogue without opening public sale — releaseFromPool
    ///         remains available regardless.
    function mintCatalogue(
        uint256 tokenId,
        string calldata slug,
        uint256 supply,
        uint256 priceWeiPerToken,
        string calldata title,
        string calldata artist
    ) external onlyOwner {
        require(totalSupplyOf[tokenId] == 0, "HumfiverseCatalogueToken: already minted");
        require(supply > 0, "HumfiverseCatalogueToken: supply must be > 0");
        totalSupplyOf[tokenId] = supply;
        catalogueSlug[tokenId] = slug;
        pricePerToken[tokenId] = priceWeiPerToken;
        trackTitle[tokenId] = title;
        artistName[tokenId] = artist;
        _mint(address(this), tokenId, supply, "");
        emit CatalogueMinted(tokenId, slug, supply, priceWeiPerToken, title, artist);
    }

    /// @notice Releases `amount` tokens of `tokenId` from the platform pool
    ///         to `to` — the on-chain analogue of a token purchase clearing.
    ///         No payment logic here: this is the owner-gated issuance path
    ///         (e.g. off-chain/fiat purchases settled by the platform), kept
    ///         alongside the public, paid `buy()` below.
    function releaseFromPool(address to, uint256 tokenId, uint256 amount) external onlyOwner {
        require(to != address(0), "HumfiverseCatalogueToken: zero address");
        _release(to, tokenId, amount);
        emit TokensReleased(tokenId, to, amount);
    }

    /// @notice Public, paid first-purchase path: buy `amount` tokens of
    ///         `tokenId` at its fixed `pricePerToken`, paying exactly
    ///         `amount * pricePerToken` wei. Reverts if the catalogue has no
    ///         price set (not open for public sale). This is always a first
    ///         purchase — it only ever moves tokens out of the platform pool,
    ///         same as releaseFromPool, so it carries no resale fee (see
    ///         HumfiverseMarketplace.sol for the fee-bearing secondary path).
    function buy(uint256 tokenId, uint256 amount) external payable nonReentrant {
        uint256 price = pricePerToken[tokenId];
        require(price > 0, "HumfiverseCatalogueToken: not for sale");
        uint256 cost = amount * price;
        require(msg.value == cost, "HumfiverseCatalogueToken: wrong payment");

        _release(msg.sender, tokenId, amount);

        (bool sent, ) = payable(payoutRecipient).call{value: cost}("");
        require(sent, "HumfiverseCatalogueToken: payout failed");

        emit TokensReleased(tokenId, msg.sender, amount);
        emit TokensPurchased(tokenId, msg.sender, amount, cost);
    }

    function _release(address to, uint256 tokenId, uint256 amount) private {
        require(releasedOf[tokenId] + amount <= totalSupplyOf[tokenId], "HumfiverseCatalogueToken: exceeds supply");
        releasedOf[tokenId] += amount;
        _safeTransferFrom(address(this), to, tokenId, amount, "");
    }

    /// @notice Owner-only: open, close, or reprice public sale for a catalogue.
    function setPrice(uint256 tokenId, uint256 priceWeiPerToken) external onlyOwner {
        emit PriceUpdated(tokenId, pricePerToken[tokenId], priceWeiPerToken);
        pricePerToken[tokenId] = priceWeiPerToken;
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
