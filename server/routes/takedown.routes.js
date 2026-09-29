"use strict";
/* /api/takedown/* — the takedown procedure (§2.105). Every write is a step
   signed by a signer of the owner Safe; see services/takedown.service.js.
   The one open read says only whether an asset's content was removed and
   on which ground. */
const { sendJson, readBody } = require("../lib/http");
const takedown = require("../services/takedown.service");

const STATUS = { invalid: 400, unauthorized: 401, forbidden: 403, not_found: 404, conflict: 409, too_large: 413 };

function sendError(res, e, fallback) {
  if (e instanceof SyntaxError) { sendJson(res, 400, { error: "invalid JSON body" }); return; }
  const status = STATUS[e && e.code];
  if (status) { sendJson(res, status, { error: e.message }); return; }
  sendJson(res, 502, { error: fallback, detail: String((e && e.message) || e) });
}

const STEPS = {
  notice: takedown.notice,
  "notice-email": takedown.resendNotice,
  reply: takedown.reply,
  dismiss: takedown.dismiss,
  decide: takedown.decide,
  complete: takedown.complete
};

module.exports = function registerTakedownRoutes(router) {
  /* Literal path first: the admin list is a signed read, hence a POST. */
  router.post("/api/takedown/cases", async (req, res) => {
    try {
      const body = await readBody(req);
      sendJson(res, 200, await takedown.listCases(body));
    } catch (e) {
      sendError(res, e, "could not read takedown cases");
    }
  });

  router.get("/api/takedown/:assetId", async (req, res, { params }) => {
    try {
      sendJson(res, 200, await takedown.publicState(params.assetId));
    } catch (e) {
      sendError(res, e, "could not read takedown state");
    }
  });

  /* Anyone may fetch the prepared Safe transaction: it holds the decision's
     hash, never its text. */
  router.get("/api/takedown/:assetId/safe-transaction", async (req, res, { params }) => {
    try {
      sendJson(res, 200, { safeTransaction: await takedown.safeTransactionFor(params.assetId) });
    } catch (e) {
      sendError(res, e, "could not prepare the Safe transaction");
    }
  });

  router.post("/api/takedown/:assetId/:step", async (req, res, { params }) => {
    const run = STEPS[params.step];
    if (!run) { sendJson(res, 404, { error: "unknown step" }); return; }
    try {
      const body = await readBody(req);
      sendJson(res, 200, await run(params.assetId, body));
    } catch (e) {
      sendError(res, e, `could not run the ${params.step} step`);
    }
  });
};
