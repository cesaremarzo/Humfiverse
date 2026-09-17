import { MediaKind } from './models';

/** §2.93: the same limits server/lib/media-sniff.js enforces. Checked here
 * first so the artist hears about a long video before uploading 25 MB. */
export const MEDIA_LIMITS: Record<MediaKind, { maxBytes: number; maxSeconds?: number; accept: string }> = {
  image: { maxBytes: 5 * 1024 * 1024, accept: 'image/jpeg,image/png,image/webp' },
  video: { maxBytes: 25 * 1024 * 1024, maxSeconds: 30, accept: 'video/mp4,video/quicktime,video/webm' }
};

export type MediaProblem = 'type' | 'size' | 'duration' | 'unreadable';

/** null when the file is acceptable, otherwise why not. */
export async function checkMediaFile(kind: MediaKind, file: File): Promise<MediaProblem | null> {
  const limit = MEDIA_LIMITS[kind];
  if (!limit.accept.split(',').includes(file.type)) return 'type';
  if (file.size > limit.maxBytes) return 'size';
  if (kind === 'video' && limit.maxSeconds) {
    const seconds = await videoDuration(file);
    if (seconds === null) return 'unreadable';
    if (Number.isFinite(seconds) && seconds > limit.maxSeconds + 0.5) return 'duration';
  }
  return null;
}

/** Duration from the browser's own decoder; Infinity for a WebM that does not
 * state it (the size cap still bounds it), null when unreadable. */
function videoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.preload = 'metadata';
    video.onloadedmetadata = () => done(Number.isNaN(video.duration) ? null : video.duration);
    video.onerror = () => done(null);
    video.src = url;
  });
}

/** Hex SHA-256 of the file, which the owner's signature commits to. */
export async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
