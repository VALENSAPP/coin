import { getStoryBuiltinLibraryUrl } from './storyAudioUpload';
import {
  resolveApiStoryClipThumbnail,
  unwrapStoryMediaEntry,
} from './storyThumbnail';

export function parseStoryMeta(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return typeof raw === 'object' ? raw : null;
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function looksLikeUrl(v) {
  return typeof v === 'string' && /^(https?:)?\/\//i.test(v.trim());
}

const pickNonEmptyString = (...values) => {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
};

function unwrapMediaEntry(entry) {
  if (entry == null) return null;
  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    return trimmed || null;
  }
  if (typeof entry === 'object') {
    return pickNonEmptyString(
      entry.url,
      entry.uri,
      entry.path,
      entry.src,
      entry.mediaUrl,
      entry.image,
    );
  }
  return null;
}

export function isStoryVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
  return videoExtensions.some(ext => url.toLowerCase().includes(ext));
}

/** Resolve a playable media URL from heterogeneous story / share payloads. */
export function resolveStoryMediaUri(storyLike, clipIndex = 0) {
  if (!storyLike || typeof storyLike !== 'object') return null;

  const idx = Number.isFinite(Number(storyLike.clipIndex))
    ? Number(storyLike.clipIndex)
    : clipIndex;

  const fromMediaArray = Array.isArray(storyLike.media)
    ? (unwrapMediaEntry(storyLike.media[idx]) || unwrapMediaEntry(storyLike.media[0]))
    : null;
  const fromImagesArray = Array.isArray(storyLike.images)
    ? (unwrapMediaEntry(storyLike.images[idx]) || unwrapMediaEntry(storyLike.images[0]))
    : null;

  return pickNonEmptyString(
    storyLike.uri,
    storyLike.video,
    storyLike.content,
    fromMediaArray,
    fromImagesArray,
    unwrapMediaEntry(storyLike.media),
    storyLike.thumbnail,
    storyLike.thumbnailUrl,
    storyLike.image,
    storyLike.photo,
    storyLike.poster,
    storyLike.cover,
  );
}

export function resolveStoryMediaType(storyLike, mediaUri) {
  if (storyLike?.type === 'video' || storyLike?.isVideo === true) return 'video';
  if (mediaUri && isStoryVideoUrl(mediaUri)) return 'video';

  const meta = parseStoryMeta(storyLike?.storyMeta);
  const idx = Number.isFinite(Number(storyLike?.clipIndex))
    ? Number(storyLike.clipIndex)
    : 0;
  const clipMeta = meta?.clips?.[idx] || meta?.clips?.[0] || {};
  if (clipMeta.isVideo === true) return 'video';
  if (clipMeta.isVideo === false) return 'image';
  return 'image';
}

export function resolveStoryDurationMs(storyLike) {
  const isVideo = storyLike?.type === 'video' || !!storyLike?.isVideo;
  const fallbackMs = isVideo ? 15000 : 5000;

  const explicitMs = toFiniteNumber(storyLike?.duration);
  if (explicitMs != null && explicitMs > 0) return explicitMs;

  const visualTrimStart = Math.max(0, toFiniteNumber(storyLike?.trim?.start) || 0);
  const visualTrimEndRaw = toFiniteNumber(storyLike?.trim?.end);
  const visualTrimSec =
    visualTrimEndRaw != null && visualTrimEndRaw > visualTrimStart
      ? visualTrimEndRaw - visualTrimStart
      : null;

  const audioTrimStart = Math.max(0, toFiniteNumber(storyLike?.audioTrim?.start) || 0);
  const audioTrimEndRaw = toFiniteNumber(storyLike?.audioTrim?.end);
  const audioTrimSec =
    audioTrimEndRaw != null && audioTrimEndRaw > audioTrimStart
      ? audioTrimEndRaw - audioTrimStart
      : null;

  const chosenSec = isVideo ? visualTrimSec : (audioTrimSec ?? visualTrimSec);
  if (chosenSec != null && chosenSec > 0) {
    return Math.max(1000, Math.round(chosenSec * 1000));
  }
  return fallbackMs;
}

