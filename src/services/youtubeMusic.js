/**
 * YouTube Data API v3 — search music videos and resolve durations.
 * Set YOUTUBE_DATA_API_KEY in `.env` (see `.env.example`).
 * `src/shims/env.js` is generated when Metro starts (`scripts/writeEnvShim.js`).
 */
import { YOUTUBE_DATA_API_KEY } from '../shims/env';

const YT_SEARCH = 'https://www.googleapis.com/youtube/v3/search';
const YT_VIDEOS = 'https://www.googleapis.com/youtube/v3/videos';

export function getYoutubeSearchApiKey() {
  const k = YOUTUBE_DATA_API_KEY;
  return typeof k === 'string' ? k.trim() : '';
}

/** Parse ISO 8601 duration from videos.list (e.g. PT4M13S). */
export function parseIso8601Duration(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!m) return null;
  const h = parseInt(m[1] || '0', 10);
  const min = parseInt(m[2] || '0', 10);
  const sec = parseFloat(m[3] || '0');
  return h * 3600 + min * 60 + sec;
}

async function fetchYoutubeVideoDurations(videoIds, apiKey) {
  const out = {};
  const chunk = 50;
  for (let i = 0; i < videoIds.length; i += chunk) {
    const slice = videoIds.slice(i, i + chunk);
    const ids = encodeURIComponent(slice.join(','));
    const url = `${YT_VIDEOS}?part=contentDetails&id=${ids}&key=${encodeURIComponent(
      apiKey,
    )}`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const json = await res.json();
    const arr = Array.isArray(json.items) ? json.items : [];
    arr.forEach(v => {
      const id = v.id;
      const iso = v.contentDetails?.duration;
      const sec = parseIso8601Duration(iso);
      if (id && sec != null && sec > 0) out[id] = sec;
    });
  }
  return out;
}

/**
 * @returns {Promise<Array<{ videoId: string, title: string, channelTitle: string, thumbnailUrl: string, durationSec: number }>>}
 */
export async function searchYoutubeMusicTracks(term, apiKeyOverride) {
  const apiKey = (apiKeyOverride ?? getYoutubeSearchApiKey()).trim();
  if (!apiKey) return [];

  const q = encodeURIComponent(term.trim());
  const url = `${YT_SEARCH}?part=snippet&type=video&videoCategoryId=10&maxResults=25&q=${q}&key=${encodeURIComponent(
    apiKey,
  )}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YouTube search failed (${res.status}): ${err.slice(0, 120)}`);
  }
  const json = await res.json();
  const items = Array.isArray(json.items) ? json.items : [];
  const ids = items.map(it => it.id?.videoId).filter(Boolean);
  if (!ids.length) return [];

  const durMap = await fetchYoutubeVideoDurations(ids, apiKey);
  return items
    .map(it => {
      const id = it.id?.videoId;
      if (!id) return null;
      const sn = it.snippet || {};
      const durationSec = durMap[id] ?? 180;
      return {
        videoId: id,
        title: sn.title || 'Unknown',
        channelTitle: sn.channelTitle || '',
        thumbnailUrl:
          sn.thumbnails?.medium?.url ||
          sn.thumbnails?.default?.url ||
          '',
        durationSec,
      };
    })
    .filter(Boolean);
}
