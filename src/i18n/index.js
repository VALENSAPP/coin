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

const interpolate = (value, options = {}) => {
  if (typeof value !== 'string') return value;

  return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) => {
    const replacement = options[name];
    return replacement !== undefined && replacement !== null ? String(replacement) : match;
  });
};

const getTranslationValue = (source, key, options = {}) => {
  if (options.count !== undefined && options.count !== null) {
    const pluralKey = Number(options.count) === 1 ? `${key}_one` : `${key}_other`;
    const pluralValue = getValueByPath(source, pluralKey);

    if (pluralValue !== undefined && pluralValue !== null && pluralValue !== '') {
      return pluralValue;
    }
  }

  return getValueByPath(source, key);
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
  const t = (key, optionsOrDefault = '', defaultValue = '') => {
    const hasOptions = optionsOrDefault && typeof optionsOrDefault === 'object' && !Array.isArray(optionsOrDefault);
    const options = hasOptions ? optionsOrDefault : {};
    const resolvedDefaultValue = hasOptions ? defaultValue : optionsOrDefault;

    // 1. Try current language
    const value = getTranslationValue(translations, key, options);

    if (value !== undefined && value !== null && value !== '') {
      return interpolate(value, options);
    }

    // 2. Fallback to English
    const fallbackValue = getTranslationValue(en, key, options);

    if (fallbackValue !== undefined && fallbackValue !== null) {
      console.warn(`Missing "${key}" in ${currentLanguage}, using EN fallback`);
      return interpolate(fallbackValue, options);
    }

    // 3. Final fallback
    console.warn(`Missing "${key}" in ALL languages`);

    return interpolate(resolvedDefaultValue || key, options);
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
