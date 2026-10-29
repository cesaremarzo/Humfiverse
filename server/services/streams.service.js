"use strict";
/* Automatic figures for the royalty calculator (§2.121): a track video's
   public YouTube view count, and the ECB exchange rates for showing the
   result in EUR or GBP.

   Only YouTube, because it is the only store with an official API that
   publishes plays: Spotify's Web API exposes a 0-100 popularity score, and
   Apple, Amazon, Deezer and TIDAL nothing. Those stay hand-entered on the
   page rather than estimated here.

   Monthly views come from two reads of the same counter about 30 days
   apart. Until such a pair exists the figure is the average since the
   video was published, and the response says which of the two it is. */

const { YOUTUBE_API_KEY } = require("../config");
const catalogueRepo = require("../data/catalogue.repo");
const streamsRepo = require("../data/streams.repo");
const chainEscrow = require("../chainEscrow");

const YT_URL = "https://www.googleapis.com/youtube/v3/videos";
/* One read per video per 6 hours at most: a videos.list call costs 1 unit
   of the 10,000 daily quota, and the counter is itself delayed. */
const REFRESH_MS = 6 * 3600 * 1000;
const DAY_MS = 86_400_000;
/* A pair of reads closer than this says more about YouTube's counter
   update cadence than about a month of listening. */
const MIN_TRAILING_DAYS = 7;

/** The 11-character video id in any common YouTube or YouTube Music URL,
 * or null. Accepts a bare id too. */
function parseVideoId(input) {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  let url;
  try { url = new URL(s); } catch { return null; }
  const host = url.hostname.replace(/^www\.|^m\./, "");
  let id = null;
  if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const m = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/);
      if (m) id = m[1];
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

/** Monthly views from the reads of one video, oldest first.
 * `trailing`: from the latest read and the read closest to 30 days before
 * it, at least MIN_TRAILING_DAYS apart, scaled to 30 days.
 * `since-release`: total views over the months since publication (at
 * least one, so a week-old video isn't scaled up fourfold). */
function monthlyViews(reads) {
  if (!reads.length) return null;
  const latest = reads[reads.length - 1];
  const latestAt = Date.parse(latest.fetched_at);
  let best = null;
  for (const r of reads) {
    const days = (latestAt - Date.parse(r.fetched_at)) / DAY_MS;
    if (days < MIN_TRAILING_DAYS) continue;
    if (!best || Math.abs(days - 30) < Math.abs(best.days - 30)) best = { r, days };
  }
  if (best) {
    const delta = Math.max(0, latest.view_count - best.r.view_count);
    return { views: Math.round((delta / best.days) * 30), method: "trailing", days: Math.round(best.days) };
  }
  if (!latest.published_at) return null;
  const months = Math.max(1, (latestAt - Date.parse(latest.published_at)) / (30 * DAY_MS));
  return { views: Math.round(latest.view_count / months), method: "since-release", days: Math.round(months * 30) };
}

/** The asset's YouTube link: the one given at launch, else the published
 * track link a pre-production campaign's release milestone put on chain. */
async function youtubeLinkOf(asset) {
  if (parseVideoId(asset.youtubeUrl)) return asset.youtubeUrl;
  try {
    const info = await chainEscrow.getCampaignInfoByAssetId(asset.id);
    const release = (info?.milestones || []).find((m) => m.kind === "release" && parseVideoId(m.link));
    return release ? release.link : null;
  } catch {
    return null;
  }
}

async function fetchVideo(videoId) {
  const url = `${YT_URL}?part=statistics,snippet&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(YOUTUBE_API_KEY)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`YouTube API ${res.status}`);
  const item = (await res.json()).items?.[0];
  if (!item) return null;
  const viewCount = Number(item.statistics?.viewCount);
  // viewCount is absent when the owner hides it: no figure, not zero.
  if (!Number.isFinite(viewCount)) return null;
  return { viewCount, publishedAt: item.snippet?.publishedAt || null, title: item.snippet?.title || null };
}

async function youtubeStatsFor(assetId) {
  if (!YOUTUBE_API_KEY) return { available: false, reason: "not-configured" };
  const asset = await catalogueRepo.findAssetById(assetId);
  if (!asset) return { available: false, reason: "no-asset" };
  const link = await youtubeLinkOf(asset);
  const videoId = parseVideoId(link);
  if (!videoId) return { available: false, reason: "no-link" };

  let reads = await streamsRepo.readsOf(videoId);
  const last = reads[reads.length - 1];
  let title = null;
  if (!last || Date.now() - Date.parse(last.fetched_at) > REFRESH_MS) {
    try {
      const v = await fetchVideo(videoId);
      if (!v) return { available: false, reason: "no-views", videoId };
      title = v.title;
      await streamsRepo.saveRead(videoId, v.viewCount, v.publishedAt, new Date().toISOString());
      reads = await streamsRepo.readsOf(videoId);
    } catch {
      // A failed refresh serves the last stored read, which carries its own
      // date; with none stored there is nothing true to show.
      if (!last) return { available: false, reason: "unreachable", videoId };
    }
  }
  const latest = reads[reads.length - 1];
  const monthly = monthlyViews(reads);
  if (!monthly) return { available: false, reason: "no-views", videoId };
  return {
    available: true,
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title,
    totalViews: latest.view_count,
    publishedAt: latest.published_at,
    fetchedAt: latest.fetched_at,
    monthlyViews: monthly.views,
    method: monthly.method,
    periodDays: monthly.days
  };
}

/* ECB reference rates through frankfurter.app (no key), cached for 12 h.
   Failure returns null and the page offers USD only — never a stale or
   hardcoded rate presented as today's. */
let fxCache = null;
async function fxRates() {
  if (fxCache && Date.now() - fxCache.at < 12 * 3600 * 1000) return fxCache.value;
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR,GBP", { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    if (!Number.isFinite(j?.rates?.EUR) || !Number.isFinite(j?.rates?.GBP)) throw new Error("bad rates");
    const value = { base: "USD", date: j.date, rates: { EUR: j.rates.EUR, GBP: j.rates.GBP }, source: "ECB (frankfurter.app)" };
    fxCache = { at: Date.now(), value };
    return value;
  } catch {
    return fxCache ? fxCache.value : null;
  }
}

module.exports = { youtubeStatsFor, fxRates, parseVideoId, _monthlyViews: monthlyViews };
