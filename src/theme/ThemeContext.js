import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSelector } from 'react-redux';
import {
  normalTheme,
  normalDarkTheme,
  businessTheme,
  businessDarkTheme,
} from './theme';

export const DARK_MODE_STORAGE_KEY = 'darkMode';

const ThemeContext = createContext();

const resolveProfileTheme = (profileType, isDarkMode) => {
  const isCompany = String(profileType || '').toLowerCase() === 'company';

  if (isCompany) {
    return isDarkMode ? businessDarkTheme : businessTheme;
  }

  return isDarkMode ? normalDarkTheme : normalTheme;
};

export const ThemeProvider = ({ children }) => {
  const reduxProfile = useSelector(state => state.userProfile.userProfile);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);

  const activeProfile = useMemo(() => {
    const normalized = String(reduxProfile || '').toLowerCase();
    return normalized === 'company' ? 'company' : 'user';
  }, [reduxProfile]);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const value = await AsyncStorage.getItem(DARK_MODE_STORAGE_KEY);

        if (value !== null) {
          setIsDarkMode(JSON.parse(value));
        }
      } catch (error) {
        console.warn('Failed to load theme preference:', error);
      } finally {
        setIsThemeLoaded(true);
      }
    };

    loadTheme();
  }, []);

  const toggleDarkMode = useCallback(async () => {
    const value = !isDarkMode;

    setIsDarkMode(value);

    try {
      await AsyncStorage.setItem(DARK_MODE_STORAGE_KEY, JSON.stringify(value));
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
    }
  }, [isDarkMode]);

  const theme = useMemo(
    () => resolveProfileTheme(activeProfile, isDarkMode),
    [activeProfile, isDarkMode],
  );

  const switchTheme = useCallback(profileType => {
    // Kept for API compatibility with dev branch; profile is driven by Redux.
    void profileType;
  }, []);

  const contextValue = useMemo(
    () => ({
      theme,
      isDarkMode,
      toggleDarkMode,
      isThemeLoaded,
      activeProfile,
      switchTheme,
    }),
    [theme, isDarkMode, toggleDarkMode, isThemeLoaded, activeProfile, switchTheme],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => useContext(ThemeContext);
