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

const SubscribeFlowModal = ({
    visible,
    onClose,
    membershipPrice = 19.99,
    onPaymentDone,
    displayName,
    userData,
    dashboard
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
    const [userProfile, setUserProfile] = useState('');
    const toast = useToast();
    const dispatch = useDispatch();
    const isCompanyProfile = userProfile === 'company';
    const [subscriptionAmount, setSubscriptionAmount] = useState(null);

    useEffect(() => {
        fetchAllData();
        fetchSubscriptionByUserId();
        GetSubscription();
        fetchSubscriptionAmount();
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

    const fetchSubscriptionByUserId = async () => {
        try {
            const id = await AsyncStorage.getItem('userId');
            dispatch(showLoader());
            const response = await getSubscriptionByUserID(id);
            console.log('getSubscriptionByUserID response:', response);

            if (response?.statusCode === 200) {
                const subscriptions = response?.data?.subscriptions;
                if (subscriptions && subscriptions.length > 0) {
                    const amount = subscriptions[0].subscriptionAmount;
                    console.log("FIRST SUBSCRIPTION AMOUNT:", amount);
                    setSubscriptionAmount(amount);
                } else {
                    console.log("No subscriptions found");
                    setSubscriptionAmount(null);
                }
            } else {
                showToastMessage(toast, 'danger', response.data.message);
            }

        } catch (error) {
            console.error('Error saving subscription:', error);
            // showToastMessage(toast, 'danger', 'Something went wrong! Please try again');
        }
        finally {
            dispatch(hideLoader());
        }
    };


    const GetSubscription = async () => {
        dispatch(showLoader());

        try {
            const response = await FanPageSubscription();

            console.log("Subscription Response:", response);

            if (response?.status === 200 && response?.data?.url) {
                const url = response.data.url;

                // Check if InAppBrowser is available
                if (await InAppBrowser.isAvailable()) {
                    await InAppBrowser.open(url, {
                        dismissButtonStyle: 'close',
                        preferredBarTintColor: '#ffffff',
                        preferredControlTintColor: '#000000',
                        readerMode: false,
                        animated: true,
                        modalPresentationStyle: 'fullScreen',
                        modalTransitionStyle: 'coverVertical',
                        enableBarCollapsing: false,
                        showTitle: true,
                        toolbarColor: '#ffffff',
                        secondaryToolbarColor: '#f0f0f0',
                    });

                    // Callback if you have one
                    if (onPurchaseComplete) {
                        onPurchaseComplete();
                    }
                } else {
                    // If InAppBrowser is not available, fallback to Linking
                    await Linking.openURL(url);
                }

            } else {
                // showToastMessage(
                //     toast,
                //     'danger',
                //     response?.message || 'Failed to open subscription. Please try again.'
                // );
            }
        } catch (error) {
            console.log("Subscription Error:", error);
            showToastMessage(
                toast,
                'danger',
                'Network error. Please check your internet connection and try again.'
            );
        } finally {
            dispatch(hideLoader());
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

    const fetchAllData = async () => {
        try {
            dispatch(showLoader());

            // Run both API calls in parallel
            const [profileResponse] = await Promise.all([
                getUserCredentials(userData.id)
            ]);

            // Handle profile response
            if (profileResponse?.statusCode === 200) {
                let userDataToSet;
                if (profileResponse.data && profileResponse.data.user) {
                    userDataToSet = profileResponse.data.user;
                } else if (profileResponse.data) {
                    userDataToSet = profileResponse.data;
                } else {
                    userDataToSet = profileResponse;
                }
                setUserProfile(userDataToSet.profile || '');
                // console.log('User profile:', userDataToSet.profile);
            } else {
                // showToastMessage(toast, 'danger', profileResponse.data.message);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            dispatch(hideLoader());
        }
    };

    const fetchSubscriptionAmount = async () => {
        try {
            dispatch(showLoader());
            const id = await AsyncStorage.getItem('userId');
            // Run both API calls in parallel
            const response = await getUserSubscription(id);
            console.log('getUserSubscription:-----------------', response);

            // Handle profile response
            if (response?.statusCode === 200) {
            } else {
                // showToastMessage(toast, 'danger', response.data);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            dispatch(hideLoader());
        }
    };

    const DragonflyIcon = getDragonflyIcon(dashboard?.totalFollowers, isCompanyProfile);

    return (
        <>
            {/* Step 1: Confirmation */}
            <RBSheet
                ref={step1Ref}
                height={380}
                closeOnPressMask={false}
                onClose={handleStep1Close}
                customStyles={{
                    container: styles.sheetContainer,
                }}>
                <View style={styles.container}>
                    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                        <Text style={styles.header}>{displayName} </Text>
                        <DragonflyIcon width={22} height={22} />
                    </View>
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
                height={380}
                closeOnPressMask={false}
                customStyles={{
                    container: styles.sheetContainer,
                }}>
                <ScrollView
                    style={styles.container}
                    showsVerticalScrollIndicator={false}
                    scrollEnabled={true}
                    nestedScrollEnabled={true}
                >
                    <View style={styles.priceBox}>
                        <Text style={styles.priceLabel}>Membership</Text>
                        <Text style={styles.priceValue}>
                            ${subscriptionAmount} / month
                        </Text>
                    </View>

                    <View style={styles.termsContainer}>
                        <ScrollView
                            style={{ maxHeight: 240 }}
                            showsVerticalScrollIndicator={true}
                            nestedScrollEnabled={true}
                            onScrollBeginDrag={() => {
                                // Disable parent scroll when user starts scrolling terms
                            }}
                            onScrollEndDrag={() => {
                                // Re-enable parent scroll when done
                            }}
                        >
                            <Text style={styles.termsContent}>
                                {`VALENS SUBSCRIBER TERMS & AGREEMENT\n
For Members Purchasing a Creator's Subscription Plan\n
By subscribing to a creator on Valens ("Plan Owner"), you ("Subscriber") agree to the following terms, in addition to the Valens Terms of Use, Master Subscription Policy, Privacy Policy, and Payout/Payment Policies.\n
1. SUBSCRIPTION ACCESS\n
By purchasing a subscription, you gain access to the creator's private channel, exclusive posts, content, messages, perks, and benefits defined by the creator. Your subscription is personal and non-transferable.\n
2. MONTHLY BILLING & AUTO-RENEWAL\n
You authorize Valens Technologies Inc. to charge your selected payment method monthly, automatically renew your subscription every billing cycle, and continue charging until you cancel. Prices may range from $9.99 to $100.00 USD per month.\n
3. CANCELLATION POLICY\n
Cancel anytime via Settings → Subscriptions → Manage. You will retain access until the end of your paid period. No refunds or partial credits are issued.\n
4. NO REFUNDS\n
All subscription payments are final, including partial months, unused time, accidental purchases, early cancellations, or creator content changes.\n
5. CONTENT PROTECTION\n
You may NOT screenshot, screen record, print, download, copy, redistribute, or share paid content. After 3 unauthorized attempts, your account may be blocked for review.\n
6. SUBSCRIBER CONDUCT\n
You must not harass creators, request prohibited content, engage in fraud, or violate privacy or intellectual property rights. Violations may result in restrictions, bans, loss of access, or legal action.\n
7. RISK DISCLOSURE\n
Creators manage their own content. Valens is not responsible for frequency, type of content, or communication between creators and subscribers.\n
8. BILLING AUTHORIZATION\n
By confirming, you authorize automated monthly payments through Valens payment partners.\n
9. AGREEMENT\n
By clicking "Agree & Subscribe," you confirm you have read and accept these terms and understand this is a recurring monthly payment.\n`}
                            </Text>
                        </ScrollView>
                    </View>

                    <TouchableOpacity
                        style={styles.checkboxRow}
                        activeOpacity={0.5}
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
                        style={[styles.btn, styles.doneBtn, { opacity: acceptedTerms ? 1 : 0.4 }]}
                        onPress={GetSubscription}>
                        <Text style={styles.doneText}>✅ Done — Complete Payment</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.btn, styles.cancelBtn]}
                        onPress={onClose}>
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
});