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

  /* `Campaign.holders` is written as 0 by the onboarding wizard and never
     updated by anything, so summing it produced a confident "0 token
     holders" for campaigns that demonstrably have some. Counting them for
     real means enumerating every address holding an ERC-1155 token id,
     which needs either a full TransferSingle history (impractical under a
     free-tier RPC's 10-block eth_getLogs cap, §2.55) or an indexer. Until
     one exists the honest answer is that this is not tracked — see the
     em dash in the template. */
}
