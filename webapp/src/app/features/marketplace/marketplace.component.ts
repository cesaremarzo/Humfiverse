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

  list = computed(() => {
    let list = this.store.assets().slice();
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

  totalCount = computed(() => this.store.assets().length);

  constructor(public store: StoreService) {}

  onQueryInput(value: string): void {
    this.query.set(value);
  }
}
