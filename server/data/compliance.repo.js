"use strict";
/* The two audit-trail tables: `contract_acceptances` (art. 1341 co.2 c.c.
   clause-by-clause acceptance) and `kyc_records` (MiFID II appropriateness
   assessment). Append-only in practice — nothing in the app ever updates
   or deletes a row here, and nothing should: they exist to record what a
   user was shown and agreed to, at a point in time. */

const db = require("../db");

async function insertContractAcceptance(row) {
  await db.prepare(`
    INSERT INTO contract_acceptances
      (template_version, artist_name, track_title, general_accepted, vessatoria_accepted, receipt_hash, accepted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.templateVersion,
    row.artistName,
    row.trackTitle,
    1,
    JSON.stringify(row.vessatoriaAccepted),
    row.receiptHash,
    row.acceptedAt
  );
}

async function insertKycRecord(row) {
  await db.prepare(`
    INSERT INTO kyc_records
      (wallet_address, full_name, dob, nationality, classification, score, appropriateness_result, source_of_funds, pep, receipt_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.walletAddress,
    row.fullName,
    row.dob,
    row.nationality,
    row.classification,
    row.score,
    row.appropriatenessResult,
    row.sourceOfFunds,
    row.pep ? 1 : 0,
    row.receiptHash,
    row.createdAt
  );
}

/** Most recent record for a wallet, or undefined if it has never
 * completed one. Wallets are stored lowercased, so the lookup lowercases
 * too — a checksummed address from a wallet UI must still match. */
async function findLatestKycByWallet(walletAddress) {
  return db.prepare(
    "SELECT classification, score, appropriateness_result, receipt_hash FROM kyc_records WHERE wallet_address = ? ORDER BY id DESC LIMIT 1"
  ).get(String(walletAddress).toLowerCase());
}

module.exports = { insertContractAcceptance, insertKycRecord, findLatestKycByWallet };
