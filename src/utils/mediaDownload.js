import RNFS from 'react-native-fs';
import { Platform, Alert, PermissionsAndroid } from 'react-native';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { showToastMessage } from '../components/displaytoastmessage';

const VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];

const DOWNLOAD_DIR = RNFS.CachesDirectoryPath;

const isHttpUrl = (uri) =>
  uri.startsWith('http://') || uri.startsWith('https://');

const isLocalUri = (uri) =>
  uri.startsWith('file://') ||
  (uri.startsWith('/') && !isHttpUrl(uri));

const stripQuery = (value) => value.split('?')[0].split('#')[0];

const hasExt = (filename, exts) => {
  const lower = filename.toLowerCase();
  return exts.some(ext => lower.endsWith(ext));
};

const sanitizeFilename = (filename, isVideo) => {
  let name = filename || '';
  try {
    name = decodeURIComponent(name);
  } catch (_e) {
    // keep original if it is not URI-encoded
  }
  name = stripQuery(name).replace(/[^a-zA-Z0-9._-]/g, '_') || `valens_${Date.now()}`;

  if (isVideo && !hasExt(name, VIDEO_EXTS)) {
    name = `${name}.mp4`;
  } else if (!isVideo && !hasExt(name, IMAGE_EXTS) && !hasExt(name, VIDEO_EXTS)) {
    name = `${name}.jpg`;
  }
  return name;
};

const getUniqueDestinationPath = async (filename) => {
  const safeName = filename.replace(/\/+/g, '_');
  const dotIndex = safeName.lastIndexOf('.');
  const hasExtension = dotIndex > 0;
  const name = hasExtension ? safeName.slice(0, dotIndex) : safeName;
  const extension = hasExtension ? safeName.slice(dotIndex) : '';

  let attempt = 0;
  let candidate = `${DOWNLOAD_DIR}/${safeName}`;

  while (await RNFS.exists(candidate)) {
    attempt += 1;
    candidate = `${DOWNLOAD_DIR}/${name}_${attempt}${extension}`;
  }

  return candidate;
};

const requestSavePermission = async () => {
  if (Platform.OS !== 'android' || Platform.Version >= 29) {
    return true;
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
};

const toFileUri = (path) =>
  path.startsWith('file://') ? path : `file://${path}`;

const isIgnorableGallerySaveError = (error) => {
  const message = String(error?.message || '');
  const code = String(error?.code || '');
  return (
    Platform.OS === 'ios' &&
    (code === 'E_UNABLE_TO_SAVE' ||
      /unknown error from a native module/i.test(message) ||
      /PHPhotosErrorDomain/i.test(message))
  );
};

const saveToGallery = async (localPath, isVideo) => {
  const fileUri = toFileUri(localPath);
  try {
    await CameraRoll.saveAsset(fileUri, {
      type: isVideo ? 'video' : 'photo',
    });
  } catch (error) {
    // iOS "Add Photos Only" can save the file then fail when reading it back.
    const exists = await RNFS.exists(localPath.replace(/^file:\/\//, ''));
    if (exists && isIgnorableGallerySaveError(error)) {
      return;
    }
    throw error;
  }
};

export const downloadMedia = async (uri, filename, isVideo = false, toast) => {
  try {
    if (!uri || typeof uri !== 'string') {
      throw new Error('No media URL to download.');
    }

    const hasPermission = await requestSavePermission();
    if (!hasPermission) {
      throw new Error('Storage permission is required to save this media.');
    }

    if (DOWNLOAD_DIR && !(await RNFS.exists(DOWNLOAD_DIR))) {
      await RNFS.mkdir(DOWNLOAD_DIR);
    }

    const destPath = await getUniqueDestinationPath(
      sanitizeFilename(filename, isVideo),
    );
    let localPath = destPath;

    if (isLocalUri(uri)) {
      const cleanSrc = uri.replace(/^file:\/\//, '');
      await RNFS.copyFile(cleanSrc, destPath);
    } else {
      const result = await RNFS.downloadFile({
        fromUrl: uri,
        toFile: destPath,
        headers: { 'Cache-Control': 'no-cache' },
      }).promise;

      if (result.statusCode !== 200) {
        throw new Error(`Download failed with status ${result.statusCode}`);
      }
    }

    await saveToGallery(localPath, isVideo);

    showToastMessage(
      toast,
      'success',
      `Saved to ${isVideo ? 'Videos' : 'Photos'}`,
    );
    return localPath;
  } catch (error) {
    console.error('downloadMedia error:', error);
    Alert.alert('Download Failed', error.message || 'Unable to save media.');
    showToastMessage(toast, 'danger', 'Download failed');
    throw error;
  }
};

export const getMediaFilename = (uri, index = 0) => {
  const raw = String(uri || '');
  const base = stripQuery(raw.split('/').pop() || '') || `media_${Date.now()}`;
  const hasFileExt = base.includes('.');
  if (hasFileExt) return `Valens_edited_${index + 1}_${Date.now()}_${base}`;
  const ext =
    VIDEO_EXTS.some(extName => raw.toLowerCase().includes(extName))
      ? 'mp4'
      : 'jpg';
  return `Valens_edited_${index + 1}_${Date.now()}.${ext}`;
};

export const isVideoMedia = (media) => {
  if (!media) return false;
  const type = String(media.type || media.mime || '').toLowerCase();
  if (type.includes('video') || type === 'reel' || type === 'flip') {
    return true;
  }
  const uri = media.uri || media.path || media.processedUri || media.url || '';
  const lower = String(uri).toLowerCase();
  return (
    VIDEO_EXTS.some(ext => lower.includes(ext)) ||
    media.duration > 0
  );
};
