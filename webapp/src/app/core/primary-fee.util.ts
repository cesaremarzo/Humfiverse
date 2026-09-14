/** Primary-purchase platform fee (§2.72): 2% of what an investor pays for
 * tokens on the primary market — a catalogue buy() or a campaign
 * contribution — deducted from that payment, never added on top. The
 * investor pays the listed price and receives every token; the campaign
 * escrow or the rights holder receives 98%. Mirrors PRIMARY_FEE_BPS on
 * HumfiverseCatalogueToken and CONTRIBUTION_FEE_BPS on
 * HumfiverseMilestoneEscrow. Not refunded if a campaign is cancelled. */
export const PRIMARY_FEE_BPS = 200;

/** The fee included in a primary purchase of `totalUsd`, rounded down to
 * the cent as the contracts round down to the wei. */
export function primaryFeeUsd(totalUsd: number): number {
  const totalCents = Math.round(totalUsd * 100);
  return Math.floor((totalCents * PRIMARY_FEE_BPS) / 10_000) / 100;
}
