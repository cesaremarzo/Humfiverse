import { Component, Input, computed, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { DEFAULT_STORE_RATES, RATES_AS_OF, annualPctOfPrice, computeMasterRoyalty } from '../core/royalty-calculator.util';
import { ROYALTY_FEE_BPS } from '../core/primary-fee.util';
import { fmtUSD, fmtUSDExact } from '../core/format.util';

/** The royalty calculator on a launched campaign's page: the master
 * royalties a number of monthly streams would pay per token, by the formula
 * in royalty-calculator.util.ts. Public, and shown with that formula and the
 * numbers it was given, so the result reads as arithmetic on past average
 * rates and not as a forecast. Nothing here is saved or sent anywhere. */
@Component({
  selector: 'app-royalty-calculator',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="card panel">
      <h3 class="panel-title" style="margin-bottom:6px;">{{ 'royaltyCalc.title' | translate }}</h3>
      <p class="prose" style="font-size:12.5px; margin-bottom:14px;">{{ 'royaltyCalc.intro' | translate }}</p>

      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>{{ 'royaltyCalc.colStore' | translate }}</th>
            <th class="cell-num">{{ 'royaltyCalc.colStreams' | translate }}</th>
            <th class="cell-num">{{ 'royaltyCalc.colRate' | translate }}</th>
            <th class="cell-num">{{ 'royaltyCalc.colGross' | translate }}</th>
          </tr></thead>
          <tbody>
            @for (s of stores(); track s.id; let i = $index) {
              <tr>
                <td>{{ s.label }}</td>
                <td class="cell-num"><input type="number" min="0" step="1000" [value]="s.monthlyStreams" (input)="setStore(i, 'monthlyStreams', $any($event.target).value)" [attr.aria-label]="s.label + ' — ' + ('royaltyCalc.colStreams' | translate)" [style]="inputStyle + 'width:120px;'" /></td>
                <td class="cell-num"><input type="number" min="0" step="0.0001" [value]="s.rateUsd" (input)="setStore(i, 'rateUsd', $any($event.target).value)" [attr.aria-label]="s.label + ' — ' + ('royaltyCalc.colRate' | translate)" [style]="inputStyle + 'width:100px;'" /></td>
                <td class="cell-num mono">
                  {{ fmtExact(result().lines[i].grossUsd) }}
                  @if (result().lines[i].belowThreshold && s.monthlyStreams > 0) { <div style="font-size:11px; color:var(--text-secondary);">{{ 'royaltyCalc.belowThreshold' | translate: { n: s.minAnnualStreams } }}</div> }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin:14px 0;">
        <label style="display:flex; flex-direction:column; gap:6px;">
          <span style="font-size:12px; color:var(--text-secondary);">{{ 'royaltyCalc.commissionLabel' | translate }}</span>
          <input type="number" min="0" max="100" step="1" [value]="commissionPct()" (input)="commissionPct.set(num($any($event.target).value))" [style]="inputStyle + 'width:120px;'" />
        </label>
        <label style="display:flex; flex-direction:column; gap:6px;">
          <span style="font-size:12px; color:var(--text-secondary);">{{ 'royaltyCalc.myTokensLabel' | translate }}</span>
          <input type="number" min="0" step="1" [value]="myTokens()" (input)="myTokens.set(num($any($event.target).value))" [style]="inputStyle + 'width:120px;'" />
        </label>
      </div>

      <div class="stat-row" style="margin-bottom:14px;">
        <div class="card stat-tile"><div class="label">{{ 'royaltyCalc.holdersMonthly' | translate }}</div><div class="value mono">{{ fmt(result().holdersMonthlyUsd) }}</div></div>
        <div class="card stat-tile"><div class="label">{{ 'royaltyCalc.perTokenAnnual' | translate }}</div><div class="value mono">{{ fmtExact(result().perTokenAnnualUsd) }}</div></div>
        <div class="card stat-tile"><div class="label">{{ 'royaltyCalc.myAnnual' | translate: { n: myTokens() } }}</div><div class="value mono">{{ fmt(result().perTokenAnnualUsd * myTokens()) }}</div></div>
        @if (pctOfPrice() !== null) {
          <div class="card stat-tile"><div class="label">{{ 'royaltyCalc.pctOfPrice' | translate }}</div><div class="value mono">{{ pctOfPrice()!.toFixed(2) }}%</div></div>
        }
      </div>

      <div class="prose" style="font-size:12px; border-top:1px solid var(--border); padding-top:12px;">
        <p style="margin-bottom:6px;"><strong>{{ 'royaltyCalc.formulaTitle' | translate }}</strong></p>
        <p class="mono" style="margin-bottom:6px;">{{ 'royaltyCalc.formula' | translate: { fee: feePct } }}</p>
        <p class="mono" style="margin-bottom:10px;">{{ 'royaltyCalc.calculation' | translate: { gross: fmtExact(result().grossMonthlyUsd), commission: commissionPct(), fee: feePct, tokens: tokens(), perToken: fmtExact(result().perTokenMonthlyUsd), annual: fmtExact(result().perTokenAnnualUsd) } }}</p>
        <p style="margin-bottom:6px;">{{ 'royaltyCalc.ratesNote' | translate: { year: ratesAsOf } }}</p>
        <p style="margin-bottom:6px;">{{ 'royaltyCalc.masterOnly' | translate }}</p>
        <p><strong>{{ 'royaltyCalc.disclaimer' | translate }}</strong></p>
      </div>
    </div>
  `
})
export class RoyaltyCalculatorComponent {
  /** Setters into signals, so the computed figures follow a changed input. */
  @Input({ required: true }) set tokensTotal(v: number) { this.tokens.set(v); }
  @Input() set tokenPrice(v: number) { this.price.set(v); }
  tokens = signal(0);
  price = signal(0);

  readonly ratesAsOf = RATES_AS_OF;
  readonly feePct = ROYALTY_FEE_BPS / 100;
  readonly inputStyle = 'padding:8px 10px; border-radius:10px; border:1px solid var(--border); background:var(--surface); color:var(--text); font:inherit; text-align:right;';

  stores = signal(DEFAULT_STORE_RATES.map((s) => ({ ...s, monthlyStreams: 0 })));
  commissionPct = signal(0);
  myTokens = signal(1);

  result = computed(() =>
    computeMasterRoyalty({ stores: this.stores(), distributorCommissionPct: this.commissionPct(), tokensTotal: this.tokens() })
  );
  pctOfPrice = computed(() => annualPctOfPrice(this.result().perTokenAnnualUsd, this.price()));

  setStore(i: number, field: 'monthlyStreams' | 'rateUsd', value: string): void {
    this.stores.update((list) => list.map((s, j) => (j === i ? { ...s, [field]: this.num(value) } : s)));
  }

  num(value: string): number {
    const n = parseFloat(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  fmt = fmtUSD;
  fmtExact = fmtUSDExact;
}
