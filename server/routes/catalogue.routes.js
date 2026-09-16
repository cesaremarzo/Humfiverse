"use strict";
/* /api/data and everything under /api/assets — the public catalogue
   surface: what the app loads at boot, what the onboarding wizard writes,
   and the self-reported royalty figures an asset accumulates afterwards. */

const { sendJson, readBody } = require("../lib/http");
const { requireAdmin } = require("../lib/admin-auth");
const catalogueRepo = require("../data/catalogue.repo");
const portfolioRepo = require("../data/portfolio.repo");
const catalogueService = require("../services/catalogue.service");
const { verifyLaunch, requireMatch } = require("../lib/launch-auth");
const { verifyAction } = require("../lib/signed-action");
const registration = require("../services/registration.service");

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
     planning/technical-architecture.md §2.20. Requires the launch
     authorization signed by the artist wallet the asset names (§2.88). */
  router.post("/api/assets", async (req, res) => {
    try {
      const body = await readBody(req);
      const asset = body.asset;
      if (!asset || !asset.id || !asset.title || !asset.kind) {
        sendJson(res, 400, { error: "asset.id, asset.title and asset.kind are required" });
        return;
      }
      const launch = verifyLaunch(body.launch);
      requireMatch("asset.id", asset.id, launch.assetId);
      requireMatch("asset.title", asset.title, launch.title);
      requireMatch("asset.artistName", asset.artistName, launch.artistName);
      requireMatch("asset.artistWallet", asset.artistWallet, launch.artistWallet);
      requireMatch("asset.tokensTotal", Number(asset.tokensTotal), launch.supply);
      await registration.requireRegistered(launch.artistWallet);
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
      } else if (e.code === "unauthorized") {
        sendJson(res, 401, { error: e.message });
      } else if (e.code === "invalid") {
        sendJson(res, 400, { error: e.message });
      } else if (e.code === "not-registered") {
        sendJson(res, 403, { error: e.message, code: e.code });
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

  /* Records a real, dated royalty figure into an asset's royaltyHistory —
     the write path that replaced the fabricated random-walk generator (see
     DELETE /api/admin/royalty-history/:assetId). These figures feed the
     yield shown to investors, so only the asset's owner wallet may write
     them, proven by a signature over this exact figure (§2.89). */
  async function requireOwnerSignature(asset, kind, auth, expected) {
    const signed = verifyAction(kind, auth);
    const owner = await catalogueService.ownerWalletOf(asset);
    if (!owner) throw Object.assign(new Error("this asset has no owner wallet on record"), { code: "forbidden" });
    if (signed.wallet !== owner) throw Object.assign(new Error("only the asset's owner wallet can change its royalty figures"), { code: "forbidden" });
    for (const [key, value] of Object.entries(expected)) {
      if (signed.fields[key] !== value) throw Object.assign(new Error(`${key} does not match the signature`), { code: "unauthorized" });
    }
    return signed.wallet;
  }

  function sendAuthError(res, e) {
    if (e.code === "unauthorized") { sendJson(res, 401, { error: e.message }); return true; }
    if (e.code === "forbidden") { sendJson(res, 403, { error: e.message }); return true; }
    return false;
  }

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
      const signer = await requireOwnerSignature(asset, "royalty-report", body.auth, { assetId: asset.id, month, royaltyUSD });
      const reportedBy = catalogueService.normalizeReporter(signer);
      const royaltyHistory = await catalogueService.upsertRoyaltyReport(asset, { month, royaltyUSD, reportedBy });
      sendJson(res, 200, { ok: true, royaltyHistory });
    } catch (e) {
      if (e instanceof SyntaxError) {
        sendJson(res, 400, { error: "malformed JSON body" });
      } else if (!sendAuthError(res, e)) {
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
      const body = await readBody(req);
      await requireOwnerSignature(asset, "royalty-remove", body.auth, { assetId: asset.id, month: params.month });
      const royaltyHistory = await catalogueService.removeRoyaltyReport(asset, params.month);
      sendJson(res, 200, { ok: true, royaltyHistory });
    } catch (e) {
      if (e instanceof SyntaxError) sendJson(res, 400, { error: "malformed JSON body" });
      else if (!sendAuthError(res, e)) sendJson(res, 502, { error: "could not remove royalty report", detail: String(e.message || e) });
    }
  });
};
