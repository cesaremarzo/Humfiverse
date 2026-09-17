import { Component, Input, OnChanges, computed, effect, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ethers } from 'ethers';
import { IconComponent } from './icon.component';
import { ApiService } from '../core/api.service';
import { WalletService } from '../core/wallet.service';
import { ToastService } from '../core/toast.service';
import { AssetRoyalties } from '../core/models';
import { onchainErrorTranslation } from '../core/onchain-error.util';
import { usdToUsdc } from '../core/usdc.util';

type SupportedRoyalties = Extract<AssetRoyalties, { supported: true }>;

/** Must match MAX_STATEMENT_LENGTH in server/services/royalties.service.js. */
const MAX_STATEMENT_LENGTH = 200;

/** Royalty income paid on chain to this asset's token holders (§2.92).
 *
 * Everything shown is read from the token contract, through the backend:
 * totals, the unsold tokens' share and what the connected wallet can claim.
 * The deposit history lists only deposits whose receipts were checked.
 *
 * Renders nothing on a token contract deployed before royalties, so the
 * live site is unchanged until the phase 2 redeploy. */
@Component({
  selector: 'app-royalty-payouts',
  standalone: true,
  imports: [TranslatePipe, IconComponent],
  template: `
    @if (state(); as s) {
      <div class="card panel">
        <h3 class="panel-title" style="margin-bottom:6px;">{{ 'royaltyPayouts.title' | translate }}</h3>
        <p class="prose" style="font-size:12.5px; margin-bottom:14px;">{{ 'royaltyPayouts.intro' | translate }}</p>

        <div class="stat-row" style="margin-bottom:14px;">
          <div class="card stat-tile"><div class="label">{{ 'royaltyPayouts.deposited' | translate }}</div><div class="value mono">{{ fmt(s.totalDepositedUsdc) }}</div></div>
          <div class="card stat-tile"><div class="label">{{ 'royaltyPayouts.claimed' | translate }}</div><div class="value mono">{{ fmt(s.totalClaimedUsdc) }}</div></div>
          @if (s.claimableUsdc !== null) {
            <div class="card stat-tile"><div class="label">{{ 'royaltyPayouts.yours' | translate }}</div><div class="value mono">{{ fmt(s.claimableUsdc) }}</div></div>
          }
        </div>

        @if (s.claimableUsdc !== null && positive(s.claimableUsdc)) {
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:14px;">
            <button class="btn btn-primary btn-sm" [disabled]="busy() !== null" (click)="claim(s)">
              <app-icon name="coins"></app-icon> {{ (busy() === 'claim' ? 'royaltyPayouts.claiming' : 'royaltyPayouts.claimBtn') | translate: { amount: fmt(s.claimableUsdc) } }}
            </button>
          </div>
        }

        @if (positive(s.poolClaimableUsdc)) {
          <div class="card panel" style="margin-bottom:14px; font-size:12.5px; color:var(--text-secondary);">
            <p style="margin:0 0 10px;">{{ 'royaltyPayouts.poolShare' | translate: { amount: fmt(s.poolClaimableUsdc), unsold: s.poolBalance, supply: s.outstandingSupply } }}</p>
            @if (isOwner) {
              <button class="btn btn-secondary btn-sm" [disabled]="busy() !== null" (click)="claimPool(s)">
                <app-icon name="coins"></app-icon> {{ (busy() === 'pool' ? 'royaltyPayouts.claiming' : 'royaltyPayouts.poolBtn') | translate }}
              </button>
            }
          </div>
        }

        @if (isOwner) {
          <div class="card panel" style="margin-bottom:14px;">
            <div class="cell-primary" style="margin-bottom:6px;">{{ 'royaltyPayouts.depositTitle' | translate }}</div>
            <p style="font-size:12.5px; color:var(--text-secondary); margin:0 0 10px;">{{ 'royaltyPayouts.depositIntro' | translate }}</p>
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;">
              <label style="display:flex; flex-direction:column; gap:6px;">
                <span style="font-size:12px; color:var(--text-secondary);">{{ 'royaltyPayouts.amountLabel' | translate }}</span>
                <input type="number" min="0" step="0.01" [value]="amountInput()" (input)="amountInput.set($any($event.target).value)"
                       style="padding:10px 12px; border-radius:10px; border:1px solid var(--border); background:var(--surface); color:var(--text); font:inherit; width:140px;" />
              </label>
              <label style="display:flex; flex-direction:column; gap:6px; flex:1; min-width:200px;">
                <span style="font-size:12px; color:var(--text-secondary);">{{ 'royaltyPayouts.statementLabel' | translate }}</span>
                <input type="text" [attr.maxlength]="maxStatement" [value]="statementInput()" (input)="statementInput.set($any($event.target).value)"
                       [placeholder]="'royaltyPayouts.statementPlaceholder' | translate"
                       style="padding:10px 12px; border-radius:10px; border:1px solid var(--border); background:var(--surface); color:var(--text); font:inherit;" />
              </label>
              <button class="btn btn-primary btn-sm" [disabled]="!canDeposit() || busy() !== null" (click)="deposit(s)">
                <app-icon name="plus"></app-icon> {{ (busy() === 'deposit' ? 'royaltyPayouts.depositing' : 'royaltyPayouts.depositBtn') | translate }}
              </button>
            </div>
            <p style="font-size:11.5px; color:var(--text-secondary); margin:10px 0 0;">{{ 'royaltyPayouts.depositNote' | translate }}</p>
          </div>
        }

        @if (s.deposits.length) {
          <div class="table-wrap">
            <table class="table-stack">
              <thead><tr><th>{{ 'royaltyPayouts.colDate' | translate }}</th><th>{{ 'royaltyPayouts.colStatement' | translate }}</th><th class="cell-num">{{ 'royaltyPayouts.colAmount' | translate }}</th><th></th></tr></thead>
              <tbody>
                @for (d of s.deposits; track d.txHash + d.statementRef) {
                  <tr>
                    <td>{{ d.depositedAt.slice(0, 10) }}</td>
                    <td>{{ d.statement ?? ('royaltyPayouts.noStatement' | translate) }}</td>
                    <td class="cell-num mono">{{ fmt(d.amountUsdc) }}</td>
                    <td style="text-align:right;"><a class="btn btn-ghost btn-sm" [href]="d.explorerUrl" target="_blank" rel="noopener">Etherscan <app-icon name="arrowRight"></app-icon></a></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p class="prose" style="font-size:12.5px; margin:0;">{{ 'royaltyPayouts.noDeposits' | translate }}</p>
        }
      </div>
    }
  `
})
export class RoyaltyPayoutsComponent implements OnChanges {
  @Input({ required: true }) assetId!: string;
  /** The asset's owner wallet is connected: offer deposit and the pool claim. */
  @Input() isOwner = false;

