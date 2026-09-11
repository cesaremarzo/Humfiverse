import { Asset } from './models';

/**
 * Aggregates over an asset's self-reported royalty history, and the format
 * check the report form applies before submitting one.
 *
 * These are the read side of the reporting flow that replaced the fabricated
 * random-walk generator: a real, dated, per-month figure a wallet submits, or
 * nothing at all. An asset with no history is not an asset earning zero, so
 * every total below is over what was actually reported — the UI shows a
 * "pending" state rather than a number when the history is empty.
 *
 * `computeYieldBreakdown` in yield.util.ts consumes the same field.
 */

/** YYYY-MM. Deliberately identical to the pattern the backend re-validates
 * with, so a submission the form accepts is never rejected server-side for
 * its shape. */
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidRoyaltyMonth(month: string): boolean {
  return MONTH_PATTERN.test(month);
}

export function royaltyTotal(a: Asset): number {
  return (a.royaltyHistory || []).reduce((sum, m) => sum + m.royaltyUSD, 0);
}

/** Mean over the months actually reported, not over a fixed 12 — reporting
 * three months and reporting twelve are different amounts of evidence, and
 * dividing both by 12 would quietly understate the first. */
export function royaltyAvg(a: Asset): number {
  const history = a.royaltyHistory || [];
  return history.length ? Math.round(royaltyTotal(a) / history.length) : 0;
}
