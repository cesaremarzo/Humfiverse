import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IconComponent } from '../../shared/icon.component';
import { CoverComponent } from '../../shared/cover.component';
import { StatusChipComponent } from '../../shared/status-chip.component';
import { MilestoneTrackComponent } from '../../shared/milestone-track.component';
import { DisclosureChipComponent } from '../../shared/disclosure-chip.component';
import { LineChartComponent } from '../../shared/line-chart.component';
import { StoreService } from '../../core/store.service';
import { ApiService } from '../../core/api.service';
import { Asset, DisclosureLevel, OnchainInfo } from '../../core/models';
import { fmtUSD, fmtUSDShort, fundingPct } from '../../core/format.util';
import { computeYieldBreakdown } from '../../core/yield.util';

type TabKey = 'overview' | 'royalty' | 'milestones' | 'disclosure' | 'documents' | 'risk';

@Component({
  selector: 'app-asset-detail',
  standalone: true,
  imports: [RouterLink, TranslatePipe, IconComponent, CoverComponent, StatusChipComponent, MilestoneTrackComponent, DisclosureChipComponent, LineChartComponent],
  templateUrl: './asset-detail.component.html'
})
export class AssetDetailComponent {
  private route = inject(ActivatedRoute);
  private paramMap = toSignal(this.route.paramMap);
  id = computed(() => this.paramMap()?.get('id') ?? '');
  asset = computed<Asset | undefined>(() => this.store.assetById(this.id()));

  tab = signal<TabKey>('overview');
  qty = signal(1);
  ack = signal(false);
  success = signal<{ qty: number; total: number } | null>(null);
  yieldInfoOpen = signal(false);
  onchainInfo = signal<OnchainInfo | null>(null);
  onchainLoading = signal(false);

  disclosureRows: [keyof Asset['aiDisclosure'], string][] = [
    ['vocals', 'disclosure.vocals'],
    ['instrumentation', 'disclosure.instrumentation'],
    ['composition', 'disclosure.composition'],
    ['postProduction', 'disclosure.postProduction'],
    ['lyrics', 'disclosure.lyrics']
  ];

  constructor(
    public store: StoreService,
    private api: ApiService
  ) {
    effect(() => {
      const id = this.id();
      if (!id) return;
      this.onchainInfo.set(null);
      this.onchainLoading.set(true);
      this.api
        .getOnchainInfo(id)
        .then((info) => this.onchainInfo.set(info))
        .catch(() => this.onchainInfo.set({ onchain: false }))
        .finally(() => this.onchainLoading.set(false));
    });
  }

  isPre(a: Asset): boolean {
    return a.kind === 'preproduction';
  }
  remaining(a: Asset): number {
    return a.tokensTotal - a.tokensSold;
  }
  soldOut(a: Asset): boolean {
    return this.remaining(a) <= 0;
  }
  tabs(a: Asset): [TabKey, string][] {
    return this.isPre(a)
      ? [
          ['overview', 'tab.overview'],
          ['milestones', 'tab.milestones'],
          ['disclosure', 'tab.disclosure'],
          ['documents', 'tab.documents'],
          ['risk', 'tab.risk']
        ]
      : [
          ['overview', 'tab.overview'],
          ['royalty', 'tab.royaltyData'],
          ['disclosure', 'tab.disclosure'],
          ['documents', 'tab.documents'],
          ['risk', 'tab.risk']
        ];
  }

  fundingPct = fundingPct;
  fmt = fmtUSD;
  fmtShort = fmtUSDShort;

  yieldBreakdown(a: Asset) {
    return computeYieldBreakdown(a);
  }

  royaltyTotal(a: Asset): number {
    return (a.royaltyHistory || []).reduce((s, d) => s + d.royaltyUSD, 0);
  }
  royaltyAvg(a: Asset): number {
    const h = a.royaltyHistory || [];
    return h.length ? Math.round(this.royaltyTotal(a) / h.length) : 0;
  }

  disclosureVal(a: Asset, key: keyof Asset['aiDisclosure']): DisclosureLevel {
    return a.aiDisclosure[key];
  }

  // --- buy panel interactions ---
  decreaseQty(a: Asset): void {
    this.qty.set(Math.max(1, Math.min(this.remaining(a), this.qty() - 1)));
  }
  increaseQty(a: Asset): void {
    this.qty.set(Math.max(1, Math.min(this.remaining(a), this.qty() + 1)));
  }
  onQtyInput(a: Asset, value: string): void {
    const n = parseInt(value.replace(/\D/g, ''), 10);
    this.qty.set(Math.max(1, Math.min(this.remaining(a), n || 1)));
  }

  buy(a: Asset): void {
    const qty = this.qty();
    const total = qty * a.tokenPrice;
    a.tokensSold += qty;
    this.store.portfolio.update((p) => {
      const existing = p.holdings.find((h) => h.assetId === a.id);
      if (existing) {
        existing.tokens += qty;
        existing.costBasis += total;
      } else {
        p.holdings.push({ assetId: a.id, tokens: qty, costBasis: total, unclaimed: 0 });
      }
      return { ...p, holdings: [...p.holdings] };
    });
    this.success.set({ qty, total });
    this.qty.set(1);
    this.ack.set(false);
  }

  closeModal(): void {
    this.success.set(null);
  }

  successQtyKey(): string {
    const s = this.success();
    return s && s.qty > 1 ? 'success.tokens' : 'success.token';
  }
}
