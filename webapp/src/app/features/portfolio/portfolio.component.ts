import { Component, computed, effect, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ethers } from 'ethers';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { IconComponent } from '../../shared/icon.component';
import { LineChartComponent } from '../../shared/line-chart.component';
import { PieChartComponent, PieSlice } from '../../shared/pie-chart.component';
import { StoreService } from '../../core/store.service';
import { WalletService } from '../../core/wallet.service';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { fmtUSD } from '../../core/format.util';
import { coverBackground } from '../../core/cover.util';
import { EscrowCampaignInfo, RoyaltyMonth, SecondaryListing } from '../../core/models';
import { platformFeeUsd } from '../../core/marketplace-fee.util';
import { onchainErrorTranslation } from '../../core/onchain-error.util';
import { usdcToUsd, usdToUsdc } from '../../core/usdc.util';
import { lowestAvailablePrice, bucketSnapshots, ChartGranularity } from '../../core/token-value.util';

/** A real on-chain holding — replaces the fictional Portfolio.holdings mock
 * data (§2.37), which was seeded fixed demo numbers never tied to any
 * actual wallet. `value` is tokens × the lowest price at which one more
 * unit is currently buyable on the platform — primary price while the
 * pool has tokens (unless a resale listing has undercut it), the cheapest
 * active resale listing once the pool is exhausted — computed once at
 * load time via core/token-value.util.ts, not a historical cost basis
 * (this app has no purchase-price indexer). */
interface RealHolding {
  assetId: string;
  tokenId: number;
  tokens: number;
  title: string;
  artist: string;
  valueUsd: number;
}

function formatSnapshotDate(iso: string, granularity: ChartGranularity): string {
  const d = new Date(iso + 'T00:00:00Z');
  if (granularity === 'yearly') return d.toLocaleString('en', { year: 'numeric', timeZone: 'UTC' });
  if (granularity === 'monthly') return d.toLocaleString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  return d.toLocaleString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [RouterLink, TranslatePipe, IconComponent, LineChartComponent, PieChartComponent],
  templateUrl: './portfolio.component.html'
})
export class PortfolioComponent {
  loading = signal(false);
  loaded = signal(false);
  error = signal<string | null>(null);
  holdings = signal<RealHolding[]>([]);

  /** One point per calendar day the wallet has visited this page — see
   * server.js's portfolio_snapshots table. Deliberately never backfilled
   * with invented history (the fake-royalty-history lesson applies here
   * too, see planning/technical-architecture.md's §2.9 changelog entry):
   * a new wallet's chart starts genuinely empty and fills in for real,
   * one real visit at a time. */
  valueHistory = signal<{ date: string; valueUsd: number }[]>([]);

  /** What the wallet holds besides Humfiverse tokens, shown even at zero:
   * a new in-app wallet's first question is whether its test USDC arrived.
   * null while loading or when the chain could not be read. */
  copied = signal(false);

  /** Cancelled campaigns this wallet can still claim from (§2.85): every
   * contributor claims their own, since refund() pays only its caller. */
  refunds = signal<{ assetId: string; title: string; campaignId: number; contractAddress: string; refundable: bigint }[]>([]);
  refunding = signal<number | null>(null);

  balances = signal<{ eth: bigint; usdc: bigint | null } | null>(null);

  sellDraft = signal<{ assetId: string; max: number } | null>(null);
  sellQty = signal(1);
  sellPrice = signal(1);
  sellResult = signal<{ assetId: string; qty: number; price: number } | null>(null);

  /** Listings are shared state now, so "mine" means the connected wallet
   * rather than the literal string 'you' this used to store as the
   * seller — which would have read as "you" for every visitor. */
  mySeller = computed(() => (this.wallet.state().address ?? '').toLowerCase());
  myListings = computed(() => {
    const me = this.mySeller();
    return me ? this.store.secondaryListings().filter((l) => l.seller.toLowerCase() === me && l.qty > 0) : [];
  });
  sellSubmitting = signal(false);
  sellStep = signal<'approving' | 'listing' | null>(null);
  usdcToUsd = usdcToUsd;

  /** Same mapping the campaign page uses: the component translates, the
   * util decides which message applies. */
  private onchainErrorMessage(err: unknown): string {
    const { key, params } = onchainErrorTranslation(err);
    return this.translate.instant(key, params);
  }

