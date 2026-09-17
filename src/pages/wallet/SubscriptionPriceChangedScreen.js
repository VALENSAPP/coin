import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import { getUserCredentials } from '../../services/post';
import { FanPageSubscription } from '../../services/stirpe';
import { cancelFanSubscription } from '../../services/wallet';
import { getPaymentSessionUrl, STRIPE_BROWSER_OPTIONS } from '../../utils/stripeOnboarding';
import { primaryCtaColors } from '../../utils/ctaContrast';

const FALLBACK_AVATAR =
  'https://cdn-icons-png.flaticon.com/512/149/149071.png';

const formatCurrency = (val) => {
  if (val == null || val === '') return '$0';
  const num = Number(val);
  if (isNaN(num)) return `$${val}`;
  return `$${num.toLocaleString('en-US')}`;
};

const SubscriptionPriceChangedScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useLanguage();
  const { bgStyle, textStyle, text, card, accent, border, mutedText } = useAppTheme();

  const {
    creatorId,
    newPrice: rawNewPrice,
    oldPrice: rawOldPrice,
    subscriptionId,
  } = route?.params || {};

  const newPrice = rawNewPrice != null ? String(rawNewPrice) : '';
  const oldPrice = rawOldPrice != null ? String(rawOldPrice) : '';

  const rawIsCancelled =
    route?.params?.isCancelled ??
    route?.params?.notification?.raw?.data?.isCancelled ??
    route?.params?.notification?.data?.isCancelled;

  const parseIsCancelled = (val) => {
    if (val === false || val === 'false' || val === 0 || val === '0') return 'accepted';
    if (val === true || val === 'true' || val === 1 || val === '1') return 'declined';
    return 'pending';
  };

  const [statusState, setStatusState] = useState(() => parseIsCancelled(rawIsCancelled));

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [creatorProfile, setCreatorProfile] = useState(null);
  const [submittingAccept, setSubmittingAccept] = useState(false);
  const [submittingDecline, setSubmittingDecline] = useState(false);

  const softBorder = border || `${text}18`;
  const muted = mutedText || `${text}99`;
  const softBg = `${text}0F`;
  const cta = primaryCtaColors(accent);

  useEffect(() => {
    let isMounted = true;
    const loadCreator = async () => {
      if (!creatorId) {
        setLoadingProfile(false);
        return;
      }
      try {
        const response = await getUserCredentials(creatorId);
        const data = response?.data?.data || response?.data || {};
        if (isMounted) {
          setCreatorProfile(data);
        }
      } catch (err) {
        console.log('SubscriptionPriceChangedScreen loadCreator error:', err);
      } finally {
        if (isMounted) setLoadingProfile(false);
      }
    };

    loadCreator();
    return () => {
      isMounted = false;
    };
  }, [creatorId]);

  const creatorName =
    creatorProfile?.userName ||
    creatorProfile?.name ||
    creatorProfile?.fullName ||
    creatorProfile?.first_name ||
    t('subscriptionPriceChangedScreen.creator');
  const avatarUrl =
    creatorProfile?.profile_image ||
    creatorProfile?.avatar ||
    creatorProfile?.image ||
    FALLBACK_AVATAR;

  const handleAccept = useCallback(async () => {
    if (!creatorId || submittingAccept || submittingDecline) return;
    setSubmittingAccept(true);
    try {
      const payload = {
        amount: Number(newPrice) || 0,
        contentUserId: creatorId,
        isAutoRenew: true,
      };

      const response = await FanPageSubscription(payload);
      const sessionUrl = getPaymentSessionUrl(response);

      if (sessionUrl) {
        if (await InAppBrowser.isAvailable()) {
          await InAppBrowser.open(sessionUrl, {
            ...STRIPE_BROWSER_OPTIONS,
            forceCloseOnRedirection: true,
          });
        } else {
          await Linking.openURL(sessionUrl);
        }
      }

      setStatusState('accepted');
      Alert.alert(
        t('subscriptionPriceChangedScreen.title'),
        t('subscriptionPriceChangedScreen.acceptSuccess')
      );
    } catch (err) {
      console.log('SubscriptionPriceChangedScreen handleAccept error:', err);
      Alert.alert(
        t('subscriptionPriceChangedScreen.errorTitle'),
        err?.response?.data?.message ||
          err?.message ||
          t('subscriptionPriceChangedScreen.errorAccept')
      );
    } finally {
      setSubmittingAccept(false);
    }
  }, [creatorId, newPrice, submittingAccept, submittingDecline, t]);

  const confirmDecline = useCallback(async () => {
    if (submittingAccept || submittingDecline) return;
    setSubmittingDecline(true);
    try {
      const payload = { creatorId };
      if (subscriptionId) {
        payload.subscriptionId = subscriptionId;
      }
      await cancelFanSubscription(payload);

      setStatusState('declined');
      Alert.alert(
        t('subscriptionPriceChangedScreen.title'),
        t('subscriptionPriceChangedScreen.declineSuccess')
      );
    } catch (err) {
      console.log('SubscriptionPriceChangedScreen confirmDecline error:', err);
      Alert.alert(
        t('subscriptionPriceChangedScreen.errorTitle'),
        err?.response?.data?.message ||
          err?.message ||
          t('subscriptionPriceChangedScreen.errorDecline')
      );
    } finally {
      setSubmittingDecline(false);
    }
  }, [creatorId, subscriptionId, submittingAccept, submittingDecline, t]);

  const handleDeclinePress = useCallback(() => {
    Alert.alert(
      t('subscriptionPriceChangedScreen.confirmDeclineTitle'),
      t('subscriptionPriceChangedScreen.confirmDeclineBody'),
      [
        { text: t('subscriptionPriceChangedScreen.cancel'), style: 'cancel' },
        {
          text: t('subscriptionPriceChangedScreen.confirm'),
          style: 'destructive',
          onPress: confirmDecline,
        },
      ]
    );
  }, [confirmDecline, t]);

  return (
    <SafeAreaView style={[styles.safe, bgStyle]} edges={['top', 'left', 'right']}>
      <View style={[styles.header, { borderBottomColor: softBorder }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color={text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]} numberOfLines={1}>
          {t('subscriptionPriceChangedScreen.title')}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Creator Info Card */}
        <View style={[styles.card, { backgroundColor: card, borderColor: softBorder }]}>
          {loadingProfile ? (
            <ActivityIndicator size="small" color={accent || text} style={{ padding: 20 }} />
          ) : (
            <View style={styles.creatorRow}>
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              <View style={styles.creatorMeta}>
                <Text style={[styles.creatorName, textStyle]} numberOfLines={1}>
                  {creatorName}
                </Text>
                <Text style={[styles.creatorSubtitle, { color: muted }]}>
                  {t('subscriptionPriceChangedScreen.creatorTitle')}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Price Change Summary Card */}
        <View style={[styles.card, { backgroundColor: card, borderColor: softBorder }]}>
          <View style={styles.badgeRow}>
            {statusState === 'accepted' ? (
              <View style={[styles.statusBadge, { backgroundColor: '#D1FAE5' }]}>
                <MaterialCommunityIcons name="check-circle-outline" size={16} color="#059669" />
                <Text style={[styles.badgeText, { color: '#059669' }]}>
                  {t('subscriptionPriceChangedScreen.statusAccepted')}
                </Text>
              </View>
            ) : statusState === 'declined' ? (
              <View style={[styles.statusBadge, { backgroundColor: '#FEE2E2' }]}>
                <MaterialCommunityIcons name="close-circle-outline" size={16} color="#DC2626" />
                <Text style={[styles.badgeText, { color: '#DC2626' }]}>
                  {t('subscriptionPriceChangedScreen.statusDeclined')}
                </Text>
              </View>
            ) : (
              <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7' }]}>
                <MaterialCommunityIcons name="clock-outline" size={16} color="#D97706" />
                <Text style={[styles.badgeText, { color: '#D97706' }]}>
                  {t('subscriptionPriceChangedScreen.autoRenewalPaused')}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.priceRow}>
            {oldPrice ? (
              <View style={styles.priceCol}>
                <Text style={[styles.priceLabel, { color: muted }]}>
                  {t('subscriptionPriceChangedScreen.previousPrice')}
                </Text>
                <Text style={[styles.oldPriceText, { color: muted }]}>
                  {formatCurrency(oldPrice)}
                  <Text style={styles.perMonthText}>
                    {t('subscriptionPriceChangedScreen.perMonth')}
                  </Text>
                </Text>
              </View>
            ) : null}

            {oldPrice && newPrice ? (
              <MaterialCommunityIcons
                name="arrow-right"
                size={22}
                color={muted}
                style={{ marginHorizontal: 8, marginTop: 16 }}
              />
            ) : null}

            <View style={styles.priceCol}>
              <Text style={[styles.priceLabel, { color: muted }]}>
                {t('subscriptionPriceChangedScreen.newPrice')}
              </Text>
              <Text style={[styles.newPriceText, { color: accent || text }]}>
                {formatCurrency(newPrice)}
                <Text style={[styles.perMonthText, { color: accent || text }]}>
                  {t('subscriptionPriceChangedScreen.perMonth')}
                </Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Notice Info Card */}
        <View style={[styles.card, { backgroundColor: softBg, borderColor: softBorder }]}>
          <View style={styles.noticeHeader}>
            <MaterialCommunityIcons
              name={
                statusState === 'accepted'
                  ? 'check-circle-outline'
                  : statusState === 'declined'
                  ? 'alert-circle-outline'
                  : 'information-outline'
              }
              size={20}
              color={
                statusState === 'accepted'
                  ? '#059669'
                  : statusState === 'declined'
                  ? '#DC2626'
                  : accent || text
              }
            />
            <Text style={[styles.noticeTitle, textStyle]}>
              {t('subscriptionPriceChangedScreen.noticeTitle')}
            </Text>
          </View>
          <Text style={[styles.noticeBody, { color: muted }]}>
            {statusState === 'accepted'
              ? t('subscriptionPriceChangedScreen.acceptedNotice')
              : statusState === 'declined'
              ? t('subscriptionPriceChangedScreen.declinedNotice')
              : t('subscriptionPriceChangedScreen.noticeBody')}
          </Text>
        </View>

        {/* Action Buttons */}
        {statusState === 'pending' ? (
          <View style={styles.actionsWrap}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: cta.bg }]}
              onPress={handleAccept}
              disabled={submittingAccept || submittingDecline}
              activeOpacity={0.8}
            >
              {submittingAccept ? (
                <ActivityIndicator color={cta.fg} />
              ) : (
                <Text style={[styles.primaryBtnText, { color: cta.fg }]}>
                  {t('subscriptionPriceChangedScreen.acceptButton')}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.outlineBtn, { borderColor: border || '#EF4444' }]}
              onPress={handleDeclinePress}
              disabled={submittingAccept || submittingDecline}
              activeOpacity={0.8}
            >
              {submittingDecline ? (
                <ActivityIndicator color="#EF4444" />
              ) : (
                <Text style={styles.outlineBtnText}>
                  {t('subscriptionPriceChangedScreen.declineButton')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actionsWrap}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: cta.bg }]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <Text style={[styles.primaryBtnText, { color: cta.fg }]}>
                {t('subscriptionPriceChangedScreen.done')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E1E1E1',
  },
  creatorMeta: {
    marginLeft: 14,
    flex: 1,
  },
  creatorName: {
    fontSize: 18,
    fontWeight: '700',
  },
  creatorSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
    marginLeft: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 6,
  },
  priceCol: {
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  oldPriceText: {
    fontSize: 20,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
  newPriceText: {
    fontSize: 24,
    fontWeight: '800',
  },
  perMonthText: {
    fontSize: 12,
    fontWeight: '400',
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  noticeBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  actionsWrap: {
    marginTop: 8,
  },
  primaryBtn: {
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  outlineBtn: {
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
});

export default SubscriptionPriceChangedScreen;
