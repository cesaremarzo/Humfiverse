import { Holding, Portfolio } from './models';

/**
 * Adds tokens to a wallet's position in one asset, creating the holding if
 * this is the first purchase of it. Returns a new Portfolio; the one passed
 * in is never modified.
 *
 * Both purchase paths on the asset-detail page used to inline this, and both
 * did it by mutating the matched Holding in place before spreading the array
 * around it. That worked only because the spread produced a new array
 * reference for the signal to notice — the same shape as the real bug the
 * comment in applyPurchase() warns about for `assets`, left in place for
 * `holdings`. Rebuilding the row instead of mutating it removes the trap
 * without changing a single displayed number.
 */
export function addHolding(portfolio: Portfolio, entry: { assetId: string; tokens: number; costBasis: number }): Portfolio {
  const existing = portfolio.holdings.find((h) => h.assetId === entry.assetId);
  const holdings: Holding[] = existing
    ? portfolio.holdings.map((h) =>
        h.assetId === entry.assetId ? { ...h, tokens: h.tokens + entry.tokens, costBasis: h.costBasis + entry.costBasis } : h
      )
    : [...portfolio.holdings, { assetId: entry.assetId, tokens: entry.tokens, costBasis: entry.costBasis, unclaimed: 0 }];
  return { ...portfolio, holdings };
}
