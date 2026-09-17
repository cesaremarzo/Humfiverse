"use strict";
/* Registration with a verified email (§2.93, legal/08 C-11).

   Two proofs, kept apart on purpose: a six-digit code sent to the address
   proves the person reads that inbox; a signature from the wallet over the
   address and the verification id proves the wallet wants it. Only both
   together register the wallet. Google, Apple and email sign-ins go
   through the same code: the backend never trusts an address the browser
   reports, and asking thirdweb's server API instead would need a secret key
   this deployment does not hold.

   Required before launching a campaign or submitting investor verification
   — but only on a deployment that can send the code. Without email
   configured nobody could register, so nothing is gated. */

const crypto = require("crypto");
const repo = require("../data/registration.repo");
const mailer = require("../lib/mailer");
const { verifyAction } = require("../lib/signed-action");

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
/* Limits on codes sent, so the endpoint can't be used to mail strangers in
   bulk or burn Brevo's free daily quota (300). */
const LIMITS = [
  { column: "wallet", perHour: 5 },
  { column: "email", perHour: 5 },
  { column: "ip", perHour: 15 }
];
const DAILY_CAP = 250;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WALLET_PATTERN = /^0x[0-9a-f]{40}$/;

function codedError(code, message, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}

function normalizeEmail(raw) {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!email || email.length > 200 || !EMAIL_PATTERN.test(email)) throw codedError("invalid", "enter a valid email address");
  return email;
}

function normalizeWallet(raw) {
  const wallet = String(raw ?? "").trim().toLowerCase();
  if (!WALLET_PATTERN.test(wallet)) throw codedError("invalid", "wallet is not an address");
  return wallet;
}

const hashCode = (id, code) => crypto.createHash("sha256").update(`${id}:${code}`).digest("hex");

function required() {
  return mailer.enabled();
}

const MESSAGES = {
  it: {
    subject: (code) => `Il tuo codice Humfiverse: ${code}`,
    body: (code) => `Il tuo codice di verifica Humfiverse è ${code}.\n\nScade tra 10 minuti. Se non hai chiesto tu di registrarti, ignora questa email: senza il codice nessuno può usare il tuo indirizzo.\n\nHumfiverse è un prototipo su rete di test. Nessun token ha valore o dà diritto a royalty.`
  },
  en: {
    subject: (code) => `Your Humfiverse code: ${code}`,
    body: (code) => `Your Humfiverse verification code is ${code}.\n\nIt expires in 10 minutes. If you didn't ask to register, ignore this email: without the code nobody can use your address.\n\nHumfiverse is a testnet prototype. No token has value or entitles you to royalties.`
  }
};

function renderEmail(locale, code) {
  const m = MESSAGES[locale] || MESSAGES.en;
  const text = m.body(code);
  const paragraphs = text
    .split("\n\n")
    .map((p) => `<p style="margin:0 0 14px">${p.replace(code, `<strong style="font-size:22px;letter-spacing:4px">${code}</strong>`)}</p>`)
    .join("");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1B1814;max-width:520px">${paragraphs}</div>`;
  return { subject: m.subject(code), text, html };
}

/** Sends a code to `email` for `wallet`. Returns the verification id the
 * wallet will sign, and when the code expires. */
async function startEmailVerification({ wallet, email, locale, ip }) {
  if (!required()) throw codedError("not-configured", "email verification is not available on this server");
  wallet = normalizeWallet(wallet);
  email = normalizeEmail(email);

  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  if ((await repo.countSince("wallet", wallet, new Date(now - RESEND_COOLDOWN_MS).toISOString())) > 0) {
    throw codedError("rate-limited", "a code was just sent; wait a minute before asking for another", { retryAfter: 60 });
  }
  for (const { column, perHour } of LIMITS) {
    const value = column === "wallet" ? wallet : column === "email" ? email : ip;
    if (value && (await repo.countSince(column, value, hourAgo)) >= perHour) {
      throw codedError("rate-limited", "too many codes requested; try again in an hour", { retryAfter: 3600 });
    }
  }
  if ((await repo.countSince(null, null, new Date(now - 24 * 60 * 60 * 1000).toISOString())) >= DAILY_CAP) {
    throw codedError("rate-limited", "registration is busy today; try again tomorrow", { retryAfter: 3600 });
  }

  const id = crypto.randomBytes(16).toString("hex");
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + CODE_TTL_MS).toISOString();
  // Recorded before sending, so a failed send still counts against the limits.
  await repo.insertVerification({ id, wallet, email, codeHash: hashCode(id, code), ip: ip || null, createdAt, expiresAt });
  await mailer.sendEmail({ to: email, ...renderEmail(locale, code) });
  return { verificationId: id, expiresAt };
}

/** Checks the code and the wallet's signature, then registers the wallet. */
async function confirmEmailVerification({ verificationId, code, auth, ip }) {
  const row = await repo.findVerification(String(verificationId || ""));
  if (!row) throw codedError("invalid", "this verification does not exist; ask for a new code");
  if (row.verified_at) throw codedError("invalid", "this code was already used");
  if (Date.parse(row.expires_at) < Date.now()) throw codedError("expired", "the code has expired; ask for a new one");
  if (row.attempts >= MAX_ATTEMPTS) throw codedError("expired", "too many wrong attempts; ask for a new code");

  // The signature first: a wrong wallet must not spend the inbox's attempts.
  const signed = verifyAction("email-verify", auth);
  if (signed.wallet !== row.wallet) throw codedError("unauthorized", "the signature is not from the wallet this code was sent for");
  if (signed.fields.verificationId !== row.id || signed.fields.email !== row.email) {
    throw codedError("unauthorized", "the signature does not match this verification");
  }

  const given = String(code ?? "").trim();
  const expected = Buffer.from(row.code_hash, "hex");
  const actual = Buffer.from(hashCode(row.id, given), "hex");
  if (!/^\d{6}$/.test(given) || !crypto.timingSafeEqual(expected, actual)) {
    await repo.incrementAttempts(row.id);
    const left = MAX_ATTEMPTS - row.attempts - 1;
    throw codedError("wrong-code", "the code is not correct", { attemptsLeft: Math.max(0, left) });
  }

  const verifiedAt = new Date().toISOString();
  await repo.markVerified(row.id, verifiedAt);
  await repo.upsertRegistration({ wallet: row.wallet, email: row.email, verificationId: row.id, signature: auth.signature, verifiedAt, ip: ip || null });
  return { registered: true, verifiedAt };
}

/** Public status: whether a wallet is registered, never the address. */
async function getStatus(wallet) {
  let normalized;
  try {
    normalized = normalizeWallet(wallet);
  } catch {
    return { registered: false, required: required() };
  }
  const row = await repo.findRegistration(normalized);
  return { registered: Boolean(row), required: required() };
}

/** Throws `not-registered` when this deployment requires registration and
 * the wallet has none. */
async function requireRegistered(wallet) {
  if (!required()) return;
  const row = wallet ? await repo.findRegistration(String(wallet).toLowerCase()) : null;
  if (!row) throw codedError("not-registered", "verify your email before continuing");
}

module.exports = { startEmailVerification, confirmEmailVerification, getStatus, requireRegistered, required, CODE_TTL_MS, MAX_ATTEMPTS };
