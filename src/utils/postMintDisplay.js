import {
  isPrivateCirclePost,
  isPrivateContentPost,
} from '../hooks/useScreenshotProtection';

const DATE_TIME_LOCALES = {
  en: { locale: 'en-US', hour12: true },
  pt: { locale: 'pt-BR', hour12: false },
  it: { locale: 'it-IT', hour12: false },
  es: { locale: 'es-ES', hour12: false },
  fr: { locale: 'fr-FR', hour12: false },
};

export const formatMintedDateTime = (value, language = 'en') => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';

  const languageCode = String(language || 'en').toLowerCase().split(/[-_]/)[0];
  const { locale, hour12 } = DATE_TIME_LOCALES[languageCode] || DATE_TIME_LOCALES.en;
  const datePart = date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12,
  });

  return `${datePart} • ${timePart}`;
};

export const resolveMintTimestamp = post => {
  if (!post || typeof post !== 'object') return null;
  return (
    post.createdAt ??
    post.created_at ??
    post.mintedAt ??
    post.minted_at ??
    post.updatedAt ??
    post.updated_at ??
    null
  );
};

export const getMintLabelKey = post => {
  if (isPrivateCirclePost(post)) return 'postItem.privateMintLabel';
  if (isPrivateContentPost(post)) return 'postItem.privateContentLabel';

  const type = String(post?.type || '').toLowerCase();
  const format = String(post?.format || '').toLowerCase();
  const mediaType = String(post?.mediaType || '').toLowerCase();
  const isFlip =
    type === 'reel' ||
    type === 'flip' ||
    type === 'flips' ||
    format === 'reel' ||
    format === 'flip' ||
    mediaType === 'flips';

  if (isFlip) return 'postItem.flippedLabel';
  return 'postItem.mintedLabel';
};
