import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  DeviceEventEmitter,
  ScrollView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { cancelSubscription, checkSubscription, createCheckoutSession } from '../../services/stirpe';
import { createOnboardingLink, getOnboardingStatus } from '../../services/profile';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import SubscriptionActivationPopup from '../../components/modals/SubscriptionActivationPopUp';
import { LogoIcon } from '../../assets/icons';

const PAYMENT_POLL_ATTEMPTS = 8;
const PAYMENT_POLL_DELAY_MS = 1500;

const PLANS = {
  monthly: {
    id: 'monthly',
    price: 9.9,
    originalPrice: null,
    periodKey: 'perMonth',
    titleKey: 'monthlyPlan',
    descKey: 'monthlyDesc',
    badgeKey: 'mostPopular',
    badgeTone: 'accent',
  },
  annual: {
    id: 'annual',
    price: 95,
    originalPrice: 118.8,
    periodKey: 'perYear',
    titleKey: 'annualPlan',
    descKey: 'annualDesc',
    badgeKey: 'save20',
    badgeTone: 'success',
  },
};

const BENEFITS = [
  { icon: 'sword-cross', titleKey: 'battleShop', descKey: 'battleShopDesc' },
  { icon: 'shopping-outline', titleKey: 'marketplace', descKey: 'marketplaceDesc' },
  { icon: 'book-open-page-variant', titleKey: 'ebooks', descKey: 'ebooksDesc' },
  { icon: 'lock-outline', titleKey: 'privateContent', descKey: 'privateContentDesc' },
];

const hasActiveSubscriptionAccess = (subscription) => {
  const normalizedStatus = String(subscription?.status || '').toUpperCase();
  if (normalizedStatus === 'ACTIVE' || normalizedStatus === 'TRIALING') return true;
  if (normalizedStatus !== 'CANCELED' && normalizedStatus !== 'CANCELLED') return false;
  const parsedEndDate = new Date(subscription?.currentPeriodEnd);
  return !Number.isNaN(parsedEndDate.getTime()) && parsedEndDate >= new Date();
};

