"use strict";
/* Simulated receipt identifiers. `fakeTxHash` is exactly what its name
   says — a random 32-byte hex string shaped like a transaction hash, used
   as an opaque receipt id for the parts of this prototype that are NOT on
   chain (contract acceptance, KYC, royalty redemption). Nothing on chain
   ever goes through here; real transaction hashes come back from chain.js
   and chainEscrow.js. */

function fakeTxHash() {
  const chars = "0123456789abcdef";
  let h = "0x";
  for (let i = 0; i < 64; i++) h += chars[Math.floor(Math.random() * 16)];
  return h;
}

function currentMonthLabel() {
  return new Date().toLocaleString("en", { month: "short", year: "2-digit" });
}

module.exports = { fakeTxHash, currentMonthLabel };
