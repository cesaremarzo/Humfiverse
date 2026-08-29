import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { StoreService } from '../../core/store.service';
import { WalletService } from '../../core/wallet.service';
import { ToastService } from '../../core/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { Locale } from '../../core/models';
import { SUPPORTED_LOCALES, LOCALE_LABEL } from '../../core/locales';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [TranslatePipe, IconComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent {
  locales = SUPPORTED_LOCALES;
  localeLabel = LOCALE_LABEL;

  constructor(
    public store: StoreService,
    public wallet: WalletService,
    private router: Router,
    private toast: ToastService,
    private translate: TranslateService
  ) {}

  setLocale(l: Locale): void {
    this.store.setLocale(l);
  }

  choose(role: 'investor' | 'artist'): void {
    this.store.perspective.set(role);
    this.router.navigateByUrl(role === 'artist' ? '/for-artists' : '/marketplace');
  }

  async connectWallet(): Promise<void> {
    if (!window.ethereum) {
      this.toast.show(this.translate.instant('toast.noWalletDetected'), 'alert');
      return;
    }
    const result = await this.wallet.connect();
    if (result.ok) {
      this.toast.show(this.translate.instant('toast.walletConnected'), 'wallet');
    } else {
      this.toast.show(this.translate.instant(result.rejected ? 'toast.connectionRejected' : 'toast.couldNotConnect'), 'alert');
    }
  }
}
