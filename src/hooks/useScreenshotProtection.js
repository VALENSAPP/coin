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

const { ScreenSecure } = NativeModules;

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
 * Blocks screenshots on Android (FLAG_SECURE) while enabled and the screen is focused.
 */
export default function useScreenshotProtection({ enabled = true, title, message } = {}) {
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
    if (Platform.OS === 'android') {
      setAndroidSecure(false);
    }
  }, []);

  const activateProtection = useCallback(async () => {
    if (Platform.OS !== 'android') return;

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

  useEffect(() => {
    if (!isFocused || !enabled || Platform.OS === 'web') {
      deactivateProtection();
      return undefined;
    }

    let cancelled = false;

    const interactionTask = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) {
        activateProtection();
      }
    });

    const appStateSubscription = AppState.addEventListener('change', nextState => {
      if (cancelled || nextState !== 'active' || !enabled || !isFocused) return;
      if (secureActiveRef.current) {
        activateProtection();
      }
    });

    return () => {
      cancelled = true;
      interactionTask.cancel();
      appStateSubscription.remove();
      deactivateProtection();
    };
  }, [isFocused, enabled, activateProtection, deactivateProtection]);
}
