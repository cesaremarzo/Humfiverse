"use strict";
/* `email_verifications` and `registrations` (§2.93). All their SQL lives here. */

const db = require("../db");

async function insertVerification(row) {
  await db.prepare(`
    INSERT INTO email_verifications (id, wallet, email, code_hash, attempts, ip, created_at, expires_at)
    VALUES (?, ?, ?, ?, 0, ?, ?, ?)
  `).run(row.id, row.wallet, row.email, row.codeHash, row.ip, row.createdAt, row.expiresAt);
}

async function findVerification(id) {
  return db.prepare("SELECT * FROM email_verifications WHERE id = ?").get(id);
}

async function incrementAttempts(id) {
  await db.prepare("UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?").run(id);
}

async function markVerified(id, verifiedAt) {
  await db.prepare("UPDATE email_verifications SET verified_at = ? WHERE id = ?").run(verifiedAt, id);
}

/** How many codes went out since `sinceIso`, for one column's value or in
 * total when `column` is null. Feeds the send limits. */
async function countSince(column, value, sinceIso) {
  const allowed = { wallet: "wallet", email: "email", ip: "ip" };
  if (column && !allowed[column]) throw new Error("unknown column");
  const row = column
    ? await db.prepare(`SELECT COUNT(*) AS n FROM email_verifications WHERE ${allowed[column]} = ? AND created_at >= ?`).get(value, sinceIso)
    : await db.prepare("SELECT COUNT(*) AS n FROM email_verifications WHERE created_at >= ?").get(sinceIso);
  return Number(row?.n || 0);
}

async function upsertRegistration(row) {
  await db.prepare(`
    INSERT INTO registrations (wallet, email, verification_id, signature, verified_at, ip)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(wallet) DO UPDATE SET
      email = excluded.email,
      verification_id = excluded.verification_id,
      signature = excluded.signature,
      verified_at = excluded.verified_at,
      ip = excluded.ip
  `).run(row.wallet, row.email, row.verificationId, row.signature, row.verifiedAt, row.ip);
}

async function findRegistration(wallet) {
  return db.prepare("SELECT wallet, email, verified_at FROM registrations WHERE wallet = ?").get(String(wallet).toLowerCase());
}

module.exports = { insertVerification, findVerification, incrementAttempts, markVerified, countSince, upsertRegistration, findRegistration };
