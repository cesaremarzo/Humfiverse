"use strict";
/* The takedown procedure (§2.105; §2.87 requirements; legal/08 A-1, A-1-bis).

   A case moves through steps, each one an event in takedown_events, signed
   by a signer of the owner Safe:

     notice   ground, evidence and reasons; email to the artist; reply period
              starts (TAKEDOWN_NOTICE_DAYS, or none when urgent)
     reply    the artist's observations, recorded as received
     dismiss  the case is closed without removal (the artist fixed it)
     decide   the written, dated, reasoned decision; its SHA-256 is the
              decisionHash the Safe passes to cancelCampaign. Content is
              hidden from here on (from the notice when urgent)
     complete after the Safe has cancelled: verify that on chain, unpin the
              media, clear the audio link on the token, email the decision
              to the artist and the holders. Each part records its own
              outcome; running complete again redoes only what failed.

   Nothing here can cancel a campaign: that is the Safe's transaction. The
   server prepares it and then checks that it happened as decided. */

const { ethers } = require("ethers");
const { TAKEDOWN_NOTICE_DAYS } = require("../config");
const repo = require("../data/takedown.repo");
const catalogueRepo = require("../data/catalogue.repo");
const registrationRepo = require("../data/registration.repo");
const catalogueService = require("./catalogue.service");
const onchainService = require("./onchain.service");
const indexer = require("./indexer.service");
const chain = require("../chain");
const escrowChain = require("../chainEscrow");
const pinata = require("../pinata");
const mailer = require("../lib/mailer");
const { verifyAction, canonicalDigest } = require("../lib/signed-action");
const { isSafeOwner, OWNER_SAFE_ADDRESS } = require("../lib/safe-owners");

/** Same order as the escrow's CancelGround enum, less NONE: index + 1 is the
 * value passed on chain. legal/08 A-1 §1 allows these three and no other. */
