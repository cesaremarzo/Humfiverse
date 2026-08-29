import { Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ApiService } from './api.service';
import { Asset, Campaign, ContractTemplate, InvestorState, Locale, Portfolio } from './models';
import { SUPPORTED_LOCALES, RTL_LOCALES } from './locales';

import assetsJson from './mock-data/assets.json';
import campaignsJson from './mock-data/campaigns.json';
import portfolioJson from './mock-data/portfolio.json';
import contractTemplateJson from './mock-data/contract-template.json';

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
  readonly backendAvailable = signal(false);

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
  }
}
