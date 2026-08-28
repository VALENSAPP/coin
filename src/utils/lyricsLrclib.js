/**
 * LRCLIB.net — same source as StoryComposer for synced/plain lyrics.
 */

const LRCLIB_GET = 'https://lrclib.net/api/get';
const LRCLIB_SEARCH = 'https://lrclib.net/api/search';

/** Parse LRC synced lyrics into [{ t: seconds, text }]. */
export function parseLrcToSyncedLines(lrc) {
  if (!lrc || typeof lrc !== 'string') return [];
  const out = [];
  const re = /\[(\d{1,2}):(\d{2})\.(\d{2,3})\]\s*([^\r\n]*)/g;
  let m;
  while ((m = re.exec(lrc)) !== null) {
    const min = parseInt(m[1], 10);
    const sec = parseInt(m[2], 10);
    const centi = parseInt(m[3], 10);
    const t = min * 60 + sec + centi / 100;
    const text = (m[4] || '').trim();
    if (text) out.push({ t, text });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Lines with timestamp t in [trimStart, trimEndSec). */
export function filterSyncedLinesByTrim(lines, trimStart, trimEndSec) {
  if (!lines?.length) return [];
  const t0 = Math.max(0, Number(trimStart) || 0);
  const t1 =
    trimEndSec == null || trimEndSec === '' || !Number.isFinite(Number(trimEndSec))
      ? Infinity
      : Number(trimEndSec);
  return lines.filter(l => l.t >= t0 && l.t < t1);
}

/**
 * Lines whose timed segment overlaps [trimStart, trimEnd) — matches StoryComposer
 * so lyrics match the audible clip better than starts-only filtering.
 */
export function filterSyncedLinesIntersectingTrim(lines, trimStart, trimEndSec) {
  if (!lines?.length) return [];
  const sorted = [...lines].sort((a, b) => a.t - b.t);
  const t0 = Math.max(0, Number(trimStart) || 0);
  const t1 =
    trimEndSec == null || trimEndSec === '' || !Number.isFinite(Number(trimEndSec))
      ? Infinity
      : Number(trimEndSec);
  const out = [];
  for (let i = 0; i < sorted.length; i++) {
    const l = sorted[i];
    const nextT = i + 1 < sorted.length ? sorted[i + 1].t : Infinity;
    if (nextT > t0 && l.t < t1) {
      out.push(l);
    }
  }
  return out;
}

/**
 * Seconds range for lyrics that match the post editor Sound trim (library music).
 * Unknown duration uses a large cap so an open-ended trim still includes late lines.
 */
export function getPostSoundtrackLyricsTrimRangeSec(edits) {
  const e = edits || {};
  const t0 = Math.max(0, Number(e.musicTrimStart) || 0);
  const durKnown =
    e.musicYoutubeDurationSec != null && Number.isFinite(Number(e.musicYoutubeDurationSec))
      ? Number(e.musicYoutubeDurationSec)
      : null;
  const cap = durKnown != null && durKnown > 0 ? durKnown : 3600;
  let t1 = cap;
  if (e.musicTrimEnd != null && Number.isFinite(Number(e.musicTrimEnd))) {
    t1 = Math.min(Number(e.musicTrimEnd), cap);
  }
  return { t0, t1 };
}

export async function fetchLyricsLRCLIB(artist, title) {
  const getUrl = `${LRCLIB_GET}?artist_name=${encodeURIComponent(
    artist || '',
  )}&track_name=${encodeURIComponent(title || '')}`;
  let res = await fetch(getUrl);
  if (res.ok) {
    const j = await res.json();
    if (j && (j.plainLyrics || j.syncedLyrics)) return j;
  }
  const searchUrl = `${LRCLIB_SEARCH}?q=${encodeURIComponent(`${title || ''} ${artist || ''}`)}`;
  res = await fetch(searchUrl);
  if (!res.ok) return null;
  const arr = await res.json();
  return Array.isArray(arr) && arr[0] ? arr[0] : null;
}
