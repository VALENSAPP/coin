/**
 * Parsers for billing/*-graph earnings endpoints.
 *
 * Real API shape:
 * {
 *   statusCode, success,
 *   data: {
 *     range, startDate, endDate,
 *     totalEarning,                          // overall total (hero only — not card amount)
 *     payFollowingTotal | totalTipEarning | totalMissionDonationsEarning |
 *       totalShopEarning | totalUsdtTransferEarning,
 *     *PercentageOfTotalEarning,
 *     graphData: [{ date, amount }, ...]
 *   }
 * }
 */

const pickFirst = (...values) =>
  values.find(value => value !== undefined && value !== null && value !== '');

const toNumber = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Resolve inner `data` object from axios-interceptor payload. */
const unwrapRoot = response => {
  if (!response || typeof response !== 'object') return {};
  if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
    if (
      response.data.data &&
      typeof response.data.data === 'object' &&
      !Array.isArray(response.data.data)
    ) {
      return response.data.data;
    }
    return response.data;
  }
  return response;
};

/** Axios interceptor often returns error bodies instead of throwing. */
export const isEarningsGraphFailure = response => {
  if (response == null) return true;
  if (response?.error === true) return true;
  if (response?.success === false) return true;
  const status = Number(
    response?.statusCode ?? response?.status ?? response?.data?.statusCode,
  );
  if (Number.isFinite(status) && status >= 400) return true;
  const message = String(response?.message || response?.data?.message || '').toLowerCase();
  if (message.includes('not found') || message.includes('does not exist')) return true;
  return false;
};

const extractSeries = root => {
  if (Array.isArray(root?.graphData)) return root.graphData;
  if (Array.isArray(root?.points)) return root.points;
  if (Array.isArray(root?.graph)) return root.graph;
  if (Array.isArray(root?.history)) return root.history;
  if (Array.isArray(root?.series)) return root.series;
  if (Array.isArray(root?.items)) return root.items;
  if (Array.isArray(root?.days)) return root.days;
  if (Array.isArray(root)) return root;
  return [];
};

const resolvePointValue = item =>
  toNumber(
    pickFirst(
      item?.amount,
      item?.earning,
      item?.earnings,
      item?.revenue,
      item?.totalAmount,
      item?.value,
      item?.total,
      typeof item === 'number' ? item : null,
    ),
  );

const resolvePointTimestamp = (item, index) => {
  const raw = pickFirst(
    item?.date,
    item?.day,
    item?.label,
    item?.timestamp,
    item?.createdAt,
    item?.time,
  );

  if (raw != null) {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw > 1e12 ? raw : raw * 1000;
    }
    const asString = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(asString)) {
      const [year, month, day] = asString.split('-').map(Number);
      return new Date(year, month - 1, day).getTime();
    }
    const parsed = new Date(asString);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }

  const day = new Date();
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - (6 - index));
  return day.getTime();
};

const formatDayLabel = timestamp => {
  try {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
};

/** Category card amount fields — never use overall `totalEarning`. */
const CATEGORY_TOTAL_KEYS = [
  'payFollowingTotal',
  'totalTipEarning',
  'totalMissionDonationsEarning',
  'totalShopEarning',
  'totalUsdtTransferEarning',
];

const CATEGORY_PERCENT_KEYS = [
  'payFollowingPercentageOfTotalEarning',
  'tipPercentageOfTotalEarning',
  'missionDonationsPercentageOfTotalEarning',
  'shopEarningPercentageOfTotalEarning',
  'usdtTransferPercentageOfTotalEarning',
];

const hasOwn = (obj, key) =>
  obj != null && Object.prototype.hasOwnProperty.call(obj, key);

const resolveCategoryTotal = root => {
  for (const key of CATEGORY_TOTAL_KEYS) {
    if (hasOwn(root, key)) return toNumber(root[key]);
  }
  return null;
};

const resolveCategoryPercentage = root => {
  for (const key of CATEGORY_PERCENT_KEYS) {
    if (hasOwn(root, key)) return toNumber(root[key]);
  }
  return toNumber(pickFirst(root?.percentageOfTotalEarning, root?.percentage, root?.percent));
};

/**
 * @param {*} response axios interceptor payload
 * @returns {{
 *   points: Array<{ value: number, timestamp: number, label?: string }>,
 *   totalAmount: number,
 *   percentage: number,
 *   overallTotalEarning: number,
 *   count: number,
 *   countLabel: string,
 * }}
 */
export const parseEarningsGraphResponse = response => {
  const root = unwrapRoot(response);
  const series = extractSeries(root);

  const points = series
    .map((item, index) => {
      const value = resolvePointValue(item);
      const timestamp = resolvePointTimestamp(item, index);
      const labelFromApi =
        typeof item === 'object' && item ? String(item.label || '').trim() : '';
      return {
        value,
        timestamp,
        label: labelFromApi || formatDayLabel(timestamp),
      };
    })
    .filter(p => Number.isFinite(p.value) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  const computedFromGraph = points.reduce((sum, p) => sum + p.value, 0);
  const categoryTotal = resolveCategoryTotal(root);
  const totalAmount = categoryTotal != null ? categoryTotal : computedFromGraph;
  const percentage = resolveCategoryPercentage(root);
  const overallTotalEarning = toNumber(root?.totalEarning ?? root?.totalEarnings);

  return {
    points,
    totalAmount,
    percentage,
    overallTotalEarning,
    count: 0,
    countLabel: '',
  };
};

export const formatEarningsUsd = n => {
  const v = Number(n) || 0;
  return v.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatEarningsPercent = n => {
  const v = Number(n) || 0;
  const digits = Math.abs(v) > 0 && Math.abs(v) < 1 ? 2 : 1;
  return `${v.toFixed(digits)}% of total`;
};

export const parseTotalAmountParam = value => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};
