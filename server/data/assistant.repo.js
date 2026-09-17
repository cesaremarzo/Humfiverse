"use strict";
/* `assistant_requests` (§2.100). All its SQL lives here.

   The table exists for one reason: the guide assistant's free-text mode
   calls a paid API from an endpoint nobody has to sign in to use, so the
   caps that protect the bill have to survive a restart. Render's free tier
   restarts often enough that an in-memory counter would be reset by the
   same traffic it is supposed to limit. Nothing about the conversation is
   written here — only that a call happened, from which address, and what
   it cost in tokens. */

const db = require("../db");

async function insertRequest(row) {
  await db.prepare(`
    INSERT INTO assistant_requests (ip, created_at, input_tokens, output_tokens)
    VALUES (?, ?, ?, ?)
  `).run(row.ip || null, row.createdAt, row.inputTokens ?? null, row.outputTokens ?? null);
}

/** How many questions were answered since `sinceIso` — for one IP, or in
 * total when `ip` is null. Feeds both caps in the service. */
async function countSince(ip, sinceIso) {
  const row = ip
    ? await db.prepare("SELECT COUNT(*) AS n FROM assistant_requests WHERE ip = ? AND created_at >= ?").get(ip, sinceIso)
    : await db.prepare("SELECT COUNT(*) AS n FROM assistant_requests WHERE created_at >= ?").get(sinceIso);
  return Number(row?.n || 0);
}

/** Token totals since `sinceIso`, for the admin fee/usage view and for
 * answering "what has this cost" without reading anyone's questions. */
async function usageSince(sinceIso) {
  const row = await db.prepare(`
    SELECT COUNT(*) AS calls,
           COALESCE(SUM(input_tokens), 0) AS input_tokens,
           COALESCE(SUM(output_tokens), 0) AS output_tokens
    FROM assistant_requests WHERE created_at >= ?
  `).get(sinceIso);
  return {
    calls: Number(row?.calls || 0),
    inputTokens: Number(row?.input_tokens || 0),
    outputTokens: Number(row?.output_tokens || 0)
  };
}

/** Rows older than the longest window the caps look at are dead weight. */
async function deleteBefore(beforeIso) {
  await db.prepare("DELETE FROM assistant_requests WHERE created_at < ?").run(beforeIso);
}

module.exports = { insertRequest, countSince, usageSince, deleteBefore };
