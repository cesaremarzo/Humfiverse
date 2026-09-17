"use strict";
/* /api/royalties/* — royalty income on the token contract (§2.92).

   Read-only apart from the deposit history, which only records what a
   transaction receipt proves. Depositing and claiming are transactions
   from the user's own wallet; Humfiverse signs neither. */

const { sendJson, readBody } = require("../lib/http");
const royalties = require("../services/royalties.service");

function sendError(res, e, fallback) {
  if (e instanceof SyntaxError) { sendJson(res, 400, { error: "invalid JSON body" }); return; }
  if (e.code === "invalid") { sendJson(res, 400, { error: e.message }); return; }
  if (e.code === "not_found") { sendJson(res, 404, { error: e.message }); return; }
  if (e.code === "unsupported") { sendJson(res, 409, { error: e.message }); return; }
  sendJson(res, 502, { error: fallback, detail: String(e.message || e) });
}

module.exports = function registerRoyaltyRoutes(router) {
  /* Literal paths, matched before /api/royalties/:assetId. */
  router.post("/api/royalties/deposits", async (req, res) => {
    try {
      const body = await readBody(req);
      sendJson(res, 200, await royalties.recordDeposit(body.txHash, body.statement ?? null));
    } catch (e) {
      sendError(res, e, "could not record the royalty deposit");
    }
  });

  router.get("/api/royalties/wallet/:wallet", async (req, res, { params }) => {
    try {
      sendJson(res, 200, await royalties.claimableForWallet(params.wallet));
    } catch (e) {
      sendError(res, e, "could not read claimable royalties");
    }
  });

  router.get("/api/royalties/:assetId", async (req, res, { params, url }) => {
    try {
      sendJson(res, 200, await royalties.royaltiesForAsset(params.assetId, url.searchParams.get("wallet")));
    } catch (e) {
      sendError(res, e, "could not read royalties");
    }
  });
};
