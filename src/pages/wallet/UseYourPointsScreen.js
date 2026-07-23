import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  Alert,
  Modal,
  Pressable,
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
import { LilacDragonfly, SoftGrayDragonfly } from '../../assets/icons';

const H_PADDING = 16;

const formatPts = value => {
  const n = Number(value) || 0;
  return `${n.toLocaleString('en-US')} pts`;
};

const UseYourPointsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useLanguage();
  const { width: screenWidth } = useWindowDimensions();

  const profileType = String(route?.params?.profileType || '').toLowerCase();
  const isBusinessProfile = profileType === 'company';
  const resolvedProfile = isBusinessProfile ? 'company' : 'user';
  const { bgStyle, textStyle, text, card, accent } = useAppTheme(
    profileType === 'company' || profileType === 'user' ? profileType : undefined,
  );

  const [totalPts, setTotalPts] = useState(Number(route?.params?.totalPoints) || 0);
  const [howItWorksVisible, setHowItWorksVisible] = useState(false);

  const refreshPoints = useCallback(async () => {
    try {
      const response = await totalPoints();
      const parsed = parseTotalPlatformPointsPayload(response);
      setTotalPts(parsed.totalPlatformPoints);
    } catch (error) {
      console.log('UseYourPointsScreen refreshPoints error:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshPoints();
    }, [refreshPoints]),
  );
  const imageSize = Math.min(78, Math.max(64, screenWidth * 0.18));
  const muted = `${text}99`;
  const softBg = `${text}14`;
  const softBorder = `${text}18`;
  const cta = primaryCtaColors(accent);

  const options = useMemo(
    () => [
      {
        id: 'mission',
        title: t('useYourPointsScreen.buyMissionTitle'),
        description: t('useYourPointsScreen.buyMissionDesc'),
        icon: 'rocket-launch',
        badge: t('useYourPointsScreen.buyMissionBadge'),
        action: () =>
          navigation.navigate('BuyMissionPost', {
            totalPoints: totalPts,
            profileType: resolvedProfile,
          }),
      },
      {
        id: 'send',
        title: t('useYourPointsScreen.sendPointsTitle'),
        description: t('useYourPointsScreen.sendPointsDesc'),
        icon: 'account-multiple',
        hint: t('useYourPointsScreen.sendPointsHint'),
        action: () =>
          Alert.alert(
            t('useYourPointsScreen.sendPointsTitle'),
            t('useYourPointsScreen.comingSoon'),
          ),
      },
      {
        id: 'travel',
        title: t('useYourPointsScreen.travelTitle'),
        description: t('useYourPointsScreen.travelDesc'),
        icon: 'airplane',
        action: () =>
          Alert.alert(
            t('useYourPointsScreen.travelTitle'),
            t('useYourPointsScreen.comingSoon'),
          ),
      },
    ],
    [t, navigation, totalPts, resolvedProfile],
  );

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
          {t('useYourPointsScreen.title')}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroCard, { backgroundColor: card, shadowColor: text }]}>
          <SoftGrayDragonfly width={44} height={44} style={styles.heroDragonfly} />
          <View style={[styles.heroHex, { borderColor: text }]}>
            <View style={[styles.heroHexInner, { backgroundColor: text }]}>
              <Text style={[styles.heroHexText, { color: contrastOn(text) }]}>P</Text>
            </View>
          </View>
          <View style={styles.heroTextCol}>
            <Text style={[styles.heroLabel, { color: text }]}>
              {t('useYourPointsScreen.availablePoints')}
            </Text>
            <Text style={[styles.heroValue, { color: text }]}>{formatPts(totalPts)}</Text>
            <Text style={[styles.heroSub, { color: muted }]}>
              {t('useYourPointsScreen.availableSubtitle')}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderText}>
            <Text style={[styles.sectionTitle, textStyle]}>
              {t('useYourPointsScreen.chooseHow')}
            </Text>
            <Text style={[styles.sectionSubtitle, { color: muted }]}>
              {t('useYourPointsScreen.chooseHowSubtitle')}
            </Text>
          </View>
          {isBusinessProfile ? (
            <SoftGrayDragonfly width={28} height={28} style={{ tintColor: text }} />
          ) : (
            <LilacDragonfly width={28} height={28} />
          )}
        </View>

        {options.map(option => (
          <TouchableOpacity
            key={option.id}
            activeOpacity={0.88}
            onPress={option.action}
            style={[styles.optionCard, { backgroundColor: card, borderColor: softBorder }]}
          >
            <View
              style={[
                styles.optionImage,
                {
                  width: imageSize,
                  height: imageSize,
                  borderRadius: imageSize * 0.28,
                  backgroundColor: softBg,
                },
              ]}
            >
              <MaterialCommunityIcons name={option.icon} size={imageSize * 0.48} color={text} />
            </View>

            <View style={styles.optionTextCol}>
              <Text style={[styles.optionTitle, textStyle]} numberOfLines={2}>
                {option.title}
              </Text>
              <Text style={[styles.optionDesc, { color: muted }]} numberOfLines={3}>
                {option.description}
              </Text>
              {option.badge ? (
                <View style={[styles.optionBadge, { backgroundColor: softBg }]}>
                  <View style={[styles.optionBadgeDot, { backgroundColor: text }]}>
                    <Text style={[styles.optionBadgeDotText, { color: contrastOn(text) }]}>
                      P
                    </Text>
                  </View>
                  <Text style={[styles.optionBadgeText, { color: text }]} numberOfLines={1}>
                    {option.badge}
                  </Text>
                </View>
              ) : null}
              {option.hint ? (
                <Text style={[styles.optionHint, { color: text }]}>{option.hint}</Text>
              ) : null}
            </View>

            <Ionicons name="chevron-forward" size={18} color={text} style={styles.optionChevron} />
          </TouchableOpacity>
        ))}

        <View style={[styles.partnerBar, { borderColor: softBorder, backgroundColor: softBg }]}>
          <View style={[styles.partnerIcon, { backgroundColor: text }]}>
            <Ionicons name="globe-outline" size={16} color={contrastOn(text)} />
          </View>
          <Text style={[styles.partnerText, { color: muted }]}>
            {t('useYourPointsScreen.partnerNetwork')}
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => setHowItWorksVisible(true)}
          style={[styles.ctaButton, { backgroundColor: cta.backgroundColor }]}
        >
          <View style={[styles.ctaLeftIcon, { backgroundColor: `${cta.color}33` }]}>
            <Text style={[styles.ctaLeftIconText, { color: cta.color }]}>P</Text>
          </View>
          <Text style={[styles.ctaText, { color: cta.color }]}>
            {t('useYourPointsScreen.howItWorks')}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={cta.color} />
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={howItWorksVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHowItWorksVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setHowItWorksVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: card }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, textStyle]}>
              {t('useYourPointsScreen.howItWorks')}
            </Text>
            <Text style={[styles.modalBody, { color: muted }]}>
              {t('useYourPointsScreen.howItWorksBody')}
            </Text>
            <TouchableOpacity
              style={[styles.modalCta, { backgroundColor: cta.backgroundColor }]}
              onPress={() => setHowItWorksVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={[styles.modalCtaText, { color: cta.color }]}>
                {t('useYourPointsScreen.gotIt')}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
    marginBottom: 22,
  },
  heroDragonfly: {
    position: 'absolute',
    top: 8,
    right: 10,
    opacity: 0.3,
  },
  heroHex: {
    width: 58,
    height: 58,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  heroHexInner: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroHexText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  heroTextCol: { flex: 1, minWidth: 0 },
  heroLabel: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  heroValue: { fontSize: 28, fontWeight: '800' },
  heroSub: { marginTop: 4, fontSize: 12, lineHeight: 16 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionHeaderText: { flex: 1, paddingRight: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, lineHeight: 18 },
  optionCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  optionImage: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionTextCol: { flex: 1, minWidth: 0, paddingRight: 6 },
  optionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  optionDesc: { fontSize: 12, lineHeight: 17 },
  optionBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
  },
  optionBadgeDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  optionBadgeDotText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  optionBadgeText: { fontSize: 11, fontWeight: '700', flexShrink: 1 },
  optionHint: { marginTop: 6, fontSize: 12, fontWeight: '600' },
  optionChevron: { marginLeft: 2 },
  partnerBar: {
    marginTop: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  partnerText: { flex: 1, fontSize: 12, lineHeight: 16 },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: { width: '100%', borderRadius: 18, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  modalBody: { fontSize: 14, lineHeight: 21, marginBottom: 18 },
  modalCta: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  modalCtaText: { fontWeight: '700', fontSize: 15 },
});

export default UseYourPointsScreen;
