"use strict";
/* Liveness probe. Render pings this to tell a cold-started instance from
   a dead one; it deliberately touches neither the database nor the RPC,
   so it stays fast and can't fail for a reason unrelated to the process
   being up. */

const { sendJson } = require("../lib/http");

module.exports = function registerSystemRoutes(router) {
  router.get("/api/health", (req, res) => {
    sendJson(res, 200, { ok: true });
  });
};
