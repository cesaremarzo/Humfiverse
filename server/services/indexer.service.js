"use strict";
/* Answers "who holds this token", from HumfiverseCatalogueToken.
 *
 * WHY THIS HAS TO EXIST. ERC-1155 offers `balanceOf(address, id)` and
 * nothing that enumerates holders. So "how many wallets hold this token"
 * — a question the artist dashboard has been answering with a hardcoded
 * zero (§2.64) — cannot be asked of the chain directly. Some record of who
 * has ever touched the token has to be built and kept.
 *
 * TWO MECHANISMS, AND WHY BOTH. `reconcile` is the authority: it collects
 * candidate wallets, reads each one's real balance with `balanceOf`, and
 * checks that holdings plus the unsold pool equal total supply. The
 * eth_getLogs walk below keeps the table current between those passes.
 * The walk alone was not enough, and §2.70 is the story of why: a replayed
 * balance is the sum of every event ever applied to it, so one missed log
 * is permanent, invisible, and unrepairable — it read 45 where the
 * contract held 1300, twice, and reported itself complete both times.
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
const onchainRepo = require("../data/onchain.repo");

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
/** How long a claimed lease lasts. A step is 40 calls at 250ms, so ~10-20s
 * in practice; three minutes leaves room for retries while still freeing
 * the indexer quickly if a process dies mid-step. */
const LEASE_MS = 180_000;

const provider = new ethers.JsonRpcProvider(RPC_URL);
const iface = new ethers.Interface([
  "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
  "event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)"
]);
const TOPICS = [[iface.getEvent("TransferSingle").topicHash, iface.getEvent("TransferBatch").topicHash]];

/* Reads used by the reconciliation below. Deliberately separate from
   chain.js's contract: this module needs them at a pinned block, and a
   snapshot taken at one block is the whole point (see reconcile). */
const token = new ethers.Contract(TOKEN_ADDRESS || ethers.ZeroAddress, [
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function poolBalance(uint256 tokenId) view returns (uint256)",
  "function totalSupplyOf(uint256 tokenId) view returns (uint256)"
], provider);

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
/** Runs `work` as the only writer to the index.
 *
 * Two guards, because they stop different things. The flag stops the
 * ticker racing an admin call inside this process; the database lease
 * stops two processes racing each other, which is what a Render deploy
 * creates and what silently corrupted the index twice. Both the walker
 * and the reconciler write balances, so both take it. */
async function withIndexLock(work) {
  if (!TOKEN_ADDRESS) return { enabled: false };
  if (stepping) return { enabled: true, busy: true };
  stepping = true;
  try {
    if (!(await indexerRepo.claimLease(TOKEN_ADDRESS, LEASE_MS, DEPLOY_BLOCK - 1))) {
      return { enabled: true, busy: true, heldElsewhere: true };
    }
    try {
      return await work();
    } finally {
      await indexerRepo.releaseLease(TOKEN_ADDRESS).catch(() => {});
    }
  } finally {
    stepping = false;
  }
}

