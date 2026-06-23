import React, { useMemo, useState } from 'react';
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
import HexAvatar from '../../components/home/story.js/HexAvatar';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { getWalletScreenGradient, getWalletGradientText } from '../../utils/walletDarkTheme';
import { getUserCredentials } from '../../services/post';
import { useWalletConnectSupport } from '../../context/WalletConnectSupportContext';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
    metaMaskRecived,
    totalamount,
    totalMission,
    totalSupport,
    transationActivity,
} from '../../services/wallet';
import { appKit } from '../../config/AppKitConfig';
import { useLanguage } from '../../i18n';

const WALLET_ICON_BY_TYPE = {
    metamask: require('../../assets/icons/pngicons/Emeta.png'),
    coinbase: require('../../assets/icons/pngicons/coin.png'),
    walletconnect: require('../../assets/icons/pngicons/EWallet.png'),
    wallet: require('../../assets/icons/pngicons/EWallet.png'),
};

const getProfilePayload = (response) =>
    response?.data?.user ||
    response?.data?.data?.user ||
    response?.data?.data ||
    response?.data ||
    response;

const getProfileImage = (profile) =>
    profile?.image ||
    profile?.avatar ||
    profile?.profilePicture ||
    profile?.profilePic ||
    '';

const ValensWallet = ({ navigation }) => {
    const [tradeModalVisible, setTradeModalVisible] = useState(false);
    const [portfolioValue, setPortfolioValue] = useState();
    const [portfolioValueNumber, setPortfolioValueNumber] = useState(0);
    const [isBusinessProfile, setIsBusinessProfile] = useState(false);
    const [metaMaskReceivedUsd, setMetaMaskReceivedUsd] = useState(0);
    const [missionEarningsUsd, setMissionEarningsUsd] = useState(0);
    const [subscriptionPaymentsUsd, setSubscriptionPaymentsUsd] = useState(0);
    const [connectedWalletAddress, setConnectedWalletAddress] = useState('');
    const [connectedWalletType, setConnectedWalletType] = useState(null);
    const [showAmounts, setShowAmounts] = useState(false);
    const [showTotalBalance, setShowTotalBalance] = useState(false);
    const [recentActivity, setRecentActivity] = useState([]);
    const dispatch = useDispatch();
    const toast = useToast();
    const { bgStyle, text, cardStyle, accent, card } = useAppTheme(isBusinessProfile ? 'company' : undefined);
    const { isDarkMode } = useThemeContext();
    const { width: screenWidth } = useWindowDimensions();
    const { t } = useLanguage();
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
            const storedWalletType = await AsyncStorage.getItem('walletType');
            setConnectedWalletAddress(String(storedWalletAddress || '').trim());
            setConnectedWalletType(storedWalletType);

            const [totalRes, userRes, metaRes, missionRes, supportRes, activityRes] = await Promise.allSettled([
                totalamount(),
                userId ? getUserCredentials(userId) : Promise.resolve(null),
                metaMaskRecived(),
                totalMission(),
                totalSupport(),
                transationActivity({ page: 1, limit: 10 }),
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

            if (activityRes.status === 'fulfilled') {
                const response = activityRes.value;
                const raw =
                    response?.data?.transactions ||
                    response?.data?.data?.transactions ||
                    response?.data?.data ||
                    response?.data ||
                    [];

                const items = Array.isArray(raw) ? raw : [];

                const pickFirst = (...values) =>
                    values.find(value => value !== undefined && value !== null && value !== '');

                const resolveTransactionUserId = (tx) => pickFirst(
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

                const transactionUserIds = [
                    ...new Set(items.map(resolveTransactionUserId).filter(Boolean).map(String)),
                ];

                const profileResults = await Promise.allSettled(
                    transactionUserIds.map((id) => getUserCredentials(id)),
                );

                const profileMap = {};
                transactionUserIds.forEach((id, index) => {
                    const result = profileResults[index];
                    if (result?.status !== 'fulfilled') return;

                    const profile = getProfilePayload(result.value);
                    profileMap[id] = {
                        id: pickFirst(profile?.id, profile?._id, profile?.userId, id),
                        displayName: pickFirst(profile?.displayName, profile?.name, profile?.fullName, ''),
                        userName: pickFirst(profile?.userName, profile?.username, ''),
                        image: getProfileImage(profile),
                    };
                });

                const toNumber = (value) => {
                    const num = Number(value);
                    return Number.isFinite(num) ? num : 0;
                };

                const formatSignedMoney = (value) => {
                    const n = toNumber(value);
                    const sign = n < 0 ? '-' : '+';
                    return `${sign}${formatMoney(Math.abs(n))}`;
                };

                const formatActivityDate = (value) => {
                    const date = value ? new Date(value) : null;
                    if (!date || Number.isNaN(date.getTime())) return '';
                    const parts = date.toLocaleString('en-US', {
                        month: 'short',
                        day: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                    });
                    return parts.replace(', ', ' • ').replace(', ', ' • ');
                };

                const resolveIcon = (type) => {
                    const t = String(type || '').toLowerCase();
                    if (t.includes('withdraw')) return 'arrow-down-outline';
                    if (t.includes('mission')) return 'cash-outline';
                    if (t.includes('subscription')) return 'people-outline';
                    if (t.includes('support') || t.includes('follow')) return 'heart-outline';
                    if (t.includes('transfer') || t.includes('wallet')) return 'swap-horizontal-outline';
                    return 'receipt-outline';
                };

                const resolveTypeLabel = (tx) => {
                    const rawType = pickFirst(tx?.typeTransaction, tx?.action, tx?.forPayment, tx?.type, tx?.transactionType, tx?.category, tx?.source, '');
                    const t = String(rawType || '').trim();
                    const lowered = t.toLowerCase();
                    if (lowered === 'payfollowing' || lowered === 'following' || lowered.includes('following')) return 'Following Payment';
                    if (lowered === 'missiondonation' || lowered.includes('mission')) return 'Mission Donation';
                    if (lowered === 'donation') return 'Donation';
                    if (!t) return 'Transaction';
                    return t
                        .replace(/([a-z])([A-Z])/g, '$1 $2')
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, (c) => c.toUpperCase());
                };

                const mapped = items.map((tx, index) => {
                    const id = pickFirst(tx?.id, tx?._id, tx?.transactionId, tx?.txId, tx?.hash, `tx_${index}`);
                    const transactionUserId = resolveTransactionUserId(tx);
                    const userProfile = transactionUserId ? profileMap[String(transactionUserId)] : null;
                    const typeLabel = resolveTypeLabel(tx);
                    const status = pickFirst(tx?.status, tx?.paymentStatus, tx?.state, '');

                    const rawAmount = pickFirst(
                        tx?.amountUsd, tx?.amountUSD, tx?.amount_usd, tx?.amount, tx?.usdAmount, tx?.value, 0,
                    );
                    const amountNumber = toNumber(rawAmount);
                    const amountTone = amountNumber < 0 ? 'negative' : 'positive';

                    const profileName = pickFirst(
                        userProfile?.displayName,
                        userProfile?.userName ? `@${userProfile.userName}` : '',
                        tx?.senderName,
                        tx?.receiverName,
                        '',
                    );
                    const profileHandle = userProfile?.userName ? `@${userProfile.userName}` : '';
                    const title = pickFirst(profileName, tx?.title, tx?.label, typeLabel) || 'Transaction';

                    const subtitle = pickFirst(
                        profileHandle, tx?.subtitle, tx?.description, tx?.note, tx?.missionQuestion,
                        tx?.mission?.question, tx?.mission?.title, tx?.receiverName, tx?.senderName, '',
                    );

                    const createdAt = pickFirst(
                        tx?.createdAt, tx?.created_at, tx?.timestamp, tx?.date, tx?.updatedAt, tx?.updated_at, null,
                    );

                    return {
                        key: String(id),
                        icon: resolveIcon(typeLabel),
                        title: String(title),
                        subtitle: subtitle ? String(subtitle) : [typeLabel, status].filter(Boolean).join(' • ') || '—',
                        amount: formatSignedMoney(amountNumber),
                        amountTone,
                        date: formatActivityDate(createdAt),
                        typeLabel,
                        status,
                        profileUserId: transactionUserId ? String(transactionUserId) : '',
                        profileImage: userProfile?.image || '',
                        profileUserName: userProfile?.userName || '',
                        profileDisplayName: userProfile?.displayName || '',
                    };
                });

                setRecentActivity(mapped);
            }

        } catch (error) {
            showToastMessage(
                toast,
                'danger',
                error?.response?.message ?? t('savedPosts.somethingWentWrong')
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

    const walletScreenGradient = useMemo(
        () => getWalletScreenGradient(isBusinessProfile, isDarkMode, accent, card),
        [isBusinessProfile, isDarkMode, accent, card],
    );
    const gradientText = getWalletGradientText(isBusinessProfile, isDarkMode, text);

    const walletOverviewCards = [
        {
            key: 'mission',
            icon: 'flag-outline',
            title: t('valensWallet.missionEarnings'),
            value: formatMoney(missionEarningsUsd),
            subtitle: t('valensWallet.missionEarningsSubtitle'),
        },
        {
            key: 'subs',
            icon: 'diamond-outline',
            title: isBusinessProfile ? t('valensWallet.marketplaceIncome') : t('valensWallet.subscriptionPayments'),
            value: isBusinessProfile ? 0 : formatMoney(subscriptionPaymentsUsd),
            subtitle: isBusinessProfile ? t('valensWallet.marketplaceIncomeSubtitle') : t('valensWallet.subscriptionPaymentsSubtitle'),
        },
    ];

    const connectedWallet = String(sessionAddress || connectedWalletAddress || '').trim();
    const isMetaMaskConnected = isWalletConnected || !!connectedWallet;
    const metaMaskPreview = connectedWallet
        ? `${connectedWallet.slice(0, 8)}…${connectedWallet.slice(-4)}`
        : t('valensWallet.notConnected');

    const handleDisconnectWallet = async () => {
        try {
            await appKit?.disconnect?.();
            await AsyncStorage.multiRemove(['walletAddress', 'walletChainId', 'walletType']);
            setConnectedWalletAddress('');
            setConnectedWalletType(null);
            showToastMessage(toast, 'success', t('valensWallet.disconnectSuccess'));
        } catch (error) {
            showToastMessage(toast, 'danger', t('valensWallet.disconnectFailed'));
        }
    };

    const handleMetaMaskCardPress = () => {
        if (isMetaMaskConnected) {
            Alert.alert(
                t('valensWallet.disconnectAlertTitle'),
                t('valensWallet.disconnectAlertMessage'),
                [
                    { text: t('valensWallet.cancel'), style: 'cancel' },
                    { text: t('valensWallet.disconnect'), style: 'destructive', onPress: handleDisconnectWallet },
                ]
            );
            return;
        }
        openWalletConnect();
    };

    const normalizedWalletType = String(connectedWalletType || '').trim().toLowerCase();
    const walletTypeForUi = isMetaMaskConnected ? normalizedWalletType || 'walletconnect' : 'wallet';
    const walletTitle = isMetaMaskConnected
        ? normalizedWalletType === 'metamask'
            ? 'MetaMask'
            : normalizedWalletType === 'coinbase'
                ? 'Coinbase Wallet'
                : t('walletConnectedSuccess.title')
        : t('valensWallet.walletLabel');
    const walletIconSource = WALLET_ICON_BY_TYPE[walletTypeForUi] || WALLET_ICON_BY_TYPE.wallet;

    const walletConnections = [
        {
            key: 'metamask',
            label: t('valensWallet.walletLabel'),
            title: walletTitle,
            badge: {
                text: isMetaMaskConnected ? t('valensWallet.connected') : t('valensWallet.disconnected'),
                tone: isMetaMaskConnected ? 'success' : 'muted',
            },
            meta: isMetaMaskConnected ? metaMaskPreview : t('valensWallet.tapToConnect'),
            amount: `$ ${Number(metaMaskReceivedUsd || 0).toFixed(2)}`,
            approx: '',
            cta: isMetaMaskConnected ? t('valensWallet.disconnectMetaMask') : t('valensWallet.connectMetaMask'),
            onPress: handleMetaMaskCardPress,
            leftIcon: { type: 'image', source: walletIconSource },
        },
    ];

    const resolvedRecentActivity = useMemo(
        () => (Array.isArray(recentActivity) ? recentActivity : []),
        [recentActivity],
    );

    const walletIcon = isBusinessProfile
        ? require('../../assets/icons/pngicons/goldenWallet-removebg.png')
        : require('../../assets/icons/pngicons/newWallet.png');

    const handleActivityProfilePress = (activity) => {
        if (!activity?.profileUserId) return;

        navigation.navigate('HomeMain', {
            screen: 'UsersProfile',
            params: {
                userId: activity.profileUserId,
                returnTo: { tab: 'wallet', screen: 'ValensWallet' },
                userName: activity.profileUserName,
            },
        });
    };

    return (
        <SafeAreaView style={[styles.container, bgStyle]}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: recentActivity.length > 5 ? 150 : 60 }}
            >
                <View style={styles.topCardWrap}>
                    <LinearGradient
                        colors={walletScreenGradient}
                        start={{ x: -8, y: -8 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.topCard, { borderColor: `${text}1a` }]}
                    >
                        <View style={[styles.topCardLeft, { paddingRight: walletImageSize + 24 }]}>
                            <View style={styles.balanceLabelRow}>
                                <Text style={[styles.balanceLabel, { color: `${gradientText}cc` }]}>
                                    {t('valensWallet.totalBalance')}
                                </Text>
                                <TouchableOpacity onPress={() => setShowTotalBalance((prev) => !prev)}>
                                    <Ionicons
                                        name={showTotalBalance ? 'eye-outline' : 'eye-off-outline'}
                                        size={16}
                                        color={`${gradientText}cc`}
                                    />
                                </TouchableOpacity>
                            </View>
                            <Text style={[styles.balanceValue, { color: gradientText, fontSize: balanceFontSize }]}>
                                {displayPortfolioValue}
                            </Text>
                            <View style={styles.balanceSubRow} />
                        </View>

                        <View style={styles.topCardRight}>
                            <Image
                                source={walletIcon}
                                style={[styles.walletImage, { width: walletImageSize * 1.5, height: walletImageSize * 1.5 }]}
                                resizeMode="contain"
                            />
                        </View>
                    </LinearGradient>
                </View>

                {/* Wallet Overview */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: text }]}>{t('valensWallet.overviewTitle')}</Text>
                    <View style={styles.statsGrid}>
                        {walletOverviewCards.map((card) => (
                            <LinearGradient
                                key={card.key}
                                colors={walletScreenGradient}
                                start={{ x: -8, y: -8 }}
                                end={{ x: 1, y: 1 }}
                                style={[styles.statCard, { borderColor: `${gradientText}1a` }]}
                            >
                                {card.key === 'subs' ? (
                                    <MaterialCommunityIcons name="crown" size={22} color={gradientText} style={styles.statIcon} />
                                ) : card.key === 'withdrawn' ? (
                                    <MaterialCommunityIcons name="bank-outline" size={22} color={gradientText} style={styles.statIcon} />
                                ) : (
                                    <Ionicons name={card.icon} size={22} color={gradientText} style={styles.statIcon} />
                                )}
                                <Text style={[styles.statTitle, { color: `${gradientText}cc` }]}>{card.title}</Text>
                                <Text style={[styles.statValue, { color: gradientText }]}>{card.value}</Text>
                                <Text style={[styles.statSubtitle, { color: `${gradientText}99` }]}>{card.subtitle}</Text>
                            </LinearGradient>
                        ))}
                    </View>
                </View>

                {/* Wallet Connections */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: text }]}>{t('valensWallet.connectionsTitle')}</Text>
                    <Text style={[styles.sectionSubtitle, { color: `${text}99` }]}>{t('valensWallet.connectionsSubtitle')}</Text>

                    {walletConnections.map((connection) => (
                        <LinearGradient
                            key={connection.key}
                            colors={walletScreenGradient}
                            start={{ x: -8, y: -8 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.connectionCard, { borderColor: `${gradientText}1a` }]}
                        >
                            <View style={styles.connectionTopRow}>
                                     <View style={styles.connectionLeft}>
                                     <View style={[styles.connectionIconWrap, { backgroundColor: `${text}0d`, borderColor: `${text}1a` }]}>
                                        {connection.leftIcon.type === 'image' ? (
                                            <Image source={connection.leftIcon.source} style={styles.connectionIconImage} />
                                        ) : (
                                            <Ionicons name={connection.leftIcon.name} size={22} color={gradientText} />
                                        )}
                                    </View>
                                    <View style={styles.connectionTextWrap}>
                                        <Text style={[styles.connectionLabel, { color: `${gradientText}99` }]}>{connection.label}</Text>
                                        <View style={styles.connectionTitleRow}>
                                            <Text style={[styles.connectionTitle, { color: gradientText }]}>{connection.title}</Text>
                                            <View style={[styles.badge, { backgroundColor: connection.badge.tone === 'success' ? '#E8F7EE' : `${gradientText}1a` }]}>
                                                <Text style={[styles.badgeText, { color: connection.badge.tone === 'success' ? '#1B7F3C' : gradientText }]}>
                                                    {connection.badge.text}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={[styles.connectionMeta, { color: `${gradientText}80` }]} numberOfLines={1}>
                                            {connection.meta}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.connectionRight}>
                                    {connection.key === 'metamask' && (
                                        <Text style={[styles.connectionReceivedLabel, { color: `${gradientText}99` }]}>
                                            {t('valensWallet.amountReceived')}
                                        </Text>
                                    )}
                                    {!!connection.amount && (
                                        <Text style={[styles.connectionAmount, { color: gradientText }]}>{connection.amount}</Text>
                                    )}
                                    {!!connection.approx && (
                                        <Text style={[styles.connectionApprox, { color: `${gradientText}99` }]}>{connection.approx}</Text>
                                    )}
                                    <Ionicons name="chevron-forward" size={18} color={`${gradientText}80`} style={styles.connectionChevron} />
                                </View>
                            </View>

                            <TouchableOpacity
                                style={[styles.connectionCtaRow, { borderColor: `${gradientText}1a` }]}
                                onPress={connection.onPress}
                                accessibilityRole="button"
                                accessibilityLabel={connection.cta}
                            >
                                <View style={[styles.plusCircle, { borderColor: `${gradientText}66` }]}>
                                    <Ionicons name="add" size={16} color={gradientText} />
                                </View>
                                <Text style={[styles.connectionCtaText, { color: gradientText }]}>{connection.cta}</Text>
                            </TouchableOpacity>
                        </LinearGradient>
                    ))}
                </View>

                {/* Recent Activity */}
                <View style={styles.section}>
                    <View style={styles.sectionTitleRow}>
                        <Text style={[styles.sectionTitle, { color: text }]}>{t('valensWallet.recentActivityTitle')}</Text>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('TransactionActivity', { activity: recentActivity })}
                            accessibilityRole="button"
                            accessibilityLabel={t('valensWallet.viewAll')}
                        >
                            <Text style={[styles.viewAllText, { color: text }]}>{t('valensWallet.viewAll')}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ marginBottom: '15%' }}>
                        {resolvedRecentActivity.length === 0 ? (
                            <View style={[styles.activityRow, cardStyle, { borderColor: `${text}1a` }]}>
                                <View style={[styles.activityIconWrap, { backgroundColor: `${text}0d`, borderColor: `${text}1a` }]}>
                                    <Ionicons name="time-outline" size={18} color={text} />
                                </View>
                                <View style={styles.activityTextWrap}>
                                    <Text style={[styles.activityTitle, { color: text }]}>
                                        {t('valensWallet.noTransactionsTitle')}
                                    </Text>
                                    <Text style={[styles.activitySubtitle, { color: `${text}99` }]} numberOfLines={1}>
                                        {t('valensWallet.noTransactionsSubtitle')}
                                    </Text>
                                </View>
                            </View>
                        ) : resolvedRecentActivity.slice(0, 5).map((activity) => {
                            const amountColor =
                                activity.amountTone === 'positive'
                                    ? '#22C55E'
                                    : activity.amountTone === 'negative'
                                        ? '#EF4444'
                                        : text;
                            return (
                                <View key={activity.key} style={[styles.activityRow, cardStyle, { borderColor: `${text}1a` }]}>
                                    <TouchableOpacity
                                        style={styles.activityProfilePressable}
                                        activeOpacity={activity.profileUserId ? 0.75 : 1}
                                        onPress={() => handleActivityProfilePress(activity)}
                                        disabled={!activity.profileUserId}
                                        accessibilityRole={activity.profileUserId ? 'button' : undefined}
                                    >
                                        <View style={styles.activityAvatarWrap}>
                                            <HexAvatar
                                                uri={activity.profileImage}
                                                size={38}
                                                borderWidth={1.5}
                                                borderColor={text}
                                            />
                                        </View>
                                        <View style={styles.activityTextWrap}>
                                            <Text style={[styles.activityTitle, { color: text }]} numberOfLines={1}>
                                                {activity.title}
                                            </Text>
                                            <Text style={[styles.activitySubtitle, { color: `${text}99` }]} numberOfLines={1}>
                                                {activity.subtitle}
                                            </Text>
                                            <Text style={[styles.activityMetaText, { color: `${text}80` }]} numberOfLines={1}>
                                                {[activity.typeLabel, activity.status].filter(Boolean).join(' • ')}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                    <View style={styles.activityRight}>
                                        <Text style={[styles.activityAmount, { color: amountColor }]}>{activity.amount}</Text>
                                        <Text style={[styles.activityDate, { color: `${text}80` }]}>{activity.date}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color={`${text}66`} style={styles.activityChevron} />

                                </View>
                            );
                        })}
                    </View>
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
        // paddingBottom: 24,
        // marginBottom: Platform.OS === 'ios' ? 50 : 20,
    },
    topCardWrap: {
        paddingHorizontal: 16,
        marginBottom: 18,
        marginTop: '2%',

    },
    topCard: {
        borderRadius: 18,
        borderWidth: 1,
        overflow: 'hidden',
        minHeight: '16%',
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
        borderRadius: 20
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
        backgroundColor: 'transparent',
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
        backgroundColor: 'transparent',
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
        // bottom: "10%"
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
        width: Platform.OS === 'ios' ? '47%' : '48%',
        borderRadius: 16,
        borderWidth: 1,
        padding: Platform.OS === 'ios' ? 8 : 10,
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
        height: '110%',
    },
    statIcon: {
        marginBottom: 10,
    },
    statTitle: {
        fontSize: Platform.OS === 'ios' ? 12 : 13,
        fontWeight: '800',
        marginBottom: 10,
        flexShrink: 1,        // allows text to wrap instead of clipping
        flexWrap: 'wrap',     // forces word wrap on iOS
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
        minHeight: '18%'
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
        fontSize: 16,
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
        paddingRight: 25,
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
        // paddingBottom: '10%'
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
    activityProfilePressable: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
    },
    activityAvatarWrap: {
        width: 42,
        height: 42,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        flexShrink: 0,
    },
    activityTextWrap: {
        flex: 1,
        minWidth: 0,
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
    activityMetaText: {
        marginTop: 2,
        fontSize: 11,
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
