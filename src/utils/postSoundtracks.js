import {
  serializeAudioForStoryMeta,
  normalizeTrim,
  buildStoryMetaPayload,
  sanitizeSerializable,
} from './buildStoryMeta';
import { getStoryBuiltinLibraryUrl } from './storyAudioUpload';

/**
 * Built-in post / flip soundtracks (UI labels). URLs match story library ids (chill / energy / vibe).
 */
export const POST_SOUNDTRACKS = [
  {
    id: 'v1',
    storyLibraryId: 'chill',
    title: 'Chill Beat',
    artist: 'Valens',
    sourceUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  },
  {
    id: 'v2',
    storyLibraryId: 'energy',
    title: 'Energy Pop',
    artist: 'Valens',
    sourceUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  },
  {
    id: 'v3',
    storyLibraryId: 'vibe',
    title: 'Lo-Fi Dream',
    artist: 'Valens',
    sourceUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  },
  {
    id: 'none',
    storyLibraryId: null,
    title: 'Original sound only',
    artist: 'No track',
    sourceUrl: null,
  },
];

export function getPostSoundtrackUrl(musicId) {
  if (!musicId || musicId === 'none') return null;
  const t = POST_SOUNDTRACKS.find(x => x.id === musicId);
  return t?.sourceUrl || null;
}

/**
 * Map editor image → same `audio` shape StoryComposer passes in `handleExport` (before serialize).
 * YouTube objects and library strings `chill` | `energy` | `vibe` match story upload resolution.
 */
export function postImageToStoryAudioRaw(img) {
  if (!img) return 'original';

  let ytId =
    typeof img.musicYoutubeVideoId === 'string' && img.musicYoutubeVideoId.trim()
      ? img.musicYoutubeVideoId.trim()
      : null;
  if (!ytId && typeof img.musicId === 'string' && img.musicId.startsWith('yt:')) {
    ytId = img.musicId.slice(3).trim() || null;
  }
  if (
    !ytId &&
    img.musicSource === 'youtube' &&
    typeof img.musicId === 'string' &&
    img.musicId &&
    !img.musicId.startsWith('yt:')
  ) {
    ytId = img.musicId.trim();
  }

  if (ytId) {
    return {
      source: 'youtube',
      videoId: ytId,
      title: img.musicTitle,
      artist: img.musicArtist,
      fullDurationSec:
        img.musicYoutubeDurationSec != null &&
        Number.isFinite(Number(img.musicYoutubeDurationSec))
          ? Number(img.musicYoutubeDurationSec)
          : undefined,
      thumbnailUrl: img.musicYoutubeThumbUrl || undefined,
    };
  }

  if (
    img.musicSource === 'none' ||
    !img.musicId ||
    img.musicId === 'none' ||
    img.musicId === 'original'
  ) {
    return 'original';
  }

  const fromPicker = POST_SOUNDTRACKS.find(x => x.id === img.musicId);
  if (fromPicker?.storyLibraryId) {
    return fromPicker.storyLibraryId;
  }

  if (typeof img.musicId === 'string') {
    if (['chill', 'energy', 'vibe'].includes(img.musicId)) {
      return img.musicId;
    }
  }

  return 'original';
}

/** Map post `imageEdits` fields → story trim/preview `audioSel` shape (youtube object | library id string | original). */
export function postImageEditsToStoryAudioSel(edits) {
  return postImageToStoryAudioRaw(edits || {});
}

/**
 * Clips shaped like StoryComposer export items needed for `prepareStoryClipsAudioForUpload` +
 * `appendStoryAudioFiles` (fields: `audio`, `audioTrim`).
 */
export function postImagesToStoryAudioClips(images = []) {
  return images.map(img => ({
    audio: postImageToStoryAudioRaw(img),
    audioTrim: normalizeTrim({
      start: img.musicTrimStart,
      end: img.musicTrimEnd,
    }),
  }));
}

/**
 * Swagger `POST /post/create`: `music` (string) + `youtubeMusicMeta` (JSON string).
 * First slide with a track; includes optional `audioTrim` { start, end } from Sound / trim UI.
 */
