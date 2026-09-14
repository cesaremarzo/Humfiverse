# The Token Mechanism

## There's no Humfiverse coin

Worth saying plainly, because it's the most common wrong assumption: **there is no platform-wide token, no fixed supply, no coin that represents "Humfiverse" as a whole.** Every token minted on the platform is a claim on one specific song or catalogue's royalty income, and only exists because that catalogue exists. Own tokens in ten catalogues, and you hold ten separate, independently priced positions — not ten units of one thing.

Technically, every catalogue is one token ID under a single shared contract (a gas-efficient standard for exactly this "many token types, one contract" case) — but each ID is its own instrument, with its own price, its own supply, and its own claim on a specific, named song.

## How a token gets its price

Every catalogue or campaign sets a fixed price per token and a fixed total supply at creation — together, that's the total raise. Buying a catalogue token is direct and immediate: pay the price, get the tokens, in one transaction. Contributing to a pre-production campaign works the same way — the amount you send determines how many tokens you get, delivered in that same transaction, atomically.

Prices don't move automatically as tokens are bought, the way an exchange's price would. That's deliberate — an algorithm that sets a moving market price would cross into running a regulated trading venue (see [Legal & Regulatory Structure](05-legal-structure.md)). Resale between holders, where it exists, works through individually priced listings instead — closer to a classified ad than a stock ticker.

## What a token actually gives you

A Humfiverse token is a claim against the legal entity holding the underlying royalty right — never the copyright itself, and never something you can enforce against the artist personally. Exactly what kind of claim it is, and who's allowed to hold it, depends on which regulatory path a given catalogue launches under. Humfiverse hasn't settled that platform-wide; it's a decision made per catalogue and jurisdiction, with real counsel — see [Legal & Regulatory Structure](05-legal-structure.md).

## One accounting rule, no exceptions

Tokens only ever leave a catalogue's pool two ways: a first purchase, or a resale from one holder to another. The contract tracks exactly how many tokens have ever left the pool and simply refuses to release more than the declared total — there's no way, for Humfiverse or anyone else, to quietly mint more of an existing catalogue's tokens later. Resale carries a 1% platform fee, taken from the payment: the buyer receives every token they pay for, and the seller receives the price less 1%. A first purchase never carries this fee — you can't resell what you don't already own.

## What Humfiverse earns

Two fees, both enforced by the contracts rather than by anyone's discretion, and both fixed in code so they can't be raised on people who already took part:

- **5% of each pre-production tranche, as it is released.** When the artist and the studio both confirm a milestone, the contract pays them 95% of that tranche and keeps 5% for the platform. A tranche that is never released is never charged — so if a campaign is cancelled, the fee applies only to what was genuinely delivered, and contributors' refunds are unaffected.
- **1% of every resale payment**, as above.

Fees accumulate inside each contract and can only ever be sent to the platform's designated fee address. Both running totals are public on-chain.
