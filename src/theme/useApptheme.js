import { useThemeContext } from "./ThemeContext";
import { businessTheme, normalTheme } from "./theme";

export const useAppTheme = (profileTypeOverride) => {
  const { theme } = useThemeContext();
  const normalizedProfileType =
    typeof profileTypeOverride === 'string'
      ? profileTypeOverride.toLowerCase()
      : undefined;
  const resolvedTheme =
    normalizedProfileType === 'company'
      ? businessTheme
      : normalizedProfileType === 'user'
        ? normalTheme
        : theme;

  return {
    ...resolvedTheme,
    bgStyle: { backgroundColor: resolvedTheme.bg },
    textStyle: { color: resolvedTheme.text },
    cardStyle: { backgroundColor: resolvedTheme.card },
  };
};
