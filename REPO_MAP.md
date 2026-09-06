# Humfiverse — repo map

A folder-by-folder index of this repo: what's where, and where to read the *why*. This file answers "where do I look" — it doesn't duplicate the *history* (that's `SESSION_LOG.md` and `planning/technical-architecture.md`) or the *rules* (`CLAUDE.md`). Update this only when a folder's purpose changes, not on every commit.

---

## Top level

| Path | What it is |
|---|---|
| `CLAUDE.md` | Project rules Claude Code reads automatically every session: branch workflow, deploy notes, env var handling. Read this first if you're a new collaborator (human or AI). |
| `SESSION_LOG.md` | Cross-session diary, most recent entry at the bottom. Read this first for *recent* context — what's live, what's in progress. |
| `REPO_MAP.md` | This file. |
| `netlify.toml` | Netlify deploy config (branch preview builds — see `CLAUDE.md` "Team & branches"). |
| `render.yaml` | Render deploy config for the backend (`server/`). |
| `run-dev.sh` | Runs backend + frontend together locally. |
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

Deployed on Render at `humfiverse-api.onrender.com`. No Express — hand-rolled routing in `server.js`.

- `server.js` — the actual HTTP server and every route.
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
  - `*.util.ts` — pure helper functions (funding-% math, formatting, IPFS gateway URLs, yield calculation, etc.) — check here before re-deriving logic that already exists.
  - `mock-data/` — bundled fallback data (assets, campaigns, i18n icons) used when the backend is unreachable.
- `webapp/src/app/features/` — one folder per page/screen (`marketplace`, `asset-detail`, `onboarding`, `portfolio`, `kyc`, `studio`, `artist-dashboard`, `artist-milestones`, `admin-escrow`, `for-artists`, `landing`). Each is self-contained: `.component.ts` + `.component.html`.
- `webapp/src/app/shared/` — reusable presentational components (`asset-card`, `cover`, `icon`, chips, charts, etc.) used across multiple features.
- `webapp/src/app/layout/` — top-level app shell (nav, topbar).
- `webapp/public/assets/i18n/` — translation files, one JSON per locale (`en`, `it`, `fr`, `es`, `de`, `ru`, `ja`, `zh`, `ar`) — **always kept at matching key-count parity across all 9** when adding a key.

## `docs/` — the deployed frontend (GitHub Pages source)

**Generated output, not hand-edited.** This is `webapp`'s build output (`ng build` writes here per `angular.json`'s `outputPath`), committed to git because GitHub Pages serves straight from this folder with no build step of its own. Rebuild after any `webapp/src` change: `cd webapp && npx ng build --base-href=/Humfiverse/`. Hashed chunk filenames change on every build — that's normal, not a conflict.

## `planning/` — planning & decision docs

- `technical-architecture.md` — **the detailed technical changelog**, dated and numbered (§2.1 → §2.44+ and counting). Every non-obvious bug, fix, or architectural decision this project has made is documented here with its reasoning. Check here before re-diagnosing something that may already have a documented answer.
- `business-overview.md`, `legal-regulatory-notes.md`, `blockchain-infrastructure-implementation-notes.md`, `frontend-prototype.md` — the original business/legal/technical planning docs, more static, written before most of the build-out.

## `.vscode/`, `.claude/`

Editor/tooling config. `.claude/` is gitignored — session-local, not shared between collaborators (unlike `CLAUDE.md` at the root, which is tracked and shared).
