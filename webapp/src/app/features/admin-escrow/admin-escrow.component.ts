import { Component, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { WalletService } from '../../core/wallet.service';
import { EscrowCampaignInfo, EscrowMilestone, FeeContractState, FeeSummary } from '../../core/models';
import { fmtUSD } from '../../core/format.util';
import { weiToUsd, weiToUsdPrecise } from '../../core/usd-eth.util';

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

  /** Platform fees (§2.71). null until loaded; a failed load says so
   * rather than showing zeros. */
  fees = signal<FeeSummary | null>(null);
  feesError = signal<string | null>(null);
  withdrawing = signal<'escrow' | 'marketplace' | null>(null);
  withdrawResult = signal<{ which: string; explorerUrl?: string; error?: string } | null>(null);

  fmt = fmtUSD;
  weiToUsd = weiToUsd;
  weiToUsdPrecise = weiToUsdPrecise;

  constructor(
    private api: ApiService,
    public wallet: WalletService
  ) {
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
    this.loadFees();
  }

  loadFees(): void {
    this.feesError.set(null);
    this.api
      .getFees()
      .then((f) => this.fees.set(f))
      .catch((err) => this.feesError.set(String(err?.message || err)));
  }

  feeRows(f: FeeSummary): { key: 'escrow' | 'marketplace'; label: string; rule: string; state: FeeContractState }[] {
    return [
      { key: 'escrow', label: 'Milestone escrow', rule: '5% of every released tranche', state: f.escrow },
      { key: 'marketplace', label: 'Secondary market', rule: '1% of every resale payment', state: f.marketplace }
    ];
  }

  /** Anyone may send withdrawFees(); the contract pays only its own
   * feeRecipient, so the connected wallet chooses when, never where. */
  async withdraw(key: 'escrow' | 'marketplace', contractAddress: string): Promise<void> {
    this.withdrawing.set(key);
    this.withdrawResult.set(null);
    try {
      const { explorerUrl } = await this.wallet.withdrawFeesOnchain(contractAddress);
      this.withdrawResult.set({ which: key, explorerUrl });
      this.loadFees();
    } catch (err: unknown) {
      const e = err as { shortMessage?: string; reason?: string; message?: string };
      this.withdrawResult.set({ which: key, error: e?.reason || e?.shortMessage || e?.message || String(err) });
    } finally {
      this.withdrawing.set(null);
    }
  }

  /** The backend reports the contract's own gate (§2.71), which is
   * cumulative: everything released so far plus this tranche must be
   * covered. The per-tranche comparison is only what an older backend
   * leaves to go on. */
  canConfirm(raisedWei: string, m: EscrowMilestone): boolean {
    return m.fundedEnough ?? BigInt(raisedWei) >= BigInt(m.amountWei);
  }
}
