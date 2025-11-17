import React, { useState } from 'react';
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
import { useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { AppleLogo, Google, Twitter } from '../../../assets/icons';
import { hideLoader, showLoader } from '../../../redux/actions/LoaderAction';
import { showToastMessage } from '../../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import createStyles from './Style';
import {
  MetasmaskLogin,
  onAppleButtonPress,
  onGoogleButtonPress,
  twitterOAuthLogin,
} from '../socialLogin';
import { signup } from '../../../services/authentication';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialDesignIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AuthHeader } from '../../../components/auth';
import DeviceInfo from "react-native-device-info";
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SignupScreen() {
  const navigation = useNavigation();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [userName, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const styles = createStyles();
  const dispatch = useDispatch();
  const profile = isChecked ? 'company' : 'user';

  useEffect(() => {
    const loadDeviceId = async () => {
      const DeviceId = await DeviceInfo.getDeviceName();
      await AsyncStorage.setItem("device_id", DeviceId);
      console.log("Saved Device ID:", DeviceId);
    };

    loadDeviceId();
  }, []);

  const validate = () => {
    const errs = {};

    // Check for blank fields
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Enter a valid email address';
    }

    if (!userName.trim()) errs.userName = 'Username is required';

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
  const toggleCheckbox = () => {
    setIsChecked(prev => !prev);
  };
  const handleSignUp = async () => {
    Keyboard.dismiss();
    if (!validate()) return;

    dispatch(showLoader());
    try {
      const signupResponse = await signup({
        email,
        password,
        registrationType: 'NORMAL',
        userName,
        profile,
      });
      if (
        signupResponse &&
        (signupResponse.statusCode == 200 || signupResponse.statusCode == 201)
      ) {
        dispatch(hideLoader());
        // showToastMessage(toast, 'success', 'OTP sent to your email.');
        navigation.navigate('OTPScreen', { email, password, type: 'signup' });
        setPassword('');
        setEmail(''), setUsername('');
      } else {
        dispatch(hideLoader());
        showToastMessage(
          toast,
          'danger',
          signupResponse?.message || 'Signup failed.',
        );
      }
    } catch (error) {
      showToastMessage(toast, 'success', error.response.message);
      dispatch(hideLoader());
    }
  };

  const handleGoogleButtonPress = async () => {
    dispatch(showLoader());
    try {
      await onGoogleButtonPress(dispatch, navigation, toast, profile);
    } finally {
      dispatch(hideLoader());
    }
  };

  const handlAppleLogin = async () => {
    dispatch(showLoader());
    try {
      await onAppleButtonPress(dispatch, navigation, toast, profile);
    } catch (error) {
      // Error is handled in onGoogleButtonPress, but you can add more here
    } finally {
      dispatch(hideLoader());
    }
  };

  const handleTwitterButtonPress = async () => {
    dispatch(showLoader());
    twitterOAuthLogin(dispatch, toast, navigation, profile);
    dispatch(hideLoader());
  };

  async function handleMetaMaskConnect() {
    MetasmaskLogin(toast, navigation, dispatch);
  }

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
          subtitle="Create Account"
          onBackPress={() => navigation.goBack()}
        />

        {/* Enhanced Form Card */}
        <View style={styles.formWrapper}>
          <View style={styles.card}>
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeTitle}>Join Valens</Text>
              <Text style={styles.welcomeSubtitle}>
                Sign up to see photos and videos from your friends
              </Text>
            </View>

            <View style={styles.inputContainer}>
              {/* Email Input */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <View
                  style={[
                    styles.inputGroup,
                    errors.email && styles.inputError,
                  ]}
                >
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter your email address"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={text => {
                      setEmail(text);
                      if (errors.email) {
                        const newErrors = { ...errors };
                        delete newErrors.email;
                        setErrors(newErrors);
                      }
                    }}
                  />
                </View>
                {errors.email && (
                  <Text style={styles.errorText}>{errors.email}</Text>
                )}
              </View>

              {/* Username Input */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Username</Text>
                <View
                  style={[
                    styles.inputGroup,
                    errors.userName && styles.inputError,
                  ]}
                >
                  <TextInput
                    style={styles.textInput}
                    placeholder="Choose a username"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                    value={userName}
                    onChangeText={text => {
                      setUsername(text);
                      if (errors.userName) {
                        const newErrors = { ...errors };
                        delete newErrors.userName;
                        setErrors(newErrors);
                      }
                    }}
                  />
                </View>
                {errors.userName && (
                  <Text style={styles.errorText}>{errors.userName}</Text>
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
                    placeholder="Create a strong password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showPassword}
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
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Icon
                      name={showPassword ? 'eye' : 'eye-off'}
                      size={20}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                </View>
                {errors.password && (
                  <Text style={styles.errorText}>{errors.password}</Text>
                )}
              </View>

              <View>
                <TouchableOpacity onPress={toggleCheckbox} style={styles.checkboxContainer}>
                  {/* Conditionally render icons based on checkbox state */}
                  <MaterialDesignIcons
                    name={isChecked ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={30}
                    color={isChecked ? '#5a2d82' : 'gray'}
                  />
                  <Text style={styles.text}>
                    This is a business account
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Sign Up Button */}
              <TouchableOpacity
                style={styles.signupButton}
                onPress={handleSignUp}
              >
                <Text style={styles.signupButtonText}>Create Account</Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.orText}>OR</Text>
                <View style={styles.divider} />
              </View>

              {/* Social Section Header */}
              <View style={styles.socialSectionHeader}>
                <Text style={styles.socialSectionTitle}>Social</Text>
              </View>

              {/* Social Login Buttons */}
              {/* <TouchableOpacity style={styles.googleButton} onPress={handleGoogleButtonPress}>
              <Google width={24} height={24} />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.twitterButton} onPress={handleTwitterButtonPress}>
              <Twitter width={24} height={24} />
              <Text style={styles.twitterButtonText}>Continue with Twitter</Text>
            </TouchableOpacity> */}

              <View style={styles.socialButtonsContainer}>
                <TouchableOpacity
                  style={styles.socialButton}
                  onPress={handleGoogleButtonPress}
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

              {/* Terms Text */}
              {/* <Text style={styles.termsText}>
              By signing up, you agree to our Terms, Privacy Policy and Cookies
              Policy.
            </Text> */}
            </View>

            {/* Already Have Account */}
            <View style={styles.loginSection}>
              <Text style={styles.loginText}>
                Already have an account?{' '}
                <Text
                  style={styles.loginLink}
                  onPress={() => navigation.navigate('Login')}
                >
                  Log in
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
