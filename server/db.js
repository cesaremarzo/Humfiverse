"use strict";
/* Thin async wrapper around @libsql/client, shaped to match the
   node:sqlite DatabaseSync API this file replaced (prepare().get/all/run)
   so the rest of the codebase only had to add `await`, not restructure
   its SQL. See planning/technical-architecture.md §2.23.

   Two modes, picked by which env vars are set:
   - TURSO_DATABASE_URL + TURSO_AUTH_TOKEN set → talks to a real Turso
     (libSQL) database over the network. This is what makes data survive
     a Render redeploy — the whole point of this migration.
   - Neither set → falls back to a local file (`file:<DB_PATH>`), which
     is what every local dev run and this repo's default use. No Turso
     account needed for local development. */

const { createClient } = require("@libsql/client");
const path = require("node:path");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "humfiverse.db");
const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

const client = TURSO_DATABASE_URL
  ? createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN })
  : createClient({ url: `file:${DB_PATH}` });

function prepare(sql) {
  return {
    async get(...args) {
      const rs = await client.execute({ sql, args });
      return rs.rows[0];
    },
    async all(...args) {
      const rs = await client.execute({ sql, args });
      return rs.rows;
    },
    async run(...args) {
      const rs = await client.execute({ sql, args });
      return { changes: Number(rs.rowsAffected), lastInsertRowid: rs.lastInsertRowid };
    }
  };
}

/** Runs a semicolon-separated block of DDL — used once at startup for
 * CREATE TABLE IF NOT EXISTS, mirroring the old db.exec(). */
async function exec(sql) {
  await client.executeMultiple(sql);
}

module.exports = { prepare, exec, usingTurso: Boolean(TURSO_DATABASE_URL) };
