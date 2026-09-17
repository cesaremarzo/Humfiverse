import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { IconComponent } from './icon.component';
import { Asset, MediaKind } from '../core/models';
import { ApiService } from '../core/api.service';
import { StoreService } from '../core/store.service';
import { ToastService } from '../core/toast.service';
import { SignedActionService, isSignatureRejection } from '../core/signed-action.service';
import { MEDIA_LIMITS, checkMediaFile, sha256Hex } from '../core/media.util';
import { ipfsGatewayUrl } from '../core/ipfs.util';

/** §2.93: the owner adds or replaces a track's cover image and short video
 * after launch. Each file is signed by the owner wallet (its SHA-256 is in
 * the signed text), so the server can tell these bytes were approved. */
@Component({
  selector: 'app-media-manager',
  standalone: true,
  imports: [TranslatePipe, IconComponent],
  template: `
    <div class="modal-scrim" (click)="$event.target === $event.currentTarget ? close() : null">
      <div class="modal connect-modal media-manager" role="dialog" aria-modal="true" aria-labelledby="media-title">
        <button type="button" class="icon-btn connect-close" [attr.aria-label]="'connect.close' | translate" [disabled]="!!busy()" (click)="close()">
          <app-icon name="close"></app-icon>
        </button>
        <div>
          <span class="page-kicker" style="margin-bottom:8px;">{{ asset.title }}</span>
          <h3 id="media-title" class="panel-title panel-title-lg" style="margin-bottom:6px;">{{ 'media.managerTitle' | translate }}</h3>
          <p style="font-size:13px; color:var(--text-secondary); margin:0;">{{ 'media.managerSubtitle' | translate }}</p>
        </div>
        <div class="media-pickers" style="margin-top:0;">
          @for (kind of kinds; track kind) {
            @let current = asset.media?.[kind];
            <div class="field media-picker">
              <label>{{ 'media.label.' + kind | translate }}</label>
              <label class="media-drop" [class.has-file]="!!current" [attr.aria-busy]="busy() === kind">
                @if (current) {
                  @if (kind === 'image') {
                    <img [src]="gateway(current.uri)" alt="">
                  } @else {
                    <video [src]="gateway(current.uri)" muted loop autoplay playsinline></video>
                  }
                } @else {
                  <app-icon [name]="kind === 'image' ? 'upload' : 'play'"></app-icon>
                  <span>{{ 'media.choose.' + kind | translate }}</span>
                }
                <input type="file" class="visually-hidden" [attr.accept]="limits[kind].accept" [disabled]="!!busy()" (change)="pick(kind, $event)">
              </label>
              <span class="hint">
                @if (busy() === kind) {
                  {{ 'media.uploading' | translate }}
                } @else if (current) {
                  {{ 'media.replaceHint' | translate }}
                } @else {
                  {{ 'media.hint.' + kind | translate }}
                }
              </span>
            </div>
          }
        </div>
        <p style="font-size:11.5px; color:var(--text-muted); margin:0; line-height:1.5;">{{ 'media.publicNote' | translate }}</p>
      </div>
    </div>
  `
})
export class MediaManagerComponent {
  @Input({ required: true }) asset!: Asset;
  @Output() closed = new EventEmitter<void>();

  readonly kinds: MediaKind[] = ['image', 'video'];
  readonly limits = MEDIA_LIMITS;
  busy = signal<MediaKind | null>(null);

  constructor(
    private api: ApiService,
    private store: StoreService,
    private signer: SignedActionService,
    private toast: ToastService,
    private translate: TranslateService
  ) {}

  gateway(uri: string): string {
    return ipfsGatewayUrl(uri);
  }

  close(): void {
    if (!this.busy()) this.closed.emit();
  }

  async pick(kind: MediaKind, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const kindLabel = this.translate.instant(`media.kind.${kind}`);
    const problem = await checkMediaFile(kind, file);
    if (problem) {
      this.toast.show(this.translate.instant(`media.problem.${problem}`, { kind: kindLabel }), 'alert');
      return;
    }
    this.busy.set(kind);
    try {
      const action = await this.signer.sign('asset-media', { assetId: this.asset.id, kind, sha256: await sha256Hex(file) });
      const { media } = await this.api.uploadAssetMedia(this.asset.id, kind, file, { action });
      this.asset = { ...this.asset, media };
      this.store.assets.update((list) => list.map((a) => (a.id === this.asset.id ? { ...a, media } : a)));
      this.toast.show(this.translate.instant('media.uploaded', { kind: kindLabel }), 'checkCircle');
    } catch (err) {
      if (!isSignatureRejection(err)) {
        console.warn('Media upload failed.', err);
        this.toast.show(this.translate.instant('media.uploadFailed', { kind: kindLabel }), 'alert');
      }
    } finally {
      this.busy.set(null);
    }
  }
}
