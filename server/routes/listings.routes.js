"use strict";
/* /api/listings — the secondary-market offer board.
 *
 * Shared, durable state: a listing created here is visible to every
 * visitor and survives a reload, which is the whole point of the table
 * behind it. It is still not a settled trade — see the header of
 * services/listings.service.js for exactly what is and is not real. */

const { sendJson, readBody } = require("../lib/http");
const listings = require("../services/listings.service");

const STATUS_BY_CODE = {
  invalid: 400,
  no_token: 400,
  insufficient_balance: 409,
  not_found: 404,
  not_seller: 403
};

function fail(res, e, fallbackMessage) {
  const status = STATUS_BY_CODE[e && e.code];
  if (status) { sendJson(res, status, { error: e.message }); return; }
  sendJson(res, 502, { error: fallbackMessage, detail: String((e && e.message) || e) });
}

module.exports = function registerListingRoutes(router) {
  router.get("/api/listings", async (req, res) => {
    try {
      sendJson(res, 200, { listings: await listings.listActive() });
    } catch (e) {
      fail(res, e, "could not read listings");
    }
  });

  router.post("/api/listings", async (req, res) => {
    try {
      const body = await readBody(req);
      sendJson(res, 200, { listing: await listings.create(body) });
    } catch (e) {
      if (e instanceof SyntaxError) { sendJson(res, 400, { error: "malformed JSON body" }); return; }
      fail(res, e, "could not create listing");
    }
  });

  /* Cancel takes the seller in the body rather than the path, so the
     wallet that owns the listing has to be stated explicitly. */
  router.post("/api/listings/:id/cancel", async (req, res, { params }) => {
    try {
      const body = await readBody(req);
      sendJson(res, 200, { ok: true, listing: await listings.cancel(params.id, body.seller) });
    } catch (e) {
      if (e instanceof SyntaxError) { sendJson(res, 400, { error: "malformed JSON body" }); return; }
      fail(res, e, "could not cancel listing");
    }
  });

  router.post("/api/listings/:id/buy", async (req, res, { params }) => {
    try {
      sendJson(res, 200, { ok: true, listing: await listings.buy(params.id) });
    } catch (e) {
      fail(res, e, "could not buy listing");
    }
  });
};
