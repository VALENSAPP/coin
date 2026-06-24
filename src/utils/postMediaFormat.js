const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.3gp'];

export const getPostMediaUri = (media) =>
  media?.processedUri ||
  media?.originalUri ||
  media?.path ||
  media?.uri ||
  media?.sourceURL ||
  '';

/** True when upload is a video file (e.g. MP4), not a still image. */
export const isPostMediaVideo = (media) => {
  if (!media) return false;
  if (media?.isVideo === true) return true;

  const type = String(media?.type || media?.mime || '').toLowerCase();
  if (type.includes('video')) return true;

  const uri = getPostMediaUri(media).toLowerCase();
  return VIDEO_EXTENSIONS.some(ext => uri.includes(ext));
};

/** Backend flip format: `video` for MP4/video uploads, `image` otherwise. */
export const getPostMediaFormat = (media) =>
  isPostMediaVideo(media) ? 'video' : 'image';
