"use strict";
/* Everything that mediates between the local onchain_tokens cache and
   HumfiverseCatalogueToken itself. The rule this whole file exists to
   enforce: the contract is the source of truth, the table is a cache, and
   a cache miss must never be reported to a caller as "no token". */

const chain = require("../chain");
const onchainRepo = require("../data/onchain.repo");

/** Falls back to scanning the chain's own event log and re-seeds the
 * cache so subsequent lookups are fast again. Used by GET
 * /api/onchain/:assetId and by escrow campaign creation — both used to
 * only check the local table directly, which meant a cold cache could
 * wrongly report "no token" for an asset that's actually minted (§2.14,
 * §2.18). */
async function findTokenWithChainFallback(assetId) {
  const record = await onchainRepo.findTokenByAssetId(assetId);
  if (record) return record;

  const fromChain = await chain.listRecentlyMintedSlugsFromChain();
  const match = fromChain && fromChain.find((m) => m.slug === assetId);
  if (!match) return null;

  const mintedAt = new Date().toISOString();
  try {
    await onchainRepo.insertTokenIfAbsent({
      tokenId: match.tokenId,
      assetId,
      slug: match.slug,
      supply: Number(match.supply),
      txHash: match.txHash,
      mintedAt
    });
  } catch { /* best-effort cache re-seed */ }
  return { token_id: match.tokenId, slug: match.slug, tx_hash: match.txHash, minted_at: mintedAt };
}

/* The local table is a hint for where to start looking, not the source of
   truth — see chain.js isTokenIdFree() for why this actually verifies
   on-chain before committing to a token id, rather than trusting the
   local MAX(token_id)+1 alone. */
async function nextFreeTokenId() {
  let candidate = (await onchainRepo.maxTokenId()) + 1;
  while (!(await chain.isTokenIdFree(candidate))) candidate += 1;
  return candidate;
}

/** §2.79: the artist decides the supply and the funding asked of investors;
 * the contract derives the price so every token is worth the same. The
 * checks here are the contract's own, run first so a bad request is a 400
 * rather than a reverted transaction the operator paid gas for. */
async function mintAsset(assetId, slug, supply, fundingUsdc, title, artist, payoutWallet) {
  const existing = await onchainRepo.findTokenByAssetId(assetId);
  if (existing) throw Object.assign(new Error("asset already has an on-chain token"), { code: "already_minted", record: existing });

  const n = Number(supply);
  if (!Number.isSafeInteger(n) || n <= 0) throw Object.assign(new Error("supply must be a whole number above 0"), { code: "invalid" });
  let funding;
  try {
    funding = BigInt(fundingUsdc ?? 0);
  } catch {
    throw Object.assign(new Error("fundingUsdc must be a whole number of USDC base units"), { code: "invalid" });
  }
  if (funding <= 0n) throw Object.assign(new Error("fundingUsdc must be above 0"), { code: "invalid" });
  if (funding / BigInt(n) === 0n) throw Object.assign(new Error("funding is too small to give each token a price"), { code: "invalid" });
  if (payoutWallet && !/^0x[a-fA-F0-9]{40}$/.test(payoutWallet)) throw Object.assign(new Error("payoutWallet is not an address"), { code: "invalid" });

  const tokenId = await nextFreeTokenId();
  const result = await chain.mintCatalogueOnchain(tokenId, slug, n, funding, title, artist, payoutWallet);
  await onchainRepo.insertToken({
    tokenId,
    assetId,
    slug,
    supply,
    txHash: result.txHash,
    mintedAt: new Date().toISOString()
  });
  return result;
}

/** §2.39: the local table is the primary source, not a fallback —
 * full-history event scanning turned out to be impractical on any
 * free-tier RPC (10-block eth_getLogs caps), and a public RPC that
 * silently returns an *incomplete* result for a too-large range (rather
 * than erroring) used to make this route wrongly report "nothing minted"
 * even though the local cache knew better. A bounded recent-blocks scan
 * still runs to catch a brand-new mint that isn't cached yet, merged in
 * and self-healed into the table — but a scan failure or gap can no
 * longer make an already-known asset vanish. */
async function listMintedAssetIds() {
  // §2.78: the local table is the whole answer. This used to re-scan the
  // last ~500 blocks whenever the table was empty and re-insert whatever it
  // found — a recovery path that recovered nothing older than ~100 minutes
  // (§2.55), and that brought deliberately deleted campaigns straight back
  // on the next page load after a cleanup. A single asset the catalogue
  // still knows is recovered by findTokenWithChainFallback.
  return { source: "local-table", assetIds: await onchainRepo.listTokenAssetIds() };
}

/** The full on-chain view of one asset, in the exact shape
 * GET /api/onchain/:assetId returns — so the batch below and the
 * single-asset route can never drift apart in what they report. */
function describeToken(assetId, record, poolInfo) {
  return {
    onchain: true,
    assetId,
    slug: record.slug,
    mintTxHash: record.tx_hash,
    mintedAt: record.minted_at,
    ...poolInfo
  };
}

async function getTokenView(assetId) {
  const record = await findTokenWithChainFallback(assetId);
  if (!record) return { onchain: false };
  return describeToken(assetId, record, await chain.getPoolInfo(record.token_id));
}

/** Many assets in one call, for the cards.
 *
 * The frontend used to ask for these one HTTP request at a time — seven
 * requests on a page with seven campaigns, each doing its own chain read
 * against a single free-tier instance, so the cards sat on placeholder
 * numbers for twenty to thirty seconds. One request now, with the chain
 * reads issued in parallel here.
 *
 * Deliberately reads the local table directly rather than going through
 * findTokenWithChainFallback: that fallback scans the chain on a miss,
 * which is fifty sequential round trips (§2.55), and doing it once per
 * missing asset would put the very cost this endpoint exists to remove
 * back into the batch. An asset with no cached row is simply omitted,
 * which the client reads as unknown rather than as "no token". The
 * single-asset route keeps the fallback, and the client requests any
 * asset it actually opens, so a lost row still heals. */
async function getTokenViews(assetIds) {
  const entries = await Promise.all(
    assetIds.map(async (assetId) => {
      try {
        const record = await onchainRepo.findTokenByAssetId(assetId);
        if (!record) return null;
        return [assetId, describeToken(assetId, record, await chain.getPoolInfo(record.token_id))];
      } catch {
        // One unreadable asset must not fail the whole batch. Omitted,
        // so the client treats it as unknown and keeps its own counter.
        return null;
      }
    })
  );
  return Object.fromEntries(entries.filter(Boolean));
}

module.exports = { findTokenWithChainFallback, nextFreeTokenId, mintAsset, listMintedAssetIds, getTokenView, getTokenViews };
