import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../../shared/icon.component';
import { CampaignCardComponent } from '../../shared/campaign-card.component';
import { StoreService } from '../../core/store.service';
import { coverBackground } from '../../core/cover.util';

@Component({
  selector: 'app-for-artists',
  standalone: true,
  imports: [RouterLink, TranslatePipe, IconComponent, CampaignCardComponent],
  templateUrl: './for-artists.component.html'
})
export class ForArtistsComponent {
  constructor(public store: StoreService) {}

  heroBg = coverBackground('artist-hero', 'preproduction');
}
