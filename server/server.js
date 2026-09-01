"use strict";
/* Humfiverse mock backend.
   Replaces the frontend's hardcoded ASSETS/CAMPAIGNS/portfolio arrays with
   a real HTTP API backed by a database (see db.js — a local SQLite file by
   default, a real Turso/libSQL database when TURSO_DATABASE_URL is set;
   §2.23). Most of it is still simulated (no real money, KYC, or SPV) — see
   planning/technical-architecture.md for what a full production backend
   would actually require. The one piece that IS real: the on-chain
   integration in chain.js talks to a deployed ERC-1155 contract on the
   Base Sepolia testnet (§2.10 of that doc).

   Uses node's built-in http module, plus two real dependencies —
   @libsql/client for storage and ethers for the on-chain integration (see
   chain.js; not reasonable to hand-roll transaction signing). Run with:
     node server.js
   Configure the port via PORT env var (defaults to 3001). On-chain
   minting needs CHAIN_OPERATOR_PRIVATE_KEY set (see chain.js) — without
   it, everything else still works, minting just stays disabled.
*/

require("dotenv").config();
const http = require("node:http");
const db = require("./db");
const { ASSETS, CAMPAIGNS, PORTFOLIO } = require("./seed-data");
const { CONTRACT_TEMPLATE } = require("./contract-template");
const chain = require("./chain");
const escrow = require("./chainEscrow");

const PORT = process.env.PORT || 3001;
// Gates POST /api/escrow/confirm — the one endpoint only Humfiverse should be
// able to call (releases real escrowed funds). Every other write endpoint is
// a normal user action triggered by the onboarding wizard and stays open;
// see planning/technical-architecture.md §2.21.
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";

