import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { IconComponent } from '../../shared/icon.component';
import { StoreService } from '../../core/store.service';
import { WalletService } from '../../core/wallet.service';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { AiDisclosure, DisclosureLevel } from '../../core/models';
import { fmtUSD } from '../../core/format.util';
import { usdToWei } from '../../core/usd-eth.util';
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
  CATALOGUE_EXTRA_MILESTONES,
  PREPRODUCTION_MILESTONES,
  buildAssetDraft,
  buildCampaignDraft,
  canAdvanceFrom,
  draftAssetId,
  draftRaiseTotal
} from './campaign-draft.util';

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

  toggleCatalogueCampaign(enabled: boolean): void {
    this.data.update((d) => ({ ...d, catalogueCampaign: { ...d.catalogueCampaign, enabled } }));
  }
  updateCatalogueCampaignGoal(value: string): void {
    const n = Math.max(0, parseInt(value || '0', 10) || 0);
    this.data.update((d) => ({ ...d, catalogueCampaign: { ...d.catalogueCampaign, goal: n } }));
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
    const id = draftAssetId(d.title);
    const total = draftRaiseTotal(d, this.preprodTotal());
    const asset = buildAssetDraft(d, id, total);
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
              milestones: PREPRODUCTION_MILESTONES
            });
            this.toast.show(this.translate.instant('toast.escrowCreated'), 'checkCircle');
          } catch (err) {
            console.warn('Escrow campaign creation did not happen (campaign was still created normally).', err);
            this.toast.show(this.translate.instant('toast.escrowCreateFailed'), 'alert');
          }
        }
      } else if (!isPre && d.catalogueCampaign.enabled && mintedTokenId !== null) {
        // Optional, catalogue-kind only: the same milestone-escrow
        // mechanism preproduction uses to finance *making* a track, reused
        // here to finance *extras* around one that's already made and
        // already earning — a video, a marketing push. Contributing still
        // atomically delivers tokens from this catalogue's own pool
        // (contribute() doesn't distinguish why a campaign exists), so this
        // is a real follow-on raise against the same catalogue, not a
        // separate instrument. Same dual artist+studio confirmation gates
        // every tranche — see planning/technical-architecture.md §2.27.
        const artistAddress = this.wallet.state().address;
        if (!artistAddress) {
          this.toast.show(this.translate.instant('toast.escrowNeedsWallet'), 'alert');
        } else {
          const fundingGoalWei = usdToWei(d.catalogueCampaign.goal).toString();
          try {
            await this.api.createEscrowCampaign({
              assetId: id,
              artistAddress,
              fundingGoalWei,
              studioName: d.catalogueCampaign.studioName,
              studioWallet: d.catalogueCampaign.studioWallet,
              milestones: CATALOGUE_EXTRA_MILESTONES
            });
            this.toast.show(this.translate.instant('toast.escrowCreated'), 'checkCircle');
          } catch (err) {
            console.warn('Optional campaign creation did not happen (catalogue was still created normally).', err);
            this.toast.show(this.translate.instant('toast.escrowCreateFailed'), 'alert');
          }
        }
      }
    }

    this.submitting.set(false);
    this.router.navigateByUrl('/artist/dashboard');
  }
}
