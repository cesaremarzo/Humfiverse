"use strict";
/* The `royalty_deposits` table — a cache of RoyaltiesDeposited logs for the
   deposit history on the asset page (§2.92). Totals and claimable amounts
   are never read from here: the token contract keeps those itself. */

const db = require("../db");

/** INSERT OR IGNORE: reporting the same transaction twice is harmless. */
async function saveDeposit(tokenContract, d) {
  await db.prepare(
    "INSERT OR IGNORE INTO royalty_deposits (token_contract, tx_hash, log_index, token_id, depositor, amount_usdc, statement_ref, block, deposited_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(tokenContract, d.txHash, d.logIndex, d.tokenId, d.depositor, d.amountUsdc, d.statementRef, d.block, d.depositedAt);
}

/** Links a deposit to its published statement file (§2.98). Never replaces
 * a link already stored: the bytes behind a statementRef cannot change. */
async function setStatementFile(tokenContract, d, file) {
  await db.prepare(
    "UPDATE royalty_deposits SET statement_uri = ?, statement_mime = ?, statement_bytes = ? WHERE token_contract = ? AND tx_hash = ? AND log_index = ? AND statement_uri IS NULL"
  ).run(file.uri, file.mime, file.bytes, tokenContract, d.txHash, d.logIndex);
}

/** The file already published for `statementRef`, if any deposit has one. */
async function statementFileOf(tokenContract, statementRef) {
  const row = await db.prepare(
    "SELECT statement_uri, statement_mime, statement_bytes FROM royalty_deposits WHERE token_contract = ? AND lower(statement_ref) = ? AND statement_uri IS NOT NULL LIMIT 1"
  ).get(tokenContract, statementRef.toLowerCase());
  return row ? { uri: row.statement_uri, mime: row.statement_mime, bytes: row.statement_bytes } : null;
}

async function depositsOf(tokenContract, tokenId) {
  return db.prepare(
    "SELECT tx_hash, depositor, amount_usdc, statement_ref, statement_uri, statement_mime, statement_bytes, block, deposited_at FROM royalty_deposits WHERE token_contract = ? AND token_id = ? ORDER BY block DESC, log_index DESC"
  ).all(tokenContract, tokenId);
}

module.exports = { saveDeposit, setStatementFile, statementFileOf, depositsOf };
