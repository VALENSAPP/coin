/**
 * Normalize `/user/totalplatfrompoints` payloads.
 * Axios interceptor already returns `response.data`, so callers may get:
 * `{ statusCode, success, data: { ...points } }` or occasionally a nested shape.
 */
export function parseTotalPlatformPointsPayload(response) {
  const root = response?.data?.data ?? response?.data ?? response ?? {};
  const payload =
    root &&
    typeof root === 'object' &&
    (root.totalPlatformPoints != null ||
      root.referPoints != null ||
      root.totalBattlePoints != null ||
      root.used != null)
      ? root
      : root?.data && typeof root.data === 'object'
        ? root.data
        : root;

  const totalBattlePoints =
    Number(
      payload?.totalBattlePoints ??
        payload?.battlePoints ??
        payload?.total_battle_points,
    ) || 0;
  const marketplaceBattlePoints =
    Number(
      payload?.marketplaceBattlePoints ??
        payload?.marketplacePoints ??
        payload?.shopBattlePoints ??
        payload?.marketplace_battle_points,
    ) || 0;
  const referPoints =
    Number(
      payload?.referPoints ??
        payload?.referralPoints ??
        payload?.refer_points,
    ) || 0;
  const used =
    Number(payload?.used ?? payload?.usedPoints ?? payload?.used_points) || 0;

  const reportedTotal =
    Number(
      payload?.totalPlatformPoints ??
        payload?.platformPoints ??
        payload?.total_platform_points ??
        payload?.totalPoints,
    ) || 0;

  // If API omits totalPlatformPoints, derive from known buckets.
  const partsSum = totalBattlePoints + marketplaceBattlePoints + referPoints;
  const totalPlatformPoints = reportedTotal > 0 ? reportedTotal : partsSum;

  // Available = total platform points (same as "Your Platform Points").
  const availablePoints = totalPlatformPoints;

  return {
    totalPlatformPoints,
    totalBattlePoints,
    marketplaceBattlePoints,
    referPoints,
    used,
    availablePoints,
  };
}
