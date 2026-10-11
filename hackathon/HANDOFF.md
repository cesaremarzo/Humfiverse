# Hackathon handoff: Petru

Welcome aboard. This file covers the hackathon, the state of the submission, and how to work on the **demo** and **pitch** videos from your branch, `dev/petru`.

## 1. The hackathon

- **Event:** Colosseum, Crypto World's Fair hackathon.
- **Deadline:** **12 Oct 2026, 11:59 pm PT**, which is **13 Oct, 08:59 in Italy**. The team leader (Cesare) uploads the submission on the Colosseum platform.
- **Required videos:**
  - **Demo video:** ≤ 3 min, on YouTube, Loom or Vimeo. The rules say it must *"show the live product, not a slide deck, not a code walkthrough"*.
  - **Pitch video:** team, problem, solution, why now, traction, business model and next steps. Ours runs 2:30.
- **Judging criteria (official rules §8):**
  - Functionality
  - Potential impact (TAM, effect on the crypto ecosystem)
  - Novelty
  - UX (how blockchain improves the UX)
  - Open source and composability
  - Team's ability to execute

  Both videos should hit every one of these.
- **Accounts:** site https://humfiverse.com, X, Telegram https://t.me/humfiverse, email @humfiverse.com.

## 2. What Humfiverse is (30 seconds)

Humfiverse is fan funding for independent music, without a middleman holding the money:

- An artist opens a campaign together with a recording studio.
- Fans contribute in **USDC** into an **escrow dedicated to that campaign** (Ethereum Sepolia).
- Each tranche is released only when **both the artist and the studio confirm** the milestone.
- If the campaign is cancelled, supporters are refunded pro rata from what is left.
- Released music becomes an **ERC-1155 catalogue token**. Royalties deposited to it are claimed by each holder from their own wallet, and there is a built-in resale marketplace.

| Item | Value |
|---|---|
| Fees, set in the contracts | 2% contributions, 3% per released tranche, 6% direct catalogue sales, 1% resales and royalty distribution |
| Contracts (Sepolia) | Token `0x3ad8…8cF9`, Escrow `0xBAEb…a82A`, Marketplace `0x7555…1585` (full addresses on Etherscan / `webapp/src/app/core/known-wallets.ts`) |
| Owner | a 2-of-3 Safe. See the wallet table in `/CLAUDE.md`. |
| Tests | 115 Hardhat tests (`contracts/`) |

**Wording rule (legal):** no "invest", "returns" or "yield". There is no legal vehicle yet, so there is no offering; we are "live on testnet, in development". Keep it that way in any copy. More background is in `legal/` and `whitepaper/`.

## 3. Status of the videos (11 Oct)

| Video | Status | Notes |
|---|---|---|
| Demo, 3:00 | **Done.** Cesare is uploading it to YouTube (unlisted). Ask him for the link and the mp4. | Cesare's own voice, recorded on the live site, with an original ambient score (`demo/music/compose.py`, synthesised, no samples). |
| Pitch, 2:30 | **Done**, with an AI voice (Kokoro TTS). | **Open:** the team scene (01) has no co-founder line or background yet. That is the most useful improvement. |

The final mp4s are **not in git** (too large). Ask Cesare for `humfiverse-demo.mp4`, `humfiverse-pitch.mp4` and the intermediate `scenes/` and `parts/` folders. Put them in the same folders (`demo/`, `pitch/`), where `.gitignore` already excludes them.

Ideas for improvements, in priority order, each to be agreed with Cesare first:

1. Pitch scene 01: add the co-founder and team.
2. Pitch: tighten the traction and "why now" scenes against the judging criteria. For example, say more explicitly how blockchain improves the UX and that the project is open source and composable.
3. Demo: re-cut only if something is wrong. It already shows the full live flow: launch a campaign → fan funds in USDC → artist + studio confirm → funds released → admin escrow dashboard → Etherscan.

Known site issues (do **not** show them in a video):

- The "Governance" text on the campaign page describes an advisory vote.
- The contract template says the SPV Manager has sole discretion over milestones, which conflicts with the dual confirmation.

## 4. Your branch and the team rules

