import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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
  constructor(
    private store: StoreService,
    private wallet: WalletService
  ) {}

  ngOnInit(): void {
    document.documentElement.lang = this.store.locale();
    this.wallet.wireProviderEvents();
    this.wallet.silentSync();
    this.store.hydrateFromBackend();
  }
}
