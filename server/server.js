"use strict";
/* Humfiverse backend — entry point.

   Replaces the frontend's hardcoded ASSETS/CAMPAIGNS/portfolio arrays with
   a real HTTP API backed by a database (see db.js — a local SQLite file by
   default, a real Turso/libSQL database when TURSO_DATABASE_URL is set;
   §2.23). Most of it is still simulated (no real money, KYC, or SPV) — see
   planning/technical-architecture.md for what a full production backend
   would actually require. The one piece that IS real: the on-chain
   integration in chain.js and chainEscrow.js, which talk to two deployed
   contracts on the Ethereum Sepolia testnet.

   Uses node's built-in http module, plus three real dependencies —
   @libsql/client for storage, ethers for the on-chain integration (not
   reasonable to hand-roll transaction signing) and dotenv. Deliberately no
   web framework: the routing layer it would provide is lib/router.js, at
   about forty lines.

   Run with:
     node server.js
   Configure the port via PORT env var (defaults to 3001). On-chain
   minting needs CHAIN_OPERATOR_PRIVATE_KEY set (see chain.js) — without
   it, everything else still works, minting just stays disabled.

   Layout (see STRUCTURE.md for the full walkthrough):
     config.js    every environment-derived constant
     app.js       builds the request handler
     lib/         framework-shaped plumbing: router, http, auth, receipts
     data/        one repository per group of tables — all the SQL lives here
     services/    domain logic, the only layer that talks to the chain
     routes/      one module per path prefix, HTTP in and HTTP out
*/

require("dotenv").config(); // must run before any module reads process.env

const http = require("node:http");
const { PORT } = require("./config");
const db = require("./db");
const { initSchema, seedIfEmpty } = require("./data/schema");
const { createRequestHandler } = require("./app");
const indexer = require("./services/indexer.service");

const server = http.createServer(createRequestHandler());

/* Two background jobs keep the holder index honest, and they do different
 * jobs. The reconciler re-reads every holding from the contract and checks
 * it adds up; the walker follows the transfer log for movement between
 * reconciliations. The reconciler runs first on purpose — it leaves the
 * cursor at a verified head, so the walker never grinds through a
 * backfill that has already been accounted for.
 *
 * Both are deliberately fire-and-forget: indexing must never delay or fail
 * a request, and a failed tick is retried by the next one. */
const INDEX_TICK_BEHIND_MS = 2_000;
const INDEX_TICK_CAUGHT_UP_MS = 60_000;
/* How often holdings are re-read from the contract and checked against
   total supply. The walk above keeps the index current between passes;
   this is what makes it *verified*, and what repairs it when a log was
   missed. Cheap enough to run often: one transfer-index call plus a
   couple of reads per token. */
const RECONCILE_TICK_MS = 10 * 60_000;

function startReconciler() {
  const tick = async () => {
    let result = null;
    try {
      result = await indexer.reconcile();
      if (result.enabled === false) return;
      if (result.unbalanced) console.warn(`Indexer: ${result.unbalanced} token(s) do not reconcile with total supply.`);
    } catch (err) {
      console.warn("Indexer reconcile failed; will retry.", err.message || err);
    }
    // A pass blocked by the other writer is worth retrying soon rather
    // than leaving counts unverified for ten minutes.
    setTimeout(tick, result && result.busy ? 30_000 : RECONCILE_TICK_MS).unref();
  };
  setTimeout(tick, 1_000).unref();
}

function startIndexer() {
  const tick = async () => {
    let delay = INDEX_TICK_CAUGHT_UP_MS;
    try {
      const result = await indexer.step();
      if (result.enabled === false) return; // no token contract configured; nothing to index
      delay = result.caughtUp ? INDEX_TICK_CAUGHT_UP_MS : INDEX_TICK_BEHIND_MS;
    } catch (err) {
      console.warn("Indexer step failed; will retry.", err.message || err);
    }
    setTimeout(tick, delay).unref();
  };
  setTimeout(tick, 20_000).unref();
}

initSchema()
  .then(seedIfEmpty)
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Humfiverse backend listening on http://localhost:${PORT} (storage: ${db.usingTurso ? "Turso" : "local file"})`);
      startIndexer();
      startReconciler();
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database", err);
    process.exit(1);
  });
