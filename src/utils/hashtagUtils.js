/**
 * Normalize API hashtag payloads into clean tag strings (without leading #).
 * Supports string[], objects, or a single string value.
 */
export function normalizePostHashtags(raw) {
  const list = Array.isArray(raw)
    ? raw
    : raw != null && raw !== ''
      ? [raw]
      : [];

  const tags = list
    .map(item => {
      if (typeof item === 'string') {
        return item.trim().replace(/^#+/, '').replace(/\s+/g, '');
      }
      if (item && typeof item === 'object') {
        return String(item.name || item.hashtag || item.tag || item.label || '')
          .trim()
          .replace(/^#+/, '')
          .replace(/\s+/g, '');
      }
      return '';
    })
    .filter(Boolean);

  return [...new Set(tags)];
}
