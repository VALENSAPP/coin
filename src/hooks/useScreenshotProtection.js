import { useCallback, useEffect, useRef } from 'react';

import {
  Alert,
  AppState,
  InteractionManager,
  NativeModules,
  Platform,
} from 'react-native';

import { useFocusEffect, useIsFocused } from '@react-navigation/native';

const WARNING_DEBOUNCE_MS = 2500;

const MAX_ENABLE_ATTEMPTS = 8;

const SCREEN_SECURE_PLATFORMS = new Set(['android', 'ios']);

const SCREEN_SECURE_ACTIVATION_PLATFORMS = new Set(['android']);

const { ScreenSecure } = NativeModules;

const setScreenSecure = enabled =>
  new Promise(resolve => {
    if (!SCREEN_SECURE_PLATFORMS.has(Platform.OS) || !ScreenSecure?.setSecure) {
      resolve(false);

      return;
    }

    ScreenSecure.setSecure(enabled)

      .then(() => resolve(true))

      .catch(() => resolve(false));
  });

const verifyScreenSecure = () =>
  new Promise(resolve => {
    if (!SCREEN_SECURE_PLATFORMS.has(Platform.OS) || !ScreenSecure?.isSecure) {
      resolve(false);

      return;
    }

    ScreenSecure.isSecure()

      .then(value => resolve(Boolean(value)))

      .catch(() => resolve(false));
  });

console.log('NativeModules =>', NativeModules);
console.log('ScreenSecure =>', NativeModules.ScreenSecure);
console.log('ScreenSecureModule =>', NativeModules.ScreenSecureModule);

const enableScreenSecureWithRetry = async () => {
  for (let attempt = 0; attempt < MAX_ENABLE_ATTEMPTS; attempt += 1) {
    const applied = await setScreenSecure(true);

    if (applied) {
      const isSecure = await verifyScreenSecure();

      if (isSecure) return true;
    }

    await new Promise(resolve => setTimeout(resolve, 80 * (attempt + 1)));
  }

  return false;
};

/**

 * Blocks screenshots while enabled and the screen is focused.

 * - Android: FLAG_SECURE on the activity window

 * - iOS: temporarily disabled; deactivation still removes any existing secure layer

 */

export default function useScreenshotProtection({
  enabled = true,
  title,
  message,
} = {}) {
  const isFocused = useIsFocused();

  const lastWarningAtRef = useRef(0);

  const secureActiveRef = useRef(false);

  const showWarning = useCallback(() => {
    if (!title || !message) return;

    const now = Date.now();

    if (now - lastWarningAtRef.current < WARNING_DEBOUNCE_MS) return;

    lastWarningAtRef.current = now;

    Alert.alert(title, message, [{ text: 'OK' }]);
  }, [title, message]);

  const deactivateProtection = useCallback(() => {
    secureActiveRef.current = false;

    if (SCREEN_SECURE_PLATFORMS.has(Platform.OS)) {
      setScreenSecure(false);
    }
  }, []);

  const activateProtection = useCallback(async () => {
    if (!SCREEN_SECURE_ACTIVATION_PLATFORMS.has(Platform.OS)) return;

    const secured = await enableScreenSecureWithRetry();

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

  useEffect(() => {
    if (
      !isFocused ||
      !enabled ||
      !SCREEN_SECURE_ACTIVATION_PLATFORMS.has(Platform.OS)
    ) {
      deactivateProtection();

      return undefined;
    }

    let cancelled = false;

    const interactionTask = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) {
        activateProtection();
      }
    });

    const appStateSubscription = AppState.addEventListener(
      'change',
      nextState => {
        if (cancelled || nextState !== 'active' || !enabled || !isFocused)
          return;

        if (secureActiveRef.current) {
          activateProtection();
        }
      },
    );

    return () => {
      cancelled = true;

      interactionTask.cancel();

      appStateSubscription.remove();

      deactivateProtection();
    };
  }, [isFocused, enabled, activateProtection, deactivateProtection]);
}
