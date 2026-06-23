import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Modal,
    StyleSheet,
    Alert,
    PermissionsAndroid,
    Platform,
    Linking
} from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { PostStory } from '../../services/stories';
import { buildStoryMetaPayload } from '../../utils/buildStoryMeta';
import {
    appendStoryAudioFiles,
    prepareStoryClipsAudioForUpload,
} from '../../utils/storyAudioUpload';
import { useToast } from 'react-native-toast-notifications';
import StoryComposer from '../../components/home/story.js/StoryComposer';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { getSubscriptionByUserID, setPrivateSubscription, setUserSubscription } from '../../services/wallet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from "react-native-vector-icons/Ionicons";
import { useBusinessProfileTheme } from '../../theme/useBusinessProfileTheme';
import { useThemeContext } from '../../theme/ThemeContext';
import TermCondition from '../../components/modals/Term&Condition';
import SubscriptionActivationPopup from '../../components/modals/SubscriptionActivationPopUp';
import ConnectStripeModal from '../../components/modals/ConnectStripeModal';
import { BusinessPlanModal, BusinessReminderModal, BusinessSuccessModal } from '../../components/modals/BusinessPlanModals';
import { useStripeOnboarding } from '../../hooks/useStripeOnboarding';
import { createOnboardingLink, getOnboardingStatus, getStripeErrorMessages } from '../../utils/stripeOnboarding';
import { createCheckoutSession } from '../../services/stirpe';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { getUserCredentials } from '../../services/post';
import { useLanguage } from '../../i18n';

const STRIPE_ONBOARDING_STATUS_KEY = 'stripeOnboardingStatus';
const SUBVENTION_TERMS_AGREED_KEY_PREFIX = 'subventionTermsAgreed';

const hasActiveSubscriptionAccess = (data) => {
    const status = String(data?.subscriptionStatus || '').toUpperCase();
    const endDateValue = data?.subscriptionEnd || data?.currentPeriodEnd;
    const endDate = endDateValue ? new Date(endDateValue) : null;
    const hasValidEndDate = endDate && !Number.isNaN(endDate.getTime());
    const hasFutureAccess = hasValidEndDate ? endDate >= new Date() : status === 'ACTIVE';

    if (status === 'ACTIVE') return hasFutureAccess;
    if (status === 'CANCELED') return hasFutureAccess;
    return false;
};

