# `server/` — architecture

How this backend is laid out, what each file is for, and how to add to it
without recreating the problem this structure was built to solve.

For *why* individual behaviours are the way they are, see
`planning/technical-architecture.md` — its numbered changelog is
referenced throughout the source as `§2.x`. This file covers shape, not
history.

---

## 1. The shape, and why

Everything below used to live in one 1,128-line `server.js`: schema, SQL,
chain calls, validation, and a single `http.createServer` callback holding
27 endpoints as a chain of `if (req.method === … && url.pathname.match(…))`
blocks. That worked, and it stopped scaling for three specific reasons.

- **Route precedence was positional.** `/api/onchain/list` only worked
  because its block sat above `/api/onchain/:assetId`. Nothing said so.
- **SQL was everywhere.** The same table was queried from four places with
  four slightly different column lists, so a schema change meant grepping.
- **Nothing was reachable without a socket.** Testing a single validation
  rule meant booting the server and issuing a real HTTP request.

The split addresses each one directly: precedence is now structural, SQL
lives in exactly one file per table group, and every layer can be required
on its own.

### The dependency rule

Four layers, and imports only ever point downward:

```
routes/      HTTP in, HTTP out. Reads the request, picks a status code.
   ↓
services/    Domain logic. The only layer allowed to talk to the chain.
   ↓
data/        One repository per group of tables. All SQL lives here.
   ↓
db.js        The libSQL client.
```

`lib/` and `config.js` sit outside the stack: leaf modules any layer may
import, importing nothing from the layers themselves.

Three consequences worth stating, because they are what keeps the shape
from eroding:

1. **A route never writes SQL.** If a handler needs data, a repository
   function gives it to it. No exceptions.
2. **A service never sees `req` or `res`.** It takes values, returns
   values, and throws errors carrying a `code`. The route maps that code
   to a status. This is what makes services callable from a test, a
   script, or a future job runner.
3. **A repository never calls the chain, and never validates.** It reads
   and writes rows.

### Where the layers meet the two contracts

`chain.js` and `chainEscrow.js` are the boundary with Ethereum Sepolia.
Only `services/` imports them, with one deliberate exception:
`routes/onchain.routes.js` and `routes/escrow.routes.js` call
`mintingEnabled()` / `writeEnabled()` directly, because "is this server
configured to sign transactions at all" is a 503 decision about *this
deployment*, not a domain rule.

---

## 2. File by file

### Entry point and wiring

| File | Role |
|---|---|
| `server.js` | Entry point, ~50 lines. Loads `.env`, initialises the schema, opens the port. Nothing else. |
| `app.js` | Builds the request handler: parses the URL, answers CORS preflight, dispatches through the router, 404s the rest. Catches anything a route throws and turns it into a 500 instead of a hung request. |
| `config.js` | Every environment-derived constant, read once: `PORT`, `ADMIN_API_KEY`, `TOKEN_METADATA_BASE`. |

### `lib/` — framework-shaped plumbing

| File | Role |
|---|---|
| `router.js` | Method + path matching. Accepts `"/api/assets/:assetId"` or a `RegExp` with named groups. Literal paths are matched from a `Map` **before** any `:param` pattern, which is what makes precedence structural rather than positional. |
| `http.js` | `sendJson`, `sendRaw`, `readBody` (JSON, 1 MB cap), `readRawBody` (binary, 20 MB cap, for audio upload). The deliberate no-`destroy()` handling in both readers is load-bearing — see the comments. |
| `admin-auth.js` | The `X-Admin-Key` check, compared with `timingSafeEqual`. Fails closed: an unset key disables admin endpoints, it never opens them. `requireAdmin(req, res)` is the guard routes actually call. |
| `receipts.js` | `fakeTxHash` and `currentMonthLabel`. Simulated receipt ids for the parts that are **not** on chain. Real transaction hashes never come from here. |
| `token-image.js` | The deterministic SVG served as each token's NFT card image (§2.36). |

### `data/` — repositories, one per group of tables

| File | Tables | Notes |
|---|---|---|
| `schema.js` | all | `CREATE TABLE IF NOT EXISTS` for every table, plus the one `ALTER TABLE` migration (§2.30). `seedIfEmpty` is a deliberate no-op (§2.25). |
| `catalogue.repo.js` | `assets`, `campaigns` | One JSON blob per row. Every read parses, every write stringifies. `listCampaigns` joins milestones off the asset record. |
| `portfolio.repo.js` | `holdings`, `distributions`, `portfolio_snapshots` | Two unrelated things: the wallet-less original simulation, and the real per-wallet daily snapshots feeding the value chart. |
| `compliance.repo.js` | `contract_acceptances`, `kyc_records` | Append-only in practice. They record what a user was shown and agreed to, at a point in time. |
| `onchain.repo.js` | `onchain_tokens` | A **cache**, never the source of truth (§2.14). A miss means "not cached", not "no token". |
| `escrow.repo.js` | `escrow_campaigns`, `escrow_studios` | Also caches, and only valid against the contract they were written for — which is why the admin reset endpoints exist. |
| `listings.repo.js` | `marketplace_listings` | Listing ids only. The offer itself — price, seller, whether it is still open — is read off the contract. |
| `indexer.repo.js` | `indexer_state`, `token_holders`, `token_holder_audit` | The resume cursor and its cross-process lease, the holder table, and the audit row that says whether that token's holdings were checked against supply (§2.70). |

