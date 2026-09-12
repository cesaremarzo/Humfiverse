"use strict";
/* Replays HumfiverseCatalogueToken's transfer log into a holder table.
 *
 * WHY THIS HAS TO EXIST. ERC-1155 offers `balanceOf(address, id)` and
 * nothing that enumerates holders. So "how many wallets hold this token"
 * — a question the artist dashboard has been answering with a hardcoded
 * zero (§2.64) — cannot be asked of the chain directly. The only source is
 * the TransferSingle/TransferBatch log, and the only way to use it is to
 * replay it and keep the running balances.
 *
 * WHY IT IS SLOW, AND WHY THAT IS NOT NEGOTIABLE. The RPC caps
 * `eth_getLogs` at a **hard 10-block range** on the free tier, so the
 * backfill is roughly 4,100 sequential calls. A public RPC does accept a
 * 45,000-block range — and **silently returns an incomplete answer**:
 * measured against the same history, it returned 6 logs where the capped
 * RPC found 15 in the first 400 blocks alone, omitting every early mint
 * without erroring. That is the §2.39 trap, and it is why this walks the
 * chain in tens rather than trusting a wide query.
 *
 * So: a cursor in the database, a bounded number of calls per step, and
 * resumption from wherever it stopped. A free-tier instance sleeps long
 * before a backfill finishes; progress has to survive that.
 *
 * The pool is not a holder. Tokens sitting in the contract's own address
 * (and the zero address) are excluded from counts — they are unsold
 * inventory, not somebody's holding. */

const { ethers } = require("ethers");
const chain = require("../chain");
const { withRetry } = require("../chainRetry");
const indexerRepo = require("../data/indexer.repo");

const RPC_URL = process.env.CHAIN_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const TOKEN_ADDRESS = chain.CONTRACT_ADDRESS;
const DEPLOY_BLOCK = Number(process.env.CHAIN_CONTRACT_DEPLOY_BLOCK || 11647954);
/** The free tier's cap is 10 blocks inclusive, so a window is `from`..`from+9`. */
const WINDOW = 10;
/** Calls per step. Keeps one tick well inside a request timeout; the
 * ticker just runs more steps. */
const DEFAULT_MAX_CALLS = 40;
/** Deliberate pacing between calls.
 *
 * The free tier caps *throughput* as well as range: running windows back
 * to back earns `429 exceeded its compute units per second capacity`
 * within a few hundred calls, which is how the first backfill attempt
 * died. eth_getLogs costs roughly 75 compute units against a ~330/s
 * budget, so four calls a second is about the ceiling. This makes a full
 * backfill take on the order of twenty minutes — acceptable for a
 * resumable background job, and not something a request ever waits on. */
const CALL_SPACING_MS = 250;
/** How far behind the chain head still counts as caught up.
 *
 * Sepolia produces a block every ~12s, so the head moves while the
 * indexer is reporting on itself: a strict `lastBlock >= latest` was false
 * within seconds of finishing a 21-minute backfill, which would have kept
 * every holder count hidden forever. Twenty-five blocks is about five
 * minutes — close enough that a count is worth showing, loose enough that
 * the flag stops flickering. */
const HEAD_TOLERANCE_BLOCKS = 25;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* Only one step at a time.
 *
 * Without this, the background ticker and a manual /api/admin/indexer/step
 * call ran concurrently in the same process: both read the cursor, both
 * scanned from it, both wrote it back. Interleaved at their await points
 * they duplicated some windows and skipped others, and since each log is
 * applied as a *delta* to a running balance, both errors corrupt the
 * result silently. It did exactly that to production — the index claimed
 * 45 tokens where the contract held 1300, and invented a holder with 1
 * where the contract held none.
 *
 * A module-level flag is enough because both callers live in this one
 * process. A second instance would need a real lock; there is only ever
 * one here. */
let stepping = false;

const provider = new ethers.JsonRpcProvider(RPC_URL);
const iface = new ethers.Interface([
  "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
  "event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)"
]);
const TOPICS = [[iface.getEvent("TransferSingle").topicHash, iface.getEvent("TransferBatch").topicHash]];

function isRealHolder(address) {
  const a = address.toLowerCase();
  return a !== ethers.ZeroAddress && a !== TOKEN_ADDRESS.toLowerCase();
}

/** Applies one log's balance movements. Mints come from the zero address
 * and burns go to it; both are just one-sided moves here. */
