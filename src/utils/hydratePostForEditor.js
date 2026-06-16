import { normalizeTrim } from './buildStoryMeta';
import {
  parsePostMeta,
  extractPostMusicPayloadFromApi,
  POST_SOUNDTRACKS,
} from './postSoundtracks';

const VIDEO_EXT = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.3gp'];

export function isVideoMediaUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase().split('?')[0];
  return VIDEO_EXT.some(ext => lower.endsWith(ext));
}

function parseRootYoutubeMeta(post) {
  const raw =
    post?.youtubeMusicMeta ??
    post?.youtube_music_meta ??
    post?.YoutubeMusicMeta ??
    null;
  if (raw == null || raw === '') return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

function createEmptySlideEdits() {
  return {
    textOverlays: [],
    overlayImages: [],
    filter: 'none',
    drawings: null,
    uriBeforeAnyDrawing: null,
    processedImageUri: null,
    musicSource: 'none',
    musicId: 'none',
    musicTitle: null,
    musicArtist: null,
    musicYoutubeVideoId: null,
    musicYoutubeThumbUrl: null,
    musicYoutubeDurationSec: null,
    musicTrimStart: 0,
    musicTrimEnd: null,
    musicLyrics: null,
    musicBadge: null,
    showMusicCard: true,
    trimStart: 0,
    trimEnd: null,
  };
}

function resolveBuiltinTrackFromLibraryId(trackId) {
  if (!trackId) return null;
  return (
    POST_SOUNDTRACKS.find(
      t => t.id === trackId || t.storyLibraryId === trackId,
    ) || null
  );
}

function slideHasSerializedMusic(slide) {
  const mode = slide?.audio?.mode;
  return Boolean(mode && mode !== 'original');
}

function resolveRootPostMusic(post) {
  const ytm = parseRootYoutubeMeta(post);
  const rootMusic = post?.music ?? post?.Music;
  const rootStr = rootMusic != null ? String(rootMusic).trim() : '';

  if (ytm && typeof ytm === 'object') {
    const source = String(ytm.source || '').toLowerCase();
    if (source === 'youtube' || ytm.videoId) {
      const vid = String(ytm.videoId || rootStr).replace(/^yt:/i, '').trim();
      if (vid) {
        return { kind: 'youtube', videoId: vid, ytm };
      }
    }
    if (source === 'builtin' || ytm.trackId || ytm.storyLibraryId) {
      const track =
        resolveBuiltinTrackFromLibraryId(ytm.trackId || ytm.storyLibraryId) ||
        POST_SOUNDTRACKS.find(t => t.id === rootStr);
      if (track) {
        return { kind: 'builtin', track, ytm };
      }
    }
  }

  if (rootStr && /^[a-zA-Z0-9_-]{11}$/.test(rootStr)) {
    return { kind: 'youtube', videoId: rootStr, ytm: null };
  }

  const builtin = POST_SOUNDTRACKS.find(t => t.id === rootStr);
  if (builtin) {
    return { kind: 'builtin', track: builtin, ytm: null };
  }

  return null;
}

function getMusicSlideIndex(slides, post) {
  const fromSlide = slides.findIndex(slideHasSerializedMusic);
  if (fromSlide >= 0) return fromSlide;
  return resolveRootPostMusic(post) ? 0 : -1;
}

function musicFieldsFromRoot(post, slide, rootMusic) {
  const base = {
    musicTrimStart: 0,
    musicTrimEnd: null,
    musicTitle: slide?.musicTitle ?? null,
    musicArtist: slide?.musicArtist ?? null,
    musicLyrics: slide?.lyrics ?? null,
    musicBadge: slide?.musicBadge ?? null,
    showMusicCard: slide?.showMusicCard !== false,
  };

  if (rootMusic.kind === 'youtube') {
    const ytm = rootMusic.ytm;
    const trim = normalizeTrim(ytm?.audioTrim);
    return {
      ...base,
      musicSource: 'youtube',
      musicId: `yt:${rootMusic.videoId}`,
      musicYoutubeVideoId: rootMusic.videoId,
      musicYoutubeThumbUrl: ytm?.thumbnailUrl ?? slide?.musicThumbnailUrl ?? null,
      musicYoutubeDurationSec:
        ytm?.durationSec != null && Number.isFinite(Number(ytm.durationSec))
          ? Number(ytm.durationSec)
          : null,
      musicTrimStart: trim.start,
      musicTrimEnd: trim.end,
      musicTitle: base.musicTitle || ytm?.title || null,
      musicArtist: base.musicArtist || ytm?.artist || null,
    };
  }

  if (rootMusic.kind === 'builtin') {
    const ytm = rootMusic.ytm;
    const trim = normalizeTrim(ytm?.audioTrim);
    const track = rootMusic.track;
    return {
      ...base,
      musicSource: 'builtin',
      musicId: track.id,
      musicTrimStart: trim.start,
      musicTrimEnd: trim.end,
      musicTitle: base.musicTitle || ytm?.title || track.title,
      musicArtist: base.musicArtist || ytm?.artist || track.artist,
    };
  }

  return null;
}

function musicFieldsFromSlide(slide, post, slideIndex, musicSlideIndex) {
  const audio = slide?.audio;
  const audioTrim = normalizeTrim(slide?.audioTrim);
  const base = {
    musicTrimStart: audioTrim.start,
    musicTrimEnd: audioTrim.end,
    musicTitle: slide?.musicTitle ?? null,
    musicArtist: slide?.musicArtist ?? null,
    musicLyrics: slide?.lyrics ?? null,
    musicBadge: slide?.musicBadge ?? null,
    showMusicCard: slide?.showMusicCard !== false,
  };

  if (audio?.mode === 'youtube' || audio?.videoId) {
    const vid = String(audio.videoId || '').trim();
    if (vid) {
      return {
        ...base,
        musicSource: 'youtube',
        musicId: `yt:${vid}`,
        musicYoutubeVideoId: vid,
        musicYoutubeThumbUrl: slide?.musicThumbnailUrl ?? null,
        musicYoutubeDurationSec:
          audio.fullDurationSec != null && Number.isFinite(Number(audio.fullDurationSec))
            ? Number(audio.fullDurationSec)
            : null,
        musicTitle: base.musicTitle || audio.title || null,
        musicArtist: base.musicArtist || audio.artist || null,
      };
    }
  }

  if (audio?.mode === 'library') {
    const track = resolveBuiltinTrackFromLibraryId(audio.trackId);
    if (track) {
      return {
        ...base,
        musicSource: 'builtin',
        musicId: track.id,
        musicTitle: base.musicTitle || audio.title || track.title,
        musicArtist: base.musicArtist || track.artist,
      };
    }
  }

  if (Number(slideIndex) === Number(musicSlideIndex)) {
    const rootMusic = resolveRootPostMusic(post);
    const fromRoot = rootMusic ? musicFieldsFromRoot(post, slide, rootMusic) : null;
    if (fromRoot) return fromRoot;
  }

  return {
    ...createEmptySlideEdits(),
    ...base,
    musicSource: 'none',
    musicId: 'none',
  };
}

export function normalizePostMediaForEditor(post) {
  const fromMedia = Array.isArray(post?.media) ? post.media : null;
  const fromImages = Array.isArray(post?.images) ? post.images : [];

  const rawList = fromMedia?.length
    ? fromMedia.map(item => {
        if (typeof item === 'string') {
          return { url: item, type: isVideoMediaUrl(item) ? 'video' : 'image' };
        }
        const url = item?.url || item?.uri || '';
        const type =
          item?.type === 'video' || isVideoMediaUrl(url) ? 'video' : 'image';
        return {
          url,
          type,
          thumbnail: item?.thumbnail || item?.poster || null,
          width: item?.width,
          height: item?.height,
          duration: item?.duration,
        };
      })
    : fromImages.map(url => {
        const normalized = typeof url === 'string' ? url : url?.url || url?.uri || '';
        return {
          url: normalized,
          type: isVideoMediaUrl(normalized) ? 'video' : 'image',
        };
      });

  return rawList
    .filter(item => item.url)
    .map((item, index) => {
      const isVideo = item.type === 'video';
      return {
        uri: item.url,
        path: item.url,
        type: isVideo ? 'video/mp4' : 'image/jpeg',
        mime: isVideo ? 'video/mp4' : 'image/jpeg',
        isVideo,
        thumbnail: item.thumbnail || null,
        width: item.width,
        height: item.height,
        duration: item.duration,
        imageIndex: index,
      };
    });
}

function normalizeTaggedPeople(post) {
  const source = Array.isArray(post?.taggedPeople) ? post.taggedPeople : [];
  const taggedPeople = [];
  const taggedPeopleIds = {};
  const taggedPeopleMeta = [];

  source.forEach(person => {
    if (typeof person === 'string') {
      const username = person.trim().replace(/^@+/, '');
      if (!username) return;
      taggedPeople.push(username);
      taggedPeopleMeta.push({ username, userId: null });
      return;
    }
    const userId = String(
      person?.id || person?.userId || person?._id || '',
    ).trim();
    const username = String(
      person?.username || person?.userName || person?.name || '',
    )
      .trim()
      .replace(/^@+/, '');
    if (!username && !userId) return;
    if (username) {
      taggedPeople.push(username);
      if (userId) taggedPeopleIds[username] = userId;
      taggedPeopleMeta.push({ username, userId: userId || null });
    }
  });

  return { taggedPeople, taggedPeopleIds, taggedPeopleMeta };
}

function resolvePostType(post) {
  const type = String(post?.type || post?.postType || 'normal').toLowerCase();
  if (type === 'reel' || type === 'flip') return 'flip';
  if (type === 'private_circle') return 'private_circle';
  if (type === 'private') return 'private';
  if (type === 'crowdfunding' || post?.raiseAmount) return 'crowdfunding';
  return 'regular';
}

function resolveFromIcon(post) {
  const type = String(post?.type || '').toLowerCase();
  const format = String(post?.format || '').toLowerCase();
  if (type === 'reel' || format === 'reel') return 'Flips';
  if (format === 'video') return 'video';
  return post?.fromIcon || 'post';
}

export function buildImageEditsFromPost(post, mediaCount) {
  const parsedMeta = parsePostMeta(
    extractPostMusicPayloadFromApi(post).postMeta ?? post?.postMeta,
  );
  const slides = Array.isArray(parsedMeta?.slides) ? parsedMeta.slides : [];
  const musicSlideIndex = getMusicSlideIndex(slides, post);
  const edits = {};

  for (let index = 0; index < mediaCount; index += 1) {
    const slide =
      slides.find(entry => Number(entry.imageIndex) === Number(index)) ||
      slides[index] ||
      {};
    const musicFields = musicFieldsFromSlide(slide, post, index, musicSlideIndex);
    const videoTrim = normalizeTrim(slide.trim);

    edits[index] = {
      ...createEmptySlideEdits(),
      ...musicFields,
      textOverlays: Array.isArray(slide.texts)
        ? slide.texts.map(overlay => ({
            ...overlay,
            position: overlay.position || { x: 0, y: 0 },
          }))
        : [],
      overlayImages: Array.isArray(slide.overlayImages)
        ? slide.overlayImages.map(overlay => ({
            ...overlay,
            position: overlay.position || { x: 0, y: 0 },
          }))
        : [],
      trimStart: videoTrim.start,
      trimEnd: videoTrim.end,
      flipVolume: slide.volume != null ? Number(slide.volume) : 1,
      overlayCanvasWidth: slide.overlayCanvasWidth ?? null,
      overlayCanvasHeight: slide.overlayCanvasHeight ?? null,
    };
  }

  return edits;
}

export function buildEditorImagesFromHydrated(hydrated) {
  const media = Array.isArray(hydrated?.selectedMedia) ? hydrated.selectedMedia : [];
  const imageEdits = hydrated?.initialImageEdits || {};

  return media.map((image, index) => {
    const edits = imageEdits[index] || createEmptySlideEdits();
    const displayUri = image.uri || image.path || image.url || '';
    return {
      ...image,
      originalUri: displayUri,
      processedUri: displayUri,
      filter: edits.filter || 'none',
      isVideo: !!image.isVideo,
      trimStart: edits.trimStart,
      trimEnd: edits.trimEnd,
      musicId: edits.musicId,
      musicTitle: edits.musicTitle,
      musicArtist: edits.musicArtist,
      musicSource: edits.musicSource,
      musicYoutubeVideoId: edits.musicYoutubeVideoId,
      musicYoutubeThumbUrl: edits.musicYoutubeThumbUrl,
      musicYoutubeDurationSec: edits.musicYoutubeDurationSec,
      musicTrimStart: edits.musicTrimStart ?? 0,
      musicTrimEnd: edits.musicTrimEnd ?? null,
      musicLyrics: edits.musicLyrics ?? null,
      musicBadge: edits.musicBadge ?? null,
      showMusicCard: edits.showMusicCard !== false,
      flipVolume: edits.flipVolume ?? 1,
      textOverlays: (edits.textOverlays || []).map(overlay => ({
        ...overlay,
        position: overlay.position || { x: 0, y: 0 },
      })),
      overlayImages: (edits.overlayImages || []).map(overlay => ({
        ...overlay,
        position: overlay.position || { x: 0, y: 0 },
      })),
      overlayCanvasWidth: edits.overlayCanvasWidth ?? null,
      overlayCanvasHeight: edits.overlayCanvasHeight ?? null,
      imageIndex: index,
    };
  });
}

export function hydratePostForEditor(post) {
  const musicPayload = extractPostMusicPayloadFromApi(post);
  const mergedPost = {
    ...post,
    music: musicPayload.music ?? post?.music ?? post?.Music,
    youtubeMusicMeta:
      musicPayload.youtubeMusicMeta ??
      post?.youtubeMusicMeta ??
      post?.youtube_music_meta,
    postMeta: musicPayload.postMeta ?? post?.postMeta ?? post?.post_meta,
  };
  const selectedMedia = normalizePostMediaForEditor(mergedPost);
  const initialImageEdits = buildImageEditsFromPost(mergedPost, selectedMedia.length);
  const { taggedPeople, taggedPeopleIds, taggedPeopleMeta } = normalizeTaggedPeople(mergedPost);

  return {
    selectedMedia,
    initialImageEdits,
    editPostId: mergedPost?.id,
    caption: mergedPost?.caption || '',
    location: typeof mergedPost?.location === 'string' ? mergedPost.location : '',
    postType: resolvePostType(mergedPost),
    fromIcon: resolveFromIcon(mergedPost),
    visibleTo: mergedPost?.visibleTo || '',
    isTrustPost: Boolean(mergedPost?.isTrustPost),
    taggedPeople,
    taggedPeopleIds,
    taggedPeopleMeta,
    originalPost: mergedPost,
  };
}

export function isLocalMediaUri(uri) {
  if (!uri || typeof uri !== 'string') return false;
  return (
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('ph://') ||
    (uri.startsWith('/') && !uri.startsWith('//'))
  );
}
