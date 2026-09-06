---
name: contract-redeploy
description: Redeploy HumfiverseCatalogueToken and/or HumfiverseMilestoneEscrow on Sepolia, re-link them, and restore all real on-chain state (assets, campaigns, holder balances) that a fresh deploy would otherwise reset to zero. Use whenever a contract source change requires a new deploy — this project has needed this four times already.
---

# Contract redeploy (Sepolia)

Both `HumfiverseCatalogueToken` and `HumfiverseMilestoneEscrow` are immutable once deployed — you can't add a field or fix a bug in place. `HumfiverseMilestoneEscrow` also holds an **immutable** reference to the token contract's address, set at its own construction. This means: **any change to the token contract forces redeploying the escrow too**, even if the escrow's own source didn't change — there's no way to just "point the old escrow at a new token."

A fresh deploy means fresh, empty contract state: every minted token, every escrow campaign, every real holder's balance resets to zero on the new address. The old contract still exists on-chain with the old state — nothing is destroyed — but the app switches to talking to the new address, so from the user's point of view their real holdings vanish unless you manually restore them. This has real financial-feeling consequences even on testnet ETH: it's the user's actual, tested activity being reconstructed, not a cosmetic detail.

## Before touching anything

1. **Get explicit user confirmation before deploying.** This is disruptive and not easily reversible in practice (old state is real but orphaned). If the contract change could instead avoid a redeploy (e.g., storing something off-chain in the metadata JSON instead of on-chain), lay out that tradeoff and let the user choose — don't assume they want the on-chain version. See `planning/technical-architecture.md` §2.43 for a worked example of presenting this choice.
2. **Read every real asset's current on-chain state fresh, right before deploying** — do not reuse numbers from an earlier check in the conversation, or from `technical-architecture.md`. Real users test the live site between your checks; balances change. Query directly:
   ```js
   // token balances + released count, per known real assetId/tokenId
   token.balanceOf(wallet, tokenId)
   token.releasedOf(tokenId)
   // escrow campaign state, per known real assetId
   escrow.campaigns(campaignId)  // .raised, .studioId, .fundingGoal
   escrow.studios(studioId)      // .name, .wallet
   escrow.getMilestones(campaignId)
   ```
   Cross-check the full list of real assets against `GET /api/data` (the backend's asset list) — don't rely on memory of "the 2 or 3 real assets," a new one may have been created since you last checked (this has happened).

## Deploy

3. Compile and run the Hardhat test suite first (`cd contracts && npx hardhat test`) — fix any failures before deploying. If a contract function gained a parameter, check for a "stack too deep" compile error; the fix already in place is `viaIR: true` in `hardhat.config.js`'s solidity settings.
4. Deploy the token first: `npx hardhat run scripts/deploy.js --network sepolia`.
5. Deploy the escrow linked to it: `CATALOGUE_TOKEN_ADDRESS=<token address> npx hardhat run scripts/deployEscrow.js --network sepolia` — this script also calls `setEscrowContract` on the token automatically. Confirm the script's own "Done — escrowContract is now ..." line before moving on.
6. Verify both on Etherscan:
   ```
   npx hardhat verify --network sepolia <token address>
   npx hardhat verify --network sepolia <escrow address> <token address>
   ```
   (Sourcify verification failing separately is normal/harmless — only Etherscan verification matters.)
7. Get each contract's exact deploy block (needed for `CHAIN_CONTRACT_DEPLOY_BLOCK`/`CHAIN_ESCROW_DEPLOY_BLOCK` — used to bound recent-activity event scans, see §2.39):
   ```bash
   KEY=$(grep ETHERSCAN_API_KEY contracts/.env | cut -d= -f2)
   curl -s "https://api.etherscan.io/v2/api?chainid=11155111&module=contract&action=getcontractcreation&contractaddresses=<address>&apikey=$KEY"
   ```

## Restore real state

8. Write a one-off Node script in `contracts/scripts/` (plain `ethers`, not a Hardhat task) that, for every real asset:
   - `mintCatalogue(tokenId, slug, supply, priceWei, title, artist)` — same tokenId/slug/supply/price/title/artist as before the redeploy.
   - `registerStudio(wallet, name)` for preproduction assets, then `createCampaign(artist, fundingGoal, studioId, deadline, assetId, tokenId, milestoneNames, milestoneBps, milestonePayees)` with the same milestone template every campaign in this app uses (`[2000,4000,3000,1000]` bps, artist/studio/artist/artist payees).
   - `releaseFromPool(wallet, tokenId, balance)` for any wallet with a real, non-zero balance from step 2 — this is what makes holders whole again.
   - Skip re-playing the escrow `raised` counter exactly (would need real repeat `contribute()` calls for a cosmetic-only number with no downstream effect on a testnet demo) — note this simplification explicitly in the changelog entry rather than silently skipping it.
   **Run the script, confirm its output, then delete it.** One-off migration scripts don't live permanently in `contracts/scripts/` — see `REPO_MAP.md`.

## Wire the new addresses in

9. Update `server/.env` (all four): `CHAIN_CONTRACT_ADDRESS`, `CHAIN_ESCROW_ADDRESS`, `CHAIN_CONTRACT_DEPLOY_BLOCK`, `CHAIN_ESCROW_DEPLOY_BLOCK`.
10. Update the same four as the fallback defaults in `server/chain.js` and `server/chainEscrow.js` (the `process.env.X || "<default>"` lines) — keeps the code honest even if an env var is ever unset, and documents the current live address in the source itself.
11. Update `server/.env.example` to match (addresses and block numbers are not secrets, safe to commit).

## Verify locally before shipping

12. Start the backend locally against the new contracts (`cd server && rm -f humfiverse.db && node server.js`) and confirm, via `curl`, that `/api/onchain/list`, `/api/portfolio/:wallet` (for a wallet with restored balance), and `/api/escrow/campaigns` all self-heal correctly from the fresh local table — this exercises the exact recent-scan fallback path (§2.39) that a real user's browser will hit first.
13. `cd contracts && npx hardhat test` once more, and `cd webapp && npx ng build --base-href=/Humfiverse/` — both must pass before committing.

## Ship it

14. Write a `planning/technical-architecture.md` changelog entry (next §2.x number) documenting: why the redeploy was needed, the new addresses (linked to Etherscan), what real state was restored and from what values, and anything deliberately simplified (like the `raised` counter above).
15. Commit and push to your `dev/<name>` branch, open a PR (`gh pr create`) per `CLAUDE.md`'s workflow — don't merge without asking, unless the user has explicitly said to skip the PR step for this change.
16. Tell the user exactly which env vars to update on Render, with exact names and values, and that this is a manual step you cannot do yourself.
17. **After the user says it's done, verify — don't trust it.** Curl a production endpoint and check a value that can only be correct if the *new* contract is actually live (e.g., a specific real balance that differs between old and new contract state), not just that the response looks plausible. This project hit a real case where Render silently kept serving stale env vars from an "environment group" that overrode the dashboard's individually-set values — the fix needed a second confirmation round, caught only because the returned balance didn't match either contract's real state at first glance. Cross-check against a direct `ethers` read of the new contract if anything looks off.
18. Merge the PR once the user confirms production looks right.