- Work **only** on `dev/petru`, inside the `hackathon/` folder. Nobody else touches it, so there are no conflicts.
- **Never commit or push to `main`.** Changes reach `main` only through a GitHub PR (`gh pr create`), with an explicit OK from Cesare.
  - A merge to `main` redeploys the live site and the backend, and the hackathon judges look at that site.
- Before a PR, run `git fetch && git merge origin/main` on your branch.
- Read `/CLAUDE.md` for the full rules. If you use Claude Code in this repo, it reads that file automatically.
- **Secrets:**
  - Never commit `server/.env`, `contracts/.env` or `demo/tools/demo-wallets.json`.
  - The last one holds the testnet keys of the recorder's three wallets (`artist`, `studio`, `fan`, each `{address, key}`). Cesare sends it to you privately.

## 5. Folder map

```
hackathon/
  HANDOFF.md            this file
  pitch/
    script.json         narration, one entry per scene (01–07)
    tts.py              script.json → audio/NN.wav (Kokoro, voice af_heart)
    ph.py               prints the phonemes of a word, for pronunciation fixes
    cards/              HTML slides for scenes 01,02,04,06,07 + 05-overlay (traction)
    parts.txt           ffmpeg concat list of the final parts
  demo/
    audio/01–07.m4a     Cesare's voice, one file per section (script below)
    cards/              HTML title cards (problem, business, close)
    music/compose.py    the score (D major, 84 bpm, 160 s) → score.wav
    parts.txt           ffmpeg concat list
    tools/              the screen recorder (Chrome DevTools Protocol)
```

## 6. Pitch: how to rebuild it

Setup, done once (macOS):

```bash
brew install python@3.12 espeak-ng ffmpeg
cd hackathon/pitch
python3.12 -m venv .venv && . .venv/bin/activate
pip install kokoro-onnx soundfile numpy scipy
mkdir -p tts audio parts
# download the model files into tts/:
#   kokoro-v1.0.onnx and voices-v1.0.bin (from the kokoro-onnx GitHub releases)
```

The espeak paths in `tts.py` are Homebrew's, under `/opt/homebrew/...`.

Loop:

1. Edit `script.json`.
2. Run `python tts.py`. It writes `audio/NN.wav` and prints each duration.
3. **Pronunciation:**
   - Fix it on the phonemes, not the spelling. Run `python ph.py "word"` to see them, then add a pair to `FIX` in `tts.py`.
   - Already fixed: *HUM-fiverse* (stress on the first syllable), *e-THE-reum*, and "lives on-chain" read as the verb.
   - Avoid abbreviations the voice reads badly. For example, it says "European Union Intellectual Property Office", not "EUIPO".
   - Spell U.S.D.C. with dots.
4. **Slides:**
   - Open `cards/*.html` in Chrome; they are animated HTML at 1920×1080.
   - `demo/tools/pitchcards.mjs` records them to `demo/scenes/pitch-NN-*.mp4` with the same recorder (see §7).
   - Scenes 03 and 05 reuse demo footage of the live site. 05 adds `05-overlay.png` on top, the traction numbers.
5. **Assembly:**
   - Each part is the scene video cut to the length of its audio: `ffmpeg -i scene.mp4 -i audio/NN.wav -t <audio length + 0.4s> ... parts/pNN.mp4`.
   - Then `ffmpeg -f concat -safe 0 -i parts.txt -c copy pitch-voce.mp4`.
   - Then add the music: duck it under the voice with `sidechaincompress` and normalise with `loudnorm=I=-16`.
   - For a still image with a fade, use `-loop 1` on the image input. Otherwise it is a single frame and the fade is invisible.

## 7. Demo: how the recorder works

