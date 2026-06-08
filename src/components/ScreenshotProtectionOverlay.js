import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

/**
 * Covers sensitive UI on iOS when the app is inactive (screenshot / app switcher).
 * Uses an opaque fallback layer (no extra native blur dependency).
 */
export default function ScreenshotProtectionOverlay({ visible }) {
  if (!visible || Platform.OS !== 'ios') {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={styles.overlay}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    zIndex: 9999,
    elevation: 9999,
  },
});
