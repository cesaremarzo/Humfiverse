"use strict";
/* The takedown case state machine (§2.105), and the second signer on the
   decision: a decision written by one Safe signer is only a proposal until a
   different signer confirms it, and only then is the content hidden.
   Decisions recorded before that rule stand as they were. */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { _fold: fold } = require("../services/takedown.service");

const A = "0xaaaa000000000000000000000000000000000001";
const B = "0xbbbb000000000000000000000000000000000002";
let t = 0;
const ev = (step, payload = {}, actor = A, outcome = "ok") => ({ id: ++t, step, outcome, actor, payload, at: new Date(1_800_000_000_000 + t * 1000).toISOString() });
const notice = (urgent = false) => ev("notice", { ground: "unlawful_content", reasons: "r", replyDeadline: "2026-01-01T00:00:00Z", urgent });

test("a new decision is only proposed: stage 'proposed', content still visible", () => {
  const s = fold([notice(), ev("decide", { text: "x", document: "d", decisionHash: "0x1", requiresConfirmation: true })]);
  assert.equal(s.stage, "proposed");
  assert.equal(s.hidden, false);
  assert.equal(s.confirmation, null);
});

test("a second signer's confirmation puts it in force and hides the content", () => {
  const s = fold([notice(), ev("decide", { decisionHash: "0x1", requiresConfirmation: true }), ev("confirm", { decisionHash: "0x1" }, B), ev("hide", {}, B)]);
  assert.equal(s.stage, "decided");
  assert.equal(s.hidden, true);
  assert.equal(s.confirmation.by, B);
});

test("an urgent case is hidden from the notice, before any decision", () => {
  const s = fold([notice(true), ev("decide", { decisionHash: "0x1", requiresConfirmation: true })]);
  assert.equal(s.stage, "proposed");
  assert.equal(s.hidden, true);
});

test("a decision recorded before the second-signer rule stands as decided", () => {
  const s = fold([notice(), ev("decide", { decisionHash: "0x1" }), ev("hide", {})]);
  assert.equal(s.stage, "decided");
  assert.equal(s.hidden, true);
});

test("dismissing a proposal closes the case", () => {
  const s = fold([notice(), ev("decide", { decisionHash: "0x1", requiresConfirmation: true }), ev("dismiss", { reason: "wrong" })]);
  assert.equal(s.stage, "dismissed");
});

test("completion needs the confirmation: an unconfirmed decision never reads as removed", () => {
  const events = [notice(), ev("decide", { decisionHash: "0x1", requiresConfirmation: true }), ev("cancel", {}), ev("clear-audio", {}), ev("complete", {})];
  assert.equal(fold(events).stage, "proposed");
  assert.equal(fold([...events.slice(0, 2), ev("confirm", {}, B), ...events.slice(2)]).stage, "removed");
});
