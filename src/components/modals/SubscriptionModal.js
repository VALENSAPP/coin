import React, { useRef, useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
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
import { getFansubscriptionStatus } from '../../services/stirpe';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { useAppTheme } from '../../theme/useApptheme';
import {
    getPaymentSessionUrl,
    STRIPE_BROWSER_OPTIONS,
    getStripeErrorMessages,
    createOnboardingLink,
    getOnboardingStatus,
} from '../../utils/stripeOnboarding';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../../i18n';
import { useThemeContext } from '../../theme/ThemeContext';

const normalizeThemeProfile = profile => {
    const value = String(profile || '').toLowerCase().trim();
    if (value === 'company' || value === 'business') return 'company';
    if (value === 'user' || value === 'normal') return 'user';
    return undefined;
};

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
    const [subscriptionAmount, setSubscriptionAmount] = useState();
    const [userProfile, setUserProfile] = useState('');
    const [comment, setComment] = useState('');

    const toast = useToast();
    const dispatch = useDispatch();
    const navigation = useNavigation();
    // Theme follows the *viewed* profile (simple → purple, business → gold), not the logged-in viewer.
    const profileOverride =
        normalizeThemeProfile(userData?.profile) ||
        normalizeThemeProfile(userProfile);
    const {
        textStyle,
        text,
        accent,
        card,
        border,
        mutedText,
    } = useAppTheme(profileOverride);
    const { isDarkMode } = useThemeContext();
    const { t } = useLanguage();
    const stripeErrorMessages = getStripeErrorMessages(t);

    const isCompanyProfile =
        profileOverride === 'company' || userProfile === 'company';
    const sheetStyle = [styles.sheetContainer, { backgroundColor: card }];
    const primaryBtnStyle = [styles.btn, { backgroundColor: accent }];
    const cancelBtnStyle = [
        styles.btn,
        styles.cancelBtn,
        {
            backgroundColor: isDarkMode ? card : '#fff',
            borderColor: border,
        },
    ];
    const cancelTextColor = { color: text };

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const isBrowserCancelled = (result) => result?.type === 'cancel' || result?.type === 'dismiss';
    const isOnboardingReady = (status) => status?.canReceivePayments === true && Boolean(status?.accountId);

    const GetInbordingstatus = async () => {
        try {
            const response = await getOnboardingStatus();
            if (response?.statusCode === 200) return response?.data ?? null;
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
            if (isOnboardingReady(latestStatus)) return { alreadyOnboarded: true };
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
            if (isOnboardingReady(status)) return status;
            await delay(2000);
        }
        return null;
    };

    const closeAllModals = () => {
        step1Ref.current?.close();
        step2Ref.current?.close();
        setAcceptedTerms(false);
        onClose?.();
    };

    useEffect(() => {
        if (visible) {
            setAcceptedTerms(false);
            setTimeout(() => { step1Ref.current?.open(); }, 300);
            fetchAllData();
            fetchSubscriptionByUserId();
            fetchSubscriptionAmount();
        } else {
            closeAllModals();
        }
    }, [visible]);

    const handleConfirm = () => {
        const amount = Number(subscriptionAmount);
        if (!subscriptionAmount || Number.isNaN(amount) || amount <= 0) {
            showToastMessage(toast, 'warning', t('subscribeFlow.subscriptionAmountNotSet'));
            return;
        }
        step1Ref.current?.close();
        setTimeout(() => { step2Ref.current?.open(); }, 350);
    };

    const getSubscription = async () => {
        const amount = Number(subscriptionAmount);

        if (!amount || Number.isNaN(amount)) {
            showToastMessage(toast, 'danger', t('subscribeFlow.amountUnavailable'));
            return;
        }

        dispatch(showLoader());

        try {
            const payload = { amount, contentUserId: targetUserId };

            const onboardingStatus = await GetInbordingstatus();

            const isActiveStatus = (value) => {
                if (value === true) return true;
                return String(value || '').toUpperCase() === 'ACTIVE';
            };

            const verifyFanSubscriptionActive = async () => {
                try {
                    const statusResponse = await getFansubscriptionStatus(targetUserId);
                    const data = statusResponse?.data;
                    if (
                        isActiveStatus(statusResponse?.status) ||
                        isActiveStatus(data?.status) ||
                        isActiveStatus(data?.subscriptionStatus) ||
                        isActiveStatus(data?.subscription?.status) ||
                        isActiveStatus(data?.fanSubscription?.status)
                    ) {
                        return true;
                    }
                    if (typeof data?.isSubscribed === 'boolean') return data.isSubscribed;
                    if (Array.isArray(data?.subscriptions)) {
                        return data.subscriptions.some((sub) => isActiveStatus(sub?.status));
                    }
                    if (Array.isArray(data)) {
                        return data.some((sub) => isActiveStatus(sub?.status));
                    }
                } catch (_e) {
                    // ignore
                }
                return false;
            };

            const waitForSubscriptionActivation = async () => {
                for (let attempt = 0; attempt < 10; attempt += 1) {
                    const active = await verifyFanSubscriptionActive();
                    if (active) return true;
                    await delay(2000);
                }
                return false;
            };

            const openPayment = async () => {
                const response = await FanPageSubscription(payload);
                const url = getPaymentSessionUrl(response);
                if (!url) {
                    showToastMessage(
                        toast,
                        'danger',
                        response?.message ||
                        response?.data?.message ||
                        stripeErrorMessages.RECIPIENT_NOT_READY
                    );
                    return false;
                }
                if (await InAppBrowser.isAvailable()) {
                    await InAppBrowser.open(url, { ...STRIPE_BROWSER_OPTIONS, forceCloseOnRedirection: true });
                } else {
                    await Linking.openURL(url);
                }

                // After returning from payment, wait a bit for backend/Stripe webhooks to sync.
                const active = await waitForSubscriptionActivation();
                if (active) {
                    onPaymentDone?.({ contentUserId: targetUserId, status: 'ACTIVE' });
                }
                return active;
            };

            if (isOnboardingReady(onboardingStatus)) {
                if (await openPayment()) closeAllModals();
                return;
            }

            const onboardingResult = await GetInbordingLink();

            if (onboardingResult?.alreadyOnboarded) {
                if (await openPayment()) closeAllModals();
                return;
            }

            if (isBrowserCancelled(onboardingResult)) return;

            const updatedStatus = await waitForOnboardingCompletion();
            if (isOnboardingReady(updatedStatus)) {
                if (await openPayment()) closeAllModals();
                return;
            }

            showToastMessage(toast, 'warning', t('subscribeFlow.onboardingIncomplete'));
        } catch (error) {
            showToastMessage(
                toast,
                'danger',
                error?.response?.data?.message || stripeErrorMessages.NETWORK_ERROR
            );
        } finally {
            dispatch(hideLoader());
        }
    };

    const fetchSubscriptionByUserId = async () => {
        try {
            dispatch(showLoader());
            const response = await getSubscriptionByUserID(targetUserId);
            if (response?.statusCode === 200) {
                const subscriptions = response?.data?.subscriptions;
                if (subscriptions?.length > 0) {
                    setSubscriptionAmount(subscriptions[0].subscriptionAmount ||'');
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
        const url = 'https://valens.app/terms';
        const supported = await Linking.canOpenURL(url);
        if (supported) await Linking.openURL(url);
    };

    const DragonflyIcon = getDragonflyIcon(dashboard?.totalFollowers, isCompanyProfile, isDarkMode);

    return (
        <>
            {/* STEP 1 */}
            <RBSheet
                ref={step1Ref}
                height={420}
                closeOnPressMask={false}
                customStyles={{ container: sheetStyle }}
            >
                <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                        <Text style={[styles.header, textStyle]}>{displayName} </Text>
                        <DragonflyIcon width={22} height={22} />
                    </View>

                    <Text style={[styles.subHeader, { color: text }]}>
                        {t('subscribeFlow.step1Subtitle')}
                    </Text>

                    <Text style={[styles.bodyText, { color: mutedText }]}>
                        {t('subscribeFlow.step1Body')}
                    </Text>

                    <Text style={[styles.confirmText, textStyle]}>
                        {t('subscribeFlow.confirmQuestion')}
                    </Text>

                    <TouchableOpacity
                        style={primaryBtnStyle}
                        onPress={handleConfirm}
                    >
                        <Text style={styles.confirmTextBtn}>{t('subscribeFlow.yesButton')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={cancelBtnStyle}
                        onPress={closeAllModals}
                    >
                        <Text style={[styles.cancelTextBtn, cancelTextColor]}>
                            {t('subscribeFlow.notNow')}
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </RBSheet>

            {/* STEP 2 */}
            <RBSheet
                ref={step2Ref}
                height={370}
                closeOnPressMask={false}
                customStyles={{ container: sheetStyle }}
            >
                <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                    <View style={[
                        styles.priceBox,
                        {
                            backgroundColor: isDarkMode ? '#242424' : '#fff',
                            borderColor: border,
                        },
                    ]}>
                        <Text style={[styles.priceLabel, { color: mutedText }]}>
                            {t('subscribeFlow.membershipLabel')}
                        </Text>
                        <Text style={[styles.priceValue, textStyle]}>
                            ${subscriptionAmount} {t('subscribeFlow.perMonth')}
                        </Text>
                    </View>

                    {comment ? (
                        <Text style={[styles.comment, { color: mutedText }]}>
                            {t('subscribeFlow.commentLabel')}{' '}
                            <Text style={[styles.comments, { color: text }]}>{comment}</Text>
                        </Text>
                    ) : null}

                    <TouchableOpacity
                        style={styles.checkboxRow}
                        onPress={() => setAcceptedTerms(!acceptedTerms)}
                    >
                        <Ionicons
                            name={acceptedTerms ? 'checkbox-outline' : 'square-outline'}
                            size={22}
                            color={acceptedTerms ? accent : mutedText}
                            style={styles.checkboxIcon}
                        />
                        <Text style={[styles.checkboxText, { color: mutedText }]}>
                            {t('subscribeFlow.termsPrefix')}{' '}
                            <Text style={[styles.linkText, { color: accent }]} onPress={openTerms}>
                                {t('subscribeFlow.termsLink')}
                            </Text>{' '}
                            {t('subscribeFlow.termsSuffix')}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.btn,
                            { backgroundColor: accent, opacity: acceptedTerms ? 1 : 0.4 },
                        ]}
                        onPress={getSubscription}
                        disabled={!acceptedTerms}
                    >
                        <Text style={styles.doneText}>
                            {t('subscribeFlow.completePaymentButton')}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={cancelBtnStyle}
                        onPress={closeAllModals}
                    >
                        <Text style={[styles.cancelTextBtn, cancelTextColor]}>
                            {t('subscribeFlow.notNow')}
                        </Text>
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
        padding: 8
    },
    subHeader: {
        fontSize: 17,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 12,
    },
    bodyText: {
        textAlign: 'center',
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
    },
    cancelTextBtn: {
        fontSize: 16,
        fontWeight: '600',
    },
    paymentNote: {
        fontSize: 13,
        marginBottom: 15,
        textAlign: 'center',
    },
    input: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 10,
        fontSize: 15,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    priceBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 14,
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
    },
    priceLabel: { fontSize: 15 },
    priceValue: { fontSize: 16, fontWeight: '700' },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 12,
        marginBottom: 18,
    },
    termsText: {
        marginLeft: 8,
        fontSize: 14,
    },
    doneText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    termsContent: {
        fontSize: 13,
        lineHeight: 20,
        textAlign: 'left',
    },
    termsContainer: {
        marginVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        padding: 10,
    },
    checkboxIcon: {
        marginTop: 3,
        marginRight: 10,
    },
    checkboxText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
    },
    linkText: {
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    comment: {
        fontSize: 14,
        marginTop: 10,
        fontWeight: '600',
    },
    comments: {
        fontWeight: '400',
        fontSize: 14,
    },
});
