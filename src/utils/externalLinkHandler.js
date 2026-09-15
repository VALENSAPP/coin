import { DeviceEventEmitter, Platform, Linking } from 'react-native';

export const SHOW_EXTERNAL_LINK_MODAL_EVENT = 'SHOW_EXTERNAL_LINK_MODAL';

/**
 * Show external link copy modal (or open directly depending on platform/config)
 * 
 * @param {string} url - The URL to open or copy
 * @param {Object} [options]
 * @param {string} [options.title] - Modal title
 * @param {string} [options.description] - Modal body description
 * @param {boolean} [options.forceModal=false] - Force showing modal on all platforms
 */
export const openExternalLink = (url, options = {}) => {
  if (!url) return;

  // On iOS (or if forceModal is set), show the Netflix-style Copy Link modal to satisfy App Store 3.1.1 guidelines
  if (Platform.OS === 'ios' || options.forceModal) {
    DeviceEventEmitter.emit(SHOW_EXTERNAL_LINK_MODAL_EVENT, {
      url,
      title: options.title,
      description: options.description,
    });
  } else {
    // On Android, we can open directly or trigger the modal as requested
    Linking.openURL(url).catch((err) => {
      console.log('Error opening URL:', err);
    });
  }
};
