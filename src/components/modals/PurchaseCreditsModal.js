import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { buyCreditHits } from '../../services/stirpe';
import { showToastMessage } from '../displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import {
  getPaymentSessionUrl,
  STRIPE_BROWSER_OPTIONS,
  getStripeErrorMessages,
  createOnboardingLink,
  getOnboardingStatus,
} from '../../utils/stripeOnboarding';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../../theme/useApptheme';
import { useRoute } from '@react-navigation/native';
import { useLanguage } from '../../i18n';

const MAX_CREDITS = 5;

const CreditPurchaseModal = ({ visible, onClose, onPurchaseComplete, currentCredits = 0 }) => {
  const [creditsToBuy, setCreditsToBuy] = useState('');
  const sheetRef = useRef(null);
  const dispatch = useDispatch();
  const toast = useToast();
  const route = useRoute();
  const { bgStyle, textStyle, text } = useAppTheme();
  const { t } = useLanguage();
  const stripeErrorMessages = getStripeErrorMessages(t);

  const safeCurrentCredits = useMemo(() => {
    const value = Number(currentCredits);
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(value, MAX_CREDITS));
  }, [currentCredits]);

  const maxPurchasable = useMemo(
    () => Math.max(0, MAX_CREDITS - safeCurrentCredits),
    [safeCurrentCredits],
  );

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const isBrowserCancelled = (result) => result?.type === 'cancel' || result?.type === 'dismiss';
  const isOnboardingReady = (status) => status?.canReceivePayments === true && Boolean(status?.accountId);

  const GetInbordingstatus = async () => {
    try {
      const response = await getOnboardingStatus();
      if (response?.statusCode === 200) return response?.data ?? null;
      return null;
    } catch (_error) {
      return null;
    }
  };

  const GetInbordingLink = async () => {
    const response = await createOnboardingLink();
    const onboardingUrl = response?.data?.onboardingUrl ?? response?.data?.data?.onboardingUrl;

    if (!onboardingUrl) {
      const latestStatus = await GetInbordingstatus();
      if (isOnboardingReady(latestStatus)) return { alreadyOnboarded: true };
      throw new Error('Onboarding link not found');
    }

    if (await InAppBrowser.isAvailable()) {
      return await InAppBrowser.open(onboardingUrl, {
        ...STRIPE_BROWSER_OPTIONS,
        forceCloseOnRedirection: true,
      });
    }

    await Linking.openURL(onboardingUrl);
    return { type: 'opened_external' };
  };

  const waitForOnboardingCompletion = async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const status = await GetInbordingstatus();
      if (isOnboardingReady(status)) return status;
      await delay(2000);
    }
    return null;
  };

  useEffect(() => {
    if (visible) {
      sheetRef.current?.open();
      setCreditsToBuy(maxPurchasable > 0 ? 1 : 0);
    } else {
      sheetRef.current?.close();
    }
  }, [visible, maxPurchasable]);

  const increaseCredits = () => {
    if (creditsToBuy < maxPurchasable) setCreditsToBuy(prev => prev + 1);
  };

  const decreaseCredits = () => {
    if (creditsToBuy > 1) setCreditsToBuy(prev => prev - 1);
  };

  // Returns the translated "up to N credit(s)" error string
  const maxPurchasableErrorMsg = () =>
    maxPurchasable === 1
      ? t('creditPurchaseModal.maxPurchasableError_one', { count: maxPurchasable })
      : t('creditPurchaseModal.maxPurchasableError_other', { count: maxPurchasable });

  const runPaymentSession = async (dataToSend) => {
    const response = await buyCreditHits(dataToSend);
    const url = getPaymentSessionUrl(response);
    if (!url) {
      showToastMessage(
        toast,
        'danger',
        response?.message || response?.data?.message || stripeErrorMessages.SESSION_FAILED,
      );
      return false;
    }
    await AsyncStorage.setItem('lastScreenBeforeBrowser', route.name);
    if (await InAppBrowser.isAvailable()) {
      await InAppBrowser.open(url, { ...STRIPE_BROWSER_OPTIONS, forceCloseOnRedirection: true });
    } else {
      await Linking.openURL(url);
    }
    if (onPurchaseComplete) onPurchaseComplete();
    return true;
  };

  const createStripeSubscription = async () => {
    if (maxPurchasable <= 0) {
      showToastMessage(toast, 'danger', t('creditPurchaseModal.maxCreditsError'));
      return;
    }
    if (creditsToBuy < 1 || creditsToBuy > maxPurchasable) {
      showToastMessage(toast, 'danger', maxPurchasableErrorMsg());
      return;
    }

    dispatch(showLoader());
    try {
      const id = await AsyncStorage.getItem('userId');
      const pricePerCredit = 1.99;
      const amount = parseFloat((creditsToBuy * pricePerCredit).toFixed(2));
      const dataToSend = { amount, hitCount: creditsToBuy, userId: id };

      const onboardingStatus = await GetInbordingstatus();
      if (isOnboardingReady(onboardingStatus)) {
        await runPaymentSession(dataToSend);
        return;
      }

      const onboardingResult = await GetInbordingLink();
      if (onboardingResult?.alreadyOnboarded) {
        await runPaymentSession(dataToSend);
        return;
      }

      if (isBrowserCancelled(onboardingResult)) return;

      const updatedStatus = await waitForOnboardingCompletion();
      if (isOnboardingReady(updatedStatus)) {
        await runPaymentSession(dataToSend);
        return;
      }

      showToastMessage(toast, 'warning', t('creditPurchaseModal.onboardingIncomplete'));
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.data?.message || stripeErrorMessages.NETWORK_ERROR,
      );
    } finally {
      dispatch(hideLoader());
    }
  };

  const handleConfirmPurchase = () => {
    if (maxPurchasable <= 0) {
      showToastMessage(toast, 'danger', t('creditPurchaseModal.maxCreditsError'));
      sheetRef.current?.close();
      return;
    }
    if (creditsToBuy < 1 || creditsToBuy > maxPurchasable) {
      showToastMessage(toast, 'danger', maxPurchasableErrorMsg());
      return;
    }

    sheetRef.current?.close();
    setTimeout(() => {
      const confirmMsg =
        creditsToBuy > 1
          ? t('creditPurchaseModal.confirmPurchaseMessage_other', { count: creditsToBuy })
          : t('creditPurchaseModal.confirmPurchaseMessage_one', { count: creditsToBuy });

      Alert.alert(
        t('creditPurchaseModal.confirmPurchaseTitle'),
        confirmMsg,
        [
          {
            text: t('creditPurchaseModal.confirmCancel'),
            style: 'cancel',
            onPress: () => { if (onClose) onClose(); },
          },
          {
            text: t('creditPurchaseModal.confirmPurchase'),
            onPress: () => createStripeSubscription(),
          },
        ],
      );
    }, 300);
  };

  return (
    <RBSheet
      ref={sheetRef}
      height={360}
      draggable
      closeOnPressMask={true}
      onClose={onClose}
      customStyles={{
        container: [
          {
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingVertical: 20,
            paddingHorizontal: 25,
          },
          bgStyle,
        ],
        draggableIcon: {
          backgroundColor: '#ccc',
          width: 60,
        },
      }}
    >
      <View style={styles.container}>
        <Text style={[styles.title, textStyle]}>
          {t('creditPurchaseModal.title')}
        </Text>

        <View style={[styles.currentCreditsContainer, { shadowColor: text }]}>
          <Text style={styles.currentCreditsLabel}>
            {t('creditPurchaseModal.currentCreditsLabel')}
          </Text>
          <Text style={[styles.currentCreditsValue, textStyle]}>
            {safeCurrentCredits} / {MAX_CREDITS}
          </Text>
        </View>

        <Text style={styles.subtitle}>
          {t('creditPurchaseModal.selectAmountLabel')}
        </Text>

        <View style={styles.selectorContainer}>
          <TouchableOpacity
            style={[
              styles.adjustBtn,
              { backgroundColor: text, shadowColor: text },
              (creditsToBuy <= 1 || maxPurchasable <= 0) && styles.adjustBtnDisabled,
            ]}
            onPress={decreaseCredits}
            disabled={creditsToBuy <= 1 || maxPurchasable <= 0}
          >
            <Text style={styles.adjustText}>−</Text>
          </TouchableOpacity>

          <View style={styles.amountContainer}>
            <Text style={[styles.amountText, textStyle]}>{creditsToBuy}</Text>
            <Text style={styles.creditsLabel}>
              {creditsToBuy > 1
                ? t('creditPurchaseModal.creditPlural')
                : t('creditPurchaseModal.creditSingular')}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.adjustBtn,
              { backgroundColor: text, shadowColor: text },
              (maxPurchasable <= 0 || creditsToBuy >= maxPurchasable) && styles.adjustBtnDisabled,
            ]}
            onPress={increaseCredits}
            disabled={maxPurchasable <= 0 || creditsToBuy >= maxPurchasable}
          >
            <Text style={styles.adjustText}>+</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.buyBtn,
            { backgroundColor: text, shadowColor: text },
            (maxPurchasable <= 0 || creditsToBuy < 1) && { opacity: 0.6 },
          ]}
          onPress={handleConfirmPurchase}
          disabled={maxPurchasable <= 0 || creditsToBuy < 1}
        >
          <Text style={styles.buyBtnText}>
            {t('creditPurchaseModal.continueToPayment')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => sheetRef.current?.close()}>
          <Text style={styles.cancelText}>
            {t('creditPurchaseModal.cancelButton')}
          </Text>
        </TouchableOpacity>
      </View>
    </RBSheet>
  );
};

export default CreditPurchaseModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 15,
  },
  currentCreditsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  currentCreditsLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  currentCreditsValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  selectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  adjustBtn: {
    borderRadius: 50,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  adjustBtnDisabled: {
    backgroundColor: '#ddd',
    shadowOpacity: 0,
    elevation: 0,
  },
  adjustText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  amountContainer: {
    alignItems: 'center',
    marginHorizontal: 40,
  },
  amountText: {
    fontSize: 32,
    fontWeight: '700',
  },
  creditsLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  buyBtn: {
    paddingVertical: 12,
    paddingHorizontal: 50,
    borderRadius: 10,
    marginBottom: 10,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buyBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  cancelText: {
    color: '#666',
    marginTop: 5,
    fontSize: 14,
  },
});
