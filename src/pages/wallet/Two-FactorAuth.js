import React from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Switch,
  Linking,
  Alert,
  Platform,
  Modal,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import OTPTextInput from 'react-native-otp-textinput';
import Icon from 'react-native-vector-icons/Ionicons';
import styles from './Style';
import { useAppTheme } from '../../theme/useApptheme';
import { useToast } from 'react-native-toast-notifications';
import { useDispatch } from 'react-redux';
import { showLoader, hideLoader } from '../../redux/actions/LoaderAction';
import { showToastMessage } from '../../components/displaytoastmessage';
import { enableTwoFactorAuth, verifyTwoFactorAuth, disableTwoFactorAuth } from '../../services/wallet';

const { height } = Dimensions.get('window');

const TwoFactorAuthScreen = () => {
  const [twoFactorEnabled, setTwoFactorEnabled] = React.useState(false);
  const [biometricEnabled, setBiometricEnabled] = React.useState(false);
  const [showVerifyModal, setShowVerifyModal] = React.useState(false);
  const [verifyOtp, setVerifyOtp] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [verifyLoading, setVerifyLoading] = React.useState(false);
  const [qrCodeUrl, setQrCodeUrl] = React.useState('');
  const [otpAuthUrl, setOtpAuthUrl] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState('');
  const otpInput = React.useRef(null);
  const { bgStyle, textStyle, text } = useAppTheme();
  const toast = useToast();
  const dispatch = useDispatch();

  const handleEnable2FA = async () => {
    setLoading(true);
    dispatch(showLoader());

    try {
      const response = await enableTwoFactorAuth();

      if (response && response.statusCode === 200) {
        const { qrCodeUrl, otpauthUrl, secret } = response.data;
        setQrCodeUrl(qrCodeUrl);
        setOtpAuthUrl(otpauthUrl);
        setShowVerifyModal(true);
      } else {
        showToastMessage(toast, 'danger', response.data?.data?.message || 'Failed to enable 2FA');
      }
    } catch (error) {
      showToastMessage(toast, 'danger', error?.response?.data?.data?.message || 'Error enabling 2FA');
    } finally {
      setLoading(false);
      dispatch(hideLoader());
    }
  };

  const handleVerify2FA = async () => {
    setErrorMessage(''); // Clear previous errors
    
    if (verifyOtp.length !== 6) {
      setErrorMessage('Please enter a 6-digit code');
      return;
    }

    setVerifyLoading(true);
    dispatch(showLoader());

    try {
      const response = await verifyTwoFactorAuth({ token: verifyOtp });

      if (response && response.data?.statusCode === 200) {
        setTwoFactorEnabled(true);
        setShowVerifyModal(false);
        setVerifyOtp('');
        otpInput.current?.clear();
        // Show success toast after modal closes
        setTimeout(() => {
          showToastMessage(toast, 'success', response.data?.data?.message || '2FA enabled successfully');
        }, 300);
      } else {
        setErrorMessage(response.data?.data?.message || 'Invalid OTP');
        setVerifyOtp('');
        otpInput.current?.clear();
      }
    } catch (error) {
      setErrorMessage(error?.response?.data?.data?.message || 'Verification failed');
      setVerifyOtp('');
      otpInput.current?.clear();
    } finally {
      setVerifyLoading(false);
      dispatch(hideLoader());
    }
  };

  const handleDisable2FA = async () => {
    Alert.alert(
      'Disable 2FA',
      'Are you sure you want to disable two-factor authentication?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            dispatch(showLoader());

            try {
              const response = await disableTwoFactorAuth();

              if (response && response.data?.statusCode === 200) {
                showToastMessage(toast, 'success', response.data?.data?.message || '2FA disabled successfully');
                setTwoFactorEnabled(false);
              } else {
                showToastMessage(toast, 'danger', response.data?.data?.message || 'Failed to disable 2FA');
              }
            } catch (error) {
              showToastMessage(toast, 'danger', error?.response?.data?.data?.message || 'Error disabling 2FA');
            } finally {
              setLoading(false);
              dispatch(hideLoader());
            }
          },
        },
      ]
    );
  };

  const openInAuthenticator = async () => {
    try {
      if (!otpAuthUrl) {
        setErrorMessage('QR code not available');
        return;
      }

      const supported = await Linking.canOpenURL(otpAuthUrl);

      if (supported) {
        await Linking.openURL(otpAuthUrl);
      } else {
        Alert.alert(
          'No Authenticator App Found',
          'Please install an authenticator app to continue.',
          [
            {
              text: 'Google Authenticator',
              onPress: () => {
                const playStoreUrl = 'market://details?id=com.google.android.apps.authenticator2';
                const appStoreUrl = 'https://apps.apple.com/app/google-authenticator/id388497605';
                const webUrl = Platform.OS === 'android' ? playStoreUrl : appStoreUrl;

                Linking.openURL(webUrl).catch(() => {
                  const fallbackUrl = Platform.OS === 'android'
                    ? 'https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2'
                    : appStoreUrl;
                  Linking.openURL(fallbackUrl);
                });
              }
            },
            {
              text: 'Microsoft Authenticator',
              onPress: () => {
                const playStoreUrl = 'market://details?id=com.azure.authenticator';
                const appStoreUrl = 'https://apps.apple.com/app/microsoft-authenticator/id983156458';
                const webUrl = Platform.OS === 'android' ? playStoreUrl : appStoreUrl;

                Linking.openURL(webUrl).catch(() => {
                  const fallbackUrl = Platform.OS === 'android'
                    ? 'https://play.google.com/store/apps/details?id=com.azure.authenticator'
                    : appStoreUrl;
                  Linking.openURL(fallbackUrl);
                });
              }
            },
            {
              text: 'Cancel',
              style: 'cancel'
            }
          ],
          { cancelable: true }
        );
      }
    } catch (e) {
      setErrorMessage('Could not open authenticator app');
    }
  };

  return (
    <>
      <SafeAreaView style={[styles.container, bgStyle]}>
        <StatusBar barStyle="dark-content" />
        <ScrollView style={styles.content}>
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>🔐</Text>
            <Text style={styles.infoTitle}>Secure Your Account</Text>
            <Text style={styles.infoDescription}>
              Two-factor authentication adds an extra layer of security to your account
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.toggleItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>Enable 2FA</Text>
                <Text style={styles.toggleSubtitle}>Require code with password</Text>
              </View>
              <Switch
                value={twoFactorEnabled}
                onValueChange={(value) => {
                  if (value) {
                    handleEnable2FA();
                  } else {
                    handleDisable2FA();
                  }
                }}
                trackColor={{ false: '#E5E5EA', true: '#5B21B6' }}
                thumbColor="#FFFFFF"
                disabled={loading}
              />
            </View>
          </View>

          {twoFactorEnabled && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Authentication Methods</Text>
              <TouchableOpacity
                style={styles.methodItem}
                onPress={openInAuthenticator}
                disabled={loading}
              >
                <View style={styles.methodLeft}>
                  <Text style={styles.methodIcon}>📱</Text>
                  <View>
                    <Text style={styles.methodTitle}>Authenticator App</Text>
                    <Text style={styles.methodSubtitle}>Use Google Authenticator or similar</Text>
                  </View>
                </View>
                <Text style={styles.arrow}>›</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Verify OTP Modal */}
      <Modal
        visible={showVerifyModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!verifyLoading) {
            setShowVerifyModal(false);
            setVerifyOtp('');
            setErrorMessage('');
            otpInput.current?.clear();
          }
        }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={modalStyles.modalOverlay}>
            <SafeAreaView style={modalStyles.safeArea}>
              <KeyboardAwareScrollView
                style={modalStyles.scrollView}
                contentContainerStyle={modalStyles.scrollContent}
                showsVerticalScrollIndicator={false}
                enableOnAndroid
                enableAutomaticScroll
                extraScrollHeight={24}
                extraHeight={Platform.OS === 'ios' ? 120 : 150}
                keyboardOpeningTime={0}
                keyboardShouldPersistTaps="handled"
              >
                <View style={modalStyles.card}>
                  <TouchableOpacity
                    onPress={() => {
                      if (!verifyLoading) {
                        setShowVerifyModal(false);
                        setVerifyOtp('');
                        setErrorMessage('');
                        otpInput.current?.clear();
                      }
                    }}
                    disabled={verifyLoading}
                    style={modalStyles.closeButton}
                  >
                    <Icon name="close" size={24} color="#374151" />
                  </TouchableOpacity>

                  <View style={modalStyles.welcomeSection}>
                    <Text style={modalStyles.welcomeTitle}>Verify 2FA Setup</Text>
                    <Text style={modalStyles.welcomeSubtitle}>
                      Enter the 6-digit code from your authenticator app
                    </Text>
                  </View>

                  {/* Error Message Box */}
                  {errorMessage ? (
                    <View style={modalStyles.errorBox}>
                      <Icon name="alert-circle" size={20} color="#DC2626" style={modalStyles.errorIcon} />
                      <Text style={modalStyles.errorText}>{errorMessage}</Text>
                    </View>
                  ) : null}

                  <View style={modalStyles.qrSection}>
                    <TouchableOpacity
                      style={modalStyles.openAuthenticatorBtn}
                      onPress={openInAuthenticator}
                      disabled={verifyLoading}
                    >
                      <Text style={modalStyles.openAuthenticatorText}>📱 Open Authenticator</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={modalStyles.infoSection}>
                    <View style={modalStyles.infoBox}>
                      <Icon
                        name="information-circle"
                        size={20}
                        color="#3B82F6"
                        style={modalStyles.infoIcon}
                      />
                      <Text style={modalStyles.infoText}>
                        Open your authenticator app and enter the code displayed
                      </Text>
                    </View>
                  </View>

                  <View style={modalStyles.otpSection}>
                    <Text style={modalStyles.otpLabel}>Verification Code</Text>
                    <OTPTextInput
                      ref={otpInput}
                      handleTextChange={(text) => {
                        setVerifyOtp(text);
                        setErrorMessage(''); // Clear error when user types
                      }}
                      containerStyle={modalStyles.otpContainer}
                      textInputStyle={modalStyles.otpInput}
                      tintColor="#5B21B6"
                      offTintColor="#E5E7EB"
                      inputCount={6}
                    />
                  </View>

                  <TouchableOpacity
                    style={[
                      modalStyles.confirmButton,
                      (verifyLoading || verifyOtp.length !== 6) && modalStyles.confirmButtonDisabled,
                    ]}
                    onPress={handleVerify2FA}
                    disabled={verifyLoading || verifyOtp.length !== 6}
                  >
                    {verifyLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={modalStyles.confirmButtonText}>Verify & Enable 2FA</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      if (!verifyLoading) {
                        setShowVerifyModal(false);
                        setVerifyOtp('');
                        setErrorMessage('');
                        otpInput.current?.clear();
                      }
                    }}
                    disabled={verifyLoading}
                    style={modalStyles.cancelButton}
                  >
                    <Text style={modalStyles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </KeyboardAwareScrollView>
            </SafeAreaView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

const modalStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
    marginBottom: 8,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 22,
  },
  errorBox: {
    flexDirection: 'row',
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    alignItems: 'center',
  },
  errorIcon: {
    marginRight: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '500',
  },
  qrSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  openAuthenticatorBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#5B21B6',
    borderRadius: 10,
  },
  openAuthenticatorText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  infoSection: {
    marginBottom: 20,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
    alignItems: 'center',
  },
  infoIcon: {
    marginRight: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 19,
  },
  otpSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  otpLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
    textAlign: 'center',
  },
  otpContainer: {
    justifyContent: 'center',
  },
  otpInput: {
    width: 45,
    height: 56,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
    textAlign: 'center',
    marginHorizontal: 4,
  },
  confirmButton: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5B21B6',
    marginBottom: 12,
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  confirmButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelButton: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
});

export default TwoFactorAuthScreen;