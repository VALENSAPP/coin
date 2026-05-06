export const isPostPinned = post =>
  post?.pinned === true || String(post?.pinned || '').toLowerCase() === 'true';

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
