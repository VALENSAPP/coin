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

const resolveOwnerId = (...candidates) => {
  for (const candidate of candidates) {
    if (candidate == null || candidate === '') continue;

    if (typeof candidate === 'string' || typeof candidate === 'number') {
      const id = String(candidate).trim();
      if (id) return id;
      continue;
    }

    if (typeof candidate === 'object') {
      const id =
        candidate.id ??
        candidate._id ??
        candidate.userId ??
        candidate.UserId;
      if (id != null && String(id).trim()) return String(id);
    }
  }

  return '';
};

const isSameUser = (leftUserId, rightUserId) => {
  const left = String(leftUserId || '').trim();
  const right = String(rightUserId || '').trim();
  return Boolean(left && right && left === right);
};

const resolvePostOwnerId = post =>
  resolveOwnerId(post?.userId, post?.UserId, post?.user);

export const shouldProtectScreenshot = ({
  posts = [],
  routeParams = {},
  currentUserId = '',
  contentUserId = '',
} = {}) => {
  const normalizedCurrentUserId = String(currentUserId || '').trim();
  const normalizedPosts = Array.isArray(posts) ? posts.filter(Boolean) : [];

  const source =
    routeParams.screenshotProtectionSource ?? routeParams.contentProtection;

  const isRestrictedSource =
    source === SCREENSHOT_PROTECTED_SOURCES.PRIVATE_CONTENT ||
    source === SCREENSHOT_PROTECTED_SOURCES.PRIVATE_CIRCLE;

  const privatePosts = normalizedPosts.filter(
    post => isPrivateCirclePost(post) || isPrivateContentPost(post),
  );

  const hasRestrictedContent = isRestrictedSource || privatePosts.length > 0;
  if (!hasRestrictedContent) return false;

  const contentOwnerId = resolveOwnerId(
    contentUserId,
    routeParams.userId,
    routeParams.userData?.id,
    routeParams.userData?.userId,
  );

  if (isSameUser(normalizedCurrentUserId, contentOwnerId)) {
    return false;
  }

  if (privatePosts.length > 0) {
    if (!normalizedCurrentUserId) return true;

    return privatePosts.some(
      post => !isSameUser(normalizedCurrentUserId, resolvePostOwnerId(post)),
    );
  }

  return isRestrictedSource;
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
  holdProtection = false,
  title,
  message,
} = {}) {
  const isFocused = useIsFocused();
  const lastWarningAtRef = useRef(0);
  const isActiveRef = useRef(false);
  const shouldProtect = (isFocused || holdProtection) && enabled;

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
  }, [shouldProtect, activateProtection, deactivateProtection]);

  useEffect(() => {
    if (!shouldProtect) return undefined;

    const subscription = CaptureProtection.addListener(eventType => {
      if (!isActiveRef.current) return;

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
  }, [shouldProtect, showWarning]);
}