export function resolveStoryAudioPayload(storyLike) {
  const rawSrc =
    storyLike?.audio ??
    storyLike?.song ??
    storyLike?.music ??
    storyLike?.track ??
    null;
  let src = rawSrc;

  if (typeof src === 'string') {
    const trimmed = src.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') src = parsed;
      } catch (_e) { }
    }
  }

  if (typeof src === 'string') {
    const normalized = src.trim();
    if (!normalized || normalized.toLowerCase() === 'original') {
      return { directUrl: null, youtubeVideoId: null };
    }
    if (looksLikeUrl(normalized)) return { directUrl: normalized, youtubeVideoId: null };
    const builtinUrl = getStoryBuiltinLibraryUrl(normalized);
    if (builtinUrl) return { directUrl: builtinUrl, youtubeVideoId: null };
    return { directUrl: null, youtubeVideoId: normalized || null };
  }

  if (src && typeof src === 'object') {
    const normalizedMode = typeof src.mode === 'string' ? src.mode.trim().toLowerCase() : '';

    if (normalizedMode === 'youtube') {
      const uploadedUrl =
        src.audioUrl || src.s3Url || src.fileUrl || src.url ||
        src.songUrl || src.musicUrl || src.previewUrl || null;
      const directUrl = looksLikeUrl(uploadedUrl) ? String(uploadedUrl).trim() : null;
      if (directUrl) return { directUrl, youtubeVideoId: null };

      const youtubeVideoId = src.videoId || src.youtubeVideoId || src.ytVideoId || null;
      return {
        directUrl: null,
        youtubeVideoId:
          typeof youtubeVideoId === 'string' && youtubeVideoId.trim()
            ? youtubeVideoId.trim()
            : null,
      };
    }

    const libraryTrackId =
      typeof src.trackId === 'string' ? src.trackId :
        typeof src.libraryTrackId === 'string' ? src.libraryTrackId :
          typeof src.id === 'string' ? src.id : null;
    const libraryTitle =
      typeof src.title === 'string' ? src.title :
        typeof src.trackName === 'string' ? src.trackName : null;

    if (normalizedMode === 'library' || libraryTrackId) {
      const builtinUrl = getStoryBuiltinLibraryUrl(libraryTrackId || libraryTitle);
      if (builtinUrl) return { directUrl: builtinUrl, youtubeVideoId: null };
    }

    const directUrl =
      src.audioUrl || src.s3Url || src.fileUrl || src.url ||
      src.songUrl || src.musicUrl || src.previewUrl || null;
    const youtubeVideoId = src.videoId || src.youtubeVideoId || src.ytVideoId || null;

    return {
      directUrl: looksLikeUrl(directUrl) ? String(directUrl).trim() : null,
      youtubeVideoId:
        typeof youtubeVideoId === 'string' && youtubeVideoId.trim()
          ? youtubeVideoId.trim()
          : null,
    };
  }

  const storyLevelUrl =
    storyLike?.audioUrl || storyLike?.songUrl || storyLike?.musicUrl || storyLike?.previewUrl || null;
  return {
    directUrl: looksLikeUrl(storyLevelUrl) ? String(storyLevelUrl).trim() : null,
    youtubeVideoId:
      typeof storyLike?.videoId === 'string' && storyLike.videoId.trim()
        ? storyLike.videoId.trim()
        : null,
  };
}

/** Merge storyMeta clip fields so shared/API story payloads play music like the feed viewer. */
export function normalizeStoryForViewer(storyLike) {
  if (!storyLike || typeof storyLike !== 'object') return storyLike;

  const meta = parseStoryMeta(storyLike.storyMeta);
  const clipIndex = Number.isFinite(Number(storyLike.clipIndex))
    ? Number(storyLike.clipIndex)
    : 0;
  const clipMeta = meta?.clips?.[clipIndex] || meta?.clips?.[0] || {};

  const fallbackAudio =
    clipMeta.audio ??
    meta?.audio ??
    storyLike.audio ??
    storyLike.song ??
    storyLike.music ??
    null;

  const mediaUri = resolveStoryMediaUri(storyLike, clipIndex);
  const mediaType = resolveStoryMediaType(storyLike, mediaUri);
  const thumbnail =
    storyLike.thumbnail ||
    resolveApiStoryClipThumbnail(storyLike, clipIndex, clipMeta, null) ||
    null;

  return {
    ...clipMeta,
    ...storyLike,
    uri: mediaUri || storyLike.uri,
    thumbnail,
    hasThumbnail: Boolean(thumbnail || clipMeta?.hasThumbnail || storyLike?.hasThumbnail),
    type: storyLike.type || mediaType,
    audio: fallbackAudio,
    audioTrim: clipMeta.audioTrim ?? storyLike.audioTrim ?? { start: 0, end: null },
    trim: clipMeta.trim ?? storyLike.trim ?? { start: 0, end: null },
    volume: clipMeta.volume ?? storyLike.volume ?? 1,
  };
}

export function splitStoryClipId(rawId) {
  const raw = String(rawId || '').trim();
  const match = raw.match(/^(.*)_(\d+)$/);
  if (match) {
    return { baseId: match[1], clipIndex: Number(match[2]) };
  }
  return { baseId: raw.replace(/_\d+$/, ''), clipIndex: 0 };
}

