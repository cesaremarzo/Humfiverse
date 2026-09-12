"use strict";
/* /api/listings — the secondary-market board.
 *
 * Read-only, plus one endpoint that records a listing id the contract has
 * already accepted. Creating, cancelling and buying are transactions from
 * the user's own wallet against HumfiverseMarketplace; this server has no
 * way to perform any of them, which is the point. See the header of
 * services/listings.service.js. */

const { sendJson, readBody } = require("../lib/http");
const listings = require("../services/listings.service");

const STATUS_BY_CODE = {
  invalid: 400,
  no_token: 400,
  not_found: 404,
  unavailable: 503
};

function fail(res, e, fallbackMessage) {
  const status = STATUS_BY_CODE[e && e.code];
  if (status) { sendJson(res, status, { error: e.message }); return; }
  sendJson(res, 502, { error: fallbackMessage, detail: String((e && e.message) || e) });
}

module.exports = function registerListingRoutes(router) {
  router.get("/api/listings", async (req, res) => {
    try {
      sendJson(res, 200, {
        marketplaceEnabled: listings.marketplaceEnabled(),
        // Needed before the first listing exists: a seller has to know
        // which contract to send `list()` to, and there is no listing to
        // read the address off yet.
        marketplaceAddress: listings.marketplaceAddress(),
        listings: await listings.listActive()
      });
    } catch (e) {
      fail(res, e, "could not read listings");
    }
  });

  /* Called once the seller's `list()` transaction has confirmed, with the
     listing id the contract returned. Unauthenticated on purpose — the id
     is verified against the contract, so a claim that isn't true there
     simply never enters the index. */
  router.post("/api/listings/index", async (req, res) => {
    try {
      const body = await readBody(req);
      sendJson(res, 200, { ok: true, listing: await listings.indexListing(body) });
    } catch (e) {
      if (e instanceof SyntaxError) { sendJson(res, 400, { error: "malformed JSON body" }); return; }
      fail(res, e, "could not index listing");
    }
  });

  /* Removed, deliberately, and answering 410 rather than 404 for the same
     reason /api/escrow/confirm does (§2.27): these used to exist and were
     taken away on purpose, and a caller deserves to know which.

     Both let this server write an offer on a wallet's behalf. Listing and
     cancelling are now transactions signed by the seller against
     HumfiverseMarketplace, so there is nothing here to call. */
  const gone = (what, instead) => (req, res) => {
    sendJson(res, 410, {
      error: `Humfiverse can no longer ${what} — this is intentional, not a bug`,
      detail: `${instead} See HumfiverseMarketplace.sol and technical-architecture.md §2.59.`
    });
  };
  router.post("/api/listings", gone(
    "create a listing on a seller's behalf",
    "A listing is now the seller's own transaction: HumfiverseMarketplace.list(), which requires msg.sender to be the seller and the marketplace to be approved on the token."
  ));
  router.post("/api/listings/:id/cancel", gone(
    "cancel a listing on a seller's behalf",
    "Cancelling is now HumfiverseMarketplace.cancelListing(), callable only by the listing's own seller."
  ));
  router.post("/api/listings/:id/buy", gone(
    "record a purchase",
    "Buying is now HumfiverseMarketplace.buyListing(), which moves the tokens and pays the seller in one transaction."
  ));
};
