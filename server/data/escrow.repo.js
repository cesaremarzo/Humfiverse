"use strict";
/* The `escrow_campaigns` and `escrow_studios` tables — both caches of
   on-chain state, both only valid against the escrow contract they were
   written for.

   `escrow_campaigns` is a fast-lookup cache for the admin listing
   endpoint, which has no on-chain equivalent of "list every campaign";
   the contract's own campaignIdByAssetId (§2.18) answers "does this asset
   have a campaign". `escrow_studios` exists purely to skip a redundant
   registration transaction when the same wallet+name pair comes back. */

const db = require("../db");

/* Matched on wallet AND name (§2.26 bugfix) — matching on wallet alone
   silently reused whatever studio name was registered *first* for that
   wallet on every later campaign, even when the artist entered a
   genuinely different studio name for the same wallet (this happened for
   real: two campaigns using the same wallet ended up both showing the
   first campaign's studio name on-chain, since the contract has no
   "rename" — a new name for a wallet must mean a new on-chain
   registration, not a silently-reused old one). */
async function findStudioByWalletAndName(wallet, name) {
  return db.prepare("SELECT studio_id FROM escrow_studios WHERE wallet = ? AND name = ?").get(wallet.toLowerCase(), name);
}

/* INSERT OR REPLACE, not INSERT: the wallet column is still UNIQUE (a
   deliberate schema choice, not changed here), so a second name for an
   already-cached wallet overwrites the cache entry rather than
   conflicting — the cache's only job is to skip a redundant on-chain
   registration when the exact same wallet+name pair repeats, so it only
   ever needs to remember the most recent pairing. */
async function upsertStudio(row) {
  await db.prepare(
    "INSERT OR REPLACE INTO escrow_studios (studio_id, wallet, name, tx_hash, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(row.studioId, row.wallet.toLowerCase(), row.name, row.txHash, row.createdAt);
}

async function clearStudios() {
  await db.prepare("DELETE FROM escrow_studios").run();
}

async function insertCampaign(row) {
  await db.prepare(
    "INSERT INTO escrow_campaigns (campaign_id, asset_id, studio_id, studio_name, studio_wallet, tx_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(row.campaignId, row.assetId, row.studioId, row.studioName, row.studioWallet.toLowerCase(), row.txHash, row.createdAt);
}

async function listCampaignAssetIds() {
  const rows = await db.prepare("SELECT asset_id FROM escrow_campaigns ORDER BY campaign_id").all();
  return rows.map((r) => r.asset_id);
}

async function deleteCampaignByAssetId(assetId) {
  const result = await db.prepare("DELETE FROM escrow_campaigns WHERE asset_id = ?").run(assetId);
  return result.changes > 0;
}

module.exports = {
  findStudioByWalletAndName,
  upsertStudio,
  clearStudios,
  insertCampaign,
  listCampaignAssetIds,
  deleteCampaignByAssetId
};
