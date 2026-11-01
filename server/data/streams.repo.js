"use strict";
/* The `youtube_views` table (§2.121): public view counts of track videos,
   one row per read, for the royalty calculator. */

const db = require("../db");

async function saveRead(videoId, viewCount, publishedAt, fetchedAt) {
  await db.prepare(
    "INSERT OR IGNORE INTO youtube_views (video_id, view_count, published_at, fetched_at) VALUES (?, ?, ?, ?)"
  ).run(videoId, viewCount, publishedAt, fetchedAt);
}

async function readsOf(videoId) {
  return db.prepare(
    "SELECT view_count, published_at, fetched_at FROM youtube_views WHERE video_id = ? ORDER BY fetched_at ASC"
  ).all(videoId);
}

module.exports = { saveRead, readsOf };
