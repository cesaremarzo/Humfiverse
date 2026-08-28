import { Component, Input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from './icon.component';
import { Asset } from '../core/models';

@Component({
  selector: 'app-verified-chip',
  standalone: true,
  imports: [TranslatePipe, IconComponent],
  template: `
    @if (asset.verified) {
      <span class="chip chip-good right"><app-icon name="shield"></app-icon> {{ 'asset.verified' | translate }}</span>
    } @else {
      <span class="chip chip-warning right"><app-icon name="alert"></app-icon> {{ (short ? 'asset.pending' : 'asset.diligencePending') | translate }}</span>
    }
  `
})
export class VerifiedChipComponent {
  @Input({ required: true }) asset!: Asset;
  @Input() short = false;
}