async function initSchema() {
  await db.exec(`
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
}

async function seedIfEmpty() {
  const assetCount = (await db.prepare("SELECT COUNT(*) AS n FROM assets").get()).n;
  if (assetCount === 0) {
    const insertAsset = db.prepare("INSERT INTO assets (id, data) VALUES (?, ?)");
    for (const a of ASSETS) await insertAsset.run(a.id, JSON.stringify(a));
  }
  const campaignCount = (await db.prepare("SELECT COUNT(*) AS n FROM campaigns").get()).n;
  if (campaignCount === 0) {
    const insertCampaign = db.prepare("INSERT INTO campaigns (id, data) VALUES (?, ?)");
    for (const c of CAMPAIGNS) await insertCampaign.run(c.id, JSON.stringify(c));
  }
  const holdingCount = (await db.prepare("SELECT COUNT(*) AS n FROM holdings").get()).n;
  if (holdingCount === 0) {
    const insertHolding = db.prepare("INSERT INTO holdings (assetId, tokens, costBasis, unclaimed) VALUES (?, ?, ?, ?)");
    for (const h of PORTFOLIO.holdings) await insertHolding.run(h.assetId, h.tokens, h.costBasis, h.unclaimed);
    const insertDist = db.prepare("INSERT INTO distributions (date, assetId, amount) VALUES (?, ?, ?)");
    for (const d of PORTFOLIO.distributions) await insertDist.run(d.date, d.assetId, d.amount);
  }
  const onchainCount = (await db.prepare("SELECT COUNT(*) AS n FROM onchain_tokens").get()).n;
  if (onchainCount === 0) {
    // The four seed catalogues were already minted directly via
    // contracts/scripts/mintCatalogues.js before this endpoint existed —
    // seeded here with their real Base Sepolia tx hashes so the API
    // reflects what's actually on-chain, not just what this server minted.
    // Re-minted 1 Sep 2026 against the redeployed contract that also stores
    // title/artist on-chain (§2.24) — these are that mint's real tx hashes.
    const insertOnchain = db.prepare(
      "INSERT INTO onchain_tokens (token_id, asset_id, slug, supply, tx_hash, minted_at) VALUES (?, ?, ?, ?, ?, ?)"
    );
    const mintedAt = "2026-09-01T00:00:00.000Z";
    await insertOnchain.run(1, "midnight-static", "midnight-static", 4000, "0x788b25df12a6d3fe5e2879f7f65f0837891c1b1fda7e7c95e79f291f62ba4bbe", mintedAt);
    await insertOnchain.run(2, "ember-choir", "ember-choir", 2500, "0x86b97d435f351ca4f824ebc0b3557b6e318065d1ba3aaf427c177cd7690e5e93", mintedAt);
    await insertOnchain.run(3, "paper-cranes", "paper-cranes", 5000, "0x9f0194fbc5fe68a532e32f2bcbcaca0977e86a9bb37de9fa930964062d8b6e40", mintedAt);
    await insertOnchain.run(4, "copper-radio", "copper-radio", 3200, "0x2cf8d8d85784ade62cb95246e0d451d3fecbc709d69d3d270d5588b13c41cdfc", mintedAt);
  }
}

async function getAssets() {
  const rows = await db.prepare("SELECT data FROM assets").all();
  return rows.map(r => JSON.parse(r.data));
}
async function getAssetById(id) {
  const row = await db.prepare("SELECT data FROM assets WHERE id = ?").get(id);
  return row ? JSON.parse(row.data) : null;
}
async function getCampaigns() {
  const rows = await db.prepare("SELECT data FROM campaigns").all();
  const campaigns = rows.map(r => JSON.parse(r.data));
  const assets = await getAssets();
  // milestones live on the asset record; join them in like the original mock did
  return campaigns.map(c => ({ ...c, milestones: (assets.find(a => a.id === c.assetId) || {}).milestones || [] }));
}
async function getPortfolio() {
  const holdings = await db.prepare("SELECT assetId, tokens, costBasis, unclaimed FROM holdings").all();
  const distributions = await db.prepare("SELECT date, assetId, amount FROM distributions ORDER BY id DESC").all();
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

async function redeem(assetId) {
  let amount = 0;
  const holdings = await db.prepare("SELECT assetId, unclaimed FROM holdings").all();
  const updateHolding = db.prepare("UPDATE holdings SET unclaimed = 0 WHERE assetId = ?");
  const insertDist = db.prepare("INSERT INTO distributions (date, assetId, amount) VALUES (?, ?, ?)");
  const month = currentMonthLabel();

  const targets = assetId === "all" ? holdings : holdings.filter(h => h.assetId === assetId);
  for (const h of targets) {
    if (h.unclaimed > 0) {
      amount += h.unclaimed;
      await insertDist.run(month, h.assetId, h.unclaimed);
      await updateHolding.run(h.assetId);
    }
  }
  return { amount, txHash: fakeTxHash(), portfolio: await getPortfolio() };
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

async function recordContractAcceptance(body) {
  const receiptHash = fakeTxHash();
  const acceptedAt = new Date().toISOString();
  await db.prepare(`
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

async function recordKyc(body) {
  const { score, result } = scoreAppropriateness(body.answers);
  const receiptHash = fakeTxHash();
  const createdAt = new Date().toISOString();
  const classification = body.classification === "professional" ? "professional" : "retail";
  await db.prepare(`
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

async function getOnchainRecord(assetId) {
  return db.prepare("SELECT token_id, asset_id, slug, supply, tx_hash, minted_at FROM onchain_tokens WHERE asset_id = ?").get(assetId);
}

/* The local table is a hint for where to start looking, not the source of
   truth — see chain.js isTokenIdFree() for why this actually verifies
   on-chain before committing to a token id, rather than trusting the
   local MAX(token_id)+1 alone. */
async function nextFreeTokenId() {
  const row = await db.prepare("SELECT MAX(token_id) AS maxId FROM onchain_tokens").get();
  let candidate = (row.maxId || 0) + 1;
  while (!(await chain.isTokenIdFree(candidate))) candidate += 1;
  return candidate;
}

async function mintAssetOnchain(assetId, slug, supply, priceWei, title, artist) {
  const existing = await getOnchainRecord(assetId);
  if (existing) throw Object.assign(new Error("asset already has an on-chain token"), { code: "already_minted", record: existing });

  const tokenId = await nextFreeTokenId();
  const result = await chain.mintCatalogueOnchain(tokenId, slug, supply, priceWei, title, artist);
  await db.prepare(
    "INSERT INTO onchain_tokens (token_id, asset_id, slug, supply, tx_hash, minted_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(tokenId, assetId, slug, supply, result.txHash, new Date().toISOString());
  return result;
}

/** Creates the on-chain milestone escrow campaign for a preproduction asset:
 * registers the studio (if not already registered — keyed by wallet
 * address, since there's no studio-picker UI yet, only a name+wallet field
 * on the onboarding wizard) and creates the campaign with the standard
 * four-milestone template, "studio booked" routed to the studio's wallet.
 * The contract itself is the source of truth on "does this asset already
 * have a campaign" (§2.18's campaignIdByAssetId) — the local table below is
 * only a fast-lookup cache for the admin listing endpoint, which has no
 * on-chain equivalent of "list every campaign". */
async function createEscrowCampaign(assetId, artistAddress, fundingGoalWei, studioName, studioWallet, milestones) {
  const existingOnchain = await escrow.getCampaignInfoByAssetId(assetId);
  if (existingOnchain) throw Object.assign(new Error("asset already has an escrow campaign"), { code: "already_created", record: existingOnchain });

  let studioRow = await db.prepare("SELECT studio_id FROM escrow_studios WHERE wallet = ?").get(studioWallet.toLowerCase());
  let studioId;
  if (studioRow) {
    studioId = studioRow.studio_id;
  } else {
    const result = await escrow.registerStudioOnchain(studioWallet, studioName);
    studioId = result.studioId;
    await db.prepare("INSERT INTO escrow_studios (studio_id, wallet, name, tx_hash, created_at) VALUES (?, ?, ?, ?, ?)").run(
      studioId, studioWallet.toLowerCase(), studioName, result.txHash, new Date().toISOString()
    );
  }

  const names = milestones.map((m) => m.name);
  const bps = milestones.map((m) => m.bps);
  const payees = milestones.map((m) => (m.payee === "studio" ? 1 : 0));
  const created = await escrow.createCampaignOnchain(artistAddress, fundingGoalWei, studioId, 0, assetId, names, bps, payees);

  await db.prepare(
    "INSERT INTO escrow_campaigns (campaign_id, asset_id, studio_id, studio_name, studio_wallet, tx_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(created.campaignId, assetId, studioId, studioName, studioWallet.toLowerCase(), created.txHash, new Date().toISOString());

  return { campaignId: created.campaignId, studioId, txHash: created.txHash };
}

function isAdminAuthorized(req) {
  if (!ADMIN_API_KEY) return false; // fail closed: unconfigured means disabled, not open
  return req.headers["x-admin-key"] === ADMIN_API_KEY;
}

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key"
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
    const [assets, campaigns, portfolio] = await Promise.all([getAssets(), getCampaigns(), getPortfolio()]);
    sendJson(res, 200, { assets, campaigns, portfolio });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/assets") {
    // Persists a campaign the onboarding wizard just created, so it shows
    // up in GET /api/data for every visitor, not just the browser tab that
    // created it — previously this only ever updated that one tab's local
    // signal, so a new campaign vanished on refresh even though its
    // on-chain token/escrow are real and permanent. See
    // planning/technical-architecture.md §2.20. No auth here, consistent
    // with every other write endpoint in this prototype backend (KYC,
    // contract acceptance, on-chain mint/escrow all have the same trust
    // model) — a real launch would need to gate this behind whatever
    // authenticates "artist" sessions.
    try {
      const body = await readBody(req);
      const asset = body.asset;
      if (!asset || !asset.id || !asset.title || !asset.kind) {
        sendJson(res, 400, { error: "asset.id, asset.title and asset.kind are required" });
        return;
      }
      if (await getAssetById(asset.id)) {
        sendJson(res, 409, { error: "an asset with this id already exists" });
        return;
      }
      await db.prepare("INSERT INTO assets (id, data) VALUES (?, ?)").run(asset.id, JSON.stringify(asset));
      if (body.campaign && body.campaign.id) {
        await db.prepare("INSERT OR IGNORE INTO campaigns (id, data) VALUES (?, ?)").run(body.campaign.id, JSON.stringify(body.campaign));
      }
      sendJson(res, 200, { ok: true, id: asset.id });
    } catch (e) {
      sendJson(res, 502, { error: "could not save asset", detail: String(e.message || e) });
    }
    return;
  }

  const assetIdMatch = url.pathname.match(/^\/api\/assets\/([^/]+)$/);
  if (req.method === "DELETE" && assetIdMatch) {
    // Admin-only cleanup (§2.22) — removes the *local* asset/campaign
    // record only. Cannot un-mint an on-chain token or delete a
    // CatalogueMinted event; this is for clearing test/mistaken rows out
    // of the public marketplace listing, not a real "delist" mechanism.
    if (!isAdminAuthorized(req)) {
      sendJson(res, 401, { error: "missing or invalid X-Admin-Key header" });
      return;
    }
    const assetId = decodeURIComponent(assetIdMatch[1]);
    const result = await db.prepare("DELETE FROM assets WHERE id = ?").run(assetId);
    await db.prepare("DELETE FROM campaigns WHERE id = ?").run(assetId);
    sendJson(res, 200, { ok: true, deleted: result.changes > 0 });
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
      sendJson(res, 200, await recordContractAcceptance(body));
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
      sendJson(res, 200, await recordKyc(body));
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
    const rows = await db.prepare("SELECT asset_id FROM onchain_tokens").all();
    sendJson(res, 200, { source: "local-table", assetIds: rows.map((r) => r.asset_id) });
    return;
  }

  const onchainMatch = url.pathname.match(/^\/api\/onchain\/([^/]+)$/);
  if (req.method === "GET" && onchainMatch) {
    try {
      const assetId = decodeURIComponent(onchainMatch[1]);
      let record = await getOnchainRecord(assetId);
      if (!record) {
        // Local table is only a cache, not the source of truth (§2.14) —
        // a miss here doesn't mean the token doesn't exist, only that this
        // cache doesn't know about it yet. Fall back to the chain's own
        // event log, and re-seed the cache from it so subsequent lookups
        // are fast again.
        const fromChain = await chain.listMintedSlugsFromChain();
        const match = fromChain && fromChain.find((m) => m.slug === assetId);
        if (match) {
          const mintedAt = new Date().toISOString();
          try {
            await db.prepare(
              "INSERT OR IGNORE INTO onchain_tokens (token_id, asset_id, slug, supply, tx_hash, minted_at) VALUES (?, ?, ?, ?, ?, ?)"
            ).run(match.tokenId, assetId, match.slug, Number(match.supply), match.txHash, mintedAt);
          } catch { /* best-effort cache re-seed */ }
          record = { token_id: match.tokenId, slug: match.slug, tx_hash: match.txHash, minted_at: mintedAt };
        }
      }
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
      const result = await mintAssetOnchain(body.assetId, body.slug, body.supply, body.priceWei, body.title, body.artist);
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
      const fromChain = await escrow.listCampaignAssetIdsFromChain();
      const assetIds = fromChain || (await db.prepare("SELECT asset_id FROM escrow_campaigns ORDER BY campaign_id").all()).map((r) => r.asset_id);
      const infos = await Promise.all(
        assetIds.map((assetId) => escrow.getCampaignInfoByAssetId(assetId).then((info) => info && { assetId, ...info }))
      );
      sendJson(res, 200, { campaigns: infos.filter(Boolean) });
    } catch (e) {
      sendJson(res, 502, { error: "could not read escrow campaigns", detail: String(e.message || e) });
    }
    return;
  }

  const escrowCampaignMatch = url.pathname.match(/^\/api\/escrow\/campaign\/([^/]+)$/);
  if (req.method === "GET" && escrowCampaignMatch) {
    try {
      const assetId = decodeURIComponent(escrowCampaignMatch[1]);
      // Chain-native (§2.18): the contract's own campaignIdByAssetId is the
      // lookup, not the local table — this survives the local DB being
      // wiped on a redeploy (see the analogous fix for the token side).
      const info = await escrow.getCampaignInfoByAssetId(assetId);
      if (!info) { sendJson(res, 200, { escrow: false }); return; }
      sendJson(res, 200, { escrow: true, assetId, ...info });
    } catch (e) {
      sendJson(res, 502, { error: "could not read escrow campaign", detail: String(e.message || e) });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/escrow/confirm") {
    try {
      if (!isAdminAuthorized(req)) {
        sendJson(res, 401, { error: "missing or invalid X-Admin-Key header" });
        return;
      }
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
      sendJson(res, 200, await redeem(assetId));
    } catch (e) {
      sendJson(res, 400, { error: "invalid request body" });
    }
    return;
  }

  sendJson(res, 404, { error: "not found" });
});

initSchema()
  .then(seedIfEmpty)
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Humfiverse mock backend listening on http://localhost:${PORT} (storage: ${db.usingTurso ? "Turso" : "local file"})`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database", err);
    process.exit(1);
  });
