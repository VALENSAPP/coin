import { Platform } from 'react-native';

const ANDROID_CALLBACK_URL = 'https://valensGoApp.com';
const IOS_CALLBACK_URL = 'com.valens://';
const WEB_BASE_URL = 'https://valensGoApp.com';
const APP_BASE_URL = 'com.valens://';

export const getProfileShareCallbackUrl = () => (
  Platform.OS === 'ios' ? IOS_CALLBACK_URL : ANDROID_CALLBACK_URL
);

export const buildProfileShareUrls = ({ username = '', userId = '' } = {}) => {
  const resolvedUsername = String(username || '').trim();
  const resolvedUserId = String(userId || '').trim();
  const callbackUrl = getProfileShareCallbackUrl();

  const deepLinkParams = [];
  const webParams = [];

  if (resolvedUserId) {
    const encodedUserId = encodeURIComponent(resolvedUserId);
    deepLinkParams.push(`userId=${encodedUserId}`);
    webParams.push(`userId=${encodedUserId}`);
  }

  if (resolvedUsername) {
    deepLinkParams.push(`username=${encodeURIComponent(resolvedUsername)}`);
  }

  const encodedCallbackUrl = encodeURIComponent(callbackUrl);
  deepLinkParams.push(`callbackUrl=${encodedCallbackUrl}`);
  webParams.push(`callbackUrl=${encodedCallbackUrl}`);

  const deepLinkQuery = deepLinkParams.join('&');
  const deepLink = deepLinkQuery
    ? `${APP_BASE_URL}profile?${deepLinkQuery}`
    : `${APP_BASE_URL}profile`;

  const webPath = resolvedUsername
    ? `/profile/${encodeURIComponent(resolvedUsername)}`
    : '/profile';
  const webQuery = webParams.join('&');
  const webFallback = webQuery
    ? `${WEB_BASE_URL}${webPath}?${webQuery}`
    : `${WEB_BASE_URL}${webPath}`;

  return {
    callbackUrl,
    deepLink,
    webFallback,
    primaryShareUrl: Platform.OS === 'ios' ? deepLink : webFallback,
  };
};
