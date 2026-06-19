import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Keyboard,
  Alert,
  Platform,
  Image,
  TouchableWithoutFeedback,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
// Removed expo LinearGradient - using pure React Native styling
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import CustomButton from '../../../components/customButton/customButton';
import { AppleLogo, Google, Twitter } from '../../../assets/icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hideLoader, showLoader } from '../../../redux/actions/LoaderAction';
import { showToastMessage } from '../../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import createStyles from './Style';
import { Eyeopen, Eyeclosed, Metamask, LogoIcon } from '../../../assets/icons';
import {
  MetasmaskLogin,
  onAppleButtonPress,
  onGoogleButtonPress,
  twitterOAuthLogin,
} from '../socialLogin';
import { login, handleLoginSuccess } from '../../../services/authentication';
import { lockProfile } from '../../../services/kycverification';
import { getProfile } from '../../../services/createProfile';
import { loggedIn } from '../../../redux/actions/LoginAction';
import TextGradient from '../../../assets/textgradient/TextGradient';
import { AuthHeader } from '../../../components/auth';
import { setUserProfile } from '../../../redux/actions/UserProfileAction';
import { persistStripeCustomerId } from '../../../hooks/useStripeCustomer';
import DeviceInfo from 'react-native-device-info';
import { getOnboardingStatus } from '../../../services/profile';
import { ensureCurrentAccountSaved, ADDING_ACCOUNT_FLAG_KEY } from '../../../utils/accountSession';
import { requestUserPermission } from '../../../services/NotificationService';
import { setIsAddAccount } from '../../../redux/actions/AddAccountAction';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useLanguage } from '../../../i18n';
import { useAppTheme } from '../../../theme/useApptheme';
import { clearSignupFormData } from '../../../redux/actions/SignupFormAction';

const { width, height } = Dimensions.get('window');
const STRIPE_ONBOARDING_STATUS_KEY = 'stripeOnboardingStatus';

