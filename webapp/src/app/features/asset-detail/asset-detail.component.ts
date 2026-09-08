import { Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IconComponent } from '../../shared/icon.component';
import { CoverComponent } from '../../shared/cover.component';
import { StatusChipComponent } from '../../shared/status-chip.component';
import { MilestoneTrackComponent } from '../../shared/milestone-track.component';
import { DisclosureChipComponent } from '../../shared/disclosure-chip.component';
import { LineChartComponent } from '../../shared/line-chart.component';
import { StoreService } from '../../core/store.service';
import { ApiService } from '../../core/api.service';
import { WalletService } from '../../core/wallet.service';
import { ToastService } from '../../core/toast.service';
import { Asset, DisclosureLevel, EscrowCampaignInfo, OnchainInfo, SecondaryListing } from '../../core/models';
import { fmtUSD, fmtUSDShort } from '../../core/format.util';
import { fundingPctFor, remainingFor, tokensSoldFor } from '../../core/onchain-progress.util';
import { ipfsGatewayUrl } from '../../core/ipfs.util';
import { computeYieldBreakdown } from '../../core/yield.util';
import { platformFeeTokens } from '../../core/marketplace-fee.util';
import { weiToUsd, usdToWei } from '../../core/usd-eth.util';

type TabKey = 'overview' | 'royalty' | 'milestones' | 'disclosure' | 'documents' | 'risk';

@Component({
  selector: 'app-asset-detail',
  standalone: true,
  imports: [RouterLink, TranslatePipe, IconComponent, CoverComponent, StatusChipComponent, MilestoneTrackComponent, DisclosureChipComponent, LineChartComponent],
  templateUrl: './asset-detail.component.html'
})
export class AssetDetailComponent {
  private route = inject(ActivatedRoute);
  private paramMap = toSignal(this.route.paramMap);
  id = computed(() => this.paramMap()?.get('id') ?? '');
  asset = computed<Asset | undefined>(() => this.store.assetById(this.id()));

  tab = signal<TabKey>('overview');
  qty = signal(1);
  ack = signal(false);
  success = signal<{ qty: number; total: number; txHash?: string; explorerUrl?: string } | null>(null);
  yieldInfoOpen = signal(false);
  onchainInfo = signal<OnchainInfo | null>(null);
  onchainLoading = signal(false);
  onchainBuyPending = signal(false);
  escrowInfo = signal<EscrowCampaignInfo | null>(null);

  listings = computed(() => this.store.activeListingsFor(this.id()));
  marketPrice = computed(() => this.store.lowestAsk(this.id()));
  resaleResult = signal<{ listing: SecondaryListing; received: number; fee: number; paid: number } | null>(null);

  disclosureRows: [keyof Asset['aiDisclosure'], string][] = [
    ['vocals', 'disclosure.vocals'],
    ['instrumentation', 'disclosure.instrumentation'],
    ['composition', 'disclosure.composition'],
    ['postProduction', 'disclosure.postProduction'],
    ['lyrics', 'disclosure.lyrics']
  ];

  constructor(
    public store: StoreService,
    public wallet: WalletService,
    private api: ApiService,
    private toast: ToastService,
    private translate: TranslateService
  ) {
    effect(() => {
      const id = this.id();
      if (!id) return;
      this.onchainInfo.set(null);
      this.escrowInfo.set(null);
      this.refreshOnchainState(id);
    });
  }

  /** Re-fetches both on-chain panels from the contracts — used on initial
   * load and again right after a real purchase/contribution, so the pool
   * balance / raised amount shown actually reflects the tx that was just
   * signed instead of sitting stale until the next full page load. */
  /** Refreshes right away, then again after a short delay — the public
   * Base Sepolia RPC has repeatedly shown a few seconds of read lag right
   * after a transaction confirms elsewhere in this app (see
   * planning/technical-architecture.md §2.13/§2.22), so an immediate-only
   * refresh can still show the pre-purchase pool balance for a moment. */
  private scheduleOnchainRefresh(id: string): void {
    this.refreshOnchainState(id);
    setTimeout(() => this.refreshOnchainState(id), 4000);
  }

