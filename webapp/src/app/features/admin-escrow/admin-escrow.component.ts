import { Component, computed, signal } from '@angular/core';
import { ethers } from 'ethers';
import { ApiService } from '../../core/api.service';
import { WalletService } from '../../core/wallet.service';
import { CancelGround, EscrowCampaignInfo, EscrowMilestone, FeeContractState, FeeSummary } from '../../core/models';
import { fmtUSD } from '../../core/format.util';
import { usdcToUsd } from '../../core/usdc.util';
import { knownWalletName } from '../../core/known-wallets';

type CampaignRow = EscrowCampaignInfo & { assetId: string };
type LoadedCampaignRow = Extract<CampaignRow, { escrow: true }>;
type FeeKey = 'catalogue' | 'escrow' | 'marketplace';

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
  withdrawing = signal<FeeKey | null>(null);
  withdrawResult = signal<{ which: string; explorerUrl?: string; error?: string } | null>(null);

  /** Owner of each escrow contract, keyed by address — cancelCampaign is
   * owner-only, so the button is live only for that wallet. */
  owners = signal<Record<string, string>>({});
  /** Refund figures for cancelled campaigns, keyed by campaign id (§2.85). */
  refundStates = signal<Record<number, { raised: bigint; released: bigint; pool: bigint } | { error: string }>>({});
  confirmingCancel = signal<number | null>(null);
  cancelling = signal<number | null>(null);
  cancelResult = signal<{ campaignId: number; explorerUrl?: string; error?: string } | null>(null);
  /** Phase 2 (§2.92): the ground and the written decision chosen per
   * campaign. Only the decision's hash goes on chain. */
  cancelDrafts = signal<Record<number, { ground: CancelGround; decision: string }>>({});
  readonly grounds: { value: CancelGround; label: string }[] = [
    { value: 'none', label: 'No legal ground (only while a milestone is unreleased)' },
    { value: 'unlawful_content', label: 'Unlawful content' },
    { value: 'third_party_rights', label: 'Third-party rights' },
    { value: 'false_warranties', label: 'False warranties by the artist' }
  ];

  fmt = fmtUSD;
  usdcToUsd = usdcToUsd;
  bigUsd = (units: bigint) => fmtUSD(usdcToUsd(units));

  /** "Founder (0x142F…BfC6)" for the platform's own wallets, the bare
   * truncated address for anyone else. */
  walletLabel(address: string | null | undefined): string {
    if (!address) return '';
    const name = knownWalletName(address);
    return name ? `${name} (${this.wallet.truncateAddr(address)})` : this.wallet.truncateAddr(address);
  }

  isOwner = computed(() => {
    const me = this.wallet.state().address?.toLowerCase();
    return (contractAddress: string) => !!me && this.owners()[contractAddress.toLowerCase()]?.toLowerCase() === me;
  });

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
      .then((res) => {
        const rows = res.campaigns.filter((c): c is LoadedCampaignRow => c.escrow === true);
        this.campaigns.set(rows);
        this.loadOnchainExtras(rows);
      })
      .catch((err) => this.error.set(String(err?.message || err)))
      .finally(() => this.loading.set(false));
    this.loadFees();
  }

  private loadOnchainExtras(rows: LoadedCampaignRow[]): void {
    for (const address of new Set(rows.map((c) => c.contractAddress.toLowerCase()))) {
      this.wallet
        .readEscrowOwner(address)
        .then((owner) => this.owners.update((o) => ({ ...o, [address]: owner })))
        .catch((err) => console.warn('Could not read the escrow owner.', err));
    }
    for (const c of rows.filter((r) => r.status === 'cancelled' && !r.legacy && !r.phase2)) {
      this.wallet
        .readRefundState(c.contractAddress, c.campaignId, null)
        .then(({ raised, released, pool }) => this.refundStates.update((s) => ({ ...s, [c.campaignId]: { raised, released, pool } })))
        .catch((err) => this.refundStates.update((s) => ({ ...s, [c.campaignId]: { error: String(err?.shortMessage || err?.message || err) } })));
    }
  }

  refundState(campaignId: number) {
    return this.refundStates()[campaignId] ?? null;
  }

  /** §2.86: the contract lets a fully released campaign be cancelled — it
   * has no "completed" status — which refunds nothing and would only mark
   * the tokens of a delivered project as cancelled. Refused here. */
  fullyReleased(c: LoadedCampaignRow): boolean {
    return c.releasedBps >= 10_000;
  }

  cancelDraft(campaignId: number): { ground: CancelGround; decision: string } {
    return this.cancelDrafts()[campaignId] ?? { ground: 'none', decision: '' };
  }

  setCancelDraft(campaignId: number, patch: Partial<{ ground: CancelGround; decision: string }>): void {
    this.cancelDrafts.update((d) => ({ ...d, [campaignId]: { ...this.cancelDraft(campaignId), ...patch } }));
    this.confirmingCancel.set(null);
  }

  /** What the contract would accept. The earlier escrow has no grounds and
   * refuses nothing, so §2.86's rule is applied here instead. Phase 2
   * enforces it itself: without a ground a fully released campaign is
   * refused, and a ground needs the hash of a written decision. */
  cancelBlocked(c: LoadedCampaignRow): string | null {
    if (!c.phase2) return this.fullyReleased(c) ? 'Fully released: nothing is left to refund, and cancelling would only mark a delivered project\'s tokens as cancelled.' : null;
    const draft = this.cancelDraft(c.campaignId);
    if (draft.ground === 'none') return this.fullyReleased(c) ? 'Fully released: only a legal ground can cancel it.' : null;
    return draft.decision.trim() ? null : 'A legal ground needs the written decision; its hash is recorded on chain.';
  }

  /** keccak256 of the decision text as written. Keep that exact text: it is
   * what proves which decision the on-chain hash refers to. */
  decisionHash(decision: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(decision.trim()));
  }

  /** Two clicks on purpose: cancelling is irreversible on the contract. */
  async cancelCampaign(c: LoadedCampaignRow): Promise<void> {
    if (this.cancelBlocked(c)) return;
    if (this.confirmingCancel() !== c.campaignId) {
      this.confirmingCancel.set(c.campaignId);
      return;
    }
    this.confirmingCancel.set(null);
    this.cancelling.set(c.campaignId);
    this.cancelResult.set(null);
    try {
      const draft = this.cancelDraft(c.campaignId);
      const { explorerUrl } = c.phase2
        ? await this.wallet.cancelCampaignWithGround({
            contractAddress: c.contractAddress,
            campaignId: c.campaignId,
            ground: draft.ground,
            decisionHash: draft.ground === 'none' ? ethers.ZeroHash : this.decisionHash(draft.decision)
          })
        : await this.wallet.cancelCampaignOnchain({ contractAddress: c.contractAddress, campaignId: c.campaignId });
      this.cancelResult.set({ campaignId: c.campaignId, explorerUrl });
      this.load();
    } catch (err: unknown) {
      const e = err as { shortMessage?: string; reason?: string; message?: string };
      this.cancelResult.set({ campaignId: c.campaignId, error: e?.reason || e?.shortMessage || e?.message || String(err) });
    } finally {
      this.cancelling.set(null);
    }
  }

  loadFees(): void {
    this.feesError.set(null);
    this.api
      .getFees()
      .then((f) => this.fees.set(f))
      .catch((err) => this.feesError.set(String(err?.message || err)));
  }

  feeRows(f: FeeSummary): { key: FeeKey; label: string; rule: string; state: FeeContractState }[] {
    return [
      { key: 'catalogue', label: 'Catalogue sales', rule: '2% of every primary purchase', state: f.catalogue },
      { key: 'escrow', label: 'Milestone escrow', rule: '2% of every contribution + 3% of every released tranche', state: f.escrow },
      { key: 'marketplace', label: 'Secondary market', rule: '1% of every resale payment', state: f.marketplace }
    ];
  }

  /** Anyone may send withdrawFees(); the contract pays only its own
   * feeRecipient, so the connected wallet chooses when, never where. */
  async withdraw(key: FeeKey, contractAddress: string): Promise<void> {
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
  canConfirm(raised: string, m: EscrowMilestone): boolean {
    return m.fundedEnough ?? BigInt(raised) >= BigInt(m.amountUsdc);
  }
}
