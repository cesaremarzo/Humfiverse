"use strict";
/* On-chain integration for HumfiverseMilestoneEscrow (planning doc §2.15,
   §2.18) — the pre-production milestone-escrow contract. Separate module
   from chain.js (which talks to HumfiverseCatalogueToken) since these are
   two independent contracts with two independent addresses.

   Reads work with just an RPC URL. Writes (registerStudio, createCampaign,
   confirmMilestone) require CHAIN_OPERATOR_PRIVATE_KEY — the same operator
   key chain.js uses, since Humfiverse is the owner of both contracts.
   TESTNET ONLY. */

const { ethers } = require("ethers");
const { withRetry } = require("./chainRetry");

// Switched from Base Sepolia to real Ethereum Sepolia (§2.35).
const RPC_URL = process.env.CHAIN_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
// §2.42 redeploy — takes a HumfiverseCatalogueToken address at construction
// so contribute() can release tokens from that pool atomically; see
// HumfiverseMilestoneEscrow.sol and chain.js's own CONTRACT_ADDRESS.
const ESCROW_ADDRESS = process.env.CHAIN_ESCROW_ADDRESS || "0xa1670bC06e2d2860e8F7c1d80e6c13a501bcaF81";
const ESCROW_DEPLOY_BLOCK = Number(process.env.CHAIN_ESCROW_DEPLOY_BLOCK || 11635556);
// §2.39: Alchemy's free tier caps eth_getLogs at a 10-block range per call,
// and the public-RPC default this project used before that started
// silently returning *incomplete* results for a full-history scan instead
// of erroring. 9 keeps every chunk's span (to - from + 1) at 10.
const EVENT_QUERY_CHUNK = 9;
// Bounded "recent activity" window, mirroring chain.js's RECENT_SCAN_BLOCKS
// (§2.39) — catches a brand-new campaign not yet in the local table without
// re-scanning full history, which would be 1,000+ eth_getLogs calls.
const RECENT_SCAN_BLOCKS = 500;
const CHAIN_ID = 11155111; // Sepolia
const EXPLORER_BASE = "https://sepolia.etherscan.io";