  private refreshOnchainState(id: string): void {
    this.onchainLoading.set(true);
    this.api
      .getOnchainInfo(id)
      .then((info) => this.onchainInfo.set(info))
      .catch(() => this.onchainInfo.set({ onchain: false }))
      .finally(() => this.onchainLoading.set(false));

    this.api
      .getEscrowCampaign(id)
      .then((info) => this.escrowInfo.set(info))
      .catch(() => this.escrowInfo.set({ escrow: false }));
  }

  isPre(a: Asset): boolean {
    return a.kind === 'preproduction';
  }

  audioGatewayUrl = ipfsGatewayUrl;

  /** Every external link on this page (explorer/source links) is wired
   * through this instead of relying on the anchor's own default click
   * behavior — reported not to open at all for at least one user on some
   * unidentified mobile/webview setup despite the href itself being
   * correct (verified against the live deployed bundle). The href stays
   * on the element too (so hover-preview, right-click "copy link", and
   * screen readers still work) — this just forces the actual navigation
   * through the one browser API that has no known environment where it
   * silently no-ops, instead of trusting the native anchor click. */
  openExternal(event: Event, url: string | undefined): void {
    if (!url) return;
    event.preventDefault();
    window.location.href = url;
  }

  /** Lets the cover artwork's play/pause icon (same affordance as the
   * marketplace card, §2.44) act as a shortcut for the full <audio> element
   * further down this same page, rather than routing through the shared
   * PreviewAudioService the marketplace grid uses — that service manages
   * one <audio> element shared *across* cards, which would fight with this
   * page's own full player over playback state. Both controls stay in sync
   * for free since they drive the exact same underlying element. */
  private audioPlayerRef = viewChild<ElementRef<HTMLAudioElement>>('audioPlayer');
  audioPreviewPlaying = signal(false);

  get audioPreviewUrl(): string | null {
    const info = this.onchainInfo();
    return info?.onchain && info.audioUri ? this.audioGatewayUrl(info.audioUri) : null;
  }

  toggleCoverAudioPreview(): void {
    const el = this.audioPlayerRef()?.nativeElement;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }
  /** Prefers real on-chain state over the mock tokensSold counter whenever
   * it's available (§2.32 — a real fix, not a cosmetic one: tokensSold is
   * never persisted anywhere, so it silently reverted to its pre-purchase
   * value on every reload even after §2.31 fixed the same-session update).
   * poolBalance/raised are read straight from the contracts and survive a
   * reload exactly because they're re-fetched from there, not from local
   * component state. BigInt division kept until the very last step to
   * avoid precision loss converting large wei amounts to Number. */
  remaining(a: Asset): number {
    return remainingFor(a, this.onchainInfo(), this.escrowInfo());
  }
  soldOut(a: Asset): boolean {
    return this.remaining(a) <= 0;
  }
  /** The "X/Y tokens" stat tile — same chain-aware logic as remaining()
   * above (§2.32), just the complement. This was the other spot on the
   * page still reading the mock a.tokensSold directly (§2.33 — caught by
   * the user looking at Black Sail specifically), which is why it kept
   * showing the pre-purchase count even after remaining()/fundingPct()
   * were fixed to read from the chain. */
  tokensSold(a: Asset): number {
    return tokensSoldFor(a, this.onchainInfo(), this.escrowInfo());
  }
  fundingPct(a: Asset): number {
    return fundingPctFor(a, this.onchainInfo(), this.escrowInfo());
  }
  tabs(a: Asset): [TabKey, string][] {
    return this.isPre(a)
      ? [
          ['overview', 'tab.overview'],
          ['milestones', 'tab.milestones'],
          ['disclosure', 'tab.disclosure'],
          ['documents', 'tab.documents'],
          ['risk', 'tab.risk']
        ]
      : [
          ['overview', 'tab.overview'],
          ['royalty', 'tab.royaltyData'],
          ['disclosure', 'tab.disclosure'],
          ['documents', 'tab.documents'],
          ['risk', 'tab.risk']
        ];
  }

  fmt = fmtUSD;
  fmtShort = fmtUSDShort;

  yieldBreakdown(a: Asset) {
    return computeYieldBreakdown(a);
  }

  royaltyTotal(a: Asset): number {
    return (a.royaltyHistory || []).reduce((s, d) => s + d.royaltyUSD, 0);
  }
  royaltyAvg(a: Asset): number {
    const h = a.royaltyHistory || [];
    return h.length ? Math.round(this.royaltyTotal(a) / h.length) : 0;
  }

