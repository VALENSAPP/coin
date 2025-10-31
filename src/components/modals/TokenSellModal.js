import { View, Text, StyleSheet, TouchableOpacity, TextInput, Dimensions, Keyboard, Alert } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import Icon from 'react-native-vector-icons/Ionicons';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { useDispatch } from 'react-redux';
import { getTokenPrice, sellToken, tokenPurchaseAmtByVendor } from '../../services/tokens';

const TokenSellModal = ({ onSell, tokenAddress, userId }) => {
  const [loading, setLoading] = useState(false);
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [availableTokens, setAvailableTokens] = useState(0);
  const [usdAmount, setUsdAmount] = useState(0);

  const dispatch = useDispatch();

  useEffect(() => {
    tokenPurchaseAmt();
    getPriceOfToken();
  }, []);

  const handleSell = async () => {
    try {
      setIsProcessingSale(true);
      dispatch(showLoader());

      const requestBody = {
        amountTokens: JSON.stringify(availableTokens),
        tokenAddress: tokenAddress,
      };
      console.log('requestBody for selling tokens:', requestBody);

      const response = await sellToken(requestBody);
      if (response && response.statusCode == 200) {
        onSell();
      }
    } catch (error) {
      console.error('Error creating sell session:', error);
      alert('Failed to process token sale. Please check your connection and try again.');
    } finally {
      setIsProcessingSale(false);
      dispatch(hideLoader());
    }
  };

  const tokenPurchaseAmt = async () => {
    try {
      dispatch(showLoader());
      if (userId) {
        console.log('userId for token purchase amount:', userId);
        
        const response = await tokenPurchaseAmtByVendor(userId);
         console.log('response.data.vendorTokenAmount:', response.data.vendorTokenAmount);
        if (response.statusCode === 200) {
          setAvailableTokens(response.data.vendorTokenAmount)
        } else {
        }
      }
    } catch (err) {
      console.log(err);
      Alert.alert('Error', err.message || 'Failed to fetch token purchase amount');
    } finally {
      dispatch(hideLoader());
    }
  };

  const getPriceOfToken = async () => {
    try {
      if (!tokenAddress) return;
      dispatch(showLoader());
      const response = await getTokenPrice({ tokenAddress });
      if (response.statusCode === 200) {
        console.log('Token price fetched:', response.data);
        setUsdAmount(response?.data?.priceInUsd);
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to fetch token price');
    } finally {
      dispatch(hideLoader());
    }
  };

  // Show loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Token Info */}
        <View style={styles.tokenInfoSection}>
          <View style={styles.tokenIconContainer}>
            <Icon name="trending-down" size={32} color="#dc2626" />
          </View>
          <Text style={styles.tokenTitle}>Sell Tokens</Text>
          <Text style={styles.availableTokens}>
            Available: {availableTokens.toLocaleString()} tokens
            {/* Available: 1 tokens */}
          </Text>
        </View>

        {/* Tokens to Sell (Disabled Display) */}
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Tokens to Sell</Text>
          <View style={[styles.inputGroup, styles.inputGroupDisabled]}>
            <Icon name="diamond" size={20} color="#9CA3AF" style={styles.tokenIcon} />
            <Text style={[styles.textDisplay, styles.textDisplayDisabled]}>
              {availableTokens.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* USD Amount Display */}
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>USD Amount</Text>
          <View style={[styles.inputGroup, styles.inputGroupDisabled]}>
            <Text style={[styles.currencySymbol, styles.currencySymbolDisabled]}>$</Text>
            <Text style={[styles.textDisplay, styles.textDisplayDisabled]}>
              {(availableTokens * usdAmount).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Sell Button */}
        <TouchableOpacity
          style={[
            styles.sellButton,
            // isButtonDisabled && styles.sellButtonDisabled,
          ]}
          onPress={handleSell}
          // disabled={isButtonDisabled}
          activeOpacity={0.8}
        >
          {isProcessingSale ? (
            <>
              <Icon name="hourglass" size={20} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.sellButtonText}>Processing...</Text>
            </>
          ) : (
            <>
              {/* <Icon name="trending-down" size={20} color="#FFFFFF" style={styles.buttonIcon} /> */}
              <Text style={styles.sellButtonText}>
                Sell Tokens for ${(availableTokens * usdAmount).toFixed(2)}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default TokenSellModal;

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

  // Content
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
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
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FECACA',
  },
  tokenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  availableTokens: {
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '600',
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
  inputGroupDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#dc2626',
    marginRight: 8,
  },
  currencySymbolDisabled: {
    color: '#9CA3AF',
  },
  tokenIcon: {
    marginRight: 8,
  },
  textDisplay: {
    flex: 1,
    fontSize: 18,
    color: '#1F2937',
    fontWeight: '600',
    paddingVertical: 4,
  },
  textDisplayDisabled: {
    color: '#9CA3AF',
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 4,
    fontWeight: '500',
  },

  // Sell Button
  sellButton: {
    height: 52,
    backgroundColor: '#dc2626',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginTop: 16,
  },
  sellButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonIcon: {
    marginRight: 8,
  },
  sellButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    flexShrink: 1,
  },
});