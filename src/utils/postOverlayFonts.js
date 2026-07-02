import { Platform } from 'react-native';

/**
 * fontFamily values match linked .ttf filenames in src/assets/fonts
 * (synced via scripts/sync-overlay-fonts.js, linked via react-native.config.js).
 */
const LEGACY_FONT_FAMILY_ALIASES = {
  'SAlfaSlabOne-Regularystem': 'AlfaSlabOne_400Regular',
  'BitcountPropSingle_Cursive-Regular': 'Caveat_400Regular',
  'FontsFree-Net-Billabong': 'DancingScript_400Regular',
  'LibertinusMono-Regular': 'RobotoMono_400Regular',
  'OpenSans-Regular': 'OpenSans_400Regular',
  'Pacifico-Regular': 'Pacifico_400Regular',
  'PlaywriteAUQLD-Regular': 'PlaywriteAUQLD_400Regular',
  'PlaywriteHU-Regular': 'PlaywriteHU_400Regular',
  'PlaywritePL-Regular': 'PlaywritePL_400Regular',
  'Roboto-Regular': 'Roboto_400Regular',
  'Triodion-Regular': 'Triodion_400Regular',
};

/**
 * iOS uses PostScript names from the font file, not the .ttf filename.
 * Android uses the linked asset name (filename without extension).
 */
const IOS_OVERLAY_FONT_POSTSCRIPT = {
  AlfaSlabOne_400Regular: 'AlfaSlabOne-Regular',
  Caveat_400Regular: 'Caveat-Regular',
  DancingScript_400Regular: 'DancingScript-Regular',
  RobotoMono_400Regular: 'RobotoMono-Regular',
  OpenSans_400Regular: 'OpenSans-Regular',
  Pacifico_400Regular: 'Pacifico-Regular',
  PlaywriteAUQLD_400Regular: 'PlaywriteAUQLD-Regular',
  PlaywriteHU_400Regular: 'PlaywriteHU-Regular',
  PlaywritePL_400Regular: 'PlaywritePL-Regular',
  Roboto_400Regular: 'Roboto-Regular',
  Triodion_400Regular: 'Triodion-Regular',
};

export const normalizeOverlayFontFamily = fontFamily => {
  if (!fontFamily || fontFamily === 'System') return fontFamily || undefined;
  return LEGACY_FONT_FAMILY_ALIASES[fontFamily] || fontFamily;
};

/** Resolve fontFamily for the current platform (PostScript on iOS, asset name on Android). */
export const resolveOverlayFontFamilyForPlatform = fontFamily => {
  const resolved = normalizeOverlayFontFamily(fontFamily);
  if (!resolved) return undefined;
  if (Platform.OS === 'ios') {
    return IOS_OVERLAY_FONT_POSTSCRIPT[resolved] || resolved;
  }
  return resolved;
};

/** Picker list — same keys as before, backed by Google Fonts. */
export const POST_OVERLAY_FONTS = [
  { name: 'saffasbom', style: { fontFamily: 'AlfaSlabOne_400Regular' } },
  { name: 'bitcount', style: { fontFamily: 'Caveat_400Regular' } },
  { name: 'fontfree', style: { fontFamily: 'DancingScript_400Regular' } },
  { name: 'liber', style: { fontFamily: 'RobotoMono_400Regular' } },
  { name: 'opensans', style: { fontFamily: 'OpenSans_400Regular' } },
  { name: 'pacifico', style: { fontFamily: 'Pacifico_400Regular' } },
  { name: 'play1', style: { fontFamily: 'PlaywriteAUQLD_400Regular' } },
  { name: 'play2', style: { fontFamily: 'PlaywriteHU_400Regular' } },
  { name: 'play3', style: { fontFamily: 'PlaywritePL_400Regular' } },
  { name: 'roboto', style: { fontFamily: 'Roboto_400Regular' } },
  { name: 'tridon', style: { fontFamily: 'Triodion_400Regular' } },
];

export const STORY_COMPOSER_FONTS = [
  { name: 'System', style: {} },
  ...POST_OVERLAY_FONTS.filter(f =>
    ['fontfree', 'roboto', 'pacifico', 'play1', 'play2', 'play3', 'tridon'].includes(f.name),
  ).map(f => ({
    name: f.name === 'fontfree' ? 'Script' : f.name,
    style: f.style,
  })),
];

export const isSameOverlayFontStyle = (left, right) =>
  normalizeOverlayFontFamily(left?.fontFamily || '') ===
  normalizeOverlayFontFamily(right?.fontFamily || '');

export const getOverlayFontTextStyle = fontFamily => {
  const family = resolveOverlayFontFamilyForPlatform(fontFamily);
  if (!family) return {};
  return {
    fontFamily: family,
    fontWeight: 'normal',
    fontStyle: 'normal',
  };
};
