"use strict";
/* /api/royalties/* — royalty income on the token contract (§2.92).

   Read-only apart from the deposit history, which only records what a
   transaction receipt proves, and the statement files (§2.98), accepted
   only when their SHA-256 is the statementRef on chain. Depositing and
   claiming are transactions from the user's own wallet; Humfiverse signs
   neither. */

const { sendJson, readBody, readRawBody } = require("../lib/http");
const { MAX_STATEMENT_BYTES } = require("../lib/statement-file");
const royalties = require("../services/royalties.service");

function sendError(res, e, fallback) {
  if (e.code === "too_large") { sendJson(res, 413, { error: e.message }); return; }
  if (e instanceof SyntaxError) { sendJson(res, 400, { error: "invalid JSON body" }); return; }
  if (e.code === "invalid") { sendJson(res, 400, { error: e.message }); return; }
  if (e.code === "not_found") { sendJson(res, 404, { error: e.message }); return; }
  if (e.code === "unsupported") { sendJson(res, 409, { error: e.message }); return; }
  if (e.code === "disabled") { sendJson(res, 503, { error: e.message }); return; }
  sendJson(res, 502, { error: fallback, detail: String(e.message || e) });
}

module.exports = function registerRoyaltyRoutes(router) {
  /* Literal paths, matched before /api/royalties/:assetId. */
  router.post("/api/royalties/deposits", async (req, res) => {
    try {
      const body = await readBody(req);
      sendJson(res, 200, await royalties.recordDeposit(body.txHash));
    } catch (e) {
      sendError(res, e, "could not record the royalty deposit");
    }
  });

  /* The body is the statement file itself. */
  router.post("/api/royalties/deposits/:txHash/statement", async (req, res, { params }) => {
    try {
      const buffer = await readRawBody(req, MAX_STATEMENT_BYTES);
      sendJson(res, 200, await royalties.attachStatement(params.txHash, buffer));
    } catch (e) {
      sendError(res, e, "could not publish the royalty statement");
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
