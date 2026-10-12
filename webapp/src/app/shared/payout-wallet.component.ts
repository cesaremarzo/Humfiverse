import { Component, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { StoreService } from '../core/store.service';
import { WalletService } from '../core/wallet.service';
import { ToastService } from '../core/toast.service';

/** One of the connected wallet's tokens, or one it has been offered. */
interface PayoutRow {
  assetId: string;
  title: string;
  tokenId: number;
  tokenContract: string;
  /** A running campaign on the current escrow, which moves with the token. */
  escrow: { address: string; campaignId: number } | null;
  payout: string;
  pendingPayout: string | null;
  artist: string | null;
  pendingArtist: string | null;
}

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const ZERO = '0x0000000000000000000000000000000000000000';

/**
 * §2.117: the artist moves their own payout wallet, in two steps — the
 * current wallet proposes, the new one accepts — on the token and, for a
 * campaign still running, on the escrow. Nobody else can, the platform
 * included, so a lost key cannot be recovered. Renders nothing for a wallet
 * that neither owns a token nor has been offered one.
 */
@Component({
  selector: 'app-payout-wallet',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  template: `
    @if (owned().length || incoming().length) {
      <div class="card" style="margin-top:24px; padding:20px;">
        <h3 style="margin:0 0 6px;">{{ 'payout.title' | translate }}</h3>
        <p style="margin:0 0 14px; color:var(--text-muted); font-size:13.5px;">{{ 'payout.intro' | translate }}</p>

        @for (r of incoming(); track r.assetId) {
          <div class="risk-item good" style="margin-bottom:10px; align-items:center;">
            <div style="flex:1;">{{ 'payout.incomingItem' | translate: { title: r.title } }}</div>
            <button class="btn btn-primary btn-sm" [disabled]="busy() !== null" (click)="accept(r)">{{ busy() === r.assetId ? ('payout.working' | translate) : ('payout.accept' | translate) }}</button>
          </div>
        }

        @for (r of owned(); track r.assetId) {
          <div style="border-top:1px solid var(--border, rgba(127,127,127,.2)); padding:12px 0;">
            <div style="font-weight:600;">{{ r.title }}</div>
            <div class="mono" style="font-size:12.5px; color:var(--text-muted);">{{ 'payout.current' | translate: { wallet: short(r.payout) } }}</div>
            @if (r.pendingPayout) {
              <div style="font-size:13px; margin-top:6px;">{{ 'payout.pending' | translate: { wallet: short(r.pendingPayout) } }}
                <button class="btn btn-ghost btn-sm" [disabled]="busy() !== null" (click)="withdraw(r)">{{ 'payout.cancel' | translate }}</button>
              </div>
            } @else {
              <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
                <input class="mono" style="flex:1 1 280px;" [placeholder]="'payout.newLabel' | translate" [attr.aria-label]="'payout.newLabel' | translate" [(ngModel)]="drafts[r.assetId]">
                <button class="btn btn-primary btn-sm" [disabled]="busy() !== null" (click)="propose(r)">{{ busy() === r.assetId ? ('payout.working' | translate) : ('payout.propose' | translate) }}</button>
              </div>
              @if (r.escrow) { <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">{{ 'payout.campaignNote' | translate }}</div> }
            }
          </div>
        }
      </div>
    }
  `
})
export class PayoutWalletComponent {
  constructor(
    private store: StoreService,
    private wallet: WalletService,
    private toast: ToastService,
    private translate: TranslateService
  ) {
    effect(() => {
      const me = this.wallet.state().address;
      this.store.onchainInfoMap(); // reload when chain state arrives
      if (me) void this.load(me.toLowerCase());
      else this.rows.set([]);
    });
  }

  private rows = signal<PayoutRow[]>([]);
  busy = signal<string | null>(null);
  drafts: Record<string, string> = {};

  private me = computed(() => (this.wallet.state().address ?? '').toLowerCase());
  owned = computed(() => this.rows().filter((r) => r.payout === this.me()));
  incoming = computed(() => this.rows().filter((r) => r.pendingPayout === this.me() || (r.payout === this.me() && r.pendingArtist === this.me())));

  short(w: string): string {
    return `${w.slice(0, 6)}…${w.slice(-4)}`;
  }

  /** Every asset with a token on chain: few enough to read one by one. */
  private async load(me: string): Promise<void> {
    const out: PayoutRow[] = [];
    for (const a of this.store.assets()) {
      const info = this.store.onchainFor(a.id);
      if (!info?.onchain) continue;
      const esc = this.store.escrowFor(a.id);
      const escrow = esc?.escrow && !esc.legacy && esc.status === 'active' && esc.releasedBps < 10_000 ? { address: esc.contractAddress, campaignId: esc.campaignId } : null;
      try {
        const s = await this.wallet.readPayoutState(info.contractAddress, info.tokenId, escrow ?? undefined);
        out.push({ assetId: a.id, title: a.title || a.id, tokenId: info.tokenId, tokenContract: info.contractAddress, escrow, ...s });
      } catch {
        /* an unreadable token is left out rather than guessed at */
      }
    }
    if (this.me() === me) this.rows.set(out);
  }

  async propose(r: PayoutRow): Promise<void> {
    const next = (this.drafts[r.assetId] || '').trim();
    if (!ADDRESS.test(next) || next.toLowerCase() === r.payout) {
      this.toast.show(this.translate.instant('payout.invalid'), 'alert');
      return;
    }
    await this.run(r.assetId, async () => {
      await this.wallet.proposePayout(r.tokenContract, r.tokenId, next);
      if (r.escrow && r.artist === this.me()) await this.wallet.proposeArtist(r.escrow.address, r.escrow.campaignId, next);
      this.toast.show(this.translate.instant('payout.proposed'), 'checkCircle');
    });
  }

  async withdraw(r: PayoutRow): Promise<void> {
    await this.run(r.assetId, async () => {
      await this.wallet.proposePayout(r.tokenContract, r.tokenId, ZERO);
      if (r.escrow && r.pendingArtist) await this.wallet.proposeArtist(r.escrow.address, r.escrow.campaignId, ZERO);
    });
  }

  /** The token first: the escrow accepts a new artist only once it is the
   * token's payout wallet. */
  async accept(r: PayoutRow): Promise<void> {
    await this.run(r.assetId, async () => {
      if (r.pendingPayout === this.me()) await this.wallet.acceptPayout(r.tokenContract, r.tokenId);
      if (r.escrow && r.pendingArtist === this.me()) await this.wallet.acceptArtist(r.escrow.address, r.escrow.campaignId);
      this.toast.show(this.translate.instant('payout.accepted'), 'checkCircle');
      await this.store.hydrateFromBackend();
    });
  }

  private async run(assetId: string, work: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(assetId);
    try {
      await work();
    } catch (err) {
      console.warn('Payout wallet change did not go through.', err);
      this.toast.show(this.translate.instant('payout.failed'), 'alert');
    } finally {
      this.busy.set(null);
      await this.load(this.me());
    }
  }
}
