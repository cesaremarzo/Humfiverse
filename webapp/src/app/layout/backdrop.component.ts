import { Component, Input } from '@angular/core';

/**
 * Decorative page background. §2.91 drew music and finance as one busy
 * picture (coins, a stave, a record, candles, a spectrum); §2.107 cut it to
 * what a finance site keeps: a soft glow at the top, a faint ledger grid, and
 * on the landing only, one price line that is also a sound wave. §2.108 added
 * back one musical motif, drawn in that line's colours: two staves as slow
 * ribbons. No data, no text a screen reader should hear. `mode="quiet"` is
 * for inner pages: no grid, no price line, fainter staves.
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
  /** Two staves, five lines each, drawn as ribbons (§2.108). */
  readonly staves: string[][] = [
    stave({ base: 150, amp: 85, len: 230, phase: 0.9, gap: 14, twist: 0.85, twistLen: 210, tilt: 0 }),
    stave({ base: 790, amp: 75, len: 200, phase: 3.4, gap: 12, twist: 0.85, twistLen: 190, tilt: -0.02 })
  ];

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

interface StaveShape { base: number; amp: number; len: number; phase: number; gap: number; twist: number; twistLen: number; tilt: number; }

/** Five lines following one sine, with the spacing between them breathing
 * along the way — wide where the ribbon faces you, close where it turns. */
function stave(s: StaveShape): string[] {
  return [-2, -1, 0, 1, 2].map((k) => {
    const pts: string[] = [];
    for (let x = -40; x <= 1480; x += 10) {
      const spread = s.gap * (1 + s.twist * Math.sin(x / s.twistLen + s.phase * 1.7));
      const y = s.base + x * s.tilt + s.amp * Math.sin(x / s.len + s.phase) + k * spread;
      pts.push(`${x} ${y.toFixed(1)}`);
    }
    return 'M' + pts.join(' L');
  });
}
