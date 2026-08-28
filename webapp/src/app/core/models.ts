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

export interface YieldBreakdown {
  pct: number;
  trailingRoyalty: number;
  raiseValue: number;
  months: number;
}

export type Locale = 'en' | 'it' | 'es' | 'fr' | 'de';

export interface LocalizedText {
  it: string;
  en: string;
  es: string;
  fr: string;
  de: string;
}

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
