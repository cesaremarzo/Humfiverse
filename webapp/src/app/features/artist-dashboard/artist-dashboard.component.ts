import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { IconComponent } from '../../shared/icon.component';
import { CampaignCardComponent } from '../../shared/campaign-card.component';
import { PayoutWalletComponent } from '../../shared/payout-wallet.component';
import { StoreService } from '../../core/store.service';
import { WalletService } from '../../core/wallet.service';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { LaunchPayload } from '../../core/models';
import { fmtUSDShort } from '../../core/format.util';
import { fundingRaisedFor } from '../../core/onchain-progress.util';

@Component({
  selector: 'app-artist-dashboard',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, TranslatePipe, IconComponent, CampaignCardComponent, PayoutWalletComponent],
  templateUrl: './artist-dashboard.component.html'
})
export class ArtistDashboardComponent {
  constructor(
    public store: StoreService,
    public wallet: WalletService,
    private api: ApiService,
    private toast: ToastService,
    private translate: TranslateService
  ) {
    effect(() => {
      const me = this.wallet.state().address;
      this.missing.set([]);
      if (me) void this.loadMissing(me);
    });
  }

  /** §2.112: this wallet's escrow-only tokens minted without a campaign.
   * The server creates the campaign in the mint request; this is for when
   * that failed (studio suspended, RPC error). Nobody can fund the token
   * until the campaign exists, so the artist is asked to sign the same
   * terms again. */
  missing = signal<Omit<LaunchPayload, 'issuedAt'>[]>([]);
  completing = signal<string | null>(null);

  private async loadMissing(wallet: string): Promise<void> {
    try {
      const { missing } = await this.api.getMissingEscrowCampaigns(wallet);
      if (this.wallet.state().address === wallet) this.missing.set(missing);
    } catch (err) {
      console.warn('Could not check for campaigns left incomplete.', err);
    }
  }

  async completeCampaign(terms: Omit<LaunchPayload, 'issuedAt'>): Promise<void> {
    if (this.completing()) return;
    this.completing.set(terms.assetId);
    try {
      const prepared = await this.api.prepareLaunch(terms);
      const launch = { payload: prepared.payload, signature: await this.wallet.signMessage(prepared.message) };
      await this.api.createEscrowCampaign({
        assetId: terms.assetId,
        artistAddress: terms.artistWallet,
        studioName: terms.studioName,
        studioWallet: terms.studioWallet,
        milestones: terms.milestones,
        launch
      });
      this.toast.show(this.translate.instant('toast.escrowCreated'), 'checkCircle');
      this.missing.update((list) => list.filter((m) => m.assetId !== terms.assetId));
      this.api
        .getEscrowCampaigns()
        .then((result) => this.store.escrowInfoMap.set(new Map(result.campaigns.map((c) => [c.assetId, c] as const))))
        .catch(() => {});
    } catch (err) {
      const e = err as { code?: unknown; status?: number; error?: { code?: string } };
      if (e?.status === 409) {
        this.missing.update((list) => list.filter((m) => m.assetId !== terms.assetId));
      } else if (e?.code === 4001 || e?.code === 'ACTION_REJECTED') {
        this.toast.show(this.translate.instant('artistDash.completeSignRejected'), 'alert');
      } else if (e?.error?.code === 'studio_unverified') {
        this.toast.show(this.translate.instant('artistDash.completeStudioUnverified'), 'alert');
      } else {
        console.warn('Could not complete the campaign.', err);
        this.toast.show(this.translate.instant('artistDash.completeFailed'), 'alert');
      }
    } finally {
      this.completing.set(null);
    }
  }

  /** Only this wallet's campaigns.
   *
   * This page iterated `store.campaigns()` — every campaign in the system —
   * under the heading "Your campaigns", so each artist saw everyone else's
   * as their own, and the three stat tiles above counted them too. A
   * display name is not ownership; see StoreService.campaignOwner. */
  myCampaigns = computed(() => {
    const me = this.wallet.state().address?.toLowerCase();
    if (!me) return [];
    return this.store.campaigns().filter((c) => this.store.campaignOwner(c.assetId) === me);
  });

  /* Was summing the chain-unaware fundingRaised(), which reads the mock
     tokensSold counter that is never persisted — so an artist whose
     campaign had genuinely sold out saw "TOTAL RAISED $0" on their own
     dashboard. Same fix as the cards below it: the real pool balance,
     off the same two store maps. */
  totalRaisedShort = computed(() => {
    const total = this.myCampaigns().reduce((s, c) => {
      const a = this.store.assetById(c.assetId);
      return s + (a ? fundingRaisedFor(a, this.store.onchainFor(a.id), this.store.escrowFor(a.id)) : 0);
    }, 0);
    return fmtUSDShort(total);
  });

  /* Real now, from the backend's event index (§2.65). `Campaign.holders`
     is still written as 0 by the wizard and updated by nothing, so it is
     ignored entirely: this sums distinct holders per campaign, counted by
     replaying the token's transfer log.
     
     null while the backfill is still catching up. A count from a
     half-finished replay is a lower bound, and showing it as a total is
     the exact mistake this whole feature was built to stop making. */
  totalHolders = computed(() => {
    if (!this.store.holderCountsComplete()) return null;
    return this.myCampaigns().reduce((sum, c) => sum + (this.store.holderCountFor(c.assetId) ?? 0), 0);
  });
}
