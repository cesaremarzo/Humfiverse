import { Component, Input } from '@angular/core';

/**
 * Decorative page background. §2.91 drew music and finance as one busy
 * picture (coins, a stave, a record, candles, a spectrum); §2.107 cut it to
 * what a finance site keeps: a soft glow at the top, a faint ledger grid, and
 * on the landing only, one price line that is also a sound wave. No data, no
 * text a screen reader should hear. `mode="quiet"` is for inner pages, which
 * get the glow and nothing else.
 */
@Component({
  selector: 'app-backdrop',
  standalone: true,
  templateUrl: './backdrop.component.html',
  styleUrl: './backdrop.component.css',
  host: { 'aria-hidden': 'true', '[class.quiet]': "mode === 'quiet'" }
})
export class BackdropComponent {
  @Input() mode: 'hero' | 'quiet' = 'hero';

  readonly wave: string;
  readonly waveArea: string;

  constructor() {
    const pts: [number, number][] = [];
    for (let x = -20; x <= 1460; x += 6) {
      const env = 0.35 + 0.65 * Math.abs(Math.sin(x / 230));
      const y = 640 - x * 0.14 + Math.sin(x / 34) * 16 * env + Math.sin(x / 9.5) * 4 * env;
      pts.push([x, y]);
    }
    this.wave = 'M' + pts.map(([x, y]) => `${x} ${y.toFixed(1)}`).join(' L');
    this.waveArea = this.wave + ' L1460 900 L-20 900 Z';
  }
}
