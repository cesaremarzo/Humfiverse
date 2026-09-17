import { Component, Input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from './icon.component';
import { StoreService } from '../core/store.service';

/** §2.93: the notice shown where an unregistered wallet is stopped — buying,
 * launching, investor verification — with the button that opens registration. */
@Component({
  selector: 'app-registration-gate',
  standalone: true,
  imports: [TranslatePipe, IconComponent],
  template: `
    <div class="risk-item" [style.margin-bottom.px]="spaced ? 16 : 0">
      <app-icon name="shield"></app-icon>
      <div>
        {{ messageKey | translate }}
        <button type="button" class="btn btn-primary btn-sm" style="margin-top:8px; display:flex;" (click)="store.registrationOpen.set(true)">
          <app-icon name="checkCircle"></app-icon> {{ 'register.verifyBtn' | translate }}
        </button>
      </div>
    </div>
  `
})
export class RegistrationGateComponent {
  @Input() messageKey = 'register.gateGeneric';
  @Input() spaced = false;
  constructor(public store: StoreService) {}
}
