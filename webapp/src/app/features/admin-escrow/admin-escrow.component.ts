import { Component, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { EscrowCampaignInfo } from '../../core/models';
import { fmtUSD } from '../../core/format.util';

type CampaignRow = EscrowCampaignInfo & { assetId: string };
type LoadedCampaignRow = Extract<CampaignRow, { escrow: true }>;

/** Internal, unlinked observability tool. Used to show Humfiverse's own
 * "confirm milestone" action (planning/technical-architecture.md §2.15) —
 * that action no longer exists. §2.27 redesigned the contract so a
 * milestone releases only once *both* the artist and the studio confirm it
 * from their own wallets; Humfiverse has no on-chain function that can
 * release a tranche by itself anymore (a deliberate choice to strengthen
 * the argument that this vehicle isn't "actively managed" for AIFMD
 * purposes — see legal-regulatory-notes.md §7.3). This page is now
 * read-only: it shows who's still waiting on whom. Not part of the public
 * artist/investor surface, so it isn't in the main nav or translated;
 * reachable only by navigating to /admin/escrow directly. */
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
}
