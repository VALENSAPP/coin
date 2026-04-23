import { Platform } from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';

/** Square output for hex profile; user pans/zooms in the native cropper first. */
export const PROFILE_CROP_SIZE = 1024;

const CROP_UI = {
  width: PROFILE_CROP_SIZE,
  height: PROFILE_CROP_SIZE,
  freeStyleCropEnabled: true,
  enableRotationGesture: true,
  compressImageQuality: 0.92,
  cropperToolbarTitle: 'Move & scale',
  cropperChooseText: 'Use photo',
  cropperCancelText: 'Cancel',
  cropperActiveWidgetColor: '#7c3aed',
  cropperStatusBarColor: '#1a1a1a',
  cropperToolbarColor: '#1a1a1a',
  cropperToolbarWidgetColor: '#ffffff',
  forceJpg: true,
};

/** Picker + crop in one flow (move/zoom then confirm). */
export function pickProfileImageFromGallery() {
  return ImagePicker.openPicker({
    mediaType: 'photo',
    cropping: true,
    ...CROP_UI,
  });
}

/** Camera + same crop step as gallery. */
export function pickProfileImageFromCamera() {
  return ImagePicker.openCamera({
    mediaType: 'photo',
    cropping: true,
    ...CROP_UI,
  });
}

/** Normalize path from react-native-image-crop-picker for display + FormData `uri`. */
export function uriFromCropPath(pathIn) {
  if (!pathIn) return null;
  const p = String(pathIn);
  if (p.startsWith('file://') || p.startsWith('content://')) return p;
  return Platform.OS === 'ios' ? `file://${p}` : p;
}
