"use strict";
/* Price history of a token: the prices it has actually changed hands at.
 *
 * WHAT COUNTS AS A TRADE. Only a transfer somebody paid for, at the price
 * the receipt proves:
 *   - `escrow`      a contribution to the token's escrow campaign. The
 *                   price is what the contributor sent (credited amount
 *                   plus the fee retained) over the tokens released to
 *                   them in the same transaction;
 *   - `primary`     a direct `buy()` on the token contract, paid / amount;
 *   - `resale`      a `buyListing()` on HumfiverseMarketplace, paid /
 *                   amount, matched to the TransferSingle of this token id
 *                   in the same receipt (Purchased itself carries no id).
 * A mint, a free `releaseFromPool` or a wallet-to-wallet transfer is not a
 * price, and is skipped rather than drawn as one.
 *
 * WHERE THE TRANSACTIONS COME FROM. `alchemy_getAssetTransfers` for this
 * token contract: one paginated call over the whole history, no 10-block
 * cap (§2.39), the same vendor extension the holder reconcile already
 * relies on. It only says *which* transactions touched the token; every
 * price comes from the receipt's own logs. Each receipt is read once and
 * cached in `token_trades` / `token_trade_scans`.
 *
 * WHAT THE CHART SHOWS. One point per UTC day, from the first trade to
 * today: the lowest price the token traded at on that day, or, on a day
 * with no trade, the last such lowest price, flagged `traded: false`. */

const { ethers } = require("ethers");
const chain = require("../chain");
const chainEscrow = require("../chainEscrow");
const chainMarketplace = require("../chainMarketplace");
const { withRetry } = require("../chainRetry");
const { toUsdcFor } = require("../chainUnits");
const tradesRepo = require("../data/trades.repo");
const onchainRepo = require("../data/onchain.repo");

const RPC_URL = process.env.CHAIN_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const TOKEN_ADDRESS = chain.CONTRACT_ADDRESS;
/** A page view must not cost a transfer-index call each time. */
const REFRESH_EVERY_MS = 60_000;
/** Receipts read per refresh, so a token with a long unscanned history
 * fills in over a few requests instead of holding one open. */
const MAX_RECEIPTS_PER_REFRESH = 50;

const provider = new ethers.JsonRpcProvider(RPC_URL);
const iface = new ethers.Interface([
  "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
  "event TokensReleased(uint256 indexed tokenId, address indexed to, uint256 amount)",
  "event TokensPurchased(uint256 indexed tokenId, address indexed buyer, uint256 amount, uint256 paid)",
  "event Contributed(uint256 indexed campaignId, address indexed contributor, uint256 amount, uint256 totalRaised)",
  "event ContributionFeeRetained(uint256 indexed campaignId, address indexed contributor, uint256 fee)",
  "event Purchased(uint256 indexed listingId, address indexed buyer, uint256 amount, uint256 platformFee, uint256 paid)"
]);
const paymentTokenAbi = ["function paymentToken() view returns (address)"];

const lower = (a) => (a || "").toLowerCase();
// Only the live escrow: a legacy one (§2.73) sold tokens of a previous
// token contract, which this history is not about.
const ESCROW = lower(chainEscrow.ESCROW_ADDRESS);
const MARKETPLACE = lower(chainMarketplace.MARKETPLACE_ADDRESS);

/** Converter to USDC base units for the contract at `address` (§2.73). */
const converters = new Map();
function convertFor(address) {
  if (!converters.has(address)) {
    const p = toUsdcFor(new ethers.Contract(address, paymentTokenAbi, provider));
    p.catch(() => converters.delete(address));
    converters.set(address, p);
  }
  return converters.get(address);
}

/** Every transaction that moved this token id, with its block and time. */
async function transfersOf(tokenId) {
  const txs = new Map();
  let pageKey;
  do {
    const res = await withRetry(() => provider.send("alchemy_getAssetTransfers", [{
      fromBlock: "0x0",
      toBlock: "latest",
      contractAddresses: [TOKEN_ADDRESS],
      category: ["erc1155"],
      withMetadata: true,
      excludeZeroValue: false,
      maxCount: "0x3e8",
      ...(pageKey ? { pageKey } : {})
    }]));
    for (const t of res.transfers || []) {
      if (!(t.erc1155Metadata || []).some((m) => Number(m.tokenId) === tokenId)) continue;
      txs.set(t.hash, { block: Number(t.blockNum), tradedAt: t.metadata && t.metadata.blockTimestamp });
    }
    pageKey = res.pageKey;
  } while (pageKey);
  return txs;
}

function parse(log) {
  try {
    const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
    return parsed ? { name: parsed.name, args: parsed.args, address: lower(log.address), index: log.index } : null;
  } catch {
    return null;
  }
}

/** Every paid trade in one receipt, of any token id: a receipt is scanned
 * once for the whole contract, so a transaction touching two ids must
 * yield both. */
