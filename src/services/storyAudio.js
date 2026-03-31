import axiosInstance from './index';

/**
 * Backend must return a temporary HTTPS URL to an MP3/M4A/MP4 file containing
 * only the requested time range of the YouTube track.
 *
 * POST story/youtube-audio-clip
 * Body: { videoId, startSec, endSec | null }
 * Response (typical): { success, data: { url } } or { url }
 */
export async function fetchYoutubeTrimmedAudioDownloadUrl({
  videoId,
  startSec,
  endSec,
}) {
  const res = await axiosInstance.post('story/youtube-audio-clip', {
    videoId: String(videoId),
    startSec: Math.max(0, Number(startSec) || 0),
    endSec:
      endSec == null || endSec === '' || !Number.isFinite(Number(endSec))
        ? null
        : Number(endSec),
  });

  if (res?.statusCode === 404) {
    console.warn(
      '[Story audio] POST /story/youtube-audio-clip is not implemented on the server (404). Add this route to return a trimmed audio file URL.',
    );
    return null;
  }

  if (res?.error || res?.success === false) {
    console.warn('[Story audio] story/youtube-audio-clip error:', res?.message || res);
    return null;
  }

  console.log('[Story audio] story/youtube-audio-clip OK:', res);

  const inner = res?.data != null && typeof res.data === 'object' ? res.data : res;
  const url =
    inner?.url ??
    inner?.downloadUrl ??
    inner?.audioUrl ??
    res?.url ??
    res?.downloadUrl;

  return typeof url === 'string' && /^https?:\/\//i.test(url.trim())
    ? url.trim()
    : null;
}
