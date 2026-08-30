import { Component, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { EscrowCampaignInfo } from '../../core/models';
import { fmtUSD } from '../../core/format.util';

type CampaignRow = EscrowCampaignInfo & { assetId: string };
type LoadedCampaignRow = Extract<CampaignRow, { escrow: true }>;

/** Internal, unlinked admin tool — the "Humfiverse confirms milestones" role
 * from planning/technical-architecture.md §2.15. Not part of the public
 * artist/investor surface, so it isn't in the main nav or translated into
 * the app's 9 locales; reachable only by navigating to /admin/escrow
 * directly. Uses the same CHAIN_OPERATOR_PRIVATE_KEY-backed backend
 * endpoints as everything else that needs Humfiverse's own signature —
 * no separate wallet-connect flow, this is a platform-operator action. */
@Component({
  selector: 'app-admin-escrow',
  standalone: true,
  imports: [],
  templateUrl: './admin-escrow.component.html'
})
export class AdminEscrowComponent {
  campaigns = signal<LoadedCampaignRow[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  confirming = signal<string | null>(null); // `${campaignId}-${milestoneIndex}`
  lastResult = signal<{ txHash: string; explorerUrl: string } | null>(null);
  // Held only in this tab's sessionStorage, never sent anywhere but the
  // X-Admin-Key header on the one endpoint that needs it — see api.service.ts.
  adminKey = signal<string>(sessionStorage.getItem('humfiverse.adminKey') || '');

  fmt = fmtUSD;
  weiToUsd(wei: string): number {
    // Inverse of the 0.0001 ETH-per-$1 illustrative mapping used at creation.
    return Number(BigInt(wei) / 100_000_000_000_000n);
  }

  constructor(private api: ApiService) {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getEscrowCampaigns()
      .then((res) => this.campaigns.set(res.campaigns.filter((c): c is LoadedCampaignRow => c.escrow === true)))
      .catch((err) => this.error.set(String(err?.message || err)))
      .finally(() => this.loading.set(false));
  }

  truncate(addr: string): string {
    return addr ? addr.slice(0, 6) + '…' + addr.slice(-4) : '';
  }

  canConfirm(raisedWei: string, amountWei: string): boolean {
    return BigInt(raisedWei) >= BigInt(amountWei);
  }

  setAdminKey(value: string): void {
    this.adminKey.set(value);
    sessionStorage.setItem('humfiverse.adminKey', value);
  }

  async confirm(campaignId: number, milestoneIndex: number): Promise<void> {
    const key = `${campaignId}-${milestoneIndex}`;
    this.confirming.set(key);
    this.error.set(null);
    try {
      const result = await this.api.confirmEscrowMilestone(campaignId, milestoneIndex, this.adminKey());
      this.lastResult.set(result);
      this.load();
    } catch (err: unknown) {
      this.error.set(String((err as { message?: string })?.message || err));
    } finally {
      this.confirming.set(null);
    }
  }
}
