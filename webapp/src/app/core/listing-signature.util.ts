/**
 * The exact text the seller signs to authorise a resale listing.
 *
 * Must stay byte-for-byte identical to server/lib/listing-signature.js,
 * which rebuilds the same message from the submitted fields and recovers
 * the signing address from it. A single character of drift and every
 * signature stops verifying, so the two are covered by a test that
 * compares their output directly.
 *
 * The wording matters as much as the format: it tells the signer this
 * moves nothing. Signing here proves wallet ownership, it does not lock
 * or transfer tokens — the on-chain listing call that would do that is
 * HumfiverseMarketplace.sol's `list()`, which is written and tested but
 * not deployed. Nobody should sign this thinking their tokens are now
 * committed.
 */
export function buildListingMessage(params: {
  assetId: string;
  seller: string;
  qty: number;
  pricePerToken: number;
  issuedAt: string;
}): string {
  return [
    'Humfiverse — authorise a resale listing',
    '',
    `Asset: ${params.assetId}`,
    `Quantity: ${params.qty}`,
    `Price per token: ${params.pricePerToken}`,
    `Wallet: ${params.seller.toLowerCase()}`,
    `Issued: ${params.issuedAt}`,
    '',
    'Signing proves you own this wallet. It does not move or lock your',
    'tokens — they stay in your wallet and you can transfer them at any',
    'time. This publishes an offer, it does not settle a trade.'
  ].join('\n');
}

export function buildCancelMessage(params: { listingId: string; seller: string; issuedAt: string }): string {
  return [
    'Humfiverse — cancel a resale listing',
    '',
    `Listing: ${params.listingId}`,
    `Wallet: ${params.seller.toLowerCase()}`,
    `Issued: ${params.issuedAt}`
  ].join('\n');
}
