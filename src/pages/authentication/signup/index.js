import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Keyboard,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { AppleLogo, Google, Twitter } from '../../../assets/icons';
import { hideLoader, showLoader } from '../../../redux/actions/LoaderAction';
import { showToastMessage } from '../../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import useSignupStyles from './Style';
import {
  onAppleButtonPress,
  onGoogleButtonPress,
  twitterOAuthLogin,
} from '../socialLogin';
import { signup } from '../../../services/authentication';
import Icon from 'react-native-vector-icons/Ionicons';
import { AuthHeader } from '../../../components/auth';
import DeviceInfo from 'react-native-device-info';
import { useAppTheme } from '../../../theme/useApptheme';
import { setUserProfile } from '../../../redux/actions/UserProfileAction';
import { setSignupFormData, clearSignupFormData } from '../../../redux/actions/SignupFormAction';
import { useLanguage } from '../../../i18n';

export default function SignupScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const toast = useToast();
  const dispatch = useDispatch();
  const { t } = useLanguage();

  const savedFormData = useSelector(state => state.signupForm);

  const [email, setEmail] = useState('');
  const [userName, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  const profileFromRoute = route?.params?.profile || 'user';
  const styles = useSignupStyles();
  const profile = profileFromRoute;
  const { bgStyle, text } = useAppTheme(profile);

  useFocusEffect(
    useCallback(() => {
      setEmail(savedFormData?.email || '');
      setUsername(savedFormData?.userName || '');
      setPassword(savedFormData?.password || '');
      setReferralCode(savedFormData?.referralCode || '');
    }, [savedFormData])
  );

  useEffect(() => {
    dispatch(setUserProfile(profile));
  }, [profile, dispatch]);

  useEffect(() => {
    const loadDeviceId = async () => {
      const DeviceId = await DeviceInfo.getDeviceName();
      console.log('Saved Device ID:', DeviceId);
    };
    loadDeviceId();
  }, []);

  const validate = () => {
    const errs = {};

    if (!email.trim()) errs.email = t('signup.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = t('signup.emailInvalid');
    }

    if (!userName.trim()) errs.userName = t('signup.usernameRequired');

    if (!password) {
      errs.password = t('signup.passwordRequired');
    } else if (password.length < 8) {
      errs.password = t('signup.passwordMinLength');
    } else if (
      !/(?=.*[A-Z])/.test(password) ||
      !/(?=.*[a-z])/.test(password) ||
      !/(?=.*\d)/.test(password) ||
      !/(?=.*[!@#$%^&*(),.?":{}|<>])/.test(password)
    ) {
      errs.password = t('signup.passwordRules');
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSignUp = async () => {
    Keyboard.dismiss();
    if (!validate()) return;

    const normalizedEmail = email.trim();
    const normalizedUserName = userName.trim();
    const normalizedReferralCode = referralCode.trim();

    dispatch(showLoader());
    try {
      const signupPayload = {
        email: normalizedEmail,
        password,
        registrationType: 'NORMAL',
        userName: normalizedUserName,
        profile,
      };

      if (normalizedReferralCode) {
        signupPayload.referrerCode = normalizedReferralCode;
      }

      const signupResponse = await signup(signupPayload);
      if (
        signupResponse &&
        (signupResponse.statusCode === 200 || signupResponse.statusCode === 201)
      ) {
        dispatch(hideLoader());
        dispatch(setSignupFormData({
          email: normalizedEmail,
          userName: normalizedUserName,
          password,
          referralCode: normalizedReferralCode,
        }));
        navigation.navigate('OTPScreen', {
          email: normalizedEmail,
          password,
          type: 'signup',
          profile,
        });
      } else {
        dispatch(hideLoader());
        showToastMessage(toast, 'danger', signupResponse?.message || 'Signup failed.');
      }
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.message || error?.message || 'Signup failed.',
      );
      dispatch(hideLoader());
    }
  };

  const handleGoogleButtonPress = async () => {
    dispatch(showLoader());
    try {
      await onGoogleButtonPress(dispatch, navigation, toast, profile, t);
    } finally {
      dispatch(hideLoader());
    }
  };

  const handlAppleLogin = async () => {
    dispatch(showLoader());
    try {
      await onAppleButtonPress(dispatch, navigation, toast, profile, t);
    } catch (error) {
      // handled inside
    } finally {
      dispatch(hideLoader());
    }
  };

  const handleTwitterButtonPress = async () => {
    dispatch(showLoader());
    twitterOAuthLogin(dispatch, toast, navigation, profile, t);
    dispatch(hideLoader());
  };

  const handleBackPress = () => {
    dispatch(clearSignupFormData());
    navigation.navigate('SelectAccountType');
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        enableAutomaticScroll
        extraScrollHeight={24}
        extraHeight={Platform.OS === 'ios' ? 120 : 150}
        resetScrollToCoords={{ x: 0, y: 0 }}
      >
        {/* Header */}
        <AuthHeader
          subtitle={t('signup.headerSubtitle')}
          profileType={profile}
          onBackPress={handleBackPress}
        />

        {/* Form Card */}
        <View style={styles.formWrapper}>
          <View style={styles.card}>
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeTitle}>{t('signup.welcomeTitle')}</Text>
              <Text style={styles.welcomeSubtitle}>{t('signup.welcomeSubtitle')}</Text>
            </View>

            <View style={styles.inputContainer}>
              {/* Email */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>{t('signup.emailLabel')}</Text>
                <View style={[styles.inputGroup, errors.email && styles.inputError]}>
                  <View style={[styles.inputIconContainer, bgStyle]}>
                    <Icon name="mail-outline" size={22} color={text} />
                  </View>
                  <TextInput
                    style={styles.textInput}
                    placeholder={t('signup.emailPlaceholder')}
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={value => {
                      setEmail(value);
                      if (errors.email) {
                        const next = { ...errors };
                        delete next.email;
                        setErrors(next);
                      }
                    }}
                  />
                </View>
                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
              </View>

              {/* Username */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>{t('signup.usernameLabel')}</Text>
                <View style={[styles.inputGroup, errors.userName && styles.inputError]}>
                  <View style={[styles.inputIconContainer, bgStyle]}>
                    <Icon name="person-outline" size={22} color={text} />
                  </View>
                  <TextInput
                    style={styles.textInput}
                    placeholder={t('signup.usernamePlaceholder')}
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                    value={userName}
                    onChangeText={value => {
                      setUsername(value);
                      if (errors.userName) {
                        const next = { ...errors };
                        delete next.userName;
                        setErrors(next);
                      }
                    }}
                  />
                </View>
                {errors.userName && <Text style={styles.errorText}>{errors.userName}</Text>}
              </View>

              {/* Password */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>{t('signup.passwordLabel')}</Text>
                <View style={[styles.inputGroup, errors.password && styles.inputError]}>
                  <View style={[styles.inputIconContainer, bgStyle]}>
                    <Icon name="lock-closed-outline" size={22} color={text} />
                  </View>
                  <TextInput
                    style={styles.textInput}
                    placeholder={t('signup.passwordPlaceholder')}
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    value={password}
                    onChangeText={value => {
                      setPassword(value);
                      if (errors.password) {
                        const next = { ...errors };
                        delete next.password;
                        setErrors(next);
                      }
                    }}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Icon
                      name={showPassword ? 'eye' : 'eye-off'}
                      size={20}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                </View>
                {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
              </View>

              {/* Referral Code */}
              <View style={styles.inputWrapper}>
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputLabel}>{t('signup.referralLabel')}</Text>
                  <View style={styles.optionalBadge}>
                    <Text style={styles.optionalBadgeText}>{t('signup.referralOptional')}</Text>
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <TextInput
                    style={styles.textInput}
                    placeholder={t('signup.referralPlaceholder')}
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={referralCode}
                    onChangeText={setReferralCode}
                  />
                </View>
                <Text style={styles.helperText}>{t('signup.referralHelper')}</Text>
              </View>

              {/* Sign Up Button */}
              <TouchableOpacity
                style={[styles.signupButton, { backgroundColor: text }]}
                onPress={handleSignUp}
              >
                <Text style={styles.signupButtonText}>{t('signup.createAccountButton')}</Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.orText}>{t('signup.dividerOr')}</Text>
                <View style={styles.divider} />
              </View>

              {/* Social Section */}
              <View style={styles.socialSectionHeader}>
                <Text style={[styles.socialSectionTitle, { color: text }]}>
                  {t('signup.socialSection')}
                </Text>
              </View>

              <View style={styles.socialButtonsContainer}>
                <TouchableOpacity style={styles.socialButton} onPress={handleGoogleButtonPress}>
                  <Google width={24} height={24} />
                  <Text style={styles.socialButtonText}>{t('signup.google')}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.socialButton} onPress={handleTwitterButtonPress}>
                  <Twitter width={24} height={24} />
                  <Text style={styles.socialButtonText}>{t('signup.twitter')}</Text>
                </TouchableOpacity>
              </View>

              {Platform.OS === 'ios' && (
                <TouchableOpacity style={styles.appleSocialButton} onPress={handlAppleLogin}>
                  <AppleLogo width={24} height={24} />
                  <Text style={styles.socialButtonText}>{t('signup.apple')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Already have account */}
            <View style={styles.loginSection}>
              <Text style={styles.loginText}>
                {t('signup.alreadyHaveAccount')}{' '}
                <Text
                  style={[styles.loginLink, { color: text }]}
                  onPress={() => navigation.navigate('Login')}
                >
                  {t('signup.logIn')}
                </Text>
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </TouchableWithoutFeedback>
  );
}