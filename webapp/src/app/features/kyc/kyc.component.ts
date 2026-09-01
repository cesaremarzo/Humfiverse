import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IconComponent } from '../../shared/icon.component';
import { StoreService } from '../../core/store.service';
import { ApiService } from '../../core/api.service';
import { WalletService } from '../../core/wallet.service';
import { ToastService } from '../../core/toast.service';
import { fakeTxHash, scoreAppropriatenessLocal } from '../../core/yield.util';
import { KycResult } from '../../core/models';

@Component({
  selector: 'app-kyc',
  standalone: true,
  imports: [RouterLink, TranslatePipe, IconComponent],
  templateUrl: './kyc.component.html'
})
export class KycComponent {
  private route = inject(ActivatedRoute);
  private paramMap = toSignal(this.route.paramMap);
  returnAssetId = computed(() => this.paramMap()?.get('returnAssetId') ?? null);
  continuePath = computed(() => (this.returnAssetId() ? ['/asset', this.returnAssetId()!] : ['/marketplace']));

  fullName = signal('');
  dob = signal('');
  nationality = signal('');
  classification = signal<'retail' | 'professional'>('retail');

  priorComplexInvestments = signal<boolean | null>(null);
  familiarWithIlliquidInstruments = signal<boolean | null>(null);
  understandsCapitalLossRisk = signal<boolean | null>(null);
  yearsExperience = signal<'0' | '1-3' | '3+' | null>(null);

  sourceOfFunds = signal('');
  pep = signal(false);
  warningAck = signal(false);
  submitting = signal(false);
  result = signal<KycResult | null>(null);

  formComplete = computed(
    () =>
      !!this.fullName().trim() &&
      !!this.dob().trim() &&
      !!this.nationality().trim() &&
      this.priorComplexInvestments() !== null &&
      this.familiarWithIlliquidInstruments() !== null &&
      this.understandsCapitalLossRisk() !== null &&
      !!this.yearsExperience() &&
      !!this.sourceOfFunds()
  );

  constructor(
    private router: Router,
    public store: StoreService,
    public wallet: WalletService,
    private api: ApiService,
    private toast: ToastService,
    private translate: TranslateService
  ) {}

  async submit(): Promise<void> {
    this.submitting.set(true);
    const payload = {
      // Ties this record to the connected wallet (§2.30) so a returning
      // wallet is recognized and never asked to redo KYC — see
      // StoreService.syncKycForWallet(), which checks this on connect.
      walletAddress: this.wallet.state().address,
      fullName: this.fullName(),
      dob: this.dob(),
      nationality: this.nationality(),
      classification: this.classification(),
      answers: {
        priorComplexInvestments: this.priorComplexInvestments(),
        familiarWithIlliquidInstruments: this.familiarWithIlliquidInstruments(),
        understandsCapitalLossRisk: this.understandsCapitalLossRisk(),
        yearsExperience: this.yearsExperience()
      },
      sourceOfFunds: this.sourceOfFunds(),
      pep: this.pep()
    };
    try {
      if (!this.store.backendAvailable()) throw new Error('backend unavailable');
      this.result.set(await this.api.submitKyc(payload));
    } catch (err) {
      console.warn('KYC backend submission unavailable, using local fallback scoring.', err);
      const local = scoreAppropriatenessLocal(payload.answers);
      this.result.set({
        verified: true,
        classification: this.classification(),
        appropriatenessResult: local.result,
        score: local.score,
        receiptHash: fakeTxHash()
      });
    }
    this.submitting.set(false);
  }

  finish(): void {
    const r = this.result();
    if (!r) return;
    this.store.investor.set({
      verified: true,
      classification: r.classification ?? null,
      appropriatenessResult: r.appropriatenessResult ?? null,
      score: r.score ?? null,
      receiptHash: r.receiptHash ?? null
    });
    this.toast.show(this.translate.instant('toast.kycVerified'), 'checkCircle');
    this.router.navigate(this.continuePath());
  }
}
