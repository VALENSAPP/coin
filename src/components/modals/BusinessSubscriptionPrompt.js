import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../displaytoastmessage';
import { createCheckoutSession } from '../../services/stirpe';
import { useAppTheme } from '../../theme/useApptheme';
import { createOnboardingLink, getOnboardingStatus } from '../../services/profile';

const BusinessSubscriptionPrompt = ({
  visible,
  onActivate,
  onLater,
  title = 'Your Business Mission Starts Here',
}) => {
  const [step, setStep] = useState('initial');
  const [isActivating, setIsActivating] = useState(false);
  const toast = useToast();
  const { text } = useAppTheme();

  useEffect(() => {
    if (visible) {
      setStep('initial');
    }
  }, [visible]);

  const handleClose = () => {
    setStep('initial');
    onLater?.();
  };

  const isBrowserCancelled = result => result?.type === 'cancel' || result?.type === 'dismiss';

  const openUrl = async url => {
    if (await InAppBrowser.isAvailable()) {
      return InAppBrowser.open(url, {
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
    }

    await Linking.openURL(url);
    return { type: 'opened_external' };
  };

  const runSubscriptionCheckout = async () => {
    const response = await createCheckoutSession();
    const checkoutUrl = response?.data?.url;

    if (response?.statusCode !== 200 || !checkoutUrl) {
      showToastMessage(
        toast,
        'danger',
        response?.error || response?.message || 'Failed to create checkout session.',
      );
      return { cancelled: true };
    }

    const result = await openUrl(checkoutUrl);
    return { cancelled: isBrowserCancelled(result) };
  };

  const handleActivateBusinessTools = async () => {
    try {
      setIsActivating(true);

      const onboardingStatusResponse = await getOnboardingStatus();
      const onboardingStatus = onboardingStatusResponse?.data;
      const canReceivePayments =
        onboardingStatusResponse?.statusCode === 200 &&
        onboardingStatus?.canReceivePayments === true &&
        Boolean(onboardingStatus?.accountId);

      if (canReceivePayments) {
        const result = await runSubscriptionCheckout();
        if (!result.cancelled) {
          setStep('success');
          onActivate?.();
        }
        return;
      }

      const onboardingResponse = await createOnboardingLink();
      const onboardingUrl =
        onboardingResponse?.data?.onboardingUrl ?? onboardingResponse?.data?.data?.onboardingUrl;

      if (!onboardingUrl) {
        throw new Error('Unable to create Stripe onboarding link.');
      }

      const onboardingResult = await openUrl(onboardingUrl);
      if (isBrowserCancelled(onboardingResult)) {
        return;
      }

      for (let attempt = 0; attempt < 10; attempt += 1) {
        const updatedStatusResponse = await getOnboardingStatus();
        const updated = updatedStatusResponse?.data;
        const isReady =
          updatedStatusResponse?.statusCode === 200 &&
          updated?.canReceivePayments === true &&
          Boolean(updated?.accountId);

        if (isReady) {
          const result = await runSubscriptionCheckout();
          if (!result.cancelled) {
            setStep('success');
            onActivate?.();
          }
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

  const handleContinueBasic = () => {
    if (step === 'initial') {
      setStep('reminder');
      return;
    }

    showToastMessage(
      toast,
      'normal',
      'Your business profile is active in Basic Mode. You can upgrade anytime to unlock all business features.',
    );
    handleClose();
  };

  const handleSuccessClose = () => {
    Alert.alert('Business Plan Activated', 'Congratulations - Your Business Plan is Active');
    handleClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {step !== 'success' && (
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Icon name="close" size={24} color={text} />
            </TouchableOpacity>
          )}

          {step === 'initial' ? (
            <>
              <Text style={[styles.title, { color: text }]}>{title}</Text>
              <Text style={styles.bodyText}>
                Valens was built for businesses that want more than followers.
              </Text>
              <Text style={styles.bodyText}>
                Activate your Business Plan to unlock mission posts, subscriber channels, brand analytics,
                and tools designed to turn attention into real engagement.
              </Text>
              <Text style={styles.planPrice}>Business Plan: $9.90/month</Text>
              <Text style={styles.planNote}>
                This plan is billed monthly through Stripe and renews until cancelled.
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: text }]}
                  onPress={handleActivateBusinessTools}
                  disabled={isActivating}
                >
                  {isActivating ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Activate Business Tools</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleContinueBasic}>
                  <Text style={styles.secondaryButtonText}>Continue with Basic Profile</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {step === 'reminder' ? (
            <>
              <Text style={[styles.title, { color: text }]}>Reminder</Text>
              <Text style={styles.bodyText}>
                You can continue with a basic business profile, but some features will remain locked
                until you activate the Business Plan.
              </Text>

              <Text style={styles.sectionTitle}>Without the Business Plan you will not have access to:</Text>
              <Text style={styles.listItem}>* Verification badge (Dragonfly)</Text>
              <Text style={styles.listItem}>* Mission Posts to engage your audience</Text>
              <Text style={styles.listItem}>* Private subscription content for followers</Text>
              <Text style={styles.listItem}>* Marketplace visibility</Text>
              <Text style={styles.listItem}>* Battle participation</Text>
              <Text style={styles.listItem}>* Advanced business analytics</Text>

              <Text style={styles.bodyText}>
                Activate the Business Plan to unlock the full Valens experience.
              </Text>
              <Text style={styles.planPrice}>Business Plan - $9.90/month</Text>

              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: text, marginBottom: 10 }]}
                onPress={handleActivateBusinessTools}
                disabled={isActivating}
              >
                {isActivating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Unlock Business Features</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleContinueBasic}>
                <Text style={styles.secondaryButtonText}>Continue with Limited Profile</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {step === 'success' ? (
            <>
              <Text style={[styles.title, { color: text }]}>Congratulations</Text>
              <Text style={styles.bodyText}>Your Business Plan is Active.</Text>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: text, marginTop: 8 }]}
                onPress={handleSuccessClose}
              >
                <Text style={styles.primaryButtonText}>Continue</Text>
              </TouchableOpacity>
            </>
          ) : null}
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
    marginBottom: 8,
    textAlign: 'center',
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
  planPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  planNote: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 14,
  },
  listItem: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
    marginBottom: 4,
  },
  actions: {
    marginTop: 6,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
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
    fontSize: 14,
    fontWeight: '600',
  },
});
