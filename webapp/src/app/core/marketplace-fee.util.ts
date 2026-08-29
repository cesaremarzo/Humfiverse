/** Secondary-sale platform fee: 1% of the tokens traded (not the sale
 * proceeds), mirroring HumfiverseMarketplace.sol's PLATFORM_FEE_BPS. This
 * only ever applies to resale — a first purchase only ever happens via the
 * platform pool (fee-free), never through a listing. */
export const PLATFORM_FEE_BPS = 100;
const BPS_DENOMINATOR = 10_000;

export function platformFeeTokens(qty: number): number {
  return Math.floor((qty * PLATFORM_FEE_BPS) / BPS_DENOMINATOR);
}
