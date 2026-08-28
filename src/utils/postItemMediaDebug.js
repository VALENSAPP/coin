const TAG = '[POST_ITEM_MEDIA]';

export const summarizeUri = uri => {
  if (uri == null || uri === '') return { kind: 'empty' };
  const s = String(uri);
  if (s.startsWith('data:')) {
    const semi = s.indexOf(';');
    return {
      kind: 'data-uri',
      mime: semi > 5 ? s.slice(5, semi) : 'unknown',
      length: s.length,
    };
  }
  if (/^https?:\/\//i.test(s)) {
    return { kind: 'http', preview: s.length > 140 ? `${s.slice(0, 140)}…` : s };
  }
  if (/^file:\/\//i.test(s)) return { kind: 'file', preview: s.slice(0, 140) };
  return { kind: 'other', preview: s.length > 140 ? `${s.slice(0, 140)}…` : s };
};

const summarizeApiMediaField = value => {
  if (value == null) return null;
  if (typeof value === 'string') return summarizeUri(value);
  if (typeof value === 'object') {
    return {
      type: value.type,
      url: summarizeUri(value.url ?? value.uri),
      thumbnail: summarizeUri(value.thumbnail),
    };
  }
  return { kind: 'unknown', value };
};

export const logApiPostsMedia = (stage, posts) => {
  if (!__DEV__) return;
  if (!Array.isArray(posts)) {
    return;
  }
  const sample = posts.slice(0, 5).map(p => ({
    postId: p?.id,
    rawImages: Array.isArray(p?.images) ? p.images.map(summarizeUri) : p?.images,
    rawMedia: Array.isArray(p?.media) ? p.media.map(summarizeApiMediaField) : p?.media,
  }));
};

export const logMappedPostMedia = (stage, posts) => {
  if (!__DEV__) return;
  if (!Array.isArray(posts)) return;
  const sample = posts.slice(0, 5).map(p => ({
    postId: p?.id,
    media: (p?.media || []).map((m, i) => ({
      index: i,
      type: m?.type,
      url: summarizeUri(m?.url),
      thumbnail: summarizeUri(m?.thumbnail),
    })),
  }));
};

export const logPostItemMedia = (stage, postId, media) => {
  if (!__DEV__) return;
  const entries = (media || []).map((m, i) => ({
    index: i,
    type: m?.type,
    url: summarizeUri(m?.url),
    thumbnail: summarizeUri(m?.thumbnail),
  }));
};
