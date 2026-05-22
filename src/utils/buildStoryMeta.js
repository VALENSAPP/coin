import { getStoryBuiltinLibraryTrack } from './storyAudioUpload';

/**
 * Builds JSON for `storyMeta` multipart field on `story/upload`.
 * Matches StoryComposer `handleExport` clip shape (audio, trims, overlays).
 */

export function normalizeTrim(t) {
  if (!t || typeof t !== 'object') {
    return { start: 0, end: null };
  }
  const start = typeof t.start === 'number' ? t.start : Number(t.start) || 0;
  const endRaw = t.end;
  const end =
    endRaw == null || endRaw === ''
      ? null
      : Number.isFinite(Number(endRaw))
        ? Number(endRaw)
        : null;
  return { start, end };
}

export function sanitizeSerializable(value) {
  if (value == null) {
    return null;
  }
  try {
    JSON.stringify(value);
    return value;
  } catch {
    return null;
  }
}

/**
 * @param {unknown} audio — from StoryComposer: 'original' | library id string | YouTube object
 * @returns {Record<string, unknown>}
 */
export function serializeAudioForStoryMeta(audio) {
  if (audio == null || audio === 'original') {
    return { mode: 'original' };
  }
  if (typeof audio === 'string') {
    const builtin = getStoryBuiltinLibraryTrack(audio);
    if (builtin) {
      return {
        mode: 'library',
        trackId: builtin.id,
        title: builtin.title,
        previewUrl: builtin.url,
      };
    }
    return { mode: 'library', trackId: audio };
  }
  if (typeof audio === 'object' && !Array.isArray(audio)) {
    if (audio.source === 'youtube' && audio.videoId) {
      const fd = audio.fullDurationSec;
      return {
        mode: 'youtube',
        videoId: String(audio.videoId),
        title: audio.title ?? audio.trackName ?? null,
        artist: audio.artist ?? audio.artistName ?? null,
        previewUrl: audio.previewUrl ?? null,
        fullDurationSec:
          fd != null && Number.isFinite(Number(fd)) ? Number(fd) : null,
      };
    }
    const out = {
      mode: 'custom',
      source: typeof audio.source === 'string' ? audio.source : undefined,
      title: audio.title ?? audio.trackName ?? null,
      artist: audio.artist ?? audio.artistName ?? null,
      previewUrl: audio.previewUrl ?? null,
      videoId: audio.videoId != null ? String(audio.videoId) : null,
    };
    return Object.fromEntries(
      Object.entries(out).filter(([, v]) => v != null && v !== undefined),
    );
  }
  return { mode: 'unknown', value: String(audio) };
}

/**
 * @param {Array<{
 *   audio?: unknown,
 *   audioTrim?: { start?: number, end?: number | null },
 *   trim?: { start?: number, end?: number | null },
 *   volume?: number,
 *   filterKey?: string,
 *   stickers?: unknown,
 *   texts?: unknown,
 *   lyrics?: unknown,
 *   isVideo?: boolean,
 *   duration?: number,
 * }>} processedArray
 */
export function buildStoryMetaPayload(processedArray) {
  const clips = (processedArray || []).map((item, index) => ({
    index,
    isVideo: !!item.isVideo,
    duration: item.duration != null ? item.duration : null,
    filterKey: item.filterKey ?? 'none',
    audio: serializeAudioForStoryMeta(item.audio),
    audioTrim: normalizeTrim(item.audioTrim),
    trim: normalizeTrim(item.trim),
    volume: item.volume != null ? Number(item.volume) : 1,
    stickers: sanitizeSerializable(item.stickers),
    texts: sanitizeSerializable(item.texts),
    lyrics: sanitizeSerializable(item.lyrics),
    musicBadge: sanitizeSerializable(item.musicBadge),
  }));

  return {
    version: 1,
    clips,
  };
}
