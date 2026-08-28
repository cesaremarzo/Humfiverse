import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { BackendData, ContractAcceptanceResult, ContractTemplate, KycResult, RedeemResult } from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiBase;

  constructor(private http: HttpClient) {}

  getData(): Promise<BackendData> {
    return firstValueFrom(this.http.get<BackendData>(`${this.base}/api/data`));
  }

  getContractTemplate(): Promise<ContractTemplate> {
    return firstValueFrom(this.http.get<ContractTemplate>(`${this.base}/api/contract-template`));
  }

  redeem(assetId: string): Promise<RedeemResult> {
    return firstValueFrom(this.http.post<RedeemResult>(`${this.base}/api/redeem`, { assetId }));
  }

  submitContractAcceptance(payload: {
    artistName: string;
    trackTitle: string;
    templateVersion: string;
    generalAccepted: boolean;
    vessatoriaAccepted: Record<string, boolean>;
  }): Promise<ContractAcceptanceResult> {
    return firstValueFrom(this.http.post<ContractAcceptanceResult>(`${this.base}/api/contract-acceptance`, payload));
  }

  submitKyc(payload: unknown): Promise<KycResult> {
    return firstValueFrom(this.http.post<KycResult>(`${this.base}/api/kyc`, payload));
  }

  health(): Promise<{ ok: boolean }> {
    return firstValueFrom(this.http.get<{ ok: boolean }>(`${this.base}/api/health`));
  }
}
