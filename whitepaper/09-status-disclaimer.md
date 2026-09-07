# Current Status & Disclaimer

## What exists today, stated plainly

- Humfiverse is a **working software prototype**: a live web application backed by a real backend and two independently verified Solidity smart contracts, deployed on **Ethereum Sepolia — a public test network.**
- Every contract address changes when the contracts are redeployed, which has happened several times as the design has evolved. Rather than print an address here that will go stale, the live application links every listed catalogue or campaign directly to its *current* contract on the block explorer, and to the contract's own verified source code — that link is the authoritative, current reference, not any address printed in this document.
- Purchases and contributions made through the application today are **real, signed blockchain transactions** — a connected wallet genuinely signs and broadcasts them, and they genuinely appear on Sepolia's public block explorer. What makes this a prototype rather than a live financial product is that **Sepolia ETH has no monetary value.** No real money has changed hands through this system.
- **No legal entity currently holds any real royalty right on Humfiverse's behalf.** No SPV, securitization compartment, or equivalent vehicle has been formed. No catalogue's royalty income has been independently verified against real distributor, DSP, or collecting-society data. The catalogues visible in the application today were created by real people testing the platform, but represent no verified, real royalty income.
- **No token has been offered, marketed, or sold to any investor under any securities or crowdfunding exemption**, in any jurisdiction. No regulator has reviewed or approved anything described in this document.
- **No smart contract described in this document has been audited by an independent third-party security firm.** They are covered by an internal automated test suite (71 passing tests as of this writing), which is not equivalent to an audit.

## What this document is not

- This is **not** a securities offering, a prospectus, an offering memorandum, or a solicitation to buy or sell any instrument, in any jurisdiction.
- This is **not** investment advice. Nothing in this document should be relied on to make a financial decision.
- Figures describing market comparables, regulatory costs, and thresholds throughout this document are drawn from public research current as of mid-2026 and should be independently re-verified — particularly anything regulatory, since several of the frameworks discussed (MiCA's Italian implementation, Italian crypto-asset taxation rules) were still actively settling at the time this document was written.
- Nothing in this document is a promise about future functionality, timeline, or return. The [Roadmap](07-roadmap.md) describes intent, not a commitment.

## Who is behind this

Humfiverse is being built and published by its operator as a concept and pilot-stage project. This document does not name individual team members or make claims about team composition, credentials, or prior track record — where that information matters to a reader's evaluation of this project, it should be sought directly from the operator, not assumed from this document's absence of it.

## How to verify any specific claim in this document

Every technical claim in this document is designed to be independently checkable, and readers are encouraged to do exactly that rather than take it on faith:

- The smart contracts' actual behavior: read their verified source code directly on the block explorer, linked from the live application.
- Whether a specific purchase or contribution was a real transaction: every completed purchase in the application shows its transaction hash and a direct link to that transaction on the block explorer.
- The automated test suite's current pass/fail status and coverage: available in the project's public source repository.

If any statement in this document cannot be verified this way, that is worth reporting as an inconsistency, not assuming as fact.

---

*This document is a working draft, current as of September 2026, and will be revised as the project's legal, business, and technical status changes. Where a later version of this document conflicts with an earlier one, the later version reflects the project's current actual status.*
