"use strict";
/* Two portfolio reads that don't belong to the same world:

   - getWalletHoldings: the real one (§2.37/§2.39). Reads known token ids
     from the local table and does a balanceOf per token.
   - redeem: the simulated one, still operating on the wallet-less
     `holdings`/`distributions` tables the original mock used. */

const chain = require("../chain");
const onchainRepo = require("../data/onchain.repo");
const portfolioRepo = require("../data/portfolio.repo");
const { fakeTxHash, currentMonthLabel } = require("../lib/receipts");

const WALLET_PATTERN = /^0x[0-9a-fA-F]{40}$/;

/** Without this check, ethers treats anything that isn't a valid address
 * as an ENS name and tries to resolve it — a malformed address then
 * surfaces as an opaque "ResolverNotFound" 502 instead of a clear 400
 * (caught testing this route by hand). */
function isValidWallet(wallet) {
  return WALLET_PATTERN.test(wallet);
}

/** §2.39: the known token ids come from the local table, not a live
 * eth_getLogs scan — a full-history scan is impractical under any
 * free-tier RPC's block-range cap, and balanceOf/poolBalance are plain
 * state reads, not subject to that cap at all. This avoids eth_getLogs
 * entirely. */
async function getWalletHoldings(wallet) {
  const rows = await onchainRepo.listTokens();
  const withBalances = await Promise.all(
    rows.map(async (r) => {
      const [tokens, info] = await Promise.all([
        chain.getBalance(r.token_id, wallet),
        chain.getPoolInfo(r.token_id)
      ]);
      // poolBalance/totalSupply ride along for free — getPoolInfo()
      // already reads them, and the frontend's portfolio dashboard
      // needs them to know whether this asset's primary sale is still
      // open (see core/token-value.util.ts).
      return {
        assetId: r.asset_id,
        tokenId: r.token_id,
        tokens,
        priceWei: info.priceWei,
        title: info.onchainTitle,
        artist: info.onchainArtist,
        poolBalance: info.poolBalance,
        totalSupply: info.totalSupply
      };
    })
  );
  return withBalances.filter((m) => m.tokens > 0);
}

async function redeem(assetId) {
  let amount = 0;
  const holdings = await portfolioRepo.listUnclaimedHoldings();
  const month = currentMonthLabel();

  const targets = assetId === "all" ? holdings : holdings.filter(h => h.assetId === assetId);
  for (const h of targets) {
    if (h.unclaimed > 0) {
      amount += h.unclaimed;
      await portfolioRepo.insertDistribution(month, h.assetId, h.unclaimed);
      await portfolioRepo.clearUnclaimed(h.assetId);
    }
  }
  return { amount, txHash: fakeTxHash(), portfolio: await portfolioRepo.getSimulatedPortfolio() };
}

/** Today in UTC, as YYYY-MM-DD — the snapshot table's per-day key. */
function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = { isValidWallet, getWalletHoldings, redeem, todayUtc };
