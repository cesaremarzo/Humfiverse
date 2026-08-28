import { RoyaltyMonth } from './models';

function monthLabel(offsetFromNow: number): string {
  const d = new Date(2026, 7, 1); // Aug 2026 anchor, matches the original site
  d.setMonth(d.getMonth() - offsetFromNow);
  return d.toLocaleString('en', { month: 'short', year: '2-digit' });
}

/** Same deterministic pseudo-random generator as the original site, so newly
 * launched mock campaigns look the same as before. */
export function buildRoyaltyHistory(months: number, base: number, growth: number, volatility: number, seed: number): RoyaltyMonth[] {
  const out: RoyaltyMonth[] = [];
  let rnd = seed;
  const next = () => {
    rnd = (rnd * 9301 + 49297) % 233280;
    return rnd / 233280;
  };
  for (let i = months - 1; i >= 0; i--) {
    const trend = base * Math.pow(growth, months - 1 - i);
    const noise = 1 + (next() - 0.5) * volatility;
    out.push({ month: monthLabel(i), royaltyUSD: Math.max(0, Math.round(trend * noise)) });
  }
  return out;
}
