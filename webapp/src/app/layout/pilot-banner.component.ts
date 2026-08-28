import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../shared/icon.component';
import { StoreService } from '../core/store.service';

@Component({
  selector: 'app-pilot-banner',
  standalone: true,
  imports: [TranslatePipe, IconComponent],
  template: `
    @if (!store.bannerDismissed()) {
      <div class="pilot-banner">
        <app-icon name="info"></app-icon>
        <div><b>{{ 'banner.title' | translate }}</b> {{ 'banner.body' | translate }}</div>
        <button class="dismiss" [attr.aria-label]="'banner.dismiss' | translate" (click)="store.bannerDismissed.set(true)">
          <app-icon name="close"></app-icon>
        </button>
      </div>
    }
  `
})
export class PilotBannerComponent {
  constructor(public store: StoreService) {}
}