const SubventionSetupScreen = () => {
    const [price, setPrice] = useState('9');
    const [subscriptionId, setSubscriptionId] = useState(null);
    const [selectedTab, setSelectedTab] = useState('posts');
    const [showPrintWarning, setShowPrintWarning] = useState(false);
    const [printAttempts, setPrintAttempts] = useState(0);
    const [hasExistingSubscription, setHasExistingSubscription] = useState(false);
    const [isChecked, setIsChecked] = useState(false);
    const [hasAgreedTerms, setHasAgreedTerms] = useState(false);
    const navigation = useNavigation();
    const toast = useToast();
    const dispatch = useDispatch();
    const { isBusinessProfile, bgStyle, textStyle, text, cardStyle, accent, mutedText, border, card, icon } = useBusinessProfileTheme();
    const { isDarkMode } = useThemeContext();
    const [credential, setCredential] = useState(null);
    const { t } = useLanguage();
    const stripeErrorMessages = getStripeErrorMessages(t);

    const [composerVisible, setComposerVisible] = useState(false);
    const [composerList, setComposerList] = useState([]);
    const [subscriptionAmount, setSubscriptionAmount] = useState(9);
    const [showModal, setShowModal] = useState(false);
    const [showActivationPopup, setShowActivationPopup] = useState(false);
    const [showBusinessReminderPopup, setShowBusinessReminderPopup] = useState(false);
    const [showBusinessSuccessPopup, setShowBusinessSuccessPopup] = useState(false);
    const [showStripeSetupModal, setShowStripeSetupModal] = useState(false);
    const [rawAmount, setRawAmount] = useState('9');
    const [comment, setComment] = useState('');

    const { openOnboarding } = useStripeOnboarding({ fetchOnMount: true });

    const contentTabs = [
        { id: 'posts', label: t('subventionSetup.tabMint'), icon: '📝' },
        { id: 'reels', label: t('subventionSetup.tabFlips'), icon: '🎬' },
        { id: 'stories', label: t('subventionSetup.tabDrops'), icon: '⭐' },
        { id: 'videos', label: t('subventionSetup.tabVideos'), icon: '🎥' }
    ];

    useFocusEffect(
        useCallback(() => {
            const initializeScreen = async () => {
                await loadTermsAgreement();
                await fetchSubscriptionByUserId();
                await getCredential();
            };
            initializeScreen();
        }, [])
    );

    const loadTermsAgreement = async () => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            const key = `${SUBVENTION_TERMS_AGREED_KEY_PREFIX}:${userId || 'unknown'}`;
            const stored = await AsyncStorage.getItem(key);
            const agreed = stored === 'true';
            setHasAgreedTerms(agreed);
            if (agreed) setIsChecked(true);
        } catch (_e) {
            // Non-fatal: keep default false.
        }
    };

    const persistTermsAgreement = async () => {
        const userId = await AsyncStorage.getItem('userId');
        const key = `${SUBVENTION_TERMS_AGREED_KEY_PREFIX}:${userId || 'unknown'}`;
        await AsyncStorage.setItem(key, 'true');
        setHasAgreedTerms(true);
        setIsChecked(true);
    };

    const formatPrice = (value) => {
        if (!value) return "";
        const stringValue = value.toString();
        if (stringValue.includes(".")) return stringValue;
        const cleaned = stringValue.replace(/\D/g, "");
        if (!cleaned) return "";
        const formatted = cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return `${formatted},00`;
    };

    const openTerms = async () => {
        const url = 'https://valens.app/creator-terms';
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            }
        } catch (error) {
            console.error('Error opening terms link:', error);
        }
    };

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const isBrowserCancelled = (result) => result?.type === 'cancel' || result?.type === 'dismiss';
    const isOnboardingReady = (status) => status?.canReceivePayments === true && Boolean(status?.accountId);

    const getCachedOnboardingStatus = async () => {
        try {
            const raw = await AsyncStorage.getItem(STRIPE_ONBOARDING_STATUS_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            return null;
        }
    };

    const GetInbordingstatus = async () => {
        try {
            const response = await getOnboardingStatus();
            if (response?.statusCode === 200) {
                const latestStatus = response?.data ?? null;
                if (latestStatus) {
                    await AsyncStorage.setItem(STRIPE_ONBOARDING_STATUS_KEY, JSON.stringify(latestStatus));
                }
                return latestStatus;
            }
            return null;
        } catch (error) {
            console.log('GetInbordingstatus error:', error?.message);
            return null;
        }
    };

    const GetInbordingLink = async () => {
        const response = await createOnboardingLink();
        const onboardingUrl = response?.data?.onboardingUrl ?? response?.data?.data?.onboardingUrl;

        if (!onboardingUrl) {
            const latestStatus = await GetInbordingstatus();
            if (isOnboardingReady(latestStatus)) return { alreadyOnboarded: true };
            const cachedStatus = await getCachedOnboardingStatus();
            if (isOnboardingReady(cachedStatus)) return { alreadyOnboarded: true };
            throw new Error('Onboarding link not found');
        }

        if (await InAppBrowser.isAvailable()) {
            return await InAppBrowser.open(onboardingUrl, {
                dismissButtonStyle: 'close',
                preferredBarTintColor: '#000',
                preferredControlTintColor: '#fff',
                showTitle: true,
                toolbarColor: '#000',
                enableUrlBarHiding: true,
                enableDefaultShare: false,
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

    const navigateToWalletDashboard = () => {
        navigation.navigate('MainApp', {
            screen: 'wallet',
            params: { screen: 'Dashboard' }
        });
    };

    const handleActivationConfirm = async () => {
        try {
            const onboardingStatus = await GetInbordingstatus();
            if (isOnboardingReady(onboardingStatus)) {
                const paymentResult = await getUserSubscription();
                setShowActivationPopup(false);
                navigateToWalletDashboard();
                if (paymentResult?.cancelled) return;
                return;
            }

            const onboardingResult = await GetInbordingLink();
            if (onboardingResult?.alreadyOnboarded) {
                const paymentResult = await getUserSubscription();
                setShowActivationPopup(false);
                navigateToWalletDashboard();
                if (paymentResult?.cancelled) return;
                return;
            }

            if (isBrowserCancelled(onboardingResult)) {
                setShowActivationPopup(false);
                navigateToWalletDashboard();
                return;
            }

            const updatedStatus = await waitForOnboardingCompletion();
            if (isOnboardingReady(updatedStatus)) {
                const paymentResult = await getUserSubscription();
                setShowActivationPopup(false);
                navigateToWalletDashboard();
                if (paymentResult?.cancelled) return;
                return;
            }

            setShowActivationPopup(false);
            navigateToWalletDashboard();
            showToastMessage(toast, 'warning', t('subventionSetup.stripeIncomplete'));
        } catch (error) {
            console.log('Activation flow error:', error);
            showToastMessage(toast, 'danger', error?.message || stripeErrorMessages.ONBOARDING_FAILED);
        }
    };

    const closeBusinessFlow = () => {
        setShowActivationPopup(false);
        setShowBusinessReminderPopup(false);
    };

    const handleBusinessActivatedSuccess = async () => {
        await AsyncStorage.setItem('businessPlanMode', 'active');
        closeBusinessFlow();
        setShowBusinessSuccessPopup(true);
        setTimeout(() => {
            setShowBusinessSuccessPopup(false);
            navigateToWalletDashboard();
        }, 1400);
    };

    const handleBusinessActivationConfirm = async () => {
        try {
            dispatch(showLoader());

            const onboardingStatus = await GetInbordingstatus();
            if (isOnboardingReady(onboardingStatus)) {
                const paymentResult = await getUserSubscription();
                if (paymentResult?.cancelled) { closeBusinessFlow(); navigateToWalletDashboard(); return; }
                await handleBusinessActivatedSuccess();
                return;
            }

            const onboardingResult = await GetInbordingLink();
            if (onboardingResult?.alreadyOnboarded) {
                const paymentResult = await getUserSubscription();
                if (paymentResult?.cancelled) { closeBusinessFlow(); navigateToWalletDashboard(); return; }
                await handleBusinessActivatedSuccess();
                return;
            }

            if (isBrowserCancelled(onboardingResult)) {
                closeBusinessFlow();
                navigateToWalletDashboard();
                return;
            }

            const updatedStatus = await waitForOnboardingCompletion();
            if (isOnboardingReady(updatedStatus)) {
                const paymentResult = await getUserSubscription();
                if (paymentResult?.cancelled) { closeBusinessFlow(); navigateToWalletDashboard(); return; }
                await handleBusinessActivatedSuccess();
                return;
            }

            closeBusinessFlow();
            navigateToWalletDashboard();
            showToastMessage(toast, 'warning', t('subventionSetup.stripeIncomplete'));
        } catch (error) {
            console.log('Business activation flow error:', error);
            showToastMessage(toast, 'danger', error?.message || stripeErrorMessages.ONBOARDING_FAILED);
        } finally {
            dispatch(hideLoader());
        }
    };

    const handleBusinessContinueBasic = () => setShowBusinessReminderPopup(true);

    const handleBusinessContinueLimited = async () => {
        await AsyncStorage.setItem('businessPlanMode', 'basic');
        closeBusinessFlow();
        showToastMessage(toast, 'warning', t('subventionSetup.businessBasicMode'));
    };

    const getCredential = async () => {
        try {
            const id = await AsyncStorage.getItem('userId');
            if (!id) return;
            const response = await getUserCredentials(id);
            const data = response?.data ?? response;
            setCredential(data);
            const hasActiveAccess = hasActiveSubscriptionAccess(data);
            if (hasActiveAccess) {
                setShowActivationPopup(false);
                setShowBusinessReminderPopup(false);
                setHasAgreedTerms(true);
                setIsChecked(true);
            } else {
                setShowBusinessReminderPopup(false);
                setShowActivationPopup(true);
                setHasAgreedTerms(false);
                setIsChecked(false);
            }
        } catch (error) {
            console.log('Get credential error:', error?.message);
        }
    };

    const fetchSubscriptionByUserId = async () => {
        try {
            const id = await AsyncStorage.getItem('userId');
            dispatch(showLoader());
            const response = await getSubscriptionByUserID(id);
            if (response?.statusCode === 200) {
                const subscriptions = response?.data?.subscriptions;
                if (subscriptions && subscriptions.length > 0) {
                    const amount = subscriptions[0].subscriptionAmount;
                    const subId = subscriptions[0].id;
                    setComment(subscriptions[0].comment);
                    setSubscriptionAmount(amount);
                    setSubscriptionId(subId);
                    setPrice(formatPrice(amount));
                    setRawAmount(amount.toString());
                    setHasExistingSubscription(true);
                    setShowModal(false);
                    setShowActivationPopup(false);
                } else {
                    setSubscriptionAmount(null);
                    setSubscriptionId(null);
                    setHasExistingSubscription(false);
                    setShowModal(true);
                    setShowActivationPopup(false);
                }
            } else {
                showToastMessage(toast, 'danger', response.data.message);
                setHasExistingSubscription(false);
            }
        } catch (error) {
            console.error('Error fetching subscription:', error);
            setHasExistingSubscription(false);
        } finally {
            dispatch(hideLoader());
        }
    };

    const handlePriceChange = (text) => {
        const clean = text.replace(/[^0-9.]/g, "");
        setRawAmount(clean);
        setPrice(clean);
    };

    const handlePriceBlur = () => {
        if (!rawAmount) { setPrice(''); setRawAmount(''); return; }
        const hasDecimal = rawAmount.includes('.');
        const numValue = parseFloat(rawAmount);
        let finalValue = numValue;
        if (numValue < 9) finalValue = 9;
        if (numValue > 100) finalValue = 100;
        setRawAmount(finalValue.toString());
        if (hasDecimal) {
            setPrice(finalValue.toString());
        } else {
            setPrice(formatPrice(finalValue.toString()));
        }
    };

    const getUserSubscription = async () => {
        let response;
        try {
            response = await createCheckoutSession();
            const checkoutUrl = response?.data?.url;
            if (!checkoutUrl) throw new Error('Checkout URL not received');
            if (await InAppBrowser.isAvailable()) {
                const browserResult = await InAppBrowser.open(checkoutUrl, {
                    dismissButtonStyle: 'close',
                    preferredBarTintColor: '#000',
                    preferredControlTintColor: '#fff',
                    showTitle: true,
                    toolbarColor: '#000',
                    enableUrlBarHiding: true,
                    enableDefaultShare: false,
                });
                return { response, cancelled: isBrowserCancelled(browserResult) };
            } else {
                await Linking.openURL(checkoutUrl);
                return { response, cancelled: false };
            }
        } catch (error) {
            console.log('Subscription error:', error);
            if (response?.data?.url) await Linking.openURL(response.data.url);
            throw error;
        }
    };

    const formatSubscriptionDate = (dateValue) => {
        if (!dateValue) return 'N/A';
        const parsed = new Date(dateValue);
        if (Number.isNaN(parsed.getTime())) return 'N/A';
        return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
    };

    const handlePrintAttempt = () => {
        const newAttempts = printAttempts + 1;
        setPrintAttempts(newAttempts);
        if (newAttempts >= 3) {
            Alert.alert(
                t('subventionSetup.printBlockTitle'),
                t('subventionSetup.printBlockMessage'),
                [{ text: 'OK', style: 'destructive' }]
            );
        } else {
            setShowPrintWarning(true);
        }
    };

    const requestCameraPermission = async () => {
        if (Platform.OS !== 'android') return true;
        try {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.CAMERA,
                {
                    title: t('subventionSetup.cameraPermissionTitle'),
                    message: t('subventionSetup.cameraPermissionMessage'),
                    buttonNeutral: t('subventionSetup.cameraPermissionAskLater'),
                    buttonNegative: t('subventionSetup.cameraPermissionCancel'),
                    buttonPositive: 'OK',
                },
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        } catch (err) {
            console.warn(err);
            return false;
        }
    };

    const openCamera = async () => {
        const hasPermission = await requestCameraPermission();
        if (!hasPermission) {
            Alert.alert(t('subventionSetup.permissionDeniedTitle'), t('subventionSetup.permissionDeniedMessage'));
            return;
        }
        const options = { mediaType: 'mixed', includeBase64: false, maxHeight: 2000, maxWidth: 2000, includeExtra: true, presentationStyle: 'fullScreen' };
        launchCamera(options, response => {
            if (response?.didCancel) return;
            if (response?.errorCode) { Alert.alert(t('subventionSetup.cameraError'), response.errorMessage || response.errorCode); return; }
            handleMediaSelected(response);
        });
    };

    const openGallery = () => {
        const options = { mediaType: 'mixed', selectionLimit: 10, includeBase64: false, maxHeight: 2000, maxWidth: 2000 };
        launchImageLibrary(options, response => {
            if (response?.didCancel || response?.errorCode) return;
            const assets = response?.assets || [];
            if (!assets.length) return;
            const list = assets.map(a => ({
                uri: a.uri,
                type: a.type?.startsWith('video') ? 'video' : 'image',
                duration: a.duration ? a.duration * 1000 : undefined,
            }));
            setComposerList(list);
            setComposerVisible(true);
        });
    };

    const handleMediaSelected = response => {
        const asset = response?.assets?.[0];
        if (!asset || !asset.uri) { Alert.alert('Oops', t('subventionSetup.mediaReadError')); return; }
        const type = asset.type?.startsWith('video') ? 'video' : 'image';
        const list = [{ uri: asset.uri, type, duration: type === 'video' ? (asset.duration ? asset.duration * 1000 : 15000) : 5000 }];
        setComposerList(list);
        setComposerVisible(true);
    };

    const handleAddStory = () => {
        Alert.alert(t('subventionSetup.addDropsTitle'), t('subventionSetup.addDropsMessage'), [
            { text: t('subventionSetup.addDropsCamera'), onPress: () => openCamera() },
            { text: t('subventionSetup.addDropsGallery'), onPress: () => openGallery() },
            { text: t('subventionSetup.cancel'), style: 'cancel' },
        ]);
    };

    const handleComposerDone = async (processedArray) => {
        try {
            const clips = await prepareStoryClipsAudioForUpload(processedArray);
            setComposerVisible(false);
            const formData = new FormData();
            formData.append('caption', '');
            formData.append('type', 'subscription-content');
            clips.forEach((item, index) => {
                const fileUri = item.processedUri || item.original.uri;
                const fileName = `story_${Date.now()}_${index}.${item.isVideo ? 'mp4' : 'jpg'}`;
                const fileType = item.isVideo ? 'video/mp4' : 'image/jpeg';
                formData.append('media', { uri: fileUri, type: fileType, name: fileName });
            });
            formData.append('storyMeta', JSON.stringify(buildStoryMetaPayload(clips)));
            await appendStoryAudioFiles(formData, clips);
            const response = await PostStory(formData);
            if (response?.success) {
                showToastMessage(toast, 'success', t('subventionSetup.storyUploadSuccess'));
            } else {
                showToastMessage(toast, 'danger', t('subventionSetup.storyUploadFail'));
            }
        } catch (error) {
            console.error('Error uploading story:', error);
            showToastMessage(toast, 'danger', t('subventionSetup.somethingWentWrong'));
        }
    };

    const handleCreateContent = (contentType) => {
        const findNavigatorWithRoute = (nav, routeName) => {
            let current = nav;
            while (current) {
                const state = current.getState?.();
                const routeNames = state?.routeNames;
                const routes = state?.routes;
                const hasRoute =
                    (Array.isArray(routeNames) && routeNames.includes(routeName)) ||
                    (Array.isArray(routes) && routes.some(r => r?.name === routeName));
                if (hasRoute) return current;
                current = current.getParent?.();
            }
            return nav;
        };

        const navigateToCreate = (params) => {
            const navWithAdd = findNavigatorWithRoute(navigation, 'Add');
            navWithAdd?.navigate?.('Add', { screen: 'Add', params });
        };

        switch (contentType) {
            case 'posts': navigateToCreate({ postType: 'private', type: 'post' }); break;
            case 'reels': navigateToCreate({ postType: 'private', type: 'Flips' }); break;
            case 'videos': navigateToCreate({ postType: 'private', type: 'video' }); break;
            case 'stories': handleAddStory(); break;
            default: break;
        }
    };

    const PrintWarningModal = () => (
        <Modal visible={showPrintWarning} transparent={true} animationType="fade" onRequestClose={() => setShowPrintWarning(false)}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalIcon}>🚫</Text>
                    <Text style={styles.modalTitle}>{t('subventionSetup.printWarningTitle')}</Text>
                    <Text style={styles.modalText}>{t('subventionSetup.printWarningText')}</Text>
                    <View style={styles.warningBox}>
                        <Text style={styles.warningIcon}>⚠️</Text>
                        <Text style={styles.warningText}>{t('subventionSetup.printWarningSubText')}</Text>
                    </View>
                    <Text style={styles.footerText}>{t('subventionSetup.printWarningFooter')}</Text>
                    <TouchableOpacity style={styles.understandButton} onPress={() => setShowPrintWarning(false)}>
                        <Text style={styles.understandButtonText}>{t('subventionSetup.iUnderstand')}</Text>
                    </TouchableOpacity>
                    <Text style={styles.attemptCounter}>{t('subventionSetup.attempts')}: {printAttempts}/3</Text>
                </View>
            </View>
        </Modal>
    );

    const handleSaveSubscription = async () => {
        try {
            if (!hasAgreedTerms && !isChecked) {
                showToastMessage(toast, 'warning', t('subventionSetup.agreementRequired'));
                return;
            }
            const subscriptionAmount = parseFloat(rawAmount) || 0;
            dispatch(showLoader());
            let response;
            if (hasExistingSubscription && subscriptionId) {
                const dataToSend = { subscriptionAmount, status: "ACTIVE", isDelete: 0, comment: comment || '' };
                response = await setUserSubscription(dataToSend, subscriptionId);
            } else {
                const dataToSend = { subscriptionAmount, status: "ACTIVE", comment: comment || '' };
                response = await setPrivateSubscription(dataToSend);
                setShowActivationPopup(false);
            }
            if (response?.statusCode === 200) {
                setComment('');
                showToastMessage(toast, 'success', hasExistingSubscription ? t('subventionSetup.updateSuccess') : t('subventionSetup.createSuccess'));
                await persistTermsAgreement();
                await fetchSubscriptionByUserId();
            } else {
                showToastMessage(toast, 'danger', response?.data?.message || t('subventionSetup.saveFail'));
            }
        } catch (error) {
            console.error('Error saving subscription:', error);
            showToastMessage(toast, 'danger', t('subventionSetup.somethingWentWrong'));
        } finally {
            dispatch(hideLoader());
        }
    };

    const hasActiveSubscription = hasActiveSubscriptionAccess(credential);
    const subscriptionEndDate = formatSubscriptionDate(credential?.subscriptionEnd || credential?.currentPeriodEnd);
    const subscriptionStatus = credential?.subscriptionStatus || 'INACTIVE';
    const isSubscriptionActive = hasActiveSubscription;
    const shouldShowAgreedButton = hasActiveSubscription && hasAgreedTerms;
    const canSaveSubscription = shouldShowAgreedButton || isChecked;

    return (
        <>
            <View style={{ flex: 1, paddingBottom: 20 }}>
                <ScrollView style={[styles.container, bgStyle]}>
                    {/* Price Setup Section */}
                    <View style={[styles.section, cardStyle, { shadowColor: text, borderColor: border, borderWidth: StyleSheet.hairlineWidth }]}>
                        <Text style={[styles.sectionTitle, textStyle]}>{t('subventionSetup.priceSectionTitle')}</Text>
                        <Text style={[styles.sectionSubtitle, { color: mutedText }]}>{t('subventionSetup.priceSectionSubtitle')}</Text>

                        <View style={styles.priceInputContainer}>
                            <Text style={[styles.currencySymbol, { color: accent }]}>$</Text>
                            <TextInput
                                style={[styles.priceInput, textStyle, { borderBottomColor: accent }]}
                                value={price}
                                onChangeText={handlePriceChange}
                                onBlur={handlePriceBlur}
                                keyboardType="numeric"
                                numberOfLines={4}
                                multiline
                            />
                            <Text style={[styles.perMonth, { color: mutedText }]}>{t('subventionSetup.perMonth')}</Text>
                        </View>

                        <View style={styles.priceRange}>
                            <Text style={[styles.rangeText, { color: mutedText }]}>{t('subventionSetup.minPrice')}: $9</Text>
                            <Text style={[styles.rangeText, { color: mutedText }]}>{t('subventionSetup.maxPrice')}: $100</Text>
                        </View>

                        <TextInput
                            style={[styles.commentBox, cardStyle, { color: text, borderColor: border }]}
                            placeholder={t('subventionSetup.commentPlaceholder')}
                            placeholderTextColor={mutedText}
                            multiline
                            value={comment}
                            onChangeText={setComment}
                            numberOfLines={4}
                            textAlignVertical="top"
                        />

                        <View style={[styles.subscriptionInfoCard, { backgroundColor: isDarkMode ? `${accent}22` : '#f9fafb' }]}>
                            <View>
                                <Text style={[styles.subscriptionInfoLabel, { color: mutedText }]}>{t('subventionSetup.subscriptionEnds')}</Text>
                                <Text style={[styles.subscriptionInfoValue, textStyle]}>{subscriptionEndDate}</Text>
                            </View>
                            <View style={[styles.subscriptionStatusBadge, isSubscriptionActive ? styles.subscriptionStatusBadgeActive : styles.subscriptionStatusBadgeInactive]}>
                                <Text style={styles.subscriptionStatusText}>{subscriptionStatus}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Content Creation Section */}
                    <View style={[styles.section, cardStyle, { shadowColor: text, borderColor: border, borderWidth: StyleSheet.hairlineWidth }]}>
                        <Text style={[styles.sectionTitle, textStyle]}>{t('subventionSetup.contentSectionTitle')}</Text>
                        <Text style={[styles.sectionSubtitle, { color: mutedText }]}>{t('subventionSetup.contentSectionSubtitle')}</Text>

                        <View style={styles.tabContainer}>
                            {contentTabs.map(tab => (
                                <TouchableOpacity
                                    key={tab.id}
                                    style={[
                                        styles.tab,
                                        { backgroundColor: isDarkMode ? card : '#f3f4f6' },
                                        selectedTab === tab.id && { backgroundColor: isDarkMode ? `${accent}33` : '#ede9fe', borderColor: accent },
                                    ]}
                                    onPress={() => setSelectedTab(tab.id)}
                                >
                                    <Text style={styles.tabIcon}>{tab.icon}</Text>
                                    <Text style={[styles.tabLabel, { color: mutedText }, selectedTab === tab.id && { color: accent }]}>
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={[styles.contentArea, { backgroundColor: isDarkMode ? `${accent}15` : '#f9fafb' }]}>
                            <Text style={[styles.contentTitle, textStyle]}>
                                {t('subventionSetup.createLabel')} {contentTabs.find(t => t.id === selectedTab)?.label}
                            </Text>
                            <TouchableOpacity
                                style={[styles.createButton, { backgroundColor: accent }]}
                                onPress={() => handleCreateContent(selectedTab)}
                            >
                                <Text style={styles.createButtonText}>
                                    + {t('subventionSetup.newLabel')} {contentTabs.find(t => t.id === selectedTab)?.label}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Content Protection Section */}
                    <View style={[styles.section, cardStyle, { shadowColor: text, borderColor: border, borderWidth: StyleSheet.hairlineWidth }]}>
                        <Text style={[styles.sectionTitle, textStyle, { marginBottom: 12 }]}>{t('subventionSetup.protectionTitle')}</Text>
                        <View style={styles.protectionItem}>
                            <Text style={styles.protectionIcon}>🚫</Text>
                            <Text style={[styles.protectionText, textStyle]}>{t('subventionSetup.noPrints')}</Text>
                        </View>
                        <View style={styles.protectionItem}>
                            <Text style={styles.protectionIcon}>🚫</Text>
                            <Text style={[styles.protectionText, textStyle]}>{t('subventionSetup.noDownloads')}</Text>
                        </View>
                        <View style={styles.protectionItem}>
                            <Text style={styles.protectionIcon}>🚫</Text>
                            <Text style={[styles.protectionText, textStyle]}>{t('subventionSetup.noScreenshots')}</Text>
                        </View>
                        {/* <View style={styles.protectionItem}>
                            <Text style={styles.protectionIcon}>⚠️</Text>
                            <Text style={styles.protectionText}>{t('subventionSetup.autoBan')}</Text>
                        </View> */}
                    </View>

                    {/* Demo Button */}
                    <TouchableOpacity style={[styles.demoButton, cardStyle, { borderColor: border, borderWidth: StyleSheet.hairlineWidth }]} onPress={handlePrintAttempt}>
                        <Text style={[styles.demoButtonText, textStyle]}>{t('subventionSetup.demoPrintWarning')}</Text>
                    </TouchableOpacity>

                    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                        <Text style={[styles.heading, textStyle]}>{t('subventionSetup.policyHeading')}</Text>

                        <View style={{ marginTop: 15 }} />

                        {shouldShowAgreedButton ? (
                            <TouchableOpacity style={[styles.agreedBtn, styles.agreedButton, { backgroundColor: card, borderColor: border, borderWidth: StyleSheet.hairlineWidth }]} activeOpacity={1} disabled>
                                <Ionicons name="checkmark-circle" size={20} color="#16A34A" style={{ marginRight: 8 }} />
                                <Text style={[styles.saveButtonText, textStyle]}>{t('subventionSetup.agreedButton')}</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[styles.checkboxRow, cardStyle, { borderColor: border, borderWidth: StyleSheet.hairlineWidth }]}
                                activeOpacity={0.8}
                                onPress={() => setIsChecked(!isChecked)}
                            >
                                <Ionicons
                                    name={isChecked ? 'checkbox-outline' : 'square-outline'}
                                    size={24}
                                    color={icon}
                                    style={styles.checkboxIcon}
                                />
                                <Text style={[styles.checkboxText, textStyle]}>
                                    {t('subventionSetup.agreePrefix')}{' '}
                                    <Text style={[styles.linkText, { color: accent }]} onPress={openTerms}>
                                        {t('subventionSetup.creatorTermsLink')}
                                    </Text>
                                    {t('subventionSetup.agreeSuffix')}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>

                    <TouchableOpacity
                        style={[styles.saveButton, { opacity: !canSaveSubscription && 0.5, backgroundColor: accent }]}
                        onPress={handleSaveSubscription}
                        disabled={!canSaveSubscription}
                    >
                        <Text style={styles.saveButtonText}>
                            {hasExistingSubscription ? t('subventionSetup.updateButton') : t('subventionSetup.saveButton')}
                        </Text>
                    </TouchableOpacity>

                    <PrintWarningModal />
                </ScrollView>

                <StoryComposer
                    modalVisible={composerVisible}
                    mediaList={composerList}
                    onCancel={() => setComposerVisible(false)}
                    onDone={handleComposerDone}
                />

                {isBusinessProfile ? (
                    <>
                        <BusinessPlanModal
                            visible={showActivationPopup && !showBusinessReminderPopup}
                            onClose={closeBusinessFlow}
                            onActivate={handleBusinessActivationConfirm}
                            onContinue={handleBusinessContinueBasic}
                        />
                        <BusinessReminderModal
                            visible={showActivationPopup && showBusinessReminderPopup}
                            onClose={closeBusinessFlow}
                            onUpgrade={handleBusinessActivationConfirm}
                            onContinue={handleBusinessContinueLimited}
                        />
                        <BusinessSuccessModal visible={showBusinessSuccessPopup} />
                    </>
                ) : (
                    <SubscriptionActivationPopup
                        visible={showActivationPopup}
                        onClose={() => { setShowModal(false); setShowActivationPopup(false); }}
                        onConfirm={handleActivationConfirm}
                    />
                )}

                <ConnectStripeModal
                    visible={showStripeSetupModal}
                    onClose={() => setShowStripeSetupModal(false)}
                    onConnectStripe={async () => {
                        setShowStripeSetupModal(false);
                        setShowActivationPopup(false);
                        try {
                            await openOnboarding();
                        } catch (e) {
                            showToastMessage(toast, 'danger', e?.message || stripeErrorMessages.ONBOARDING_FAILED);
                        }
                    }}
                />
            </View>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        // flex: 1,
        marginBottom: 20,
    },
    section: {
        margin: 16,
        padding: 20,
        borderRadius: 12,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 14,
        marginBottom: 16,
    },
    priceInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 20,
        flexWrap: 'wrap',
    },
    currencySymbol: {
        fontSize: 32,
        fontWeight: 'bold',
        marginRight: 8,
    },
    priceInput: {
        fontSize: 48,
        fontWeight: 'bold',
        borderBottomWidth: 3,
        minWidth: 100,
        textAlign: 'center',
        padding: 8,
        maxWidth: '70%',
    },
    perMonth: {
        fontSize: 18,
        marginLeft: 8,
    },
    priceRange: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
    },
    rangeText: {
        fontSize: 14,
    },
    tabContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
    },
    tab: {
        flex: 1,
        minWidth: '45%',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    tabActive: {
        backgroundColor: '#ede9fe',
        borderColor: '#7c3aed',
    },
    tabIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    tabLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6b7280',
    },
    tabLabelActive: {
        color: '#7c3aed',
    },
    contentArea: {
        padding: 20,
        borderRadius: 8,
        alignItems: 'center',
    },
    contentTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    createButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
    },
    createButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    protectionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    protectionIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    protectionText: {
        fontSize: 16,
    },
    demoButton: {
        margin: 16,
        padding: 16,
        borderRadius: 8,
        borderWidth: 2,
        borderStyle: 'dashed',
    },
    demoButtonText: {
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '600',
    },
    agreedBtn: {
        //  marginLeft: 16,
        // marginRight: 16,
        paddingHorizontal: 18,
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: 'center',
        // marginBottom: 40,
    },
    saveButton: {
        marginLeft: 16,
        marginRight: 16,
        paddingHorizontal: 18,
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 40,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    agreedButton: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 30,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
    },
    modalIcon: {
        fontSize: 60,
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#dc2626',
        marginBottom: 16,
    },
    modalText: {
        fontSize: 16,
        color: '#374151',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 20,
    },
    warningBox: {
        backgroundColor: '#fef3c7',
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#fbbf24',
    },
    warningIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    warningText: {
        flex: 1,
        fontSize: 14,
        color: '#92400e',
        lineHeight: 20,
    },
    footerText: {
        fontSize: 16,
        color: '#6b7280',
        marginBottom: 24,
        textAlign: 'center',
    },
    understandButton: {
        backgroundColor: '#7c3aed',
        paddingVertical: 16,
        paddingHorizontal: 40,
        borderRadius: 12,
        width: '100%',
    },
    understandButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    attemptCounter: {
        marginTop: 16,
        fontSize: 14,
        color: '#dc2626',
        fontWeight: '600',
    },
    // term and condition style
    content: {
        paddingLeft: 15,
        paddingRight: 15,
    },
    heading: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 15,
        color: '#000000',
        textAlign: 'center',
    },
    partTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginTop: 10,
        marginBottom: 10,
        color: '#000000',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginTop: 7,
        marginBottom: 5,
        color: '#000000',
    },
    subSection: {
        fontSize: 15,
        fontWeight: '600',
        marginTop: 5,
        color: '#000000',
        marginBottom: 1,
    },
    text: {
        fontSize: 14,
        color: '#000000',
        lineHeight: 18,
    },
    checkboxRow: {
        flexDirection: "row",
        alignItems: "center",
    },

    checkboxLabel: {
        marginLeft: 10,
        fontSize: 16,
        color: "#333",
    },
    heading: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 16,
        color: '#000',
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    checkboxIcon: {
        marginTop: 2,
        marginRight: 10,
    },
    checkboxText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
        color: '#000',
    },
    linkText: {
        color: '#5a2d82', // same blue as image
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    commentBox: {
        marginTop: 10,
        fontSize: 12,
        color: '#6b7280',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 6,
        padding: 10,
        minHeight: 80,
        backgroundColor: '#fff',
    },
    subscriptionInfoCard: {
        marginTop: 15,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 10,
        backgroundColor: '#f9fafb',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    subscriptionInfoLabel: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 2,
    },
    subscriptionInfoValue: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
    },
    subscriptionStatusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
    subscriptionStatusBadgeActive: {
        backgroundColor: '#dcfce7',
    },
    subscriptionStatusBadgeInactive: {
        backgroundColor: '#fee2e2',
    },
    subscriptionStatusText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#111827',
    },
});

export default SubventionSetupScreen;