  /** §2.85: refund() returns a contributor's USDC but leaves their tokens
   * in place, so a cancelled campaign's tokens would otherwise keep a price
   * and a Sell button after the money behind them has gone back. They are
   * shown, valued at zero and not offered for sale. */
  isCancelledCampaign(assetId: string): boolean {
    const escrow = this.store.escrowFor(assetId);
    // A fully released campaign delivered everything it raised for; if it
    // was cancelled anyway its tokens keep their value (§2.86).
    return !!escrow?.escrow && escrow.status === 'cancelled' && escrow.releasedBps < 10_000;
  }

  effectiveHoldings = computed(() =>
    this.holdings().map((h) => (this.isCancelledCampaign(h.assetId) ? { ...h, valueUsd: 0, cancelled: true } : { ...h, cancelled: false }))
  );

  totalTokens = computed(() => this.effectiveHoldings().reduce((s, h) => s + h.tokens, 0));
  totalValue = computed(() => this.effectiveHoldings().reduce((s, h) => s + h.valueUsd, 0));

  /** Allocation-by-campaign pie chart. Colors assigned once, in a fixed
   * order keyed by assetId (never by current value/rank), so a slice
   * doesn't change color just because holdings were re-fetched and
   * happened to sort differently — see the dataviz skill's "color follows
   * the entity, never its rank" rule. Caps at the palette's 8 validated
   * categorical slots and folds anything beyond into "Other" rather than
   * inventing a 9th hue. */
  pieSlices = computed<PieSlice[]>(() => {
    const held = this.effectiveHoldings()
      .filter((h) => h.valueUsd > 0)
      .sort((a, b) => a.assetId.localeCompare(b.assetId));
    const MAX_SLOTS = 8;
    const overflow = held.length > MAX_SLOTS;
    const shown = held.slice(0, overflow ? MAX_SLOTS - 1 : MAX_SLOTS);
    const rest = held.slice(shown.length);
    const slices: PieSlice[] = shown.map((h, i) => ({ label: h.title, value: h.valueUsd, color: `var(--pie-${i + 1})` }));
    if (rest.length) {
      slices.push({
        label: this.translate.instant('portfolio.dashboardOther'),
        value: rest.reduce((s, h) => s + h.valueUsd, 0),
        color: 'var(--text-muted)'
      });
    }
    return slices;
  });

  /** Daily/weekly/monthly/yearly — line-chart.component.ts now handles a
   * single real point gracefully (a lone dot, no line), so this shows
   * real data from the very first visit rather than gating on having
   * "enough" of it. null only when there's genuinely zero history yet
   * (a wallet that has never triggered a snapshot at all). */
  granularity = signal<ChartGranularity>('daily');

  valueTrend = computed<RoyaltyMonth[] | null>(() => {
    const h = this.valueHistory();
    if (h.length === 0) return null;
    const g = this.granularity();
    return bucketSnapshots(h, g).map((p) => ({ month: formatSnapshotDate(p.date, g), royaltyUSD: p.valueUsd }));
  });

  setGranularity(g: ChartGranularity): void {
    this.granularity.set(g);
  }

  constructor(
    public store: StoreService,
    public wallet: WalletService,
    private api: ApiService,
    private toast: ToastService,
    private translate: TranslateService
  ) {
    // Loads as soon as an address is present — covers both a fresh connect
    // and a wallet that was already connected when this page loaded (see
    // the same pattern in studio.component.ts / artist-milestones.component.ts).
    // Separate effect: the marketplace address arrives with the backend's
    // hydration, possibly after the wallet does.
    effect(() => {
      const address = this.wallet.state().address;
      const marketplace = this.store.marketplaceAddress();
      if (address) this.loadBalances(address, marketplace);
    });

    effect(() => {
      const address = this.wallet.state().address;
      const campaigns = this.store.escrowInfoMap();
      if (address) this.loadRefunds(address, [...campaigns.values()]);
      else this.refunds.set([]);
    });

    effect(() => {
      const address = this.wallet.state().address;
      if (address) this.load(address);
      else {
        this.balances.set(null);
        this.holdings.set([]);
        this.valueHistory.set([]);
        this.loaded.set(false);
      }
    });
  }

