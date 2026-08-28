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
import { useThemeContext } from '../../theme/ThemeContext';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { addMissionDonation, purchaseTokenWithUSD } from '../../services/tokens';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { showToastMessage } from '../displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import {
    getPaymentSessionUrl,
    STRIPE_BROWSER_OPTIONS,
    getStripeErrorMessages,
    createOnboardingLink,
    getOnboardingStatus,
} from '../../utils/stripeOnboarding';
import { useLanguage } from '../../i18n';

const withAlpha = (hex, alpha = 0.18) => {
    const normalized = String(hex || '').replace('#', '');
    if (normalized.length !== 6) return `rgba(90,45,130,${alpha})`;
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
};

export default function MissionSupportScreen({ visible, onClose, item, onDonationSuccess }) {
    const { bgStyle, textStyle, text, card, border, mutedText, accent } = useAppTheme();
    const { isDarkMode } = useThemeContext();
    const foreground = isDarkMode ? '#F3F4F6' : '#333';
    // Selected amount follows the active profile theme: gold for business, purple for regular.
    const selectedAmountStyle = {
        borderColor: accent,
        backgroundColor: withAlpha(accent, isDarkMode ? 0.18 : 0.12),
    };
    const dispatch = useDispatch();
    const toast = useToast();
    const { t } = useLanguage();
    const stripeErrorMessages = getStripeErrorMessages(t);

    const [selectedAmount, setSelectedAmount] = useState(null);
    const [customAmount, setCustomAmount] = useState('');
    const [note, setNote] = useState('');
    const [isButtonLoading, setIsButtonLoading] = useState(false);
    const paymentCompletedRef = useRef(false);
    const finalAmount = Number(selectedAmount || customAmount);
    const isAmountValid = finalAmount > 0;

    const amounts = [5, 10, 25, 50];

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const isBrowserCancelled = (result) => result?.type === 'cancel' || result?.type === 'dismiss';
    const isOnboardingReady = (status) => status?.canReceivePayments === true && Boolean(status?.accountId);

    const GetInbordingstatus = async () => {
        try {
            const response = await getOnboardingStatus();
            if (response?.statusCode === 200) {
                return response?.data ?? null;
            }
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
            if (isOnboardingReady(latestStatus)) {
                return { alreadyOnboarded: true };
            }
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
            if (isOnboardingReady(status)) {
                return status;
            }
            await delay(2000);
        }
        return null;
    };

    useEffect(() => {
        if (!visible) return;

        const subscription = DeviceEventEmitter.addListener('PAYMENT_COMPLETED', (data) => {
            paymentCompletedRef.current = true;
            setIsButtonLoading(false);
            dispatch(hideLoader());

            if (onDonationSuccess) {
                onDonationSuccess();
            }

            setCustomAmount('');
            setSelectedAmount(null);
            setNote('');
            onClose();

            setTimeout(() => {
                global.isDonationInProgress = false;
            }, 1000);

            showToastMessage(toast, 'success', t('missionSupportScreen.donationSuccess'));
        });

        return () => {
            subscription.remove();
        };
    }, [visible]);

    const runPaymentFlow = async (createPaymentSession) => {
        global.isDonationInProgress = true;
        const onboardingStatus = await GetInbordingstatus();

        if (isOnboardingReady(onboardingStatus)) {
            const response = await createPaymentSession();
            const url = getPaymentSessionUrl(response);
            if (!url) {
                showToastMessage(toast, 'danger', response?.message || response?.data?.message || stripeErrorMessages.RECIPIENT_NOT_READY);
                return;
            }
            if (await InAppBrowser.isAvailable()) {
                await InAppBrowser.open(url, { ...STRIPE_BROWSER_OPTIONS, forceCloseOnRedirection: true });
            } else {
                await Linking.openURL(url);
                setCustomAmount('');
                setSelectedAmount(null);
                setNote('');
                setIsButtonLoading(false);
                onClose();
                dispatch(hideLoader());
            }
            return;
        }

        const onboardingResult = await GetInbordingLink();
        if (onboardingResult?.alreadyOnboarded) {
            const response = await createPaymentSession();
            const url = getPaymentSessionUrl(response);
            if (!url) {
                showToastMessage(toast, 'danger', response?.message || response?.data?.message || stripeErrorMessages.RECIPIENT_NOT_READY);
                return;
            }
            if (await InAppBrowser.isAvailable()) {
                await InAppBrowser.open(url, { ...STRIPE_BROWSER_OPTIONS, forceCloseOnRedirection: true });
            } else {
                await Linking.openURL(url);
                setCustomAmount('');
                setSelectedAmount(null);
                setNote('');
                setIsButtonLoading(false);
                onClose();
                dispatch(hideLoader());
            }
            return;
        }

        if (isBrowserCancelled(onboardingResult)) {
            return;
        }

        const updatedStatus = await waitForOnboardingCompletion();
        if (isOnboardingReady(updatedStatus)) {
            const response = await createPaymentSession();
            const url = getPaymentSessionUrl(response);
            if (!url) {
                showToastMessage(toast, 'danger', response?.message || response?.data?.message || stripeErrorMessages.RECIPIENT_NOT_READY);
                return;
            }
            if (await InAppBrowser.isAvailable()) {
                await InAppBrowser.open(url, { ...STRIPE_BROWSER_OPTIONS, forceCloseOnRedirection: true });
            } else {
                await Linking.openURL(url);
                setCustomAmount('');
                setSelectedAmount(null);
                setNote('');
                setIsButtonLoading(false);
                onClose();
                dispatch(hideLoader());
            }
            return;
        }

        showToastMessage(toast, 'warning', t('missionSupportScreen.onboardingIncomplete'));
    };

    const handleConfirm = async () => {
        setIsButtonLoading(true);

        if (item?.profile === 'user') {
            await handleMissionDonation();
        } else {
            const finalAmount = selectedAmount || customAmount;
            try {
                dispatch(showLoader());
                const requestBody = {
                    type: 'donation',
                    amount: Number(finalAmount),
                    vendorId: item.UserId,
                    postId: item.id,
                    note: note,
                };

                setTimeout(async () => {
                    try {
                        await runPaymentFlow(() => purchaseTokenWithUSD(requestBody));
                    } catch (err) {
                        await InAppBrowser.close();
                        setIsButtonLoading(false);
                        dispatch(hideLoader());
                        showToastMessage(toast, 'danger', err?.message || stripeErrorMessages.SESSION_FAILED);
                    }
                }, 1000);
            } catch (error) {
                showToastMessage(toast, 'danger', error?.response?.data?.message || stripeErrorMessages.NETWORK_ERROR);
                await InAppBrowser.close();
                setIsButtonLoading(false);
                dispatch(hideLoader());
            }
        }
    };

    const handleMissionDonation = async () => {
        const finalAmount = selectedAmount || customAmount;

        try {
            dispatch(showLoader());
            const requestBody = {
                type: 'missionDonation',
                amount: Number(finalAmount),
                vendorId: item.UserId,
                postId: item.id,
                note: note,
            };

            try {
                await runPaymentFlow(() => addMissionDonation(requestBody));
            } catch (err) {
                showToastMessage(toast, 'danger', err?.message || stripeErrorMessages.RECIPIENT_NOT_READY);
                setIsButtonLoading(false);
                dispatch(hideLoader());
            }
        } catch (error) {
            showToastMessage(toast, 'danger', error?.response?.data?.message || stripeErrorMessages.NETWORK_ERROR);
            setIsButtonLoading(false);
            dispatch(hideLoader());
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.overlay}>
                    <View style={[styles.modalBox, { backgroundColor: card }]}>
                        <ScrollView contentContainerStyle={[styles.container, bgStyle]}>

                            <Text style={[styles.title, textStyle]}>
                                {t('missionSupportScreen.title')}
                            </Text>

                            <Text style={[styles.heading, { color: foreground }]}>
                                {t('missionSupportScreen.heading')}
                            </Text>

                            <Text style={[styles.description, { color: mutedText }]}>
                                {t('missionSupportScreen.description')}
                            </Text>

                            <Text style={[styles.label, { color: foreground }]}>
                                {t('missionSupportScreen.noteLabel')}
                            </Text>
                            <TextInput
                                style={[styles.noteInput, { borderColor: border, color: foreground }]}
                                placeholder={t('missionSupportScreen.notePlaceholder')}
                                placeholderTextColor={mutedText}
                                multiline
                                value={note}
                                onChangeText={setNote}
                            />

                            <Text style={[styles.label, { color: foreground }]}>
                                {t('missionSupportScreen.amountLabel')}
                            </Text>

                            <View style={styles.amountContainer}>
                                {amounts.map((amt) => (
                                    <TouchableOpacity
                                        key={amt}
                                        style={[
                                            styles.amountBox,
                                            { borderColor: border },
                                            selectedAmount === amt && selectedAmountStyle,
                                        ]}
                                        onPress={() => {
                                            setSelectedAmount(amt);
                                            setCustomAmount('');
                                        }}
                                    >
                                        <Text style={[styles.amountText, { color: foreground }]}>${amt}</Text>
                                    </TouchableOpacity>
                                ))}

                                <View style={[styles.customBox, { borderColor: border }, customAmount && selectedAmountStyle]}>
                                    <TextInput
                                        keyboardType="numeric"
                                        style={[styles.customInput, { color: foreground }]}
                                        value={customAmount}
                                        onChangeText={(val) => {
                                            setCustomAmount(val);
                                            setSelectedAmount(null);
                                        }}
                                        placeholder={t('missionSupportScreen.customAmountPlaceholder')}
                                        placeholderTextColor={mutedText}
                                        cursorColor={text}
                                        selectionColor={text}
                                    />
                                </View>
                            </View>

                            <Text style={[styles.secureText, { color: mutedText, borderLeftColor: border }]}>
                                {t('missionSupportScreen.secureText')}
                            </Text>

                            <View style={styles.bottomButtons}>
                                <TouchableOpacity
                                    style={[
                                        styles.confirmBtn,
                                        { backgroundColor: accent },
                                        (isButtonLoading || !isAmountValid) && styles.confirmBtnDisabled,
                                    ]}
                                    onPress={handleConfirm}
                                    disabled={isButtonLoading || !isAmountValid}
                                >
                                    {isButtonLoading ? (
                                        <View style={styles.loadingContainer}>
                                            <ActivityIndicator size="small" color="#fff" />
                                            <Text style={[styles.confirmText, { marginLeft: 8 }]}>
                                                {t('missionSupportScreen.processingButton')}
                                            </Text>
                                        </View>
                                    ) : (
                                        <Text style={styles.confirmText}>
                                            {t('missionSupportScreen.confirmButton')}
                                        </Text>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.cancelBtn, { borderColor: border }]}
                                    onPress={() => {
                                        setIsButtonLoading(false);
                                        dispatch(hideLoader());
                                        onClose();
                                    }}
                                >
                                    <Text style={[styles.cancelText, { color: foreground }]}>
                                        {t('missionSupportScreen.cancelButton')}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                        </ScrollView>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
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
    amountText: {
        fontSize: 16,
        fontWeight: '600',
    },
    customBox: {
        borderWidth: 1,
        borderColor: '#666',
        borderRadius: 8,
        paddingHorizontal: 12,
        marginBottom: 10,
        width: '48%',
        height: 44,
        justifyContent: 'center',
    },
    customInput: {
        flex: 1,
        height: '100%',
        fontSize: 16,
        color: '#000',
        paddingHorizontal: 8,
        paddingVertical: 0,
        textAlignVertical: 'center',
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
