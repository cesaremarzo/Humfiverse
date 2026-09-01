export type AssetKind = 'catalogue' | 'preproduction';
export type DisclosureLevel = 'human' | 'ai-assisted' | 'ai' | 'pending' | 'n/a';

export interface RoyaltyMonth {
  month: string;
  royaltyUSD: number;
}

export interface AiDisclosure {
  vocals: DisclosureLevel;
  instrumentation: DisclosureLevel;
  composition: DisclosureLevel;
  postProduction: DisclosureLevel;
  lyrics: DisclosureLevel;
}

export interface AssetDocument {
  name: string;
  type: string;
  date: string;
}

export interface Milestone {
  name: string;
  trancheAmount: number;
  status: 'active' | 'pending' | 'done';
}

export interface Asset {
  id: string;
  kind: AssetKind;
  title: string;
  artistName: string;
  genre: string;
  description: string;
  verified: boolean;
  tokenPrice: number;
  tokensTotal: number;
  tokensSold: number;
  royaltyHistory?: RoyaltyMonth[];
  targetRaiseUse?: string;
  aiDisclosure: AiDisclosure;
  dspPolicy: string;
  riskFactors: string[];
  documents: AssetDocument[];
  milestones?: Milestone[];
  status: 'funding' | 'sold-out';
}

export interface Campaign {
  id: string;
  assetId: string;
  title: string;
  artistName: string;
  holders: number;
  milestones?: Milestone[];
}

export interface Holding {
  assetId: string;
  tokens: number;
  costBasis: number;
  unclaimed: number;
}

export interface Distribution {
  date: string;
  assetId: string;
  amount: number;
}

export interface Portfolio {
  holdings: Holding[];
  distributions: Distribution[];
}

/** A resale (secondary-market) listing — the display/state-management
 * counterpart of HumfiverseMarketplace.sol's on-chain Listing struct. The
 * platform's "current market price" for an asset is the lowest active
 * listing's pricePerToken (see StoreService.lowestAsk), not an
 * automatically-updating/matched price. */
export interface SecondaryListing {
  id: string;
  assetId: string;
  seller: string;
  qty: number;
  pricePerToken: number;
}

export interface YieldBreakdown {
  pct: number;
  trailingRoyalty: number;
  raiseValue: number;
  months: number;
}

export type Locale = 'en' | 'it' | 'es' | 'fr' | 'de' | 'ru' | 'ja' | 'zh' | 'ar';

export type LocalizedText = Partial<Record<Locale, string>>;

export interface ContractClauseI18n {
  title: string;
  body: string;
}

export interface ContractClause {
  id: string;
  vessatoria: boolean;
  vessatoriaCategory?: LocalizedText;
  i18n: Record<Locale, ContractClauseI18n>;
}

export interface ContractTemplate {
  version: string;
  title: LocalizedText;
  note: LocalizedText;
  legalBasisNote: LocalizedText;
  authoritativeLanguage: Locale;
  clauses: ContractClause[];
}

export interface WalletState {
  address: string | null;
  chainId: string | null;
  connecting: boolean;
}

export interface InvestorState {
  verified: boolean;
  classification: 'retail' | 'professional' | null;
  appropriatenessResult: 'appropriate' | 'warning' | null;
  score: number | null;
  receiptHash: string | null;
}

export interface KycAnswers {
  priorComplexInvestments: boolean | null;
  familiarWithIlliquidInstruments: boolean | null;
  understandsCapitalLossRisk: boolean | null;
  yearsExperience: '0' | '1-3' | '3+' | null;
}

export interface KycResult {
  verified: boolean;
  classification: 'retail' | 'professional';
  appropriatenessResult: 'appropriate' | 'warning';
  score: number;
  receiptHash: string;
}

export interface ContractAcceptanceResult {
  receiptHash: string;
  acceptedAt: string;
  templateVersion: string;
}

export interface RedeemResult {
  amount: number;
  txHash: string;
  portfolio: Portfolio;
}

export interface BackendData {
  assets: Asset[];
  campaigns: Campaign[];
  portfolio: Portfolio;
}

/** Live on-chain data for an asset's HumfiverseCatalogueToken — see
 * server/chain.js. `onchain: false` means this asset has no on-chain token
 * yet (shouldn't normally happen post-§2.14: every asset gets one at
 * creation, catalogue and preproduction alike). */
export type OnchainInfo =
  | { onchain: false }
  | {
      onchain: true;
      assetId: string;
      slug: string;
      mintTxHash: string;
      mintedAt: string;
      tokenId: number;
      contractAddress: string;
      network: string;
      explorerUrl: string;
      poolBalance: string;
      totalSupply: string;
      released: string;
      /** Wei per token for the public HumfiverseCatalogueToken.buy() path —
       * "0" means the catalogue isn't open for real on-chain purchase yet. */
      priceWei: string;
      /** Title/artist read straight from the contract's own trackTitle()/
       * artistName() view functions (§2.24) — proof this isn't just the
       * off-chain database's copy of the name. */
      onchainTitle: string;
      onchainArtist: string;
    };

export interface OnchainMintResult {
  tokenId: number;
  txHash: string;
  contractAddress: string;
  explorerUrl: string;
}

/** A single tranche of a preproduction campaign's milestone escrow — see
 * contracts/contracts/HumfiverseMilestoneEscrow.sol and
 * planning/technical-architecture.md §2.15. */
export interface EscrowMilestone {
  index: number;
  name: string;
  bps: number;
  payee: 'artist' | 'studio';
  released: boolean;
  amountWei: string;
}

/** Live on-chain state for a preproduction asset's milestone escrow
 * campaign. `escrow: false` means this asset has no escrow campaign yet. */
export type EscrowCampaignInfo =
  | { escrow: false }
  | {
      escrow: true;
      assetId: string;
      campaignId: number;
      contractAddress: string;
      network: string;
      explorerUrl: string;
      artist: string;
      studioId: number;
      studio: { name: string; wallet: string; active: boolean } | null;
      fundingGoal: string;
      raised: string;
      deadline: number;
      status: 'active' | 'cancelled';
      releasedBps: number;
      milestones: EscrowMilestone[];
    };

export interface EscrowCampaignCreateResult {
  campaignId: number;
  studioId: number;
  txHash: string;
}
