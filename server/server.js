"use strict";
/* Humfiverse mock backend.
   Replaces the frontend's hardcoded ASSETS/CAMPAIGNS/portfolio arrays with
   a real HTTP API backed by SQLite. Most of it is still simulated (no
   real money, KYC, or SPV) — see planning/technical-architecture.md for
   what a full production backend would actually require. The one piece
   that IS real: the on-chain integration in chain.js talks to a deployed
   ERC-1155 contract on the Base Sepolia testnet (§2.10 of that doc).

   Uses node's built-in http module and node:sqlite (stable in the Node
   version this was built against), plus one real dependency — ethers,
   for the on-chain integration (see chain.js; not reasonable to hand-roll
   transaction signing). Run with:
     node server.js
   Configure the port via PORT env var (defaults to 3001). On-chain
   minting needs CHAIN_OPERATOR_PRIVATE_KEY set (see chain.js) — without
   it, everything else still works, minting just stays disabled.
*/

require("dotenv").config();
const http = require("node:http");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { ASSETS, CAMPAIGNS, PORTFOLIO } = require("./seed-data");
const { CONTRACT_TEMPLATE } = require("./contract-template");
const chain = require("./chain");
const escrow = require("./chainEscrow");

const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "humfiverse.db");

const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS campaigns (id TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS holdings (assetId TEXT PRIMARY KEY, tokens REAL, costBasis REAL, unclaimed REAL);
  CREATE TABLE IF NOT EXISTS distributions (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, assetId TEXT, amount REAL);
  CREATE TABLE IF NOT EXISTS contract_acceptances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_version TEXT,
    artist_name TEXT,
    track_title TEXT,
    general_accepted INTEGER,
    vessatoria_accepted TEXT,
    receipt_hash TEXT,
    accepted_at TEXT
  );
  CREATE TABLE IF NOT EXISTS kyc_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT,
    dob TEXT,
    nationality TEXT,
    classification TEXT,
    score REAL,
    appropriateness_result TEXT,
    source_of_funds TEXT,
    pep INTEGER,
    receipt_hash TEXT,
    created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS onchain_tokens (
    token_id INTEGER PRIMARY KEY,
    asset_id TEXT UNIQUE NOT NULL,
    slug TEXT NOT NULL,
    supply INTEGER NOT NULL,
    tx_hash TEXT,
    minted_at TEXT
  );
  CREATE TABLE IF NOT EXISTS escrow_campaigns (
    campaign_id INTEGER PRIMARY KEY,
    asset_id TEXT UNIQUE NOT NULL,
    studio_id INTEGER,
    studio_name TEXT,
    studio_wallet TEXT,
    tx_hash TEXT,
    created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS escrow_studios (
    studio_id INTEGER PRIMARY KEY,
    wallet TEXT UNIQUE NOT NULL,
    name TEXT,
    tx_hash TEXT,
    created_at TEXT
  );
`);

function seedIfEmpty() {
  const assetCount = db.prepare("SELECT COUNT(*) AS n FROM assets").get().n;
  if (assetCount === 0) {
    const insertAsset = db.prepare("INSERT INTO assets (id, data) VALUES (?, ?)");
    for (const a of ASSETS) insertAsset.run(a.id, JSON.stringify(a));
  }
  const campaignCount = db.prepare("SELECT COUNT(*) AS n FROM campaigns").get().n;
  if (campaignCount === 0) {
    const insertCampaign = db.prepare("INSERT INTO campaigns (id, data) VALUES (?, ?)");
    for (const c of CAMPAIGNS) insertCampaign.run(c.id, JSON.stringify(c));
  }
  const holdingCount = db.prepare("SELECT COUNT(*) AS n FROM holdings").get().n;
  if (holdingCount === 0) {
    const insertHolding = db.prepare("INSERT INTO holdings (assetId, tokens, costBasis, unclaimed) VALUES (?, ?, ?, ?)");
    for (const h of PORTFOLIO.holdings) insertHolding.run(h.assetId, h.tokens, h.costBasis, h.unclaimed);
    const insertDist = db.prepare("INSERT INTO distributions (date, assetId, amount) VALUES (?, ?, ?)");
    for (const d of PORTFOLIO.distributions) insertDist.run(d.date, d.assetId, d.amount);
  }
  const onchainCount = db.prepare("SELECT COUNT(*) AS n FROM onchain_tokens").get().n;
  if (onchainCount === 0) {
    // The four seed catalogues were already minted directly via
    // contracts/scripts/mintCatalogues.js before this endpoint existed —
    // seeded here with their real Base Sepolia tx hashes so the API
    // reflects what's actually on-chain, not just what this server minted.
    const insertOnchain = db.prepare(
      "INSERT INTO onchain_tokens (token_id, asset_id, slug, supply, tx_hash, minted_at) VALUES (?, ?, ?, ?, ?, ?)"
    );
    const mintedAt = "2026-08-28T22:30:00.000Z";
    insertOnchain.run(1, "midnight-static", "midnight-static", 4000, "0x897079c54dba4b5531802fe7cd2454f1a8fe2032a50a159dc39589a218dfbff5", mintedAt);
    insertOnchain.run(2, "ember-choir", "ember-choir", 2500, "0x6673060bf68e4d9f026e81fd2843d00868ab73648ae7e1aa08594fee758d2628", mintedAt);
    insertOnchain.run(3, "paper-cranes", "paper-cranes", 5000, "0x31249c0f4c0a8654232b531d3321e681545a25c240920455e2ae7df5dd984272", mintedAt);
    insertOnchain.run(4, "copper-radio", "copper-radio", 3200, "0x1a11a8e5cb2d938796c8ed49f5bdaad34a0c8fd999739afacab6cc80ab8a3047", mintedAt);
  }
}
seedIfEmpty();

function getAssets() {
  return db.prepare("SELECT data FROM assets").all().map(r => JSON.parse(r.data));
}
function getCampaigns() {
  const rows = db.prepare("SELECT data FROM campaigns").all().map(r => JSON.parse(r.data));
  const assets = getAssets();
  // milestones live on the asset record; join them in like the original mock did
  return rows.map(c => ({ ...c, milestones: (assets.find(a => a.id === c.assetId) || {}).milestones || [] }));
}
function getPortfolio() {
  const holdings = db.prepare("SELECT assetId, tokens, costBasis, unclaimed FROM holdings").all();
  const distributions = db.prepare("SELECT date, assetId, amount FROM distributions ORDER BY id DESC").all();
  return { holdings, distributions };
}

function fakeTxHash() {
  const chars = "0123456789abcdef";
  let h = "0x";
  for (let i = 0; i < 64; i++) h += chars[Math.floor(Math.random() * 16)];
  return h;
}
function currentMonthLabel() {
  return new Date().toLocaleString("en", { month: "short", year: "2-digit" });
}

function redeem(assetId) {
  let amount = 0;
  const holdings = db.prepare("SELECT assetId, unclaimed FROM holdings").all();
  const updateHolding = db.prepare("UPDATE holdings SET unclaimed = 0 WHERE assetId = ?");
  const insertDist = db.prepare("INSERT INTO distributions (date, assetId, amount) VALUES (?, ?, ?)");
  const month = currentMonthLabel();

  const targets = assetId === "all" ? holdings : holdings.filter(h => h.assetId === assetId);
  for (const h of targets) {
    if (h.unclaimed > 0) {
      amount += h.unclaimed;
      insertDist.run(month, h.assetId, h.unclaimed);
      updateHolding.run(h.assetId);
    }
  }
  return { amount, txHash: fakeTxHash(), portfolio: getPortfolio() };
}

const VESSATORIA_CLAUSE_IDS = CONTRACT_TEMPLATE.clauses.filter(c => c.vessatoria).map(c => c.id);

/* Server-side re-validation: never trust the client's checkbox state alone
   for a document with clauses that (per art. 1341 co.2 c.c.) need specific,
   individual acceptance — the general "I accept" checkbox is not enough on
   its own for those clauses. */
function validateContractAcceptance(body) {
  const missing = [];
  if (body.generalAccepted !== true) missing.push("generalAccepted");
  const va = body.vessatoriaAccepted || {};
  for (const clauseId of VESSATORIA_CLAUSE_IDS) {
    if (va[clauseId] !== true) missing.push(clauseId);
  }
  return missing;
}

function recordContractAcceptance(body) {
  const receiptHash = fakeTxHash();
  const acceptedAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO contract_acceptances
      (template_version, artist_name, track_title, general_accepted, vessatoria_accepted, receipt_hash, accepted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    CONTRACT_TEMPLATE.version,
    body.artistName || "",
    body.trackTitle || "",
    1,
    JSON.stringify(body.vessatoriaAccepted || {}),
    receiptHash,
    acceptedAt
  );
  return { receiptHash, acceptedAt, templateVersion: CONTRACT_TEMPLATE.version };
}

/* MiFID II Art. 25(3) appropriateness assessment (execution-only regime):
   for a complex, non-standard instrument like a royalty-participation
   note, the firm must assess the client's knowledge/experience and warn
   them if the product may not be appropriate — it does NOT have to
   block the transaction outright (that's the suitability regime, which
   applies to advice, not execution-only). Scoring here is a simple
   illustrative heuristic, not a validated methodology. */
const APPROPRIATENESS_THRESHOLD = 3; // out of a max of 4 points

function scoreAppropriateness(answers) {
  answers = answers || {};
  let score = 0;
  if (answers.priorComplexInvestments === true) score += 1;
  if (answers.familiarWithIlliquidInstruments === true) score += 1;
  if (answers.understandsCapitalLossRisk === true) score += 1;
  if (answers.yearsExperience === "3+") score += 1;
  else if (answers.yearsExperience === "1-3") score += 0.5;
  const result = score >= APPROPRIATENESS_THRESHOLD ? "appropriate" : "warning";
  return { score, result };
}

function recordKyc(body) {
  const { score, result } = scoreAppropriateness(body.answers);
  const receiptHash = fakeTxHash();
  const createdAt = new Date().toISOString();
  const classification = body.classification === "professional" ? "professional" : "retail";
  db.prepare(`
    INSERT INTO kyc_records
      (full_name, dob, nationality, classification, score, appropriateness_result, source_of_funds, pep, receipt_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    body.fullName || "",
    body.dob || "",
    body.nationality || "",
    classification,
    score,
    result,
    body.sourceOfFunds || "",
    body.pep ? 1 : 0,
    receiptHash,
    createdAt
  );
  return { verified: true, classification, appropriatenessResult: result, score, receiptHash };
}

