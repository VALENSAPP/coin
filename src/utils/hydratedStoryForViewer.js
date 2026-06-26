import { getStoryByUser, getFollowingUserStories } from '../services/stories';
import {
  buildStoryClipFromApiRow,
  inferClipIndex,
  normalizeStoryForViewer,
  splitStoryClipId,
  storyHasPlayableAudio,
} from './storyAudioResolve';

function normalizeStoryRows(data) {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

function findStoryRow(rows, baseId) {
  const target = String(baseId || '').trim();
  if (!target) return null;
  return (
    rows.find(row => String(row?.id || row?._id || row?.storyId || '').trim() === target) ||
    null
  );
}

async function fetchStoryRow(baseId, ownerId, selfUserId) {
  const ownerCandidates = [ownerId, selfUserId].filter(Boolean).map(String);
  const uniqueOwners = [...new Set(ownerCandidates)];

  for (const candidateId of uniqueOwners) {
    try {
      const response = await getStoryByUser(candidateId, { time: 'all' });
      const match = findStoryRow(normalizeStoryRows(response?.data), baseId);
      if (match) return match;
    } catch (_error) {
      // Try the next owner candidate / following feed.
    }
  }

  try {
    const followingRes = await getFollowingUserStories();
    const match = findStoryRow(normalizeStoryRows(followingRes?.data), baseId);
    if (match) return match;
  } catch (_error) {
    // Fall back to the partial chat payload.
  }

  return null;
}

/**
 * Chat share payloads often omit `storyMeta` (music lives in clip metadata).
 * Fetch the full story row from the API when audio is missing.
 */
export async function hydrateStoryForViewer(partialStory, selfUserId = null) {
  const immediate = normalizeStoryForViewer(partialStory);
  if (storyHasPlayableAudio(immediate)) return immediate;

  const { baseId, clipIndex: idClipIndex } = splitStoryClipId(
    partialStory?.storyId || partialStory?.id,
  );
  if (!baseId) return immediate;

  const ownerId = String(
    partialStory?.userId ||
    partialStory?.UserId ||
    partialStory?.user?.id ||
    partialStory?.user?._id ||
    partialStory?.senderId ||
    '',
  ).trim();

  const apiStory = await fetchStoryRow(baseId, ownerId, selfUserId);
  if (!apiStory) return immediate;

  const clipIndex = inferClipIndex(partialStory, apiStory, idClipIndex);

  return buildStoryClipFromApiRow(apiStory, clipIndex, {
    userId: ownerId || apiStory.userId || apiStory.UserId || selfUserId || null,
    userName: partialStory?.userName || partialStory?.username || partialStory?.displayName,
    userImage: partialStory?.userImage || partialStory?.avatar,
    caption: partialStory?.caption || partialStory?.text,
    createdAt: partialStory?.createdAt || partialStory?.updatedAt,
  });
}
