"use strict";
/* The royalty calculator's automatic YouTube figure (§2.121): which links
   name a video, and how monthly views come out of stored reads. */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseVideoId, _monthlyViews: monthlyViews } = require("../services/streams.service");

test("video ids from the usual YouTube and YouTube Music links", () => {
  for (const u of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=dQw4w9WgXcQ&t=10s",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://music.youtube.com/watch?v=dQw4w9WgXcQ&si=abc",
    "https://youtu.be/dQw4w9WgXcQ?si=x",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "dQw4w9WgXcQ"
  ]) assert.equal(parseVideoId(u), "dQw4w9WgXcQ", u);
});

test("anything else names no video", () => {
  for (const u of ["", null, "https://open.spotify.com/track/abc", "https://www.youtube.com/@channel", "https://evil.com/watch?v=dQw4w9WgXcQ", "https://youtube.com/watch?v=short"])
    assert.equal(parseVideoId(u), null, String(u));
});

const read = (iso, n, pub = "2026-01-01T00:00:00Z") => ({ fetched_at: iso, view_count: n, published_at: pub });

test("one read: the average since publication, at least one month", () => {
  assert.deepEqual(monthlyViews([read("2026-07-01T00:00:00Z", 18_100, "2026-01-01T00:00:00Z")]), { views: 3000, method: "since-release", days: 181 });
  // A week-old video is not scaled up to a month.
  assert.equal(monthlyViews([read("2026-01-08T00:00:00Z", 700, "2026-01-01T00:00:00Z")]).views, 700);
});

test("reads 30 days apart: the difference", () => {
  const m = monthlyViews([read("2026-06-01T00:00:00Z", 10_000), read("2026-07-01T00:00:00Z", 13_000)]);
  assert.deepEqual(m, { views: 3000, method: "trailing", days: 30 });
});

test("reads under a week apart fall back to the average since publication", () => {
  const m = monthlyViews([read("2026-06-28T00:00:00Z", 12_000), read("2026-07-01T00:00:00Z", 12_100)]);
  assert.equal(m.method, "since-release");
});

test("the trailing pair is the one closest to 30 days, and never negative", () => {
  const m = monthlyViews([read("2026-03-01T00:00:00Z", 1_000), read("2026-06-01T00:00:00Z", 5_000), read("2026-07-01T00:00:00Z", 4_000)]);
  assert.equal(m.views, 0);
  assert.equal(m.days, 30);
});

test("no reads, or no publication date with a single read: no figure", () => {
  assert.equal(monthlyViews([]), null);
  assert.equal(monthlyViews([read("2026-07-01T00:00:00Z", 5, null)]), null);
});
