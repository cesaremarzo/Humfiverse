import { Component, computed, effect, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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
import { SecondaryListing, RoyaltyMonth } from '../../core/models';
import { platformFeeTokens } from '../../core/marketplace-fee.util';
import { weiToUsd } from '../../core/usd-eth.util';
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

  hasInjectedWallet = typeof window !== 'undefined' && !!window.ethereum;

  sellDraft = signal<{ assetId: string; max: number } | null>(null);
  sellQty = signal(1);
  sellPrice = signal(1);
  sellResult = signal<{ assetId: string; qty: number; price: number } | null>(null);

  mySellerLabel = 'you';
  myListings = computed(() => this.store.secondaryListings().filter((l) => l.seller === this.mySellerLabel && l.qty > 0));

  totalTokens = computed(() => this.holdings().reduce((s, h) => s + h.tokens, 0));
  totalValue = computed(() => this.holdings().reduce((s, h) => s + h.valueUsd, 0));

  /** Allocation-by-campaign pie chart. Colors assigned once, in a fixed
   * order keyed by assetId (never by current value/rank), so a slice
   * doesn't change color just because holdings were re-fetched and
   * happened to sort differently — see the dataviz skill's "color follows
   * the entity, never its rank" rule. Caps at the palette's 8 validated
   * categorical slots and folds anything beyond into "Other" rather than
   * inventing a 9th hue. */
  pieSlices = computed<PieSlice[]>(() => {
    const held = this.holdings()
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
    effect(() => {
      const address = this.wallet.state().address;
      if (address) this.load(address);
      else {
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
            const primaryPriceUsd = weiToUsd(h.priceWei);
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
    if (!result.ok && !this.hasInjectedWallet) {
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
    if (!holding || holding.tokens <= 0) return;
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
    return platformFeeTokens(this.sellQty());
  }

  confirmSell(): void {
    const draft = this.sellDraft();
    if (!draft) return;
    const qty = this.sellQty();
    const price = this.sellPrice();

    this.holdings.update((list) =>
      list.map((h) => (h.assetId === draft.assetId ? { ...h, tokens: h.tokens - qty } : h))
    );

    const listingId = `you-${draft.assetId}-${Date.now()}`;
    this.store.secondaryListings.update((listings) => [
      ...listings,
      { id: listingId, assetId: draft.assetId, seller: this.mySellerLabel, qty, pricePerToken: price } as SecondaryListing
    ]);

    this.sellDraft.set(null);
    this.sellResult.set({ assetId: draft.assetId, qty, price });
  }

  closeSellResult(): void {
    this.sellResult.set(null);
  }

  cancelListing(listingId: string): void {
    const listing = this.store.secondaryListings().find((l) => l.id === listingId);
    if (!listing) return;

    this.holdings.update((list) => {
      const existing = list.find((h) => h.assetId === listing.assetId);
      if (existing) {
        return list.map((h) => (h.assetId === listing.assetId ? { ...h, tokens: h.tokens + listing.qty } : h));
      }
      return [...list, { assetId: listing.assetId, tokenId: 0, tokens: listing.qty, title: listing.assetId, artist: '', valueUsd: 0 }];
    });

    this.store.secondaryListings.update((listings) => listings.filter((l) => l.id !== listingId));
  }
}
