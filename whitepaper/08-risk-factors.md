# Risk Factors

Specific to Humfiverse's actual design and stage — not generic boilerplate. Read alongside [Current Status & Disclaimer](09-status-disclaimer.md).

## Legal

- **No offering exists yet, and the legal path isn't final.** Everything in [Legal & Regulatory Structure](05-legal-structure.md) is a working plan, pending a lawyer's confirmation — it can still change.
- **A regulator could reach a different conclusion** than the one assumed here, which could delay a launch or require restructuring.
- **The rules themselves are still moving** — several of the frameworks discussed were still being finalized as of this document's research.

## Technology

- **The contracts haven't had a professional security audit.** They pass an internal automated test suite, which is meaningfully different from — and weaker than — a third-party audit, especially for anything handling money.
- **The contracts can't be upgraded in place.** Every real change so far has meant deploying new contracts and manually moving real balances across. That's safer in one sense (no admin key can silently change the rules) and riskier in another (a redeploy is a real, manual, error-prone event).
- **This deployment is on a public testnet.** Nothing described as a "real, signed purchase" in this document involves money of any actual value today.
- **Royalty confirmation depends on one trusted party**, not a decentralized network, until that evolves (see [Technical Architecture](03-technical-architecture.md)).

## Money

- **There's no guaranteed way to resell a token**, or to find a buyer at any price.
- **Total loss is possible.** A "projected yield" is a historical number, never a promise. For pre-production campaigns, the track might never get finished, released, or earn anything — that risk is real, not a formality.
- **A streaming platform can change its rules after the fact**, including around AI content, in a way that reduces a catalogue's royalty income after it's already tokenized.
- **Streaming fraud dilutes royalty pools industry-wide** — a risk to the whole asset class, not specific to any one catalogue.

## Operational

- **Milestone deadlock is possible by design.** If the artist and studio genuinely disagree about a milestone, the money stays locked with no automatic way to resolve it — a deliberate tradeoff against giving Humfiverse override power (see [Governance](06-governance.md)).
- **Confirming a royalty right is real is still a human, not a blockchain, job.** An error or an undisclosed prior claim at that stage isn't something the token layer can catch.
- **Humfiverse itself is an early-stage venture.** The platform's own ability to keep operating is a dependency this system doesn't yet have a way around.

Naming these risks plainly, at this stage, is the point of publishing this document — not a formality to get past.
