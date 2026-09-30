const LOCALE_MAP = {
    en: 'en-US',
    pt: 'pt-BR',
    it: 'it-IT',
    es: 'es-ES',
    fr: 'fr-FR',
};

const getLanguageCode = (language) => {
    return String(language || 'en').split('-')[0].toLowerCase();
};

const getLocale = (language) => {
    const languageCode = getLanguageCode(language);
    return LOCALE_MAP[languageCode] || 'en-US';
};

const parseDateValue = (value) => {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'number' && Number.isFinite(value)) {
        const date = new Date(Math.abs(value) < 1e12 ? value * 1000 : value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value !== 'string' || !value.trim()) return null;

    const normalized = value.trim();
    // Do not treat localized values such as "Sim" or boolean-like strings as dates.
    if (!/\d/.test(normalized)) return null;
    const numericValue = Number(normalized);
    const dateValue = Number.isFinite(numericValue) && normalized.length <= 13
        ? (Math.abs(numericValue) < 1e12 ? numericValue * 1000 : numericValue)
        : normalized;
    const date = new Date(dateValue);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const formatLocalizedActivityDate = (value, language) => {
    if (!value) return '';

    const date = parseDateValue(value);
    if (!date) return '';

    const languageCode = getLanguageCode(language);

    if (languageCode === 'en') {
        const datePart = new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: '2-digit',
        }).format(date);

        const timePart = new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        }).format(date);

        return `${datePart} • ${timePart}`;
    }

    const locale = getLocale(language);

    const datePart = new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
    }).format(date);

    const timePart = new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date);

    return `${datePart} • ${timePart}`;
};

export const formatLocalizedDateTime = (value, language) => {
    if (!value) return '';

    const date = parseDateValue(value);
    if (!date) return '';

    return new Intl.DateTimeFormat(getLocale(language), {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
}).format(date);
};

export const formatLocalizedDate = (value, language) => {
    if (!value) return '';

    const date = parseDateValue(value);
    if (!date) return '';

    return new Intl.DateTimeFormat(getLocale(language), {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(date);
};
