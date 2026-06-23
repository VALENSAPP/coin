import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  DeviceEventEmitter,
} from 'react-native';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { cancelSubscription, checkSubscription, createCheckoutSession } from '../../services/stirpe';
import { ScrollView } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSelector } from 'react-redux';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n';
import SubscriptionActivationPopup from '../../components/modals/SubscriptionActivationPopUp';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { createOnboardingLink, getOnboardingStatus } from '../../services/profile';

const PAYMENT_POLL_ATTEMPTS = 8;
const PAYMENT_POLL_DELAY_MS = 1500;

const hasActiveSubscriptionAccess = subscription => {
  const normalizedStatus = String(subscription?.status || '').toUpperCase();
  if (normalizedStatus === 'ACTIVE' || normalizedStatus === 'TRIALING') return true;
  if (normalizedStatus !== 'CANCELED' && normalizedStatus !== 'CANCELLED') return false;

  const parsedEndDate = new Date(subscription?.currentPeriodEnd);
  return !Number.isNaN(parsedEndDate.getTime()) && parsedEndDate >= new Date();
};

const Subscription = () => {
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activating, setActivating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showActivationPopup, setShowActivationPopup] = useState(false);
  const paymentPollRef = useRef(null);
  const navigation = useNavigation();
  const [isBusinessProfile, setIsBusinessProfile] = useState(false);
  const reduxProfile = useSelector(state => state.userProfile.userProfile);
  const profileThemeType = isBusinessProfile ? 'company' : undefined;
  const { bgStyle, textStyle, bg, text, card, accent, mutedText, border, icon } = useAppTheme(profileThemeType);
  const { isDarkMode } = useThemeContext();
  const { t } = useLanguage();

  const loadProfileType = useCallback(async () => {
    const type = await AsyncStorage.getItem('profile');
    if (type) {
      setIsBusinessProfile(String(type).toLowerCase() !== 'user');
    }
  }, []);

  const highlightColor = isBusinessProfile ? accent : '#FF6B35';

  const themeColors = {
    bg,
    text,
    card,
    border,
    subText: mutedText,
    accent,
    icon,
    warning: highlightColor,
    warningBg: isDarkMode ? `${highlightColor}22` : (isBusinessProfile ? `${accent}18` : '#FFF4EA'),
    warningText: isDarkMode ? highlightColor : (isBusinessProfile ? accent : '#8A4B16'),
    buttonBg: accent,
    buttonText: '#ffffff',
  };

  const loadSubscriptionData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await checkSubscription();
      if (response.success) {
        setSubscriptionData(response.data);
        return response.data;
      }

      if (!silent) {
        setSubscriptionData(null);
      }
      return null;
    } catch (error) {
      console.error('Error loading subscription:', error);
      if (!silent) {
        Alert.alert(t('subscription.error'), t('subscription.failedToLoad'));
        setSubscriptionData(null);
      }
      return null;
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [t]);

  const pollSubscriptionAfterPayment = useCallback(async () => {
    if (paymentPollRef.current) {
      return paymentPollRef.current;
    }

    paymentPollRef.current = (async () => {
      setRefreshing(true);
      setActivating(true);

      try {
        for (let attempt = 0; attempt < PAYMENT_POLL_ATTEMPTS; attempt += 1) {
          try {
            const response = await checkSubscription();
            if (response?.success) {
              setSubscriptionData(response.data);
              const subscription = response.data?.subscription;
              if (hasActiveSubscriptionAccess(subscription)) {
                return true;
              }
            }
          } catch (error) {
            console.error('Error polling subscription status:', error);
          }

          if (attempt < PAYMENT_POLL_ATTEMPTS - 1) {
            await new Promise(resolve => setTimeout(resolve, PAYMENT_POLL_DELAY_MS));
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
    loadProfileType();
    loadSubscriptionData();
  }, [loadProfileType, loadSubscriptionData]));

  useEffect(() => {
    if (reduxProfile && reduxProfile !== 'normal') {
      setIsBusinessProfile(String(reduxProfile).toLowerCase() !== 'user');
    }
  }, [reduxProfile]);

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

  const handleCancelSubscription = () => {
    Alert.alert(
      t('subscription.cancelTitle'),
      t('subscription.cancelMessage'),
      [
        {
          text: t('subscription.keepSubscription'),
          style: 'cancel',
        },
        {
          text: t('subscription.yesCancel'),
          style: 'destructive',
          onPress: confirmCancellation,
        },
      ],
    );
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

  const isBrowserCancelled = result => result?.type === 'cancel' || result?.type === 'dismiss';

  const handleActivationConfirm = async () => {
    try {
      setActivating(true);

      // 1. Check onboarding status first
      const onboardingStatus = await getOnboardingStatus();
      const isReady = onboardingStatus?.data?.canReceivePayments === true
        && Boolean(onboardingStatus?.data?.accountId);

      if (!isReady) {
        // 2. Not onboarded — open onboarding flow
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

          // User cancelled onboarding
          if (browserResult?.type === 'cancel' || browserResult?.type === 'dismiss') {
            setShowActivationPopup(false);
            return;
          }

          // 3. Poll until onboarding completes
          let onboarded = false;
          for (let i = 0; i < 10; i++) {
            const status = await getOnboardingStatus();
            if (status?.data?.canReceivePayments && status?.data?.accountId) {
              onboarded = true;
              break;
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

          if (!onboarded) {
            Alert.alert(t('subscription.error'), t('subventionSetup.stripeIncomplete'));
            setShowActivationPopup(false);
            return;
          }
        }
      }

      // 4. Onboarding confirmed — proceed to checkout
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
      if (!cancelled) {
        await pollSubscriptionAfterPayment();
      }
    } catch (error) {
      console.error('Error activating subscription:', error);
      Alert.alert(t('subscription.error'), error?.message || t('payment.paymentErrorMsg'));
    } finally {
      setActivating(false);
    }
  };

  const formatDateISO = isoString => {
    if (!isoString) return t('subscription.notAvailable');
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeRemaining = endDate => {
    if (!endDate) return t('subscription.notAvailable');

    const now = new Date();
    const end = new Date(
      typeof endDate === 'string' ? endDate : endDate * 1000,
    );
    const diff = end - now;

    if (diff <= 0) return t('subscription.expired');

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return t('subscription.daysHoursRemaining', { days, hours });
    } else {
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return t('subscription.hoursMinutesRemaining', { hours, minutes });
    }
  };

  const getStatusColor = (status, isCancelled) => {
    if (isCancelled) return highlightColor;
    switch (status?.toLowerCase()) {
      case 'active':
        return '#4CAF50';
      case 'canceled':
      case 'cancelled':
        return '#f44336';
      case 'past_due':
        return '#ff9800';
      default:
        return '#757575';
    }
  };

  const getStatusText = subscription => {
    if (
      subscription.subscription &&
      subscription.subscription.status === 'CANCELED' &&
      hasActiveSubscriptionAccess(subscription.subscription)
    ) {
      return t('subscription.cancelledActiveUntilPeriodEnd');
    }
    if (subscription.subscription) {
      return subscription.subscription.status;
    }
    return t('subscription.unknown');
  };

  if (loading && !subscriptionData) {
    return (
      <View style={[styles.loadingContainer, bgStyle]}>
        <ActivityIndicator size="large" color={themeColors.text} />
        <Text style={[styles.loadingText, textStyle]}>{t('subscription.loadingText')}</Text>
      </View>
    );
  }

  if (!subscriptionData) {
    return (
      <View style={[styles.errorContainer, bgStyle]}>
        <View style={[styles.errorCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Icon name="alert-circle-outline" size={64} color={themeColors.text} />
          <Text style={[styles.errorText, textStyle]}>{t('subscription.noDataFound')}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: themeColors.buttonBg }]}
            onPress={loadSubscriptionData}
          >
            <Text style={[styles.retryButtonText, { color: themeColors.buttonText }]}>{t('subscription.retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isCancelledSubscription =
    subscriptionData.subscription && subscriptionData.subscription.status === 'CANCELED';
  const subscription = subscriptionData.subscription;
  const isSubscriptionActive = hasActiveSubscriptionAccess(subscription);
  const shouldShowActivationOption = !isSubscriptionActive && !refreshing && !activating;

  const status = getStatusText(subscriptionData);
  const statusColor = getStatusColor(status, isCancelledSubscription);

  return (
    <View style={[styles.container, bgStyle]}>
      <View style={[styles.headerGradient, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: themeColors.bg, borderColor: themeColors.border }]}
            onPress={() => navigation?.goBack()}
          >
            <Icon name="arrow-back" size={24} color={icon} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, textStyle]}>{t('subscription.headerTitle')}</Text>
          <View style={styles.headerPlaceholder} />
        </View>
      </View>

      <ScrollView style={[styles.scrollContainer, bgStyle]} showsVerticalScrollIndicator={false}>
        {(refreshing || activating) && (
          <View style={[styles.syncBanner, { backgroundColor: themeColors.warningBg, borderColor: themeColors.warning }]}>
            <ActivityIndicator size="small" color={themeColors.warning} />
            <Text style={[styles.syncBannerText, { color: themeColors.warning }]}>
              {t('subscription.loadingText')}
            </Text>
          </View>
        )}

        {/* Status Card */}
        <View style={[styles.statusCard, { shadowColor: themeColors.text }]}>
          <View style={[styles.statusGradient, { backgroundColor: statusColor }]}>
            <View style={styles.statusContent}>
              <View style={styles.statusIconContainer}>
                <Icon
                  name={shouldShowActivationOption ? 'alert-circle' : isCancelledSubscription ? 'warning' : 'checkmark-circle'}
                  size={32}
                  color="#fff"
                />
              </View>
              <Text style={styles.statusText}>{status}</Text>
            </View>
          </View>

          {isCancelledSubscription && isSubscriptionActive && (
            <View style={[styles.warningContainer, { backgroundColor: themeColors.warningBg, borderLeftColor: themeColors.warning }]}>
              <Icon name="warning" size={20} color={themeColors.warning} />
              <Text style={[styles.warningText, { color: themeColors.warningText }]}>
                {t('subscription.cancelledWarningText')}
              </Text>
            </View>
          )}
        </View>

        {/* Plan Details Card */}
        <View style={[styles.detailsCard, { backgroundColor: themeColors.card, shadowColor: themeColors.text }]}>
          <View style={styles.cardHeader}>
            <Icon name="card-outline" size={24} color={themeColors.text} />
            <Text style={[styles.cardTitle, textStyle]}>{t('subscription.planDetails')}</Text>
          </View>

          {isCancelledSubscription ? (
            <>
              <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                <View style={styles.detailIconContainer}>
                  <Icon name="checkmark-circle" size={16} color={themeColors.warning} />
                </View>
                <Text style={[styles.detailLabel, { color: themeColors.subText }]}>{t('subscription.statusLabel')}</Text>
                <Text style={[styles.detailValue, textStyle]}>
                  {subscription?.status || t('subscription.notAvailable')}
                </Text>
              </View>

              <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                <View style={styles.detailIconContainer}>
                  <Icon name="calendar" size={16} color={themeColors.text} />
                </View>
                <Text style={[styles.detailLabel, { color: themeColors.subText }]}>{t('subscription.startedLabel')}</Text>
                <Text style={[styles.detailValue, textStyle]}>
                  {formatDateISO(subscription?.start)}
                </Text>
              </View>

              <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                <View style={styles.detailIconContainer}>
                  <Icon name="time" size={16} color={themeColors.text} />
                </View>
                <Text style={[styles.detailLabel, { color: themeColors.subText }]}>{t('subscription.currentPeriodEndsLabel')}</Text>
                <Text style={[styles.detailValue, textStyle]}>
                  {formatDateISO(subscription?.currentPeriodEnd)}
                </Text>
              </View>

              <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                <View style={styles.detailIconContainer}>
                  <Icon name="stopwatch" size={16} color={themeColors.warning} />
                </View>
                <Text style={[styles.detailLabel, { color: themeColors.subText }]}>{t('subscription.accessUntilLabel')}</Text>
                <Text style={[styles.detailValue, styles.highlightText, { color: themeColors.warning }]}>
                  {formatDateISO(subscription?.currentPeriodEnd)}
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                <View style={styles.detailIconContainer}>
                  <Icon name="checkmark-circle" size={16} color="#4CAF50" />
                </View>
                <Text style={[styles.detailLabel, { color: themeColors.subText }]}>{t('subscription.statusLabel')}</Text>
                <Text style={[styles.detailValue, textStyle]}>
                  {subscription?.status || t('subscription.notAvailable')}
                </Text>
              </View>

              <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                <View style={styles.detailIconContainer}>
                  <Icon name="calendar" size={16} color={themeColors.text} />
                </View>
                <Text style={[styles.detailLabel, { color: themeColors.subText }]}>{t('subscription.startedLabel')}</Text>
                <Text style={[styles.detailValue, textStyle]}>
                  {formatDateISO(subscription?.start)}
                </Text>
              </View>

              <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                <View style={styles.detailIconContainer}>
                  <Icon name="time" size={16} color={themeColors.text} />
                </View>
                <Text style={[styles.detailLabel, { color: themeColors.subText }]}>{t('subscription.subscriptionEndsLabel')}</Text>
                <Text style={[styles.detailValue, textStyle]}>
                  {formatDateISO(subscription?.currentPeriodEnd)}
                </Text>
              </View>
            </>
          )}

          {shouldShowActivationOption && (
            <View style={[
              styles.activationPrompt,
              {
                borderColor: isDarkMode ? `${highlightColor}55` : (isBusinessProfile ? `${accent}44` : '#fecaca'),
                backgroundColor: isDarkMode ? `${highlightColor}15` : (isBusinessProfile ? `${accent}12` : '#fff1f2'),
              },
            ]}>
              <Text style={[styles.activationPromptText, { color: themeColors.warningText }]}>
                {t('subventionSetup.inactiveSubscriptionMessage')}
              </Text>
              <TouchableOpacity
                style={[styles.activateSubscriptionButton, { backgroundColor: themeColors.buttonBg }]}
                onPress={() => setShowActivationPopup(true)}
              >
                <Text style={[styles.activateSubscriptionButtonText, { color: themeColors.buttonText }]}>
                  {t('subventionSetup.activateSubscriptionButton')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.timeRemainingContainer, { borderColor: themeColors.border }]}>
            <View style={[styles.timeRemainingGradient, { backgroundColor: themeColors.bg }]}>
              <Text style={[styles.timeRemainingLabel, { color: themeColors.subText }]}>{t('subscription.timeRemaining')}</Text>
              <Text style={[styles.timeRemainingValue, textStyle]}>
                {getTimeRemaining(subscription?.currentPeriodEnd)}
              </Text>
            </View>
          </View>
        </View>

        {/* Legal Links */}
        <View style={[styles.legalCard, { backgroundColor: themeColors.card, shadowColor: themeColors.text }]}>
          <View style={styles.cardHeader}>
            <Icon name="document-text" size={24} color={themeColors.text} />
            <Text style={[styles.cardTitle, textStyle]}>{t('subscription.importantInfo')}</Text>
          </View>

          <View style={styles.legalLinksRow}>
            <TouchableOpacity
              style={styles.legalLink}
              onPress={() => Linking.openURL('https://valens.app/terms')}
            >
              <View style={[styles.legalLinkGradient, { backgroundColor: themeColors.bg, borderColor: themeColors.border }]}>
                <Icon name="document-text" size={16} color={themeColors.text} />
                <Text style={[styles.legalLinkText, textStyle]}>{t('subscription.termsConditions')}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.legalLink}
              onPress={() => Linking.openURL('https://valens.app/privacy-policy')}
            >
              <View style={[styles.legalLinkGradient, { backgroundColor: themeColors.bg, borderColor: themeColors.border }]}>
                <Icon name="shield-checkmark" size={16} color={themeColors.text} />
                <Text style={[styles.legalLinkText, textStyle]}>{t('subscription.privacyPolicy')}</Text>
              </View>
            </TouchableOpacity>
          </View>

          <Text style={[styles.legalLinksNote, { color: themeColors.subText }]}>
            {t('subscription.legalNote')}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {!isCancelledSubscription && subscription?.status === 'ACTIVE' && (
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: themeColors.warning }]}
              onPress={handleCancelSubscription}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="close-circle" size={20} color="#fff" />
                  <Text style={styles.cancelButtonText}>{t('subscription.cancelButton')}</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.refreshButton, { backgroundColor: themeColors.buttonBg }]}
            onPress={() => loadSubscriptionData({ silent: true })}
            disabled={refreshing || activating}
          >
            {refreshing ? (
              <ActivityIndicator color={themeColors.buttonText} />
            ) : (
              <>
                <Icon name="refresh" size={20} color={themeColors.buttonText} />
                <Text style={[styles.refreshButtonText, { color: themeColors.buttonText }]}>{t('subscription.refreshButton')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      <SubscriptionActivationPopup
        visible={showActivationPopup}
        onClose={() => setShowActivationPopup(false)}
        onConfirm={handleActivationConfirm}
        returnToSettingsSub={true}
        isBusinessProfile={isBusinessProfile}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 40,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  syncBanner: {
    marginTop: 16,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  syncBannerText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: '500',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusCard: {
    marginTop: 20,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  statusGradient: {
    padding: 20,
  },
  statusContent: {
    alignItems: 'center',
  },
  statusIconContainer: {
    marginBottom: 8,
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderLeftWidth: 4,
  },
  warningText: {
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 8,
    flex: 1,
  },
  detailsCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  detailIconContainer: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
  },
  detailLabel: {
    fontSize: 16,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    fontWeight: '500',
    paddingRight: 8,
    lineHeight: 22,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    textAlign: 'right',
    lineHeight: 22,
  },
  highlightText: {
    fontWeight: 'bold',
  },
  activationPrompt: {
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  activationPromptText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  activateSubscriptionButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  activateSubscriptionButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  timeRemainingContainer: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  timeRemainingGradient: {
    padding: 20,
    alignItems: 'center',
  },
  timeRemainingLabel: {
    fontSize: 14,
    marginTop: 8,
    marginBottom: 4,
    fontWeight: '500',
  },
  timeRemainingValue: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  legalCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  legalLinksRow: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  legalLink: {
    flex: 1,
    marginHorizontal: 4,
  },
  legalLinkGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
    borderWidth: 1,
  },
  legalLinkText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  legalLinksNote: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    fontStyle: 'italic',
  },
  actionContainer: {
    marginTop: 24,
    marginBottom: 40,
  },
  cancelButton: {
    marginBottom: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  refreshButton: {
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  refreshButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default Subscription;
