import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Keyboard,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';

import Ionicons from 'react-native-vector-icons/Ionicons';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../../redux/actions/LoaderAction';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useToast } from 'react-native-toast-notifications';
import { forgotPassword } from '../../../services/authentication';
import { showToastMessage } from '../../../components/displaytoastmessage';
import { LogoIcon } from '../../../assets/icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthHeader } from '../../../components/auth';

const { width, height } = Dimensions.get('window');

const NewPasswordScreen = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [secureTextEntryConfirm, setSecureTextEntryConfirm] = useState(true);
  const [errors, setErrors] = useState({});
  const dispatch = useDispatch();
  const toast = useToast();
  const navigation = useNavigation();
  const route = useRoute();

  const { email, otp } = route.params || {};

  const validate = () => {
    const errs = {};

    if (!password) {
      errs.password = 'Password is required';
    } else if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters';
    } else if (
      !/(?=.*[A-Z])/.test(password) ||
      !/(?=.*[a-z])/.test(password) ||
      !/(?=.*\d)/.test(password) ||
      !/(?=.*[!@#$%^&*(),.?":{}|<>])/.test(password)
    ) {
      errs.password =
        'Password must include uppercase, lowercase, number & special character';
    }

    if (!confirmPassword) {
      errs.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onReset = async () => {
    if (!validate()) return;

    Keyboard.dismiss();
    // dispatch(showLoader());
    navigation.navigate('Login');
    // try {
    //   const newPassword = password;
    //   const response = await forgotPassword({ email, otp, newPassword });

    //   if (response.statusCode == 200 && response) {
    //     showToastMessage(toast, 'success', response.data.message);
    //   } else {
    //     showToastMessage(toast, 'danger', response.message);
    //   }
    // } catch (error) {
    //   showToastMessage(
    //     toast,
    //     'danger',
    //     error?.message || 'Reset failed.'
    //   );
    // } finally {
    //   dispatch(hideLoader());
    // }
  };

  return (
    // <SafeAreaView style={styles.safe} edges={['top', 'right', 'left']}>
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        enableAutomaticScroll
        extraScrollHeight={24} // adjust if needed
        extraHeight={Platform.OS === 'ios' ? 120 : 150}
        resetScrollToCoords={{ x: 0, y: 0 }}
      >
        <AuthHeader
          subtitle="Create New Password"
          onBackPress={() => navigation.goBack()}
        />

        {/* Enhanced Form Card */}
        <View style={styles.formWrapper}>
          <View style={styles.card}>
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeTitle}>Create New Password</Text>
              <Text style={styles.welcomeSubtitle}>
                Please choose a new password that's at least 8 characters long
                and secure
              </Text>
            </View>

            <View style={styles.inputContainer}>
              {/* Password Requirements Info */}
              <View style={styles.infoSection}>
                <View style={styles.infoBox}>
                  <Ionicons
                    name="shield-checkmark"
                    size={20}
                    color="#5a2d82"
                    style={styles.infoIcon}
                  />
                  <Text style={styles.infoText}>
                    Your password must include uppercase, lowercase, numbers and
                    special characters
                  </Text>
                </View>
              </View>

              {/* New Password Input */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>New Password</Text>
                <View
                  style={[
                    styles.inputGroup,
                    errors.password && styles.inputError,
                  ]}
                >
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter your new password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={secureTextEntry}
                    autoCapitalize="none"
                    value={password}
                    onChangeText={text => {
                      setPassword(text);
                      if (errors.password) {
                        const newErrors = { ...errors };
                        delete newErrors.password;
                        setErrors(newErrors);
                      }
                    }}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setSecureTextEntry(!secureTextEntry)}
                  >
                    <Ionicons
                      name={secureTextEntry ? 'eye-off' : 'eye'}
                      size={20}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                </View>
                {errors.password && (
                  <Text style={styles.errorText}>{errors.password}</Text>
                )}
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Confirm Password</Text>
                <View
                  style={[
                    styles.inputGroup,
                    errors.confirmPassword && styles.inputError,
                  ]}
                >
                  <TextInput
                    style={styles.textInput}
                    placeholder="Confirm your new password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={secureTextEntryConfirm}
                    autoCapitalize="none"
                    value={confirmPassword}
                    onChangeText={text => {
                      setConfirmPassword(text);
                      if (errors.confirmPassword) {
                        const newErrors = { ...errors };
                        delete newErrors.confirmPassword;
                        setErrors(newErrors);
                      }
                    }}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() =>
                      setSecureTextEntryConfirm(!secureTextEntryConfirm)
                    }
                  >
                    <Ionicons
                      name={secureTextEntryConfirm ? 'eye-off' : 'eye'}
                      size={20}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                </View>
                {errors.confirmPassword && (
                  <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                )}
              </View>

              {/* Reset Password Button */}
              <TouchableOpacity style={styles.resetButton} onPress={onReset}>
                <Text style={styles.resetButtonText}>Reset Password</Text>
              </TouchableOpacity>
            </View>

            {/* Back to Login */}
            <View style={styles.backToLoginSection}>
              <Text style={styles.backToLoginText}>
                Remember your password?{' '}
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
    // </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f2fd' },
  container: {
    flex: 1,
    backgroundColor: '#f8f2fd',
  },
  contentContainer: {
    flexGrow: 1,
    backgroundColor: '#f8f2fd',
  },

  // Form wrapper styles
  formWrapper: {
    flex: 1,
    marginTop: -30,
    paddingHorizontal: 7,
  },

  // Enhanced Card Styles
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

  // Welcome Section
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

  // Enhanced Input Styles
  inputContainer: {
    width: '100%',
  },
  inputWrapper: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '400',
  },
  eyeIcon: {
    padding: 4,
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '500',
  },

  // Info Section
  infoSection: {
    marginBottom: 24,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#5a2d82',
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },

  // Reset Password Button
  resetButton: {
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
    marginTop: 8,
  },
  resetButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Back to Login Section
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

export default NewPasswordScreen;
