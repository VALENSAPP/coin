import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
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
import { resetPassword } from '../../../services/authentication';
import { showToastMessage } from '../../../components/displaytoastmessage';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { AuthHeader } from '../../../components/auth';
import { useAppTheme } from '../../../theme/useApptheme';
import { useLanguage } from '../../../i18n';

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
  const { bgStyle, textStyle, text } = useAppTheme();
  const { t } = useLanguage(); // i18n

  const { email, otp } = route.params || {};

  const validate = () => {
    const errs = {};

    if (!password) {
      errs.password = t('newPassword.passwordRequired');
    } else if (password.length < 8) {
      errs.password = t('newPassword.passwordMinLength');
    } else if (
      !/(?=.*[A-Z])/.test(password) ||
      !/(?=.*[a-z])/.test(password) ||
      !/(?=.*\d)/.test(password) ||
      !/(?=.*[!@#$%^&*(),.?":{}|<>])/.test(password)
    ) {
      errs.password = t('newPassword.passwordRules');
    }

    if (!confirmPassword) {
      errs.confirmPassword = t('newPassword.confirmPasswordRequired');
    } else if (password !== confirmPassword) {
      errs.confirmPassword = t('newPassword.passwordMismatch');
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onReset = async () => {
    if (!validate()) return;

    Keyboard.dismiss();
    dispatch(showLoader());
    try {
      const newPassword = password;
      const response = await resetPassword({ email, newPassword });
      console.log('response in reset password', response);

      if (response.statusCode == 200 && response) {
        showToastMessage(toast, 'success', response.data.message);
        navigation.navigate('Login');
      } else {
        showToastMessage(toast, 'danger', response.message);
      }
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.message || 'Reset failed.'
      );
    } finally {
      dispatch(hideLoader());
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAwareScrollView
        style={[styles.container, bgStyle]}
        contentContainerStyle={[styles.contentContainer, bgStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        enableAutomaticScroll
        extraScrollHeight={24}
        extraHeight={Platform.OS === 'ios' ? 120 : 150}
        resetScrollToCoords={{ x: 0, y: 0 }}
      >
        <AuthHeader
          subtitle={t('newPassword.screenTitle')}
          onBackPress={() => navigation.goBack()}
        />

        {/* Enhanced Form Card */}
        <View style={styles.formWrapper}>
          <View style={styles.card}>
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeTitle}>{t('newPassword.cardTitle')}</Text>
              <Text style={styles.welcomeSubtitle}>
                {t('newPassword.cardSubtitle')}
              </Text>
            </View>

            <View style={styles.inputContainer}>
              {/* Password Requirements Info */}
              <View style={styles.infoSection}>
                <View style={[styles.infoBox, { borderLeftColor: text }]}>
                  <Ionicons
                    name="shield-checkmark"
                    size={20}
                    color={text}
                    style={styles.infoIcon}
                  />
                  <Text style={styles.infoText}>
                    {t('newPassword.infoBoxText')}
                  </Text>
                </View>
              </View>

              {/* New Password Input */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>{t('newPassword.newPasswordLabel')}</Text>
                <View
                  style={[
                    styles.inputGroup,
                    errors.password && styles.inputError,
                  ]}
                >
                  <TextInput
                    style={styles.textInput}
                    placeholder={t('newPassword.newPasswordPlaceholder')}
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
                <Text style={styles.inputLabel}>{t('newPassword.confirmPasswordLabel')}</Text>
                <View
                  style={[
                    styles.inputGroup,
                    errors.confirmPassword && styles.inputError,
                  ]}
                >
                  <TextInput
                    style={styles.textInput}
                    placeholder={t('newPassword.confirmPasswordPlaceholder')}
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
              <TouchableOpacity
                style={[styles.resetButton, { backgroundColor: text, shadowColor: text }]}
                onPress={onReset}
              >
                <Text style={styles.resetButtonText}>{t('newPassword.resetButton')}</Text>
              </TouchableOpacity>
            </View>

            {/* Back to Login */}
            <View style={styles.backToLoginSection}>
              <Text style={styles.backToLoginText}>
                {t('newPassword.rememberPassword')}{' '}
                <Text
                  style={[styles.backToLoginLink, textStyle]}
                  onPress={() => navigation.navigate('Login')}
                >
                  {t('newPassword.backToLogin')}
                </Text>
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flex: 1
  },
  contentContainer: {
    flexGrow: 1,
  },
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
  infoSection: {
    marginBottom: 24,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
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
  resetButton: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
  backToLoginSection: {
    alignItems: 'center',
    marginTop: 16,
  },
  backToLoginText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '400',
    textAlign: 'center'
  },
  backToLoginLink: {
    fontWeight: '700',
  },
});

export default NewPasswordScreen;