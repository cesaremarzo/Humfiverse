"use strict";
/* The `token_trades` and `token_trade_scans` tables — a cache of the paid
   trades found in transaction receipts, for the price-history chart.

   Nothing here is the truth: every row can be rebuilt from the chain, and
   the service does exactly that for any transaction not yet scanned. */

const db = require("../db");

async function scannedTxHashes(tokenContract) {
  const rows = await db.prepare(
    "SELECT tx_hash FROM token_trade_scans WHERE token_contract = ?"
  ).all(tokenContract);
  return new Set(rows.map((r) => r.tx_hash));
}

/** Stores a transaction's trades and marks it scanned. INSERT OR IGNORE on
 * both, so two concurrent refreshes reading the same receipt are harmless. */
async function saveScan(tokenContract, txHash, trades) {
  for (const t of trades) {
    await db.prepare(
      "INSERT OR IGNORE INTO token_trades (token_contract, tx_hash, log_index, token_id, source, qty, price_usdc, block, traded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(tokenContract, txHash, t.logIndex, t.tokenId, t.source, t.qty, t.priceUsdc, t.block, t.tradedAt);
  }
  await db.prepare(
    "INSERT OR IGNORE INTO token_trade_scans (token_contract, tx_hash, scanned_at) VALUES (?, ?, ?)"
  ).run(tokenContract, txHash, new Date().toISOString());
}

async function tradesOf(tokenContract, tokenId) {
  return db.prepare(
    "SELECT tx_hash, log_index, source, qty, price_usdc, block, traded_at FROM token_trades WHERE token_contract = ? AND token_id = ? ORDER BY block ASC, log_index ASC"
  ).all(tokenContract, tokenId);
}

module.exports = { scannedTxHashes, saveScan, tradesOf };
