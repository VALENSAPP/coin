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
import { subscriptionEarningGraph, totalSupport, transationActivity } from '../../services/wallet';
import { useAppTheme } from '../../theme/useApptheme';
import { getUserCredentials } from '../../services/post';
import { useLanguage } from '../../i18n';
import HexAvatar from '../../components/home/story.js/HexAvatar';
import { resolveTransactionAmount } from '../../utils/transactionAmount';
import SubscriptionTrendChart, {
    parseSubscriptionGraphResponse,
    SUBSCRIPTION_CHART_LINE,
} from '../../components/wallet/SubscriptionTrendChart';

const { width } = Dimensions.get('window');
const CHART_VIEWPORT_WIDTH = width - 80;
const RECENT_TX_PREVIEW_LIMIT = 5;

const PERIOD_MAP = {
    Daily: 'daily',
    Weekly: 'weekly',
    Monthly: 'monthly',
};

const PERIOD_DELTA_LABEL = {
    Daily: 'vs prior day',
    Weekly: 'vs last week',
    Monthly: 'vs last month',
};

const pickFirst = (...values) =>
    values.find((value) => value !== undefined && value !== null && value !== '');

const resolveTransactionUserId = (tx) =>
    pickFirst(
        tx?.userId,
        tx?.senderId,
        tx?.payerId,
        tx?.buyerId,
        tx?.fromUserId,
        tx?.user?.id,
        tx?.user?._id,
        tx?.user?.userId,
        '',
    );

const extractTransactions = (response) => {
    const raw =
        response?.data?.transactions ||
        response?.data?.data?.transactions ||
        response?.data?.data ||
        response?.data ||
        [];
    return Array.isArray(raw) ? raw : [];
};

