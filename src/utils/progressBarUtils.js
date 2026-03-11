/**
 * Returns fill color for mission/goal progress bar based on percentage and profile type.
 * Shared by search MissionProgressBar and PostItem to keep behavior consistent.
 * @param {number} progressPercent - 0–100
 * @param {string} [profile='user'] - 'user' | 'company' (affects high-percent color)
 * @returns {string} Hex color
 */
export function getProgressBarColor(progressPercent, profile = 'user') {
  if (progressPercent >= 75) return profile === 'user' ? '#5a2d82' : '#D3B683';
  if (progressPercent >= 50) return profile === 'user' ? '#5a2d82' : '#D3B683';
  if (progressPercent >= 25) return '#FF9800';
  return '#F44336';
}
