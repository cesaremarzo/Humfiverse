/** USDC amounts (§2.73). Every price, contribution, payout and fee on the
 * live contracts is in USDC base units — 6 decimals, 1,000,000 = $1 — and
 * so is every amount the backend returns, including the legacy ETH-era
 * escrow's, which the backend converts before sending. A dollar amount to
 * the cent is always an exact integer here, so nothing rounds.
 *
 * This replaced an illustrative 0.0001 ETH = $1 mapping, under which the
 * displayed dollars were a made-up conversion of wei and fees carried 18
 * decimals the screen then truncated. */
const UNITS_PER_CENT = 10_000n;

export function usdcToUsd(units: string | bigint): number {
  return Number(BigInt(units)) / 1_000_000;
}

/** Dollars to base units, rounded to the cent — the finest amount any input
 * in this app accepts. */
export function usdToUsdc(usd: number): bigint {
  return BigInt(Math.round(usd * 100)) * UNITS_PER_CENT;
}
