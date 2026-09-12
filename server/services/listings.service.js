"use strict";
/* Secondary-market resale, now genuinely on chain.
 *
 * What changed, and why it matters. Until §2.58 a listing was a row this
 * server wrote on request, with `seller` supplied as a string in the body
 * — so anyone could publish an offer on any wallet's behalf, and cancel
 * anyone else's. A signed message closed the impersonation hole but still
 * only proved *who asked*: the offer itself remained non-binding, because
 * nothing could make a seller hand over tokens when a buyer turned up.
 *
 * Now `HumfiverseMarketplace.list()` is a transaction from the seller's
 * own wallet. `msg.sender` is the authentication, and the contract also
 * requires `isApprovedForAll`, so it can actually move the tokens at
 * purchase time. Humfiverse has no function on that contract at all —
 * this server cannot list, cancel, or transfer anything for anyone.
 *
 * Which leaves this module doing one narrow job: keeping the list of
 * listing ids that exist, and reading each one's live state back off the
 * contract. It is an index, not a ledger.
 *
 * The contract is non-custodial by design: tokens stay in the seller's
 * wallet until someone buys, and transfer atomically at that moment. So a
 * seller can still move their tokens after listing, and a listing can
 * outlive the balance behind it — `buyListing` then reverts rather than
 * half-completing. Surfaced to buyers rather than hidden. */

const chainMarketplace = require("../chainMarketplace");
const chain = require("../chain");
const listingsRepo = require("../data/listings.repo");
const onchainRepo = require("../data/onchain.repo");

function invalid(message, code = "invalid") {
  return Object.assign(new Error(message), { code });
}

function marketplaceEnabled() {
  return chainMarketplace.marketplaceEnabled();
}

function marketplaceAddress() {
  return chainMarketplace.MARKETPLACE_ADDRESS || null;
}

/**
 * Every open listing, read from the contract.
 *
 * `deliverable` says whether the seller still holds what they are
 * offering. The contract checks the balance when a listing is created,
 * not continuously, so this can go false afterwards — the buy would
 * revert. Better shown than discovered at signing time.
 */
async function listActive() {
  if (!marketplaceEnabled()) return [];
  const indexed = await listingsRepo.listIndexed();

  const results = await Promise.all(
    indexed.map(async (row) => {
      let listing;
      try {
        listing = await chainMarketplace.getListing(row.listing_id);
      } catch {
        // An unreadable listing is omitted rather than guessed at. It stays
        // indexed, so the next request tries again.
        return null;
      }
      if (!listing) {
        // Cancelled or fully sold. Stop re-reading it.
        await listingsRepo.forget(row.listing_id).catch(() => {});
        return null;
      }
      let deliverable = true;
      try {
        deliverable = (await chain.getBalance(listing.tokenId, listing.seller)) >= listing.qty;
      } catch {
        /* leave it true rather than accuse a seller on a failed read */
      }
      return {
        id: String(listing.listingId),
        listingId: listing.listingId,
        assetId: row.asset_id,
        seller: listing.seller,
        qty: listing.qty,
        pricePerTokenWei: listing.pricePerTokenWei,
        deliverable,
        contractAddress: chainMarketplace.MARKETPLACE_ADDRESS,
        explorerUrl: `${chainMarketplace.EXPLORER_BASE}/address/${chainMarketplace.MARKETPLACE_ADDRESS}`,
        txHash: row.tx_hash,
        createdAt: row.created_at
      };
    })
  );
  return results.filter(Boolean).sort((a, b) => Number(BigInt(a.pricePerTokenWei) - BigInt(b.pricePerTokenWei)) || a.listingId - b.listingId);
}

/**
 * Records a listing id the seller has just created on chain.
 *
 * Needs no authentication, which is worth stating plainly: the id is
 * checked against the contract, and a listing that does not exist there,
 * or whose token id is not this asset's, never enters the index. The
 * thing being trusted is the contract, not the caller. The worst a bad
 * actor can do is index a real listing that already exists, which is
 * where it was heading anyway.
 */
async function indexListing({ listingId, assetId }) {
  if (!marketplaceEnabled()) throw invalid("the marketplace contract is not configured on this server", "unavailable");
  const id = Number(listingId);
  if (!Number.isInteger(id) || id <= 0) throw invalid("listingId must be a positive whole number");
  if (!assetId || typeof assetId !== "string") throw invalid("assetId is required");

  const token = await onchainRepo.findTokenByAssetId(assetId);
  if (!token) throw invalid("this asset has no on-chain token", "no_token");

  const listing = await chainMarketplace.verifyListingMatches(id, token.token_id);
  if (!listing) throw invalid("no active listing with this id for this asset on the marketplace contract", "not_found");

  await listingsRepo.index({
    listingId: id,
    assetId,
    tokenId: token.token_id,
    txHash: null,
    createdAt: new Date().toISOString()
  });
  return listing;
}

module.exports = { marketplaceEnabled, marketplaceAddress, listActive, indexListing };