// ── Enrich transactions with user profile (name + image) ─────────────────────
const enrichTransactionsWithProfiles = async (transactions) => {
    const uniqueUserIds = [
        ...new Set(transactions.map(resolveTransactionUserId).filter(Boolean).map(String)),
    ];

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

    return transactions.map((tx) => {
        const userId = resolveTransactionUserId(tx);
        return {
            ...tx,
            userId: userId || tx.userId,
            _profile: userId ? profileMap[userId] ?? null : null,
        };
    });
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

    const [chartPeriod, setChartPeriod] = useState('Daily');
    const [graphData, setGraphData] = useState([]);
    const [graphTotalAmount, setGraphTotalAmount] = useState(0);
    const [graphLoading, setGraphLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [totalRevenue, setTotalRevenue] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [revenueLoading, setRevenueLoading] = useState(false);

    const walletScreenGradient = isBusinessProfile
        ? ['#C9A15a', '#f8f2fd']
        : ['#513189', '#f8f2fd'];

    const walletIllustrationGradient = isBusinessProfile
        ? ['#8A6B2C', '#E0C06E']
        : ['#5F348D', '#9A68D2'];

    // ── Fetch graph ────────────────────────────────────────────────────────────
    const fetchGraph = useCallback(async () => {
        setGraphLoading(true);
        try {
            const interval = PERIOD_MAP[chartPeriod] ?? 'daily';
            const response = await subscriptionEarningGraph({ interval });
            console.log('Subscription graph response chcek this as oii chcek date s:', response);
            const { points, totalAmount } = parseSubscriptionGraphResponse(response, interval);
            setGraphData(points);
            setGraphTotalAmount(totalAmount);
        } catch (error) {
            console.error('Error fetching subscription earning graph:', error);
            setGraphData([]);
            setGraphTotalAmount(0);
        } finally {
            setGraphLoading(false);
        }
    }, [chartPeriod]);

    // ── Fetch revenue + enrich transactions with profiles ─────────────────────
    const fetchRevenue = useCallback(async () => {
        setRevenueLoading(true);
        try {
            const [supportRes, activityRes] = await Promise.allSettled([
                totalSupport({ params: { page: 1 } }),
                transationActivity({ params: { page: 1, limit: RECENT_TX_PREVIEW_LIMIT } }),
            ]);

            if (supportRes.status === 'fulfilled') {
                const data = supportRes.value?.data ?? supportRes.value;
                setTotalRevenue(Number(data?.totalAmount) || 0);
            } else {
                setTotalRevenue(0);
            }

            if (activityRes.status === 'fulfilled') {
                const rawTransactions = extractTransactions(activityRes.value);
                const enriched = await enrichTransactionsWithProfiles(rawTransactions);
                setTransactions(enriched);
            } else if (supportRes.status === 'fulfilled') {
                const fallbackTransactions = extractTransactions(supportRes.value).map((tx) => ({
                    ...tx,
                    type: tx?.type || 'credit',
                }));
                const enriched = await enrichTransactionsWithProfiles(fallbackTransactions);
                setTransactions(enriched);
            } else {
                setTransactions([]);
            }
        } catch (error) {
            console.error('Error fetching subscription revenue:', error);
            setTotalRevenue(0);
            setTransactions([]);
        } finally {
            setRevenueLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRevenue();
    }, [fetchRevenue]);

    useEffect(() => {
        fetchGraph();
    }, [fetchGraph]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([fetchGraph(), fetchRevenue()]);
        setRefreshing(false);
    }, [fetchGraph, fetchRevenue]);

    // ── Resolve display name for a transaction ─────────────────────────────────
    const getDisplayName = (tx) => {
        const profile = tx._profile;
        if (profile?.displayName) return profile.displayName;
        if (profile?.userName) return `@${profile.userName}`;
        if (tx.userId) return `@${tx.userId.slice(0, 8)}…`;
        return t('revenue.unknownUser');
    };

    const handleTransactionProfilePress = useCallback((tx) => {
        const userId = String(tx?.userId || '').trim();
        if (!userId) return;

        navigation.navigate('HomeMain', {
            screen: 'UsersProfile',
            params: {
                userId,
                userName: tx?._profile?.userName,
                returnTo: { tab: 'wallet', screen: 'RevenueFromSubscriptions' }
            },
        });
    }, [navigation]);

    const handleViewAllTransactions = useCallback(() => {
        navigation.navigate('TransactionActivity', {
            returnTo: { tab: 'wallet', screen: 'RevenueFromSubscriptions' },
        });
    }, [navigation]);

    const previewTransactions = transactions.slice(0, RECENT_TX_PREVIEW_LIMIT);

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
                    <View style={[styles.chartContainer, { shadowColor: text }]}>
                        <Text style={[styles.chartLabel, { color: text, marginBottom: 12 }]}>
                            {t('revenue.subscriptionEarnings')}
                        </Text>
                        <SubscriptionTrendChart
                            points={graphData}
                            totalAmount={graphTotalAmount}
                            periodDeltaLabel={PERIOD_DELTA_LABEL[chartPeriod] ?? 'vs prior period'}
                            chartViewportWidth={CHART_VIEWPORT_WIDTH}
                            lineColor={SUBSCRIPTION_CHART_LINE}
                            textColor={text}
                            interval={PERIOD_MAP[chartPeriod] ?? 'daily'}
                            loading={graphLoading}
                            emptyTitle={
                                graphLoading ? t('revenue.loadingChart') : t('revenue.noDataAvailable')
                            }
                            emptySubtitle={graphLoading ? undefined : t('revenue.checkBackLater')}
                            footnote="Swipe the chart sideways when points are crowded."
                        />
                    </View>
                </View>

                {/* ── Recent Transactions ── */}
                <View style={[styles.section, bgStyle]}>
                    <View style={styles.txHeader}>
                        <Text style={[styles.sectionTitle, { color: text, marginBottom: 0 }]}>
                            {t('revenue.recentTransactions')}
                        </Text>
                        {transactions.length > 0 ? (
                            <TouchableOpacity
                                onPress={handleViewAllTransactions}
                                accessibilityRole="button"
                                accessibilityLabel={t('valensWallet.viewAll')}
                            >
                                <Text style={[styles.viewAll, { color: text }]}>{t('valensWallet.viewAll')}</Text>
                            </TouchableOpacity>
                        ) : null}
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
                        previewTransactions.map((tx) => {
                            const { formatted, amountTone } = resolveTransactionAmount(tx);
                            const amountColor = amountTone === 'negative' ? '#EF4444' : '#22C55E';

                            return (
                            <TouchableOpacity key={tx.id ?? tx._id} style={styles.txRow} activeOpacity={tx.userId ? 0.75 : 1} onPress={() => handleTransactionProfilePress(tx)} disabled={!tx.userId}>
                                {/* ── Avatar: real image or fallback icon ── */}
                                <View style={styles.txAvatar}>
                                    <HexAvatar
                                        uri={tx._profile?.image ?? ''}
                                        size={44}
                                        borderWidth={1.5}
                                        borderColor={text}
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
                                    <Text style={[styles.txAmount, { color: amountColor }]}>
                                        {formatted}
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
                            </TouchableOpacity>
                            );
                        })
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
    chartContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 3,
    },
    chartLabel: { fontSize: 14, opacity: 0.7 },
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
    txAmount: { fontSize: 14, fontWeight: '700' },
    txDate: { fontSize: 10, opacity: 0.5, marginTop: 2 },
});
