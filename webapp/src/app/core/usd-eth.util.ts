/** Illustrative-only 0.0001 ETH-per-$1 mapping applied at mint time
 * (onboarding.component.ts, mirroring contracts/scripts/catalogues.js) —
 * there is no real USD/ETH peg here. `Asset.tokenPrice` (USD, mock display)
 * and the contract's `pricePerToken` (wei, real) are intentionally two
 * different numbers connected only by this constant. Kept in one place so
 * every wei→USD display figure across the app can't drift out of sync with
 * it, the same reason marketplace-fee.util.ts exists for the resale fee. */
const WEI_PER_USD = 100_000_000_000_000n;

export function weiToUsd(wei: string): number {
  return Number(BigInt(wei) / WEI_PER_USD);
}

export function usdToWei(usd: number): bigint {
  return BigInt(Math.round(usd)) * WEI_PER_USD;
}

/* --- resale prices ---
 * The two above round to whole dollars, which is right for the places they
 * were written for: mint-time prices and pool/escrow amounts are always
 * whole numbers. Reusing them for a seller's own asking price was a
 * mistake. The resale dialog invites cents (`min="0.01" step="0.01"`), so
 * $15.50 silently listed at $16, and anything under $0.50 converted to
 * **zero wei** — which HumfiverseMarketplace rejects outright
 * (`require(pricePerToken > 0)`), surfacing only as a failed transaction.
 *
 * A cent is 1e12 wei at this mapping, still an exact integer, so nothing
 * needs to round at all. */
const WEI_PER_CENT = WEI_PER_USD / 100n;

export function usdToWeiPrecise(usd: number): bigint {
  return BigInt(Math.round(usd * 100)) * WEI_PER_CENT;
}

export function weiToUsdPrecise(wei: string): number {
  return Number(BigInt(wei) / WEI_PER_CENT) / 100;
}
