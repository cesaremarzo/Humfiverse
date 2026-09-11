import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../../shared/icon.component';
import { CampaignCardComponent } from '../../shared/campaign-card.component';
import { StoreService } from '../../core/store.service';
import { fmtUSDShort } from '../../core/format.util';
import { fundingRaisedFor } from '../../core/onchain-progress.util';

@Component({
  selector: 'app-artist-dashboard',
  standalone: true,
  imports: [RouterLink, TranslatePipe, IconComponent, CampaignCardComponent],
  templateUrl: './artist-dashboard.component.html'
})
export class ArtistDashboardComponent {
  constructor(public store: StoreService) {}

  /* Was summing the chain-unaware fundingRaised(), which reads the mock
     tokensSold counter that is never persisted — so an artist whose
     campaign had genuinely sold out saw "TOTAL RAISED $0" on their own
     dashboard. Same fix as the cards below it: the real pool balance,
     off the same two store maps. */
  totalRaisedShort = computed(() => {
    const total = this.store.campaigns().reduce((s, c) => {
      const a = this.store.assetById(c.assetId);
      return s + (a ? fundingRaisedFor(a, this.store.onchainFor(a.id), this.store.escrowFor(a.id)) : 0);
    }, 0);
    return fmtUSDShort(total);
  });

  totalHolders = computed(() => this.store.campaigns().reduce((s, c) => s + c.holders, 0));
}
