"use strict";
/* On-chain integration for HumfiverseMarketplace — the secondary-market
   exchange. A third independent contract alongside chain.js (the catalogue
   token) and chainEscrow.js (the milestone escrow); it reaches the token
   through the plain IERC1155 interface, so deploying it needed no redeploy
   of either of the other two.

   Read-only from this server's point of view, deliberately. Every state
   change on this contract is a transaction from a *user's* wallet:
   `list` and `cancelListing` require msg.sender to be the seller, and
   `buyListing` sends the buyer's own ETH. Humfiverse has no operator
   function here at all, which is the whole point — the platform cannot
   list, cancel or move anyone's tokens on their behalf. Compare the
   previous design, where `seller` was a string in a POST body and anyone
   could publish an offer for any wallet (§2.58).

   TESTNET ONLY. */

const { ethers } = require("ethers");
const { withRetry } = require("./chainRetry");

const RPC_URL = process.env.CHAIN_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const MARKETPLACE_ADDRESS = process.env.CHAIN_MARKETPLACE_ADDRESS || "";
const EXPLORER_BASE = "https://sepolia.etherscan.io";

const ABI = [
  "function list(address token, uint256 tokenId, uint256 amount, uint256 pricePerToken) returns (uint256)",
  "function cancelListing(uint256 listingId)",
  "function buyListing(uint256 listingId, uint256 amount) payable",
  "function getListing(uint256 listingId) view returns (tuple(address seller, address token, uint256 tokenId, uint256 amount, uint256 pricePerToken, bool active))",
  "function feeRecipient() view returns (address)",
  "function PLATFORM_FEE_BPS() view returns (uint256)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const readContract = MARKETPLACE_ADDRESS ? new ethers.Contract(MARKETPLACE_ADDRESS, ABI, provider) : null;

/** False until CHAIN_MARKETPLACE_ADDRESS is set. The resale board then
 * reports itself as unavailable rather than falling back to anything —
 * an offer the chain cannot vouch for is exactly what this replaced. */
function marketplaceEnabled() {
  return Boolean(MARKETPLACE_ADDRESS);
}

/** One listing, straight from the contract. Returns null for an id that
 * was never created, and for a cancelled or fully-sold one — `active` is
 * the contract's own word for it, so a listing disappears from the board
 * the moment its last token sells, without this server tracking anything. */
async function getListing(listingId) {
  if (!readContract) return null;
  const raw = await withRetry(() => readContract.getListing(listingId));
  if (raw.seller === ethers.ZeroAddress || !raw.active || raw.amount === 0n) return null;
  return {
    listingId: Number(listingId),
    seller: raw.seller.toLowerCase(),
    tokenContract: raw.token,
    tokenId: Number(raw.tokenId),
    qty: Number(raw.amount),
    pricePerTokenWei: raw.pricePerToken.toString(),
    active: raw.active
  };
}

/** Used to check an id a client claims to have just created: a listing
 * that does not exist on chain, or whose token id is not this asset's,
 * simply never enters the index. That is why the indexing endpoint needs
 * no authentication — the contract is the one being trusted, not the
 * caller. */
async function verifyListingMatches(listingId, tokenId) {
  const listing = await getListing(listingId);
  if (!listing) return null;
  return listing.tokenId === Number(tokenId) ? listing : null;
}

module.exports = {
  marketplaceEnabled,
  getListing,
  verifyListingMatches,
  MARKETPLACE_ADDRESS,
  EXPLORER_BASE
};
