"use strict";
/* /api/launch — the text a wallet signs to authorize a campaign launch
   (§2.88). Stateless: it stamps the time and returns the message built by
   lib/launch-auth.js, so the frontend never assembles the signed text
   itself and the two can't drift apart. */

const { sendJson, readBody } = require("../lib/http");
const { prepareLaunch } = require("../lib/launch-auth");

module.exports = function registerLaunchRoutes(router) {
  router.post("/api/launch/message", async (req, res) => {
    try {
      const body = await readBody(req);
      sendJson(res, 200, prepareLaunch(body.payload));
    } catch (e) {
      if (e instanceof SyntaxError) sendJson(res, 400, { error: "malformed JSON body" });
      else if (e.code === "invalid") sendJson(res, 400, { error: e.message });
      else sendJson(res, 500, { error: "could not prepare the launch message" });
    }
  });
};
