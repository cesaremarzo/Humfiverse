"use strict";
/* The `assets` and `campaigns` tables. Both store one JSON blob per row
   (the frontend's own Asset/Campaign shape, see webapp core/models.ts) —
   a deliberate choice for a prototype whose record shape was still moving,
   which is why every read here parses and every write stringifies.

   No SQL lives outside this file for these two tables. */

const db = require("../db");

async function listAssets() {
  const rows = await db.prepare("SELECT data FROM assets").all();
  return rows.map(r => JSON.parse(r.data));
}

async function findAssetById(id) {
  const row = await db.prepare("SELECT data FROM assets WHERE id = ?").get(id);
  return row ? JSON.parse(row.data) : null;
}

async function insertAsset(asset) {
  await db.prepare("INSERT INTO assets (id, data) VALUES (?, ?)").run(asset.id, JSON.stringify(asset));
}

/** Overwrites the whole JSON blob for an asset that already exists — used
 * by every partial edit (royalty reports, history cleanup), which read the
 * record, change one field, and write it back. */
async function saveAsset(asset) {
  await db.prepare("UPDATE assets SET data = ? WHERE id = ?").run(JSON.stringify(asset), asset.id);
}

async function deleteAsset(id) {
  const result = await db.prepare("DELETE FROM assets WHERE id = ?").run(id);
  return result.changes > 0;
}

/** Milestones live on the asset record; joined in here like the original
 * mock data did, so a campaign always arrives with them attached. */
async function listCampaigns() {
  const rows = await db.prepare("SELECT data FROM campaigns").all();
  const campaigns = rows.map(r => JSON.parse(r.data));
  const assets = await listAssets();
  return campaigns.map(c => ({ ...c, milestones: (assets.find(a => a.id === c.assetId) || {}).milestones || [] }));
}

async function insertCampaignIfAbsent(campaign) {
  await db.prepare("INSERT OR IGNORE INTO campaigns (id, data) VALUES (?, ?)").run(campaign.id, JSON.stringify(campaign));
}

async function deleteCampaign(id) {
  const result = await db.prepare("DELETE FROM campaigns WHERE id = ?").run(id);
  return result.changes > 0;
}

module.exports = {
  listAssets,
  findAssetById,
  insertAsset,
  saveAsset,
  deleteAsset,
  listCampaigns,
  insertCampaignIfAbsent,
  deleteCampaign
};
