"use strict";
/* Track media checks (§2.93): what a file really is, read from its first
   bytes rather than from the name or Content-Type the browser sends, and how
   long a video lasts, read from its container header. No dependency — MP4
   and WebM keep the duration in a small, well-known place. */

const LIMITS = {
  image: { maxBytes: 5 * 1024 * 1024 },
  video: { maxBytes: 25 * 1024 * 1024, maxSeconds: 30 }
};

/** 'image/jpeg' | 'image/png' | 'image/webp' | 'video/mp4' | 'video/quicktime' | 'video/webm' | null */
function sniffMime(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.toString("ascii", 4, 8) === "ftyp") return buf.toString("ascii", 8, 10) === "qt" ? "video/quicktime" : "video/mp4";
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "video/webm";
  return null;
}

/** Seconds from the movie header box (mvhd) of an MP4/MOV, or null. */
function mp4Duration(buf) {
  let i = buf.indexOf("mvhd");
  while (i >= 4) {
    const version = buf[i + 4];
    try {
      if (version === 0) {
        const timescale = buf.readUInt32BE(i + 16);
        const duration = buf.readUInt32BE(i + 20);
        if (timescale) return duration / timescale;
      } else if (version === 1) {
        const timescale = buf.readUInt32BE(i + 24);
        const duration = Number(buf.readBigUInt64BE(i + 28));
        if (timescale) return duration / timescale;
      }
    } catch {
      /* truncated header */
    }
    i = buf.indexOf("mvhd", i + 4);
  }
  return null;
}

/** Seconds from a WebM's Segment Info (TimecodeScale × Duration), or null.
 * Recorders that stream (MediaRecorder) often leave Duration out; then the
 * size cap is the only bound, which the caller accepts. */
function webmDuration(buf) {
  const readVintSize = (pos) => {
    const first = buf[pos];
    let len = 1;
    let mask = 0x80;
    while (len <= 8 && !(first & mask)) { len++; mask >>= 1; }
    if (len > 8) return null;
    let value = first & (mask - 1);
    for (let k = 1; k < len; k++) value = value * 256 + buf[pos + k];
    return { len, value };
  };
  let scale = 1_000_000;
  const scaleAt = buf.indexOf(Buffer.from([0x2a, 0xd7, 0xb1]));
  if (scaleAt >= 0) {
    const size = readVintSize(scaleAt + 3);
    if (size && size.value > 0 && size.value <= 8) scale = buf.readUIntBE(scaleAt + 3 + size.len, Math.min(size.value, 6));
  }
  const durAt = buf.indexOf(Buffer.from([0x44, 0x89]));
  if (durAt < 0) return null;
  const size = readVintSize(durAt + 2);
  if (!size) return null;
  const start = durAt + 2 + size.len;
  try {
    if (size.value === 4) return (buf.readFloatBE(start) * scale) / 1e9;
    if (size.value === 8) return (buf.readDoubleBE(start) * scale) / 1e9;
  } catch {
    /* truncated */
  }
  return null;
}

function codedError(code, message) {
  return Object.assign(new Error(message), { code });
}

/** Throws `invalid` unless `buf` is an accepted file of `kind`. Returns
 * { mime, durationSeconds }. */
function checkMedia(kind, buf) {
  const limit = LIMITS[kind];
  if (!limit) throw codedError("invalid", "kind must be image or video");
  if (!buf.length) throw codedError("invalid", "empty file");
  if (buf.length > limit.maxBytes) throw codedError("too_large", `file too large (${limit.maxBytes / 1024 / 1024} MB max)`);
  const mime = sniffMime(buf);
  if (!mime || !mime.startsWith(`${kind}/`)) {
    throw codedError("invalid", kind === "image" ? "the image must be JPG, PNG or WebP" : "the video must be MP4, MOV or WebM");
  }
  let durationSeconds = null;
  if (kind === "video") {
    durationSeconds = mime === "video/webm" ? webmDuration(buf) : mp4Duration(buf);
    // Half a second of slack: encoders round the last frame up.
    if (durationSeconds !== null && durationSeconds > limit.maxSeconds + 0.5) {
      throw codedError("invalid", `the video must be at most ${limit.maxSeconds} seconds`);
    }
    if (durationSeconds === null && mime !== "video/webm") throw codedError("invalid", "could not read the video's length");
  }
  return { mime, durationSeconds };
}

module.exports = { LIMITS, sniffMime, checkMedia };
