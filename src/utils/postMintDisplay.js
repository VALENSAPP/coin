import {
  isPrivateCirclePost,
  isPrivateContentPost,
} from '../hooks/useScreenshotProtection';

export const formatMintedDateTime = value => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';

  const datePart = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
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
