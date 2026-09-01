import { Component, OnInit, effect, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { TopbarComponent } from './layout/topbar.component';
import { PilotBannerComponent } from './layout/pilot-banner.component';
import { FooterComponent } from './layout/footer.component';
import { ToastWrapComponent } from './layout/toast-wrap.component';
import { StoreService } from './core/store.service';
import { WalletService } from './core/wallet.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TopbarComponent, PilotBannerComponent, FooterComponent, ToastWrapComponent],
  templateUrl: './app.html'
})
export class App implements OnInit {
  isLanding = signal(true);

  constructor(
    private store: StoreService,
    private wallet: WalletService,
    private router: Router
  ) {
    this.isLanding.set(this.router.url === '/');
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      this.isLanding.set(e.urlAfterRedirects === '/');
    });

    // Re-checks KYC status every time the connected wallet changes (§2.30)
    // — a wallet that already completed it shouldn't be asked again, and
    // switching to a different, never-verified wallet shouldn't inherit
    // the previous one's verification.
    let lastSyncedAddress: string | null | undefined = undefined;
    effect(() => {
      const address = this.wallet.state().address;
      if (address === lastSyncedAddress) return;
      lastSyncedAddress = address;
      this.store.syncKycForWallet(address);
    });
  }

  ngOnInit(): void {
    document.documentElement.lang = this.store.locale();
    this.wallet.wireProviderEvents();
    this.wallet.silentSync();
    this.store.hydrateFromBackend();
  }
}
