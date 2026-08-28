import { Asset } from './models';

export function fmtUSD(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: n % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 });
}

export function fmtUSDShort(n: number): string {
  if (n >= 1000) return '$' + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k';
  return '$' + Math.round(n);
}

export function fundingRaised(a: Asset): number {
  return a.tokenPrice * a.tokensSold;
}
export function fundingGoal(a: Asset): number {
  return a.tokenPrice * a.tokensTotal;
}
export function fundingPct(a: Asset): number {
  return Math.min(100, Math.round((a.tokensSold / a.tokensTotal) * 100));
}
