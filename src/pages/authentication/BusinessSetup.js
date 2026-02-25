import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  Dimensions,
  Alert,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { useToast } from 'react-native-toast-notifications';
import { AuthHeader } from '../../components/auth';
import { showToastMessage } from '../../components/displaytoastmessage';
import {
  CreateCompanyProfile,
  GetCompanyProfile,
  UpdateCompanyProfile,
} from '../../services/companyProfile';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { useAppTheme } from '../../theme/useApptheme';

const { height } = Dimensions.get('window');

const BusinessProfileForm = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const profileData = route?.params?.profileData ?? null;
  const serverProfile = route?.params?.serverProfile ?? null;
  const dispatch = useDispatch();
  const toast = useToast();
  const { bgStyle, text } = useAppTheme();

  const [form, setForm] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    phone: '',
    category: '',
    address: '',
    description: '',
    website: '',
    gstNumber: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasExistingCompanyProfile, setHasExistingCompanyProfile] = useState(false);

  const handleChange = (key, value) => {
    setForm({ ...form, [key]: value });
    if (errors[key]) {
      const next = { ...errors };
      delete next[key];
      setErrors(next);
    }
  };

  const proceedToKyc = () => {
    navigation.navigate('kycverify', {
      profileData,
      serverProfile,
      businessProfile: form,
    });
  };

  const isAlreadyCreatedResponse = response => {
    const message = String(response?.message || '').toLowerCase();
    return message.includes('already created') || message.includes('use update');
  };

  const mapCompanyProfileToForm = data => ({
    businessName: data?.businessName || '',
    ownerName: data?.ownerName || '',
    email: data?.email || '',
    phone: data?.phoneNumber || data?.phone || '',
    category: data?.category || '',
    address: data?.address || '',
    description: data?.description || '',
    website: data?.website || '',
    gstNumber: data?.gstNumber || '',
  });

  const fetchCompanyProfile = async () => {
    try {
      const response = await GetCompanyProfile();
      const code = response?.statusCode;
      const companyData = response?.data || {};

      if ((code === 200 || code === 201) && Object.keys(companyData).length > 0) {
        setForm(mapCompanyProfileToForm(companyData));
        setHasExistingCompanyProfile(true);
      } else {
        setHasExistingCompanyProfile(false);
      }
    } catch (error) {
      setHasExistingCompanyProfile(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchCompanyProfile();
    }, []),
  );

  const handleSubmit = async () => {
    const nextErrors = {};
    if (!form.businessName.trim()) nextErrors.businessName = 'Business name is required';
    if (!form.phone.trim()) nextErrors.phone = 'Phone number is required';

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      Alert.alert('Missing details', 'Please complete all required fields.');
      return;
    }

    const payload = {
      businessName: form.businessName.trim(),
      ownerName: form.ownerName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      phoneNumber: form.phone.trim(),
      category: form.category.trim(),
      address: form.address.trim(),
      description: form.description.trim(),
      website: form.website.trim(),
      gstNumber: form.gstNumber.trim(),
    };

    setIsSubmitting(true);
    dispatch(showLoader());
    try {
      if (hasExistingCompanyProfile) {
        const updateResponse = await UpdateCompanyProfile(payload);
        const updateCode = updateResponse?.statusCode;

        if (updateCode === 200 || updateCode === 201) {
          showToastMessage(
            toast,
            'success',
            updateResponse?.message || 'Business profile updated successfully.',
          );
          proceedToKyc();
        } else {
          showToastMessage(
            toast,
            'danger',
            updateResponse?.message || 'Failed to update business profile.',
          );
        }
      } else {
        const response = await CreateCompanyProfile(payload);
        const code = response?.statusCode;

        if (code === 200 || code === 201) {
          showToastMessage(
            toast,
            'success',
            response?.message || 'Business profile saved successfully.',
          );
          setHasExistingCompanyProfile(true);
          proceedToKyc();
          return;
        }

        if (isAlreadyCreatedResponse(response)) {
          const updateResponse = await UpdateCompanyProfile(payload);
          const updateCode = updateResponse?.statusCode;

          if (updateCode === 200 || updateCode === 201) {
            showToastMessage(
              toast,
              'success',
              updateResponse?.message || 'Business profile updated successfully.',
            );
            setHasExistingCompanyProfile(true);
            proceedToKyc();
          } else {
            showToastMessage(
              toast,
              'danger',
              updateResponse?.message || 'Failed to update business profile.',
            );
          }
        } else {
          showToastMessage(
            toast,
            'danger',
            response?.message || 'Failed to save business profile.',
          );
        }
      }
    } catch (error) {
      showToastMessage(toast, 'danger', 'Unable to save business profile.');
    } finally {
      setIsSubmitting(false);
      dispatch(hideLoader());
    }
  };

  const fields = [
    { key: 'businessName', label: 'Business Name *', placeholder: 'Enter your business name' },
    { key: 'ownerName', label: 'Owner Name', placeholder: 'Enter owner name' },
    {
      key: 'email',
      label: 'Business Email',
      placeholder: 'Enter business email',
      keyboardType: 'email-address',
      autoCapitalize: 'none',
    },
    {
      key: 'phone',
      label: 'Phone Number *',
      placeholder: 'Enter contact number',
      keyboardType: 'phone-pad',
    },
    { key: 'category', label: 'Business Category', placeholder: 'Ex: Retail, Services, Food' },
    { key: 'address', label: 'Business Address', placeholder: 'Enter business address' },
    {
      key: 'description',
      label: 'Business Description',
      placeholder: 'Tell us about your business',
      multiline: true,
      numberOfLines: 4,
    },
    {
      key: 'website',
      label: 'Website',
      placeholder: 'https://yourdomain.com',
      autoCapitalize: 'none',
    },
    { key: 'gstNumber', label: 'GST / Tax ID', placeholder: 'Enter GST or tax ID' },
  ];

  return (
    <SafeAreaView style={[styles.safe, bgStyle]} edges={['top', 'right', 'left']}>
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
          <AuthHeader subtitle="Business Setup" onBackPress={() => navigation.goBack()} />

          <View style={styles.formWrapper}>
            <View style={styles.card}>
              <View style={styles.welcomeSection}>
                <Text style={styles.welcomeTitle}>Set Up Business Profile</Text>
                <Text style={styles.welcomeSubtitle}>
                  Add your business details to continue KYC verification
                </Text>
              </View>

              <View style={styles.inputContainer}>
                {fields.map(field => (
                  <View key={field.key} style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>{field.label}</Text>
                    <View style={[styles.inputGroup, errors[field.key] && styles.inputError]}>
                      <TextInput
                        style={[styles.textInput, field.multiline && styles.textArea]}
                        placeholder={field.placeholder}
                        placeholderTextColor="#9CA3AF"
                        value={form[field.key]}
                        onChangeText={value => handleChange(field.key, value)}
                        keyboardType={field.keyboardType || 'default'}
                        autoCapitalize={field.autoCapitalize || 'sentences'}
                        multiline={field.multiline}
                        numberOfLines={field.numberOfLines}
                        textAlignVertical={field.multiline ? 'top' : 'center'}
                      />
                    </View>
                    {errors[field.key] ? (
                      <Text style={styles.errorText}>{errors[field.key]}</Text>
                    ) : null}
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: text, shadowColor: text }]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? 'Saving...' : 'Continue'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAwareScrollView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
};

export default BusinessProfileForm;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flex: 1,
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
    padding: 20,
    minHeight: height * 0.8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 10,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  inputContainer: {
    width: '100%',
  },
  inputWrapper: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputGroup: {
    minHeight: 52,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  textInput: {
    flex: 1,
    color: '#1F2937',
    fontSize: 16,
    paddingVertical: 0,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
    paddingBottom: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 5,
    marginLeft: 4,
    fontWeight: '500',
  },
  submitButton: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 17,
  },
});
