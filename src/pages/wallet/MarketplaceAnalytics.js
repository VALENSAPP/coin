import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Svg, { Polyline, Circle, Line as SvgLine } from 'react-native-svg';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n';
import { getMarketplaceAnalytics } from '../../services/myCloset';
import { formSurfaces, withAlpha } from '../../utils/closetTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_HEIGHT = 150;
const CHART_TOP_PADDING = 24; // room for the tooltip bubble above the highest point

// ── Parse the /dashboard/marketPlaceAnalytics payload into UI-friendly shapes ──
// Expected shape:
// {
//   range, fromDate, toDate,
//   performance: [{ date: 'Jun 30', views: 0 }, ...],
//   summary: { totalViews, totalLikes, totalOrders, totalRevenue },
//   changes: { viewsPercent, likesPercent, ordersPercent, revenuePercent },
//   topPerformingItem: { id, name, image, price, orderCount, likeCount, quantitySoldInRange }
// }
export const parseMarketplaceAnalyticsResponse = (response) => {
    const data = response?.data?.data ?? response?.data ?? response ?? {};

    const performance = Array.isArray(data?.performance) ? data.performance : [];
    const points = performance.map((p) => ({
        label: p?.date ?? '',
        value: Number(p?.views) || 0,
    }));

    const summary = data?.summary ?? {};
    const changes = data?.changes ?? {};
    const topItem = data?.topPerformingItem ?? null;

    return {
        points,
        summary: {
            totalViews: Number(summary?.totalViews) || 0,
            totalLikes: Number(summary?.totalLikes) || 0,
            totalOrders: Number(summary?.totalOrders) || 0,
            totalRevenue: Number(summary?.totalRevenue) || 0,
        },
        changes: {
            viewsPercent: changes?.viewsPercent,
            likesPercent: changes?.likesPercent,
            ordersPercent: changes?.ordersPercent,
            revenuePercent: changes?.revenuePercent,
        },
        topItem,
    };
};

const formatDelta = (percent) => {
    if (percent == null || Number.isNaN(Number(percent))) return null;
    const value = Number(percent);
    if (value === 0) return '0%';
    return `${value > 0 ? '+' : ''}${value}%`;
};

const formatMoney = (value) => `$${Number(value ?? 0).toFixed(0)}`;

// ── Small SVG line chart with a tap-to-reveal tooltip, mirrors the look of ──
// ── SubscriptionTrendChart but scoped down for this screen. ─────────────────
const PerformanceChart = ({ points, lineColor, textColor, mutedColor, isDarkMode }) => {
    const [containerWidth, setContainerWidth] = useState(SCREEN_WIDTH - 64);
    const [activeIndex, setActiveIndex] = useState(
        points.length ? points.length - 1 : null,
    );

    useEffect(() => {
        // Keep the tooltip pinned to the latest point whenever fresh data arrives
        setActiveIndex(points.length ? points.length - 1 : null);
    }, [points]);

    if (!points.length) {
        return (
            <View style={styles.emptyChart}>
                <Ionicons name="stats-chart-outline" size={28} color={mutedColor || textColor} />
                <Text style={[styles.emptyChartText, { color: mutedColor || textColor }]}>
                    No data yet
                </Text>
            </View>
        );
    }

    const maxValue = Math.max(1, ...points.map((p) => p.value));
    const usableWidth = containerWidth - 16;
    const stepX = points.length > 1 ? usableWidth / (points.length - 1) : 0;

    const coords = points.map((p, i) => {
        const x = 8 + i * stepX;
        const y =
            CHART_TOP_PADDING +
            (CHART_HEIGHT - CHART_TOP_PADDING - 10) * (1 - p.value / maxValue);
        return { x, y, ...p };
    });

    const polylineStr = coords.map((c) => `${c.x},${c.y}`).join(' ');
    const active = activeIndex != null ? coords[activeIndex] : null;
    const inactiveDotFill = isDarkMode ? '#1E1E1E' : '#fff';
    const baselineStroke = isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(128,128,128,0.15)';

    return (
        <View
            style={styles.chartWrap}
            onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        >
            {active ? (
                <View
                    pointerEvents="none"
                    style={[
                        styles.tooltip,
                        {
                            left: Math.min(
                                Math.max(active.x - 46, 0),
                                containerWidth - 92,
                            ),
                            backgroundColor: isDarkMode ? '#0f172a' : '#1f2937',
                        },
                    ]}
                >
                    <Text style={styles.tooltipTitle}>{active.label}</Text>
                    <Text style={styles.tooltipValue}>Views: {active.value}</Text>
                </View>
            ) : null}

            <Svg width={containerWidth} height={CHART_HEIGHT}>
                {/* baseline */}
                <SvgLine
                    x1={0}
                    y1={CHART_HEIGHT - 10}
                    x2={containerWidth}
                    y2={CHART_HEIGHT - 10}
                    stroke={baselineStroke}
                    strokeWidth={1}
                />
                <Polyline
                    points={polylineStr}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />
                {coords.map((c, i) => (
                    <Circle
                        key={i}
                        cx={c.x}
                        cy={c.y}
                        r={activeIndex === i ? 5 : 3}
                        fill={activeIndex === i ? lineColor : inactiveDotFill}
                        stroke={lineColor}
                        strokeWidth={2}
                    />
                ))}
            </Svg>

            {/* Transparent tap targets, one per point, positioned over the SVG */}
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                {coords.map((c, i) => (
                    <TouchableOpacity
                        key={i}
                        onPress={() => setActiveIndex(i)}
                        style={{
                            position: 'absolute',
                            left: c.x - 14,
                            top: 0,
                            width: 28,
                            height: CHART_HEIGHT,
                        }}
                    />
                ))}
            </View>

            <View style={styles.chartAxisRow}>
                {coords.map((c, i) => (
                    <Text
                        key={i}
                        style={[
                            styles.chartAxisLabel,
                            { color: mutedColor || textColor, width: Math.max(stepX, 1) },
                        ]}
                        numberOfLines={1}
                    >
                        {i === 0 || i === coords.length - 1 || i === activeIndex
                            ? c.label
                            : ''}
                    </Text>
                ))}
            </View>
        </View>
    );
};

