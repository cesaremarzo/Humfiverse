import { ROYALTY_FEE_BPS } from './primary-fee.util';

/**
 * The royalty calculator on a launched campaign's page: what the master
 * (recording) royalties of a track come to, per token, at a given number of
 * monthly streams.
 *
 * Only the master flow. A token is a share of the master royalties the
 * distributor pays under the distribution contract; copyright royalties
 * (composition and lyrics, collected by SIAE or another collecting society)
 * stay with the authors and are not part of the token, even when they come
 * from the same streams. The calculator therefore never adds them in.
 *
 *   gross    = Σ streams_s × rate_s          (per store s, per month)
 *   net      = gross × (1 − distributor commission)
 *   holders  = net × (1 − ROYALTY_FEE_BPS)   (what the token contract shares out)
 *   perToken = holders ÷ tokensTotal
 *
 * Every rate is an average of past payouts, not a tariff: stores split a
 * monthly revenue pool by share of streams, so the real figure moves with
 * country, subscription tier and month. The defaults below are only a
 * starting point the visitor can change, and the page says so.
 */

export interface StoreRate {
  id: string;
  label: string;
  /** USD paid to the master rights holder per stream, on average. */
  rateUsd: number;
  /** Streams a track needs in the trailing 12 months before the store pays
   * anything for it (Spotify, since April 2024). */
  minAnnualStreams?: number;
}

/** Midpoints of published industry estimates of the per-stream master
 * payout, 2025 (Royalty Exchange, Digital Music News and others). Not
 * official rates: no store publishes one. */
export const RATES_AS_OF = '2025';
export const DEFAULT_STORE_RATES: StoreRate[] = [
  { id: 'spotify', label: 'Spotify', rateUsd: 0.004, minAnnualStreams: 1000 },
  { id: 'apple', label: 'Apple Music', rateUsd: 0.008 },
  { id: 'amazon', label: 'Amazon Music', rateUsd: 0.0045 },
  { id: 'youtube', label: 'YouTube Music', rateUsd: 0.002 },
  { id: 'deezer', label: 'Deezer', rateUsd: 0.0064 },
  { id: 'tidal', label: 'TIDAL', rateUsd: 0.0128 }
];

export interface StoreInput {
  id: string;
  monthlyStreams: number;
  rateUsd: number;
  minAnnualStreams?: number;
}

export interface CalculatorInput {
  stores: StoreInput[];
  /** 0–100: what the distributor (or label) keeps under its contract. */
  distributorCommissionPct: number;
  tokensTotal: number;
}

export interface StoreLine {
  id: string;
  grossUsd: number;
  /** True when the store's minimum annual streams is not met, so it pays 0. */
  belowThreshold: boolean;
}

export interface CalculatorResult {
  lines: StoreLine[];
  grossMonthlyUsd: number;
  netMonthlyUsd: number;
  holdersMonthlyUsd: number;
  perTokenMonthlyUsd: number;
  perTokenAnnualUsd: number;
}

/** Negative, NaN and infinite inputs count as 0, and a commission is
 * clamped to 0–100: a typo in a form field must not produce a figure. */
function clean(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function computeMasterRoyalty(input: CalculatorInput): CalculatorResult {
  const lines = input.stores.map((s) => {
    const streams = clean(s.monthlyStreams);
    const belowThreshold = s.minAnnualStreams !== undefined && streams * 12 < s.minAnnualStreams;
    return { id: s.id, grossUsd: belowThreshold ? 0 : streams * clean(s.rateUsd), belowThreshold };
  });
  const grossMonthlyUsd = lines.reduce((sum, l) => sum + l.grossUsd, 0);
  const commission = Math.min(clean(input.distributorCommissionPct), 100) / 100;
  const netMonthlyUsd = grossMonthlyUsd * (1 - commission);
  const holdersMonthlyUsd = netMonthlyUsd * (1 - ROYALTY_FEE_BPS / 10_000);
  const tokens = clean(input.tokensTotal);
  const perTokenMonthlyUsd = tokens ? holdersMonthlyUsd / tokens : 0;
  return { lines, grossMonthlyUsd, netMonthlyUsd, holdersMonthlyUsd, perTokenMonthlyUsd, perTokenAnnualUsd: perTokenMonthlyUsd * 12 };
}

/** Annual royalty per token as a % of the token price, or null without a price. */
export function annualPctOfPrice(perTokenAnnualUsd: number, tokenPriceUsd: number): number | null {
  return tokenPriceUsd > 0 ? (perTokenAnnualUsd / tokenPriceUsd) * 100 : null;
}
