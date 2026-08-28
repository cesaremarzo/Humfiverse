import { Asset } from './models';
import genreMotifMap from './mock-data/genre-motif.json';

const GENRE_MOTIF: Record<string, string> = genreMotifMap;

export function genreMotif(genre: string): string {
  return GENRE_MOTIF[genre] || 'music';
}

/** Deterministic hue pair from the asset id — same algorithm as the original site. */
export function coverBackground(seed: string, kind: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  const h1 = h;
  const h2 = (h + (kind === 'preproduction' ? 46 : 28)) % 360;
  const s1 = kind === 'preproduction' ? 62 : 48;
  const l1 = kind === 'preproduction' ? 42 : 38;
  return `radial-gradient(120% 140% at 15% 15%, hsl(${h1} ${s1}% ${l1 + 10}%) 0%, transparent 60%),
    radial-gradient(140% 160% at 90% 95%, hsl(${h2} ${s1 - 8}% ${l1}%) 0%, transparent 65%),
    linear-gradient(135deg, hsl(${h1} ${s1 - 10}% ${l1 - 6}%), hsl(${h2} ${s1 - 6}% ${l1 - 14}%))`;
}

export function coverMonogram(asset: Asset): string {
  return (asset.title || '?').trim().charAt(0).toUpperCase();
}
