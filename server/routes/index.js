"use strict";
/* Registers every route module on the router, in one place.

   Order is not load-bearing across modules: each owns a distinct path
   prefix, and the router matches literal paths before :param patterns, so
   no module can shadow another. It is listed roughly in the order a user
   meets these endpoints — boot, catalogue, compliance, chain, money —
   purely so this file reads as a table of contents for the API. */

const registerSystemRoutes = require("./system.routes");
const registerCatalogueRoutes = require("./catalogue.routes");
const registerComplianceRoutes = require("./compliance.routes");
const registerOnchainRoutes = require("./onchain.routes");
const registerTokenMetadataRoutes = require("./token-metadata.routes");
const registerPortfolioRoutes = require("./portfolio.routes");
const registerEscrowRoutes = require("./escrow.routes");
const registerListingRoutes = require("./listings.routes");
const registerHolderRoutes = require("./holders.routes");
const registerPriceHistoryRoutes = require("./price-history.routes");
const registerFeeRoutes = require("./fees.routes");
const registerAdminRoutes = require("./admin.routes");
const registerAuthRoutes = require("./auth.routes");
const registerLaunchRoutes = require("./launch.routes");
const registerSignedActionRoutes = require("./signed-action.routes");
const registerRegistrationRoutes = require("./registration.routes");
const registerMediaRoutes = require("./media.routes");

module.exports = function registerRoutes(router) {
  registerSystemRoutes(router);
  registerAuthRoutes(router);
  registerLaunchRoutes(router);
  registerSignedActionRoutes(router);
  registerRegistrationRoutes(router);
  registerCatalogueRoutes(router);
  registerMediaRoutes(router);
  registerComplianceRoutes(router);
  registerOnchainRoutes(router);
  registerTokenMetadataRoutes(router);
  registerPortfolioRoutes(router);
  registerEscrowRoutes(router);
  registerListingRoutes(router);
  registerHolderRoutes(router);
  registerPriceHistoryRoutes(router);
  registerFeeRoutes(router);
  registerAdminRoutes(router);
};
