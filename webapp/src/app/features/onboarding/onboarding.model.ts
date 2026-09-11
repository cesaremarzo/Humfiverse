import { AiDisclosure, DisclosureLevel } from '../../core/models';

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
  catalogue: { dsp: string; months: string; history: string };
  preprod: { studio: number; session: number; mix: number; extra: number; studioName: string; studioWallet: string };
  /** Optional, catalogue-kind only: an already-tokenized, already-earning
   * catalogue can *additionally* raise a small milestone-gated fund for
   * post-launch production work (a video, a marketing push) — the same
   * escrow mechanism preproduction campaigns use for financing the track
   * itself, reused here for financing extras around an already-finished
   * one. `goal` is USD, same illustrative mapping as everywhere else in
   * this wizard. */
  catalogueCampaign: { enabled: boolean; goal: number; studioName: string; studioWallet: string };
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
    catalogue: { dsp: 'Spotify for Artists', months: '12', history: '' },
    preprod: { studio: 5000, session: 4000, mix: 3000, extra: 1000, studioName: '', studioWallet: '' },
    catalogueCampaign: { enabled: false, goal: 2000, studioName: '', studioWallet: '' },
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
