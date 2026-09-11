"use strict";
/* Builds the request handler: parse the URL, answer CORS preflight, hand
   the rest to the router, 404 anything unmatched.

   Kept separate from server.js so the handler can be constructed without
   opening a port — what a future test suite would do, and what makes the
   routing table inspectable on its own. */

const { createRouter } = require("./lib/router");
const { sendJson } = require("./lib/http");
const registerRoutes = require("./routes");

function createRequestHandler() {
  const router = createRouter();
  registerRoutes(router);

  return async function handleRequest(req, res) {
    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host}`);
    } catch {
      sendJson(res, 400, { error: "malformed request URL" });
      return;
    }

    // Preflight: answered before routing, since the browser sends it for
    // paths that may well not exist yet on this deploy.
    if (req.method === "OPTIONS") { sendJson(res, 204, {}); return; }

    const matched = router.match(req.method, url.pathname);
    if (!matched) { sendJson(res, 404, { error: "not found" }); return; }

    try {
      await matched.handler(req, res, { params: matched.params, url });
    } catch (e) {
      /* Backstop for routes without their own try/catch. Before the split
         these threw into an async handler nobody awaited, which meant an
         unhandled rejection in the log and a request that hung until the
         client gave up. A 500 is not a fix for the underlying error, but
         it does mean the caller always gets an answer. */
      console.error(`Unhandled error in ${req.method} ${url.pathname}`, e);
      if (!res.headersSent) sendJson(res, 500, { error: "internal server error" });
      else res.end();
    }
  };
}

module.exports = { createRequestHandler };
