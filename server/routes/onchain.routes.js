"use strict";
/* /api/onchain/* — reads and writes against HumfiverseCatalogueToken.

   The listing and single-asset reads always work. The two writes (mint,
   audio link) need CHAIN_OPERATOR_PRIVATE_KEY and return 503 without it,
   rather than failing deep inside ethers with an opaque message. */

const { sendJson, readBody, readRawBody } = require("../lib/http");
const chain = require("../chain");
const pinata = require("../pinata");
const onchainService = require("../services/onchain.service");

module.exports = function registerOnchainRoutes(router) {
  /* Exact path, so it can never be shadowed by /api/onchain/:assetId
     below — the router matches literal paths before :param patterns. */
  router.get("/api/onchain/list", async (req, res) => {
    sendJson(res, 200, await onchainService.listMintedAssetIds());
  });

  router.get("/api/onchain/:assetId", async (req, res, { params }) => {
    try {
      const record = await onchainService.findTokenWithChainFallback(params.assetId);
      if (!record) { sendJson(res, 200, { onchain: false }); return; }
      const poolInfo = await chain.getPoolInfo(record.token_id);
      sendJson(res, 200, {
        onchain: true,
        assetId: params.assetId,
        slug: record.slug,
        mintTxHash: record.tx_hash,
        mintedAt: record.minted_at,
        ...poolInfo
      });
    } catch (e) {
      sendJson(res, 502, { error: "could not read on-chain data", detail: String(e.message || e) });
    }
  });

  router.post("/api/onchain/mint", async (req, res) => {
    try {
      const body = await readBody(req);
      if (!body.assetId || !body.slug || !body.supply) {
        sendJson(res, 400, { error: "assetId, slug and supply are required" });
        return;
      }
      if (!chain.mintingEnabled()) {
        sendJson(res, 503, { error: "on-chain minting is disabled on this server (no operator key configured)" });
        return;
      }
      const result = await onchainService.mintAsset(body.assetId, body.slug, body.supply, body.priceWei, body.title, body.artist);
      sendJson(res, 200, result);
    } catch (e) {
      if (e.code === "already_minted") {
        sendJson(res, 409, { error: "asset already has an on-chain token", record: e.record });
      } else {
        sendJson(res, 502, { error: "on-chain mint failed", detail: String(e.message || e) });
      }
    }
  });

  /* §2.43 — links an already-minted token to its real, uploaded track
     audio: pins the file to IPFS via Pinata, then writes the resulting CID
     on-chain (HumfiverseCatalogueToken.setTrackAudioUri). Two independent
     steps — a Pinata failure never touches the chain, and a chain failure
     still leaves the file pinned (safe to retry: it'll just get set again). */
  router.post("/api/onchain/audio/:assetId", async (req, res, { params, url }) => {
    try {
      const filename = url.searchParams.get("filename") || "track";
      if (!chain.mintingEnabled()) {
        sendJson(res, 503, { error: "on-chain actions are disabled on this server (no operator key configured)" });
        return;
      }
      if (!pinata.uploadsEnabled()) {
        sendJson(res, 503, { error: "audio upload is disabled on this server (no Pinata key configured)" });
        return;
      }
      const onchainRecord = await onchainService.findTokenWithChainFallback(params.assetId);
      if (!onchainRecord) {
        sendJson(res, 400, { error: "asset has no on-chain token yet — mint it before uploading audio" });
        return;
      }
      const buffer = await readRawBody(req);
      if (!buffer.length) {
        sendJson(res, 400, { error: "empty file body" });
        return;
      }
      const uri = await pinata.uploadAudio(buffer, filename);
      const result = await chain.setTrackAudioUriOnchain(onchainRecord.token_id, uri);
      sendJson(res, 200, { uri, txHash: result.txHash, explorerUrl: result.explorerUrl });
    } catch (e) {
      if (e.code === "too_large") {
        sendJson(res, 413, { error: "file too large (20MB max)" });
      } else {
        sendJson(res, 502, { error: "audio upload failed", detail: String(e.message || e) });
      }
    }
  });
};
