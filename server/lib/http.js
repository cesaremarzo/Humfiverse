"use strict";
/* Request/response plumbing shared by every route: the two response
   writers and the two body readers. Lifted out of server.js unchanged —
   the CORS headers, the size caps and the deliberate no-destroy() error
   handling below are all load-bearing, see the comments on each. */

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

function sendRaw(res, status, contentType, body) {
  res.writeHead(status, { "Content-Type": contentType, "Access-Control-Allow-Origin": "*" });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    let settled = false;
    req.on("data", chunk => {
      if (settled) return;
      raw += chunk;
      if (raw.length > 1e6) {
        // Reject immediately instead of calling req.destroy() here: destroy()
        // tears down the socket res also writes on, so the route handler's
        // catch block could never actually deliver a 413 to the client —
        // the promise (and the client) just hung forever instead. Rejecting
        // without destroying lets the normal error response flow through;
        // the rest of the oversized body is simply drained and ignored
        // (raw is never appended to again) rather than forcibly cut off —
        // fine for this prototype's threat model, not a substitute for real
        // request-size enforcement at a reverse-proxy/rate-limiting layer.
        settled = true;
        reject(Object.assign(new Error("request body too large"), { code: "too_large" }));
      }
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
    });
    req.on("error", (e) => {
      if (settled) return;
      settled = true;
      reject(e);
    });
  });
}

/** Raw binary body reader for the audio-upload endpoint (§2.43) — readBody
 * above is JSON-only and capped at 1MB, far too small for an audio file.
 * 20MB covers a full-length mp3 at a normal bitrate; the client sends the
 * file's raw bytes directly as the request body (no multipart parsing
 * needed here — Pinata is the one that wants multipart, see pinata.js). */
function readRawBody(req, maxBytes = 20 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let settled = false;
    req.on("data", (chunk) => {
      if (settled) return;
      total += chunk.length;
      if (total > maxBytes) {
        // Same fix as readBody above: reject without destroying req, so the
        // route handler's catch block can still send a real 413 on the same
        // (still-alive) socket instead of the client hanging forever against
        // one destroy() already killed.
        settled = true;
        reject(Object.assign(new Error("file too large"), { code: "too_large" }));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks));
    });
    req.on("error", (e) => {
      if (settled) return;
      settled = true;
      reject(e);
    });
  });
}

module.exports = { sendJson, sendRaw, readBody, readRawBody };
