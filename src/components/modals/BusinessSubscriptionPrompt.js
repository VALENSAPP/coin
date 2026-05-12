import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../displaytoastmessage';
import { createCheckoutSession } from '../../services/stirpe';
import { useAppTheme } from '../../theme/useApptheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createOnboardingLink, getOnboardingStatus } from '../../services/profile';


const BusinessSubscriptionPrompt = ({
  visible,
  subscriptionStatus,
  // onActivate,
  onLater,
  title = 'Unlock Business Features',
}) => {
  const [step, setStep] = useState(1);
  const [isActivating, setIsActivating] = useState(false);
  const [resolvedSubscriptionStatus, setResolvedSubscriptionStatus] = useState('');
  const toast = useToast();
  const { text } = useAppTheme();

  useEffect(() => {
    if (visible) {
      setStep(1);
    }
  }, [visible]);

  useEffect(() => {
    let isMounted = true;

    const resolveStatus = async () => {
      if (subscriptionStatus !== undefined && subscriptionStatus !== null) {
        if (isMounted) {
          setResolvedSubscriptionStatus(String(subscriptionStatus).toUpperCase());
        }
        return;
      }

      try {
        const storedStatus = await AsyncStorage.getItem('subscriptionStatus');
        if (isMounted) {
          setResolvedSubscriptionStatus(String(storedStatus || '').toUpperCase());
        }
      } catch (error) {
        if (isMounted) {
          setResolvedSubscriptionStatus('');
        }
      }
    };

    if (visible) {
      resolveStatus();
    }

    return () => {
      isMounted = false;
    };
  }, [visible, subscriptionStatus]);

  const shouldShowModal = visible;

  const handleClose = () => {
    setStep(1);
    onLater?.();
  };

  const handleActivateNow = async () => {
    try {
      setIsActivating(true);

      const runSubscriptionCheckout = async () => {
        const response = await createCheckoutSession();

        if (response?.statusCode === 200 && response?.data?.url) {
          if (await InAppBrowser.isAvailable()) {
            await InAppBrowser.open(response.data.url, {
              dismissButtonStyle: 'close',
              preferredBarTintColor: '#ffffff',
              preferredControlTintColor: '#000000',
              readerMode: false,
              animated: true,
              modalPresentationStyle: 'fullScreen',
              modalTransitionStyle: 'coverVertical',
              enableBarCollapsing: false,
              showTitle: true,
              toolbarColor: '#ffffff',
              secondaryToolbarColor: '#f0f0f0',
              forceCloseOnRedirection: true,
            });
            handleClose();
          } else {
            await Linking.openURL(response.data.url);
          }
          return;
        }

        showToastMessage(
          toast,
          'danger',
          response?.error || response?.message || 'Failed to create checkout session.',
        );
      };

      const onboardingStatusResponse = await getOnboardingStatus();
      const onboardingStatus = onboardingStatusResponse?.data;
      const canReceivePayments =
        onboardingStatusResponse?.statusCode === 200 &&
        onboardingStatus?.canReceivePayments === true &&
        Boolean(onboardingStatus?.accountId);

      if (canReceivePayments) {
        await runSubscriptionCheckout();
        return;
      }

      const onboardingResponse = await createOnboardingLink();
      const onboardingUrl =
        onboardingResponse?.data?.onboardingUrl ?? onboardingResponse?.data?.data?.onboardingUrl;

      if (!onboardingUrl) {
        throw new Error('Unable to create Stripe onboarding link.');
      }

      if (await InAppBrowser.isAvailable()) {
        await InAppBrowser.open(onboardingUrl, {
          dismissButtonStyle: 'close',
          preferredBarTintColor: '#ffffff',
          preferredControlTintColor: '#000000',
          readerMode: false,
          animated: true,
          modalPresentationStyle: 'fullScreen',
          modalTransitionStyle: 'coverVertical',
          enableBarCollapsing: false,
          showTitle: true,
          toolbarColor: '#ffffff',
          secondaryToolbarColor: '#f0f0f0',
          forceCloseOnRedirection: true,
        });
      } else {
        await Linking.openURL(onboardingUrl);
      }

      for (let attempt = 0; attempt < 10; attempt += 1) {
        const updatedStatusResponse = await getOnboardingStatus();
        const updated = updatedStatusResponse?.data;
        const isReady =
          updatedStatusResponse?.statusCode === 200 &&
          updated?.canReceivePayments === true &&
          Boolean(updated?.accountId);

        if (isReady) {
          await runSubscriptionCheckout();
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      showToastMessage(toast, 'warning', 'Stripe onboarding is not complete yet.');
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.data?.message || error?.message || 'Unable to start subscription. Please try again.',
      );
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <Modal
      visible={shouldShowModal}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>

          {step === 1 ? (
            <>
              {/* <Text style={styles.icon}>✨</Text> */}
              <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                <Icon name="close" size={28} color={text} />
              </TouchableOpacity>
              <Text style={[styles.title, { color: text }]}>Subscribe Valens</Text>
              <Text style={styles.bodyText}>
                To continue with business tools, you need to subscribe to Valens.
              </Text>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    styles.primaryButtonSingle,
                    { backgroundColor: text },
                  ]}
                  onPress={() => setStep(2)}
                >
                  <Text style={styles.primaryButtonText}>Subscribe Valens</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.icon}>🔓</Text>
              <Text style={[styles.title, { color: text }]}>{title}</Text>

              <Text style={styles.bodyText}>
                To access Mission Posts and Marketing Placements, you'll need an active Business Subscription.
              </Text>

              <Text style={styles.sectionTitle}>With a Business Subscription, you can:</Text>
              <Text style={styles.listItem}>✔ Launch Mission Posts (goal-based campaigns)</Text>
              <Text style={styles.listItem}>✔ Promote your brand with marketing placements</Text>
              <Text style={styles.listItem}>✔ Collaborate with creators</Text>
              <Text style={styles.listItem}>✔ Access advanced analytics and campaign tools</Text>

              <Text style={styles.bodyText}>
                Your subscription grants access to platform tools and services within Valens.
              </Text>

              <Text style={styles.ctaText}>Activate your Business Subscription to continue.</Text>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleClose}>
                  <Text style={styles.secondaryButtonText}>Maybe Later</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: text }]}
                  onPress={handleActivateNow}
                  disabled={isActivating}
                >
                  {isActivating ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Activate Now</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default BusinessSubscriptionPrompt;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingBottom: 22,
    paddingTop: 10,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  icon: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  bodyText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 10,
    paddingVertical: 10,
    textAlign: 'center'
  },
  closeButton: {
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  listItem: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
    marginBottom: 4,
  },
  ctaText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 14,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButtonSingle: {
    width: '100%',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },
});
