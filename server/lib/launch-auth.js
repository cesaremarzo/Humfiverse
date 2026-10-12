"use strict";
/* Launch authorization (§2.88): the wallet that will own a campaign signs
   what it is launching, once, and every write that makes Founder's key act
   for that campaign checks the signature against its own request.

   Those writes — saving the asset, minting its token, creating its escrow
   campaign, linking its audio — are sent by Founder, so without this
   anything the request named was what Founder signed on chain, payout
   wallet included. Now the payout/artist wallet must be the signer, and the
   request must match what was signed.

   The message is built only here. The frontend asks for it
   (POST /api/launch/message), has the wallet sign exactly that text, and
   sends back the payload and signature; this module rebuilds the text from
   the payload and recovers the signer. A replayed authorization can only
   repeat the same launch, which the asset-exists / already-minted /
   already-created checks already refuse. */

const { ethers } = require("ethers");

/** How long a signed launch stays usable: long enough for a slow mint and
 * an audio upload, short enough that an old signature is useless. */
const LAUNCH_WINDOW_MS = 30 * 60 * 1000;
const CLOCK_SKEW_MS = 2 * 60 * 1000;

function codedError(code, message) {
  return Object.assign(new Error(message), { code });
}

function text(value, field, { optional = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (optional) return "";
    throw codedError("invalid", `${field} is required`);
  }
  const s = String(value).trim();
  // One field per line: a newline in a value could forge another line.
  if (/[\r\n]/.test(s)) throw codedError("invalid", `${field} must be a single line`);
  if (s.length > 200) throw codedError("invalid", `${field} is too long`);
  return s;
}

function address(value, field, { optional = false } = {}) {
  const s = text(value, field, { optional });
  if (!s) return "";
  if (!/^0x[a-fA-F0-9]{40}$/.test(s)) throw codedError("invalid", `${field} is not an address`);
  return s.toLowerCase();
}

/** The fields a launch commits to, in a fixed shape. `issuedAt` is set by
 * the server when the message is requested. */
function normalizePayload(p, { issuedAt, contract } = {}) {
  if (!p || typeof p !== "object") throw codedError("invalid", "launch payload is required");
  const supply = Number(p.supply);
  if (!Number.isSafeInteger(supply) || supply <= 0) throw codedError("invalid", "supply must be a whole number above 0");
  let funding;
  try {
    funding = BigInt(p.fundingUsdc);
  } catch {
    throw codedError("invalid", "fundingUsdc must be a whole number of USDC base units");
  }
  if (funding <= 0n) throw codedError("invalid", "fundingUsdc must be above 0");
  if (typeof p.directSale !== "boolean") throw codedError("invalid", "directSale must be true or false");

  const milestones = Array.isArray(p.milestones)
    ? p.milestones.map((m, i) => {
        const bps = Number(m?.bps);
        if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) throw codedError("invalid", `milestone ${i + 1} bps is out of range`);
        const payee = m?.payee === "studio" ? "studio" : m?.payee === "artist" ? "artist" : null;
        if (!payee) throw codedError("invalid", `milestone ${i + 1} payee must be artist or studio`);
        return { name: text(m?.name, `milestone ${i + 1} name`), bps, payee };
      })
    : [];

  // §2.114: an escrow campaign's raise deadline (unix seconds) and minimum
  // (bps of the target). Required when the token is sold only through its
  // escrow; a direct sale has neither.
  let raiseDeadline = 0;
  let minRaiseBps = 0;
  if (!p.directSale) {
    raiseDeadline = Number(p.raiseDeadline);
    minRaiseBps = Number(p.minRaiseBps);
    if (!Number.isSafeInteger(raiseDeadline) || raiseDeadline <= 0) throw codedError("invalid", "raiseDeadline is required");
    if (!Number.isInteger(minRaiseBps) || minRaiseBps < 1 || minRaiseBps > 10_000) throw codedError("invalid", "minRaiseBps must be between 1 and 10000");
  }

  const stamp = issuedAt ?? p.issuedAt;
  if (!stamp || Number.isNaN(Date.parse(stamp))) throw codedError("invalid", "issuedAt is required");

  const artistWallet = address(p.artistWallet, "artistWallet");
  const studioWallet = address(p.studioWallet, "studioWallet", { optional: true });
  // §2.89: a milestone releases on two independent confirmations, artist and
  // studio (§2.27); one wallet in both roles would confirm alone.
  if (studioWallet && studioWallet === artistWallet) {
    throw codedError("invalid", "the studio wallet must be different from the artist wallet");
  }

  return {
    assetId: text(p.assetId, "assetId"),
    title: text(p.title, "title"),
    artistName: text(p.artistName, "artistName"),
    artistWallet,
    supply,
    fundingUsdc: funding.toString(),
    directSale: p.directSale,
    studioName: text(p.studioName, "studioName", { optional: true }),
    studioWallet,
    milestones,
    raiseDeadline,
    minRaiseBps,
    // The artist agreement on screen when the launch was signed — stamped by
    // the server, like issuedAt, never taken from the client's word.
    contractVersion: text(contract?.version ?? p.contractVersion, "contractVersion", { optional: true }),
    contractSha256: text(contract?.sha256 ?? p.contractSha256, "contractSha256", { optional: true }),
    issuedAt: new Date(stamp).toISOString()
  };
}

