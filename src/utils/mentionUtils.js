import { getAllUser } from '../services/users';

/**
 * Detect the active @mention token being typed at the cursor.
 * Returns { query, startIndex } or null when not in a mention.
 */
export function getActiveMention(text, cursor = null) {
  const value = String(text || '');
  const caret = Number.isFinite(cursor) ? Math.max(0, Math.min(cursor, value.length)) : value.length;
  const before = value.slice(0, caret);
  const match = before.match(/(?:^|[\s([{])@([a-zA-Z0-9._-]*)$/);
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
    (Array.isArray(payload?.data?.data?.users) && payload.data.data.users) ||
    (Array.isArray(payload?.result?.users) && payload.result.users) ||
    (Array.isArray(payload?.results) && payload.results) ||
    [];

  return raw
    .map(user => {
      const id = String(
        user?.id ?? user?.userId ?? user?._id ?? user?.uuid ?? '',
      ).trim();
      const username = String(
        user?.userName ?? user?.username ?? user?.handle ?? '',
      )
        .trim()
        .replace(/^@+/, '');
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

/**
 * Score a user against the typed @query. Lower is better.
 * Prefers prefix matches so "@st" ranks stevenaustin above test20.
 */
export function getMentionMatchScore(user, query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return 100;

  const username = String(user?.username || '').toLowerCase();
  const displayName = String(user?.displayName || '').toLowerCase();
  const displayWords = displayName.split(/\s+/).filter(Boolean);

  if (username === needle) return 0;
  if (displayName === needle) return 1;
  if (username.startsWith(needle)) return 2;
  if (displayName.startsWith(needle)) return 3;
  if (displayWords.some(word => word.startsWith(needle))) return 4;
  if (username.includes(needle)) return 5;
  if (displayName.includes(needle)) return 6;
  return 100;
}

/**
 * Filter + sort mention candidates so prefix matches appear first.
 */
export function rankMentionUsers(users, query, limit = 8) {
  const needle = String(query || '').trim().toLowerCase();
  const list = Array.isArray(users) ? users : [];
  if (!needle) return list.slice(0, limit);

  return list
    .map(user => ({ user, score: getMentionMatchScore(user, needle) }))
    .filter(entry => entry.score < 100)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      const aName = String(a.user.username || '').toLowerCase();
      const bName = String(b.user.username || '').toLowerCase();
      return aName.localeCompare(bName);
    })
    .slice(0, limit)
    .map(entry => entry.user);
}

/**
 * Resolve a @username to a user id via /user/all?userName=
 * @param {string} incomingUsername
 * @returns {Promise<string|null>}
 */
export async function resolveUserIdFromUsername(incomingUsername) {
  const cleanUsername = decodeURIComponent(String(incomingUsername || '').trim()).replace(
    /^@+/,
    '',
  );
  if (!cleanUsername) return null;

  try {
    const response = await getAllUser({ userName: cleanUsername });
    const users = response?.data?.users ?? response?.data ?? [];
    const list = Array.isArray(users) ? users : [];
    const exactMatch = list.find(
      u =>
        String(u?.userName || u?.username || '').toLowerCase() ===
        cleanUsername.toLowerCase(),
    );
    const fallbackUser = exactMatch || list[0];
    const id =
      fallbackUser?.id || fallbackUser?._id || fallbackUser?.userId || null;
    return id != null ? String(id).trim() : null;
  } catch (error) {
    console.log('Username resolution failed:', error?.message || error);
    return null;
  }
}
