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

/* §2.83 — RS256 key that signs the JWTs opening a thirdweb in-app wallet
   from an identity this backend verified (the EUDIW path). Unset disables
   it: the JWKS endpoint answers 503 and nothing can be signed. The issuer
   and audience must match what is entered under "Custom JWT" in thirdweb's
   dashboard. */
const AUTH_JWT_PRIVATE_KEY = process.env.AUTH_JWT_PRIVATE_KEY || "";
const AUTH_JWT_ISSUER = process.env.AUTH_JWT_ISSUER || TOKEN_METADATA_BASE;
const AUTH_JWT_AUDIENCE = process.env.AUTH_JWT_AUDIENCE || "humfiverse-wallet";

/* §2.93 — transactional email through Brevo (verification codes at
   registration). Unset disables sending: registration then cannot complete
   and is not required either, see services/registration.service.js.
   EMAIL_FROM must be a sender verified in the Brevo dashboard.
   EMAIL_DEV_LOG=1 prints codes to the console instead, for local runs only. */
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "";
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "Humfiverse";
const EMAIL_DEV_LOG = process.env.EMAIL_DEV_LOG === "1";

/* §2.100 — the guide assistant's free-text mode. Unset leaves the widget in
   its guided mode: it answers from the topics it ships with, says so, and
   nothing is ever sent to Anthropic. ANTHROPIC_MODEL lets a deployment pick
   a cheaper model than the default without a code change; ASSISTANT_DAILY_CAP
   is the platform-wide ceiling on answered questions per rolling 24 hours,
   the last line of defence for the bill (per-IP caps are in the service). */
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";
const ASSISTANT_DAILY_CAP = Number(process.env.ASSISTANT_DAILY_CAP || 300);

module.exports = {
  PORT,
  ADMIN_API_KEY,
  TOKEN_METADATA_BASE,
  AUTH_JWT_PRIVATE_KEY,
  AUTH_JWT_ISSUER,
  AUTH_JWT_AUDIENCE,
  BREVO_API_KEY,
  EMAIL_FROM,
  EMAIL_FROM_NAME,
  EMAIL_DEV_LOG,
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL,
  ASSISTANT_DAILY_CAP
};
