import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

export function containsEmoji(value) {
  return EMOJI_REGEX.test(String(value || ''));
}

export function resolveOverlayFontFamily(value, requestedFontFamily) {
  return containsEmoji(value) ? undefined : requestedFontFamily || undefined;
}

export function getTextStyleWithFont(value, requestedFontFamily) {
  const resolvedFontFamily = resolveOverlayFontFamily(value, requestedFontFamily);
  return resolvedFontFamily ? { fontFamily: resolvedFontFamily } : {};
}

export function getOverlayScaleFactors(width, height, canvasWidth, canvasHeight) {
  const sourceWidth = Number(canvasWidth) > 0 ? Number(canvasWidth) : width;
  const sourceHeight = Number(canvasHeight) > 0 ? Number(canvasHeight) : height;
  return {
    scaleX: width / sourceWidth,
    scaleY: height / sourceHeight,
  };
}

function normalizeOverlays(overlays) {
  return Array.isArray(overlays) ? overlays.filter(Boolean) : [];
}

export default function PostMediaTextOverlays({
  textOverlays = [],
  overlayImages = [],
  width,
  height,
  canvasWidth,
  canvasHeight,
  pointerEvents = 'none',
}) {
  const texts = normalizeOverlays(textOverlays);
  const images = normalizeOverlays(overlayImages);
  if (!texts.length && !images.length) return null;

  const { scaleX, scaleY } = getOverlayScaleFactors(width, height, canvasWidth, canvasHeight);
  const fontScale = Math.min(scaleX, scaleY);

  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]} pointerEvents={pointerEvents}>
      {images.map(img => {
        const baseSize = (Number(img.baseSize) || 100) * fontScale;
        const x = (Number(img.position?.x) || 0) * scaleX;
        const y = (Number(img.position?.y) || 0) * scaleY;
        const scale = Number(img.scale ?? 1) || 1;
        const rotation = Number(img.rotation ?? 0) || 0;
        return (
          <View
            key={img.id || img.uri}
            style={[
              styles.overlayImageWrap,
              {
                width: baseSize,
                height: baseSize,
                left: x,
                top: y,
                transform: [{ scale }, { rotate: `${rotation}rad` }],
              },
            ]}
          >
            <Image source={{ uri: img.uri }} style={styles.overlayImage} resizeMode="contain" />
          </View>
        );
      })}

      {texts.map(overlay => {
        const x = (Number(overlay.position?.x) || 0) * scaleX;
        const y = (Number(overlay.position?.y) || 0) * scaleY;
        const scale = Number(overlay.scale ?? 1) || 1;
        const rotation = Number(overlay.rotation ?? 0) || 0;
        const fontSize = (Number(overlay.fontSize) || 28) * fontScale;
        return (
          <View
            key={overlay.id || overlay.text}
            style={[
              styles.textWrap,
              {
                left: x,
                top: y,
                backgroundColor: overlay.highlightColor || 'transparent',
                transform: [{ scale }, { rotate: `${rotation}rad` }],
              },
            ]}
          >
            <Text
              style={[
                getTextStyleWithFont(overlay.text, overlay.fontFamily),
                {
                  fontSize,
                  color: overlay.color || '#fff',
                  textAlign: overlay.textAlign || 'center',
                  textShadowColor: 'rgba(0,0,0,0.8)',
                  textShadowOffset: { width: 1, height: 1 },
                  textShadowRadius: 3,
                  maxWidth: 220 * fontScale,
                },
              ]}
              numberOfLines={3}
            >
              {overlay.text}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    zIndex: 20,
    elevation: 20,
  },
  overlayImageWrap: {
    position: 'absolute',
    zIndex: 21,
  },
  overlayImage: {
    width: '100%',
    height: '100%',
  },
  textWrap: {
    position: 'absolute',
    zIndex: 22,
    padding: 4,
    borderRadius: 4,
  },
});
