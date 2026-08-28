/**
 * Shared gradient + surface helpers for wallet drawer screens in light/dark mode.
 */
export function getWalletScreenGradient(isBusinessProfile, isDarkMode, accent, card) {
  if (isDarkMode) {
    return isBusinessProfile
      ? ['#3d3428', card || '#1E1E1E']
      : [accent || '#4a2d7a', '#1a1228'];
  }
  return isBusinessProfile
    ? ['#D3B683', '#fdfcfa']
    : ['#513189', '#f8f2fd'];
}

export function getWalletIllustrationGradient(isDarkMode, accent) {
  if (isDarkMode) {
    return [accent || '#5a2d82', '#2a1a45'];
  }
  return ['#5F348D', '#9A68D2'];
}

/** Text/icons on gradient cards — brand color always for business; white on personal dark gradients for contrast. */
export function getWalletGradientText(isBusinessProfile, isDarkMode, text) {
  if (isDarkMode && !isBusinessProfile) return '#ffffff';
  return text;
}

/** Icon bubble on gradient KPI / header cards */
export function getWalletGradientIconWrapStyle(isBusinessProfile, isDarkMode, accent) {
  if (isDarkMode) {
    if (isBusinessProfile) {
      return {
        backgroundColor: `${accent}55`,
        borderColor: accent,
      };
    }
    return {
      backgroundColor: `${accent}33`,
      borderColor: `${accent}55`,
    };
  }
  return {
    backgroundColor: '#D3D3D3',
    borderColor: '#D3D3D3',
  };
}
