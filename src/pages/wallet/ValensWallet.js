import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    Platform,
    Alert,
    Image,
    useWindowDimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { useToast } from 'react-native-toast-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

import TradeModal from '../../components/modals/TradeModal';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useAppTheme } from '../../theme/useApptheme';
import { getUserCredentials } from '../../services/post';
import { useWalletConnectSupport } from '../../context/WalletConnectSupportContext';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
    metaMaskRecived,
    totalamount,
    totalMission,
    totalSupport,
} from '../../services/wallet';
import { Metamask } from '../../assets/icons';
import { appKit } from '../../config/AppKitConfig';

const ValensWallet = ({ navigation }) => {
    const [tradeModalVisible, setTradeModalVisible] = useState(false);
    const [portfolioValue, setPortfolioValue] = useState();
    const [portfolioValueNumber, setPortfolioValueNumber] = useState(0);
    const [isBusinessProfile, setIsBusinessProfile] = useState(false);
    const [metaMaskReceivedUsd, setMetaMaskReceivedUsd] = useState(0);
    const [missionEarningsUsd, setMissionEarningsUsd] = useState(0);
    const [subscriptionPaymentsUsd, setSubscriptionPaymentsUsd] = useState(0);
    const [connectedWalletAddress, setConnectedWalletAddress] = useState('');
    const [showAmounts, setShowAmounts] = useState(false);
    const [showTotalBalance, setShowTotalBalance] = useState(false);
    const dispatch = useDispatch();
    const toast = useToast();
    const { bgStyle, text, cardStyle } = useAppTheme();
    const { width: screenWidth } = useWindowDimensions();
    const { openWalletConnect, isConnected: isWalletConnected, address: sessionAddress } =
        useWalletConnectSupport();

    useFocusEffect(
        React.useCallback(() => {
            fetchDashboardData();
        }, [])
    );

    const fetchDashboardData = async () => {
        try {
            dispatch(showLoader());
            const userId = await AsyncStorage.getItem('userId');
            const storedWalletAddress = await AsyncStorage.getItem('walletAddress');
            setConnectedWalletAddress(String(storedWalletAddress || '').trim());

            const [totalRes, userRes, metaRes, missionRes, supportRes] = await Promise.allSettled([
                totalamount(),
                userId ? getUserCredentials(userId) : Promise.resolve(null),
                metaMaskRecived(),
                totalMission(),
                totalSupport(),
            ]);

            if (totalRes.status === 'fulfilled') {
                const response = totalRes.value;
                if (response?.statusCode === 200) {
                    const rawValue =
                        response?.data?.totalAmount ??
                        response?.data?.data?.totalAmount ??
                        response?.data?.totalReceived ??
                        response?.data?.data?.totalReceived ??
                        response?.data?.amount ??
                        response?.data?.data?.amount ??
                        0;
                    const totalValue = Number(rawValue) || 0;
                    setPortfolioValueNumber(totalValue);
                    setPortfolioValue(`$${totalValue.toFixed(2)}`);
                } else if (response?.message) {
                    showToastMessage(toast, 'danger', response.message);
                }
            }

            if (userRes.status === 'fulfilled') {
                const response = userRes.value;
                setIsBusinessProfile(response?.data?.profile !== 'user');
            }

            if (metaRes.status === 'fulfilled') {
                const response = metaRes.value;
                const raw =
                    response?.data?.totalUsd ??
                    response?.data?.totalUSD ??
                    response?.data?.amountUsd ??
                    response?.data?.amountUSD ??
                    response?.data?.totalAmountUsd ??
                    response?.data?.totalAmountUSD ??
                    response?.data?.data?.totalUsd ??
                    response?.data?.data?.totalUSD ??
                    response?.data?.data?.amountUsd ??
                    response?.data?.data?.amountUSD ??
                    response?.data?.data?.totalAmountUsd ??
                    response?.data?.data?.totalAmountUSD ??
                    response?.data?.total ??
                    response?.data?.amount ??
                    response?.data?.data?.total ??
                    response?.data?.data?.amount ??
                    response?.data?.totalAmount ??
                    response?.data?.data?.totalAmount ??
                    0;
                const parsed = Number(raw);
                setMetaMaskReceivedUsd(Number.isFinite(parsed) ? parsed : 0);
            }

            if (missionRes.status === 'fulfilled') {
                const response = missionRes.value;
                const rawValue =
                    response?.data?.totalAmount ??
                    response?.data?.data?.totalAmount ??
                    response?.data?.amount ??
                    response?.data?.data?.amount ??
                    0;
                const parsed = Number(rawValue);
                setMissionEarningsUsd(Number.isFinite(parsed) ? parsed : 0);
            }

            if (supportRes.status === 'fulfilled') {
                const response = supportRes.value;
                const rawValue =
                    response?.data?.totalAmount ??
                    response?.data?.data?.totalAmount ??
                    response?.data?.totalSupportReceived ??
                    response?.data?.totalSupport ??
                    response?.data?.supportedAmount ??
                    response?.data?.amount ??
                    0;
                const parsed = Number(rawValue);
                setSubscriptionPaymentsUsd(Number.isFinite(parsed) ? parsed : 0);
            }


        } catch (error) {
            showToastMessage(
                toast,
                'danger',
                error?.response?.message ?? 'Something went wrong'
            );
        } finally {
            dispatch(hideLoader());
        }
    };


    const formatMoney = (value) => {
        if (typeof value !== 'number' || Number.isNaN(value)) return '$0.00';
        return `$${value.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };

    const maskMoney = (formattedMoney) => {
        if (!formattedMoney) return '$••••';
        const normalized = String(formattedMoney).trim();
        if (!normalized.startsWith('$')) return '••••';
        return '$••••';
    };

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const scale = clamp(screenWidth / 390, 0.86, 1.18);
    const walletImageSize = clamp(Math.round(screenWidth * 0.32), 96, 132);
    const balanceFontSize = clamp(Math.round(40 * scale), 30, 44);

    const displayPortfolioValue = showTotalBalance
        ? (portfolioValue ?? '$0.00')
        : maskMoney(portfolioValue);

    const walletScreenGradient = isBusinessProfile
        ? ['#D3B683', '#fdfcfa']
        : ['#513189', '#f8f2fd'];

    const walletOverviewCards = [
        {
            key: 'mission',
            icon: 'flag-outline',
            title: 'Mission Earnings',
            value: formatMoney(missionEarningsUsd),
            subtitle: 'From mission posts',
        },
        {
            key: 'subs',
            icon: 'diamond-outline',
            title: 'Subscription Payments',
            value: formatMoney(subscriptionPaymentsUsd),
            subtitle: 'From subscribers',
        },
        {
            key: 'donations',
            icon: 'heart-outline',
            title: 'Donations',
            value: '0',
            subtitle: 'From supporters',
        },
        {
            key: 'withdrawn',
            icon: 'business',
            title: 'Total Withdrawn',
            value: '0',
            subtitle: 'All time',
        },
    ];

    const connectedWallet = String(sessionAddress || connectedWalletAddress || '').trim();
    const isMetaMaskConnected = isWalletConnected || !!connectedWallet;
    const metaMaskPreview = connectedWallet
        ? `${connectedWallet.slice(0, 8)}…${connectedWallet.slice(-4)}`
        : 'Not connected';

    const handleDisconnectWallet = async () => {
        try {
            await appKit?.disconnect?.();
            await AsyncStorage.multiRemove(['walletAddress', 'walletChainId', 'walletType']);
            setConnectedWalletAddress('');
            showToastMessage(toast, 'success', 'Wallet disconnected');
        } catch (error) {
            showToastMessage(toast, 'danger', 'Unable to disconnect wallet');
        }
    };

    const handleMetaMaskCardPress = () => {
        if (isMetaMaskConnected) {
            Alert.alert('Disconnect wallet', 'Do you want to disconnect your wallet?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Disconnect', style: 'destructive', onPress: handleDisconnectWallet },
            ]);
            return;
        }
        openWalletConnect();
    };

    const walletConnections = [
        {
            key: 'metamask',
            label: 'Wallet',
            title: 'MetaMask',
            badge: {
                text: isMetaMaskConnected ? 'Connected' : 'Disconnected',
                tone: isMetaMaskConnected ? 'success' : 'muted',
            },
            meta: isMetaMaskConnected ? metaMaskPreview : 'Tap to connect',
            amount: `$ ${Number(metaMaskReceivedUsd || 0).toFixed(2)}`,
            approx: '',
            cta: isMetaMaskConnected ? 'Disconnect MetaMask' : 'Connect MetaMask',
            onPress: handleMetaMaskCardPress,
            leftIcon: { type: 'custom', name: 'metamask' },
        },
    ];


    const recentActivity = [
        {
            key: 'withdrawal',
            icon: 'arrow-down-outline',
            title: 'Withdrawal to Bank',
            subtitle: 'To Chase Bank •••• 5678',
            amount: '-$250.00',
            amountTone: 'negative',
            date: 'Apr 27, 2026 • 10:22 AM',
        },
        {
            key: 'mission',
            icon: 'cash-outline',
            title: 'Mission Earnings',
            subtitle: 'Who won today’s football match?',
            amount: '+$120.50',
            amountTone: 'positive',
            date: 'Apr 26, 2026 • 08:15 PM',
        },
    ];

    return (
        <SafeAreaView style={[styles.container, bgStyle]}>
            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.topCardWrap}>
                    <LinearGradient
                        colors={walletScreenGradient}
                        start={{ x: -8, y: -8 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.topCard, { borderColor: `${text}1a` }]}
                    >
                        <View style={[styles.topCardLeft, { paddingRight: walletImageSize + 24 }]}>
                            <View style={styles.balanceLabelRow}>
                                <Text style={[styles.balanceLabel, { color: `${text}cc` }]}>
                                    Total Balance
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setShowTotalBalance((prev) => !prev)}
                                >
                                    <Ionicons
                                        name={showTotalBalance ? 'eye-outline' : 'eye-off-outline'}
                                        size={16}
                                        color={`${text}cc`}
                                    />
                                </TouchableOpacity>
                            </View>
                            <Text style={[styles.balanceValue, { color: text, fontSize: balanceFontSize }]}>
                                {displayPortfolioValue}
                            </Text>
                            <View style={styles.balanceSubRow}>
                            </View>
                        </View>

                        <View style={styles.topCardRight}>
                            <Image
                                source={require('../../assets/icons/pngicons/newWallet.png')}
                                style={[styles.walletImage, { width: walletImageSize * 1.5, height: walletImageSize * 1.5 }]}
                                resizeMode="contain"
                            />
                        </View>
                    </LinearGradient>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: text }]}>Wallet Overview</Text>

                    <View style={styles.statsGrid}>
                        {walletOverviewCards.map((card) => (
                            <LinearGradient
                                key={card.key}
                                colors={walletScreenGradient}
                                start={{ x: -8, y: -8 }}
                                end={{ x: 1, y: 1 }}
                                style={[styles.statCard, { borderColor: `${text}1a` }]}
                            >
                                {card.key === 'subs' ? (
                                    <MaterialCommunityIcons name="crown" size={22} color={text} style={styles.statIcon} />
                                ) : card.key === 'withdrawn' ? (
                                    <MaterialCommunityIcons name="bank-outline" size={22} color={text} style={styles.statIcon} />
                                ) : (
                                    <Ionicons name={card.icon} size={22} color={text} style={styles.statIcon} />
                                )}

                                <Text style={[styles.statTitle, { color: `${text}cc` }]}>
                                    {card.title}
                                </Text>
                                <Text style={[styles.statValue, { color: text }]}>{card.value}</Text>
                                <Text style={[styles.statSubtitle, { color: `${text}99` }]}>
                                    {card.subtitle}
                                </Text>
                            </LinearGradient>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: text }]}>
                        Wallet Connections
                    </Text>
                    <Text style={[styles.sectionSubtitle, { color: `${text}99` }]}>
                        Manage your linked accounts and wallets
                    </Text>

                    {walletConnections.map((connection) => (
                        <LinearGradient
                            key={connection.key}
                            colors={walletScreenGradient}
                            start={{ x: -8, y: -8 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.connectionCard, { borderColor: `${text}1a` }]}
                        >
                            <View style={styles.connectionTopRow}>
                                <View style={styles.connectionLeft}>
                                    <View
                                        style={[
                                            styles.connectionIconWrap,
                                            { backgroundColor: `${text}0d`, borderColor: `${text}1a` },
                                        ]}
                                    >
                                        {connection.key === 'metamask' ? (
                                            <Metamask width={28} height={28} />
                                        ) : connection.leftIcon.type === 'image' ? (
                                            <Image
                                                source={connection.leftIcon.source}
                                                style={styles.connectionIconImage}
                                            />
                                        ) : (
                                            <Ionicons
                                                name={connection.leftIcon.name}
                                                size={22}
                                                color={text}
                                            />
                                        )}
                                    </View>
                                    <View style={styles.connectionTextWrap}>
                                        <Text style={[styles.connectionLabel, { color: `${text}99` }]}>
                                            {connection.label}
                                        </Text>
                                        <View style={styles.connectionTitleRow}>
                                            <Text style={[styles.connectionTitle, { color: text }]}>
                                                {connection.title}
                                            </Text>
                                            <View
                                                style={[
                                                    styles.badge,
                                                    {
                                                        backgroundColor:
                                                            connection.badge.tone === 'success'
                                                                ? '#E8F7EE'
                                                                : `${text}1a`,
                                                    },
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.badgeText,
                                                        {
                                                            color:
                                                                connection.badge.tone === 'success'
                                                                    ? '#1B7F3C'
                                                                    : text,
                                                        },
                                                    ]}
                                                >
                                                    {connection.badge.text}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text
                                            style={[styles.connectionMeta, { color: `${text}80` }]}
                                            numberOfLines={1}
                                        >
                                            {connection.meta}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.connectionRight}>
                                    {connection.key === 'metamask' && (
                                        <Text style={[styles.connectionReceivedLabel, { color: `${text}99` }]}>
                                            Amount received
                                        </Text>
                                    )}
                                    {!!connection.amount && (
                                        <Text style={[styles.connectionAmount, { color: text }]}>{connection.amount}</Text>
                                    )}
                                    {!!connection.approx && (
                                        <Text style={[styles.connectionApprox, { color: `${text}99` }]}>
                                            {connection.approx}
                                        </Text>
                                    )}
                                    <Ionicons
                                        name="chevron-forward"
                                        size={18}
                                        color={`${text}80`}
                                        style={styles.connectionChevron}
                                    />
                                </View>
                            </View>

                            <TouchableOpacity
                                style={[styles.connectionCtaRow, { borderColor: `${text}1a` }]}
                                onPress={connection.onPress}
                                accessibilityRole="button"
                                accessibilityLabel={connection.cta}
                            >
                                <View style={[styles.plusCircle, { borderColor: `${text}66` }]}>
                                    <Ionicons name="add" size={16} color={text} />
                                </View>
                                <Text style={[styles.connectionCtaText, { color: text }]}>
                                    {connection.cta}
                                </Text>
                            </TouchableOpacity>
                        </LinearGradient>
                    ))}
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionTitleRow}>
                        <Text style={[styles.sectionTitle, { color: text }]}>Recent Activity</Text>
                        <TouchableOpacity
                            onPress={() =>
                                showToastMessage(toast, 'success', 'View all coming soon')
                            }
                            accessibilityRole="button"
                            accessibilityLabel="View all recent activity"
                        >
                            <Text style={[styles.viewAllText, { color: text }]}>View All</Text>
                        </TouchableOpacity>
                    </View>

                    {recentActivity.map((activity) => {
                        const amountColor =
                            activity.amountTone === 'positive'
                                ? '#22C55E'
                                : activity.amountTone === 'negative'
                                    ? '#EF4444'
                                    : text;
                        return (
                            <View
                                key={activity.key}
                                style={[styles.activityRow, cardStyle, { borderColor: `${text}1a` }]}
                            >
                                <View
                                    style={[
                                        styles.activityIconWrap,
                                        { backgroundColor: `${text}0d`, borderColor: `${text}1a` },
                                    ]}
                                >
                                    <Ionicons name={activity.icon} size={18} color={text} />
                                </View>
                                <View style={styles.activityTextWrap}>
                                    <Text style={[styles.activityTitle, { color: text }]}>
                                        {activity.title}
                                    </Text>
                                    <Text
                                        style={[styles.activitySubtitle, { color: `${text}99` }]}
                                        numberOfLines={1}
                                    >
                                        {activity.subtitle}
                                    </Text>
                                </View>
                                <View style={styles.activityRight}>
                                    <Text style={[styles.activityAmount, { color: amountColor }]}>
                                        {activity.amount}
                                    </Text>
                                    <Text style={[styles.activityDate, { color: `${text}80` }]}>
                                        {activity.date}
                                    </Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={18}
                                    color={`${text}66`}
                                    style={styles.activityChevron}
                                />
                            </View>
                        );
                    })}
                </View>

                <View style={styles.bottomSpacer} />
            </ScrollView>

            <TradeModal visible={tradeModalVisible} onClose={() => setTradeModalVisible(false)} />
        </SafeAreaView>
    );
};

export default ValensWallet;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingBottom: 24,
        marginBottom: Platform.OS === 'ios' ? 50 : 20,
    },
    topCardWrap: {
        paddingHorizontal: 16,
        marginBottom: 18,
        marginTop: '2%'

    },
    topCard: {
        borderRadius: 18,
        borderWidth: 1,
        overflow: 'hidden',
        minHeight: '12%',
    },
    topCardLeft: {
        padding: 16,
    },
    topCardRight: {
        position: 'absolute',
        right: -10,
        top: -10,
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
    },
    walletImage: {
        opacity: 0.95,
    },
    balanceLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    balanceLabel: {
        fontSize: 13,
        fontWeight: '700',
    },
    balanceValue: {
        marginTop: 6,
        fontSize: 40,
        fontWeight: '900',
        letterSpacing: 0.2,
    },
    balanceSubRow: {
        marginTop: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    balanceSubText: {
        fontSize: 13,
        fontWeight: '700',
    },
    breakdownRow: {
        marginTop: 14,
        borderWidth: 1,
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        backgroundColor: '#ffffffc7',
    },
    breakdownCol: {
        flex: 1,
    },
    breakdownDivider: {
        width: 1,
        marginHorizontal: 12,
    },
    breakdownLabel: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 6,
    },
    breakdownLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    breakdownValue: {
        fontSize: 18,
        fontWeight: '900',
    },
    topActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        backgroundColor: '#ffffffd6',
    },
    topAction: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 14,
        paddingHorizontal: 12,
    },
    topActionText: {
        fontSize: 15,
        fontWeight: '800',
    },
    topActionDivider: {
        width: 1,
        height: '60%',
    },

    section: {
        paddingHorizontal: 20,
        marginBottom: 18,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    sectionSubtitle: {
        marginTop: 6,
        fontSize: 13,
        marginBottom: 12,
        fontWeight: '600',
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    viewAllText: {
        fontSize: 13,
        fontWeight: '700',
    },

    tabsWrap: {
        marginTop: 12,
        borderRadius: 16,
        borderWidth: 1,
        padding: 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    tabItem: {
        flex: 1,
    },
    tabPillActive: {
        borderRadius: 14,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabPillInactive: {
        borderRadius: 14,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabTextActive: {
        fontSize: 13,
        fontWeight: '900',
    },
    tabTextInactive: {
        fontSize: 13,
        fontWeight: '800',
    },

    statsGrid: {
        marginTop: 12,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
    },
    statCard: {
        width: '48%',
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    statIcon: {
        marginBottom: 10,
    },
    statTitle: {
        fontSize: 13,
        fontWeight: '800',
        marginBottom: 10,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '900',
        marginBottom: 6,
    },
    statSubtitle: {
        fontSize: 12,
        fontWeight: '700',
    },

    connectionCard: {
        borderRadius: 18,
        borderWidth: 1,
        padding: 14,
        marginBottom: 12,
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    connectionTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    connectionLeft: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        flex: 1,
        paddingRight: 8,
    },
    connectionIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    connectionIconImage: {
        width: 28,
        height: 28,
        resizeMode: 'contain',
    },
    connectionTextWrap: {
        flex: 1,
    },
    connectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 4,
    },
    connectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 4,
        flexWrap: 'wrap',
    },
    connectionTitle: {
        fontSize: 18,
        fontWeight: '900',
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '900',
    },
    connectionMeta: {
        fontSize: 12,
        fontWeight: '700',
    },
    connectionRight: {
        alignItems: 'flex-end',
        minWidth: 92,
    },
    connectionAmount: {
        fontSize: 16,
        fontWeight: '900',
        marginBottom: 2,
    },
    connectionReceivedLabel: {
        fontSize: 11,
        fontWeight: '800',
        marginBottom: 2,
    },
    connectionApprox: {
        fontSize: 12,
        fontWeight: '700',
    },
    connectionChevron: {
        marginTop: 2,
    },
    connectionCtaRow: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    plusCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    connectionCtaText: {
        fontSize: 14,
        fontWeight: '900',
    },

    activityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        borderWidth: 1,
        padding: 12,
        marginBottom: 10,
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    activityIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    activityTextWrap: {
        flex: 1,
        paddingRight: 10,
    },
    activityTitle: {
        fontSize: 14,
        fontWeight: '900',
        marginBottom: 2,
    },
    activitySubtitle: {
        fontSize: 12,
        fontWeight: '700',
    },
    activityRight: {
        alignItems: 'flex-end',
        marginRight: 10,
    },
    activityAmount: {
        fontSize: 14,
        fontWeight: '900',
        marginBottom: 2,
    },
    activityDate: {
        fontSize: 11,
        fontWeight: '700',
    },
    activityChevron: {
        marginLeft: 2,
    },

    bottomSpacer: {
        height: 24,
    },
});