`demo/tools/` drives a real Chrome over the DevTools Protocol, on the **live** site (https://humfiverse.com):

| File | What it does |
|---|---|
| `cdp.mjs` | Launches Chrome, headless or headful (`HEADFUL=1`). Headful is needed for Etherscan, which runs a Cloudflare bot check. Has anti-throttling flags. |
| `rec.mjs` | `recordScene(name, script, {port, poll})`: captures frames to `../frames/<name>`, encodes `../scenes/<name>.mp4` at 1080p30. `poll: true` takes screenshots in a loop, needed while waiting for a transaction because the screencast stops. A 2px animation ticker keeps static pages producing frames. |
| `wallet.mjs` | An injected EIP-6963 wallet. The page sees an extension, and every signature is made in Node with the test keys from `demo-wallets.json`. Reads `CHAIN_RPC_URL` from `server/.env` (ask Cesare). With `DRYRUN=1`, transactions are rejected, so you can rehearse a scene without spending test funds. |
| `helpers.js` | Injected into the page: fake cursor, click animation, field helpers. |
| `live.mjs <launch\|fan\|artist\|studio\|after>` | The real on-chain flow on campaign `golden-hour-538`: the artist launches, the fan funds, the artist confirms, the studio confirms and the money is released. |
| `noslides.mjs <01-live\|06-live\|06-admin\|07-live>` | Live-site shots that replaced the slides, including the admin escrow dashboard for the fees part. |
| `scenes.mjs` | The title cards. |
| `ctl.mjs`, `c.sh` | Optional HTTP control of an open browser: `c.sh PORT goto URL`, etc. |

Run from `hackathon/demo/tools` (Node 20+, deps come from `contracts/node_modules`, so run `npm ci` in `contracts/` first):

```bash
DRYRUN=1 node noslides.mjs 07-live
HEADFUL=1 node live.mjs fan
```

Caveats:

- Live scenes need the demo accounts already signed in. The studio and fan accounts were registered with `cesare.marzo3+hvstudio/+hvfan@gmail.com`, and the email codes go to Cesare. Each scene uses its own Chrome profile.
- A real transaction costs Sepolia ETH and test USDC. Circle USDC on Sepolia is `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`.
- The Founder wallet allows only one pending transaction at a time.
- The demo campaign's artist "Lena Marsh" is fictional, and the campaign is visible on the production marketplace.

**Demo narration** (Cesare's voice, `audio/01–07.m4a`):

- **01, the problem (0:00–0:20):** Independent artists have a funding problem. Recording an album costs thousands, and the money usually comes from fans — through platforms that ask everyone to trust them. In 2019, PledgeMusic collapsed and artists never saw the money their fans had already paid.
- **02, the solution (0:20–0:40):** Humfiverse is our answer. It's a music platform on Ethereum where fan funding is held by a smart contract, not by us — and where every payment can be checked by anyone.
- **03, the escrow (0:40–1:30):**
  - Here's how it works. An artist teams up with a recording studio and opens a campaign, split into milestones — say, recording, mixing, mastering. Fans contribute in USDC, and the money goes into an escrow dedicated to that one campaign.
  - Nothing moves until the work is done. A milestone is released only when both the artist and the studio confirm it, in order, and only if enough has been raised. Then that tranche goes straight to whoever was named for it.
  - If a campaign has to be cancelled, supporters get refunded from what's left in the escrow, in proportion to what they hold.
- **04, the catalogue (1:30–2:05):** Finished music lives on-chain too. Each catalogue is an ERC-1155 token. When royalty income comes in, it's deposited into the contract together with a reference to the statement it pays — and every holder can claim their share directly, from their own wallet. Tokens can also change hands on our built-in marketplace.
- **05, trust (2:05–2:25):** We don't ask you to trust us. Every contribution, release and claim is a transaction you can open on Etherscan. The contracts are owned by a two-of-three multisig, not a single key, and the code is open source.
- **06, the business model (2:25–2:50):** Our business model is simple: we take a small fee at the moment value moves — 2% on contributions, 3% on each released tranche, 6% on direct catalogue sales and 1% on resales and on royalty distribution. We're starting with artists and studios first, and growing step by step, in line with European regulation.
- **07, the close (2:50–3:00):** Humfiverse is live today on the Sepolia testnet. Music funded transparently — and verifiable by everyone. I'm Cesare, and this is Humfiverse.

Any claim about the product must match what the contracts do. If you change a sentence, check it against `contracts/` or ask.

## 8. Before you hand anything back

- [ ] Total length ≤ 3:00 for the demo and about 2–3 min for the pitch, at 1080p.
- [ ] The demo shows the live product, not slides.
- [ ] No offering or investment language. The numbers match the contracts.
- [ ] No private keys, emails or `.env` contents visible on screen.
- [ ] Commit only the sources to `dev/petru`. Send the mp4s to Cesare, or upload them unlisted and send the link.
