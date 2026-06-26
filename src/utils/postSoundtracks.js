import {
  serializeAudioForStoryMeta,
  normalizeTrim,
  buildStoryMetaPayload,
  sanitizeSerializable,
} from './buildStoryMeta';
import { getStoryBuiltinLibraryUrl } from './storyAudioUpload';
import { defaultMusicBadgePosition } from '../components/home/story.js/storyOverlayConstants';
import { normalizePostTextOverlayForDisplay } from '../components/post/PostMediaTextOverlays';

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

const DEFAULT_MUSIC_CLIP_SEC = 30;

/**
 * Absolute [start, end] window (seconds) for trimmed music playback.
 * Expands a stale short loaded duration when trim points further into the track.
 */
export function getMusicTrimPlaybackWindow(trimStart, trimEnd, fullDurationSec) {
  const start = Math.max(0, Number(trimStart) || 0);
  const parsedEnd =
    trimEnd != null && trimEnd !== '' && Number.isFinite(Number(trimEnd))
      ? Number(trimEnd)
      : null;

  let dur =
    fullDurationSec != null && Number.isFinite(Number(fullDurationSec)) && Number(fullDurationSec) > 0
      ? Number(fullDurationSec)
      : null;

  if (parsedEnd != null) {
    dur = dur != null ? Math.max(dur, parsedEnd) : parsedEnd;
  }
  if (dur != null) {
    dur = Math.max(dur, start + 0.001);
  }

  let end = parsedEnd ?? (dur != null ? dur : start + DEFAULT_MUSIC_CLIP_SEC);
  if (dur != null) {
    end = Math.min(end, dur);
  }

  if (end <= start) {
    const fallbackEnd =
      dur != null
        ? Math.min(Math.max(dur, start + 1), start + DEFAULT_MUSIC_CLIP_SEC)
        : start + DEFAULT_MUSIC_CLIP_SEC;
    return { start: 0, end: fallbackEnd, valid: false, hasOverlap: false };
  }

  return { start, end, valid: true, hasOverlap: true };
}

