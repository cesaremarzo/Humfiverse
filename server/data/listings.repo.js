"use strict";
/* The `secondary_listings` table: an offer to resell tokens someone holds.

   Until this table existed, a listing lived only in the signal of the tab
   that created it — seeded from a bundled JSON file of three fictional
   rows, appended to in memory, and gone on the next reload. An artist who
   listed real tokens for sale watched them vanish, and no other visitor
   ever saw the listing at all. Same failure the campaign records had
   before §2.20, and the same fix. */

const db = require("../db");

async function listActive() {
  const rows = await db.prepare(
    "SELECT id, asset_id, seller, qty, price_per_token, created_at FROM secondary_listings WHERE qty > 0 ORDER BY price_per_token ASC, created_at ASC"
  ).all();
  return rows.map(toListing);
}

async function findById(id) {
  const row = await db.prepare(
    "SELECT id, asset_id, seller, qty, price_per_token, created_at FROM secondary_listings WHERE id = ?"
  ).get(id);
  return row ? toListing(row) : null;
}

async function insert(listing) {
  await db.prepare(
    "INSERT INTO secondary_listings (id, asset_id, seller, qty, price_per_token, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(listing.id, listing.assetId, listing.seller, listing.qty, listing.pricePerToken, listing.createdAt);
}

async function remove(id) {
  const result = await db.prepare("DELETE FROM secondary_listings WHERE id = ?").run(id);
  return result.changes > 0;
}

/** The frontend's own SecondaryListing shape, so nothing has to translate
 * column names anywhere above this file. */
function toListing(row) {
  return {
    id: row.id,
    assetId: row.asset_id,
    seller: row.seller,
    qty: Number(row.qty),
    pricePerToken: Number(row.price_per_token),
    createdAt: row.created_at
  };
}

module.exports = { listActive, findById, insert, remove };
