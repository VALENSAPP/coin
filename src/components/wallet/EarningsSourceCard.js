import React, { memo, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import Svg, { Path, Rect, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  formatEarningsPercent,
  formatEarningsUsd,
} from '../../utils/earningsGraph';
import { useAppTheme } from '../../theme/useApptheme';

const CHART_WIDTH = 88;
const CHART_HEIGHT = 44;

const MiniBarChart = ({ points = [], color = '#7C3AED' }) => {
  const values = points.map(p => Number(p.value) || 0);
  const max = Math.max(...values, 1);
  const barCount = Math.max(values.length, 1);
  const gap = 3;
  const barWidth = Math.max(4, (CHART_WIDTH - gap * (barCount - 1)) / barCount);

  return (
    <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
      {values.map((value, index) => {
        const h = Math.max(3, (value / max) * (CHART_HEIGHT - 4));
        const x = index * (barWidth + gap);
        const y = CHART_HEIGHT - h;
        return (
          <Rect
            key={`bar-${index}`}
            x={x}
            y={y}
            width={barWidth}
            height={h}
            rx={2}
            fill={color}
            opacity={0.35 + (0.65 * (index + 1)) / barCount}
          />
        );
      })}
    </Svg>
  );
};

const MiniLineChart = ({ points = [], color = '#DB2777', filled = false }) => {
  const values = points.map(p => Number(p.value) || 0);
  if (values.length === 0) {
    return (
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Path
          d={`M0 ${CHART_HEIGHT / 2} L${CHART_WIDTH} ${CHART_HEIGHT / 2}`}
          stroke={color}
          strokeWidth={2}
          opacity={0.35}
        />
      </Svg>
    );
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const stepX = values.length > 1 ? CHART_WIDTH / (values.length - 1) : CHART_WIDTH;

  const coords = values.map((value, index) => {
    const x = index * stepX;
    const y = CHART_HEIGHT - ((value - min) / range) * (CHART_HEIGHT - 8) - 4;
    return { x, y };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');

  const areaPath = filled
    ? `${linePath} L${CHART_WIDTH} ${CHART_HEIGHT} L0 ${CHART_HEIGHT} Z`
    : null;

  return (
    <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
      {filled ? (
        <Defs>
          <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.35" />
            <Stop offset="1" stopColor={color} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>
      ) : null}
      {areaPath ? <Path d={areaPath} fill="url(#areaFill)" /> : null}
      <Path
        d={linePath}
        stroke={color}
        strokeWidth={2.2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {coords.map((c, index) => (
        <Circle
          key={`pt-${index}`}
          cx={c.x}
          cy={c.y}
          r={2.4}
          fill={color}
        />
      ))}
    </Svg>
  );
};

const EarningsSourceCard = memo(({
  title,
  icon,
  accentColor = '#7C3AED',
  chartType = 'bars',
  amount = 0,
  percentage = 0,
  points = [],
  footerLabel = '',
  loading = false,
  onPress,
  width,
}) => {
  const { text, cardStyle } = useAppTheme();
  const mutedText = `${text}99`;

  const chartPoints = useMemo(() => {
    if (Array.isArray(points) && points.length > 0) return points;
    return Array.from({ length: 7 }, (_, i) => ({ value: 0, timestamp: i }));
  }, [points]);

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.88 : 1}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.card, cardStyle, { width, borderColor: `${text}22` }]}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, { backgroundColor: `${text}14` }]}>
          <Ionicons name={icon} size={16} color={text} />
        </View>
        <View style={styles.chartWrap}>
          {loading ? (
            <ActivityIndicator size="small" color={accentColor} />
          ) : chartType === 'line' || chartType === 'area' ? (
            <MiniLineChart
              points={chartPoints}
              color={accentColor}
              filled={chartType === 'area'}
            />
          ) : (
            <MiniBarChart points={chartPoints} color={accentColor} />
          )}
        </View>
      </View>

      <Text style={[styles.title, { color: text }]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[styles.amount, { color: text }]}>
        {formatEarningsUsd(amount)}
      </Text>
      <Text style={[styles.percent, { color: mutedText }]}>
        {formatEarningsPercent(percentage)}
      </Text>

      {footerLabel ? (
        <View style={[styles.footer, { borderTopColor: `${text}22` }]}>
          <Text style={[styles.footerText, { color: mutedText }]} numberOfLines={1}>
            {footerLabel}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={mutedText} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
});

EarningsSourceCard.displayName = 'EarningsSourceCard';

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: '#fff',
    padding: 12,
    minHeight: 168,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartWrap: {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  amount: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  percent: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 8,
  },
  footer: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    marginRight: 4,
  },
});

export default EarningsSourceCard;
