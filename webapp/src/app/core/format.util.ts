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
  // tokensTotal can genuinely be 0: the wizard computes a preproduction
  // campaign's supply as budget/10 and does not require a budget above
  // zero, so a campaign created with every budget field emptied lands
  // here and used to divide by it. The result drives a CSS width, and
  // `width: NaN%` is silently ignored by the browser, leaving a bar that
  // simply never renders rather than an error anyone would notice.
  if (!a.tokensTotal) return 0;
  return Math.min(100, Math.round((a.tokensSold / a.tokensTotal) * 100));
}
