import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import EarningsSourceCard from '../../components/wallet/EarningsSourceCard';
import {
  payFollowingGraph,
  tipGraph,
  missionDonationsGraph,
  shopEarningGraph,
  usdtTransferGraph,
  totalamount,
} from '../../services/wallet';
import {
  formatEarningsUsd,
  isEarningsGraphFailure,
  parseEarningsGraphResponse,
  parseTotalAmountParam,
} from '../../utils/earningsGraph';

const H_PADDING = 16;
const CARD_GAP = 12;
const SOURCE_KEYS = ['mission', 'tip', 'wallet', 'fans', 'shop'];

const emptyCardState = (overrides = {}) => ({
  points: [],
  totalAmount: 0,
  percentage: 0,
  overallTotalEarning: 0,
  count: 0,
  countLabel: '',
  loading: true,
  error: false,
  ...overrides,
});

const failedCardState = () =>
  emptyCardState({
    loading: false,
    error: true,
  });

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const resolveSettledCard = settledItem => {
  if (!settledItem || typeof settledItem !== 'object') {
    return failedCardState();
  }

  if (settledItem.status !== 'fulfilled') {
    return failedCardState();
  }

  const payload = settledItem.value;
  if (isEarningsGraphFailure(payload)) {
    return failedCardState();
  }

  try {
    const parsed = parseEarningsGraphResponse(payload) || {};
    return {
      points: Array.isArray(parsed.points) ? parsed.points : [],
      totalAmount: Number(parsed.totalAmount) || 0,
      percentage: Number(parsed.percentage) || 0,
      overallTotalEarning: Number(parsed.overallTotalEarning) || 0,
      count: Number(parsed.count) || 0,
      countLabel: parsed.countLabel || '',
      loading: false,
      error: false,
    };
  } catch (error) {
    console.log('parseEarningsGraphResponse error:', error);
    return failedCardState();
  }
};

const TotalEarningsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useLanguage();
  const { bgStyle, textStyle, text, cardStyle } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();

  const paramTotal = parseTotalAmountParam(route?.params?.totalAmount);
  const [heroTotal, setHeroTotal] = useState(paramTotal);
  const [amountHidden, setAmountHidden] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sources, setSources] = useState({
    mission: emptyCardState(),
    tip: emptyCardState(),
    wallet: emptyCardState(),
    fans: emptyCardState(),
    shop: emptyCardState(),
  });

  const isBusinessProfile = String(route?.params?.profileType || '').toLowerCase() === 'company';
  const walletIcon = isBusinessProfile
    ? require('../../assets/icons/pngicons/goldenWallet-removebg.png')
    : require('../../assets/icons/pngicons/newWallet.png');

  const contentWidth = screenWidth - H_PADDING * 2;
  const cardWidth = (contentWidth - CARD_GAP) / 2;
  const walletImageSize = clamp(Math.round(screenWidth * 0.28), 88, 120);

  const sourceConfig = useMemo(
    () => [
      {
        key: 'mission',
        title: t('totalEarnings.missionPost') || 'Mission Post',
        icon: 'ribbon-outline',
        accentColor: '#7C3AED',
        chartType: 'bars',
        footerFallback: t('totalEarnings.campaigns') || 'Campaigns',
      },
      {
        key: 'tip',
        title: t('totalEarnings.tip') || 'Tip',
        icon: 'heart-circle-outline',
        accentColor: '#DB2777',
        chartType: 'line',
        footerFallback: t('totalEarnings.tips') || 'Tips',
      },
      {
        key: 'wallet',
        title: t('totalEarnings.walletToWallet') || 'Wallet to Wallet',
        icon: 'wallet-outline',
        accentColor: '#2563EB',
        chartType: 'area',
        footerFallback: t('totalEarnings.transactions') || 'Transactions',
      },
      {
        key: 'fans',
        title: t('totalEarnings.subscribedFans') || 'Subscribed Fans',
        icon: 'people-outline',
        accentColor: '#059669',
        chartType: 'bars',
        footerFallback: t('totalEarnings.subscribers') || 'Subscribers',
      },
      {
        key: 'shop',
        title: t('totalEarnings.shop') || 'Shop',
        icon: 'bag-handle-outline',
        accentColor: '#6D28D9',
        chartType: 'bars',
        footerFallback: t('totalEarnings.sales') || 'Sales',
      },
    ],
    [t],
  );

  const loadGraphs = useCallback(async () => {
    setSources({
      mission: emptyCardState({ loading: true, error: false }),
      tip: emptyCardState({ loading: true, error: false }),
      wallet: emptyCardState({ loading: true, error: false }),
      fans: emptyCardState({ loading: true, error: false }),
      shop: emptyCardState({ loading: true, error: false }),
    });

    let settledList = [];
    try {
      settledList = await Promise.allSettled([
        missionDonationsGraph(),
        tipGraph(),
        usdtTransferGraph(),
        payFollowingGraph(),
        shopEarningGraph(),
      ]);
    } catch (error) {
      console.log('loadGraphs Promise.allSettled failed:', error);
      settledList = [];
    }

    const safeList = Array.isArray(settledList) ? settledList : [];
    const nextSources = {};
    SOURCE_KEYS.forEach((key, index) => {
      nextSources[key] = resolveSettledCard(safeList[index]);
    });
    setSources(nextSources);

    // Hero: prefer nav param; else use overall `totalEarning` from any graph API.
    if (!(paramTotal > 0)) {
      const fromGraphs = SOURCE_KEYS.map(key => nextSources[key]?.overallTotalEarning || 0).find(
        n => n > 0,
      );
      if (fromGraphs > 0) {
        setHeroTotal(fromGraphs);
      }
    }
  }, [paramTotal]);

  const ensureHeroTotal = useCallback(async () => {
    if (paramTotal > 0) {
      setHeroTotal(paramTotal);
      return;
    }
    try {
      const response = await totalamount();
      const rawValue =
        response?.data?.totalAmount ??
        response?.data?.data?.totalAmount ??
        response?.data?.totalEarning ??
        response?.data?.data?.totalEarning ??
        response?.data?.totalReceived ??
        response?.data?.data?.totalReceived ??
        response?.data?.amount ??
        response?.data?.data?.amount ??
        0;
      const n = Number(rawValue) || 0;
      if (n > 0) setHeroTotal(n);
    } catch {
      // Graph responses may still fill hero via overallTotalEarning.
    }
  }, [paramTotal]);

  useFocusEffect(
    useCallback(() => {
      ensureHeroTotal();
      loadGraphs();
    }, [ensureHeroTotal, loadGraphs]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([ensureHeroTotal(), loadGraphs()]);
    } finally {
      setRefreshing(false);
    }
  }, [ensureHeroTotal, loadGraphs]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('wallet', { screen: 'Dashboard' });
  }, [navigation]);

  const handleWithdrawPress = useCallback(() => {
    // Placeholder — wiring later
  }, []);

  const buildFooterLabel = (config, data) => {
    if (data?.countLabel) return data.countLabel;
    if (data?.count > 0) return `${data.count} ${config.footerFallback}`;
    return '';
  };

  return (
    <SafeAreaView style={[styles.safe, bgStyle]} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]}>
          {t('totalEarnings.title') || 'Earnings'}
        </Text>
        <TouchableOpacity
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => {}}
        >
          {/* <Ionicons name="information-circle-outline" size={22} color={text} /> */}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={text} />
        }
      >
        <View style={[styles.heroCard, cardStyle]}>
          <View style={[styles.heroTextCol, { paddingRight: walletImageSize * 0.55 }]}>
            <View style={styles.heroLabelRow}>
              <Text style={styles.heroLabel}>
                {t('totalEarnings.totalEarnings') || 'Total Earnings'}
              </Text>
              <TouchableOpacity
                onPress={() => setAmountHidden(prev => !prev)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={amountHidden ? 'eye-off-outline' : 'eye-outline'}
                  size={16}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>
            <Text style={[styles.heroAmount, { color: text }]}>
              {amountHidden ? '••••••' : formatEarningsUsd(heroTotal)}
            </Text>
            <Text style={styles.heroSub}>
              {t('totalEarnings.allTimeEarnings') || 'All time earnings'}
            </Text>
          </View>
          <Image
            source={walletIcon}
            style={[
              styles.heroWalletImage,
              {
                width: walletImageSize * 1.35,
                height: walletImageSize * 1.35,
                right: -8,
              },
            ]}
            resizeMode="contain"
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, textStyle]}>
            {t('totalEarnings.bySource') || 'Earnings by Source'}
          </Text>
        </View>

        <View style={styles.grid}>
          {sourceConfig.map(config => {
            const data = sources[config.key] || emptyCardState({ loading: false });
            return (
              <EarningsSourceCard
                key={config.key}
                title={config.title}
                icon={config.icon}
                accentColor={config.accentColor}
                chartType={config.chartType}
                amount={data.totalAmount}
                percentage={data.percentage}
                points={data.points}
                footerLabel={buildFooterLabel(config, data)}
                loading={data.loading}
                width={cardWidth}
              />
            );
          })}
        </View>

        {/* <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleWithdrawPress}
          style={[styles.withdrawBtn, { backgroundColor: text }]}
        >
          <Text style={styles.withdrawText}>
            {t('totalEarnings.withdrawEarnings') || 'Withdraw Earnings'}
          </Text>
        </TouchableOpacity> */}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8F7FF',
  },
  header: {
    height: 56,
    paddingHorizontal: H_PADDING,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: H_PADDING,
    paddingBottom: 28,
  },
  heroCard: {
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    minHeight: 128,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EDE9FE',
    marginBottom: 20,
  },
  heroTextCol: {
    zIndex: 2,
  },
  heroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  heroWalletImage: {
    position: 'absolute',
    bottom: -10,
    opacity: 0.95,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: CARD_GAP,
    marginBottom: 24,
  },
  withdrawBtn: {
    minHeight: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: '15%',
  },
  withdrawText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});

export default TotalEarningsScreen;
