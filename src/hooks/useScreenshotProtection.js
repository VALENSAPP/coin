import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  InteractionManager,
  NativeEventEmitter,
  NativeModules,
  Platform,
} from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';

const WARNING_DEBOUNCE_MS = 2500;
const MAX_ENABLE_ATTEMPTS = 8;
const IOS_BLUR_FLASH_MS = 1200;

const { ScreenSecure } = NativeModules;

const screenSecureEmitter =
  Platform.OS === 'ios' && ScreenSecure
    ? new NativeEventEmitter(ScreenSecure)
    : null;

const setAndroidSecure = enabled =>
  new Promise(resolve => {
    if (Platform.OS !== 'android' || !ScreenSecure?.setSecure) {
      resolve(false);
      return;
    }

    ScreenSecure.setSecure(enabled)
      .then(() => resolve(true))
      .catch(() => resolve(false));
  });

const verifyAndroidSecure = () =>
  new Promise(resolve => {
    if (Platform.OS !== 'android' || !ScreenSecure?.isSecure) {
      resolve(false);
      return;
    }

    ScreenSecure.isSecure()
      .then(value => resolve(Boolean(value)))
      .catch(() => resolve(false));
  });

const enableAndroidSecureWithRetry = async () => {
  for (let attempt = 0; attempt < MAX_ENABLE_ATTEMPTS; attempt += 1) {
    const applied = await setAndroidSecure(true);
    if (applied) {
      const isSecure = await verifyAndroidSecure();
      if (isSecure) return true;
    }
    await new Promise(resolve => setTimeout(resolve, 80 * (attempt + 1)));
  }
  return false;
};

/**
 * Protects sensitive screens from capture.
 * - Android: FLAG_SECURE while enabled and focused
 * - iOS: blur overlay when inactive + on screenshot + warning alert
 */
export default function useScreenshotProtection({
  enabled = true,
  title,
  message,
} = {}) {
  const isFocused = useIsFocused();
  const lastWarningAtRef = useRef(0);
  const secureActiveRef = useRef(false);
  const blurFlashTimeoutRef = useRef(null);
  const [shouldBlur, setShouldBlur] = useState(false);

  const showBlurFlash = useCallback(() => {
    setShouldBlur(true);
    if (blurFlashTimeoutRef.current) {
      clearTimeout(blurFlashTimeoutRef.current);
    }
    blurFlashTimeoutRef.current = setTimeout(() => {
      blurFlashTimeoutRef.current = null;
      if (AppState.currentState === 'active') {
        setShouldBlur(false);
      }
    }, IOS_BLUR_FLASH_MS);
  }, []);

  const showWarning = useCallback(() => {
    if (!title || !message) return;

    const now = Date.now();
    if (now - lastWarningAtRef.current < WARNING_DEBOUNCE_MS) return;
    lastWarningAtRef.current = now;

    Alert.alert(title, message, [{ text: 'OK' }]);
  }, [title, message]);

  const deactivateProtection = useCallback(() => {
    secureActiveRef.current = false;
    if (Platform.OS === 'android') {
      setAndroidSecure(false);
    }
    if (blurFlashTimeoutRef.current) {
      clearTimeout(blurFlashTimeoutRef.current);
      blurFlashTimeoutRef.current = null;
    }
    setShouldBlur(false);
  }, []);

  const activateAndroidProtection = useCallback(async () => {
    const secured = await enableAndroidSecureWithRetry();
    secureActiveRef.current = secured;
    if (!secured) {
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

  // Android: FLAG_SECURE
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    if (!isFocused || !enabled) {
      deactivateProtection();
      return undefined;
    }

    let cancelled = false;

    const interactionTask = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) {
        activateAndroidProtection();
      }
    });

    const appStateSubscription = AppState.addEventListener('change', nextState => {
      if (cancelled || nextState !== 'active' || !enabled || !isFocused) return;
      if (secureActiveRef.current) {
        activateAndroidProtection();
      }
    });

    return () => {
      cancelled = true;
      interactionTask.cancel();
      appStateSubscription.remove();
      deactivateProtection();
    };
  }, [
    isFocused,
    enabled,
    activateAndroidProtection,
    deactivateProtection,
  ]);

  // iOS: blur when app goes inactive (screenshot / app switcher) + screenshot alert
  useEffect(() => {
    if (Platform.OS !== 'ios' || !enabled || !isFocused) {
      setShouldBlur(false);
      return undefined;
    }

    const appStateSubscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        if (!blurFlashTimeoutRef.current) {
          setShouldBlur(false);
        }
        return;
      }

      if (nextState === 'inactive' || nextState === 'background') {
        setShouldBlur(true);
      }
    });

    const screenshotSubscription = screenSecureEmitter?.addListener(
      'UserDidTakeScreenshot',
      () => {
        showBlurFlash();
        showWarning();
      },
    );

    return () => {
      appStateSubscription.remove();
      screenshotSubscription?.remove();
      if (blurFlashTimeoutRef.current) {
        clearTimeout(blurFlashTimeoutRef.current);
        blurFlashTimeoutRef.current = null;
      }
      setShouldBlur(false);
    };
  }, [isFocused, enabled, showBlurFlash, showWarning]);

  return { shouldBlur };
}
