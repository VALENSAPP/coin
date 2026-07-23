import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import { totalPoints } from '../../services/wallet';
import { parseTotalPlatformPointsPayload } from '../../utils/platformPoints';
import { primaryCtaColors, contrastOn } from '../../utils/ctaContrast';
import {
  SoftGrayDragonfly,
  LilacDragonfly,
} from '../../assets/icons';

const H_PADDING = 16;

const formatPts = value => {
  const n = Number(value) || 0;
  return `${n.toLocaleString('en-US')} pts`;
};

const formatNumber = value => {
  const n = Number(value) || 0;
  return n.toLocaleString('en-US');
};

const ReferralPointsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useLanguage();
  const { width: screenWidth } = useWindowDimensions();

  const profileType = String(route?.params?.profileType || '').toLowerCase();
  const isBusinessProfile = profileType === 'company';
  const { bgStyle, textStyle, text, card, accent, border, mutedText } = useAppTheme(
    profileType === 'company' || profileType === 'user' ? profileType : undefined,
  );

  const initialTotal = Number(route?.params?.totalPoints) || 0;
  const initialUsed = Number(route?.params?.used) || 0;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [points, setPoints] = useState({
    totalPlatformPoints: initialTotal,
    totalBattlePoints: Number(route?.params?.battlePoints) || 0,
    marketplaceBattlePoints: Number(route?.params?.shopPoints) || 0,
    referPoints: Number(route?.params?.referPoints) || 0,
    used: initialUsed,
    availablePoints: initialTotal,
  });

  const iconSize = Math.min(72, Math.max(56, screenWidth * 0.17));
  const muted = mutedText || `${text}99`;
  const softBg = `${text}14`;
  const softBorder = border || `${text}18`;
  const cta = primaryCtaColors(accent);

  // Available mirrors Your Platform Points.
  const availablePts = Number(points.totalPlatformPoints) || 0;

  const loadPoints = useCallback(async () => {
    try {
      const response = await totalPoints();
      const statusCode =
        response?.statusCode ?? response?.data?.statusCode ?? response?.status;
      const ok =
        statusCode == null ||
        Number(statusCode) === 200 ||
        response?.success === true;
      if (!ok) {
        return;
      }
      setPoints(parseTotalPlatformPointsPayload(response));
    } catch (error) {
      console.log('ReferralPointsScreen loadPoints error:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        await loadPoints();
        if (active) setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [loadPoints]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPoints();
    setRefreshing(false);
  }, [loadPoints]);

  const earnCategories = useMemo(
    () => [
      {
        id: 'refer',
        title: t('referralPointsScreen.referTitle'),
        description: t('referralPointsScreen.referDesc'),
        totalLabel: t('referralPointsScreen.totalReferPoints'),
        points: points.referPoints,
        icon: 'gift',
        bullets: [
          { icon: 'account-plus-outline', label: t('referralPointsScreen.referBullet1') },
          { icon: 'share-variant-outline', label: t('referralPointsScreen.referBullet2') },
          { icon: 'trophy-outline', label: t('referralPointsScreen.referBullet3') },
        ],
      },
      {
        id: 'battle',
        title: t('referralPointsScreen.battleTitle'),
        description: t('referralPointsScreen.battleDesc'),
        totalLabel: t('referralPointsScreen.totalBattlePoints'),
        points: points.totalBattlePoints,
        icon: 'sword-cross',
        bullets: [
          { icon: 'sword-cross', label: t('referralPointsScreen.battleBullet1') },
          { icon: 'message-outline', label: t('referralPointsScreen.battleBullet2') },
          { icon: 'trophy-outline', label: t('referralPointsScreen.battleBullet3') },
        ],
      },
      {
        id: 'shop',
        title: t('referralPointsScreen.shopBattleTitle'),
        description: t('referralPointsScreen.shopBattleDesc'),
        totalLabel: t('referralPointsScreen.totalShopPoints'),
        points: points.marketplaceBattlePoints,
        icon: 'shopping',
        bullets: [
          { icon: 'circle-multiple', label: t('referralPointsScreen.shopBullet1') },
          { icon: 'message-outline', label: t('referralPointsScreen.shopBullet2') },
          { icon: 'trophy-outline', label: t('referralPointsScreen.shopBullet3') },
        ],
      },
    ],
    [t, points.referPoints, points.totalBattlePoints, points.marketplaceBattlePoints],
  );

  const openUsePoints = () => {
    navigation.navigate('UseYourPoints', {
      totalPoints: availablePts,
      totalPlatformPoints: points.totalPlatformPoints,
      used: points.used,
      profileType: isBusinessProfile ? 'company' : 'user',
    });
  };

  return (
    <SafeAreaView style={[styles.safe, bgStyle]} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={26} color={text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]} numberOfLines={1}>
          {t('referralPointsScreen.title')}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={accent || text} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={text}
            />
          }
        >
          <View style={[styles.heroCard, { backgroundColor: card, shadowColor: text }]}>
            <SoftGrayDragonfly width={48} height={48} style={styles.heroDragonfly} />
            <View style={[styles.heroIconWrap, { backgroundColor: softBg }]}>
              <MaterialCommunityIcons name="star-circle" size={iconSize * 0.55} color={text} />
              <View style={[styles.heroCoinBadge, { backgroundColor: text }]}>
                <Text style={[styles.heroCoinText, { color: contrastOn(text) }]}>P</Text>
              </View>
            </View>
            <View style={styles.heroTextCol}>
              <Text style={[styles.heroLabel, { color: text }]}>
                {t('referralPointsScreen.yourPlatformPoints')}
              </Text>
              <Text style={[styles.heroValue, { color: text }]}>
                {formatPts(points.totalPlatformPoints)}
              </Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: card, borderColor: softBorder }]}>
              <Text style={[styles.summaryLabel, { color: muted }]}>
                {t('referralPointsScreen.available')}
              </Text>
              <Text style={[styles.summaryValue, { color: text }]}>
                {formatNumber(availablePts)}
              </Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: card, borderColor: softBorder }]}>
              <Text style={[styles.summaryLabel, { color: muted }]}>
                {t('referralPointsScreen.used')}
              </Text>
              <Text style={[styles.summaryValue, { color: text }]}>
                {formatNumber(points.used)}
              </Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: card, borderColor: softBorder }]}>
              <Text style={[styles.summaryLabel, { color: muted }]}>
                {t('referralPointsScreen.referShort')}
              </Text>
              <Text style={[styles.summaryValue, { color: text }]}>
                {formatNumber(points.referPoints)}
              </Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.sectionTitle, textStyle]}>
                {t('referralPointsScreen.waysToEarn')}
              </Text>
              <Text style={[styles.sectionSubtitle, { color: muted }]}>
                {t('referralPointsScreen.waysToEarnSubtitle')}
              </Text>
            </View>
            {isBusinessProfile ? (
              <SoftGrayDragonfly width={28} height={28} style={{ tintColor: text }} />
            ) : (
              <LilacDragonfly width={28} height={28} />
            )}
          </View>

          {earnCategories.map(category => (
            <View
              key={category.id}
              style={[styles.earnCard, { backgroundColor: card, borderColor: softBorder }]}
            >
              <View style={styles.earnTopRow}>
                <View style={[styles.earnIconWrap, { backgroundColor: softBg }]}>
                  <MaterialCommunityIcons
                    name={category.icon}
                    size={Math.min(42, screenWidth * 0.1)}
                    color={text}
                  />
                </View>
                <View style={styles.earnTitleCol}>
                  <Text style={[styles.earnTitle, textStyle]} numberOfLines={2}>
                    {category.title}
                  </Text>
                  <Text style={[styles.earnDesc, { color: muted }]}>{category.description}</Text>
                </View>
              </View>

              <View style={styles.bulletList}>
                {category.bullets.map(bullet => (
                  <View key={bullet.label} style={styles.bulletRow}>
                    <MaterialCommunityIcons name={bullet.icon} size={16} color={text} />
                    <Text style={[styles.bulletText, { color: muted }]}>{bullet.label}</Text>
                  </View>
                ))}
              </View>

              <View style={[styles.earnFooter, { borderTopColor: softBorder }]}>
                <Text style={[styles.earnFooterLabel, { color: muted }]}>{category.totalLabel}</Text>
                <Text style={[styles.earnFooterValue, { color: text }]}>
                  {formatPts(category.points)}
                </Text>
              </View>
            </View>
          ))}

          <View style={[styles.totalBar, { backgroundColor: card, borderColor: softBorder }]}>
            <View style={[styles.totalPBadge, { backgroundColor: text }]}>
              <Text style={[styles.totalPText, { color: contrastOn(text) }]}>P</Text>
            </View>
            <View style={styles.totalTextCol}>
              <Text style={[styles.totalTitle, textStyle]}>
                {t('referralPointsScreen.totalPoints')}
              </Text>
              <Text style={[styles.totalSubtitle, { color: muted }]}>
                {t('referralPointsScreen.allTimePoints')}
              </Text>
            </View>
            <Text style={[styles.totalValue, { color: text }]}>
              {formatPts(points.totalPlatformPoints)}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.88}
            onPress={openUsePoints}
            style={[styles.ctaButton, { backgroundColor: cta.backgroundColor }]}
          >
            <View style={[styles.ctaLeftIcon, { backgroundColor: `${cta.color}33` }]}>
              <Text style={[styles.ctaLeftIconText, { color: cta.color }]}>P</Text>
            </View>
            <Text style={[styles.ctaText, { color: cta.color }]}>
              {t('referralPointsScreen.useYourPoints')}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={cta.color} />
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    height: 56,
    paddingHorizontal: H_PADDING,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: H_PADDING,
    paddingBottom: Platform.OS === 'ios' ? 46 : 38,
  },
  heroCard: {
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 14,
  },
  heroDragonfly: {
    position: 'absolute',
    top: 8,
    right: 10,
    opacity: 0.35,
  },
  heroIconWrap: {
    width: 78,
    height: 78,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  heroCoinBadge: {
    position: 'absolute',
    right: 6,
    bottom: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCoinText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  heroTextCol: { flex: 1, minWidth: 0 },
  heroLabel: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  heroValue: { fontSize: 28, fontWeight: '800' },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionHeaderText: { flex: 1, paddingRight: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, lineHeight: 18 },
  earnCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  earnTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  earnIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  earnTitleCol: { flex: 1, minWidth: 0 },
  earnTitle: { fontSize: 16, fontWeight: '700' },
  earnDesc: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  bulletList: { marginTop: 14, gap: 8 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bulletText: { fontSize: 13, flex: 1 },
  earnFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  earnFooterLabel: { fontSize: 13, fontWeight: '500' },
  earnFooterValue: { fontSize: 16, fontWeight: '800' },
  totalBar: {
    marginTop: 4,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalPBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  totalPText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  totalTextCol: { flex: 1, minWidth: 0 },
  totalTitle: { fontSize: 14, fontWeight: '700' },
  totalSubtitle: { fontSize: 11, marginTop: 1 },
  totalValue: { fontSize: 16, fontWeight: '800' },
  ctaButton: {
    height: 54,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: '10%',
  },
  ctaLeftIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  ctaLeftIconText: { fontWeight: '800', fontSize: 12 },
  ctaText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default ReferralPointsScreen;
