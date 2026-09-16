import { Component, Input } from '@angular/core';

interface Candle { x: number; body: number; h: number; wickTop: number; wickBottom: number; up: boolean; delay: number; }
interface Note { x: number; y: number; stem: number; }
interface Bar { x: number; h: number; delay: number; }

/**
 * Decorative page background (§2.91): music and finance drawn as one thing.
 * Candles that breathe like an equaliser, a price line that is also a sound
 * wave, a stave whose note heads are coins, a record whose outer ring is a
 * funding gauge, a spectrum that reads as an order book. No data, no text a
 * screen reader should hear. `mode="quiet"` is for inner pages, where cards
 * sit on top and legibility comes first.
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

  readonly candles: Candle[];
  readonly wave: string;
  readonly waveEcho: string;
  readonly waveArea: string;
  readonly staff = [0, 1, 2, 3, 4].map((i) => `M-20 ${150 + i * 15} C 360 ${120 + i * 15}, 1080 ${190 + i * 15}, 1460 ${140 + i * 15}`);
  readonly notes: Note[] = [
    { x: 150, y: 150, stem: 44 }, { x: 250, y: 165, stem: 44 }, { x: 350, y: 142, stem: 44 },
    { x: 470, y: 170, stem: 44 }, { x: 590, y: 182, stem: 44 }, { x: 720, y: 170, stem: 44 }
  ];
  readonly grooves = Array.from({ length: 10 }, (_, i) => 62 + i * 9);
  readonly ticks = Array.from({ length: 48 }, (_, i) => (i * 360) / 48);
  readonly spectrum: Bar[];
  readonly labels = [
    { x: 92, y: 118, t: 'ERC-1155' },
    { x: 1030, y: 470, t: '♩ = 120' },
    { x: 1290, y: 790, t: 'USDC' },
    { x: 196, y: 700, t: 'Sepolia' },
    { x: 842, y: 92, t: 'escrow ▸ tranche' }
  ];
  /** Circumference of the gauge ring (r = 168) and the share drawn. */
  readonly gaugeLen = 2 * Math.PI * 168;
  readonly gaugeFill = 0.72;

  constructor() {
    // Seeded, so the picture is the same on every visit and every build.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    const n = 34;
    const step = 1440 / n;
    let price = 0.3;
    this.candles = Array.from({ length: n }, (_, i) => {
      const open = price;
      const close = Math.min(0.95, Math.max(0.08, open + (rnd() - 0.4) * 0.2));
      price = close;
      const hi = Math.max(open, close) + rnd() * 0.08;
      const lo = Math.min(open, close) - rnd() * 0.08;
      const y = (v: number) => 880 - v * 380;
      const top = y(Math.max(open, close));
      return {
        x: Math.round(i * step + step / 2),
        body: top,
        h: Math.max(6, Math.abs(y(open) - y(close))),
        wickTop: y(hi),
        wickBottom: y(lo),
        up: close >= open,
        delay: -Math.round(rnd() * 3000)
      };
    });

    const pts: [number, number][] = [];
    for (let x = -20; x <= 1460; x += 6) {
      const env = 0.35 + 0.65 * Math.abs(Math.sin(x / 230));
      const y = 600 - x * 0.16 + Math.sin(x / 34) * 20 * env + Math.sin(x / 9.5) * 5 * env;
      pts.push([x, y]);
    }
    this.wave = 'M' + pts.map(([x, y]) => `${x} ${y.toFixed(1)}`).join(' L');
    this.waveEcho = 'M' + pts.map(([x, y]) => `${x} ${(y + 34 + Math.sin(x / 60) * 10).toFixed(1)}`).join(' L');
    this.waveArea = this.wave + ' L1460 900 L-20 900 Z';

    this.spectrum = Array.from({ length: 22 }, (_, i) => ({
      x: 40 + i * 15,
      h: 10 + Math.round(Math.abs(Math.sin(i / 2.4)) * 46 + rnd() * 18),
      delay: -i * 120
    }));
  }
}
