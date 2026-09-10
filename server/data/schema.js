"use strict";
/* Database schema, applied once at startup. Every CREATE is IF NOT
   EXISTS, so this runs safely on every boot against an existing Turso
   database as well as an empty local file. */

const db = require("../db");

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
      wallet_address TEXT,
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
    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
      wallet TEXT NOT NULL,
      snapshot_date TEXT NOT NULL,
      value_usd REAL NOT NULL,
      recorded_at TEXT NOT NULL,
      PRIMARY KEY (wallet, snapshot_date)
    );
  `);
  // Migration for a kyc_records table that already existed before
  // wallet_address was added (§2.30) — CREATE TABLE IF NOT EXISTS above
  // only sets the new schema for a table that doesn't exist yet.
  try {
    await db.exec("ALTER TABLE kyc_records ADD COLUMN wallet_address TEXT;");
  } catch {
    /* column already exists — fine */
  }
}

/** Deliberately does nothing (§2.25) — this used to seed 6 fictional demo
 * catalogues/campaigns plus matching mock portfolio holdings on an empty
 * database. Once real users could genuinely create and buy tracks (§2.20,
 * §2.13), the user explicitly asked for the site to show only real,
 * user-created data going forward — fictional placeholder content, even
 * though it did have a real on-chain token (§2.10/§2.24), doesn't belong
 * next to it. Left as a no-op hook (not deleted) in case a future non-
 * production environment (a demo/staging deploy) wants seed data back —
 * see seed-data.js, still present and unused for that purpose. */
async function seedIfEmpty() {}

module.exports = { initSchema, seedIfEmpty };
