"use strict";
/* Automatic figures for the royalty calculator (§2.121): a track video's
   YouTube views, and exchange rates. Read-only and public. */

const { sendJson } = require("../lib/http");
const streams = require("../services/streams.service");

module.exports = function registerStreamsRoutes(router) {
  router.get("/api/fx", async (req, res) => {
    const fx = await streams.fxRates();
    sendJson(res, 200, fx ? { available: true, ...fx } : { available: false });
  });

  router.get("/api/assets/:assetId/youtube", async (req, res, { params }) => {
    try {
      sendJson(res, 200, await streams.youtubeStatsFor(params.assetId));
    } catch (e) {
      sendJson(res, 502, { available: false, reason: "error", detail: String(e.message || e) });
    }
  });
};
