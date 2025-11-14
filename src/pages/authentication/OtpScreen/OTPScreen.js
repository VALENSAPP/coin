import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Keyboard,
  Dimensions,
  Platform,
  TouchableWithoutFeedback,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../../../components/displaytoastmessage';
import { login, sendEmailotp, verifyEmailOtp, verifyOtp } from '../../../services/authentication';
import { hideLoader, showLoader } from '../../../redux/actions/LoaderAction';
import CustomButton from '../../../components/customButton/customButton';
import { LogoIcon } from '../../../assets/icons';
import Icon from 'react-native-vector-icons/Ionicons';
import { AuthHeader } from '../../../components/auth';
import OTPTextInput from 'react-native-otp-textinput';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProfile } from '../../../services/createProfile';

const { width, height } = Dimensions.get('window');

export default function OTPScreen() {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const otpInput = useRef(null);
  const navigation = useNavigation();
  const route = useRoute();
  const toast = useToast();
  const dispatch = useDispatch();
  const { email, password, type } = route.params || {};

  useEffect(() => {
    handleResend();
  }, []);

  const handleConfirm = async () => {
    if (otp.length !== 6) {
      showToastMessage(toast, 'danger', 'Please enter a 6-digit code.');
      return;
    }
    // {
    //   if (type === 'signup') {
    //     // navigation.navigate('Login');
    //     handleLogin();
    //   } else {
    //     navigation.navigate('CreateNewPassword', { email, otp });
    //   }
    // }
    Keyboard.dismiss();
    setLoading(true);
    dispatch(showLoader());

    try {
      if (type === 'signup') {
        const response = await verifyEmailOtp({ email, otp });
        if (response && response.statusCode == 200) {
          showToastMessage(toast, 'success', response.data.message);
          handleLogin();
        } else {
          showToastMessage(toast, 'danger', response.message);
          setOtp('');
        }

      } else {
        const response = await verifyOtp({ email, otp });
        if (response && response.statusCode == 200) {
          showToastMessage(toast, 'success', response.data.message);
          navigation.navigate('CreateNewPassword', { email, otp });
        } else {
          showToastMessage(toast, 'danger', response.message);
          setOtp('');
        }
      }
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.data?.message || 'Verification failed',
      );
    } finally {
      setLoading(false);
      dispatch(hideLoader());
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    dispatch(showLoader());
    try {
      const response = await sendEmailotp({ email });
      if (response && response.statusCode == 200) {
        showToastMessage(toast, 'success', response.data.message);
        otpInput.current?.clear();
        setOtp('');
      } else {
        showToastMessage(toast, 'danger', response.message);
      }
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.message || 'Failed to resend code',
      );
    } finally {
      setResendLoading(false);
      dispatch(hideLoader());
    }
  };

  const handleLogin = async () => {
    Keyboard.dismiss();

    try {
      dispatch(showLoader());
      const response = await login({
        email,
        password,
        registrationType: 'NORMAL',
      });
      if (response && response.statusCode == 200) {
        console.log('login response ===================>', response);
        showToastMessage(toast, 'success', response.data.message);
        await AsyncStorage.setItem('userId', response?.data?.user?.id);
        await AsyncStorage.setItem('token', response.data.user.access_token);
        await AsyncStorage.setItem(
          'refreshToken',
          response.data.user.refresh_token,
        );
        if (
          response.data.user.walletAddress &&
          response.data.user.walletPrivateKey &&
          response.data.user.walletPrivateKey
        ) {
          await AsyncStorage.setItem(
            'walletAddress',
            response.data.user.walletAddress,
          );
          await AsyncStorage.setItem(
            'walletPrivateKey',
            response.data.user.walletPrivateKey,
          );
          await AsyncStorage.setItem(
            'walletMnemonic',
            response.data.user.walletMnemonic,
          );
        }
        await getProfileData('fromlogin', response?.data?.user?.id);
      } else {
        showToastMessage(toast, 'danger', response.message);
      }
    } catch (error) {
      showToastMessage(toast, 'success', error.response.message);
    } finally {
      dispatch(hideLoader());
    }
  };

  const getProfileData = async (type, userid) => {
    try {
      dispatch(showLoader());
      const storedId = await AsyncStorage.getItem('userId');
      const id = type === 'fromlogin' ? userid : storedId;

      if (id) {
        const response = await getProfile(id);
        if (response.statusCode === 200 && response.data.bio == null) {
          navigation.navigate('CreateProfile');
        } else {
          await AsyncStorage.setItem('isLoggedIn', 'true');
          dispatch(loggedIn());
        }
      }
    } catch (err) {
      console.log(err);
      Alert.alert('Error', err.message || 'Failed to fetch profile status');
    } finally {
      dispatch(hideLoader());
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'right', 'left']}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAwareScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          // KeyboardAware props that make it “just work”
          enableOnAndroid
          enableAutomaticScroll
          extraScrollHeight={24} // lift content a bit more
          extraHeight={Platform.OS === 'ios' ? 120 : 150}
          keyboardOpeningTime={0}
          keyboardShouldPersistTaps="handled"
          resetScrollToCoords={{ x: 0, y: 0 }}
        >
          {/* Header */}
          <AuthHeader
            subtitle="Verification Code"

            onBackPress={() => navigation.goBack()}
          />

          {/* Card */}
          <View style={styles.formWrapper}>
            <View style={styles.card}>
              <View style={styles.welcomeSection}>
                <Text style={styles.welcomeTitle}>Enter Confirmation Code</Text>
                <Text style={styles.welcomeSubtitle}>
                  Enter the 6-digit code sent to {email || 'your email'}
                </Text>
              </View>

              <View style={styles.infoSection}>
                <View style={styles.infoBox}>
                  <Icon
                    name="mail"
                    size={20}
                    color="#5a2d82"
                    style={styles.infoIcon}
                  />
                  <Text style={styles.infoText}>
                    Check your email inbox and spam folder for the verification
                    code
                  </Text>
                </View>
              </View>

              {/* OTP */}
              <View style={styles.otpSection}>
                <Text style={styles.otpLabel}>Verification Code</Text>
                <OTPTextInput
                  ref={otpInput}
                  handleTextChange={setOtp}
                  containerStyle={styles.otpContainer}
                  textInputStyle={styles.otpInput}
                  tintColor="#5a2d82"
                  offTintColor="#E5E7EB"
                  inputCount={6}
                // keyboardType="default" 
                />
              </View>

              {/* Confirm */}
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  (loading || otp.length !== 6) && styles.confirmButtonDisabled,
                ]}
                onPress={handleConfirm}
                disabled={loading || otp.length !== 6}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>Verify Code</Text>
                )}
              </TouchableOpacity>

              {/* Resend */}
              <View style={styles.resendSection}>
                <Text style={styles.resendPromptText}>
                  Didn't receive the code?
                </Text>
                <TouchableOpacity
                  onPress={handleResend}
                  disabled={resendLoading}
                  style={styles.resendButton}
                >
                  {resendLoading ? (
                    <View style={styles.resendLoadingContainer}>
                      <ActivityIndicator color="#5a2d82" size="small" />
                      <Text style={styles.resendLoadingText}>Sending...</Text>
                    </View>
                  ) : (
                    <Text style={styles.resendText}>Resend Code</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Back to Login */}
              <View style={styles.backToLoginSection}>
                <Text style={styles.backToLoginText}>
                  Having trouble?{' '}
                  <Text
                    style={styles.backToLoginLink}
                    onPress={() => navigation.navigate('Login')}
                  >
                    Back to Login
                  </Text>
                </Text>
              </View>
            </View>
          </View>
        </KeyboardAwareScrollView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f2fd' },
  container: { flex: 1, backgroundColor: '#f8f2fd' },
  contentContainer: { flexGrow: 1, backgroundColor: '#f8f2fd' },

  formWrapper: {
    flex: 1,
    marginTop: -30,
    paddingHorizontal: 7,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 32,
    minHeight: height * 0.75,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },

  welcomeSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10,
  },

  infoSection: {
    marginBottom: 32,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#5a2d82',
  },
  infoIcon: { marginRight: 12, marginTop: 1 },
  infoText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },

  otpSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  otpLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
    textAlign: 'center',
  },
  otpContainer: {
    marginBottom: 8,
    justifyContent: 'center',
    // marginLeft removed so fields stay centered in smaller screens
    marginLeft: 20,
  },
  otpInput: {
    width: 43,
    height: 56,
    borderWidth: 2,
    borderRadius: 12,
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
    textAlign: 'center',
    marginHorizontal: 4,
    shadowColor: '#5a2d82',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  confirmButton: {
    height: 52,
    backgroundColor: '#5a2d82',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5a2d82',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 24,
  },
  confirmButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0.1,
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  resendSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  resendPromptText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  resendButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resendText: {
    fontSize: 16,
    color: '#5a2d82',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  resendLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendLoadingText: {
    fontSize: 16,
    color: '#5a2d82',
    fontWeight: '600',
    marginLeft: 8,
  },

  backToLoginSection: {
    alignItems: 'center',
    marginTop: 16,
  },
  backToLoginText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '400',
  },
  backToLoginLink: {
    color: '#5a2d82',
    fontWeight: '700',
  },
});
