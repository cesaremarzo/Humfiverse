/** Secondary-sale platform fee: 1% of the payment, mirroring
 * HumfiverseMarketplace.sol's PLATFORM_FEE_BPS (§2.71). The buyer receives
 * every token; the seller receives the price less this. Only ever applies to
 * resale — a first purchase comes from the platform pool, never a listing.
 *
 * Until §2.71 the contract took 1% of the *tokens* instead, which rounded to
 * nothing on any trade under 100 tokens. */
export const PLATFORM_FEE_BPS = 100;
const BPS_DENOMINATOR = 10_000;

/** Exactly what the contract retains, rounded down to the USDC base unit as it does. */
export function platformFeeUsdc(payment: bigint): bigint {
  return (payment * BigInt(PLATFORM_FEE_BPS)) / BigInt(BPS_DENOMINATOR);
}

/** A preview for a price typed in dollars, rounded down to the cent as the
 * contract rounds down to the base unit. */
export function platformFeeUsd(totalUsd: number): number {
  const totalCents = Math.round(totalUsd * 100);
  return Math.floor((totalCents * PLATFORM_FEE_BPS) / BPS_DENOMINATOR) / 100;
}