  load(address: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getRealPortfolio(address)
      .then((res) => {
        this.holdings.set(
          res.holdings.map((h) => {
            const primaryPriceUsd = usdcToUsd(h.priceUsdc);
            const unitValue = lowestAvailablePrice(primaryPriceUsd, Number(h.poolBalance), this.store.lowestAsk(h.assetId));
            return {
              assetId: h.assetId,
              tokenId: h.tokenId,
              tokens: h.tokens,
              title: h.title,
              artist: h.artist,
              valueUsd: h.tokens * unitValue
            };
          })
        );
        this.loaded.set(true);
        this.recordSnapshotAndLoadHistory(address);
      })
      .catch((err) => this.error.set(String(err?.message || err)))
      .finally(() => this.loading.set(false));
  }

  private loadBalances(address: string, marketplace: string | null): void {
    this.wallet
      .readBalances(address, marketplace)
      .then((b) => {
        if (this.wallet.state().address === address) this.balances.set(b);
      })
      .catch((err) => console.warn('Could not read wallet balances.', err));
  }

  private loadRefunds(address: string, campaigns: EscrowCampaignInfo[]): void {
    const cancelled = campaigns.filter((c): c is Extract<EscrowCampaignInfo, { escrow: true }> => c.escrow && c.status === 'cancelled' && !c.legacy);
    Promise.all(
      cancelled.map((c) =>
        this.wallet
          .readRefundState(c.contractAddress, c.campaignId, address)
          .then(({ refundable }) => ({ assetId: c.assetId, title: this.store.assetById(c.assetId)?.title ?? c.assetId, campaignId: c.campaignId, contractAddress: c.contractAddress, refundable }))
          .catch((err) => {
            console.warn('Could not read a refund.', err);
            return null;
          })
      )
    ).then((rows) => {
      if (this.wallet.state().address !== address) return;
      this.refunds.set(rows.filter((r): r is NonNullable<typeof r> => !!r && r.refundable > 0n));
    });
  }

  async claimRefund(r: { campaignId: number; contractAddress: string; refundable: bigint }): Promise<void> {
    const address = this.wallet.state().address;
    if (!address || this.refunding() !== null) return;
    this.refunding.set(r.campaignId);
    try {
      await this.wallet.refundOnchain({ contractAddress: r.contractAddress, campaignId: r.campaignId });
      this.toast.show(this.translate.instant('toast.refundDone', { amount: this.fmtUsdcExact(r.refundable) }), 'wallet');
      this.loadRefunds(address, [...this.store.escrowInfoMap().values()]);
      this.loadBalances(address, this.store.marketplaceAddress());
    } catch (err) {
      console.warn('Refund did not complete.', err);
      this.toast.show(this.onchainErrorMessage(err), 'alert');
    } finally {
      this.refunding.set(null);
    }
  }

