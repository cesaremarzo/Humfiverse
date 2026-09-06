/** `ipfs://<cid>` isn't fetchable by a browser <audio>/<img> tag directly —
 * routes through Pinata's own public gateway (§2.43/§2.44), the same
 * service the file was pinned to. The on-chain value itself stays the
 * protocol-neutral ipfs:// form; this is purely a playback convenience,
 * shared between the asset-detail player and the marketplace card preview. */
export function ipfsGatewayUrl(uri: string): string {
  return uri.startsWith('ipfs://') ? `https://gateway.pinata.cloud/ipfs/${uri.slice('ipfs://'.length)}` : uri;
}
