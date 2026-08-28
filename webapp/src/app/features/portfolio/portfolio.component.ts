import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../../shared/icon.component';
import { StoreService } from '../../core/store.service';
import { fmtUSD } from '../../core/format.util';
import { coverBackground } from '../../core/cover.util';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [RouterLink, TranslatePipe, IconComponent],
  templateUrl: './portfolio.component.html'
})
export class PortfolioComponent {
  holdings = computed(() => this.store.portfolio().holdings);
  distributionsReversed = computed(() => this.store.portfolio().distributions.slice().reverse());

  totalTokens = computed(() => this.holdings().reduce((s, h) => s + h.tokens, 0));
  totalCost = computed(() => this.holdings().reduce((s, h) => s + h.costBasis, 0));
  totalUnclaimed = computed(() => this.holdings().reduce((s, h) => s + h.unclaimed, 0));
  totalClaimed = computed(() => this.store.portfolio().distributions.reduce((s, d) => s + d.amount, 0));

  constructor(public store: StoreService) {}

  fmt = fmtUSD;
  bg(id: string, kind: string): string {
    return coverBackground(id, kind);
  }
  assetTitle(assetId: string): string {
    return this.store.assetById(assetId)?.title || assetId;
  }
  assetArtist(assetId: string): string {
    return this.store.assetById(assetId)?.artistName || '';
  }
}
