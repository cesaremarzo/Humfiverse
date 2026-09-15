---
name: legal-review
description: Bring Humfiverse's legal/ folder (regulatory explainer, smart-contract legal review, Terms, privacy policy, risk disclaimers, draft contract clauses, questions for counsel) back in line with the code. Use whenever legal/check.sh reports a change, and whenever a change touches the contracts, fees, Founder powers, refunds, personal data, KYC, sign-in providers, the contract template or the whitepaper — in the same PR as that change.
---

# Legal review

`legal/` describes what the platform *actually does* in legal terms. It is
written in Italian for Cesare, Vincenzo and their lawyer. None of it is legal
advice and none of it has been reviewed by counsel: keep saying so.

A legal document that describes a superseded contract is worse than none.
This skill keeps them aligned.

## 1. Find what changed

```bash
./legal/check.sh
git log --oneline <commit in legal/README.md "Commit rivisto">..HEAD -- contracts server webapp/src/app/core whitepaper
```

Read the diffs of every CHANGED/NEW file, not just the file names. Also read
`planning/legal-regulatory-notes.md` and the latest `SESSION_LOG.md` entry
for **decisions** the user took since the last review. Decisions win over
this folder's recommendations: record them, don't argue with them. Examples
already taken:
- §7.10: Founder keeps the power to cancel a campaign, limited to legal grounds.
- §2.86: no deadlines.

## 2. Decide what each change affects

| If the change touches… | Update |
|---|---|
| An `onlyOwner` function, a new privileged role, `transferOwnership` | `02` §1 table and C-1/C-2/C-9; `04` §5.2; `CLAUDE.md` "Wallet names" (only if the address or role list changed) |
| A fee (rate, base, refundability) | `02` §1 and C-11; `04` §6; `06` §2; `08` A-6 (recompute the example); `03` W-6/W-12 |
| Refunds, cancellation, milestones, deadlines | `02` C-2/C-3/C-4/C-5; `04` §5.3–5.6; `06` §2.2; `08` A-1/A-2/A-5/B-1; `07` group B/C |
| Transfer restrictions, whitelist, KYC on chain | `02` C-6; `03` W-8; `01` §6; `07` A3 |
| Marketplace | `02` C-7; `01` §5; `06` §2.3; `07` A4 |
| Where sale proceeds go (`payoutOf`, a vehicle wallet) | `02` C-8; `07` A5; `08` |
| Data written on-chain / IPFS | `02` C-13; `05` §2–3 |
| `schema.js`, KYC fields, a new table with personal data, a new third-party service, `index.html` external resources | `05` §3–6 (the table must match the code exactly); `01` §7 |
| `contract-template.js` | `03` §B (mark fixed items); `08` (what is now implemented) |
| `whitepaper/*.md` | `03` §A: mark corrected rows, add new mismatches |
| A redeploy | Addresses and test count in `02` header and `legal/README.md` |
| Backend authentication and integrity of data shown to investors | the private file `.claude/legal-private/backend-sicurezza.md` (gitignored); never in `legal/` |

## 3. Rules for editing

- **Verify against the code**, with file and line, before writing a claim. Re-run
  `cd contracts && npm test` and use the real count.
- **Never renumber** C-n, B-n, W-n, T-n, A-n or question ids: other files cite
  them. A resolved finding stays, marked `**Risolto (AAAA-MM-GG, commit abc1234)**`
  with one line on how.
- New findings get the next free id.
- Anything regulatory you are unsure about (thresholds, dates, article numbers)
  gets **[verificare]** — don't guess.
- **Security weaknesses never go in `legal/`**: the repo is public. Record them in
  `.claude/legal-private/backend-sicurezza.md` (gitignored, local only) and leave
  `legal/` with a generic pointer.
- `whitepaper/` publishes to GitBook: propose corrections in `03` and apply them
  only when the user says so.
- Italian, plain language, short sentences; legal terms explained the first time.

## 4. Close

1. Update "Stato della revisione" in `legal/README.md` (date, commit, addresses, tests).
2. Update the revision line at the top of each file you touched.
3. Add a `legal/CHANGELOG.md` entry: date, commit, what changed and why.
4. `./legal/check.sh --update`, then `./legal/check.sh` must pass.
5. Stage `legal/` **by path** (another session may be working in the same tree)
   and commit in the same PR as the code change.
6. Tell the user, in a few lines, which legal conclusions changed — especially any
   new 🔴 question for counsel.
