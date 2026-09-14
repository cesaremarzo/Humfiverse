"use strict";
/* Platform fees (§2.71): 5% of every released escrow tranche, 1% of every
   secondary-market payment. Both accrue inside their own contract and
   leave only through that contract's withdrawFees(), which anyone may call
   and which can only pay the contract's feeRecipient.

   Nothing here is counted by this server. Every figure is a read of a
   counter the contract itself keeps, so there is no replayed total to
   drift from the truth (compare the holder index, §2.70). */

const escrowChain = require("../chainEscrow");
const chainMarketplace = require("../chainMarketplace");

/** One entry per fee-bearing contract. A contract whose fees cannot be
 * read reports why instead of a zero: `unsupported` for a deployment that
 * predates the fee, `unavailable` for a read that failed. */
async function getSummary() {
  const [escrow, marketplace] = await Promise.all([
    read(() => escrowChain.getFeeState(), "the configured escrow contract predates the platform fee"),
    read(
      () => chainMarketplace.getFeeState(),
      chainMarketplace.marketplaceEnabled()
        ? "the configured marketplace contract takes its fee in tokens, not ETH"
        : "no marketplace contract is configured on this server"
    )
  ]);
  return { escrow, marketplace };
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
