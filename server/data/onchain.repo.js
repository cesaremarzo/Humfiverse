"use strict";
/* The `onchain_tokens` table: assetId -> minted ERC-1155 token id.

   A cache, never the source of truth (§2.14) — the contract is. A miss
   here doesn't mean the token doesn't exist, only that this cache doesn't
   know about it yet, e.g. after a redeploy wiped it (§2.18). Callers that
   care handle the miss by falling back to the chain; see
   services/onchain.service.js. */

const db = require("../db");

async function findTokenByAssetId(assetId) {
  return db.prepare(
    "SELECT token_id, asset_id, slug, supply, tx_hash, minted_at FROM onchain_tokens WHERE asset_id = ?"
  ).get(assetId);
}

async function insertToken(row) {
  await db.prepare(
    "INSERT INTO onchain_tokens (token_id, asset_id, slug, supply, tx_hash, minted_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(row.tokenId, row.assetId, row.slug, row.supply, row.txHash, row.mintedAt);
}

/** INSERT OR IGNORE variant used by the two self-healing cache re-seeds
 * (a chain scan finding a token this table didn't know about). A losing
 * race against a real mint must not throw. */
async function insertTokenIfAbsent(row) {
  await db.prepare(
    "INSERT OR IGNORE INTO onchain_tokens (token_id, asset_id, slug, supply, tx_hash, minted_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(row.tokenId, row.assetId, row.slug, row.supply, row.txHash, row.mintedAt);
}

async function listTokens() {
  return db.prepare("SELECT token_id, asset_id FROM onchain_tokens").all();
}

async function listTokenAssetIds() {
  const rows = await db.prepare("SELECT asset_id FROM onchain_tokens").all();
  return rows.map((r) => r.asset_id);
}

async function maxTokenId() {
  const row = await db.prepare("SELECT MAX(token_id) AS maxId FROM onchain_tokens").get();
  return row.maxId || 0;
}

async function deleteTokenByAssetId(assetId) {
  const result = await db.prepare("DELETE FROM onchain_tokens WHERE asset_id = ?").run(assetId);
  return result.changes > 0;
}

module.exports = {
  findTokenByAssetId,
  insertToken,
  insertTokenIfAbsent,
  listTokens,
  listTokenAssetIds,
  maxTokenId,
  deleteTokenByAssetId
};
