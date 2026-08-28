const MS_PER_DAY = 1000 * 60 * 60 * 24;

const toValidDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toStartOfDay = (value) => {
  const date = toValidDate(value);
  if (!date) return null;
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

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

/** True when start and create fall on the same local calendar day. */
export const isSameMissionCalendarDay = (createTime, startTime) => {
  const createDay = toStartOfDay(createTime);
  const startDay = toStartOfDay(startTime);
  if (!createDay || !startDay) return true;
  return createDay.getTime() === startDay.getTime();
};

/** Days remaining until the mission start date (from now). */
export const getMissionStartsInDays = (startTime) => {
  const startDay = toStartOfDay(startTime);
  if (!startDay) return 0;
  const today = toStartOfDay(new Date());
  if (!today) return 0;
  const diff = startDay.getTime() - today.getTime();
  const days = Math.ceil(diff / MS_PER_DAY);
  return days > 0 ? days : 0;
};

/**
 * When create date ≠ start date and the mission has not started yet,
 * return days left until start. Otherwise null (do not show the label).
 */
export const getMissionScheduledStartInfo = (createTime, startTime) => {
  if (!createTime || !startTime) return null;
  if (isSameMissionCalendarDay(createTime, startTime)) return null;
  const daysUntilStart = getMissionStartsInDays(startTime);
  if (daysUntilStart <= 0) return null;
  return { daysUntilStart };
};
