import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Keyboard,
  ScrollView,
  Dimensions,
} from 'react-native';
import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useDispatch } from 'react-redux';
import { forgotPassword } from '../../../services/authentication';
import { showLoader, hideLoader } from '../../../redux/actions/LoaderAction';
import { useToast } from 'react-native-toast-notifications';
import CustomButton from '../../../components/customButton/customButton';
import { LogoIcon } from '../../../assets/icons';
import { AuthHeader } from '../../../components/auth';
import { showToastMessage } from '../../../components/displaytoastmessage';
import { useAppTheme } from '../../../theme/useApptheme';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const { width, height } = Dimensions.get('window');

const ForgetPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const [isEmailMode, setIsEmailMode] = useState(true);
  const toast = useToast();
  const { bgStyle, textStyle, text } = useAppTheme();

  const toggleMode = () => {
    setIsEmailMode(!isEmailMode);
  };

  const handleContinue = async () => {
    if (!EMAIL_REGEX.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }
    Keyboard.dismiss()
    dispatch(showLoader());
    try {
      const response = await forgotPassword({
        email,
      });
      console.log(response, 'response');
      if (response &&  response.statusCode == 200) {
        showToastMessage(toast, 'success', response.data.message);
        navigation.navigate('OTPScreen', { email, type: 'forgotpassword' });
        setError('');
      }else{
         showToastMessage(toast, 'danger', response.message);
      }
    } catch (error) {
      showToastMessage(toast, 'danger', 'An unexpected error occurred.');
    } finally {
      dispatch(hideLoader());
    }
  };

  return (
    <ScrollView
      style={[styles.container, bgStyle]}
      contentContainerStyle={[styles.contentContainer, bgStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Enhanced Header */}
      <AuthHeader
        title="Reset Password"
        subtitle="Enter your email address and we'll help you find your account"
        onBackPress={() => navigation.goBack()}
      />

      {/* Enhanced Form Card */}
      <View style={styles.formWrapper}>
        <View style={styles.card}>
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>Reset Password</Text>
            <Text style={styles.welcomeSubtitle}>
              Enter your email address and we'll help you find your account
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>
                {isEmailMode ? 'Email Address' : 'Phone Number'}
              </Text>
              <View style={[styles.inputGroup, error && styles.inputError]}>
                <TextInput
                  style={styles.textInput}
                  placeholder={
                    isEmailMode
                      ? 'Enter your email address'
                      : 'Enter your phone number'
                  }
                  placeholderTextColor="#9CA3AF"
                  keyboardType={isEmailMode ? 'email-address' : 'phone-pad'}
                  autoCapitalize="none"
                  value={email}
                  onChangeText={text => {
                    setEmail(text);
                    if (error) setError('');
                  }}
                />
              </View>
              {!!error && <Text style={styles.errorText}>{error}</Text>}
            </View>

            <View style={styles.infoSection}>
              <View style={[styles.infoBox, {borderLeftColor: text}]}>
                <Icon
                  name="information-circle"
                  size={20}
                  color={text}
                  style={styles.infoIcon}
                />
                <Text style={styles.infoText}>
                  You may receive an OTP code at this{' '}
                  {isEmailMode ? 'email' : 'phone number'} after clicking
                  Continue
                </Text>
              </View>
            </View>

            {/* Mode Toggle */}
            {/* <TouchableOpacity style={styles.toggleButton} onPress={toggleMode}>
        <Text style={styles.toggleText}>
                Use {isEmailMode ? 'phone number' : 'email address'} instead
        </Text>
      </TouchableOpacity> */}

            {/* Continue Button */}
            <TouchableOpacity
              style={[styles.continueButton, {backgroundColor: text, shadowColor: text}]}
              onPress={()=> handleContinue()}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>

          {/* Back to Login */}
          <View style={styles.backToLoginSection}>
            <Text style={styles.backToLoginText}>
              Remember your password?{' '}
              <Text
                style={[styles.backToLoginLink, textStyle]}
                onPress={() => navigation.goBack()}
              >
                Back to Login
              </Text>
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

export default ForgetPassword;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },

  // Form wrapper styles
  formWrapper: {
    flex: 1,
      marginTop: -20,
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

  // Toggle Button
  toggleButton: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 8,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // Continue Button
  continueButton: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 24,
  },
  continueButtonText: {
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
    fontWeight: '700',
  },
});
