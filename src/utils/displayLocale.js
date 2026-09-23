import { getActiveLanguage } from '../i18n';

const LOCALE_FORMAT = {
  en: { locale: 'en-US', currency: 'USD', hour12: true },
  pt: { locale: 'pt-BR', currency: 'BRL', hour12: false },
  es: { locale: 'es-ES', currency: 'USD', hour12: false },
  fr: { locale: 'fr-FR', currency: 'USD', hour12: false },
  it: { locale: 'it-IT', currency: 'USD', hour12: false },
};

const formatConfig = (language = getActiveLanguage()) =>
  LOCALE_FORMAT[language] || LOCALE_FORMAT.en;

export const formatDisplayCurrency = (value, language) => {
  const amount = Number(value) || 0;
  const { locale, currency } = formatConfig(language);
  return amount.toLocaleString(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatDisplayNumber = (value, language) => {
  const amount = Number(value) || 0;
  const { locale } = formatConfig(language);
  return amount.toLocaleString(locale, { maximumFractionDigits: 0 });
};

export const formatDisplayDecimal = (value, language) => {
  const amount = Number(value) || 0;
  const { locale } = formatConfig(language);
  return amount.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatDisplayTime = (date, language) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const { locale, hour12 } = formatConfig(language);
  return date.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12,
  });
};
