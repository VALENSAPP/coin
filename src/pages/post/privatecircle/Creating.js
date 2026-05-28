import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../../../i18n';
import { useAppTheme } from '../../../theme/useApptheme';
import { showToastMessage } from '../../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import {
  addPrivateCircleMembers,
  PrivateSetup,
  isPrivateCircleApiSuccess,
} from '../../../services/privatecircle';
import { goToPrivateCircleSuccess } from './privateCircleFlow';

const PRIVATE_CIRCLE_LOCK = require('../../../assets/icons/pngicons/private.png');
const PRIVATE_CIRCLE_GOLDEN = require('../../../assets/icons/pngicons/privateGolden.png');

const RING_SIZE = 168;
const RING_STROKE = 8;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const MIN_LOADER_DURATION_MS = 5000;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function PrivateCircleCreating() {
  const navigation = useNavigation();
  const route = useRoute();
  const toast = useToast();
  const { t } = useLanguage();
  const [profileType, setProfileType] = useState('');

  const mode = route.params?.mode === 'mint' ? 'mint' : 'setup';
  const selectedIds = useMemo(
    () =>
      Array.isArray(route.params?.selectedIds)
        ? route.params.selectedIds.map(String)
        : [],
    [route.params?.selectedIds],
  );
  const membersAlreadySaved = route.params?.membersAlreadySaved === true;

  const progressAnim = useRef(new Animated.Value(RING_CIRCUMFERENCE)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const hasRunRef = useRef(false);
  const navigationRef = useRef(navigation);
  const toastRef = useRef(toast);
  const tRef = useRef(t);

  navigationRef.current = navigation;
  toastRef.current = toast;
  tRef.current = t;

  const isCompanyProfile = profileType === 'company';
  const headingColor = isCompanyProfile ? '#B8954F' : '#513189';
  const glowColor = isCompanyProfile ? '#F7F3EA' : '#F3EDFF';
  useAppTheme(profileType);

  useEffect(() => {
    AsyncStorage.getItem('profile').then((type) => setProfileType(type || ''));
  }, []);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1400,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: RING_CIRCUMFERENCE * 0.08,
      duration: MIN_LOADER_DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [progressAnim]);

  const selectedIdsKey = selectedIds.join(',');

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    let cancelled = false;

    const goSuccess = () => {
      if (cancelled) return;
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished && !cancelled) {
          goToPrivateCircleSuccess(navigationRef.current, { mode, selectedIds });
        }
      });
    };

    const run = async () => {
      const startedAt = Date.now();
      try {
        if (mode === 'setup' && !membersAlreadySaved) {
          const setupRes = await PrivateSetup();
          if (!isPrivateCircleApiSuccess(setupRes)) {
            throw new Error(
              setupRes?.message || tRef.current('privateCircleMint.setupError'),
            );
          }

          if (selectedIds.length > 0) {
            const membersRes = await addPrivateCircleMembers(selectedIds);
            console.log(membersRes, "add members response=>>>>>>>>>>>>>>");
            if (!isPrivateCircleApiSuccess(membersRes)) {
              throw new Error(
                membersRes?.message ||
                  tRef.current('privateCircleMint.saveMembersError'),
              );
            }
          }
        }

        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, MIN_LOADER_DURATION_MS - elapsed);
        if (remaining > 0) {
          await new Promise((resolve) => setTimeout(resolve, remaining));
        }

        if (!cancelled) {
          goSuccess();
        }
      } catch (e) {
        if (cancelled) return;
        hasRunRef.current = false;
        showToastMessage(
          toastRef.current,
          'danger',
          e?.message || tRef.current('privateCircleMint.setupError'),
        );
        navigationRef.current.goBack();
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [mode, membersAlreadySaved, selectedIdsKey, progressAnim]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.08],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.backBtn} />
        <Text style={[styles.headerTitle, { color: headingColor }]}>
          {t('privateCircleMint.welcomeTitle')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.body}>
        <View style={styles.progressWrap}>
          <Animated.View
            style={[
              styles.pulseRing,
              styles.pulseRingOuter,
              { backgroundColor: glowColor, opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
            ]}
          />
          <Animated.View
            style={[
              styles.pulseRing,
              styles.pulseRingMid,
              { backgroundColor: glowColor, opacity: pulseOpacity },
            ]}
          />
          <View style={[styles.pulseRing, styles.pulseRingInner, { backgroundColor: glowColor }]} />

          <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ringSvg}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke="#E5E7EB"
              strokeWidth={RING_STROKE}
              fill="none"
            />
            <AnimatedCircle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke={headingColor}
              strokeWidth={RING_STROKE}
              fill="none"
              strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
              strokeDashoffset={progressAnim}
              strokeLinecap="round"
              rotation="-90"
              origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
            />
          </Svg>

          <Image source={isCompanyProfile ? PRIVATE_CIRCLE_GOLDEN : PRIVATE_CIRCLE_LOCK} style={styles.lockImage} resizeMode="contain" />
        </View>

        <Text style={[styles.title, { color: headingColor }]}>
          {t('privateCircleMint.creatingTitle')}
        </Text>
        <Text style={styles.subtitle}>{t('privateCircleMint.creatingSubtitle')}</Text>
        <Text style={styles.hint}>{t('privateCircleMint.creatingHint')}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  progressWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  pulseRing: {
    position: 'absolute',
    borderRadius: 999,
  },
  pulseRingOuter: {
    width: RING_SIZE + 48,
    height: RING_SIZE + 48,
  },
  pulseRingMid: {
    width: RING_SIZE + 24,
    height: RING_SIZE + 24,
  },
  pulseRingInner: {
    width: RING_SIZE + 8,
    height: RING_SIZE + 8,
    opacity: 0.5,
  },
  ringSvg: {
    position: 'absolute',
  },
  lockImage: {
    width: 56,
    height: 56,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
