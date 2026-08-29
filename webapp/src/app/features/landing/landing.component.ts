import { AfterViewInit, Component, ElementRef, HostListener, ViewChild, signal } from '@angular/core';
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
export class LandingComponent implements AfterViewInit {
  locales = SUPPORTED_LOCALES;
  localeLabel = LOCALE_LABEL;

  artistOpacity = signal(1);
  investorOpacity = signal(1);

  @ViewChild('artistPanel') private artistPanelRef?: ElementRef<HTMLElement>;
  @ViewChild('investorPanel') private investorPanelRef?: ElementRef<HTMLElement>;

  constructor(
    public store: StoreService,
    public wallet: WalletService,
    private router: Router,
    private toast: ToastService,
    private translate: TranslateService
  ) {}

  ngAfterViewInit(): void {
    this.updateOpacities();
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.updateOpacities();
  }

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

  private updateOpacities(): void {
    if (this.artistPanelRef) this.artistOpacity.set(this.opacityFor(this.artistPanelRef.nativeElement));
    if (this.investorPanelRef) this.investorOpacity.set(this.opacityFor(this.investorPanelRef.nativeElement));
  }

  /** Panels fade in as they approach the viewport centre while scrolling, and
   * fade back out once they drift away from it — never fully invisible. */
  private opacityFor(el: HTMLElement): number {
    const rect = el.getBoundingClientRect();
    const viewportCenter = window.innerHeight / 2;
    const elCenter = rect.top + rect.height / 2;
    const distance = Math.abs(elCenter - viewportCenter);
    const maxDistance = window.innerHeight * 0.85;
    const t = Math.min(distance / maxDistance, 1);
    return Math.max(1 - t, 0.15);
  }
}
