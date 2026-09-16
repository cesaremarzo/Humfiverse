import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { StoreService } from '../../core/store.service';
import { WalletService } from '../../core/wallet.service';
import { ToastService } from '../../core/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { FooterComponent } from '../../layout/footer.component';
import { Locale } from '../../core/models';
import { SUPPORTED_LOCALES, LOCALE_LABEL } from '../../core/locales';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [TranslatePipe, IconComponent, FooterComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent {
  locales = SUPPORTED_LOCALES;
  localeLabel = LOCALE_LABEL;

  /** Protocol facts scrolled under the hero; each must stay true of the live prototype. */
  tickerKeys = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `landing.ticker.${i}`);

  steps = [
    { key: 'step1', icon: 'mic' },
    { key: 'step2', icon: 'coins' },
    { key: 'step3', icon: 'shield' },
    { key: 'step4', icon: 'pulse' }
  ];

  /** The brand mark's nine bars (same geometry as the topbar logo). */
  markBars = [
    { x: 16, y1: 55, y2: 65, o: 0.4 }, { x: 27, y1: 44.7, y2: 75.3, o: 0.6 }, { x: 38, y1: 35.9, y2: 84.1, o: 0.8 },
    { x: 49, y1: 30.1, y2: 90, o: 0.95 }, { x: 60, y1: 28, y2: 92, o: 1 }, { x: 71, y1: 30.1, y2: 90, o: 0.95 },
    { x: 82, y1: 35.9, y2: 84.1, o: 0.8 }, { x: 93, y1: 44.7, y2: 75.3, o: 0.6 }, { x: 104, y1: 55, y2: 65, o: 0.4 }
  ];

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

  /** The page uses hash routing, so a plain #fragment link would be read as a route. */
  scrollToPanels(event: Event): void {
    event.preventDefault();
    document.getElementById('landing-panels')?.scrollIntoView({ behavior: 'smooth' });
  }

  choose(role: 'investor' | 'artist'): void {
    this.store.perspective.set(role);
    this.router.navigateByUrl(role === 'artist' ? '/for-artists' : '/marketplace');
  }

  async connectWallet(): Promise<void> {
    const result = await this.wallet.connect();
    if (result.cancelled) return;
    if (result.ok) {
      this.toast.show(this.translate.instant('toast.walletConnected'), 'wallet');
    } else {
      this.toast.show(this.translate.instant(result.rejected ? 'toast.connectionRejected' : 'toast.couldNotConnect'), 'alert');
    }
  }
}
