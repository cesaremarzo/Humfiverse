"use strict";
/* /api/escrow/* — HumfiverseMilestoneEscrow (§2.15).

   Note what is NOT here: releasing a milestone. Humfiverse has no
   function on the contract that lets it do that at all; both confirmation
   calls come from the artist's and the studio's own wallets. See the
   410 on /api/escrow/confirm at the bottom. */

const { sendJson, readBody } = require("../lib/http");
const escrowChain = require("../chainEscrow");
const escrow = require("../services/escrow.service");

module.exports = function registerEscrowRoutes(router) {
  router.post("/api/escrow/campaign", async (req, res) => {
    try {
      const body = await readBody(req);
      if (!body.assetId || !body.artistAddress || !body.fundingGoalWei || !body.studioName || !body.studioWallet || !Array.isArray(body.milestones)) {
        sendJson(res, 400, { error: "assetId, artistAddress, fundingGoalWei, studioName, studioWallet and milestones are required" });
        return;
      }
      if (!escrowChain.writeEnabled()) {
        sendJson(res, 503, { error: "escrow admin actions are disabled on this server (no operator key configured)" });
        return;
      }
      const result = await escrow.createCampaign(
        body.assetId, body.artistAddress, body.fundingGoalWei, body.studioName, body.studioWallet, body.milestones
      );
      sendJson(res, 200, result);
    } catch (e) {
      if (e.code === "already_created") {
        sendJson(res, 409, { error: "asset already has an escrow campaign", record: e.record });
      } else if (e.code === "no_token") {
        sendJson(res, 400, { error: e.message });
      } else {
        sendJson(res, 502, { error: "escrow campaign creation failed", detail: String(e.message || e) });
      }
    }
  });

  router.get("/api/escrow/campaigns", async (req, res) => {
    try {
      sendJson(res, 200, { campaigns: await escrow.listCampaigns() });
    } catch (e) {
      sendJson(res, 502, { error: "could not read escrow campaigns", detail: String(e.message || e) });
    }
  });

  /* Chain-native (§2.18): the contract's own campaignIdByAssetId is the
     lookup, not the local table — this survives the local DB being wiped
     on a redeploy (see the analogous fix for the token side). */
  router.get("/api/escrow/campaign/:assetId", async (req, res, { params }) => {
    try {
      const info = await escrowChain.getCampaignInfoByAssetId(params.assetId);
      if (!info) { sendJson(res, 200, { escrow: false }); return; }
      sendJson(res, 200, { escrow: true, assetId: params.assetId, ...info });
    } catch (e) {
      sendJson(res, 502, { error: "could not read escrow campaign", detail: String(e.message || e) });
    }
  });

  /* Removed (§2.27): the contract no longer has any function that lets
     Humfiverse release a milestone by itself — confirmMilestoneAsArtist/
     confirmMilestoneAsStudio must each be called directly from the
     relevant party's own wallet (see WalletService, mirroring how
     buyOnchain/contributeOnchain already request a signature from the
     actual counterparty, not this server). 410, not 404: this used to
     exist and was deliberately removed, not a typo'd URL. */
  router.post("/api/escrow/confirm", (req, res) => {
    sendJson(res, 410, {
      error: "Humfiverse can no longer confirm milestones — this is intentional, not a bug",
      detail: "Release now requires confirmMilestoneAsArtist and confirmMilestoneAsStudio, called directly by the artist's and studio's own wallets. See HumfiverseMilestoneEscrow.sol and technical-architecture.md §2.27."
    });
  });
};
