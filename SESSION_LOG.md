# Humfiverse — Session Log

Running handoff notes between Claude Code sessions on this project.

**How this works:** at the end of a session, say "save in memory for the
next session" and a new dated entry gets appended below summarizing what
happened, what's live, and what's next. At the start of a new session
(in this terminal or a fresh one, or in VS Code), read this file first —
most recent entry is at the bottom — to pick up full context without
re-explaining anything.

---

## 2026-08-28

**What exists and is live:**
- Frontend (`docs/index.html`): the click-through prototype, deployed via
  GitHub Pages at https://cesaremarzo.github.io/Humfiverse/. Marketplace,
  asset detail, buy flow, portfolio, redeem (via wallet identity connect),
  artist onboarding/dashboard. Mascot: an animated AI-robot busker
  (guitar + drum kit) walking left-to-right across the bottom of the page,
  popping simulated "+$ royalties" earnings periodically.
- Backend (`server/`): a small Node.js API (zero npm dependencies — uses
  built-in `http` + `node:sqlite`) deployed on Render at
  https://humfiverse-api.onrender.com. Endpoints: `GET /api/health`,
  `GET /api/data` (assets/campaigns/portfolio), `POST /api/redeem`.
  Free tier — spins down after 15 min idle, ~30-50s cold start.
- The frontend hydrates from the backend on load and falls back to
  bundled mock data if the backend is unreachable (e.g. cold start, or
  opened as a plain static file).
- GitHub repo: https://github.com/cesaremarzo/Humfiverse (public, `main`
  branch). `gh` CLI is installed and authenticated as `cesaremarzo` —
  `git push`/`git pull` work directly from the terminal, no manual tokens
  needed anymore.
- Deploy config: `render.yaml` (Render blueprint, service name
  `humfiverse-api`, rootDir `server/`, `--experimental-sqlite` flag for
  Node compatibility).

**Project layout (reorganized this session):**
- `docs/` — deployed frontend (GitHub Pages source, do not rename — the
  Pages setting points at this exact folder)
- `server/` — backend API + SQLite seed data
- `planning/` — the original business/legal/technical planning docs
  (business-overview, technical-architecture, legal-regulatory-notes,
  blockchain-infrastructure-implementation-notes, frontend-prototype)
- `.vscode/` — recommends the Claude Code extension, hides node_modules
  and the local SQLite db file from the explorer
- `run-dev.sh` — runs backend + frontend together locally
  (`http://localhost:8080` + `http://localhost:3001`)
- Removed: `dashboard/` (an older, pre-backend/pre-robot duplicate of
  `docs/index.html` — still recoverable from git history if ever needed)

**Everything is still simulated, by design and matching where the real
project is:** no real SPV, smart contracts, KYC, payments, or wallets —
see `planning/technical-architecture.md` §3 for the actual phased build
plan (Phase 0 hasn't started). The wallet "connect" is real (reads an
injected wallet's address/chain), but redeeming is a fake tx hash, and
the backend is a mock data server, not real infrastructure.

**Open items / possible next steps:**
- Custom domain (optional) — not set up; GitHub Pages custom-domain field
  was left blank on purpose (that field is only for a domain you actually
  own, not the default `github.io` URL).
- If real infrastructure work ever starts (auth, real backend, smart
  contracts, KYC), that's a much bigger scope needing its own planning
  session — flagged, not started.
- No automated tests exist for either the frontend or backend.

---

## 2026-08-28 (update)

- Set up this file itself: `SESSION_LOG.md` now exists as the standing
  cross-session handoff doc, triggered by saying "save in memory for the
  next session" (appends a new dated entry here rather than overwriting).
- Also saved a matching Claude memory note (type: feedback) so a brand
  new session knows to read this file first, before even opening it —
  see the assistant's persistent memory for this project if curious.
- No functional/code changes this update — purely the logging workflow
  itself, committed and pushed (`60321ff`).
