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
    AppState,
    Keyboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useToast } from 'react-native-toast-notifications';
import StepHeader from '../createProfile/headerSection';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hideLoader, showLoader } from '../../../redux/actions/LoaderAction';
import { useDispatch } from 'react-redux';
import { kycStart, kycStatus, kycWebhook } from '../../../services/kycverification';
import { showToastMessage } from '../../../components/displaytoastmessage';
import InAppBrowser from 'react-native-inappbrowser-reborn';
// Import your KYC API service here
// import { submitKYC } from '../../../services/kycService';

const { width, height } = Dimensions.get('window');

const DOCUMENT_TYPES = [
    { label: 'Driving License', value: 'DRIVERS_LICENSE' },
    { label: 'Passport', value: 'PASSPORT' },
    { label: 'ID Card', value: 'ID_CARD' },
];

export default function KYCVerification({ route }) {
    const { profileData, serverProfile } = route.params;
    const navigation = useNavigation();
    const toast = useToast();
    const dispatch = useDispatch();

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [documentType, setDocumentType] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [errors, setErrors] = useState({});

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('submitting'); // 'submitting', 'success', 'error'
    const [modalMessage, setModalMessage] = useState('');
    const [isRetrying, setIsRetrying] = useState(false);

    const isFirstMount = useRef(true);
    const isFocused = useIsFocused();

    // Monitor app state
    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active' && isFocused && !isFirstMount.current) {
                fetchKycStatus();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [isFocused]);

    // Also check on focus (but skip first time)
    useFocusEffect(
        useCallback(() => {
            fetchKycStatus();
        }, [])
    );

    const validateFirstName = (v) => {
        if (!v) return 'First name is required';
        if (v.length < 2) return 'First name must be at least 2 characters';
        if (!/^[a-zA-Z\s]+$/.test(v)) return 'First name should only contain letters';
        return '';
    };

    const validateLastName = (v) => {
        if (!v) return 'Last name is required';
        if (v.length < 2) return 'Last name must be at least 2 characters';
        if (!/^[a-zA-Z\s]+$/.test(v)) return 'Last name should only contain letters';
        return '';
    };

    const validateDocumentType = (v) => (!v ? 'Document type is required' : '');

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
        return selected ? selected.label : 'Select document type';
    };

    const handleSubmitKYC = async () => {
        dispatch(showLoader());
        try {
            const getUserId = await AsyncStorage.getItem('userId');
            const kycData = {
                documentType,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
            };
            console.log('get user idddddd', getUserId);
            console.log('kycDataaaaaaaaaaaaaaaaaaa', kycData);

            const response = await kycStart(getUserId, kycData);
            console.log('response in kyc start---->>>>>>>>>>>>', response.data);
            if (response.statusCode == 200) {
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
                    });

                    // Browser was closed - check KYC status
                    if (result.type === 'dismiss' || result.type === 'cancel') {
                        fetchKycStatus();
                    }
                } else {
                    // Fallback if in-app browser isn’t available
                    await Linking.openURL(url);
                }

            } else {
                showToastMessage(toast, 'danger', response.message || 'Please try again');
            }

            // Replace this with your actual KYC API call
            // const response = await submitKYC(kycData);

            // Simulating API call for demonstration
            // await new Promise(resolve => setTimeout(resolve, 2000));
            // const response = { statusCode: 200, message: 'KYC submitted successfully' };

            // if (response.statusCode === 200) {
            //     setModalType('success');
            //     setModalMessage('KYC verification submitted successfully!');

            //     // Navigate to Wallet after 3 seconds
            //     setTimeout(() => {
            //         setShowModal(false);
            //         navigation.navigate('Wallet', { profileData, serverProfile });
            //     }, 3000);

            // } else if (response.statusCode === 500) {
            //     setModalType('error');
            //     setModalMessage('Server error. Please try again.');
            // } else {
            //     setModalType('error');
            //     setModalMessage(response.message || 'Failed to submit KYC. Please try again.');
            // }
        } catch (err) {
            setModalType('error');
            setModalMessage(err?.response?.data?.message || 'Network error. Please check your connection.');
        } finally {
            dispatch(hideLoader());
        }
    };

    const handleKycWebhook = async () => {
        try {
            dispatch(showLoader());
            const dataToSend = {
                event: "verification.reviewed",
                verification: {
                    id: "8c0d61f7-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
                    status: "approved",
                    document: {
                        type: "DRIVERS_LICENSE"
                    }
                }
            };
            const response = await kycWebhook(dataToSend);
            if (response?.statusCode === 200) {
                console.log('KYC Webhook Response', response.data);

            } else {
                showToastMessage(toast, 'danger', response.data.message);
            }
        } catch (error) {
            showToastMessage(
                toast,
                'danger',
                error?.response?.message ?? 'Something went wrong',
            );
        } finally {
            dispatch(hideLoader());
        }
    };

    const fetchKycStatus = async () => {
        const getUserId = await AsyncStorage.getItem('userId');
        try {
            dispatch(showLoader());
            const response = await kycStatus(getUserId);
            console.log('response in kyc status------>>>>>>>>>>', response);

            if (response?.statusCode === 200) {
                console.log('KYC Webhook Response', response.data);
                if (response.data.status == "APPROVED") {
                    navigation.navigate('Wallet', { profileData, serverProfile });
                }
                else {
                    if (isFirstMount.current) {
                        isFirstMount.current = false;
                        return;
                    }
                    Alert.alert(
                        "KYC Not Verified",
                        "Your KYC is not verified. Please try again.",
                        [
                            {
                                text: "Cancel",
                                style: "cancel"
                            },
                            {
                                text: "Retry",
                                onPress: () => {
                                    handleSubmitKYC();
                                }
                            }
                        ],
                        { cancelable: true }
                    );
                }
            } else {
                showToastMessage(toast, 'danger', response.data.message);
            }
        } catch (error) {
            // showToastMessage(
            //     toast,
            //     'danger',
            //     error?.response?.message ?? 'Something went wrong',
            // );
        } finally {
            dispatch(hideLoader());
        }
    };

    const handleRetry = () => {
        setIsRetrying(true);
        setModalType('submitting');
        setTimeout(handleSubmitKYC, 300);
    };

    const continueNext = () => {
        // Validate all fields
        const firstNameError = validateFirstName(firstName);
        const lastNameError = validateLastName(lastName);
        const documentTypeError = validateDocumentType(documentType);

        if (firstNameError || lastNameError || documentTypeError) {
            setErrors({
                firstName: firstNameError,
                lastName: lastNameError,
                documentType: documentTypeError,
            });
            Alert.alert('Invalid', 'Please fix all errors before continuing.');
            return;
        }

        // Show modal and submit KYC
        // setShowModal(true);
        // setModalType('submitting');
        setTimeout(handleSubmitKYC, 500);
    };

    const renderModalContent = () => {
        if (modalType === 'submitting') {
            return (
                <>
                    <View style={styles.submittingIcon}>
                        <ActivityIndicator size="large" color="#fff" />
                    </View>
                    <Text style={styles.modalTitle}>
                        {isRetrying ? 'Retrying...' : 'Submitting KYC'}
                    </Text>
                    <Text style={styles.modalMessage}>
                        {isRetrying
                            ? 'Trying again to verify your identity...'
                            : 'Verifying your identity and securing your information...'
                        }
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
                    <Text style={styles.modalTitle}>Verified!</Text>
                    <Text style={styles.modalMessage}>{modalMessage}</Text>
                    <View style={styles.successFooter}>
                        <Text style={styles.autoCloseText}>
                            Proceeding to wallet setup...
                        </Text>
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
                    <Text style={styles.modalTitle}>Error!</Text>
                    <Text style={styles.modalMessage}>{modalMessage}</Text>
                    <TouchableOpacity
                        style={[styles.modalButton, styles.errorButton]}
                        onPress={handleRetry}
                    >
                        <Text style={styles.buttonText}>Try Again</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modalButton, styles.cancelButton]}
                        onPress={() => setShowModal(false)}
                    >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </>
            );
        }

        return null;
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAwareScrollView
                style={styles.container}
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
                        <Text style={styles.title}>KYC Verification</Text>
                        <Text style={styles.subtitle}>
                            We need to verify your real identity to comply with regulations and keep the platform secure.
                        </Text>
                    </View>

                    <View style={styles.infoBox}>
                        <Icon name="shield" size={20} color="#4F46E5" />
                        <Text style={styles.infoText}>
                            Your information is encrypted and securely stored. We never share your personal data with third parties.
                        </Text>
                    </View>

                    <View style={styles.form}>
                        {/* First Name Field */}
                        <View style={styles.field}>
                            <Text style={styles.label}>First Name</Text>
                            <TextInput
                                placeholder="Enter your first name"
                                placeholderTextColor="#6B7280"
                                style={[
                                    styles.inputFull,
                                    errors.firstName && styles.inputErrorWrapper,
                                ]}
                                value={firstName}
                                onChangeText={txt => {
                                    setFirstName(txt);
                                    setErrors(prev => ({
                                        ...prev,
                                        firstName: validateFirstName(txt),
                                    }));
                                }}
                            />
                            {errors.firstName && (
                                <Text style={styles.errorText}>{errors.firstName}</Text>
                            )}
                        </View>

                        {/* Last Name Field */}
                        <View style={styles.field}>
                            <Text style={styles.label}>Last Name</Text>
                            <TextInput
                                placeholder="Enter your last name"
                                placeholderTextColor="#6B7280"
                                style={[
                                    styles.inputFull,
                                    errors.lastName && styles.inputErrorWrapper,
                                ]}
                                value={lastName}
                                onChangeText={txt => {
                                    setLastName(txt);
                                    setErrors(prev => ({
                                        ...prev,
                                        lastName: validateLastName(txt),
                                    }));
                                }}
                            />
                            {errors.lastName && (
                                <Text style={styles.errorText}>{errors.lastName}</Text>
                            )}
                        </View>

                        {/* Document Type Dropdown */}
                        <View style={styles.field}>
                            <Text style={styles.label}>Document Type</Text>
                            <TouchableOpacity
                                style={[
                                    styles.dropdownButton,
                                    errors.documentType && styles.inputErrorWrapper,
                                    showDropdown && styles.dropdownButtonActive,
                                ]}
                                onPress={() => { Keyboard.dismiss(), setShowDropdown(!showDropdown) }}
                            >
                                <Text
                                    style={[
                                        styles.dropdownButtonText,
                                        !documentType && styles.dropdownPlaceholder,
                                    ]}
                                >
                                    {getSelectedLabel()}
                                </Text>
                                <Icon
                                    name={showDropdown ? 'chevron-up' : 'chevron-down'}
                                    size={20}
                                    color="#6B7280"
                                />
                            </TouchableOpacity>

                            {showDropdown && (
                                <View style={styles.dropdownList}>
                                    {DOCUMENT_TYPES.map((item, index) => (
                                        <TouchableOpacity
                                            key={item.value}
                                            style={[
                                                styles.dropdownItem,
                                                index !== DOCUMENT_TYPES.length - 1 && styles.dropdownItemBorder,
                                                documentType === item.value && styles.dropdownItemSelected,
                                            ]}
                                            onPress={() => handleDocumentSelect(item)}
                                        >
                                            <Text
                                                style={[
                                                    styles.dropdownItemText,
                                                    documentType === item.value && styles.dropdownItemTextSelected,
                                                ]}
                                            >
                                                {item.label}
                                            </Text>
                                            {documentType === item.value && (
                                                <Icon name="check" size={16} color="#4F46E5" />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {errors.documentType && (
                                <Text style={styles.errorText}>{errors.documentType}</Text>
                            )}
                        </View>

                        {/* Information Note */}
                        <View style={styles.noteBox}>
                            <Icon name="info" size={16} color="#6B7280" />
                            <Text style={styles.noteText}>
                                Make sure the information matches your official documents exactly as they appear.
                            </Text>
                        </View>

                        {/* Continue Button */}
                        <TouchableOpacity
                            onPress={continueNext}
                            style={[styles.continueButton, isValid && styles.continueButtonActive]}
                            disabled={!isValid}
                        >
                            <Text
                                style={[
                                    styles.continueButtonText,
                                    isValid && styles.continueButtonTextActive,
                                ]}
                            >
                                Submit & Continue
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.backButton}
                        >
                            <Text style={styles.backButtonText}>Go Back</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAwareScrollView>

            {/* KYC Submission Modal */}
            <Modal
                visible={showModal}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={() => {
                    if (modalType === 'error') {
                        setShowModal(false);
                    }
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        {renderModalContent()}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f8f2fd',
    },
    container: {
        flex: 1,
    },
    contentContainer: {
        flexGrow: 1,
        paddingBottom: 50,
    },
    inner: {
        padding: 16,
        alignItems: 'center',
        minHeight: '100%',
    },
    headerSection: {
        alignItems: 'center',
        marginVertical: 16,
        paddingHorizontal: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: '600',
        marginBottom: 8,
        color: '#1F2937',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#EEF2FF',
        padding: 16,
        borderRadius: 12,
        borderLeftWidth: 3,
        borderLeftColor: '#4F46E5',
        marginBottom: 24,
        width: '100%',
        maxWidth: 360,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: '#4338CA',
        lineHeight: 18,
        marginLeft: 12,
    },
    form: {
        width: '100%',
        maxWidth: 360,
    },
    field: {
        marginBottom: 24,
        width: '100%',
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 8,
    },
    inputFull: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#f8f2fd',
        fontSize: 14,
        minHeight: 48,
        color: '#1F2937',
    },
    inputErrorWrapper: {
        borderColor: '#DC2626',
        backgroundColor: '#FEF2F2',
    },
    errorText: {
        color: '#DC2626',
        fontSize: 12,
        marginTop: 4,
    },

    // Dropdown Styles
    dropdownButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#f8f2fd',
        minHeight: 48,
    },
    dropdownButtonActive: {
        borderColor: '#4F46E5',
        backgroundColor: '#F5F3FF',
    },
    dropdownButtonText: {
        fontSize: 14,
        color: '#1F2937',
    },
    dropdownPlaceholder: {
        color: '#6B7280',
    },
    dropdownList: {
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        backgroundColor: '#FFF',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    dropdownItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    dropdownItemSelected: {
        backgroundColor: '#F5F3FF',
    },
    dropdownItemText: {
        fontSize: 14,
        color: '#374151',
    },
    dropdownItemTextSelected: {
        color: '#4F46E5',
        fontWeight: '500',
    },

    // Note Box
    noteBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#F9FAFB',
        padding: 12,
        borderRadius: 8,
        marginBottom: 24,
    },
    noteText: {
        flex: 1,
        fontSize: 12,
        color: '#6B7280',
        lineHeight: 16,
        marginLeft: 8,
    },

    // Buttons
    continueButton: {
        width: '100%',
        padding: 16,
        borderRadius: 8,
        backgroundColor: '#E5E7EB',
        alignItems: 'center',
        marginTop: 8,
    },
    continueButtonActive: {
        backgroundColor: '#1F2937',
    },
    continueButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#9CA3AF',
    },
    continueButtonTextActive: {
        color: '#FFF',
    },
    backButton: {
        width: '100%',
        padding: 16,
        alignItems: 'center',
        marginTop: 12,
    },
    backButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6B7280',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 32,
        alignItems: 'center',
        width: width * 0.85,
        maxWidth: 350,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.2,
                shadowRadius: 16,
            },
            android: {
                elevation: 12,
            },
        }),
    },

    // Submitting state
    submittingIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#6366f1',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },

    // Result icons
    resultIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    successIconBg: { backgroundColor: '#10b981' },
    errorIconBg: { backgroundColor: '#ef4444' },

    resultIconText: {
        fontSize: 36,
        color: '#fff',
        fontWeight: 'bold',
    },

    modalTitle: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 12,
        textAlign: 'center',
        color: '#111827',
    },

    modalMessage: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 24,
    },

    // Modal Buttons
    modalButton: {
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 10,
        marginTop: 16,
        width: '100%',
        alignItems: 'center',
    },
    errorButton: { backgroundColor: '#ef4444' },
    cancelButton: {
        backgroundColor: '#F3F4F6',
        marginTop: 8,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    cancelButtonText: {
        color: '#6B7280',
        fontSize: 16,
        fontWeight: '600',
    },

    // Loading dots
    dotsContainer: {
        flexDirection: 'row',
        marginTop: 20,
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#d1d5db',
    },
    dotActive: {
        backgroundColor: '#6366f1',
    },

    // Success modal footer
    successFooter: {
        marginTop: 20,
        alignItems: 'center',
    },
    autoCloseText: {
        fontSize: 14,
        color: '#10b981',
        textAlign: 'center',
        fontWeight: '500',
    },
    successDots: {
        flexDirection: 'row',
        marginTop: 12,
        gap: 6,
    },
    successDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#d1fae5',
    },
    successDotActive: {
        backgroundColor: '#10b981',
    },
});