"use strict";
/* Minimal method+path router — the piece that replaces the long chain of
   `if (req.method === "..." && url.pathname.match(...))` blocks server.js
   used to be. No dependency: this backend is deliberately framework-free
   (see server.js's header), and an Express-shaped router is about forty
   lines of code, not a reason to take on a dependency.

   Two kinds of pattern are accepted:
   - a plain string, either exact ("/api/data") or with :named segments
     ("/api/assets/:assetId"), where each :name matches one path segment;
   - a RegExp, for the few paths a segment matcher can't express (the
     ERC-1155 metadata routes, which pin an exact hex/digit shape and a
     file extension). Use named capture groups there — they land in
     `params` under the same names a string pattern would produce.

   Exact string routes are matched first, from a Map, so registration
   order can never make a literal path lose to a :param pattern that
   happens to be registered earlier ("/api/onchain/list" vs
   "/api/onchain/:assetId" — a real ordering dependency in the original
   file, now structurally impossible). Pattern routes are then tried in
   registration order, first match wins. */

/** Escapes regex metacharacters, then turns each :name into a
 * one-segment capture group. The escape pass leaves ":" and word
 * characters alone, so the :name replacement below still sees them. */
function compilePattern(pattern) {
  if (pattern instanceof RegExp) return { regex: pattern, keys: [] };
  const keys = [];
  const source = pattern
    .replace(/[.+*?^${}()|[\]\\]/g, "\\$&")
    .replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_match, name) => {
      keys.push(name);
      return "([^/]+)";
    });
  return { regex: new RegExp(`^${source}$`), keys };
}

/** Path params arrive percent-encoded. The original handlers each called
 * decodeURIComponent() themselves, which throws on a malformed sequence
 * ("%" alone) — in a route without its own try/catch that used to be an
 * unhandled rejection and a request that hung forever. Falling back to
 * the raw value keeps a malformed id a plain 404/no-op instead. */
function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function createRouter() {
  const exact = new Map(); // "GET /api/data" -> handler
  const patterns = []; // { method, regex, keys, handler }

  function add(method, pattern, handler) {
    if (typeof pattern === "string" && !pattern.includes(":")) {
      exact.set(`${method} ${pattern}`, handler);
      return;
    }
    const { regex, keys } = compilePattern(pattern);
    patterns.push({ method, regex, keys, handler });
  }

  return {
    get: (pattern, handler) => add("GET", pattern, handler),
    post: (pattern, handler) => add("POST", pattern, handler),
    delete: (pattern, handler) => add("DELETE", pattern, handler),

    /** Returns { handler, params } for the first route that matches, or
     * null so the caller can send its own 404. */
    match(method, pathname) {
      const direct = exact.get(`${method} ${pathname}`);
      if (direct) return { handler: direct, params: {} };

      for (const route of patterns) {
        if (route.method !== method) continue;
        const matched = pathname.match(route.regex);
        if (!matched) continue;
        if (route.keys.length) {
          const params = {};
          route.keys.forEach((key, i) => {
            params[key] = safeDecode(matched[i + 1]);
          });
          return { handler: route.handler, params };
        }
        return { handler: route.handler, params: matched.groups ? { ...matched.groups } : {} };
      }
      return null;
    }
  };
}

module.exports = { createRouter };
