import { Component, Input } from '@angular/core';
import { RoyaltyMonth } from '../core/models';
import { fmtUSD } from '../core/format.util';

interface Point {
  x: number;
  y: number;
}

@Component({
  selector: 'app-line-chart',
  standalone: true,
  templateUrl: './line-chart.component.html'
})
export class LineChartComponent {
  w = 640;
  h = 200;
  padL = 6;
  padR = 6;
  padT = 14;
  padB = 26;

  points: Point[] = [];
  linePath = '';
  areaPath = '';
  gridLines: number[] = [];
  labels: { i: number; month: string }[] = [];
  data: RoyaltyMonth[] = [];

  hoverIndex: number | null = null;
  hoverX = 0;
  hoverY = 0;

  @Input({ required: true }) set royaltyHistory(value: RoyaltyMonth[]) {
    this.data = value;
    const innerW = this.w - this.padL - this.padR;
    const innerH = this.h - this.padT - this.padB;
    const vals = value.map((d) => d.royaltyUSD);
    // A single point (or every point sitting at 0) used to divide by zero
    // here — (length - 1) === 0 for one point, (max - min) === 0 when
    // every value is 0 — producing NaN coordinates and a broken chart
    // rather than a real, if minimal, one. A portfolio-value chart with
    // exactly one real data point so far is a genuine, expected state
    // (see portfolio.component.ts), not an edge case to gate around.
    const max = Math.max(0, Math.max(...vals, 0) * 1.15) || 1;
    const min = 0;
    const x = (i: number) => (value.length > 1 ? this.padL + (i / (value.length - 1)) * innerW : this.padL + innerW / 2);
    const y = (v: number) => this.padT + innerH - ((v - min) / (max - min)) * innerH;
    this.points = value.map((d, i) => ({ x: x(i), y: y(d.royaltyUSD) }));
    this.linePath = value.length > 1 ? this.points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ') : '';
    this.areaPath =
      value.length > 1
        ? this.linePath + ` L${x(value.length - 1).toFixed(1)},${(this.padT + innerH).toFixed(1)} L${this.padL},${(this.padT + innerH).toFixed(1)} Z`
        : '';
    this.gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => this.padT + innerH * t);
    const labelEvery = Math.max(1, Math.ceil(value.length / 6));
    this.labels = value
      .map((d, i) => ({ i, month: d.month }))
      .filter((o) => o.i % labelEvery === 0 || o.i === value.length - 1);
  }

  activate(i: number): void {
    const p = this.points[i];
    if (!p) return;
    this.hoverIndex = i;
    this.hoverX = p.x;
    this.hoverY = p.y;
  }

  deactivate(): void {
    this.hoverIndex = null;
  }

  fmt(n: number): string {
    return fmtUSD(n);
  }
}