### `services/` — domain logic

| File | Role |
|---|---|
| `catalogue.service.js` | Royalty-history rules: month validation, upsert-by-month, sorted ascending so the frontend's trailing-12-months slice keeps working. Also the admin strip used to clean up the fabricated histories the old wizard generated. |
| `portfolio.service.js` | Real per-wallet holdings via `balanceOf` per known token id, plus the leftover simulated `redeem`. Owns the wallet-address check that stops ethers treating a malformed address as an ENS name. |
| `compliance.service.js` | Clause-by-clause contract acceptance (art. 1341 co.2 c.c.) and the MiFID II Art. 25(3) appropriateness scoring. Both re-validated server-side. |
| `onchain.service.js` | The cache-versus-contract logic: chain-fallback lookup, next free token id, mint, and the listing that self-heals the cache from a bounded recent-blocks scan (§2.39). |
| `escrow.service.js` | Campaign creation: studio registration, the already-minted-token precondition (§2.42), and the campaign listing. |
| `listings.service.js` | Resale: records the ids of on-chain listings and reads each one's live state back off `HumfiverseMarketplace`. No price or seller is ever taken from a request body (§2.62). |
| `indexer.service.js` | Who holds each token. `reconcile` is the authority — real balances from `balanceOf`, verified by `held + pool == totalSupply`; the eth_getLogs walk only follows movement between passes (§2.70). |

### `routes/` — one module per path prefix

| File | Endpoints |
|---|---|
| `index.js` | Registers every module. Reads as a table of contents for the API. |
| `system.routes.js` | `GET /api/health` |
| `catalogue.routes.js` | `GET /api/data`, `POST /api/assets`, `DELETE /api/assets/:assetId`, and the two royalty-report endpoints |
| `compliance.routes.js` | `GET /api/contract-template`, `POST /api/contract-acceptance`, `POST /api/kyc`, `GET /api/kyc/status/:wallet` |
| `onchain.routes.js` | `GET /api/onchain/list`, `GET /api/onchain/:assetId`, `POST /api/onchain/mint`, `POST /api/onchain/audio/:assetId` |
| `token-metadata.routes.js` | The two ERC-1155 metadata endpoints wallets read (§2.36) |
| `portfolio.routes.js` | `GET /api/portfolio/:wallet`, the snapshot pair, and `POST /api/redeem` |
| `escrow.routes.js` | `POST /api/escrow/campaign`, `GET /api/escrow/campaigns`, `GET /api/escrow/campaign/:assetId`, and the deliberate `410` on `/api/escrow/confirm` (§2.27) |
| `listings.routes.js` | `GET /api/listings`, `POST /api/listings`, `POST /api/listings/index`, and the `:id` cancel/buy pair |
| `holders.routes.js` | `GET /api/holders`, `GET /api/holders/:assetId`, `GET /api/indexer/status`, and the admin reconcile/reindex/step trio |
| `admin.routes.js` | The three `X-Admin-Key` reset endpoints, all of which exist because of contract redeploys |

### Not part of the split

`db.js`, `chain.js`, `chainEscrow.js`, `chainRetry.js`, `pinata.js`,
`contract-template.js` and `seed-data.js` were already single-purpose
modules and were left exactly as they were.

---

## 3. Adding an endpoint

Work downward through the layers, and stop at the first one that already
has what you need.

1. **Does a table need a new query?** Add a function to the repository
   that owns that table. If no repository owns it, the table is new: add
   it to `data/schema.js` and create the repository.
2. **Is there a rule, a calculation, or a chain call?** Add it to the
   service for that domain. Throw `Object.assign(new Error(msg), { code })`
   for anything the caller must distinguish — that is how
   `already_minted`, `already_created` and `no_token` reach their 409s
   and 400s today.
3. **Register the route** in the module owning that path prefix:

   ```js
   router.post("/api/assets/:assetId/something", async (req, res, { params, url }) => {
     // validate the request, call the service, pick a status code
   });
   ```

   The handler receives `params` (decoded) and `url` (a parsed `URL`, for
   query strings). A new path prefix means a new module plus one line in
   `routes/index.js`.

Two things to keep an eye on:

- **Error mapping stays in the route.** A service saying `code: "no_token"`
  and a route saying `400` are two different decisions, on purpose.
- **A route with no `try/catch` is caught by `app.js` and answered 500.**
  That is a backstop, not a design. If a failure has a meaningful status,
  handle it in the route.

---

## 4. Running it

```bash
cd server
npm install
cp .env.example .env    # then fill it in — every var is documented there
npm start               # http://localhost:3001
```

Nothing but `PORT` is required to boot. Without `CHAIN_OPERATOR_PRIVATE_KEY`
the on-chain writes return `503` and everything else works; without
`PINATA_JWT` the same is true of audio upload; without `ADMIN_API_KEY` the
admin endpoints are disabled rather than open. Without `TURSO_DATABASE_URL`
storage is a local SQLite file, which is what local development uses.

To run against a throwaway database instead of the checked-in local file:

```bash
DB_PATH=/tmp/humfiverse-test.db npm start
```

There is no automated test suite for this backend yet. The layering above
is what makes one possible: `app.js` builds a handler without opening a
port, and every service and repository can be required directly.
