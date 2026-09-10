"use strict";
/* The X-Admin-Key check gating every /api/admin/* route plus the two
   destructive asset routes. Fails closed: an unconfigured ADMIN_API_KEY
   means "admin endpoints are disabled", never "admin endpoints are open".
   Compared with timingSafeEqual, which requires equal lengths — hence the
   explicit length check first (it would throw otherwise). */

const crypto = require("node:crypto");
const { ADMIN_API_KEY } = require("../config");
const { sendJson } = require("./http");

function isAdminAuthorized(req) {
  if (!ADMIN_API_KEY) return false; // fail closed: unconfigured means disabled, not open
  const provided = req.headers["x-admin-key"];
  if (typeof provided !== "string" || provided.length !== ADMIN_API_KEY.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(ADMIN_API_KEY));
}

/** Guard shorthand for route handlers: sends the 401 and returns false
 * when the caller isn't authorized, so a handler reads
 * `if (!requireAdmin(req, res)) return;` instead of repeating the same
 * five lines it did at each of the five admin-gated routes. */
function requireAdmin(req, res) {
  if (isAdminAuthorized(req)) return true;
  sendJson(res, 401, { error: "missing or invalid X-Admin-Key header" });
  return false;
}

module.exports = { isAdminAuthorized, requireAdmin };
