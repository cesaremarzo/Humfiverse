"use strict";
/* Signs the JWTs that open a thirdweb in-app wallet from an identity this
   backend has verified itself (§2.83) — the path an EU Digital Identity
   Wallet login will take. thirdweb's "Custom JWT" auth checks each token
   against the public key served by GET /api/auth/jwks.json, and derives the
   wallet from `sub`: the same sub always opens the same wallet.

   That makes `issueIdentityJwt` exactly as powerful as the wallets it can
   open. It is deliberately not reachable from any route yet. Whatever calls
   it must first have verified the person — for EUDIW, an OpenID4VP
   presentation of the PID checked against the issuer's trust list — and
   must derive `sub` from a stable identifier inside that credential (e.g.
   an HMAC of the national personal identifier under a server-side secret),
   never from anything the browser sends.

   No dependency: Node's crypto signs RS256 and exports the JWK directly. */

const crypto = require("crypto");
const { AUTH_JWT_PRIVATE_KEY, AUTH_JWT_ISSUER, AUTH_JWT_AUDIENCE } = require("../config");

let keyCache = null;

function codedError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function keys() {
  if (!AUTH_JWT_PRIVATE_KEY) return null;
  if (!keyCache) {
    // Render env vars hold one line, so "\n" arrives escaped.
    const privateKey = crypto.createPrivateKey(AUTH_JWT_PRIVATE_KEY.replace(/\\n/g, "\n"));
    const publicJwk = crypto.createPublicKey(privateKey).export({ format: "jwk" });
    // RFC 7638 thumbprint, so the kid changes exactly when the key does.
    const thumbprint = JSON.stringify({ e: publicJwk.e, kty: publicJwk.kty, n: publicJwk.n });
    const kid = crypto.createHash("sha256").update(thumbprint).digest("base64url");
    keyCache = { privateKey, publicJwk: { ...publicJwk, kid, alg: "RS256", use: "sig" }, kid };
  }
  return keyCache;
}

function enabled() {
  return !!AUTH_JWT_PRIVATE_KEY;
}

function getJwks() {
  const k = keys();
  if (!k) throw codedError("not-configured", "AUTH_JWT_PRIVATE_KEY is not set");
  return { keys: [k.publicJwk] };
}

const b64 = obj => Buffer.from(JSON.stringify(obj)).toString("base64url");

/** Short-lived by default: the token is only used once, to open the wallet. */
function issueIdentityJwt({ subject, ttlSeconds = 300, claims = {} }) {
  const k = keys();
  if (!k) throw codedError("not-configured", "AUTH_JWT_PRIVATE_KEY is not set");
  if (typeof subject !== "string" || !subject) throw codedError("invalid-subject", "subject is required");
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT", kid: k.kid };
  const payload = { ...claims, iss: AUTH_JWT_ISSUER, aud: AUTH_JWT_AUDIENCE, sub: subject, iat: now, exp: now + ttlSeconds };
  const signingInput = `${b64(header)}.${b64(payload)}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(signingInput), k.privateKey).toString("base64url");
  return `${signingInput}.${signature}`;
}

module.exports = { enabled, getJwks, issueIdentityJwt };
