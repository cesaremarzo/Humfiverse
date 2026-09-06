import { Component, EventEmitter, Input, Output } from '@angular/core';
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
        <!-- §2.44: functional only when a real track is linked
             (previewable=true) — click plays/pauses it via the caller's
             PreviewAudioService and never navigates the card's own link.
             Without a linked track this stays the original decorative
             affordance: clicking it just navigates like the rest of the
             card, unchanged from before. Keyboard-operable when previewable
             (role="button", focusable, Enter/Space) — previously mouse-only,
             the only way to reach the preview toggle without a pointer. -->
        <span class="cover-play" [class.cover-play-active]="playing" [style.width.px]="playSize" [style.height.px]="playSize"
              [attr.role]="previewable ? 'button' : 'img'" [attr.tabindex]="previewable ? 0 : null"
              [attr.aria-pressed]="previewable ? playing : null"
              [attr.aria-label]="asset.title + (previewable ? ' — ' + (playing ? 'pause preview' : 'play preview') : ' — track preview')"
              (click)="onPlayClick($event)" (keydown.enter)="onPlayKeydown($event)" (keydown.space)="onPlayKeydown($event)">
          <app-icon [name]="playing ? 'pause' : 'play'"></app-icon>
        </span>
      }
    </div>
  `,
  styles: [`.cover-play-active{ transform: scale(1.08); }`]
})
export class CoverComponent {
  @Input({ required: true }) asset!: Asset;
  @Input() play = true;
  @Input() playSize = 52;
  @Input() motifSize = 90;
  /** Whether a real audio preview is available to toggle — see the
   * template note above. */
  @Input() previewable = false;
  @Input() playing = false;
  @Output() previewToggle = new EventEmitter<Event>();

  get background(): string {
    return coverBackground(this.asset.id, this.asset.kind);
  }
  get monogram(): string {
    return coverMonogram(this.asset);
  }
  get motif(): string {
    return genreMotif(this.asset.genre);
  }

  onPlayClick(event: Event): void {
    if (!this.previewable) return; // decorative — let the click bubble to the card's own link, unchanged
    event.stopPropagation();
    event.preventDefault();
    this.previewToggle.emit(event);
  }

  onPlayKeydown(event: Event): void {
    if (!this.previewable) return; // not focusable in this state, but guard anyway
    this.onPlayClick(event);
  }
}
