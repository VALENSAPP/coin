import { View, Text, StyleSheet, TouchableOpacity, TextInput, Dimensions, Keyboard, Linking, AppState, DeviceEventEmitter } from 'react-native';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Icon from 'react-native-vector-icons/Ionicons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { useDispatch } from 'react-redux';
import { getTokenPrice, getUserTokenInfoByBlockChain, purchaseTokenWithUSD } from '../../services/tokens';
import { showToastMessage } from '../displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { useAppTheme } from '../../theme/useApptheme';
import { getPaymentSessionUrl, STRIPE_BROWSER_OPTIONS, getStripeErrorMessages } from '../../utils/stripeOnboarding';
import { useStripeCustomer } from '../../hooks/useStripeCustomer';
import StripePaymentMethodModal from './StripePaymentMethodModal';
import { useLanguage } from '../../i18n';

const { width, height } = Dimensions.get('window');

const TokenPurchaseModal = ({ onClose, onPurchase, hasFollowing = false, autoFocus = false, vendorid }) => {
  const [amount, setAmount] = useState('');
  const [selectedTokens, setSelectedTokens] = useState(0);
  const [tokenRate, setTokenRate] = useState(0.001);
  const [loading, setLoading] = useState(true);
  const [bottomPad, setBottomPad] = useState(0);
  const [activeInput, setActiveInput] = useState('amount');
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);

  const updateInProgress = useRef(false);
  const amountInputRef = useRef(null);
  const dispatch = useDispatch();
  const toast = useToast();
  const { textStyle, text } = useAppTheme();
  const { requireStripeCustomerForPayment, openPaymentConnectionAndRefresh } = useStripeCustomer();
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const paymentCompletedRef = useRef(false);
  const { t } = useLanguage();
  const stripeErrorMessages = getStripeErrorMessages(t);

  const calculateBreakdown = (inputAmount) => {
    const baseAmount = parseFloat(inputAmount) || 0;
    const platformFee = baseAmount * 0.05;
    const followingFee = baseAmount * 0.05;
    const totalAmount = baseAmount + platformFee + followingFee;
    const tokens = Math.floor(baseAmount / tokenRate);
    return {
      baseAmount,
      platformFee,
      followingFee,
      totalAmount,
      tokens: Math.max(0, tokens),
    };
  };

  const calculateAmountFromTokens = (tokenCount) => {
    if (tokenCount <= 0) return 0;
    return tokenCount * tokenRate;
  };

  useEffect(() => {
    if (vendorid) {
      fetchTokenPrice();
    } else {
      console.warn('TokenPurchaseModal: vendorid is missing');
      setLoading(false);
    }
  }, [vendorid, fetchTokenPrice]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('PAYMENT_COMPLETED', (data) => {
      paymentCompletedRef.current = true;
      setIsProcessingPurchase(false);
      dispatch(hideLoader());
      if (onPurchase) onPurchase();
      showToastMessage(toast, 'success', t('tokenPurchase.paymentCompleted'));
    });
    return () => subscription.remove();
  }, [onPurchase, dispatch, toast, t]);

  const fetchTokenPrice = useCallback(async () => {
    try {
      if (!vendorid) {
        setLoading(false);
        return;
      }
      const response = await getUserTokenInfoByBlockChain(vendorid);
      if (response?.statusCode === 200 && response?.data) {
        await getPriceOfToken(response.data.data?.tokenAddress);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching profile token info:', err);
      setLoading(false);
    }
  }, [vendorid]);

  const getPriceOfToken = async (tokenAddress) => {
    try {
      if (!tokenAddress) return;
      dispatch(showLoader());
      const response = await getTokenPrice({ tokenAddress });
      if (response.statusCode === 200) {
        const price = parseFloat(response?.data?.priceInUsd);
        if (!isNaN(price) && price > 0) setTokenRate(price);
        setLoading(false);
      }
    } catch (err) {
      Alert.alert(t('tokenPurchase.errorTitle'), err.message || t('tokenPurchase.fetchPriceError'));
    } finally {
      dispatch(hideLoader());
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!updateInProgress.current && activeInput === 'amount' && !loading && tokenRate > 0) {
      const breakdown = calculateBreakdown(amount);
      if (breakdown.tokens !== selectedTokens) {
        updateInProgress.current = true;
        setSelectedTokens(breakdown.tokens);
        setTimeout(() => { updateInProgress.current = false; }, 50);
      }
    }
  }, [amount, tokenRate, loading, activeInput]);

  useEffect(() => {
    if (!updateInProgress.current && activeInput === 'tokens' && !loading && tokenRate > 0) {
      const newAmount = calculateAmountFromTokens(selectedTokens);
      const newAmountStr = newAmount > 0 ? String(newAmount) : '';
      if (newAmountStr !== amount) {
        updateInProgress.current = true;
        setAmount(newAmountStr);
        setTimeout(() => { updateInProgress.current = false; }, 50);
      }
    }
  }, [selectedTokens, tokenRate, loading, activeInput]);

  const handleAmountChange = (newAmount) => {
    if (!updateInProgress.current) {
      setActiveInput('amount');
      setAmount(newAmount);
    }
  };

  const handleTokenChange = (newTokenCount) => {
    if (newTokenCount < 0) return;
    if (!updateInProgress.current) {
      setActiveInput('tokens');
      setSelectedTokens(newTokenCount);
    }
  };

  const handleAmountFocus = () => setActiveInput('amount');

  const handlePurchase = async () => {
    const breakdown = calculateBreakdown(amount);
    if (breakdown.baseAmount <= 0 || breakdown.tokens <= 0) return;

    if (breakdown.totalAmount < 0.50) {
      showToastMessage(toast, 'danger', t('tokenPurchase.minAmountError'));
      return;
    }

    const canProceed = await requireStripeCustomerForPayment();
    if (!canProceed) {
      setShowPaymentMethodModal(true);
      return;
    }

    try {
      setIsProcessingPurchase(true);
      dispatch(showLoader());

      const requestBody = {
        amount: breakdown.totalAmount,
        platformFee: breakdown.platformFee,
        vendorFee: breakdown.followingFee,
        restAmount: breakdown.baseAmount,
        tokensReceived: breakdown.tokens,
        purchaseTokenPrice: tokenRate,
        type: 'token_purchase',
        vendorId: vendorid,
      };

      const response = await purchaseTokenWithUSD(requestBody);
      const url = getPaymentSessionUrl(response);

      if (url) {
        try {
          if (await InAppBrowser.isAvailable()) {
            paymentCompletedRef.current = false;
            await InAppBrowser.open(url, STRIPE_BROWSER_OPTIONS);
            if (!paymentCompletedRef.current) {
              setIsProcessingPurchase(false);
              dispatch(hideLoader());
              showToastMessage(toast, 'danger', stripeErrorMessages.PAYMENT_CANCELLED);
            }
          } else {
            await Linking.openURL(url);
            setIsProcessingPurchase(false);
            dispatch(hideLoader());
          }
        } catch (err) {
          setIsProcessingPurchase(false);
          dispatch(hideLoader());
          showToastMessage(toast, 'danger', stripeErrorMessages.SESSION_FAILED);
        }
      } else {
        showToastMessage(toast, 'danger', response?.message || response?.data?.message || stripeErrorMessages.SESSION_FAILED);
        setIsProcessingPurchase(false);
        dispatch(hideLoader());
      }
    } catch (error) {
      showToastMessage(toast, 'danger', error?.response?.data?.message || stripeErrorMessages.NETWORK_ERROR);
      setIsProcessingPurchase(false);
      dispatch(hideLoader());
    }
  };

  const handlePaymentCallback = useCallback(() => {
    const checkPaymentStatus = async () => {
      if (onPurchase) onPurchase();
    };
    checkPaymentStatus();
  }, [onPurchase]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') handlePaymentCallback();
    });
    return () => appStateSubscription.remove();
  }, [handlePaymentCallback]);

  const formatCurrency = (value) => {
    const num = Number(value);
    if (num < 0.01) return `${parseFloat(num.toFixed(6))}`;
    return `${parseFloat(num.toFixed(2))}`;
  };

  const currentBreakdown = calculateBreakdown(amount);
  const isButtonDisabled =
    currentBreakdown.baseAmount <= 0 ||
    currentBreakdown.tokens <= 0 ||
    isProcessingPurchase;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>{t('tokenPurchase.loadingPrice')}</Text>
      </View>
    );
  }

  return (
    <>
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, marginBottom: -10 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={0}
        extraHeight={0}
        enableAutomaticScroll={false}
      >
        <View style={styles.content}>
          {/* Token Info */}
          <View style={styles.tokenInfoSection}>
            <View style={styles.tokenIconContainer}>
              <Icon name="diamond" size={32} color={text} />
            </View>
            <Text style={styles.tokenTitle}>{t('tokenPurchase.title')}</Text>
            <Text style={styles.tokenSubtitle}>
              {t('tokenPurchase.rateLabel', { rate: formatCurrency(tokenRate) })}
            </Text>
          </View>

          {/* Amount Input */}
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>{t('tokenPurchase.amountInputLabel')}</Text>
            <View style={[styles.inputGroup, activeInput === 'amount' && styles.inputGroupActive, { borderColor: text, shadowColor: text }]}>
              <Text style={[styles.currencySymbol, textStyle]}>$</Text>
              <TextInput
                ref={amountInputRef}
                style={styles.textInput}
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={amount}
                onChangeText={handleAmountChange}
                onFocus={handleAmountFocus}
                blurOnSubmit
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
                editable={!isProcessingPurchase}
              />
            </View>
          </View>

          {/* Token Selector */}
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>{t('tokenPurchase.selectTokensLabel')}</Text>
            <View style={[styles.tokenSelector, activeInput === 'tokens' && styles.tokenSelectorActive, { borderColor: text, shadowColor: text }]}>
              <TouchableOpacity
                style={[styles.tokenButton, isProcessingPurchase && styles.tokenButtonDisabled, { backgroundColor: text }]}
                onPress={() => handleTokenChange(Math.max(0, selectedTokens - 1))}
                activeOpacity={0.7}
                disabled={isProcessingPurchase}
              >
                <Text style={styles.tokenButtonText}>-</Text>
              </TouchableOpacity>

              <Text style={styles.tokenCount}>{selectedTokens.toLocaleString()}</Text>

              <TouchableOpacity
                style={[styles.tokenButton, isProcessingPurchase && styles.tokenButtonDisabled, { backgroundColor: text }]}
                onPress={() => handleTokenChange(selectedTokens + 1)}
                activeOpacity={0.7}
                disabled={isProcessingPurchase}
              >
                <Text style={styles.tokenButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Fee Breakdown */}
          <View style={styles.calculationSection}>
            <Text style={styles.calculationTitle}>{t('tokenPurchase.breakdownTitle')}</Text>
            <View style={styles.calculationCard}>
              <View style={styles.calculationRow}>
                <Text style={styles.calculationLabel}>{t('tokenPurchase.tokenValueLabel')}</Text>
                <Text style={styles.calculationValue}>
                  ${formatCurrency(currentBreakdown.baseAmount)}
                </Text>
              </View>
              <View style={styles.calculationRow}>
                <Text style={styles.calculationLabel}>{t('tokenPurchase.platformFeeLabel')}</Text>
                <Text style={[styles.calculationValue, styles.addition]}>
                  +${formatCurrency(currentBreakdown.platformFee)}
                </Text>
              </View>
              {hasFollowing && (
                <View style={styles.calculationRow}>
                  <Text style={styles.calculationLabel}>{t('tokenPurchase.followingFeeLabel')}</Text>
                  <Text style={[styles.calculationValue, styles.addition]}>
                    +${formatCurrency(currentBreakdown.followingFee)}
                  </Text>
                </View>
              )}
              <View style={styles.separator} />
              <View style={styles.calculationRow}>
                <Text style={[styles.calculationLabel, styles.totalLabel]}>
                  {t('tokenPurchase.totalPayableLabel')}
                </Text>
                <Text style={[styles.calculationValue, styles.totalValue, textStyle]}>
                  ${formatCurrency(currentBreakdown.totalAmount)}
                </Text>
              </View>
              <View style={styles.tokenResultRow}>
                <Icon name="diamond" size={20} color={text} style={styles.tokenIconSmall} />
                <Text style={styles.tokenResultLabel}>{t('tokenPurchase.youWillReceive')}</Text>
                <Text style={[styles.tokenResultValue, textStyle]}>
                  {t('tokenPurchase.tokensCount', { count: currentBreakdown.tokens.toLocaleString() })}
                </Text>
              </View>
            </View>
          </View>

          {/* Info Section */}
          <View style={styles.infoSection}>
            <View style={[styles.infoBox, { borderLeftColor: text }]}>
              <Icon name="information-circle" size={20} color={text} style={styles.infoIcon} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoText}>{t('tokenPurchase.info1')}</Text>
                <Text style={styles.infoText}>{t('tokenPurchase.info2')}</Text>
                <Text style={styles.infoText}>{t('tokenPurchase.info3')}</Text>
              </View>
            </View>
          </View>

          {/* Purchase Button */}
          <TouchableOpacity
            style={[
              styles.purchaseButton,
              isButtonDisabled && styles.purchaseButtonDisabled,
              { backgroundColor: text, shadowColor: text },
            ]}
            onPress={handlePurchase}
            disabled={isButtonDisabled}
            activeOpacity={0.8}
          >
            {isProcessingPurchase ? (
              <>
                <Icon name="hourglass" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                <Text style={styles.purchaseButtonText}>{t('tokenPurchase.processingButton')}</Text>
              </>
            ) : (
              <>
                <Icon name="card" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                <Text style={styles.purchaseButtonText}>
                  {currentBreakdown.tokens > 0
                    ? t('tokenPurchase.purchaseButtonWithDetails', {
                        count: currentBreakdown.tokens.toLocaleString(),
                        total: formatCurrency(currentBreakdown.totalAmount),
                      })
                    : t('tokenPurchase.purchaseButton')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>

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

export default TokenPurchaseModal;

const styles = StyleSheet.create({
  // Loading styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: height * 0.9,
    minHeight: height * 0.6,
  },
  scrollView: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  placeholder: {
    width: 32,
  },

  // Content
  content: {
    padding: 24,
    paddingTop: 16,
    marginBottom: 10,
    // paddingBottom:20,
  },

  // Token Info Section
  tokenInfoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  tokenIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E0E7FF',
  },
  tokenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  tokenSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '400',
  },

  // Input Styles
  inputWrapper: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
  },
  inputGroupActive: {
    backgroundColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 18,
    color: '#1F2937',
    fontWeight: '600',
  },

  // Token Selector
  tokenSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingVertical: 8,
  },
  tokenSelectorActive: {
    backgroundColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tokenButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  tokenButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  tokenButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  tokenCount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    minWidth: 60,
    textAlign: 'center',
  },

  // Calculation Section
  calculationSection: {
    marginBottom: 24,
  },
  calculationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  calculationCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  calculationLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '400',
  },
  calculationValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  addition: {
    color: '#48AD24', // Orange color to indicate addition
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  totalLabel: {
    fontWeight: '600',
    color: '#374151',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  tokenResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  tokenIconSmall: {
    marginRight: 8,
  },
  tokenResultLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    flex: 1,
  },
  tokenResultValue: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Info Section
  infoSection: {
    marginBottom: 24,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 1,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
    marginBottom: 4,
  },

  // Purchase Button
  purchaseButton: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  purchaseButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonIcon: {
    marginRight: 8,
  },
  purchaseButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    flexShrink: 1,
  },
});
