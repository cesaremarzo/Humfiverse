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

async function mintAsset(assetId, slug, supply, priceWei, title, artist) {
  const existing = await onchainRepo.findTokenByAssetId(assetId);
  if (existing) throw Object.assign(new Error("asset already has an on-chain token"), { code: "already_minted", record: existing });

  const tokenId = await nextFreeTokenId();
  const result = await chain.mintCatalogueOnchain(tokenId, slug, supply, priceWei, title, artist);
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
  const known = new Set(await onchainRepo.listTokenAssetIds());
  // Same change as escrow.service.js listCampaigns: the scan costs 50
  // sequential RPC round trips (the free-tier eth_getLogs cap is 10
  // blocks), and it was being paid on every page load of the app to look
  // for a mint that this backend itself records as it happens. It now
  // runs only when the table is empty, which is the signature of the
  // cache loss it exists to recover from.
  const recent = known.size ? null : await chain.listRecentlyMintedSlugsFromChain();
  if (recent) {
    for (const m of recent) {
      if (known.has(m.slug)) continue;
      known.add(m.slug);
      try {
        await onchainRepo.insertTokenIfAbsent({
          tokenId: m.tokenId,
          assetId: m.slug,
          slug: m.slug,
          supply: Number(m.supply),
          txHash: m.txHash,
          mintedAt: new Date().toISOString()
        });
      } catch { /* best-effort cache re-seed */ }
    }
  }
  return { source: recent ? "local-table+recent-scan" : "local-table", assetIds: [...known] };
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
