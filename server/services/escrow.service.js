"use strict";
/* Everything that mediates between the local escrow cache tables and
   HumfiverseMilestoneEscrow itself. Same rule as onchain.service.js: the
   contract is the source of truth (its own campaignIdByAssetId answers
   "does this asset have a campaign", §2.18), the tables are caches. */

const escrowChain = require("../chainEscrow");
const escrowRepo = require("../data/escrow.repo");
const onchainService = require("./onchain.service");

/** Creates the on-chain milestone escrow campaign for a preproduction
 * asset: registers the studio (if not already registered — keyed by
 * wallet address, since there's no studio-picker UI yet, only a
 * name+wallet field on the onboarding wizard) and creates the campaign
 * with the milestones the wizard collected, each routed to either the
 * artist's or the studio's wallet. */
async function createCampaign(assetId, artistAddress, fundingGoalWei, studioName, studioWallet, milestones) {
  const existingOnchain = await escrowChain.getCampaignInfoByAssetId(assetId);
  if (existingOnchain) throw Object.assign(new Error("asset already has an escrow campaign"), { code: "already_created", record: existingOnchain });

  // §2.42: the campaign now needs an already-minted token id at creation
  // time — contribute() releases tokens from this same pool atomically, so
  // the contract itself requires the token to exist before the campaign
  // can reference it. The frontend now awaits the mint call before this
  // one for exactly this reason (previously these two calls raced).
  const onchainRecord = await onchainService.findTokenWithChainFallback(assetId);
  if (!onchainRecord) throw Object.assign(new Error("asset has no on-chain token yet — mint it before creating a campaign"), { code: "no_token" });

  const studioRow = await escrowRepo.findStudioByWalletAndName(studioWallet, studioName);
  let studioId;
  if (studioRow) {
    studioId = studioRow.studio_id;
  } else {
    const result = await escrowChain.registerStudioOnchain(studioWallet, studioName);
    studioId = result.studioId;
    await escrowRepo.upsertStudio({
      studioId,
      wallet: studioWallet,
      name: studioName,
      txHash: result.txHash,
      createdAt: new Date().toISOString()
    });
  }

  const names = milestones.map((m) => m.name);
  const bps = milestones.map((m) => m.bps);
  const payees = milestones.map((m) => (m.payee === "studio" ? 1 : 0));
  const created = await escrowChain.createCampaignOnchain(artistAddress, fundingGoalWei, studioId, 0, assetId, onchainRecord.token_id, names, bps, payees);

  await escrowRepo.insertCampaign({
    campaignId: created.campaignId,
    assetId,
    studioId,
    studioName,
    studioWallet,
    txHash: created.txHash,
    createdAt: new Date().toISOString()
  });

  return { campaignId: created.campaignId, studioId, txHash: created.txHash };
}

/** §2.39: local table is the primary source (see onchain.service.js
 * listMintedAssetIds for the same pattern applied to catalogue tokens) —
 * a recent-blocks scan only supplements it with campaigns not cached
 * yet. */
async function listCampaigns() {
  const assetIds = new Set(await escrowRepo.listCampaignAssetIds());
  const recent = await escrowChain.listRecentlyCreatedCampaignAssetIdsFromChain();
  if (recent) {
    for (const c of recent) assetIds.add(c.assetId);
  }
  const infos = await Promise.all(
    [...assetIds].map((assetId) => escrowChain.getCampaignInfoByAssetId(assetId).then((info) => info && { escrow: true, assetId, ...info }))
  );
  return infos.filter(Boolean);
}

module.exports = { createCampaign, listCampaigns };
