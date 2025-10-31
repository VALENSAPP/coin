import { View, Text, StyleSheet, TouchableOpacity, TextInput, Dimensions, Keyboard, Linking } from 'react-native';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Icon from 'react-native-vector-icons/Ionicons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { useDispatch } from 'react-redux';
import { getTokenPrice, getUserTokenInfoByBlockChain, purchaseTokenWithUSD } from '../../services/tokens';
import { showToastMessage } from '../displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import InAppBrowser from 'react-native-inappbrowser-reborn';

const { width, height } = Dimensions.get('window');

const TokenPurchaseModal = ({ onClose, onPurchase, hasFollowing = false, autoFocus = false, vendorid }) => {
  const [amount, setAmount] = useState('');
  const [selectedTokens, setSelectedTokens] = useState(0);
  const [tokenRate, setTokenRate] = useState(0.001);
  const [loading, setLoading] = useState(true);
  const [bottomPad, setBottomPad] = useState(0);
  const [activeInput, setActiveInput] = useState('amount');
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false); // Add this state

  const updateInProgress = useRef(false);
  const amountInputRef = useRef(null);
  const dispatch = useDispatch();
  const toast = useToast();

  const calculateBreakdown = (inputAmount) => {
    const baseAmount = parseFloat(inputAmount) || 0;
    const platformFee = baseAmount * 0.05;
    const followingFee = baseAmount * 0.05;
    const totalAmount = baseAmount + platformFee + followingFee;
    const tokens = Math.floor(baseAmount / tokenRate);

    console.log('calculateBreakdown:', {
      inputAmount,
      baseAmount,
      platformFee,
      totalAmount,
      tokenRate,
      tokens
    });

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
    const baseAmount = tokenCount * tokenRate;
    return baseAmount;
  };

  useEffect(() => {
    // const loadTokenPrice = async () => {
    //   try {
    setLoading(true);
    //     const storedPrice = await AsyncStorage.getItem('priceInUsd');
    //     if (storedPrice) {
    //       const price = parseFloat(storedPrice);
    //       if (!isNaN(price) && price > 0) {
    //         setTokenRate(price);
    //       }
    //     }
    //   } catch (error) {
    //     console.error('Error loading token price from AsyncStorage:', error);
    //   } finally {
    //     setLoading(false);
    //   }
    // };

    // loadTokenPrice();
    fetchTokenPrice();
  }, []);

  const fetchTokenPrice = useCallback(async () => {
    try {
      const response = await getUserTokenInfoByBlockChain(vendorid);
      if (response?.statusCode === 200 && response?.data) {
        console.log('Fetched token info:', response.data);

        getPriceOfToken(response.data.data?.tokenAddress);
      }
    } catch (err) {
      console.error('Error fetching profile token info:', err);
      // Don't show toast error for this, as it's not critical
    }
  }, [vendorid]);

  const getPriceOfToken = async (tokenAddress) => {
    try {
      if (!tokenAddress) return;
      dispatch(showLoader());
      const response = await getTokenPrice({ tokenAddress });
      console.log('getPriceOfToken--------------', response);
      if (response.statusCode === 200) {
        // setTokenRate(response?.data?.priceInUsd);
        const price = parseFloat(response?.data?.priceInUsd);
        if (!isNaN(price) && price > 0) {
          setTokenRate(price);
        }
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to fetch token price');
    } finally {
      dispatch(hideLoader());
      setLoading(false);
    }
  };


  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setBottomPad(e?.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      requestAnimationFrame(() => setBottomPad(0));
    });
    return () => {
      showSub?.remove?.();
      hideSub?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (!updateInProgress.current && activeInput === 'amount' && !loading && tokenRate > 0) {
      const breakdown = calculateBreakdown(amount);

      if (breakdown.tokens !== selectedTokens) {
        updateInProgress.current = true;
        setSelectedTokens(breakdown.tokens);
        setTimeout(() => {
          updateInProgress.current = false;
        }, 50);
      }
    }
  }, [amount, tokenRate, loading, activeInput]);

  useEffect(() => {
    console.log('Token effect triggered:', {
      selectedTokens,
      activeInput,
      loading,
      tokenRate,
      updateInProgress: updateInProgress.current
    });

    if (!updateInProgress.current && activeInput === 'tokens' && !loading && tokenRate > 0) {
      const newAmount = calculateAmountFromTokens(selectedTokens);
      const newAmountStr = newAmount > 0 ? String(newAmount) : '';
      // Only update if the calculated amount is different from current
      if (newAmountStr !== amount) {
        updateInProgress.current = true;
        setAmount(newAmountStr);
        setTimeout(() => {
          updateInProgress.current = false;
        }, 50);
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

  const handleAmountFocus = () => {
    setActiveInput('amount');
  };

  const handlePurchase = async () => {
    const breakdown = calculateBreakdown(amount);
    if (breakdown.baseAmount <= 0 || breakdown.tokens <= 0) {
      return;
    }

    try {
      setIsProcessingPurchase(true); // Set local loading state
      dispatch(showLoader())
      const requestBody = {
        amount: breakdown.totalAmount,
        platformFee: breakdown.platformFee,
        vendorFee: breakdown.followingFee,
        restAmount: breakdown.baseAmount,
        tokensReceived: breakdown.tokens,
        purchaseTokenPrice: tokenRate,
        // amount: 0.55,
        // platformFee: 0.00003,
        // vendorFee: 0.00007,
        // restAmount: 0.50,
        // tokensReceived: breakdown.tokens,
        // purchaseTokenPrice: 0.001,
        vendorId: vendorid
        // vendorId: 'fe9fb714-36f1-44bb-a8fc-ee2573c9cc3f'
      };

      console.log('Purchase request body:', requestBody);
      const response = await purchaseTokenWithUSD(requestBody);
      console.log('purchaseTokenWithUSD------------------------:', response);
      if (response && response.statusCode === 200) {
        const url = response?.data?.sessionUrl;

        try {
          if (await InAppBrowser.isAvailable()) {
            await InAppBrowser.open(url, {
              // ✅ Customization options
              dismissButtonStyle: 'close',
              preferredBarTintColor: '#ffffff',
              preferredControlTintColor: '#000000',
              readerMode: false,
              animated: true,
              modalPresentationStyle: 'fullScreen',
              modalTransitionStyle: 'coverVertical',
              enableBarCollapsing: true,
              showTitle: true,
            });
          } else {
            // Fallback if in-app browser not available
            await Linking.openURL(url);
          }
          onPurchase(); // Trigger after browser opened
        } catch (error) {
          console.warn(error);
        }
      }
      else {
        showToastMessage(toast, 'danger', response.message);
      }
    } catch (error) {
      console.error('Error creating payment session:', error);
      alert('Failed to process payment. Please check your connection and try again.');
    } finally {
      setIsProcessingPurchase(false); // Reset local loading state
      dispatch(hideLoader());
    }
  };


  const formatCurrency = (value) => {
    const num = Number(value);
    if (num < 0.01) {
      return `${parseFloat(num.toFixed(6))}`;
    }
    return `${parseFloat(num.toFixed(2))}`;
  };

  // Calculate current breakdown for display
  const currentBreakdown = calculateBreakdown(amount);

  // Check if button should be disabled
  const isButtonDisabled = currentBreakdown.baseAmount <= 0 ||
    currentBreakdown.tokens <= 0 ||
    isProcessingPurchase;

  // Show loading state while fetching token price
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading token price...</Text>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={{ flexGrow: 1, paddingBottom: bottomPad + 24 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid={true}
      extraScrollHeight={16}
    >
      <View style={styles.content}>
        {/* Token Info */}
        <View style={styles.tokenInfoSection}>
          <View style={styles.tokenIconContainer}>
            <Icon name="diamond" size={32} color="#5a2d82" />
          </View>
          <Text style={styles.tokenTitle}>Buy Tokens</Text>
          <Text style={styles.tokenSubtitle}>
            Current rate: ${formatCurrency(tokenRate)} per token
          </Text>
        </View>

        {/* Amount Input */}
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Token Value Amount</Text>
          <View style={[styles.inputGroup, activeInput === 'amount' && styles.inputGroupActive]}>
            <Text style={styles.currencySymbol}>$</Text>
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
              editable={!isProcessingPurchase} // Disable input during purchase
            />
          </View>
        </View>

        {/* Token Selector */}
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Select Tokens</Text>
          <View style={[styles.tokenSelector, activeInput === 'tokens' && styles.tokenSelectorActive]}>
            <TouchableOpacity
              style={[styles.tokenButton, isProcessingPurchase && styles.tokenButtonDisabled]}
              onPress={() => handleTokenChange(Math.max(0, selectedTokens - 1))}
              activeOpacity={0.7}
              disabled={isProcessingPurchase} // Disable during purchase
            >
              <Text style={styles.tokenButtonText}>-</Text>
            </TouchableOpacity>

            <Text style={styles.tokenCount}>{selectedTokens.toLocaleString()}</Text>

            <TouchableOpacity
              style={[styles.tokenButton, isProcessingPurchase && styles.tokenButtonDisabled]}
              onPress={() => handleTokenChange(selectedTokens + 1)}
              activeOpacity={0.7}
              disabled={isProcessingPurchase} // Disable during purchase
            >
              <Text style={styles.tokenButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Fee Structure - Always Visible */}
        <View style={styles.calculationSection}>
          <Text style={styles.calculationTitle}>Fee Structure & Breakdown</Text>
          <View style={styles.calculationCard}>
            <View style={styles.calculationRow}>
              <Text style={styles.calculationLabel}>Token Value</Text>
              <Text style={styles.calculationValue}>
                ${formatCurrency(currentBreakdown.baseAmount)}
              </Text>
            </View>
            <View style={styles.calculationRow}>
              <Text style={styles.calculationLabel}>Platform Fee (5%)</Text>
              <Text style={[styles.calculationValue, styles.addition]}>
                +${formatCurrency(currentBreakdown.platformFee)}
              </Text>
            </View>
            {hasFollowing && (
              <View style={styles.calculationRow}>
                <Text style={styles.calculationLabel}>Following Fee (5%)</Text>
                <Text style={[styles.calculationValue, styles.addition]}>
                  +${formatCurrency(currentBreakdown.followingFee)}
                </Text>
              </View>
            )}
            <View style={styles.separator} />
            <View style={styles.calculationRow}>
              <Text style={[styles.calculationLabel, styles.totalLabel]}>
                Total Payable Amount
              </Text>
              <Text style={[styles.calculationValue, styles.totalValue]}>
                ${formatCurrency(currentBreakdown.totalAmount)}
              </Text>
            </View>
            <View style={styles.tokenResultRow}>
              <Icon name="diamond" size={20} color="#5a2d82" style={styles.tokenIconSmall} />
              <Text style={styles.tokenResultLabel}>You'll receive</Text>
              <Text style={styles.tokenResultValue}>
                {currentBreakdown.tokens.toLocaleString()} tokens
              </Text>
            </View>
          </View>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <View style={styles.infoBox}>
            <Icon name="information-circle" size={20} color="#5a2d82" style={styles.infoIcon} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoText}>
                • Platform fee and Following fee is added to your token value amount
              </Text>
              <Text style={styles.infoText}>
                • Token count is calculated from the token value amount (before fees)
              </Text>
              <Text style={styles.infoText}>
                • Adjusting either amount or tokens will update the other automatically
              </Text>
            </View>
          </View>
        </View>

        {/* Purchase Button */}
        <TouchableOpacity
          style={[
            styles.purchaseButton,
            isButtonDisabled && styles.purchaseButtonDisabled,
          ]}
          onPress={handlePurchase}
          disabled={isButtonDisabled}
          activeOpacity={0.8}
        >
          {isProcessingPurchase ? (
            <>
              <Icon name="hourglass" size={20} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.purchaseButtonText}>Processing...</Text>
            </>
          ) : (
            <>
              <Icon name="card" size={20} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.purchaseButtonText}>
                Purchase {currentBreakdown.tokens > 0 ? `${currentBreakdown.tokens.toLocaleString()} ` : ''}Tokens
                {currentBreakdown.totalAmount > 0 && ` for $${formatCurrency(currentBreakdown.totalAmount)}`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAwareScrollView>
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
    borderColor: '#5a2d82',
    backgroundColor: '#FFFFFF',
    shadowColor: '#5a2d82',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#5a2d82',
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
    borderColor: '#5a2d82',
    backgroundColor: '#FFFFFF',
    shadowColor: '#5a2d82',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tokenButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#5a2d82',
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
    color: '#5a2d82',
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
    color: '#5a2d82',
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
    borderLeftColor: '#5a2d82',
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
    backgroundColor: '#5a2d82',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#5a2d82',
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