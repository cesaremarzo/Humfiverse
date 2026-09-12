import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../../shared/icon.component';
import { CampaignCardComponent } from '../../shared/campaign-card.component';
import { StoreService } from '../../core/store.service';
import { WalletService } from '../../core/wallet.service';
import { fmtUSDShort } from '../../core/format.util';
import { fundingRaisedFor } from '../../core/onchain-progress.util';

@Component({
  selector: 'app-artist-dashboard',
  standalone: true,
  imports: [RouterLink, TranslatePipe, IconComponent, CampaignCardComponent],
  templateUrl: './artist-dashboard.component.html'
})
export class ArtistDashboardComponent {
  constructor(public store: StoreService, public wallet: WalletService) {}

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

  /** Campaigns that predate ownership being recorded and have no escrow to
   * fall back on. Nobody can claim them, and saying how many there are
   * beats quietly dropping them. */
  unattributedCount = computed(() =>
    this.store.campaigns().filter((c) => this.store.campaignOwner(c.assetId) === null).length
  );

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
