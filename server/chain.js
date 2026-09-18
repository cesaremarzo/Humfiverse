"use strict";
/* On-chain integration — talks to HumfiverseCatalogueToken on Sepolia
   (see contracts/contracts/HumfiverseCatalogueToken.sol and
   planning/technical-architecture.md §2.10). This is the one place this
   backend needs a real dependency (ethers) instead of hand-rolling
   JSON-RPC/transaction signing, which isn't reasonable to do safely by hand.

   Reads (poolBalance, totalSupplyOf) work with just an RPC URL — no key
   needed. Writes (mintCatalogue) require CHAIN_OPERATOR_PRIVATE_KEY to be
   set to the contract owner's key. If it isn't set, minting is disabled
   but the rest of the API still works — same graceful-degradation
   pattern as the rest of this backend.

   TESTNET ONLY. The operator key here should never hold real funds. */

const { ethers } = require("ethers");
const { withRetry } = require("./chainRetry");
const { paymentTokenOf, toUsdcFor } = require("./chainUnits");

// Switched from Base Sepolia to real Ethereum Sepolia (§2.35) — easier to
// get testnet ETH (for gas) from faucets there.
const RPC_URL = process.env.CHAIN_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
// §2.96 phase 2 redeploy (royalties, burn, operator; owned by the Safe).
// §2.43 redeploy — added trackAudioUri + setTrackAudioUri, linking a
// minted token to its uploaded track's real IPFS audio (see pinata.js).
const CONTRACT_ADDRESS = process.env.CHAIN_CONTRACT_ADDRESS || "0xa619aCD77D2540a38a2B95FFb051357a921082EF";
// Block this contract was deployed at — starting event queries here instead
// of block 0 keeps each eth_getLogs call well under public RPCs' ~10,000-
// block range limit even as the chain grows. Update after any redeploy.
const CONTRACT_DEPLOY_BLOCK = Number(process.env.CHAIN_CONTRACT_DEPLOY_BLOCK || 11724392);
// Alchemy's free tier caps eth_getLogs at a 10-block range per call (found
// the hard way — the public-RPC default this project used before §2.39
// silently returned *incomplete* results instead of erroring, which is
// worse). 9 keeps every chunk's span (to - from + 1) at 10.
const EVENT_QUERY_CHUNK = 9;
// How far back from the current block a "recent activity" scan looks —
// used to catch a brand-new mint that isn't in the local cache yet,
// without re-scanning the contract's entire history (§2.39): at 10 blocks
// per request that would be well over a thousand calls on a contract this
// old, impractical on any free-tier RPC. The local onchain_tokens table,
// self-healed per asset since §2.18/§2.20, remains the primary source for
// anything older than this window.
const RECENT_SCAN_BLOCKS = 500;
const CHAIN_ID = 11155111; // Sepolia
const EXPLORER_BASE = "https://sepolia.etherscan.io";

