import { Component, computed, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { IconComponent } from '../shared/icon.component';
import { ConnectResult, WalletService } from '../core/wallet.service';
import { ToastService } from '../core/toast.service';

/** The sign-in dialog behind every "Connect wallet" button (§2.83).
 * WalletService.connect() opens it and waits; whichever option the user
 * picks, the dialog closes by handing WalletService the result, so the
 * button that asked gets its answer exactly as it did with MetaMask alone. */
@Component({
  selector: 'app-connect-modal',
  standalone: true,
  imports: [TranslatePipe, IconComponent],
  templateUrl: './connect-modal.component.html'
})
export class ConnectModalComponent {
  email = signal('');
  code = signal('');
  codeSentTo = signal<string | null>(null);
  busy = signal<'google' | 'apple' | 'email' | null>(null);
  /** The browser wallet being waited on. Kept apart from `busy` so a wallet
   * that doesn't answer never locks Google, Apple, email or another wallet. */
  pendingWallet = signal<string | null>(null);
  errorKey = signal<string | null>(null);

  /** The browser wallet currently connected, when that is the source. */
  activeWallet = computed(() => {
    const id = this.wallet.activeInjectedId();
    return this.wallet.state().kind === 'injected' && id ? (this.wallet.injectedWallets().find((w) => w.id === id) ?? null) : null;
  });

  constructor(
    public wallet: WalletService,
    private toast: ToastService,
    private translate: TranslateService
  ) {}

  /** Opened from the connected address in the top bar: signs out without
   * leaving the dialog's other options, which switch to another account. */
  disconnect(): void {
    if (this.busy()) return;
    const embedded = this.wallet.state().kind === 'embedded';
    this.close();
    this.wallet.disconnect();
    this.toast.show(this.translate.instant(embedded ? 'toast.signedOut' : 'toast.walletDisconnected'), 'info');
  }

  /* No await before connectWithSocial: it opens the popup, and the browser
     only allows that while still inside the click. */
  social(strategy: 'google' | 'apple'): void {
    this.start(strategy);
    this.pendingWallet.set(null);
    void this.wallet.connectWithSocial(strategy).then((r) => this.finish(r));
  }

  async injected(walletId: string): Promise<void> {
    this.pendingWallet.set(walletId);
    this.errorKey.set(null);
    const result = await this.wallet.connectInjected(walletId);
    // A later choice, or closing the dialog, superseded this attempt.
    if (result.cancelled || this.pendingWallet() !== walletId) return;
    this.pendingWallet.set(null);
    this.finish(result);
  }

  async sendCode(): Promise<void> {
    const email = this.email().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.errorKey.set('connect.emailInvalid');
      return;
    }
    this.start('email');
    try {
      await this.wallet.sendEmailCode(email);
      this.codeSentTo.set(email);
      this.code.set('');
    } catch (err) {
      console.warn('Could not send the email code.', err);
      this.errorKey.set('connect.emailSendFailed');
    } finally {
      this.busy.set(null);
    }
  }

  async verifyCode(): Promise<void> {
    const email = this.codeSentTo();
    if (!email || !this.code().trim()) return;
    this.start('email');
    const result = await this.wallet.connectWithEmail(email, this.code().trim());
    if (!result.ok) {
      this.busy.set(null);
      this.errorKey.set('connect.codeInvalid');
      return;
    }
    this.finish(result);
  }

  changeEmail(): void {
    this.codeSentTo.set(null);
    this.code.set('');
    this.errorKey.set(null);
  }

  close(): void {
    if (this.busy()) return;
    if (this.pendingWallet()) {
      this.pendingWallet.set(null);
      this.wallet.cancelPendingConnect();
    }
    this.reset();
    this.wallet.closePicker();
  }

  private start(what: 'google' | 'apple' | 'email'): void {
    this.busy.set(what);
    this.errorKey.set(null);
  }

  private finish(result: ConnectResult): void {
    this.busy.set(null);
    if (result.ok) {
      this.reset();
      this.wallet.closePicker(result);
      return;
    }
    if (result.popupBlocked) this.errorKey.set('connect.popupBlocked');
    else if (result.timedOut) this.errorKey.set('connect.walletTimeout');
    else if (result.rejected) this.errorKey.set('toast.connectionRejected');
    else this.errorKey.set('connect.failed');
  }

  private reset(): void {
    this.email.set('');
    this.code.set('');
    this.codeSentTo.set(null);
    this.errorKey.set(null);
  }
}
