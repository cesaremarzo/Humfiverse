"use strict";
/* Two unrelated things that both happen to be "portfolio" storage:

   - `holdings` + `distributions`: the original simulated portfolio, still
     served by GET /api/data and still what POST /api/redeem operates on.
     Not tied to any wallet — predates real on-chain holdings (§2.37).
   - `portfolio_snapshots`: real, per-wallet, one row per calendar day,
     feeding the value-over-time chart on the portfolio dashboard. */

const db = require("../db");

async function getSimulatedPortfolio() {
  const holdings = await db.prepare("SELECT assetId, tokens, costBasis, unclaimed FROM holdings").all();
  const distributions = await db.prepare("SELECT date, assetId, amount FROM distributions ORDER BY id DESC").all();
  return { holdings, distributions };
}

async function listUnclaimedHoldings() {
  return db.prepare("SELECT assetId, unclaimed FROM holdings").all();
}

async function clearUnclaimed(assetId) {
  await db.prepare("UPDATE holdings SET unclaimed = 0 WHERE assetId = ?").run(assetId);
}

async function insertDistribution(date, assetId, amount) {
  await db.prepare("INSERT INTO distributions (date, assetId, amount) VALUES (?, ?, ?)").run(date, assetId, amount);
}

/** One snapshot per wallet per day: INSERT OR REPLACE, so revisiting the
 * portfolio page repeatedly in the same day overwrites rather than growing
 * the table. Wallet is lowercased by the caller's convention — done here
 * too so no caller can forget. */
async function upsertSnapshot(wallet, snapshotDate, valueUsd, recordedAt) {
  await db.prepare(
    "INSERT OR REPLACE INTO portfolio_snapshots (wallet, snapshot_date, value_usd, recorded_at) VALUES (?, ?, ?, ?)"
  ).run(wallet.toLowerCase(), snapshotDate, valueUsd, recordedAt);
}

async function listSnapshots(wallet) {
  const rows = await db.prepare(
    "SELECT snapshot_date, value_usd FROM portfolio_snapshots WHERE wallet = ? ORDER BY snapshot_date ASC"
  ).all(wallet.toLowerCase());
  return rows.map((r) => ({ date: r.snapshot_date, valueUsd: r.value_usd }));
}

module.exports = {
  getSimulatedPortfolio,
  listUnclaimedHoldings,
  clearUnclaimed,
  insertDistribution,
  upsertSnapshot,
  listSnapshots
};
