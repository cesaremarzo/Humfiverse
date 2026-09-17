"use strict";
/* The `royalty_deposits` table — a cache of RoyaltiesDeposited logs for the
   deposit history on the asset page (§2.92). Totals and claimable amounts
   are never read from here: the token contract keeps those itself. */

const db = require("../db");

/** INSERT OR IGNORE: reporting the same transaction twice is harmless. A
 * statement text arriving later fills in a row stored without one. */
async function saveDeposit(tokenContract, d) {
  await db.prepare(
    "INSERT OR IGNORE INTO royalty_deposits (token_contract, tx_hash, log_index, token_id, depositor, amount_usdc, statement_ref, statement, block, deposited_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(tokenContract, d.txHash, d.logIndex, d.tokenId, d.depositor, d.amountUsdc, d.statementRef, d.statement, d.block, d.depositedAt);
  if (d.statement) {
    await db.prepare(
      "UPDATE royalty_deposits SET statement = ? WHERE token_contract = ? AND tx_hash = ? AND log_index = ? AND statement IS NULL"
    ).run(d.statement, tokenContract, d.txHash, d.logIndex);
  }
}

async function depositsOf(tokenContract, tokenId) {
  return db.prepare(
    "SELECT tx_hash, depositor, amount_usdc, statement_ref, statement, block, deposited_at FROM royalty_deposits WHERE token_contract = ? AND token_id = ? ORDER BY block DESC, log_index DESC"
  ).all(tokenContract, tokenId);
}

module.exports = { saveDeposit, depositsOf };
