import React, { useRef, useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    ScrollView,
    Linking,
} from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { showToastMessage } from '../displaytoastmessage';
import { getUserCredentials } from '../../services/post';
import { useDispatch } from 'react-redux';
import { useToast } from 'react-native-toast-notifications';
import { getDragonflyIcon } from '../profile/ProfilePersonalData';
import { getSubscriptionByUserID, getUserSubscription } from '../../services/wallet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FanPageSubscription } from '../../services/stirpe';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { useAppTheme } from '../../theme/useApptheme';
import {
    getPaymentSessionUrl,
    STRIPE_BROWSER_OPTIONS,
    STRIPE_ERROR_MESSAGES,
    createOnboardingLink,
    getOnboardingStatus,
} from '../../utils/stripeOnboarding';
import { useNavigation } from '@react-navigation/native';

const SubscribeFlowModal = ({
    visible,
    onClose,
    membershipPrice = 19.99,
    onPaymentDone,
    displayName,
    userData,
    dashboard,
    targetUserId,
}) => {
    
    const step1Ref = useRef(null);
    const step2Ref = useRef(null);

    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [subscriptionAmount, setSubscriptionAmount] = useState(null);
    const [userProfile, setUserProfile] = useState('');
    const [comment, setComment] = useState('');

    const toast = useToast();
    const dispatch = useDispatch();
    const navigation = useNavigation();
    const { bgStyle, textStyle, text } = useAppTheme();

    const isCompanyProfile = userProfile === 'company';

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

    /* =========================
       PROPER MODAL RESET
    ========================== */
    const closeAllModals = () => {
        step1Ref.current?.close();
        step2Ref.current?.close();
        setAcceptedTerms(false);
        onClose?.();
    };

    /* =========================
       HANDLE VISIBLE CHANGE
    ========================== */
    useEffect(() => {
        if (visible) {
            setAcceptedTerms(false);

            setTimeout(() => {
                step1Ref.current?.open();
            }, 300);

            fetchAllData();
            fetchSubscriptionByUserId();
            fetchSubscriptionAmount();
        } else {
            closeAllModals();
        }
    }, [visible]);

    /* =========================
       STEP FLOW
    ========================== */
    const handleConfirm = () => {
        step1Ref.current?.close();

        setTimeout(() => {
            step2Ref.current?.open();
        }, 350);
    };

    /* =========================
       STRIPE SUBSCRIPTION FLOW
    ========================== */
    const getSubscription = async () => {
        const amount = Number(subscriptionAmount);

        if (!amount || Number.isNaN(amount)) {
            showToastMessage(toast, 'danger', 'Subscription amount is not available. Please try again.');
            return;
        }

        dispatch(showLoader());

        try {
            const payload = {
                amount,
                contentUserId: targetUserId,
                // fanUserId: userId,
            };

            const onboardingStatus = await GetInbordingstatus();
            console.log(onboardingStatus,'data in fanpage')
            if (isOnboardingReady(onboardingStatus)) {
                const response = await FanPageSubscription(payload);
                const url = getPaymentSessionUrl(response);
                if (!url) {
                    showToastMessage(
                        toast,
                        'danger',
                        response?.message ||
                        response?.data?.message ||
                        STRIPE_ERROR_MESSAGES.RECIPIENT_NOT_READY
                    );
                    return;
                }
                if (await InAppBrowser.isAvailable()) {
                    await InAppBrowser.open(url, {
                        ...STRIPE_BROWSER_OPTIONS,
                        forceCloseOnRedirection: true,
                    });
                } else {
                    await Linking.openURL(url);
                }
                closeAllModals();
                return;
            }

            const onboardingResult = await GetInbordingLink();
            if (onboardingResult?.alreadyOnboarded) {
                const response = await FanPageSubscription(payload);
                const url = getPaymentSessionUrl(response);
                if (!url) {
                    showToastMessage(
                        toast,
                        'danger',
                        response?.message ||
                        response?.data?.message ||
                        STRIPE_ERROR_MESSAGES.RECIPIENT_NOT_READY
                    );
                    return;
                }
                if (await InAppBrowser.isAvailable()) {
                    await InAppBrowser.open(url, {
                        ...STRIPE_BROWSER_OPTIONS,
                        forceCloseOnRedirection: true,
                    });
                } else {
                    await Linking.openURL(url);
                }
                closeAllModals();
                return;
            }

            if (isBrowserCancelled(onboardingResult)) {
                return;
            }

            const updatedStatus = await waitForOnboardingCompletion();
            if (isOnboardingReady(updatedStatus)) {
                const response = await FanPageSubscription(payload);
                const url = getPaymentSessionUrl(response);
                if (!url) {
                    showToastMessage(
                        toast,
                        'danger',
                        response?.message ||
                        response?.data?.message ||
                        STRIPE_ERROR_MESSAGES.RECIPIENT_NOT_READY
                    );
                    return;
                }
                if (await InAppBrowser.isAvailable()) {
                    await InAppBrowser.open(url, {
                        ...STRIPE_BROWSER_OPTIONS,
                        forceCloseOnRedirection: true,
                    });
                } else {
                    await Linking.openURL(url);
                }
                closeAllModals();
                return;
            }

            showToastMessage(toast, 'warning', 'Stripe onboarding is not complete yet.');
        } catch (error) {
            showToastMessage(
                toast,
                'danger',
                error?.response?.data?.message ||
                STRIPE_ERROR_MESSAGES.NETWORK_ERROR
            );
        } finally {
            dispatch(hideLoader());
        }
    };

    /* =========================
       EXISTING API FUNCTIONS
    ========================== */
    const fetchSubscriptionByUserId = async () => {
        try {
            dispatch(showLoader());
            const response = await getSubscriptionByUserID(targetUserId);

            if (response?.statusCode === 200) {
                const subscriptions = response?.data?.subscriptions;

                if (subscriptions?.length > 0) {
                    setSubscriptionAmount(subscriptions[0].subscriptionAmount);
                    setComment(subscriptions[0].comment);
                }
            }
        } finally {
            dispatch(hideLoader());
        }
    };

    const fetchAllData = async () => {
        try {
            dispatch(showLoader());
            const profileResponse = await getUserCredentials(userData?.id);

            if (profileResponse?.statusCode === 200) {
                const user = profileResponse?.data?.user || profileResponse?.data;
                setUserProfile(user?.profile || '');
            }
        } finally {
            dispatch(hideLoader());
        }
    };

    const fetchSubscriptionAmount = async () => {
        try {
            dispatch(showLoader());
            const id = await AsyncStorage.getItem('userId');
            await getUserSubscription(id);
        } finally {
            dispatch(hideLoader());
        }
    };

    const openTerms = async () => {
        const url = 'https://www.valenstechnologies.app/subscriberterms';
        const supported = await Linking.canOpenURL(url);
        if (supported) await Linking.openURL(url);
    };

    const DragonflyIcon = getDragonflyIcon(
        dashboard?.totalFollowers,
        isCompanyProfile
    );

    return (
        <>
            {/* STEP 1 */}
            <RBSheet
                ref={step1Ref}
                height={400}
                closeOnPressMask={false}
                customStyles={{ container: [styles.sheetContainer, bgStyle] }}
            >
                <View style={styles.container}>
                    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                        <Text style={[styles.header, textStyle]}>{displayName} </Text>
                        <DragonflyIcon width={22} height={22} />
                    </View>

                    <Text style={[styles.subHeader, { color: text }]}>
                        You’re about to Subscribe!
                    </Text>

                    <Text style={styles.bodyText}>
                        Unlock exclusive posts, private drops, and direct access to this
                        creator’s Valens world.{'\n\n'}
                        Your support turns into real-time rewards — every subscription fuels
                        their journey and yours.
                    </Text>

                    <Text style={[styles.confirmText, textStyle]}>
                        Confirm Subscription?
                    </Text>

                    <TouchableOpacity
                        style={[styles.btn, { backgroundColor: text }]}
                        onPress={handleConfirm}
                    >
                        <Text style={styles.confirmTextBtn}>Yes, I’m In</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.btn, styles.cancelBtn]}
                        onPress={closeAllModals}
                    >
                        <Text style={[styles.cancelTextBtn, textStyle]}>
                            Not Now
                        </Text>
                    </TouchableOpacity>
                </View>
            </RBSheet>

            {/* STEP 2 */}
            <RBSheet
                ref={step2Ref}
                height={370}
                closeOnPressMask={false}
                customStyles={{ container: styles.sheetContainer }}
            >
                <ScrollView style={styles.container}
                 showsVerticalScrollIndicator={false}>

                    <View style={styles.priceBox}>
                        <Text style={styles.priceLabel}>Membership</Text>
                        <Text style={[styles.priceValue, textStyle]}>
                            ${subscriptionAmount} / month
                        </Text>
                    </View>

                    {comment ? (
                        <Text style={styles.comment}>
                            Comment: <Text style={styles.comments}>{comment}</Text>
                        </Text>
                    ) : null}

                    <TouchableOpacity
                        style={styles.checkboxRow}
                        onPress={() => setAcceptedTerms(!acceptedTerms)}
                    >
                        <Ionicons
                            name={acceptedTerms ? 'checkbox-outline' : 'square-outline'}
                            size={22}
                            color={acceptedTerms ? '#000' : '#aaa'}
                            style={styles.checkboxIcon}
                        />
                        <Text style={styles.checkboxText}>
                            I agree to the{' '}
                            <Text style={styles.linkText} onPress={openTerms}>
                                Valens Subscriber Terms
                            </Text>{' '}
                            and understand that subscriptions provide access to digital content only
                            and are not investments or financial products.
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.btn,
                            { opacity: acceptedTerms ? 1 : 0.4, backgroundColor: text },
                        ]}
                        onPress={getSubscription}
                    >
                        <Text style={styles.doneText}>
                            ✅ Done — Complete Payment
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.btn, styles.cancelBtn]}
                        onPress={closeAllModals}
                    >
                        <Text style={styles.cancelTextBtn}>Not Now</Text>
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
        padding: 20,
    },
    container: {
        flex: 1,
    },
    header: {
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 6,
    },
    subHeader: {
        fontSize: 17,
        fontWeight: '600',
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
        marginBottom: 14,
    },
    btn: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 10,
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
    priceValue: { fontSize: 16, fontWeight: '700' },
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
    doneText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    termsContent: {
        color: '#444',
        fontSize: 13,
        lineHeight: 20,
        textAlign: 'left',
    },
    termsContainer: {
        marginVertical: 10,
        backgroundColor: '#fff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 10,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 12,
    },

    checkboxIcon: {
        marginTop: 3,
        marginRight: 10,
    },

    checkboxText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
        color: '#000',
    },

    linkText: {
        color: '#5a2d82',
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    comment: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 10,
        fontWeight: 600
    },
    comments: {
        fontWeight: 100,
        fontSize: 14,
        color: '#000'
    }
});
