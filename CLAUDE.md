# Humfiverse — project notes for Claude Code

Read `SESSION_LOG.md` first (most recent entry at the bottom) for full
running context on what's live and what's in progress. Read
`planning/technical-architecture.md` for design decisions and their
rationale — it has a dated changelog (§2.x) documenting every non-obvious
fix this project has needed; check it before re-diagnosing something that
may have already been solved and explained there.

## Team & branches

Two people work on this repo: Cesare (`dev/cesare`) and Vincenzo
(`dev/vincenzo`). Rules for any Claude Code session here, regardless of
who's driving:

- **Never commit or push directly to `main`.** Work happens on the
  person's own `dev/<name>` branch; `main` only moves via merge/PR.
- Push to your own `dev/<name>` branch freely — it's expected to be
  rebuilt/force-pushed/rebased as needed, it's a personal working branch,
  not a shared one.
- Before merging your branch into `main`, pull `main` and merge/rebase it
  into your branch first, resolve any conflicts there — don't discover
  conflicts for the first time in a PR against `main`.
- Merges into `main` should go through a GitHub PR (`gh pr create`), not a
  local `git merge` + push, so the other person can see what changed. Only
  actually push to `main` (or merge a PR) when the user explicitly asks —
  same rule as any other repo.
- If you're about to touch a file the other person is likely also
  mid-change on (check recent commits on their branch with
  `git log origin/dev/<name>`), say so before diving in.

## Render deploy

`humfiverse-api` on Render deploys from whatever branch its dashboard is
set to — confirm it's set to `main` only, so pushes to `dev/*` branches
never touch production. Backend changes only go live after being merged
to `main` and Render redeploys (auto on push, or manually trigger it).

## Environment / secrets

`server/.env` and `contracts/.env` are gitignored — each person keeps
their own local copy (not shared via git). Required vars are documented
with comments in `server/.env.example` and `contracts/.env.example`. Real
RPC keys, operator private keys, and Turso credentials must never be
committed — double-check `git diff`/`git status` before staging if you've
touched either `.env` file's surrounding area.

## Stack quick reference

- Frontend: Angular 17+ (standalone components, signals), built to
  `docs/` for GitHub Pages (`cesaremarzo.github.io/Humfiverse`).
- Backend: Node.js, zero-dependency `http` server + Turso (libSQL) in
  production / local SQLite file in dev, deployed on Render (free tier —
  cold starts after 15 min idle).
- Contracts: Solidity 0.8.24 + Hardhat + OpenZeppelin v5, deployed on
  **Ethereum Sepolia** (not Base Sepolia — migrated, see
  technical-architecture.md §2.35). Two independent contracts,
  `HumfiverseCatalogueToken` (ERC-1155) and `HumfiverseMilestoneEscrow` —
  they never call each other.
- RPC: Alchemy (free tier caps `eth_getLogs` at a 10-block range per
  call — see §2.39). Never redesign around a full-history event scan;
  the local DB tables (`onchain_tokens`, `escrow_campaigns`) are the
  primary source of truth for listing, chain scans are only a bounded
  recent-activity supplement.

## Testing

`contracts/test/` has the Hardhat test suite (`npm test` in `contracts/`)
— run it after any contract change. There's no frontend/backend
automated test suite yet; for UI changes, actually run the dev server and
click through the flow (see the `run` skill) rather than assuming a
build pass means the feature works.
