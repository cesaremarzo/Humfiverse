# Humfiverse

### Fractional ownership of music royalty income, on-chain

> **This is a concept and pilot-stage document, not an offering.** Humfiverse has not raised money from investors, is not licensed by any financial regulator, and nothing described here is investment advice or a solicitation to invest. The smart contracts referenced in this paper are live on the Ethereum Sepolia **test network only** — no real funds move through them. See [Current Status & Disclaimer](09-status-disclaimer.md) before reading anything else as a claim about what exists today versus what is planned.

## Abstract

Recorded music generates royalty income — from streaming, mechanical licensing, performance rights, and sync licensing — that is recurring, increasingly well-measured, and almost entirely locked away from ordinary investors. It sits with labels, publishers, and specialized royalty funds, often illiquid even for the artists who created it. Humfiverse tokenizes the *right to a share of a specific song's or catalogue's royalty income*, issuing on-chain tokens that represent a claim on that cash flow. A claim that today is sold whole, to institutions, in transactions few artists and no retail investors can access, becomes something that can be split into small denominations, held, and — subject to the regulatory path a given catalogue is launched under — transferred.

Humfiverse supports two distinct financing models that intentionally carry different risk profiles and are disclosed as such:

1. **Catalogue tokenization** — an already-released, already-earning song or catalogue is tokenized against its real, reported royalty history. This is the bond-like product: a claim on a known, ongoing cash flow.
2. **Pre-production financing** — an artist raises the money to actually *finish* an unreleased track (studio time, session musicians, mixing and mastering) against future royalty income, with funds held in a milestone-gated on-chain escrow rather than a commingled account. This is the venture-like product: a claim on a cash flow that does not exist yet.

Both models sit on the same underlying infrastructure — a legal wrapper that holds the real royalty right, a token that represents a claim against that wrapper, and a smart contract layer that automates what can honestly be automated (custody, milestone-gated release, pro-rata accounting) without pretending to automate what cannot be (proving who owns a royalty right, collecting money out of a streaming platform, or replacing a securities regulator's judgment about who Humfiverse is allowed to sell this to).

## Why this document exists

Most crypto whitepapers describe a token that does not exist yet, running on infrastructure that has not been built. This one is unusual in the other direction: it describes infrastructure that has already been built and is running — three audited-by-test-suite (not by a third-party auditor — see [Risk Factors](08-risk-factors.md)) Solidity contracts, deployed and verified on a public testnet, driving a working application — attached to a business and legal model that is deliberately still open on several of its biggest questions. Where the technology is ahead of the paperwork, this document says so plainly, chapter by chapter, rather than presenting a polished narrative that implies more certainty than exists. That is a deliberate choice: a project whose core promise is "verifiable, on-chain, checkable by anyone" should be held to that standard in its own whitepaper, not just its code.
