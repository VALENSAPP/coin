import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  MUSIC_STICKER_CARD_W,
  MUSIC_STICKER_CARD_H,
  defaultMusicBadgePosition,
} from '../home/story.js/storyOverlayConstants';
import {
  getOverlayFontTextStyle,
  normalizeOverlayFontFamily,
} from '../../utils/postOverlayFonts';

const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

export function containsEmoji(value) {
  return EMOJI_REGEX.test(String(value || ''));
}

export function resolveOverlayFontFamily(value, requestedFontFamily) {
  if (containsEmoji(value)) return undefined;
  return normalizeOverlayFontFamily(requestedFontFamily) || undefined;
}

export function getTextStyleWithFont(value, requestedFontFamily) {
  const resolvedFontFamily = resolveOverlayFontFamily(value, requestedFontFamily);
  return getOverlayFontTextStyle(resolvedFontFamily);
}

export function getOverlayScaleFactors(width, height, canvasWidth, canvasHeight) {
  const sourceWidth = Number(canvasWidth) > 0 ? Number(canvasWidth) : width;
  const sourceHeight = Number(canvasHeight) > 0 ? Number(canvasHeight) : height;
  return {
    scaleX: width / sourceWidth,
    scaleY: height / sourceHeight,
  };
}

export const POST_TEXT_OVERLAY_EDGE_PADDING = 24;
const MIN_TEXT_FONT_SIZE = 10;
const MAX_TEXT_FONT_SIZE = 140;

/** Upper bound before text wraps — full canvas width, not tied to sticker position. */
export function getPostTextOverlayCanvasMaxWidth(canvasWidth) {
  const baseWidth = Number(canvasWidth) > 0 ? Number(canvasWidth) : 390;
  return Math.max(80, baseWidth - POST_TEXT_OVERLAY_EDGE_PADDING * 2);
}

/** Font size used for layout/wrapping (pinch scale is baked into fontSize, not transform). */
export function getPostTextOverlayEffectiveFontSize(overlay, extraMultiplier = 1) {
  const base = Number(overlay?.fontSize) || 28;
  const scale = Number(overlay?.scale ?? 1) || 1;
  return Math.min(
    MAX_TEXT_FONT_SIZE,
    Math.max(MIN_TEXT_FONT_SIZE, base * scale * (Number(extraMultiplier) || 1)),
  );
}

/** Bake pinch `scale` into `fontSize` so wrapping matches the visible size (Instagram-style). */
export function normalizePostTextOverlayForDisplay(overlay) {
  if (!overlay || typeof overlay !== 'object') return overlay;
  const scale = Number(overlay.scale ?? 1) || 1;
  if (Math.abs(scale - 1) < 0.02) return overlay;
  return {
    ...overlay,
    fontSize: getPostTextOverlayEffectiveFontSize(overlay),
    scale: 1,
  };
}

/** @deprecated Use getPostTextOverlayCanvasMaxWidth — kept for callers passing scale/position. */
export function getPostTextOverlayMaxWidth(canvasWidth, overlayScale = 1, positionX = null) {
  return getPostTextOverlayCanvasMaxWidth(canvasWidth);
}

export function getPostTextOverlayBounds(
  canvasWidth,
  canvasHeight,
  footprint,
  padding = POST_TEXT_OVERLAY_EDGE_PADDING,
) {
  const width = Number(canvasWidth) > 0 ? Number(canvasWidth) : 390;
  const height = Number(canvasHeight) > 0 ? Number(canvasHeight) : width;
  const fw = Math.max(1, Number(footprint?.width) || 1);
  const fh = Math.max(1, Number(footprint?.height) || 1);
  return {
    minX: padding,
    minY: padding,
    maxX: Math.max(padding, width - fw - padding),
    maxY: Math.max(padding, height - fh - padding),
  };
}

/**
 * Drag bounds for positioned text stickers. Allows partial off-screen bleed when zoomed
 * so large text can still be moved back into frame (Instagram-style).
 */
export function getPostTextOverlayDragBounds(
  canvasWidth,
  canvasHeight,
  layoutFootprint,
  scale = 1,
  { minVisibleFraction = 0.22, padding = POST_TEXT_OVERLAY_EDGE_PADDING } = {},
) {
  const width = Number(canvasWidth) > 0 ? Number(canvasWidth) : 390;
  const height = Number(canvasHeight) > 0 ? Number(canvasHeight) : width;
  const layoutW = Math.max(1, Number(layoutFootprint?.width) || 1);
  const layoutH = Math.max(1, Number(layoutFootprint?.height) || 1);
  const safeScale = Math.max(0.2, Number(scale) || 1);
  const visualW = layoutW * safeScale;
  const visualH = layoutH * safeScale;
  const keep = Math.min(0.45, Math.max(0.12, minVisibleFraction));

  const rawMinX = padding - visualW * (1 - keep);
  const rawMaxX = width - padding - visualW * keep;
  const rawMinY = padding - visualH * (1 - keep);
  const rawMaxY = height - padding - visualH * keep;

  return {
    minX: Math.min(rawMinX, rawMaxX),
    maxX: Math.max(rawMinX, rawMaxX),
    minY: Math.min(rawMinY, rawMaxY),
    maxY: Math.max(rawMinY, rawMaxY),
  };
}

export function clampPostTextOverlayPosition(position, bounds) {
  const x = Number(position?.x) || 0;
  const y = Number(position?.y) || 0;
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, y)),
  };
}

