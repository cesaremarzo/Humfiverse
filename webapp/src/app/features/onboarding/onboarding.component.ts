import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { IconComponent } from '../../shared/icon.component';
import { StoreService } from '../../core/store.service';
import { WalletService } from '../../core/wallet.service';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { AiDisclosure, DisclosureLevel } from '../../core/models';
import { fmtUSD, fmtUSDExact } from '../../core/format.util';
import { usdToUsdc } from '../../core/usdc.util';
import { clauseCategory, clauseText, contractLegalBasisNote, vessatoriaClauseIds } from '../../core/contract-text.util';
import {
  DISCLOSURE_ROWS,
  DISCLOSURE_VALUES,
  DISTRIBUTORS,
  GENRES,
  WIZARD_STEPS,
  WizardData,
  freshWizardData,
  isValidWalletAddress
} from './onboarding.model';
import {
  milestoneTotalBps,
  milestonesValid,
  milestoneBreakdown,
  marketingStageMilestones,
  MILESTONE_NAME_MAX,
  MILESTONES_MAX,
  CATALOGUE_EXTRA_MILESTONES,
  MilestoneBreakdown,
  buildAssetDraft,
  buildCampaignDraft,
  canAdvanceFrom,
  draftAssetId,
  draftRaiseTotal,
  draftSupply,
  raiseTerms
} from './campaign-draft.util';

