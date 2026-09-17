"use strict";
/* /api/assistant — the guide widget's free-text mode (§2.100). See
   services/assistant.service.js for the caps and assistant-knowledge.js
   for everything the assistant is allowed to say. */

const { sendJson, readBody } = require("../lib/http");
const { requireAdmin } = require("../lib/admin-auth");
const assistant = require("../services/assistant.service");

/** Render sits behind a proxy: the client is the first forwarded hop. */
function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || null;
}

function sendError(res, e) {
  if (e instanceof SyntaxError) return sendJson(res, 400, { error: "malformed JSON body" });
  switch (e.code) {
    case "invalid": return sendJson(res, 400, { error: e.message });
    case "too_large": return sendJson(res, 413, { error: "that message is too long" });
    case "rate-limited": return sendJson(res, 429, { error: e.message, code: "rate-limited", retryAfter: e.retryAfter });
    case "not-configured": return sendJson(res, 503, { error: e.message, code: "not-configured" });
    case "refused": return sendJson(res, 200, { reply: null, code: "refused", error: e.message });
    default:
      /* The upstream detail can name the key or the account, so it stays in
         the log: the widget only needs to know the answer didn't come. */
      console.error("[assistant]", e.message);
      return sendJson(res, 502, { error: "the assistant could not answer just now", code: "upstream" });
  }
}

module.exports = function registerAssistantRoutes(router) {
  /* Public, and deliberately says nothing but whether typed questions work
     on this deployment — the widget asks once, when it is first opened, so
     it can show the right input instead of guessing. */
  router.get("/api/assistant/status", (req, res) => {
    sendJson(res, 200, assistant.status());
  });

  router.post("/api/assistant/ask", async (req, res) => {
    try {
      const body = await readBody(req);
      const answer = await assistant.ask({
        messages: body.messages,
        locale: body.locale,
        ip: clientIp(req)
      });
      sendJson(res, 200, answer);
      // Housekeeping after the answer is out: never delays it, never fails it.
      assistant.prune().catch((e) => console.error("[assistant] prune", e.message));
    } catch (e) {
      sendError(res, e);
    }
  });

  /* Admin: what the widget has cost. No question or answer is stored, so
     there is nothing here but call counts and token totals. */
  router.get("/api/assistant/usage", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      sendJson(res, 200, await assistant.usage());
    } catch (e) {
      sendError(res, e);
    }
  });
};