export default function LoginScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const styles = createStyles();
  const insets = useSafeAreaInsets();
  const [showPassword, setShowPassword] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const isAddAccount = useSelector(state => state.addAccount.isAddAccount);
  const { bgStyle, textStyle, bg, text } = useAppTheme();
  const { t, currentLanguage, languageNames, languages, changeLanguage, isLoading: langLoading } = useLanguage();

  const safeTop =
    insets.top > 0
      ? insets.top
      : Platform.OS === 'android'
        ? StatusBar.currentHeight ?? 0
        : 0;

  useFocusEffect(
    useCallback(() => {
      dispatch(setUserProfile('user'));
    }, [dispatch])
  );

  const getProfileData = async (type, userid) => {
    try {
      dispatch(showLoader());
      const storedId = await AsyncStorage.getItem('userId');
      const id = type === 'fromlogin' ? userid : storedId;
      if (id) {
        const response = await getProfile(id);
        console.log('in profile response ----->>>>>>>>> ', response)
        if (response?.statusCode === 200) {
          try {
            const onboardingStatusResponse = await getOnboardingStatus();
            if (onboardingStatusResponse?.statusCode === 200) {
              await AsyncStorage.setItem(
                STRIPE_ONBOARDING_STATUS_KEY,
                JSON.stringify(onboardingStatusResponse?.data ?? null),
              );
            }
          } catch (onboardingError) {
            console.log('getOnboardingStatus on login error:', onboardingError?.message);
          }
        }

        const normalizedKycStatus = String(response?.data?.kycStatus || '').toUpperCase();
        if (response.statusCode === 200 && (normalizedKycStatus === 'PENDING' || normalizedKycStatus === 'SUBMITTED' && normalizedKycStatus === 'true')) {
          requestUserPermission();
          await ensureCurrentAccountSaved({
            profile: response?.data?.profile || (await AsyncStorage.getItem('profile')) || 'normal',
            username: response?.data?.userName || response?.data?.username || (await AsyncStorage.getItem('username')),
            displayName: response?.data?.displayName || response?.data?.userName || response?.data?.username,
            email: response?.data?.email || (await AsyncStorage.getItem('email')),
          });
          await AsyncStorage.removeItem(ADDING_ACCOUNT_FLAG_KEY);
          await AsyncStorage.setItem('isLoggedIn', 'true');
          dispatch(loggedIn());
          dispatch(clearSignupFormData());
          dispatch(setIsAddAccount(false));
          // showToastMessage(toast, 'danger', 'KYC Verificaion is still pending. Please check again later.');
          return;
        }
        else if (response.statusCode === 200 && (normalizedKycStatus === 'DECLINED' || normalizedKycStatus === 'REJECTED')) {
          showToastMessage(toast, 'danger', 'KYC Verificaion is rejected. Please try again.', 3500);
          navigation.navigate('CreateProfile', { profile: response.data.profile || 'user', id });
        }
        else if (response.statusCode === 200 && response.data.kyc == false) {

          const profile = response.data.profile
          if (profile) {
            await AsyncStorage.setItem('profile', profile);
            dispatch(setUserProfile(profile));
          }
          navigation.navigate('CreateProfile', { profile: profile || 'user', id });
        }
        else if (response.statusCode === 200 && response.data.bio == null) {

          const profile = response.data.profile
          if (profile) {
            await AsyncStorage.setItem('profile', profile);
            dispatch(setUserProfile(profile));
          }
          navigation.navigate('CreateProfile', { profile: profile || 'user', id });
        }
        else {
          await persistStripeCustomerId(response?.data?.stripeCustomerId ?? null, dispatch);
          await ensureCurrentAccountSaved({
            profile: response?.data?.profile || (await AsyncStorage.getItem('profile')) || 'normal',
            username: response?.data?.userName || response?.data?.username || (await AsyncStorage.getItem('username')),
            displayName: response?.data?.displayName || response?.data?.userName || response?.data?.username,
            email: response?.data?.email || (await AsyncStorage.getItem('email')),
          });
          await AsyncStorage.removeItem(ADDING_ACCOUNT_FLAG_KEY);
          showToastMessage(toast, 'success', 'User logged in successfully');
          await AsyncStorage.setItem('isLoggedIn', 'true');
          dispatch(loggedIn());
          dispatch(clearSignupFormData());
          dispatch(setIsAddAccount(false));
        }
      }
    } catch (err) {
      console.log(err);
      // Alert.alert('Error', err.message /*|| 'Failed to fetch profile status'*/);
    } finally {
      dispatch(hideLoader());
    }
  };

  useEffect(() => {
    const loadDeviceId = async () => {
      const DeviceId = await DeviceInfo.getUniqueId();
      await AsyncStorage.setItem("device_id", DeviceId);
      console.log("Saved Device ID:", DeviceId);
    };

    loadDeviceId();
  }, []);

  const handleLangSelect = (lang) => {
    changeLanguage(lang);
    setShowLangDropdown(false);
    Keyboard.dismiss();
  };

  const handleGoogleLogin = async () => {
    dispatch(showLoader());
    try {
      await onGoogleButtonPress(dispatch, navigation, toast, 'user', t);
    } catch (error) {
      // Error is handled in onGoogleButtonPress, but you can add more here
    } finally {
      dispatch(hideLoader());
    }
  };

  const handlAppleLogin = async () => {
    dispatch(showLoader());
    try {
      await onAppleButtonPress(dispatch, navigation, toast, 'user', t);
    } catch (error) {
      // Error is handled in onGoogleButtonPress, but you can add more here
    } finally {
      dispatch(hideLoader());
    }
  };

  async function handleMetaMaskConnect() {
    MetasmaskLogin(toast, navigation, dispatch);
  }

  const validate = () => {
    const errs = {};

    // Check for blank fields
    if (!email.trim()) errs.email = t('login.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = t('login.emailInvalid');
    }

    if (!password) {
      errs.password = t('login.passwordRequired');
    } else if (password.length < 8) {
      errs.password = t('login.passwordMinLength');
    } else if (
      !/(?=.*[A-Z])/.test(password) ||
      !/(?=.*[a-z])/.test(password) ||
      !/(?=.*\d)/.test(password) ||
      !/(?=.*[!@#$%^&*(),.?":{}|<>])/.test(password)
    ) {
      errs.password = t('login.passwordRules');
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleTwitterButtonPress = () => {
    dispatch(showLoader());
    twitterOAuthLogin(dispatch, toast, navigation, 'user', t);
    dispatch(hideLoader());
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!email) setEmail(email.trim());
    if (!password) setPassword(password);
    if (!validate()) return;

    try {
      dispatch(showLoader());
      const response = await login({
        email,
        password,
        registrationType: 'NORMAL',
      });
      if (response && response.statusCode == 200) {
        console.log(response, "response===>>>>>>>>>>>>22222222222222222222222")
        await AsyncStorage.setItem('userId', response.data.user.id);
        await AsyncStorage.setItem('token', response.data.user.access_token);
        await AsyncStorage.setItem(
          'refreshToken',
          response.data.user.refresh_token,
        );
        if (response?.data?.user?.userName || response?.data?.user?.username) {
          await AsyncStorage.setItem(
            'username',
            response?.data?.user?.userName || response?.data?.user?.username,
          );
        }
        if (response?.data?.user?.email) {
          await AsyncStorage.setItem('email', response?.data?.user?.email);
        }
        const loginProfileType = String(response?.data?.user?.profile || 'user').toLowerCase();
        const normalizedProfileType =
          loginProfileType === 'company' || loginProfileType === 'business'
            ? 'company'
            : 'user';
        if (response?.data?.user?.profile) {
          await AsyncStorage.setItem('profile', response.data.user.profile);
        }
        try {
          const lockResponse = await lockProfile();
          const isLock = String(lockResponse?.data?.isLock ?? '').toLowerCase() === 'true';
          if (isLock) {
            const userId = response.data.user.id;

            const keys = await AsyncStorage.getAllKeys();
            const keysToRemove = keys.filter(
              key => key !== 'hasLaunchedBefore'
            );
            await AsyncStorage.multiRemove(keysToRemove);

            if (userId) {
              await AsyncStorage.setItem('userId', userId);
            }

            dispatch(setUserProfile('normal'));
            dispatch(setIsAddAccount(false));

            navigation.reset({
              index: 0,
              routes: [
                {
                  name: 'BlockedVerification',
                  params: { profile: normalizedProfileType },
                },
              ],
            });

            return;
          }
        } catch (lockError) {
          console.log('Profile lock check failed after login:', lockError?.message || lockError);
        }
        await persistStripeCustomerId(response.data.user.stripeCustomerId ?? null, dispatch);
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
        await getProfileData('fromlogin', response.data.user.id);
      } else {
        showToastMessage(toast, 'danger', response.message);
      }
    } catch (error) {
      showToastMessage(toast, 'success', error.response.message);
    } finally {
      dispatch(hideLoader());
    }
  };

  const forgotPassword = () => {
    navigation.navigate('ForgotPassword');
  };

  const handleBackToApp = async () => {
    try {
      await AsyncStorage.removeItem(ADDING_ACCOUNT_FLAG_KEY);
      dispatch(setIsAddAccount(false));
    } catch (e) {
      console.warn('handleBackToApp', e);
    }
  };

  return (
    // <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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
        {isAddAccount && (
          <View style={[styles.backToAppBar, { paddingTop: safeTop + 10 }]}>
            <TouchableOpacity
              style={styles.backToAppButton}
              onPress={handleBackToApp}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Back to the app"
            >
              <Icon name="arrow-back" size={22} color="#374151" />
              <Text style={styles.backToAppLabel}>{t('login.backToApp')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Enhanced Header */}
        <AuthHeader
          subtitle={t('login.socialMediaUpgrade')}
          showBackButton={false}
          headerHeight={height * 0.28}
          isFirstLaunch={false}
        />


        {/* Enhanced Form Card */}
        <View style={styles.formWrapper}>
          <View style={styles.card}>
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeTitle}>{t('login.welcomeTitle')}</Text>
              <Text style={styles.welcomeSubtitle}>
                {t('login.welcomeSubtitle')}
              </Text>
            </View>

            <View style={styles.inputContainer}>
              {/* Email Input */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>{t('login.emailLabel')}</Text>
                <View
                  style={[
                    styles.inputGroup,
                    errors.email && styles.inputError,
                  ]}
                >
                  <View style={[styles.inputIconContainer, bgStyle]}>
                    <Ionicons name="mail-outline" size={22} color={text} />
                  </View>
                  <TextInput
                    style={styles.textInput}
                    placeholder={t('login.emailPlaceholder')}
                    placeholderTextColor="#9CA3AF"
                    onChangeText={t => {
                      setEmail(t);
                      if (errors.email) validate();
                    }}
                    value={email}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    textContentType="username"
                    autoComplete="email"
                  />
                </View>
                {errors.email && (
                  <Text style={styles.errorText}>{errors.email}</Text>
                )}
              </View>

              {/* Password Input */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>{t('login.passwordLabel')}</Text>
                <View
                  style={[
                    styles.inputGroup,
                    errors.password && styles.inputError,
                  ]}
                >
                  <View style={[styles.inputIconContainer, bgStyle]}>
                    <Ionicons name="lock-closed-outline" size={22} color={text} />
                  </View>
                  <TextInput
                    style={styles.textInput}
                    placeholder={t('login.passwordPlaceholder')}
                    placeholderTextColor="#9CA3AF"
                    onChangeText={t => {
                      setPassword(t);
                      if (errors.password) validate();
                    }}
                    value={password}
                    secureTextEntry={!showPassword}
                    textContentType="password"
                    autoComplete="password"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.passwordToggle}
                  >
                    {showPassword ? <Eyeopen /> : <Eyeclosed />}
                  </TouchableOpacity>
                </View>
                {errors.password && (
                  <Text style={styles.errorText}>{errors.password}</Text>
                )}
              </View>

              {/* Language Selector */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>{t('login.selectLanguage')}</Text>
                <TouchableOpacity
                  style={[styles.inputGroup, styles.langDropdown]}
                  onPress={() => setShowLangDropdown(!showLangDropdown)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.inputIconContainer, bgStyle]}>
                    <Ionicons name="language" size={22} color={text} />
                  </View>
                  <Text style={styles.langText}>{languageNames[currentLanguage] || 'English'}</Text>
                  <Ionicons name={showLangDropdown ? "chevron-up" : "chevron-down"} size={22} color="#6B7280" />
                </TouchableOpacity>
                {showLangDropdown && (
                  <View style={styles.langDropdownList}>
                    {languages.map(lang => (
                      <TouchableOpacity
                        key={lang}
                        style={styles.langOption}
                        onPress={() => handleLangSelect(lang)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.langOptionText}>{languageNames[lang]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.forgotPasswordBtn}
                onPress={forgotPassword}
              >
                <Text style={styles.forgotPasswordText}>
                  {t('login.forgotPassword')}
                </Text>
              </TouchableOpacity>

              {/* Enhanced Login Button */}
              <TouchableOpacity
                style={styles.loginButtonGradient}
                onPress={handleLogin}
              >
                <Text style={styles.loginButtonText}>{t('login.signInButton')}</Text>
              </TouchableOpacity>
            </View>

            {/* Enhanced Divider */}
            <View style={styles.dividerSection}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('login.dividerOrContinue')}</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Section Header */}
            <View style={styles.socialSectionHeader}>
              <Text style={styles.socialSectionTitle}>{t('login.socialSection')}</Text>
            </View>

            {/* Enhanced Social Buttons */}
            <View style={styles.socialButtonsContainer}>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleGoogleLogin}
              >
                <Google width={24} height={24} />
                <Text style={styles.socialButtonText}>Google</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleTwitterButtonPress}
              >
                <Twitter width={24} height={24} />
                <Text style={styles.socialButtonText}>Twitter</Text>
              </TouchableOpacity>
            </View>

            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={styles.appleSocialButton}
                onPress={handlAppleLogin}
              >
                <AppleLogo width={24} height={24} />
                <Text style={styles.socialButtonText}>Apple</Text>
              </TouchableOpacity>
            )}

            {/* Sign Up Link */}
            <View style={styles.signupSection}>
              <Text style={styles.signupText}>
                {t('login.noAccountText')} {' '}
                <Text
                  style={styles.signupLink}
                  onPress={() => navigation.navigate('SelectAccountType')}
                >
                  {t('login.signUpLink')}
                </Text>
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </TouchableWithoutFeedback>
    // {/* </SafeAreaView> */}
  );
}
