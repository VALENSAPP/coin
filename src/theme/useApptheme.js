import { useThemeContext } from "./ThemeContext";
import { businessTheme, normalTheme } from "./theme";

export const useAppTheme = (profileTypeOverride) => {
  const { theme } = useThemeContext();
  const normalizedProfileType =
    typeof profileTypeOverride === 'string'
      ? profileTypeOverride.toLowerCase()
      : undefined;
  const resolvedProfileType =
    normalizedProfileType === 'normal' ? 'user' : normalizedProfileType;
  const resolvedTheme =
    resolvedProfileType === 'company'
      ? businessTheme
      : resolvedProfileType === 'user'
        ? normalTheme
        : theme;

  return {
    ...resolvedTheme,
    bgStyle: { backgroundColor: resolvedTheme.bg },
    textStyle: { color: resolvedTheme.text },
    cardStyle: { backgroundColor: resolvedTheme.card },
  };
};