async function tradesInReceipt(receipt, block, tradedAt) {
  const logs = receipt.logs.map(parse).filter(Boolean);
  const token = lower(TOKEN_ADDRESS);
  const used = new Set();
  const trades = [];
  const push = (logIndex, tokenId, source, qty, paid) => {
    if (qty <= 0n) return;
    trades.push({ logIndex, tokenId: Number(tokenId), source, qty: Number(qty), priceUsdc: (paid / qty).toString(), block, tradedAt });
  };
  const nextAfter = (index, match) => logs.find((l) => l.index > index && !used.has(l.index) && match(l));

  for (const log of logs) {
    if (log.address === token && log.name === "TokensPurchased") {
      push(log.index, log.args.tokenId, "primary", log.args.amount, (await convertFor(token))(log.args.paid));
    }

    if (log.address === ESCROW && log.name === "Contributed") {
      const contributor = lower(log.args.contributor);
      const released = nextAfter(log.index, (l) =>
        l.address === token && l.name === "TokensReleased" && lower(l.args.to) === contributor);
      if (!released) continue;
      used.add(released.index);
      const fee = logs.filter((l) => l.address === log.address && l.name === "ContributionFeeRetained" &&
        l.index < log.index && lower(l.args.contributor) === contributor &&
        l.args.campaignId === log.args.campaignId).pop();
      const toUsdc = await convertFor(log.address);
      push(log.index, released.args.tokenId, "escrow", released.args.amount, toUsdc(log.args.amount) + (fee ? toUsdc(fee.args.fee) : 0n));
    }

    if (MARKETPLACE && log.address === MARKETPLACE && log.name === "Purchased") {
      const buyer = lower(log.args.buyer);
      const moved = logs.find((l) => !used.has(l.index) && l.address === token && l.name === "TransferSingle" &&
        lower(l.args.to) === buyer && l.args.value === log.args.amount);
      if (!moved) continue;
      used.add(moved.index);
      push(log.index, moved.args.id, "resale", log.args.amount, (await convertFor(MARKETPLACE))(log.args.paid));
    }
  }
  return trades;
}

const lastRefresh = new Map();

/** Reads receipts for this token's transactions not yet scanned. */
async function refresh(tokenId) {
  const previous = lastRefresh.get(tokenId);
  if (previous && Date.now() - previous.at < REFRESH_EVERY_MS) return previous.done;
  const done = (async () => {
    const [txs, scanned] = await Promise.all([transfersOf(tokenId), tradesRepo.scannedTxHashes(TOKEN_ADDRESS)]);
    const unscanned = [...txs.entries()].filter(([hash]) => !scanned.has(hash));
    let read = 0;
    for (const [hash, meta] of unscanned.slice(0, MAX_RECEIPTS_PER_REFRESH)) {
      const receipt = await withRetry(() => provider.getTransactionReceipt(hash));
      if (!receipt) continue; // not mined yet from this node's view; next refresh
      const tradedAt = meta.tradedAt || new Date((await withRetry(() => provider.getBlock(receipt.blockNumber))).timestamp * 1000).toISOString();
      await tradesRepo.saveScan(TOKEN_ADDRESS, hash, await tradesInReceipt(receipt, receipt.blockNumber, tradedAt));
      read += 1;
    }
    return read === unscanned.length;
  })();
  lastRefresh.set(tokenId, { at: Date.now(), done });
  done.catch(() => lastRefresh.delete(tokenId));
  return done;
}

/** One point per UTC day from the first trade to `today`. */
function dailyLowest(trades, today = new Date()) {
  if (!trades.length) return [];
  const lowestByDay = new Map();
  for (const t of trades) {
    const day = t.tradedAt.slice(0, 10);
    const price = BigInt(t.priceUsdc);
    if (!lowestByDay.has(day) || price < lowestByDay.get(day)) lowestByDay.set(day, price);
  }
  const days = [];
  const end = today.toISOString().slice(0, 10);
  let last = null;
  for (let d = new Date(`${trades[0].tradedAt.slice(0, 10)}T00:00:00Z`); d.toISOString().slice(0, 10) <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    const traded = lowestByDay.has(day);
    if (traded) last = lowestByDay.get(day);
    days.push({ date: day, priceUsdc: last.toString(), traded });
  }
  return days;
}

async function priceHistory(assetId) {
  const token = await onchainRepo.findTokenByAssetId(assetId);
  if (!token) throw Object.assign(new Error("this asset has no on-chain token"), { code: "no_token" });
  const tokenId = Number(token.token_id);

  let complete = true;
  let refreshError = null;
  try {
    complete = await refresh(tokenId);
  } catch (e) {
    // The cache is still true as far as it goes; say it may be behind, and
    // why: a bare `complete: false` gave nothing to diagnose with.
    complete = false;
    refreshError = String((e && (e.shortMessage || e.message)) || e).slice(0, 300);
  }

  const trades = (await tradesRepo.tradesOf(TOKEN_ADDRESS, tokenId)).map((r) => ({
    txHash: r.tx_hash,
    source: r.source,
    qty: Number(r.qty),
    priceUsdc: r.price_usdc,
    block: Number(r.block),
    tradedAt: r.traded_at
  }));
  const daily = dailyLowest(trades);
  return {
    assetId,
    tokenId,
    complete,
    refreshError,
    lastLowestPriceUsdc: daily.length ? daily[daily.length - 1].priceUsdc : null,
    daily,
    trades
  };
}

module.exports = { priceHistory, dailyLowest, tradesInReceipt };
