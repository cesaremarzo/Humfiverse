import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../../shared/icon.component';
import { CampaignCardComponent } from '../../shared/campaign-card.component';
import { StoreService } from '../../core/store.service';
import { WalletService } from '../../core/wallet.service';

@Component({
  selector: 'app-for-artists',
  standalone: true,
  imports: [RouterLink, TranslatePipe, IconComponent, CampaignCardComponent],
  templateUrl: './for-artists.component.html'
})
export class ForArtistsComponent {
  /** The same ownership rule the artist dashboard uses. This section is
   * headed "Your campaigns" and was listing every campaign on the
   * platform, so an artist saw other people's work under their own name
   * here as well as on the dashboard (§2.63 fixed only the dashboard). */
  myCampaigns = computed(() => {
    const me = this.wallet.state().address?.toLowerCase();
    if (!me) return [];
    return this.store.campaigns().filter((c) => this.store.campaignOwner(c.assetId) === me);
  });

  constructor(public store: StoreService, public wallet: WalletService) {}

  /** Relative heights of the hero waveform, the brand mark's profile. */
  eqBars = [0.28, 0.46, 0.64, 0.82, 1, 0.82, 0.64, 0.46, 0.28];
}
