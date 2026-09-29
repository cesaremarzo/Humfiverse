"use strict";
/* takedown_events (§2.105) — the takedown procedure's record. Append-only:
   there is no update or delete here, on purpose. A case's state is what its
   events add up to, so every notice, reply, decision and removal step keeps
   the date, the signer and the outcome it had, including the failures. */
const db = require("../db");

async function append({ assetId, step, outcome, actor, payload }) {
  await db.prepare(
    "INSERT INTO takedown_events (asset_id, step, outcome, actor, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(assetId, step, outcome, actor ? String(actor).toLowerCase() : null, JSON.stringify(payload ?? {}), new Date().toISOString());
}

function parse(row) {
  return { id: row.id, assetId: row.asset_id, step: row.step, outcome: row.outcome, actor: row.actor, payload: JSON.parse(row.payload || "{}"), at: row.created_at };
}

async function eventsFor(assetId) {
  return (await db.prepare("SELECT * FROM takedown_events WHERE asset_id = ? ORDER BY id").all(assetId)).map(parse);
}

async function allEvents() {
  return (await db.prepare("SELECT * FROM takedown_events ORDER BY id").all()).map(parse);
}

module.exports = { append, eventsFor, allEvents };
