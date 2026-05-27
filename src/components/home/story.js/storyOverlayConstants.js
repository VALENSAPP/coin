import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/** Music sticker card layout (matches export clamp size). */
export const MUSIC_STICKER_CARD_W = Math.min(280, SCREEN_WIDTH - 40);
export const MUSIC_STICKER_CARD_H = 56;

export const OVERLAY_MIN_SCALE_STICKER = 0.12;
export const OVERLAY_MIN_SCALE_TEXT = 0.12;
export const OVERLAY_MIN_SCALE_MUSIC = 0.4;
export const OVERLAY_MAX_SCALE = 3.5;

export { SCREEN_WIDTH, SCREEN_HEIGHT };

export function clampMusicBadgePosition(x, y, layout, scale = 1, bleed = {}) {
  const s = Math.min(
    OVERLAY_MAX_SCALE,
    Math.max(OVERLAY_MIN_SCALE_MUSIC, scale || 1),
  );
  const lw = layout?.width || SCREEN_WIDTH;
  const lh = layout?.height || SCREEN_HEIGHT * 0.65;
  const cardW = MUSIC_STICKER_CARD_W * s;
  const cardH = MUSIC_STICKER_CARD_H * s;
  const minX = -(bleed?.left || 0);
  const minY = -(bleed?.top || 0);
  const maxX = Math.max(minX, lw - cardW + (bleed?.right || 0));
  const maxY = Math.max(minY, lh - cardH + (bleed?.bottom || 0));
  return {
    x: Math.max(minX, Math.min(x, maxX)),
    y: Math.max(minY, Math.min(y, maxY)),
  };
}

export function defaultMusicBadgePosition(layout) {
  const lw = layout?.width || SCREEN_WIDTH;
  const lh = layout?.height || SCREEN_HEIGHT * 0.65;
  return clampMusicBadgePosition(
    (lw - MUSIC_STICKER_CARD_W) / 2,
    lh * 0.42,
    { width: lw, height: lh },
    1,
  );
}

export function pointInTrash(ax, ay, rect) {
  if (!rect || !Number.isFinite(ax) || !Number.isFinite(ay)) {
    return false;
  }
  // Delete UI is bottom-anchored. Reject full-bleed or top-placed measurements.
  if (rect.y < SCREEN_HEIGHT * 0.18) {
    return false;
  }
  // Lifting the finger in the top half of the window must not count as a drop on trash
  // (trash is always near the bottom; this blocks bogus coords + false positives).
  if (ay < SCREEN_HEIGHT * 0.5) {
    return false;
  }
  return (
    ax >= rect.x &&
    ax <= rect.x + rect.width &&
    ay >= rect.y &&
    ay <= rect.y + rect.height
  );
}

/** Show trash hint only after dragging down or moving the finger into the lower screen. */
const TRASH_HINT_MIN_DOWN_PX = 44;
const TRASH_HINT_FINGER_MIN_Y_RATIO = 0.58;

export function shouldShowTrashHint(translationY, absoluteY) {
  if (translationY > TRASH_HINT_MIN_DOWN_PX) return true;
  if (
    translationY > 12 &&
    absoluteY > SCREEN_HEIGHT * TRASH_HINT_FINGER_MIN_Y_RATIO
  ) {
    return true;
  }
  return false;
}
