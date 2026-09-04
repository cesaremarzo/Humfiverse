import { Component, computed, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../../shared/icon.component';
import { AssetCardComponent } from '../../shared/asset-card.component';
import { StoreService } from '../../core/store.service';

@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [TranslatePipe, IconComponent, AssetCardComponent],
  templateUrl: './marketplace.component.html'
})
export class MarketplaceComponent {
  filter = signal<'all' | 'catalogue' | 'preproduction'>('all');
  query = signal('');

  /** Only assets with a real, chain-verified token (technical-architecture.md
   * §2.14) — falls back to the full mock catalogue while the check is still
   * loading or the backend is unreachable, matching this app's usual
   * graceful-degradation pattern rather than showing an empty marketplace. */
  chainVerifiedAssets = computed(() => {
    const ids = this.store.onchainAssetIds();
    const all = this.store.assets();
    return ids ? all.filter((a) => ids.has(a.id)) : all;
  });

  list = computed(() => {
    let list = this.chainVerifiedAssets().slice();
    if (this.filter() === 'catalogue') list = list.filter((a) => a.kind === 'catalogue');
    if (this.filter() === 'preproduction') list = list.filter((a) => a.kind === 'preproduction');
    const q = this.query().trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) => a.title.toLowerCase().includes(q) || a.artistName.toLowerCase().includes(q) || a.genre.toLowerCase().includes(q)
      );
    }
    return list;
  });

  /** §2.41 — while the first on-chain listing check is still in flight,
   * show a loading state instead of the mock-catalogue fallback (which is
   * meant for a genuinely unreachable backend, not this normal ~1s window
   * on every page load) to avoid a flash of the wrong 6 tracks — and the
   * wrong "All (6)" filter-button count — before the real 2 snap in. */
  loading = computed(() => this.store.onchainListLoading());

  totalCount = computed(() => (this.loading() ? 0 : this.chainVerifiedAssets().length));

  constructor(public store: StoreService) {}

  onQueryInput(value: string): void {
    this.query.set(value);
  }
}
