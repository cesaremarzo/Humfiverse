import { Component, effect, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../shared/icon.component';
import { ApiService } from '../core/api.service';
import { StoreService } from '../core/store.service';
import { WalletService } from '../core/wallet.service';
import { SignedActionService, isSignatureRejection } from '../core/signed-action.service';
import { ToastService } from '../core/toast.service';
import { TranslateService } from '@ngx-translate/core';

/** Registration with a verified email (§2.93, legal/08 C-11). Email → a
 * six-digit code from our backend → the wallet signs address and
 * verification id. Opened from the gates (buy, launch, verification) and
 * once after a wallet connects without a registration. */
@Component({
  selector: 'app-registration-modal',
  standalone: true,
  imports: [TranslatePipe, IconComponent],
  templateUrl: './registration-modal.component.html'
})
export class RegistrationModalComponent {
  email = signal('');
  code = signal('');
  verificationId = signal<string | null>(null);
  sentTo = signal<string | null>(null);
  busy = signal<'send' | 'verify' | null>(null);
  errorKey = signal<string | null>(null);
  errorParams = signal<Record<string, unknown>>({});
  done = signal(false);

  constructor(
    public store: StoreService,
    public wallet: WalletService,
    private api: ApiService,
    private signer: SignedActionService,
    private toast: ToastService,
    private translate: TranslateService
  ) {
    // Fresh state each time it opens, prefilled from the in-app login.
    effect(() => {
      if (!this.store.registrationOpen()) return;
      // Only the open flag is tracked: a wallet update must not wipe a code
      // the user is halfway through typing.
      untracked(() => {
        this.reset();
        void this.wallet.loginEmail().then((e) => {
          if (e && !this.email()) this.email.set(e);
        });
      });
    });
  }

  private reset(): void {
    this.code.set('');
    this.verificationId.set(null);
    this.sentTo.set(null);
    this.busy.set(null);
    this.errorKey.set(null);
    this.done.set(false);
  }

  private fail(key: string, params: Record<string, unknown> = {}): void {
    this.errorKey.set(key);
    this.errorParams.set(params);
  }

  close(): void {
    if (this.busy()) return;
    this.store.registrationOpen.set(false);
  }

  async sendCode(): Promise<void> {
    const wallet = this.wallet.state().address;
    const email = this.email().trim();
    this.errorKey.set(null);
    if (!wallet) return this.fail('register.noWallet');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return this.fail('register.emailInvalid');
    this.busy.set('send');
    try {
      const { verificationId } = await this.api.startEmailVerification({ wallet, email, locale: this.store.locale() });
      this.verificationId.set(verificationId);
      this.sentTo.set(email.toLowerCase());
      this.code.set('');
    } catch (err) {
      const status = (err as HttpErrorResponse)?.status;
      this.fail(status === 429 ? 'register.rateLimited' : status === 503 ? 'register.unavailable' : 'register.sendFailed');
    } finally {
      this.busy.set(null);
    }
  }

  async verify(): Promise<void> {
    const id = this.verificationId();
    const email = this.sentTo();
    const code = this.code().replace(/\s/g, '');
    this.errorKey.set(null);
    if (!id || !email) return;
    if (!/^\d{6}$/.test(code)) return this.fail('register.codeFormat');
    this.busy.set('verify');
    try {
      const auth = await this.signer.sign('email-verify', { email, verificationId: id });
      await this.api.confirmEmailVerification({ verificationId: id, code, auth });
      await this.store.syncRegistrationForWallet(this.wallet.state().address);
      this.done.set(true);
      this.toast.show(this.translate.instant('toast.registered'), 'checkCircle');
    } catch (err) {
      if (isSignatureRejection(err)) {
        this.fail('register.signRejected');
      } else {
        const res = err as HttpErrorResponse;
        if (res?.error?.code === 'wrong-code') this.fail('register.codeWrong', { n: res.error.attemptsLeft });
        else if (res?.status === 410) this.fail('register.codeExpired');
        else this.fail('register.verifyFailed');
      }
    } finally {
      this.busy.set(null);
    }
  }

  changeEmail(): void {
    this.reset();
  }
}
