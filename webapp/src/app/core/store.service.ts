import { Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ApiService } from './api.service';
import { Asset, Campaign, ContractTemplate, EscrowCampaignInfo, InvestorState, Locale, OnchainInfo, Portfolio, SecondaryListing } from './models';
import { SUPPORTED_LOCALES, RTL_LOCALES } from './locales';
import { retrying } from './retry.util';

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
  /** Bundled rows are the offline seed only. Once the backend answers,
   * its list replaces them outright — including when it answers with
   * nothing, because three fictional offers are worse than an honest
   * empty board. Until these were persisted server-side, a listing lived
   * in the creating tab's memory and was gone on the next reload. */
  readonly secondaryListings = signal<SecondaryListing[]>(secondaryListingsJson as unknown as SecondaryListing[]);
  readonly backendAvailable = signal(false);

  /** Every assetId with a real, chain-verified token (technical-architecture.md
   * §2.14) — null while unresolved/unreachable, in which case callers should
   * show the full mock catalogue rather than hide everything (this backend's
   * usual graceful-degradation pattern). Marketplace listings are filtered
   * to this set once it resolves, so an asset only ever appears once it
   * genuinely exists on the testnet. */
  readonly onchainAssetIds = signal<Set<string> | null>(null);
  /** True until the first `/api/onchain/list` call settles (success or
   * failure) — §2.41. `onchainAssetIds` starting at `null` is meant to
   * distinguish "still loading" from "genuinely unreachable" for callers
   * that want the mock-catalogue fallback in the unreachable case, but on
   * every normal page load it's briefly null too, before the very first
   * request resolves — without this flag, the marketplace showed the full
   * 6-track mock catalogue for that ~1s window before snapping to the 2
   * real assets, a visible flash of wrong content the user caught live. */
  readonly onchainListLoading = signal(true);

  /** Per-asset real pool/escrow state, keyed by assetId (§2.40) — used by
   * both the asset-detail page and the marketplace listing cards so a
   * card's funding bar reflects real purchases instead of the static mock
   * tokensSold count, which never changes after a real on-chain buy. */
  readonly onchainInfoMap = signal<Map<string, OnchainInfo>>(new Map());
  /** True until the batched pool read has come back. The cards read it so
   * they can show a placeholder instead of a confident zero they are about
   * to replace — the failure mode that made several real bugs in this
   * project so hard to tell apart from a slow page. */
  readonly onchainInfoLoading = signal(true);
  readonly escrowInfoMap = signal<Map<string, EscrowCampaignInfo>>(new Map());

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

  /** The two lookups every card needs before it can show real funding
   * progress instead of the mock `tokensSold` counter. Both maps are
   * populated once during hydrate(); a miss means this asset has no
   * chain state to read, which the progress helpers handle by falling
   * back. Here rather than repeated at each call site, because getting
   * the `?? null` wrong turns a miss into `undefined` and silently
   * changes which branch the helper takes. */
  onchainFor(assetId: string): OnchainInfo | null {
    return this.onchainInfoMap().get(assetId) ?? null;
  }
  escrowFor(assetId: string): EscrowCampaignInfo | null {
    return this.escrowInfoMap().get(assetId) ?? null;
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

  /** Re-pulls the offer board after any write, so the portfolio, the
   * campaign page and the marketplace all see the same thing without
   * each maintaining its own copy. */
  async refreshListings(): Promise<void> {
    try {
      const result = await this.api.getListings();
      this.secondaryListings.set(result.listings ?? []);
    } catch (err) {
      console.warn('Could not refresh resale listings.', err);
    }
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
    /* Three independent loads, each publishing its own signal the moment
       it lands. They used to be chained, and then joined with a single
       Promise.all that set both maps only once *both* had resolved — so
       the slowest one gated every card in the app. Measured on the live
       backend: GET /api/escrow/campaigns took 200s on a cold instance and
       31s warm, because it runs a chain scan plus a read per campaign. For
       that whole time the artist dashboard showed "TOTAL RAISED $0" and
       every campaign at 0%, with the pool data already sitting fetched and
       unused. The per-asset reads also waited on GET /api/onchain/list,
       another chain scan, for asset ids that GET /api/data had already
       returned. Nothing here needs to wait for anything else. */
    const knownAssetIds = this.assets().map((a) => a.id);

    const listLoad = this.api
      .getOnchainList()
      .then((list) => this.onchainAssetIds.set(new Set(list.assetIds)))
      .catch((err) => {
        console.warn('Could not load the on-chain listing check — showing the full catalogue unfiltered.', err);
        this.onchainAssetIds.set(null);
      })
      .finally(() => this.onchainListLoading.set(false));

    // §2.40: each asset's real pool state, so every card shows a real,
    // moving funding bar instead of the static mock count. A read that
    // fails is left *out* of the map rather than recorded as
    // `{ onchain: false }`: the two are not the same claim, and the second
    // one says this asset has no token, which is what lets the funding
    // helpers fall back to the escrow's ETH ratio and print a precise
    // wrong number. An absent entry reads as unknown, which is the truth.
    /* One request for every asset, not one per asset. Seven separate
       requests, each doing its own chain read against a single free-tier
       instance, kept the cards on placeholder numbers for twenty to
       thirty seconds. An asset missing from the response is left out of
       the map: absent reads as unknown, which is what it is, and is not
       the same claim as `{ onchain: false }`. */
    const onchainLoad = (knownAssetIds.length ? retrying(() => this.api.getOnchainBatch(knownAssetIds)) : Promise.resolve({ tokens: {} }))
      // `result.tokens ?? {}` guards the window between the two deploys:
      // GitHub Pages publishes in a minute, Render takes several, and a
      // backend that predates this endpoint answers the same URL from
      // /api/onchain/:assetId with `{ onchain: false }` and a 200. Without
      // the guard that is a TypeError on every page load until the backend
      // catches up. It recurs on every release, not just this one.
      .then((result) => this.onchainInfoMap.set(new Map(Object.entries(result?.tokens ?? {}))))
      .catch((err) => console.warn('Could not load per-asset on-chain state for the cards.', err))
      .finally(() => this.onchainInfoLoading.set(false));

    const listingsLoad = this.api
      .getListings()
      .then((result) => this.secondaryListings.set(result.listings ?? []))
      .catch((err) => console.warn('Could not load resale listings — showing the bundled sample instead.', err));

    const escrowLoad = this.api
      .getEscrowCampaigns()
      .then((result) => this.escrowInfoMap.set(new Map(result.campaigns.map((c) => [c.assetId, c] as const))))
      .catch((err) => console.warn('Could not load escrow campaign state for the cards.', err));

    await Promise.allSettled([listLoad, onchainLoad, escrowLoad, listingsLoad]);
  }
}
