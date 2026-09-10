"use strict";
/* /api/admin/* — operator-only maintenance, all gated by X-Admin-Key.

   Every route here exists because of a redeploy. When
   HumfiverseCatalogueToken or HumfiverseMilestoneEscrow is redeployed,
   this backend's cache tables still describe tokens, campaigns and studio
   ids that only ever existed on the *previous* contract. These clear the
   affected rows so the affected asset can be re-created against the new
   deploy. None of them touch anything on chain. */

const { sendJson } = require("../lib/http");
const { requireAdmin } = require("../lib/admin-auth");
const catalogueRepo = require("../data/catalogue.repo");
const onchainRepo = require("../data/onchain.repo");
const escrowRepo = require("../data/escrow.repo");
const catalogueService = require("../services/catalogue.service");

module.exports = function registerAdminRoutes(router) {
  /* §2.42: clears the local onchain_tokens/escrow_campaigns cache rows
     for one asset so it can be re-minted against a *new* contract deploy
     — the mint and campaign-creation services both refuse to re-mint an
     assetId with an existing row, which is exactly right for normal
     operation but wrong immediately after a redeploy, where the row
     correctly describes a token that no longer exists on the contract
     this backend now talks to. Does not touch the old contract's
     on-chain state — only this backend's local cache of it. */
  router.delete("/api/admin/onchain-reset/:assetId", async (req, res, { params }) => {
    if (!requireAdmin(req, res)) return;
    const tokenRowDeleted = await onchainRepo.deleteTokenByAssetId(params.assetId);
    const campaignRowDeleted = await escrowRepo.deleteCampaignByAssetId(params.assetId);
    sendJson(res, 200, { ok: true, tokenRowDeleted, campaignRowDeleted });
  });

  /* Strips a fabricated royaltyHistory from an already-stored asset,
     without touching anything else on the record or anything on-chain.
     Exists because the onboarding wizard used to synthesize a fake
     royalty history for every catalogue-kind campaign — a real campaign
     with no real distribution history yet showing a fabricated "72%
     projected yield" straight out of a random-number generator. The
     wizard no longer does this; this endpoint is for cleaning up rows
     created before that fix. */
  router.delete("/api/admin/royalty-history/:assetId", async (req, res, { params }) => {
    if (!requireAdmin(req, res)) return;
    const asset = await catalogueRepo.findAssetById(params.assetId);
    if (!asset) {
      sendJson(res, 404, { error: "no asset with this id" });
      return;
    }
    await catalogueService.stripRoyaltyHistory(asset);
    sendJson(res, 200, { ok: true, assetId: params.assetId });
  });

  /* §2.42: the escrow_studios table caches wallet+name -> on-chain
     studioId to skip a redundant registration transaction — but that
     studioId is only valid against the escrow contract it was registered
     on. After redeploying HumfiverseMilestoneEscrow, every cached id is
     stale (studio ids restart from 1 on the new contract), so campaign
     creation would silently reuse the wrong id instead of registering
     fresh. Clearing the whole table is safe either way —
     registerStudioOnchain is just an extra tx if it turns out to be
     unnecessary, never incorrect. */
  router.delete("/api/admin/escrow-studios-reset", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    await escrowRepo.clearStudios();
    sendJson(res, 200, { ok: true });
  });
};
