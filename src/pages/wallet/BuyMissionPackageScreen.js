import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from 'react-native-toast-notifications';
import { useDispatch } from 'react-redux';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import { buyHitWithPoints } from '../../services/stirpe';
import { getCreditsLeft, totalPoints } from '../../services/wallet';
import { parseTotalPlatformPointsPayload } from '../../utils/platformPoints';
import { showToastMessage } from '../../components/displaytoastmessage';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';

const H_PADDING = 16;
const TOTAL_STEPS = 4;
const DEFAULT_COST = 1000;
const HIT_COUNT = 1;

const formatPts = value => `${(Number(value) || 0).toLocaleString('en-US')} pts`;

const parsePointsBalance = response => {
  const parsed = parseTotalPlatformPointsPayload(response);
  return parsed.totalPlatformPoints;
};

const BuyMissionPackageScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useLanguage();
  const toast = useToast();
  const dispatch = useDispatch();
  const { width } = useWindowDimensions();

  const profileType = String(route?.params?.profileType || '').toLowerCase();
  const resolvedProfile = profileType === 'company' ? 'company' : 'user';
  const { bgStyle, textStyle, text, card } = useAppTheme(
    profileType === 'company' || profileType === 'user' ? profileType : undefined,
  );

  const costPoints = Number(route?.params?.costPoints) || DEFAULT_COST;
  const [availablePoints, setAvailablePoints] = useState(
    Number(route?.params?.totalPoints) || 0,
  );
  const [hitLeft, setHitLeft] = useState(null);
  const [selected, setSelected] = useState('one');
  const [submitting, setSubmitting] = useState(false);

  const muted = `${text}99`;
  const softBg = `${text}12`;
  const softBorder = `${text}18`;
  const step = 2;
  const progressWidth = width - H_PADDING * 2;
  const canAfford = availablePoints >= costPoints;

  const features = useMemo(
    () => [
      { icon: 'star', label: t('buyMissionPost.featureBoost') },
      { icon: 'eye-outline', label: t('buyMissionPost.featureReach') },
      { icon: 'people-outline', label: t('buyMissionPost.featureImpact') },
    ],
    [t],
  );

  const refreshBalances = useCallback(async () => {
    try {
      const [pointsRes, hitsRes] = await Promise.allSettled([
        totalPoints(),
        getCreditsLeft(),
      ]);
      if (pointsRes.status === 'fulfilled') {
        setAvailablePoints(parsePointsBalance(pointsRes.value));
      }
      if (hitsRes.status === 'fulfilled') {
        const raw = hitsRes.value?.data?.hitLeft ?? hitsRes.value?.data?.data?.hitLeft;
        if (raw != null && Number.isFinite(Number(raw))) {
          setHitLeft(Number(raw));
        }
      }
    } catch (error) {
      console.log('BuyMissionPackage refreshBalances error:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshBalances();
    }, [refreshBalances]),
  );

  const onContinue = async () => {
    if (submitting) return;

    if (!canAfford) {
      showToastMessage(
        toast,
        'danger',
        t('buyMissionPost.insufficientPoints', {
          needed: costPoints.toLocaleString('en-US'),
          available: availablePoints.toLocaleString('en-US'),
        }),
      );
      return;
    }

    setSubmitting(true);
    dispatch(showLoader());
    try {
      const userId = await AsyncStorage.getItem('userId');
      const payload = {
        hitCount: HIT_COUNT,
        points: costPoints,
        ...(userId ? { userId } : {}),
      };

      const response = await buyHitWithPoints(payload);
      const statusCode =
        response?.statusCode ?? response?.data?.statusCode ?? response?.status;
      const ok =
        statusCode === 200 ||
        response?.success === true ||
        response?.data?.success === true;

      if (!ok) {
        showToastMessage(
          toast,
          'danger',
          response?.message ||
            response?.data?.message ||
            t('buyMissionPost.purchaseFailed'),
        );
        return;
      }

      const data = response?.data?.data ?? response?.data ?? {};
      const pointsUsed =
        Number(data?.pointsUsed ?? data?.points ?? data?.usedPoints) || costPoints;
      const remainingPoints =
        Number(
          data?.remainingPoints ??
            data?.availablePoints ??
            data?.totalPlatformPoints,
        ) || Math.max(0, availablePoints - pointsUsed);
      const nextHitLeft = Number(
        data?.hitLeft ?? data?.creditsLeft ?? data?.hits,
      );
      const allowanceUsed = Number(
        data?.allowanceUsed ??
          data?.monthlyUsed ??
          (hitLeft != null ? hitLeft + HIT_COUNT : HIT_COUNT),
      );
      const allowanceTotal = Number(
        data?.allowanceTotal ?? data?.monthlyLimit ?? data?.maxHits ?? 5,
      );
      const resetOn = data?.resetsOn ?? data?.resetDate ?? null;

      showToastMessage(
        toast,
        'success',
        response?.message ||
          response?.data?.message ||
          t('buyMissionPost.purchaseSuccessToast'),
      );

      DeviceEventEmitter.emit('PLATFORM_POINTS_UPDATED');
      DeviceEventEmitter.emit('CREDITS_UPDATED');

      navigation.navigate('BuyMissionSuccess', {
        totalPoints: remainingPoints,
        profileType: resolvedProfile,
        costPoints,
        pointsUsed,
        allowanceUsed: Number.isFinite(allowanceUsed) ? allowanceUsed : 1,
        allowanceTotal: Number.isFinite(allowanceTotal) ? allowanceTotal : 5,
        hitLeft: Number.isFinite(nextHitLeft) ? nextHitLeft : undefined,
        resetsOn: resetOn,
      });
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.data?.message ||
          error?.message ||
          t('buyMissionPost.purchaseFailed'),
      );
    } finally {
      setSubmitting(false);
      dispatch(hideLoader());
    }
  };

  return (
    <SafeAreaView style={[styles.safe, bgStyle]} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          disabled={submitting}
        >
          <Ionicons name="chevron-back" size={26} color={text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]} numberOfLines={1}>
          {t('buyMissionPost.title')}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      {/* <View style={[styles.progressWrap, { width: progressWidth }]}>
        <View style={[styles.progressTrack, { backgroundColor: softBg }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: text,
                width: `${(step / TOTAL_STEPS) * 100}%`,
              },
            ]}
          />
        </View>
        <View style={styles.progressDots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, index) => {
            const active = index < step;
            return (
              <View
                key={`step-${index}`}
                style={[
                  styles.progressDot,
                  {
                    backgroundColor: active ? text : softBg,
                    borderColor: active ? text : softBorder,
                  },
                ]}
              />
            );
          })}
        </View>
      </View>
      <Text style={[styles.stepLabel, { color: muted }]}>
        {t('buyMissionPost.stepOf', { current: step, total: TOTAL_STEPS })}
      </Text> */}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, textStyle]}>
          {t('buyMissionPost.choosePackage')}
        </Text>
        <Text style={[styles.pageSubtitle, { color: muted }]}>
          {t('buyMissionPost.choosePackageSubtitle', {
            points: costPoints.toLocaleString('en-US'),
          })}
        </Text>

        <View style={[styles.balanceRow, { backgroundColor: softBg, borderColor: softBorder }]}>
          <Text style={[styles.balanceLabel, { color: muted }]}>
            {t('buyMissionPost.yourBalance')}
          </Text>
          <Text style={[styles.balanceValue, { color: text }]}>
            {formatPts(availablePoints)}
          </Text>
        </View>

        {!canAfford ? (
          <View style={[styles.warnBox, { backgroundColor: softBg }]}>
            <Ionicons name="warning-outline" size={18} color={text} />
            <Text style={[styles.warnText, { color: text }]}>
              {t('buyMissionPost.insufficientPoints', {
                needed: costPoints.toLocaleString('en-US'),
                available: availablePoints.toLocaleString('en-US'),
              })}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setSelected('one')}
          style={[
            styles.packageCard,
            {
              backgroundColor: card,
              borderColor: selected === 'one' ? text : softBorder,
            },
          ]}
        >
          <View style={[styles.checkBadge, { backgroundColor: text }]}>
            <Ionicons name="checkmark" size={14} color="#fff" />
          </View>

          <View style={[styles.packageArt, { backgroundColor: softBg }]}>
            <MaterialCommunityIcons name="rocket-launch" size={52} color={text} />
          </View>

          <Text style={[styles.packageName, textStyle]}>
            {t('buyMissionPost.packageOne')}
          </Text>

          <View style={[styles.pricePill, { backgroundColor: softBg }]}>
            <View style={[styles.pBadge, { backgroundColor: text }]}>
              <Text style={styles.pBadgeText}>P</Text>
            </View>
            <Text style={[styles.priceText, { color: text }]}>
              {formatPts(costPoints)}
            </Text>
          </View>

          <View style={styles.featureList}>
            {features.map(item => (
              <View key={item.label} style={styles.featureRow}>
                <Ionicons name={item.icon} size={16} color={text} />
                <Text style={[styles.featureText, { color: muted }]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>

        <View style={[styles.noteBox, { backgroundColor: softBg }]}>
          <Ionicons name="calendar-outline" size={20} color={text} style={styles.noteIcon} />
          <Text style={[styles.noteText, { color: text }]}>
            <Text style={styles.noteBold}>{t('buyMissionPost.noteLabel')} </Text>
            {t('buyMissionPost.noteBody')}
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: card, borderTopColor: softBorder }]}>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={onContinue}
          disabled={submitting || !canAfford}
          style={[
            styles.ctaButton,
            { backgroundColor: text, opacity: submitting || !canAfford ? 0.55 : 1 },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>{t('buyMissionPost.confirmPurchase')}</Text>
          )}
        </TouchableOpacity>
      </View>
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
  progressWrap: {
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressDots: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  stepLabel: {
    textAlign: 'center',
    fontSize: 12,
    marginBottom: 10,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: H_PADDING,
    paddingBottom: 20,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  pageSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  balanceRow: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  balanceLabel: { fontSize: 13, fontWeight: '600' },
  balanceValue: { fontSize: 15, fontWeight: '800' },
  warnBox: {
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  warnText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  packageCard: {
    borderRadius: 18,
    borderWidth: 2,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  checkBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packageArt: {
    width: 110,
    height: 110,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  packageName: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  pricePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  pBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  pBadgeText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  priceText: { fontSize: 14, fontWeight: '800' },
  featureList: { width: '100%', gap: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 14 },
  noteBox: {
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  noteIcon: { marginRight: 10, marginTop: 2 },
  noteText: { flex: 1, fontSize: 13, lineHeight: 19 },
  noteBold: { fontWeight: '800' },
  footer: {
    paddingHorizontal: H_PADDING,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ctaButton: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '10%',
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default BuyMissionPackageScreen;
