"use strict";
/* Uploads a track's audio file, image or video to IPFS via Pinata's pinning API (§2.43) —
   the off-chain half of the audio-upload feature; chain.js's
   setTrackAudioUriOnchain writes the resulting CID on-chain.

   Uses Node's built-in fetch/FormData/Blob (stable since Node 18) rather
   than an SDK or a new dependency, matching this backend's near-zero-
   dependency approach elsewhere. Disabled (uploads fail with a clear
   error) if PINATA_JWT isn't set — same graceful-degradation pattern as
   CHAIN_OPERATOR_PRIVATE_KEY. */

const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_PIN_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";

function uploadsEnabled() {
  return Boolean(PINATA_JWT);
}

/** Pins `buffer` to IPFS, named `filename`. Returns the ipfs:// URI.
 * Throws on any non-2xx response — the caller turns that into a
 * client-facing error. Used for audio (§2.43) and track media (§2.93). */
async function uploadFile(buffer, filename) {
  if (!PINATA_JWT) throw new Error("uploads are disabled (no PINATA_JWT configured)");

  const form = new FormData();
  form.append("file", new Blob([buffer]), filename);
  form.append("pinataMetadata", JSON.stringify({ name: filename }));

  const res = await fetch(PINATA_PIN_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: form
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pinata upload failed (${res.status}): ${text || res.statusText}`);
  }

  const data = await res.json();
  return `ipfs://${data.IpfsHash}`;
}

const uploadAudio = uploadFile;

/** Unpins a file we pinned earlier, when it has been replaced (§2.93). Best
 * effort: the free plan's 1 GB fills up with replaced videos otherwise, but
 * a failure here must never undo the replacement. The same call is what the
 * takedown procedure (§2.87) will use. */
async function unpin(uri) {
  if (!PINATA_JWT || typeof uri !== "string" || !uri.startsWith("ipfs://")) return false;
  const cid = uri.slice("ipfs://".length);
  const res = await fetch(`https://api.pinata.cloud/pinning/unpin/${encodeURIComponent(cid)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${PINATA_JWT}` }
  }).catch(() => null);
  return Boolean(res?.ok);
}

module.exports = { uploadsEnabled, uploadFile, uploadAudio, unpin };
