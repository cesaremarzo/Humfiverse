/** The lowest price at which one more unit of a token could currently be
 * bought on the platform, from any source — this is the valuation the
 * portfolio dashboard uses for both the allocation pie chart and the
 * value-over-time chart (confirmed directly with the user, since the
 * obvious-looking alternative — always the primary price — misses that a
 * reseller can already list below it, see marketplace-fee.util.ts's
 * resale mechanism).
 *
 * While the primary pool still has tokens, that fixed price is the floor
 * *unless* a reseller has undercut it (a real, already-shipped scenario —
 * a holder can list at any price above $0.01, including below what they
 * paid, to liquidate faster). Once the pool is exhausted, only resale
 * listings can supply a new unit, so the lowest active one is the only
 * real answer. With no resale listings at all in that state, there's no
 * live quote to report — falls back to the last known primary price as a
 * display-only estimate rather than showing an empty/zero value. */
export function lowestAvailablePrice(primaryPriceUsd: number, poolBalance: number, lowestResaleAsk: number | null): number {
  if (poolBalance > 0) {
    return lowestResaleAsk !== null ? Math.min(primaryPriceUsd, lowestResaleAsk) : primaryPriceUsd;
  }
  return lowestResaleAsk ?? primaryPriceUsd;
}
