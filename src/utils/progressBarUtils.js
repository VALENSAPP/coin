/**
 * Returns fill color for mission/goal progress bar based on percentage and profile type.
 * Shared by search MissionProgressBar and PostItem to keep behavior consistent.
 * @param {number} progressPercent - 0–100
 * @param {string} [profile='user'] - 'user' | 'company' (affects high-percent color)
 * @returns {string} Hex color
 */
export function getProgressBarColor(progressPercent, profile = 'user') {
  if (progressPercent >= 75) return profile === 'user' ? '#5a2d82' : '#C9A15a';
  if (progressPercent >= 50) return profile === 'user' ? '#5a2d82' : '#C9A15a';
  if (progressPercent >= 25) return '#FF9800';
  return '#F44336';
}

/**
 * Formats mission progress without rounding small, valid contributions down to
 * zero. For example, 5 raised toward a 25,000 goal is shown as 0.02%.
 */
export function formatMissionProgressPercent(progressPercent) {
  const normalized = Number.isFinite(Number(progressPercent))
    ? Math.max(0, Math.min(Number(progressPercent), 100))
    : 0;

  if (normalized === 0) return '0';
  if (normalized < 0.01) return '<0.01';
  return normalized < 1 ? normalized.toFixed(2) : normalized.toFixed(1);
}

/**
 * Keeps a non-zero mission contribution visible in the progress bar while the
 * label continues to show the exact percentage.
 */
export function getMissionProgressBarWidth(progressPercent, minimumVisiblePercent = 1) {
  const normalized = Number.isFinite(Number(progressPercent))
    ? Math.max(0, Math.min(Number(progressPercent), 100))
    : 0;

  return normalized > 0 ? Math.max(normalized, minimumVisiblePercent) : 0;
}
