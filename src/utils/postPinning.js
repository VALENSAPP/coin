const isTruthyPinnedFlag = value => {
  if (value === true || value === 1) return true;
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
};

export const isPostPinned = post =>
  isTruthyPinnedFlag(
    post?.pinned ??
    post?.isPinned ??
    post?.is_pinned ??
    post?.pin,
  );

export const sortPostsByPinned = posts =>
  [...(Array.isArray(posts) ? posts : [])].sort((a, b) => {
    const pinnedDelta = Number(isPostPinned(b)) - Number(isPostPinned(a));
    if (pinnedDelta !== 0) return pinnedDelta;
    return 0;
  });

export const setPostPinnedState = (posts, postId, pinned) =>
  sortPostsByPinned(
    (Array.isArray(posts) ? posts : []).map(post =>
      String(post?.id || post?._id || '') === String(postId)
        ? { ...post, pinned }
        : post,
    ),
  );
