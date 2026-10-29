/* The royalty calculator's formula (master royalties only): per-store gross,
   the distributor's commission, the contract's 1% royalty fee, per token.
   Run with `npm test`. */

import { DEFAULT_STORE_RATES, annualPctOfPrice, computeMasterRoyalty } from './royalty-calculator.util';

const store = (id: string, monthlyStreams: number, rateUsd: number, minAnnualStreams?: number) => ({ id, monthlyStreams, rateUsd, minAnnualStreams });

describe('computeMasterRoyalty', () => {
  it('applies streams × rate, the commission, the 1% fee, then divides by tokens', () => {
    const r = computeMasterRoyalty({
      stores: [store('a', 100_000, 0.004), store('b', 50_000, 0.008)],
      distributorCommissionPct: 10,
      tokensTotal: 1000
    });
    expect(r.grossMonthlyUsd).toBeCloseTo(800, 9);
    expect(r.netMonthlyUsd).toBeCloseTo(720, 9);
    expect(r.holdersMonthlyUsd).toBeCloseTo(712.8, 9);
    expect(r.perTokenMonthlyUsd).toBeCloseTo(0.7128, 9);
    expect(r.perTokenAnnualUsd).toBeCloseTo(8.5536, 9);
  });

  it('pays nothing for a store whose annual minimum is not met', () => {
    const r = computeMasterRoyalty({ stores: [store('spotify', 83, 0.004, 1000), store('x', 83, 0.004)], distributorCommissionPct: 0, tokensTotal: 1 });
    expect(r.lines[0]).toEqual({ id: 'spotify', grossUsd: 0, belowThreshold: true });
    expect(r.lines[1].grossUsd).toBeCloseTo(0.332, 9);
    // 84 × 12 = 1008: over the minimum.
    expect(computeMasterRoyalty({ stores: [store('spotify', 84, 0.004, 1000)], distributorCommissionPct: 0, tokensTotal: 1 }).lines[0].belowThreshold).toBe(false);
  });

  it('treats junk input as zero instead of producing a figure', () => {
    const r = computeMasterRoyalty({ stores: [store('a', NaN, 0.004), store('b', -5, 0.004), store('c', 10, -1)], distributorCommissionPct: 250, tokensTotal: 0 });
    expect(r.grossMonthlyUsd).toBe(0);
    expect(r.perTokenMonthlyUsd).toBe(0);
    const full = computeMasterRoyalty({ stores: [store('a', 1000, 0.01)], distributorCommissionPct: 250, tokensTotal: 1 });
    expect(full.netMonthlyUsd).toBe(0); // commission clamped to 100%
  });

  it('starts every default store at zero streams and a positive rate', () => {
    for (const s of DEFAULT_STORE_RATES) expect(s.rateUsd).toBeGreaterThan(0);
  });
});

describe('annualPctOfPrice', () => {
  it('is the annual royalty per token over the token price', () => {
    expect(annualPctOfPrice(1, 10)).toBe(10);
    expect(annualPctOfPrice(1, 0)).toBeNull();
  });
});
