import { Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ApiService } from './api.service';
import { Asset, Campaign, ContractTemplate, InvestorState, Locale, Portfolio, SecondaryListing } from './models';
import { SUPPORTED_LOCALES, RTL_LOCALES } from './locales';

import assetsJson from './mock-data/assets.json';
import campaignsJson from './mock-data/campaigns.json';
import portfolioJson from './mock-data/portfolio.json';
import contractTemplateJson from './mock-data/contract-template.json';
import secondaryListingsJson from './mock-data/secondary-listings.json';

function detectInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem('humfiverse-locale');
    if (saved && (SUPPORTED_LOCALES as string[]).includes(saved)) return saved as Locale;
  } catch {
    /* ignore */
  }
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return (SUPPORTED_LOCALES as string[]).includes(nav) ? (nav as Locale) : 'en';
}

/** Central app state, using signals — the Angular equivalent of the original
 * site's `store` object. Hydrates from the backend when reachable, falling
 * back to the bundled mock data otherwise (same graceful-degradation design
 * as the original `hydrateFromBackend()`). */
@Injectable({ providedIn: 'root' })
export class StoreService {
  readonly assets = signal<Asset[]>(assetsJson as unknown as Asset[]);
  readonly campaigns = signal<Campaign[]>(campaignsJson as unknown as Campaign[]);
  readonly portfolio = signal<Portfolio>(portfolioJson as unknown as Portfolio);
  readonly contractTemplate = signal<ContractTemplate>(contractTemplateJson as unknown as ContractTemplate);
  readonly secondaryListings = signal<SecondaryListing[]>(secondaryListingsJson as unknown as SecondaryListing[]);
  readonly backendAvailable = signal(false);

  /** Every assetId with a real, chain-verified token (technical-architecture.md
   * §2.14) — null while unresolved/unreachable, in which case callers should
   * show the full mock catalogue rather than hide everything (this backend's
   * usual graceful-degradation pattern). Marketplace listings are filtered
   * to this set once it resolves, so an asset only ever appears once it
   * genuinely exists on the testnet. */
  readonly onchainAssetIds = signal<Set<string> | null>(null);

  readonly locale = signal<Locale>(detectInitialLocale());
  readonly theme = signal<'light' | 'dark' | null>(null); // null = follow system
  readonly bannerDismissed = signal(false);
  readonly perspective = signal<'investor' | 'artist'>('investor');

  readonly investor = signal<InvestorState>({
    verified: false,
    classification: null,
    appropriatenessResult: null,
    score: null,
    receiptHash: null
  });

  constructor(
    private api: ApiService,
    private translate: TranslateService
  ) {
    translate.addLangs(SUPPORTED_LOCALES);
    translate.use(this.locale());
    this.updateDocumentDirection(this.locale());
  }

  /** Checks the backend for an existing KYC/appropriateness record for this
   * wallet and, if one exists, marks the investor as verified without
   * making them redo the form (§2.30 — this previously didn't exist at
   * all, so KYC was re-required every session regardless of wallet).
   * Called from app.ts whenever WalletService's connected address changes;
   * `null` (disconnect) resets to unverified rather than leaving a stale
   * verification from a *different* wallet in place. */
  async syncKycForWallet(walletAddress: string | null): Promise<void> {
    if (!walletAddress) {
      this.investor.set({ verified: false, classification: null, appropriatenessResult: null, score: null, receiptHash: null });
      return;
    }
    try {
      const status = await this.api.getKycStatus(walletAddress);
      if (status.verified) {
        this.investor.set({
          verified: true,
          classification: status.classification ?? null,
          appropriatenessResult: status.appropriatenessResult ?? null,
          score: status.score ?? null,
          receiptHash: status.receiptHash ?? null
        });
      } else {
        this.investor.set({ verified: false, classification: null, appropriatenessResult: null, score: null, receiptHash: null });
      }
    } catch {
      /* backend unreachable — leave whatever local state already exists */
    }
  }

  setLocale(locale: Locale): void {
    this.locale.set(locale);
    this.translate.use(locale);
    try {
      localStorage.setItem('humfiverse-locale', locale);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = locale;
    this.updateDocumentDirection(locale);
  }

  private updateDocumentDirection(locale: Locale): void {
    document.documentElement.dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
  }

  assetById(id: string): Asset | undefined {
    return this.assets().find((a) => a.id === id);
  }

  /** Active resale listings for an asset, cheapest first. */
  activeListingsFor(assetId: string): SecondaryListing[] {
    return this.secondaryListings()
      .filter((l) => l.assetId === assetId && l.qty > 0)
      .sort((a, b) => a.pricePerToken - b.pricePerToken);
  }

  /** The platform's displayed "current market price" for an asset: the
   * cheapest active resale listing, or null if nobody is reselling — never
   * an automatically-matched/algorithmic price (see planning doc §7.8). */
  lowestAsk(assetId: string): number | null {
    const listings = this.activeListingsFor(assetId);
    return listings.length ? listings[0].pricePerToken : null;
  }

  async hydrateFromBackend(): Promise<void> {
    try {
      const data = await this.api.getData();
      if (Array.isArray(data.assets) && data.assets.length) this.assets.set(data.assets);
      if (Array.isArray(data.campaigns) && data.campaigns.length) this.campaigns.set(data.campaigns);
      if (data.portfolio) this.portfolio.set(data.portfolio);
      this.backendAvailable.set(true);
    } catch (err) {
      console.warn('Humfiverse backend unavailable — using bundled mock data.', err);
      this.backendAvailable.set(false);
    }
    try {
      const tpl = await this.api.getContractTemplate();
      if (tpl && Array.isArray(tpl.clauses) && tpl.clauses.length) this.contractTemplate.set(tpl);
    } catch {
      /* keep bundled fallback template */
    }
    try {
      const list = await this.api.getOnchainList();
      this.onchainAssetIds.set(new Set(list.assetIds));
    } catch (err) {
      console.warn('Could not load the on-chain listing check — showing the full catalogue unfiltered.', err);
      this.onchainAssetIds.set(null);
    }
  }
}
