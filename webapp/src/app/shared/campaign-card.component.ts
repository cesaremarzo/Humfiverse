import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from './icon.component';
import { StatusChipComponent } from './status-chip.component';
import { MilestoneTrackComponent } from './milestone-track.component';
import { Campaign } from '../core/models';
import { StoreService } from '../core/store.service';
import { fmtUSDShort, fundingGoal } from '../core/format.util';
import { fundingPctFor, fundingRaisedFor } from '../core/onchain-progress.util';
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

  /* The artist dashboard's own cards used to read the static mock
     `tokensSold` counter, which is never persisted anywhere and reverts
     on every reload (§2.32) — so an artist watching their own campaign
     saw a bar that never moved, while the marketplace card for the same
     campaign showed the real one. Same chain-aware helpers as that card
     now, off the same two store maps. */
  pct(): number {
    const a = this.asset;
    return a ? fundingPctFor(a, this.store.onchainFor(a.id), this.store.escrowFor(a.id)) : 0;
  }
  raisedShort(): string {
    const a = this.asset;
    return a ? fmtUSDShort(fundingRaisedFor(a, this.store.onchainFor(a.id), this.store.escrowFor(a.id))) : '';
  }
  goalShort(): string {
    return this.asset ? fmtUSDShort(fundingGoal(this.asset)) : '';
  }
  bg(): string {
    return this.asset ? coverBackground(this.asset.id, this.asset.kind) : '';
  }
}