type MilestoneKind = 'preprod' | 'catalogue';

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
  fmtExact = fmtUSDExact;

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
  /** §2.79: price and effective raise, exactly as the token contract will
   * compute them from the funding and supply the artist entered. */
  raise = computed(() => {
    const d = this.data();
    return raiseTerms(draftRaiseTotal(d, this.preprodTotal()), draftSupply(d));
  });

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

  /** Token supply, for whichever model is being drafted. Whole tokens only. */
  updateSupply(value: string): void {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    this.data.update((d) =>
      d.model === 'preproduction' ? { ...d, preprod: { ...d.preprod, supply: n } } : { ...d, catalogue: { ...d.catalogue, supply: n } }
    );
  }

  /** A catalogue's funding request, in dollars to the cent. */
  updateCatalogueFunding(value: string): void {
    const n = Math.max(0, Math.round((Number(value) || 0) * 100) / 100);
    this.data.update((d) => ({ ...d, catalogue: { ...d.catalogue, funding: n } }));
  }

  updatePreprodTextField(field: 'studioName' | 'studioWallet', value: string): void {
    this.data.update((d) => ({ ...d, preprod: { ...d.preprod, [field]: value } }));
  }

  /** Which split an editor row belongs to. */
  private milestoneKey(kind: MilestoneKind): 'preprodMilestones' | 'catalogueMilestones' {
    return kind === 'preprod' ? 'preprodMilestones' : 'catalogueMilestones';
  }

  /** A percentage typed by the artist, stored as basis points — the unit the
   * contract takes — so 12.5% is exactly 1250 and nothing is rounded later. */
  updateMilestonePercent(kind: MilestoneKind, index: number, value: string): void {
    const pct = parseFloat(String(value).replace(',', '.'));
    const bps = Number.isFinite(pct) ? Math.min(10_000, Math.max(0, Math.round(pct * 100))) : 0;
    const key = this.milestoneKey(kind);
    this.data.update((d) => ({ ...d, [key]: d[key].map((m, i) => (i === index ? { ...m, bps } : m)) }));
  }

  readonly milestoneNameMax = MILESTONE_NAME_MAX;
  readonly milestonesMax = MILESTONES_MAX;

  /* --- §2.75: a catalogue's extra campaign is the artist's to shape ---
     A track that is already made and earning has no fixed production path,
     so the artist decides what each tranche waits for: they name it, choose
     who it pays, and add or remove milestones. The preproduction split keeps
     its four named stages, which describe making a track. */
  updateMilestoneName(index: number, value: string): void {
    this.data.update((d) => ({ ...d, catalogueMilestones: d.catalogueMilestones.map((m, i) => (i === index ? { ...m, name: value.slice(0, MILESTONE_NAME_MAX) } : m)) }));
  }

  updateMilestonePayee(index: number, payee: 'artist' | 'studio'): void {
    this.data.update((d) => ({ ...d, catalogueMilestones: d.catalogueMilestones.map((m, i) => (i === index ? { ...m, payee } : m)) }));
  }

  addMilestone(): void {
    this.data.update((d) =>
      d.catalogueMilestones.length >= MILESTONES_MAX ? d : { ...d, catalogueMilestones: [...d.catalogueMilestones, { name: '', bps: 0, payee: 'studio' }] }
    );
  }

  removeMilestone(index: number): void {
    this.data.update((d) =>
      d.catalogueMilestones.length <= 1 ? d : { ...d, catalogueMilestones: d.catalogueMilestones.filter((_, i) => i !== index) }
    );
  }

  /** Switches the split to equal stages of a marketing campaign, or back to
   * the default milestones. Either replaces what was typed, which is why it
   * is an explicit checkbox rather than something inferred. */
  toggleMarketingStages(enabled: boolean): void {
    const stages = enabled ? 3 : null;
    this.data.update((d) => ({
      ...d,
      catalogueMarketingStages: stages,
      catalogueMilestones: stages ? this.marketingStages(stages) : CATALOGUE_EXTRA_MILESTONES.map((m) => ({ ...m }))
    }));
  }

  setMarketingStageCount(value: string): void {
    const n = Math.min(MILESTONES_MAX, Math.max(2, parseInt(value, 10) || 2));
    this.data.update((d) => ({ ...d, catalogueMarketingStages: n, catalogueMilestones: this.marketingStages(n) }));
  }

  private marketingStages(n: number) {
    return marketingStageMilestones(n, (i) => this.translate.instant('wizMilestones.marketingStageName', { n: i }));
  }

  milestoneRows(kind: MilestoneKind): ({ name: string; payee: 'artist' | 'studio'; percent: number } & MilestoneBreakdown)[] {
    const d = this.data();
    const goal = this.milestoneGoal(kind);
    return d[this.milestoneKey(kind)].map((m) => ({ name: m.name, payee: m.payee, percent: m.bps / 100, ...milestoneBreakdown(goal, m.bps) }));
  }

  /** What the escrow will aim for: price times supply (§2.79), the same
   * figure whichever model is being drafted. */
  private milestoneGoal(_kind: MilestoneKind): number {
    return this.raise().effectiveUsd;
  }

  /** The whole campaign's split between Humfiverse's fees and what the artist
   * and studio receive, summed from the rows so it can never disagree with
   * them. */
  milestoneSummary(kind: MilestoneKind): { goalUsd: number; feesUsd: number; payeeUsd: number } {
    const rows = this.milestoneRows(kind);
    const sum = (f: (r: MilestoneBreakdown) => number) => Math.round(rows.reduce((s, r) => s + f(r), 0) * 1e6) / 1e6;
    return { goalUsd: this.milestoneGoal(kind), feesUsd: sum((r) => r.feesUsd), payeeUsd: sum((r) => r.payeeUsd) };
  }

  milestoneTotalPercent(kind: MilestoneKind): number {
    return milestoneTotalBps(this.data()[this.milestoneKey(kind)]) / 100;
  }

  milestonesValid(kind: MilestoneKind): boolean {
    return milestonesValid(this.data()[this.milestoneKey(kind)]);
  }

  toggleCatalogueCampaign(enabled: boolean): void {
    this.data.update((d) => ({ ...d, catalogueCampaign: { ...d.catalogueCampaign, enabled } }));
  }
  updateCatalogueCampaignTextField(field: 'studioName' | 'studioWallet', value: string): void {
    this.data.update((d) => ({ ...d, catalogueCampaign: { ...d.catalogueCampaign, [field]: value } }));
  }

  /** Exposed as a member because the template calls it directly on both
   * studio-wallet fields; the rule itself lives in onboarding.model.ts. */
  isValidWalletAddress = isValidWalletAddress;

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
    const key = this.stepKey();
    // The contract step is the one check that can't be a pure function: it
    // needs the clause list off the loaded template, not just the draft.
    if (key === 'contract') return this.isContractComplete();
    return canAdvanceFrom(key, this.data());
  }

  back(): void {
    this.stepIndex.update((i) => Math.max(0, i - 1));
  }

  next(): void {
    if (!this.canAdvance()) {
      const d = this.data();
      let msg = this.stepKey() === 'contract' ? 'wizContract.requiredNote' : 'wizard.fillRequired';
      if (this.stepKey() === 'source' && d.model === 'preproduction' && this.preprodTotal() <= 0) msg = 'wizSource.budgetRequired';
      else if (this.stepKey() === 'source' && !this.raise().valid) msg = 'wizRaise.invalid';
      else if (this.stepKey() === 'source' && d.model === 'preproduction' && !this.milestonesValid('preprod')) msg = 'wizMilestones.invalid';
      else if (this.stepKey() === 'source' && d.model === 'catalogue' && d.catalogueCampaign.enabled && !this.milestonesValid('catalogue')) msg = 'wizMilestones.invalid';
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
    // §2.77: every campaign belongs to the wallet that creates it — that is
    // how an artist's campaigns are found, who confirms milestones, and where
    // the artist's tranches are paid. The button is disabled without one;
    // this is the same rule for anything that calls submit() directly.
    // Read once, here, and used for every step below (§2.80). Launching takes
    // up to a minute of awaited calls; reading the wallet at each step meant
    // an account switch in the wallet mid-way split one campaign across two
    // owners — the asset and token on the first, the escrow's artist on the
    // second, who alone could confirm milestones.
    const owner = this.wallet.state().address;
    if (!owner) {
      this.toast.show(this.translate.instant('wizReview.walletRequired'), 'alert');
      return;
    }
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
    const id = draftAssetId(d.title);
    const total = draftRaiseTotal(d, this.preprodTotal());
    const asset = buildAssetDraft(d, id, total, owner);
    const campaign = buildCampaignDraft(asset);

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
      // §2.79: the funding and supply go on chain; the contract sets the price.
      const fundingUsdc = usdToUsdc(total).toString();
      // Awaited now (§2.42) — createCampaign on the escrow contract
      // requires this token to already exist on-chain, since contribute()
      // releases tokens from this same pool atomically. The two calls used
      // to fire in parallel/unawaited, which raced: if the escrow call
      // reached the chain before the mint transaction had confirmed, campaign
      // creation would revert.
      let mintedTokenId: number | null = null;
      try {
        const result = await this.api.mintOnchainToken({
          assetId: id,
          slug: id,
          supply: asset.tokensTotal,
          fundingUsdc,
          payoutWallet: owner,
          // §2.81: a campaign released by milestones is sold only through its
          // escrow, so its token is never open to a direct purchase.
          directSale: !(isPre || d.catalogueCampaign.enabled),
          title: asset.title,
          artist: asset.artistName
        });
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
        try {
          await this.api.createEscrowCampaign({
            assetId: id,
            artistAddress: owner,
            studioName: d.preprod.studioName,
            studioWallet: d.preprod.studioWallet,
            milestones: d.preprodMilestones
          });
          this.toast.show(this.translate.instant('toast.escrowCreated'), 'checkCircle');
        } catch (err) {
          console.warn('Escrow campaign creation did not happen (campaign was still created normally).', err);
          this.toast.show(this.translate.instant('toast.escrowCreateFailed'), 'alert');
        }
      } else if (!isPre && d.catalogueCampaign.enabled && mintedTokenId !== null) {
        // Catalogue-kind, when the artist ties the release of the funding to
        // milestones (§2.79): the whole raise goes through the escrow, whose
        // goal the contract takes from this token's price times supply. The
        // same dual artist+studio confirmation gates every tranche (§2.27).
        try {
          await this.api.createEscrowCampaign({
            assetId: id,
            artistAddress: owner,
            studioName: d.catalogueCampaign.studioName,
            studioWallet: d.catalogueCampaign.studioWallet,
            milestones: d.catalogueMilestones
          });
          this.toast.show(this.translate.instant('toast.escrowCreated'), 'checkCircle');
        } catch (err) {
          console.warn('Optional campaign creation did not happen (catalogue was still created normally).', err);
          this.toast.show(this.translate.instant('toast.escrowCreateFailed'), 'alert');
        }
      }
    }

    this.submitting.set(false);
    this.router.navigateByUrl('/artist/dashboard');
  }
}
