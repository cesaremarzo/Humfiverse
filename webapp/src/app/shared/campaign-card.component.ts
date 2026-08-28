import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from './icon.component';
import { StatusChipComponent } from './status-chip.component';
import { MilestoneTrackComponent } from './milestone-track.component';
import { Campaign } from '../core/models';
import { StoreService } from '../core/store.service';
import { fmtUSDShort, fundingGoal, fundingPct, fundingRaised } from '../core/format.util';
import { coverBackground } from '../core/cover.util';

@Component({
  selector: 'app-campaign-card',
  standalone: true,
  imports: [RouterLink, TranslatePipe, IconComponent, StatusChipComponent, MilestoneTrackComponent],
  templateUrl: './campaign-card.component.html'
})
export class CampaignCardComponent {
  @Input({ required: true }) campaign!: Campaign;

  constructor(private store: StoreService) {}

  get asset() {
    return this.store.assetById(this.campaign.assetId);
  }
  pct(): number {
    return this.asset ? fundingPct(this.asset) : 0;
  }
  raisedShort(): string {
    return this.asset ? fmtUSDShort(fundingRaised(this.asset)) : '';
  }
  goalShort(): string {
    return this.asset ? fmtUSDShort(fundingGoal(this.asset)) : '';
  }
  bg(): string {
    return this.asset ? coverBackground(this.asset.id, this.asset.kind) : '';
  }
}