function buildLaunchMessage(payload) {
  const milestones = payload.milestones.length
    ? payload.milestones.map((m) => `${m.name} | ${m.bps} bps | ${m.payee}`).join("; ")
    : "none";
  return [
    "Humfiverse — authorize this campaign launch",
    "",
    `Asset: ${payload.assetId}`,
    `Title: ${payload.title}`,
    `Artist: ${payload.artistName}`,
    `Artist wallet (receives payouts): ${payload.artistWallet}`,
    `Tokens: ${payload.supply}`,
    `Funding (USDC base units): ${payload.fundingUsdc}`,
    `Direct sale: ${payload.directSale ? "yes" : "no, escrow only"}`,
    `Studio: ${payload.studioName || "none"}${payload.studioWallet ? ` (${payload.studioWallet})` : ""}`,
    `Milestones: ${milestones}`,
    ...(payload.directSale ? [] : [`Raise: at least ${payload.minRaiseBps / 100}% by ${new Date(payload.raiseDeadline * 1000).toISOString()}, or every holder is refunded`]),
    ...(payload.contractSha256 ? [`Artist agreement: ${payload.contractVersion} (sha256 ${payload.contractSha256})`] : []),
    `Issued: ${payload.issuedAt}`
  ].join("\n");
}

/** For POST /api/launch/message: stamps the time and returns the exact
 * text the wallet must sign, with the payload it was built from. */
/** Longest raise a campaign may set, matching the escrow's MAX_RAISE_PERIOD. */
const MAX_RAISE_SECONDS = 365 * 24 * 60 * 60;

function prepareLaunch(rawPayload) {
  const { CONTRACT_TEMPLATE, CONTRACT_TEMPLATE_SHA256 } = require("../contract-template");
  const payload = normalizePayload(rawPayload, {
    issuedAt: new Date().toISOString(),
    contract: { version: CONTRACT_TEMPLATE.version, sha256: CONTRACT_TEMPLATE_SHA256 }
  });
  // Checked only when signing starts: a later check of the same signature
  // (e.g. completing a campaign, §2.112) is the contract's to refuse.
  if (!payload.directSale) {
    const now = Math.floor(Date.now() / 1000);
    if (payload.raiseDeadline <= now + 3600) throw codedError("invalid", "the raise deadline must be at least an hour away");
    if (payload.raiseDeadline > now + MAX_RAISE_SECONDS) throw codedError("invalid", "the raise deadline can be at most a year away");
  }
  return { payload, message: buildLaunchMessage(payload) };
}

/** Throws `unauthorized` unless `launch.signature` was made by the payload's
 * artist wallet over this payload's message, within the time window.
 * Returns the normalized payload for the caller to compare against its
 * own request. */
function verifyLaunch(launch) {
  if (!launch || typeof launch !== "object" || typeof launch.signature !== "string") {
    throw codedError("unauthorized", "a launch authorization signed by the artist wallet is required");
  }
  let payload;
  try {
    payload = normalizePayload(launch.payload);
  } catch (e) {
    throw codedError("unauthorized", `launch authorization is malformed: ${e.message}`);
  }
  const age = Date.now() - Date.parse(payload.issuedAt);
  if (age > LAUNCH_WINDOW_MS || age < -CLOCK_SKEW_MS) {
    throw codedError("unauthorized", "launch authorization has expired; sign the launch again");
  }
  let signer;
  try {
    signer = ethers.verifyMessage(buildLaunchMessage(payload), launch.signature).toLowerCase();
  } catch {
    throw codedError("unauthorized", "launch signature is not valid");
  }
  if (signer !== payload.artistWallet) {
    throw codedError("unauthorized", "launch was not signed by the artist wallet it names");
  }
  return payload;
}

/** Throws `unauthorized` when a request field differs from the signed one. */
function requireMatch(field, requested, signed) {
  const norm = (v) => (typeof v === "string" ? v.trim().toLowerCase() : v);
  if (norm(requested) !== norm(signed)) {
    throw codedError("unauthorized", `${field} does not match the signed launch`);
  }
}

module.exports = { prepareLaunch, verifyLaunch, requireMatch, buildLaunchMessage, LAUNCH_WINDOW_MS };
