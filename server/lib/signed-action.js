"use strict";
/* Signed actions (§2.89): a wallet proves it wants a specific write by
   signing a short text the server built. Same shape as the launch
   authorization (lib/launch-auth.js, §2.88), for writes that are one
   wallet's own business rather than a campaign launch: royalty figures on
   an asset it owns, and its own investor verification.

   The frontend asks POST /api/signed-action/message for the text, the
   wallet signs it, and the write carries back { kind, wallet, fields,
   issuedAt, signature }. The route rebuilds the text, recovers the signer,
   and compares `fields` with what it is about to write. */

const crypto = require("crypto");
const { ethers } = require("ethers");

const ACTION_WINDOW_MS = 10 * 60 * 1000;
const CLOCK_SKEW_MS = 2 * 60 * 1000;

function codedError(code, message) {
  return Object.assign(new Error(message), { code });
}

function line(value, field) {
  const s = String(value ?? "").trim();
  if (!s) throw codedError("invalid", `${field} is required`);
  if (/[\r\n]/.test(s)) throw codedError("invalid", `${field} must be a single line`);
  if (s.length > 200) throw codedError("invalid", `${field} is too long`);
  return s;
}

/** The investor-verification answers in a fixed key order, so the digest
 * the wallet signs is the same one the server recomputes from the
 * submission. Only a digest is signed: an in-app wallet signs on
 * thirdweb's servers, and the answers are personal data. */
function kycDigest(submission) {
  const s = submission || {};
  const a = s.answers || {};
  const canonical = JSON.stringify([
    String(s.walletAddress || "").toLowerCase(),
    String(s.fullName || ""),
    String(s.dob || ""),
    String(s.nationality || ""),
    s.classification === "professional" ? "professional" : "retail",
    a.priorComplexInvestments ?? null,
    a.familiarWithIlliquidInstruments ?? null,
    a.understandsCapitalLossRisk ?? null,
    a.yearsExperience ?? null,
    String(s.sourceOfFunds || ""),
    s.pep === true
  ]);
  return "0x" + crypto.createHash("sha256").update(canonical).digest("hex");
}

/* Each kind: the heading shown to the signer, and how its fields are
   normalized and printed. Adding a kind is adding an entry here. */
const KINDS = {
  "royalty-report": {
    heading: "Humfiverse — record a royalty figure",
    fields: (f) => {
      const royaltyUSD = Number(f.royaltyUSD);
      if (!Number.isFinite(royaltyUSD) || royaltyUSD < 0) throw codedError("invalid", "royaltyUSD must be a non-negative number");
      return { assetId: line(f.assetId, "assetId"), month: line(f.month, "month"), royaltyUSD };
    },
    lines: (f) => [`Asset: ${f.assetId}`, `Month: ${f.month}`, `Royalty (USD): ${f.royaltyUSD}`]
  },
  "royalty-remove": {
    heading: "Humfiverse — remove a royalty figure",
    fields: (f) => ({ assetId: line(f.assetId, "assetId"), month: line(f.month, "month") }),
    lines: (f) => [`Asset: ${f.assetId}`, `Month: ${f.month}`]
  },
  "kyc-submit": {
    heading: "Humfiverse — submit my investor verification",
    // Prepared from the whole submission, signed and verified as a digest.
    fields: (f) => {
      if (f.submission) return { digest: kycDigest(f.submission) };
      if (!/^0x[0-9a-f]{64}$/.test(String(f.digest || ""))) throw codedError("invalid", "digest is required");
      return { digest: String(f.digest) };
    },
    lines: (f) => [`Answers digest (SHA-256): ${f.digest}`]
  }
};

function wallet(value) {
  const s = String(value ?? "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(s)) throw codedError("invalid", "wallet is not an address");
  return s.toLowerCase();
}

function buildMessage(kind, action) {
  const def = KINDS[kind];
  return [def.heading, "", `Wallet: ${action.wallet}`, ...def.lines(action.fields), `Issued: ${action.issuedAt}`].join("\n");
}

function normalize(kind, raw, { issuedAt } = {}) {
  const def = KINDS[kind];
  if (!def) throw codedError("invalid", "unknown action");
  const stamp = issuedAt ?? raw?.issuedAt;
  if (!stamp || Number.isNaN(Date.parse(stamp))) throw codedError("invalid", "issuedAt is required");
  return { kind, wallet: wallet(raw?.wallet), fields: def.fields(raw?.fields || {}), issuedAt: new Date(stamp).toISOString() };
}

/** For POST /api/signed-action/message. */
function prepareAction(raw) {
  const action = normalize(raw?.kind, raw, { issuedAt: new Date().toISOString() });
  return { action, message: buildMessage(action.kind, action) };
}

/** Throws `unauthorized` unless `auth` is a `kind` action signed by its own
 * wallet within the window. Returns { wallet, fields }. */
function verifyAction(kind, auth) {
  if (!auth || typeof auth !== "object" || typeof auth.signature !== "string") {
    throw codedError("unauthorized", "a signature from your wallet is required for this change");
  }
  if (auth.kind !== kind) throw codedError("unauthorized", "the signature is for a different action");
  let action;
  try {
    action = normalize(kind, auth);
  } catch (e) {
    throw codedError("unauthorized", `signed action is malformed: ${e.message}`);
  }
  const age = Date.now() - Date.parse(action.issuedAt);
  if (age > ACTION_WINDOW_MS || age < -CLOCK_SKEW_MS) throw codedError("unauthorized", "the signature has expired; sign again");
  let signer;
  try {
    signer = ethers.verifyMessage(buildMessage(kind, action), auth.signature).toLowerCase();
  } catch {
    throw codedError("unauthorized", "the signature is not valid");
  }
  if (signer !== action.wallet) throw codedError("unauthorized", "the signature is not from the wallet it names");
  return { wallet: action.wallet, fields: action.fields };
}

module.exports = { prepareAction, verifyAction, kycDigest, ACTION_WINDOW_MS };
