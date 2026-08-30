"use strict";
/* Retry helper for on-chain write calls (chain.js, chainEscrow.js).

   Root cause of a real production bug (30 Aug 2026, see
   planning/technical-architecture.md §2.22): the public Base Sepolia RPC
   (https://sepolia.base.org, the default CHAIN_RPC_URL) rate-limits under
   any burst of requests — a handful of mints/confirms in quick succession
   was enough to trigger "-32016 over rate limit" on eth_getTransactionCount,
   which happens before any transaction is broadcast. The wizard's mint call
   failed outright, so the new campaign never got added to onchainAssetIds
   and silently disappeared from the marketplace (§2.14 only lists
   chain-verified assets) even though the campaign itself had been created.

   Only retries errors that look transient/rate-limit-shaped — a real
   revert (bad input, insufficient funds, business-rule failure) fails
   immediately, same as before. */

const RETRYABLE_CODES = new Set(["UNKNOWN_ERROR", "SERVER_ERROR", "TIMEOUT", "NETWORK_ERROR"]);

function looksRetryable(err) {
  if (RETRYABLE_CODES.has(err && err.code)) return true;
  const msg = String((err && err.message) || err || "").toLowerCase();
  return msg.includes("rate limit") || msg.includes("-32016") || msg.includes("timeout") || msg.includes("econnreset");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retries `fn` up to `retries` extra times (so `retries=2` means 3 total
 * attempts) with exponential backoff, but only for errors that look like a
 * transient RPC problem rather than a genuine on-chain rejection. */
async function withRetry(fn, { retries = 2, baseDelayMs = 1500 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !looksRetryable(err)) throw err;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  throw lastErr;
}

module.exports = { withRetry };
