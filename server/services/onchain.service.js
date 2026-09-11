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

module.exports = { findTokenWithChainFallback, nextFreeTokenId, mintAsset, listMintedAssetIds };
