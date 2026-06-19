import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  normalTheme,
  normalDarkTheme,
} from './theme';

export const DARK_MODE_STORAGE_KEY = 'darkMode';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);

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

  const toggleDarkMode = async () => {
    const value = !isDarkMode;

    setIsDarkMode(value);

    try {
      await AsyncStorage.setItem(
        DARK_MODE_STORAGE_KEY,
        JSON.stringify(value),
      );
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
    }
  };

  const theme = isDarkMode
    ? normalDarkTheme
    : normalTheme;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDarkMode,
        toggleDarkMode,
        isThemeLoaded,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () =>
  useContext(ThemeContext);
