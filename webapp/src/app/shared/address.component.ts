import { Component, Input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from './icon.component';
import { knownWalletName } from '../core/known-wallets';
import { explorerUrl, ExplorerKind } from '../core/explorer.util';

/** An on-chain identifier — a wallet, a contract, a transaction or a token —
 * shown the same way everywhere: shortened, linked to Etherscan so anyone can
 * check it on the chain, with a copy button. Platform wallets also carry
 * their team name (Owner/Founder/Fees), which is display only.
 *
 * `nested` is for places already inside a link (the asset cards are one big
 * `<a>`): an anchor cannot sit inside another, so it renders a span that
 * opens the explorer itself and does not trigger the outer link. */
@Component({
  selector: 'app-address',
  standalone: true,
  imports: [TranslatePipe, IconComponent],
  template: `
    @if (href) {
      <span class="addr mono">
        @if (named) { <span class="addr-name">{{ named }}</span> }
        @if (nested) {
          <span class="addr-link" role="link" tabindex="0" [title]="value" [attr.aria-label]="'address.viewOnExplorer' | translate"
                (click)="open($event)" (keydown.enter)="open($event)">{{ label }}</span>
        } @else {
          <a class="addr-link" [href]="href" target="_blank" rel="noopener" [title]="value">{{ label }}</a>
        }
        @if (!nested) {
          <button type="button" class="addr-copy" (click)="copy($event)" [attr.aria-label]="'address.copy' | translate" [title]="(copied() ? 'address.copied' : 'address.copy') | translate">
            <app-icon [name]="copied() ? 'check' : 'copy'"></app-icon>
          </button>
        }
      </span>
    }
  `,
  styles: [`
    :host{ display:inline-flex; max-width:100%; }
    .addr{ display:inline-flex; align-items:center; gap:4px; font-size:11.5px; color:var(--text-secondary); min-width:0; }
    .addr-name{ font-family:var(--font-sans); font-weight:600; color:var(--text); }
    .addr-link{ color:inherit; text-decoration:underline dotted; text-underline-offset:2px; cursor:pointer; white-space:nowrap; }
    .addr-link:hover{ color:var(--accent-ink); }
    .addr-copy{ border:0; background:none; padding:0 2px; color:inherit; cursor:pointer; line-height:0; opacity:.7; }
    .addr-copy:hover{ opacity:1; color:var(--accent-ink); }
    .addr-copy ::ng-deep svg{ width:12px; height:12px; }
  `]
})
export class AddressComponent {
  /** 0x address or transaction hash. Renders nothing when empty. */
  @Input() value: string | null | undefined = null;
  @Input() kind: ExplorerKind = 'address';
  /** For kind 'token': the ERC-1155 id; `value` is then the contract. */
  @Input() tokenId: number | null = null;
  /** Show the whole value instead of 0x1234…abcd. */
  @Input() full = false;
  @Input() nested = false;

  copied = signal(false);

  get href(): string | null {
    return this.value ? explorerUrl(this.kind, this.value, this.tokenId) : null;
  }

  get named(): string | null {
    return this.kind === 'address' ? knownWalletName(this.value) : null;
  }

  get label(): string {
    const v = this.value ?? '';
    const short = this.full || v.length <= 12 ? v : v.slice(0, 6) + '…' + v.slice(-4);
    return this.kind === 'token' && this.tokenId !== null ? `${short} #${this.tokenId}` : short;
  }

  open(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.href) window.open(this.href, '_blank', 'noopener');
  }

  copy(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.value) return;
    navigator.clipboard?.writeText(this.value).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    }, () => {});
  }
}
