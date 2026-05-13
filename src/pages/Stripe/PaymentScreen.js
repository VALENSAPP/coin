import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  BackHandler,
  Linking,
  ScrollView,
  Dimensions,
} from 'react-native';

import LinearGradient from 'react-native-linear-gradient';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSelector, useDispatch } from 'react-redux';
import { loggedOut } from '../../redux/actions/LoginAction';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../../components/displaytoastmessage';
import { createCheckoutSession } from '../../services/stirpe';
import { getPaymentSessionUrl, getStripeErrorMessages } from '../../utils/stripeOnboarding';
import { useStripeCustomer } from '../../hooks/useStripeCustomer';
import StripePaymentMethodModal from '../../components/modals/StripePaymentMethodModal';
import { useLanguage } from '../../i18n';

const PaymentScreen = ({ onPaymentSuccess, onRetryCheck }) => {
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const toast = useToast();
  const { requireStripeCustomerForPayment, openPaymentConnectionAndRefresh } = useStripeCustomer();
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const { t } = useLanguage();
  const stripeErrorMessages = getStripeErrorMessages(t);

  useEffect(() => {
    const handleDeepLink = (event) => {
      console.log(event, 'checkEvent Exist');
      if (event?.url) {
        handlePaymentResult(event.url);
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url) handlePaymentResult(url);
    });

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);

    return () => {
      subscription?.remove?.();
      backHandler.remove();
    };
  }, []);

  const getUserToken = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      return token;
    } catch (error) {
      return null;
    }
  };

  const parseDeepLink = (url) => {
    try {
      const [, afterScheme = ''] = url.split('://');
      const [host, queryString = ''] = afterScheme.split('?');
      const params = Object.fromEntries(new URLSearchParams(queryString));
      return { host, params };
    } catch {
      return { host: '', params: {} };
    }
  };

  const handlePaymentResult = async (url) => {
    const { host, params } = parseDeepLink(url);

    if (host === 'payment-success') {
      await verifyPaymentStatus(true);
    } else if (host === 'payment-cancel') {
      Alert.alert(
        t('payment.paymentCancelled'),
        t('payment.paymentCancelledMsg'),
        [{ text: t('payment.tryAgain'), onPress: () => {} }],
      );
    } else if (host === 'payment-failure') {
      Alert.alert(
        t('payment.paymentError'),
        t('payment.paymentErrorMsg'),
        [{ text: t('payment.tryAgain'), onPress: () => {} }],
      );
    }
  };

  const verifyPaymentStatus = async (success) => {
    if (success) {
      Alert.alert(
        t('payment.paymentSuccess'),
        t('payment.paymentSuccessMsg'),
        [{ text: t('payment.continueBtn'), onPress: () => onPaymentSuccess?.() }],
      );
    } else {
      Alert.alert(
        t('payment.paymentFailed'),
        t('payment.paymentFailedMsg'),
        [{ text: t('payment.continueBtn'), onPress: () => onPaymentSuccess?.() }],
      );
    }
  };

  const createStripeSubscription = async () => {
    const canProceed = await requireStripeCustomerForPayment();
    if (!canProceed) {
      setShowPaymentMethodModal(true);
      return;
    }
    setLoading(true);
    try {
      const token = await getUserToken();

      if (!token) {
        showToastMessage(toast, 'danger', t('payment.authError'));
        return;
      }

      const response = await createCheckoutSession();
      const url = getPaymentSessionUrl(response);

      if (url) {
        await openPaymentBrowser(url);
      } else {
        showToastMessage(
          toast,
          'danger',
          response?.error || response?.message || stripeErrorMessages.SESSION_FAILED,
        );
      }
    } catch (error) {
      showToastMessage(toast, 'danger', error?.response?.data?.message || t('payment.networkError'));
    } finally {
      setLoading(false);
    }
  };

  const openPaymentBrowser = async (url) => {
    try {
      if (await InAppBrowser.isAvailable()) {
        const authResult = await InAppBrowser.openAuth(url, 'com.valens://', {
          showTitle: true,
          enableUrlBarHiding: true,
          enableDefaultShare: false,
          forceCloseOnRedirection: true,
        });
        await handleRetryCheck();
      } else {
        await Linking.openURL(url);
      }
    } catch (error) {
      Alert.alert('Error', error?.message || t('payment.networkError'));
    }
  };

  const handleLogout = async () => {
    Alert.alert(t('payment.logoutTitle'), t('payment.logoutMessage'), [
      { text: t('payment.logoutCancel'), style: 'cancel' },
      {
        text: t('payment.logoutConfirm'),
        onPress: async () => {
          try {
            await AsyncStorage.multiRemove([
              'userToken',
              'token',
              'firebaseToken',
              'userId',
              'username',
              'email',
              'walletAddress',
              'walletPrivateKey',
              'walletMnemonic',
              'profile',
              'stripeCustomerId',
            ]);
            await AsyncStorage.setItem('isLoggedIn', 'false');
            dispatch(loggedOut());
          } catch (error) {}
        },
      },
    ]);
  };

  const handleRetryCheck = async () => {
    if (onRetryCheck) {
      setLoading(true);
      try {
        const result = await onRetryCheck();

        if (result && result.success) {
          // Subscription is active — RootNavigator handles navigation
        } else {
          if (result && result.message) {
            if (
              result.message.includes('No active subscription') ||
              result.message.includes('No subscription found')
            ) {
              showToastMessage(toast, 'info', t('payment.noSubscription'));
            } else {
              showToastMessage(toast, 'warning', result.message);
            }
          }
        }
      } catch (error) {
        showToastMessage(toast, 'danger', t('payment.verifyFailed'));
      } finally {
        setLoading(false);
      }
    }
  };

  const { width } = Dimensions.get('window');

  return (
    <>
      <LinearGradient
        colors={['#667eea', '#764ba2', '#f093fb']}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.content}>
              {/* Header Section */}
              <View style={styles.header}>
                <View style={styles.iconContainer}>
                  <Text style={styles.iconEmoji}>👑</Text>
                </View>
                <Text style={styles.title}>{t('payment.title')}</Text>
                <Text style={styles.subtitle}>{t('payment.subtitle')}</Text>
              </View>

              {/* Pricing Card */}
              <View style={styles.pricingCard}>
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>{t('payment.mostPopular')}</Text>
                </View>

                <View style={styles.priceContainer}>
                  <Text style={styles.currency}>{t('payment.currency')}</Text>
                  <Text style={styles.price}>{t('payment.price')}</Text>
                  <Text style={styles.period}>{t('payment.period')}</Text>
                </View>

                <Text style={styles.priceDescription}>{t('payment.billingNote')}</Text>

                <View style={styles.features}>
                  <View style={styles.featureRow}>
                    <View style={styles.checkmarkContainer}>
                      <Text style={styles.checkmark}>✓</Text>
                    </View>
                    <Text style={styles.feature}>{t('payment.features.unlimitedAccess')}</Text>
                  </View>
                  <View style={styles.featureRow}>
                    <View style={styles.checkmarkContainer}>
                      <Text style={styles.checkmark}>✓</Text>
                    </View>
                    <Text style={styles.feature}>{t('payment.features.premiumCreator')}</Text>
                  </View>
                  <View style={styles.featureRow}>
                    <View style={styles.checkmarkContainer}>
                      <Text style={styles.checkmark}>✓</Text>
                    </View>
                    <Text style={styles.feature}>{t('payment.features.freeCredits')}</Text>
                  </View>
                  <View style={styles.featureRow}>
                    <View style={styles.checkmarkContainer}>
                      <Text style={styles.checkmark}>✓</Text>
                    </View>
                    <Text style={styles.feature}>{t('payment.features.dashboard')}</Text>
                  </View>
                  <View style={styles.featureRow}>
                    <View style={styles.checkmarkContainer}>
                      <Text style={styles.checkmark}>✓</Text>
                    </View>
                    <Text style={styles.feature}>{t('payment.features.prioritySupport')}</Text>
                  </View>
                  <View style={styles.featureRow}>
                    <View style={styles.checkmarkContainer}>
                      <Text style={styles.checkmark}>✓</Text>
                    </View>
                    <Text style={styles.feature}>{t('payment.features.cancelAnytime')}</Text>
                  </View>
                </View>
              </View>

              {/* Security Info */}
              <View style={styles.infoSection}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>🔒</Text>
                  <Text style={styles.infoText}>{t('payment.security.stripe')}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>💡</Text>
                  <Text style={styles.infoText1}>{t('payment.security.cancel')}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>📋</Text>
                  <Text style={styles.infoText}>{t('payment.security.terms')}</Text>
                </View>
                <View style={styles.warningRow}>
                  <Text style={styles.infoIcon}>⚠️</Text>
                  <Text style={styles.warningText}>{t('payment.security.disclaimer')}</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.subscribeButton, loading && styles.disabledButton]}
                  onPress={createStripeSubscription}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#FF6B6B', '#FF8E53']}
                    style={styles.buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text style={styles.subscribeButtonText}>{t('payment.subscribeButton')}</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={handleRetryCheck}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  {loading ? (
                    <View style={styles.retryButtonLoading}>
                      <ActivityIndicator color="#007AFF" size="small" />
                      <Text style={[styles.retryButtonText, { marginLeft: 10 }]}>
                        {t('payment.checkingStatus')}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.retryButtonText}>{t('payment.verifyButton')}</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <View style={styles.legalLinks}>
                  <TouchableOpacity
                    style={styles.legalButton}
                    onPress={() => Linking.openURL('https://www.valens.app/terms-conditions')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.legalButtonText}>{t('payment.legal.termsLink')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.legalButton}
                    onPress={() => Linking.openURL('https://www.valens.app/privacy-policy')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.legalButtonText}>{t('payment.legal.privacyLink')}</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.disclaimer}>{t('payment.legal.footerDisclaimer')}</Text>

                <TouchableOpacity
                  style={styles.logoutButton}
                  onPress={handleLogout}
                  activeOpacity={0.7}
                >
                  <Text style={styles.logoutButtonText}>{t('payment.logout')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </ScrollView>
      </LinearGradient>

      <StripePaymentMethodModal
        visible={showPaymentMethodModal}
        onClose={() => setShowPaymentMethodModal(false)}
        onConnectStripe={async () => {
          try {
            await openPaymentConnectionAndRefresh();
          } catch (e) {
            showToastMessage(toast, 'danger', e?.message || stripeErrorMessages.ONBOARDING_FAILED);
          }
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  
  // Header Styles
  header: {
    alignItems: 'center',
    marginBottom: 30,
    paddingTop: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  iconEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: 'white',
    marginBottom: 10,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },

  // Pricing Card Styles
  pricingCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    left: 20,
    right: 20,
    backgroundColor: '#FF6B6B',
    borderRadius: 15,
    paddingVertical: 6,
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  popularText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  currency: {
    fontSize: 28,
    fontWeight: '700',
    color: '#667eea',
  },
  price: {
    fontSize: 48,
    fontWeight: '800',
    color: '#667eea',
  },
  period: {
    fontSize: 18,
    color: '#666',
    marginLeft: 5,
    fontWeight: '500',
  },
  priceDescription: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 25,
    fontWeight: '500',
  },
  features: {
    alignItems: 'flex-start',
    width: '100%',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 2,
  },
  checkmarkContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  checkmark: {
    fontSize: 14,
    color: 'white',
    fontWeight: 'bold',
  },
  feature: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    fontWeight: '500',
  },

  // Info Section
  infoSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  infoIcon: {
    fontSize: 16,
    marginRight: 10,
    marginTop: 2,
  },
  infoText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '500',
    flex: 1,
  },
  infoText1: {
    fontSize: 13,
    color: 'white',
    fontWeight: '500',
    flex: 1,
    lineHeight: 18,
  },
  warningText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    flex: 1,
    lineHeight: 18,
  },

  // Button Container
  buttonContainer: {
    marginBottom: 0,
  },
  subscribeButton: {
    borderRadius: 25,
    marginBottom: 15,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  buttonGradient: {
    borderRadius: 25,
    paddingVertical: 18,
    paddingHorizontal: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  subscribeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  retryButton: {
    alignItems: 'center',
    paddingVertical: 15,
  },
  retryButtonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // Footer
  footer: {
    alignItems: 'center',
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    flexWrap: 'wrap',
  },
  legalButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginHorizontal: 10,
  },
  legalButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  disclaimer: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  logoutButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PaymentScreen;

