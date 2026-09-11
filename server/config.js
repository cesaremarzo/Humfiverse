"use strict";
/* Every environment-derived constant the backend reads, in one place.

   Deliberately a plain module of constants, not a config *loader*: these
   are read once at require time, exactly as they were when they lived at
   the top of server.js. `require("dotenv").config()` runs in server.js
   before anything requires this file, so process.env is already populated
   by the time these evaluate. */

const PORT = process.env.PORT || 3001;

/* Gates the admin-only endpoints — the ones that clear cached on-chain
   state or delete public marketplace rows. Every other write endpoint is
   a normal user action triggered by the onboarding wizard and stays open;
   see planning/technical-architecture.md §2.21. */
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";

/* §2.36 — must match the domain baked into HumfiverseCatalogueToken's own
   metadata URI (see the contract's constructor/setURI), since the image
   field inside each token's metadata JSON links back here. */
const TOKEN_METADATA_BASE = process.env.TOKEN_METADATA_BASE || "https://humfiverse-api.onrender.com";

module.exports = { PORT, ADMIN_API_KEY, TOKEN_METADATA_BASE };