const StatRow = ({ label, value, delta, text, mutedColor, dividerColor }) => {
    const isNegative = typeof delta === 'string' && delta.startsWith('-');
    return (
        <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: mutedColor || text }]}>{label}</Text>
            <View style={styles.statValueRow}>
                <Text style={[styles.statValue, { color: text }]}>{value}</Text>
                {delta ? (
                    <View style={styles.deltaPill}>
                        <Ionicons
                            name={isNegative ? 'arrow-down' : 'arrow-up'}
                            size={11}
                            color={isNegative ? '#dc2626' : '#16a34a'}
                        />
                        <Text
                            style={[
                                styles.deltaText,
                                { color: isNegative ? '#dc2626' : '#16a34a' },
                            ]}
                        >
                            {delta.replace(/^[+-]/, '')}
                        </Text>
                    </View>
                ) : null}
            </View>
        </View>
    );
};

export default function MarketplaceAnalytics({ navigation, route }) {
    const { text, bgStyle, cardStyle, card, border, mutedText, accent } = useAppTheme();
    const { isDarkMode } = useThemeContext();
    const surfaces = formSurfaces(isDarkMode);
    const { t } = useLanguage();

    const initialRange = route?.params?.range === 'monthly' ? 'monthly' : 'weekly';
    const [range, setRange] = useState(initialRange);
    const [loading, setLoading] = useState(false);
    const [points, setPoints] = useState([]);
    const [summary, setSummary] = useState(null);
    const [changes, setChanges] = useState(null);
    const [topItem, setTopItem] = useState(null);

    const fetchAnalytics = useCallback(async (selectedRange) => {
        setLoading(true);
        try {
            const response = await getMarketplaceAnalytics(selectedRange);
            const parsed = parseMarketplaceAnalyticsResponse(response);
            setPoints(parsed.points);
            setSummary(parsed.summary);
            setChanges(parsed.changes);
            setTopItem(parsed.topItem);
        } catch (error) {
            console.error('Error fetching marketplace analytics:', error);
            setPoints([]);
            setSummary(null);
            setChanges(null);
            setTopItem(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAnalytics(range);
    }, [range, fetchAnalytics]);

    const rangeLabel =
        range === 'weekly' ? t('marketplaceAnalytics.thisWeek') : t('marketplaceAnalytics.thisMonth');

    const chartLineColor = isDarkMode ? '#ffffff' : (accent || text);
    const muted = mutedText || surfaces.mutedColor;
    const dividerColor = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(128,128,128,0.12)';

    const statRows = useMemo(
        () => [
            {
                key: 'views',
                label: t('marketplaceAnalytics.totalViews'),
                value: String(summary?.totalViews ?? 0),
                delta: formatDelta(changes?.viewsPercent),
            },
            {
                key: 'likes',
                label: t('marketplaceAnalytics.totalLikes'),
                value: String(summary?.totalLikes ?? 0),
                delta: formatDelta(changes?.likesPercent),
            },
            {
                key: 'orders',
                label: t('marketplaceAnalytics.orders'),
                value: String(summary?.totalOrders ?? 0),
                delta: formatDelta(changes?.ordersPercent),
            },
            {
                key: 'revenue',
                label: t('marketplaceAnalytics.revenue'),
                value: formatMoney(summary?.totalRevenue),
                delta: formatDelta(changes?.revenuePercent),
            },
        ],
        [summary, changes, t],
    );

    return (
        <View style={[styles.safe, bgStyle]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation?.goBack?.()} hitSlop={10}>
                    <Ionicons name="chevron-back" size={24} color={text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: text }]}>
                    {t('marketplaceAnalytics.title')}
                </Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
            >
                <View
                    style={[
                        styles.card,
                        cardStyle,
                        {
                            backgroundColor: card || surfaces.listSurface,
                            borderColor: border || surfaces.listBorder,
                        },
                    ]}
                >
                    <View style={styles.cardHeaderRow}>
                        <Text style={[styles.cardTitle, { color: text }]}>
                            {t('marketplaceAnalytics.performance')}
                        </Text>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() =>
                                setRange((prev) => (prev === 'weekly' ? 'monthly' : 'weekly'))
                            }
                            style={[
                                styles.rangePill,
                                {
                                    backgroundColor: withAlpha(accent || text, isDarkMode ? 0.28 : 0.1),
                                },
                            ]}
                        >
                            <Text style={[styles.rangePillText, { color: text }]}>
                                {rangeLabel} ▾
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.emptyChart}>
                            <ActivityIndicator color={text} />
                        </View>
                    ) : (
                        <PerformanceChart
                            points={points}
                            lineColor={chartLineColor}
                            textColor={text}
                            mutedColor={muted}
                            isDarkMode={isDarkMode}
                        />
                    )}
                </View>

                <View
                    style={[
                        styles.card,
                        cardStyle,
                        {
                            paddingVertical: 4,
                            backgroundColor: card || surfaces.listSurface,
                            borderColor: border || surfaces.listBorder,
                        },
                    ]}
                >
                    {statRows.map((row, idx) => (
                        <React.Fragment key={row.key}>
                            <StatRow
                                label={row.label}
                                value={row.value}
                                delta={row.delta}
                                text={text}
                                mutedColor={muted}
                            />
                            {idx < statRows.length - 1 && (
                                <View style={[styles.divider, { backgroundColor: dividerColor }]} />
                            )}
                        </React.Fragment>
                    ))}
                </View>

                <Text style={[styles.sectionTitle, { color: text }]}>
                    {t('marketplaceAnalytics.topPerformingItem')}
                </Text>
                <View
                    style={[
                        styles.card,
                        cardStyle,
                        styles.topItemCard,
                        {
                            backgroundColor: card || surfaces.listSurface,
                            borderColor: border || surfaces.listBorder,
                        },
                    ]}
                >
                    {loading ? (
                        <ActivityIndicator color={text} />
                    ) : topItem ? (
                        <>
                            <View
                                style={[
                                    styles.topItemThumb,
                                    {
                                        backgroundColor: withAlpha(
                                            accent || text,
                                            isDarkMode ? 0.2 : 0.08,
                                        ),
                                    },
                                ]}
                            >
                                {topItem.image ? (
                                    <Image source={{ uri: topItem.image }} style={styles.topItemImage} />
                                ) : (
                                    <Ionicons name="shirt-outline" size={26} color={text} />
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.topItemName, { color: text }]} numberOfLines={1}>
                                    {topItem.name}
                                </Text>
                                <Text style={[styles.topItemPrice, { color: text }]}>
                                    ${Number(topItem.price ?? 0).toFixed(2)}
                                </Text>
                                <Text style={[styles.topItemMeta, { color: muted }]}>
                                    {t('marketplaceAnalytics.viewsLikesOrders', {
                                        views: summary?.totalViews ?? 0,
                                        likes: topItem.likeCount ?? 0,
                                        orders: topItem.orderCount ?? 0,
                                    })}
                                </Text>
                            </View>
                        </>
                    ) : (
                        <Text style={[styles.topItemMeta, { color: muted }]}>
                            {t('marketplaceAnalytics.noTopItem')}
                        </Text>
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, paddingTop: 45 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 15,
    },
    headerTitle: { fontSize: 17, fontWeight: '700' },
    scroll: { paddingHorizontal: 16, paddingTop: 8 },

    card: {
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
        borderWidth: StyleSheet.hairlineWidth,
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardTitle: { fontSize: 15, fontWeight: '700' },
    rangePill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    rangePillText: { fontSize: 12, fontWeight: '600' },

    chartWrap: { width: '100%' },
    chartAxisRow: { flexDirection: 'row', marginTop: 2 },
    chartAxisLabel: { fontSize: 9, fontWeight: '500', textAlign: 'center', paddingEnd: 15 },

    emptyChart: {
        height: CHART_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyChartText: { fontSize: 13, opacity: 0.5, marginTop: 8 },

    tooltip: {
        position: 'absolute',
        top: -4,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        zIndex: 5,
        width: 92,
    },
    tooltipTitle: { color: '#fff', fontSize: 11, fontWeight: '700' },
    tooltipValue: { color: '#e5e7eb', fontSize: 10, marginTop: 1 },

    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    statLabel: { fontSize: 14, fontWeight: '700' },
    statValueRow: { flexDirection: 'row', alignItems: 'center' },
    statValue: { fontSize: 16, fontWeight: '700', marginRight: 8 },
    deltaPill: { flexDirection: 'row', alignItems: 'center' },
    deltaText: { fontSize: 12, fontWeight: '700', marginLeft: 2 },
    divider: { height: 1 },

    sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
    topItemCard: { flexDirection: 'row', alignItems: 'center' },
    topItemThumb: {
        width: 56,
        height: 56,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        overflow: 'hidden',
    },
    topItemImage: { width: '100%', height: '100%' },
    topItemName: { fontSize: 14, fontWeight: '700' },
    topItemPrice: { fontSize: 13, fontWeight: '600', marginTop: 2 },
    topItemMeta: { fontSize: 11, marginTop: 4 },
});
