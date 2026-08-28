import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../../shared/icon.component';
import { CampaignCardComponent } from '../../shared/campaign-card.component';
import { StoreService } from '../../core/store.service';
import { fmtUSDShort, fundingRaised } from '../../core/format.util';

@Component({
  selector: 'app-artist-dashboard',
  standalone: true,
  imports: [RouterLink, TranslatePipe, IconComponent, CampaignCardComponent],
  templateUrl: './artist-dashboard.component.html'
})
export class ArtistDashboardComponent {
  constructor(public store: StoreService) {}

  totalRaisedShort = computed(() => {
    const total = this.store.campaigns().reduce((s, c) => {
      const a = this.store.assetById(c.assetId);
      return s + (a ? fundingRaised(a) : 0);
    }, 0);
    return fmtUSDShort(total);
  });

  totalHolders = computed(() => this.store.campaigns().reduce((s, c) => s + c.holders, 0));
}