const ABI = [
  // §2.79: the artist's funding and supply go in; the contract derives the price.
  "function mintCatalogue(uint256 tokenId, tuple(string slug, string title, string artist) text, uint256 supply, uint256 fundingAmount, address payout, bool directSale)",
  "function payoutOf(uint256) view returns (address)",
  // §2.81: false for a token sold only through its escrow campaign.
  "function directSaleOf(uint256) view returns (bool)",
  "function poolBalance(uint256 tokenId) view returns (uint256)",
  "function totalSupplyOf(uint256) view returns (uint256)",
  "function releasedOf(uint256) view returns (uint256)",
  "function catalogueSlug(uint256) view returns (string)",
  "function pricePerToken(uint256) view returns (uint256)",
  "function trackTitle(uint256) view returns (string)",
  "function artistName(uint256) view returns (string)",
  "function trackAudioUri(uint256) view returns (string)",
  "function setTrackAudioUri(uint256 tokenId, string uri)",
  "function releaseFromPool(address to, uint256 tokenId, uint256 amount)",
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  // §2.72 primary-sale fee — absent on tokens deployed before it.
  "function PRIMARY_FEE_BPS() view returns (uint256)",
  // §2.73: the USDC every price is in — absent on ETH-era tokens.
  "function paymentToken() view returns (address)",
  "function feeRecipient() view returns (address)",
  "function accruedFees() view returns (uint256)",
  "function totalFeesCollected() view returns (uint256)",
  "event CatalogueMinted(uint256 indexed tokenId, string slug, uint256 supply, uint256 pricePerToken, string title, string artist)",
  // §2.92 royalties — absent on tokens deployed before phase 2.
  "function royaltyPerToken(uint256) view returns (uint256)",
  "function outstandingSupply(uint256) view returns (uint256)",
  "function claimableRoyalties(uint256 tokenId, address holder) view returns (uint256)",
  "function totalRoyaltiesDistributed(uint256) view returns (uint256)",
  // The pre-§2.101 name for the same total, kept so this backend can read a
  // token contract deployed before the royalty fee — see readDistributed().
  "function totalRoyaltiesDeposited(uint256) view returns (uint256)",
  "function totalRoyaltiesClaimed(uint256) view returns (uint256)",
  "function payoutRecipient() view returns (address)",
  "event RoyaltiesDeposited(uint256 indexed tokenId, address indexed depositor, uint256 distributed, bytes32 statementRef)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
const readContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

let writeContract = null;
const operatorKey = process.env.CHAIN_OPERATOR_PRIVATE_KEY;
if (operatorKey) {
  const wallet = new ethers.Wallet(operatorKey, provider);
  writeContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
} else {
  console.warn("CHAIN_OPERATOR_PRIVATE_KEY not set — on-chain minting is disabled (reads still work).");
}

function mintingEnabled() {
  return writeContract !== null;
}

async function getPoolInfo(tokenId) {
  const toUsdc = await toUsdcFor(readContract);
  const [poolBalance, totalSupply, released, price, title, artist, audioUri, payout, directSale] = await Promise.all([
    readContract.poolBalance(tokenId),
    readContract.totalSupplyOf(tokenId),
    readContract.releasedOf(tokenId),
    readContract.pricePerToken(tokenId),
    readContract.trackTitle(tokenId),
    readContract.artistName(tokenId),
    readContract.trackAudioUri(tokenId),
    readContract.payoutOf(tokenId).catch(() => null),
    readContract.directSaleOf(tokenId).catch(() => null)
  ]);
  return {
    tokenId,
    contractAddress: CONTRACT_ADDRESS,
    network: "sepolia",
    explorerUrl: `${EXPLORER_BASE}/token/${CONTRACT_ADDRESS}?a=${tokenId}`,
    poolBalance: poolBalance.toString(),
    totalSupply: totalSupply.toString(),
    released: released.toString(),
    priceUsdc: toUsdc(price).toString(),
    // What selling every token raises — price times supply, the same figure
    // an escrow campaign on this token aims for (§2.79).
    fundingUsdc: toUsdc(price * totalSupply).toString(),
    payoutWallet: payout && payout !== ethers.ZeroAddress ? payout : null,
    // null on a token contract that predates §2.81, where buy() was always open.
    directSale,
    onchainTitle: title,
    onchainArtist: artist,
    audioUri
  };
}

/** Links tokenId to its uploaded track's IPFS URI (§2.43) — see
 * trackAudioUri on the contract. Called after server.js's pinata.js module
 * uploads the file and gets a CID back; two independent steps (upload,
 * then on-chain write) that can each fail on their own. */
async function setTrackAudioUriOnchain(tokenId, uri) {
  if (!writeContract) throw new Error("on-chain minting is disabled (no operator key configured)");
  const tx = await withRetry(() => writeContract.setTrackAudioUri(tokenId, uri));
  const receipt = await tx.wait();
  return { txHash: receipt.hash, explorerUrl: `${EXPLORER_BASE}/tx/${receipt.hash}` };
}

/** The local SQLite record of used token ids is only a hint — it can be
 * wiped or fall out of sync with what's actually been minted on-chain
 * (this happened during development: a local DB reset caused a token id
 * collision against a real, already-minted on-chain token). The chain
 * itself is the source of truth: a token id is free only if its
 * totalSupplyOf is still zero. */
async function isTokenIdFree(tokenId) {
  const supply = await readContract.totalSupplyOf(tokenId);
  return supply === 0n;
}

/** A *recent-activity* scan only (§2.39) — deliberately not "from deploy
 * block", which used to mean 1000+ eth_getLogs calls at a free-tier RPC's
 * 10-block cap, impractical regardless of provider. Callers are expected
 * to merge this with the local onchain_tokens table (the real source for
 * anything older than `RECENT_SCAN_BLOCKS`), not treat it as the full
 * picture on its own. Falls back to null on an RPC error so callers can
 * fall back to the local table entirely, matching this backend's usual
 * graceful-degradation pattern. */
async function listRecentlyMintedSlugsFromChain() {
  try {
    const latest = await provider.getBlockNumber();
    const from = Math.max(CONTRACT_DEPLOY_BLOCK, latest - RECENT_SCAN_BLOCKS);
    const filter = readContract.filters.CatalogueMinted();
    const events = [];
    for (let f = from; f <= latest; f += EVENT_QUERY_CHUNK + 1) {
      const t = Math.min(f + EVENT_QUERY_CHUNK, latest);
      const chunk = await withRetry(() => readContract.queryFilter(filter, f, t));
      events.push(...chunk);
    }
    return events.map((e) => ({
      tokenId: Number(e.args.tokenId),
      slug: e.args.slug,
      supply: e.args.supply.toString(),
      priceUsdc: e.args.pricePerToken.toString(),
      title: e.args.title,
      artist: e.args.artist,
      txHash: e.transactionHash,
      blockNumber: e.blockNumber
    }));
  } catch (err) {
    console.warn("Could not read recent CatalogueMinted events from chain.", err.message || err);
    return null;
  }
}

async function mintCatalogueOnchain(tokenId, slug, supply, fundingUsdc, title, artist, payoutWallet, directSale) {
  if (!writeContract) throw new Error("on-chain minting is disabled (no operator key configured)");
  // A USDC price minted on an ETH-era token would be read as wei — a token
  // priced at a hundred-millionth of what the artist asked for.
  if (!(await paymentTokenOf(readContract))) throw new Error("the configured token contract predates USDC pricing; refusing to mint a USDC price on it");
  // Wrapped in withRetry (chainRetry.js) — the free public RPC rate-limits
  // under bursts, and a failure here used to silently drop the campaign
  // from the marketplace even though it had been created (§2.22).
  const tx = await withRetry(() =>
    writeContract.mintCatalogue(tokenId, [slug, title || "", artist || ""], supply, fundingUsdc || 0, payoutWallet || ethers.ZeroAddress, directSale)
  );
  const receipt = await tx.wait();
  return {
    tokenId,
    txHash: receipt.hash,
    contractAddress: CONTRACT_ADDRESS,
    explorerUrl: `${EXPLORER_BASE}/tx/${receipt.hash}`
  };
}

/** Releases `amount` tokens from tokenId's pool straight to `to` — used
 * (§2.34) right after a real, verified escrow contribution, so a
 * preproduction investor's contribution actually moves the same on-chain
 * pool a catalogue purchase does, instead of that pool staying frozen at
 * its minted value forever for preproduction assets (contribute() on
 * HumfiverseMilestoneEscrow never touches this contract on its own — see
 * server.js's releaseForContribution, which is what calls this after
 * verifying the contribution really happened). */
async function releaseFromPoolOnchain(tokenId, to, amount) {
  if (!writeContract) throw new Error("on-chain minting is disabled (no operator key configured)");
  const tx = await withRetry(() => writeContract.releaseFromPool(to, tokenId, amount));
  const receipt = await tx.wait();
  return { txHash: receipt.hash, explorerUrl: `${EXPLORER_BASE}/tx/${receipt.hash}` };
}

/** Real ERC-1155 balance for one holder/token — the actual source of
 * truth for "how many tokens does this wallet hold" (§2.37), unlike the
 * mock Portfolio.holdings this replaced, which was seeded fictional data
 * never tied to a real wallet at all. */
async function getBalance(tokenId, address) {
  const bal = await readContract.balanceOf(address, tokenId);
  return Number(bal);
}

/** The 6% primary-sale fee's state, read off the contract (§2.101). Null when the
 * configured token predates USDC (§2.73), whose fees would be wei. */
async function getFeeState() {
  if (!(await paymentTokenOf(readContract))) return null;
  const bps = await withRetry(() => readContract.PRIMARY_FEE_BPS());
  const [recipient, accrued, total] = await Promise.all([
    withRetry(() => readContract.feeRecipient()),
    withRetry(() => readContract.accruedFees()),
    withRetry(() => readContract.totalFeesCollected())
  ]);
  return {
    contractAddress: CONTRACT_ADDRESS,
    explorerUrl: `https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`,
    feeBps: Number(bps),
    feeRecipient: recipient,
    accruedUsdc: accrued.toString(),
    totalCollectedUsdc: total.toString()
  };
}

/** Whether the configured token pays royalties (§2.92), cached: bytecode
 * never changes. Only a revert means "no"; an RPC failure is rethrown. */
let royaltiesPromise = null;
function royaltiesSupported() {
  if (!royaltiesPromise) {
    royaltiesPromise = withRetry(() => readContract.royaltyPerToken(0))
      .then(() => true)
      .catch((err) => {
        if (err.code === "CALL_EXCEPTION" || err.code === "BAD_DATA") return false;
        royaltiesPromise = null;
        throw err;
      });
  }
  return royaltiesPromise;
}

/** One token's royalty totals, straight from the contract. `poolClaimable`
 * is the unsold tokens' share, which claimPoolRoyalties pays to the
 * token's payout wallet — the artist (§2.92). Null on a token contract
 * without royalties. */
/** Royalties shared out for a token, under whichever name the deployed
 * contract carries it: `totalRoyaltiesDistributed` since §2.101, the older
 * `totalRoyaltiesDeposited` before it. On a pre-§2.101 contract no fee was
 * deducted, so the two are the same number and the fallback reports no
 * different figure than the contract itself does.
 *
 * This exists because the code reaches `main` before the contract is
 * redeployed: the rename shipped in `c34a1bf`, but Sepolia still runs the
 * token deployed at phase 2, where calling the new name returns no data and
 * ethers throws. Without this the whole royalty endpoint 500s in production
 * for every asset. Delete the fallback once the redeploy is done. */
async function readRoyaltiesDistributed(tokenId) {
  try {
    return await readContract.totalRoyaltiesDistributed(tokenId);
  } catch {
    return await withRetry(() => readContract.totalRoyaltiesDeposited(tokenId));
  }
}

async function getRoyaltyState(tokenId) {
  if (!(await royaltiesSupported())) return null;
  const [distributed, claimed, outstanding, pool, poolClaimable, payout] = await Promise.all([
    withRetry(() => readRoyaltiesDistributed(tokenId)),
    withRetry(() => readContract.totalRoyaltiesClaimed(tokenId)),
    withRetry(() => readContract.outstandingSupply(tokenId)),
    withRetry(() => readContract.poolBalance(tokenId)),
    withRetry(() => readContract.claimableRoyalties(tokenId, CONTRACT_ADDRESS)),
    withRetry(() => readContract.payoutOf(tokenId))
  ]);
  const payoutWallet = payout !== ethers.ZeroAddress ? payout : await withRetry(() => readContract.payoutRecipient());
  return {
    tokenId,
    contractAddress: CONTRACT_ADDRESS,
    totalDistributedUsdc: distributed.toString(),
    // The name this field had before §2.101, still served because the bundle
    // on GitHub Pages is only rebuilt at a merge: a browser that loaded the
    // site before this deploy reads the old name and would otherwise show an
    // empty tile. Remove it once docs/ is rebuilt with the new frontend.
    totalDepositedUsdc: distributed.toString(),
    totalClaimedUsdc: claimed.toString(),
    outstandingSupply: outstanding.toString(),
    poolBalance: pool.toString(),
    poolClaimableUsdc: poolClaimable.toString(),
    payoutWallet
  };
}

/** What `holder` can claim on `tokenId` now, in USDC base units, or null
 * on a token contract without royalties. */
async function getClaimableRoyalties(tokenId, holder) {
  if (!(await royaltiesSupported())) return null;
  return (await withRetry(() => readContract.claimableRoyalties(tokenId, holder))).toString();
}

/** Every RoyaltiesDeposited this token contract emitted in `txHash`.
 * The receipt is the proof: a deposit enters the history only if the
 * chain says it happened, whoever reports it. */
async function getRoyaltyDepositsFromTx(txHash) {
  const receipt = await withRetry(() => provider.getTransactionReceipt(txHash));
  if (!receipt || receipt.status !== 1) return null;
  const block = await withRetry(() => provider.getBlock(receipt.blockNumber));
  return receipt.logs
    .filter((l) => l.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase())
    .map((l) => { try { return { log: l, parsed: readContract.interface.parseLog(l) }; } catch { return null; } })
    .filter((e) => e && e.parsed && e.parsed.name === "RoyaltiesDeposited")
    .map(({ log, parsed }) => ({
      txHash: receipt.hash,
      logIndex: log.index,
      tokenId: Number(parsed.args.tokenId),
      depositor: parsed.args.depositor.toLowerCase(),
      amountUsdc: parsed.args.distributed.toString(),
      statementRef: parsed.args.statementRef,
      block: receipt.blockNumber,
      depositedAt: new Date(Number(block.timestamp) * 1000).toISOString()
    }));
}

module.exports = {
  royaltiesSupported,
  getRoyaltyState,
  getClaimableRoyalties,
  getRoyaltyDepositsFromTx,
  getFeeState,
  getBalance,
  mintingEnabled,
  getPoolInfo,
  mintCatalogueOnchain,
  releaseFromPoolOnchain,
  setTrackAudioUriOnchain,
  isTokenIdFree,
  listRecentlyMintedSlugsFromChain,
  CONTRACT_ADDRESS,
  EXPLORER_BASE
};
