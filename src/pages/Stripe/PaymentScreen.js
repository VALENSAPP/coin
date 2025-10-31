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

const PaymentScreen = ({ onPaymentSuccess, onRetryCheck }) => {
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const toast = useToast();

  useEffect(() => {
    const handleDeepLink = (event) => {
      console.log(event,'checkEvent Exist')
      if (event?.url) {
        handlePaymentResult(event.url);
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url) handlePaymentResult(url);
    });

    // Disable hardware back on this screen (keep as you had it)
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

  // Tiny, robust parser that works for custom schemes
  const parseDeepLink = (url) => {
    try {
      const [, afterScheme = ''] = url.split('://'); // "payment-success?x=1"
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
      // If you include ?session_id={CHECKOUT_SESSION_ID} in success_url, you can verify here
      await verifyPaymentStatus(true /*, params.session_id */);
    } else if (host === 'payment-cancel') {
      Alert.alert(
        'Payment Cancelled',
        'Your payment was cancelled. You need an active subscription to use the app.',
        [{ text: 'Try Again', onPress: () => {} }],
      );
    } else if (host === 'payment-failure') {
      Alert.alert(
        'Payment Error',
        'There was an error processing your payment. Please try again.',
        [{ text: 'Try Again', onPress: () => {} }],
      );
    }
  };

  const verifyPaymentStatus = async (success /*, sessionId */) => {
    // Optionally call your backend with sessionId to verify before unlocking
    if (success) {
      Alert.alert(
        'Payment Successful!',
        'Your subscription is now active. Welcome to premium features!',
        [{ text: 'Continue', onPress: () => onPaymentSuccess?.() }],
      );
    } else {
      Alert.alert(
        'Payment Failed!',
        'Your subscription is not Active. Please purchase a subscription',
        [{ text: 'Continue', onPress: () => onPaymentSuccess?.() }],
      );
    }
  };

  const createStripeSubscription = async () => {
    setLoading(true);
    try {
      const token = await getUserToken();

      if (!token) {
        showToastMessage(toast, 'danger', 'Authentication token not found. Please login again.');
        return;
      }

      // Your service should create a Checkout Session and return { success, statusCode, data: { url } }
      const response = await createCheckoutSession();

      if (response?.success && response?.data?.url && response?.statusCode === 200) {
        await openPaymentBrowser(response.data.url);
        
      } else {
        showToastMessage(
          toast,
          'danger',
          response?.error || response?.message || 'Failed to create payment session. Please try again.',
        );
      }
    } catch (error) {
      showToastMessage(toast, 'danger', 'Network error. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const openPaymentBrowser = async (url) => {
    try {
      if (await InAppBrowser.isAvailable()) {
        /**
         * Use openAuth so the browser auto-closes when Stripe redirects to your custom scheme.
         * IMPORTANT: Configure your backend Checkout URLs as HTTPS pages that immediately
         * window.location.replace('com.valens://payment-success?session_id=...') etc.
         */
        const authResult = await InAppBrowser.openAuth(url, 'com.valens://', {
          showTitle: true,
          enableUrlBarHiding: true,
          enableDefaultShare: false,
        });
        await handleRetryCheck()
      } else {
        await Linking.openURL(url);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open payment page. Please check your internet connection and try again.');
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
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
            ]);
            await AsyncStorage.setItem('isLoggedIn', 'false');
            dispatch(loggedOut());
          } catch (error) {
          }
        },
      },
    ]);
  };

  const handleRetryCheck = async () => {
    if (onRetryCheck) {
      setLoading(true);
      try {
        const result = await onRetryCheck();
        
        // Check the result from subscription verification
        if (result && result.success) {
          // Subscription is active - user will be automatically navigated away
          // No need to show additional message as RootNavigator handles it
        } else {
          // Subscription is not active - show appropriate message
          if (result && result.message) {
            if (result.message.includes('No active subscription') || result.message.includes('No subscription found')) {
              showToastMessage(toast, 'info', 'Please subscribe to access Valens-app.');
            } else {
              showToastMessage(toast, 'warning', result.message);
            }
          }
        }
      } catch (error) {
        showToastMessage(toast, 'danger', 'Failed to verify subscription status. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const { width } = Dimensions.get('window');

  return (
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
              <Text style={styles.title}>Premium Access Required</Text>
              <Text style={styles.subtitle}>
              Subscribe to unlock all features and continue using the Valens App</Text>
            </View>

            {/* Pricing Card */}
            <View style={styles.pricingCard}>
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>MOST POPULAR</Text>
              </View>
              
              <View style={styles.priceContainer}>
                <Text style={styles.currency}>$</Text>
                <Text style={styles.price}>2</Text>
                <Text style={styles.period}>/month</Text>
              </View>
              
              <Text style={styles.priceDescription}>Billed monthly • Cancel anytime</Text>

              <View style={styles.features}>
                <View style={styles.featureRow}>
                  <View style={styles.checkmarkContainer}>
                    <Text style={styles.checkmark}>✓</Text>
                  </View>
                  <Text style={styles.feature}>Unlimited app access</Text>
                </View>
                <View style={styles.featureRow}>
                  <View style={styles.checkmarkContainer}>
                    <Text style={styles.checkmark}>✓</Text>
                  </View>
                  <Text style={styles.feature}>Premium creator features</Text>
                </View>
                <View style={styles.featureRow}>
                  <View style={styles.checkmarkContainer}>
                    <Text style={styles.checkmark}>✓</Text>
                  </View>
                  <Text style={styles.feature}>Built-in secure wallet</Text>
                </View>
                <View style={styles.featureRow}>
                  <View style={styles.checkmarkContainer}>
                    <Text style={styles.checkmark}>✓</Text>
                  </View>
                  <Text style={styles.feature}>5 free coin credits monthly</Text>
                </View>
                <View style={styles.featureRow}>
                  <View style={styles.checkmarkContainer}>
                    <Text style={styles.checkmark}>✓</Text>
                  </View>
                  <Text style={styles.feature}>Dashboard & market insights</Text>
                </View>
                <View style={styles.featureRow}>
                  <View style={styles.checkmarkContainer}>
                    <Text style={styles.checkmark}>✓</Text>
                  </View>
                  <Text style={styles.feature}>Priority support & early access</Text>
                </View>
                <View style={styles.featureRow}>
                  <View style={styles.checkmarkContainer}>
                    <Text style={styles.checkmark}>✓</Text>
                  </View>
                  <Text style={styles.feature}>Cancel anytime</Text>
                </View>
              </View>
            </View>

            {/* Security Info */}
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>🔒</Text>
                <Text style={styles.infoText}>Secure payment powered by Stripe</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>💡</Text>
                <Text style={styles.infoText1}>Cancel anytime from your account settings</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>📋</Text>
                <Text style={styles.infoText}>Read Terms & Privacy Policy before canceling</Text>
              </View>
              <View style={styles.warningRow}>
                <Text style={styles.infoIcon}>⚠️</Text>
                <Text style={styles.warningText}>Profile coins are digital collectibles designed for community engagement. They are not securities or financial products.</Text>
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
                    <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
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
                    <Text style={[styles.retryButtonText, { marginLeft: 10 }]}>Checking Status...</Text>
                  </View>
                ) : (
                  <Text style={styles.retryButtonText}>Already subscribed? Verify Status</Text>
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
                  <Text style={styles.legalButtonText}>Terms & Conditions</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.legalButton} 
                  onPress={() => Linking.openURL('https://www.valens.app/privacy-policy')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.legalButtonText}>Privacy Policy</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.disclaimer}>
                Profile coins are digital collectibles for community engagement. They are not securities or financial products.
              </Text>

              <TouchableOpacity 
                style={styles.logoutButton} 
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <Text style={styles.logoutButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </ScrollView>
    </LinearGradient>
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


