"use strict";
/* /api/data and everything under /api/assets — the public catalogue
   surface: what the app loads at boot, what the onboarding wizard writes,
   and the self-reported royalty figures an asset accumulates afterwards. */

const { sendJson, readBody } = require("../lib/http");
const { requireAdmin } = require("../lib/admin-auth");
const catalogueRepo = require("../data/catalogue.repo");
const portfolioRepo = require("../data/portfolio.repo");
const catalogueService = require("../services/catalogue.service");

module.exports = function registerCatalogueRoutes(router) {
  /* The app-boot aggregate: one round trip instead of three, since the
     frontend needs all of it before it can render anything. */
  router.get("/api/data", async (req, res) => {
    const [assets, campaigns, portfolio] = await Promise.all([
      catalogueRepo.listAssets(),
      catalogueRepo.listCampaigns(),
      portfolioRepo.getSimulatedPortfolio()
    ]);
    sendJson(res, 200, { assets, campaigns, portfolio });
  });

  /* Persists a campaign the onboarding wizard just created, so it shows
     up in GET /api/data for every visitor, not just the browser tab that
     created it — previously this only ever updated that one tab's local
     signal, so a new campaign vanished on refresh even though its
     on-chain token/escrow are real and permanent. See
     planning/technical-architecture.md §2.20. No auth here, consistent
     with every other write endpoint in this prototype backend (KYC,
     contract acceptance, on-chain mint/escrow all have the same trust
     model) — a real launch would need to gate this behind whatever
     authenticates "artist" sessions. */
  router.post("/api/assets", async (req, res) => {
    try {
      const body = await readBody(req);
      const asset = body.asset;
      if (!asset || !asset.id || !asset.title || !asset.kind) {
        sendJson(res, 400, { error: "asset.id, asset.title and asset.kind are required" });
        return;
      }
      if (await catalogueRepo.findAssetById(asset.id)) {
        sendJson(res, 409, { error: "an asset with this id already exists" });
        return;
      }
      await catalogueRepo.insertAsset(asset);
      if (body.campaign && body.campaign.id) {
        await catalogueRepo.insertCampaignIfAbsent(body.campaign);
      }
      sendJson(res, 200, { ok: true, id: asset.id });
    } catch (e) {
      if (e instanceof SyntaxError) {
        sendJson(res, 400, { error: "malformed JSON body" });
      } else if (e.code === "too_large") {
        sendJson(res, 413, { error: "request body too large" });
      } else {
        sendJson(res, 502, { error: "could not save asset", detail: String(e.message || e) });
      }
    }
  });

  /* Admin-only cleanup (§2.22) — removes the *local* asset/campaign
     record only. Cannot un-mint an on-chain token or delete a
     CatalogueMinted event; this is for clearing test/mistaken rows out
     of the public marketplace listing, not a real "delist" mechanism. */
  router.delete("/api/assets/:assetId", async (req, res, { params }) => {
    if (!requireAdmin(req, res)) return;
    const deleted = await catalogueRepo.deleteAsset(params.assetId);
    await catalogueRepo.deleteCampaign(params.assetId);
    sendJson(res, 200, { ok: true, deleted });
  });

  /* Lets whoever is looking at a catalogue asset record a real, dated
     royalty figure into its royaltyHistory — the write path that replaces
     the fabricated random-walk generator the fake-yield fix removed (see
     DELETE /api/admin/royalty-history/:assetId). Deliberately
     unauthenticated beyond requiring a connected wallet address for the
     audit trail: unlike an escrow campaign, a catalogue asset has no
     stored owner-wallet field to check a submitter against, and this app
     has no broader identity system to build real authorization on top of
     — same trust posture as every other prototype-stage write endpoint
     here (contract acceptance, KYC). */
  router.post("/api/assets/:assetId/royalty-report", async (req, res, { params }) => {
    try {
      const asset = await catalogueRepo.findAssetById(params.assetId);
      if (!asset) {
        sendJson(res, 404, { error: "no asset with this id" });
        return;
      }
      const body = await readBody(req);
      const month = String(body.month || "");
      if (!catalogueService.isValidMonth(month)) {
        sendJson(res, 400, { error: "month must be in YYYY-MM format" });
        return;
      }
      const royaltyUSD = Number(body.royaltyUSD);
      if (!Number.isFinite(royaltyUSD) || royaltyUSD < 0) {
        sendJson(res, 400, { error: "royaltyUSD must be a non-negative number" });
        return;
      }
      const reportedBy = catalogueService.normalizeReporter(body.reportedBy);
      const royaltyHistory = await catalogueService.upsertRoyaltyReport(asset, { month, royaltyUSD, reportedBy });
      sendJson(res, 200, { ok: true, royaltyHistory });
    } catch (e) {
      if (e instanceof SyntaxError) {
        sendJson(res, 400, { error: "malformed JSON body" });
      } else {
        sendJson(res, 502, { error: "could not save royalty report", detail: String(e.message || e) });
      }
    }
  });

  router.delete("/api/assets/:assetId/royalty-report/:month", async (req, res, { params }) => {
    try {
      const asset = await catalogueRepo.findAssetById(params.assetId);
      if (!asset) {
        sendJson(res, 404, { error: "no asset with this id" });
        return;
      }
      const royaltyHistory = await catalogueService.removeRoyaltyReport(asset, params.month);
      sendJson(res, 200, { ok: true, royaltyHistory });
    } catch (e) {
      sendJson(res, 502, { error: "could not remove royalty report", detail: String(e.message || e) });
    }
  });
};
