# The Opportunity

## Royalty income is unusually well-suited to tokenization

Most real-world assets are hard to tokenize honestly because the hard part was never the token — it's proving the asset is what it claims to be, and getting reliable data about its performance. Streaming has quietly solved the second half of that problem for music. Spotify, Apple Music, and the collecting societies report streams and payouts on a regular, auditable cadence, which makes recorded-music royalty income unusually predictable and data-rich compared to most other real-world assets being proposed for tokenization today.

The market has already validated investor appetite for this specific idea, from more than one direction:

| Platform | Legal wrapper | Rail | Who can invest |
|---|---|---|---|
| **Royal** (royal.io) | "Limited Digital Asset" — an NFT-like collectible with attached revenue rights | On-chain | Broadly, framed as a collectible, not a security |
| **anotherblock** | Tokenized streaming right | Ethereum + Optimism | Broadly, framed as fan ownership |
| **JKBX** | SEC-qualified security, sold through a dedicated broker-dealer | Traditional — no blockchain | US retail, via a qualified offering |

Royal has run real payouts to fans since 2022 on catalogues from artists including Nas, Diplo, and The Chainsmokers. JKBX went the opposite technical direction — full securities registration, no blockchain at all in the ownership record — and still found investor demand, per-song, at yields in the low single digits. anotherblock has proven the on-chain version specifically in the EU regulatory environment Humfiverse also operates in.

What differs between these platforms is not whether investors want this — they clearly do — but which legal wrapper and which settlement rail each one chose, and how much regulatory risk each was willing to carry in exchange for speed to market. That is the design space Humfiverse sits in, and no EU-based, MiCA/MiFID-native platform doing exactly this at meaningful scale had surfaced as of this document's research (mid-2026) — worth further diligence before treating as open ground, but a reasonable signal that an EU-first version of this model is not already crowded.

## Who Humfiverse is for

- **Retail and fan investors** who want small-denomination, song-level exposure to royalty income, rather than buying a whole catalogue outright or an opaque pooled royalty fund they cannot see inside.
- **Independent artists and small catalogue owners** who want liquidity or upfront capital against future royalties without signing over full ownership to a major label or a royalty-buyout fund — a faster, fractional alternative to the traditional catalogue-sale model.
- **Existing royalty funds and catalogue owners** who may want to tokenize a slice of an already-owned catalogue to raise capital or provide liquidity to their own limited partners.

Each of these could be Humfiverse's primary customer, and each pulls the product in a different direction — a marketplace app, a capital-raising rail, or a secondary-liquidity venue for funds that already hold catalogues. Humfiverse's pilot is scoped around the first two: giving artists and small catalogue owners direct access to fan and retail capital.

## A risk this project takes seriously rather than ignores: AI content and royalty-pool integrity

Any platform built on royalty income in 2026 has to reckon with a live, unsettled question: does AI-generated music undermine the income streams being tokenized? The honest answer is more specific than a blanket yes or no, and the nuance changes how Humfiverse is built, not just how it is marketed.

Platforms are diverging, not converging, on this. TIDAL began fully demonetizing tracks it classifies as "100% AI-generated" on 15 July 2026 — zero royalties, regardless of fraud — while continuing to pay normally on AI-*assisted* tracks that carry real human creative input. Spotify has taken the opposite public stance, monetizing AI-generated music normally and framing its own policy as being about fraud, not AI authorship. There is no cross-platform bright line yet, and a platform can change its policy unilaterally, after a catalogue is already tokenized, the way TIDAL just did.

The better-evidenced problem, in the data available as of mid-2026, is fraud rather than AI authorship as such: IFPI estimates streaming fraud costs artists roughly $2 billion a year industry-wide, and on Deezer specifically around 85% of streams on AI-generated tracks were bot-driven rather than real listening. The royalty pools this platform taps into are under real pressure — but mostly from fraud and low-quality mass uploads diluting pro-rata payouts, not from AI music being formally locked out of monetization.

Humfiverse treats this as an onboarding-diligence requirement, not an afterthought: every catalogue records, at listing and periodically thereafter, what AI tooling (if any) was used in its creation, disclosed per element — vocals, instrumentation, composition, post-production, lyrics — in the same DDEX-aligned categories DSPs are converging on for disclosure. A platform that only lists diligenced, disclosed catalogues with fraud-pattern screening built into onboarding is offering investors something the broader streaming royalty pool increasingly cannot guarantee on its own.

This connects directly to Humfiverse's pre-production financing model (see [How Humfiverse Works](02-how-it-works.md)): financing the human production layer on top of a raw or AI-assisted draft — real musicians, a real vocalist, a real mix and master, all timestamped and recorded as part of the milestone-escrow process — does not just improve a track creatively. It plausibly moves that track along the exact spectrum DSPs are starting to police, from "policy-exposed" toward "durable." No DSP has published a quantitative threshold for how much human contribution is enough, so Humfiverse markets this honestly, as a factor that materially reduces AI-demonetization exposure — not as a guarantee no policy can ever touch.
