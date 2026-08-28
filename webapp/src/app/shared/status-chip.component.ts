import { Component, Input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from './icon.component';
import { Asset } from '../core/models';

@Component({
  selector: 'app-status-chip',
  standalone: true,
  imports: [TranslatePipe, IconComponent],
  template: `
    @if (asset.status === 'sold-out') {
      <span class="chip chip-neutral"><app-icon name="checkCircle"></app-icon> {{ 'asset.soldOut' | translate }}</span>
    } @else if (asset.kind === 'preproduction') {
      <span class="chip chip-accent"><app-icon name="sparkles"></app-icon> {{ 'asset.preproduction' | translate }}</span>
    } @else {
      <span class="chip chip-good"><app-icon name="coins"></app-icon> {{ 'asset.funding' | translate }}</span>
    }
  `
})
export class StatusChipComponent {
  @Input({ required: true }) asset!: Asset;
}
