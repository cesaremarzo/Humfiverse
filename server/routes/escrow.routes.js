"use strict";
/* /api/escrow/* — HumfiverseMilestoneEscrow (§2.15).

   Note what is NOT here: releasing a milestone. Humfiverse has no
   function on the contract that lets it do that at all; both confirmation
   calls come from the artist's and the studio's own wallets. See the
   410 on /api/escrow/confirm at the bottom. */

const { sendJson, readBody } = require("../lib/http");
const escrowChain = require("../chainEscrow");
const escrow = require("../services/escrow.service");
const { verifyLaunch, requireMatch } = require("../lib/launch-auth");

module.exports = function registerEscrowRoutes(router) {
  router.post("/api/escrow/campaign", async (req, res) => {
    try {
      const body = await readBody(req);
      // §2.79: no goal in the request — the escrow takes it from the token.
      if (!body.assetId || !body.artistAddress || !body.studioName || !body.studioWallet || !Array.isArray(body.milestones)) {
        sendJson(res, 400, { error: "assetId, artistAddress, studioName, studioWallet and milestones are required" });
        return;
      }
      // §2.88: Founder's key registers the studio and creates the campaign,
      // so every field it will write must be what the artist wallet signed.
      const launch = verifyLaunch(body.launch);
      requireMatch("assetId", body.assetId, launch.assetId);
      requireMatch("artistAddress", body.artistAddress, launch.artistWallet);
      requireMatch("studioName", body.studioName, launch.studioName);
      requireMatch("studioWallet", body.studioWallet, launch.studioWallet);
      requireMatch("milestones.length", body.milestones.length, launch.milestones.length);
      body.milestones.forEach((m, i) => {
        requireMatch(`milestones[${i}].name`, m?.name, launch.milestones[i].name);
        requireMatch(`milestones[${i}].bps`, Number(m?.bps), launch.milestones[i].bps);
        requireMatch(`milestones[${i}].payee`, m?.payee === "studio" ? "studio" : "artist", launch.milestones[i].payee);
        requireMatch(`milestones[${i}].kind`, m?.kind || "standard", launch.milestones[i].kind);
      });
      if (!escrowChain.writeEnabled()) {
        sendJson(res, 503, { error: "escrow admin actions are disabled on this server (no operator key configured)" });
        return;
      }
      // §2.114: the raise terms come only from the signature.
      const result = await escrow.createCampaign(
        body.assetId, body.artistAddress, body.studioName, body.studioWallet, body.milestones, launch.raiseDeadline, launch.minRaiseBps
      );
      sendJson(res, 200, result);
    } catch (e) {
      if (e.code === "unauthorized") {
        sendJson(res, 401, { error: e.message });
      } else if (e.code === "invalid") {
        sendJson(res, 400, { error: e.message });
      } else if (e.code === "already_created") {
        sendJson(res, 409, { error: "asset already has an escrow campaign", record: e.record });
      } else if (e.code === "studio_unverified") {
        sendJson(res, 400, { error: e.message, code: e.code });
      } else if (/raise deadline|minimum out of range/.test(String(e.shortMessage || e.reason || e.message))) {
        sendJson(res, 400, { error: "the raise deadline has passed or is out of range: launch the campaign again with new terms", code: "raise_terms" });
      } else if (e.code === "no_token") {
        sendJson(res, 400, { error: e.message });
      } else {
        sendJson(res, 502, { error: "escrow campaign creation failed", detail: String(e.message || e) });
      }
    }
  });

  /* §2.110: the studios a campaign may name — registered by the Owner Safe
     after an off-chain check, and active. The wizard offers only these. */
  router.get("/api/escrow/studios", async (req, res) => {
    try {
      const studios = (await escrowChain.listStudiosOnchain()).filter((s) => s.active);
      sendJson(res, 200, { studios: studios.map(({ studioId, name, wallet }) => ({ studioId, name, wallet })) });
    } catch (e) {
      sendJson(res, 502, { error: "could not read the studio registry", detail: String(e.message || e) });
    }
  });

  /* §2.112: an artist's escrow-only tokens left without a campaign, with the
     terms to sign again. */
  router.get("/api/escrow/missing/:wallet", async (req, res, { params }) => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(params.wallet)) {
      sendJson(res, 400, { error: "wallet is not an address" });
      return;
    }
    try {
      sendJson(res, 200, { missing: await escrow.listMissingCampaigns(params.wallet) });
    } catch (e) {
      sendJson(res, 502, { error: "could not check for missing campaigns", detail: String(e.message || e) });
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
      // A campaign missing from the local table would be missing from the
      // artist's and studio's pages too (§2.104); a failed write never
      // costs the reader the answer.
      await escrow.rememberCampaign(params.assetId, info).catch((e) => console.warn("could not record campaign", params.assetId, e.message));
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
