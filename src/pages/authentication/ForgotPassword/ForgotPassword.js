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
import { useThemeContext } from '../../../theme/ThemeContext';
import { useLanguage } from '../../../i18n';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const { width, height } = Dimensions.get('window');

const withAlpha = (hex, alpha = 0.12) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return `rgba(90,45,130,${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const ForgetPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const [isEmailMode, setIsEmailMode] = useState(true);
  const toast = useToast();
  const { bgStyle, accent, card, border, mutedText } = useAppTheme('user');
  const { isDarkMode } = useThemeContext();
  const { t } = useLanguage();
  const surface = isDarkMode ? '#242424' : '#F9FAFB';
  const infoSurface = isDarkMode ? withAlpha(accent, 0.12) : '#F0F9FF';
  const foreground = isDarkMode ? '#F3F4F6' : '#1F2937';

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
        profileType="user"
        isFirstLaunch={true}
      />

      {/* Form Card */}
      <View style={styles.formWrapper}>
        <View style={[styles.card, { backgroundColor: card }]}>
          <View style={styles.welcomeSection}>
            <Text style={[styles.welcomeTitle, { color: foreground }]}>
              {t('forgotPassword.cardTitle')}
            </Text>
            <Text style={[styles.welcomeSubtitle, { color: mutedText }]}>
              {t('forgotPassword.cardSubtitle')}
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Text style={[styles.inputLabel, { color: foreground }]}>
                {isEmailMode
                  ? t('forgotPassword.emailLabel')
                  : t('forgotPassword.phonelabel')}
              </Text>
              <View style={[
                styles.inputGroup,
                { backgroundColor: surface, borderColor: border },
                error && styles.inputError,
              ]}>
                <TextInput
                  style={[styles.textInput, { color: foreground }]}
                  placeholder={
                    isEmailMode
                      ? t('forgotPassword.emailPlaceholder')
                      : t('forgotPassword.phonePlaceholder')
                  }
                  placeholderTextColor={mutedText}
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
              <View style={[styles.infoBox, { borderLeftColor: accent, backgroundColor: infoSurface }]}>
                <Icon
                  name="information-circle"
                  size={20}
                  color={accent}
                  style={styles.infoIcon}
                />
                <Text style={[styles.infoText, { color: mutedText }]}>
                  {isEmailMode
                    ? t('forgotPassword.infoTextEmail')
                    : t('forgotPassword.infoTextPhone')}
                </Text>
              </View>
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              style={[styles.continueButton, { backgroundColor: accent, shadowColor: accent }]}
              onPress={handleContinue}
            >
              <Text style={styles.continueButtonText}>
                {t('forgotPassword.continueButton')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Back to Login */}
          <View style={styles.backToLoginSection}>
            <Text style={[styles.backToLoginText, { color: mutedText }]}>
              {t('forgotPassword.rememberPassword')}{' '}
              <Text
                style={[styles.backToLoginLink, { color: accent }]}
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
    marginBottom: 12,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
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
    marginBottom: 8,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
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
    fontWeight: '400',
  },
  backToLoginLink: {
    fontWeight: '700',
  },
});