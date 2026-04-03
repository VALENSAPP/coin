import RNFS from 'react-native-fs';
import { fetchYoutubeTrimmedAudioDownloadUrl } from '../services/storyAudio';

const ALLOWED_EXTS = ['.mp3', '.m4a', '.wav', '.aac', '.ogg', '.mp4'];

const MIME_BY_EXT = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
};

// Keep in sync with StoryComposer quick picks.
const BUILTIN_AUDIO_URLS = {
  vibe: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  chill: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  energy: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
};

function getExtFromPathLike(value) {
  if (typeof value !== 'string') return null;
  const noQuery = value.split('?')[0].split('#')[0];
  const lower = noQuery.toLowerCase();
  const idx = lower.lastIndexOf('.');
  if (idx < 0) return null;
  const ext = lower.slice(idx);
  return ALLOWED_EXTS.includes(ext) ? ext : null;
}

function toUploadUri(localPath) {
  if (typeof localPath !== 'string') return null;
  if (localPath.startsWith('file://') || localPath.startsWith('content://')) {
    return localPath;
  }
  if (localPath.startsWith('/')) {
    return `file://${localPath}`;
  }
  return localPath;
}

function resolveAudioSource(clip) {
  if (clip?._uploadAudioUri) {
    return clip._uploadAudioUri;
  }

  const audio = clip?.audio;
  if (!audio || audio === 'original') return null;

  if (typeof audio === 'string') {
    if (
      audio.startsWith('http://') ||
      audio.startsWith('https://') ||
      audio.startsWith('file://') ||
      audio.startsWith('content://')
    ) {
      return audio;
    }
    return BUILTIN_AUDIO_URLS[audio] || null;
  }

  if (typeof audio === 'object') {
    return (
      audio.audioUrl ||
      audio.url ||
      audio.fileUrl ||
      audio.s3Url ||
      audio.previewUrl ||
      audio.songUrl ||
      audio.musicUrl ||
      null
    );
  }

  return null;
}

async function toLocalAudioUri(source, index) {
  if (!source) return null;
  const ext = getExtFromPathLike(source);
  if (!ext) return null;

  // Local path/file/content URI can be used directly.
  if (
    source.startsWith('file://') ||
    source.startsWith('content://') ||
    source.startsWith('/')
  ) {
    return {
      uri: toUploadUri(source),
      ext,
    };
  }

  // Remote URL: download to cache first so backend receives real file.
  if (source.startsWith('http://') || source.startsWith('https://')) {
    const localPath = `${RNFS.CachesDirectoryPath}/story_audio_${Date.now()}_${index}${ext}`;
    await RNFS.downloadFile({
      fromUrl: source,
      toFile: localPath,
    }).promise;

    return {
      uri: toUploadUri(localPath),
      ext,
    };
  }

  return null;
}

/**
 * For YouTube-selected tracks: ask backend for a trimmed MP3/M4A/MP4 URL, download to cache,
 * attach `_uploadAudioUri` / `_uploadAudioExt` on the clip for multipart upload.
 * Library / original / non-YouTube clips are unchanged.
 */
export async function prepareStoryClipsAudioForUpload(processedArray = []) {
  const out = processedArray.map(c => ({ ...c }));

  for (let i = 0; i < out.length; i += 1) {
    const clip = out[i];
    const a = clip.audio;
    if (!a || typeof a !== 'object' || a.source !== 'youtube' || !a.videoId) {
      continue;
    }

    const trim = clip.audioTrim || { start: 0, end: null };
    const startSec = Math.max(0, Number(trim.start) || 0);
    let endSec =
      trim.end == null || trim.end === '' ? null : Number(trim.end);
    if (endSec != null && !Number.isFinite(endSec)) {
      endSec = null;
    }
    if (endSec == null && a.fullDurationSec != null) {
      const fd = Number(a.fullDurationSec);
      if (Number.isFinite(fd) && fd > startSec) {
        endSec = fd;
      }
    }

    const remoteUrl = await fetchYoutubeTrimmedAudioDownloadUrl({
      videoId: a.videoId,
      startSec,
      endSec,
    });

    if (!remoteUrl) {
      console.warn(
        '[Story audio] No trimmed audio URL (e.g. POST /story/youtube-audio-clip missing or 404). ' +
          'Story still uploads with storyMeta; add that endpoint on the server to attach audio_0 files.',
      );
      continue;
    }

    try {
      const ext = getExtFromPathLike(remoteUrl) || '.mp3';
      const localPath = `${RNFS.CachesDirectoryPath}/story_yt_trim_${Date.now()}_${i}${ext}`;
      await RNFS.downloadFile({ fromUrl: remoteUrl, toFile: localPath }).promise;

      out[i] = {
        ...clip,
        _uploadAudioUri: toUploadUri(localPath),
        _uploadAudioExt: ext,
      };
    } catch (e) {
      console.warn('[Story audio] Failed to download trimmed file from server URL', e);
    }
  }

  return out;
}

export async function appendStoryAudioFiles(formData, processedArray = []) {
  const appendedFields = [];
  for (let i = 0; i < processedArray.length; i += 1) {
    const clip = processedArray[i];
    const source = resolveAudioSource(clip);
    if (!source) continue;

    try {
      const extFromClip = clip._uploadAudioExt;
      let local;
      if (clip._uploadAudioUri && extFromClip) {
        local = {
          uri: toUploadUri(clip._uploadAudioUri),
          ext: extFromClip,
        };
      } else {
        local = await toLocalAudioUri(source, i);
      }
      if (!local?.uri || !local?.ext) continue;
      const mime = MIME_BY_EXT[local.ext] || 'audio/mpeg';

      const fieldName = `audio_${i}`;
      formData.append(fieldName, {
        uri: local.uri,
        type: mime,
        name: `story_audio_${i}${local.ext}`,
      });
      appendedFields.push({
        field: fieldName,
        name: `story_audio_${i}${local.ext}`,
        type: mime,
        source: clip._uploadAudioUri ? 'prepared_youtube_trim' : 'url_or_library',
      });
    } catch (_e) {
      // Skip invalid/unsupported/unavailable audio source for this clip.
    }
  }
  if (appendedFields.length > 0) {
    console.log('[Story upload] multipart audio parts attached:', appendedFields);
  }
}