const GROUNDS = ["unlawful_content", "third_party_rights", "false_warranties"];
const GROUND_TEXT = {
  unlawful_content: "(a) unlawful content",
  third_party_rights: "(b) infringement of third-party rights",
  false_warranties: "(c) false or inaccurate artist warranties"
};
const EVIDENCE = ["notice", "authority_order", "court_decision"];
/** The escrow's CancelGround enum in full, NONE included, for reading one back. */
const CHAIN_GROUNDS = ["none", ...GROUNDS];
const EVIDENCE_TEXT = { notice: "notice from the rights holder", authority_order: "order of an authority", court_decision: "court decision" };
const DAY_MS = 24 * 60 * 60 * 1000;
const cancelInterface = new ethers.Interface([
  "function cancelCampaign(uint256 campaignId, uint8 ground, bytes32 decisionHash)",
  "event CampaignCancelled(uint256 indexed campaignId, uint8 ground, bytes32 decisionHash, uint256 refundPool, uint256 refundTokens)"
]);
const provider = new ethers.JsonRpcProvider(process.env.CHAIN_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com", 11155111);

function codedError(code, message) {
  return Object.assign(new Error(message), { code });
}

function text(value, field, max) {
  const s = String(value ?? "").trim();
  if (!s) throw codedError("invalid", `${field} is required`);
  if (s.length > max) throw codedError("invalid", `${field} is longer than ${max} characters`);
  return s;
}

/* ---------- state ---------- */

/** What the events of the current case add up to. A dismissed case ends
 * there, and the next notice opens a new one. */
function fold(events) {
  let start = 0;
  events.forEach((e, i) => { if (e.step === "dismiss" && e.outcome === "ok") start = i + 1; });
  const current = events.slice(start);
  const notice = current.find((e) => e.step === "notice" && e.outcome === "ok");
  if (!notice) return { stage: events.length ? "dismissed" : "none", events };
  const decision = current.find((e) => e.step === "decide" && e.outcome === "ok");
  const okSteps = (step) => current.filter((e) => e.step === step && e.outcome === "ok");
  const last = (step) => [...current].reverse().find((e) => e.step === step);
  const cancel = last("cancel");
  const unpinned = new Set(okSteps("unpin").map((e) => e.payload.uri));
  const unpinFailed = [...new Set(current.filter((e) => e.step === "unpin" && e.outcome === "failed" && !unpinned.has(e.payload.uri)).map((e) => e.payload.uri))];
  const audio = last("clear-audio");
  const emailed = new Set(okSteps("decision-email").map((e) => e.payload.wallet));
  const emailFailed = [...new Set(current.filter((e) => e.step === "decision-email" && e.outcome === "failed" && !emailed.has(e.payload.wallet)).map((e) => e.payload.wallet))];
  const complete = last("complete");
  const done = Boolean(
    decision && cancel && cancel.outcome !== "failed" && audio && audio.outcome !== "failed" && complete &&
      unpinFailed.length === 0 && emailFailed.length === 0
  );
  const p = notice.payload;
  return {
    stage: done ? "removed" : decision ? "decided" : "noticed",
    ground: p.ground,
    evidenceType: p.evidenceType || null,
    evidenceRef: p.evidenceRef || null,
    reasons: p.reasons,
    urgent: Boolean(p.urgent),
    urgentBasis: p.urgentBasis || null,
    noticeAt: notice.at,
    replyDeadline: p.replyDeadline,
    noticeEmail: last("notice-email") ? { outcome: last("notice-email").outcome, detail: last("notice-email").payload } : null,
    replies: current.filter((e) => e.step === "reply").map((e) => ({ at: e.at, by: e.actor, text: e.payload.text })),
    decision: decision ? { at: decision.at, by: decision.actor, text: decision.payload.text, document: decision.payload.document, decisionHash: decision.payload.decisionHash } : null,
    hidden: Boolean(decision || p.urgent),
    hiddenAt: decision ? decision.at : p.urgent ? notice.at : null,
    cancel: cancel ? { outcome: cancel.outcome, ...cancel.payload } : null,
    unpinned: [...unpinned],
    unpinFailed,
    audio: audio ? { outcome: audio.outcome, ...audio.payload } : null,
    emailed: [...emailed],
    emailFailed,
    // Holders and artist with no verified email: unreachable from here.
    noEmail: complete ? complete.payload.noEmail || [] : [],
    events
  };
}

async function caseOf(assetId) {
  return fold(await repo.eventsFor(assetId));
}

/** What anyone may know: whether the content was removed, and on which
 * ground — no reasons, no evidence, no names (legal/08 A-1-bis 1(a)). */
function publicView(state) {
  if (!state.hidden) return { removed: false };
  return { removed: true, ground: state.ground, removedAt: state.hiddenAt };
}

async function publicState(assetId) {
  return publicView(await caseOf(assetId));
}

/** Asset id → public removal state, for every asset with a hidden case. One
 * table read, for the catalogue, listings and metadata to filter by. */
async function removedAssets() {
  const byAsset = new Map();
  for (const e of await repo.allEvents()) {
    if (!byAsset.has(e.assetId)) byAsset.set(e.assetId, []);
    byAsset.get(e.assetId).push(e);
  }
  const out = new Map();
  for (const [assetId, events] of byAsset) {
    const view = publicView(fold(events));
    if (view.removed) out.set(assetId, view);
  }
  return out;
}

/** The catalogue record with its content taken out: what GET /api/data
 * serves for a removed asset. The id, kind and token figures stay, so the
 * portfolio and the refund path keep working (A-1-bis §3). */
function strippedAsset(asset, view) {
  return {
    id: asset.id,
    kind: asset.kind,
    artistWallet: asset.artistWallet,
    title: "",
    artistName: "",
    genre: "",
    description: "",
    verified: false,
    tokenPrice: asset.tokenPrice,
    tokensTotal: asset.tokensTotal,
    tokensSold: asset.tokensSold,
    aiDisclosure: asset.aiDisclosure,
    dspPolicy: "",
    riskFactors: [],
    documents: [],
    status: asset.status,
    removed: view
  };
}

/* ---------- authorization ---------- */

/** The signer of this step, if it is a signer of the owner Safe and signed
 * exactly this payload. */
/** The digest covers the request body exactly as sent, less `auth`: the
 * signer approves what the browser submits, before any defaulting here. */
async function authorize(body, assetId, step) {
  const { auth, ...sent } = body || {};
  const { wallet, fields } = verifyAction("takedown", auth);
  if (fields.assetId !== assetId || fields.step !== step) throw codedError("unauthorized", "the signature is for a different step");
  if (fields.digest !== canonicalDigest(sent)) throw codedError("unauthorized", "the details do not match the signature");
  if (!(await isSafeOwner(wallet))) throw codedError("forbidden", "only a signer of the owner Safe can run the takedown procedure");
  return wallet;
}

/* ---------- context ---------- */

async function contextOf(assetId) {
  const asset = await catalogueRepo.findAssetById(assetId);
  if (!asset) throw codedError("not_found", "no asset with this id");
  const [artistWallet, token, escrow] = await Promise.all([
    catalogueService.ownerWalletOf(asset),
    onchainService.findTokenWithChainFallback(assetId).catch(() => null),
    escrowChain.getCampaignInfoByAssetId(assetId).catch(() => null)
  ]);
  const tokenId = token ? Number(token.token_id) : null;
  const pool = tokenId != null ? await chain.getPoolInfo(tokenId).catch(() => null) : null;
  return { asset, artistWallet, tokenId, pool, escrow };
}

async function emailOf(wallet) {
  if (!wallet) return null;
  const row = await registrationRepo.findRegistration(wallet).catch(() => null);
  return row && row.verified_at ? row.email : null;
}

/* ---------- emails ---------- */

function noticeEmail(ctx, p) {
  const title = ctx.asset.title || ctx.asset.id;
  const lines = [
    `Humfiverse — notice about your campaign "${title}"`,
    "",
    `We are considering cancelling the campaign "${title}" (${ctx.asset.id}) and removing its content, on this ground: ${GROUND_TEXT[p.ground]}.`,
    p.evidenceType ? `Evidence: ${EVIDENCE_TEXT[p.evidenceType]}${p.evidenceRef ? ` — ${p.evidenceRef}` : ""}.` : null,
    "",
    "Reasons:",
    p.reasons,
    "",
    p.urgent
      ? `The law or an authority requires immediate removal (${p.urgentBasis}), so the content has been hidden already and the reply period does not apply. You can still send us your observations.`
      : `You have until ${p.replyDeadline} (UTC) to reply to this email with your observations, or to remove the violation. We decide only after that date.`,
    "",
    "This is a testnet prototype: no real money is involved.",
    "",
    "—",
    `Humfiverse — avviso sulla tua campagna "${title}". Stiamo valutando l'annullamento per il motivo indicato sopra. ` +
      (p.urgent ? "La rimozione è imposta dalla legge o da un'autorità: il contenuto è già nascosto." : `Puoi rispondere a questa email entro il ${p.replyDeadline} (UTC).`)
  ].filter((l) => l !== null);
  return { subject: `Humfiverse — notice about "${title}"`, text: lines.join("\n") };
}

function decisionEmail(ctx, state, toArtist) {
  const title = ctx.asset.title || ctx.asset.id;
  const intro = toArtist
    ? `We have decided to cancel your campaign "${title}" (${ctx.asset.id}) and remove its content.`
    : `The campaign "${title}" (${ctx.asset.id}), whose tokens you hold, has been cancelled and its content removed.`;
  const refund = ctx.escrow && !ctx.escrow.legacy
    ? "What was raised and not yet released is refunded pro rata to the tokens held: claim it from your portfolio on the site. Claiming hands back the tokens, which are burned."
    : "This campaign had no escrow balance to refund.";
  const lines = [
    intro,
    "",
    toArtist ? null : refund,
    toArtist ? null : "",
    "The decision follows. Its SHA-256 is recorded on chain with the cancellation, so this text can be checked against it.",
    "",
    "----- decision -----",
    state.decision.document,
    "----- end -----",
    "",
    "This is a testnet prototype: no real money is involved."
  ].filter((l) => l !== null);
  return { subject: `Humfiverse — decision on "${title}"`, text: lines.join("\n") };
}

/* ---------- steps ---------- */

async function notice(assetId, body) {
  const payload = {
    ground: body.ground,
    evidenceType: body.evidenceType ?? null,
    evidenceRef: body.evidenceRef ?? null,
    reasons: body.reasons,
    urgent: body.urgent === true,
    urgentBasis: body.urgentBasis ?? null
  };
  const actor = await authorize(body, assetId, "notice");
  if (!GROUNDS.includes(payload.ground)) throw codedError("invalid", `ground must be one of ${GROUNDS.join(", ")}`);
  if (payload.ground === "third_party_rights" && !EVIDENCE.includes(payload.evidenceType)) {
    throw codedError("invalid", `a third-party rights ground needs its evidence: ${EVIDENCE.join(", ")}`);
  }
  if (payload.ground !== "third_party_rights") payload.evidenceType = null;
  payload.evidenceRef = payload.evidenceRef ? text(payload.evidenceRef, "evidenceRef", 500) : null;
  payload.reasons = text(payload.reasons, "reasons", 4000);
  payload.urgentBasis = payload.urgent ? text(payload.urgentBasis, "urgentBasis", 500) : null;

  const state = await caseOf(assetId);
  if (state.stage !== "none" && state.stage !== "dismissed") throw codedError("conflict", "this asset already has an open takedown case");
  const ctx = await contextOf(assetId);

  const now = Date.now();
  const recorded = {
    ...payload,
    noticeDays: payload.urgent ? 0 : TAKEDOWN_NOTICE_DAYS,
    replyDeadline: new Date(payload.urgent ? now : now + TAKEDOWN_NOTICE_DAYS * DAY_MS).toISOString(),
    artistWallet: ctx.artistWallet
  };
  await repo.append({ assetId, step: "notice", outcome: "ok", actor, payload: recorded });
  if (recorded.urgent) await repo.append({ assetId, step: "hide", outcome: "ok", actor, payload: { reason: "urgent" } });
  await sendNotice(assetId, ctx, recorded, actor);
  return caseOf(assetId);
}

async function sendNotice(assetId, ctx, p, actor) {
  const email = await emailOf(ctx.artistWallet);
  if (!email) {
    await repo.append({ assetId, step: "notice-email", outcome: "failed", actor, payload: { wallet: ctx.artistWallet, error: "the artist wallet has no verified email" } });
    return;
  }
  try {
    await mailer.sendEmail({ to: email, ...noticeEmail(ctx, p) });
    await repo.append({ assetId, step: "notice-email", outcome: "ok", actor, payload: { wallet: ctx.artistWallet } });
  } catch (e) {
    await repo.append({ assetId, step: "notice-email", outcome: "failed", actor, payload: { wallet: ctx.artistWallet, error: String(e.message || e) } });
  }
}

async function resendNotice(assetId, body) {
  const actor = await authorize(body, assetId, "notice-email");
  const state = await caseOf(assetId);
  if (state.stage !== "noticed") throw codedError("conflict", "there is no notice waiting for a decision");
  const ctx = await contextOf(assetId);
  const notice = [...state.events].reverse().find((e) => e.step === "notice" && e.outcome === "ok");
  await sendNotice(assetId, ctx, notice.payload, actor);
  return caseOf(assetId);
}

async function reply(assetId, body) {
  const payload = { text: body.text };
  const actor = await authorize(body, assetId, "reply");
  payload.text = text(payload.text, "text", 8000);
  const state = await caseOf(assetId);
  if (state.stage !== "noticed") throw codedError("conflict", "replies are recorded before the decision");
  await repo.append({ assetId, step: "reply", outcome: "ok", actor, payload });
  return caseOf(assetId);
}

async function dismiss(assetId, body) {
  const payload = { reason: body.reason };
  const actor = await authorize(body, assetId, "dismiss");
  payload.reason = text(payload.reason, "reason", 2000);
  const state = await caseOf(assetId);
  if (state.stage !== "noticed") throw codedError("conflict", "only a case awaiting its decision can be dismissed");
  await repo.append({ assetId, step: "dismiss", outcome: "ok", actor, payload });
  return caseOf(assetId);
}

/** The decision as one plain-text document. Its SHA-256 is what goes on
 * chain; anyone holding the text can check it with `shasum -a 256`. */
function decisionDocument(ctx, state, decisionText, actor, at) {
  const noticeLine = state.urgent
    ? `Notice: ${state.noticeAt}; immediate removal required (${state.urgentBasis}), reply period not applied`
    : `Notice: ${state.noticeAt}; reply period until ${state.replyDeadline}`;
  const replies = state.replies.length ? state.replies.map((r) => `- ${r.at}: ${r.text}`).join("\n") : "none received";
  return [
    "Humfiverse — decision to cancel a campaign and remove its content",
    "",
    `Asset: ${ctx.asset.id} ("${ctx.asset.title}" by ${ctx.asset.artistName})`,
    `Artist wallet: ${ctx.artistWallet || "unknown"}`,
    `Token: ${ctx.tokenId != null ? `${ctx.tokenId} on ${chain.CONTRACT_ADDRESS}` : "none"}`,
    `Escrow campaign: ${ctx.escrow ? `${ctx.escrow.campaignId} on ${ctx.escrow.contractAddress}` : "none"}`,
    `Ground: ${GROUND_TEXT[state.ground]} (legal/08 A-1 §1)`,
    state.evidenceType ? `Evidence: ${EVIDENCE_TEXT[state.evidenceType]}${state.evidenceRef ? ` — ${state.evidenceRef}` : ""}` : `Evidence reference: ${state.evidenceRef || "none"}`,
    "",
    "Reasons:",
    state.reasons,
    "",
    noticeLine,
    "Artist's observations:",
    replies,
    "",
    "Decision:",
    decisionText,
    "",
    `Decided by: ${actor}, signer of the owner Safe ${OWNER_SAFE_ADDRESS}`,
    `Date: ${at}`
  ].join("\n");
}

/** The Safe transaction, when there is an active campaign on the current
 * escrow to cancel: the raw call and a Transaction Builder batch file. */
function safeTransaction(ctx, groundIndex, decisionHash) {
  // Still returned once the campaign is cancelled: the page needs it to ask
  // for the executed transaction's hash, which complete then verifies.
  if (!ctx.escrow || ctx.escrow.legacy) return null;
  const to = ethers.getAddress(ctx.escrow.contractAddress);
  const args = { campaignId: String(ctx.escrow.campaignId), ground: String(groundIndex), decisionHash };
  const data = cancelInterface.encodeFunctionData("cancelCampaign", [ctx.escrow.campaignId, groundIndex, decisionHash]);
  const batch = {
    version: "1.0",
    chainId: "11155111",
    createdAt: Date.now(),
    meta: {
      name: `Cancel ${ctx.asset.id}`,
      description: `cancelCampaign(${args.campaignId}, ${args.ground}, ${decisionHash}) — takedown decision`,
      txBuilderVersion: "1.16.5",
      createdFromSafeAddress: OWNER_SAFE_ADDRESS,
      createdFromOwnerAddress: ""
    },
    transactions: [{ to, value: "0", data }]
  };
  batch.meta.checksum = txBuilderChecksum(batch);
  return { to, value: "0", data, method: "cancelCampaign", args, batch, campaignStatus: ctx.escrow.status };
}

/* The Transaction Builder's own checksum of a batch file (keys sorted,
   meta.name nulled, keccak256), so the file loads without a "modified"
   warning. */
function txBuilderChecksum(batch) {
  const replacer = (_k, v) => (v === undefined ? null : v);
  const ser = (json) => {
    if (Array.isArray(json)) return `[${json.map(ser).join(",")}]`;
    if (json && typeof json === "object") {
      const keys = Object.keys(json).sort();
      let acc = `{${JSON.stringify(keys, replacer)}`;
      for (const k of keys) acc += `${ser(json[k])},`;
      return `${acc}}`;
    }
    return JSON.stringify(json, replacer);
  };
  return ethers.keccak256(ethers.toUtf8Bytes(ser({ ...batch, meta: { ...batch.meta, name: null } })));
}

async function decide(assetId, body) {
  const payload = { text: body.text };
  const actor = await authorize(body, assetId, "decide");
  payload.text = text(payload.text, "text", 8000);
  const state = await caseOf(assetId);
  if (state.stage !== "noticed") throw codedError("conflict", "there is no notice awaiting a decision");
  if (!state.urgent && Date.now() < Date.parse(state.replyDeadline)) {
    throw codedError("conflict", `the artist's reply period runs until ${state.replyDeadline}`);
  }
  const ctx = await contextOf(assetId);
  const at = new Date().toISOString();
  const document = decisionDocument(ctx, state, payload.text, actor, at);
  const decisionHash = "0x" + require("crypto").createHash("sha256").update(document, "utf8").digest("hex");
  await repo.append({ assetId, step: "decide", outcome: "ok", actor, payload: { text: payload.text, document, decisionHash } });
  if (!state.urgent) await repo.append({ assetId, step: "hide", outcome: "ok", actor, payload: { reason: "decision" } });
  return { case: await caseOf(assetId), safeTransaction: safeTransaction(ctx, GROUNDS.indexOf(state.ground) + 1, decisionHash) };
}

/** The Safe transaction again, for a decision already taken. */
async function safeTransactionFor(assetId) {
  const state = await caseOf(assetId);
  if (!state.decision) return null;
  const ctx = await contextOf(assetId);
  return safeTransaction(ctx, GROUNDS.indexOf(state.ground) + 1, state.decision.decisionHash);
}

/** Checks that `txHash` cancelled this campaign on this ground with this
 * decision — the chain's word, not the caller's. */
async function verifyCancel(ctx, state, txHash, priorDecisionText) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(String(txHash || ""))) throw codedError("invalid", "the Safe transaction hash is required");
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt || receipt.status !== 1) throw codedError("invalid", "that transaction is not confirmed, or it failed");
  const escrowAddress = ctx.escrow.contractAddress.toLowerCase();
  const event = receipt.logs
    .filter((l) => l.address.toLowerCase() === escrowAddress)
    .map((l) => { try { return cancelInterface.parseLog(l); } catch { return null; } })
    .find((e) => e && e.name === "CampaignCancelled" && Number(e.args.campaignId) === Number(ctx.escrow.campaignId));
  if (!event) throw codedError("invalid", "that transaction did not cancel this campaign");
  const base = { txHash: receipt.hash, block: receipt.blockNumber, campaignId: Number(ctx.escrow.campaignId), escrow: ctx.escrow.contractAddress };
  const onChainHash = event.args.decisionHash.toLowerCase();
  if (onChainHash === state.decision.decisionHash.toLowerCase()) {
    if (Number(event.args.ground) !== GROUNDS.indexOf(state.ground) + 1) throw codedError("invalid", "the campaign was cancelled on a different ground");
    return base;
  }
  // A cancellation from before this case was opened (Test C, cancelled by
  // hand before §2.105 existed) cannot carry this decision's hash. It is
  // accepted as what it is — an earlier cancellation, with its own ground
  // and hash on record — never as the execution of this decision. One
  // made after the notice with another hash is still refused.
  const { timestamp } = await provider.getBlock(receipt.blockNumber);
  if (timestamp * 1000 >= Date.parse(state.noticeAt)) throw codedError("invalid", "the campaign was cancelled with a different decision hash");
  const prior = { ...base, prior: true, priorGround: CHAIN_GROUNDS[Number(event.args.ground)] ?? String(event.args.ground), priorDecisionHash: onChainHash, cancelledAt: new Date(timestamp * 1000).toISOString() };
  // The earlier decision's text, kept only if it is the one the chain names.
  if (priorDecisionText) {
    const hash = "0x" + require("crypto").createHash("sha256").update(priorDecisionText, "utf8").digest("hex");
    if (hash !== onChainHash) throw codedError("invalid", "that text is not the earlier decision: its SHA-256 differs from the hash on chain");
    prior.priorDecisionText = priorDecisionText;
  }
  return prior;
}

