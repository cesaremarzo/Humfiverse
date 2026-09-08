import { Component, Input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { fmtUSD } from '../core/format.util';

export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

interface Arc {
  slice: PieSlice;
  pct: number;
  path: string;
  labelX: number;
  labelY: number;
}

const SIZE = 180;
const CENTER = SIZE / 2;
const OUTER_R = 82;
const INNER_R = 50; // donut hole — big enough to hold the total-value label

/** Hand-rolled SVG donut, matching this app's existing zero-dependency
 * chart style (line-chart.component.ts, sparkline.component.ts) — no
 * charting library. Colors are supplied by the caller (portfolio's
 * allocation-by-campaign dashboard), assigned once per asset id in a
 * fixed order upstream, never recomputed from rank here — see the
 * dataviz skill's "color follows the entity, never its rank" rule. */
@Component({
  selector: 'app-pie-chart',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './pie-chart.component.html'
})
export class PieChartComponent {
  size = SIZE;
  center = CENTER;
  innerR = INNER_R;

  arcs: Arc[] = [];
  total = 0;
  hoverIndex: number | null = null;

  @Input({ required: true }) set slices(value: PieSlice[]) {
    this.total = value.reduce((s, x) => s + x.value, 0);
    let angle = -Math.PI / 2; // start at 12 o'clock
    this.arcs = value.map((slice) => {
      const pct = this.total > 0 ? slice.value / this.total : 0;
      const sweep = pct * Math.PI * 2;
      const path = this.donutSlicePath(angle, angle + sweep);
      const midAngle = angle + sweep / 2;
      const labelR = (OUTER_R + INNER_R) / 2;
      angle += sweep;
      return {
        slice,
        pct: pct * 100,
        path,
        labelX: CENTER + Math.cos(midAngle) * labelR,
        labelY: CENTER + Math.sin(midAngle) * labelR
      };
    });
  }

  private donutSlicePath(startAngle: number, endAngle: number): string {
    // A full circle (single holding = 100%) can't be drawn as one SVG arc
    // (start === end), so it's split into two half-sweeps.
    if (endAngle - startAngle >= Math.PI * 2 - 1e-6) {
      const mid = startAngle + Math.PI;
      return this.donutSlicePath(startAngle, mid) + ' ' + this.donutSlicePath(mid, endAngle);
    }
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    const p = (r: number, a: number) => [CENTER + Math.cos(a) * r, CENTER + Math.sin(a) * r];
    const [ox1, oy1] = p(OUTER_R, startAngle);
    const [ox2, oy2] = p(OUTER_R, endAngle);
    const [ix2, iy2] = p(INNER_R, endAngle);
    const [ix1, iy1] = p(INNER_R, startAngle);
    return [
      `M ${ox1.toFixed(2)},${oy1.toFixed(2)}`,
      `A ${OUTER_R} ${OUTER_R} 0 ${large} 1 ${ox2.toFixed(2)},${oy2.toFixed(2)}`,
      `L ${ix2.toFixed(2)},${iy2.toFixed(2)}`,
      `A ${INNER_R} ${INNER_R} 0 ${large} 0 ${ix1.toFixed(2)},${iy1.toFixed(2)}`,
      'Z'
    ].join(' ');
  }

  activate(i: number): void {
    this.hoverIndex = i;
  }
  deactivate(): void {
    this.hoverIndex = null;
  }

  fmt = fmtUSD;
}
