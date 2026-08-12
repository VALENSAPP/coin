const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Days remaining until a mission ends, from now.
 * Shared by profile grid, search, and post detail so all surfaces match.
 */
export const getMissionDaysLeft = (endTime) => {
  if (!endTime) return 0;
  try {
    const end = new Date(endTime);
    if (Number.isNaN(end.getTime())) return 0;
    const diff = end.getTime() - Date.now();
    const days = Math.ceil(diff / MS_PER_DAY);
    return days > 0 ? days : 0;
  } catch {
    return 0;
  }
};
