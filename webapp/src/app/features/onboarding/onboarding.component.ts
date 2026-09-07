import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { IconComponent } from '../../shared/icon.component';
import { StoreService } from '../../core/store.service';
import { WalletService } from '../../core/wallet.service';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { AiDisclosure, Asset, Campaign, DisclosureLevel } from '../../core/models';
import { fmtUSD } from '../../core/format.util';
import { usdToWei } from '../../core/usd-eth.util';
import { clauseCategory, clauseText, contractLegalBasisNote, vessatoriaClauseIds } from '../../core/contract-text.util';

type ModelKind = 'catalogue' | 'preproduction' | null;
type WizardStepKey = 'basics' | 'model' | 'source' | 'disclosure' | 'contract' | 'review';

interface WizardData {
  model: ModelKind;
  title: string;
  artistName: string;
  genre: string;
  description: string;
  catalogue: { dsp: string; months: string; history: string };
  preprod: { studio: number; session: number; mix: number; extra: number; studioName: string; studioWallet: string };
  disclosure: AiDisclosure;
  contract: { generalAccepted: boolean; vessatoriaAccepted: Record<string, boolean> };
  ack: boolean;
}

const WIZARD_STEPS: { key: WizardStepKey; labelKey: string }[] = [
  { key: 'basics', labelKey: 'wizStep.basics' },
  { key: 'model', labelKey: 'wizStep.model' },
  { key: 'source', labelKey: 'wizStep.source' },
  { key: 'disclosure', labelKey: 'wizStep.disclosure' },
  { key: 'contract', labelKey: 'wizStep.contract' },
  { key: 'review', labelKey: 'wizStep.review' }
];

function freshWizardData(): WizardData {
  return {
    model: null,
    title: '',
    artistName: '',
    genre: 'Indie Pop',
    description: '',
    catalogue: { dsp: 'Spotify for Artists', months: '12', history: '' },
    preprod: { studio: 5000, session: 4000, mix: 3000, extra: 1000, studioName: '', studioWallet: '' },
    disclosure: { vocals: 'human', instrumentation: 'human', composition: 'human', postProduction: 'human', lyrics: 'human' },
    contract: { generalAccepted: false, vessatoriaAccepted: {} },
    ack: false
  };
}

const GENRES: [string, string][] = [
  ['Indie Pop', 'genre.indiePop'],
  ['Electronic', 'genre.electronic'],
  ['Alt R&B', 'genre.altRnb'],
  ['Lo-fi / Ambient', 'genre.lofiAmbient'],
  ['Cinematic / Orchestral', 'genre.cinematic'],
  ['Rock', 'genre.rock'],
  ['Hip-Hop', 'genre.hiphop'],
  ['Other', 'genre.other']
];
const DISTRIBUTORS = ['Spotify for Artists', 'Apple Music for Artists', 'DistroKid', 'Believe', 'SIAE'];
const DISCLOSURE_ROWS: [keyof AiDisclosure, string][] = [
  ['vocals', 'disclosure.vocals'],
  ['instrumentation', 'disclosure.instrumentation'],
  ['composition', 'disclosure.composition'],
  ['postProduction', 'disclosure.postProduction'],
  ['lyrics', 'disclosure.lyrics']
];
const DISCLOSURE_VALUES: [DisclosureLevel, string][] = [
  ['human', 'disclosure.human'],
  ['ai-assisted', 'disclosure.aiAssisted'],
  ['ai', 'disclosure.ai']
];

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [TranslatePipe, IconComponent],
  templateUrl: './onboarding.component.html'
})
export class OnboardingComponent {
  steps = WIZARD_STEPS;
  genres = GENRES;
  distributors = DISTRIBUTORS;
  disclosureRows = DISCLOSURE_ROWS;
  disclosureValues = DISCLOSURE_VALUES;
  fmt = fmtUSD;

  stepIndex = signal(0);
  data = signal<WizardData>(freshWizardData());
  /** The real audio file for this track, if the artist attached one
   * (§2.43) — kept out of WizardData since a File object doesn't survive
   * freshWizardData()'s reset-by-spread pattern meaningfully, and it's
   * transient upload state, not campaign data. Uploaded (to IPFS, then
   * linked on-chain) after a successful mint in submit() below. */
  audioFile = signal<File | null>(null);

  /** True from the moment submit() is clicked until every best-effort
   * on-chain step (mint, audio link, escrow) has settled — see submit()'s
   * comment on why this can genuinely take up to a minute and why the app
   * used to navigate away long before that finished. */
  submitting = signal(false);

