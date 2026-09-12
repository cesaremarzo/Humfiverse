import { EscrowCampaignInfo, Milestone } from './models';
import { weiToUsd } from './usd-eth.util';

/**
 * The milestone track, built from the escrow contract rather than the
 * stored copy.
 *
 * `Asset.milestones[].status` is written as `'pending'` by the onboarding
 * wizard and updated by nothing — not when a milestone is confirmed, not
 * when its tranche is released. So the progress bar sat empty for every
 * campaign forever, including Guns, where three of four tranches have
 * genuinely been paid out. Same shape as `tokensSold` and
 * `Campaign.holders`: a field that looks like state and is really a
 * constant.
 *
 * The contract knows the truth and the page already fetches it. Statuses
 * map from what it reports:
 *   released              -> done
 *   one side confirmed    -> active (waiting on the other signature)
 *   neither confirmed     -> pending
 *
 * Amounts come from the chain too (`amountWei`), since the stored
 * `trancheAmount` was computed at creation from the goal and would drift
 * from what the contract actually pays if either ever changed.
 *
 * Falls back to the stored list when there is no escrow to read — a
 * catalogue campaign without one has no on-chain milestones at all, and
 * the stored names and amounts are still the best available.
 */
export function milestonesWithOnchainStatus(
  stored: Milestone[] | undefined,
  escrow: EscrowCampaignInfo | null
): Milestone[] {
  if (!escrow?.escrow || !escrow.milestones?.length) return stored ?? [];

  return escrow.milestones.map((m) => ({
    name: m.name,
    trancheAmount: weiToUsd(m.amountWei),
    status: m.released ? 'done' : m.artistConfirmed || m.studioConfirmed ? 'active' : 'pending'
  }));
}
