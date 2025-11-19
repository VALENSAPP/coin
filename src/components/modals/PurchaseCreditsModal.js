import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { buyCreditHits, createCheckoutSession } from '../../services/stirpe';
import { showToastMessage } from '../displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../../theme/useApptheme';

const CreditPurchaseModal = ({ visible, onClose, onPurchaseComplete, currentCredits = 0 }) => {
  const [creditsToBuy, setCreditsToBuy] = useState(1);
  const sheetRef = useRef(null);
  const dispatch = useDispatch();
  const toast = useToast();
  const { bgStyle, textStyle, text } = useAppTheme();

  useEffect(() => {
    if (visible) {
      sheetRef.current?.open();
      setCreditsToBuy(1); // Reset to 1 when modal opens
    } else {
      sheetRef.current?.close();
    }
  }, [visible]);

  const increaseCredits = () => {
    if (creditsToBuy < 5) {
      setCreditsToBuy(prev => prev + 1);
    }
  };

  const decreaseCredits = () => {
    if (creditsToBuy > 1) {
      setCreditsToBuy(prev => prev - 1);
    }
  };

  const createStripeSubscription = async () => {
    console.log('Creating Stripe checkout session for', creditsToBuy, 'credits');
    dispatch(showLoader());
    try {
      const id = await AsyncStorage.getItem('userId');
      const pricePerCredit = 1.99;
      const dataToSend = {
        amount: creditsToBuy * pricePerCredit,
        hitCount: creditsToBuy,
        userId: id
      };
      const response = await buyCreditHits(dataToSend);
      console.log('Response from buyCreditHits:', response);
      if (response?.statusCode === 200 && response?.data?.url) {
        const url = response.data.url;

        if (await InAppBrowser.isAvailable()) {
          await InAppBrowser.open(url, {
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
          });

          // Call the callback after successful payment flow
          if (onPurchaseComplete) {
            onPurchaseComplete();
          }
        } else {
          await Linking.openURL(url);
        }
      } else {
        showToastMessage(
          toast,
          'danger',
          response?.error ||
          response?.message ||
          'Failed to create payment session. Please try again.'
        );
      }
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        'Network error. Please check your internet connection and try again.'
      );
    } finally {
      dispatch(hideLoader());
    }
  };

  const handleConfirmPurchase = () => {
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

        <View style={[styles.currentCreditsContainer, {shadowColor: text}]}>
          <Text style={styles.currentCreditsLabel}>Current Credits:</Text>
          <Text style={[styles.currentCreditsValue, textStyle]}>{currentCredits} / 5</Text>
        </View>

        <Text style={styles.subtitle}>Select amount to purchase:</Text>

        <View style={styles.selectorContainer}>
          <TouchableOpacity
            style={[styles.adjustBtn, creditsToBuy === 1 && styles.adjustBtnDisabled, {backgroundColor: text, shadowColor: text}]}
            onPress={decreaseCredits}
            disabled={creditsToBuy === 1}
          >
            <Text style={styles.adjustText}>−</Text>
          </TouchableOpacity>

          <View style={styles.amountContainer}>
            <Text style={[styles.amountText, textStyle]}>{creditsToBuy}</Text>
            <Text style={styles.creditsLabel}>credit{creditsToBuy > 1 ? 's' : ''}</Text>
          </View>

          <TouchableOpacity
            style={[styles.adjustBtn, creditsToBuy === 5 && styles.adjustBtnDisabled]}
            onPress={increaseCredits}
            disabled={creditsToBuy === 5}
          >
            <Text style={styles.adjustText}>+</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.buyBtn, { backgroundColor: text, shadowColor: text}]}
          onPress={handleConfirmPurchase}
        >
          <Text style={styles.buyBtnText}>Continue to Payment</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => sheetRef.current?.close()}>
          <Text style={styles.cancelText}>Cancel</Text>
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