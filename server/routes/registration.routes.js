"use strict";
/* /api/registration — email verification at registration (§2.93). See
   services/registration.service.js for the rules. */

const { sendJson, readBody } = require("../lib/http");
const registration = require("../services/registration.service");

/** Render sits behind a proxy: the client is the first forwarded hop. */
function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || null;
}

function sendError(res, e) {
  if (e instanceof SyntaxError) return sendJson(res, 400, { error: "malformed JSON body" });
  switch (e.code) {
    case "invalid": return sendJson(res, 400, { error: e.message });
    case "wrong-code": return sendJson(res, 400, { error: e.message, code: "wrong-code", attemptsLeft: e.attemptsLeft });
    case "expired": return sendJson(res, 410, { error: e.message, code: "expired" });
    case "unauthorized": return sendJson(res, 401, { error: e.message });
    case "rate-limited": return sendJson(res, 429, { error: e.message, retryAfter: e.retryAfter });
    case "not-configured": return sendJson(res, 503, { error: e.message });
    default: return sendJson(res, 502, { error: "could not complete the verification", detail: String(e.message || e) });
  }
}

module.exports = function registerRegistrationRoutes(router) {
  router.post("/api/registration/email/start", async (req, res) => {
    try {
      const body = await readBody(req);
      sendJson(res, 200, await registration.startEmailVerification({
        wallet: body.wallet,
        email: body.email,
        locale: body.locale,
        ip: clientIp(req)
      }));
    } catch (e) {
      sendError(res, e);
    }
  });

  router.post("/api/registration/email/confirm", async (req, res) => {
    try {
      const body = await readBody(req);
      sendJson(res, 200, await registration.confirmEmailVerification({
        verificationId: body.verificationId,
        code: body.code,
        auth: body.auth,
        ip: clientIp(req)
      }));
    } catch (e) {
      sendError(res, e);
    }
  });

  /* Public, so it says only whether a wallet is registered, and whether this
     deployment asks for it — never the address. */
  router.get("/api/registration/status/:wallet", async (req, res, { params }) => {
    try {
      sendJson(res, 200, await registration.getStatus(params.wallet));
    } catch (e) {
      sendJson(res, 502, { error: "could not read registration status", detail: String(e.message || e) });
    }
  });
};
