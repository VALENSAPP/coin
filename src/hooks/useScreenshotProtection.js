import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import {
  CaptureProtection,
  CaptureEventType,
} from 'react-native-capture-protection';

const WARNING_DEBOUNCE_MS = 2500;
const LOG_TAG = '[ScreenshotProtection]';

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
