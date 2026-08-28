/** True when a hex color is light enough that white glyphs disappear on it. */
export const isLightColor = hex => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length === 3) {
    return isLightColor(normalized.split('').map(c => c + c).join(''));
  }
  if (normalized.length !== 6) return false;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some(n => Number.isNaN(n))) return false;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.65;
};

/** Label / icon color that stays readable on a filled button. */
export const contrastOn = background =>
  isLightColor(background) ? '#111111' : '#ffffff';

/**
 * Primary CTA colors for wallet / points screens.
 * Prefer brand accent — never theme `text` as fill (white-on-white in dark mode).
 */
export const primaryCtaColors = (accent, fallback = '#5a2d82') => {
  const backgroundColor = accent || fallback;
  return {
    backgroundColor,
    color: contrastOn(backgroundColor),
  };
};