  disclosureVal(a: Asset, key: keyof Asset['aiDisclosure']): DisclosureLevel {
    return a.aiDisclosure[key];
  }

  // --- buy panel interactions ---
  decreaseQty(a: Asset): void {
    this.qty.set(Math.max(1, Math.min(this.remaining(a), this.qty() - 1)));
  }
  increaseQty(a: Asset): void {
    this.qty.set(Math.max(1, Math.min(this.remaining(a), this.qty() + 1)));
  }
  onQtyInput(a: Asset, value: string): void {
    const n = parseInt(value.replace(/\D/g, ''), 10);
    this.qty.set(Math.max(1, Math.min(this.remaining(a), n || 1)));
  }

  /** True once this asset has a live on-chain price and a connected wallet —
   * meaning `buy()` will submit a real, signed transaction instead of the
   * simulated purchase every asset falls back to otherwise. */
  canBuyOnchain(): boolean {
    const info = this.onchainInfo();
    return !!(info?.onchain && info.priceWei !== '0' && this.wallet.state().address);
  }

  /** True once this preproduction asset has an active escrow campaign and a
   * connected wallet — meaning `buy()` contributes real ETH into
   * HumfiverseMilestoneEscrow instead of the simulated fallback. */
  canContributeOnchain(): boolean {
    const info = this.escrowInfo();
    return !!(info?.escrow && info.status === 'active' && this.wallet.state().address);
  }

  /** Shared by buy()'s preproduction path and fundExtraCampaign() below —
   * both are "pay into this asset's active escrow campaign", the only
   * difference being *why* the campaign exists (financing the track
   * itself vs. financing extras around an already-tokenized one). Same
   * contribute() call, same atomic token release, same refresh pattern
   * either way — see §2.42. */
  private async contributeToEscrow(a: Asset, escrowInfo: Extract<EscrowCampaignInfo, { escrow: true }>, qty: number, total: number): Promise<void> {
    this.onchainBuyPending.set(true);
    try {
      const amountWei = usdToWei(total).toString();
      const result = await this.wallet.contributeOnchain({
        contractAddress: escrowInfo.contractAddress,
        campaignId: escrowInfo.campaignId,
        amountWei
      });
      this.applyPurchase(a, qty, total);
      this.success.set({ qty, total, txHash: result.txHash, explorerUrl: result.explorerUrl });
      this.scheduleOnchainRefresh(a.id);
    } catch (err: unknown) {
      console.warn('On-chain contribution did not complete.', err);
      this.toast.show(this.onchainErrorMessage(err), 'alert');
    } finally {
      this.onchainBuyPending.set(false);
    }
  }

  /** Catalogue-kind only: funds this catalogue's *optional* extra campaign
   * (a video, a marketing push — see onboarding.component.ts's
   * catalogueCampaign step) rather than buying regular catalogue tokens
   * outright. Both draw from the exact same token pool and deliver the
   * same tokens — the only difference is whether the ETH goes straight to
   * the rights holder (buy()) or into the milestone-gated escrow
   * (contribute()), which is exactly why this needs to be a deliberate,
   * separate action rather than something buy() infers on its own. */
  async fundExtraCampaign(a: Asset): Promise<void> {
    const escrowInfo = this.escrowInfo();
    if (!escrowInfo?.escrow || escrowInfo.status !== 'active' || !this.wallet.state().address) return;
    const qty = this.qty();
    const total = qty * a.tokenPrice;
    await this.contributeToEscrow(a, escrowInfo, qty, total);
  }

  async buy(a: Asset): Promise<void> {
    const qty = this.qty();
    const total = qty * a.tokenPrice;
    const escrowInfo = this.escrowInfo();
    const onchain = this.onchainInfo();

    if (this.isPre(a) && escrowInfo?.escrow && escrowInfo.status === 'active' && this.wallet.state().address) {
      await this.contributeToEscrow(a, escrowInfo, qty, total);
      return;
    }

    if (onchain?.onchain && onchain.priceWei !== '0' && this.wallet.state().address) {
      this.onchainBuyPending.set(true);
      try {
        const result = await this.wallet.buyOnchain({
          contractAddress: onchain.contractAddress,
          tokenId: onchain.tokenId,
          amount: qty,
          priceWei: onchain.priceWei
        });
        this.applyPurchase(a, qty, total);
        this.success.set({ qty, total, txHash: result.txHash, explorerUrl: result.explorerUrl });
        this.scheduleOnchainRefresh(a.id);
      } catch (err: unknown) {
        console.warn('On-chain purchase did not complete.', err);
        this.toast.show(this.onchainErrorMessage(err), 'alert');
      } finally {
        this.onchainBuyPending.set(false);
      }
      return;
    }

    this.applyPurchase(a, qty, total);
    this.success.set({ qty, total });
  }

