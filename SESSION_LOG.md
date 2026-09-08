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

---

## 2026-08-28 → 2026-08-29 (major session — read this fully before continuing)

Huge session. Frontend was fully rewritten (Angular), real legal decisions were made (Luxembourg, MiFID II), and a real smart contract is live on a real testnet with real transactions. Details below, roughly in the order they happened.

**1. Compliance decisions (see `planning/legal-regulatory-notes.md` §7 for full detail):**
- Confirmed path: token = MiFID II financial instrument (not MiCA/CASP), issuing vehicle moved from an Italian SPV to a **Luxembourg securitization vehicle** (compartments instead of one company per catalogue), Malta explicitly considered and rejected (Malta's edge is CASP-specific, irrelevant here; also FATF grey-listed 2021–2022).
- A real secondary market (investors trading tokens with each other, price moving) would need **MTF/OTF authorization under MiFID II**, not CASP — heavier than issuance, EU-harmonized, not eased by any jurisdiction choice. Not built for real; only simulated where it appears in the UI.
- MiFID II Art. 25(3) investor appropriateness is implemented for real in the UI (see #3 below).

**2. Artist contract template, now Luxembourg-governed:**
- `server/contract-template.js` (mirrored as fallback in the Angular app) — a milestone-escrow/royalty-assignment agreement artists accept when launching a catalogue-kind campaign. 8 clauses, 5 flagged as needing separate individual acceptance (SPV-manager discretion, tranche forfeiture, liability limit, royalty exclusivity, governing law/forum) — the UX principle (flag risky clauses, separate checkboxes) is kept, but the legal basis is no longer cited as Italian art. 1341 co.2 c.c. (wrong now that it's Luxembourg-governed) — replaced with a `legalBasisNote` pointing at EU Directive 93/13/EEC + Luxembourg adhesion-contract principles, explicitly flagged as **not confirmed by counsel**.
- **Authoritative language is now French** (`fr`), not Italian — Luxembourg civil/commercial law is published in French. IT/EN/ES/DE are provisional AI-assisted translations; the UI shows a visible warning whenever viewing in a non-authoritative language.
- Draft prototype text throughout — never reviewed by a real lawyer. Don't treat as usable for anything real.

**3. Investor KYC / MiFID II appropriateness — implemented, gates the buy flow:**
- New `#/kyc` flow: identity fields, retail/professional classification (self-declared, not the real Annex II criteria), a 4-question appropriateness assessment scored server-side (`server/server.js` `scoreAppropriateness()` — an illustrative heuristic, not a validated methodology), AML source-of-funds + PEP self-declaration.
- Below-threshold shows a warning but does **not** block purchase — matches the real execution-only regime (warn, don't refuse).
- The buy button on asset-detail is disabled until `investor.verified` is true.

**4. Projected yield — was fake, now actually computed:**
- Old: a hardcoded number, disconnected from the royalty-history chart next to it.
- New: `yield% = (royalty paid over trailing 12 months ÷ (tokenPrice × tokensTotal)) × 100`, in `computeYieldBreakdown()`. An info popover shows the formula + real numbers + a "not a guaranteed return" disclaimer.
- Fixing this exposed the mock royalty-history generator was never calibrated against token price/supply — computed yields came out at 37–71% before `buildRoyaltyHistory()` base amounts were rescaled in the seed data to reproduce plausible single-digit numbers (same shape, different scale).

**5. Real smart contract, deployed to a real testnet (Base Sepolia) — this is not simulated:**
- `contracts/` — Hardhat project, `HumfiverseCatalogueToken.sol` (ERC-1155, OpenZeppelin v5). One token id per catalogue-kind demo track. `mintCatalogue()` mints the full supply into the contract's own balance (the "pool"), using `ERC1155Holder` (plain mint-to-self reverts without it — real bug hit and fixed). `releaseFromPool()` is owner-gated and over-release-guarded. 8 passing tests.
- **Deployed and live**: contract at [`0xC1aFD3D24de2C344053bBe83aB412140C452146b`](https://sepolia.basescan.org/address/0xC1aFD3D24de2C344053bBe83aB412140C452146b) on Base Sepolia. Deployer/owner wallet: `0x142F945e13f59FdE3583bea8F78528a44317BfC6` — **a real private key the user pasted into chat** (`27dda16bbcb4b1a99f6766cc134708fc2e5bffd5548d2b18be580df2a1b7bef1`). Testnet-only, negligible balance (~0.00018 ETH), but it IS exposed in this conversation's history — never treat it as safe to reuse anywhere with real value.
- 6 tokens minted so far, all real on-chain transactions (verified by querying `CatalogueMinted` events directly from the chain, not just local DB): midnight-static(1, 4000), ember-choir(2, 2500), paper-cranes(3, 5000), copper-radio(4, 3200), test-catalogue-1(5, 1000), midnight-echo-2(6, 1500). **No token called "Guns" exists on-chain** — user asked about it, turned out the live site's mint silently failed (see below) and the campaign only ever existed client-side in their browser.
- `contracts/.env` and `server/.env` hold the operator key locally (both gitignored, confirmed never committed). `.env.example` files show what's needed.

**6. On-chain data wired into the app, new campaigns auto-mint:**
- `server/chain.js` — the backend's one real dependency (`ethers`). `GET /api/onchain/:assetId` (public read, live pool/supply/released, no key needed) and `POST /api/onchain/mint` (owner-gated write). `onchain_tokens` table maps assetId→tokenId, seeded at boot with the 4 original catalogues' real historical tx hashes.
- **Real bug found and fixed**: the local token-id counter can desync from on-chain truth (happened during testing when the local DB was wiped but the chain still remembered token id 5 was taken) — mint now verifies `totalSupplyOf(candidateId) == 0` on-chain before committing to an id, not just trusting local bookkeeping.
- Angular's artist-onboarding wizard calls the mint endpoint automatically after creating a new catalogue-kind campaign, using the UI's own `tokensTotal` as the on-chain supply. Asset-detail page shows a live on-chain panel (token id, pool/supply, block-explorer link) when present.
- **Known gap, not yet resolved**: the production backend on Render (`https://humfiverse-api.onrender.com`) does NOT have `CHAIN_OPERATOR_PRIVATE_KEY` set, and as of last check also appeared to be running an older deploy (`/api/onchain/*` returned 404 there while working locally) — Render's auto-deploy may not have picked up recent pushes. **Next session: check whether the user added the env var / triggered a manual deploy on Render, verify `GET https://humfiverse-api.onrender.com/api/onchain/midnight-static` actually works, and confirm minting succeeds from the live site, not just locally.**

**7. Frontend fully rewritten from the HTML/JS monolith to Angular (`webapp/`):**
- Full 1:1 feature parity, done via a background fork with a very detailed brief — verified afterward independently (build success, live API smoke test, i18n key-count parity 294/294 at the time, now 304/304 after later additions). Standalone components + Angular Signals (not RxJS/NgRx) for state, `@ngx-translate/core` for runtime i18n (no reload), hash-based routing (`withHashLocation()`, keeps the old `#/marketplace` URL shape, sidesteps GitHub Pages SPA-routing issues entirely).
- Source: `webapp/src/app/` — `core/` (StoreService = central signal store, ApiService, WalletService), `features/` (one component per screen), `shared/`, `layout/`.
- **Build output goes to `docs/`** (`angular.json` outputPath `../docs`), so GitHub Pages' existing "serve from /docs" setting didn't need to change. To rebuild after any source edit: `cd webapp && npx ng build`, then `git add -A && git commit && git push` from the repo root (the `docs/` diff — hashed chunk filenames change every build, that's normal).
- **No headless/real browser was available in this environment all session** — every verification was build-success + HTTP/API smoke tests + code tracing, never an actual visual click-through by Claude. Worth doing a real manual pass at some point.
- Old `dashboard/`-era rooster mascot and the original AI-robot-busker mascot are both gone (robot was removed earlier per explicit request, well before the Angular rewrite).

**8. Brand: purple, not terracotta; new waveform logo:**
- Accent color changed from terracotta (`#A6572A`/`#D98A4D`) to deep purple (`#6B3FA0` light / `#C39BE8` dark) — applied via the existing CSS custom-property system (`--accent`, `--accent-ink`, `--accent-soft`, `--accent-soft-border`, both theme blocks), so it propagates everywhere automatically.
- Logo: a symmetric 9-bar sine-profile waveform (chosen over an earlier concentric-rings direction, then over an earlier ripple/burst/open-mouth set of 3 directions — see the published design canvas artifact from earlier in the session if it's still needed, URL not re-saved here). Used as the topbar brand mark, and as a large (opacity ~0.16) decorative background on the for-artists page and the new landing page.
- **A new root landing page** (`webapp/src/app/features/landing/`) replaces the old redirect-straight-to-marketplace behavior: logo, tagline ("Get your art's independence funded." + translations), two buttons ("I'm an artist" / "I'm an investor") that set the existing `perspective` signal and navigate to `/for-artists` or `/marketplace`.

**9. Housekeeping:**
- `gh` CLI stays authenticated — `git push`/`pull` just work, no manual tokens.
- An empty, untracked, unexplained `password` file appeared at the repo root at some point this session (found by the Angular-migration fork) — added to `.gitignore` so it never gets committed, left in place, origin never determined, harmless (0 bytes).
- `.gitignore` now also excludes `.env` at the repo root level (previously only `contracts/.gitignore` had it — a real gap, since `server/.env` wasn't excluded until this was fixed).

**Open items for next session:**
- Resolve the Render deploy/env-var gap (§6) — this is the immediate next step the user asked for.
- No real browser click-through has ever been done on the Angular app — worth doing once, especially the artist-onboarding wizard and KYC flow end to end.
- Everything is still fundamentally a demo: no real SPV, no real KYC verification, no real payments, testnet-only crypto. That's intentional and matches where the actual project is (see `planning/technical-architecture.md` for the real phased build plan) — don't let the real Base Sepolia contract create a false impression that more is "real" than actually is.

---

## 2026-09-03 — second collaborator onboarded (Vincenzo), branch workflow set up

A second person, Vincenzo, is joining the project. Set up a two-branch
workflow plus a `CLAUDE.md` so both people's Claude Code sessions follow
the same conventions automatically:

- Created `dev/cesare`, pushed to `origin`. `dev/vincenzo` is his to
  create the same way (branched from `main`).
- Added `CLAUDE.md` at repo root (tracked in git, so it's automatically
  read by Claude Code for anyone who clones the repo — unlike `.claude/`,
  which is gitignored and local-only). It documents: never push directly
  to `main`; work happens on `dev/<name>`, merged to `main` via PR; Render
  deploys from `main` only; `.env` files are local-only/gitignored, never
  committed; a stack quick-reference (Sepolia + Alchemy RPC limits, the
  two independent contracts, etc.); and 5 conflict-avoidance practices
  (merge small & often, sync `main` into your branch before starting work
  each session, split work by area, check the other person's recent
  commits before touching a shared "hot" file, and — important caveat —
  two different people's Claude Code sessions can't coordinate with each
  other automatically across accounts, so a quick human heads-up is still
  the most reliable way to avoid collisions).
- **Message to forward to Vincenzo to get him set up** (also good context
  for his Claude Code session's first prompt):

  > Ciao! Ecco come iniziare sul repo Humfiverse:
  > 1. `git clone https://github.com/cesaremarzo/Humfiverse.git`
  > 2. `git checkout -b dev/vincenzo` (parti da `main`)
  > 3. Apri il progetto in Claude Code — leggerà automaticamente
  >    `CLAUDE.md` (regole del repo) e `SESSION_LOG.md` (contesto di
  >    quello che è stato fatto finora, questa voce compresa).
  > 4. Copia `server/.env.example` → `server/.env` e
  >    `contracts/.env.example` → `contracts/.env`, poi compilali con le
  >    tue chiavi/valori (chiedimeli se ti servono quelli condivisi, tipo
  >    l'RPC — **non committare mai questi due file**, sono già in
  >    `.gitignore`).
  > 5. Lavora sempre su `dev/vincenzo`, mai direttamente su `main`. Quando
  >    hai qualcosa di pronto, apri una PR verso `main` (`gh pr create`)
  >    invece di pushare direttamente.
  > 6. Prima di iniziare a lavorare ogni volta, sincronizza `main` nel tuo
  >    branch (`git fetch && git merge origin/main`) così eventuali
  >    conflitti li vedi subito, non a sorpresa dentro una PR.
  > 7. Se stai per toccare un file "caldo" condiviso (`server/server.js`,
  >    `server/chain.js`, roba sotto `webapp/src/app/core/`), dammi un
  >    'ping' prima — le nostre due sessioni Claude non si parlano tra
  >    loro automaticamente, quindi resta il modo più affidabile per non
  >    pestarci i piedi.

- No code/functional changes this session — purely workflow/onboarding
  setup, on `dev/cesare` (commit `6b0a414`, not yet merged to `main`).

---

## 2026-09-04 — Netlify preview deploys working, marketplace funding-bar bug fixed

Continuation of the collaborator-onboarding session above, same day. The
`CLAUDE.md`/branch-workflow PR (#1) got merged to `main`. Then set up and
debugged real Netlify deploys, and fixed a real on-chain-data bug the
user found on the live site.

**Netlify — three real, sequential build failures found and fixed** (each
caught from an actual Netlify build log the user pasted, not guessed):
1. **404 on every page load despite a successful deploy**: `docs/index.html`
   (built for GitHub Pages) has `base href="/Humfiverse/"` — GitHub Pages
   serves this repo from that subpath, but Netlify serves from the domain
   root, so every JS/CSS asset request 404'd. Fixed by adding
   `netlify.toml` that builds the app fresh on Netlify with
   `--base-href=/` instead of relying on the GitHub-Pages-flavored
   committed `docs/`.
2. **`npm warn EBADENGINE`** — Angular 22's toolchain needs Node
   `^22.22.3 || ^24.15.0 || >=26.0.0`; the pinned `NODE_VERSION=22.12.0`
   was below that. Fixed by pinning only the major (`NODE_VERSION=22`),
   so Netlify always resolves the latest 22.x patch.
3. **Build silently hung** right after printing the build command, no
   error: the Angular CLI's first-run "share anonymous usage data?"
   prompt blocks on stdin on a non-interactive CI runner. Fixed with
   `NG_CLI_ANALYTICS=false` in `netlify.toml`'s build environment — and
   additionally, a local `ng build` run with that env var wrote
   `cli.analytics: false` into `webapp/angular.json`, which disables the
   prompt permanently for everyone, everywhere (not just Netlify), so
   this shouldn't recur even in a brand new clone.
- `netlify.toml` (repo root): `command = "cd webapp && npm ci && npx ng
  build --base-href=/"`, `publish = "docs"`, plus the env vars above and
  an SPA-fallback redirect (belt-and-suspenders; the app's hash-based
  routing shouldn't normally need it).
- **Still to verify next session**: confirm a Netlify deploy actually
  succeeds end-to-end with all three fixes in place (was mid-troubleshoot
  when the session ended), and confirm branch-deploy previews for
  `dev/cesare`/`dev/vincenzo` are enabled in the Netlify dashboard (a
  manual dashboard setting, not something committed in code) so both
  collaborators get separate live preview URLs.

**Real bug found and fixed: marketplace card funding bar never moved
after a real purchase.** The user reported Guns' progress bar not
advancing despite real tokens sold, live on the site. Root cause: the
marketplace's `AssetCardComponent` computed its % from
`a.tokensSold`/`a.tokensTotal` — static mock fields that never update —
while the asset-detail page had its own, separate, correct calculation
reading real on-chain pool balance / escrow raised amounts. Fixed by
extracting that calculation into `webapp/src/app/core/onchain-progress.util.ts`
(`remainingFor`/`fundingPctFor`/`tokensSoldFor`/`fundingRaisedFor`),
refactoring asset-detail to use it (removing the duplicated logic), and
wiring the marketplace cards to the same functions via two new
`StoreService` signals (`onchainInfoMap`, `escrowInfoMap`) populated once
per chain-verified asset during `hydrateFromBackend()`.
- The user also asked why, without a wallet connected, the marketplace
  showed all 6 mock tracks instead of the 2 real ones — traced this to
  **not** be wallet-related at all (marketplace filtering has no wallet
  dependency); confirmed via direct `curl` that the backend now correctly
  returns the 2 real assets (`guns-448`, `black-sail-739`) — this was
  very likely the tail end of the `/api/onchain/list` bug fixed earlier
  the same day (see the "local table as primary source" entry above), or
  a Render free-tier cold-start hiccup. Told the user to hard-refresh and
  retest; **worth confirming next session that it's actually resolved on
  their end**, not just from this session's own `curl` check.

**Workflow note**: several of this session's fixes (the three Netlify
fixes, the funding-bar fix) were pushed and merged directly to `main`
without going through a PR, at the user's explicit request each time
("fai direttamente merge senza pull request") — a deliberate, faster
path for quick infra/bug fixes, not a reversal of the PR-based workflow
`CLAUDE.md` documents for normal feature work. Worth keeping in mind:
default to the PR workflow unless the user explicitly asks to skip it
again.

All changes are on `main` (and mirrored onto `dev/cesare`), commits
`b73f26c` → `fef2a31` (see `git log` for the full list — netlify.toml
added/fixed across `b73f26c`, `1c3f69e`, `a2fd463`; funding-bar fix in
`fef2a31`).

---

## 2026-09-05 → 2026-09-06 — token/escrow unification, real audio upload, repo docs

Big session, same collaboration thread as above. Four real contract
redeploys happened (yes, four — see the new skill at the bottom of this
entry). All work went through PRs on `dev/cesare`, merged to `main` after
explicit confirmation each time (PRs #2–#5) — the direct-merge-without-PR
pattern from the previous entry did **not** recur this session; back to
the normal PR workflow throughout.

**1. Unified catalogue and preproduction token release (PR #2).** User's
explicit ask: a preproduction `contribute()` should deliver tokens
exactly like a catalogue `buy()` does — one signed transaction, not a
contribution followed by a second backend-signed release (the old §2.34
design). `HumfiverseCatalogueToken.releaseFromPool` is now callable by an
authorized escrow contract, not just the owner; `HumfiverseMilestoneEscrow.contribute()`
releases the matching tokens atomically, in the same transaction, via the
linked token contract. Removed the now-dangerous (double-release risk)
`releaseForContribution` backend flow entirely. Real redeploy #1
(token `0xfd8D1d...`, escrow `0xa1670bC...`) — see
`planning/technical-architecture.md` §2.42 for full detail.

**2. Real audio-file upload, linked on-chain (PR #3).** User's explicit
ask: upload a track's actual audio and link it on-chain to the contract
that mints/sells its tokens — the wizard never touched a real audio file
before, only metadata. Storage decision given to the user as a real
tradeoff (Render's disk is ephemeral): **IPFS via Pinata**, user created
the account and provided the API key. `HumfiverseCatalogueToken` gained
`trackAudioUri` + `setTrackAudioUri`; `server/pinata.js` uploads via
Node's built-in fetch/FormData/Blob, no new dependency. New
`POST /api/onchain/audio/:assetId`. Since `HumfiverseMilestoneEscrow`'s
reference to the token is **immutable**, this forced redeploy #2 of
*both* contracts (token `0xd8820e0...`, escrow `0x170c825f...`) — real
holder balances (Guns 45, Black Sail 9 — both had grown from real testing
since redeploy #1) were read fresh right before redeploying and restored
exactly. See §2.43.

**3. Marketplace audio preview + artist wallet on the escrow panel (PR
#4).** Same-day follow-up, also explicit asks: a track should be
previewable from the marketplace grid itself, and the asset-detail page
should show the funding data tied to the artist who registered it. Wired
the marketplace cover art's previously-decorative "play" icon to a real
preview via a new shared `PreviewAudioService` (one `<audio>` element,
starting one card's preview stops another's). Added the campaign's
artist wallet address to the escrow panel. Frontend-only, no redeploy.
See §2.44.

**4. Repo documentation, user-initiated (PRs #5).** User asked directly
whether any file tracks "what's where and how it was built" across the
whole repo — answer was no, not as a single file, so:
- **`REPO_MAP.md`** — folder-by-folder index of the repo (contracts/,
  server/, webapp/, docs/, planning/), cross-referencing `SESSION_LOG.md`
  and `technical-architecture.md` rather than duplicating them. Linked
  from `CLAUDE.md`.
- **`.claude/skills/contract-redeploy/SKILL.md`** — a real Claude Code
  skill, the user's own idea after asking whether the project would need
  one going forward. Packages the exact redeploy playbook (snapshot real
  state fresh → deploy token → deploy escrow linked to it → verify on
  Etherscan → restore real assets/campaigns/balances via a one-off
  script → wire in new addresses → verify locally → ship via PR → verify
  production isn't silently still on the old contract → merge) learned
  across this session's four real redeploys. Had to carve `.claude/skills/`
  out of `.gitignore`'s blanket `.claude/` exclusion so it's shared via
  git like `CLAUDE.md`, not session-local — the rest of `.claude/` stays
  ignored.

**A real gotcha hit twice while verifying redeploy #1 in production**:
after updating Render's env vars to the new contract addresses, the API
kept responding with old-contract data. Root cause: Render's dashboard
env vars were overridden by an **environment group** the user hadn't
realized existed — editing the individual service's env vars did nothing
until the group's values were fixed too. Caught by comparing a real
balance number against a direct `ethers` read of both the old and new
contract (not by trusting that the response merely "looked plausible") —
now written into the `contract-redeploy` skill as an explicit step, not
just a one-off lesson.

**Contract addresses at the end of this session** (current production,
Sepolia): `HumfiverseCatalogueToken` at `0xd8820e0fb8F6229577BcdfA0BaAF864280B969a4`,
`HumfiverseMilestoneEscrow` at `0x170c825f68024D0b919BfacecD0D8FcFDc639f8d`.
Real assets live on it: `guns-448` (Guns, 45 tokens held by the test
wallet), `black-sail-739` (Black Sail, 9 tokens held), `darios-516`
(dariosà, 0 held), `primo-pezzo-783` (Primo Pezzo, catalogue-kind, no
audio linked yet as of this entry).

**Open items for next session**: none blocking. Worth confirming the
marketplace audio preview actually works when clicked on the live site
(verified via code review + build success, not an actual browser click —
no browser tooling available this session, see the `run` skill's note in
`CLAUDE.md` about testing UI changes for real when possible).

---

## 2026-09-06 → 2026-09-08 — full-project review, several real bugs the user caught by actually using the site, first whitepaper draft

Big session, no contract redeploy (contract addresses unchanged from the
entry above). Everything went through PRs on `dev/cesare`, merged to
`main` only when the user explicitly asked, same as always — PRs #7–#12,
all listed below with their merge order.

**1. Full-project review (PR #7, first half).** The user asked for a
complete review of the project. Ran four reviews in parallel (Solidity
contracts, backend, Angular core/architecture, Angular
pages/UX/i18n/accessibility), each briefed on this log and
`technical-architecture.md` so it wouldn't re-flag already-documented,
deliberate decisions as bugs. Findings compiled into a published Artifact
("Humfiverse Audit") the user can revisit. Fixed and shipped the
low-risk findings in the same pass:
- `server.js`: `readBody`/`readRawBody` could hang a request forever on
  an oversized body (`req.destroy()` killed the socket `res` needed to
  respond on — fixed by rejecting without destroying); `isAdminAuthorized`
  now uses `crypto.timingSafeEqual`; `/api/assets` returns the right
  status per failure type instead of a blanket 502; `PORT`/`DB_PATH`/
  `TOKEN_METADATA_BASE` documented in `.env.example`.
- `run-dev.sh`: dropped the `--experimental-sqlite` flag, stale since the
  Turso/@libsql migration (§2.23) — was passing a flag for a sync SQLite
  API the backend hasn't used in over a week.
- `npm audit`: 0 vulnerabilities left in `webapp`; `contracts` reduced via
  a non-breaking fix (the rest need a Hardhat 2→3 migration, not
  attempted — real risk, already flagged elsewhere in this doc re:
  Sourcify verification).
- `webapp`: `weiToUsd()`/`usdToWei()` deduplicated from 6 files into
  `core/usd-eth.util.ts`; `truncate()` deduplicated from 3 components
  into `WalletService.truncateAddr()`; removed a dead i18n key
  (`redeem.successBody`, zero references, all 9 locales); the
  marketplace track-preview toggle (`shared/cover.component.ts`) is now
  keyboard-operable (`role="button"`, focus, Enter/Space) instead of
  mouse-only.

**2. Critical bug found by the user actually using the wizard (PR #7,
second half): tracks created through onboarding kept ending up with no
playable audio.** Root cause: `onboarding.component.ts`'s `submit()`
fired the audio-upload and escrow-creation calls without awaiting them,
then immediately redirected to `/artist/dashboard` with a "campaign
launched" toast. The audio-link request stays open server-side until the
Pinata upload *and* the on-chain `setTrackAudioUri` tx both confirm —
up to a minute — so leaving the page early (which the UI actively
invited, looking finished) silently lost the link, with no way to retry
since audio can only be attached during creation. `submit()` now awaits
both calls and the UI shows a "Publishing…" state with an explicit
don't-close-this-tab note. **A second discovery while diagnosing this**:
even the one track that *did* have linked audio (`guns-448`) turned out
to be a 35-byte plain-text test file from when this feature was first
built (§2.43), not real audio — clicking its play button did nothing
visible because the browser can't decode it, which is the same visible
symptom as "no audio" for an unrelated reason. Both this and the fake
Guns file were left for the user to fix by re-creating the affected
campaigns now that the underlying bug is gone — there's no "edit an
existing campaign" surface anywhere in the app to patch them in place.

**3. Cover-embedded audio preview on the asset-detail page, and a
related staleness bug (PR #8).** The marketplace card's play/pause icon
overlay (§2.44) only existed on the marketplace grid; the asset-detail
page had a plain `<audio controls>` element instead, disconnected from
the cover shown at the top of the same page. The cover's icon there now
drives that same `<audio>` element directly via a `viewChild` ref
(deliberately not the marketplace's shared `PreviewAudioService`, which
would fight this page's own full player over playback state). Found
while testing: `store.onchainInfoMap` (audioUri/pool/price — what
marketplace cards read) is only ever populated once at app boot, so a
campaign created in the same browser session showed no preview icon or
funding data on its card until a full reload, even though
`onchainAssetIds` (whether the card shows *at all*) was already updated
live for exactly this reason. `onboarding.component.ts` now refreshes
that map entry too, right after minting.

**4. "View on block explorer" doing nothing after a purchase — took two
rounds to actually fix (PR #8, then #9).** First fix: dropped
`target="_blank"`/`rel="noopener"` from all 5 external links on the
asset-detail page, on the theory that a wallet app's in-app browser
(MetaMask Mobile, commonly used for exactly this kind of on-chain
purchase) might be silently swallowing new-tab requests. The user
retested and it still didn't work. Second fix, since the URL itself
checked out correct in both source and the live deployed bundle: all 5
links now also fire `window.location.href` on click via an
`openExternal()` handler (keeping `href` on the element for
hover-preview/right-click/screen readers) — forcing navigation through
the one API with no known environment that silently no-ops it, rather
than continuing to trust the browser's native anchor-click handling.
**This was the actual fix** — the user confirmed it started working and
identified the real cause themselves: Brave's Shields, which block
exactly this kind of new-tab/redirect behavior more aggressively than
Chrome/Firefox. Worth remembering for any future "a link/redirect
silently does nothing" report — ask what browser first.

**5. Fake "projected yield" — a real bug, not just a calibration issue
(PR #10).** The user caught a 75.2% projected yield on a track they'd
just uploaded, correctly identifying it as impossible for a track with
no real distribution history, and asked for a way to compute this for
real. Root cause: `onboarding.component.ts`'s catalogue branch called
`buildRoyaltyHistory()` (a seeded random-walk generator) to fabricate a
fake royalty history for every new catalogue campaign. Its base amount
(1800/mo) was calibrated years ago against the four *original* demo
catalogues' own varied price/supply combinations (§2.9) but never
against the wizard's own fixed $20/token × 1,500-token economics
($30k raise) — trailing-12-months-of-$1800 against a $30k raise lands
at ~72-75% for *every* catalogue the wizard creates, regardless of the
actual track. Recalibrating the generator would only have produced a
more convincing fake number, so the fix removes it entirely:
`onboarding.component.ts` no longer generates a royalty history for new
catalogues (`royalty-history.util.ts` deleted, its only caller), and
every place that reads `Asset.royaltyHistory` — the marketplace card's
yield badge, both royalty-chart sections on asset-detail — now shows an
honest "Royalty data pending" state instead of a fabricated number or a
null-masked-as-zero one (`asset-card.component.ts`'s `(y || 0)` was
doing exactly that). New admin-gated `DELETE
/api/admin/royalty-history/:assetId` to strip the already-stored fake
history from the two campaigns created before this fix (`primo-pezzo-783`
and whatever id "Secondo Pezzo" actually has — **not yet confirmed run
by the user**, flagged below). **Still open, proposed but not built**:
letting an artist self-report a real monthly royalty figure during
onboarding for an already-earning catalogue, so a real yield number
becomes possible for catalogue tokenization specifically — the user
was interested, nothing built yet.

**6. On-chain purchase reverting at the exact max quantity the UI
itself offered (PR #10, same PR as #5).** The user reported buying
Guns' full advertised remaining amount (1,300 tokens, $13,000 at its
$10 price) always failed on-chain. `remainingFor()` computed a
preproduction campaign's "remaining" purely from the escrow's
raised/fundingGoal ratio, which only tracks ETH that came in through a
real `contribute()` call on the *current* contract — it never accounted
for the 45 tokens this project has manually re-released directly via
`releaseFromPool` across past contract redeploys (§2.36/§2.42/§2.43),
to make a real holder whole, which never touches `raised`. The token
contract's real pool balance was 1,255, not 1,300; buying the UI's own
advertised max reverted every time. Fixed by preferring the token
contract's real `poolBalance` (already fetched via `onchainInfo`)
whenever available, for a preproduction campaign too, not just
catalogue-kind ones — the actual hard constraint either purchase path
shares, independent of how the ETH-side accounting happens to track it.

**7. Real on-chain errors were all collapsed into one unhelpful message
(PR #11).** Surfaced while chasing #6: after that fix, the user hit
"on-chain purchase not completed" and there was no way — from either
side — to tell whether it was a leftover instance of the same bug, a
declined signature, or something else, since `onchainErrorKey()` mapped
every failure to the same generic toast regardless of cause; the real
reason only ever reached the browser console. Replaced with
`onchainErrorMessage()`, which distinguishes a declined signature
(`ACTION_REJECTED`), an underfunded wallet (`INSUFFICIENT_FUNDS`), a
transaction mined but reverted on-chain (this app's own `'tx-failed'`),
and — when ethers can decode one — the raw on-chain revert reason
itself, shown verbatim rather than translated. **Not yet confirmed
whether the Guns purchase now actually succeeds end-to-end** — the
conversation moved to other things before a final retest was reported;
worth checking first next session.

**8. First whitepaper draft, structured for GitBook (PR #12 + one
unmerged commit).** The user wants a public whitepaper, specifically on
GitBook (a git-sync-based docs tool, dominant for crypto whitepapers).
`whitepaper/` (10 chapters, ~8,400 words) synthesizes the existing
internal planning docs (`business-overview.md`, `legal-regulatory-notes.md`,
`blockchain-infrastructure-implementation-notes.md`,
`technical-architecture.md`) into a public-facing document — deliberately
not just a copy of their working-draft tone, but held to the same
honesty standard: states plainly that no real SPV exists yet, no token
has been offered to any investor, and the deployed contracts are
unaudited and live on a public testnet only. Explicitly clarifies there
is no platform-wide Humfiverse coin — only per-catalogue ERC-1155 tokens.
- Added `.gitbook.yaml` at the repo root first (for GitBook's older,
  single-"Space" git-sync model) — this turned out to be the wrong
  mechanism for the user's actual setup, which is a GitBook **Site**
  (their newer product), and the space came up completely empty
  ("the page does not exist") because a Site needs `gitbook-docs.yaml`
  at the Git Sync **Project directory** to map any content to any space
  at all; `.gitbook.yaml` alone has no effect until something points a
  space at a directory in the first place. Confirmed this by fetching
  GitBook's own current docs and its schema directly
  (`api.gitbook.com/gitbook-docs.yaml`), since the product had moved on
  from what a first search turned up.
- Added `gitbook-docs.yaml` (repo root) mapping exactly one space —
  `whitepaper` → `./whitepaper` — since that's the only directory in
  this repo actually shaped as GitBook content (its own README+SUMMARY).
  Deliberately didn't map `planning/` (internal, superseded by the
  whitepaper itself) or any code directory. **Pushed to `dev/cesare`
  only, not yet merged to `main`** — the user hadn't asked to merge this
  one by the end of the session.
- Told the user to leave GitBook's "Project directory" field blank,
  since `gitbook-docs.yaml` lives at the repo root and GitBook defaults
  there — **not yet confirmed whether the sync actually picked up
  content after this change.**
- The earlier root-level `.gitbook.yaml` is very likely redundant now
  under the Site/`gitbook-docs.yaml` model — left in place (wasn't asked
  to remove it), flagged here rather than silently deleted.

**Open items for next session:**
- Merge `gitbook-docs.yaml` (commit `5376267`, `dev/cesare` only) to
  `main` if the user wants it live — not yet asked for.
- Confirm the GitBook Site actually shows the whitepaper's content now
  that `gitbook-docs.yaml` exists and "Project directory" is blank.
- Confirm buying tokens for Guns (or any preproduction campaign) now
  actually succeeds end-to-end on-chain — the remaining-tokens fix (#6)
  and the better error messages (#7) were both shipped, but no final
  "it worked" was confirmed before the conversation moved on.
- Run the two `DELETE /api/admin/royalty-history/:assetId` cleanup
  calls (Primo Pezzo, and whichever id Secondo Pezzo actually has — the
  user needs to grab that from `GET /api/data` first) to strip the
  already-stored fake royalty history #5 left behind on those two.
- Decide whether to remove the now-likely-redundant root `.gitbook.yaml`.
- Decide whether to build the proposed self-reported-monthly-royalty
  field for catalogue onboarding (#5's real-yield follow-up) — discussed,
  not committed to.
- The onboarding wizard's "months of history" field (catalogue model)
  still collects a number that no longer feeds anything now that fake
  royalty-history generation is gone — cosmetic dead input, flagged
  during #5's fix but not resolved.
