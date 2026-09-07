# Risk Factors

This list is specific to Humfiverse's actual design and current stage, not a generic boilerplate risk section. It should be read alongside [Current Status & Disclaimer](09-status-disclaimer.md).

## Regulatory and legal risk

- **No offering exists yet, and the regulatory path is not finalized.** Everything in [Legal & Regulatory Structure](05-legal-structure.md) is a working position pending confirmation from qualified counsel, not a settled legal fact. The classification of a Humfiverse token, the jurisdiction of the legal vehicle holding a given royalty right, and which license (if any) is required can all still change.
- **A regulator could reach a different classification than the one assumed here.** If a Humfiverse token, or the vehicle issuing it, is found to require a different or additional authorization than currently planned — including, for the pre-production model, possible AIFMD collective-investment-scheme treatment — launch timelines and cost could change materially, or a given structure could need to be unwound entirely.
- **Regulation itself is still moving.** MiCA implementation in Italy, and crypto-asset taxation rules more broadly, were still actively settling as of this document's research. A rule that applies today may not apply the same way by the time any real offering launches.

## Smart contract and technology risk

- **The contracts are not third-party audited.** They are covered by an internal, passing automated test suite, which is meaningfully different from a professional security audit and does not carry the same assurance against subtle logic errors, especially around fund-handling paths.
- **The contracts are not upgradeable.** Every material change to Humfiverse's contracts to date has required a full redeployment to a new address, with real holder balances and campaign state manually migrated across. A future bug fix follows the same pattern — it is not applied in place — which is both a safety feature (no admin key can silently rewrite the rules a token holder already agreed to) and an operational risk (a redeployment is a real, manual, error-prone event, and past ones have required careful reconciliation of real balances).
- **This deployment is on a public testnet.** Ethereum Sepolia tokens, balances, and transactions described in this document have no monetary value and can be reset or become unreliable at the network's own discretion, as is normal and expected for any testnet. Nothing describing "real, signed, on-chain purchases" in this document should be read as describing a transaction of real economic value today.
- **Royalty confirmation is a single attested trust point, not yet decentralized** (see [Technical Architecture](03-technical-architecture.md)). Until this evolves toward a multi-party or fully decentralized attestation, a real launch depends on the honesty and continued operation of whichever party is authorized to confirm royalty receipt on-chain.

## Financial and market risk

- **Illiquidity.** There is no guaranteed secondary market for any Humfiverse token. Resale, where it exists at all, depends on finding another buyer willing to transact at a price the seller sets; a holder may not be able to exit a position when they want to, or at any price.
- **Total loss is possible.** For catalogue tokenization, royalty income can decline as well as grow — a "projected yield" figure is a trailing, historical calculation, never a promised or guaranteed return. For pre-production financing specifically, the underlying venture may never be completed, released, or successfully monetized at all; contributors should expect a real, non-trivial chance of not recouping their contribution, the same way most creative crowdfunding and early-stage venture investing carries that risk.
- **Platform-policy risk is real and can change after the fact.** A streaming platform can alter its monetization policy — including around AI-generated or AI-assisted content — after a catalogue has already been tokenized, potentially reducing the royalty income a token's value depends on. See [The Opportunity](01-market-opportunity.md) for how Humfiverse's own diligence process tries to price this in, which reduces but does not eliminate this exposure.
- **Streaming fraud dilutes pro-rata royalty pools industry-wide**, independent of anything Humfiverse does — a risk affecting the underlying asset class generally, not specific to any one catalogue's own conduct.

## Operational and counterparty risk

- **Milestone deadlock is a designed possibility, not a bug.** Because a pre-production milestone releases funds only when both the artist and the assigned studio confirm it independently, and there is deliberately no arbitration path (see [Governance](06-governance.md)), a genuine disagreement between the two parties leaves funds locked with no automatic resolution. This is a deliberate tradeoff against giving Humfiverse discretionary release power, and it means a contributor's funds could remain locked, unreleased and unrefunded, for as long as that disagreement is unresolved.
- **Rights and title risk exists independent of the token.** Confirming clean title to a royalty stream, and correctly structuring its assignment to the legal vehicle issuing tokens against it, is conventional music-industry diligence that a blockchain does not automate or guarantee — an error or an undisclosed prior claim at this layer is a risk the token layer cannot detect or correct after the fact.
- **Humfiverse itself is an early-stage venture.** The platform's own continuity — its ability to operate the attested royalty-confirmation role, administer legal vehicles, and support the application — is itself a dependency this system currently has no way to route around.

## What none of this changes

Stating these risks explicitly is the point of publishing this document at this stage, not a formality to get past. A platform whose core claim is "verifiable, checkable by anyone" should disclose what is and is not yet true about itself with the same rigor it asks of the catalogues it lists.
