"use strict";
/* Self-hosted NFT card image (§2.36) — no external asset dependency, no
   artwork to source per track; a small, deterministic, on-brand SVG (same
   purple/cream palette as the site itself) beats the blank/broken image
   every wallet was showing before this endpoint existed at all. */

function xmlEscape(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function tokenImageSvg(title, artist) {
  const t = xmlEscape(title);
  const a = xmlEscape(artist);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6B3FA0"/>
      <stop offset="100%" stop-color="#2A1B3D"/>
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#g)"/>
  <text x="48" y="520" font-family="Georgia, serif" font-size="40" font-weight="600" fill="#F7F4EE">${t}</text>
  <text x="48" y="558" font-family="Helvetica, Arial, sans-serif" font-size="20" fill="#DAC2EE">${a}</text>
  <text x="48" y="64" font-family="Helvetica, Arial, sans-serif" font-size="14" letter-spacing="2" fill="#DAC2EE">HUMFIVERSE · TESTNET</text>
</svg>`;
}

module.exports = { xmlEscape, tokenImageSvg };
