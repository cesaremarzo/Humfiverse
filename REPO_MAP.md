# Humfiverse — repo map

A folder-by-folder index of this repo: what's where, and where to read the *why*. This file answers "where do I look" — it doesn't duplicate the *history* (that's `SESSION_LOG.md` and `planning/technical-architecture.md`) or the *rules* (`CLAUDE.md`). Update this only when a folder's purpose changes, not on every commit.

---

## Top level

| Path | What it is |
|---|---|
| `README.md` | Front door: what the project is, what's real versus simulated, prerequisites, setup, how to run each part locally, and how each part deploys. Start here if you've never run this repo. |
| `CLAUDE.md` | Project rules Claude Code reads automatically every session: branch workflow, deploy notes, env var handling. Read this first if you're a new collaborator (human or AI). |
| `SESSION_LOG.md` | Cross-session diary, most recent entry at the bottom. Read this first for *recent* context — what's live, what's in progress. |
| `REPO_MAP.md` | This file. |
| `netlify.toml` | Netlify deploy config (branch preview builds — see `CLAUDE.md` "Team & branches"). |
| `render.yaml` | Render deploy config for the backend (`server/`). |
| `run-dev.sh` | Runs backend + frontend together locally. |
| `.gitbook.yaml` | Tells GitBook where the synced whitepaper content lives (`whitepaper/`) when the space is connected to this repo. |
| `password` | Empty, untracked-origin file that showed up once during development (§ in `SESSION_LOG.md`'s 2026-08-29 entry). Harmless, gitignored, never resolved — not a real credential. |

## `contracts/` — Solidity smart contracts (Hardhat)

The only genuinely on-chain part of the project. Deployed to **Ethereum Sepolia** (testnet).

- `contracts/contracts/` — the two live contracts:
  - `HumfiverseCatalogueToken.sol` (ERC-1155) — mints/holds/releases royalty tokens, one token id per catalogue or preproduction asset.
  - `HumfiverseMilestoneEscrow.sol` — preproduction funding escrow with dual artist+studio milestone confirmation. Holds an **immutable** reference to the token contract (see `technical-architecture.md` §2.42) — redeploying one forces redeploying both.
  - `HumfiverseMarketplace.sol` — written and tested, **not deployed** (secondary-market resale is still a frontend simulation).
- `contracts/test/` — Hardhat test suite (`npm test`). Run after any contract change.
- `contracts/scripts/` — `deploy.js`/`deployEscrow.js` (canonical deploy scripts, keep these in sync with the linking pattern), `catalogues.js`/`mintCatalogues.js` (old fictional demo catalogues, not the real assets). One-off migration scripts used during a redeploy are written, run, and deleted in the same session — they don't live here permanently.
- `contracts/.env` — `DEPLOYER_PRIVATE_KEY`, `SEPOLIA_RPC_URL`, `ETHERSCAN_API_KEY`. Gitignored.
- Current deployed addresses: see `server/.env.example` (kept in sync) or `technical-architecture.md`'s changelog for the redeploy history.

## `server/` — backend API (Node, zero-framework `http`)

Deployed on Render at `humfiverse-api.onrender.com`. No Express: the routing layer one would provide is `lib/router.js`, at about forty lines.

**Read `server/STRUCTURE.md` before changing anything here** — it has the layer rule, the file-by-file table, and the steps for adding an endpoint. Short version: four layers, imports pointing one way only.

- `server.js` — entry point. Loads `.env`, initialises the schema, opens the port. Nothing else.
- `app.js` — builds the request handler: URL parsing, CORS preflight, dispatch, 404, and the 500 backstop.
- `config.js` — every environment-derived constant, read once.
- `lib/` — `router.js` (method+path matching, literal paths beat `:param` ones), `http.js` (send/read helpers and their size caps), `admin-auth.js` (`X-Admin-Key`, fails closed), `receipts.js`, `token-image.js`.
- `data/` — one repository per group of tables, plus `schema.js`. **All SQL lives here**, nowhere else.
- `services/` — domain logic, and the only layer that talks to the two contracts. Takes values, returns values, throws errors carrying a `code`.
- `routes/` — one module per path prefix; `index.js` registers them and reads as a table of contents for the API.
- `chain.js` — talks to `HumfiverseCatalogueToken` (reads always work; writes need `CHAIN_OPERATOR_PRIVATE_KEY`).
- `chainEscrow.js` — talks to `HumfiverseMilestoneEscrow`.
- `pinata.js` — uploads track audio files to IPFS (§2.43). No SDK — Node's built-in `fetch`/`FormData`/`Blob`.
- `chainRetry.js` — retry wrapper for flaky RPC calls.
- `db.js` — thin wrapper: a local SQLite file by default, a real Turso/libSQL database in production (`TURSO_DATABASE_URL` set).
- `contract-template.js`, `seed-data.js` — mock legal contract text / seed catalogue data.
- `server/.env` — RPC URL, contract addresses, operator key, `PINATA_JWT`, `ADMIN_API_KEY`. Gitignored — `.env.example` documents every var.

## `webapp/` — frontend (Angular 17+, standalone components + signals)

Builds to `../docs` (see below) for GitHub Pages; Netlify builds it fresh from source too (`netlify.toml`).

- `webapp/src/app/core/` — the non-visual layer:
  - `store.service.ts` — central signal-based app state, hydrates from the backend.
  - `api.service.ts` — every backend HTTP call.
  - `wallet.service.ts` — MetaMask/injected-wallet connect + on-chain tx signing (buy/contribute/confirm-milestone).
  - `models.ts` — shared TypeScript types.
  - `*.util.ts` — pure helper functions (funding-% math, formatting, IPFS gateway URLs, yield calculation, royalty aggregates, holdings upsert, on-chain error mapping, etc.) — **check here before re-deriving logic that already exists.**
  - `mock-data/` — bundled fallback data (assets, campaigns, i18n icons) used when the backend is unreachable.
- `webapp/src/app/features/` — one folder per page/screen (`marketplace`, `asset-detail`, `onboarding`, `portfolio`, `kyc`, `studio`, `artist-dashboard`, `artist-milestones`, `admin-escrow`, `for-artists`, `landing`). Each is self-contained: `.component.ts` + `.component.html`, plus any `.model.ts`/`.util.ts` that only that page uses — `onboarding/` has both, holding the wizard's draft shape and its milestone templates (the single source of truth for both the displayed tranche amounts and the basis points sent to the escrow contract).
- `webapp/src/app/shared/` — reusable presentational components (`asset-card`, `cover`, `icon`, chips, charts, etc.) used across multiple features.
- `webapp/src/app/layout/` — top-level app shell (nav, topbar).
- `webapp/public/assets/i18n/` — translation files, one JSON per locale (`en`, `it`, `fr`, `es`, `de`, `ru`, `ja`, `zh`, `ar`) — **always kept at matching key-count parity across all 9** when adding a key.

## `docs/` — the deployed frontend (GitHub Pages source)

**Generated output, not hand-edited.** This is `webapp`'s build output (`ng build` writes here per `angular.json`'s `outputPath`), committed to git because GitHub Pages serves straight from this folder with no build step of its own. Rebuild after any `webapp/src` change: `cd webapp && npx ng build --base-href=/Humfiverse/`. Hashed chunk filenames change on every build — that's normal, not a conflict.

## `planning/` — planning & decision docs

- `technical-architecture.md` — **the detailed technical changelog**, dated and numbered (§2.1 → §2.44+ and counting). Every non-obvious bug, fix, or architectural decision this project has made is documented here with its reasoning. Check here before re-diagnosing something that may already have a documented answer.
- `business-overview.md`, `legal-regulatory-notes.md`, `blockchain-infrastructure-implementation-notes.md`, `frontend-prototype.md` — the original business/legal/technical planning docs, more static, written before most of the build-out.

## `whitepaper/` — public-facing whitepaper (GitBook)

Synced to GitBook via git (`.gitbook.yaml` at the repo root points GitBook at this folder). `SUMMARY.md` is GitBook's table-of-contents file; `README.md` is the space's landing page; everything else is one chapter per file. Unlike `planning/` (internal working docs, written for the team, full of open questions and hedges), this is the polished, external-facing document — written to be read by artists/investors, but held to the same honesty standard as the rest of this project: it states plainly what's actually built/deployed (testnet only, unaudited, no real SPV yet) versus what's planned, rather than reading as a pitch. Update this whenever a real, material change happens to the legal, business, or technical status it describes — not on every commit.

## `.vscode/`, `.claude/`

Editor/tooling config. Most of `.claude/` is gitignored — session-local, not shared between collaborators. **Exception: `.claude/skills/`** — repo-specific Claude Code skills (packaged, checklist-style playbooks for a procedure this project repeats), tracked and shared like `CLAUDE.md`. Currently: `contract-redeploy` (see its `SKILL.md` — the exact steps to redeploy `HumfiverseCatalogueToken`/`HumfiverseMilestoneEscrow` and restore real on-chain state afterward, learned the hard way across four real redeploys this project has needed).
