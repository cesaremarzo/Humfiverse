# Blockchain infrastructure — implementation notes

*Companion to `technical-architecture.md`. Written 27 Aug 2026 after building a working
prototype of the on-chain infrastructure described there.*

## What was built

A locally-runnable prototype implementing Phase 0/1 of `technical-architecture.md` §3,
built against the **security-token legal path** (ERC-3643-style permissioned
transfers — one of the two branches left open in §4, chosen for this build since
counsel hasn't confirmed which applies yet):

- **Smart contracts** (Solidity, Foundry): `IdentityRegistry` (KYC/whitelist),
  `DefaultCompliance` (per-catalogue transfer rules — holder caps, country
  allow-list), `RoyaltyToken` (permissioned ERC-20 per catalogue, with historical
  balance checkpoints), `DistributionVault` (claims-based pro-rata royalty
  payouts), `RoyaltyOracle` (the attested trust point from §2.3 that bridges a
  confirmed royalty payment on-chain), and `MilestoneEscrow` (the pre-production
  financing variant from §2.7, including the exact "refund net of released
  tranches" formula that doc specifies). Factories for each. 42 tests, all
  passing, covering compliance gating, freeze/forced-transfer, distribution math,
  and the milestone-escrow refund edge case explicitly.
- **Backend**: a small API wrapping the contracts with the platform roles
  (onboarding/KYC agent, catalogue issuer, oracle confirmer, escrow administrator).
- **Frontend**: a local web console for exercising the whole flow — KYC, catalogue
  creation, minting, royalty confirmation, claiming, and running a financing
  campaign through its milestones — by hand.

Delivered to the user as a zip (`music-royalty-chain.zip`) with a `run-local.sh`
one-command bring-up and a full README.

## Notable build constraint

The sandbox this was built in had no npm/pip/apt registry access at all (only
`git`/HTTPS to `github.com` worked). Contracts use Foundry (binaries pulled from
GitHub Releases) instead of Hardhat; the backend uses Node's built-in `http` +
shells out to Foundry's `cast` CLI instead of Express + ethers.js/viem; the
frontend is a dependency-free static HTML/JS page instead of React. All three are
documented as deliberate substitutions for a constrained environment, not the
long-term intended stack — see the repo's README for the swap-back guidance.

## What's deliberately NOT done here (open items)

- **Not audited** — `RoyaltyToken`/`DefaultCompliance` are a from-scratch,
  narrow ERC-3643 implementation; a real deployment should use the audited T-REX
  reference implementation and go through a real audit.
- **Oracle is single-key** — `RoyaltyOracle`'s `CONFIRMER_ROLE` should move to a
  multisig (platform + independent royalty administrator) before any real royalty
  income flows through it.
- **Not deployed anywhere public** — everything targets a local `anvil` chain only.
- **Legal path unresolved** — this was built against the security-token branch of
  the open question in `technical-architecture.md` §4; `legal-regulatory-notes.md`
  is still explicit that no real offering should proceed without counsel
  confirming jurisdiction/classification first.
- **Phase 2/3 features not built**: multi-catalogue marketplace, fiat on-ramp,
  real KYC provider integration, advisory governance module, decentralized
  oracle, secondary-market liquidity — all deliberately deferred per the doc's own
  phased ordering.
