import { Dimensions } from 'react-native';

export const PROFILE_GRID_NUM_COLUMNS = 3;
export const PROFILE_GRID_SPACING = 1;
const screenWidth = Dimensions.get('window').width;

export const PROFILE_GRID_IMAGE_SIZE =
  (screenWidth - PROFILE_GRID_SPACING * (PROFILE_GRID_NUM_COLUMNS + 1)) /
  PROFILE_GRID_NUM_COLUMNS;

export const PROFILE_GRID_IMAGE_ASPECT = 1.5;
export const PROFILE_GRID_ITEM_TOP_MARGIN = 5;
export const PROFILE_TAB_BAR_HEIGHT = 52;

export const getProfileGridRowHeight = (aspectRatio = PROFILE_GRID_IMAGE_ASPECT) =>
  PROFILE_GRID_ITEM_TOP_MARGIN +
  PROFILE_GRID_IMAGE_SIZE * aspectRatio +
  PROFILE_GRID_SPACING;

export const getProfileGridContentHeight = (
  itemCount,
  {
    numColumns = PROFILE_GRID_NUM_COLUMNS,
    aspectRatio = PROFILE_GRID_IMAGE_ASPECT,
    paddingTop = PROFILE_GRID_SPACING,
    paddingBottom = 100,
    minHeight = 320,
  } = {},
) => {
  if (!itemCount) {
    return minHeight;
  }
  const rows = Math.ceil(itemCount / numColumns);
  return Math.max(
    minHeight,
    paddingTop + rows * getProfileGridRowHeight(aspectRatio) + paddingBottom,
  );
};

export const isProfileVideoPost = (post) => {
  const candidates = [
    ...(Array.isArray(post?.media) ? post.media : []),
    ...(Array.isArray(post?.images) ? post.images : []),
    post?.image,
    post?.video,
  ].filter(Boolean);
  const first = candidates[0];
  const url =
    typeof first === 'string'
      ? first
      : first?.url || first?.uri || first?.video || first?.path || '';
  if (String(post?.mediaType || post?.type || '').toLowerCase().includes('video')) {
    return true;
  }
  return /\.(mp4|mov|avi|mkv|webm|m4v|3gp)(\?|$)/i.test(String(url));
};

export const countProfileImagePosts = (postList) =>
  (Array.isArray(postList) ? postList : []).filter((post) => !isProfileVideoPost(post)).length;

export const countProfileVideoPosts = (postList) =>
  (Array.isArray(postList) ? postList : []).filter((post) => isProfileVideoPost(post)).length;
