"use strict";
/* /api/assets/:assetId/media/:kind — an image or a short video for a track
   (§2.93), pinned to IPFS and recorded on the asset. Not written on chain:
   the token's metadata JSON picks the image up from the asset record.

   The body is the file, so the authorization travels in a header, base64
   of JSON, one of:
   - X-Humfiverse-Launch: the launch authorization (§2.88), while the wizard
     is still creating the campaign;
   - X-Humfiverse-Action: an "asset-media" signed action from the owner
     wallet, carrying the SHA-256 of these exact bytes, for any later
     change. */

const crypto = require("crypto");
const { sendJson, readRawBody } = require("../lib/http");
const pinata = require("../pinata");
const catalogueRepo = require("../data/catalogue.repo");
const catalogueService = require("../services/catalogue.service");
const { verifyLaunch, requireMatch } = require("../lib/launch-auth");
const { verifyAction } = require("../lib/signed-action");
const { LIMITS, checkMedia } = require("../lib/media-sniff");

function headerJson(req, name) {
  const raw = req.headers[name];
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(String(raw), "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function codedError(code, message) {
  return Object.assign(new Error(message), { code });
}

/** The wallet allowed to make this change, or a thrown auth error. */
async function authorize(req, asset, kind, buffer) {
  const owner = await catalogueService.ownerWalletOf(asset);
  if (!owner) throw codedError("forbidden", "this asset has no owner wallet on record");

  const launchRaw = headerJson(req, "x-humfiverse-launch");
  if (launchRaw) {
    const launch = verifyLaunch(launchRaw);
    requireMatch("assetId", asset.id, launch.assetId);
    if (launch.artistWallet !== owner) throw codedError("forbidden", "only the asset's owner wallet can change its media");
    return owner;
  }

  const signed = verifyAction("asset-media", headerJson(req, "x-humfiverse-action"));
  if (signed.wallet !== owner) throw codedError("forbidden", "only the asset's owner wallet can change its media");
  if (signed.fields.assetId !== asset.id || signed.fields.kind !== kind) throw codedError("unauthorized", "the signature is for a different change");
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  if (signed.fields.sha256 !== sha256) throw codedError("unauthorized", "the file does not match the signature");
  return owner;
}

const EXTENSION = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };

module.exports = function registerMediaRoutes(router) {
  router.post("/api/assets/:assetId/media/:kind", async (req, res, { params }) => {
    try {
      const kind = params.kind;
      if (!LIMITS[kind]) {
        sendJson(res, 404, { error: "media kind must be image or video" });
        return;
      }
      if (!pinata.uploadsEnabled()) {
        sendJson(res, 503, { error: "uploads are disabled on this server (no Pinata key configured)" });
        return;
      }
      const asset = await catalogueRepo.findAssetById(params.assetId);
      if (!asset) {
        sendJson(res, 404, { error: "no asset with this id" });
        return;
      }
      const buffer = await readRawBody(req, LIMITS[kind].maxBytes);
      const { mime, durationSeconds } = checkMedia(kind, buffer);
      const wallet = await authorize(req, asset, kind, buffer);

      const uri = await pinata.uploadFile(buffer, `${asset.id}-${kind}.${EXTENSION[mime]}`);
      const ref = {
        uri,
        mime,
        bytes: buffer.length,
        ...(durationSeconds !== null ? { durationSeconds: Math.round(durationSeconds * 10) / 10 } : {}),
        uploadedAt: new Date().toISOString(),
        uploadedBy: wallet
      };
      const previous = await catalogueService.setAssetMedia(asset, kind, ref);
      if (previous?.uri && previous.uri !== uri) pinata.unpin(previous.uri);
      sendJson(res, 200, { ok: true, media: asset.media });
    } catch (e) {
      if (e.code === "too_large") sendJson(res, 413, { error: e.message || "file too large" });
      else if (e.code === "invalid") sendJson(res, 400, { error: e.message });
      else if (e.code === "unauthorized") sendJson(res, 401, { error: e.message });
      else if (e.code === "forbidden") sendJson(res, 403, { error: e.message });
      else sendJson(res, 502, { error: "media upload failed", detail: String(e.message || e) });
    }
  });
};
