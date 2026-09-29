const LOCALE_MAP = {
    en: 'en-US',
    pt: 'pt-BR',
    it: 'it-IT',
    es: 'es-ES',
};

const getLanguageCode = (language) => {
    return String(language || 'en').split('-')[0].toLowerCase();
};

const getLocale = (language) => {
    const languageCode = getLanguageCode(language);
    return LOCALE_MAP[languageCode] || 'en-US';
};

export const formatLocalizedActivityDate = (value, language) => {
    if (!value) return '';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

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