async function complete(assetId, body) {
  const payload = { txHash: body.txHash ?? null };
  const actor = await authorize(body, assetId, "complete");
  let state = await caseOf(assetId);
  if (state.stage !== "decided") throw codedError("conflict", state.stage === "removed" ? "this takedown is already complete" : "there is no decision to carry out");
  const ctx = await contextOf(assetId);

  // 1. The cancellation, which the Safe made. Checked, never assumed.
  if (!state.cancel || state.cancel.outcome === "failed") {
    if (ctx.escrow && !ctx.escrow.legacy) {
      const record = await verifyCancel(ctx, state, payload.txHash, typeof body.priorDecisionText === "string" && body.priorDecisionText ? body.priorDecisionText : null);
      await repo.append({ assetId, step: "cancel", outcome: "ok", actor, payload: record });
    } else {
      const why = ctx.escrow ? "campaign on the legacy escrow, not cancelled by this procedure" : "no escrow campaign: nothing to cancel on chain";
      await repo.append({ assetId, step: "cancel", outcome: "skipped", actor, payload: { reason: why } });
    }
  }

  // 2. Unpin every file we pinned for this asset.
  // Failed ones come from the record: once step 3 has cleared the link on
  // chain, the audio's URI is known only from the earlier attempt.
  const uris = [ctx.pool?.audioUri, ctx.asset.media?.image?.uri, ctx.asset.media?.video?.uri, ...state.unpinFailed].filter((u) => typeof u === "string" && u.startsWith("ipfs://"));
  const pastUnpinned = new Set(state.unpinned);
  for (const uri of new Set(uris)) {
    if (pastUnpinned.has(uri)) continue;
    const ok = await pinata.unpin(uri);
    await repo.append({ assetId, step: "unpin", outcome: ok ? "ok" : "failed", actor, payload: { uri, ...(ok ? {} : { error: pinata.uploadsEnabled() ? "Pinata refused the unpin" : "no PINATA_JWT configured" }) } });
  }

  // 3. Clear the audio link on the token (Founder is its operator).
  if (!state.audio || state.audio.outcome === "failed") {
    if (ctx.tokenId == null || !ctx.pool?.audioUri) {
      await repo.append({ assetId, step: "clear-audio", outcome: "skipped", actor, payload: { reason: ctx.tokenId == null ? "no token" : "no audio link on chain" } });
    } else {
      try {
        const tx = await chain.setTrackAudioUriOnchain(ctx.tokenId, "");
        await repo.append({ assetId, step: "clear-audio", outcome: "ok", actor, payload: { tokenId: ctx.tokenId, txHash: tx.txHash } });
      } catch (e) {
        await repo.append({ assetId, step: "clear-audio", outcome: "failed", actor, payload: { tokenId: ctx.tokenId, error: String(e.message || e) } });
      }
    }
  }

  // 4. The decision, to the artist and to the holders (legal/08 A-1 §3).
  state = await caseOf(assetId);
  const holders = ctx.tokenId != null ? (await indexer.holders(ctx.tokenId).catch(() => ({ holders: [] }))).holders : [];
  const recipients = [
    ...(ctx.artistWallet ? [{ wallet: ctx.artistWallet, artist: true }] : []),
    ...holders.map((h) => ({ wallet: String(h.wallet).toLowerCase(), artist: false })).filter((r) => r.wallet !== ctx.artistWallet)
  ];
  const already = new Set(state.emailed);
  const noEmail = [];
  for (const r of recipients) {
    if (already.has(r.wallet)) continue;
    const email = await emailOf(r.wallet);
    if (!email) { noEmail.push(r.wallet); continue; }
    try {
      await mailer.sendEmail({ to: email, ...decisionEmail(ctx, state, r.artist) });
      await repo.append({ assetId, step: "decision-email", outcome: "ok", actor, payload: { wallet: r.wallet, artist: r.artist } });
    } catch (e) {
      await repo.append({ assetId, step: "decision-email", outcome: "failed", actor, payload: { wallet: r.wallet, artist: r.artist, error: String(e.message || e) } });
    }
  }
  // Wallets with no verified email cannot be reached here; recorded so the
  // gap is visible, not retried (nothing would change on a retry).
  await repo.append({ assetId, step: "complete", outcome: "ok", actor, payload: { recipients: recipients.length, noEmail } });
  return caseOf(assetId);
}

/** Every case with anything recorded, for the admin page. */
async function listCases(body) {
  const actor = await authorize(body, "*", "view");
  const byAsset = new Map();
  for (const e of await repo.allEvents()) {
    if (!byAsset.has(e.assetId)) byAsset.set(e.assetId, []);
    byAsset.get(e.assetId).push(e);
  }
  return { viewer: actor, noticeDays: TAKEDOWN_NOTICE_DAYS, cases: [...byAsset].map(([assetId, events]) => ({ assetId, ...fold(events) })) };
}

module.exports = {
  GROUNDS,
  EVIDENCE,
  publicState,
  removedAssets,
  strippedAsset,
  notice,
  resendNotice,
  reply,
  dismiss,
  decide,
  safeTransactionFor,
  complete,
  listCases,
  txBuilderChecksum
};
