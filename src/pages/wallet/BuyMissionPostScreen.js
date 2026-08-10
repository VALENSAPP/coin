import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useToast } from 'react-native-toast-notifications';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import { showToastMessage } from '../../components/displaytoastmessage';
import { totalPoints as fetchTotalPoints } from '../../services/wallet';
import { parseTotalPlatformPointsPayload } from '../../utils/platformPoints';
import { primaryCtaColors } from '../../utils/ctaContrast';

const H_PADDING = 16;
const MISSION_COST = 1000;

const formatPts = value => `${(Number(value) || 0).toLocaleString('en-US')} pts`;

const BuyMissionPostScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useLanguage();
  const toast = useToast();
  const { width } = useWindowDimensions();

  const profileType = String(route?.params?.profileType || '').toLowerCase();
  const resolvedProfile = profileType === 'company' ? 'company' : 'user';
  const { bgStyle, textStyle, text, card, accent } = useAppTheme(
    profileType === 'company' || profileType === 'user' ? profileType : undefined,
  );

  const [totalPoints, setTotalPoints] = useState(
    Number(route?.params?.totalPoints) || 0,
  );

  const refreshPoints = useCallback(async () => {
    try {
      const response = await fetchTotalPoints();
      const parsed = parseTotalPlatformPointsPayload(response);
      setTotalPoints(parsed.totalPlatformPoints);
    } catch (error) {
      console.log('BuyMissionPostScreen refreshPoints error:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshPoints();
    }, [refreshPoints]),
  );
  const muted = `${text}99`;
  const softBg = `${text}12`;
  const softBorder = `${text}18`;
  const iconBox = Math.min(56, Math.max(48, width * 0.13));
  const canAfford = totalPoints >= MISSION_COST;
  const cta = primaryCtaColors(accent);

  const benefits = useMemo(
    () => [
      {
        icon: 'eye-outline',
        title: t('buyMissionPost.benefitVisibilityTitle'),
        desc: t('buyMissionPost.benefitVisibilityDesc'),
      },
      {
        icon: 'people-outline',
        title: t('buyMissionPost.benefitImpactTitle'),
        desc: t('buyMissionPost.benefitImpactDesc'),
      },
      {
        icon: 'trending-up-outline',
        title: t('buyMissionPost.benefitFrictionTitle'),
        desc: t('buyMissionPost.benefitFrictionDesc'),
      },
    ],
    [t],
  );

  const openPackageStep = () => {
    if (!canAfford) {
      showToastMessage(
        toast,
        'danger',
        t('buyMissionPost.insufficientPoints', {
          needed: MISSION_COST.toLocaleString('en-US'),
          available: totalPoints.toLocaleString('en-US'),
        }),
      );
      return;
    }
    navigation.navigate('BuyMissionPackage', {
      totalPoints,
      profileType: resolvedProfile,
      costPoints: MISSION_COST,
    });
  };

  return (
    <SafeAreaView style={[styles.safe, bgStyle]} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color={text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]} numberOfLines={1}>
          {t('buyMissionPost.title')}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroCard, { backgroundColor: softBg }]}>
          <Text style={[styles.heroTitle, textStyle]}>
            {t('buyMissionPost.heroTitlePrefix')}{' '}
            <Text style={{ color: text }}>{t('buyMissionPost.heroTitleAccent')}</Text>
          </Text>
          <Text style={[styles.heroBody, { color: muted }]}>
            {t('buyMissionPost.heroBody')}
          </Text>

          <View style={styles.heroArtRow}>
            <View style={[styles.heroArtBubble, { backgroundColor: softBg }]}>
              <MaterialCommunityIcons name="rocket-launch" size={42} color={text} />
            </View>
            <View style={[styles.heroArtBubble, { backgroundColor: softBg }]}>
              <MaterialCommunityIcons name="target" size={42} color={text} />
            </View>
          </View>

          <View style={[styles.balancePill, { backgroundColor: card, borderColor: softBorder }]}>
            <View style={[styles.pBadge, { backgroundColor: text }]}>
              <Text style={styles.pBadgeText}>P</Text>
            </View>
            <Text style={[styles.balanceText, { color: muted }]}>
              {t('buyMissionPost.yourBalance')}{' '}
              <Text style={{ color: text, fontWeight: '800' }}>{formatPts(totalPoints)}</Text>
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, textStyle]}>
          {t('buyMissionPost.exchangeTitle')}
        </Text>
        <Text style={[styles.sectionSubtitle, { color: muted }]}>
          {t('buyMissionPost.exchangeSubtitle')}
        </Text>

        <View style={[styles.exchangeCard, { backgroundColor: card, borderColor: softBorder }]}>
          <View style={styles.exchangeRow}>
            <View style={styles.exchangeSide}>
              <View style={[styles.exchangeIcon, { backgroundColor: text }]}>
                <Text style={styles.pBadgeText}>P</Text>
              </View>
              <Text style={[styles.exchangeValue, textStyle]}>
                {MISSION_COST.toLocaleString('en-US')}
              </Text>
              <Text style={[styles.exchangeLabel, { color: muted }]}>
                {t('buyMissionPost.points')}
              </Text>
            </View>

            <Ionicons name="arrow-forward" size={22} color={text} />

            <View style={styles.exchangeSide}>
              <View style={[styles.exchangeIconSquare, { backgroundColor: softBg }]}>
                <MaterialCommunityIcons name="file-document-outline" size={22} color={text} />
              </View>
              <Text style={[styles.exchangeValue, textStyle]}>1</Text>
              <Text style={[styles.exchangeLabel, { color: muted }]}>
                {t('buyMissionPost.missionPost')}
              </Text>
            </View>
          </View>

          <View style={[styles.exchangeFooter, { backgroundColor: softBg }]}>
            <Ionicons name="star" size={14} color={text} />
            <Text style={[styles.exchangeFooterText, { color: text }]}>
              {t('buyMissionPost.rateLine', {
                points: MISSION_COST.toLocaleString('en-US'),
              })}
            </Text>
          </View>
        </View>

        <View style={[styles.noteBox, { backgroundColor: softBg }]}>
          <Ionicons name="calendar-outline" size={20} color={text} style={styles.noteIcon} />
          <Text style={[styles.noteText, { color: text }]}>
            <Text style={styles.noteBold}>{t('buyMissionPost.noteLabel')} </Text>
            {t('buyMissionPost.noteBody')}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, textStyle, { marginTop: 8 }]}>
          {t('buyMissionPost.whyTitle')}
        </Text>

        {benefits.map(item => (
          <View key={item.title} style={styles.benefitRow}>
            <View
              style={[
                styles.benefitIcon,
                {
                  width: iconBox,
                  height: iconBox,
                  borderRadius: 12,
                  backgroundColor: softBg,
                },
              ]}
            >
              <Ionicons name={item.icon} size={22} color={text} />
            </View>
            <View style={styles.benefitText}>
              <Text style={[styles.benefitTitle, textStyle]}>{item.title}</Text>
              <Text style={[styles.benefitDesc, { color: muted }]}>{item.desc}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: card, borderTopColor: softBorder }]}>
        {!canAfford ? (
          <Text style={[styles.insufficientHint, { color: muted }]}>
            {t('buyMissionPost.insufficientPoints', {
              needed: MISSION_COST.toLocaleString('en-US'),
              available: totalPoints.toLocaleString('en-US'),
            })}
          </Text>
        ) : null}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={openPackageStep}
          disabled={!canAfford}
          style={[
            styles.ctaButton,
            {
              backgroundColor: cta.backgroundColor,
              opacity: canAfford ? 1 : 0.55,
            },
          ]}
        >
          <View style={[styles.ctaLeftIcon, { backgroundColor: `${cta.color}33` }]}>
            <Text style={[styles.pBadgeText, { color: cta.color }]}>P</Text>
          </View>
          <Text style={[styles.ctaText, { color: cta.color }]}>
            {t('buyMissionPost.buyCta', {
              points: MISSION_COST.toLocaleString('en-US'),
            })}
          </Text>
        </TouchableOpacity>
        <View style={styles.secureRow}>
          <Ionicons name="lock-closed-outline" size={14} color={muted} />
          <Text style={[styles.secureText, { color: muted }]}>
            {t('buyMissionPost.secureNote')}
          </Text>
        </View>
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
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: H_PADDING,
    paddingBottom: 20,
  },
  heroCard: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: 8,
  },
  heroBody: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  heroArtRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
  },
  heroArtBubble: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balancePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
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
  balanceText: { fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  exchangeCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
  },
  exchangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  exchangeSide: { alignItems: 'center', minWidth: 90 },
  exchangeIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  exchangeIconSquare: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  exchangeValue: { fontSize: 20, fontWeight: '800' },
  exchangeLabel: { fontSize: 12, marginTop: 2 },
  exchangeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  exchangeFooterText: { fontSize: 13, fontWeight: '700' },
  noteBox: {
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  noteIcon: { marginRight: 10, marginTop: 2 },
  noteText: { flex: 1, fontSize: 13, lineHeight: 19 },
  noteBold: { fontWeight: '800' },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  benefitIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  benefitText: { flex: 1, minWidth: 0 },
  benefitTitle: { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  benefitDesc: { fontSize: 13, lineHeight: 18 },
  footer: {
    paddingHorizontal: H_PADDING,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ctaButton: {
    height: 54,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '10%',
  },
  ctaLeftIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'center',
  },
  secureRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secureText: { fontSize: 12 },
  insufficientHint: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 17,
  },
});

export default BuyMissionPostScreen;
