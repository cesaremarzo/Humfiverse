import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  icon: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  show(message: string, icon = 'checkCircle'): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, message, icon }]);
    setTimeout(() => {
      this.toasts.update((list) => list.filter((t) => t.id !== id));
    }, 3200);
  }
}