  weiToUsd = weiToUsd;

  /** Was a single catch-all "failed or was rejected" message regardless of
   * why — indistinguishable whether the user just declined the signature,
   * their wallet couldn't cover the ETH, or the contract itself reverted
   * (and if it reverted, for what reason). That collapsed every real
   * diagnosis into "open devtools and read the console", which is exactly
   * what made a real on-chain-capacity bug (§ the Guns remaining-tokens
   * fix) take several rounds to actually pin down. Distinguishes the
   * cases ethers v6 (and this service's own pre-flight checks) actually
   * report, and surfaces the raw on-chain revert reason verbatim when
   * there is one — untranslated by design, same as the backend's own
   * error responses elsewhere in this app, since it's a fixed Solidity
   * string, not user-facing copy this app authored. */
  private onchainErrorMessage(err: unknown): string {
    const e = err as { message?: string; code?: string; reason?: string; shortMessage?: string };
    if (e?.message === 'wrong-network') return this.translate.instant('toast.onchainWrongNetwork');
    if (e?.message === 'no-wallet') return this.translate.instant('toast.noWalletDetected');
    if (e?.code === 'ACTION_REJECTED') return this.translate.instant('toast.onchainRejected');
    if (e?.code === 'INSUFFICIENT_FUNDS') return this.translate.instant('toast.onchainInsufficientFunds');
    if (e?.message === 'tx-failed') return this.translate.instant('toast.onchainReverted');
    const reason = e?.reason || e?.shortMessage;
    if (reason) return this.translate.instant('toast.onchainBuyFailedReason', { reason });
    return this.translate.instant('toast.onchainBuyFailed');
  }

  private applyPurchase(a: Asset, qty: number, total: number): void {
    // Goes through the assets signal (not a naked `a.tokensSold += qty`,
    // which was a real bug — mutating a nested object in place doesn't
    // notify anything reading the assets signal, so "tokens remaining"
    // silently never updated after a real preproduction contribution
    // until an unrelated re-render happened to expose the same-reference
    // mutation) so every view reading this asset re-renders correctly.
    this.store.assets.update((assets) => assets.map((x) => (x.id === a.id ? { ...x, tokensSold: x.tokensSold + qty } : x)));
    this.store.portfolio.update((p) => {
      const existing = p.holdings.find((h) => h.assetId === a.id);
      if (existing) {
        existing.tokens += qty;
        existing.costBasis += total;
      } else {
        p.holdings.push({ assetId: a.id, tokens: qty, costBasis: total, unclaimed: 0 });
      }
      return { ...p, holdings: [...p.holdings] };
    });
    this.qty.set(1);
    this.ack.set(false);
  }

  closeModal(): void {
    this.success.set(null);
  }

  successQtyKey(): string {
    const s = this.success();
    return s && s.qty > 1 ? 'success.tokens' : 'success.token';
  }

  // --- buy from a resale listing (secondary purchase, 1% platform token fee) ---
  buyFromListing(listing: SecondaryListing): void {
    const fee = platformFeeTokens(listing.qty);
    const received = listing.qty - fee;
    const paid = listing.qty * listing.pricePerToken;

    this.store.portfolio.update((p) => {
      const existing = p.holdings.find((h) => h.assetId === listing.assetId);
      if (existing) {
        existing.tokens += received;
        existing.costBasis += paid;
      } else {
        p.holdings.push({ assetId: listing.assetId, tokens: received, costBasis: paid, unclaimed: 0 });
      }
      return { ...p, holdings: [...p.holdings] };
    });

    this.store.secondaryListings.update((listings) => listings.filter((l) => l.id !== listing.id));
    this.resaleResult.set({ listing, received, fee, paid });
  }

  closeResaleResult(): void {
    this.resaleResult.set(null);
  }
}
