import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { IconComponent } from '../../shared/icon.component';
import { StoreService } from '../../core/store.service';
import { WalletService } from '../../core/wallet.service';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { fakeTxHash } from '../../core/yield.util';
import { fmtUSD } from '../../core/format.util';
import { coverBackground } from '../../core/cover.util';

/** Secondary-sale platform fee: 1% of the tokens traded (not the proceeds),
 * matching HumfiverseMarketplace.sol's PLATFORM_FEE_BPS. Only ever applies
 * here — selling a holding is by definition a secondary sale, since a
 * holding only exists after a (fee-free) first purchase. */
const PLATFORM_FEE_BPS = 100;
const BPS_DENOMINATOR = 10_000;

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [RouterLink, TranslatePipe, IconComponent],
  templateUrl: './portfolio.component.html'
})
export class PortfolioComponent {
  pending = signal<string | null>(null); // assetId | 'all'
  success = signal<{ amount: number; txHash: string } | null>(null);
  hasInjectedWallet = typeof window !== 'undefined' && !!window.ethereum;

  sellDraft = signal<{ assetId: string; max: number } | null>(null);
  sellQty = signal(1);
  sellResult = signal<{ assetId: string; qty: number; fee: number; proceeds: number } | null>(null);

  holdings = computed(() => this.store.portfolio().holdings);
  distributionsReversed = computed(() => this.store.portfolio().distributions.slice().reverse());

  totalTokens = computed(() => this.holdings().reduce((s, h) => s + h.tokens, 0));
  totalCost = computed(() => this.holdings().reduce((s, h) => s + h.costBasis, 0));
  totalUnclaimed = computed(() => this.holdings().reduce((s, h) => s + h.unclaimed, 0));
  totalClaimed = computed(() => this.store.portfolio().distributions.reduce((s, d) => s + d.amount, 0));

  constructor(
    public store: StoreService,
    public wallet: WalletService,
    private api: ApiService,
    private toast: ToastService,
    private translate: TranslateService
  ) {}

  fmt = fmtUSD;
  bg(id: string, kind: string): string {
    return coverBackground(id, kind);
  }
  assetTitle(assetId: string): string {
    return this.store.assetById(assetId)?.title || assetId;
  }
  assetArtist(assetId: string): string {
    return this.store.assetById(assetId)?.artistName || '';
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

  async redeem(assetId: string): Promise<void> {
    if (!this.wallet.state().address) {
      await this.connect();
      return;
    }
    if (this.pending()) return;
    this.pending.set(assetId);

    if (this.store.backendAvailable()) {
      try {
        const result = await this.api.redeem(assetId);
        this.store.portfolio.set(result.portfolio);
        this.pending.set(null);
        this.success.set({ amount: result.amount, txHash: result.txHash });
        return;
      } catch (err) {
        console.warn('Backend redeem failed, falling back to local simulation.', err);
      }
    }

    setTimeout(() => {
      let amount = 0;
      const month = new Date().toLocaleString('en', { month: 'short', year: '2-digit' });
      this.store.portfolio.update((p) => {
        if (assetId === 'all') {
          p.holdings.forEach((h) => {
            if (h.unclaimed > 0) {
              amount += h.unclaimed;
              p.distributions.push({ date: month, assetId: h.assetId, amount: h.unclaimed });
              h.unclaimed = 0;
            }
          });
        } else {
          const h = p.holdings.find((x) => x.assetId === assetId);
          if (h && h.unclaimed > 0) {
            amount = h.unclaimed;
            p.distributions.push({ date: month, assetId, amount: h.unclaimed });
            h.unclaimed = 0;
          }
        }
        return { holdings: [...p.holdings], distributions: [...p.distributions] };
      });
      this.pending.set(null);
      this.success.set({ amount, txHash: fakeTxHash() });
    }, 1100);
  }

  closeModal(): void {
    this.success.set(null);
  }

  // --- secondary sale (platform-mediated, 1% token fee) ---
  openSell(assetId: string): void {
    const holding = this.holdings().find((h) => h.assetId === assetId);
    if (!holding || holding.tokens <= 0) return;
    this.sellDraft.set({ assetId, max: holding.tokens });
    this.sellQty.set(1);
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

  sellFeeTokens(): number {
    return Math.floor((this.sellQty() * PLATFORM_FEE_BPS) / BPS_DENOMINATOR);
  }

  sellProceeds(): number {
    const draft = this.sellDraft();
    if (!draft) return 0;
    const price = this.store.assetById(draft.assetId)?.tokenPrice || 0;
    return this.sellQty() * price;
  }

  confirmSell(): void {
    const draft = this.sellDraft();
    if (!draft) return;
    const qty = this.sellQty();
    const fee = this.sellFeeTokens();
    const proceeds = this.sellProceeds();

    this.store.portfolio.update((p) => {
      const h = p.holdings.find((x) => x.assetId === draft.assetId);
      if (h) {
        const costPerToken = h.tokens > 0 ? h.costBasis / h.tokens : 0;
        h.tokens -= qty;
        h.costBasis = Math.max(0, h.costBasis - costPerToken * qty);
      }
      return { holdings: [...p.holdings], distributions: p.distributions };
    });

    this.sellDraft.set(null);
    this.sellResult.set({ assetId: draft.assetId, qty, fee, proceeds });
  }

  closeSellResult(): void {
    this.sellResult.set(null);
  }
}
