import React, { useCallback, useRef, useState, useEffect } from 'react';
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
  Image,
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
  UploadDocument,
  UpdateCompanyProfile,
  startVerification,
  CheckVerificationStatus,
} from '../../services/companyProfile';
import { EditProfile } from '../../services/createProfile';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { useAppTheme } from '../../theme/useApptheme';
import { setUserProfile } from '../../redux/actions/UserProfileAction';
import { pick } from '@react-native-documents/picker';
import { launchImageLibrary } from 'react-native-image-picker';
import SNSMobileSDK from '@sumsub/react-native-mobilesdk-module';
import CountryPicker, { getAllCountries } from 'react-native-country-picker-modal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loggedIn } from '../../redux/actions/LoginAction';
import { setIsAddAccount } from '../../redux/actions/AddAccountAction';
import { useLanguage } from '../../i18n';
import { clearSignupFormData } from '../../redux/actions/SignupFormAction';

const { height } = Dimensions.get('window');

const BusinessProfileForm = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const profileData = route?.params?.profileData ?? null;
  const serverProfile = route?.params?.serverProfile ?? null;
  const profileFromRoute = route?.params?.profile || profileData?.profile || 'user';
  const dispatch = useDispatch();
  const toast = useToast();
  const { bgStyle, text } = useAppTheme(profileFromRoute);
  const { t } = useLanguage();

  useEffect(() => {
    dispatch(setUserProfile(profileFromRoute));
  }, [profileFromRoute, dispatch]);

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
  const [selectedCountry, setSelectedCountry] = useState({ cca2: 'US', callingCode: ['1'] });
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isDocumentUploaded, setIsDocumentUploaded] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [isLaunchingSumsub, setIsLaunchingSumsub] = useState(false);
  const sumsubLaunchLockRef = useRef(false);
  const hasSavedUserProfileRef = useRef(false);

  // Build field definitions inside component so t() is in scope
  const fields = [
    { key: 'businessName', label: t('businessProfile.fields.businessName'),        placeholder: t('businessProfile.fields.businessNamePlaceholder') },
    { key: 'ownerName',    label: t('businessProfile.fields.ownerName'),            placeholder: t('businessProfile.fields.ownerNamePlaceholder') },
    { key: 'email',        label: t('businessProfile.fields.email'),                placeholder: t('businessProfile.fields.emailPlaceholder'),        keyboardType: 'email-address', autoCapitalize: 'none' },
    { key: 'phone',        label: t('businessProfile.fields.phone'),                placeholder: t('businessProfile.fields.phonePlaceholder'),         keyboardType: 'phone-pad' },
    { key: 'category',     label: t('businessProfile.fields.category'),             placeholder: t('businessProfile.fields.categoryPlaceholder') },
    { key: 'address',      label: t('businessProfile.fields.address'),              placeholder: t('businessProfile.fields.addressPlaceholder'),       multiline: true, numberOfLines: 3, autoCapitalize: 'words' },
    { key: 'description',  label: t('businessProfile.fields.description'),          placeholder: t('businessProfile.fields.descriptionPlaceholder'),   multiline: true, numberOfLines: 4 },
    { key: 'website',      label: t('businessProfile.fields.website'),              placeholder: t('businessProfile.fields.websitePlaceholder'),       autoCapitalize: 'none' },
    { key: 'gstNumber',    label: t('businessProfile.fields.gstNumber'),            placeholder: t('businessProfile.fields.gstNumberPlaceholder') },
  ];

  const handleChange = (key, value) => {
    setForm({ ...form, [key]: value });
    if (errors[key]) {
      const next = { ...errors };
      delete next[key];
      setErrors(next);
    }
  };

  const getDialCode = useCallback(
    () => `+${selectedCountry?.callingCode?.[0] || '1'}`,
    [selectedCountry],
  );

  const normalizePhoneWithCountryCode = useCallback(
    rawPhone => {
      const value = String(rawPhone || '').trim();
      const digits = value.replace(/\D/g, '');
      const dialCodeDigits = getDialCode().replace(/\D/g, '');
      if (!digits) return '';
      if (value.startsWith('+')) return `+${digits}`;
      if (digits.startsWith(dialCodeDigits)) return `+${digits}`;
      return `+${dialCodeDigits}${digits}`;
    },
    [getDialCode],
  );

  const getPhoneInputValue = useCallback(() => {
    const phoneValue = String(form.phone || '');
    const dialCodeDigits = getDialCode().replace(/\D/g, '');
    const phoneDigits = phoneValue.replace(/\D/g, '');
    if (phoneDigits.startsWith(dialCodeDigits)) return phoneDigits.slice(dialCodeDigits.length);
    return phoneValue.replace(/[^\d\s\-()]/g, '');
  }, [form.phone, getDialCode]);

  const handlePhoneChange = value => {
    const sanitized = String(value || '').replace(/[^\d\s\-()]/g, '');
    const localDigits = sanitized.replace(/\D/g, '');
    const dialCodeDigits = getDialCode().replace(/\D/g, '');
    const combined = `${dialCodeDigits}${localDigits}`;
    handleChange('phone', combined ? `+${combined}` : '');
  };

  const handleCountrySelect = country => {
    const nextCountry = {
      cca2: country?.cca2 || 'US',
      callingCode: country?.callingCode?.length ? country.callingCode : ['1'],
    };
    const currentDigits = String(form.phone || '').replace(/\D/g, '');
    const currentDial = getDialCode().replace(/\D/g, '');
    const localDigits = currentDigits.startsWith(currentDial)
      ? currentDigits.slice(currentDial.length)
      : currentDigits;
    const nextDial = nextCountry.callingCode[0];
    setSelectedCountry(nextCountry);
    handleChange('phone', localDigits ? `+${nextDial}${localDigits}` : `+${nextDial}`);
  };

  const saveUserProfile = useCallback(async () => {
    if (!profileData) return true;
    try {
      const formData = new FormData();
      formData.append('userName', profileData.username || '');
      formData.append('displayName', profileData.displayName || '');
      formData.append('bio', profileData.bio || '');
      if (profileData?.image?.uri) {
        const img = profileData.image;
        const fileUri = Platform.OS === 'android' ? img.uri : img.uri.replace('file://', '');
        formData.append('image', {
          uri: fileUri,
          name: img.name || 'profile.jpg',
          type: img.type || 'image/jpeg',
        });
      } else if (profileData?.imageUri) {
        const uri = profileData.imageUri;
        const fileUri = Platform.OS === 'android' ? uri : uri.replace('file://', '');
        formData.append('image', { uri: fileUri, name: 'profile.jpg', type: 'image/jpeg' });
      }
      formData.append('gender', '');
      formData.append('age', '');
      formData.append('phoneNumber', '');
      const response = await EditProfile(formData);
      if (response?.statusCode === 200) {
        if (profileData.displayName) {
          await AsyncStorage.setItem('currentUsername', profileData.displayName);
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [profileData]);

  useEffect(() => {
    if (!profileData || hasSavedUserProfileRef.current) return;
    hasSavedUserProfileRef.current = true;
    saveUserProfile();
  }, [profileData, saveUserProfile]);

  const proceedToKyc = async () => {
    await saveUserProfile();
    await AsyncStorage.setItem('isLoggedIn', 'true');
    dispatch(loggedIn());
    dispatch(clearSignupFormData());
    dispatch(setIsAddAccount(false));
    if (navigation.canGoBack()) { navigation.goBack(); return; }
  };

  const isAlreadyCreatedResponse = response => {
    const msg = String(response?.message || '').toLowerCase();
    return msg.includes('already created') || msg.includes('use update');
  };

  const isImageType = (type = '', uri = '') => {
    if (String(type).startsWith('image/')) return true;
    return /\.(png|jpe?g|webp|gif)$/i.test(String(uri));
  };

  const mapCompanyProfileToForm = useCallback(
    data => ({
      businessName: data?.businessName || '',
      ownerName: data?.ownerName || '',
      email: data?.email || '',
      phone: normalizePhoneWithCountryCode(data?.phoneNumber || data?.phone || ''),
      category: data?.category || '',
      address: data?.address || '',
      description: data?.description || '',
      website: data?.website || '',
      gstNumber: data?.gstNumber || '',
    }),
    [normalizePhoneWithCountryCode],
  );

  const syncCountryCodeFromPhone = useCallback(async phoneValue => {
    const normalized = String(phoneValue || '').trim();
    if (!normalized.startsWith('+')) return;
    const digits = normalized.replace(/\D/g, '');
    const countries = await getAllCountries();
    for (let len = 4; len >= 1; len -= 1) {
      const candidate = digits.slice(0, len);
      if (!candidate) continue;
      const country = countries.find(item => item?.callingCode?.includes(candidate));
      if (country?.cca2) {
        setSelectedCountry({ cca2: country.cca2, callingCode: [candidate] });
        return;
      }
    }
  }, []);

  const clearDocumentError = () => {
    if (errors.document) {
      const next = { ...errors };
      delete next.document;
      setErrors(next);
    }
  };

  const isValidEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
  const isValidWebsite = v => {
    const raw = String(v || '').trim();
    if (!raw) return true;
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(normalized);
  };
  const normalizeWebsite = v => {
    const raw = String(v || '').trim();
    if (!raw) return '';
    return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  };

  const validateForm = () => {
    const next = {};
    const businessName = form.businessName.trim();
    const phoneDigits = form.phone.replace(/\D/g, '');
    const email = form.email.trim();
    const website = form.website.trim();

    if (!businessName) next.businessName = t('businessProfile.businessNameRequired');
    else if (businessName.length < 2) next.businessName = t('businessProfile.businessNameTooShort');

    if (!phoneDigits) next.phone = t('businessProfile.phoneRequired');
    else if (phoneDigits.length < 7 || phoneDigits.length > 15) next.phone = t('businessProfile.phoneInvalid');

    if (email && !isValidEmail(email)) next.email = t('businessProfile.emailInvalid');
    if (website && !isValidWebsite(website)) next.website = t('businessProfile.websiteInvalid');

    if (!selectedDocument) next.document = t('businessProfile.documentRequired');
    else if (!isDocumentUploaded) next.document = t('businessProfile.documentNotUploaded');

    return next;
  };

  const uploadDocumentNow = async file => {
    if (!file?.uri) {
      showToastMessage(toast, 'danger', t('businessProfile.validFileError'));
      return false;
    }
    const documentFormData = new FormData();
    const fileUri = Platform.OS === 'android' ? file.uri : file.uri?.replace('file://', '');
    if (!fileUri) {
      showToastMessage(toast, 'danger', t('businessProfile.validFileError'));
      return false;
    }
    documentFormData.append('documents', {
      uri: fileUri,
      name: file.name || `document-${Date.now()}`,
      type: file.type || 'application/octet-stream',
    });

    setIsUploadingDocument(true);
    dispatch(showLoader());
    try {
      const uploadResponse = await UploadDocument(documentFormData);
      const uploadCode = uploadResponse?.statusCode;
      if (uploadCode === 200 || uploadCode === 201) {
        setIsDocumentUploaded(true);
        showToastMessage(toast, 'success', uploadResponse?.message || t('businessProfile.documentUploadSuccess'));
        return true;
      }
      setIsDocumentUploaded(false);
      showToastMessage(toast, 'danger', uploadResponse?.message || t('businessProfile.documentUploadFail'));
      return false;
    } catch (error) {
      setIsDocumentUploaded(false);
      showToastMessage(toast, 'danger', t('businessProfile.documentUploadFail'));
      return false;
    } finally {
      setIsUploadingDocument(false);
      dispatch(hideLoader());
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, includeBase64: false, quality: 0.8 });
      if (result?.didCancel) return;
      if (result?.errorCode) {
        showToastMessage(toast, 'danger', result?.errorMessage || t('businessProfile.pickImageFail'));
        return;
      }
      const image = result?.assets?.[0];
      if (image?.uri) {
        const file = { name: image?.fileName || `image-${Date.now()}.jpg`, uri: image.uri, type: image?.type || 'image/jpeg', isImage: true };
        setSelectedDocument(file);
        setIsDocumentUploaded(false);
        clearDocumentError();
        await uploadDocumentNow(file);
      }
    } catch (error) {
      showToastMessage(toast, 'danger', t('businessProfile.pickImageFail'));
    }
  };

  const launchSumsub = async () => {
    const nextErrors = validateForm();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      Alert.alert(t('businessProfile.validationError'), t('businessProfile.validationMessage'));
      return;
    }
    if (sumsubLaunchLockRef.current || isLaunchingSumsub) return;
    sumsubLaunchLockRef.current = true;
    setIsLaunchingSumsub(true);
    try {
      const response = await startVerification();
      const accessToken = response?.data?.token;
      if (!accessToken) {
        showToastMessage(toast, 'danger', t('businessProfile.sumsubUnavailable'));
        return;
      }
      const snsMobileSDK = SNSMobileSDK.init(accessToken, () => accessToken)
        .withHandlers({ onStatusChanged: event => console.log('Sumsub status:', event) })
        .withDebug(true)
        .build();
      await snsMobileSDK.launch();
    } catch (error) {
      const errorMessage = String(error?.message || error || '').toLowerCase();
      if (errorMessage.includes('another instance is in use')) {
        showToastMessage(toast, 'warning', t('businessProfile.sumsubAlreadyOpen'));
      } else {
        showToastMessage(toast, 'danger', t('businessProfile.sumsubFail'));
      }
    } finally {
      sumsubLaunchLockRef.current = false;
      setIsLaunchingSumsub(false);
    }
  };

  const getVerificationStatus = useCallback(async () => {
    try {
      const response = await CheckVerificationStatus();
      console.log(response, 'response in status');
    } catch (err) {
      console.log(err, 'error in get status');
    }
  }, []);

  const handlePickFile = async () => {
    try {
      const [file] = await pick({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/jpeg', 'image/png', 'image/jpg'],
      });
      if (file) {
        const uri = file?.uri || file?.fileCopyUri;
        const selectedFile = { name: file?.name || `document-${Date.now()}`, uri, type: file?.type || 'application/octet-stream', isImage: String(file?.type || '').startsWith('image/') };
        setSelectedDocument(selectedFile);
        setIsDocumentUploaded(false);
        clearDocumentError();
        await uploadDocumentNow(selectedFile);
      }
    } catch (error) {
      const errorCode = String(error?.code || '').toUpperCase();
      if (errorCode.includes('CANCEL')) return;
      showToastMessage(toast, 'danger', t('businessProfile.pickDocumentFail'));
    }
  };

  const handlePickDocument = () => {
    Alert.alert(
      t('businessProfile.uploadDocumentTitle'),
      t('businessProfile.uploadDocumentMessage'),
      [
        { text: t('businessProfile.galleryOption'), onPress: handlePickImage },
        { text: t('businessProfile.pdfOption'),     onPress: handlePickFile },
        { text: t('businessProfile.cancel'),         style: 'cancel' },
      ],
    );
  };

  const fetchCompanyProfile = useCallback(async () => {
    try {
      const response = await GetCompanyProfile();
      const code = response?.statusCode;
      const companyData = response?.data || {};
      const existingDocument = companyData?.document || companyData?.documents?.[0] || companyData?.documents;

      if ((code === 200 || code === 201) && Object.keys(companyData).length > 0) {
        const mappedForm = mapCompanyProfileToForm(companyData);
        setForm(mappedForm);
        await syncCountryCodeFromPhone(mappedForm.phone);
        setHasExistingCompanyProfile(true);
        if (existingDocument) {
          const existingUri = typeof existingDocument === 'string' ? existingDocument : existingDocument?.url || existingDocument?.uri || '';
          const documentName = (typeof existingDocument === 'string' ? existingDocument.split('/').pop() : existingDocument?.name || existingDocument?.originalName || existingDocument?.fileName) || 'Uploaded document';
          const existingType = typeof existingDocument === 'string' ? '' : existingDocument?.type || 'application/octet-stream';
          setSelectedDocument({ name: documentName, uri: existingUri, type: existingType, isImage: isImageType(existingType, existingUri) });
          setIsDocumentUploaded(true);
        }
      } else {
        setHasExistingCompanyProfile(false);
        setSelectedDocument(null);
        setIsDocumentUploaded(false);
      }
    } catch (error) {
      setHasExistingCompanyProfile(false);
      setSelectedDocument(null);
      setIsDocumentUploaded(false);
    }
  }, [mapCompanyProfileToForm, syncCountryCodeFromPhone]);

  useFocusEffect(
    useCallback(() => {
      fetchCompanyProfile();
      getVerificationStatus();
    }, [fetchCompanyProfile, getVerificationStatus]),
  );

  const handleSubmit = async () => {
    const nextErrors = validateForm();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      Alert.alert(t('businessProfile.validationError'), t('businessProfile.validationMessage'));
      return;
    }

    const normalizedPhone = normalizePhoneWithCountryCode(form.phone);
    const payload = {
      businessName: form.businessName.trim(),
      ownerName: form.ownerName.trim(),
      email: form.email.trim(),
      phone: normalizedPhone,
      phoneNumber: normalizedPhone,
      category: form.category.trim(),
      address: form.address.trim(),
      description: form.description.trim(),
      website: normalizeWebsite(form.website),
      gstNumber: form.gstNumber.trim(),
    };

    setIsSubmitting(true);
    dispatch(showLoader());
    try {
      const profileSaved = await saveUserProfile();
      if (!profileSaved) {
        showToastMessage(toast, 'danger', t('businessProfile.saveError'));
        return;
      }

      if (!isDocumentUploaded) {
        const documentFormData = new FormData();
        const fileUri = Platform.OS === 'android' ? selectedDocument.uri : selectedDocument.uri?.replace('file://', '');
        if (!fileUri) {
          showToastMessage(toast, 'danger', t('businessProfile.validFileError'));
          return;
        }
        documentFormData.append('documents', { uri: fileUri, name: selectedDocument.name || `document-${Date.now()}`, type: selectedDocument.type || 'application/octet-stream' });
        const uploadResponse = await UploadDocument(documentFormData);
        const uploadCode = uploadResponse?.statusCode;
        if (!(uploadCode === 200 || uploadCode === 201)) {
          showToastMessage(toast, 'danger', uploadResponse?.message || t('businessProfile.documentUploadFail'));
          return;
        }
        setIsDocumentUploaded(true);
      }

      if (hasExistingCompanyProfile) {
        const updateResponse = await UpdateCompanyProfile(payload);
        const updateCode = updateResponse?.statusCode;
        if (updateCode === 200 || updateCode === 201) {
          showToastMessage(toast, 'success', updateResponse?.message || t('businessProfile.updateSuccess'));
          proceedToKyc();
        } else {
          showToastMessage(toast, 'danger', updateResponse?.message || t('businessProfile.updateFail'));
        }
      } else {
        const response = await CreateCompanyProfile(payload);
        const code = response?.statusCode;
        if (code === 200 || code === 201) {
          showToastMessage(toast, 'success', response?.message || t('businessProfile.saveSuccess'));
          setHasExistingCompanyProfile(true);
          proceedToKyc();
          return;
        }
        if (isAlreadyCreatedResponse(response)) {
          const updateResponse = await UpdateCompanyProfile(payload);
          const updateCode = updateResponse?.statusCode;
          if (updateCode === 200 || updateCode === 201) {
            showToastMessage(toast, 'success', updateResponse?.message || t('businessProfile.updateSuccess'));
            setHasExistingCompanyProfile(true);
            proceedToKyc();
          } else {
            showToastMessage(toast, 'danger', updateResponse?.message || t('businessProfile.updateFail'));
          }
        } else {
          showToastMessage(toast, 'danger', response?.message || t('businessProfile.saveFail'));
        }
      }
    } catch (error) {
      showToastMessage(toast, 'danger', t('businessProfile.saveError'));
    } finally {
      setIsSubmitting(false);
      dispatch(hideLoader());
    }
  };

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
          <AuthHeader
            subtitle={t('businessProfile.headerSubtitle')}
            profileType={profileFromRoute}
            onBackPress={() => navigation.goBack()}
            isFirstLaunch={true}
          />

          <View style={styles.formWrapper}>
            <View style={styles.card}>
              <View style={styles.welcomeSection}>
                <Text style={styles.welcomeTitle}>{t('businessProfile.welcomeTitle')}</Text>
                <Text style={styles.welcomeSubtitle}>{t('businessProfile.welcomeSubtitle')}</Text>
              </View>

              <View style={styles.inputContainer}>
                {fields.map(field => (
                  <View key={field.key} style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>{field.label}</Text>
                    <View style={[styles.inputGroup, errors[field.key] && styles.inputError]}>
                      {field.key === 'phone' ? (
                        <View style={styles.phoneInputRow}>
                          <TouchableOpacity
                            style={styles.countryCodeButton}
                            onPress={() => setShowCountryPicker(true)}
                            activeOpacity={0.8}
                          >
                            <CountryPicker
                              countryCode={selectedCountry.cca2}
                              withFlag
                              withCallingCode={false}
                              withFilter
                              withEmoji
                              visible={showCountryPicker}
                              onClose={() => setShowCountryPicker(false)}
                              onSelect={handleCountrySelect}
                            />
                            <Text style={styles.countryCodeText}>{getDialCode()}</Text>
                          </TouchableOpacity>
                          <TextInput
                            style={[styles.textInput, styles.phoneTextInput]}
                            placeholder={field.placeholder}
                            placeholderTextColor="#9CA3AF"
                            value={getPhoneInputValue()}
                            onChangeText={handlePhoneChange}
                            keyboardType={field.keyboardType || 'phone-pad'}
                            autoCapitalize="none"
                            textAlignVertical="center"
                          />
                        </View>
                      ) : (
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
                      )}
                    </View>
                    {errors[field.key] ? <Text style={styles.errorText}>{errors[field.key]}</Text> : null}
                  </View>
                ))}

                {/* Document Upload */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>{t('businessProfile.documentLabel')}</Text>
                  <TouchableOpacity
                    style={[styles.inputGroup, errors.document && styles.inputError]}
                    onPress={handlePickDocument}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[styles.uploadText, !selectedDocument && styles.uploadPlaceholder]}
                      numberOfLines={1}
                    >
                      {selectedDocument?.name || t('businessProfile.documentPlaceholder')}
                    </Text>
                  </TouchableOpacity>
                  {selectedDocument?.isImage && selectedDocument?.uri ? (
                    <Image source={{ uri: selectedDocument.uri }} style={styles.documentPreview} resizeMode="cover" />
                  ) : null}
                  {errors.document ? <Text style={styles.errorText}>{errors.document}</Text> : null}
                </View>
              </View>

              <View />

              {/* Verify (Sumsub) Button */}
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: '#C9A15a', shadowColor: '#C9A15a' }]}
                onPress={launchSumsub}
                disabled={isLaunchingSumsub}
              >
                <Text style={styles.submitButtonText}>
                  {isLaunchingSumsub
                    ? t('businessProfile.verifyingButton')
                    : t('businessProfile.verifyButton')}
                </Text>
              </TouchableOpacity>

              <View />

              {/* Continue (Save) Button */}
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: '#C9A15a', shadowColor: '#C9A15a' }]}
                onPress={handleSubmit}
                disabled={isSubmitting || isUploadingDocument}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting
                    ? t('businessProfile.savingButton')
                    : isUploadingDocument
                    ? t('businessProfile.uploadingButton')
                    : t('businessProfile.continueButton')}
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
  container: { flex: 1 },
  contentContainer: { flexGrow: 1 },
  formWrapper: { flex: 1, marginTop: -30, paddingHorizontal: 7 },
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
  welcomeSection: { alignItems: 'center', marginBottom: 24 },
  welcomeTitle: { fontSize: 24, fontWeight: '700', color: '#1F2937', marginBottom: 10, textAlign: 'center' },
  welcomeSubtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  inputContainer: { width: '100%' },
  inputWrapper: { marginBottom: 14 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  inputGroup: {
    minHeight: 52,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  inputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  textInput: { flex: 1, color: '#1F2937', fontSize: 16, paddingVertical: 0 },
  phoneInputRow: { flexDirection: 'row', alignItems: 'center' },
  countryCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  countryCodeText: { marginLeft: 8, color: '#1F2937', fontSize: 16, fontWeight: '600' },
  phoneTextInput: { paddingVertical: 14 },
  textArea: { minHeight: 100, paddingTop: 12, paddingBottom: 12 },
  errorText: { color: '#EF4444', fontSize: 12, marginTop: 5, marginLeft: 4, fontWeight: '500' },
  submitButton: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 5,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  uploadText: { color: '#1F2937', fontSize: 15 },
  uploadPlaceholder: { color: '#9CA3AF' },
  documentPreview: { marginTop: 10, width: 92, height: 92, borderRadius: 10, backgroundColor: '#E5E7EB' },
});