export function getMusicTrimPlaybackWindowFromTrim(trim, fullDurationSec) {
  return getMusicTrimPlaybackWindow(trim?.start, trim?.end, fullDurationSec);
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
      i?.musicId &&
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
function serializePostSlideTexts(textOverlays) {
  if (!Array.isArray(textOverlays) || textOverlays.length === 0) return null;
  return sanitizeSerializable(
    textOverlays.map(overlay => {
      const normalized = normalizePostTextOverlayForDisplay(overlay);
      return {
        id: normalized.id,
        text: normalized.text,
        fontSize: normalized.fontSize ?? 28,
        scale: normalized.scale ?? 1,
        rotation: normalized.rotation ?? 0,
        color: normalized.color ?? '#fff',
        fontFamily: normalized.fontFamily ?? null,
        textAlign: normalized.textAlign ?? 'center',
        highlightColor: normalized.highlightColor ?? null,
        position: normalized.position || { x: 0, y: 0 },
      };
    }),
  );
}

function serializePostSlideOverlayImages(overlayImages) {
  if (!Array.isArray(overlayImages) || overlayImages.length === 0) return null;
  return sanitizeSerializable(
    overlayImages.map(img => ({
      id: img.id,
      uri: img.uri,
      position: img.position || { x: 0, y: 0 },
      scale: img.scale ?? 1,
      rotation: img.rotation ?? 0,
      baseSize: img.baseSize ?? 100,
    })),
  );
}

function normalizeVideoTextColor(color) {
  const raw = String(color || '#ffffff').trim().toLowerCase();
  if (raw === '#000' || raw === '#000000' || raw === 'black') return 'black';
  if (raw === '#fff' || raw === '#ffffff' || raw === 'white') return 'white';
  if (raw.startsWith('#')) return raw.slice(1);
  return raw;
}

function estimateTextOverlayFootprint(overlay, canvasWidth = 390) {
  const scale = Math.max(0.2, Number(overlay?.scale) || 1);
  const fontSize = (Number(overlay?.fontSize) || 28) * scale;
  const text = String(overlay?.text || '');
  const lines = text.split('\n');
  const longestLineLength = lines.reduce(
    (longest, line) => Math.max(longest, Array.from(line).length),
    0,
  ) || 1;
  const maxLineWidth = Math.max(80, Number(canvasWidth) - 48) / scale;
  const width = Math.min(
    maxLineWidth,
    Math.max(fontSize + 24, longestLineLength * fontSize * 0.62 + 24),
  );
  const wrappedLines = Math.max(
    1,
    lines.length,
    Math.ceil((longestLineLength * fontSize * 0.62 + 24) / maxLineWidth),
  );
  const height = Math.max(fontSize + 14, wrappedLines * fontSize * 1.2 + 14);
  return { width, height, fontSize };
}

/**
 * Convert editor text overlays on a video slide to backend `videoTextItems` shape.
 * @returns {Array<{ text: string, xPercent: number, yPercent: number, fontSize: number, color: string }>}
 */
export function buildVideoTextItemsFromImage(img) {
  const overlays = Array.isArray(img?.textOverlays) ? img.textOverlays : [];
  if (!overlays.length || !img?.isVideo) return [];

  const canvasWidth = Number(img.overlayCanvasWidth) > 0 ? Number(img.overlayCanvasWidth) : 390;
  const canvasHeight = Number(img.overlayCanvasHeight) > 0 ? Number(img.overlayCanvasHeight) : 450;

  return overlays
    .filter(overlay => String(overlay?.text || '').trim().length > 0)
    .map(overlay => {
      const { width, height, fontSize } = estimateTextOverlayFootprint(overlay, canvasWidth);
      const pos = overlay.position || { x: 0, y: 0 };
      const centerX = (Number(pos.x) || 0) + width / 2;
      const centerY = (Number(pos.y) || 0) + height / 2;
      const xPercent = Math.min(1, Math.max(0, centerX / canvasWidth));
      const yPercent = Math.min(1, Math.max(0, centerY / canvasHeight));
      const exportFontSize = Math.round(fontSize * (canvasWidth / 120));

      return {
        text: String(overlay.text).trim(),
        xPercent: Math.round(xPercent * 1000) / 1000,
        yPercent: Math.round(yPercent * 1000) / 1000,
        fontSize: Math.max(12, exportFontSize),
        color: normalizeVideoTextColor(overlay.color),
      };
    });
}

/**
 * Build `videoText` + `videoTextItems` multipart fields for `post/create`.
 */
export function buildVideoTextPayloadFromImages(images = []) {
  const videoTextItems = (images || [])
    .filter(img => img?.isVideo)
    .flatMap(img => buildVideoTextItemsFromImage(img));

  if (!videoTextItems.length) {
    return { videoText: null, videoTextItems: null };
  }

  return {
    videoText: true,
    videoTextItems,
  };
}

function imageHasPostMusicSticker(img) {
  return !!(
    img?.musicId &&
    img.musicId !== 'none' &&
    img.musicSource &&
    img.musicSource !== 'none'
  );
}

function slideMetaHasMusicSticker(slide) {
  if (!slide || typeof slide !== 'object') return false;
  const mode = slide.audio?.mode;
  if (mode && mode !== 'original') return true;
  return !!(slide.musicTitle || slide.musicArtist);
}

function postMetaSlidesHaveOverlayContent(parsedPostMeta) {
  const slides = parsedPostMeta?.slides;
  if (!Array.isArray(slides) || slides.length === 0) return false;
  return slides.some(
    slide =>
      (Array.isArray(slide.texts) && slide.texts.length > 0) ||
      (Array.isArray(slide.overlayImages) && slide.overlayImages.length > 0) ||
      slideMetaHasMusicSticker(slide),
  );
}

function normalizeParsedPostMeta(parsed) {
  if (!parsed || typeof parsed !== 'object') return parsed;
  if (parsed.overlayDisplay) return parsed;
  if (postMetaSlidesHaveOverlayContent(parsed)) {
    return { ...parsed, overlayDisplay: 'layer' };
  }
  return parsed;
}

function resolvePostMusicStickerThumbnail(slide, fallbackImage, rootItem) {
  const ytm = parseRootYoutubeMusicMeta(rootItem);
  return (
    slide?.musicThumbnailUrl ||
    fallbackImage?.musicYoutubeThumbUrl ||
    ytm?.thumbnailUrl ||
    null
  );
}

function resolvePostMusicStickerCopy(slide, fallbackImage, rootItem, slideIndex) {
  const ytm = parseRootYoutubeMusicMeta(rootItem);
  const postMusic =
    Number(slideIndex) === 0
      ? getPostMusicForSlide(rootItem, 0, parsePostMeta(rootItem?.postMeta))
      : null;
  return {
    title:
      slide?.musicTitle ||
      fallbackImage?.musicTitle ||
      ytm?.title ||
      postMusic?.title ||
      null,
    artist:
      slide?.musicArtist ||
      fallbackImage?.musicArtist ||
      ytm?.artist ||
      postMusic?.artist ||
      null,
    thumbnailUrl: resolvePostMusicStickerThumbnail(slide, fallbackImage, rootItem),
  };
}

export function getPostMusicStickerFromMeta(
  parsedPostMeta,
  slideIndex,
  fallbackImage = null,
  rootItem = null,
) {
  const slides = parsedPostMeta?.slides;
  const slide =
    (Array.isArray(slides)
      ? slides.find(entry => Number(entry.imageIndex) === Number(slideIndex)) || slides[slideIndex]
      : null) || {};

  let hasMusic =
    imageHasPostMusicSticker(fallbackImage) || slideMetaHasMusicSticker(slide);
  if (!hasMusic && Number(slideIndex) === 0 && rootItem) {
    hasMusic = !!getPostMusicForSlide(rootItem, 0, parsedPostMeta);
  }
  if (!hasMusic) return null;

  if (fallbackImage?.showMusicCard === false || slide?.showMusicCard === false) {
    return null;
  }

  const canvasWidth =
    slide.overlayCanvasWidth || fallbackImage?.overlayCanvasWidth || null;
  const canvasHeight =
    slide.overlayCanvasHeight || fallbackImage?.overlayCanvasHeight || null;
  const storedBadge = slide.musicBadge || fallbackImage?.musicBadge || null;
  const layout =
    canvasWidth && canvasHeight
      ? { width: canvasWidth, height: canvasHeight }
      : null;
  const defaultBadge = layout ? defaultMusicBadgePosition(layout) : null;
  const badge = storedBadge || (defaultBadge
    ? { x: defaultBadge.x, y: defaultBadge.y, scale: 1, rotation: 0 }
    : { x: null, y: null, scale: 1, rotation: 0 });

  const copy = resolvePostMusicStickerCopy(slide, fallbackImage, rootItem, slideIndex);
  return {
    badge,
    title: copy.title,
    artist: copy.artist,
    thumbnailUrl: copy.thumbnailUrl,
  };
}

export function getPostSlideOverlaysFromMeta(
  parsedPostMeta,
  slideIndex,
  fallbackImage = null,
  rootItem = null,
) {
  const slides = parsedPostMeta?.slides;
  const slide =
    (Array.isArray(slides)
      ? slides.find(entry => Number(entry.imageIndex) === Number(slideIndex)) || slides[slideIndex]
      : null) || {};

  return {
    textOverlays: slide.texts || fallbackImage?.textOverlays || [],
    overlayImages: slide.overlayImages || fallbackImage?.overlayImages || [],
    canvasWidth: slide.overlayCanvasWidth || fallbackImage?.overlayCanvasWidth || null,
    canvasHeight: slide.overlayCanvasHeight || fallbackImage?.overlayCanvasHeight || null,
    musicSticker: getPostMusicStickerFromMeta(
      parsedPostMeta,
      slideIndex,
      fallbackImage,
      rootItem,
    ),
  };
}

export function overlayBundleHasLayers(overlayBundle) {
  return (
    (overlayBundle?.textOverlays?.length || 0) > 0 ||
    (overlayBundle?.overlayImages?.length || 0) > 0 ||
    !!overlayBundle?.musicSticker
  );
}

function normalizeUriPath(uri) {
  if (!uri || typeof uri !== 'string') return '';
  return uri.replace(/\?.*$/, '').replace(/^file:\/\//, '');
}

export function isBakedMediaCapture(image = null) {
  const processed = image?.processedUri;
  const original = image?.originalUri || image?.uri || image?.path;
  if (!processed || !original) return false;
  return normalizeUriPath(processed) !== normalizeUriPath(original);
}

/**
 * Picks the base image URI and whether metadata overlays should render on top.
 * Avoids double music cards / text when capture already baked overlays into processedUri.
 */
export function getPostSlidePreviewState({
  mediaUri,
  fallbackImage = null,
  parsedPostMeta = null,
  slideIndex = 0,
  rootItem = null,
  preferLayerOverlays = false,
  isVideoSlide = null,
}) {
  const slideFromMeta = Array.isArray(parsedPostMeta?.slides)
    ? parsedPostMeta.slides.find(entry => Number(entry.imageIndex) === Number(slideIndex)) ||
      parsedPostMeta.slides[slideIndex]
    : null;
  const slideIsVideo =
    isVideoSlide ??
    fallbackImage?.isVideo ??
    slideFromMeta?.isVideo ??
    false;

  const overlayBundle = getPostSlideOverlaysFromMeta(
    parsedPostMeta,
    slideIndex,
    fallbackImage,
    rootItem,
  );
  const hasLayers = overlayBundleHasLayers(overlayBundle);

  if (!slideIsVideo && !preferLayerOverlays) {
    const uri = isBakedMediaCapture(fallbackImage)
      ? fallbackImage?.processedUri || mediaUri
      : mediaUri;
    return { uri, overlayBundle, showOverlays: false };
  }
  const overlayDisplay = parsedPostMeta?.overlayDisplay;
  const explicitBurned = overlayDisplay === 'burned';
  const explicitLayer = overlayDisplay === 'layer';
  const inferredLayer = postMetaSlidesHaveOverlayContent(parsedPostMeta);
  const layerMode =
    preferLayerOverlays ||
    explicitLayer ||
    (inferredLayer && !explicitBurned) ||
    (!parsedPostMeta && hasLayers);
  const baseUri =
    fallbackImage?.originalUri ||
    fallbackImage?.uri ||
    fallbackImage?.path ||
    mediaUri;

  if (!hasLayers) {
    return { uri: mediaUri, overlayBundle, showOverlays: false };
  }

  if (isBakedMediaCapture(fallbackImage)) {
    return {
      uri: fallbackImage?.processedUri || mediaUri,
      overlayBundle,
      showOverlays: false,
    };
  }

  if (explicitBurned) {
    return { uri: mediaUri, overlayBundle, showOverlays: false };
  }

  if (layerMode) {
    return { uri: baseUri, overlayBundle, showOverlays: true };
  }

  return { uri: mediaUri, overlayBundle, showOverlays: false };
}

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
      stickers: serializePostSlideOverlayImages(img.overlayImages),
      texts: serializePostSlideTexts(img.textOverlays),
      lyrics: sanitizeSerializable(img.musicLyrics ?? null),
      musicBadge: sanitizeSerializable(img.musicBadge ?? null),
    })),
  );
}

