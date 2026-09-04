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

// Switched from Base Sepolia to real Ethereum Sepolia (§2.35) — easier to
// get testnet ETH from faucets there.
const RPC_URL = process.env.CHAIN_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
// §2.42 redeploy — added escrowContract authorization so
// HumfiverseMilestoneEscrow.contribute() can release tokens atomically;
// see HumfiverseMilestoneEscrow.sol and chainEscrow.js.
const CONTRACT_ADDRESS = process.env.CHAIN_CONTRACT_ADDRESS || "0xfd8D1d02Df922B9839D05b5C24cA2C06eD9690dD";
// Block this contract was deployed at — starting event queries here instead
// of block 0 keeps each eth_getLogs call well under public RPCs' ~10,000-
// block range limit even as the chain grows. Update after any redeploy.
const CONTRACT_DEPLOY_BLOCK = Number(process.env.CHAIN_CONTRACT_DEPLOY_BLOCK || 11635555);
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
  "function mintCatalogue(uint256 tokenId, string slug, uint256 supply, uint256 priceWeiPerToken, string title, string artist)",
  "function poolBalance(uint256 tokenId) view returns (uint256)",
  "function totalSupplyOf(uint256) view returns (uint256)",
  "function releasedOf(uint256) view returns (uint256)",
  "function catalogueSlug(uint256) view returns (string)",
  "function pricePerToken(uint256) view returns (uint256)",
  "function trackTitle(uint256) view returns (string)",
  "function artistName(uint256) view returns (string)",
  "function releaseFromPool(address to, uint256 tokenId, uint256 amount)",
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "event CatalogueMinted(uint256 indexed tokenId, string slug, uint256 supply, uint256 priceWeiPerToken, string title, string artist)"
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
  const [poolBalance, totalSupply, released, priceWei, title, artist] = await Promise.all([
    readContract.poolBalance(tokenId),
    readContract.totalSupplyOf(tokenId),
    readContract.releasedOf(tokenId),
    readContract.pricePerToken(tokenId),
    readContract.trackTitle(tokenId),
    readContract.artistName(tokenId)
  ]);
  return {
    tokenId,
    contractAddress: CONTRACT_ADDRESS,
    network: "sepolia",
    explorerUrl: `${EXPLORER_BASE}/token/${CONTRACT_ADDRESS}?a=${tokenId}`,
    poolBalance: poolBalance.toString(),
    totalSupply: totalSupply.toString(),
    released: released.toString(),
    priceWei: priceWei.toString(),
    onchainTitle: title,
    onchainArtist: artist
  };
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
      priceWei: e.args.priceWeiPerToken.toString(),
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

async function mintCatalogueOnchain(tokenId, slug, supply, priceWei, title, artist) {
  if (!writeContract) throw new Error("on-chain minting is disabled (no operator key configured)");
  // Wrapped in withRetry (chainRetry.js) — the free public RPC rate-limits
  // under bursts, and a failure here used to silently drop the campaign
  // from the marketplace even though it had been created (§2.22).
  const tx = await withRetry(() => writeContract.mintCatalogue(tokenId, slug, supply, priceWei || 0, title || "", artist || ""));
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

module.exports = {
  getBalance,
  mintingEnabled,
  getPoolInfo,
  mintCatalogueOnchain,
  releaseFromPoolOnchain,
  isTokenIdFree,
  listRecentlyMintedSlugsFromChain,
  CONTRACT_ADDRESS,
  EXPLORER_BASE
};
