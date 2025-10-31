import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
// Removed expo LinearGradient - using pure React Native styling
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
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
import { getProfile } from '../../../services/createProfile';
import { loggedIn } from '../../../redux/actions/LoginAction';
import TextGradient from '../../../assets/textgradient/TextGradient';
import { AuthHeader } from '../../../components/auth';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const styles = createStyles();
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    getProfileData();
  }, []);

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
      // Alert.alert('Error', err.message /*|| 'Failed to fetch profile status'*/);
    } finally {
      dispatch(hideLoader());
    }
  };

  const handleGoogleLogin = async () => {
    dispatch(showLoader());
    try {
      await onGoogleButtonPress(dispatch, navigation, toast);
    } catch (error) {
      // Error is handled in onGoogleButtonPress, but you can add more here
    } finally {
      dispatch(hideLoader());
    }
  };

  const handlAppleLogin = async () => {
    dispatch(showLoader());
    try {
      await onAppleButtonPress(dispatch, navigation, toast);
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
    if (!email.trim()) errs.email = 'Email/Username is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Enter a valid email address';
    }

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

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleTwitterButtonPress = () => {
    dispatch(showLoader());
    twitterOAuthLogin(dispatch, toast, navigation);
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
        console.log('login response ===================>', response);

        showToastMessage(toast, 'success', response.data.message);
        await AsyncStorage.setItem('userId', response.data.user.id);
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
        {/* Enhanced Header */}
        <AuthHeader
          subtitle="Social media just got an upgrade"
          showBackButton={false}
          headerHeight={height * 0.28}
        />

        {/* Enhanced Form Card */}
        <View style={styles.formWrapper}>
          <View style={styles.card}>
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeTitle}>Welcome Back</Text>
              <Text style={styles.welcomeSubtitle}>
                Sign in to continue your journey
              </Text>
            </View>

            <View style={styles.inputContainer}>
              {/* Email Input */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Email or Username</Text>
                <View
                  style={[
                    styles.inputGroup,
                    errors.email && styles.inputError,
                  ]}
                >
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter your email or username"
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
                <Text style={styles.inputLabel}>Password</Text>
                <View
                  style={[
                    styles.inputGroup,
                    errors.password && styles.inputError,
                  ]}
                >
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter your password"
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

              <TouchableOpacity
                style={styles.forgotPasswordBtn}
                onPress={forgotPassword}
              >
                <Text style={styles.forgotPasswordText}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>

              {/* Enhanced Login Button */}
              <TouchableOpacity
                style={styles.loginButtonGradient}
                onPress={handleLogin}
              >
                <Text style={styles.loginButtonText}>Sign In</Text>
              </TouchableOpacity>
            </View>

            {/* Enhanced Divider */}
            <View style={styles.dividerSection}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Section Header */}
            <View style={styles.socialSectionHeader}>
              <Text style={styles.socialSectionTitle}>Social</Text>
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
                Don't have an account?{' '}
                <Text
                  style={styles.signupLink}
                  onPress={() => navigation.navigate('Signup')}
                >
                  Sign up
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
