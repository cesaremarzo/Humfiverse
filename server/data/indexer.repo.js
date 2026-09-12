"use strict";
/* The event indexer's two tables: where it got to, and what it learned.

   `token_holders` exists because ERC-1155 has `balanceOf` but no way to
   enumerate holders — there is no on-chain question that answers "how many
   wallets hold this token". The only source is the transfer log, and
   replaying it is what this table stores the result of. */

const db = require("../db");

/**
 * Claims the right to step this contract, for `ttlMs`.
 *
 * The conditional UPDATE is the whole mechanism: SQLite applies it
 * atomically, so of two processes racing, exactly one sees `changes > 0`.
 * An in-process flag could not do this — Render boots the new instance
 * before retiring the old one, so a deploy briefly runs two tickers
 * against the same database, and both stepped the same cursor.
 *
 * The lease expires rather than being held, so a process that dies
 * mid-step does not block the indexer forever.
 */
async function claimLease(contract, ttlMs, startBlock) {
  const key = contract.toLowerCase();
  const now = Date.now();
  await db.prepare(
    "INSERT OR IGNORE INTO indexer_state (contract, last_block, updated_at, locked_until) VALUES (?, ?, ?, 0)"
  ).run(key, startBlock, new Date().toISOString());
  const result = await db.prepare(
    "UPDATE indexer_state SET locked_until = ? WHERE contract = ? AND locked_until < ?"
  ).run(now + ttlMs, key, now);
  return result.changes > 0;
}

async function releaseLease(contract) {
  await db.prepare("UPDATE indexer_state SET locked_until = 0 WHERE contract = ?").run(contract.toLowerCase());
}

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

module.exports = { claimLease, releaseLease, getCursor, setCursor, applyDelta, holdersOf, clearAll };