  /** The full address, so it can be pasted into a faucet or another
   * wallet to receive USDC. */
  async copyAddress(): Promise<void> {
    const address = this.wallet.state().address;
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.toast.show(this.translate.instant('portfolio.copyFailed'), 'alert');
    }
  }

  fmtEth(wei: bigint): string {
    return Number(ethers.formatEther(wei)).toLocaleString(undefined, { maximumFractionDigits: 4 });
  }

  /** Refunds are the contract's exact figure, so no rounding to the cent. */
  fmtUsdcExact(units: bigint): string {
    return Number(ethers.formatUnits(units, 6)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  }

  fmtUsdc(units: bigint): string {
    return Number(ethers.formatUnits(units, 6)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /** Best-effort on both ends — a failed snapshot write or history read
   * just means the dashboard's trend chart stays at whatever it already
   * had (or empty), never blocks the rest of the page. */
  private recordSnapshotAndLoadHistory(address: string): void {
    this.api.recordPortfolioSnapshot(address, this.totalValue()).catch(() => {
      /* the trend chart just won't gain today's point */
    });
    this.api
      .getPortfolioHistory(address)
      .then((res) => this.valueHistory.set(res.history))
      .catch(() => {
        /* trend chart shows its empty state instead */
      });
  }

  fmt = fmtUSD;
  bg(id: string, kind: string): string {
    return coverBackground(id, kind);
  }
  chainLabel(): string {
    return this.wallet.chainName(this.wallet.state().chainId);
  }

  async connect(): Promise<void> {
    const result = await this.wallet.connect();
    if (!result.ok && !result.cancelled && !this.wallet.hasInjected && !this.wallet.embeddedEnabled) {
      this.toast.show(this.translate.instant('toast.noWalletDetected'), 'alert');
    }
  }

  disconnect(): void {
    this.wallet.disconnect();
    this.toast.show(this.translate.instant('toast.walletDisconnected'), 'info');
  }

  // --- list tokens for resale (platform-mediated, 1% token fee on purchase)
  // — still a client-side simulated listing (HumfiverseMarketplace.sol is
  // written and tested but not deployed, see planning doc §2.11/§2.12) —
  // the token count it operates on is real now, the listing mechanism
  // itself isn't yet. ---
  openSell(assetId: string): void {
    const holding = this.holdings().find((h) => h.assetId === assetId);
    if (!holding || holding.tokens <= 0 || this.isCancelledCampaign(assetId)) return;
    this.sellDraft.set({ assetId, max: holding.tokens });
    this.sellQty.set(1);
    this.sellPrice.set(this.store.lowestAsk(assetId) ?? this.store.assetById(assetId)?.tokenPrice ?? 1);
  }

  closeSellDraft(): void {
    this.sellDraft.set(null);
  }

  setSellQty(value: string): void {
    const draft = this.sellDraft();
    if (!draft) return;
    const n = parseInt(value.replace(/\D/g, ''), 10);
    this.sellQty.set(Math.max(1, Math.min(draft.max, n || 1)));
  }

  setSellPrice(value: string): void {
    const n = parseFloat(value.replace(/[^0-9.]/g, ''));
    this.sellPrice.set(n > 0 ? n : 0.01);
  }

  sellFeePreview(): number {
    return platformFeeUsd(this.sellQty() * this.sellPrice());
  }

  /** The seller's own transaction against HumfiverseMarketplace: a one-off
   * approval so the contract can move this token when a buyer arrives,
   * then `list`. Humfiverse signs nothing — see the campaign page's copy
   * of this for the reasoning, and §2.58 for what it replaced. */
  async confirmSell(): Promise<void> {
    const draft = this.sellDraft();
    const seller = this.mySeller();
    const marketplace = this.store.marketplaceAddress();
    if (!draft || !seller || this.sellSubmitting()) return;
    const onchain = this.store.onchainFor(draft.assetId);
    if (!marketplace || !onchain?.onchain) {
      this.toast.show(this.translate.instant('detail.resaleUnavailable'), 'alert');
      return;
    }
    const qty = this.sellQty();
    const price = this.sellPrice();

    this.sellSubmitting.set(true);
    try {
      if (!(await this.wallet.isMarketplaceApproved(onchain.contractAddress, marketplace))) {
        this.sellStep.set('approving');
        await this.wallet.approveMarketplace(onchain.contractAddress, marketplace);
      }
      this.sellStep.set('listing');
      const { listingId } = await this.wallet.listOnMarketplace({
        marketplace,
        tokenContract: onchain.contractAddress,
        tokenId: onchain.tokenId,
        qty,
        pricePerTokenUsdc: usdToUsdc(price).toString()
      });
      await this.api.indexListing({ listingId, assetId: draft.assetId }).catch((err) => console.warn('Listing created on chain but not indexed.', err));
      await this.store.refreshListings();
      this.loadBalances(seller, marketplace);
      this.sellDraft.set(null);
      this.sellResult.set({ assetId: draft.assetId, qty, price });
    } catch (err) {
      console.warn('Could not create the listing.', err);
      // Say which of declined-signature, wrong network, insufficient funds
      // or an on-chain revert it was. The generic message here hid the
      // real reason — including the contract's own "price must be > 0".
      this.toast.show(this.onchainErrorMessage(err), 'alert');
    } finally {
      this.sellStep.set(null);
      this.sellSubmitting.set(false);
    }
  }

  closeSellResult(): void {
    this.sellResult.set(null);
  }

  async cancelListing(listing: SecondaryListing): Promise<void> {
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
}
