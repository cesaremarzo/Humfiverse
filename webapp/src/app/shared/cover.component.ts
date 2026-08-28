import { Component, Input } from '@angular/core';
import { IconComponent } from './icon.component';
import { Asset } from '../core/models';
import { coverBackground, coverMonogram, genreMotif } from '../core/cover.util';

/** Procedural "album art": gradient tied to the asset id + a large initial +
 * a genre-motif watermark + an optional play affordance. Deterministic from
 * asset id/kind/genre — no external images, same algorithm as the original. */
@Component({
  selector: 'app-cover',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="cover-art" [style.background]="background">
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"
           style="position:absolute;inset:0;opacity:.5;mix-blend-mode:overlay;">
        <circle cx="78" cy="24" r="34" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="10"/>
        <circle cx="78" cy="24" r="20" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="6"/>
      </svg>
      <span class="cover-monogram" aria-hidden="true">{{ monogram }}</span>
      <span class="cover-motif" aria-hidden="true" [style.width.px]="motifSize" [style.height.px]="motifSize">
        <app-icon [name]="motif"></app-icon>
      </span>
      @if (play) {
        <span class="cover-play" [style.width.px]="playSize" [style.height.px]="playSize" role="img" [attr.aria-label]="asset.title + ' — track preview'">
          <app-icon name="play"></app-icon>
        </span>
      }
    </div>
  `
})
export class CoverComponent {
  @Input({ required: true }) asset!: Asset;
  @Input() play = true;
  @Input() playSize = 52;
  @Input() motifSize = 90;

  get background(): string {
    return coverBackground(this.asset.id, this.asset.kind);
  }
  get monogram(): string {
    return coverMonogram(this.asset);
  }
  get motif(): string {
    return genreMotif(this.asset.genre);
  }
}
