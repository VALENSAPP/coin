import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { buyCreditHits } from '../../services/stirpe';
import { showToastMessage } from '../displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { Linking } from 'react-native';
import { getPaymentSessionUrl, STRIPE_BROWSER_OPTIONS, STRIPE_ERROR_MESSAGES } from '../../utils/stripeOnboarding';
import { useStripeCustomer } from '../../hooks/useStripeCustomer';
import StripePaymentMethodModal from './StripePaymentMethodModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../../theme/useApptheme';
import { useRoute } from '@react-navigation/native';

const MAX_CREDITS = 5;

const CreditPurchaseModal = ({ visible, onClose, onPurchaseComplete, currentCredits = 0 }) => {
  const [creditsToBuy, setCreditsToBuy] = useState(1);
  const sheetRef = useRef(null);
  const dispatch = useDispatch();
  const toast = useToast();
  const route = useRoute();
  const { bgStyle, textStyle, text } = useAppTheme();
  const { requireStripeCustomerForPayment, openPaymentConnectionAndRefresh } = useStripeCustomer();
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);

  const safeCurrentCredits = useMemo(() => {
    const value = Number(currentCredits);
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(value, MAX_CREDITS));
  }, [currentCredits]);

  const maxPurchasable = useMemo(
    () => Math.max(0, MAX_CREDITS - safeCurrentCredits),
    [safeCurrentCredits]
  );

  useEffect(() => {
    if (visible) {
      sheetRef.current?.open();
      setCreditsToBuy(maxPurchasable > 0 ? 1 : 0); // Reset when modal opens
    } else {
      sheetRef.current?.close();
    }
  }, [visible, maxPurchasable]);

  const increaseCredits = () => {
    if (creditsToBuy < maxPurchasable) {
      setCreditsToBuy(prev => prev + 1);
    }
  };

  const decreaseCredits = () => {
    if (creditsToBuy > 1) {
      setCreditsToBuy(prev => prev - 1);
    }
  };

  const createStripeSubscription = async () => {
    if (maxPurchasable <= 0) {
      showToastMessage(toast, 'danger', 'You already have maximum credits.');
      return;
    }
    if (creditsToBuy < 1 || creditsToBuy > maxPurchasable) {
      showToastMessage(
        toast,
        'danger',
        `You can buy up to ${maxPurchasable} credit${maxPurchasable === 1 ? '' : 's'}.`
      );
      return;
    }
    const canProceed = await requireStripeCustomerForPayment();
    if (!canProceed) {
      setShowPaymentMethodModal(true);
      return;
    }
    dispatch(showLoader());
    try {
      const id = await AsyncStorage.getItem('userId');
      const pricePerCredit = 1.99;
      const amount = parseFloat((creditsToBuy * pricePerCredit).toFixed(2));
      const dataToSend = {
        amount: amount,
        hitCount: creditsToBuy,
        userId: id
      };
      const response = await buyCreditHits(dataToSend);
      const url = getPaymentSessionUrl(response);
      if (url) {
        await AsyncStorage.setItem('lastScreenBeforeBrowser', route.name);
        if (await InAppBrowser.isAvailable()) {
          await InAppBrowser.open(url, { ...STRIPE_BROWSER_OPTIONS, forceCloseOnRedirection: true });
          if (onPurchaseComplete) onPurchaseComplete();
        } else {
          await Linking.openURL(url);
        }
      } else {
        showToastMessage(toast, 'danger', response?.message || response?.data?.message || STRIPE_ERROR_MESSAGES.SESSION_FAILED);
      }
    } catch (error) {
      showToastMessage(toast, 'danger', error?.response?.data?.message || STRIPE_ERROR_MESSAGES.NETWORK_ERROR);
    } finally {
      dispatch(hideLoader());
    }
  };

  const handleConfirmPurchase = () => {
    if (maxPurchasable <= 0) {
      showToastMessage(toast, 'danger', 'You already have maximum credits.');
      sheetRef.current?.close();
      return;
    }
    if (creditsToBuy < 1 || creditsToBuy > maxPurchasable) {
      showToastMessage(
        toast,
        'danger',
        `You can buy up to ${maxPurchasable} credit${maxPurchasable === 1 ? '' : 's'}.`
      );
      return;
    }
    sheetRef.current?.close();
    setTimeout(() => {
      Alert.alert(
        'Confirm Purchase',
        `Purchase ${creditsToBuy} additional post credit${creditsToBuy > 1 ? 's' : ''}?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              if (onClose) onClose();
            }
          },
          {
            text: 'Purchase',
            onPress: () => {
              createStripeSubscription();
            }
          }
        ]
      );
    }, 300);
  };

  return (
    <>
    <RBSheet
      ref={sheetRef}
      height={340}
      draggable
      closeOnPressMask={true}
      onClose={onClose}
      customStyles={{
        container: [{
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingVertical: 20,
          paddingHorizontal: 25,
        }, bgStyle],
        draggableIcon: {
          backgroundColor: '#ccc',
          width: 60,
        },
      }}
    >
      <View style={styles.container}>
        <Text style={[styles.title, textStyle]}>Buy Mint Credits</Text>

        <View style={[styles.currentCreditsContainer, { shadowColor: text }]}>
          <Text style={styles.currentCreditsLabel}>Current Credits:</Text>
          <Text style={[styles.currentCreditsValue, textStyle]}>{safeCurrentCredits} / {MAX_CREDITS}</Text>
        </View>

        <Text style={styles.subtitle}>Select amount to purchase:</Text>

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
            <Text style={styles.creditsLabel}>credit{creditsToBuy > 1 ? 's' : ''}</Text>
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
          <Text style={styles.buyBtnText}>Continue to Payment</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => sheetRef.current?.close()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </RBSheet>

    <StripePaymentMethodModal
      visible={showPaymentMethodModal}
      onClose={() => setShowPaymentMethodModal(false)}
      onConnectStripe={async () => {
        try {
          await openPaymentConnectionAndRefresh();
        } catch (e) {
          showToastMessage(toast, 'danger', e?.message || STRIPE_ERROR_MESSAGES.ONBOARDING_FAILED);
        }
      }}
    />
    </>
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
