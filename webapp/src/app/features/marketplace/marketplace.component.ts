import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../../shared/icon.component';
import { AssetCardComponent } from '../../shared/asset-card.component';
import { CoverComponent } from '../../shared/cover.component';
import { StoreService } from '../../core/store.service';
import { Asset } from '../../core/models';
import { fmtUSD, fmtUSDShort, fundingGoal } from '../../core/format.util';
import { fundingPctFor, fundingRaisedFor } from '../../core/onchain-progress.util';
import { computeProjectedYield } from '../../core/yield.util';

type SortKey = 'default' | 'funded' | 'raised' | 'priceAsc' | 'priceDesc' | 'holders';

/** One row of the market table: every figure the card shows, computed once
 * with the same helpers the card uses, so the two views can never disagree. */
interface MarketRow {
  asset: Asset;
  pct: number;
  raised: number;
  goal: number;
  holders: number | null;
  yieldPct: number | null;
}

const VIEW_KEY = 'hv.marketView';

@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [RouterLink, TranslatePipe, IconComponent, AssetCardComponent, CoverComponent],
  templateUrl: './marketplace.component.html'
})
export class MarketplaceComponent {
  private router = inject(Router);

  filter = signal<'all' | 'catalogue' | 'preproduction'>('all');
  query = signal('');
  sort = signal<SortKey>('default');
  view = signal<'grid' | 'table'>(readView());

  readonly sortKeys: SortKey[] = ['default', 'funded', 'raised', 'priceAsc', 'priceDesc', 'holders'];
  readonly skeletons = [0, 1, 2, 3, 4, 5];

  /** Only assets with a real, chain-verified token (technical-architecture.md
   * §2.14) — falls back to the full mock catalogue while the check is still
   * loading or the backend is unreachable, matching this app's usual
   * graceful-degradation pattern rather than showing an empty marketplace. */
  chainVerifiedAssets = computed(() => {
    const ids = this.store.onchainAssetIds();
    const all = this.store.assets();
    return ids ? all.filter((a) => ids.has(a.id)) : all;
  });

  rows = computed<MarketRow[]>(() =>
    this.chainVerifiedAssets().map((a) => {
      const onchain = this.store.onchainFor(a.id);
      const escrow = this.store.escrowFor(a.id);
      return {
        asset: a,
        pct: fundingPctFor(a, onchain, escrow),
        raised: fundingRaisedFor(a, onchain, escrow),
        goal: fundingGoal(a),
        holders: this.store.holderCountFor(a.id),
        yieldPct: a.kind === 'preproduction' ? null : computeProjectedYield(a)
      };
    })
  );

  list = computed<MarketRow[]>(() => {
    let list = this.rows().slice();
    if (this.filter() === 'catalogue') list = list.filter((r) => r.asset.kind === 'catalogue');
    if (this.filter() === 'preproduction') list = list.filter((r) => r.asset.kind === 'preproduction');
    const q = this.query().trim().toLowerCase();
    if (q) {
      list = list.filter(
        ({ asset: a }) => a.title.toLowerCase().includes(q) || a.artistName.toLowerCase().includes(q) || a.genre.toLowerCase().includes(q)
      );
    }
    switch (this.sort()) {
      case 'funded': list.sort((x, y) => y.pct - x.pct); break;
      case 'raised': list.sort((x, y) => y.raised - x.raised); break;
      case 'priceAsc': list.sort((x, y) => x.asset.tokenPrice - y.asset.tokenPrice); break;
      case 'priceDesc': list.sort((x, y) => y.asset.tokenPrice - x.asset.tokenPrice); break;
      // Unknown holder counts sort last, never as zero: "not tracked" is not "none".
      case 'holders': list.sort((x, y) => (y.holders ?? -1) - (x.holders ?? -1)); break;
    }
    return list;
  });

  /** §2.41 — while the first on-chain listing check is still in flight,
   * show a loading state instead of the mock-catalogue fallback (which is
   * meant for a genuinely unreachable backend, not this normal ~1s window
   * on every page load) to avoid a flash of the wrong 6 tracks — and the
   * wrong "All (6)" filter-button count — before the real 2 snap in. */
  loading = computed(() => this.store.onchainListLoading());

  /** Funding figures come from the batched chain read; until it lands they
   * would be the mock counters, so every figure derived from them waits. */
  figuresLoading = computed(() => this.loading() || this.store.onchainInfoLoading());

  totalCount = computed(() => (this.loading() ? 0 : this.chainVerifiedAssets().length));

  /** Market overview: sums of the same per-asset numbers the cards print. */
  stats = computed(() => {
    const rows = this.rows();
    const raised = rows.reduce((s, r) => s + r.raised, 0);
    const goal = rows.reduce((s, r) => s + r.goal, 0);
    return {
      listed: rows.length,
      catalogues: rows.filter((r) => r.asset.kind === 'catalogue').length,
      preproduction: rows.filter((r) => r.asset.kind === 'preproduction').length,
      raised: fmtUSD(Math.round(raised * 100) / 100),
      goal: fmtUSDShort(goal),
      fundedPct: goal > 0 ? Math.round((raised / goal) * 1000) / 10 : 0
    };
  });

  constructor(public store: StoreService) {}

  onQueryInput(value: string): void {
    this.query.set(value);
  }

  setView(v: 'grid' | 'table'): void {
    this.view.set(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* private mode: the choice just isn't remembered */ }
  }

  open(row: MarketRow): void {
    this.router.navigate(['/asset', row.asset.id]);
  }

  usd(n: number): string {
    return fmtUSD(n);
  }
  usdShort(n: number): string {
    return fmtUSDShort(n);
  }
}

function readView(): 'grid' | 'table' {
  try { return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'grid'; } catch { return 'grid'; }
}
