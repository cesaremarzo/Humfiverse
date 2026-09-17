"use strict";
/* /api/price-history/:assetId — the prices a token has actually traded at,
   read from transaction receipts. See services/trades.service.js. */

const { sendJson } = require("../lib/http");
const trades = require("../services/trades.service");

module.exports = function registerPriceHistoryRoutes(router) {
  router.get("/api/price-history/:assetId", async (req, res, { params }) => {
    try {
      sendJson(res, 200, await trades.priceHistory(params.assetId));
    } catch (e) {
      if (e.code === "no_token") { sendJson(res, 404, { error: e.message }); return; }
      sendJson(res, 502, { error: "could not read price history", detail: String(e.message || e) });
    }
  });
};
