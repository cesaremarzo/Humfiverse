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
  // The token pool's own balance is the real, hard constraint on how many
  // more tokens *any* purchase path (buy() or contribute() — both release
  // from this same pool atomically, §2.42) can actually deliver, for a
  // catalogue or a preproduction campaign alike — prefer it whenever it's
  // available, before ever falling back to the escrow's own raised/goal
  // ratio. That ratio only reflects contributions that went through
  // contribute() on the *current* contract; tokens released other ways —
  // most notably the manual re-releases this project has done to make a
  // real holder whole after every contract redeploy (see
  // planning/technical-architecture.md §2.36/§2.42/§2.43) — never touch
  // escrow.raised at all. For Guns specifically that gap is 45 tokens
  // (poolBalance 1255 vs. tokensTotal 1300): the escrow-ratio formula
  // advertised the full 1300 as purchasable, and a buy for the max the UI
  // itself offered would revert every time, since the token contract
  // simply doesn't have that many left to release.
  if (onchain?.onchain) {
    return Number(BigInt(onchain.poolBalance));
  }
  // `null` and `{ onchain: false }` are not the same answer and must not
  // be treated alike. `null` means the read hasn't come back yet — the
  // page is still loading, or this asset isn't in the store's map. Only
  // `{ onchain: false }` means "asked, and there is no token", which is
  // the single case where the escrow's ETH ratio is the best available
  // measure. Falling back to it while the answer is merely unknown put
  // the pre-fix number back on screen for the length of the request: on
  // Guns, 96.53% and "1,255/1,300", flipping to 100% and "1,300/1,300"
  // once the pool balance arrived. On a cold Render instance that window
  // is seconds long, which is quite long enough to read and report.
  if (onchain && !onchain.onchain && isPre(a) && escrow?.escrow) {
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

/** The percentage form of tokensSoldFor()/a.tokensTotal — deliberately
 * derived from the same two numbers the UI prints beside it, so the bar
 * can never contradict the "X/Y tokens" tile or the USD raised figure.
 *
 * This used to compute a preproduction campaign's percentage from the
 * escrow's own raised/fundingGoal ratio instead, which is a different
 * measurement: ETH that arrived through contribute() on the current
 * contract. Tokens that left the pool any other way never touch `raised`
 * — most of all the manual releaseFromPool re-issues this project runs
 * after every contract redeploy to make real holders whole (§2.36/§2.42/
 * §2.43). remainingFor() above was fixed to prefer the real pool balance
 * for exactly that reason; this function was not, so the two drifted
 * apart by precisely the number of manually released tokens.
 *
 * Guns is what surfaced it: 45 of its 1,300 tokens were re-released by
 * hand, so once the remaining 1,255 had genuinely sold, the page showed
 * "1,300/1,300 tokens", "0 remaining" and "$13,000 of $13,000 raised"
 * next to a bar reading 96.53%. Black Sail had the mirror image — 9
 * tokens out and $90 raised against a bar reading 0%.
 *
 * The escrow ratio stays as the fallback for a preproduction campaign
 * with no on-chain token data to read, and the mock counter below that. */
export function fundingPctFor(a: Asset, onchain: OnchainInfo | null, escrow: EscrowCampaignInfo | null): number {
  if (onchain?.onchain && a.tokensTotal > 0) {
    const sold = tokensSoldFor(a, onchain, escrow);
    // Truncated to two decimals, matching the basis-point division this
    // replaced, and clamped: the value drives a CSS width, and a local
    // asset record that disagrees with the chain must not produce a
    // negative or overflowing bar.
    const bps = Math.floor((sold * 10000) / a.tokensTotal);
    return Math.min(100, Math.max(0, bps / 100));
  }
  // Same gate as remainingFor above, and it has to be the same: these two
  // are printed side by side, so a fallback one takes and the other
  // doesn't is how they contradicted each other in the first place.
  if (onchain && !onchain.onchain && isPre(a) && escrow?.escrow) {
    const goal = BigInt(escrow.fundingGoal);
    if (goal > 0n) {
      const raised = BigInt(escrow.raised);
      const bps = raised >= goal ? 10000n : (raised * 10000n) / goal;
      return Number(bps) / 100;
    }
  }
  return fundingPctMock(a);
}

export function fundingRaisedFor(a: Asset, onchain: OnchainInfo | null, escrow: EscrowCampaignInfo | null): number {
  return a.tokenPrice * tokensSoldFor(a, onchain, escrow);
}
