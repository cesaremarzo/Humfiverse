"use strict";
/* /api/portfolio/* plus POST /api/redeem, which lives here despite its
   path because it operates on the same simulated holdings table.

   Two different worlds share this prefix, and the split matters when
   reading them: GET /api/portfolio/:wallet is real, per-wallet, read
   straight off the chain. The snapshot pair is real too, recorded per
   wallet per day. /api/redeem is the leftover simulation. */

const { sendJson, readBody } = require("../lib/http");
const portfolioRepo = require("../data/portfolio.repo");
const portfolio = require("../services/portfolio.service");

module.exports = function registerPortfolioRoutes(router) {
  /* §2.37/§2.39 — real holdings for a wallet, replacing the fictional
     Portfolio.holdings mock data (which was never tied to any actual
     wallet at all). */
  router.get("/api/portfolio/:wallet", async (req, res, { params }) => {
    try {
      if (!portfolio.isValidWallet(params.wallet)) {
        sendJson(res, 400, { error: "not a valid wallet address" });
        return;
      }
      sendJson(res, 200, { holdings: await portfolio.getWalletHoldings(params.wallet) });
    } catch (e) {
      sendJson(res, 502, { error: "could not read portfolio", detail: String(e.message || e) });
    }
  });

  /* Portfolio value dashboard: one snapshot per wallet per calendar day
     (UTC), upserted — so a wallet revisiting the portfolio page
     repeatedly in the same day doesn't grow this table unboundedly, while
     genuinely building up a real value-over-time history from whenever
     that wallet first visits. The frontend computes valueUsd itself (same
     lowest-available-price logic driving the pie chart, see
     core/token-value.util.ts) and just reports it here — this is a
     personal-analytics convenience, not something anything else depends
     on being correct, so trusting the client's own already-verified
     on-chain reads is proportionate. Deliberately no backfilled/synthetic
     history: a fabricated royalty history produced a fabricated yield
     number the user rightly rejected once already — the same principle
     applies to this chart starting genuinely empty for a new wallet
     rather than inventing a past. */
  router.post("/api/portfolio/:wallet/snapshot", async (req, res, { params }) => {
    try {
      if (!portfolio.isValidWallet(params.wallet)) {
        sendJson(res, 400, { error: "not a valid wallet address" });
        return;
      }
      const body = await readBody(req);
      const valueUsd = Number(body.valueUsd);
      if (!Number.isFinite(valueUsd) || valueUsd < 0) {
        sendJson(res, 400, { error: "valueUsd must be a non-negative number" });
        return;
      }
      const date = portfolio.todayUtc();
      await portfolioRepo.upsertSnapshot(params.wallet, date, valueUsd, new Date().toISOString());
      sendJson(res, 200, { ok: true, date, valueUsd });
    } catch (e) {
      if (e instanceof SyntaxError) {
        sendJson(res, 400, { error: "malformed JSON body" });
      } else {
        sendJson(res, 502, { error: "could not record snapshot", detail: String(e.message || e) });
      }
    }
  });

  router.get("/api/portfolio/:wallet/history", async (req, res, { params }) => {
    try {
      if (!portfolio.isValidWallet(params.wallet)) {
        sendJson(res, 400, { error: "not a valid wallet address" });
        return;
      }
      sendJson(res, 200, { history: await portfolioRepo.listSnapshots(params.wallet) });
    } catch (e) {
      sendJson(res, 502, { error: "could not read portfolio history", detail: String(e.message || e) });
    }
  });

  router.post("/api/redeem", async (req, res) => {
    try {
      const body = await readBody(req);
      if (!body.assetId) { sendJson(res, 400, { error: "assetId is required" }); return; }
      sendJson(res, 200, await portfolio.redeem(body.assetId));
    } catch (e) {
      sendJson(res, 400, { error: "invalid request body" });
    }
  });
};