  readonly maxStatement = MAX_STATEMENT_LENGTH;
  private data = signal<AssetRoyalties | null>(null);
  state = computed<SupportedRoyalties | null>(() => {
    const d = this.data();
    return d && d.supported ? d : null;
  });
  busy = signal<'claim' | 'pool' | 'deposit' | null>(null);
  amountInput = signal('');
  statementInput = signal('');
  private assetIdSignal = signal<string | null>(null);

  constructor(
    private api: ApiService,
    public wallet: WalletService,
    private toast: ToastService,
    private translate: TranslateService
  ) {
    effect(() => {
      const assetId = this.assetIdSignal();
      const address = this.wallet.state().address;
      if (assetId) this.load(assetId, address);
    });
  }

  ngOnChanges(): void {
    if (this.assetId !== this.assetIdSignal()) {
      this.data.set(null);
      this.assetIdSignal.set(this.assetId);
    }
  }

  private load(assetId: string, address: string | null): void {
    this.api
      .getAssetRoyalties(assetId, address)
      .then((res) => { if (res.assetId === this.assetIdSignal()) this.data.set(res); })
      .catch((err) => console.warn('Could not read royalties.', err));
  }

  private reload(): void {
    const assetId = this.assetIdSignal();
    if (assetId) this.load(assetId, this.wallet.state().address);
  }

  /** Templates cannot write bigint literals. */
  positive(units: string): boolean {
    return BigInt(units) > 0n;
  }

  /** Exact to the base unit: a holder's share of a deposit is rarely whole cents. */
  fmt(units: string | bigint): string {
    return '$' + Number(ethers.formatUnits(BigInt(units), 6)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  }

  canDeposit(): boolean {
    const amount = Number(this.amountInput());
    const statement = this.statementInput().trim();
    return Number.isFinite(amount) && amount >= 0.01 && statement.length > 0 && statement.length <= MAX_STATEMENT_LENGTH;
  }

  async claim(s: SupportedRoyalties): Promise<void> {
    await this.run('claim', async () => {
      await this.wallet.claimRoyaltiesOnchain({ contractAddress: s.contractAddress, tokenIds: [s.tokenId] });
      this.toast.show(this.translate.instant('toast.royaltiesClaimed', { amount: this.fmt(s.claimableUsdc ?? '0') }), 'wallet');
    });
  }

  async claimPool(s: SupportedRoyalties): Promise<void> {
    await this.run('pool', async () => {
      await this.wallet.claimPoolRoyaltiesOnchain({ contractAddress: s.contractAddress, tokenId: s.tokenId });
      this.toast.show(this.translate.instant('toast.royaltiesClaimed', { amount: this.fmt(s.poolClaimableUsdc) }), 'wallet');
    });
  }

  async deposit(s: SupportedRoyalties): Promise<void> {
    if (!this.canDeposit()) return;
    const amountUsdc = usdToUsdc(Number(this.amountInput()));
    const statement = this.statementInput().trim();
    await this.run('deposit', async () => {
      const { txHash } = await this.wallet.depositRoyaltiesOnchain({ contractAddress: s.contractAddress, tokenId: s.tokenId, amountUsdc, statement });
      // The deposit is on chain whatever happens next; a failed report only
      // leaves it out of the history until it is reported again.
      await this.api.recordRoyaltyDeposit(txHash, statement).catch((err) => console.warn('Deposit made but not recorded in the history.', err));
      this.amountInput.set('');
      this.statementInput.set('');
      this.toast.show(this.translate.instant('toast.royaltiesDeposited', { amount: this.fmt(amountUsdc) }), 'wallet');
    });
  }

  private async run(kind: 'claim' | 'pool' | 'deposit', work: () => Promise<void>): Promise<void> {
    if (this.busy() !== null) return;
    this.busy.set(kind);
    try {
      await work();
      this.reload();
    } catch (err) {
      console.warn('Royalty transaction did not complete.', err);
      const { key, params } = onchainErrorTranslation(err);
      this.toast.show(this.translate.instant(key, params), 'alert');
    } finally {
      this.busy.set(null);
    }
  }
}
