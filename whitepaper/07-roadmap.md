# Roadmap

Humfiverse's build has, honestly, moved faster on infrastructure than on the legal foundation it depends on — the phases below are listed in the order they need to be *true*, not the order pieces of them happen to have been built in. Where a phase's technology already exists ahead of its legal prerequisites, that is stated plainly rather than implied to be further along than it is.

## Phase 0 — Paper pilot: the legal foundation

One song or a small catalogue, manually verified, with a real legal vehicle formed and a real royalty-collection account in place, proving the legal-to-cash-to-token pipeline end to end with real, if small, royalty income — before any of it needs to be polished into a product. No governance module. If the pre-production model is in scope for this pilot, milestone confirmation is manually administered rather than smart-contract-enforced at this stage.

**Status: not started.** No legal vehicle has been formed, no counsel has confirmed jurisdiction or classification, and no real catalogue's royalty income has been verified end to end. This is the actual next dependency for everything that follows, regardless of how much of the technology below already exists.

## Phase 1 — Minimum on-chain pilot

Smart contracts for token issuance, milestone-gated escrow, and claims-based distribution, first on a testnet, then a single deployment for a real pilot catalogue once Phase 0's legal foundation is in place — with the royalty-confirmation step still manual and attested, not decentralized. Still no governance or voting.

**Status: the technology is substantially built and proven, ahead of this phase's legal prerequisite.** `HumfiverseCatalogueToken` and `HumfiverseMilestoneEscrow` are deployed, independently verified, and have processed real signed transactions — real wallet-initiated purchases and contributions, real dual-confirmation milestone logic — on Ethereum Sepolia. What is not yet true: this is a public testnet, not a production deployment backed by a real legal vehicle or real royalty income, and no royalty-distribution claims contract has been built yet, since there is no real royalty income for it to distribute.

## Phase 2 — Marketplace

Multi-catalogue listing, a fiat on-ramp so retail users are not required to already hold crypto, integrated KYC, and compliant basic secondary transfer. This is also where the advisory governance module (see [Governance](06-governance.md)) ships — once the legal-vehicle-manager role, shortlist-vetting process, and vote-weight caps are properly in place, not before.

**Status: partially prototyped, not compliant or licensed.** A working multi-catalogue marketplace exists, along with a prototype MiFID II-style appropriateness check gating purchases and basic, non-custodial resale listings between holders. None of this has been reviewed by counsel or connects to a licensed offering; a fiat on-ramp does not exist, and every purchase today settles in testnet ETH, not fiat or a stablecoin.

## Phase 3 — Scale

Decentralize or professionalize the royalty-confirmation oracle step beyond a single attested party, and — subject to obtaining the correct, separate trading-venue authorization (see [Legal & Regulatory Structure](05-legal-structure.md)) — consider genuine secondary-market liquidity mechanisms, kept architecturally distinct from the royalty-distribution mechanism itself.

**Status: not started, and deliberately not attempted before the phases above are real.**
