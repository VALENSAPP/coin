export const isTruthyTrustPost = value =>
  value === true || value === 1 || String(value).toLowerCase() === 'true';

export const resolveIsTrustPost = (post = {}) => {
  if (!post || typeof post !== 'object') return false;

  if (
    isTruthyTrustPost(post.isTrustPost)
    || isTruthyTrustPost(post.communityTrustPost)
    || isTruthyTrustPost(post.is_trust_post)
    || isTruthyTrustPost(post.community_trust_post)
  ) {
    return true;
  }

  const typeValue = String(post.type ?? post.postType ?? post.post_type ?? '').toLowerCase();
  return typeValue === 'trust'
    || typeValue === 'community_trust'
    || typeValue === 'communitytrust'
    || typeValue === 'trust_post';
};

export const resolveTrustPostFromSources = (...sources) =>
  sources.some(source => resolveIsTrustPost(source));

export const withTrustPostFields = (post = {}) => {
  if (!post || typeof post !== 'object') return post;
  const isTrustPost = resolveIsTrustPost(post);
  return {
    ...post,
    isTrustPost,
    communityTrustPost: isTrustPost,
  };
};

export const mergeTrustPostFields = (existing = {}, incoming = {}) => {
  const isTrustPost = resolveIsTrustPost(incoming) || resolveIsTrustPost(existing);
  return withTrustPostFields({
    ...existing,
    ...incoming,
    isTrustPost,
    communityTrustPost: isTrustPost,
  });
};

export const extractPostFromByIdResponse = (response) => {
  const payload =
    response?.data?.data
    ?? response?.data?.post
    ?? response?.data
    ?? response
    ?? null;

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data) && payload.data.id) {
    return payload.data;
  }
  if (payload.id) return payload;
  return null;
};

export const appendTrustPostShareFields = (messageData, postLike) => {
  if (!postLike) return messageData;
  const normalizedPost = withTrustPostFields(postLike?.post || postLike);
  if (!resolveIsTrustPost(normalizedPost)) return messageData;
  return {
    ...messageData,
    isTrustPost: true,
    communityTrustPost: true,
    post: normalizedPost,
  };
};

export const resolveSharedPostImages = (post = {}) => {
  if (!post || typeof post !== 'object') return [];

  if (Array.isArray(post.images) && post.images.length > 0) {
    return post.images.map(img => (typeof img === 'string' ? { url: img } : img));
  }

  if (Array.isArray(post.media) && post.media.length > 0) {
    return post.media.map(mediaItem => ({
      url: mediaItem?.url || mediaItem?.uri || mediaItem,
      thumbnail: mediaItem?.thumbnail,
      type: mediaItem?.type,
    }));
  }

  if (post.image) return [{ url: post.image }];
  return [];
};

export const normalizeTrustPostFromMessage = (message = {}) => {
  if (!message?.post) return message?.post;
  const isTrustPost = resolveTrustPostFromSources(message.post, message);
  return withTrustPostFields({
    ...message.post,
    isTrustPost,
    communityTrustPost: isTrustPost,
  });
};
