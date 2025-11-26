import { View, Text, StyleSheet, TouchableOpacity, TextInput, Dimensions, Keyboard } from 'react-native';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Icon from 'react-native-vector-icons/Ionicons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { useDispatch } from 'react-redux';
import { showToastMessage } from '../displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import { useAppTheme } from '../../theme/useApptheme';
import { requestWithdrawal } from '../../services/profile';

const { width, height } = Dimensions.get('window');

const WithdrawalModal = ({ onWithdrawal }) => {
    const [amount, setAmount] = useState('');
    const [bottomPad, setBottomPad] = useState(0);
    const [activeInput, setActiveInput] = useState('amount');
    const [isProcessingWithdraw, setIsProcessingWithdraw] = useState(false);

    const updateInProgress = useRef(false);
    const amountInputRef = useRef(null);
    const dispatch = useDispatch();
    const toast = useToast();
    const { textStyle, text } = useAppTheme();

    // Calculate fee breakdown
    const calculateFeeBreakdown = (inputAmount) => {
        const numAmount = Number(inputAmount) || 0;
        const withdrawalFee = numAmount * 0.05; // 5% fee
        const finalAmount = numAmount - withdrawalFee; // Amount after deducting fee
        
        return {
            enteredAmount: numAmount,
            withdrawalFee: withdrawalFee,
            finalAmount: finalAmount
        };
    };

    const breakdown = calculateFeeBreakdown(amount);

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

    const handleAmountChange = (newAmount) => {
        if (!updateInProgress.current) {
            setActiveInput('amount');
            setAmount(newAmount);
        }
    };

    const handleAmountFocus = () => {
        setActiveInput('amount');
    };

    const handleWithdraw = async () => {
        // Validate amount
        if (!amount || Number(amount) <= 0) {
            showToastMessage(toast, 'danger', 'Please enter a valid amount');
            return;
        }

        try {
            setIsProcessingWithdraw(true);
            dispatch(showLoader());
            
            // Send the final amount (after deducting 5% fee) to the API
            const response = await requestWithdrawal({ amount: Number(breakdown.finalAmount) });
            console.log('requestWithdrawal--------------', response);
            
            if (response.statusCode === 200) {
                onWithdrawal();
            } else {
                showToastMessage(toast, 'danger', response.message);
            }
        } catch (error) {
            console.error('Error creating payment session:', error);
            showToastMessage(toast, 'danger', 'Failed to process withdrawal. Please try again.');
        } finally {
            setIsProcessingWithdraw(false);
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
                    <Text style={styles.tokenTitle}>Withdraw Amount</Text>
                </View>

                {/* Amount Input */}
                <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Enter Amount</Text>
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
                            editable={!isProcessingWithdraw}
                        />
                    </View>
                </View>

                {/* Fee Structure - Always Visible */}
                <View style={styles.calculationSection}>
                    <Text style={styles.calculationTitle}>Fee Structure & Breakdown</Text>
                    <View style={styles.calculationCard}>
                        <View style={styles.calculationRow}>
                            <Text style={styles.calculationLabel}>Entered Amount</Text>
                            <Text style={styles.calculationValue}>
                                ${formatCurrency(breakdown.enteredAmount)}
                            </Text>
                        </View>
                        <View style={styles.calculationRow}>
                            <Text style={styles.calculationLabel}>Withdrawal Fee (5%)</Text>
                            <Text style={[styles.calculationValue, styles.deduction]}>
                                -${formatCurrency(breakdown.withdrawalFee)}
                            </Text>
                        </View>
                        <View style={styles.separator} />
                        <View style={styles.calculationRow}>
                            <Text style={[styles.calculationLabel, styles.totalLabel]}>
                                Final Withdrawal Amount
                            </Text>
                            <Text style={[styles.calculationValue, styles.totalValue, textStyle]}>
                                ${formatCurrency(breakdown.finalAmount)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Withdraw Button */}
                <TouchableOpacity
                    style={[
                        styles.withdrawButton,
                        { backgroundColor: text, shadowColor: text },
                        (!amount || Number(amount) <= 0 || isProcessingWithdraw) && styles.withdrawButtonDisabled
                    ]}
                    onPress={handleWithdraw}
                    activeOpacity={0.8}
                    disabled={!amount || Number(amount) <= 0 || isProcessingWithdraw}
                >
                    {isProcessingWithdraw ? (
                        <>
                            <Icon name="hourglass" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                            <Text style={styles.withdrawButtonText}>Processing...</Text>
                        </>
                    ) : (
                        <>
                            <Text style={styles.withdrawButtonText}>
                                Withdraw ${formatCurrency(breakdown.finalAmount)}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAwareScrollView>
    );
};

export default WithdrawalModal;

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
        color: '#48AD24',
    },
    deduction: {
        color: '#EF4444', // Red color to indicate deduction
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

    // Withdraw Button
    withdrawButton: {
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
    withdrawButtonDisabled: {
        backgroundColor: '#D1D5DB',
        shadowOpacity: 0,
        elevation: 0,
    },
    buttonIcon: {
        marginRight: 8,
    },
    withdrawButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        flexShrink: 1,
    },
});