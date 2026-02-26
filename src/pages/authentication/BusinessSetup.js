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
} from '../../services/companyProfile';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { useAppTheme } from '../../theme/useApptheme';
import { pick } from '@react-native-documents/picker';
import { launchImageLibrary } from 'react-native-image-picker';

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
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isDocumentUploaded, setIsDocumentUploaded] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);

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

  const isImageType = (type = '', uri = '') => {
    if (String(type).startsWith('image/')) return true;
    return /\.(png|jpe?g|webp|gif)$/i.test(String(uri));
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

  const clearDocumentError = () => {
    if (errors.document) {
      const next = { ...errors };
      delete next.document;
      setErrors(next);
    }
  };

  const isValidEmail = value =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

  const isValidWebsite = value => {
    const raw = String(value || '').trim();
    if (!raw) return true;
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(normalized);
  };

  const normalizeWebsite = value => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  };

  const validateForm = () => {
    const nextErrors = {};
    const businessName = form.businessName.trim();
    const phoneDigits = form.phone.replace(/\D/g, '');
    const email = form.email.trim();
    const website = form.website.trim();

    if (!businessName) {
      nextErrors.businessName = 'Business name is required';
    } else if (businessName.length < 2) {
      nextErrors.businessName = 'Business name is too short';
    }

    if (!phoneDigits) {
      nextErrors.phone = 'Phone number is required';
    } else if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      nextErrors.phone = 'Enter a valid phone number';
    }

    if (email && !isValidEmail(email)) {
      nextErrors.email = 'Enter a valid email address';
    }

    if (website && !isValidWebsite(website)) {
      nextErrors.website = 'Enter a valid website URL';
    }

    if (!selectedDocument) {
      nextErrors.document = 'Document is required';
    } else if (!isDocumentUploaded) {
      nextErrors.document = 'Please upload document before continuing';
    }

    return nextErrors;
  };

  const uploadDocumentNow = async file => {
    if (!file?.uri) {
      showToastMessage(toast, 'danger', 'Please choose a valid file to upload.');
      return false;
    }

    const documentFormData = new FormData();
    const fileUri =
      Platform.OS === 'android' ? file.uri : file.uri?.replace('file://', '');

    if (!fileUri) {
      showToastMessage(toast, 'danger', 'Please choose a valid file to upload.');
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
      console.log(uploadResponse,'upload response');
      
      const uploadCode = uploadResponse?.statusCode;
      if (uploadCode === 200 || uploadCode === 201) {
        setIsDocumentUploaded(true);
        showToastMessage(
          toast,
          'success',
          uploadResponse?.message || 'Document uploaded successfully.',
        );
        return true;
      }
      setIsDocumentUploaded(false);
      showToastMessage(
        toast,
        'danger',
        uploadResponse?.message || 'Failed to upload document.',
      );
      return false;
    } catch (error) {
      setIsDocumentUploaded(false);
      showToastMessage(toast, 'danger', 'Failed to upload document.');
      return false;
    } finally {
      setIsUploadingDocument(false);
      dispatch(hideLoader());
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        includeBase64: false,
        quality: 0.8,
      });

      if (result?.didCancel) return;
      if (result?.errorCode) {
        showToastMessage(toast, 'danger', result?.errorMessage || 'Failed to pick image.');
        return;
      }

      const image = result?.assets?.[0];
      if (image?.uri) {
        const file = {
          name: image?.fileName || `image-${Date.now()}.jpg`,
          uri: image.uri,
          type: image?.type || 'image/jpeg',
          isImage: true,
        };
        setSelectedDocument(file);
        setIsDocumentUploaded(false);
        clearDocumentError();
        await uploadDocumentNow(file);
      }
    } catch (error) {
      showToastMessage(toast, 'danger', 'Failed to pick image.');
    }
  };

  const handlePickFile = async () => {
    try {
      const [file] = await pick({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'image/jpeg',
          'image/png',
          'image/jpg',
        ],
      });
      if (file) {
        const uri = file?.uri || file?.fileCopyUri;
        const selectedFile = {
          name: file?.name || `document-${Date.now()}`,
          uri,
          type: file?.type || 'application/octet-stream',
          isImage: String(file?.type || '').startsWith('image/'),
        };
        setSelectedDocument(selectedFile);
        setIsDocumentUploaded(false);
        clearDocumentError();
        await uploadDocumentNow(selectedFile);
      }
    } catch (error) {
      const errorCode = String(error?.code || '').toUpperCase();
      if (errorCode.includes('CANCEL')) return;
      showToastMessage(toast, 'danger', 'Failed to pick document.');
    }
  };

  const handlePickDocument = () => {
    Alert.alert('Upload Document', 'Choose upload source', [
      { text: 'Gallery Image', onPress: handlePickImage },
      { text: 'PDF/Document', onPress: handlePickFile },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const fetchCompanyProfile = useCallback(async () => {
    try {
      const response = await GetCompanyProfile();
      const code = response?.statusCode;
      const companyData = response?.data || {};
      const existingDocument =
        companyData?.document ||
        companyData?.documents?.[0] ||
        companyData?.documents;

      if ((code === 200 || code === 201) && Object.keys(companyData).length > 0) {
        setForm(mapCompanyProfileToForm(companyData));
        setHasExistingCompanyProfile(true);
        if (existingDocument) {
          const existingUri =
            typeof existingDocument === 'string'
              ? existingDocument
              : existingDocument?.url || existingDocument?.uri || '';
          const documentName =
            (typeof existingDocument === 'string'
              ? existingDocument.split('/').pop()
              : existingDocument?.name ||
                existingDocument?.originalName ||
                existingDocument?.fileName) || 'Uploaded document';
          const existingType =
            typeof existingDocument === 'string'
              ? ''
              : existingDocument?.type || 'application/octet-stream';
          setSelectedDocument({
            name: documentName,
            uri: existingUri,
            type: existingType,
            isImage: isImageType(existingType, existingUri),
          });
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
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCompanyProfile();
    }, [fetchCompanyProfile]),
  );

  const handleSubmit = async () => {
    const nextErrors = validateForm();

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      Alert.alert('Validation error', 'Please fix the highlighted fields.');
      return;
    }

    const payload = {
      businessName: form.businessName.trim(),
      ownerName: form.ownerName.trim(),
      email: form.email.trim(),
      phone: form.phone.replace(/\D/g, ''),
      phoneNumber: form.phone.replace(/\D/g, ''),
      category: form.category.trim(),
      address: form.address.trim(),
      description: form.description.trim(),
      website: normalizeWebsite(form.website),
      gstNumber: form.gstNumber.trim(),
    };

    setIsSubmitting(true);
    dispatch(showLoader());
    try {
      if (!isDocumentUploaded) {
        const documentFormData = new FormData();
        const fileUri =
          Platform.OS === 'android'
            ? selectedDocument.uri
            : selectedDocument.uri?.replace('file://', '');
        if (!fileUri) {
          showToastMessage(toast, 'danger', 'Please choose a valid file to upload.');
          return;
        }

        documentFormData.append('documents', {
          uri: fileUri,
          name: selectedDocument.name || `document-${Date.now()}`,
          type: selectedDocument.type || 'application/octet-stream',
        });

        const uploadResponse = await UploadDocument(documentFormData);
        const uploadCode = uploadResponse?.statusCode;
        if (!(uploadCode === 200 || uploadCode === 201)) {
          showToastMessage(
            toast,
            'danger',
            uploadResponse?.message || 'Failed to upload document.',
          );
          return;
        }
        setIsDocumentUploaded(true);
      }

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

                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Upload Document (Image/PDF) *</Text>
                  <TouchableOpacity
                    style={[styles.inputGroup, errors.document && styles.inputError]}
                    onPress={handlePickDocument}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.uploadText,
                        !selectedDocument && styles.uploadPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedDocument?.name || 'Tap to upload image or PDF'}
                    </Text>
                  </TouchableOpacity>
                  {selectedDocument?.isImage && selectedDocument?.uri ? (
                    <Image
                      source={{ uri: selectedDocument.uri }}
                      style={styles.documentPreview}
                      resizeMode="cover"
                    />
                  ) : null}
                  {errors.document ? (
                    <Text style={styles.errorText}>{errors.document}</Text>
                  ) : null}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: text, shadowColor: text }]}
                onPress={handleSubmit}
                disabled={isSubmitting || isUploadingDocument}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? 'Saving...' : isUploadingDocument ? 'Uploading...' : 'Continue'}
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
  uploadText: {
    color: '#1F2937',
    fontSize: 15,
  },
  uploadPlaceholder: {
    color: '#9CA3AF',
  },
  documentPreview: {
    marginTop: 10,
    width: 92,
    height: 92,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
  },
});
