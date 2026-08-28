import { Component } from '@angular/core';
import { IconComponent } from '../shared/icon.component';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-toast-wrap',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="toast-wrap">
      @for (t of toastService.toasts(); track t.id) {
        <div class="toast">
          <app-icon [name]="t.icon"></app-icon>
          <span>{{ t.message }}</span>
        </div>
      }
    </div>
  `
})
export class ToastWrapComponent {
  constructor(public toastService: ToastService) {}
}
