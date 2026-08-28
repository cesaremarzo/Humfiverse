// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

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
contract HumfiverseCatalogueToken is ERC1155, Ownable, ERC1155Holder {
    string public constant NAME = "Humfiverse Catalogue Tokens (Testnet Demo)";

    /// @notice catalogue slug (matches the id used in docs/index.html ASSETS / server/seed-data.js)
    mapping(uint256 => string) public catalogueSlug;
    /// @notice total minted supply for a given token id
    mapping(uint256 => uint256) public totalSupplyOf;
    /// @notice cumulative amount released from the pool for a given token id
    mapping(uint256 => uint256) public releasedOf;

    event CatalogueMinted(uint256 indexed tokenId, string slug, uint256 supply);
    event TokensReleased(uint256 indexed tokenId, address indexed to, uint256 amount);

    constructor()
        ERC1155("https://humfiverse.example/api/token-metadata/{id}.json")
        Ownable(msg.sender)
    {}

    /// @notice Mints the full supply for a catalogue into the platform pool
    ///         (this contract's own balance). Can only be called once per id.
    function mintCatalogue(uint256 tokenId, string calldata slug, uint256 supply) external onlyOwner {
        require(totalSupplyOf[tokenId] == 0, "HumfiverseCatalogueToken: already minted");
        require(supply > 0, "HumfiverseCatalogueToken: supply must be > 0");
        totalSupplyOf[tokenId] = supply;
        catalogueSlug[tokenId] = slug;
        _mint(address(this), tokenId, supply, "");
        emit CatalogueMinted(tokenId, slug, supply);
    }

    /// @notice Releases `amount` tokens of `tokenId` from the platform pool
    ///         to `to` — the on-chain analogue of a token purchase clearing.
    ///         No payment logic here: this is purely the issuance/pool
    ///         mechanism the user asked for, not a marketplace contract.
    function releaseFromPool(address to, uint256 tokenId, uint256 amount) external onlyOwner {
        require(to != address(0), "HumfiverseCatalogueToken: zero address");
        require(releasedOf[tokenId] + amount <= totalSupplyOf[tokenId], "HumfiverseCatalogueToken: exceeds supply");
        releasedOf[tokenId] += amount;
        _safeTransferFrom(address(this), to, tokenId, amount, "");
        emit TokensReleased(tokenId, to, amount);
    }

    /// @notice Convenience view: how many tokens of `tokenId` remain unsold in the pool.
    function poolBalance(uint256 tokenId) external view returns (uint256) {
        return balanceOf(address(this), tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, ERC1155Holder) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