const ABI = [
  "function registerStudio(address wallet, string name) returns (uint256)",
  "function setStudioActive(uint256 studioId, bool active)",
  "function renameStudio(uint256 studioId, string name)",
  "function createCampaign(address artist, uint256 fundingGoal, uint256 studioId, uint256 deadline, string assetId, uint256 tokenId, string[] milestoneNames, uint16[] milestoneBps, uint8[] milestonePayees) returns (uint256)",
  "function campaignTokenId(uint256) view returns (uint256)",
  "function contribute(uint256 campaignId) payable",
  "function confirmMilestoneAsArtist(uint256 campaignId, uint256 milestoneIndex)",
  "function confirmMilestoneAsStudio(uint256 campaignId, uint256 milestoneIndex)",
  "function artistConfirmed(uint256 campaignId, uint256 milestoneIndex) view returns (bool)",
  "function studioConfirmed(uint256 campaignId, uint256 milestoneIndex) view returns (bool)",
  "function cancelCampaign(uint256 campaignId)",
  "function refund(uint256 campaignId)",
  "function campaigns(uint256) view returns (address artist, uint256 studioId, uint256 fundingGoal, uint256 raised, uint256 deadline, uint8 status, uint256 releasedBps, string assetId)",
  "function studios(uint256) view returns (string name, address wallet, bool active)",
  "function getMilestones(uint256 campaignId) view returns (tuple(string name, uint16 bps, uint8 payee, bool released)[])",
  "function campaignIdByAssetId(string) view returns (uint256)",
  "event StudioRegistered(uint256 indexed studioId, address indexed wallet, string name)",
  "event CampaignCreated(uint256 indexed campaignId, address indexed artist, uint256 fundingGoal, uint256 studioId, uint256 deadline, string assetId)",
  "event Contributed(uint256 indexed campaignId, address indexed contributor, uint256 amount, uint256 totalRaised)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
const readContract = new ethers.Contract(ESCROW_ADDRESS, ABI, provider);

let writeContract = null;
const operatorKey = process.env.CHAIN_OPERATOR_PRIVATE_KEY;
if (operatorKey) {
  const wallet = new ethers.Wallet(operatorKey, provider);
  writeContract = new ethers.Contract(ESCROW_ADDRESS, ABI, wallet);
}

function writeEnabled() {
  return writeContract !== null;
}

/** Reads a real Contributed event straight off a transaction receipt
 * (§2.34) — the verification step before releaseForContribution in
 * server.js will release any tokens, so a caller can't just POST an
 * arbitrary amount/address and get tokens released; the request has to
 * point at a transaction that genuinely emitted this event. Returns null
 * if the tx doesn't exist yet or isn't actually a contribution. */
async function getContributionFromTx(txHash) {
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return null;
  const parsed = receipt.logs
    .map((l) => { try { return readContract.interface.parseLog(l); } catch { return null; } })
    .find((e) => e && e.name === "Contributed");
  if (!parsed) return null;
  return {
    campaignId: Number(parsed.args.campaignId),
    contributor: parsed.args.contributor,
    amountWei: parsed.args.amount.toString()
  };
}

async function registerStudioOnchain(walletAddress, name) {
  if (!writeContract) throw new Error("escrow admin actions are disabled (no operator key configured)");
  const tx = await withRetry(() => writeContract.registerStudio(walletAddress, name));
  const receipt = await tx.wait();
  const parsed = receipt.logs.map((l) => { try { return readContract.interface.parseLog(l); } catch { return null; } }).find((e) => e && e.name === "StudioRegistered");
  return { studioId: Number(parsed.args.studioId), txHash: receipt.hash };
}

/** Admin correction for a genuine mistake in an already-registered studio's
 * name (§2.26) — not exposed via any API route yet, called directly when
 * needed. Renames every campaign already pointing at this studioId too,
 * since a campaign stores a studioId, not a name. */
async function renameStudioOnchain(studioId, name) {
  if (!writeContract) throw new Error("escrow admin actions are disabled (no operator key configured)");
  const tx = await withRetry(() => writeContract.renameStudio(studioId, name));
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

async function createCampaignOnchain(artist, fundingGoalWei, studioId, deadline, assetId, tokenId, milestoneNames, milestoneBps, milestonePayees) {
  if (!writeContract) throw new Error("escrow admin actions are disabled (no operator key configured)");
  const tx = await withRetry(() =>
    writeContract.createCampaign(artist, fundingGoalWei, studioId, deadline, assetId, tokenId, milestoneNames, milestoneBps, milestonePayees)
  );
  const receipt = await tx.wait();
  const parsed = receipt.logs.map((l) => { try { return readContract.interface.parseLog(l); } catch { return null; } }).find((e) => e && e.name === "CampaignCreated");
  return { campaignId: Number(parsed.args.campaignId), txHash: receipt.hash };
}

/** No more confirmMilestoneOnchain here (§2.27) — Humfiverse deliberately
 * has no on-chain function that can release a milestone by itself anymore.
 * Release requires the artist's and the studio's own wallets to each call
 * confirmMilestoneAsArtist/confirmMilestoneAsStudio directly (mirroring
 * WalletService.buyOnchain/contributeOnchain's pattern of requesting a
 * signature from the actual counterparty, not the operator key). This
 * module can still read the confirmation state (below) but cannot write it
 * on anyone's behalf. */

async function getCampaignInfo(campaignId) {
  const [c, milestones] = await Promise.all([readContract.campaigns(campaignId), readContract.getMilestones(campaignId)]);
  let studio = null;
  if (c.studioId > 0n) {
    const s = await readContract.studios(c.studioId);
    studio = { name: s.name, wallet: s.wallet, active: s.active };
  }
  const milestonesWithConfirmations = await Promise.all(
    milestones.map(async (m, i) => ({
      index: i,
      name: m.name,
      bps: Number(m.bps),
      payee: Number(m.payee) === 1 ? "studio" : "artist",
      released: m.released,
      amountWei: ((c.fundingGoal * BigInt(m.bps)) / 10_000n).toString(),
      // §2.27: what's still needed for release, not something Humfiverse can do.
      artistConfirmed: await readContract.artistConfirmed(campaignId, i),
      studioConfirmed: c.studioId > 0n ? await readContract.studioConfirmed(campaignId, i) : true
    }))
  );
  return {
    campaignId,
    assetId: c.assetId,
    contractAddress: ESCROW_ADDRESS,
    network: "sepolia",
    explorerUrl: `${EXPLORER_BASE}/address/${ESCROW_ADDRESS}`,
    artist: c.artist,
    studioId: Number(c.studioId),
    studio,
    fundingGoal: c.fundingGoal.toString(),
    raised: c.raised.toString(),
    deadline: Number(c.deadline),
    status: Number(c.status) === 0 ? "active" : "cancelled",
    releasedBps: Number(c.releasedBps),
    milestones: milestonesWithConfirmations
  };
}

/** The genuinely chain-native lookup (§2.18): the contract itself stores
 * the assetId<->campaignId link (`campaignIdByAssetId`), so this needs no
 * local table at all — unlike the token side, which has to fall back to
 * scanning events since HumfiverseCatalogueToken predates this pattern.
 * Returns null if this asset has no campaign. */
async function getCampaignInfoByAssetId(assetId) {
  const campaignId = await readContract.campaignIdByAssetId(assetId);
  if (campaignId === 0n) return null;
  return getCampaignInfo(Number(campaignId));
}

/** A *recent-activity* scan only (§2.39) — same rationale as chain.js's
 * listRecentlyMintedSlugsFromChain: a full-history scan from
 * ESCROW_DEPLOY_BLOCK is impractical under any free-tier RPC's block-range
 * cap. Callers should treat the local escrow_campaigns table as the primary
 * source and merge this in only to catch a brand-new campaign not yet
 * cached. Returns null on an RPC error so callers can fall back to the
 * local table entirely. */
async function listRecentlyCreatedCampaignAssetIdsFromChain() {
  try {
    const latest = await provider.getBlockNumber();
    const from = Math.max(ESCROW_DEPLOY_BLOCK, latest - RECENT_SCAN_BLOCKS);
    const filter = readContract.filters.CampaignCreated();
    const events = [];
    for (let f = from; f <= latest; f += EVENT_QUERY_CHUNK + 1) {
      const to = Math.min(f + EVENT_QUERY_CHUNK, latest);
      const chunk = await withRetry(() => readContract.queryFilter(filter, f, to));
      events.push(...chunk);
    }
    return events.map((e) => ({ campaignId: Number(e.args.campaignId), assetId: e.args.assetId, txHash: e.transactionHash }));
  } catch (err) {
    console.warn("Could not read recent CampaignCreated events from chain.", err.message || err);
    return null;
  }
}

module.exports = {
  writeEnabled,
  getContributionFromTx,
  registerStudioOnchain,
  renameStudioOnchain,
  createCampaignOnchain,
  getCampaignInfo,
  getCampaignInfoByAssetId,
  listRecentlyCreatedCampaignAssetIdsFromChain,
  ESCROW_ADDRESS,
  EXPLORER_BASE
};
