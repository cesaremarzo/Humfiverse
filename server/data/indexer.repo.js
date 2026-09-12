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

/** Moves the cursor without touching the lease.
 *
 * This was an UPDATE-by-REPLACE, and REPLACE deletes the row before
 * reinserting it — which reset locked_until to its default of 0. The
 * cursor is written after every window, so the lease this file exists to
 * hold was being dropped within a second of being taken, and two
 * processes could step the same cursor anyway. An UPDATE of just the two
 * columns that change leaves the lease alone. */
async function setCursor(contract, lastBlock) {
  const key = contract.toLowerCase();
  const now = new Date().toISOString();
  const result = await db.prepare(
    "UPDATE indexer_state SET last_block = ?, updated_at = ? WHERE contract = ?"
  ).run(lastBlock, now, key);
  if (result.changes === 0) {
    await db.prepare(
      "INSERT INTO indexer_state (contract, last_block, updated_at, locked_until) VALUES (?, ?, ?, 0)"
    ).run(key, lastBlock, now);
  }
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

/** Replaces one token's holder set outright, from authoritative balances.
 *
 * The delta path above cannot repair itself: every balance is the sum of
 * every event ever applied, so one missed log is permanent and invisible.
 * This is the repair — a whole token's holdings, read from the contract
 * and written over whatever was there. */
async function replaceHolders(tokenId, rows) {
  await db.prepare("DELETE FROM token_holders WHERE token_id = ?").run(tokenId);
  for (const row of rows) {
    await db.prepare(
      "INSERT INTO token_holders (token_id, wallet, balance) VALUES (?, ?, ?)"
    ).run(tokenId, row.wallet.toLowerCase(), row.balance);
  }
}

async function saveAudit(tokenId, audit) {
  await db.prepare(
    `INSERT OR REPLACE INTO token_holder_audit
       (token_id, balanced, held, pool, supply, block, checked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(tokenId, audit.balanced ? 1 : 0, audit.held, audit.pool, audit.supply, audit.block, new Date().toISOString());
}

async function getAudit(tokenId) {
  const row = await db.prepare(
    "SELECT token_id, balanced, held, pool, supply, block, checked_at FROM token_holder_audit WHERE token_id = ?"
  ).get(tokenId);
  if (!row) return null;
  return {
    tokenId: Number(row.token_id),
    balanced: Boolean(row.balanced),
    held: String(row.held),
    pool: String(row.pool),
    supply: String(row.supply),
    block: row.block === null || row.block === undefined ? null : Number(row.block),
    checkedAt: row.checked_at
  };
}

async function clearAll() {
  await db.prepare("DELETE FROM token_holders").run();
  await db.prepare("DELETE FROM token_holder_audit").run();
  await db.prepare("DELETE FROM indexer_state").run();
}

module.exports = {
  claimLease,
  releaseLease,
  getCursor,
  setCursor,
  applyDelta,
  holdersOf,
  replaceHolders,
  saveAudit,
  getAudit,
  clearAll
};
