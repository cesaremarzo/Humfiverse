import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CoverComponent } from './cover.component';
import { StatusChipComponent } from './status-chip.component';
import { VerifiedChipComponent } from './verified-chip.component';
import { SparklineComponent } from './sparkline.component';
import { Asset } from '../core/models';
import { fmtUSD, fmtUSDShort, fundingGoal, fundingPct, fundingRaised } from '../core/format.util';
import { computeProjectedYield } from '../core/yield.util';

@Component({
  selector: 'app-asset-card',
  standalone: true,
  imports: [RouterLink, TranslatePipe, CoverComponent, StatusChipComponent, VerifiedChipComponent, SparklineComponent],
  templateUrl: './asset-card.component.html'
})
export class AssetCardComponent {
  @Input({ required: true }) asset!: Asset;

  get isPre(): boolean {
    return this.asset.kind === 'preproduction';
  }
  get pct(): number {
    return fundingPct(this.asset);
  }
  get raisedShort(): string {
    return fmtUSDShort(fundingRaised(this.asset));
  }
  get goalShort(): string {
    return fmtUSDShort(fundingGoal(this.asset));
  }
  get priceFmt(): string {
    return fmtUSD(this.asset.tokenPrice);
  }
  get yieldPct(): string {
    const y = computeProjectedYield(this.asset);
    return (y || 0).toFixed(1);
  }
}
