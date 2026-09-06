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