const withAlpha = (hex, alpha = 0.12) => {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;
  const int = parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const formatMoney = (value) => `$${Number(value).toFixed(2)}`;

const SubscriptionDetails = () => {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const { bgStyle, textStyle, bg, text, card, cardStyle } = useAppTheme();
  const { t } = useLanguage();

  const [subscriptionData, setSubscriptionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activating, setActivating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showActivationPopup, setShowActivationPopup] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const paymentPollRef = useRef(null);

  const benefitCardWidth = Math.min(168, Math.max(148, width * 0.42));
  const themeColors = useMemo(() => ({
    bg,
    text,
    card,
    border: `${text}22`,
    subText: '#6B7280',
    bodyText: '#111827',
    success: '#22C55E',
    warning: '#FF6B35',
    warningBg: '#FFF4EA',
  }), [bg, text, card]);

  const loadSubscriptionData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      const response = await checkSubscription();
      if (response.success) {
        setSubscriptionData(response.data);
        return response.data;
      }
      if (!silent) setSubscriptionData(null);
      return null;
    } catch (error) {
      console.error('Error loading subscription:', error);
      if (!silent) {
        Alert.alert(t('subscription.error'), t('subscription.failedToLoad'));
        setSubscriptionData(null);
      }
      return null;
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [t]);

  const pollSubscriptionAfterPayment = useCallback(async () => {
    if (paymentPollRef.current) return paymentPollRef.current;

    paymentPollRef.current = (async () => {
      setRefreshing(true);
      setActivating(true);
      try {
        for (let attempt = 0; attempt < PAYMENT_POLL_ATTEMPTS; attempt += 1) {
          try {
            const response = await checkSubscription();
            if (response?.success) {
              setSubscriptionData(response.data);
              if (hasActiveSubscriptionAccess(response.data?.subscription)) return true;
            }
          } catch (error) {
            console.error('Error polling subscription status:', error);
          }
          if (attempt < PAYMENT_POLL_ATTEMPTS - 1) {
            await new Promise((resolve) => setTimeout(resolve, PAYMENT_POLL_DELAY_MS));
          }
        }
        return false;
      } finally {
        setRefreshing(false);
        setActivating(false);
        paymentPollRef.current = null;
      }
    })();

    return paymentPollRef.current;
  }, []);

  useFocusEffect(useCallback(() => {
    loadSubscriptionData();
  }, [loadSubscriptionData]));

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('PAYMENT_COMPLETED', (data) => {
      const paymentStatus = String(data?.status || 'success').toLowerCase();
      const isPaymentSuccess = !['failed', 'cancelled', 'canceled'].includes(paymentStatus);
      if (!isPaymentSuccess) return;
      setShowActivationPopup(false);
      void pollSubscriptionAfterPayment();
    });
    return () => subscription.remove();
  }, [pollSubscriptionAfterPayment]);

  useEffect(() => () => {
    paymentPollRef.current = null;
  }, []);

  const formatDateISO = (isoString) => {
    if (!isoString) return t('subscription.notAvailable');
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeRemaining = (endDate) => {
    if (!endDate) return t('subscription.notAvailable');
    const now = new Date();
    const end = new Date(typeof endDate === 'string' ? endDate : endDate * 1000);
    const diff = end - now;
    if (diff <= 0) return t('subscription.expired');
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return t('subscription.daysHoursRemaining', { days, hours });
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return t('subscription.hoursMinutesRemaining', { hours, minutes });
  };

  const confirmCancellation = async () => {
    try {
      setCancelling(true);
      const response = await cancelSubscription();
      if (response.success) {
        Alert.alert(t('subscription.success'), response.data.message);
        await loadSubscriptionData({ silent: true });
      } else {
        Alert.alert(t('subscription.error'), t('subscription.failedToCancel'));
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      Alert.alert(t('subscription.error'), t('subscription.failedToCancel'));
    } finally {
      setCancelling(false);
    }
  };

  const handleCancelSubscription = () => {
    Alert.alert(
      t('subscription.cancelTitle'),
      t('subscription.cancelMessage'),
      [
        { text: t('subscription.keepSubscription'), style: 'cancel' },
        { text: t('subscription.yesCancel'), style: 'destructive', onPress: confirmCancellation },
      ],
    );
  };

  const handleActivationConfirm = async () => {
    try {
      setActivating(true);
      const onboardingStatus = await getOnboardingStatus();
      const isReady = onboardingStatus?.data?.canReceivePayments === true
        && Boolean(onboardingStatus?.data?.accountId);

      if (!isReady) {
        const onboardingLink = await createOnboardingLink();
        const onboardingUrl = onboardingLink?.data?.onboardingUrl
          ?? onboardingLink?.data?.data?.onboardingUrl;

        if (onboardingUrl) {
          let browserResult;
          if (await InAppBrowser.isAvailable()) {
            browserResult = await InAppBrowser.open(onboardingUrl, {
              dismissButtonStyle: 'close',
              preferredBarTintColor: '#000',
              preferredControlTintColor: '#fff',
              showTitle: true,
              toolbarColor: '#000',
              enableUrlBarHiding: true,
              enableDefaultShare: false,
            });
          } else {
            await Linking.openURL(onboardingUrl);
          }

          if (browserResult?.type === 'cancel' || browserResult?.type === 'dismiss') {
            setShowActivationPopup(false);
            return;
          }

          let onboarded = false;
          for (let i = 0; i < 10; i++) {
            const status = await getOnboardingStatus();
            if (status?.data?.canReceivePayments && status?.data?.accountId) {
              onboarded = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }

          if (!onboarded) {
            Alert.alert(t('subscription.error'), t('subventionSetup.stripeIncomplete'));
            setShowActivationPopup(false);
            return;
          }
        }
      }

      const response = await createCheckoutSession();
      const checkoutUrl = response?.data?.url;
      if (!checkoutUrl) throw new Error('Checkout URL not received');

      let cancelled = false;
      if (await InAppBrowser.isAvailable()) {
        const browserResult = await InAppBrowser.open(checkoutUrl, {
          dismissButtonStyle: 'close',
          preferredBarTintColor: '#000',
          preferredControlTintColor: '#fff',
          showTitle: true,
          toolbarColor: '#000',
          enableUrlBarHiding: true,
          enableDefaultShare: false,
        });
        cancelled = browserResult?.type === 'cancel' || browserResult?.type === 'dismiss';
      } else {
        await Linking.openURL(checkoutUrl);
      }

      setShowActivationPopup(false);
      if (!cancelled) await pollSubscriptionAfterPayment();
    } catch (error) {
      console.error('Error activating subscription:', error);
      Alert.alert(t('subscription.error'), error?.message || t('payment.paymentErrorMsg'));
    } finally {
      setActivating(false);
    }
  };

  const renderHeader = () => (
    <View style={[styles.headerWrap, cardStyle, { borderBottomColor: themeColors.border }]}>
      <TouchableOpacity
        style={[styles.backButton, { backgroundColor: bg, borderColor: themeColors.border }]}
        onPress={() => navigation?.goBack()}
      >
        <Ionicons name="arrow-back" size={22} color={text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: themeColors.bodyText }]}>
        {t('subscription.headerTitle')}
      </Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  const renderHeroIllustration = () => (
    <View style={styles.heroArtWrap}>
      <View style={[styles.heroArtGlow, { backgroundColor: withAlpha(text, 0.12) }]} />
      <View style={styles.logoBackground}>
        <LogoIcon height={88} width={88} />
      </View>
      <View style={[styles.heroArtFloat, styles.heroArtFloatLeft, { backgroundColor: card }]}>
        <Ionicons name="lock-closed-outline" size={14} color={text} />
      </View>
      <View style={[styles.heroArtFloat, styles.heroArtFloatRight, { backgroundColor: card }]}>
        <Ionicons name="chatbubble-ellipses-outline" size={14} color={text} />
      </View>
    </View>
  );

  const renderHero = (isActive) => (
    <LinearGradient
      colors={[withAlpha(text, 0.14), withAlpha(text, 0.04), card]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.heroCard, { borderColor: withAlpha(text, 0.12) }]}
    >
      <View style={styles.heroContent}>
        <View style={styles.heroCopy}>
          <View style={[styles.premiumBadge, { backgroundColor: withAlpha(text, 0.12) }]}>
            <Text style={[styles.premiumBadgeText, { color: text }]}>{t('subscription.premiumBadge')}</Text>
          </View>
          <Text style={[styles.heroTitle, { color: themeColors.bodyText }]}>
            {isActive ? t('subscription.activeTitle') : t('subscription.notActiveTitle')}
          </Text>
          <Text style={styles.heroSubtitle}>
            {isActive ? t('subscription.activeSubtitle') : t('subscription.notActiveSubtitle')}
          </Text>
          {!isActive && (
            <View style={[styles.statusPill, { backgroundColor: withAlpha(text, 0.1) }]}>
              <Ionicons name="time-outline" size={14} color={text} />
              <Text style={[styles.statusPillText, { color: text }]}>{t('subscription.notActiveBadge')}</Text>
            </View>
          )}
          {isActive && (
            <View style={[styles.statusPill, { backgroundColor: withAlpha(themeColors.success, 0.12) }]}>
              <Ionicons name="checkmark-circle" size={14} color={themeColors.success} />
              <Text style={[styles.statusPillText, { color: themeColors.success }]}>
                {t('subscription.activeStatus')}
              </Text>
            </View>
          )}
        </View>
        {renderHeroIllustration()}
      </View>
    </LinearGradient>
  );

  const renderBenefitCard = (benefit) => (
    <View
      key={benefit.titleKey}
      style={[
        styles.benefitCard,
        cardStyle,
        { width: benefitCardWidth, borderColor: withAlpha(text, 0.12) },
      ]}
    >
      <View style={[styles.benefitIconWrap, { backgroundColor: withAlpha(text, 0.1) }]}>
        <MaterialCommunityIcons name={benefit.icon} size={22} color={text} />
      </View>
      <Text style={[styles.benefitTitle, { color: text }]}>{t(`subscription.${benefit.titleKey}`)}</Text>
      <Text style={styles.benefitDesc}>{t(`subscription.${benefit.descKey}`)}</Text>
    </View>
  );

  const renderBenefitsSection = (isActive) => (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: themeColors.bodyText }]}>
          {isActive ? t('subscription.premiumAccessTitle') : t('subscription.whatYouGetTitle')}
        </Text>
        {isActive && (
          <View style={[styles.memberBadge, { backgroundColor: withAlpha(text, 0.1) }]}>
            <Ionicons name="diamond-outline" size={14} color={text} />
            <Text style={[styles.memberBadgeText, { color: text }]}>{t('subscription.premiumMember')}</Text>
          </View>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.benefitsRow}>
        {BENEFITS.map(renderBenefitCard)}
      </ScrollView>
      {isActive && (
        <View style={styles.unlimitedRow}>
          <Ionicons name="checkmark-circle" size={16} color={text} />
          <Text style={styles.unlimitedText}>{t('subscription.unlimitedAccessNote')}</Text>
        </View>
      )}
    </View>
  );

  const renderPlanOption = (planKey) => {
    const plan = PLANS[planKey];
    const selected = selectedPlan === planKey;
    return (
      <TouchableOpacity
        key={planKey}
        activeOpacity={0.9}
        onPress={() => setSelectedPlan(planKey)}
        style={[
          styles.planCard,
          cardStyle,
          { borderColor: selected ? text : withAlpha(text, 0.12) },
          selected && { backgroundColor: withAlpha(text, 0.04) },
        ]}
      >
        <View style={styles.planTopRow}>
          <View style={[styles.radioOuter, { borderColor: selected ? text : '#D1D5DB' }]}>
            {selected && <View style={[styles.radioInner, { backgroundColor: text }]} />}
          </View>
          <View style={[styles.planBadge, {
            backgroundColor: plan.badgeTone === 'success' ? withAlpha(themeColors.success, 0.12) : withAlpha(text, 0.12),
          }]}
          >
            <Text style={[styles.planBadgeText, {
              color: plan.badgeTone === 'success' ? themeColors.success : text,
            }]}
            >
              {t(`subscription.${plan.badgeKey}`)}
            </Text>
          </View>
        </View>
        <View style={styles.planTitleRow}>
          <MaterialCommunityIcons name="crown-outline" size={18} color={text} />
          <Text style={[styles.planTitle, { color: themeColors.bodyText }]}>{t(`subscription.${plan.titleKey}`)}</Text>
        </View>
        <Text style={styles.planDesc}>{t(`subscription.${plan.descKey}`)}</Text>
        <View style={styles.planPriceRow}>
          <Text style={[styles.planPrice, { color: themeColors.bodyText }]}>{formatMoney(plan.price)}</Text>
          <Text style={styles.planPeriod}>{t(`subscription.${plan.periodKey}`)}</Text>
        </View>
        {plan.originalPrice ? (
          <Text style={styles.planOriginalPrice}>{formatMoney(plan.originalPrice)}</Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderPlanPicker = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: themeColors.bodyText }]}>{t('subscription.choosePlanTitle')}</Text>
      <Text style={styles.sectionSubtitle}>{t('subscription.choosePlanSubtitle')}</Text>
      {renderPlanOption('monthly')}
      {renderPlanOption('annual')}
    </View>
  );

  const renderDetailRow = (icon, label, value, valueColor) => (
    <View style={[styles.detailRow, { borderBottomColor: withAlpha(text, 0.08) }]}>
      <View style={[styles.detailIconWrap, { backgroundColor: withAlpha(text, 0.08) }]}>
        <Ionicons name={icon} size={16} color={text} />
      </View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, { color: valueColor || themeColors.bodyText }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );

  const renderPlanDetails = (subscription, isActive) => {
    const billingLabel = selectedPlan === 'annual'
      ? t('subscription.billingAnnual')
      : t('subscription.billingMonthly');

    return (
      <View style={[styles.detailsCard, cardStyle, { borderColor: withAlpha(text, 0.1) }]}>
        <View style={styles.detailsHeader}>
          <Ionicons name="clipboard-outline" size={20} color={text} />
          <Text style={[styles.detailsTitle, { color: themeColors.bodyText }]}>{t('subscription.planDetails')}</Text>
        </View>

        {isActive ? (
          <>
            {renderDetailRow(
              'checkmark-circle-outline',
              t('subscription.statusLabel'),
              t('subscription.activeStatus'),
              themeColors.success,
            )}
            {renderDetailRow('calendar-outline', t('subscription.startedLabel'), formatDateISO(subscription?.start))}
            {renderDetailRow(
              'time-outline',
              t('subscription.renewsOnLabel'),
              formatDateISO(subscription?.currentPeriodEnd),
            )}
          </>
        ) : (
          <>
            {renderDetailRow('card-outline', t('subscription.billingLabel'), billingLabel)}
            {renderDetailRow('time-outline', t('subscription.renewsOnLabel'), formatDateISO(subscription?.currentPeriodEnd))}
            {renderDetailRow('close-circle-outline', t('subscription.cancelAnytimeLabel'), t('subscription.cancelAnytimeYes'))}
          </>
        )}

        {isActive && (
          <View style={[styles.timeRemainingCard, { backgroundColor: withAlpha(text, 0.06) }]}>
            <View style={[styles.timeRemainingIcon, { backgroundColor: withAlpha(text, 0.12) }]}>
              <Text style={[styles.timeRemainingIconText, { color: text }]}>L</Text>
            </View>
            <View style={styles.timeRemainingCopy}>
              <Text style={[styles.timeRemainingValue, { color: themeColors.bodyText }]}>
                {getTimeRemaining(subscription?.currentPeriodEnd)}
              </Text>
              <Text style={styles.timeRemainingNote}>{t('subscription.autoRenewNote')}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderWhySubscribe = () => (
    <View style={[styles.whyCard, cardStyle, { borderColor: withAlpha(text, 0.1) }]}>
      <View style={styles.whyHeader}>
        <Ionicons name="star-outline" size={20} color={text} />
        <Text style={[styles.sectionTitle, { color: themeColors.bodyText }]}>{t('subscription.whySubscribeTitle')}</Text>
      </View>
      <View style={styles.whyContent}>
        <View style={[styles.whyArt, { backgroundColor: withAlpha(text, 0.08) }]}>
          <MaterialCommunityIcons name="crown" size={42} color={text} />
        </View>
        <View style={styles.whyList}>
          {['whySubscribe1', 'whySubscribe2', 'whySubscribe3', 'whySubscribe4'].map((key) => (
            <View key={key} style={styles.whyItem}>
              <Ionicons name="checkmark-circle" size={16} color={text} />
              <Text style={styles.whyItemText}>{t(`subscription.${key}`)}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  const renderLegalLinks = () => (
    <View style={styles.section}>
      <TouchableOpacity
        style={[styles.legalRow, cardStyle, { borderColor: withAlpha(text, 0.1) }]}
        onPress={() => Linking.openURL('https://valens.app/terms')}
      >
        <Ionicons name="document-text-outline" size={18} color={text} />
        <Text style={[styles.legalText, { color: themeColors.bodyText }]}>{t('subscription.termsConditions')}</Text>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.legalRow, cardStyle, { borderColor: withAlpha(text, 0.1) }]}
        onPress={() => Linking.openURL('https://valens.app/privacy-policy')}
      >
        <Ionicons name="shield-checkmark-outline" size={18} color={text} />
        <Text style={[styles.legalText, { color: themeColors.bodyText }]}>{t('subscription.privacyPolicy')}</Text>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </TouchableOpacity>
      <Text style={styles.legalNote}>{t('subscription.legalNote')}</Text>
    </View>
  );

  const renderInactiveFooter = () => {
    const selected = PLANS[selectedPlan];
    return (
      <View style={[styles.footerBar, cardStyle, { borderTopColor: withAlpha(text, 0.1) }]}>
        <View style={styles.footerPriceBlock}>
          <Text style={styles.footerPriceLabel}>{t('subscription.totalToday')}</Text>
          <Text style={[styles.footerPriceValue, { color: text }]}>{formatMoney(selected.price)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.subscribeButton, { backgroundColor: text }]}
          onPress={() => setShowActivationPopup(true)}
          disabled={activating}
        >
          {activating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.subscribeButtonText}>{t('subscription.subscribeNow')}</Text>
          )}
        </TouchableOpacity>
        <View style={styles.secureRow}>
          <Ionicons name="lock-closed-outline" size={14} color="#6B7280" />
          <Text style={styles.secureText}>{t('subscription.securePayment')}</Text>
        </View>
      </View>
    );
  };

  const renderActiveFooter = () => (
    <View style={styles.activeFooter}>
      <View style={styles.safeSecureBlock}>
        <Ionicons name="shield-checkmark-outline" size={22} color={text} />
        <View style={styles.safeSecureCopy}>
          <Text style={[styles.safeSecureTitle, { color: themeColors.bodyText }]}>{t('subscription.safeSecure')}</Text>
          <Text style={styles.safeSecureDesc}>{t('subscription.safeSecureDesc')}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.manageButton, { borderColor: text }]}
        onPress={() => loadSubscriptionData({ silent: true })}
        disabled={refreshing}
      >
        {refreshing ? (
          <ActivityIndicator color={text} />
        ) : (
          <Text style={[styles.manageButtonText, { color: text }]}>{t('subscription.manageSubscription')}</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.cancelButton, { backgroundColor: themeColors.warning }]}
        onPress={handleCancelSubscription}
        disabled={cancelling}
      >
        {cancelling ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="close-circle" size={20} color="#fff" />
            <Text style={styles.cancelButtonText}>{t('subscription.cancelButton')}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  if (loading && !subscriptionData) {
    return (
      <View style={[styles.loadingContainer, bgStyle]}>
        {renderHeader()}
        <ActivityIndicator size="large" color={text} />
        <Text style={[styles.loadingText, textStyle]}>{t('subscription.loadingText')}</Text>
      </View>
    );
  }

  if (!subscriptionData) {
    return (
      <View style={[styles.container, bgStyle]}>
        {renderHeader()}
        <View style={styles.errorWrap}>
          <Ionicons name="alert-circle-outline" size={56} color={text} />
          <Text style={[styles.errorText, { color: themeColors.bodyText }]}>{t('subscription.noDataFound')}</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: text }]} onPress={loadSubscriptionData}>
            <Text style={styles.retryButtonText}>{t('subscription.retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const subscription = subscriptionData.subscription;
  const isSubscriptionActive = hasActiveSubscriptionAccess(subscription);
  const isCancelledSubscription = subscription?.status === 'CANCELED';
  const showInactiveExperience = !isSubscriptionActive && !refreshing && !activating;

  return (
    <View style={[styles.container, bgStyle]}>
      {renderHeader()}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: showInactiveExperience ? 180 : 40 },
        ]}
      >
        {(refreshing || activating) && (
          <View style={[styles.syncBanner, { backgroundColor: themeColors.warningBg, borderColor: themeColors.warning }]}>
            <ActivityIndicator size="small" color={themeColors.warning} />
            <Text style={[styles.syncBannerText, { color: themeColors.warning }]}>
              {t('subscription.loadingText')}
            </Text>
          </View>
        )}

        {renderHero(isSubscriptionActive)}
        {renderBenefitsSection(isSubscriptionActive)}
        {showInactiveExperience && renderPlanPicker()}
        {renderPlanDetails(subscription, isSubscriptionActive)}
        {isSubscriptionActive && renderWhySubscribe()}
        {renderLegalLinks()}

        {isSubscriptionActive && !isCancelledSubscription && renderActiveFooter()}

        {isCancelledSubscription && isSubscriptionActive && (
          <View style={[styles.cancelledBanner, { backgroundColor: themeColors.warningBg, borderColor: themeColors.warning }]}>
            <Ionicons name="warning-outline" size={18} color={themeColors.warning} />
            <Text style={[styles.cancelledBannerText, { color: '#8A4B16' }]}>
              {t('subscription.cancelledWarningText')}
            </Text>
          </View>
        )}
      </ScrollView>

      {showInactiveExperience && renderInactiveFooter()}

      <SubscriptionActivationPopup
        visible={showActivationPopup}
        onClose={() => setShowActivationPopup(false)}
        onConfirm={handleActivationConfirm}
        returnToSettingsSub
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, },
  loadingText: { marginTop: 16, fontSize: 16, fontWeight: '500',textAlign:'center',alignSelf:'center' },
  headerWrap: {
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
  },
  headerSpacer: { width: 40 },
  scrollContent: { padding: 16, gap: 18 },
  syncBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  syncBannerText: { flex: 1, fontSize: 14, fontWeight: '600' },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 10,
    minHeight:240,
    overflow: 'hidden',
  },
  heroContent: { flexDirection: 'row', alignItems: 'center',paddingRight:15 },
  heroCopy: { flex: 1, paddingRight: 8 },
  premiumBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  premiumBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  heroTitle: { fontSize: 22, fontWeight: '800', lineHeight: 28, marginBottom: 8 },
  heroSubtitle: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 12 },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  heroArtWrap: { width: 108, height: 108, alignItems: 'center', justifyContent: 'center' },
  heroArtGlow: { position: 'absolute', width: 92, height: 92, borderRadius: 46 },
  logoBackground: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroArtFloat: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  heroArtFloatLeft: { top: 8, left: 0 },
  heroArtFloatRight: { top: 18, right: 0 },
  section: { gap: 12 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '800', flex: 1 },
  sectionSubtitle: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  memberBadgeText: { fontSize: 12, fontWeight: '700' },
  benefitsRow: { gap: 12, paddingRight: 8 },
  benefitCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    minHeight: 150,
  },
  benefitIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  benefitTitle: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  benefitDesc: { fontSize: 12, color: '#6B7280', lineHeight: 18 },
  unlimitedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  unlimitedText: { flex: 1, fontSize: 13, color: '#6B7280', lineHeight: 18 },
  planCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginBottom: 4,
  },
  planTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  planBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  planBadgeText: { fontSize: 11, fontWeight: '800' },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  planTitle: { fontSize: 17, fontWeight: '800' },
  planDesc: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 12 },
  planPriceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  planPrice: { fontSize: 28, fontWeight: '800' },
  planPeriod: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  planOriginalPrice: {
    marginTop: 4,
    fontSize: 13,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  detailsCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 4,
  },
  detailsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  detailsTitle: { fontSize: 17, fontWeight: '800' },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  detailIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: { flex: 1, fontSize: 14, color: '#6B7280', fontWeight: '600' },
  detailValue: { flex: 1.2, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  timeRemainingCard: {
    marginTop: 12,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeRemainingIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeRemainingIconText: { fontSize: 18, fontWeight: '800' },
  timeRemainingCopy: { flex: 1 },
  timeRemainingValue: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  timeRemainingNote: { fontSize: 12, color: '#6B7280', lineHeight: 17 },
  whyCard: { borderWidth: 1, borderRadius: 18, padding: 16 },
  whyHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  whyContent: { flexDirection: 'row', gap: 14 },
  whyArt: {
    width: 88,
    height: 88,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whyList: { flex: 1, gap: 10 },
  whyItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  whyItemText: { flex: 1, fontSize: 13, color: '#4B5563', lineHeight: 18 },
  legalRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legalText: { flex: 1, fontSize: 15, fontWeight: '600' },
  legalNote: { fontSize: 12, color: '#6B7280', lineHeight: 18, fontStyle: 'italic' },
  footerBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  footerPriceBlock: { marginBottom: 12 },
  footerPriceLabel: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  footerPriceValue: { fontSize: 28, fontWeight: '800' },
  subscribeButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  subscribeButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secureRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secureText: { fontSize: 12, color: '#6B7280' },
  activeFooter: { gap: 14, marginTop: 4 },
  safeSecureBlock: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  safeSecureCopy: { flex: 1 },
  safeSecureTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  safeSecureDesc: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  manageButton: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  manageButtonText: { fontSize: 15, fontWeight: '800' },
  cancelButton: {
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    minHeight: 52,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelledBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  cancelledBannerText: { flex: 1, fontSize: 13, lineHeight: 18 },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 16, marginTop: 12, marginBottom: 18, textAlign: 'center' },
  retryButton: { borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12 },
  retryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default SubscriptionDetails;
