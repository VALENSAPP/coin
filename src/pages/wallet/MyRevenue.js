import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    TouchableOpacity,
    Dimensions,
    RefreshControl,
    Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { LineChart } from 'react-native-wagmi-charts';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { subscriptionEarningGraph, totalSupport } from '../../services/wallet';
import { useAppTheme } from '../../theme/useApptheme';
import { getUserCredentials } from '../../services/post';
import { useLanguage } from '../../i18n';

const { width } = Dimensions.get('window');

const PERIOD_MAP = {
    Daily: 'daily',
    Weekly: 'weekly',
    Monthly: 'monthly',
};

const mapGraphResponse = (response) => {
    const root = response?.data?.data ?? response?.data ?? response;

    const raw = Array.isArray(root?.points)
        ? root.points
        : Array.isArray(root)
            ? root
            : root?.graph ??
            root?.history ??
            root?.series ??
            root?.items ??
            (Array.isArray(root?.data) ? root.data : null);

    if (!Array.isArray(raw) || raw.length === 0) return [];

    return raw
        .map((item, index) => {
            const dateStr =
                item?.date ?? item?.label ?? item?.day ?? item?.time ?? item?.createdAt;

            const val = Number(
                item?.amount ?? item?.earning ?? item?.revenue ??
                item?.totalAmount ?? item?.value ?? item?.count ?? 0,
            );

            let ts;
            if (dateStr != null && String(dateStr).length > 0) {
                ts = new Date(dateStr).getTime();
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
};

// ── Enrich transactions with user profile (name + image) ─────────────────────
const enrichTransactionsWithProfiles = async (transactions) => {
    const uniqueUserIds = [...new Set(transactions.map((tx) => tx.userId).filter(Boolean))];

    const profileResults = await Promise.allSettled(
        uniqueUserIds.map((userId) => getUserCredentials(userId))
    );

    const profileMap = {};
    uniqueUserIds.forEach((userId, index) => {
        const result = profileResults[index];
        if (result.status === 'fulfilled') {
            const profileData =
                result.value?.data?.data ?? result.value?.data ?? result.value;
            profileMap[userId] = {
                displayName: profileData?.displayName ?? profileData?.userName ?? null,
                userName: profileData?.userName ?? null,
                image: profileData?.image ?? null,
            };
        }
    });

    return transactions.map((tx) => ({
        ...tx,
        _profile: profileMap[tx.userId] ?? null,
    }));
};

// ── Transaction Avatar ────────────────────────────────────────────────────────
const TxAvatar = ({ imageUrl, text, size = 44 }) => {
    const [error, setError] = useState(false);

    if (imageUrl && !error) {
        return (
            <Image
                source={{ uri: imageUrl }}
                style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: '#e2e8f0',
                }}
                onError={() => setError(true)}
            />
        );
    }

    return <Ionicons name="person-circle" size={size} color={text} />;
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function RevenueFromSubscriptions({ navigation, route }) {
    const { isBusinessProfile } = route?.params || {};
    const { bgStyle, text } = useAppTheme();
    const { t } = useLanguage();

    const [period] = useState('This Month');
    const [chartPeriod, setChartPeriod] = useState('Weekly');
    const [graphData, setGraphData] = useState([]);
    const [selectedValue, setSelectedValue] = useState(0);
    const [graphLoading, setGraphLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [totalRevenue, setTotalRevenue] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [revenueLoading, setRevenueLoading] = useState(false);

    const walletScreenGradient = isBusinessProfile
        ? ['#D3B683', '#f8f2fd']
        : ['#513189', '#f8f2fd'];

    const walletIllustrationGradient = isBusinessProfile
        ? ['#8A6B2C', '#E0C06E']
        : ['#5F348D', '#9A68D2'];

    // ── Fetch graph ────────────────────────────────────────────────────────────
    const fetchGraph = useCallback(async () => {
        setGraphLoading(true);
        try {
            const range = PERIOD_MAP[chartPeriod] ?? 'weekly';
            const response = await subscriptionEarningGraph({ range });
            console.log('Subscription Earning Graph Response:', response);
            const points = mapGraphResponse(response);
            if (points.length > 0) {
                setGraphData(points);
                setSelectedValue(points[points.length - 1].value);
            } else {
                setGraphData([]);
                setSelectedValue(0);
            }
        } catch (error) {
            console.error('Error fetching subscription earning graph:', error);
            setGraphData([]);
            setSelectedValue(0);
        } finally {
            setGraphLoading(false);
        }
    }, [chartPeriod]);

    // ── Fetch revenue + enrich transactions with profiles ─────────────────────
    const fetchRevenue = useCallback(async () => {
        setRevenueLoading(true);
        try {
            const response = await totalSupport({ page: 1 });
            console.log('Total Support Response:', response);
            const data = response?.data?.data ?? response?.data ?? response;

            setTotalRevenue(data?.totalAmount ?? 0);

            const rawTransactions = Array.isArray(data?.transactions)
                ? data.transactions
                : [];

            const enriched = await enrichTransactionsWithProfiles(rawTransactions);
            setTransactions(enriched);
        } catch (error) {
            console.error('Error fetching subscription revenue:', error);
            setTotalRevenue(0);
            setTransactions([]);
        } finally {
            setRevenueLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchGraph();
        fetchRevenue();
    }, [fetchGraph, fetchRevenue]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([fetchGraph(), fetchRevenue()]);
        setRefreshing(false);
    }, [fetchGraph, fetchRevenue]);

    const hapticFeedback = (type) => {
        ReactNativeHapticFeedback.trigger(type, {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
        });
    };

    const updateSelectedValue = (point) => {
        if (point && point.value !== undefined) setSelectedValue(point.value);
    };

    const resetSelectedValue = () => {
        if (graphData.length > 0) setSelectedValue(graphData[graphData.length - 1].value);
    };

    const formattedSelected = Number.isFinite(Number(selectedValue))
        ? `$${Number(selectedValue).toFixed(2)}`
        : '$0.00';

    // ── Resolve display name for a transaction ─────────────────────────────────
    const getDisplayName = (tx) => {
        const profile = tx._profile;
        if (profile?.displayName) return profile.displayName;
        if (profile?.userName) return `@${profile.userName}`;
        if (tx.userId) return `@${tx.userId.slice(0, 8)}…`;
        return t('revenue.unknownUser');
    };

    return (
        <SafeAreaView style={[styles.safe, bgStyle]}>
            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[text]}
                        tintColor={text}
                    />
                }
            >
                {/* ── Total Revenue Card ── */}
                <View style={styles.revenueCardWrap}>
                    <LinearGradient
                        colors={walletScreenGradient}
                        start={{ x: -1, y: -1 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.revenueCard}
                    >
                        <View style={styles.revenueContent}>
                            <Text style={[styles.revenueLabel, { color: text }]}>{t('revenue.totalRevenue')}</Text>
                            <Text style={[styles.revenueAmount, { color: text }]}>
                                {revenueLoading ? '…' : `$${Number(totalRevenue).toFixed(2)}`}
                            </Text>
                            <View style={styles.stripeRow}>
                                <Text style={[styles.poweredBy, { color: text }]}>{t('revenue.poweredBy')} </Text>
                                <Text style={[styles.stripeBrand, { color: text }]}>stripe</Text>
                            </View>
                        </View>
                        <View style={styles.walletIllustration}>
                            <LinearGradient
                                colors={walletIllustrationGradient}
                                style={styles.walletGrad}
                            >
                                <Ionicons name="wallet-outline" size={42} color="#fff" />
                                <View style={styles.coinBadge}>
                                    <Text
                                        style={[
                                            styles.coinBadgeText,
                                            { color: walletIllustrationGradient[0] },
                                        ]}
                                    >
                                        $
                                    </Text>
                                </View>
                            </LinearGradient>
                        </View>
                    </LinearGradient>
                </View>

                {/* ── How It Works ── */}
                <View style={[styles.section, bgStyle]}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: text }]}>{t('revenue.howItWorks')}</Text>
                        <View style={styles.instantSplitBox}>
                            <Text style={[styles.instantSplitLabel, { color: text }]}>{t('revenue.instantSplit')}</Text>
                            <View style={styles.splitPercentRow}>
                                <Text style={[styles.splitPct, { color: text }]}>80%</Text>
                                <Text style={[styles.splitPctLabel, { color: text }]}> {t('revenue.toYou')}</Text>
                            </View>
                            <View style={styles.splitPercentRow}>
                                <Text style={[styles.splitPct, { color: text, fontSize: 14 }]}>20%</Text>
                                <Text style={[styles.splitPctLabel, { color: text }]}> {t('revenue.valensFee')}</Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.flowRow}>
                        {[
                            { icon: 'person-outline', label: t('revenue.userSubscribes'), sub: '(Stripe)' },
                            { icon: 'flash-outline', label: t('revenue.instantSplit'), sub: '80% / 20%' },
                            { icon: 'business-outline', label: t('revenue.payoutToCreator'), sub: '(Stripe)' },
                        ].map((step, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && (
                                    <Ionicons
                                        name="arrow-forward"
                                        size={16}
                                        color={text}
                                        style={{ marginTop: -12 }}
                                    />
                                )}
                                <View style={styles.flowStep}>
                                    <View style={styles.flowIcon}>
                                        <Ionicons name={step.icon} size={20} color={text} />
                                    </View>
                                    <Text style={[styles.flowLabel, { color: text }]}>{step.label}</Text>
                                    <Text style={[styles.flowSub, { color: text }]}>{step.sub}</Text>
                                </View>
                            </React.Fragment>
                        ))}
                    </View>
                </View>

                {/* ── Revenue Overview ── */}
                <View style={[styles.section, bgStyle]}>
                    <Text style={[styles.sectionTitle, { color: text, marginBottom: 10 }]}>
                        {t('revenue.revenueOverview')}
                    </Text>
                    <View style={styles.periodSelector}>
                        {['Daily', 'Weekly', 'Monthly'].map((p) => (
                            <TouchableOpacity
                                key={p}
                                style={[
                                    styles.periodButton,
                                    chartPeriod === p && { backgroundColor: text },
                                ]}
                                onPress={() => setChartPeriod(p)}
                            >
                                <Text
                                    style={[
                                        styles.periodButtonText,
                                        chartPeriod === p && styles.periodButtonTextActive,
                                    ]}
                                >
                                    {p}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={styles.chartContainer}>
                        <Text style={[styles.chartPrice, { color: text }]}>{formattedSelected}</Text>
                        <Text style={[styles.chartLabel, { color: text }]}>{t('revenue.subscriptionEarnings')}</Text>

                        {graphData.length > 0 ? (
                            <LineChart.Provider data={graphData}>
                                <LineChart height={200} width={width - 72}>
                                    <LineChart.Path color={text} width={3}>
                                        <LineChart.Gradient color={text} />
                                    </LineChart.Path>
                                    <LineChart.CursorCrosshair
                                        onActivated={() => hapticFeedback('impactLight')}
                                        onEnded={resetSelectedValue}
                                    >
                                        <LineChart.Tooltip>
                                            {({ value }) => {
                                                updateSelectedValue({ value });
                                                return (
                                                    <View style={[styles.tooltipContainer, { backgroundColor: text }]}>
                                                        <Text style={styles.tooltipText}>
                                                            {Number.isFinite(Number(value))
                                                                ? `$${Number(value).toFixed(2)}`
                                                                : '—'}
                                                        </Text>
                                                    </View>
                                                );
                                            }}
                                        </LineChart.Tooltip>
                                        <LineChart.HoverTrap />
                                    </LineChart.CursorCrosshair>
                                </LineChart>
                            </LineChart.Provider>
                        ) : graphLoading ? (
                            <View style={styles.emptyChart}>
                                <Ionicons name="hourglass-outline" size={48} color={text} />
                                <Text style={[styles.emptyChartText, { color: text }]}>{t('revenue.loadingChart')}</Text>
                            </View>
                        ) : (
                            <View style={styles.emptyChart}>
                                <Ionicons name="bar-chart-outline" size={48} color="#ccc" />
                                <Text style={[styles.emptyChartText, { color: text }]}>{t('revenue.noDataAvailable')}</Text>
                                <Text style={[styles.emptyChartSubtext, { color: text }]}>
                                    {t('revenue.checkBackLater')}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* ── Recent Transactions ── */}
                <View style={[styles.section, bgStyle]}>
                    <View style={styles.txHeader}>
                        <Text style={[styles.sectionTitle, { color: text }]}>{t('revenue.recentTransactions')}</Text>
                    </View>

                    {revenueLoading ? (
                        <View style={styles.emptyChart}>
                            <Ionicons name="hourglass-outline" size={32} color={text} />
                            <Text style={[styles.emptyChartText, { color: text }]}>{t('revenue.loading')}</Text>
                        </View>
                    ) : transactions.length === 0 ? (
                        <Text style={[styles.txSub, { color: text, textAlign: 'center', paddingVertical: 16 }]}>
                            {t('revenue.noTransactions')}
                        </Text>
                    ) : (
                        transactions.map((tx) => (
                            <View key={tx.id ?? tx._id} style={styles.txRow}>
                                {/* ── Avatar: real image or fallback icon ── */}
                                <View style={styles.txAvatar}>
                                    <TxAvatar
                                        imageUrl={tx._profile?.image ?? null}
                                        text={text}
                                        size={44}
                                    />
                                </View>

                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.txName, { color: text }]}>
                                        {getDisplayName(tx)}
                                    </Text>
                                    {tx._profile?.userName && tx._profile?.displayName && (
                                        <Text style={[styles.txSub, { color: text }]}>
                                            @{tx._profile.userName}
                                        </Text>
                                    )}
                                </View>

                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.txAmount}>
                                        {tx.currency === 'USD'
                                            ? `+$${Number(tx.amount).toFixed(2)}`
                                            : `+${tx.amount}`}
                                    </Text>
                                    <Text style={[styles.txDate, { color: text }]}>
                                        {tx.createdAt
                                            ? new Date(tx.createdAt).toLocaleString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })
                                            : ''}
                                    </Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    safe: { flex: 1 },
    scroll: { paddingHorizontal: 16, paddingTop: 8 },

    // Period row (top)
    periodRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    periodPicker: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    periodText: { fontSize: 13, fontWeight: '500' },
    periodRange: { fontSize: 12, opacity: 0.7 },

    // Revenue Card — gradient, no hardcoded bg
    revenueCardWrap: { marginBottom: 14 },
    revenueCard: {
        width: '100%',
        borderRadius: 20,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'flex-start',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 180,
    },
    revenueContent: {
        flex: 1,
        paddingRight: 108,
    },
    revenueLabel: { fontSize: 13, opacity: 0.85, marginBottom: 4 },
    revenueAmount: { fontSize: 34, fontWeight: '800', marginBottom: 6 },
    growthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    growthBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#dcfce7',
        borderRadius: 20,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    growthText: { fontSize: 12, color: '#16a34a', fontWeight: '700' },
    growthSub: { fontSize: 11, opacity: 0.8 },
    stripeRow: { flexDirection: 'row', alignItems: 'center' },
    poweredBy: { fontSize: 11, opacity: 0.7 },
    stripeBrand: { fontSize: 14, fontWeight: '800', fontStyle: 'italic' },
    walletIllustration: {
        position: 'absolute',
        top: 20,
        right: 60,
        zIndex: 2,
        elevation: 4,
    },
    walletGrad: {
        position: 'relative',
        width: 78,
        height: 78,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        // overflow: 'visible',
        shadowColor: '#000',
        shadowOpacity: 0.14,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    coinBadge: {
        position: 'absolute',
        right: 12,
        bottom: 5,
        width: 20,
        height: 20,
        borderRadius: 14,
        backgroundColor: '#fef3c7',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    coinBadgeText: {
        fontSize: 18,
        fontWeight: '900',
        lineHeight: 18,
        textAlign: 'center',
        includeFontPadding: false,
    },

    // Sections — no hardcoded backgroundColor; bgStyle applied inline
    section: {
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },

    // How it works
    instantSplitBox: {
        backgroundColor: '#f5f3ff',
        borderRadius: 10,
        padding: 10,
        alignItems: 'flex-start',
    },
    instantSplitLabel: { fontSize: 10, fontWeight: '700', marginBottom: 4 },
    splitPercentRow: { flexDirection: 'row', alignItems: 'baseline' },
    splitPct: { fontSize: 18, fontWeight: '800' },
    splitPctLabel: { fontSize: 12 },
    flowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    flowStep: { alignItems: 'center', flex: 1 },
    flowIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#f5f3ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
    },
    flowLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
    flowSub: { fontSize: 10, opacity: 0.6, textAlign: 'center' },

    // Period toggle — active bg set inline with `text`, so no hardcoded color here
    periodSelector: {
        flexDirection: 'row',
        backgroundColor: 'rgba(128,128,128,0.12)',
        borderRadius: 8,
        padding: 2,
        marginBottom: 12,
    },
    periodButton: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 6,
        borderRadius: 6,
    },
    periodButtonText: { fontSize: 12, color: '#64748b', textAlign: 'center' },
    // active bg = `text` → white text ensures contrast on both light and dark
    periodButtonTextActive: { color: '#fff', fontWeight: '600' },

    // Chart
    chartContainer: { borderRadius: 12, paddingTop: 4 },
    chartPrice: { fontSize: 32, fontWeight: '800', marginBottom: 2 },
    chartLabel: { fontSize: 13, opacity: 0.6, marginBottom: 16 },
    tooltipContainer: { padding: 8, borderRadius: 8 },
    tooltipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    emptyChart: { height: 200, justifyContent: 'center', alignItems: 'center' },
    emptyChartText: { fontSize: 15, fontWeight: '600', opacity: 0.6, marginTop: 12 },
    emptyChartSubtext: { fontSize: 13, opacity: 0.4, marginTop: 4, textAlign: 'center' },

    // Transactions
    txHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    viewAll: { fontSize: 13, fontWeight: '600' },
    txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    txAvatar: { marginRight: 10 },
    txName: { fontSize: 14, fontWeight: '700' },
    txSub: { fontSize: 11, opacity: 0.6 },
    txAmount: { fontSize: 14, fontWeight: '700', color: '#16a34a' },
    txDate: { fontSize: 10, opacity: 0.5, marginTop: 2 },
});
