import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommonActions, useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import { primaryCtaColors } from '../../utils/ctaContrast';

const H_PADDING = 20;

const formatPts = value => `${(Number(value) || 0).toLocaleString('en-US')} pts`;

const BuyMissionSuccessScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();

  const profileType = String(route?.params?.profileType || '').toLowerCase();
  const { bgStyle, textStyle, text, card, accent } = useAppTheme(
    profileType === 'company' || profileType === 'user' ? profileType : undefined,
  );

  const pointsUsed = Number(route?.params?.pointsUsed) || 1000;
  const allowanceUsed = Number(route?.params?.allowanceUsed) || 1;
  const allowanceTotal = Number(route?.params?.allowanceTotal) || 1;
  const resetsOnParam = route?.params?.resetsOn;

  const muted = `${text}99`;
  const softBg = `${text}12`;
  const softBorder = `${text}18`;
  const checkSize = Math.min(96, Math.max(80, width * 0.22));
  const cta = primaryCtaColors(accent);

  const resetDate = useMemo(() => {
    if (resetsOnParam) {
      const parsed = new Date(resetsOnParam);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }
      return String(resetsOnParam);
    }
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return next.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [resetsOnParam]);

  const rows = [
    {
      id: 'points',
      icon: 'p',
      label: t('buyMissionPost.pointsUsed'),
      value: formatPts(pointsUsed),
      valueAccent: true,
    },
    {
      id: 'allowance',
      icon: 'calendar-outline',
      label: t('buyMissionPost.monthlyAllowance'),
      value: t('buyMissionPost.allowanceUsed', {
        used: allowanceUsed,
        total: allowanceTotal,
      }),
    },
    {
      id: 'reset',
      icon: 'refresh-outline',
      label: t('buyMissionPost.resetsOn'),
      value: resetDate,
    },
  ];

  const goToMissionPosts = () => {
    try {
      navigation.navigate('ViewMissionPost', {
        isBusinessProfile: profileType === 'company',
      });
    } catch (error) {
      navigation.navigate('wallet', {
        screen: 'ViewMissionPost',
        params: { isBusinessProfile: profileType === 'company' },
      });
    }
  };

  const backToDashboard = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Dashboard' }],
      }),
    );
  };

  return (
    <SafeAreaView style={[styles.safe, bgStyle]} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.successVisual}>
          <View
            style={[
              styles.ringOuter,
              {
                width: checkSize + 48,
                height: checkSize + 48,
                borderRadius: (checkSize + 48) / 2,
                backgroundColor: softBg,
              },
            ]}
          />
          <View
            style={[
              styles.ringMid,
              {
                width: checkSize + 24,
                height: checkSize + 24,
                borderRadius: (checkSize + 24) / 2,
                backgroundColor: softBg,
              },
            ]}
          />
          <View
            style={[
              styles.checkCircle,
              {
                width: checkSize,
                height: checkSize,
                borderRadius: checkSize / 2,
                backgroundColor: text,
              },
            ]}
          >
            <Ionicons name="checkmark" size={checkSize * 0.45} color="#fff" />
          </View>
        </View>

        <Text style={[styles.title, textStyle]}>{t('buyMissionPost.successTitle')}</Text>
        <Text style={[styles.subtitle, { color: muted }]}>
          {t('buyMissionPost.successSubtitle')}
        </Text>

        <View style={[styles.card, { backgroundColor: card, borderColor: softBorder }]}>
          {rows.map((row, index) => (
            <View
              key={row.id}
              style={[
                styles.row,
                index < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: softBorder },
              ]}
            >
              {row.icon === 'p' ? (
                <View style={[styles.pBadge, { backgroundColor: text }]}>
                  <Text style={styles.pBadgeText}>P</Text>
                </View>
              ) : (
                <View style={[styles.rowIconWrap, { backgroundColor: softBg }]}>
                  <Ionicons name={row.icon} size={18} color={text} />
                </View>
              )}
              <Text style={[styles.rowLabel, textStyle]}>{row.label}</Text>
              <Text
                style={[
                  styles.rowValue,
                  { color: row.valueAccent ? text : muted, fontWeight: row.valueAccent ? '800' : '600' },
                ]}
              >
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={goToMissionPosts}
          style={[styles.primaryBtn, { backgroundColor: cta.backgroundColor }]}
        >
          <Text style={[styles.primaryText, { color: cta.color }]}>
            {t('buyMissionPost.goToMissionPosts')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.8} onPress={backToDashboard} style={styles.secondaryBtn}>
          <Text style={[styles.secondaryText, { color: text }]}>
            {t('buyMissionPost.backToDashboard')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: H_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successVisual: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  ringOuter: { position: 'absolute' },
  ringMid: { position: 'absolute' },
  checkCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pBadgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  rowIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  rowValue: {
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: H_PADDING,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
  },
  primaryBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '10%',
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom:'10%'
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

export default BuyMissionSuccessScreen;
