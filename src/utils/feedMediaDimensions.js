import { Dimensions, Image } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

export const FEED_MEDIA_MIN_RATIO = 0.56;
export const FEED_MEDIA_MAX_RATIO = 2.2;
export const DEFAULT_FEED_MEDIA_HEIGHT = SCREEN_WIDTH;

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

export function measureFeedMediaHeight(uri, containerWidth = SCREEN_WIDTH) {
  return new Promise(resolve => {
    if (!uri) {
      resolve(DEFAULT_FEED_MEDIA_HEIGHT);
      return;
    }
    Image.getSize(
      uri,
      (w, h) => resolve(computeFeedMediaHeight(w, h, containerWidth)),
      () => resolve(DEFAULT_FEED_MEDIA_HEIGHT),
    );
  });
}