export function estimatePostTextOverlayFootprint(overlay, canvasWidth) {
  const fontSize = getPostTextOverlayEffectiveFontSize(overlay);
  const lines = String(overlay?.text || '').split('\n');
  const longestLineLength =
    lines.reduce((longest, line) => Math.max(longest, Array.from(line).length), 0) || 1;
  const emojiHeavy = containsEmoji(overlay?.text) && longestLineLength <= 4;
  const maxLineWidth = getPostTextOverlayCanvasMaxWidth(canvasWidth);
  const charWidth = emojiHeavy ? fontSize * 0.95 : fontSize * 0.55;
  const naturalWidth = Math.min(maxLineWidth, longestLineLength * charWidth + 24);
  const baseWidth = Math.max(fontSize + 24, naturalWidth);
  const wrappedLines = Math.max(
    1,
    lines.length,
    Math.ceil((longestLineLength * charWidth + 24) / maxLineWidth),
  );
  const baseHeight = Math.max(fontSize + 14, wrappedLines * fontSize * 1.2 + 14);
  return { width: baseWidth, height: baseHeight };
}

export function buildPostTextOverlayTextStyle(
  overlay,
  { canvasWidth, fontSizeMultiplier = 1, livePinchScale = 1 } = {},
) {
  const fontSize = getPostTextOverlayEffectiveFontSize(overlay, fontSizeMultiplier * livePinchScale);
  return {
    ...getTextStyleWithFont(overlay?.text, overlay?.fontFamily),
    ...(overlay?.fontWeight ? { fontWeight: overlay.fontWeight } : {}),
    fontSize,
    color: overlay?.color || '#fff',
    textAlign: overlay?.textAlign || 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    maxWidth: getPostTextOverlayCanvasMaxWidth(canvasWidth),
  };
}

export const postTextOverlayBubbleStyle = {
  alignSelf: 'flex-start',
  padding: 4,
  borderRadius: 4,
};

function normalizeOverlays(overlays) {
  return Array.isArray(overlays) ? overlays.filter(Boolean) : [];
}

function PostMusicStickerCard({ title, artist, thumbnailUrl }) {
  return (
    <View style={styles.musicStickerCard}>
      {thumbnailUrl ? (
        <Image source={{ uri: thumbnailUrl }} style={styles.musicStickerArt} />
      ) : (
        <View style={styles.musicStickerArtPlaceholder}>
          <Icon name="musical-notes" size={22} color="#8e8e93" />
        </View>
      )}
      <View style={styles.musicStickerTexts}>
        <Text style={styles.musicStickerTitle} numberOfLines={1}>
          {title || 'Music'}
        </Text>
        <Text style={styles.musicStickerArtist} numberOfLines={1}>
          {artist || ' '}
        </Text>
      </View>
    </View>
  );
}

export default function PostMediaTextOverlays({
  textOverlays = [],
  overlayImages = [],
  musicSticker = null,
  width,
  height,
  canvasWidth,
  canvasHeight,
  pointerEvents = 'none',
}) {
  const texts = normalizeOverlays(textOverlays);
  const images = normalizeOverlays(overlayImages);
  if (!texts.length && !images.length && !musicSticker) return null;

  const { scaleX, scaleY } = getOverlayScaleFactors(width, height, canvasWidth, canvasHeight);
  const fontScale = Math.min(scaleX, scaleY);

  const sourceWidth = Number(canvasWidth) > 0 ? Number(canvasWidth) : width;
  const sourceHeight = Number(canvasHeight) > 0 ? Number(canvasHeight) : height;
  const defaultBadge = defaultMusicBadgePosition({
    width: sourceWidth,
    height: sourceHeight,
  });
  const badge = musicSticker?.badge || defaultBadge;
  const resolvedX =
    badge?.x != null && Number.isFinite(Number(badge.x)) ? Number(badge.x) : defaultBadge.x;
  const resolvedY =
    badge?.y != null && Number.isFinite(Number(badge.y)) ? Number(badge.y) : defaultBadge.y;
  const musicX = resolvedX * scaleX;
  const musicY = resolvedY * scaleY;
  const musicScale = (Number(badge?.scale) ?? 1) * fontScale;
  const musicRotation = Number(badge?.rotation ?? 0) || 0;

  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]} pointerEvents={pointerEvents}>
      {musicSticker ? (
        <View
          style={[
            styles.musicStickerWrap,
            {
              left: musicX,
              top: musicY,
              transform: [{ scale: musicScale }, { rotate: `${musicRotation}rad` }],
            },
          ]}
        >
          <PostMusicStickerCard
            title={musicSticker.title}
            artist={musicSticker.artist}
            thumbnailUrl={musicSticker.thumbnailUrl}
          />
        </View>
      ) : null}

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
        const rotation = Number(overlay.rotation ?? 0) || 0;
        const displayOverlay = normalizePostTextOverlayForDisplay(overlay);
        return (
          <View
            key={overlay.id || overlay.text}
            style={[
              styles.textWrap,
              {
                left: x,
                top: y,
                backgroundColor: displayOverlay.highlightColor || 'transparent',
                transform: [{ rotate: `${rotation}rad` }],
              },
            ]}
          >
            <Text
              style={buildPostTextOverlayTextStyle(displayOverlay, {
                canvasWidth: sourceWidth,
                fontSizeMultiplier: fontScale,
              })}
            >
              {displayOverlay.text}
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
  musicStickerWrap: {
    position: 'absolute',
    zIndex: 24,
  },
  musicStickerCard: {
    width: MUSIC_STICKER_CARD_W,
    minHeight: MUSIC_STICKER_CARD_H,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
  musicStickerArt: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  musicStickerArtPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f2f2f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  musicStickerTexts: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0,
    justifyContent: 'center',
  },
  musicStickerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
  },
  musicStickerArtist: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8e8e93',
    marginTop: 2,
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
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
});
