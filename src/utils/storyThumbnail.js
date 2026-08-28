import { createThumbnail } from 'react-native-create-thumbnail';

function looksLikeUrl(v) {
  return typeof v === 'string' && /^(https?:)?\/\//i.test(v.trim());
}

function pickNonEmpty(...values) {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function toUploadUri(localPath) {
  if (typeof localPath !== 'string') return null;
  if (
    localPath.startsWith('file://') ||
    localPath.startsWith('content://') ||
    localPath.startsWith('http://') ||
    localPath.startsWith('https://')
  ) {
    return localPath;
  }
  if (localPath.startsWith('/')) {
    return `file://${localPath}`;
  }
  return localPath;
}

export function isStoryThumbnailUri(candidate) {
  if (candidate == null) return false;
  const text = String(candidate).trim();
  if (!text) return false;
  return (
    text.startsWith('file://') ||
    text.startsWith('content://') ||
    looksLikeUrl(text)
  );
}

/** Normalize API `media` entry (string URL or media object). */
export function unwrapStoryMediaEntry(entry) {
  if (typeof entry === 'string') {
    const uri = entry.trim();
    return { uri: uri || null, thumbnail: null };
  }
  if (entry && typeof entry === 'object') {
    const uri = pickNonEmpty(
      entry.url,
      entry.uri,
      entry.path,
      entry.src,
      entry.mediaUrl,
      typeof entry.media === 'string' ? entry.media : null,
    );
    const thumbnail = pickNonEmpty(
      entry.thumbnail,
      entry.thumbnailUrl,
      entry.thumb,
      entry.thumbUrl,
      entry.poster,
      entry.posterUrl,
    );
    return { uri, thumbnail };
  }
  return { uri: null, thumbnail: null };
}

/** Normalize API `thumbnails` entry (string URL or thumbnail object). */
export function unwrapStoryThumbnailEntry(entry) {
  if (typeof entry === 'string') {
    const text = entry.trim();
    return text || null;
  }
  if (entry && typeof entry === 'object') {
    return pickNonEmpty(
      entry.url,
      entry.uri,
      entry.thumbnail,
      entry.thumbnailUrl,
      entry.thumb,
      entry.thumbUrl,
      entry.path,
      entry.poster,
    );
  }
  return null;
}

/**
 * Resolve poster URL for one clip from API story row.
 * Priority: `thumbnails[idx]` → media object thumb → clipMeta → story-level thumb.
 */
export function resolveApiStoryClipThumbnail(apiStory, clipIndex, clipMeta = {}, mediaEntry) {
  const thumbnails = apiStory?.thumbnails;
  if (Array.isArray(thumbnails) && thumbnails.length > 0) {
    const raw =
      thumbnails[clipIndex] ??
      (thumbnails.length === 1 ? thumbnails[0] : null);
    const fromArray = unwrapStoryThumbnailEntry(raw);
    if (isStoryThumbnailUri(fromArray)) {
      return String(fromArray).trim();
    }
  }

  const { thumbnail: mediaThumb } = unwrapStoryMediaEntry(mediaEntry);
  if (isStoryThumbnailUri(mediaThumb)) {
    return String(mediaThumb).trim();
  }

  const fromMeta = pickNonEmpty(
    clipMeta?.thumbnail,
    clipMeta?.thumbnailUrl,
    clipMeta?.thumb,
    clipMeta?.thumbUrl,
    clipMeta?.poster,
    clipMeta?.posterUrl,
  );
  if (isStoryThumbnailUri(fromMeta)) {
    return String(fromMeta).trim();
  }

  const single = pickNonEmpty(
    apiStory?.thumbnail,
    apiStory?.thumbnailUrl,
    apiStory?.poster,
  );
  if (isStoryThumbnailUri(single)) {
    return String(single).trim();
  }

  return null;
}

function resolveClipVideoUri(clip) {
  const candidate =
    clip?.processedUri ||
    clip?.original?.uri ||
    clip?.original?.path ||
    clip?.uri ||
    null;
  return candidate ? String(candidate).trim() : null;
}

/**
 * Generate a poster image for each video clip before story upload.
 * Image clips reuse their processed JPEG as the poster.
 */
export async function prepareStoryClipThumbnails(processedArray = []) {
  const out = [];

  for (let i = 0; i < processedArray.length; i += 1) {
    const clip = { ...processedArray[i] };

    if (!clip.isVideo) {
      const imageUri = clip.processedUri || clip.original?.uri || clip.original?.path;
      if (imageUri) {
        clip._thumbnailUri = toUploadUri(imageUri);
      }
      out.push(clip);
      continue;
    }

    const videoUri = resolveClipVideoUri(clip);
    if (!videoUri) {
      out.push(clip);
      continue;
    }

    try {
      const response = await createThumbnail({
        url: toUploadUri(videoUri),
        timeStamp: 0,
        format: 'jpeg',
        maxWidth: 720,
        maxHeight: 1280,
      });
      if (response?.path) {
        clip._thumbnailUri = toUploadUri(response.path);
      }
    } catch (error) {
      console.warn('[Story thumbnail] Failed to generate video poster', error?.message || error);
    }

    out.push(clip);
  }

  return out;
}

/** Attach generated poster files to multipart story upload. */
export function appendStoryThumbnailFiles(formData, processedArray = []) {
  const appended = [];

  processedArray.forEach((clip, index) => {
    const uri = clip?._thumbnailUri;
    if (!uri) return;

    const uploadUri = toUploadUri(uri);
    if (!uploadUri) return;
    const isLocal =
      uploadUri.startsWith('file://') || uploadUri.startsWith('content://');
    if (!isLocal && !looksLikeUrl(uploadUri)) return;

    formData.append('thumbnails', {
      uri: uploadUri,
      type: 'image/jpeg',
      name: `story_thumb_${Date.now()}_${index}.jpg`,
    });
    appended.push(index);
  });

  if (appended.length > 0) {
    console.log('[Story upload] thumbnail parts attached for clip indexes:', appended);
  }
}

export function resolveStoryThumbnailSource(storyLike) {
  if (!storyLike || typeof storyLike !== 'object') return null;

  const clipIndex = Number.isFinite(Number(storyLike.clipIndex))
    ? Number(storyLike.clipIndex)
    : 0;

  const thumbnails = storyLike.thumbnails;
  if (Array.isArray(thumbnails) && thumbnails.length > 0) {
    const raw =
      thumbnails[clipIndex] ??
      (thumbnails.length === 1 ? thumbnails[0] : null);
    const fromArray = unwrapStoryThumbnailEntry(raw);
    if (isStoryThumbnailUri(fromArray)) {
      return String(fromArray).trim();
    }
  }

  const candidate = pickNonEmpty(
    storyLike.thumbnail,
    storyLike.thumbnailUrl,
    storyLike.thumb,
    storyLike.thumbUrl,
    storyLike.poster,
    storyLike.posterUrl,
    storyLike.cover,
    storyLike.coverUrl,
    storyLike.videoThumbnail,
    storyLike.videoThumb,
  );

  if (!isStoryThumbnailUri(candidate)) return null;
  return String(candidate).trim();
}

export function resolveStoryVideoThumbnailSource(storyLike) {
  const uri = resolveStoryThumbnailSource(storyLike);
  return uri ? { uri } : null;
}

export function resolveClipThumbnailUri(clip) {
  const candidate =
    clip?._thumbnailUri ||
    clip?.thumbnail ||
    clip?.thumbnailUrl ||
    clip?.poster ||
    null;
  if (!candidate) return null;
  const text = String(candidate).trim();
  if (!text) return null;
  return toUploadUri(text);
}
