import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import {
  CaptureProtection,
  CaptureEventType,
} from 'react-native-capture-protection';

const WARNING_DEBOUNCE_MS = 2500;
const LOG_TAG = '[ScreenshotProtection]';

export const SCREENSHOT_PROTECTED_SOURCES = {
  PRIVATE_CONTENT: 'private_content',
  PRIVATE_CIRCLE: 'private_circle',
};

export const isPrivateCirclePost = post => {
  if (!post || typeof post !== 'object') return false;
  const visibleTo = post.visibleTo ?? post.visible_to;
  return Boolean(visibleTo && String(visibleTo).trim() !== '');
};

export const isPrivateContentPost = post => {
  if (!post || typeof post !== 'object') return false;
  if (isPrivateCirclePost(post)) return false;

  const type = String(
    post.postType ?? post.post_type ?? post.type ?? '',
  ).toLowerCase();

  return type === 'private';
};

export const shouldProtectScreenshot = ({ posts = [], routeParams = {} } = {}) => {
  const source =
    routeParams.screenshotProtectionSource ?? routeParams.contentProtection;

  if (
    source === SCREENSHOT_PROTECTED_SOURCES.PRIVATE_CONTENT ||
    source === SCREENSHOT_PROTECTED_SOURCES.PRIVATE_CIRCLE
  ) {
    return true;
  }

  const normalizedPosts = Array.isArray(posts) ? posts.filter(Boolean) : [];
  if (normalizedPosts.length === 0) return false;

  return normalizedPosts.some(
    post => isPrivateCirclePost(post) || isPrivateContentPost(post),
  );
};

const captureEventLabel = eventType => {
  switch (eventType) {
    case CaptureEventType.CAPTURED:
      return 'screenshot';
    case CaptureEventType.RECORDING:
      return 'screen recording';
    case CaptureEventType.END_RECORDING:
      return 'recording ended';
    case CaptureEventType.APP_SWITCHING:
      return 'app switcher';
    default:
      return `event(${eventType})`;
  }
};

let protectionRefCount = 0;

const acquireProtection = async () => {
  protectionRefCount += 1;
  if (protectionRefCount === 1) {
    await CaptureProtection.prevent({
      screenshot: true,
      record: true,
      appSwitcher: true,
    });
    console.log(`${LOG_TAG} Restricted screenshot — protection enabled`);
  } else {
    console.log(`${LOG_TAG} Restricted screenshot — refCount: ${protectionRefCount}`);
  }
};

const releaseProtection = async () => {
  protectionRefCount = Math.max(0, protectionRefCount - 1);
  if (protectionRefCount === 0) {
    await CaptureProtection.allow();
    console.log(`${LOG_TAG} Screenshot allowed — protection disabled`);
  } else {
    console.log(`${LOG_TAG} Screenshot still restricted — refCount: ${protectionRefCount}`);
  }
};

/**
 * Enables native capture protection via react-native-capture-protection.
 * No overlay required — iOS and Android handle blocking at the OS level.
 */
export default function useScreenshotProtection({
  enabled = true,
  title,
  message,
} = {}) {
  const isFocused = useIsFocused();
  const lastWarningAtRef = useRef(0);
  const isActiveRef = useRef(false);

  const showWarning = useCallback(() => {
    if (!title || !message) return;

    const now = Date.now();
    if (now - lastWarningAtRef.current < WARNING_DEBOUNCE_MS) return;
    lastWarningAtRef.current = now;

    Alert.alert(title, message, [{ text: 'OK' }]);
  }, [title, message]);

  const deactivateProtection = useCallback(() => {
    if (!isActiveRef.current) return;
    isActiveRef.current = false;
    releaseProtection();
  }, []);

  const activateProtection = useCallback(async () => {
    if (isActiveRef.current) return;

    try {
      await acquireProtection();
      isActiveRef.current = true;
      const status = await CaptureProtection.protectionStatus();
      console.log(`${LOG_TAG} Protection status:`, status);
    } catch (error) {
      isActiveRef.current = false;
      console.warn(`${LOG_TAG} Failed to enable protection:`, error);
      showWarning();
    }
  }, [showWarning]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        deactivateProtection();
      };
    }, [deactivateProtection]),
  );

  useEffect(() => {
    const shouldProtect = isFocused && enabled;

    if (!shouldProtect) {
      deactivateProtection();
      return undefined;
    }

    let cancelled = false;

    activateProtection().then(() => {
      if (cancelled) {
        deactivateProtection();
      }
    });

    return () => {
      cancelled = true;
      deactivateProtection();
    };
  }, [isFocused, enabled, activateProtection, deactivateProtection]);

  useEffect(() => {
    if (!enabled) return undefined;

    const subscription = CaptureProtection.addListener(eventType => {
      if (eventType < CaptureEventType.ALLOW) {
        console.log(
          `${LOG_TAG} Capture detected: ${captureEventLabel(eventType)}`,
        );
      }

      if (
        eventType === CaptureEventType.CAPTURED ||
        eventType === CaptureEventType.RECORDING
      ) {
        showWarning();
      }
    });

    return () => {
      subscription?.remove?.();
    };
  }, [enabled, showWarning]);
}
