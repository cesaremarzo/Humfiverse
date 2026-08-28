"use strict";
/* Humfiverse mock backend.
   Replaces the frontend's hardcoded ASSETS/CAMPAIGNS/portfolio arrays with
   a real HTTP API backed by SQLite. Still entirely simulated (no real
   money, wallets, or contracts) — see claude_technical-architecture.md for
   what a production backend (SPV, oracle, KYC, on-chain contracts) would
   actually require.

   Zero npm dependencies: uses node's built-in http module and node:sqlite
   (stable in the Node version this was built against). Run with:
     node server.js
   Configure the port via PORT env var (defaults to 3001).
*/

const http = require("node:http");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { ASSETS, CAMPAIGNS, PORTFOLIO } = require("./seed-data");

const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "humfiverse.db");

const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS campaigns (id TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS holdings (assetId TEXT PRIMARY KEY, tokens REAL, costBasis REAL, unclaimed REAL);
  CREATE TABLE IF NOT EXISTS distributions (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, assetId TEXT, amount REAL);
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
