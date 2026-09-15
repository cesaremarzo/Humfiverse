"use strict";
/* /api/signed-action — the text a wallet signs for a single write that is
   its own business (§2.89): a royalty figure on an asset it owns, its
   investor verification. Stateless, like /api/launch/message. */

const { sendJson, readBody } = require("../lib/http");
const { prepareAction } = require("../lib/signed-action");

module.exports = function registerSignedActionRoutes(router) {
  router.post("/api/signed-action/message", async (req, res) => {
    try {
      sendJson(res, 200, prepareAction(await readBody(req)));
    } catch (e) {
      if (e instanceof SyntaxError) sendJson(res, 400, { error: "malformed JSON body" });
      else if (e.code === "invalid") sendJson(res, 400, { error: e.message });
      else sendJson(res, 500, { error: "could not prepare the message" });
    }
  });
};
