"use strict";
/* /api/auth — the public half of wallet sign-in with an identity this
   backend verified (§2.83). Only the verification key is served here; the
   signing side has no route until an EUDIW verifier exists to call it — see
   services/identity-jwt.service.js for why. */

const { sendJson } = require("../lib/http");
const identityJwt = require("../services/identity-jwt.service");

module.exports = function registerAuthRoutes(router) {
  // The URL entered as the JWKS URI under "Custom JWT" in thirdweb's dashboard.
  router.get("/api/auth/jwks.json", (req, res) => {
    if (!identityJwt.enabled()) {
      sendJson(res, 503, { error: "identity JWT signing is not configured on this deployment" });
      return;
    }
    sendJson(res, 200, identityJwt.getJwks());
  });
};