export function buildCreatePostMusicPayload(images = []) {
  const img = images.find(
    i =>
      i &&
      i.musicId &&
      i.musicId !== 'none' &&
      i.musicSource &&
      i.musicSource !== 'none',
  );
  if (!img) return {};

  const audioTrim = normalizeTrim({
    start: img.musicTrimStart,
    end: img.musicTrimEnd,
  });

  if (img.musicSource === 'youtube') {
    const vid =
      (typeof img.musicYoutubeVideoId === 'string' && img.musicYoutubeVideoId.trim()) ||
      (typeof img.musicId === 'string' && img.musicId.startsWith('yt:')
        ? img.musicId.slice(3).trim()
        : '') ||
      (typeof img.musicId === 'string' ? img.musicId.trim() : '');
    if (!vid) return {};
    const meta = {
      source: 'youtube',
      videoId: vid,
      title: img.musicTitle ?? null,
      artist: img.musicArtist ?? null,
      thumbnailUrl: img.musicYoutubeThumbUrl ?? null,
      durationSec:
        img.musicYoutubeDurationSec != null && Number.isFinite(Number(img.musicYoutubeDurationSec))
          ? Number(img.musicYoutubeDurationSec)
          : null,
      audioTrim,
    };
    return { music: vid, youtubeMusicMeta: JSON.stringify(meta) };
  }

  if (img.musicSource === 'builtin') {
    const track = POST_SOUNDTRACKS.find(x => x.id === img.musicId);
    const meta = {
      source: 'builtin',
      trackId: img.musicId,
      storyLibraryId: track?.storyLibraryId ?? null,
      title: img.musicTitle ?? track?.title ?? null,
      artist: img.musicArtist ?? track?.artist ?? null,
      audioTrim,
    };
    return {
      music: String(img.musicId),
      youtubeMusicMeta: JSON.stringify(meta),
    };
  }

  return {};
}

/**
 * Same JSON shape as story `storyMeta` on `story/upload`, built from post slides (for `post/create`).
 */
export function buildPostStoryMetaPayload(images = []) {
  const audioClips = postImagesToStoryAudioClips(images);
  return buildStoryMetaPayload(
    images.map((img, i) => ({
      isVideo: !!img.isVideo,
      duration: img.duration != null ? img.duration : null,
      filterKey: img.filter ?? 'none',
      audio: audioClips[i].audio,
      audioTrim: audioClips[i].audioTrim,
      trim: normalizeTrim({ start: img.trimStart, end: img.trimEnd }),
      volume: img.flipVolume != null ? Number(img.flipVolume) : 1,
      stickers: null,
      texts: null,
      lyrics: sanitizeSerializable(img.musicLyrics ?? null),
      musicBadge: sanitizeSerializable(img.musicBadge ?? null),
    })),
  );
}

/**
 * Per-slide meta persisted on the post (echoed by API). Uses same `audio` serialization as stories.
 */
export function buildPostMetaFromImages(images = []) {
  const slides = images.map((img, imageIndex) => {
    const raw = postImageToStoryAudioRaw(img);
    const audioTrim = normalizeTrim({
      start: img.musicTrimStart,
      end: img.musicTrimEnd,
    });
    const videoTrim = normalizeTrim({ start: img.trimStart, end: img.trimEnd });
    return {
      imageIndex,
      isVideo: !!img.isVideo,
      audio: serializeAudioForStoryMeta(raw),
      audioTrim,
      trim: videoTrim,
      volume: img.flipVolume != null ? Number(img.flipVolume) : 1,
      musicTitle: img.musicTitle ?? null,
      musicArtist: img.musicArtist ?? null,
      lyrics: sanitizeSerializable(img.musicLyrics ?? null),
      musicBadge: sanitizeSerializable(img.musicBadge ?? null),
    };
  });
  return { version: 1, slides };
}

