import { Component, computed, effect, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { IconComponent } from '../../shared/icon.component';
import { ApiService } from '../../core/api.service';
import { WalletService } from '../../core/wallet.service';
import { ToastService } from '../../core/toast.service';
import { EscrowCampaignInfo } from '../../core/models';
import { fmtUSD } from '../../core/format.util';

type CampaignRow = EscrowCampaignInfo & { assetId: string };
type LoadedCampaignRow = Extract<CampaignRow, { escrow: true }>;

/** Wallet-gated page for a real studio: connect the wallet an artist
 * registered for you, see every campaign that names you as its studio, and
 * confirm milestones as they're genuinely met. No separate studio login —
 * there's no account system anywhere in this app, a studio's "identity" is
 * just whichever wallet address an artist entered for them (§2.16). This is
 * also the studio's whole "onboarding": there's nothing to sign up for,
 * since registration itself happens automatically when an artist creates a
 * preproduction campaign that names them (see onboarding.component.ts). */
@Component({
  selector: 'app-studio',
  standalone: true,
  imports: [TranslatePipe, IconComponent],
  templateUrl: './studio.component.html'
})
export class StudioComponent {
  campaigns = signal<LoadedCampaignRow[]>([]);
  loading = signal(false);
  loaded = signal(false);
  error = signal<string | null>(null);
  confirming = signal<string | null>(null); // `${campaignId}-${milestoneIndex}`

  fmt = fmtUSD;
  weiToUsd(wei: string): number {
    return Number(BigInt(wei) / 100_000_000_000_000n);
  }

  myCampaigns = computed(() => {
    const addr = this.wallet.state().address?.toLowerCase();
    if (!addr) return [];
    return this.campaigns().filter((c) => c.studio?.wallet.toLowerCase() === addr);
  });

  constructor(
    public wallet: WalletService,
    private api: ApiService,
    private toast: ToastService,
    private translate: TranslateService
  ) {
    // Loads as soon as an address is present — covers both a fresh connect
    // via the button below and a wallet that was already connected when
    // this page loaded (the "Connect wallet" button never renders in that
    // case, so nothing else would trigger the initial load).
    effect(() => {
      if (this.wallet.state().address) this.load();
    });
  }

  async connect(): Promise<void> {
    await this.wallet.connect();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getEscrowCampaigns()
      .then((res) => {
        this.campaigns.set(res.campaigns.filter((c): c is LoadedCampaignRow => c.escrow === true));
        this.loaded.set(true);
      })
      .catch((err) => this.error.set(String(err?.message || err)))
      .finally(() => this.loading.set(false));
  }

  truncate(addr: string): string {
    return addr ? addr.slice(0, 6) + '…' + addr.slice(-4) : '';
  }

  canConfirm(raisedWei: string, amountWei: string): boolean {
    return BigInt(raisedWei) >= BigInt(amountWei);
  }

  statusKey(m: LoadedCampaignRow['milestones'][number]): string {
    if (m.released) return 'escrowStatus.released';
    if (!m.artistConfirmed && !m.studioConfirmed) return 'escrowStatus.studio.waitingOnBoth';
    if (m.artistConfirmed) return 'escrowStatus.studio.waitingOnYou';
    return 'escrowStatus.studio.waitingOnArtist';
  }

  async confirm(campaign: LoadedCampaignRow, milestoneIndex: number): Promise<void> {
    const key = `${campaign.campaignId}-${milestoneIndex}`;
    this.confirming.set(key);
    try {
      await this.wallet.confirmMilestoneAsStudio({
        contractAddress: campaign.contractAddress,
        campaignId: campaign.campaignId,
        milestoneIndex
      });
      this.toast.show(this.translate.instant('studio.confirmSuccess'), 'checkCircle');
      this.load();
    } catch {
      this.toast.show(this.translate.instant('studio.confirmError'), 'alert');
    } finally {
      this.confirming.set(null);
    }
  }
}
