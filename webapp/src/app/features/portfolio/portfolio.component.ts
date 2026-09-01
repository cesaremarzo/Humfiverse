import { Component, computed, effect, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { IconComponent } from '../../shared/icon.component';
import { StoreService } from '../../core/store.service';
import { WalletService } from '../../core/wallet.service';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { fmtUSD } from '../../core/format.util';
import { coverBackground } from '../../core/cover.util';
import { SecondaryListing } from '../../core/models';
import { platformFeeTokens } from '../../core/marketplace-fee.util';

/** A real on-chain holding — replaces the fictional Portfolio.holdings mock
 * data (§2.37), which was seeded fixed demo numbers never tied to any
 * actual wallet. `value` is tokens × the token's own current on-chain
 * price, not a historical cost basis (this app has no purchase-price
 * indexer) — labeled accordingly in the template, not called "cost basis". */
interface RealHolding {
  assetId: string;
  tokenId: number;
  tokens: number;
  title: string;
  artist: string;
  valueUsd: number;
}

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [RouterLink, TranslatePipe, IconComponent],
  templateUrl: './portfolio.component.html'
})
export class PortfolioComponent {
  loading = signal(false);
  loaded = signal(false);
  error = signal<string | null>(null);
  holdings = signal<RealHolding[]>([]);

  hasInjectedWallet = typeof window !== 'undefined' && !!window.ethereum;

  sellDraft = signal<{ assetId: string; max: number } | null>(null);
  sellQty = signal(1);
  sellPrice = signal(1);
  sellResult = signal<{ assetId: string; qty: number; price: number } | null>(null);

  mySellerLabel = 'you';
  myListings = computed(() => this.store.secondaryListings().filter((l) => l.seller === this.mySellerLabel && l.qty > 0));

  totalTokens = computed(() => this.holdings().reduce((s, h) => s + h.tokens, 0));
  totalValue = computed(() => this.holdings().reduce((s, h) => s + h.valueUsd, 0));

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
          res.holdings.map((h) => ({
            assetId: h.assetId,
            tokenId: h.tokenId,
            tokens: h.tokens,
            title: h.title,
            artist: h.artist,
            // Same illustrative 0.0001 ETH-per-$1 mapping used everywhere
            // else this app converts a real priceWei back to a mock USD
            // display figure (see weiToUsd in asset-detail.component.ts).
            valueUsd: h.tokens * Number(BigInt(h.priceWei) / 100_000_000_000_000n)
          }))
        );
        this.loaded.set(true);
      })
      .catch((err) => this.error.set(String(err?.message || err)))
      .finally(() => this.loading.set(false));
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
