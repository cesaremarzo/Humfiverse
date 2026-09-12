import { Asset, Campaign, Milestone } from '../../core/models';
import { WizardData, WizardStepKey, isValidWalletAddress } from './onboarding.model';

/**
 * Turns a completed wizard draft into the records the rest of the app
 * stores: the Asset and Campaign written locally and persisted to the
 * backend, and the milestone list handed to the escrow contract.
 *
 * Pure on purpose. The component around it is a long sequence of awaited,
 * best-effort network calls in a deliberate order; what each record should
 * *contain* is separable from that, and is the part worth being able to
 * read, reason about, and eventually test on its own.
 */

/** A milestone tranche, in basis points of the campaign's funding goal.
 * `payee` is which wallet the escrow contract releases that tranche to. */
export interface MilestoneTemplate {
  name: string;
  bps: number;
  payee: 'artist' | 'studio';
}

/**
 * The four preproduction tranches, and the single source of truth for them.
 *
 * These used to be written out twice in the component: once as display
 * amounts (`Math.round(total * 0.2)` and so on) and again, forty lines
 * later, as the basis points actually sent to the escrow contract. Nothing
 * checked that the two agreed. Editing one and forgetting the other would
 * have shown the artist and every investor a split the contract did not
 * enforce, with no error anywhere — the UI number and the on-chain number
 * simply disagreeing.
 */
export const PREPRODUCTION_MILESTONES: MilestoneTemplate[] = [
  { name: 'Funding goal reached', bps: 2000, payee: 'artist' },
  { name: 'Studio & collaborators booked', bps: 4000, payee: 'studio' },
  { name: 'Mix & master delivered', bps: 3000, payee: 'artist' },
  { name: 'Release confirmed on DSPs', bps: 1000, payee: 'artist' }
];

/** The optional follow-on raise a catalogue can run for extras around an
 * already-finished track. Both tranches pay the studio, since both are work
 * the studio delivers. */
export const CATALOGUE_EXTRA_MILESTONES: MilestoneTemplate[] = [
  { name: 'Music video produced', bps: 5000, payee: 'studio' },
  { name: 'Marketing campaign launched', bps: 5000, payee: 'studio' }
];

/** The display half of a template: what each tranche is worth in USD. */
export function milestonesForDisplay(templates: MilestoneTemplate[], totalUsd: number): Milestone[] {
  return templates.map((t) => ({
    name: t.name,
    trancheAmount: Math.round((totalUsd * t.bps) / 10000),
    status: 'pending' as const
  }));
}

/** Slug plus a three-digit suffix, so two tracks with the same title don't
 * collide. Not a uniqueness guarantee — the backend rejects a duplicate id
 * with a 409, which is the actual check. */
export function draftAssetId(title: string): string {
  const slug = (title || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${slug}-${Math.floor(Math.random() * 900 + 100)}`;
}

/** Preproduction raises what the artist budgeted; a catalogue always
 * tokenizes at the same illustrative $20 x 1,500 tokens. */
export function draftRaiseTotal(d: WizardData, preprodTotal: number): number {
  return d.model === 'preproduction' ? preprodTotal : 30000;
}

export function buildAssetDraft(d: WizardData, id: string, total: number, artistWallet?: string): Asset {
  const isPre = d.model === 'preproduction';
  const asset: Asset = {
    id,
    kind: isPre ? 'preproduction' : 'catalogue',
    title: d.title || 'Untitled campaign',
    artistName: d.artistName || 'Independent artist',
    // Whose campaign this is. Only knowable if a wallet was connected at
    // creation; the dashboard falls back to the escrow's on-chain artist
    // when it is missing.
    ...(artistWallet ? { artistWallet: artistWallet.toLowerCase() } : {}),
    genre: d.genre || 'Other',
    description: d.description || 'No description provided.',
    verified: false,
    tokenPrice: isPre ? 10 : 20,
    tokensTotal: isPre ? Math.ceil(total / 10) : 1500,
    tokensSold: 0,
    aiDisclosure: { ...d.disclosure },
    dspPolicy: 'Policy exposure to be re-checked at listing review.',
    riskFactors: [
      'This is a newly submitted campaign — diligence has not been completed yet.',
      isPre ? 'Unreleased track: no royalty history, venture-style risk.' : 'Recently submitted: limited royalty history collected so far.'
    ],
    documents: [
      isPre
        ? { name: 'Production budget breakdown', type: 'PDF', date: 'Aug 2026' }
        : { name: d.catalogue.history || 'Royalty statement (pending)', type: 'PDF', date: 'Aug 2026' }
    ],
    status: 'funding'
  };

  if (isPre) {
    asset.targetRaiseUse = 'Studio time, session musicians, mix & master, release';
    asset.milestones = milestonesForDisplay(PREPRODUCTION_MILESTONES, total);
  } else {
    // Both of these were collected by the wizard's catalogue step and then
    // dropped on the floor: the draft held them, the review step showed
    // them back to the artist, and nothing ever wrote them anywhere. They
    // are the provenance of whatever royalty figures get self-reported
    // later, so they belong on the record, shown as declared and unverified.
    asset.royaltySource = d.catalogue.dsp;
    const months = parseInt(d.catalogue.months, 10);
    if (Number.isFinite(months) && months > 0) asset.royaltyHistoryMonths = months;
  }

  // Catalogue-kind campaigns deliberately get no royaltyHistory — a track
  // just uploaded through this wizard has no real distribution history yet.
  // This used to call buildRoyaltyHistory() to fabricate one (a random-walk
  // generator never calibrated against this wizard's own fixed $20 x
  // 1,500-token catalogue economics), which is exactly what produced the
  // ~72-75% "projected yield" the user flagged as fake — recalibrating the
  // generator's numbers would have just produced a more convincing fake
  // one. A real yield needs a real trailing-12-month royalty statement
  // (§2.1/§2.9), which an artist now supplies through the self-reporting
  // form on the asset page; every place that reads royaltyHistory shows an
  // honest "not yet reported" state instead of a number when it's absent.
  return asset;
}

export function buildCampaignDraft(asset: Asset): Campaign {
  return {
    id: asset.id,
    assetId: asset.id,
    title: asset.title,
    artistName: asset.artistName,
    holders: 0,
    milestones: asset.milestones
  };
}

/** Which fields each step requires before the wizard will move on. */
export function canAdvanceFrom(step: WizardStepKey, d: WizardData): boolean {
  if (step === 'basics') return !!d.title.trim() && !!d.artistName.trim();
  if (step === 'model') return !!d.model;
  if (step === 'source' && d.model === 'preproduction') {
    return !!d.preprod.studioName.trim() && isValidWalletAddress(d.preprod.studioWallet);
  }
  if (step === 'source' && d.model === 'catalogue' && d.catalogueCampaign.enabled) {
    return d.catalogueCampaign.goal > 0 && !!d.catalogueCampaign.studioName.trim() && isValidWalletAddress(d.catalogueCampaign.studioWallet);
  }
  return true;
}
