import { Dimensions, Image } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

export const FEED_MEDIA_MIN_RATIO = 0.56;
export const FEED_MEDIA_MAX_RATIO = 2.2;
export const DEFAULT_FEED_MEDIA_HEIGHT = SCREEN_WIDTH;

/** URI → measured feed height; avoids layout flicker when posts re-enter the list. */
const feedMediaHeightCache = new Map();

export function getCachedFeedMediaHeight(uri) {
  return uri ? feedMediaHeightCache.get(uri) : undefined;
}

export function cacheFeedMediaHeight(uri, height) {
  if (uri && Number.isFinite(height) && height > 0) {
    feedMediaHeightCache.set(uri, height);
  }
}

export function computeFeedMediaHeight(imageWidth, imageHeight, containerWidth = SCREEN_WIDTH) {
  if (!imageWidth || !imageHeight) {
    return DEFAULT_FEED_MEDIA_HEIGHT;
  }
  const ratio = containerWidth / imageWidth;
  const scaledHeight = imageHeight * ratio;
  const minHeight = containerWidth * FEED_MEDIA_MIN_RATIO;
  const maxHeight = containerWidth * FEED_MEDIA_MAX_RATIO;
  return Math.max(minHeight, Math.min(scaledHeight, maxHeight));
}

export function resolveFeedMediaHeight(media, containerWidth = SCREEN_WIDTH) {
  const uri = media?.url;
  if (!uri) return DEFAULT_FEED_MEDIA_HEIGHT;

  const cached = getCachedFeedMediaHeight(uri);
  if (cached) return cached;

  const w = Number(media?.width);
  const h = Number(media?.height);
  if (w > 0 && h > 0) {
    const height = computeFeedMediaHeight(w, h, containerWidth);
    cacheFeedMediaHeight(uri, height);
    return height;
  }

  return null;
}

export function measureFeedMediaHeight(uri, containerWidth = SCREEN_WIDTH) {
  return new Promise(resolve => {
    if (!uri) {
      resolve(DEFAULT_FEED_MEDIA_HEIGHT);
      return;
    }
    const cached = getCachedFeedMediaHeight(uri);
    if (cached) {
      resolve(cached);
      return;
    }
    Image.getSize(
      uri,
      (w, h) => {
        const height = computeFeedMediaHeight(w, h, containerWidth);
        cacheFeedMediaHeight(uri, height);
        resolve(height);
      },
      () => resolve(DEFAULT_FEED_MEDIA_HEIGHT),
    );
  });
}

export async function measureFeedMediaItemHeight(media, isVideoUrl, containerWidth = SCREEN_WIDTH) {
  const syncHeight = resolveFeedMediaHeight(media, containerWidth);
  if (syncHeight != null) return syncHeight;

  const uri = media?.url;
  if (!uri) return DEFAULT_FEED_MEDIA_HEIGHT;

  const isVideo = media?.type === 'video' || (typeof isVideoUrl === 'function' && isVideoUrl(uri));
  const measureUri = isVideo && media?.thumbnail ? media.thumbnail : uri;
  return measureFeedMediaHeight(measureUri, containerWidth);
}
