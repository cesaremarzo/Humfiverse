"use strict";
/* The `marketplace_listings` table — an index of on-chain listing ids.

   Deliberately stores almost nothing. Quantity, price, seller and whether
   a listing is still open all live on HumfiverseMarketplace and are read
   from it on every request; duplicating them here would create a second
   version of the truth that goes stale the moment someone buys or cancels
   directly on the contract. What the contract cannot answer cheaply is
   "which listing ids exist" — its counter is private, and scanning the
   Listed event costs fifty sequential RPC calls (§2.55). That one question
   is what this table is for. */

const db = require("../db");

async function listIndexed() {
  return db.prepare(
    "SELECT listing_id, asset_id, token_id, tx_hash, created_at FROM marketplace_listings ORDER BY listing_id ASC"
  ).all();
}

async function findByListingId(listingId) {
  return db.prepare(
    "SELECT listing_id, asset_id, token_id, tx_hash, created_at FROM marketplace_listings WHERE listing_id = ?"
  ).get(listingId);
}

/** INSERT OR IGNORE: indexing the same listing twice is a no-op, so a
 * client retrying after a flaky response cannot create a duplicate. */
async function index(row) {
  await db.prepare(
    "INSERT OR IGNORE INTO marketplace_listings (listing_id, asset_id, token_id, tx_hash, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(row.listingId, row.assetId, row.tokenId, row.txHash || null, row.createdAt);
}

/** Only ever called for a listing the contract itself reports as gone, to
 * stop re-reading an id that will never be active again. */
async function forget(listingId) {
  const result = await db.prepare("DELETE FROM marketplace_listings WHERE listing_id = ?").run(listingId);
  return result.changes > 0;
}

module.exports = { listIndexed, findByListingId, index, forget };
