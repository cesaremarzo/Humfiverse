import { Component, computed, effect, inject, signal } from '@angular/core';
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
import { Asset, DisclosureLevel, OnchainInfo, SecondaryListing } from '../../core/models';
import { fmtUSD, fmtUSDShort, fundingPct } from '../../core/format.util';
import { computeYieldBreakdown } from '../../core/yield.util';
import { platformFeeTokens } from '../../core/marketplace-fee.util';

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
      this.onchainLoading.set(true);
      this.api
        .getOnchainInfo(id)
        .then((info) => this.onchainInfo.set(info))
        .catch(() => this.onchainInfo.set({ onchain: false }))
        .finally(() => this.onchainLoading.set(false));
    });
  }

  isPre(a: Asset): boolean {
    return a.kind === 'preproduction';
  }
  remaining(a: Asset): number {
    return a.tokensTotal - a.tokensSold;
  }
  soldOut(a: Asset): boolean {
    return this.remaining(a) <= 0;
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

  fundingPct = fundingPct;
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

  async buy(a: Asset): Promise<void> {
    const qty = this.qty();
    const total = qty * a.tokenPrice;
    const info = this.onchainInfo();

    if (info?.onchain && info.priceWei !== '0' && this.wallet.state().address) {
      this.onchainBuyPending.set(true);
      try {
        const result = await this.wallet.buyOnchain({
          contractAddress: info.contractAddress,
          tokenId: info.tokenId,
          amount: qty,
          priceWei: info.priceWei
        });
        this.applyPurchase(a, qty, total);
        this.success.set({ qty, total, txHash: result.txHash, explorerUrl: result.explorerUrl });
      } catch (err: unknown) {
        console.warn('On-chain purchase did not complete.', err);
        const message = (err as { message?: string })?.message;
        const key =
          message === 'wrong-network'
            ? 'toast.onchainWrongNetwork'
            : message === 'no-wallet'
              ? 'toast.noWalletDetected'
              : 'toast.onchainBuyFailed';
        this.toast.show(this.translate.instant(key), 'alert');
      } finally {
        this.onchainBuyPending.set(false);
      }
      return;
    }

    this.applyPurchase(a, qty, total);
    this.success.set({ qty, total });
  }

  private applyPurchase(a: Asset, qty: number, total: number): void {
    a.tokensSold += qty;
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