  stepKey = computed(() => this.steps[this.stepIndex()].key);

  preprodTotal = computed(() => {
    const p = this.data().preprod;
    return p.studio + p.session + p.mix + p.extra;
  });
  preprodTokenCount = computed(() => Math.ceil(this.preprodTotal() / 10).toLocaleString());

  isTranslated = computed(() => this.store.locale() !== (this.store.contractTemplate().authoritativeLanguage || 'it'));

  plainClauses = computed(() => this.store.contractTemplate().clauses.filter((c) => !c.vessatoria));
  vClauses = computed(() => this.store.contractTemplate().clauses.filter((c) => c.vessatoria));

  constructor(
    public store: StoreService,
    public wallet: WalletService,
    private api: ApiService,
    private toast: ToastService,
    private translate: TranslateService,
    private router: Router
  ) {}

  updateData(patch: Partial<WizardData>): void {
    this.data.update((d) => ({ ...d, ...patch }));
  }

  updatePreprodField(field: 'studio' | 'session' | 'mix' | 'extra', value: string): void {
    const n = Math.max(0, parseInt(value || '0', 10) || 0);
    this.data.update((d) => ({ ...d, preprod: { ...d.preprod, [field]: n } }));
  }

  updatePreprodTextField(field: 'studioName' | 'studioWallet', value: string): void {
    this.data.update((d) => ({ ...d, preprod: { ...d.preprod, [field]: value } }));
  }

  isValidWalletAddress(value: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
  }

  setDisclosure(key: keyof AiDisclosure, value: DisclosureLevel): void {
    this.data.update((d) => ({ ...d, disclosure: { ...d.disclosure, [key]: value } }));
  }

  text(clauseId: string, field: 'title' | 'body'): string {
    const tpl = this.store.contractTemplate();
    const clause = tpl.clauses.find((c) => c.id === clauseId)!;
    return clauseText(tpl, clause, field, this.store.locale());
  }
  category(clauseId: string): string {
    const tpl = this.store.contractTemplate();
    const clause = tpl.clauses.find((c) => c.id === clauseId)!;
    return clauseCategory(clause, this.store.locale(), tpl.authoritativeLanguage);
  }
  legalBasisNote(): string {
    return contractLegalBasisNote(this.store.contractTemplate(), this.store.locale());
  }

  toggleVessatoria(clauseId: string, checked: boolean): void {
    this.data.update((d) => ({
      ...d,
      contract: { ...d.contract, vessatoriaAccepted: { ...d.contract.vessatoriaAccepted, [clauseId]: checked } }
    }));
  }
  setGeneralAccepted(checked: boolean): void {
    this.data.update((d) => ({ ...d, contract: { ...d.contract, generalAccepted: checked } }));
  }

  isContractComplete(): boolean {
    const d = this.data();
    if (!d.contract.generalAccepted) return false;
    return vessatoriaClauseIds(this.store.contractTemplate()).every((id) => d.contract.vessatoriaAccepted[id] === true);
  }

  canAdvance(): boolean {
    const d = this.data();
    const key = this.stepKey();
    if (key === 'basics') return !!d.title.trim() && !!d.artistName.trim();
    if (key === 'model') return !!d.model;
    if (key === 'source' && d.model === 'preproduction') {
      return !!d.preprod.studioName.trim() && this.isValidWalletAddress(d.preprod.studioWallet);
    }
    if (key === 'contract') return this.isContractComplete();
    return true;
  }

  back(): void {
    this.stepIndex.update((i) => Math.max(0, i - 1));
  }

  next(): void {
    if (!this.canAdvance()) {
      const msg = this.stepKey() === 'contract' ? 'wizContract.requiredNote' : 'wizard.fillRequired';
      this.toast.show(this.translate.instant(msg), 'alert');
      return;
    }
    this.stepIndex.update((i) => Math.min(this.steps.length - 1, i + 1));
  }

  attachStatement(): void {
    this.updateData({ catalogue: { ...this.data().catalogue, history: 'royalty-statement-2026.pdf' } });
    this.toast.show(this.translate.instant('toast.statementAttached'), 'file');
  }

  onAudioFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (file && file.size > 20 * 1024 * 1024) {
      this.toast.show(this.translate.instant('toast.audioTooLarge'), 'alert');
      (event.target as HTMLInputElement).value = '';
      return;
    }
    this.audioFile.set(file);
  }

  async submit(): Promise<void> {
    if (this.submitting()) return; // guard against a double-click firing this twice
    this.submitting.set(true);
    const d = this.data();
    const audioFile = this.audioFile(); // captured before the reset below

    if (this.store.backendAvailable()) {
      try {
        const receipt = await this.api.submitContractAcceptance({
          artistName: d.artistName,
          trackTitle: d.title,
          templateVersion: this.store.contractTemplate().version,
          generalAccepted: d.contract.generalAccepted,
          vessatoriaAccepted: d.contract.vessatoriaAccepted
        });
        this.toast.show(this.translate.instant('toast.contractAccepted', { receipt: receipt.receiptHash.slice(0, 10) + '…' }), 'checkCircle');
      } catch (err) {
        console.warn('Contract acceptance rejected by backend.', err);
        this.toast.show(this.translate.instant('toast.contractFailed'), 'alert');
        this.submitting.set(false);
        return;
      }
    }

    const isPre = d.model === 'preproduction';
    const id = (d.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.floor(Math.random() * 900 + 100);
    const total = isPre ? this.preprodTotal() : 30000;

    const asset: Asset = {
      id,
      kind: isPre ? 'preproduction' : 'catalogue',
      title: d.title || 'Untitled campaign',
      artistName: d.artistName || 'Independent artist',
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
      asset.milestones = [
        { name: 'Funding goal reached', trancheAmount: Math.round(total * 0.2), status: 'pending' },
        { name: 'Studio & collaborators booked', trancheAmount: Math.round(total * 0.4), status: 'pending' },
        { name: 'Mix & master delivered', trancheAmount: Math.round(total * 0.3), status: 'pending' },
        { name: 'Release confirmed on DSPs', trancheAmount: Math.round(total * 0.1), status: 'pending' }
      ];
    }
    // Catalogue-kind campaigns deliberately get no royaltyHistory here — a
    // track just uploaded through this wizard has no real distribution
    // history yet. This used to call buildRoyaltyHistory() to fabricate one
    // (a random-walk generator never calibrated against this wizard's own
    // fixed $20 x 1,500-token catalogue economics), which is exactly what
    // produced the ~72-75% "projected yield" the user flagged as fake —
    // recalibrating the generator's numbers would have just produced a
    // more convincing fake one. A real yield needs a real trailing-12-month
    // royalty statement (§2.1/§2.9), which this prototype has no way to
    // collect yet; every place that reads royaltyHistory shows an honest
    // "not yet reported" state instead of a number when it's absent.

    const campaign: Campaign = { id, assetId: id, title: asset.title, artistName: asset.artistName, holders: 0, milestones: asset.milestones };
    this.store.assets.update((assets) => [asset, ...assets]);
    this.store.campaigns.update((campaigns) => [campaign, ...campaigns]);

    this.stepIndex.set(0);
    this.data.set(freshWizardData());
    this.audioFile.set(null);

    this.toast.show(this.translate.instant('toast.campaignLaunched'), 'sparkles');

    // Persist to the backend so this campaign shows up for every visitor,
    // not just this browser tab — previously the campaign only ever lived
    // in this tab's local signal and vanished on refresh, even though its
    // on-chain token/escrow (below) are real and permanent. See
    // planning/technical-architecture.md §2.20. Best-effort, same
    // graceful-degradation pattern as the on-chain calls below: the local
    // UI already reflects the campaign either way.
    if (this.store.backendAvailable()) {
      this.api.createAsset({ asset, campaign }).catch((err) => {
        console.warn('Could not persist campaign to the backend (it still exists locally in this tab).', err);
        this.toast.show(this.translate.instant('toast.assetSaveFailed'), 'alert');
      });
    }

    // Every campaign gets an on-chain token at upload time, catalogue and
    // preproduction alike (unified 29 Aug 2026 — see
    // planning/technical-architecture.md §2.14/§2.15). Preproduction
    // campaigns additionally get a real milestone-escrow campaign below,
    // which is what actually controls fund release — the token here is
    // just the claim/quantity record, same role it plays for catalogues.
    if (this.store.backendAvailable()) {
      const priceWei = usdToWei(asset.tokenPrice).toString();
      // Awaited now (§2.42) — createCampaign on the escrow contract
      // requires this token to already exist on-chain, since contribute()
      // releases tokens from this same pool atomically. The two calls used
      // to fire in parallel/unawaited, which raced: if the escrow call
      // reached the chain before the mint transaction had confirmed, campaign
      // creation would revert.
      let mintedTokenId: number | null = null;
      try {
        const result = await this.api.mintOnchainToken({ assetId: id, slug: id, supply: asset.tokensTotal, priceWei, title: asset.title, artist: asset.artistName });
        mintedTokenId = result.tokenId;
        this.toast.show(this.translate.instant('toast.onchainMinted', { tokenId: result.tokenId }), 'checkCircle');
        // The marketplace only lists chain-verified assets (§2.14) — add
        // this one to that set now rather than waiting for a reload,
        // otherwise the campaign would vanish from its own listing right
        // after being created.
        this.store.onchainAssetIds.update((ids) => (ids ? new Set(ids).add(id) : ids));
      } catch (err) {
        console.warn('On-chain mint did not happen (campaign was still created normally).', err);
        this.toast.show(this.translate.instant('toast.onchainMintFailed'), 'alert');
      }

      // Links the real audio file to the just-minted token (§2.43) — needs
      // the mint above to have succeeded first, same reasoning as the
      // escrow campaign below. Best-effort: uploading is optional, and a
      // failure here doesn't affect the token/campaign that already exist.
      // Awaited (previously fire-and-forget with an immediate navigate right
      // after this block) — this request stays open server-side until the
      // Pinata upload *and* the on-chain setTrackAudioUri transaction both
      // confirm, which can genuinely take up to a minute. Navigating away
      // before that finished didn't cancel the request, but it also gave the
      // artist zero signal to stay on the tab — closing it (or the browser
      // backgrounding/killing it) mid-upload silently lost the link forever,
      // with no way to attach audio to an existing campaign afterward. This
      // was the actual cause of tracks created through the wizard ending up
      // with no playable preview.
      if (audioFile && mintedTokenId !== null) {
        try {
          await this.api.uploadTrackAudio(id, audioFile);
          this.toast.show(this.translate.instant('toast.audioLinked'), 'checkCircle');
        } catch (err) {
          console.warn('Audio upload did not happen (campaign was still created normally).', err);
          this.toast.show(this.translate.instant('toast.audioUploadFailed'), 'alert');
        }
      }

      // store.onchainInfoMap (unlike onchainAssetIds just above) is only
      // ever populated once, at app boot — it has no entry for a campaign
      // created since then, so its marketplace card would show no preview
      // icon/funding data until a full page reload. Re-fetching just this
      // one asset's on-chain record now and merging it in fixes that for
      // this session without waiting on a reload, mirroring what already
      // happens for onchainAssetIds above.
      if (mintedTokenId !== null) {
        try {
          const info = await this.api.getOnchainInfo(id);
          this.store.onchainInfoMap.update((map) => new Map(map).set(id, info));
        } catch {
          /* the card just falls back to mock data until the next reload, same as any other onchain-read failure */
        }
      }

      // Preproduction campaigns also get a real milestone escrow (§2.15) —
      // needs the artist's own wallet connected, since that's where every
      // non-studio milestone tranche pays out to, and needs the mint above
      // to have actually succeeded (§2.42 — see the comment there). Best-
      // effort: the campaign still exists without it, just without escrow
      // protection until an artist wallet is set up. Awaited for the same
      // reason as the audio upload above.
      if (isPre && mintedTokenId !== null) {
        const artistAddress = this.wallet.state().address;
        if (!artistAddress) {
          this.toast.show(this.translate.instant('toast.escrowNeedsWallet'), 'alert');
        } else {
          const fundingGoalWei = usdToWei(total).toString();
          try {
            await this.api.createEscrowCampaign({
              assetId: id,
              artistAddress,
              fundingGoalWei,
              studioName: d.preprod.studioName,
              studioWallet: d.preprod.studioWallet,
              milestones: [
                { name: 'Funding goal reached', bps: 2000, payee: 'artist' },
                { name: 'Studio & collaborators booked', bps: 4000, payee: 'studio' },
                { name: 'Mix & master delivered', bps: 3000, payee: 'artist' },
                { name: 'Release confirmed on DSPs', bps: 1000, payee: 'artist' }
              ]
            });
            this.toast.show(this.translate.instant('toast.escrowCreated'), 'checkCircle');
          } catch (err) {
            console.warn('Escrow campaign creation did not happen (campaign was still created normally).', err);
            this.toast.show(this.translate.instant('toast.escrowCreateFailed'), 'alert');
          }
        }
      }
    }

    this.submitting.set(false);
    this.router.navigateByUrl('/artist/dashboard');
  }
}
