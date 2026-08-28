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

@Component({
  selector: 'app-redeem',
  standalone: true,
  imports: [RouterLink, TranslatePipe, IconComponent],
  templateUrl: './redeem.component.html'
})
export class RedeemComponent {
  pending = signal<string | null>(null); // assetId | 'all'
  success = signal<{ amount: number; txHash: string } | null>(null);

  holdings = computed(() => this.store.portfolio().holdings);
  totalRedeemable = computed(() => this.holdings().reduce((s, h) => s + h.unclaimed, 0));
  totalRedeemed = computed(() => this.store.portfolio().distributions.reduce((s, d) => s + d.amount, 0));
  hasInjectedWallet = typeof window !== 'undefined' && !!window.ethereum;

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
}
