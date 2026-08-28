import { Component, Input, computed, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { DisclosureLevel } from '../core/models';

const KEY_MAP: Record<string, string> = {
  human: 'disclosure.human',
  'ai-assisted': 'disclosure.aiAssisted',
  ai: 'disclosure.ai',
  pending: 'disclosure.pending',
  'n/a': 'disclosure.na'
};
const CLASS_MAP: Record<string, string> = {
  human: 'chip-good',
  'ai-assisted': 'chip-warning',
  ai: 'chip-critical'
};

@Component({
  selector: 'app-disclosure-chip',
  standalone: true,
  imports: [TranslatePipe],
  template: `<span class="chip" [class]="cls()">{{ labelKey() | translate }}</span>`
})
export class DisclosureChipComponent {
  value = signal<DisclosureLevel>('human');
  @Input({ required: true }) set val(v: DisclosureLevel) {
    this.value.set(v);
  }

  labelKey = computed(() => KEY_MAP[this.value()] || this.value());
  cls = computed(() => CLASS_MAP[this.value()] || 'chip-neutral');
}
