"use strict";
/* The contract-acceptance and KYC endpoints. Both are prototype-grade
   ceremony recorded for the audit trail, not integrations with any real
   registry or identity provider — see services/compliance.service.js. */

const { sendJson, readBody } = require("../lib/http");
const { CONTRACT_TEMPLATE } = require("../contract-template");
const compliance = require("../services/compliance.service");
const { verifyAction, kycDigest } = require("../lib/signed-action");
const registration = require("../services/registration.service");

module.exports = function registerComplianceRoutes(router) {
  router.get("/api/contract-template", (req, res) => {
    sendJson(res, 200, CONTRACT_TEMPLATE);
  });

  router.post("/api/contract-acceptance", async (req, res) => {
    try {
      const body = await readBody(req);
      const missing = compliance.validateContractAcceptance(body);
      if (missing.length) {
        sendJson(res, 400, { error: "missing required acceptances", missing });
        return;
      }
      sendJson(res, 200, await compliance.recordContractAcceptance(body));
    } catch (e) {
      sendJson(res, 400, { error: "invalid request body" });
    }
  });

  router.post("/api/kyc", async (req, res) => {
    try {
      const body = await readBody(req);
      if (!body.fullName || !body.dob || !body.walletAddress) {
        sendJson(res, 400, { error: "fullName, dob and walletAddress are required" });
        return;
      }
      // §2.89: the wallet the verification is recorded for signs a digest of
      // these exact answers, so no one can mark another wallet verified.
      const signed = verifyAction("kyc-submit", body.auth);
      if (signed.wallet !== String(body.walletAddress).toLowerCase()) {
        sendJson(res, 401, { error: "the signature is not from the wallet being verified" });
        return;
      }
      if (signed.fields.digest !== kycDigest(body)) {
        sendJson(res, 401, { error: "the answers do not match the signature" });
        return;
      }
      await registration.requireRegistered(signed.wallet);
      sendJson(res, 200, await compliance.recordKyc(body));
    } catch (e) {
      if (e.code === "unauthorized") sendJson(res, 401, { error: e.message });
      else if (e.code === "not-registered") sendJson(res, 403, { error: e.message, code: e.code });
      else sendJson(res, 400, { error: "invalid request body" });
    }
  });

  /* Public, so it says only whether a wallet is verified (§2.89): the
     classification, score and result belong to that investor, and this
     route cannot tell who is asking. */
  router.get("/api/kyc/status/:wallet", async (req, res, { params }) => {
    try {
      sendJson(res, 200, await compliance.getKycStatusForWallet(params.wallet));
    } catch (e) {
      sendJson(res, 502, { error: "could not read KYC status", detail: String(e.message || e) });
    }
  });
};
