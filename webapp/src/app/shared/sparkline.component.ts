import { Component, Input } from '@angular/core';
import { RoyaltyMonth } from '../core/models';

@Component({
  selector: 'app-sparkline',
  standalone: true,
  template: `
    <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" width="100" height="32" preserveAspectRatio="none" style="overflow:visible;">
      <path [attr.d]="path" fill="none" stroke="var(--chart-line)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `
})
export class SparklineComponent {
  w = 100;
  h = 32;
  path = '';

  @Input({ required: true }) set data(value: RoyaltyMonth[]) {
    const vals = value.map((d) => d.royaltyUSD);
    const max = Math.max(...vals) * 1.1 || 1;
    const pts = vals.map((v, i): [number, number] => [(i / (vals.length - 1)) * this.w, this.h - (v / max) * this.h]);
    this.path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  }
}
