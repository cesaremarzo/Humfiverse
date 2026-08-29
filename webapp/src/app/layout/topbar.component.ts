import { Component, computed } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { IconComponent } from '../shared/icon.component';
import { StoreService } from '../core/store.service';
import { WalletService } from '../core/wallet.service';
import { ToastService } from '../core/toast.service';
import { Locale } from '../core/models';
import { SUPPORTED_LOCALES, LOCALE_LABEL } from '../core/locales';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe, IconComponent],
  templateUrl: './topbar.component.html'
})
export class TopbarComponent {
  locales = SUPPORTED_LOCALES;
  localeLabel = LOCALE_LABEL;

  theme = computed(() => {
    const explicit = this.store.theme();
    if (explicit) return explicit;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  constructor(
    public store: StoreService,
    public wallet: WalletService,
    private toast: ToastService,
    private router: Router,
    private translate: TranslateService
  ) {}

  setLocale(l: Locale): void {
    this.store.setLocale(l);
  }

  setPerspective(role: 'investor' | 'artist'): void {
    this.store.perspective.set(role);
    const path = this.router.url.replace(/^\//, '').replace(/^#\//, '');
    const seg = path.split('/')[0];
    if (role === 'artist' && !['for-artists', 'artist'].includes(seg)) {
      this.router.navigateByUrl('/for-artists');
    }
    if (role === 'investor' && !['marketplace', 'asset', 'portfolio'].includes(seg)) {
      this.router.navigateByUrl('/marketplace');
    }
  }

  toggleTheme(): void {
    this.store.theme.set(this.theme() === 'dark' ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', this.store.theme()!);
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
