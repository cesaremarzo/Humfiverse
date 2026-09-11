"use strict";
/* Secondary-market resale listings.
 *
 * What this is honestly: an *offer* board. Creating a listing does not
 * move, lock, or escrow anything on chain — HumfiverseMarketplace.sol is
 * written and tested but has never been deployed, so nothing here can
 * hold a seller to their offer or settle a trade. Buying a listing is a
 * simulated transfer, exactly as it was before these rows were persisted.
 *
 * The one thing it does check is that the offer is *possible*: the seller
 * really holds at least the quantity they are listing, read from the
 * token contract at creation time. That turns a listing from an
 * unverifiable claim into a verified one, which is the most this can
 * honestly be until the marketplace contract is deployed. The balance is
 * checked once, at creation — nothing stops the seller moving the tokens
 * afterwards, and the UI says so. */

const crypto = require("node:crypto");
const chain = require("../chain");
const listingsRepo = require("../data/listings.repo");
const onchainRepo = require("../data/onchain.repo");

const WALLET_PATTERN = /^0x[0-9a-fA-F]{40}$/;

function listActive() {
  return listingsRepo.listActive();
}

/** Throws an error carrying a `code` the route maps to a status. */
function invalid(message, code = "invalid") {
  return Object.assign(new Error(message), { code });
}

async function create({ assetId, seller, qty, pricePerToken }) {
  if (!assetId || typeof assetId !== "string") throw invalid("assetId is required");
  if (typeof seller !== "string" || !WALLET_PATTERN.test(seller)) {
    throw invalid("seller must be a wallet address");
  }
  const quantity = Number(qty);
  if (!Number.isInteger(quantity) || quantity <= 0) throw invalid("qty must be a positive whole number");
  const price = Number(pricePerToken);
  if (!Number.isFinite(price) || price <= 0) throw invalid("pricePerToken must be a positive number");

  // Verify the seller can actually deliver. A missing token record means
  // this asset was never minted, which makes the offer meaningless.
  const token = await onchainRepo.findTokenByAssetId(assetId);
  if (!token) throw invalid("this asset has no on-chain token to resell", "no_token");

  const balance = await chain.getBalance(token.token_id, seller);
  if (balance < quantity) {
    throw invalid(`wallet holds ${balance} token(s) of this asset, cannot list ${quantity}`, "insufficient_balance");
  }

  const listing = {
    id: `listing-${crypto.randomUUID()}`,
    assetId,
    seller: seller.toLowerCase(),
    qty: quantity,
    pricePerToken: price,
    createdAt: new Date().toISOString()
  };
  await listingsRepo.insert(listing);
  return listing;
}

/** Cancelling is gated on being the seller, since a listing is now shared
 * state rather than one tab's own signal. Not real authentication — this
 * backend has none — but it does stop one wallet removing another's
 * listing by guessing an id. */
async function cancel(id, seller) {
  const listing = await listingsRepo.findById(id);
  if (!listing) throw invalid("no listing with this id", "not_found");
  if (typeof seller !== "string" || listing.seller !== seller.toLowerCase()) {
    throw invalid("only the wallet that created a listing can cancel it", "not_seller");
  }
  await listingsRepo.remove(id);
  return listing;
}

/** Buying takes the whole listing, which is what the UI offers. The token
 * movement itself is simulated; this only retires the offer so it stops
 * being shown to everyone else. */
async function buy(id) {
  const listing = await listingsRepo.findById(id);
  if (!listing) throw invalid("no listing with this id", "not_found");
  await listingsRepo.remove(id);
  return listing;
}

module.exports = { listActive, create, cancel, buy };
