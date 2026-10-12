"use strict";
/* On-chain integration for HumfiverseMarketplace — the secondary-market
   exchange. A third independent contract alongside chain.js (the catalogue
   token) and chainEscrow.js (the milestone escrow); it reaches the token
   through the plain IERC1155 interface, so deploying it needed no redeploy
   of either of the other two.

   Read-only from this server's point of view, deliberately. Every state
   change on this contract is a transaction from a *user's* wallet:
   `list` and `cancelListing` require msg.sender to be the seller, and
   `buyListing` pays with the buyer's own USDC. Humfiverse has no operator
   function here at all, which is the whole point — the platform cannot
   list, cancel or move anyone's tokens on their behalf. Compare the
   previous design, where `seller` was a string in a POST body and anyone
   could publish an offer for any wallet (§2.58).

   TESTNET ONLY. */

const { ethers } = require("ethers");
const { withRetry } = require("./chainRetry");
const { paymentTokenOf, toUsdcFor } = require("./chainUnits");

const RPC_URL = process.env.CHAIN_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const MARKETPLACE_ADDRESS = process.env.CHAIN_MARKETPLACE_ADDRESS || "";
const EXPLORER_BASE = "https://sepolia.etherscan.io";

const COMMON_ABI = [
  "function cancelListing(uint256 listingId)",
  "function buyListing(uint256 listingId, uint256 amount)",
  "function paymentToken() view returns (address)",
  "function feeRecipient() view returns (address)",
  "function PLATFORM_FEE_BPS() view returns (uint256)",
  // §2.71: the fee is 1% of the payment, accrued here until withdrawn.
  // The first deployment took 1% of the tokens and has neither of these.
  "function accruedFees() view returns (uint256)",
  "function totalFeesCollected() view returns (uint256)"
];

/* Up to §2.116: any ERC-1155 per listing, no expiry. */
const ABI_V1 = [
  ...COMMON_ABI,
  "function list(address token, uint256 tokenId, uint256 amount, uint256 pricePerToken) returns (uint256)",
  "function getListing(uint256 listingId) view returns (tuple(address seller, address token, uint256 tokenId, uint256 amount, uint256 pricePerToken, bool active))"
];
/* §2.117: the Humfiverse token only, fixed at deployment, and every listing
   expires within 30 days. */
const ABI_V2 = [
  ...COMMON_ABI,
  "function token() view returns (address)",
  "function MAX_LISTING_PERIOD() view returns (uint256)",
  "function list(uint256 tokenId, uint256 amount, uint256 pricePerToken, uint256 expiresAt) returns (uint256)",
  "function getListing(uint256 listingId) view returns (tuple(address seller, uint256 tokenId, uint256 amount, uint256 pricePerToken, uint256 expiresAt, bool active))"
];
const ABI = ABI_V2;

const provider = new ethers.JsonRpcProvider(RPC_URL);
const readContract = MARKETPLACE_ADDRESS ? new ethers.Contract(MARKETPLACE_ADDRESS, ABI_V2, provider) : null;
const readContractV1 = MARKETPLACE_ADDRESS ? new ethers.Contract(MARKETPLACE_ADDRESS, ABI_V1, provider) : null;

/** The token address of a §2.117 marketplace, or null for the earlier one
 * (no token() function). Cached: bytecode never changes. An RPC failure is
 * rethrown, never read as "old contract". */
let tokenPromise = null;
function fixedToken() {
  if (!readContract) return Promise.resolve(null);
  if (!tokenPromise) {
    tokenPromise = withRetry(() => readContract.token()).then(
      (a) => a,
      (err) => {
        if (err.code === "CALL_EXCEPTION" || err.code === "BAD_DATA") return null;
        tokenPromise = null;
        throw err;
      }
    );
  }
  return tokenPromise;
}

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
  const token = await fixedToken();
  const raw = await withRetry(() => (token ? readContract : readContractV1).getListing(listingId));
  if (raw.seller === ethers.ZeroAddress || !raw.active || raw.amount === 0n) return null;
  // §2.117: an expired listing cannot be bought; it leaves the board.
  const expiresAt = token ? Number(raw.expiresAt) : null;
  if (expiresAt !== null && expiresAt * 1000 < Date.now()) return null;
  return {
    listingId: Number(listingId),
    seller: raw.seller.toLowerCase(),
    tokenContract: token || raw.token,
    tokenId: Number(raw.tokenId),
    qty: Number(raw.amount),
    pricePerTokenUsdc: (await toUsdcFor(readContract))(raw.pricePerToken).toString(),
    expiresAt,
    active: raw.active
  };
}

/** Used to check an id a client claims to have just created: a listing
 * that does not exist on chain, or whose token id is not this asset's,
 * simply never enters the index. That is why the indexing endpoint needs
 * no authentication — the contract is the one being trusted, not the
 * caller. */
/** Contract-wide fee state, read straight off the chain. Null when no
 * marketplace is configured, or when the configured one predates USDC
 * (§2.73) — its fees are in wei or in tokens, and reporting them as USDC
 * would claim otherwise. */
async function getFeeState() {
  if (!readContract) return null;
  if (!(await paymentTokenOf(readContract))) return null;
  const accrued = await withRetry(() => readContract.accruedFees());
  const [recipient, total, bps] = await Promise.all([
    withRetry(() => readContract.feeRecipient()),
    withRetry(() => readContract.totalFeesCollected()),
    withRetry(() => readContract.PLATFORM_FEE_BPS())
  ]);
  return {
    contractAddress: MARKETPLACE_ADDRESS,
    explorerUrl: `${EXPLORER_BASE}/address/${MARKETPLACE_ADDRESS}`,
    feeBps: Number(bps),
    feeRecipient: recipient,
    accruedUsdc: accrued.toString(),
    totalCollectedUsdc: total.toString()
  };
}

async function verifyListingMatches(listingId, tokenId) {
  const listing = await getListing(listingId);
  if (!listing) return null;
  // The token id alone was not enough on the earlier marketplace, which took
  // any ERC-1155: a listing of another contract's token with the same id
  // passed. It must be the Humfiverse token (§2.117).
  const humfiverseToken = (process.env.CHAIN_CONTRACT_ADDRESS || "0x471DE935a7538D67F0E231aaf2768f5C4EB42431").toLowerCase();
  if (String(listing.tokenContract).toLowerCase() !== humfiverseToken) return null;
  return listing.tokenId === Number(tokenId) ? listing : null;
}

module.exports = {
  marketplaceEnabled,
  getListing,
  verifyListingMatches,
  getFeeState,
  MARKETPLACE_ADDRESS,
  EXPLORER_BASE
};
