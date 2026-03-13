// / mediaDownload.js
import RNFS from 'react-native-fs';
import { Platform, Alert } from 'react-native';
import { showToastMessage } from '../components/displaytoastmessage';
 
const DOWNLOAD_DIR =
  Platform.OS === 'ios'
    ? RNFS.DocumentDirectoryPath
    : RNFS.DownloadDirectoryPath ?? RNFS.ExternalDirectoryPath;
 
/** True when the URI is a local file path (not an http/https URL). */
const isLocalUri = (uri) =>
  uri.startsWith('file://') ||
  uri.startsWith('/') ||
  (!uri.startsWith('http://') && !uri.startsWith('https://'));
 
export const downloadMedia = async (uri, filename, isVideo = false, toast) => {
  try {
    const destPath = `${DOWNLOAD_DIR}/${filename}`;
    const cleanSrc = uri.replace(/^file:\/\//, ''); // RNFS.copyFile wants bare path
 
    if (isLocalUri(uri)) {
      // ── Local file: just copy it ──────────────────────────────
      await RNFS.copyFile(cleanSrc, destPath);
    } else {
      // ── Remote URL: download it ───────────────────────────────
      const result = await RNFS.downloadFile({
        fromUrl: uri,
        toFile: destPath,
        headers: { 'Cache-Control': 'no-cache' },
        progress: (res) => {
          const pct = ((res.bytesWritten / res.contentLength) * 100).toFixed(1);
          console.log(`Download progress: ${pct}%`);
        },
      }).promise;
 
      if (result.statusCode !== 200) {
        throw new Error(`Download failed with status ${result.statusCode}`);
      }
    }
 
    // ── Android: tell the gallery the file exists ─────────────
    if (Platform.OS === 'android') {
      RNFS.scanFile(destPath).catch(err =>
        console.warn('MediaScanner error (non-fatal):', err)
      );
    }
 
    showToastMessage(
      toast,
      'success',
      `Saved to ${isVideo ? 'Downloads' : 'Photos'}`
    );
    return destPath;
 
  } catch (error) {
    console.error('downloadMedia error:', error);
    Alert.alert('Download Failed', error.message || 'Unable to save media.');
    showToastMessage(toast, 'danger', 'Download failed');
    throw error; // let the caller handle it if needed
  }
};
 
export const getMediaFilename = (uri, index = 0) => {
  const base = uri.split('/').pop().split('?')[0] || `media_${Date.now()}`;
  const hasExt = base.includes('.');
  if (hasExt) return `Valens_edited_${index + 1}_${base}`;
  const ext =
    uri.toLowerCase().includes('.mp4') || uri.toLowerCase().includes('.mov')
      ? 'mp4'
      : 'jpg';
  return `Valens_edited_${index + 1}.${ext}`;
};
 
export const isVideoMedia = (media) => {
  if (!media) return false;
  const uri = media.uri || media.path || media.processedUri || media.url || '';
  const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
  return (
    videoExts.some(ext => uri.toLowerCase().includes(ext)) ||
    media.duration > 0 ||
    !!media.type?.includes('video')
  );
};
 
