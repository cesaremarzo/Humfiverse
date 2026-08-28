import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { IconComponent } from '../../shared/icon.component';
import { StoreService } from '../../core/store.service';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { AiDisclosure, Asset, DisclosureLevel } from '../../core/models';
import { fmtUSD } from '../../core/format.util';
import { buildRoyaltyHistory } from '../../core/royalty-history.util';
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
  preprod: { studio: number; session: number; mix: number; extra: number };
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
    preprod: { studio: 5000, session: 4000, mix: 3000, extra: 1000 },
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

  async submit(): Promise<void> {
    const d = this.data();

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
    } else {
      asset.royaltyHistory = buildRoyaltyHistory(Math.max(3, parseInt(d.catalogue.months, 10) || 6), 1800, 1.01, 0.18, id.length * 7);
    }

    this.store.assets.update((assets) => [asset, ...assets]);
    this.store.campaigns.update((campaigns) => [
      { id, assetId: id, title: asset.title, artistName: asset.artistName, holders: 0, milestones: asset.milestones },
      ...campaigns
    ]);

    this.stepIndex.set(0);
    this.data.set(freshWizardData());

    this.toast.show(this.translate.instant('toast.campaignLaunched'), 'sparkles');
    this.router.navigateByUrl('/artist/dashboard');
  }
}
