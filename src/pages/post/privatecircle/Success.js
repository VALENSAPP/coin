import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useLanguage } from '../../../i18n';
import { useAppTheme } from '../../../theme/useApptheme';
import { finishPrivateCircleFlow } from './privateCircleFlow';

const PRIVATE_CIRCLE_LOCK = require('../../../assets/icons/pngicons/private.png');
const PRIVATE_CIRCLE_GOLDEN = require('../../../assets/icons/pngicons/privateGolden.png');

const SPARKLES = [
  { top: 18, left: 42, size: 5 },
  { top: 36, right: 38, size: 4 },
  { top: 72, left: 22, size: 4 },
  { top: 88, right: 28, size: 5 },
  { bottom: 52, left: 34, size: 4 },
  { bottom: 30, right: 42, size: 5 },
  { bottom: 68, right: 18, size: 4 },
];

export default function PrivateCircleSuccess() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useLanguage();
  const [profileType, setProfileType] = useState('');

  const mode = route.params?.mode === 'mint' ? 'mint' : 'setup';
  const selectedIds = Array.isArray(route.params?.selectedIds)
    ? route.params.selectedIds.map(String)
    : [];

  useEffect(() => {
    AsyncStorage.getItem('profile').then((type) => setProfileType(type || ''));
  }, []);

  const isCompanyProfile = profileType === 'company';
  const profileActionGradient = isCompanyProfile
    ? ['#C9A15a', '#C9A15a']
    : ['#513189bd', '#e54ba0'];
  const headingColor = isCompanyProfile ? '#C9A15a' : '#513189';
  const bodyTextColor = isCompanyProfile ? '#6B5E45' : '#6B7280';
  const lockCircleBg = isCompanyProfile ? '#F7F3EA' : '#F3EDFF';
  const glowColor = isCompanyProfile ? '#F7F3EA' : '#F3EDFF';
  const { text } = useAppTheme(profileType);

  const handleGoToCircle = () => {
    finishPrivateCircleFlow(navigation, { mode, selectedIds });
  };

  const handleBack = () => {
    finishPrivateCircleFlow(navigation, { mode, selectedIds });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={26} color={text || headingColor} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text
            style={[styles.headerTitle, { color: text || headingColor }]}
            numberOfLines={1}
          >
            {t('privateCircleMint.welcomeTitle')}
          </Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.body}>
        <View style={styles.heroStage}>
          <View
            style={[
              styles.heroRing,
              styles.heroRingOuter,
              { backgroundColor: glowColor, opacity: 0.45 },
            ]}
          />
          <View
            style={[
              styles.heroRing,
              styles.heroRingMid,
              { backgroundColor: glowColor, opacity: 0.65 },
            ]}
          />

          {SPARKLES.map((sparkle, index) => (
            <View
              key={index}
              style={[
                styles.sparkle,
                {
                  width: sparkle.size,
                  height: sparkle.size,
                  borderRadius: sparkle.size / 2,
                  backgroundColor: headingColor,
                  top: sparkle.top,
                  bottom: sparkle.bottom,
                  left: sparkle.left,
                  right: sparkle.right,
                },
              ]}
            />
          ))}

          <View
            style={[
              styles.lockOrb,
              { backgroundColor: lockCircleBg },
              Platform.select({
                ios: {
                  shadowColor: headingColor,
                  shadowOpacity: 0.18,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 6 },
                },
                android: { elevation: 6 },
              }),
            ]}
          >
            <Image
              source={isCompanyProfile ? PRIVATE_CIRCLE_GOLDEN : PRIVATE_CIRCLE_LOCK}
              style={styles.lockImage}
              resizeMode="contain"
            />
          </View>

          <View style={[styles.checkBadge, { backgroundColor: headingColor }]}>
            <Ionicons name="checkmark" size={24} color="#FFFFFF" />
          </View>
        </View>

        <Text style={[styles.heading, { color: headingColor }]}>
          {t('privateCircleMint.successTitle')}
        </Text>
        <Text style={[styles.description, { color: bodyTextColor }]}>
          {t('privateCircleMint.successBody')}
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleGoToCircle}
          style={[styles.primaryBtnWrap, { backgroundColor: text || headingColor }]}
        >
          <LinearGradient
            colors={profileActionGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>{t('privateCircleMint.successCta')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const HERO_SIZE = 232;
const LOCK_ORB = 136;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 52,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 16,
  },
  heroStage: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  heroRing: {
    position: 'absolute',
    borderRadius: 999,
  },
  heroRingOuter: {
    width: HERO_SIZE,
    height: HERO_SIZE,
  },
  heroRingMid: {
    width: HERO_SIZE - 36,
    height: HERO_SIZE - 36,
  },
  sparkle: {
    position: 'absolute',
    opacity: 0.22,
  },
  lockOrb: {
    width: LOCK_ORB,
    height: LOCK_ORB,
    borderRadius: LOCK_ORB / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  lockImage: {
    width: 92,
    height: 92,
  },
  checkBadge: {
    position: 'absolute',
    right: 44,
    bottom: 42,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#513189',
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 5 },
    }),
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 30,
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 300,
    fontWeight: '400',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 12 : 24,
  },
  primaryBtnWrap: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  primaryBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
