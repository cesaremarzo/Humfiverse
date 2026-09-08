# Technical Architecture

## What's actually live

Two smart contracts, deployed and independently verified on **Ethereum Sepolia** — a public test network (see [Current Status & Disclaimer](09-status-disclaimer.md) for what that means):

- **The token contract.** Mints one token per catalogue or campaign into a pool the platform holds, and controls every way tokens can leave it: a fixed-price purchase for already-earning catalogues, or a release triggered by the escrow contract for pre-production campaigns. Each token also carries its track's title, artist name, and — once uploaded — a link to the actual audio file, all readable directly from the contract by anyone, independent of Humfiverse's own website.
- **The escrow contract.** Holds contributed money for pre-production campaigns and releases it in tranches — but only once **both** the artist and the assigned studio confirm, from their own wallets, that a milestone genuinely happened. No one, including Humfiverse, can release a tranche on their own say-so. If the two sides disagree, the money just stays locked — no arbitration, on purpose (see [Governance](06-governance.md)).

A third contract, for peer-to-peer resale between token holders, is written and tested but not yet turned on — that part of the app is still simulated while the compliance question around resale gets worked out (see [Legal & Regulatory Structure](05-legal-structure.md)). Both live contracts pass 71 automated tests. That's real test coverage, not a professional security audit — the two aren't the same thing (see [Risk Factors](08-risk-factors.md)).

## Why Ethereum, why Sepolia

An Ethereum-compatible chain is the standard, well-tested choice — anotherblock, the closest comparable platform, runs on Ethereum too. Humfiverse's pilot sits on Sepolia rather than a cheaper Layer 2 for one practical reason: at this stage, moving no real money yet, easy access to free testnet funds for building and demonstrating mattered more than transaction cost. That choice gets revisited before any real, live deployment.

## The hardest problem isn't the smart contract

Minting a token and writing an escrow contract are both well-understood. The genuinely hard part is everything around them: proving a royalty right is real before it's tokenized, and getting royalty income to *become* an on-chain event in the first place.

Royalty money doesn't arrive on-chain by itself. A streaming platform or collecting society pays into a normal bank account, and someone has to confirm that payment happened and record it on-chain before token holders can be paid. Today, that confirmation is done by a single trusted party — Humfiverse or a royalty administrator — not by a decentralized network. This document says that plainly rather than overselling how "trustless" the system is: the *distribution* of confirmed royalty income is automated and verifiable; the *confirmation itself* still depends on trusting who's allowed to make it. Moving toward a shared, harder-to-fake confirmation process — starting with more than one party having to sign off — is a planned next step, not something already built.

## What the database is for

Humfiverse's backend keeps an ordinary database that mirrors on-chain data for speed — which catalogues exist, current balances, campaign status. It's a cache, not a source of truth: every number in it can be re-derived from the blockchain itself, and the app is built to rebuild that cache automatically if it's ever found to be wrong or wiped. Nothing an investor should rely on lives only in this database.

## Built to be checked

Every listed catalogue links directly to its contract on a block explorer, where anyone can read the actual verified source code — not just compiled bytecode — and see every transaction decoded in plain terms. That's a deliberate commitment: a platform whose whole pitch is "your claim is checkable, independent of us" needs to make checking it genuinely easy, not a chore.
