// Mirrors the "catalogue"-kind fictional demo tracks in server/seed-data.js /
// docs/index.html ASSETS. Only catalogue-kind assets are tokenized here —
// preproduction (milestone-escrow) assets use a different mechanism per
// planning/technical-architecture.md §2.7 and aren't part of this contract.
//
// priceWei is an illustrative testnet-only mapping (0.0001 ETH per $1 of the
// mock USD tokenPrice shown in the app) — there's no real USD/ETH peg here,
// it just keeps the relative pricing between catalogues sensible for a demo.
const { ethers } = require("ethers");

module.exports = [
  { tokenId: 1, slug: "midnight-static", supply: 4000, priceWei: ethers.parseEther("0.0025") }, // $25 mock price
  { tokenId: 2, slug: "ember-choir", supply: 2500, priceWei: ethers.parseEther("0.004") }, // $40 mock price
  { tokenId: 3, slug: "paper-cranes", supply: 5000, priceWei: ethers.parseEther("0.0015") }, // $15 mock price
  { tokenId: 4, slug: "copper-radio", supply: 3200, priceWei: ethers.parseEther("0.003") } // $30 mock price
];
