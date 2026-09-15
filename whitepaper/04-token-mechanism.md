# The Token Mechanism

## There's no Humfiverse coin

Worth saying plainly, because it's the most common wrong assumption: **there is no platform-wide token, no fixed supply, no coin that represents "Humfiverse" as a whole.** Every token minted on the platform is a claim on one specific song or catalogue's royalty income, and only exists because that catalogue exists. Own tokens in ten catalogues, and you hold ten separate, independently priced positions — not ten units of one thing.

Technically, every catalogue is one token ID under a single shared contract (a gas-efficient standard for exactly this "many token types, one contract" case) — but each ID is its own instrument, with its own price, its own supply, and its own claim on a specific, named song.

## How a token gets its price

Every catalogue or campaign sets a fixed price per token and a fixed total supply at creation — together, that's the total raise. Prices, payments and fees are all in USDC, a dollar stablecoin, so a $10 token costs exactly ten dollars' worth and every fee is an exact amount to the cent. Buying a catalogue token is direct and immediate: pay the price, get the tokens, in one transaction. Contributing to a pre-production campaign works the same way — the amount you send determines how many tokens you get, delivered in that same transaction, atomically.

Prices don't move automatically as tokens are bought, the way an exchange's price would. That's deliberate — an algorithm that sets a moving market price would cross into running a regulated trading venue (see [Legal & Regulatory Structure](05-legal-structure.md)). Resale between holders, where it exists, works through individually priced listings instead; whether that can be offered for real is still an open legal question.

## What a token actually gives you

A Humfiverse token is a claim against the legal entity holding the underlying royalty right — never the copyright itself. If a campaign is cancelled because the artist's content was unlawful or infringing, investors also keep claims against the artist for released money and damages (see [How Humfiverse Works](02-how-it-works.md)). Exactly what kind of claim it is, and who's allowed to hold it, depends on which regulatory path a given catalogue launches under. Humfiverse hasn't settled that platform-wide; it's a decision made per catalogue and jurisdiction, with real counsel — see [Legal & Regulatory Structure](05-legal-structure.md).

## One accounting rule, no exceptions

Tokens leave a catalogue's pool when they are bought, when a campaign contribution releases them, or when the platform operator releases them directly without payment — a power the operator holds on today's testnet contracts and which is planned to be restricted. The contract tracks exactly how many tokens have ever left the pool and simply refuses to release more than the declared total — there's no way, for Humfiverse or anyone else, to mint more of an existing catalogue's tokens later. Resale carries a 1% platform fee, taken from the payment: the buyer receives every token they pay for, and the seller receives the price less 1%. A first purchase never carries this fee — you can't resell what you don't already own.

## What Humfiverse earns

Three fees, all enforced by the contracts rather than by anyone's discretion, and all fixed in code so they can't be raised on people who already took part:

- **2% of every primary purchase** — buying a catalogue's tokens, or contributing to a pre-production campaign. It is included in the price, not added to it: you pay the listed price, receive every token, and 98% goes to the rights holder or into the campaign's escrow. On a campaign, this 2% is not refunded if the campaign is cancelled.
- **3% of each pre-production tranche, as it is released.** When the artist and the studio both confirm a milestone, the contract pays them 97% of that tranche. A tranche that is never released is never charged. Tranches are sized against what a sold-out campaign actually holds — its goal less the 2% — so every milestone can still be paid in full.
- **1% of every resale payment**, as above.

Across a campaign that sells out and releases every milestone, Humfiverse receives 4.94% of the goal. Fees accumulate inside each contract and can only be sent to the fee address the operator designates; every change of that address is a public on-chain event, and every running total is public on-chain. The 2% contribution fee stays with the platform even if a campaign is cancelled; when the cancellation is the artist's fault, it is part of the damages claimed from the artist.
