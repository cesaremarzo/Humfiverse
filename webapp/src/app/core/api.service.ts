import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  BackendData,
  ContractAcceptanceResult,
  ContractTemplate,
  EscrowCampaignCreateResult,
  EscrowCampaignInfo,
  KycResult,
  OnchainInfo,
  OnchainMintResult,
  RedeemResult
} from './models';

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

  getOnchainInfo(assetId: string): Promise<OnchainInfo> {
    return firstValueFrom(this.http.get<OnchainInfo>(`${this.base}/api/onchain/${encodeURIComponent(assetId)}`));
  }

  mintOnchainToken(payload: { assetId: string; slug: string; supply: number; priceWei?: string }): Promise<OnchainMintResult> {
    return firstValueFrom(this.http.post<OnchainMintResult>(`${this.base}/api/onchain/mint`, payload));
  }

  /** Every assetId with a real, chain-verified token — see StoreService.onchainAssetIds. */
  getOnchainList(): Promise<{ source: 'chain' | 'local-table'; assetIds: string[] }> {
    return firstValueFrom(this.http.get<{ source: 'chain' | 'local-table'; assetIds: string[] }>(`${this.base}/api/onchain/list`));
  }

  getEscrowCampaign(assetId: string): Promise<EscrowCampaignInfo> {
    return firstValueFrom(this.http.get<EscrowCampaignInfo>(`${this.base}/api/escrow/campaign/${encodeURIComponent(assetId)}`));
  }

  createEscrowCampaign(payload: {
    assetId: string;
    artistAddress: string;
    fundingGoalWei: string;
    studioName: string;
    studioWallet: string;
    milestones: { name: string; bps: number; payee: 'artist' | 'studio' }[];
  }): Promise<EscrowCampaignCreateResult> {
    return firstValueFrom(this.http.post<EscrowCampaignCreateResult>(`${this.base}/api/escrow/campaign`, payload));
  }

  /** Admin: every milestone-escrow campaign, for the confirm-milestone panel. */
  getEscrowCampaigns(): Promise<{ campaigns: (EscrowCampaignInfo & { assetId: string })[] }> {
    return firstValueFrom(this.http.get<{ campaigns: (EscrowCampaignInfo & { assetId: string })[] }>(`${this.base}/api/escrow/campaigns`));
  }

  /** Admin: Humfiverse confirms a milestone was met, releasing its tranche. */
  confirmEscrowMilestone(campaignId: number, milestoneIndex: number): Promise<{ txHash: string; explorerUrl: string }> {
    return firstValueFrom(this.http.post<{ txHash: string; explorerUrl: string }>(`${this.base}/api/escrow/confirm`, { campaignId, milestoneIndex }));
  }
}
