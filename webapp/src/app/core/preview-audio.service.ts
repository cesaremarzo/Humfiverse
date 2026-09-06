import { Injectable, signal } from '@angular/core';

/** One shared <audio> element for marketplace card previews (§2.44) — so
 * starting a preview on one card stops whatever was already playing on
 * another, rather than several tracks overlapping. Deliberately separate
 * from the asset-detail page's own <audio controls> element, which plays
 * the full track and manages its own state via native browser controls. */
@Injectable({ providedIn: 'root' })
export class PreviewAudioService {
  private audio = new Audio();
  readonly playingAssetId = signal<string | null>(null);

  constructor() {
    this.audio.addEventListener('ended', () => this.playingAssetId.set(null));
    this.audio.addEventListener('pause', () => {
      // Only clear on an external pause (e.g. another tab's media key) —
      // toggle() below already clears it for an explicit stop/switch, so
      // this is just a safety net against state drifting from reality.
      if (this.audio.paused && this.audio.currentTime === 0) this.playingAssetId.set(null);
    });
  }

  /** Starts previewing `url` for `assetId`, or stops it if that asset is
   * already the one playing. */
  toggle(assetId: string, url: string): void {
    if (this.playingAssetId() === assetId) {
      this.audio.pause();
      this.playingAssetId.set(null);
      return;
    }
    this.audio.src = url;
    this.audio.currentTime = 0;
    this.audio.play().catch(() => this.playingAssetId.set(null));
    this.playingAssetId.set(assetId);
  }
}