export function inferClipIndex(storyLike, apiStory, fallbackIndex = 0) {
  const fromId = splitStoryClipId(storyLike?.id || storyLike?.storyId).clipIndex;
  if (String(storyLike?.id || '').includes('_')) return fromId;

  const targetUri = resolveStoryMediaUri(storyLike);
  const media = Array.isArray(apiStory?.media) ? apiStory.media : [];
  if (targetUri && media.length) {
    const idx = media.findIndex(entry => {
      const candidate =
        typeof entry === 'string'
          ? entry
          : entry?.url || entry?.uri || entry?.path || null;
      return candidate && String(candidate).trim() === String(targetUri).trim();
    });
    if (idx >= 0) return idx;
  }

  return Number.isFinite(fallbackIndex) ? fallbackIndex : 0;
}

function resolveStoryClipMediaType(uri, clipMeta) {
  if (clipMeta?.isVideo === true) return 'video';
  if (clipMeta?.isVideo === false) return 'image';
  if (uri && isStoryVideoUrl(uri)) return 'video';
  return 'image';
}

/** Map one API story row (`media` + `thumbnails` + `storyMeta`) into viewer-ready clips. */
export function mapApiStoryRowToClips(apiStory, extras = {}) {
  if (!apiStory || typeof apiStory !== 'object') return [];

  const ts = new Date(
    apiStory.createdAt || apiStory.updatedAt || Date.now(),
  ).getTime();
  const meta = parseStoryMeta(apiStory.storyMeta);
  const media = Array.isArray(apiStory.media) ? apiStory.media : [];
  const storyBaseId = String(
    apiStory.id || apiStory._id || apiStory.storyId || '',
  ).trim();

  return media.map((mediaEntry, idx) => {
    const clipMeta = meta?.clips?.[idx] || {};
    const { uri: mediaUri } = unwrapStoryMediaEntry(mediaEntry);
    const uri = mediaUri ? String(mediaUri).trim() : '';
    const mediaType = resolveStoryClipMediaType(uri, clipMeta);
    const thumbnail = resolveApiStoryClipThumbnail(
      apiStory,
      idx,
      clipMeta,
      mediaEntry,
    );
    const fallbackAudio =
      clipMeta.audio ??
      meta?.audio ??
      apiStory?.audio ??
      apiStory?.song ??
      apiStory?.music ??
      null;

    return {
      ...clipMeta,
      ...extras,
      audio: fallbackAudio,
      duration: resolveStoryDurationMs({ ...clipMeta, type: mediaType }),
      thumbnail,
      hasThumbnail: Boolean(thumbnail || clipMeta?.hasThumbnail),
      id: storyBaseId ? `${storyBaseId}_${idx}` : `story_${idx}`,
      storyId: storyBaseId || extras.storyId || null,
      type: mediaType,
      uri,
      clipIndex: idx,
      timestamp: ts,
      seen: false,
      views: [],
      likes: [],
      comments: [],
    };
  });
}

export function storyHasPlayableAudio(storyLike) {
  const normalized = normalizeStoryForViewer(storyLike);
  const { directUrl, youtubeVideoId } = resolveStoryAudioPayload(normalized);
  return !!(directUrl || youtubeVideoId);
}

/** Build a feed-quality clip object from a full API story row (includes storyMeta audio). */
export function buildStoryClipFromApiRow(apiStory, clipIndex = 0, extras = {}) {
  if (!apiStory || typeof apiStory !== 'object') return extras;

  const meta = parseStoryMeta(apiStory.storyMeta);
  const clipMeta = meta?.clips?.[clipIndex] || meta?.clips?.[0] || {};
  const media = Array.isArray(apiStory.media) ? apiStory.media : [];
  const mediaEntry = media[clipIndex] || media[0];
  const { uri: mediaUri, thumbnail: embeddedThumb } = unwrapStoryMediaEntry(mediaEntry);
  const uri =
    resolveStoryMediaUri({
      ...apiStory,
      uri: mediaUri,
      clipIndex,
    }) || mediaUri;
  const mediaType = resolveStoryMediaType({ ...clipMeta, ...apiStory, uri }, uri);
  const thumbnail =
    resolveApiStoryClipThumbnail(apiStory, clipIndex, clipMeta, mediaEntry) ||
    embeddedThumb ||
    null;
  const fallbackAudio =
    clipMeta.audio ??
    meta?.audio ??
    apiStory.audio ??
    apiStory.song ??
    apiStory.music ??
    null;
  const storyBaseId = String(apiStory.id || apiStory._id || apiStory.storyId || '').trim();

  return normalizeStoryForViewer({
    ...clipMeta,
    ...extras,
    ...apiStory,
    clipIndex,
    storyMeta: apiStory.storyMeta,
    uri,
    thumbnail,
    hasThumbnail: Boolean(thumbnail || clipMeta?.hasThumbnail),
    type: mediaType,
    audio: fallbackAudio,
    id: storyBaseId ? `${storyBaseId}_${clipIndex}` : extras.id,
    storyId: storyBaseId || extras.storyId,
    duration: resolveStoryDurationMs({ ...clipMeta, type: mediaType }),
    createdAt: apiStory.createdAt || apiStory.updatedAt || extras.createdAt,
  });
}
