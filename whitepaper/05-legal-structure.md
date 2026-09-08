# Legal & Regulatory Structure

> This chapter summarizes research and working decisions, not legal advice, about a structure that **isn't in force yet** — see [Current Status & Disclaimer](09-status-disclaimer.md). No Humfiverse token has been offered to any investor. A real launch needs a securities lawyer to confirm every point below before a single token is sold.

## The one question everything else depends on

Is a Humfiverse token a regulated financial instrument, or not? In practice, the answer is yes, once it pays holders a share of real royalty income — in the US under the Howey test, and in the EU under MiFID II. That's also the pattern across every comparable platform: JKBX went straight for full securities registration; Royal took the lighter, more contested "digital collectible" route and accepts more legal risk for it. There's no clean way to tokenize real royalty income and avoid securities-style rules entirely. The real choice is which flavor of regulation to take on, and Humfiverse's working plan is to do this the properly-licensed way rather than the fast, ambiguous way.

## The legal wrapper: a Luxembourg vehicle

The entity actually holding each catalogue's royalty right is planned as a **Luxembourg securitization vehicle** — chosen, pending final legal confirmation, for three practical reasons: Luxembourg lets one legal vehicle hold multiple separate "compartments" (potentially one per catalogue, instead of a brand-new company each time), it's the largest fund domicile in the EU with deep expertise in exactly this kind of structuring, and it has a workable path to staying outside a heavier fund-manager licensing regime (more on that below). Malta, which is known for being crypto-friendly, doesn't actually help here — its advantage is for a different kind of crypto license this project isn't pursuing.

## Making sure this doesn't quietly become a "fund"

Pooling many people's money into something professionally managed toward a return can trigger fund-manager regulation (AIFMD) — a much heavier layer requiring an authorized manager and an independent custodian. Two things help keep Humfiverse outside that: staying under certain size thresholds, and structuring each catalogue around one specific, already-identified track rather than a manager actively picking a diversified portfolio.

This isn't just theory — it's exactly why the escrow contract works the way it does. An earlier design gave Humfiverse the power to decide, on its own, whether a production milestone had been met. That's active, discretionary management — the opposite of what keeps this structure outside fund regulation. So it was redesigned: releasing a milestone now requires the artist and the studio to confirm it themselves, with Humfiverse having no say in the decision at all (see [Governance](06-governance.md)). A technical fix to a real legal problem, not just a nicer feature.

## Pre-production financing needs its own answer

Financing an *unfinished* track sits in extra territory beyond the above. The EU's crowdfunding rules (ECSPR) are a possible fit, but not a perfect one — Humfiverse's working approach is to structure each campaign as a simple, recognized financial instrument, with the token acting as a record of ownership of it rather than something novel in itself, which gives it the best shot at qualifying under that lighter regime instead of full securities treatment for every campaign.

## Secondary trading is deliberately not built yet

Letting investors trade tokens with each other at a price that moves automatically would require an entirely separate, heavier license — the kind that runs a stock exchange, not the kind that issues shares. That's a real, multi-year undertaking, not something a contract update solves. Humfiverse's resale feature is kept simple on purpose: individually priced listings between holders, not an automated market.

## What this costs, roughly

Getting a pilot catalogue placed through an already-licensed partner (rather than Humfiverse becoming a licensed firm itself) is estimated at **€80,000–€250,000** in legal and structuring cost — the realistic path for a first pilot. Humfiverse obtaining its own full investment-firm license, needed only to sell at scale without a partner, runs roughly **€300,000–€1,000,000** and over a year to obtain. These are order-of-magnitude estimates from research done in mid-2026, not quotes, and need reconfirming with counsel.

## The rights themselves, separate from the token

Independent of how the token is regulated, someone still has to confirm the underlying royalty right is real: no existing liens, no conflicting agreements, and an assignment to the legal vehicle that survives even if the original rights holder goes bankrupt. In Italy specifically, SIAE no longer holds a legal monopoly on collecting royalties — independent alternatives exist — but the real constraint in any given case is the specific terms of whichever society already administers a catalogue's rights, not a platform-wide rule.

## Investor protection, built into onboarding

Before buying anything, an investor completes an identity check and a short suitability questionnaire, modeled on the EU's standard rules for selling complex instruments without financial advice. A low score produces a clear warning, not an automatic block — matching how those real rules actually work. This is a working prototype of that process, not a certified, lawyer-reviewed version ready for a real regulated launch.