function getOnchainRecord(assetId) {
  return db.prepare("SELECT token_id, asset_id, slug, supply, tx_hash, minted_at FROM onchain_tokens WHERE asset_id = ?").get(assetId);
}

/* The local table is a hint for where to start looking, not the source of
   truth — see chain.js isTokenIdFree() for why this actually verifies
   on-chain before committing to a token id, rather than trusting the
   local MAX(token_id)+1 alone. */
async function nextFreeTokenId() {
  const row = db.prepare("SELECT MAX(token_id) AS maxId FROM onchain_tokens").get();
  let candidate = (row.maxId || 0) + 1;
  while (!(await chain.isTokenIdFree(candidate))) candidate += 1;
  return candidate;
}

async function mintAssetOnchain(assetId, slug, supply, priceWei) {
  const existing = getOnchainRecord(assetId);
  if (existing) throw Object.assign(new Error("asset already has an on-chain token"), { code: "already_minted", record: existing });

  const tokenId = await nextFreeTokenId();
  const result = await chain.mintCatalogueOnchain(tokenId, slug, supply, priceWei);
  db.prepare(
    "INSERT INTO onchain_tokens (token_id, asset_id, slug, supply, tx_hash, minted_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(tokenId, assetId, slug, supply, result.txHash, new Date().toISOString());
  return result;
}

function getEscrowRecord(assetId) {
  return db.prepare("SELECT campaign_id, asset_id, studio_id, studio_name, studio_wallet, tx_hash, created_at FROM escrow_campaigns WHERE asset_id = ?").get(assetId);
}

/** Creates the on-chain milestone escrow campaign for a preproduction asset:
 * registers the studio (if not already registered — keyed by wallet
 * address, since there's no studio-picker UI yet, only a name+wallet field
 * on the onboarding wizard) and creates the campaign with the standard
 * four-milestone template, "studio booked" routed to the studio's wallet.
 * See planning/technical-architecture.md §2.15. */
async function createEscrowCampaign(assetId, artistAddress, fundingGoalWei, studioName, studioWallet, milestones) {
  const existing = getEscrowRecord(assetId);
  if (existing) throw Object.assign(new Error("asset already has an escrow campaign"), { code: "already_created", record: existing });

  let studioRow = db.prepare("SELECT studio_id FROM escrow_studios WHERE wallet = ?").get(studioWallet.toLowerCase());
  let studioId;
  if (studioRow) {
    studioId = studioRow.studio_id;
  } else {
    const result = await escrow.registerStudioOnchain(studioWallet, studioName);
    studioId = result.studioId;
    db.prepare("INSERT INTO escrow_studios (studio_id, wallet, name, tx_hash, created_at) VALUES (?, ?, ?, ?, ?)").run(
      studioId, studioWallet.toLowerCase(), studioName, result.txHash, new Date().toISOString()
    );
  }

  const names = milestones.map((m) => m.name);
  const bps = milestones.map((m) => m.bps);
  const payees = milestones.map((m) => (m.payee === "studio" ? 1 : 0));
  const created = await escrow.createCampaignOnchain(artistAddress, fundingGoalWei, studioId, 0, names, bps, payees);

  db.prepare(
    "INSERT INTO escrow_campaigns (campaign_id, asset_id, studio_id, studio_name, studio_wallet, tx_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(created.campaignId, assetId, studioId, studioName, studioWallet.toLowerCase(), created.txHash, new Date().toISOString());

  return { campaignId: created.campaignId, studioId, txHash: created.txHash };
}

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(json);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy(); // basic guard against oversized bodies
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") { sendJson(res, 204, {}); return; }

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true }); return;
  }

  if (req.method === "GET" && url.pathname === "/api/data") {
    sendJson(res, 200, { assets: getAssets(), campaigns: getCampaigns(), portfolio: getPortfolio() });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/contract-template") {
    sendJson(res, 200, CONTRACT_TEMPLATE);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/contract-acceptance") {
    try {
      const body = await readBody(req);
      const missing = validateContractAcceptance(body);
      if (missing.length) {
        sendJson(res, 400, { error: "missing required acceptances", missing });
        return;
      }
      sendJson(res, 200, recordContractAcceptance(body));
    } catch (e) {
      sendJson(res, 400, { error: "invalid request body" });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/kyc") {
    try {
      const body = await readBody(req);
      if (!body.fullName || !body.dob) {
        sendJson(res, 400, { error: "fullName and dob are required" });
        return;
      }
      sendJson(res, 200, recordKyc(body));
    } catch (e) {
      sendJson(res, 400, { error: "invalid request body" });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/onchain/list") {
    // Chain-native listing check (technical-architecture.md §2.14): try
    // the contract's own event log first — the real source of truth —
    // and only fall back to the local table mirror if that read fails.
    const fromChain = await chain.listMintedSlugsFromChain();
    if (fromChain) {
      sendJson(res, 200, { source: "chain", assetIds: fromChain.map((m) => m.slug) });
      return;
    }
    const rows = db.prepare("SELECT asset_id FROM onchain_tokens").all();
    sendJson(res, 200, { source: "local-table", assetIds: rows.map((r) => r.asset_id) });
    return;
  }

  const onchainMatch = url.pathname.match(/^\/api\/onchain\/([^/]+)$/);
  if (req.method === "GET" && onchainMatch) {
    try {
      const assetId = decodeURIComponent(onchainMatch[1]);
      const record = getOnchainRecord(assetId);
      if (!record) { sendJson(res, 200, { onchain: false }); return; }
      const poolInfo = await chain.getPoolInfo(record.token_id);
      sendJson(res, 200, { onchain: true, assetId, slug: record.slug, mintTxHash: record.tx_hash, mintedAt: record.minted_at, ...poolInfo });
    } catch (e) {
      sendJson(res, 502, { error: "could not read on-chain data", detail: String(e.message || e) });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/onchain/mint") {
    try {
      const body = await readBody(req);
      if (!body.assetId || !body.slug || !body.supply) {
        sendJson(res, 400, { error: "assetId, slug and supply are required" });
        return;
      }
      if (!chain.mintingEnabled()) {
        sendJson(res, 503, { error: "on-chain minting is disabled on this server (no operator key configured)" });
        return;
      }
      const result = await mintAssetOnchain(body.assetId, body.slug, body.supply, body.priceWei);
      sendJson(res, 200, result);
    } catch (e) {
      if (e.code === "already_minted") {
        sendJson(res, 409, { error: "asset already has an on-chain token", record: e.record });
      } else {
        sendJson(res, 502, { error: "on-chain mint failed", detail: String(e.message || e) });
      }
    }
    return;
  }

  // --- milestone escrow (HumfiverseMilestoneEscrow.sol, §2.15) ---

  if (req.method === "POST" && url.pathname === "/api/escrow/campaign") {
    try {
      const body = await readBody(req);
      if (!body.assetId || !body.artistAddress || !body.fundingGoalWei || !body.studioName || !body.studioWallet || !Array.isArray(body.milestones)) {
        sendJson(res, 400, { error: "assetId, artistAddress, fundingGoalWei, studioName, studioWallet and milestones are required" });
        return;
      }
      if (!escrow.writeEnabled()) {
        sendJson(res, 503, { error: "escrow admin actions are disabled on this server (no operator key configured)" });
        return;
      }
      const result = await createEscrowCampaign(
        body.assetId, body.artistAddress, body.fundingGoalWei, body.studioName, body.studioWallet, body.milestones
      );
      sendJson(res, 200, result);
    } catch (e) {
      if (e.code === "already_created") {
        sendJson(res, 409, { error: "asset already has an escrow campaign", record: e.record });
      } else {
        sendJson(res, 502, { error: "escrow campaign creation failed", detail: String(e.message || e) });
      }
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/escrow/campaigns") {
    try {
      const rows = db.prepare("SELECT campaign_id, asset_id FROM escrow_campaigns ORDER BY campaign_id").all();
      const infos = await Promise.all(rows.map((r) => escrow.getCampaignInfo(r.campaign_id).then((info) => ({ assetId: r.asset_id, ...info }))));
      sendJson(res, 200, { campaigns: infos });
    } catch (e) {
      sendJson(res, 502, { error: "could not read escrow campaigns", detail: String(e.message || e) });
    }
    return;
  }

  const escrowCampaignMatch = url.pathname.match(/^\/api\/escrow\/campaign\/([^/]+)$/);
  if (req.method === "GET" && escrowCampaignMatch) {
    try {
      const assetId = decodeURIComponent(escrowCampaignMatch[1]);
      const record = getEscrowRecord(assetId);
      if (!record) { sendJson(res, 200, { escrow: false }); return; }
      const info = await escrow.getCampaignInfo(record.campaign_id);
      sendJson(res, 200, { escrow: true, assetId, ...info });
    } catch (e) {
      sendJson(res, 502, { error: "could not read escrow campaign", detail: String(e.message || e) });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/escrow/confirm") {
    try {
      const body = await readBody(req);
      if (!body.campaignId || body.milestoneIndex === undefined) {
        sendJson(res, 400, { error: "campaignId and milestoneIndex are required" });
        return;
      }
      if (!escrow.writeEnabled()) {
        sendJson(res, 503, { error: "escrow admin actions are disabled on this server (no operator key configured)" });
        return;
      }
      const result = await escrow.confirmMilestoneOnchain(body.campaignId, body.milestoneIndex);
      sendJson(res, 200, result);
    } catch (e) {
      sendJson(res, 502, { error: "milestone confirmation failed", detail: String(e.message || e) });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/redeem") {
    try {
      const body = await readBody(req);
      const assetId = body.assetId;
      if (!assetId) { sendJson(res, 400, { error: "assetId is required" }); return; }
      sendJson(res, 200, redeem(assetId));
    } catch (e) {
      sendJson(res, 400, { error: "invalid request body" });
    }
    return;
  }

  sendJson(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`Humfiverse mock backend listening on http://localhost:${PORT}`);
});
