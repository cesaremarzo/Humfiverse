export type AssetKind = 'catalogue' | 'preproduction';
export type DisclosureLevel = 'human' | 'ai-assisted' | 'ai' | 'pending' | 'n/a';

export interface RoyaltyMonth {
  month: string;
  royaltyUSD: number;
  /** Wallet that submitted this entry, if any — an audit trail, not
   * authorization; see server.js's /api/assets/:id/royalty-report. */
  reportedBy?: string;
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
  /** Catalogue-only, collected by the onboarding wizard: which distributor
   * or PRO the artist says reports this track's royalties, and how many
   * months of history they say exists. Both are artist-declared provenance
   * for royaltyHistory above and are never verified — shown beside the
   * reported figures so a reader can see where the numbers are meant to
   * come from, and how much of what was claimed has actually been entered.
   * Until this existed the wizard collected both and then discarded them. */
  royaltySource?: string;
  royaltyHistoryMonths?: number;
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
  /** Absent when `verified` is false — e.g. GET /api/kyc/status/:wallet for
   * a wallet that has never completed KYC (§2.30). */
  classification?: 'retail' | 'professional';
  appropriatenessResult?: 'appropriate' | 'warning';
  score?: number;
  receiptHash?: string;
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
      /** ipfs://<cid> for the uploaded track's audio, or "" if none has
       * been linked yet — see HumfiverseCatalogueToken.trackAudioUri
       * (§2.43). Source of truth is the contract itself, not this API
       * response. */
      audioUri: string;
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
  /** Dual sign-off state (§2.27) — a milestone releases only once both are
   * true. Humfiverse has no function that can set either of these itself;
   * they're only ever set by the artist's/studio's own wallet transaction. */
  artistConfirmed: boolean;
  studioConfirmed: boolean;
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

/** GET /api/portfolio/:wallet's per-holding shape (§2.37/§2.39, extended
 * for the portfolio value dashboard). poolBalance/totalSupply — both plain
 * on-chain state reads already made for this same response — tell the
 * dashboard whether this asset's primary sale is still open, which is
 * half of the "lowest available price" valuation in core/token-value.util.ts. */
export interface RealHoldingDto {
  assetId: string;
  tokenId: number;
  tokens: number;
  priceWei: string;
  title: string;
  artist: string;
  poolBalance: string;
  totalSupply: string;
}
