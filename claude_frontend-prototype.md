# Humfiverse — Frontend Prototype

*Working prototype, 27 Aug 2026 (renamed from "Cadence" same day; wallet/redeem flow and track-cover treatment added same day)*

**Live artifact:** https://claude.ai/code/artifact/65a782c6-1d16-4bfe-945f-9db9bfc6e8e0

A functioning, click-through prototype of the platform's frontend, covering both sides of the marketplace described in the technical architecture doc (§2.6) and concept doc. Built as a single self-contained HTML/CSS/JS app (vanilla JS, no framework), with all data mocked client-side — no backend or smart contract behind it. Wallet connection is the one piece that talks to something real (see below).

## What it covers

**Investor side**
- Marketplace: browse tokenized catalogues and pre-production campaigns, filter by type, search. Each listing tile reads as a track: a play-button affordance, a large initial, and a genre-coded motif (note/waveform/heart/moon/strings/bolt/mic) watermark, procedurally generated per track — no external images.
- Asset detail page: overview, royalty history chart (catalogues) or milestone escrow view (pre-production), AI-content disclosure (per-element: vocals/instrumentation/composition/post-production/lyrics), documents, risk factors
- Buy flow: quantity selection, cost breakdown, required risk-acknowledgement checkbox before purchase, success confirmation
- Portfolio dashboard: holdings, unclaimed royalties, distribution history — claiming itself now happens on the Redeem page (below)
- **Redeem page (new):** connect an injected EVM wallet (MetaMask or similar) via `eth_requestAccounts`/`eth_accounts`/`eth_chainId` — a real connection if the viewer has the extension installed, showing their actual address and network. Once connected, unclaimed royalties per holding can be "redeemed" to that address. The redemption itself is simulated (fake tx hash, short delay, no real transfer) — the app never requests a signature or sends a transaction, only identity. The topbar shows a persistent wallet chip (connect / truncated address) from any page.

**Artist side**
- Overview/landing, 5-step onboarding wizard (details → financing model → verification/budget → AI disclosure → review), and artist dashboard with milestone escrow tracker — unchanged from the first pass.

## Design intent, tied back to the legal/concept docs

- Both financing models (bond-like catalogue vs. venture-like pre-production) are genuinely different flows.
- Milestone-gated escrow (legal doc §4, PledgeMusic precedent) is a first-class UI element.
- AI-content disclosure is captured per-element and surfaced identically on listings.
- Governance is explicitly advisory-only in copy, consistent with the Lido DAO liability risk (legal doc §4).
- Wallet connection is deliberately identity-only (no signature/transaction prompts) — appropriate for a pilot where the legal/regulatory track (securities vs. crypto-asset, see legal doc §1–3) isn't settled yet; nothing here should look like it's moving real funds.
- Persistent pilot/mock-data banner and risk-factor tabs keep the "not investment advice" framing visible throughout.

## Known simplifications (intentionally out of scope for this pass)

- No real auth, KYC/AML, payments, or deployed smart contract — wallet *connection* is real, the redeem *transaction* is simulated.
- No artist-side document upload backend; file attachment is mocked.
- Governance UI (shortlist voting) is described in copy but not built as an interactive flow.
- Track covers are procedural (gradient + initial + genre motif), not real artwork or AI-generated images — there's no real audio or artwork behind these fictional tracks.

Next natural step, if this direction is kept: pick one flow (most likely the investor buy/redeem flow or the artist onboarding wizard) and take it to full depth once the business-model and jurisdiction questions in the legal doc are resolved with counsel — including, at that point, what a real on-chain redeem transaction would need (deployed contract, gas handling, network selection).
