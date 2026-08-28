import { Component, Input, SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import iconsJson from '../core/mock-data/icons.json';

/** Static, developer-authored SVG strings (see mock-data/icons.json, extracted
 * verbatim from the original site's ICONS dictionary) — never user input, so
 * bypassing the sanitizer here is safe. Do not reuse this pattern for anything
 * dynamic/user-supplied. */
const ICONS: Record<string, string> = iconsJson;

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `<span class="icon-inline" [innerHTML]="svg"></span>`,
  styles: [`.icon-inline{ display:inline-flex; line-height:0; }`]
})
export class IconComponent {
  private _name = '';
  svg: SafeHtml = '';

  constructor(private sanitizer: DomSanitizer) {}

  @Input() set name(value: string) {
    this._name = value;
    const raw = ICONS[value] || '';
    this.svg = this.sanitizer.bypassSecurityTrustHtml(raw);
  }
  get name(): string {
    return this._name;
  }
}

export function iconHtml(sanitizer: DomSanitizer, name: string): SafeHtml {
  return sanitizer.bypassSecurityTrustHtml(ICONS[name] || '');
}

export { ICONS };
