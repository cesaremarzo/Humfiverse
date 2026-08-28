// Mirrors the "catalogue"-kind fictional demo tracks in server/seed-data.js /
// docs/index.html ASSETS. Only catalogue-kind assets are tokenized here —
// preproduction (milestone-escrow) assets use a different mechanism per
// planning/technical-architecture.md §2.7 and aren't part of this contract.
module.exports = [
  { tokenId: 1, slug: "midnight-static", supply: 4000 },
  { tokenId: 2, slug: "ember-choir", supply: 2500 },
  { tokenId: 3, slug: "paper-cranes", supply: 5000 },
  { tokenId: 4, slug: "copper-radio", supply: 3200 }
];
