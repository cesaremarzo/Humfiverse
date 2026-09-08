# How Humfiverse Works

## Two products

Humfiverse offers two ways to invest, and treats them as genuinely different, not two flavors of the same pitch:

- **Catalogue tokenization.** A song or catalogue that's already out and already earning royalties gets tokenized. You're buying a share of income that already exists. This is the safer, bond-like product.
- **Pre-production financing.** An artist uploads an unfinished track — a demo, a rough idea — and token sales pay for finishing it: studio time, musicians, mixing and mastering. You're buying a share of income that doesn't exist yet, betting the track gets made and does well. This is the riskier, venture-like product. Most crowdfunded creative projects don't fully pay back their backers, and Humfiverse says so plainly rather than hiding that risk behind the first product's safer profile.

Both work the same way underneath: a legal entity holds the real royalty right, and your token is a claim against *that entity* — never a claim on the copyright itself. See [Legal & Regulatory Structure](05-legal-structure.md).

## The full money loop

Not just where an investor's money goes on the way in — the whole round trip, including how it eventually comes back as a payout:

```mermaid
flowchart TD
    Investor(["Investor"])

    Investor -->|"① buys or contributes"| Choice{"Catalogue<br/>or<br/>Pre-production?"}

    Choice -->|"Catalogue — already earning"| Paid["Rights holder<br/>paid immediately, in full"]
    Choice -->|"Pre-production — not finished"| Escrow["Money held in the<br/>milestone escrow contract"]

    Escrow --> MS

    subgraph MS["② Escrow pays out one tranche at a time —<br/>only once BOTH the Artist and the Studio confirm it themselves"]
        direction LR
        M1["Funding goal<br/>20% → Artist"]
        M2["Studio booked<br/>40% → Studio"]
        M3["Mix & master<br/>30% → Artist"]
        M4["Release confirmed<br/>10% → Artist"]
    end

    Paid --> Track(["Track is released<br/>and streaming"])
    MS --> Track

    Track -->|"③ earns"| Royalties["Royalty income<br/>(Spotify, PROs, etc.)"]
    Royalties -->|"④ confirmed on-chain"| Payout["Distribution contract"]
    Payout -->|"⑤ paid out, pro-rata,<br/>to every token holder"| Investor

    Escrow -.->|"if the campaign is cancelled"| Refund(["Contributors refunded —<br/>the unreleased portion only"])
```

Step by step:

1. **The investor pays**, and their tokens land in their wallet immediately — one transaction, whichever product it is.
2. **For a catalogue**, that's it — the rights holder is paid in full right away, because the track is already earning. **For pre-production**, the money instead sits in the escrow contract and only reaches the artist and studio as the track actually gets made, tranche by tranche. Neither Humfiverse nor the artist can touch it early, and no single side can release a tranche alone — it pays out only once the artist and the studio *both* confirm, independently, that it genuinely happened. If they disagree, the money just stays locked; there's no arbitration, on purpose (see [Governance](06-governance.md)). If the campaign is cancelled instead, contributors are refunded for whatever hasn't been released yet — money already paid out for milestones genuinely delivered stays with whoever earned it.
3. **The track releases and starts earning** royalties from streaming, licensing, and performance.
4. **That income has to be confirmed on-chain** before anything can happen with it — a smart contract can't reach into Spotify and pull money out by itself. Someone has to confirm "this royalty payment really arrived." That confirmation step is the hardest, most important part of the whole system — see [Technical Architecture](03-technical-architecture.md) for how Humfiverse handles it honestly rather than glossing over it.
5. **Confirmed income gets paid out**, pro-rata, to every token holder — closing the loop back to the investor.

## Why an escrow, specifically

A pre-blockchain platform called PledgeMusic tried something similar and collapsed in 2019 — it had been using new campaigns' money to pay off older campaigns, and when growth outpaced its books, artists were left owed hundreds of thousands of dollars that had simply vanished. Humfiverse's escrow is a direct, structural answer to that exact failure: the money is never in one pool anyone can dip into. It's a stronger guarantee than a traditional crowdfunding platform can offer, and — unlike a lot of whitepaper promises — it's real, deployed, and checkable on a block explorer today, not just a design on paper.

## Not a trading venue

Humfiverse's payout system (collect confirmed royalty income, let holders claim their share) is deliberately kept separate from any future system for reselling tokens between holders. A price that moves automatically, set by an algorithm matching buyers and sellers, would cross into running a regulated trading venue — a much heavier license than issuing tokens. So that's not built. Resale, where it exists, works more like a classified ad than a stock exchange: a holder lists tokens at a price they choose, and a buyer takes it or doesn't. See [Legal & Regulatory Structure](05-legal-structure.md).
