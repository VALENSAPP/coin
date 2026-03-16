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

export const buildProfileSharePayload = ({ username = '', userId = '' } = {}) => {
  const resolvedUsername = String(username || '').trim();
  const urls = buildProfileShareUrls({ username, userId });
  const profileLabel = resolvedUsername ? `@${resolvedUsername}` : 'this profile';

  return {
    ...urls,
    shareMessage: [
      `Check out ${profileLabel} on Valens.`,
      '',
      urls.primaryShareUrl,
    ].join('\n'),
  };
};

export const normalizeProfileShareUrl = (rawUrl = '') => String(rawUrl || '')
  .trim()
  .replace(/^com\.valens:\/\//i, `${WEB_BASE_URL}/`)
  .replace(/^valens:\/\//i, `${WEB_BASE_URL}/`);

export const parseProfileShareUrl = (rawUrl = '') => {
  const normalizedUrl = normalizeProfileShareUrl(rawUrl);

  if (!normalizedUrl) {
    return null;
  }

  try {
    const urlObj = new URL(normalizedUrl);
    const pathSegments = String(urlObj.pathname || '').split('/').filter(Boolean);

    if (String(pathSegments[0] || '').toLowerCase() !== 'profile') {
      return null;
    }

    const pathUsername = decodeURIComponent(pathSegments[1] || '')
      .replace(/^@+/, '')
      .trim();
    const queryUsername = decodeURIComponent(
      String(urlObj.searchParams.get('username') || ''),
    )
      .replace(/^@+/, '')
      .trim();
    const userId = String(urlObj.searchParams.get('userId') || '').trim();

    return {
      normalizedUrl,
      path: urlObj.pathname,
      userId,
      username: queryUsername || pathUsername,
      callbackUrl: String(urlObj.searchParams.get('callbackUrl') || '').trim(),
    };
  } catch (error) {
    return null;
  }
};