function buildSlideMetaForUpload(img, imageIndex) {
  const videoTrim = normalizeTrim({ start: img.trimStart, end: img.trimEnd });
  const base = {
    imageIndex,
    isVideo: !!img.isVideo,
    trim: videoTrim,
    volume: img.flipVolume != null ? Number(img.flipVolume) : 1,
  };

  if (!img.isVideo) {
    if (!imageHasPostMusicSticker(img)) {
      return base;
    }
    const raw = postImageToStoryAudioRaw(img);
    const audioTrim = normalizeTrim({
      start: img.musicTrimStart,
      end: img.musicTrimEnd,
    });
    return {
      ...base,
      audio: serializeAudioForStoryMeta(raw),
      audioTrim,
      musicTitle: img.musicTitle ?? null,
      musicArtist: img.musicArtist ?? null,
      musicThumbnailUrl: img.musicYoutubeThumbUrl ?? null,
      musicBadge: sanitizeSerializable(img.musicBadge ?? null),
      showMusicCard: img.showMusicCard !== false,
      overlayCanvasWidth: img.overlayCanvasWidth ?? null,
      overlayCanvasHeight: img.overlayCanvasHeight ?? null,
    };
  }

  const raw = postImageToStoryAudioRaw(img);
  const audioTrim = normalizeTrim({
    start: img.musicTrimStart,
    end: img.musicTrimEnd,
  });

  return {
    ...base,
    audio: serializeAudioForStoryMeta(raw),
    audioTrim,
    musicTitle: img.musicTitle ?? null,
    musicArtist: img.musicArtist ?? null,
    musicThumbnailUrl: img.musicYoutubeThumbUrl ?? null,
    lyrics: sanitizeSerializable(img.musicLyrics ?? null),
    musicBadge: sanitizeSerializable(img.musicBadge ?? null),
    showMusicCard: img.showMusicCard !== false,
    texts: serializePostSlideTexts(img.textOverlays),
    overlayImages: serializePostSlideOverlayImages(img.overlayImages),
    overlayCanvasWidth: img.overlayCanvasWidth ?? null,
    overlayCanvasHeight: img.overlayCanvasHeight ?? null,
  };
}

