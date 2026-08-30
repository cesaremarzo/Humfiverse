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

const RPC_URL = process.env.CHAIN_RPC_URL || "https://sepolia.base.org";
const ESCROW_ADDRESS = process.env.CHAIN_ESCROW_ADDRESS || "0xbc220eB1234749a2127aad3deB69c689DC74C1a1";
const ESCROW_DEPLOY_BLOCK = Number(process.env.CHAIN_ESCROW_DEPLOY_BLOCK || 46164128);
const EVENT_QUERY_CHUNK = 9000; // public RPCs cap eth_getLogs at ~10,000 blocks
const CHAIN_ID = 84532; // Base Sepolia
const EXPLORER_BASE = "https://sepolia.basescan.org";

const ABI = [
  "function registerStudio(address wallet, string name) returns (uint256)",
  "function setStudioActive(uint256 studioId, bool active)",
  "function createCampaign(address artist, uint256 fundingGoal, uint256 studioId, uint256 deadline, string assetId, string[] milestoneNames, uint16[] milestoneBps, uint8[] milestonePayees) returns (uint256)",
  "function contribute(uint256 campaignId) payable",
  "function confirmMilestone(uint256 campaignId, uint256 milestoneIndex)",
  "function cancelCampaign(uint256 campaignId)",
  "function refund(uint256 campaignId)",
  "function campaigns(uint256) view returns (address artist, uint256 studioId, uint256 fundingGoal, uint256 raised, uint256 deadline, uint8 status, uint256 releasedBps, string assetId)",
  "function studios(uint256) view returns (string name, address wallet, bool active)",
  "function getMilestones(uint256 campaignId) view returns (tuple(string name, uint16 bps, uint8 payee, bool released)[])",
  "function campaignIdByAssetId(string) view returns (uint256)",
  "event StudioRegistered(uint256 indexed studioId, address indexed wallet, string name)",
  "event CampaignCreated(uint256 indexed campaignId, address indexed artist, uint256 fundingGoal, uint256 studioId, uint256 deadline, string assetId)"
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

async function registerStudioOnchain(walletAddress, name) {
  if (!writeContract) throw new Error("escrow admin actions are disabled (no operator key configured)");
  const tx = await writeContract.registerStudio(walletAddress, name);
  const receipt = await tx.wait();
  const parsed = receipt.logs.map((l) => { try { return readContract.interface.parseLog(l); } catch { return null; } }).find((e) => e && e.name === "StudioRegistered");
  return { studioId: Number(parsed.args.studioId), txHash: receipt.hash };
}

async function createCampaignOnchain(artist, fundingGoalWei, studioId, deadline, assetId, milestoneNames, milestoneBps, milestonePayees) {
  if (!writeContract) throw new Error("escrow admin actions are disabled (no operator key configured)");
  const tx = await writeContract.createCampaign(artist, fundingGoalWei, studioId, deadline, assetId, milestoneNames, milestoneBps, milestonePayees);
  const receipt = await tx.wait();
  const parsed = receipt.logs.map((l) => { try { return readContract.interface.parseLog(l); } catch { return null; } }).find((e) => e && e.name === "CampaignCreated");
  return { campaignId: Number(parsed.args.campaignId), txHash: receipt.hash };
}

async function confirmMilestoneOnchain(campaignId, milestoneIndex) {
  if (!writeContract) throw new Error("escrow admin actions are disabled (no operator key configured)");
  const tx = await writeContract.confirmMilestone(campaignId, milestoneIndex);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, explorerUrl: `${EXPLORER_BASE}/tx/${receipt.hash}` };
}

async function getCampaignInfo(campaignId) {
  const [c, milestones] = await Promise.all([readContract.campaigns(campaignId), readContract.getMilestones(campaignId)]);
  let studio = null;
  if (c.studioId > 0n) {
    const s = await readContract.studios(c.studioId);
    studio = { name: s.name, wallet: s.wallet, active: s.active };
  }
  return {
    campaignId,
    assetId: c.assetId,
    contractAddress: ESCROW_ADDRESS,
    network: "base-sepolia",
    explorerUrl: `${EXPLORER_BASE}/address/${ESCROW_ADDRESS}`,
    artist: c.artist,
    studioId: Number(c.studioId),
    studio,
    fundingGoal: c.fundingGoal.toString(),
    raised: c.raised.toString(),
    deadline: Number(c.deadline),
    status: Number(c.status) === 0 ? "active" : "cancelled",
    releasedBps: Number(c.releasedBps),
    milestones: milestones.map((m, i) => ({
      index: i,
      name: m.name,
      bps: Number(m.bps),
      payee: Number(m.payee) === 1 ? "studio" : "artist",
      released: m.released,
      amountWei: ((c.fundingGoal * BigInt(m.bps)) / 10_000n).toString()
    }))
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

/** Chain-native campaign enumeration for the admin panel (§2.18): there's
 * no on-chain "list all campaigns" view, so this reads every
 * CampaignCreated event instead of relying on the local table — the local
 * table is only ever a cache of this, and doesn't survive a redeploy on
 * the current hosting plan. Returns null on an RPC error so callers can
 * fall back to the local table. */
async function listCampaignAssetIdsFromChain() {
  try {
    const latest = await provider.getBlockNumber();
    const filter = readContract.filters.CampaignCreated();
    const events = [];
    for (let from = ESCROW_DEPLOY_BLOCK; from <= latest; from += EVENT_QUERY_CHUNK + 1) {
      const to = Math.min(from + EVENT_QUERY_CHUNK, latest);
      const chunk = await readContract.queryFilter(filter, from, to);
      events.push(...chunk);
    }
    return events.map((e) => e.args.assetId);
  } catch (err) {
    console.warn("Could not read CampaignCreated events from chain.", err.message || err);
    return null;
  }
}

module.exports = {
  writeEnabled,
  registerStudioOnchain,
  createCampaignOnchain,
  confirmMilestoneOnchain,
  getCampaignInfo,
  getCampaignInfoByAssetId,
  listCampaignAssetIdsFromChain,
  ESCROW_ADDRESS,
  EXPLORER_BASE
};
