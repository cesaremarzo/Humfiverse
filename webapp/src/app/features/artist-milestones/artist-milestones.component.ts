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

/** Wallet-gated page for an artist to confirm their own preproduction
 * campaigns' milestones (§2.27) — the mirror of StudioComponent. A
 * milestone only releases once both this and the studio's own confirmation
 * are in; Humfiverse has no function that can do either on anyone's
 * behalf. */
@Component({
  selector: 'app-artist-milestones',
  standalone: true,
  imports: [TranslatePipe, IconComponent],
  templateUrl: './artist-milestones.component.html'
})
export class ArtistMilestonesComponent {
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
    return this.campaigns().filter((c) => c.artist.toLowerCase() === addr);
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
    if (!m.artistConfirmed && !m.studioConfirmed) return 'escrowStatus.artist.waitingOnBoth';
    if (m.studioConfirmed) return 'escrowStatus.artist.waitingOnYou';
    return 'escrowStatus.artist.waitingOnStudio';
  }

  async confirm(campaign: LoadedCampaignRow, milestoneIndex: number): Promise<void> {
    const key = `${campaign.campaignId}-${milestoneIndex}`;
    this.confirming.set(key);
    try {
      await this.wallet.confirmMilestoneAsArtist({
        contractAddress: campaign.contractAddress,
        campaignId: campaign.campaignId,
        milestoneIndex
      });
      this.toast.show(this.translate.instant('artistMilestones.confirmSuccess'), 'checkCircle');
      this.load();
    } catch {
      this.toast.show(this.translate.instant('artistMilestones.confirmError'), 'alert');
    } finally {
      this.confirming.set(null);
    }
  }
}