/**
 * Per-slide meta persisted on the post (echoed by API).
 * Image slides bake text/music stickers into the uploaded file; only video slides carry layer metadata.
 */
export function buildPostMetaFromImages(images = []) {
  const slides = images.map((img, imageIndex) => buildSlideMetaForUpload(img, imageIndex));
  const hasVideoLayerContent = slides.some(
    slide =>
      slide.isVideo &&
      ((Array.isArray(slide.texts) && slide.texts.length > 0) ||
        (Array.isArray(slide.overlayImages) && slide.overlayImages.length > 0) ||
        slideMetaHasMusicSticker(slide)),
  );
  return {
    version: 1,
    overlayDisplay: hasVideoLayerContent ? 'layer' : 'burned',
    slides,
  };
}

/**
 * Fields sent to `post/create` and `post/edit`.
 * Image slides bake text/music stickers into the file; soundtrack fields apply to any slide with music.
 */
export function buildPostUploadPayloadFromImages(images = []) {
  const postMeta = buildPostMetaFromImages(images);
  const { music, youtubeMusicMeta } = buildCreatePostMusicPayload(images);
  const { videoText, videoTextItems } = buildVideoTextPayloadFromImages(images);
  return {
    postMeta,
    ...(music ? { music } : {}),
    ...(youtubeMusicMeta ? { youtubeMusicMeta } : {}),
    ...(videoText ? { videoText, videoTextItems } : {}),
  };
}

