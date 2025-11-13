import React, { useRef, useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    ScrollView,
} from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import Ionicons from 'react-native-vector-icons/Ionicons';

const SubscribeFlowModal = ({
    visible,
    onClose,
    membershipPrice = 19.99,
    onPaymentDone,
    displayName
}) => {
    const step1Ref = useRef(null);
    const step2Ref = useRef(null);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [cardInfo, setCardInfo] = useState({
        name: '',
        number: '',
        expiry: '',
        cvv: '',
    });

    useEffect(() => {
        if (visible) step1Ref.current?.open();
        else {
            step1Ref.current?.close();
            step2Ref.current?.close();
        }
    }, [visible]);

    const handleConfirm = () => {
        // Trigger close animation of step 1
        step1Ref.current?.close();
    };

    const handleStep1Close = () => {
  // If user clicked “Yes, I’m In”, open next step
  if (visible) {
    setTimeout(() => step2Ref.current?.open(), 200);
  } else {
    onClose?.();
  }
};

    const handlePayment = () => {
        if (!acceptedTerms) {
            alert('Please accept Terms & Conditions to continue');
            return;
        }
        onPaymentDone?.(cardInfo);
        step2Ref.current?.close();
        onClose?.();
    };

    return (
        <>
            {/* Step 1: Confirmation */}
            <RBSheet
                ref={step1Ref}
                height={380}
                closeOnPressMask
                onClose={handleStep1Close} 
                customStyles={{
                    container: styles.sheetContainer,
                }}>
                <View style={styles.container}>
                    <Text style={styles.header}>{displayName} </Text>
                    <Text style={styles.subHeader}>You’re about to Subscribe!</Text>
                    <Text style={styles.bodyText}>
                        Unlock exclusive posts, private drops, and direct access to this
                        creator’s Valens world.{'\n\n'}
                        Your support turns into real-time rewards — every subscription fuels
                        their journey and yours.
                    </Text>

                    <Text style={styles.confirmText}>Confirm Subscription?</Text>

                    <TouchableOpacity
                        style={[styles.btn, styles.confirmBtn]}
                        onPress={handleConfirm}>
                        <Text style={styles.confirmTextBtn}>💜 Yes, I’m In</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.btn, styles.cancelBtn]}
                        onPress={onClose}>
                        <Text style={styles.cancelTextBtn}>Not Now</Text>
                    </TouchableOpacity>
                </View>
            </RBSheet>

            {/* Step 2: Payment */}
            <RBSheet
                ref={step2Ref}
                height={445}
                closeOnPressMask
                customStyles={{
                    container: styles.sheetContainer,
                }}>
                <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                    <Text style={styles.header}>💳 Add Card</Text>
                    <Text style={styles.paymentNote}>
                        We are fully compliant with Payment Card Industry Data Security
                        Standards.
                    </Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Name on Card"
                        value={cardInfo.name}
                        onChangeText={t => setCardInfo({ ...cardInfo, name: t })}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Card Number"
                        keyboardType="number-pad"
                        value={cardInfo.number}
                        onChangeText={t => setCardInfo({ ...cardInfo, number: t })}
                    />
                    <View style={styles.row}>
                        <TextInput
                            style={[styles.input, { flex: 1, marginRight: 8 }]}
                            placeholder="MM/YY"
                            value={cardInfo.expiry}
                            onChangeText={t => setCardInfo({ ...cardInfo, expiry: t })}
                        />
                        <TextInput
                            style={[styles.input, { flex: 1, marginLeft: 8 }]}
                            placeholder="CVV"
                            secureTextEntry
                            keyboardType="number-pad"
                            value={cardInfo.cvv}
                            onChangeText={t => setCardInfo({ ...cardInfo, cvv: t })}
                        />
                    </View>

                    <View style={styles.priceBox}>
                        <Text style={styles.priceLabel}>Membership</Text>
                        <Text style={styles.priceValue}>
                            ${membershipPrice.toFixed(2)} / month
                        </Text>
                    </View>

                    {/* ✅ Custom Checkbox */}
                    <TouchableOpacity
                        style={styles.checkboxRow}
                        activeOpacity={0.7}
                        onPress={() => setAcceptedTerms(!acceptedTerms)}>
                        <Ionicons
                            name={
                                acceptedTerms
                                    ? 'checkbox-outline'
                                    : 'square-outline'
                            }
                            size={22}
                            color={acceptedTerms ? '#5a2d82' : '#aaa'}
                        />
                        <Text style={styles.termsText}>I accept Terms & Conditions</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.btn, styles.doneBtn]}
                        onPress={handlePayment}>
                        <Text style={styles.doneText}>✅ Done — Complete Payment</Text>
                    </TouchableOpacity>
                </ScrollView>
            </RBSheet>
        </>
    );
};

export default SubscribeFlowModal;

const styles = StyleSheet.create({
    sheetContainer: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        backgroundColor: '#f8f2fd',
        padding: 20,
    },
    container: {
        flex: 1,
    },
    header: {
        fontSize: 20,
        fontWeight: '700',
        color: '#5a2d82',
        textAlign: 'center',
        marginBottom: 6,
    },
    subHeader: {
        fontSize: 17,
        fontWeight: '600',
        color: '#8b4ec4',
        textAlign: 'center',
        marginBottom: 12,
    },
    bodyText: {
        textAlign: 'center',
        color: '#333',
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 20,
    },
    confirmText: {
        textAlign: 'center',
        fontWeight: '600',
        color: '#5a2d82',
        marginBottom: 14,
    },
    btn: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 10,
    },
    confirmBtn: {
        backgroundColor: '#5a2d82',
    },
    confirmTextBtn: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    cancelBtn: {
        borderWidth: 1,
        borderColor: '#d3c1e0',
        backgroundColor: '#fff',
    },
    cancelTextBtn: {
        color: '#5a2d82',
        fontSize: 16,
        fontWeight: '600',
    },
    paymentNote: {
        color: '#555',
        fontSize: 13,
        marginBottom: 15,
        textAlign: 'center',
    },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 10,
        fontSize: 15,
        color: '#333',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    priceBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 14,
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    priceLabel: { fontSize: 15, color: '#555' },
    priceValue: { fontSize: 16, fontWeight: '700', color: '#5a2d82' },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 18,
    },
    termsText: {
        color: '#333',
        marginLeft: 8,
        fontSize: 14,
    },
    doneBtn: {
        backgroundColor: '#5a2d82',
    },
    doneText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});