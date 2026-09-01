import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Asset,
  BackendData,
  Campaign,
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

  /** Persists a campaign the onboarding wizard just created, so it's in
   * GET /api/data for every visitor, not just the tab that created it. */
  createAsset(payload: { asset: Asset; campaign?: Campaign }): Promise<{ ok: true; id: string }> {
    return firstValueFrom(this.http.post<{ ok: true; id: string }>(`${this.base}/api/assets`, payload));
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

  /** Whether this wallet has already completed KYC/appropriateness on a
   * past visit — a wallet that already has, shouldn't have to redo it
   * (§2.30). `{ verified: false }` if it never has. */
  getKycStatus(walletAddress: string): Promise<KycResult> {
    return firstValueFrom(this.http.get<KycResult>(`${this.base}/api/kyc/status/${encodeURIComponent(walletAddress)}`));
  }

  health(): Promise<{ ok: boolean }> {
    return firstValueFrom(this.http.get<{ ok: boolean }>(`${this.base}/api/health`));
  }

  getOnchainInfo(assetId: string): Promise<OnchainInfo> {
    return firstValueFrom(this.http.get<OnchainInfo>(`${this.base}/api/onchain/${encodeURIComponent(assetId)}`));
  }

  mintOnchainToken(payload: { assetId: string; slug: string; supply: number; priceWei?: string; title?: string; artist?: string }): Promise<OnchainMintResult> {
    return firstValueFrom(this.http.post<OnchainMintResult>(`${this.base}/api/onchain/mint`, payload));
  }

  /** Every assetId with a real, chain-verified token — see StoreService.onchainAssetIds. */
  getOnchainList(): Promise<{ source: 'chain' | 'local-table'; assetIds: string[] }> {
    return firstValueFrom(this.http.get<{ source: 'chain' | 'local-table'; assetIds: string[] }>(`${this.base}/api/onchain/list`));
  }

  /** Real token holdings for a wallet (§2.37) — replaces the fictional
   * Portfolio.holdings mock data, which was never tied to any actual
   * wallet. Scanned live off the chain, not cached. */
  getRealPortfolio(walletAddress: string): Promise<{
    holdings: { assetId: string; tokenId: number; tokens: number; priceWei: string; title: string; artist: string }[];
  }> {
    return firstValueFrom(
      this.http.get<{ holdings: { assetId: string; tokenId: number; tokens: number; priceWei: string; title: string; artist: string }[] }>(
        `${this.base}/api/portfolio/${encodeURIComponent(walletAddress)}`
      )
    );
  }

  /** Releases the contributor's matching token share from the pool right
   * after a real preproduction contribution (§2.34) — contribute() on the
   * escrow contract never touches the token pool on its own. Verified
   * server-side against the contribution's own on-chain event, not this
   * call's own claims. */
  releaseForContribution(assetId: string, txHash: string): Promise<{ released: boolean; qty: number; releaseTxHash: string | null }> {
    return firstValueFrom(
      this.http.post<{ released: boolean; qty: number; releaseTxHash: string | null }>(`${this.base}/api/onchain/release-for-contribution`, { assetId, txHash })
    );
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

  /** Admin (read-only, §2.27): every milestone-escrow campaign and its
   * dual sign-off state. Humfiverse has no confirm action to take here
   * anymore — release requires the artist's and the studio's own wallets,
   * see WalletService.confirmMilestoneAsArtist/confirmMilestoneAsStudio. */
  getEscrowCampaigns(): Promise<{ campaigns: (EscrowCampaignInfo & { assetId: string })[] }> {
    return firstValueFrom(this.http.get<{ campaigns: (EscrowCampaignInfo & { assetId: string })[] }>(`${this.base}/api/escrow/campaigns`));
  }
}
