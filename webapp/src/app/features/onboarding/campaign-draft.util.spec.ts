/* The wizard's figures are the contract's figures: the price per token
   (§2.79), each milestone's share, fees and payout (§2.72, §2.74), and the
   raise deadline and minimum signed into the launch (§2.114). A number here
   that disagreed with the escrow would show the artist and every investor a
   split the contract does not enforce. Run with `npm test`. */

import {
  escrowMilestonesFor,
  CATALOGUE_EXTRA_MILESTONES,
  PREPRODUCTION_MILESTONES,
  milestoneTotalBps,
  milestonesValid,
  marketingStageMilestones,
  milestoneBreakdown,
  trancheUsd,
  raiseTerms,
  raiseRuleOnChain,
  draftAssetId,
  RAISE_MAX_DAYS
} from './campaign-draft.util';

describe('milestone splits', () => {
  it('the default preproduction split totals 100% and is valid', () => {
    expect(milestoneTotalBps(PREPRODUCTION_MILESTONES)).toBe(10_000);
    expect(milestonesValid(PREPRODUCTION_MILESTONES)).toBe(true);
  });

  it('refuses a split that does not total 100%, a 0% milestone, or a nameless one', () => {
    expect(milestonesValid([{ name: 'a', bps: 5_000, payee: 'artist' }, { name: 'b', bps: 4_000, payee: 'artist' }])).toBe(false);
    expect(milestonesValid([{ name: 'a', bps: 10_000, payee: 'artist' }, { name: 'b', bps: 0, payee: 'artist' }])).toBe(false);
    expect(milestonesValid([{ name: '  ', bps: 10_000, payee: 'artist' }])).toBe(false);
    expect(milestonesValid([])).toBe(false);
  });

  it('marketing stages are equal, total exactly 100%, and put the remainder on the last', () => {
    const stages = marketingStageMilestones(3, (n) => `Stage ${n}`);
    expect(stages.map((s) => s.bps)).toEqual([3_333, 3_333, 3_334]);
    expect(milestoneTotalBps(stages)).toBe(10_000);
    expect(stages.every((s) => s.payee === 'studio')).toBe(true);
  });
});

describe('milestone money, as the escrow computes it (§2.72)', () => {
  it('a 20% milestone of a $100 goal: $20 share, 2% on arrival, 3% on release', () => {
    const b = milestoneBreakdown(100, 2_000);
    expect(b.shareUsd).toBe(20);
    expect(b.trancheUsd).toBe(19.6); // sized against the goal less the 2%
    expect(b.contributionFeeUsd).toBeCloseTo(0.4, 6);
    expect(b.milestoneFeeUsd).toBeCloseTo(0.588, 6);
    expect(b.payeeUsd).toBeCloseTo(19.012, 6);
    expect(b.feesUsd).toBeCloseTo(b.shareUsd - b.payeeUsd, 6);
  });

  it('across a sold-out campaign that releases everything, the platform keeps 4.94%', () => {
    const goal = 10_000;
    const fees = PREPRODUCTION_MILESTONES.reduce((sum, m) => sum + milestoneBreakdown(goal, m.bps).feesUsd, 0);
    expect(fees).toBeCloseTo(goal * 0.0494, 2);
  });

  it('trancheUsd is the exact tranche floored to the cent, for display', () => {
    for (const m of PREPRODUCTION_MILESTONES) {
      const exact = milestoneBreakdown(1_234.56, m.bps).trancheUsd;
      expect(trancheUsd(1_234.56, m.bps)).toBe(Math.floor(exact * 100 + 1e-9) / 100);
    }
  });
});

describe('price per token (§2.79)', () => {
  it('is the funding divided by the supply, rounded down in USDC units', () => {
    const t = raiseTerms(10, 3);
    expect(t.valid).toBe(true);
    expect(t.priceUsd).toBe(3.333333);
    expect(t.effectiveUsd).toBe(9.999999);
    expect(t.rounded).toBe(true);
  });

  it('an exact division is not rounded', () => {
    const t = raiseTerms(5, 5);
    expect(t.priceUsd).toBe(1);
    expect(t.rounded).toBe(false);
  });

  it('is invalid with no funding, no supply, a fractional supply, or a price that rounds to zero', () => {
    expect(raiseTerms(0, 10).valid).toBe(false);
    expect(raiseTerms(10, 0).valid).toBe(false);
    expect(raiseTerms(10, 2.5).valid).toBe(false);
    expect(raiseTerms(0.000001 * 2, 3).valid).toBe(false);
  });
});

describe('raise deadline and minimum (§2.114)', () => {
  const now = Date.parse('2026-10-12T12:00:00Z');

  it('signs the end of the chosen day in UTC and the minimum in bps', () => {
    expect(raiseRuleOnChain({ deadline: '2026-12-11', minPercent: 50 }, now)).toEqual({
      raiseDeadline: Date.parse('2026-12-11T23:59:59Z') / 1000,
      minRaiseBps: 5_000
    });
    expect(raiseRuleOnChain({ deadline: '2026-12-11', minPercent: 12.34 }, now)?.minRaiseBps).toBe(1_234);
  });

  it('refuses a date today or earlier, or more than a year away', () => {
    expect(raiseRuleOnChain({ deadline: '2026-10-11', minPercent: 50 }, now)).toBeNull();
    expect(raiseRuleOnChain({ deadline: '2027-10-13', minPercent: 50 }, now)).toBeNull();
    const lastDay = new Date(now + (RAISE_MAX_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
    expect(raiseRuleOnChain({ deadline: lastDay, minPercent: 50 }, now)).not.toBeNull();
  });

  it('refuses a minimum of 0% or over 100%, and a malformed date', () => {
    expect(raiseRuleOnChain({ deadline: '2026-12-11', minPercent: 0 }, now)).toBeNull();
    expect(raiseRuleOnChain({ deadline: '2026-12-11', minPercent: 101 }, now)).toBeNull();
    expect(raiseRuleOnChain({ deadline: '11/12/2026', minPercent: 50 }, now)).toBeNull();
  });
});

describe('asset ids', () => {
  it('are a lowercase slug of the title with a three-digit suffix', () => {
    expect(draftAssetId('Night Swim!')).toMatch(/^night-swim-\d{3}$/);
    expect(draftAssetId('')).toMatch(/^untitled-\d{3}$/);
  });
});

describe('milestone kinds (§2.119)', () => {
  it('makes the last preproduction stage the release, with or without the saved kind', () => {
    const kinds = escrowMilestonesFor(PREPRODUCTION_MILESTONES, true).map((m) => m.kind);
    expect(kinds).toEqual(['standard', 'standard', 'standard', 'release']);
    const oldDraft = PREPRODUCTION_MILESTONES.map(({ kind, ...m }) => m);
    expect(escrowMilestonesFor(oldDraft, true)[3].kind).toBe('release');
  });

  it('keeps an advance only first and paid to the artist', () => {
    const withAdvance = PREPRODUCTION_MILESTONES.map((m, i) => (i === 0 ? { ...m, kind: 'advance' as const } : m));
    expect(escrowMilestonesFor(withAdvance, true)[0].kind).toBe('advance');
    const misplaced = PREPRODUCTION_MILESTONES.map((m, i) => (i === 1 ? { ...m, kind: 'advance' as const } : m));
    expect(escrowMilestonesFor(misplaced, true)[1].kind).toBe('standard');
  });

  it('leaves a catalogue campaign standard unless asked', () => {
    expect(escrowMilestonesFor(CATALOGUE_EXTRA_MILESTONES, false).map((m) => m.kind)).toEqual(['standard', 'standard']);
  });
});
