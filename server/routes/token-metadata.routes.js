"use strict";
/* ERC-1155 metadata (§2.36) — HumfiverseCatalogueToken.uri() points here
   with a {id} template every wallet substitutes for a 64-hex-char,
   zero-padded, lowercase token id (EIP-1155's own convention, not
   something this backend chose). The original deploy pointed at a
   reserved, never-resolving `.example` domain, so no wallet could ever
   load a token's name/image/balance display — these routes are the fix.

   Both patterns are RegExps rather than :param strings because the shape
   itself is the contract: exactly 64 lowercase hex characters and a
   .json suffix, or digits and /image.svg. Anything else must 404 rather
   than reach a handler that would then have to re-validate it. */

const { sendJson, sendRaw } = require("../lib/http");
const chain = require("../chain");
const { TOKEN_METADATA_BASE } = require("../config");
const { tokenImageSvg } = require("../lib/token-image");

module.exports = function registerTokenMetadataRoutes(router) {
  router.get(/^\/api\/token-metadata\/(?<hexTokenId>[0-9a-f]{64})\.json$/, async (req, res, { params }) => {
    try {
      const tokenId = parseInt(params.hexTokenId, 16);
      const info = await chain.getPoolInfo(tokenId);
      if (!info.onchainTitle) { sendJson(res, 404, { error: "no token minted at this id" }); return; }
      sendJson(res, 200, {
        name: info.onchainTitle,
        description: `"${info.onchainTitle}" by ${info.onchainArtist} — a Humfiverse catalogue token on Sepolia. Testnet prototype, not a real financial instrument.`,
        image: `${TOKEN_METADATA_BASE}/api/token-metadata/${tokenId}/image.svg`,
        // §2.43 — the standard field wallets/marketplaces read to play an
        // NFT's audio/video; only present once a track's been uploaded and
        // linked on-chain (see trackAudioUri on the contract, the actual
        // source of truth — this JSON is just a convenience mirror of it).
        ...(info.audioUri ? { animation_url: info.audioUri } : {}),
        attributes: [
          { trait_type: "Artist", value: info.onchainArtist },
          { trait_type: "Total supply", value: Number(info.totalSupply) },
          { trait_type: "Network", value: "Sepolia (testnet)" }
        ]
      });
    } catch (e) {
      sendJson(res, 502, { error: "could not read token metadata", detail: String(e.message || e) });
    }
  });

  router.get(/^\/api\/token-metadata\/(?<tokenId>\d+)\/image\.svg$/, async (req, res, { params }) => {
    try {
      const tokenId = Number(params.tokenId);
      const info = await chain.getPoolInfo(tokenId);
      sendRaw(res, 200, "image/svg+xml", tokenImageSvg(info.onchainTitle || `Token #${tokenId}`, info.onchainArtist || ""));
    } catch (e) {
      sendRaw(res, 502, "text/plain", "could not render token image");
    }
  });
};
