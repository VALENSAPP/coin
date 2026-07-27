/**
 * Detect the active @mention token being typed at the cursor.
 * Returns { query, startIndex } or null when not in a mention.
 */
export function getActiveMention(text, cursor = null) {
  const value = String(text || '');
  const caret = Number.isFinite(cursor) ? Math.max(0, Math.min(cursor, value.length)) : value.length;
  const before = value.slice(0, caret);
  const match = before.match(/(?:^|[\s([{])@([a-zA-Z0-9._]*)$/);
  if (!match) return null;

  const query = match[1] || '';
  const startIndex = before.length - query.length - 1; // index of '@'
  return { query, startIndex };
}

/**
 * Insert a selected username into the text, replacing the active @query.
 */
export function insertMention(text, cursor, mentionStart, username) {
  const value = String(text || '');
  const caret = Number.isFinite(cursor) ? Math.max(0, Math.min(cursor, value.length)) : value.length;
  const handle = String(username || '').replace(/^@/, '');
  const before = value.slice(0, mentionStart);
  const after = value.slice(caret);
  const nextText = `${before}@${handle} ${after}`;
  const nextCursor = before.length + handle.length + 2; // after "@user "
  return { text: nextText, cursor: nextCursor };
}

/**
 * Normalize /user/search response into a stable list.
 */
export function normalizeSearchUsers(response) {
  const payload = response?.data ?? response ?? {};
  const raw =
    (Array.isArray(payload) && payload) ||
    (Array.isArray(payload?.data) && payload.data) ||
    (Array.isArray(payload?.users) && payload.users) ||
    (Array.isArray(payload?.data?.users) && payload.data.users) ||
    (Array.isArray(payload?.results) && payload.results) ||
    [];

  return raw
    .map(user => {
      const id = String(
        user?.id ?? user?.userId ?? user?._id ?? user?.uuid ?? '',
      ).trim();
      const username = String(
        user?.userName ?? user?.username ?? user?.handle ?? '',
      ).trim();
      const displayName = String(
        user?.displayName ?? user?.name ?? username ?? '',
      ).trim();
      const avatar = String(
        user?.profilePicture ??
          user?.image ??
          user?.avatar ??
          user?.profileImg ??
          '',
      ).trim();

      if (!id && !username) return null;
      return {
        id: id || username,
        username: username || displayName,
        displayName: displayName || username,
        avatar:
          avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
      };
    })
    .filter(Boolean);
}
