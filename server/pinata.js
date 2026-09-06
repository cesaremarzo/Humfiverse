"use strict";
/* Uploads a track's audio file to IPFS via Pinata's pinning API (§2.43) —
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

/** Pins `buffer` (the raw audio file bytes) to IPFS, named `filename`.
 * Returns the ipfs:// URI. Throws on any non-2xx response — the caller
 * (server.js) is responsible for turning that into a client-facing error. */
async function uploadAudio(buffer, filename) {
  if (!PINATA_JWT) throw new Error("audio upload is disabled (no PINATA_JWT configured)");

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

module.exports = { uploadsEnabled, uploadAudio };
