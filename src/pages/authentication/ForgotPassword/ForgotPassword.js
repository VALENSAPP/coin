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
import { AuthHeader } from '../../../components/auth';
import { showToastMessage } from '../../../components/displaytoastmessage';
import { useAppTheme } from '../../../theme/useApptheme';
import { useLanguage } from '../../../i18n';

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
  const { t } = useLanguage();

  const handleContinue = async () => {
    if (!EMAIL_REGEX.test(email.trim())) {
      setError(t('forgotPassword.emailInvalid'));
      return;
    }
    Keyboard.dismiss();
    dispatch(showLoader());
    try {
      const response = await forgotPassword({ email });
      if (response && response.statusCode == 200) {
        showToastMessage(toast, 'success', response.data.message);
        navigation.navigate('OTPScreen', { email, type: 'forgotpassword' });
        setError('');
      } else {
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
      {/* Header */}
      <AuthHeader
        title={t('forgotPassword.headerTitle')}
        subtitle={t('forgotPassword.headerSubtitle')}
        onBackPress={() => navigation.goBack()}
        isFirstLaunch={true}
      />

      {/* Form Card */}
      <View style={styles.formWrapper}>
        <View style={styles.card}>
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>{t('forgotPassword.cardTitle')}</Text>
            <Text style={styles.welcomeSubtitle}>
              {t('forgotPassword.cardSubtitle')}
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>
                {isEmailMode
                  ? t('forgotPassword.emailLabel')
                  : t('forgotPassword.phonelabel')}
              </Text>
              <View style={[styles.inputGroup, error && styles.inputError]}>
                <TextInput
                  style={styles.textInput}
                  placeholder={
                    isEmailMode
                      ? t('forgotPassword.emailPlaceholder')
                      : t('forgotPassword.phonePlaceholder')
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
              <View style={[styles.infoBox, { borderLeftColor: text }]}>
                <Icon
                  name="information-circle"
                  size={20}
                  color={text}
                  style={styles.infoIcon}
                />
                <Text style={styles.infoText}>
                  {isEmailMode
                    ? t('forgotPassword.infoTextEmail')
                    : t('forgotPassword.infoTextPhone')}
                </Text>
              </View>
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              style={[styles.continueButton, { backgroundColor: text, shadowColor: text }]}
              onPress={handleContinue}
            >
              <Text style={styles.continueButtonText}>
                {t('forgotPassword.continueButton')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Back to Login */}
          <View style={styles.backToLoginSection}>
            <Text style={styles.backToLoginText}>
              {t('forgotPassword.rememberPassword')}{' '}
              <Text
                style={[styles.backToLoginLink, textStyle]}
                onPress={() => navigation.goBack()}
              >
                {t('forgotPassword.backToLogin')}
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
  formWrapper: {
    flex: 1,
    marginTop: -20,
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