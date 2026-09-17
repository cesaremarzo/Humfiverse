/** The platform's fees on the primary market, in basis points, each
 * mirroring a constant in the contract that charges it. They are deducted
 * from what the investor pays, never added on top: the investor pays the
 * listed price and receives every token.
 *
 * The two rates differ on purpose (§2.101), and the difference is the whole
 * reason they are separate constants here: before it, one `PRIMARY_FEE_BPS`
 * stood for both, and raising the direct-sale rate alone would silently have
 * resized every escrow tranche in the wizard.
 *
 * - PRIMARY_FEE_BPS — HumfiverseCatalogueToken.buy(), a catalogue that
 *   already earns, sold outright. 6% is all the platform ever charges on
 *   that raise; there are no tranches to charge on later.
 * - CONTRIBUTION_FEE_BPS — HumfiverseMilestoneEscrow.contribute(). 2% on
 *   arrival, then 3% again on each tranche the escrow releases (see
 *   MILESTONE_FEE_BPS in campaign-draft.util.ts): 4.94% of a goal that sells
 *   out and releases in full. Not refunded if the campaign is cancelled.
 */
export const PRIMARY_FEE_BPS = 600;
export const CONTRIBUTION_FEE_BPS = 200;

/** HumfiverseCatalogueToken.ROYALTY_FEE_BPS: what the platform keeps of a
 * royalty deposit for running the distribution. Deducted before the deposit
 * is shared out, so the holders share 99% of it (§2.101). */
export const ROYALTY_FEE_BPS = 100;

function feeUsd(totalUsd: number, bps: number): number {
  const totalCents = Math.round(totalUsd * 100);
  return Math.floor((totalCents * bps) / 10_000) / 100;
}

/** The fee included in a direct catalogue purchase of `totalUsd`, rounded
 * down to the cent as the contracts round down to the USDC base unit. */
export function primaryFeeUsd(totalUsd: number): number {
  return feeUsd(totalUsd, PRIMARY_FEE_BPS);
}

/** The fee included in a campaign contribution of `totalUsd`. */
export function contributionFeeUsd(totalUsd: number): number {
  return feeUsd(totalUsd, CONTRIBUTION_FEE_BPS);
}

/** The platform's share of a royalty deposit of `totalUsd`. */
export function royaltyFeeUsd(totalUsd: number): number {
  return feeUsd(totalUsd, ROYALTY_FEE_BPS);
}
