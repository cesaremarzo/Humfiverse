import { Component, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../shared/icon.component';
import { ConnectResult, WalletService } from '../core/wallet.service';

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
  busy = signal<'google' | 'apple' | 'email' | 'injected' | null>(null);
  errorKey = signal<string | null>(null);

  constructor(public wallet: WalletService) {}

  /* No await before connectWithSocial: it opens the popup, and the browser
     only allows that while still inside the click. */
  social(strategy: 'google' | 'apple'): void {
    this.start(strategy);
    void this.wallet.connectWithSocial(strategy).then((r) => this.finish(r));
  }

  async injected(): Promise<void> {
    this.start('injected');
    this.finish(await this.wallet.connectInjected());
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
    this.reset();
    this.wallet.closePicker();
  }

  private start(what: 'google' | 'apple' | 'email' | 'injected'): void {
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
