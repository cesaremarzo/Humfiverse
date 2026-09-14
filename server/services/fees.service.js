"use strict";
/* Platform fees (§2.71, §2.72): 2% of every primary purchase — a catalogue
   buy() on the token, a contribution on the escrow — 3% of every released
   escrow tranche, and 1% of every secondary-market payment. Each accrues
   inside its own contract and leaves only through that contract's
   withdrawFees(), which anyone may call and which can only pay the
   contract's feeRecipient.

   Nothing here is counted by this server. Every figure is a read of a
   counter the contract itself keeps, so there is no replayed total to
   drift from the truth (compare the holder index, §2.70). */

const chain = require("../chain");
const escrowChain = require("../chainEscrow");
const chainMarketplace = require("../chainMarketplace");

/** One entry per fee-bearing contract. A contract whose fees cannot be
 * read reports why instead of a zero: `unsupported` for a deployment that
 * predates the fee, `unavailable` for a read that failed. */
async function getSummary() {
  const [catalogue, escrow, marketplace] = await Promise.all([
    read(() => chain.getFeeState(), "the configured token contract predates the primary-sale fee"),
    read(() => escrowChain.getFeeState(), "the configured escrow contract predates the platform fees"),
    read(
      () => chainMarketplace.getFeeState(),
      chainMarketplace.marketplaceEnabled()
        ? "the configured marketplace contract takes its fee in tokens, not ETH"
        : "no marketplace contract is configured on this server"
    )
  ]);
  return { catalogue, escrow, marketplace };
}

async function read(fn, unsupportedReason) {
  try {
    const state = await fn();
    return state ? { status: "ok", ...state } : { status: "unsupported", reason: unsupportedReason };
  } catch (err) {
    return { status: "unavailable", reason: String(err.message || err) };
  }
}

module.exports = { getSummary };
