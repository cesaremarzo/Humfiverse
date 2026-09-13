"use strict";
/* Holder counts, served from the event index (§2.65).
 *
 * Every response carries `complete`. A count taken while the backfill is
 * still running is a lower bound, not an answer, and this project has
 * spent a session learning what happens when a partial figure is rendered
 * with the authority of a settled one. */

const { sendJson } = require("../lib/http");
const { requireAdmin } = require("../lib/admin-auth");
const indexer = require("../services/indexer.service");
const onchainRepo = require("../data/onchain.repo");

module.exports = function registerHolderRoutes(router) {
  router.get("/api/indexer/status", async (req, res) => {
    try {
      sendJson(res, 200, await indexer.status());
    } catch (e) {
      sendJson(res, 502, { error: "could not read indexer status", detail: String(e.message || e) });
    }
  });

  /* Many assets in one call, for a page of cards. Exact path, so it is
     matched before /api/holders/:assetId below. */
  router.get("/api/holders", async (req, res, { url }) => {
    try {
      const ids = (url.searchParams.get("ids") || "").split(",").map((i) => i.trim()).filter(Boolean);
      if (!ids.length) { sendJson(res, 400, { error: "ids query parameter is required, comma-separated" }); return; }
      if (ids.length > 100) { sendJson(res, 400, { error: "at most 100 ids per request" }); return; }
      const tokenIdsByAsset = {};
      for (const id of ids) {
        const token = await onchainRepo.findTokenByAssetId(id);
        if (token) tokenIdsByAsset[id] = token.token_id;
      }
      sendJson(res, 200, await indexer.holderCounts(tokenIdsByAsset));
    } catch (e) {
      sendJson(res, 502, { error: "could not read holder counts", detail: String(e.message || e) });
    }
  });

  router.get("/api/holders/:assetId", async (req, res, { params }) => {
    try {
      const token = await onchainRepo.findTokenByAssetId(params.assetId);
      if (!token) { sendJson(res, 200, { assetId: params.assetId, onchain: false, count: null, complete: false }); return; }
      const result = await indexer.holders(token.token_id);
      sendJson(res, 200, { assetId: params.assetId, onchain: true, tokenId: token.token_id, ...result });
    } catch (e) {
      sendJson(res, 502, { error: "could not read holders", detail: String(e.message || e) });
    }
  });

  /* Admin-only: re-read every holding from the contract and check that
     holdings plus pool equal supply. This is the repair path — a replayed
     balance cannot be patched, only overwritten with the real one. */
  router.post("/api/admin/indexer/reconcile", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      sendJson(res, 200, await indexer.reconcile());
    } catch (e) {
      sendJson(res, 502, { error: "reconcile failed", detail: String(e.message || e) });
    }
  });

  /* Admin-only: wipe and replay. Balances are running deltas, so an index
     corrupted by a bad run cannot be patched — only rebuilt. */
  router.post("/api/admin/indexer/reindex", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      sendJson(res, 200, await indexer.reindex());
    } catch (e) {
      sendJson(res, 502, { error: "reindex failed", detail: String(e.message || e) });
    }
  });

  /* Admin-only manual nudge. The indexer runs on its own while the process
     is awake, but a free-tier instance sleeps, so being able to push it
     along without waiting for traffic is worth the one endpoint. */
  router.post("/api/admin/indexer/step", async (req, res, { url }) => {
    if (!requireAdmin(req, res)) return;
    try {
      const calls = Math.min(Number(url.searchParams.get("calls")) || 40, 500);
      sendJson(res, 200, await indexer.step(calls));
    } catch (e) {
      sendJson(res, 502, { error: "indexer step failed", detail: String(e.message || e) });
    }
  });
};