export function parsePostMeta(raw) {
  if (raw == null) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return normalizeParsedPostMeta(parsed);
  } catch {
    return null;
  }
}

export function mergePostOverlayFieldsFromClient(apiPost, clientFields = {}) {
  if (!apiPost || typeof apiPost !== 'object') return apiPost;
  const postMeta =
    apiPost.postMeta ??
    apiPost.post_meta ??
    apiPost.PostMeta ??
    clientFields.postMeta ??
    null;
  const music = apiPost.music ?? apiPost.Music ?? clientFields.music ?? null;
  const youtubeMusicMeta =
    apiPost.youtubeMusicMeta ??
    apiPost.youtube_music_meta ??
    apiPost.YoutubeMusicMeta ??
    clientFields.youtubeMusicMeta ??
    null;
  return { ...apiPost, postMeta, music, youtubeMusicMeta };
}

const clientPostOverlayCache = new Map();

export function cacheClientPostOverlayFields(postId, fields = {}) {
  if (postId == null || postId === '') return;
  clientPostOverlayCache.set(String(postId), {
    postMeta: fields.postMeta ?? null,
    music: fields.music ?? null,
    youtubeMusicMeta: fields.youtubeMusicMeta ?? null,
  });
}

export function applyClientPostOverlayCache(post) {
  const cached = clientPostOverlayCache.get(String(post?.id));
  if (!cached) return post;
  return mergePostOverlayFieldsFromClient(post, cached);
}

export function applyClientPostOverlayCacheToList(posts) {
  return (Array.isArray(posts) ? posts : []).map(applyClientPostOverlayCache);
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
