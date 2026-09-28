import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyAcceptLanguage } from '../services';
import { updateUserLanguage, getUserLanguage } from '../services/users';
import { getAuthDeviceId } from '../services/authentication';

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

// Global setter callback for outside calls (e.g. app startup, login success)
let _setAppLanguageGlobal = null;

/**
 * Call GET /user/language and apply the user's preferred language
 */
export const fetchAndApplyUserLanguage = async (deviceId) => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) return null;

    const resolvedDeviceId = deviceId || (await getAuthDeviceId());
    console.log('Fetched deviceId:', resolvedDeviceId);
    const response = await getUserLanguage(resolvedDeviceId);
    console.log('Fetched user language response:', response);
    const rawData = response?.data;
    const lang =
      typeof rawData === 'string'
        ? rawData
        : rawData?.language ||
          rawData?.data?.language ||
          rawData?.data ||
          rawData?.preferredLanguage ||
          rawData?.userLanguage;

    if (lang && typeof lang === 'string') {
      const rawLang = lang.trim().toLowerCase();
      const code = rawLang.split(/[-_]/)[0];
      const targetLang = languages.includes(rawLang)
        ? rawLang
        : languages.includes(code)
        ? code
        : null;

      if (targetLang) {
        await AsyncStorage.setItem('language', targetLang);
        applyAcceptLanguage(targetLang);
        if (_setAppLanguageGlobal) {
          _setAppLanguageGlobal(targetLang);
        }
        return targetLang;
      }
    }
  } catch (error) {
    console.warn('Fetch user language error:', error?.message || error);
  }
  return null;
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

let activeLanguage = 'en';

export const getActiveLanguage = () => activeLanguage;

export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [translations, setTranslations] = useState(en);
  const [isLoading, setIsLoading] = useState(true);
  activeLanguage = currentLanguage;

  useEffect(() => {
    _setAppLanguageGlobal = (lang) => {
      if (languages.includes(lang)) {
        setCurrentLanguage(lang);
        setTranslations(allTranslations[lang] || en);
      }
    };
    return () => {
      _setAppLanguageGlobal = null;
    };
  }, []);

  // ✅ Init language
  useEffect(() => {
    const initLanguage = async () => {
      try {
        const savedLang = await AsyncStorage.getItem('language');
        const lang = languages.includes(savedLang) ? savedLang : 'en';

        applyAcceptLanguage(lang);
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
      applyAcceptLanguage(lang);
      setCurrentLanguage(lang);
      setTranslations(allTranslations[lang] || en);

      const token = await AsyncStorage.getItem('token');
      if (token) {
        updateUserLanguage(lang).catch((error) => {
          console.warn('Update language error:', error);
        });
      }
    } catch (error) {
      console.warn('Change language error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Translation function (FINAL)
  const t = (key, optionsOrDefault = '', defaultValue = '') => {
    let options = {};
    let resolvedDefaultValue = '';

    if (optionsOrDefault && typeof optionsOrDefault === 'object' && !Array.isArray(optionsOrDefault)) {
      options = optionsOrDefault;
      resolvedDefaultValue = typeof defaultValue === 'string' ? defaultValue : '';
    } else {
      resolvedDefaultValue = typeof optionsOrDefault === 'string' ? optionsOrDefault : '';
      if (defaultValue && typeof defaultValue === 'object' && !Array.isArray(defaultValue)) {
        options = defaultValue;
      }
    }

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
        fetchUserLanguage: fetchAndApplyUserLanguage,
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

