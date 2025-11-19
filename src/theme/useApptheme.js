import { useThemeContext } from "./ThemeContext";

export const useAppTheme = () => {
  const { theme } = useThemeContext();

  return {
    ...theme,
    bgStyle: { backgroundColor: theme.bg },
    textStyle: { color: theme.text },
    cardStyle: { backgroundColor: theme.card },
  };
};