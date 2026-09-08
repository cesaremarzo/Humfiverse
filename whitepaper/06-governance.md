# Governance

## A reasonable-sounding idea that needs care

For pre-production campaigns, it's tempting to let token holders vote on production choices — which studio, which musicians — so decisions aren't made behind closed doors. That instinct runs into two real problems.

**Legal risk.** In late 2024, a US court ruled that people who vote in a DAO's governance over a real treasury can be treated as general partners in a business — personally liable for its debts, not just for what they invested. That's a live risk for any project giving token holders a binding vote over real decisions, not a hypothetical one.

**Creative risk.** Committee-run creative decisions tend to go badly. It's part of why most successful fan-funding platforms let backers decide *whether* to fund something, but not *how* it gets made.

## Humfiverse's answer: not yet, and advisory when it ships

There's no token-holder voting in Humfiverse today, on purpose — the harder, more foundational parts (verified royalty data, working escrow, honest payouts) need to be proven first, without also debugging a novel governance structure at the same time.

When a voting feature does ship, the plan is a lighter version: token holders vote on a shortlist someone has already vetted, the vote is advisory only, and a legally accountable party still makes the final call and signs the contracts. Every vote and its outcome is recorded on-chain either way, so the process stays transparent even though the vote isn't binding. A cap on how much any one wallet's vote counts is treated as a requirement from day one, not an afterthought — otherwise "no single gatekeeper" just turns into "a few large holders quietly running things instead."

## Where "no one has sole power" already exists today

One piece of this isn't a future plan — it's already live. An earlier version of the escrow contract gave Humfiverse the sole power to decide whether a milestone had genuinely been met. Beyond the legal reason to remove that (see [Legal & Regulatory Structure](05-legal-structure.md)), it also concentrated real power in one place — exactly what this whole chapter is about avoiding.

It was redesigned. A milestone now only pays out once **both** the artist and the studio confirm it, independently, from their own wallets. There is no function anywhere in the contract — not even for Humfiverse's own operator role — that can release money on one side's say-so. If they disagree, the money just stays locked. No arbitration, no timeout, no one who can override it. Humfiverse's actual role here is limited to registering the artist and studio and setting up the campaign on agreed terms — not judging whether anyone did their job.