export function parsePostMeta(raw) {
  if (raw == null) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

function audioMetaPlayableUrl(audioMeta) {
  if (!audioMeta || typeof audioMeta !== 'object') return null;
  if (audioMeta.mode === 'library' && audioMeta.trackId) {
    return getStoryBuiltinLibraryUrl(audioMeta.trackId);
  }
  return null;
}

/**
 * Resolve playable audio URL for a feed slide: server media first, then postMeta (story-shaped or legacy).
 */
export function getSlideBackgroundAudioUrl(mediaItem, postMetaParsed, slideIndex) {
  const fromMedia =
    mediaItem?.audioUrl ||
    mediaItem?.musicUrl ||
    mediaItem?.backgroundAudioUrl ||
    null;
  if (fromMedia) return fromMedia;

  const slides = postMetaParsed?.slides;
  if (!Array.isArray(slides) || slides.length === 0) return null;

  const slide =
    slides.find(s => Number(s.imageIndex) === Number(slideIndex)) || slides[slideIndex];
  if (!slide) return null;

  const direct = slide.audioUrl || slide.musicUrl;
  if (direct) return direct;

  const fromSerialized = audioMetaPlayableUrl(slide.audio);
  if (fromSerialized) return fromSerialized;

  if (slide.musicSource === 'youtube' || slide.youtubeVideoId) {
    return null;
  }

  return getPostSoundtrackUrl(slide.musicId);
}

/**
 * Pull music-related fields from API (camelCase or snake_case) for feed → PostItem mapping.
 */
export function extractPostMusicPayloadFromApi(post) {
  if (!post || typeof post !== 'object') {
    return { music: null, youtubeMusicMeta: null, postMeta: null };
  }
  return {
    music: post.music ?? post.Music ?? null,
    youtubeMusicMeta:
      post.youtubeMusicMeta ??
      post.youtube_music_meta ??
      post.YoutubeMusicMeta ??
      null,
    postMeta: post.postMeta ?? post.post_meta ?? post.PostMeta ?? null,
  };
}

function parseRootYoutubeMusicMeta(item) {
  const raw =
    item?.youtubeMusicMeta ??
    item?.youtube_music_meta ??
    item?.YoutubeMusicMeta ??
    null;
  if (raw == null || raw === '') return null;
  let ytm;
  try {
    ytm = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!ytm || typeof ytm !== 'object') return null;
  if (!ytm.videoId && ytm.video_id) ytm.videoId = ytm.video_id;
  if (!ytm.audioTrim && ytm.audio_trim) ytm.audioTrim = ytm.audio_trim;
  if (!ytm.trackId && ytm.track_id) ytm.trackId = ytm.track_id;
  if (!ytm.storyLibraryId && ytm.story_library_id) {
    ytm.storyLibraryId = ytm.story_library_id;
  }
  if (!ytm.durationSec && ytm.duration_sec != null) ytm.durationSec = ytm.duration_sec;
  return ytm;
}

function postRootMusicId(item) {
  const m = item?.music ?? item?.Music;
  if (m == null || m === '') return null;
  return m;
}

function normalizeAudioTrim(at) {
  if (!at || typeof at !== 'object') return { start: 0, end: null };
  const start = at.start != null ? Math.max(0, Number(at.start) || 0) : 0;
  const end =
    at.end != null && at.end !== '' && Number.isFinite(Number(at.end)) ? Number(at.end) : null;
  return { start, end };
}

/**
 * Feed / post detail: resolve attached soundtrack from `music` + `youtubeMusicMeta` (create-post shape)
 * and fall back to per-slide `postMeta` / media URLs.
 *
 * @returns {{ kind: 'youtube', videoId: string, trim: object, title: ?string, artist: ?string, durationSec: ?number }
 *   | { kind: 'mp3', audioUrl: string, trim: object, title: ?string, artist: ?string }
 *   | null}
 */
export function getPostMusicForSlide(item, slideIndex, parsedPostMeta) {
  const ytm = parseRootYoutubeMusicMeta(item);
  const ytmSource =
    ytm?.source != null ? String(ytm.source).toLowerCase().trim() : '';

  if (ytmSource === 'youtube') {
    const videoId = String(ytm.videoId || postRootMusicId(item) || '')
      .trim()
      .replace(/^yt:/i, '');
    if (!videoId) return null;
    return {
      kind: 'youtube',
      videoId,
      trim: normalizeAudioTrim(ytm.audioTrim),
      title: ytm.title ?? null,
      artist: ytm.artist ?? ytm.channelTitle ?? null,
      durationSec:
        ytm.durationSec != null && Number.isFinite(Number(ytm.durationSec))
          ? Number(ytm.durationSec)
          : null,
    };
  }

  if (ytmSource === 'builtin') {
    const trackId = ytm.trackId || postRootMusicId(item);
    const url =
      getPostSoundtrackUrl(trackId) ||
      (ytm.storyLibraryId
        ? getStoryBuiltinLibraryUrl(String(ytm.storyLibraryId))
        : null);
    if (!url) return null;
    return {
      kind: 'mp3',
      audioUrl: url,
      trim: normalizeAudioTrim(ytm.audioTrim),
      title: ytm.title ?? null,
      artist: ytm.artist ?? null,
    };
  }

  const rootMusic = postRootMusicId(item);
  if (!ytm && rootMusic != null && rootMusic !== '') {
    const mid = String(rootMusic).trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(mid)) {
      return {
        kind: 'youtube',
        videoId: mid,
        trim: { start: 0, end: null },
        title: null,
        artist: null,
        durationSec: null,
      };
    }
    const builtinUrl = getPostSoundtrackUrl(mid);
    if (builtinUrl) {
      return {
        kind: 'mp3',
        audioUrl: builtinUrl,
        trim: { start: 0, end: null },
        title: null,
        artist: null,
      };
    }
  }

  const fromLegacy = getSlideBackgroundAudioUrl(
    item?.media?.[slideIndex],
    parsedPostMeta,
    slideIndex,
  );
  if (fromLegacy) {
    return {
      kind: 'mp3',
      audioUrl: fromLegacy,
      trim: { start: 0, end: null },
      title: null,
      artist: null,
    };
  }

  return null;
}
