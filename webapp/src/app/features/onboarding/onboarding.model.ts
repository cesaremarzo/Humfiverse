import { AiDisclosure, DisclosureLevel } from '../../core/models';
import { CATALOGUE_EXTRA_MILESTONES, MilestoneTemplate, PREPRODUCTION_MILESTONES } from './campaign-draft.util';

/** The wizard's own shape and option lists: everything the six steps read
 * from that is data rather than behaviour. Kept beside the component
 * instead of in core/ because nothing outside this wizard has any use for
 * it — an artist's in-progress draft only exists between "start" and
 * "submit". */

export type ModelKind = 'catalogue' | 'preproduction' | null;
export type WizardStepKey = 'basics' | 'model' | 'source' | 'disclosure' | 'contract' | 'review';

export interface WizardData {
  model: ModelKind;
  title: string;
  artistName: string;
  genre: string;
  description: string;
  /** §2.79: `funding` (USD) and `supply` are the artist's; the token
   * contract derives the price from them at mint. */
  catalogue: { dsp: string; months: string; history: string; funding: number; supply: number };
  /** The budget lines sum to the funding requested; `supply` is the token count. */
  preprod: { studio: number; session: number; mix: number; extra: number; supply: number; studioName: string; studioWallet: string };
  /** Catalogue-kind only: whether the funding raised is held in escrow and
   * released by milestones (a video, a marketing campaign in stages)
   * instead of paid to the artist as tokens sell. Since §2.79 there is one
   * raise — `catalogue.funding` — not a separate extra goal. */
  catalogueCampaign: { enabled: boolean; studioName: string; studioWallet: string };
  /** §2.75: a catalogue's extra campaign released as stages of a marketing
   * campaign — the number of stages, or null for a free-form split. */
  catalogueMarketingStages: number | null;
  /** The artist's own split of each raise into milestones (§2.74). Names and
   * payees come from the templates; the percentages are theirs to set, and
   * must total exactly 100% — the escrow contract refuses anything else. */
  preprodMilestones: MilestoneTemplate[];
  catalogueMilestones: MilestoneTemplate[];
  disclosure: AiDisclosure;
  contract: { generalAccepted: boolean; vessatoriaAccepted: Record<string, boolean> };
  ack: boolean;
}

export const WIZARD_STEPS: { key: WizardStepKey; labelKey: string }[] = [
  { key: 'basics', labelKey: 'wizStep.basics' },
  { key: 'model', labelKey: 'wizStep.model' },
  { key: 'source', labelKey: 'wizStep.source' },
  { key: 'disclosure', labelKey: 'wizStep.disclosure' },
  { key: 'contract', labelKey: 'wizStep.contract' },
  { key: 'review', labelKey: 'wizStep.review' }
];

export const GENRES: [string, string][] = [
  ['Indie Pop', 'genre.indiePop'],
  ['Electronic', 'genre.electronic'],
  ['Alt R&B', 'genre.altRnb'],
  ['Lo-fi / Ambient', 'genre.lofiAmbient'],
  ['Cinematic / Orchestral', 'genre.cinematic'],
  ['Rock', 'genre.rock'],
  ['Hip-Hop', 'genre.hiphop'],
  ['Other', 'genre.other']
];

export const DISTRIBUTORS = ['Spotify for Artists', 'Apple Music for Artists', 'DistroKid', 'Believe', 'SIAE'];

export const DISCLOSURE_ROWS: [keyof AiDisclosure, string][] = [
  ['vocals', 'disclosure.vocals'],
  ['instrumentation', 'disclosure.instrumentation'],
  ['composition', 'disclosure.composition'],
  ['postProduction', 'disclosure.postProduction'],
  ['lyrics', 'disclosure.lyrics']
];

export const DISCLOSURE_VALUES: [DisclosureLevel, string][] = [
  ['human', 'disclosure.human'],
  ['ai-assisted', 'disclosure.aiAssisted'],
  ['ai', 'disclosure.ai']
];

export function freshWizardData(): WizardData {
  return {
    model: null,
    title: '',
    artistName: '',
    genre: 'Indie Pop',
    description: '',
    catalogue: { dsp: 'Spotify for Artists', months: '12', history: '', funding: 30000, supply: 1500 },
    preprod: { studio: 5000, session: 4000, mix: 3000, extra: 1000, supply: 1300, studioName: '', studioWallet: '' },
    catalogueCampaign: { enabled: false, studioName: '', studioWallet: '' },
    preprodMilestones: PREPRODUCTION_MILESTONES.map((m) => ({ ...m })),
    catalogueMilestones: CATALOGUE_EXTRA_MILESTONES.map((m) => ({ ...m })),
    catalogueMarketingStages: null,
    disclosure: { vocals: 'human', instrumentation: 'human', composition: 'human', postProduction: 'human', lyrics: 'human' },
    contract: { generalAccepted: false, vessatoriaAccepted: {} },
    ack: false
  };
}

/** Checked before letting the wizard advance past the studio step, because
 * this address is what the escrow contract will pay a milestone tranche to
 * — a typo here is not recoverable once the campaign is on chain. */
export function isValidWalletAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}