async function step(maxCalls = DEFAULT_MAX_CALLS) {
  return withIndexLock(() => runStep(maxCalls));
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

/** Every wallet that has ever sent or received one of this contract's
 * tokens, by token id, from the RPC's own transfer index.
 *
 * One paginated call covers the whole history, with no range cap — the
 * opposite of the eth_getLogs walk below, which needs ~4,100 calls for
 * the same ground. It is a vendor extension, so a provider that does not
 * implement it throws and the caller falls back to whoever the walk has
 * already found. Crucially, nothing here is trusted for *amounts*: this
 * only answers "which wallets are worth asking about", and every balance
 * comes from the contract. That is what makes a wide query safe here
 * while the same shape of query silently lied in 2.39.
 */
async function discoverWallets(toBlock) {
  const byToken = new Map();
  let pageKey;
  do {
    const res = await withRetry(() => provider.send("alchemy_getAssetTransfers", [{
      fromBlock: "0x0",
      toBlock: ethers.toBeHex(toBlock),
      contractAddresses: [TOKEN_ADDRESS],
      category: ["erc1155"],
      excludeZeroValue: false,
      maxCount: "0x3e8",
      ...(pageKey ? { pageKey } : {})
    }]));
    for (const transfer of res.transfers || []) {
      for (const entry of transfer.erc1155Metadata || []) {
        const tokenId = Number(entry.tokenId);
        if (!byToken.has(tokenId)) byToken.set(tokenId, new Set());
        for (const address of [transfer.from, transfer.to]) {
          if (address && isRealHolder(address)) byToken.get(tokenId).add(address.toLowerCase());
        }
      }
    }
    pageKey = res.pageKey;
  } while (pageKey);
  return byToken;
}

/**
 * Rebuilds every token's holdings from the contract, and checks the
 * result adds up.
 *
 * WHY A REPLAY IS NOT ENOUGH. A balance here is the sum of every event
 * ever applied to it, so a single missed log is permanent, invisible, and
 * unrepairable in place. It happened twice in production and neither run
 * reported anything wrong: the walk finished, the cursor reached the head,
 * the flag said complete, and one token read 45 where the contract held
 * 1300. Nothing in a replay can detect that, because the replay is the
 * only thing that knows what the answer should be.
 *
 * WHAT MAKES THIS DIFFERENT. Two independent facts, both from the
 * contract. balanceOf gives each wallet's real holding, so no amount is
 * ever derived. And `held + pool == totalSupply` catches the one thing
 * balanceOf alone cannot — a holder nobody knows to ask about — because a
 * missing wallet's tokens leave a hole in the supply. A token that fails
 * that check has its count withheld instead of shown.
 *
 * Everything is read at one pinned block so the snapshot is internally
 * consistent, and the cursor is moved to that block: the walk then
 * resumes from a verified state instead of re-applying history that is
 * already accounted for.
 */
async function reconcile() {
  return withIndexLock(async () => {
    const block = await provider.getBlockNumber();
    let discovered = new Map();
    let discovery = "asset-transfers";
    try {
      discovered = await discoverWallets(block);
    } catch {
      // A provider without the transfer index: fall back to whatever the
      // eth_getLogs walk has found. The supply check below is what says
      // whether that was enough.
      discovery = "indexed-only";
    }

    const tokens = await onchainRepo.listTokens();
    const assets = {};
    let unbalanced = 0;
    for (const row of tokens) {
      const tokenId = Number(row.token_id);
      const known = (await indexerRepo.holdersOf(tokenId)).map((h) => h.wallet);
      const wallets = [...new Set([...(discovered.get(tokenId) || []), ...known])];

      const holders = [];
      let held = 0n;
      for (const wallet of wallets) {
        const balance = await withRetry(() => token.balanceOf(wallet, tokenId, { blockTag: block }));
        if (balance > 0n) { holders.push({ wallet, balance: balance.toString() }); held += balance; }
        await sleep(CALL_SPACING_MS);
      }
      const pool = await withRetry(() => token.poolBalance(tokenId, { blockTag: block }));
      await sleep(CALL_SPACING_MS);
      const supply = await withRetry(() => token.totalSupplyOf(tokenId, { blockTag: block }));
      await sleep(CALL_SPACING_MS);

      const balanced = held + pool === supply;
      if (!balanced) unbalanced += 1;
      await indexerRepo.replaceHolders(tokenId, holders);
      await indexerRepo.saveAudit(tokenId, {
        balanced, held: held.toString(), pool: pool.toString(), supply: supply.toString(), block
      });
      assets[row.asset_id] = {
        tokenId, holders: holders.length, balanced,
        held: held.toString(), pool: pool.toString(), supply: supply.toString()
      };
    }

    await indexerRepo.setCursor(TOKEN_ADDRESS, block);
    return { enabled: true, block, discovery, tokens: tokens.length, unbalanced, assets };
  });
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
  const [rows, state, audit] = await Promise.all([
    indexerRepo.holdersOf(tokenId), status(), indexerRepo.getAudit(tokenId)
  ]);
  const verified = Boolean(audit && audit.balanced);
  return {
    holders: rows,
    // Withheld rather than guessed when the supply check has not passed:
    // an unverified count is the kind of number this project has already
    // shipped twice and had to retract.
    count: verified ? rows.length : null,
    verified,
    audit,
    complete: Boolean(state.complete),
    indexedToBlock: state.lastBlock ?? null
  };
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
  const unverified = [];
  for (const [assetId, tokenId] of Object.entries(tokenIdsByAsset)) {
    const audit = await indexerRepo.getAudit(tokenId);
    if (audit && audit.balanced) counts[assetId] = (await indexerRepo.holdersOf(tokenId)).length;
    else unverified.push(assetId);
  }
  // An asset simply absent from `counts` is the signal that its count is
  // not known; callers render "not tracked" for it.
  return { complete: Boolean(state.complete), indexedToBlock: state.lastBlock ?? null, counts, unverified };
}

/** Wipes the index and the cursor so the next step replays from the
 * deploy block. Balances are running deltas, so a corrupted index cannot
 * be repaired in place — only rebuilt. */
async function reindex() {
  await indexerRepo.clearAll();
  return { cleared: true, resumesFrom: DEPLOY_BLOCK };
}

module.exports = { step, reconcile, status, holders, holderCounts, reindex, DEPLOY_BLOCK, WINDOW };
