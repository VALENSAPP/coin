import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const languages = ['en', 'pt', 'it', 'es', 'fr'];
const languageNames = {
  en: 'English',
  pt: 'Português',
  it: 'Italiano',
  es: 'Español',
  fr: 'Français'
};

let translationsCache = {};

import en from './en.json';
import pt from './pt.json';
import it from './it.json';
import es from './es.json';
import fr from './fr.json';

const translations = {
  en,
  pt,
  it,
  es,
  fr
};

const loadTranslations = (lang) => {
  return translations[lang] || translations.en;
};

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [translations, setTranslations] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initLanguage = async () => {
      try {
        const savedLang = await AsyncStorage.getItem('language');
        const lang = languages.includes(savedLang) ? savedLang : 'en';
        setCurrentLanguage(lang);
        const data = await loadTranslations(lang);
        setTranslations(data);
      } catch (error) {
        console.warn('Language init error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    initLanguage();
  }, []);

  const changeLanguage = async (lang) => {
    if (!languages.includes(lang)) return;
    
    try {
      setIsLoading(true);
      await AsyncStorage.setItem('language', lang);
      setCurrentLanguage(lang);
      const data = loadTranslations(lang);
      setTranslations(data);
    } catch (error) {
      console.warn('Change language error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const t = (key) => {
    return translations?.login?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ 
      currentLanguage, 
      languageNames,
      languages,
      changeLanguage, 
      t, 
      isLoading 
    }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

