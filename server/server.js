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

const server = http.createServer(createRequestHandler());

initSchema()
  .then(seedIfEmpty)
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Humfiverse backend listening on http://localhost:${PORT} (storage: ${db.usingTurso ? "Turso" : "local file"})`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database", err);
    process.exit(1);
  });
