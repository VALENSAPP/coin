/** Shared closet form/surface theming helpers for dark + light mode. */

export const mixWithWhite = (hex, amount = 0.88) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return '#f5f3ff';
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const mix = channel => Math.round(channel + (255 - channel) * amount);
  const toHex = channel => mix(channel).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const withAlpha = (hex, alpha = 0.12) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length === 3) {
    const expanded = normalized
      .split('')
      .map(c => c + c)
      .join('');
    return withAlpha(`#${expanded}`, alpha);
  }
  if (normalized.length !== 6) return `rgba(124,58,237,${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

export const formSurfaces = isDarkMode => ({
  inputSurface: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ffffff',
  labelColor: isDarkMode ? '#ffffff' : '#3f3f46',
  inputText: isDarkMode ? '#ffffff' : '#111827',
  placeholderColor: isDarkMode ? '#9ca3af' : '#a1a1aa',
  listSurface: isDarkMode ? '#1E1E1E' : '#ffffff',
  listBorder: isDarkMode ? '#333333' : '#e5e7eb',
  itemBorder: isDarkMode ? '#333333' : '#f3f4f6',
  mutedColor: isDarkMode ? '#aaaaaa' : '#6b7280',
  iconBubble: isDarkMode ? 'rgba(255,255,255,0.12)' : '#f5f3ff',
});

export const selectedSurface = (accent, isDarkMode) =>
  isDarkMode ? withAlpha(accent, 0.22) : mixWithWhite(accent, 0.93);

/** Convenience styles for cards/rows in closet UIs. */
export const themedCard = (card, border) => ({
  backgroundColor: card || '#fff',
  borderColor: border || '#e5e7eb',
});
