import { Component, Input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CoverComponent } from './cover.component';
import { StatusChipComponent } from './status-chip.component';
import { VerifiedChipComponent } from './verified-chip.component';
import { SparklineComponent } from './sparkline.component';
import { Asset } from '../core/models';
import { fmtUSD, fmtUSDShort, fundingGoal } from '../core/format.util';
import { fundingPctFor, fundingRaisedFor } from '../core/onchain-progress.util';
import { computeProjectedYield } from '../core/yield.util';
import { StoreService } from '../core/store.service';
import { PreviewAudioService } from '../core/preview-audio.service';
import { ipfsGatewayUrl } from '../core/ipfs.util';

@Component({
  selector: 'app-asset-card',
  standalone: true,
  imports: [RouterLink, TranslatePipe, CoverComponent, StatusChipComponent, VerifiedChipComponent, SparklineComponent],
  templateUrl: './asset-card.component.html'
})
export class AssetCardComponent {
  private store = inject(StoreService);
  private preview = inject(PreviewAudioService);

  @Input({ required: true }) asset!: Asset;

  /** §2.44 — a real preview, straight from the track linked on-chain
   * (HumfiverseCatalogueToken.trackAudioUri), not a mock/placeholder clip.
   * "" until the artist actually uploads one (§2.43). */
  get previewUrl(): string | null {
    const info = this.store.onchainInfoMap().get(this.asset.id);
    return info?.onchain && info.audioUri ? ipfsGatewayUrl(info.audioUri) : null;
  }
  get isPreviewPlaying(): boolean {
    return this.preview.playingAssetId() === this.asset.id;
  }
  onPreviewToggle(): void {
    const url = this.previewUrl;
    if (url) this.preview.toggle(this.asset.id, url);
  }

  get isPre(): boolean {
    return this.asset.kind === 'preproduction';
  }
  /** Real chain/escrow state when available (§2.40) — falls back to the
   * static mock tokensSold count otherwise, same graceful-degradation
   * pattern as the asset-detail page this now shares logic with. Without
   * this, a card's funding bar never moved after a real on-chain purchase
   * even though the detail page for the same asset showed the update. */
  /** True while the batched pool read is still in flight and this asset
   * has no entry yet. The card then shows a placeholder rather than the
   * mock counter's zero, which is a real number the page is about to
   * replace and reads exactly like a finished answer. */
  get fundingUnknown(): boolean {
    return this.store.onchainInfoLoading() && !this.store.onchainFor(this.asset.id);
  }
  get pct(): number {
    return fundingPctFor(this.asset, this.store.onchainFor(this.asset.id), this.store.escrowFor(this.asset.id));
  }
  get raisedShort(): string {
    return fmtUSDShort(fundingRaisedFor(this.asset, this.store.onchainFor(this.asset.id), this.store.escrowFor(this.asset.id)));
  }
  get goalShort(): string {
    return fmtUSDShort(fundingGoal(this.asset));
  }
  get priceFmt(): string {
    return fmtUSD(this.asset.tokenPrice);
  }
  /** null when there's no real royalty history to compute from — the
   * template shows an honest "not yet reported" state instead of masking
   * this as a plausible-looking "0.0%", which would just be a different
   * kind of fake number. */
  get yieldPct(): number | null {
    return computeProjectedYield(this.asset);
  }
}
