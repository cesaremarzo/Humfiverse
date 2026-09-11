# Humfiverse

A prototype platform for tokenizing music royalty streams. An artist
either tokenizes an existing catalogue or raises preproduction funding
released against milestones; investors buy per-track tokens and hold a
share of what that track earns.

**This is a testnet prototype, not a product.** The contracts are
deployed to Ethereum Sepolia, are unaudited, and hold no real value. No
SPV exists, no token has been offered to any investor, and the KYC and
royalty-distribution flows are simulated. The parts that are genuinely
real are listed below, because the difference matters when reading the
code.

| Real | Simulated |
|---|---|
| ERC-1155 token mint, purchase, and pool release on Sepolia | Royalty distribution and redemption |
| Milestone escrow, funded and released by artist + studio wallets | KYC identity verification |
| Track audio pinned to IPFS and linked on-chain | Secondary-market resale |
| Wallet balances, read per token from the contract | Legal contract signature |

---

## 1. Where things live

Four independent parts, each with its own dependencies and its own
lifecycle:

| Folder | What | Deployed to |
|---|---|---|
| `contracts/` | Solidity, Hardhat, OpenZeppelin v5 | Ethereum Sepolia |
| `server/` | Node HTTP API, no framework | Render |
| `webapp/` | Angular, standalone components + signals | GitHub Pages and Netlify |
| `docs/` | The frontend's committed build output | served by GitHub Pages |

Everything else is documentation. Read it in this order depending on
what you need:

- **`REPO_MAP.md`** — folder-by-folder index of the whole repo, and what
  each file is for. Start here to find something.
- **`server/STRUCTURE.md`** — the backend's layers, its file-by-file
  table, and how to add an endpoint. Read before changing `server/`.
- **`planning/technical-architecture.md`** — the numbered, dated
  changelog. Every non-obvious decision and bug fix, with its reasoning.
  Check here before re-diagnosing anything.
- **`SESSION_LOG.md`** — running diary, newest entry at the bottom. What
  is live, what is half-done.
- **`CLAUDE.md`** — branch workflow and conventions. Binding for both
  collaborators.
- **`whitepaper/`** — the public-facing document, synced to GitBook.

---

## 2. Prerequisites

- **Node.js 22.22.3 or newer.** The Angular 22 toolchain requires
  `^22.22.3 || ^24.15.0 || >=26.0.0`; the backend needs only `>=22.5.0`.
  If you run one Node version for everything, satisfy the stricter one.
- **A browser wallet** (MetaMask or similar) on the Sepolia network, for
  anything involving a purchase, a contribution, or a milestone
  confirmation.
- **Sepolia test ETH**, from a faucet, in that wallet.
- Nothing else is required to read data. The marketplace, the asset pages
  and the on-chain panels all render without a wallet connected.

---

## 3. Setup

Each part is configured independently. Do the ones you need.

### Backend

```bash
cd server
npm install
cp .env.example .env
```

`server/.env.example` documents every variable inline, including how to
generate the ones that need generating. Nothing is required to boot: the
server starts with an empty `.env` and degrades one feature at a time.

| Unset variable | Consequence |
|---|---|
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Storage falls back to a local SQLite file. **This is what local development uses.** |
| `CHAIN_OPERATOR_PRIVATE_KEY` | On-chain mint returns `503`. Everything else works. |
| `PINATA_JWT` | Audio upload returns `503`. Everything else works. |
| `ADMIN_API_KEY` | Admin endpoints are **disabled**, not open. They fail closed by design. |
| `CHAIN_RPC_URL` | Falls back to a public Sepolia endpoint, which this project has repeatedly found unreliable. Use your own Alchemy key. |

### Frontend

```bash
cd webapp
npm install
```

No `.env`: the API base URL is compiled in, from
`src/environments/`. `ng serve` defaults to the development
configuration and points at `localhost:3001`; `ng build` defaults to
production and points at Render.

### Contracts

```bash
cd contracts
npm install
cp .env.example .env
```

`DEPLOYER_PRIVATE_KEY` must be a throwaway testnet key holding Sepolia
test ETH. Never reuse a wallet that touches mainnet or real funds.

---

## 4. Running locally

The everyday loop is the backend plus the Angular dev server:

```bash
# terminal 1
cd server && npm start          # http://localhost:3001

# terminal 2
cd webapp && npx ng serve       # http://localhost:4200/Humfiverse
```

Note the `/Humfiverse` in that second URL. `ng serve` inherits the base
href from `angular.json`, which is set for GitHub Pages' subpath, so the
bare `localhost:4200` redirects rather than serving the app.

Confirm the backend is up before using the app:

```bash
curl localhost:3001/api/health  # {"ok":true}
```

`./run-dev.sh` starts both together. Note that the version currently on
`main` serves the committed `docs/` build rather than running `ng serve`,
which means it loads the production API and the wrong base path. Use the
two commands above until the corrected script is merged; a fixed version
already exists on the `dev/vincenzo` branch.

To run the backend against a throwaway database instead of the local
file, so you can experiment without touching your dev data:

```bash
cd server && DB_PATH=/tmp/humfiverse-test.db npm start
```

---

## 5. Building and deploying

**Frontend to GitHub Pages.** `docs/` is generated output committed to
git, because Pages serves that folder directly with no build step of its
own. Rebuild it after any change under `webapp/src`:

```bash
cd webapp && npx ng build --base-href=/Humfiverse/
```

The hashed chunk filenames change on every build. That is normal, not a
conflict.

**Frontend to Netlify.** Built from source on every push, per
`netlify.toml`. It overrides the base href to `/` because Netlify serves
from the domain root while Pages serves from a subpath. It does not touch
`docs/`.

**Backend to Render.** `humfiverse-api` deploys from whatever branch its
dashboard is set to, which should be `main` only. A backend change goes
live after it is merged to `main` and Render redeploys, automatically on
push or manually triggered. Configuration lives in `render.yaml`; the
secrets are set in the Render dashboard, never in the repo.

**Contracts to Sepolia.** Deploy order is always the token first, then
the escrow, because the escrow takes the token's address at construction
and the token must then authorize the escrow back.

```bash
cd contracts
npm run compile
npm test
npm run deploy:sepolia
```

A redeploy resets on-chain state that real holders depend on. This
project has needed one four times, and the exact recovery procedure is
written down in `.claude/skills/contract-redeploy/SKILL.md`. Follow it
rather than improvising.

---

## 6. Testing

The contracts have a real Hardhat suite. Run it after any contract
change:

```bash
cd contracts && npm test
```

There is no automated suite for the backend or the frontend yet. For any
change to either, run the app and click through the affected flow. A
passing build is not evidence that a feature works, and this project has
shipped several bugs that a build could never have caught.

---

## 7. The API

27 endpoints, all under `/api`. `server/routes/index.js` lists every
module and reads as a table of contents; each module holds one path
prefix. `server/STRUCTURE.md` has the full map.

Admin endpoints require an `X-Admin-Key` header matching `ADMIN_API_KEY`,
and exist only to clear cached state after a contract redeploy. They
cannot un-mint a token or alter anything on chain.

One endpoint returns `410 Gone` on purpose. Humfiverse deliberately has
no ability to release an escrow milestone by itself; both confirmations
come from the artist's and the studio's own wallets.
