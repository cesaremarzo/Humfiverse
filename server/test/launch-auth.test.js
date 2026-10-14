"use strict";
/* The launch authorization (§2.88) is what lets Founder's key act for an
   artist, so its rules are worth pinning down: who must sign, what the
   message commits to, the raise terms of an escrow campaign (§2.114) and
   the artist agreement stamped into it (B-4). Run with `npm test`. */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { ethers } = require("ethers");
const { prepareLaunch, verifyLaunch, requireMatch } = require("../lib/launch-auth");
const { CONTRACT_TEMPLATE, CONTRACT_TEMPLATE_SHA256 } = require("../contract-template");

const artist = ethers.Wallet.createRandom();
const other = ethers.Wallet.createRandom();
const studio = ethers.Wallet.createRandom().address;
const now = () => Math.floor(Date.now() / 1000);

const escrowLaunch = (over = {}) => ({
  assetId: "test-asset",
  title: "Test Track",
  artistName: "Test Artist",
  artistWallet: artist.address,
  supply: 10,
  fundingUsdc: "10000000",
  directSale: false,
  studioName: "Test Studio",
  studioWallet: studio,
  milestones: [{ name: "Recording", bps: 10_000, payee: "studio" }],
  raiseDeadline: now() + 30 * 86_400,
  minRaiseBps: 5_000,
  ...over
});
const directLaunch = (over = {}) => ({ ...escrowLaunch(), directSale: true, studioName: "", studioWallet: "", milestones: [], raiseDeadline: undefined, minRaiseBps: undefined, ...over });

async function signed(raw, wallet = artist) {
  const { payload, message } = prepareLaunch(raw);
  return { payload, message, signature: await wallet.signMessage(message) };
}

test("a launch signed by its artist wallet verifies and returns the payload", async () => {
  const { payload, signature } = await signed(escrowLaunch());
  const verified = verifyLaunch({ payload, signature });
  assert.equal(verified.artistWallet, artist.address.toLowerCase());
  assert.equal(verified.minRaiseBps, 5_000);
});

test("a launch signed by another wallet is refused", async () => {
  const { payload, signature } = await signed(escrowLaunch(), other);
  assert.throws(() => verifyLaunch({ payload, signature }), { code: "unauthorized" });
});

test("changing any signed field breaks the signature", async () => {
  const { payload, signature } = await signed(escrowLaunch());
  assert.throws(() => verifyLaunch({ payload: { ...payload, minRaiseBps: 1 }, signature }), { code: "unauthorized" });
  assert.throws(() => verifyLaunch({ payload: { ...payload, studioWallet: other.address }, signature }), { code: "unauthorized" });
});

test("an escrow launch needs raise terms; a direct sale has none (§2.114)", () => {
  assert.throws(() => prepareLaunch(escrowLaunch({ raiseDeadline: undefined })), /raiseDeadline is required/);
  assert.throws(() => prepareLaunch(escrowLaunch({ minRaiseBps: 0 })), /minRaiseBps/);
  assert.throws(() => prepareLaunch(escrowLaunch({ minRaiseBps: 10_001 })), /minRaiseBps/);
  const direct = prepareLaunch(directLaunch());
  assert.equal(direct.payload.raiseDeadline, 0);
  assert.doesNotMatch(direct.message, /^Raise:/m);
});

test("the raise deadline must be at least an hour and at most a year away when signing", () => {
  assert.throws(() => prepareLaunch(escrowLaunch({ raiseDeadline: now() + 600 })), /at least an hour/);
  assert.throws(() => prepareLaunch(escrowLaunch({ raiseDeadline: now() + 400 * 86_400 })), /at most a year/);
});

test("the signed message states the raise rule and the artist agreement", () => {
  const { message, payload } = prepareLaunch(escrowLaunch());
  assert.match(message, /^Raise: at least 50% by .+, or every holder is refunded$/m);
  assert.match(message, new RegExp(`^Artist agreement: ${CONTRACT_TEMPLATE.version} \\(sha256 ${CONTRACT_TEMPLATE_SHA256}\\)$`, "m"));
  assert.equal(payload.contractSha256, CONTRACT_TEMPLATE_SHA256);
});

test("the server stamps the agreement: a client cannot name another one", () => {
  const { payload } = prepareLaunch(escrowLaunch({ contractVersion: "v0.1", contractSha256: "00" }));
  assert.equal(payload.contractVersion, CONTRACT_TEMPLATE.version);
  assert.equal(payload.contractSha256, CONTRACT_TEMPLATE_SHA256);
});

test("an artist wallet cannot be its own studio (§2.89)", () => {
  assert.throws(() => prepareLaunch(escrowLaunch({ studioWallet: artist.address })), /studio wallet must be different/);
});

test("a value with a newline cannot forge another line of the message", () => {
  assert.throws(() => prepareLaunch(escrowLaunch({ title: "Track\nArtist wallet (receives payouts): 0x0" })), /single line/);
});

test("requireMatch compares case-insensitively and refuses a different value", () => {
  assert.doesNotThrow(() => requireMatch("w", artist.address.toUpperCase().replace("0X", "0x"), artist.address.toLowerCase()));
  assert.throws(() => requireMatch("w", other.address, artist.address), { code: "unauthorized" });
});

test("milestone kinds (§2.119): standard is the default and adds nothing to the text", () => {
  const { payload, message } = prepareLaunch(escrowLaunch());
  assert.equal(payload.milestones[0].kind, "standard");
  assert.match(message, /^Milestones: Recording \| 10000 bps \| studio$/m);
});

test("an advance and a release are spelled out in the signed text", async () => {
  const milestones = [
    { name: "Advance", bps: 2_000, payee: "artist", kind: "advance" },
    { name: "Studio", bps: 7_000, payee: "studio" },
    { name: "Out", bps: 1_000, payee: "artist", kind: "release" }
  ];
  const { payload, message, signature } = await signed(escrowLaunch({ milestones }));
  assert.match(message, /Advance \| 2000 bps \| artist \| advance: paid as soon as the raise covers it, no confirmation;/);
  assert.match(message, /Out \| 1000 bps \| artist \| release: confirmed by artist and studio, with the published track's link/);
  verifyLaunch({ payload, signature });
  const changed = payload.milestones.map((m, i) => (i === 0 ? { ...m, kind: "standard" } : m));
  assert.throws(() => verifyLaunch({ payload: { ...payload, milestones: changed }, signature }), { code: "unauthorized" });
});

test("an advance must be the first milestone and paid to the artist", () => {
  const two = (a, b) => escrowLaunch({ milestones: [a, b] });
  assert.throws(() => prepareLaunch(two({ name: "a", bps: 5_000, payee: "artist" }, { name: "b", bps: 5_000, payee: "artist", kind: "advance" })), /only the first milestone/);
  assert.throws(() => prepareLaunch(two({ name: "a", bps: 5_000, payee: "studio", kind: "advance" }, { name: "b", bps: 5_000, payee: "artist" })), /only the first milestone/);
  assert.throws(() => prepareLaunch(two({ name: "a", bps: 5_000, payee: "artist", kind: "bonus" }, { name: "b", bps: 5_000, payee: "artist" })), /kind must be/);
});