async function applyLog(log) {
  const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
  if (!parsed) return;
  const moves = parsed.name === "TransferSingle"
    ? [[parsed.args.id, parsed.args.value]]
    : parsed.args.ids.map((id, i) => [id, parsed.args.values[i]]);

  for (const [id, value] of moves) {
    const tokenId = Number(id);
    const amount = BigInt(value);
    if (amount === 0n) continue;
    if (isRealHolder(parsed.args.from)) await indexerRepo.applyDelta(tokenId, parsed.args.from, -amount);
    if (isRealHolder(parsed.args.to)) await indexerRepo.applyDelta(tokenId, parsed.args.to, amount);
  }
}

/**
 * Advances the index by at most `maxCalls` windows. Returns where it got
 * to and whether it has caught up, so a caller can decide to keep going.
 *
 * The cursor is written after each window, not at the end: a step that
 * dies halfway has still made real progress, and re-running repeats at
 * most one window. Re-applying a window would double-count, which is why
 * the cursor moves with the work rather than after it.
 */
async function step(maxCalls = DEFAULT_MAX_CALLS) {
  if (!TOKEN_ADDRESS) return { enabled: false };
  if (stepping) return { enabled: true, busy: true };
  stepping = true;
  try {
    return await runStep(maxCalls);
  } finally {
    stepping = false;
  }
}

async function runStep(maxCalls) {
  const latest = await provider.getBlockNumber();
  let from = (await indexerRepo.getCursor(TOKEN_ADDRESS)) ?? DEPLOY_BLOCK - 1;
  if (from >= latest) return { enabled: true, caughtUp: true, lastBlock: from, latest, scanned: 0, logs: 0 };

  let calls = 0;
  let logsSeen = 0;
  while (calls < maxCalls && from < latest) {
    const start = from + 1;
    const end = Math.min(start + WINDOW - 1, latest);
    // withRetry absorbs a transient rate-limit or network blip; the pacing
    // below is what stops us provoking one in the first place.
    const logs = await withRetry(() =>
      provider.getLogs({ address: TOKEN_ADDRESS, fromBlock: start, toBlock: end, topics: TOPICS })
    );
    for (const log of logs) await applyLog(log);
    logsSeen += logs.length;
    from = end;
    await indexerRepo.setCursor(TOKEN_ADDRESS, from);
    calls += 1;
    if (calls < maxCalls && from < latest) await sleep(CALL_SPACING_MS);
  }
  return { enabled: true, caughtUp: from >= latest, lastBlock: from, latest, scanned: calls * WINDOW, logs: logsSeen };
}

async function status() {
  if (!TOKEN_ADDRESS) return { enabled: false };
  const lastBlock = await indexerRepo.getCursor(TOKEN_ADDRESS);
  let latest = null;
  try { latest = await provider.getBlockNumber(); } catch { /* report what we have */ }
  const startedAt = DEPLOY_BLOCK - 1;
  const done = lastBlock === null ? 0 : lastBlock - startedAt;
  const total = latest === null ? null : latest - startedAt;
  return {
    enabled: true,
    contract: TOKEN_ADDRESS,
    lastBlock,
    latest,
    // Whether a holder count from this index can be trusted as complete.
    complete: lastBlock !== null && latest !== null && lastBlock >= latest - HEAD_TOLERANCE_BLOCKS,
    progressPct: total && total > 0 ? Math.min(100, Math.round((done / total) * 1000) / 10) : null
  };
}

/** Holders of one token id, plus whether the index has caught up. The flag
 * travels with the number on purpose: a count taken mid-backfill is a
 * lower bound, and this project has spent a whole session learning not to
 * present a partial answer as a settled one. */
async function holders(tokenId) {
  const [rows, state] = await Promise.all([indexerRepo.holdersOf(tokenId), status()]);
  return { holders: rows, count: rows.length, complete: Boolean(state.complete), indexedToBlock: state.lastBlock ?? null };
}

/** Counts for many assets at once, keyed by asset id.
 *
 * One request for a page of cards rather than one per card — the same
 * mistake the per-asset on-chain reads made (§2.56), not worth repeating.
 * `complete` is shared across the whole response because it describes the
 * index, not any one token. */
async function holderCounts(tokenIdsByAsset) {
  const state = await status();
  const counts = {};
  for (const [assetId, tokenId] of Object.entries(tokenIdsByAsset)) {
    counts[assetId] = (await indexerRepo.holdersOf(tokenId)).length;
  }
  return { complete: Boolean(state.complete), indexedToBlock: state.lastBlock ?? null, counts };
}

/** Wipes the index and the cursor so the next step replays from the
 * deploy block. Balances are running deltas, so a corrupted index cannot
 * be repaired in place — only rebuilt. */
async function reindex() {
  await indexerRepo.clearAll();
  return { cleared: true, resumesFrom: DEPLOY_BLOCK };
}

module.exports = { step, status, holders, holderCounts, reindex, DEPLOY_BLOCK, WINDOW };
