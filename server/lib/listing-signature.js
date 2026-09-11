"use strict";
/* Proof that the wallet named as the seller actually authorised a listing.
 *
 * Without this, `seller` was just a string in the request body. Anyone
 * could publish an offer on behalf of any wallet holding tokens, and
 * cancel anyone else's listing — the seller address is returned by
 * GET /api/listings, so there was nothing to guess. Demonstrated against
 * a local instance before this file existed: a listing of 500 of another
 * wallet's tokens at $0.01 was accepted, and that wallet's own listing
 * was then cancelled by a caller who held nothing.
 *
 * The seller now signs a plain-text message stating the exact terms, and
 * the server rebuilds that message from the submitted fields and recovers
 * the address from the signature. A signature therefore only authorises
 * the precise offer it was shown: change the quantity, the price, the
 * asset or the wallet and recovery no longer matches.
 *
 * This is authentication, not settlement. It proves who asked; it does
 * not move or lock a single token. The real listing flow is an on-chain
 * `list()` call to HumfiverseMarketplace.sol, which is written and tested
 * but not yet deployed — see the header of services/listings.service.js.
 * The message text says so, so nobody signs it thinking otherwise. */

const { ethers } = require("ethers");

/** How long a signed message stays usable. Short enough that a captured
 * signature is not indefinitely replayable, long enough for a slow wallet
 * confirmation on a phone. */
const MAX_AGE_MS = 10 * 60 * 1000;

function buildListingMessage({ assetId, seller, qty, pricePerToken, issuedAt }) {
  return [
    "Humfiverse — authorise a resale listing",
    "",
    `Asset: ${assetId}`,
    `Quantity: ${qty}`,
    `Price per token: ${pricePerToken}`,
    `Wallet: ${String(seller).toLowerCase()}`,
    `Issued: ${issuedAt}`,
    "",
    "Signing proves you own this wallet. It does not move or lock your",
    "tokens — they stay in your wallet and you can transfer them at any",
    "time. This publishes an offer, it does not settle a trade."
  ].join("\n");
}

function buildCancelMessage({ listingId, seller, issuedAt }) {
  return [
    "Humfiverse — cancel a resale listing",
    "",
    `Listing: ${listingId}`,
    `Wallet: ${String(seller).toLowerCase()}`,
    `Issued: ${issuedAt}`
  ].join("\n");
}

/** Recovers the signer and checks it matches, the message is the one the
 * terms produce, and the timestamp is recent. Returns null when valid, or
 * a reason string when not. */
function checkSignature({ message, signature, expectedSigner, issuedAt }) {
  if (typeof signature !== "string" || !signature) return "a wallet signature is required";
  const issuedMs = Date.parse(issuedAt || "");
  if (!Number.isFinite(issuedMs)) return "issuedAt must be an ISO timestamp";
  const age = Date.now() - issuedMs;
  // A little tolerance for a clock running ahead of the server's.
  if (age > MAX_AGE_MS || age < -MAX_AGE_MS) return "signature has expired, please sign again";

  let recovered;
  try {
    recovered = ethers.verifyMessage(message, signature);
  } catch {
    return "signature could not be verified";
  }
  if (recovered.toLowerCase() !== String(expectedSigner).toLowerCase()) {
    return "signature does not match the wallet it claims to be from";
  }
  return null;
}

module.exports = { buildListingMessage, buildCancelMessage, checkSignature, MAX_AGE_MS };
