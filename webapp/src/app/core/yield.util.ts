import { Asset, YieldBreakdown } from './models';

/**
 * Projected yield — computed from actual trailing royalty history instead
 * of a hardcoded number: (royalty paid out over the last 12 reported
 * months) / (tokenPrice * tokensTotal) * 100. Returns null when there's
 * no royalty history (e.g. pre-production/unreleased tracks). This is a
 * trailing/historical figure, not a promised or guaranteed return.
 */
export function computeYieldBreakdown(a: Asset): YieldBreakdown | null {
  if (!a.royaltyHistory || !a.royaltyHistory.length || !a.tokenPrice || !a.tokensTotal) return null;
  const last12 = a.royaltyHistory.slice(-12);
  const trailingRoyalty = last12.reduce((sum, m) => sum + m.royaltyUSD, 0);
  const raiseValue = a.tokenPrice * a.tokensTotal;
  if (!raiseValue) return null;
  const pct = (trailingRoyalty / raiseValue) * 100;
  return { pct, trailingRoyalty, raiseValue, months: last12.length };
}

export function computeProjectedYield(a: Asset): number | null {
  const b = computeYieldBreakdown(a);
  return b ? b.pct : null;
}

export function scoreAppropriatenessLocal(answers: {
  priorComplexInvestments: boolean | null;
  familiarWithIlliquidInstruments: boolean | null;
  understandsCapitalLossRisk: boolean | null;
  yearsExperience: string | null;
}): { score: number; result: 'appropriate' | 'warning' } {
  let score = 0;
  if (answers.priorComplexInvestments === true) score += 1;
  if (answers.familiarWithIlliquidInstruments === true) score += 1;
  if (answers.understandsCapitalLossRisk === true) score += 1;
  if (answers.yearsExperience === '3+') score += 1;
  else if (answers.yearsExperience === '1-3') score += 0.5;
  return { score, result: score >= 3 ? 'appropriate' : 'warning' };
}

export function fakeTxHash(): string {
  const chars = '0123456789abcdef';
  let h = '0x';
  for (let i = 0; i < 64; i++) h += chars[Math.floor(Math.random() * 16)];
  return h;
}
