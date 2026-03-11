import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    ScrollView,
    Modal,
    TouchableOpacity,
    KeyboardAvoidingView,
    Linking,
    ActivityIndicator,
    DeviceEventEmitter,
    Platform,
} from 'react-native';
import { useAppTheme } from '../../theme/useApptheme';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { addMissionDonation, purchaseTokenWithUSD } from '../../services/tokens';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { showToastMessage } from '../displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import { getPaymentSessionUrl, STRIPE_BROWSER_OPTIONS, STRIPE_ERROR_MESSAGES } from '../../utils/stripeOnboarding';
import { useStripeCustomer } from '../../hooks/useStripeCustomer';
import StripePaymentMethodModal from './StripePaymentMethodModal';
import { useNavigation } from '@react-navigation/native';

export default function MissionSupportScreen({ visible, onClose, item, onDonationSuccess }) {
    const { bgStyle, textStyle, bg } = useAppTheme();
    const dispatch = useDispatch();
    const toast = useToast();
    const navigation = useNavigation();
    const { requireStripeCustomerForPayment, openPaymentConnectionAndRefresh } = useStripeCustomer();
    const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);

    const [selectedAmount, setSelectedAmount] = useState(null);
    const [customAmount, setCustomAmount] = useState('');
    const [note, setNote] = useState('');
    const [isButtonLoading, setIsButtonLoading] = useState(false);
    const paymentCompletedRef = useRef(false);


    const amounts = [5, 10, 25, 50];

    // ✅ Listen for payment completion events
    useEffect(() => {
        // Only setup listener when modal is visible
        if (!visible) return;

        console.log('🎧 MissionSupport: Setting up PAYMENT_COMPLETED listener');

        const subscription = DeviceEventEmitter.addListener('PAYMENT_COMPLETED', (data) => {
            console.log('🔔 MissionSupport: PAYMENT_COMPLETED event received!', data);

            // Reset loading state
            paymentCompletedRef.current = true;
            setIsButtonLoading(false);
            dispatch(hideLoader());

            // Call success callback if provided
            if (onDonationSuccess) {
                console.log('📞 MissionSupport: Calling onDonationSuccess');
                onDonationSuccess();
            }

            // Reset form
            setCustomAmount('');
            setSelectedAmount(null);
            setNote('');

            // Close modal
            onClose();

            showToastMessage(toast, 'success', 'Donation completed successfully!');
        });

        return () => {
            console.log('🔇 MissionSupport: Removing PAYMENT_COMPLETED listener');
            subscription.remove();
        };
    }, [visible]); // ✅ Only depend on visible prop

    const handleConfirm = async () => {
        const canProceed = await requireStripeCustomerForPayment();
        if (!canProceed) {
            setShowPaymentMethodModal(true);
            return;
        }
        setIsButtonLoading(true);

        if (item?.profile === "user") {
            await handleMissionDonation();
        }
        else {
            const finalAmount = selectedAmount || customAmount;
            console.log("Final Amount:", finalAmount);
            console.log("Note:", note);
            try {
                dispatch(showLoader())
                const requestBody = {
                    type: "donation",
                    amount: Number(finalAmount),
                    vendorId: item.UserId,
                    postId: item.id,
                    note: note
                };

                console.log('Purchase request body:', requestBody);
                const response = await purchaseTokenWithUSD(requestBody);
                setTimeout(async () => {
                    const url = getPaymentSessionUrl(response);
                    if (url) {
                        try {
                            if (await InAppBrowser.isAvailable()) {
                                paymentCompletedRef.current = false;
                                await InAppBrowser.open(url, STRIPE_BROWSER_OPTIONS);
                                if (!paymentCompletedRef.current) {
                                    setIsButtonLoading(false);
                                    dispatch(hideLoader());
                                    showToastMessage(toast, 'danger', STRIPE_ERROR_MESSAGES.PAYMENT_CANCELLED);
                                }
                            } else {
                                await Linking.openURL(url);
                                setCustomAmount('');
                                setSelectedAmount(null);
                                setNote('');
                                setIsButtonLoading(false);
                                onClose();
                                dispatch(hideLoader());
                            }
                        } catch (err) {
                            await InAppBrowser.close();
                            setIsButtonLoading(false);
                            dispatch(hideLoader());
                            showToastMessage(toast, 'danger', STRIPE_ERROR_MESSAGES.SESSION_FAILED);
                        }
                    } else {
                        const msg = response?.message || response?.data?.message || STRIPE_ERROR_MESSAGES.RECIPIENT_NOT_READY;
                        showToastMessage(toast, 'danger', msg);
                        setIsButtonLoading(false);
                        dispatch(hideLoader());
                    }
                }, 1000);
            } catch (error) {
                console.error('Error creating payment session:', error);
                showToastMessage(toast, 'danger', error?.response?.data?.message || STRIPE_ERROR_MESSAGES.NETWORK_ERROR);
                await InAppBrowser.close();
                setIsButtonLoading(false);
                dispatch(hideLoader());
            }
        }
    };
    const handleMissionDonation = async () => {
        const finalAmount = selectedAmount || customAmount;
        console.log("Final Amount:", finalAmount);
        console.log("Note:", note);

        try {
            dispatch(showLoader());

            const requestBody = {
                type: "missionDonation",
                amount: Number(finalAmount),
                vendorId: item.UserId,
                postId: item.id,
                note: note
            };

            console.log('Mission Donation Request:', requestBody);

            const response = await addMissionDonation(requestBody);
            const url = getPaymentSessionUrl(response);

            if (url) {
                try {
                    if (await InAppBrowser.isAvailable()) {
                        await InAppBrowser.open(url, STRIPE_BROWSER_OPTIONS);
                    } else {
                        await Linking.openURL(url);
                        setCustomAmount('');
                        setSelectedAmount(null);
                        setNote('');
                        setIsButtonLoading(false);
                        dispatch(hideLoader());
                        onClose();
                    }
                } catch (err) {
                    setIsButtonLoading(false);
                    dispatch(hideLoader());
                    showToastMessage(toast, 'danger', STRIPE_ERROR_MESSAGES.SESSION_FAILED);
                }
            } else {
                showToastMessage(toast, 'danger', response?.message || response?.data?.message || STRIPE_ERROR_MESSAGES.RECIPIENT_NOT_READY);
                setIsButtonLoading(false);
                dispatch(hideLoader());
            }
        } catch (error) {
            console.error('Error creating mission donation session:', error);
            showToastMessage(toast, 'danger', error?.response?.data?.message || STRIPE_ERROR_MESSAGES.NETWORK_ERROR);
            setIsButtonLoading(false);
            dispatch(hideLoader());
        }
    };

    return (
        <>
        <Modal
            visible={visible && !showPaymentMethodModal}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <View style={styles.overlay}>
                    <View style={styles.modalBox}>
                        <ScrollView contentContainerStyle={[styles.container, bgStyle]}>

                            <Text style={[styles.title, textStyle]}>💜 VALENS MISSION POST</Text>

                            <Text style={styles.heading}>Fund this Mission. Fuel their vision.</Text>

                            <Text style={styles.description}>
                                Your contribution helps this creator complete a specific goal or project.
                            </Text>

                            <Text style={styles.label}>Leave a note (optional):</Text>
                            <TextInput
                                style={styles.noteInput}
                                placeholder="Type a short message of support..."
                                placeholderTextColor="#999"
                                multiline
                                value={note}
                                onChangeText={setNote}
                            />

                            <Text style={styles.label}>Choose your support amount:</Text>

                            <View style={styles.amountContainer}>
                                {amounts.map((amt) => (
                                    <TouchableOpacity
                                        key={amt}
                                        style={[styles.amountBox, selectedAmount === amt && styles.amountSelected]}
                                        onPress={() => {
                                            setSelectedAmount(amt);
                                            setCustomAmount('');
                                        }}
                                    >
                                        <Text style={styles.amountText}>${amt}</Text>
                                    </TouchableOpacity>
                                ))}

                                <View style={[styles.customBox, customAmount && styles.amountSelected]}>
                                    <TextInput
                                        keyboardType="numeric"
                                        style={styles.customInput}
                                        value={customAmount}
                                        onChangeText={(t) => {
                                            setCustomAmount(t);
                                            setSelectedAmount(null);
                                        }}
                                        placeholder='Enter amount'
                                        placeholderTextColor="#000"
                                        cursorColor="#000"
                                        selectionColor="#000"
                                    />
                                </View>
                            </View>

                            <Text style={styles.secureText}>
                                Your payment is processed securely. Standard Valens platform fees apply.
                            </Text>

                            <View style={styles.bottomButtons}>
                                <TouchableOpacity
                                    style={[styles.confirmBtn, bg, isButtonLoading && styles.confirmBtnDisabled]}
                                    onPress={handleConfirm}
                                    disabled={isButtonLoading}
                                >
                                    {isButtonLoading ? (
                                        <View style={styles.loadingContainer}>
                                            <ActivityIndicator size="small" color="#fff" />
                                            <Text style={[styles.confirmText, { marginLeft: 8 }]}>Processing...</Text>
                                        </View>
                                    ) : (
                                        <Text style={styles.confirmText}>🚀 Confirm & Support</Text>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.cancelBtn}
                                    onPress={() => {
                                        setIsButtonLoading(false);
                                        dispatch(hideLoader());
                                        onClose();
                                    }}
                                // disabled={isButtonLoading}
                                >
                                    <Text style={styles.cancelText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>

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
                    showToastMessage(toast, 'danger', e?.message || STRIPE_ERROR_MESSAGES.ONBOARDING_FAILED);
                }
            }}
        />
    </>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        padding: 20,
    },
    modalBox: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 10,
    },
    container: {
        padding: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    heading: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 10,
    },
    description: {
        fontSize: 15,
        color: '#333',
        marginVertical: 10,
    },
    label: {
        marginTop: 20,
        fontWeight: '600',
        fontSize: 15,
    },
    noteInput: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 10,
        height: 80,
        marginTop: 10,
    },
    amountContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 10,
    },
    amountBox: {
        borderWidth: 1,
        borderColor: '#666',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 20,
        marginRight: 10,
        marginBottom: 10,
    },
    amountSelected: {
        borderColor: '#7F3DFF',
        backgroundColor: '#EDE4FF',
    },
    amountText: {
        fontSize: 16,
        fontWeight: '600',
    },
    customBox: {
        borderWidth: 1,
        borderColor: '#666',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 10,
        width: '48%',
        height: 44,
    },
    customInput: {
        fontSize: 16,
        color: '#000',
        paddingHorizontal: 8,
    },
    secureText: {
        marginTop: 15,
        color: '#555',
        borderLeftWidth: 3,
        borderLeftColor: '#ccc',
        paddingLeft: 10,
    },
    bottomButtons: {
        flexDirection: 'row',
        marginTop: 30,
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    confirmBtn: {
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#5a2d82',
    },
    confirmBtnDisabled: {
        opacity: 0.7,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmText: {
        color: '#fff',
        fontWeight: '600',
    },
    cancelBtn: {
        padding: 12,
        borderWidth: 1,
        borderRadius: 5,
    },
    cancelText: {
        color: '#333',
        fontWeight: '600',
    },
});
