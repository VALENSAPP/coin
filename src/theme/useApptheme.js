import { useThemeContext } from './ThemeContext';

import {
  businessTheme,
  businessDarkTheme,
  normalTheme,
  normalDarkTheme,
} from './theme';

const resolveTheme = (profileType, isDarkMode) => {
  const normalized =
    typeof profileType === 'string' ? profileType.toLowerCase() : '';

  if (normalized === 'company') {
    return isDarkMode ? businessDarkTheme : businessTheme;
  }

  if (normalized === 'user') {
    return isDarkMode ? normalDarkTheme : normalTheme;
  }

  return null;
};

export const useAppTheme = profileTypeOverride => {
  const { isDarkMode, theme: contextTheme } = useThemeContext();

  const normalizedProfileType =
    typeof profileTypeOverride === 'string'
      ? profileTypeOverride.toLowerCase()
      : undefined;
  // Map legacy 'normal' → 'user' (dev) while keeping dark-mode resolveTheme (HEAD)
  const resolvedProfileType =
    normalizedProfileType === 'normal' ? 'user' : normalizedProfileType;

  const resolvedTheme =
    resolveTheme(resolvedProfileType, isDarkMode) ?? contextTheme;

  return {
    ...resolvedTheme,
    bgStyle: {
      backgroundColor: resolvedTheme.bg,
    },
    textStyle: {
      color: resolvedTheme.text,
    },
    cardStyle: {
      backgroundColor: resolvedTheme.card,
    },
    borderStyle: {
      borderColor: resolvedTheme.border,
    },
    mutedTextStyle: {
      color: resolvedTheme.mutedText,
    },
    accentStyle: {
      color: resolvedTheme.accent,
    },
    buttonBgStyle: {
      backgroundColor: resolvedTheme.accent,
    },
  };
};
