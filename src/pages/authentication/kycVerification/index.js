import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Modal,
    ActivityIndicator,
    Animated,
    Dimensions,
    Platform,
    Easing,
    Linking,
    Keyboard,
    DeviceEventEmitter,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useToast } from 'react-native-toast-notifications';
import StepHeader from '../createProfile/headerSection';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hideLoader, showLoader } from '../../../redux/actions/LoaderAction';
import { useDispatch, useSelector } from 'react-redux';
import { getKycToken, kycStart, kycStatus, kycSync, kycWebhook } from '../../../services/kycverification';
import { showToastMessage } from '../../../components/displaytoastmessage';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { useAppTheme } from '../../../theme/useApptheme';
import { useThemeContext } from '../../../theme/ThemeContext';
import { EditProfile } from '../../../services/createProfile';
import { loggedIn } from '../../../redux/actions/LoginAction';
import { setUserProfile } from '../../../redux/actions/UserProfileAction';
import SNSMobileSDK from '@sumsub/react-native-mobilesdk-module';
import { setIsAddAccount } from '../../../redux/actions/AddAccountAction';
import { useLanguage } from '../../../i18n';
import { clearSignupFormData } from '../../../redux/actions/SignupFormAction';

const { width, height } = Dimensions.get('window');

const withAlpha = (hex, alpha = 0.12) => {
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
        return `rgba(90, 45, 130, ${alpha})`;
    }
    const normalized = hex.replace('#', '');
    const full = normalized.length === 3
        ? normalized.split('').map((c) => c + c).join('')
        : normalized;
    const int = parseInt(full, 16);
    if (Number.isNaN(int)) return `rgba(90, 45, 130, ${alpha})`;
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function KYCVerification({ route }) {
    const profileData = route?.params?.profileData ?? null;
    const serverProfile = route?.params?.serverProfile ?? null;
    const profileFromRoute = route?.params?.profile || profileData?.profile || serverProfile?.profile || 'user';
    const getLastRoute = route?.params?.fromRoute || null;
    const navigation = useNavigation();
    const dispatch = useDispatch();
    const { t } = useLanguage();
    const { isDarkMode } = useThemeContext();
    const {
        bgStyle,
        text,
        mutedText,
        card,
        border,
        accent,
        bg,
    } = useAppTheme(profileFromRoute);

    const primaryText = isDarkMode ? '#F5F0FF' : (text || '#1F2937');
    const secondaryText = isDarkMode ? '#C8C4D0' : (mutedText || '#6B7280');
    const actionAccent = accent || '#5a2d82';
    const surface = card || (isDarkMode ? '#1E1E1E' : '#FFFFFF');
    const fieldBorder = border || (isDarkMode ? '#444444' : '#D1D5DB');
    const screenBg = bg || (isDarkMode ? '#121212' : '#FFFFFF');
    const infoBg = withAlpha(actionAccent, isDarkMode ? 0.22 : 0.1);
    const noteBg = isDarkMode ? withAlpha(actionAccent, 0.18) : '#F9FAFB';
    const disabledBtnBg = isDarkMode ? '#3F3F46' : '#E5E7EB';
    const disabledBtnText = isDarkMode ? '#A1A1AA' : '#9CA3AF';
    const dropdownListBg = surface;
    const modalBg = surface;
    const inputTextColor = primaryText;
    const placeholderColor = secondaryText;

    // Build translated document types inside component so t() is in scope
    const DOCUMENT_TYPES = [
        { label: t('kyc.documentTypes.drivingLicense'), value: 'DRIVERS_LICENSE' },
        { label: t('kyc.documentTypes.passport'), value: 'PASSPORT' },
        { label: t('kyc.documentTypes.idCard'), value: 'ID_CARD' },
    ];

    useEffect(() => {
        dispatch(setUserProfile(profileFromRoute));
    }, [profileFromRoute, dispatch]);

    const toast = useToast();
    const isLoggedIn = useSelector(state => state.login.IS_LOGGED_IN);

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [documentType, setDocumentType] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [errors, setErrors] = useState({});
    const [isLaunchingSumsub, setIsLaunchingSumsub] = useState(false);

    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('submitting');
    const [modalMessage, setModalMessage] = useState('');
    const [isRetrying, setIsRetrying] = useState(false);
    const [showProgressModal, setShowProgressModal] = useState(false);
    const progressValue = useRef(new Animated.Value(0)).current;
    const [progressPercent, setProgressPercent] = useState(0);
    const [hasOpenedBrowser, setHasOpenedBrowser] = useState(false);
    const isOnboardingFlow = Boolean(profileData) || !isLoggedIn;

    const isFirstMount = useRef(true);
    const isFocused = useIsFocused();
    const firstNameInputRef = useRef(null);
    const lastNameInputRef = useRef(null);
    const progressTimerRef = useRef(null);
    const progressAnimationRef = useRef(null);
    const percentUpdateInterval = useRef(null);
    const shouldReturnAfterStatusCheckRef = useRef(false);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('PAYMENT_COMPLETED', (data) => {
            if (hasOpenedBrowser) setHasOpenedBrowser(false);
            startProgressBarAndFetch();
        });
        return () => subscription.remove();
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchKycStatus();
        }, [])
    );

    const validateFirstName = (v) => {
        if (!v) return t('kyc.firstNameRequired');
        if (v.length < 2) return t('kyc.firstNameMinLength');
        if (!/^[a-zA-Z\s]+$/.test(v)) return t('kyc.firstNameLettersOnly');
        return '';
    };

    const validateLastName = (v) => {
        if (!v) return t('kyc.lastNameRequired');
        if (v.length < 2) return t('kyc.lastNameMinLength');
        if (!/^[a-zA-Z\s]+$/.test(v)) return t('kyc.lastNameLettersOnly');
        return '';
    };

    const validateDocumentType = (v) => (!v ? t('kyc.documentTypeRequired') : '');

    const cleanupProgress = () => {
        if (progressTimerRef.current) { clearTimeout(progressTimerRef.current); progressTimerRef.current = null; }
        if (progressAnimationRef.current) { progressAnimationRef.current.stop(); progressAnimationRef.current = null; }
        if (percentUpdateInterval.current) { clearInterval(percentUpdateInterval.current); percentUpdateInterval.current = null; }
    };

    const launchSumsub = async () => {
        if (isLaunchingSumsub) return;
        setIsLaunchingSumsub(true);
        try {
            const response = await getKycToken();
            const accessToken = response?.data?.token;
            if (!accessToken) {
                showToastMessage(toast, 'danger', 'Unable to start verification. Please try again.');
                return;
            }
            const snsMobileSDK = SNSMobileSDK.init(accessToken, () => accessToken)
                .withHandlers({ onStatusChanged: event => console.log('Sumsub status:', event) })
                .withDebug(true)
                .build();
            await snsMobileSDK.launch();
        } catch (error) {
            showToastMessage(toast, 'danger', 'Failed to open Sumsub verification.');
        } finally {
            setIsLaunchingSumsub(false);
        }
    };

    const handleCreateProfile = async () => {
        if (!profileData) return;
        try {
            const formData = new FormData();
            formData.append('userName', profileData.username);
            formData.append('displayName', profileData.displayName);
            formData.append('bio', profileData.bio);
            if (profileData?.image && profileData.image.uri) {
                const img = profileData.image;
                const fileUri = Platform.OS === 'android' ? img.uri : img.uri.replace('file://', '');
                formData.append('image', { uri: fileUri, name: img.name || 'profile.jpg', type: img.type || 'image/jpeg' });
            } else if (profileData?.imageUri) {
                const uri = profileData.imageUri;
                const fileUri = Platform.OS === 'android' ? uri : uri.replace('file://', '');
                formData.append('image', { uri: fileUri, name: 'profile.jpg', type: 'image/jpeg' });
            }
            formData.append('gender', '');
            formData.append('age', '');
            formData.append('phoneNumber', '');
            const response = await EditProfile(formData);
            const code = response.statusCode;

            if (code === 200) {
                console.log('profile edit response ---------------', response)
                // showToastMessage(toast, 'success', 'Profile de.');
            } else if (code === 500) {
                showToastMessage(toast, 'danger', 'Something went wrong. Please try again.');
            } else {
                showToastMessage(toast, 'danger', 'Something went wrong. Please try again.');
            }
        } catch (err) {
            showToastMessage(toast, 'danger', 'Network error. Please check your connection.');
        }
    };

    const startProgressBarAndFetch = async () => {
        await handleCreateProfile();
        setShowProgressModal(true);
    };

    const cancelProgress = () => {
        cleanupProgress();
        setShowProgressModal(false);
        progressValue.setValue(0);
        setProgressPercent(0);
    };

    const isValid =
        !validateFirstName(firstName) &&
        !validateLastName(lastName) &&
        !validateDocumentType(documentType);

    const handleDocumentSelect = (item) => {
        setDocumentType(item.value);
        setShowDropdown(false);
        setErrors(prev => ({ ...prev, documentType: '' }));
    };

    const getSelectedLabel = () => {
        const selected = DOCUMENT_TYPES.find(item => item.value === documentType);
        return selected ? selected.label : t('kyc.documentTypePlaceholder');
    };

    const handleSubmitKYC = async () => {
        const firstNameError = validateFirstName(firstName);
        const lastNameError = validateLastName(lastName);
        const documentTypeError = validateDocumentType(documentType);

        if (firstNameError || lastNameError || documentTypeError) {
            setErrors({ firstName: firstNameError, lastName: lastNameError, documentType: documentTypeError });
            showToastMessage(toast, 'warning', t('kyc.validationWarning'));
            requestAnimationFrame(() => {
                if (firstNameError) firstNameInputRef.current?.focus?.();
                else if (lastNameError) lastNameInputRef.current?.focus?.();
            });
            return;
        }

        dispatch(showLoader());
        try {
            const getUserId = await AsyncStorage.getItem('userId');
            const kycData = { documentType, firstName: firstName.trim(), lastName: lastName.trim() };
            const response = await kycStart(getUserId, kycData);
            if (response.statusCode == 200) {
                shouldReturnAfterStatusCheckRef.current = true;
                const url = response.data.url;
                if (await InAppBrowser.isAvailable()) {
                    const result = await InAppBrowser.open(url, {
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
                        forceCloseOnRedirection: true,
                    });
                    if (result.type === 'dismiss' || result.type === 'cancel') {
                        startProgressBarAndFetch();
                    }
                } else {
                    await Linking.openURL(url);
                }
                setHasOpenedBrowser(true);
            } else {
                showToastMessage(toast, 'danger', response.message || 'Please try again');
            }
        } catch (err) {
            setModalType('error');
            setModalMessage(err?.response?.data?.message || 'Network error. Please check your connection.');
        } finally {
            dispatch(hideLoader());
        }
    };

    const handleRejectedRetry = () => {
        setShowDropdown(false);
        handleSubmitKYC();
    };

    const fetchKycStatus = async () => {
        try {
            if (getLastRoute == 'BlockedVerification') {
                return;
            }
            dispatch(showLoader());
            const storedUserId = await AsyncStorage.getItem('userId');
            const effectiveUserId = storedUserId || profileData?.userId || profileData?.id || serverProfile?.userId || serverProfile?.id;
            if (!effectiveUserId) return;

            const response = await kycStatus(effectiveUserId);
            if (response?.statusCode === 200) {
                const status = String(response?.data?.status || '').toUpperCase();
                if (status === 'APPROVED') {
                    setShowProgressModal(false);
                    if (profileData) {
                        navigation.navigate('Wallet', { profileData, serverProfile });
                    } else if (!isOnboardingFlow && shouldReturnAfterStatusCheckRef.current && navigation.canGoBack()) {
                        shouldReturnAfterStatusCheckRef.current = false;
                        navigation.goBack();
                    } else if (navigation.canGoBack()) {
                        navigation.goBack();
                    }
                } else if (status === 'PENDING' || status === 'SUBMITTED' || status === false) {
                    setShowProgressModal(false);
                    if (!isOnboardingFlow) {
                        if (shouldReturnAfterStatusCheckRef.current && navigation.canGoBack()) {
                            shouldReturnAfterStatusCheckRef.current = false;
                            navigation.goBack();
                            return;
                        }
                        return;
                    }
                    await AsyncStorage.setItem('isLoggedIn', 'true');
                    dispatch(loggedIn());
                    dispatch(clearSignupFormData());
                    dispatch(setIsAddAccount(false));
                    if (navigation.canGoBack()) { navigation.goBack(); return; }
                } else if (status === 'DECLINED' || status === 'REJECTED') {
                    Alert.alert(
                        t('kyc.kycRejectedTitle'),
                        t('kyc.kycRejectedMessage'),
                        [
                            { text: t('kyc.cancel'), style: 'cancel' },
                            { text: t('kyc.retry'), onPress: () => handleRejectedRetry() },
                        ],
                        { cancelable: true }
                    );
                } else {
                    if (isFirstMount.current) { isFirstMount.current = false; return; }
                    Alert.alert(t('kyc.kycNotVerifiedTitle'), t('kyc.kycNotVerifiedMessage'));
                }
            } else {
                showToastMessage(toast, 'danger', response.data.message);
            }
        } catch (error) {
            // silent
        } finally {
            dispatch(hideLoader());
        }
    };

    const kycSycncById = async () => {
        const getUserId = await AsyncStorage.getItem('userId');
        try {
            const response = await kycSync(getUserId);
            if (response?.statusCode === 200) {
                const status = String(response?.data?.status || '').toUpperCase();
                if (status === 'APPROVED') {
                    setShowProgressModal(false);
                    if (profileData) navigation.navigate('Wallet', { profileData, serverProfile });
                    else if (!isOnboardingFlow && shouldReturnAfterStatusCheckRef.current && navigation.canGoBack()) {
                        shouldReturnAfterStatusCheckRef.current = false;
                        navigation.goBack();
                    } else if (navigation.canGoBack()) navigation.goBack();
                } else if (status === 'PENDING' || status === 'SUBMITTED' || status === false) {
                    setShowProgressModal(false);
                    if (!isOnboardingFlow) {
                        if (shouldReturnAfterStatusCheckRef.current && navigation.canGoBack()) {
                            shouldReturnAfterStatusCheckRef.current = false;
                            navigation.goBack();
                            return;
                        }
                        return;
                    }
                    await AsyncStorage.setItem('isLoggedIn', 'true');
                    dispatch(loggedIn());
                    dispatch(clearSignupFormData());
                    dispatch(setIsAddAccount(false));
                    if (navigation.canGoBack()) { navigation.goBack(); return; }
                } else if (status === 'DECLINED' || status === 'REJECTED') {
                    Alert.alert(
                        t('kyc.kycRejectedTitle'),
                        t('kyc.kycRejectedMessage'),
                        [
                            { text: t('kyc.cancel'), style: 'cancel' },
                            { text: t('kyc.retry'), onPress: () => handleRejectedRetry() },
                        ],
                        { cancelable: true }
                    );
                } else {
                    if (isFirstMount.current) { isFirstMount.current = false; return; }
                    Alert.alert(t('kyc.kycNotVerifiedTitle'), t('kyc.kycNotVerifiedMessage'));
                }
            } else {
                showToastMessage(toast, 'danger', response.data.message);
            }
        } catch (err) {
            console.log(err, 'error in kyc');
        }
    };

    const handleRetry = () => {
        setIsRetrying(true);
        setModalType('submitting');
        setTimeout(handleSubmitKYC, 300);
    };

    const continueNext = () => {
        const firstNameError = validateFirstName(firstName);
        const lastNameError = validateLastName(lastName);
        const documentTypeError = validateDocumentType(documentType);
        if (firstNameError || lastNameError || documentTypeError) {
            setErrors({ firstName: firstNameError, lastName: lastNameError, documentType: documentTypeError });
            Alert.alert(t('kyc.invalidAlert'), t('kyc.fixErrors'));
            return;
        }
        setTimeout(handleSubmitKYC, 500);
    };

    const renderModalContent = () => {
        if (modalType === 'submitting') {
            return (
                <>
                    <View style={styles.submittingIcon}>
                        <ActivityIndicator size="large" color="#fff" />
                    </View>
                    <Text style={[styles.modalTitle, { color: primaryText }]}>
                        {isRetrying ? t('kyc.modalRetrying') : t('kyc.modalSubmitting')}
                    </Text>
                    <Text style={[styles.modalMessage, { color: secondaryText }]}>
                        {isRetrying ? t('kyc.modalRetryingMsg') : t('kyc.modalSubmittingMsg')}
                    </Text>
                    <View style={styles.dotsContainer}>
                        <View style={[styles.dot, styles.dotActive]} />
                        <View style={[styles.dot, styles.dotActive]} />
                        <View style={styles.dot} />
                    </View>
                </>
            );
        }
        if (modalType === 'success') {
            return (
                <>
                    <View style={[styles.resultIcon, styles.successIconBg]}>
                        <Text style={styles.resultIconText}>✓</Text>
                    </View>
                    <Text style={[styles.modalTitle, { color: primaryText }]}>{t('kyc.modalVerified')}</Text>
                    <Text style={[styles.modalMessage, { color: secondaryText }]}>{modalMessage}</Text>
                    <View style={styles.successFooter}>
                        <Text style={styles.autoCloseText}>{t('kyc.proceedingWallet')}</Text>
                        <View style={styles.successDots}>
                            <View style={[styles.successDot, styles.successDotActive]} />
                            <View style={[styles.successDot, styles.successDotActive]} />
                            <View style={[styles.successDot, styles.successDotActive]} />
                        </View>
                    </View>
                </>
            );
        }
        if (modalType === 'error') {
            return (
                <>
                    <View style={[styles.resultIcon, styles.errorIconBg]}>
                        <Text style={styles.resultIconText}>×</Text>
                    </View>
                    <Text style={[styles.modalTitle, { color: primaryText }]}>{t('kyc.modalError')}</Text>
                    <Text style={[styles.modalMessage, { color: secondaryText }]}>{modalMessage}</Text>
                    <TouchableOpacity style={[styles.modalButton, styles.errorButton]} onPress={handleRetry}>
                        <Text style={styles.buttonText}>{t('kyc.tryAgain')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.modalButton,
                            styles.cancelButton,
                            { backgroundColor: isDarkMode ? withAlpha(actionAccent, 0.2) : '#F3F4F6' },
                        ]}
                        onPress={() => setShowModal(false)}
                    >
                        <Text style={[styles.cancelButtonText, { color: primaryText }]}>{t('kyc.cancel')}</Text>
                    </TouchableOpacity>
                </>
            );
        }
        return null;
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: screenBg }, bgStyle]}>
            <KeyboardAwareScrollView
                style={[styles.container, { backgroundColor: screenBg }]}
                contentContainerStyle={styles.contentContainer}
                keyboardShouldPersistTaps="handled"
                enableOnAndroid={true}
                enableAutomaticScroll={true}
                extraScrollHeight={100}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                <View style={styles.inner}>
                    <StepHeader currentStep={2} />

                    <View style={styles.headerSection}>
                        <Text style={[styles.title, { color: primaryText }]}>{t('kyc.title')}</Text>
                        <Text style={[styles.subtitle, { color: secondaryText }]}>{t('kyc.subtitle')}</Text>
                    </View>

                    <View style={[styles.infoBox, { backgroundColor: infoBg, borderLeftColor: actionAccent }]}>
                        <Icon name="shield" size={20} color={actionAccent} />
                        <Text style={[styles.infoText, { color: isDarkMode ? primaryText : '#4338CA' }]}>
                            {t('kyc.securityInfo')}
                        </Text>
                    </View>

                    <View style={styles.form}>
                        {/* First Name */}
                        <View style={styles.field}>
                            <Text style={[styles.label, { color: primaryText }]}>{t('kyc.firstNameLabel')}</Text>
                            <TextInput
                                placeholder={t('kyc.firstNamePlaceholder')}
                                placeholderTextColor={placeholderColor}
                                ref={firstNameInputRef}
                                style={[
                                    styles.inputFull,
                                    {
                                        color: inputTextColor,
                                        borderColor: fieldBorder,
                                        backgroundColor: surface,
                                    },
                                    errors.firstName && styles.inputErrorWrapper,
                                ]}
                                value={firstName}
                                onChangeText={txt => {
                                    setFirstName(txt);
                                    setErrors(prev => ({ ...prev, firstName: validateFirstName(txt) }));
                                }}
                            />
                            {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
                        </View>

                        {/* Last Name */}
                        <View style={styles.field}>
                            <Text style={[styles.label, { color: primaryText }]}>{t('kyc.lastNameLabel')}</Text>
                            <TextInput
                                placeholder={t('kyc.lastNamePlaceholder')}
                                placeholderTextColor={placeholderColor}
                                ref={lastNameInputRef}
                                style={[
                                    styles.inputFull,
                                    {
                                        color: inputTextColor,
                                        borderColor: fieldBorder,
                                        backgroundColor: surface,
                                    },
                                    errors.lastName && styles.inputErrorWrapper,
                                ]}
                                value={lastName}
                                onChangeText={txt => {
                                    setLastName(txt);
                                    setErrors(prev => ({ ...prev, lastName: validateLastName(txt) }));
                                }}
                            />
                            {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
                        </View>

                        {/* Document Type Dropdown */}
                        <View style={styles.field}>
                            <Text style={[styles.label, { color: primaryText }]}>{t('kyc.documentTypeLabel')}</Text>
                            <TouchableOpacity
                                style={[
                                    styles.dropdownButton,
                                    {
                                        borderColor: showDropdown ? actionAccent : fieldBorder,
                                        backgroundColor: showDropdown
                                            ? withAlpha(actionAccent, isDarkMode ? 0.2 : 0.08)
                                            : surface,
                                    },
                                    errors.documentType && styles.inputErrorWrapper,
                                ]}
                                onPress={() => { Keyboard.dismiss(); setShowDropdown(!showDropdown); }}
                            >
                                <Text
                                    style={[
                                        styles.dropdownButtonText,
                                        { color: documentType ? primaryText : secondaryText },
                                    ]}
                                >
                                    {getSelectedLabel()}
                                </Text>
                                <Icon
                                    name={showDropdown ? 'chevron-up' : 'chevron-down'}
                                    size={20}
                                    color={secondaryText}
                                />
                            </TouchableOpacity>

                            {showDropdown && (
                                <View
                                    style={[
                                        styles.dropdownList,
                                        { backgroundColor: dropdownListBg, borderColor: fieldBorder },
                                    ]}
                                >
                                    {DOCUMENT_TYPES.map((item, index) => (
                                        <TouchableOpacity
                                            key={item.value}
                                            style={[
                                                styles.dropdownItem,
                                                index !== DOCUMENT_TYPES.length - 1 && {
                                                    borderBottomWidth: 1,
                                                    borderBottomColor: fieldBorder,
                                                },
                                                documentType === item.value && {
                                                    backgroundColor: withAlpha(actionAccent, isDarkMode ? 0.22 : 0.1),
                                                },
                                            ]}
                                            onPress={() => handleDocumentSelect(item)}
                                        >
                                            <Text
                                                style={[
                                                    styles.dropdownItemText,
                                                    {
                                                        color: documentType === item.value
                                                            ? actionAccent
                                                            : primaryText,
                                                        fontWeight: documentType === item.value ? '600' : '400',
                                                    },
                                                ]}
                                            >
                                                {item.label}
                                            </Text>
                                            {documentType === item.value && (
                                                <Icon name="check" size={16} color={actionAccent} />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                            {errors.documentType && <Text style={styles.errorText}>{errors.documentType}</Text>}
                        </View>

                        {/* Note */}
                        <View style={[styles.noteBox, { backgroundColor: noteBg }]}>
                            <Icon name="info" size={16} color={secondaryText} />
                            <Text style={[styles.noteText, { color: primaryText }]}>{t('kyc.noteText')}</Text>
                        </View>

                        {/* Submit Button */}
                        <TouchableOpacity
                            onPress={continueNext}
                            style={[
                                styles.continueButton,
                                { backgroundColor: isValid ? actionAccent : disabledBtnBg },
                            ]}
                            disabled={!isValid}
                        >
                            <Text
                                style={[
                                    styles.continueButtonText,
                                    { color: isValid ? '#FFFFFF' : disabledBtnText },
                                ]}
                            >
                                {t('kyc.submitButton')}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => { setShowProgressModal(false); navigation.goBack(); }}
                            style={styles.backButton}
                        >
                            <Text style={[styles.backButtonText, { color: secondaryText }]}>
                                {t('kyc.goBack')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAwareScrollView>

            {/* KYC Submission Modal */}
            <Modal visible={showModal} transparent animationType="fade" statusBarTranslucent
                onRequestClose={() => { if (modalType === 'error') setShowModal(false); }}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContainer, { backgroundColor: modalBg }]}>
                        {renderModalContent()}
                    </View>
                </View>
            </Modal>

            {/* Progress Modal */}
            <Modal visible={showProgressModal} transparent animationType="fade" statusBarTranslucent onRequestClose={cancelProgress}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContainer, { backgroundColor: modalBg }]}>
                        <Text style={[styles.modalTitle, { color: primaryText }]}>{t('kyc.progressTitle')}</Text>
                        <Text style={[styles.modalMessage, { color: secondaryText }]}>{t('kyc.progressMessage')}</Text>
                        <TouchableOpacity
                            style={[
                                styles.modalButton,
                                styles.cancelButton,
                                { backgroundColor: isDarkMode ? withAlpha(actionAccent, 0.2) : '#F3F4F6' },
                            ]}
                            onPress={async () => {
                                setShowProgressModal(false);
                                await fetchKycStatus();
                            }}
                        >
                            <Text style={[styles.cancelButtonText, { color: primaryText }]}>
                                {isOnboardingFlow ? t('kyc.exploreApp') : t('kyc.checkStatusGoBack')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    container: { flex: 1 },
    contentContainer: { flexGrow: 1, paddingBottom: 50 },
    inner: { padding: 16, alignItems: 'center', minHeight: '100%' },
    headerSection: { alignItems: 'center', marginVertical: 16, paddingHorizontal: 16 },
    title: { fontSize: 24, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
    subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    infoBox: {
        flexDirection: 'row', alignItems: 'flex-start',
        padding: 16, borderRadius: 12, borderLeftWidth: 3,
        marginBottom: 24, width: '100%', maxWidth: 360,
    },
    infoText: { flex: 1, fontSize: 13, lineHeight: 18, marginLeft: 12 },
    form: { width: '100%', maxWidth: 360 },
    field: { marginBottom: 24, width: '100%' },
    label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
    inputFull: {
        borderWidth: 1, borderRadius: 8,
        padding: 12, fontSize: 14, minHeight: 48, textAlign: 'left',
    },
    inputErrorWrapper: { borderColor: '#DC2626', backgroundColor: 'rgba(220,38,38,0.12)' },
    errorText: { color: '#DC2626', fontSize: 12, marginTop: 4 },
    dropdownButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 48,
    },
    dropdownButtonText: { fontSize: 14 },
    dropdownList: {
        marginTop: 8, borderWidth: 1, borderRadius: 8,
        overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
    },
    dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
    dropdownItemText: { fontSize: 14 },
    noteBox: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, borderRadius: 8, marginBottom: 24 },
    noteText: { flex: 1, fontSize: 12, lineHeight: 16, marginLeft: 8 },
    continueButton: { width: '100%', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
    continueButtonText: { fontSize: 16, fontWeight: '600' },
    backButton: { width: '100%', padding: 16, alignItems: 'center', marginTop: 12 },
    backButtonText: { fontSize: 14, fontWeight: '500' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContainer: {
        borderRadius: 20, padding: 32, alignItems: 'center',
        width: width * 0.85, maxWidth: 350,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16 },
            android: { elevation: 12 },
        }),
    },
    submittingIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
    resultIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
    successIconBg: { backgroundColor: '#10b981' },
    errorIconBg: { backgroundColor: '#ef4444' },
    resultIconText: { fontSize: 36, color: '#fff', fontWeight: 'bold' },
    modalTitle: { fontSize: 24, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
    modalMessage: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
    modalButton: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 10, marginTop: 16, width: '100%', alignItems: 'center' },
    errorButton: { backgroundColor: '#ef4444' },
    cancelButton: { marginTop: 8 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    cancelButtonText: { fontSize: 16, fontWeight: '600' },
    dotsContainer: { flexDirection: 'row', marginTop: 20, gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#d1d5db' },
    dotActive: { backgroundColor: '#6366f1' },
    successFooter: { marginTop: 20, alignItems: 'center' },
    autoCloseText: { fontSize: 14, color: '#10b981', textAlign: 'center', fontWeight: '500' },
    successDots: { flexDirection: 'row', marginTop: 12, gap: 6 },
    successDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#d1fae5' },
    successDotActive: { backgroundColor: '#10b981' },
});