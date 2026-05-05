import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ Supported languages
const languages = ['en', 'pt', 'it', 'es', 'fr'];

const languageNames = {
  en: 'English',
  pt: 'Português',
  it: 'Italiano',
  es: 'Español',
  fr: 'Français'
};

// ✅ Import translations
import en from './en.json';
import pt from './pt.json';
import it from './it.json';
import es from './es.json';
import fr from './fr.json';

// ✅ All translations
const allTranslations = {
  en,
  pt,
  it,
  es,
  fr
};

// ✅ Helper: get nested value (important)
const getValueByPath = (obj, path) => {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
};

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [translations, setTranslations] = useState(en);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ Init language
  useEffect(() => {
    const initLanguage = async () => {
      try {
        const savedLang = await AsyncStorage.getItem('language');
        const lang = languages.includes(savedLang) ? savedLang : 'en';

        setCurrentLanguage(lang);
        setTranslations(allTranslations[lang] || en);
      } catch (error) {
        console.warn('Language init error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initLanguage();
  }, []);

  // ✅ Change language
  const changeLanguage = async (lang) => {
    if (!languages.includes(lang)) return;

    try {
      setIsLoading(true);

      await AsyncStorage.setItem('language', lang);
      setCurrentLanguage(lang);
      setTranslations(allTranslations[lang] || en);
    } catch (error) {
      console.warn('Change language error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Translation function (FINAL)
  const t = (key, defaultValue = '') => {
    // 1. Try current language
    const value = getValueByPath(translations, key);

    if (value !== undefined && value !== null && value !== '') {
      return value;
    }

    // 2. Fallback to English
    const fallbackValue = getValueByPath(en, key);

    if (fallbackValue !== undefined && fallbackValue !== null) {
      console.warn(`Missing "${key}" in ${currentLanguage}, using EN fallback`);
      return fallbackValue;
    }

    // 3. Final fallback
    console.warn(`Missing "${key}" in ALL languages`);

    return defaultValue || key;
  };

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        languageNames,
        languages,
        changeLanguage,
        t,
        isLoading
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

// ✅ Hook
export const useLanguage = () => {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }

  return context;
};