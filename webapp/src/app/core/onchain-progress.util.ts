import { Asset, EscrowCampaignInfo, OnchainInfo } from './models';
import { fundingPct as fundingPctMock } from './format.util';

/** Chain-aware "remaining/sold/funding %" math, shared between the asset
 * detail page and the marketplace listing cards (previously only the
 * detail page had this — the marketplace cards kept reading the static
 * mock a.tokensSold/tokensTotal directly, so a card's progress bar never
 * moved after a real purchase even though the detail page for the same
 * asset showed the correct, updated number). BigInt math kept until the
 * final step to avoid precision loss on wei-scale values. */

function isPre(a: Asset): boolean {
  return a.kind === 'preproduction';
}

export function remainingFor(a: Asset, onchain: OnchainInfo | null, escrow: EscrowCampaignInfo | null): number {
  if (!isPre(a) && onchain?.onchain) {
    return Number(BigInt(onchain.poolBalance));
  }
  if (isPre(a) && escrow?.escrow) {
    const goal = BigInt(escrow.fundingGoal);
    if (goal > 0n) {
      const raised = BigInt(escrow.raised);
      const remainingWei = raised >= goal ? 0n : goal - raised;
      return Number((remainingWei * BigInt(a.tokensTotal)) / goal);
    }
  }
  return a.tokensTotal - a.tokensSold;
}

export function tokensSoldFor(a: Asset, onchain: OnchainInfo | null, escrow: EscrowCampaignInfo | null): number {
  return a.tokensTotal - remainingFor(a, onchain, escrow);
}

export function fundingPctFor(a: Asset, onchain: OnchainInfo | null, escrow: EscrowCampaignInfo | null): number {
  if (isPre(a) && escrow?.escrow) {
    const goal = BigInt(escrow.fundingGoal);
    if (goal > 0n) {
      const raised = BigInt(escrow.raised);
      const bps = raised >= goal ? 10000n : (raised * 10000n) / goal;
      return Number(bps) / 100;
    }
  }
  if (!isPre(a) && onchain?.onchain) {
    const total = BigInt(onchain.totalSupply);
    if (total > 0n) {
      const pool = BigInt(onchain.poolBalance);
      const sold = total > pool ? total - pool : 0n;
      const bps = sold >= total ? 10000n : (sold * 10000n) / total;
      return Number(bps) / 100;
    }
  }
  return fundingPctMock(a);
}

export function fundingRaisedFor(a: Asset, onchain: OnchainInfo | null, escrow: EscrowCampaignInfo | null): number {
  return a.tokenPrice * tokensSoldFor(a, onchain, escrow);
}
