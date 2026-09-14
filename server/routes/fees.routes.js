"use strict";
/* /api/fees — platform fee totals, read from the two fee-bearing contracts
   (§2.71). Public and read-only: every figure is already public on chain.

   Deliberately no withdrawal route. withdrawFees() is callable by any
   wallet and pays only the contract's feeRecipient, so the admin page
   sends it from a connected wallet; this server holds no key for it. */

const { sendJson } = require("../lib/http");
const fees = require("../services/fees.service");

module.exports = function registerFeeRoutes(router) {
  router.get("/api/fees", async (req, res) => {
    sendJson(res, 200, await fees.getSummary());
  });
};
