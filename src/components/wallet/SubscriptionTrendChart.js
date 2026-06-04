import React, { useEffect, useMemo, useRef } from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import Svg, {
  Path,
  Text as SvgText,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import { format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import Ionicons from 'react-native-vector-icons/Ionicons';

export const SUBSCRIPTION_CHART_LINE = '#8b5cf6';
const CHART_POINT_GAP = 46;

/** Bucket daily points into weekly / monthly when the API returns daily data. */
export const aggregatePointsByInterval = (points, interval) => {
  if (!Array.isArray(points) || points.length === 0 || interval === 'daily') {
    return points;
  }

  const buckets = new Map();

  points.forEach(({ timestamp, value }) => {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return;

    const bucketDate =
      interval === 'monthly'
        ? startOfMonth(date)
        : startOfWeek(date, { weekStartsOn: 1 });

    const key = bucketDate.getTime();
    buckets.set(key, (buckets.get(key) || 0) + (Number(value) || 0));
  });

  return [...buckets.entries()]
    .map(([timestamp, value]) => ({ timestamp, value }))
    .sort((a, b) => a.timestamp - b.timestamp);
};

/** Parse `billing/subscription-earning/graph` → points + summary */
export const parseSubscriptionGraphResponse = (response, requestedInterval = 'daily') => {
  const root = response?.data ?? response;
  const raw = Array.isArray(root?.points) ? root.points : [];
  const responseInterval = root?.interval ?? null;

  const points = raw
    .map((item, index) => {
      const dateStr =
        item?.date ??
        item?.label ??
        item?.day ??
        item?.week ??
        item?.month ??
        item?.time ??
        item?.createdAt;
      const val = Number(
        item?.amount ??
          item?.earning ??
          item?.revenue ??
          item?.totalAmount ??
          item?.value ??
          item?.count ??
          0,
      );

      let ts;
      if (dateStr != null && String(dateStr).length > 0) {
        const rawDate = String(dateStr);
        const parsed = rawDate.length >= 10 ? parseISO(rawDate.slice(0, 10)) : new Date(rawDate);
        ts = parsed.getTime();
      } else if (typeof item?.timestamp === 'number') {
        ts = item.timestamp;
      } else {
        ts = Date.now() - (raw.length - 1 - index) * 86400000;
      }

      return {
        timestamp: ts,
        value: Number.isFinite(val) ? val : 0,
      };
    })
    .filter((p) => !isNaN(p.timestamp) && Number.isFinite(p.value))
    .sort((a, b) => a.timestamp - b.timestamp);

  const totalAmount = Number(root?.totalAmount);
  const computedTotal = points.reduce((sum, p) => sum + p.value, 0);

  const normalizedInterval = requestedInterval || responseInterval || 'daily';
  const shouldAggregate =
    normalizedInterval !== 'daily' &&
    (responseInterval === 'daily' || responseInterval == null);
  const displayPoints = shouldAggregate
    ? aggregatePointsByInterval(points, normalizedInterval)
    : points;

  return {
    points: displayPoints,
    totalAmount: Number.isFinite(totalAmount) ? totalAmount : computedTotal,
    interval: responseInterval,
  };
};

export const formatSupportUsd = (n) => {
  const v = Number(n) || 0;
  return v.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const seriesDelta = (points) => {
  if (!points || points.length < 2) return 0;
  const a = Number(points[0].value) || 0;
  const b = Number(points[points.length - 1].value) || 0;
  return b - a;
};

function SubscriptionTrendSvg({ points, chartWidth, chartHeight, lineColor, interval = 'daily' }) {
  const pairedSorted = useMemo(() => {
    return [...points]
      .map((p) => ({
        t: Number(p.timestamp),
        v: Number(p.value) || 0,
      }))
      .filter((p) => Number.isFinite(p.t))
      .sort((a, b) => a.t - b.t);
  }, [points]);

  const padL = 32;
  const padR = 32;
  const padT = 8;
  const padB = 30;
  const innerW = Math.max(chartWidth - padL - padR, 1);
  const innerH = Math.max(chartHeight - padT - padB, 1);
  const n = pairedSorted.length;

  const xs = Array.from({ length: n }, (_, i) =>
    padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW),
  );

  const labelIndexes = useMemo(() => {
    if (n <= 0) return [];
    if (n === 1) return [0];
    const maxLabels = Math.min(7, n);
    const set = new Set([0, n - 1]);
    for (let k = 1; k < maxLabels - 1; k++) {
      set.add(Math.round((k / (maxLabels - 1)) * (n - 1)));
    }
    return [...set].sort((a, b) => a - b);
  }, [n]);

  const values = pairedSorted.map((r) => r.v);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0;
    max = 1;
  }
  if (max === min) {
    min -= 1;
    max += 1;
  }

  const ys = values.map(
    (v) => padT + innerH - ((v - min) / (max - min)) * innerH,
  );

  const linePath = () => {
    if (n === 0) return '';
    if (n === 1) return `M ${xs[0]} ${ys[0]} L ${xs[0] + 0.5} ${ys[0]}`;
    return ys.map((y, i) => `${i === 0 ? 'M' : 'L'} ${xs[i]} ${y}`).join(' ');
  };

  const areaPath = () => {
    if (n === 0) return '';
    const base = padT + innerH;
    const lp = linePath();
    if (!lp) return '';
    return `${lp} L ${xs[n - 1]} ${base} L ${xs[0]} ${base} Z`;
  };

  const formatLabel = (ts) => {
    if (interval === 'monthly') return format(ts, 'MMM yyyy');
    return format(ts, 'MMM d');
  };

  return (
    <Svg width={chartWidth} height={chartHeight}>
      <Defs>
        <SvgLinearGradient id="gradSubscription" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={lineColor} stopOpacity={0.22} />
          <Stop offset="1" stopColor={lineColor} stopOpacity={0.02} />
        </SvgLinearGradient>
      </Defs>

      {n > 0 ? (
        <>
          <Path d={areaPath()} fill="url(#gradSubscription)" stroke="none" />
          <Path d={linePath()} stroke={lineColor} strokeWidth={2.5} fill="none" />
        </>
      ) : null}

      {labelIndexes.map((i) => {
        const ts = pairedSorted[i].t;
        return (
          <SvgText
            key={`lb-${ts}-${i}`}
            x={xs[i]}
            y={chartHeight - 4}
            fill="#888"
            fontSize={9}
          >
            {formatLabel(ts)}
          </SvgText>
        );
      })}
    </Svg>
  );
}

export default function SubscriptionTrendChart({
  points,
  totalAmount,
  periodDeltaLabel,
  chartViewportWidth,
  chartHeight = 200,
  lineColor = SUBSCRIPTION_CHART_LINE,
  textColor,
  loading,
  emptyTitle,
  emptySubtitle,
  footnote,
  interval = 'daily',
}) {
  const scrollRef = useRef(null);
  const trendDelta = seriesDelta(points);
  const hasData = points.length > 0;

  const chartScrollWidth = useMemo(() => {
    const n = points.length;
    if (n <= 1) return chartViewportWidth;
    return Math.round(Math.max(chartViewportWidth, 16 + (n - 1) * CHART_POINT_GAP));
  }, [chartViewportWidth, points.length]);

  useEffect(() => {
    if (!hasData || chartScrollWidth <= chartViewportWidth) return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        x: Math.max(chartScrollWidth - chartViewportWidth, 0),
        animated: false,
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [hasData, chartScrollWidth, chartViewportWidth, points]);

  if (loading) {
    return (
      <View style={styles.emptyChart}>
        <Ionicons name="hourglass-outline" size={48} color={textColor} />
        <Text style={[styles.emptyChartText, { color: textColor }]}>{emptyTitle}</Text>
      </View>
    );
  }

  if (!hasData) {
    return (
      <View style={styles.emptyChart}>
        <Ionicons name="bar-chart-outline" size={48} color="#ccc" />
        <Text style={[styles.emptyChartText, { color: textColor }]}>{emptyTitle}</Text>
        {emptySubtitle ? (
          <Text style={[styles.emptyChartSubtext, { color: textColor }]}>{emptySubtitle}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <>
      <View style={styles.metricRow}>
        <View style={[styles.metricCard, { borderColor: `${lineColor}33` }]}>
          <Text style={[styles.metricValue, { color: lineColor }]}>
            {formatSupportUsd(totalAmount)}
          </Text>
          <Text style={styles.metricLabel}>Period earnings</Text>
          <View
            style={[
              styles.deltaPill,
              {
                backgroundColor:
                  trendDelta >= 0 ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)',
              },
            ]}
          >
            <Ionicons
              name={trendDelta >= 0 ? 'arrow-up' : 'arrow-down'}
              size={10}
              color={trendDelta >= 0 ? '#059669' : '#dc2626'}
            />
            <Text
              style={[
                styles.deltaText,
                { color: trendDelta >= 0 ? '#059669' : '#dc2626' },
              ]}
              numberOfLines={1}
            >
              {`${trendDelta >= 0 ? '+' : '-'}${formatSupportUsd(Math.abs(trendDelta))} ${periodDeltaLabel}`}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: lineColor }]} />
          <Text style={styles.legendText}>Subscription earnings</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator
        style={styles.scrollViewport}
        contentContainerStyle={styles.scrollContent}
      >
        <SubscriptionTrendSvg
          points={points}
          chartWidth={chartScrollWidth}
          chartHeight={chartHeight}
          lineColor={lineColor}
          interval={interval}
        />
      </ScrollView>

      {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 8,
  },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deltaText: {
    fontSize: 10,
    fontWeight: '700',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  scrollViewport: {
    marginTop: 4,
    alignSelf: 'stretch',
  },
  scrollContent: {
    alignItems: 'flex-start',
    paddingLeft: 8,
    paddingRight: 8,
  },
  footnote: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 10,
    lineHeight: 15,
  },
  emptyChart: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyChartText: {
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.6,
    marginTop: 12,
  },
  emptyChartSubtext: {
    fontSize: 13,
    opacity: 0.4,
    marginTop: 4,
    textAlign: 'center',
  },
});
