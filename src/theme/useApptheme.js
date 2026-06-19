import { useThemeContext } from './ThemeContext';

import {
  businessTheme,
  businessDarkTheme,
  normalTheme,
  normalDarkTheme,
} from './theme';

export const useAppTheme = (profileTypeOverride) => {
  const { isDarkMode } = useThemeContext();

  const normalizedProfileType =
    typeof profileTypeOverride === 'string'
      ? profileTypeOverride.toLowerCase()
      : undefined;

  let resolvedTheme;

  if (normalizedProfileType === 'company') {
    resolvedTheme = isDarkMode
      ? businessDarkTheme
      : businessTheme;
  } else {
    resolvedTheme = isDarkMode
      ? normalDarkTheme
      : normalTheme;
  }

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
  };
};