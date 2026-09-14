"use strict";
/* Which currency a contract's amounts are in (§2.73).

   The live contracts take USDC, and every amount this API returns is in
   USDC base units (1e6 = $1). Contracts deployed before that took ETH — the
   legacy escrow Guns finished on is still read — and their amounts are wei
   at the app's illustrative 0.0001 ETH = $1 mapping. Those are converted
   here, once, so no caller ever receives wei under a USDC field name.

   A contract is USDC-denominated exactly when it exposes paymentToken().
   Only a revert or an empty return means "no such function"; an RPC
   failure is rethrown rather than read as "legacy". */

const { withRetry } = require("./chainRetry");

// 1e14 wei per $1 over 1e6 USDC base units per $1.
const LEGACY_WEI_PER_USDC_UNIT = 100_000_000n;

const cache = new Map();

/** The contract's payment token address, or null for an ETH-era contract. */
function paymentTokenOf(contract) {
  const key = contract.target;
  if (!cache.has(key)) {
    cache.set(
      key,
      withRetry(() => contract.paymentToken()).catch((err) => {
        if (err.code === "CALL_EXCEPTION" || err.code === "BAD_DATA") return null;
        cache.delete(key);
        throw err;
      })
    );
  }
  return cache.get(key);
}

/** A converter from the contract's raw amounts to USDC base units. */
async function toUsdcFor(contract) {
  return (await paymentTokenOf(contract)) ? (v) => BigInt(v) : (v) => BigInt(v) / LEGACY_WEI_PER_USDC_UNIT;
}

module.exports = { paymentTokenOf, toUsdcFor, LEGACY_WEI_PER_USDC_UNIT };
