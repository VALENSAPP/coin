/**
 * Builds per-post state maps from a list of API posts.
 * Used by SavedPosts and HidePosts to seed liked, counts, following, saved, and hidden state.
 * @param {Array} list - Array of post objects from API
 * @param {{ includeSaved?: boolean, includeHidden?: boolean }} options
 * @returns {{ nextLiked: {}, nextLikeCounts: {}, nextCommentCounts: {}, nextFollowing: {}, nextSaved?: {}, nextHidden?: {} }}
 */
export function buildPostMaps(list, { includeSaved = false, includeHidden = false } = {}) {
  const nextLiked = {};
  const nextLikeCounts = {};
  const nextCommentCounts = {};
  const nextFollowing = {};
  const nextSaved = includeSaved ? {} : null;
  const nextHidden = includeHidden ? {} : null;

  for (const p of list) {
    if (!p?.id) continue;
    nextLiked[p.id] = !!(p.isLike ?? p.liked);
    nextLikeCounts[p.id] = p.likesCount ?? p.likeCount ?? 0;
    nextCommentCounts[p.id] = p.commentCount ?? 0;
    if (includeSaved) nextSaved[p.id] = !!(p.isSaved ?? true);
    if (includeHidden) nextHidden[p.id] = true;
    if (p?.userId != null && typeof p.isFollow === 'boolean') {
      nextFollowing[String(p.userId)] = p.isFollow;
    }
  }

  return {
    nextLiked,
    nextLikeCounts,
    nextCommentCounts,
    nextFollowing,
    ...(includeSaved && { nextSaved }),
    ...(includeHidden && { nextHidden }),
  };
}
