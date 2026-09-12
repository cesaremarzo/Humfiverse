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
import { Asset, DisclosureLevel, EscrowCampaignInfo, Milestone, OnchainInfo, SecondaryListing } from '../../core/models';
import { fmtUSD, fmtUSDShort } from '../../core/format.util';
import { fundingPctFor, remainingFor, tokensSoldFor } from '../../core/onchain-progress.util';
import { ipfsGatewayUrl } from '../../core/ipfs.util';
import { computeYieldBreakdown } from '../../core/yield.util';
import { platformFeeTokens } from '../../core/marketplace-fee.util';
import { weiToUsd, usdToWei, usdToWeiPrecise, weiToUsdPrecise } from '../../core/usd-eth.util';
import { isValidRoyaltyMonth, royaltyAvg, royaltyTotal } from '../../core/royalty.util';
import { onchainErrorTranslation } from '../../core/onchain-error.util';
import { addHolding } from '../../core/portfolio-holdings.util';
import { milestonesWithOnchainStatus } from '../../core/milestone-status.util';
import { retrying } from '../../core/retry.util';

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
  success = signal<{ qty: number; total: number; txHash?: string; explorerUrl?: string; simulated?: boolean } | null>(null);
  yieldInfoOpen = signal(false);
  onchainInfo = signal<OnchainInfo | null>(null);
  onchainLoading = signal(false);
  onchainBuyPending = signal(false);
  escrowInfo = signal<EscrowCampaignInfo | null>(null);

  listings = computed(() => this.store.activeListingsFor(this.id()));
  marketPrice = computed(() => this.store.lowestAsk(this.id()));
  resaleResult = signal<{ listing: SecondaryListing; received: number; fee: number; paid: number; txHash?: string; explorerUrl?: string } | null>(null);

  /* --- listing your own tokens, from the page the tokens are on ---
     Until now the only way to offer tokens for resale was the Portfolio
     page, which meant leaving the campaign you were looking at to do it.
     The balance below is the connected wallet's real on-chain holding of
     this one asset, read from the same endpoint the Portfolio uses. */
  myTokens = signal(0);
  mySeller = computed(() => (this.wallet.state().address ?? '').toLowerCase());
  myListings = computed(() => {
    const me = this.mySeller();
    return me ? this.listings().filter((l) => l.seller.toLowerCase() === me) : [];
  });
  sellOpen = signal(false);
  sellQty = signal(1);
  sellPrice = signal(1);
  sellSubmitting = signal(false);
  /** Which wallet prompt is in flight, so the dialog can say whether it
   * is asking for the one-off approval or the listing itself. */
  sellStep = signal<'approving' | 'listing' | null>(null);
  sellResult = signal<{ qty: number; price: number } | null>(null);

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

    // Re-reads whenever the asset or the connected wallet changes, so the
    // sell panel knows how much this wallet can actually offer.
    effect(() => {
      const id = this.id();
      const address = this.wallet.state().address;
      if (!id || !address) { this.myTokens.set(0); return; }
      this.api
        .getRealPortfolio(address)
        .then((res) => this.myTokens.set(res.holdings.find((h) => h.assetId === id)?.tokens ?? 0))
        .catch(() => this.myTokens.set(0));
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
    retrying(() => this.api.getOnchainInfo(id))
      .then((info) => this.onchainInfo.set(info))
      // A failed request is NOT evidence that this asset has no on-chain
      // token. It used to be recorded as `{ onchain: false }`, which says
      // exactly that — and that is the one value that lets the funding
      // helpers fall back to the escrow's ETH ratio. So a request that
      // merely timed out put 96.53% on Guns and left it there, because
      // nothing ever retried. `null` means unknown, which is the truth,
      // and the helpers then show the plain counter instead of a precise
      // wrong number. The template already renders both identically.
      .catch(() => this.onchainInfo.set(null))
      .finally(() => this.onchainLoading.set(false));

    retrying(() => this.api.getEscrowCampaign(id))
      .then((info) => this.escrowInfo.set(info))
      .catch(() => this.escrowInfo.set({ escrow: false }));
  }

  /** How many wallets hold this token, or null while the event index is
   * catching up. A buyer is deciding here, so concentration is a material
   * fact: one holder with everything and fifty holders are not the same
   * asset. */
  holderCount(): number | null {
    return this.store.holderCountFor(this.id());
  }

  /** The milestone track, with statuses from the escrow contract rather
   * than the stored copy that is always 'pending'. */
  liveMilestones(a: Asset): Milestone[] {
    return milestonesWithOnchainStatus(a.milestones, this.escrowInfo());
  }

  isPre(a: Asset): boolean {
    return a.kind === 'preproduction';
  }

  /** True when the campaign's artist and studio are the same wallet — the
   * dual artist+studio confirmation (§2.27) exists specifically so no
   * single party can release a milestone tranche alone; a shared wallet
   * defeats that independence entirely, since one signer controls both
   * confirmations. Surfaced as a warning rather than blocked outright —
   * this app has no way to verify a studio's identity beyond the wallet
   * address an artist entered, so it can flag the specific case it *can*
   * detect (identical addresses) without claiming to catch every way two
   * parties could still be the same person behind different wallets. */
  isStudioSelfDealing(escrowInfo: EscrowCampaignInfo | null): boolean {
    if (!escrowInfo?.escrow || !escrowInfo.studio) return false;
    return escrowInfo.artist.toLowerCase() === escrowInfo.studio.wallet.toLowerCase();
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

  royaltyTotal = royaltyTotal;
  royaltyAvg = royaltyAvg;

  // --- real royalty self-reporting (replaces the fabricated random-walk
  // history generator removed after the fake-yield fix) — a connected
  // wallet can add or correct one real monthly figure at a time, which
  // feeds straight into yield.util.ts's trailing-12-months calculation and
  // the charts above, unchanged. No ownership check exists for who submits
  // (see server.js's endpoint comment for why); the wallet is only kept as
  // a visible audit trail per entry. ---
  royaltyMonthInput = signal('');
  royaltyUsdInput = signal('');
  royaltySubmitting = signal(false);

  updateRoyaltyMonthInput(v: string): void {
    this.royaltyMonthInput.set(v);
  }
  updateRoyaltyUsdInput(v: string): void {
    this.royaltyUsdInput.set(v);
  }

  canSubmitRoyaltyReport(): boolean {
    if (!this.wallet.state().address) return false;
    if (!isValidRoyaltyMonth(this.royaltyMonthInput())) return false;
    const n = Number(this.royaltyUsdInput());
    return Number.isFinite(n) && n >= 0;
  }

  async submitRoyaltyReport(a: Asset): Promise<void> {
    if (!this.canSubmitRoyaltyReport() || this.royaltySubmitting()) return;
    this.royaltySubmitting.set(true);
    try {
      const res = await this.api.submitRoyaltyReport(a.id, this.royaltyMonthInput(), Number(this.royaltyUsdInput()), this.wallet.state().address ?? undefined);
      this.store.assets.update((list) => list.map((x) => (x.id === a.id ? { ...x, royaltyHistory: res.royaltyHistory } : x)));
      this.royaltyMonthInput.set('');
      this.royaltyUsdInput.set('');
      this.toast.show(this.translate.instant('detail.royaltyReportSuccessToast'));
    } catch (err) {
      this.toast.show(this.translate.instant('detail.royaltyReportErrorToast'), 'alert');
    } finally {
      this.royaltySubmitting.set(false);
    }
  }

  async removeRoyaltyReport(a: Asset, month: string): Promise<void> {
    try {
      const res = await this.api.deleteRoyaltyReport(a.id, month);
      this.store.assets.update((list) => list.map((x) => (x.id === a.id ? { ...x, royaltyHistory: res.royaltyHistory } : x)));
    } catch (err) {
      this.toast.show(this.translate.instant('detail.royaltyReportErrorToast'), 'alert');
    }
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

  /** Catalogue-kind only: true while this catalogue has an active *optional*
   * extra campaign (video/marketing — see onboarding.component.ts's
   * catalogueCampaign step) whose own goal isn't fully raised yet. The
   * token a buyer receives is identical either way and carries the same
   * royalty claim — the only thing that changes is whether the ETH they
   * pay stops in the milestone escrow on its way to the studio, or goes
   * straight to the rights holder. Since that's not a difference that
   * changes what the buyer owns, routing it is the app's job, not a
   * choice to hand the buyer: purchases fund the open campaign
   * automatically until its goal is met, then quietly go back to paying
   * the rights holder directly, all under one "buy" action. */
  catalogueEscrowStillOpen(escrowInfo: EscrowCampaignInfo | null): escrowInfo is Extract<EscrowCampaignInfo, { escrow: true }> {
    return !!escrowInfo?.escrow && escrowInfo.status === 'active' && BigInt(escrowInfo.raised) < BigInt(escrowInfo.fundingGoal);
  }

  /** Is there a real on-chain path for this asset — an active escrow
   * campaign to contribute to, or a token with a price to buy from? */
  hasOnchainPath(a: Asset): boolean {
    const escrowInfo = this.escrowInfo();
    const onchain = this.onchainInfo();
    if (this.isPre(a) && escrowInfo?.escrow && escrowInfo.status === 'active') return true;
    if (this.catalogueEscrowStillOpen(escrowInfo)) return true;
    return !!(onchain?.onchain && onchain.priceWei !== '0');
  }

  /**
   * Why the buy button is not available, or null when it is.
   *
   * This exists because the button used to require only the
   * acknowledgement checkbox. With no wallet connected, every real path
   * below was skipped and the click fell through to a *simulated*
   * purchase that updated local state and opened the same "Purchase
   * confirmed" dialog — minus the transaction hash, which is the only
   * thing distinguishing it. A buyer could reasonably conclude they owned
   * tokens they did not.
   *
   * `'loading'` is its own case for the same reason `null` and
   * `{ onchain: false }` had to be separated elsewhere: while the chain
   * read is in flight, this app does not yet know whether a real path
   * exists, and acting on that is how it invented one.
   */
  buyBlockedReason(a: Asset): 'loading' | 'wallet' | null {
    if (this.onchainInfo() === null) return 'loading';
    if (this.hasOnchainPath(a) && !this.wallet.state().address) return 'wallet';
    return null;
  }

  async buy(a: Asset): Promise<void> {
    const blocked = this.buyBlockedReason(a);
    if (blocked) {
      this.toast.show(this.translate.instant(blocked === 'loading' ? 'buy.stillLoading' : 'buy.connectFirst'), 'alert');
      return;
    }
    const qty = this.qty();
    const total = qty * a.tokenPrice;
    const escrowInfo = this.escrowInfo();
    const onchain = this.onchainInfo();

    if (this.isPre(a) && escrowInfo?.escrow && escrowInfo.status === 'active' && this.wallet.state().address) {
      await this.contributeToEscrow(a, escrowInfo, qty, total);
      return;
    }

    if (!this.isPre(a) && this.catalogueEscrowStillOpen(escrowInfo) && this.wallet.state().address) {
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

    /* Only reachable when the chain has told us this asset has no token
       at all — bundled demo data, or a backend that could not be reached.
       Still simulated, but now it says so instead of borrowing the real
       dialog's authority. */
    this.applyPurchase(a, qty, total);
    this.success.set({ qty, total, simulated: true });
  }

  weiToUsd = weiToUsd;
  weiToUsdPrecise = weiToUsdPrecise;

  /** The component still owns the translating; which message applies is
   * decided in core/onchain-error.util.ts, where it can be reasoned about
   * without a wallet or a TranslateService. */
  private onchainErrorMessage(err: unknown): string {
    const { key, params } = onchainErrorTranslation(err);
    return this.translate.instant(key, params);
  }

  private applyPurchase(a: Asset, qty: number, total: number): void {
    // Goes through the assets signal (not a naked `a.tokensSold += qty`,
    // which was a real bug — mutating a nested object in place doesn't
    // notify anything reading the assets signal, so "tokens remaining"
    // silently never updated after a real preproduction contribution
    // until an unrelated re-render happened to expose the same-reference
    // mutation) so every view reading this asset re-renders correctly.
    this.store.assets.update((assets) => assets.map((x) => (x.id === a.id ? { ...x, tokensSold: x.tokensSold + qty } : x)));
    this.store.portfolio.update((p) => addHolding(p, { assetId: a.id, tokens: qty, costBasis: total }));
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

  // --- offering your own tokens for resale ---

  openSell(a: Asset): void {
    if (!this.mySeller() || this.myTokens() <= 0) return;
    this.sellQty.set(1);
    this.sellPrice.set(this.marketPrice() ?? a.tokenPrice);
    this.sellOpen.set(true);
  }
  closeSell(): void {
    this.sellOpen.set(false);
  }
  setSellQty(value: string): void {
    const n = parseInt(value.replace(/\D/g, ''), 10);
    this.sellQty.set(Math.max(1, Math.min(this.myTokens(), n || 1)));
  }
  setSellPrice(value: string): void {
    const n = Number(value);
    this.sellPrice.set(Number.isFinite(n) && n > 0 ? n : 1);
  }
  sellFeePreview(): number {
    return platformFeeTokens(this.sellQty());
  }

  /** The listing is the seller's own transaction against
   * HumfiverseMarketplace, so this is two wallet prompts at most: a
   * one-off approval letting the contract move this token when a buyer
   * arrives, then `list` itself. Humfiverse signs nothing and cannot
   * create, cancel or move anything here. */
  async confirmSell(a: Asset): Promise<void> {
    const seller = this.mySeller();
    const marketplace = this.store.marketplaceAddress();
    const onchain = this.onchainInfo();
    if (!seller || this.sellSubmitting()) return;
    if (!marketplace || !onchain?.onchain) {
      this.toast.show(this.translate.instant('detail.resaleUnavailable'), 'alert');
      return;
    }
    const qty = this.sellQty();
    const price = this.sellPrice();
    this.sellSubmitting.set(true);
    try {
      const approved = await this.wallet.isMarketplaceApproved(onchain.contractAddress, marketplace);
      if (!approved) {
        this.sellStep.set('approving');
        await this.wallet.approveMarketplace(onchain.contractAddress, marketplace);
      }
      this.sellStep.set('listing');
      const { listingId } = await this.wallet.listOnMarketplace({
        marketplace,
        tokenContract: onchain.contractAddress,
        tokenId: onchain.tokenId,
        qty,
        pricePerTokenWei: usdToWeiPrecise(price).toString()
      });
      // Tell the backend the id so the board can find it without an event
      // scan. Best-effort: the listing exists on chain either way.
      await this.api.indexListing({ listingId, assetId: a.id }).catch((err) => console.warn('Listing created on chain but not indexed.', err));
      await this.store.refreshListings();
      this.sellOpen.set(false);
      this.sellResult.set({ qty, price });
    } catch (err) {
      console.warn('Could not create the listing.', err);
      this.toast.show(this.onchainErrorMessage(err), 'alert');
    } finally {
      this.sellStep.set(null);
      this.sellSubmitting.set(false);
    }
  }
  closeSellResult(): void {
    this.sellResult.set(null);
  }

  async cancelMyListing(listing: SecondaryListing): Promise<void> {
    const marketplace = this.store.marketplaceAddress();
    if (!this.mySeller() || !marketplace) return;
    try {
      await this.wallet.cancelListingOnchain({ marketplace, listingId: listing.listingId });
      await this.store.refreshListings();
    } catch (err) {
      console.warn('Could not cancel the listing.', err);
      this.toast.show(this.onchainErrorMessage(err), 'alert');
    }
  }

  /** A real trade: `buyListing` moves the tokens from the seller and the
   * ETH to them in one transaction, with the platform's 1% token fee
   * diverted by the contract. Nothing here simulates a transfer any more,
   * so there is also nothing to undo if it fails. */
  async buyFromListing(listing: SecondaryListing): Promise<void> {
    const marketplace = this.store.marketplaceAddress();
    if (!marketplace || !this.wallet.state().address) {
      this.toast.show(this.translate.instant('toast.escrowNeedsWallet'), 'alert');
      return;
    }
    this.onchainBuyPending.set(true);
    try {
      const result = await this.wallet.buyListingOnchain({
        marketplace,
        listingId: listing.listingId,
        qty: listing.qty,
        pricePerTokenWei: listing.pricePerTokenWei
      });
      const fee = platformFeeTokens(listing.qty);
      await this.store.refreshListings();
      this.scheduleOnchainRefresh(listing.assetId);
      this.resaleResult.set({
        listing,
        received: listing.qty - fee,
        fee,
        paid: weiToUsd((BigInt(listing.pricePerTokenWei) * BigInt(listing.qty)).toString()),
        txHash: result.txHash,
        explorerUrl: result.explorerUrl
      });
    } catch (err) {
      console.warn('On-chain resale purchase did not complete.', err);
      this.toast.show(this.onchainErrorMessage(err), 'alert');
    } finally {
      this.onchainBuyPending.set(false);
    }
  }

  closeResaleResult(): void {
    this.resaleResult.set(null);
  }
}
