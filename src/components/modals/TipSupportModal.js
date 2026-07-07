import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
  Linking,
  DeviceEventEmitter,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { sendTip } from '../../services/stirpe';
import { showToastMessage } from '../displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import {
  getPaymentSessionUrl,
  STRIPE_BROWSER_OPTIONS,
  getStripeErrorMessages,
} from '../../utils/stripeOnboarding';
import { useStripeCustomer } from '../../hooks/useStripeCustomer';
import StripePaymentMethodModal from './StripePaymentMethodModal';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';

const AMOUNTS = [5, 10, 25, 50];
const MIN_TIP_AMOUNT = 0.5;

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

export default function TipSupportModal({
  visible,
  onClose,
  creatorName = 'Creator',
  vendorId,
  onTipSuccess,
}) {
  const toast = useToast();
  const dispatch = useDispatch();
  const { t } = useLanguage();
  const { text, card, cardStyle } = useAppTheme();
  const stripeErrorMessages = getStripeErrorMessages(t);
  const {
    requireStripeCustomerForPayment,
    openPaymentConnectionAndRefresh,
  } = useStripeCustomer();

  const [selectedAmount, setSelectedAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [isButtonLoading, setIsButtonLoading] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const paymentCompletedRef = useRef(false);

  const finalAmount = Number(selectedAmount || customAmount);
  const isAmountValid = finalAmount >= MIN_TIP_AMOUNT;

  const resetForm = () => {
    setCustomAmount('');
    setSelectedAmount(null);
    setIsButtonLoading(false);
    paymentCompletedRef.current = false;
  };

  useEffect(() => {
    if (!visible) {
      resetForm();
      return undefined;
    }

    const subscription = DeviceEventEmitter.addListener('PAYMENT_COMPLETED', () => {
      paymentCompletedRef.current = true;
      setIsButtonLoading(false);
      dispatch(hideLoader());
      onTipSuccess?.();
      setCustomAmount('');
      setSelectedAmount(null);
      onClose?.();
      showToastMessage(toast, 'success', t('tipSupportScreen.tipSuccess'));
    });

    return () => subscription.remove();
  }, [visible, onClose, onTipSuccess, dispatch, toast, t]);

  const openCheckoutSession = useCallback(async (url) => {
    try {
      paymentCompletedRef.current = false;
      if (await InAppBrowser.isAvailable()) {
        await InAppBrowser.open(url, { ...STRIPE_BROWSER_OPTIONS, forceCloseOnRedirection: true });
        if (!paymentCompletedRef.current) {
          // showToastMessage(toast, 'danger', stripeErrorMessages.PAYMENT_CANCELLED);
        }
      } else {
        await Linking.openURL(url);
      }
    } catch (err) {
      // showToastMessage(toast, 'danger', err?.message || stripeErrorMessages.SESSION_FAILED);
    } finally {
      setIsButtonLoading(false);
      dispatch(hideLoader());
    }
  }, [dispatch, stripeErrorMessages, toast]);

  const handleConfirm = async () => {
    if (!vendorId) {
      showToastMessage(toast, 'danger', t('tipSupportScreen.missingCreator'));
      return;
    }

    if (!isAmountValid) {
      showToastMessage(toast, 'danger', t('tipSupportScreen.minAmountError'));
      return;
    }

    const canProceed = await requireStripeCustomerForPayment();
    if (!canProceed) {
      setShowPaymentMethodModal(true);
      return;
    }

    setIsButtonLoading(true);
    dispatch(showLoader());

    try {
      const response = await sendTip({
        amount: Number(finalAmount),
        receiverUserId: String(vendorId),
      });
      console.log('sendTip response:', response);
      const url = getPaymentSessionUrl(response);

      if (!url) {
        // showToastMessage(
        //   toast,
        //   'danger',
        //   response?.message || response?.data?.message || stripeErrorMessages.SESSION_FAILED,
        // );
        setIsButtonLoading(false);
        dispatch(hideLoader());
        return;
      }

      await openCheckoutSession(url);
    } catch (error) {
      // showToastMessage(
      //   toast,
      //   'danger',
      //   error?.response?.data?.message || error?.message || stripeErrorMessages.NETWORK_ERROR,
      // );
      setIsButtonLoading(false);
      dispatch(hideLoader());
    }
  };

  const isSelected = (amt) => selectedAmount === amt;
  const isCustomSelected = Boolean(customAmount);

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <View style={styles.overlay}>
            <View style={[styles.sheet, cardStyle]}>
              <View style={styles.headerRow}>
                <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.headerIconBtn}>
                  <Ionicons name="arrow-back" size={22} color="#1F2937" />
                </TouchableOpacity>
                <View style={styles.headerTitleWrap}>
                  <Text style={styles.title}>{t('tipSupportScreen.title')}</Text>
                  <View style={styles.subtitleRow}>
                    <Text style={styles.subtitle}>
                      {t('tipSupportScreen.subtitle', { creatorName })}
                    </Text>
                    <Ionicons name="heart" size={14} color={text} style={styles.subtitleHeart} />
                  </View>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.headerIconBtn}>
                  <Ionicons name="close" size={24} color="#1F2937" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.amountLabel}>{t('tipSupportScreen.amountLabel')}</Text>

                <View style={styles.amountGrid}>
                  {AMOUNTS.map((amt) => (
                    <TouchableOpacity
                      key={amt}
                      style={[
                        styles.amountBox,
                        { borderColor: '#D1D5DB', backgroundColor: card },
                        isSelected(amt) && {
                          borderColor: text,
                          backgroundColor: withAlpha(text, 0.12),
                        },
                      ]}
                      onPress={() => {
                        setSelectedAmount(amt);
                        setCustomAmount('');
                      }}
                    >
                      <Text style={styles.amountText}>${amt}</Text>
                    </TouchableOpacity>
                  ))}

                  <View
                    style={[
                      styles.customBox,
                      { borderColor: '#D1D5DB', backgroundColor: card },
                      isCustomSelected && {
                        borderColor: text,
                        backgroundColor: withAlpha(text, 0.12),
                      },
                    ]}
                  >
                    <TextInput
                      keyboardType="decimal-pad"
                      style={styles.customInput}
                      value={customAmount}
                      onChangeText={(val) => {
                        setCustomAmount(val);
                        setSelectedAmount(null);
                      }}
                      placeholder={t('tipSupportScreen.customAmountPlaceholder')}
                      placeholderTextColor="#9CA3AF"
                    />
                    <Ionicons name="pencil" size={16} color="#6B7280" />
                  </View>
                </View>

                <View style={[styles.infoBox, { backgroundColor: withAlpha(text, 0.12) }]}>
                  <Ionicons name="information-circle" size={20} color={text} />
                  <Text style={styles.infoText}>{t('tipSupportScreen.disclaimer')}</Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.continueBtn,
                    { backgroundColor: text },
                    (isButtonLoading || !isAmountValid) && styles.continueBtnDisabled,
                  ]}
                  onPress={handleConfirm}
                  disabled={isButtonLoading || !isAmountValid}
                  activeOpacity={0.9}
                >
                  {isButtonLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
                      <Text style={styles.continueText}>{t('tipSupportScreen.continueButton')}</Text>
                      <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.maybeLaterBtn} onPress={onClose}>
                  <Text style={styles.maybeLaterText}>{t('tipSupportScreen.maybeLater')}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <StripePaymentMethodModal
        visible={showPaymentMethodModal}
        onClose={() => setShowPaymentMethodModal(false)}
        onConnectStripe={async () => {
          try {
            await openPaymentConnectionAndRefresh();
          } catch (e) {
            // showToastMessage(toast, 'danger', e?.message || stripeErrorMessages.ONBOARDING_FAILED);
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 8, 20, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerIconBtn: {
    width: 32,
    paddingTop: 2,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  subtitleHeart: {
    marginLeft: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  amountLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  amountBox: {
    width: '48%',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  customBox: {
    width: '48%',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  customInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 0,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#4B5563',
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 14,
  },
  continueBtnDisabled: {
    opacity: 0.65,
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  maybeLaterBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  maybeLaterText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '600',
  },
});
