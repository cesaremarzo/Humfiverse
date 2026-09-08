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

export type ChartGranularity = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ValueSnapshot {
  date: string; // YYYY-MM-DD, UTC calendar day — matches server.js's portfolio_snapshots
  valueUsd: number;
}

/** ISO 8601 week ("2026-W37") — used only as a stable bucket key, not
 * displayed, so the exact ISO edge-case handling around year boundaries
 * only needs to be "consistent", not textbook-perfect. */
function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (t.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  t.setUTCDate(t.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round((t.getTime() - firstThursday.getTime()) / 86400000 / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Buckets raw daily snapshots (already ORDER BY date ASC from the
 * backend) into one point per period, keeping the *last* snapshot in
 * each period — the same "closing value" convention real price charts
 * use for coarser timeframes. This only changes how already-real points
 * are grouped; it never interpolates or invents a point for a period
 * that has none. */
export function bucketSnapshots(history: ValueSnapshot[], granularity: ChartGranularity): ValueSnapshot[] {
  if (granularity === 'daily') return history;
  const buckets = new Map<string, ValueSnapshot>();
  for (const point of history) {
    const d = new Date(point.date + 'T00:00:00Z');
    const key =
      granularity === 'yearly'
        ? String(d.getUTCFullYear())
        : granularity === 'monthly'
          ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
          : isoWeekKey(d);
    buckets.set(key, point); // ascending input -> last write per key is the period's latest real snapshot
  }
  return [...buckets.values()];
}
