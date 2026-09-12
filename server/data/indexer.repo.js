"use strict";
/* The event indexer's two tables: where it got to, and what it learned.

   `token_holders` exists because ERC-1155 has `balanceOf` but no way to
   enumerate holders — there is no on-chain question that answers "how many
   wallets hold this token". The only source is the transfer log, and
   replaying it is what this table stores the result of. */

const db = require("../db");

async function getCursor(contract) {
  const row = await db.prepare("SELECT last_block FROM indexer_state WHERE contract = ?").get(contract.toLowerCase());
  return row ? Number(row.last_block) : null;
}

async function setCursor(contract, lastBlock) {
  await db.prepare(
    "INSERT OR REPLACE INTO indexer_state (contract, last_block, updated_at) VALUES (?, ?, ?)"
  ).run(contract.toLowerCase(), lastBlock, new Date().toISOString());
}

/** Balances are stored as text because an ERC-1155 amount is a uint256 and
 * SQLite integers are 64-bit. These particular tokens are small enough that
 * it would not matter, but a number type that silently truncates is the
 * kind of thing that only bites once the values grow. */
async function applyDelta(tokenId, wallet, delta) {
  const key = wallet.toLowerCase();
  const row = await db.prepare("SELECT balance FROM token_holders WHERE token_id = ? AND wallet = ?").get(tokenId, key);
  const next = (row ? BigInt(row.balance) : 0n) + delta;
  if (next <= 0n) {
    await db.prepare("DELETE FROM token_holders WHERE token_id = ? AND wallet = ?").run(tokenId, key);
    return;
  }
  await db.prepare(
    "INSERT OR REPLACE INTO token_holders (token_id, wallet, balance) VALUES (?, ?, ?)"
  ).run(tokenId, key, next.toString());
}

async function holdersOf(tokenId) {
  const rows = await db.prepare(
    "SELECT wallet, balance FROM token_holders WHERE token_id = ? ORDER BY CAST(balance AS INTEGER) DESC"
  ).all(tokenId);
  return rows.map((r) => ({ wallet: r.wallet, balance: r.balance }));
}

async function clearAll() {
  await db.prepare("DELETE FROM token_holders").run();
  await db.prepare("DELETE FROM indexer_state").run();
}

module.exports = { getCursor, setCursor, applyDelta, holdersOf, clearAll };
