"use strict";
/* The contract-acceptance and KYC endpoints. Both are prototype-grade
   ceremony recorded for the audit trail, not integrations with any real
   registry or identity provider — see services/compliance.service.js. */

const { sendJson, readBody } = require("../lib/http");
const { CONTRACT_TEMPLATE } = require("../contract-template");
const compliance = require("../services/compliance.service");

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
      if (!body.fullName || !body.dob) {
        sendJson(res, 400, { error: "fullName and dob are required" });
        return;
      }
      sendJson(res, 200, await compliance.recordKyc(body));
    } catch (e) {
      sendJson(res, 400, { error: "invalid request body" });
    }
  });

  router.get("/api/kyc/status/:wallet", async (req, res, { params }) => {
    try {
      sendJson(res, 200, await compliance.getKycStatusForWallet(params.wallet));
    } catch (e) {
      sendJson(res, 502, { error: "could not read KYC status", detail: String(e.message || e) });
    }
  });
};
