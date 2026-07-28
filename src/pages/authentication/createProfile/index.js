import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  Alert,
  PermissionsAndroid,
  Platform,
  FlatList,
  Linking,
  Modal,
  Pressable
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import StepHeader from './headerSection';
import { checkDisplayName, getProfile, EditProfile } from '../../../services/createProfile';
import { logout, removeDeviceAccountRequest } from '../../../services/authentication';
import { useToast } from 'react-native-toast-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RBSheet from 'react-native-raw-bottom-sheet';
import { useRoute } from '@react-navigation/native';
import { useAppTheme } from '../../../theme/useApptheme';
import { useThemeContext } from '../../../theme/ThemeContext';
import { useDebouncedCallback } from '../../../hooks/useDebouncedCallback';
import { setUserProfile } from '../../../redux/actions/UserProfileAction';
import { showLoader, hideLoader } from '../../../redux/actions/LoaderAction';
import { useLanguage } from '../../../i18n';
import { validateUsername } from '../../../utils/validation';
import {
  pickProfileImageFromCamera,
  pickProfileImageFromGallery,
  uriFromCropPath,
} from '../../../utils/profileImageCrop';

const { width } = Dimensions.get('window');
const AVATAR_SIZE = 128;

export default function CreateProfile() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const toast = useToast();
  const route = useRoute();
  const { t } = useLanguage(); // i18n
  const profileFromRoute = route?.params?.profile || 'user';
  const { accessToken, refreshToken, id } = route?.params || {};
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [receiveEmails, setReceiveEmails] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [errors, setErrors] = useState({});
  const [imageUri, setImageUri] = useState(null);
  const [serverProfile, setServerProfile] = useState(null);
  const [displayNameStatus, setDisplayNameStatus] = useState(null);
  const [displayNameSuggestions, setDisplayNameSuggestions] = useState([]);
  const [isCheckingDisplayName, setIsCheckingDisplayName] = useState(false);
  const refRBSheet = useRef();
  const [imageMeta, setImageMeta] = useState(null);
  const { bgStyle, card, border, mutedText, accent, cardStyle } = useAppTheme(profileFromRoute);
  const { isDarkMode } = useThemeContext();
  const ui = useMemo(() => ({
    labelColor: isDarkMode ? '#ffffff' : '#111827',
    inputColor: isDarkMode ? '#ffffff' : '#1F2937',
    inputSurface: isDarkMode ? 'rgba(255,255,255,0.06)' : '#ffffff',
    policyInfoBg: isDarkMode ? 'rgba(255,255,255,0.08)' : '#EEF2FF',
  }), [isDarkMode]);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    dispatch(setUserProfile(profileFromRoute));
  }, [profileFromRoute, dispatch]);

  const handleConfirmedLogout = useCallback(async () => {
    setShowLogoutModal(false);
    try {
      dispatch(showLoader());
      if (accessToken || refreshToken) {
        await logout({ token: accessToken, refreshToken });
        const res = await removeDeviceAccountRequest({ userId: id });
        const ok = res?.statusCode === 200 || res?.statusCode === 201;
        if (ok) {
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('refreshToken');
          await AsyncStorage.removeItem('firebaseToken');
          await AsyncStorage.removeItem('userId');
          await AsyncStorage.removeItem('username');
          await AsyncStorage.removeItem('email');
          await AsyncStorage.removeItem('profile');
          await AsyncStorage.setItem('isLoggedIn', 'false');
        }
      }
    } catch (error) {
      console.warn('Logout failed on back navigation:', error?.message);
    } finally {
      dispatch(hideLoader());
      navigation.navigate('Signup', { profile: profileFromRoute });
    }
  }, [navigation, accessToken, refreshToken, dispatch]);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener('beforeRemove', async (e) => {
        if (!accessToken && !refreshToken) return;
        e.preventDefault();
        setShowLogoutModal(true);
      });
      return unsubscribe;
    }, [navigation, accessToken, refreshToken])
  );

  const validateUsernameField = v => validateUsername(v, t);

  const validateDisplayName = v => (!v ? t('createProfile.displayNameRequired') : '');

  const validateBio = v => {
    if (!v) return t('createProfile.bioRequired');
    if (v.length < 5) return t('createProfile.bioMinLength');
    if (v.length > 250) return t('createProfile.bioMaxLength');
    return '';
  };

  const validateTermsAndPrivacy = () => {
    const errs = {};
    if (!acceptTerms) errs.terms = t('createProfile.termsRequired');
    if (!acceptPrivacy) errs.privacy = t('createProfile.privacyRequired');
    return errs;
  };

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const id = await AsyncStorage.getItem('userId');
        const resp = await getProfile(id);
        if (!isMounted) return;
        if (resp.statusCode === 200) {
          setServerProfile(resp);
          setUsername(resp.data.userName || '');
          setDisplayName(resp.data.displayName || '');
          setBio(resp.data.bio || '');
          if (resp.data.displayName) setDisplayNameStatus('approved');
        } else {
          toast.show(resp.message, { type: 'danger' });
        }
      } catch (err) {
        if (isMounted) toast.show(err.message, { type: 'danger' });
      }
    };
    fetchProfile();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    const data = route.params?.agreementData;
    if (data) {
      setAcceptTerms(Boolean(data.acceptTerms));
      setAcceptPrivacy(Boolean(data.acceptPrivacy));
    }
  }, [route.params?.agreementData]);

  const pickImageFromGallery = async () => {
    try {
      const image = await pickProfileImageFromGallery();
      refRBSheet.current?.close();
      const uri = uriFromCropPath(image.path);
      if (!uri) return;
      setImageUri(uri);
      setImageMeta({ uri, type: image.mime || 'image/jpeg', name: image.filename || 'profile.jpg' });
    } catch (e) {
      refRBSheet.current?.close();
      if (e?.code !== 'E_PICKER_CANCELLED') {
        Alert.alert('Error', e?.message || 'Failed to pick image from gallery');
      }
    }
  };

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'This app needs access to your camera to take photos.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const pickImageFromCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
      return;
    }
    try {
      const image = await pickProfileImageFromCamera();
      refRBSheet.current?.close();
      const uri = uriFromCropPath(image.path);
      if (!uri) return;
      setImageUri(uri);
      setImageMeta({ uri, type: image.mime || 'image/jpeg', name: image.filename || 'profile.jpg' });
    } catch (e) {
      refRBSheet.current?.close();
      if (e?.code !== 'E_PICKER_CANCELLED') {
        Alert.alert('Camera Error', e?.message || 'Failed to capture image');
      }
    }
  };

  const checkDisplayNameAvailability = async (name) => {
    if (!name || name.length < 2) {
      setDisplayNameStatus(null);
      setDisplayNameSuggestions([]);
      return;
    }
    setIsCheckingDisplayName(true);
    setDisplayNameStatus('checking');
    setDisplayNameSuggestions([]);
    try {
      const resp = await checkDisplayName({ displayName: name });
      if (resp && resp.statusCode === 200 && resp.success) {
        const { status, suggestions = [] } = resp.data;
        setDisplayNameStatus(status);
        if (status === 'taken') {
          setDisplayNameSuggestions(suggestions);
          setErrors(prev => ({
            ...prev,
            displayName: resp.data.message || t('createProfile.displayNameTaken'),
          }));
        } else if (status === 'approved') {
          setErrors(prev => ({ ...prev, displayName: '' }));
        }
      } else {
        setDisplayNameStatus(null);
        setErrors(prev => ({
          ...prev,
          displayName: t('createProfile.displayNameError'),
        }));
      }
    } catch (err) {
      setDisplayNameStatus(null);
      toast.show(err.message || t('createProfile.displayNameError'), { type: 'danger' });
    } finally {
      setIsCheckingDisplayName(false);
    }
  };

  const debouncedCheckDisplayName = useDebouncedCallback(checkDisplayNameAvailability, 500);

  const naviGationButton = (data) => {
    if (data === 'termsCondition') {
      Linking.openURL('https://valens.app/terms');
    } else if (data === 'privacyPolicy') {
      Linking.openURL('https://valens.app/privacy-policy');
    } else {
      navigation.navigate('TermsCondition');
    }
  };

  const isValid =
    !validateUsernameField(username) &&
    !validateDisplayName(displayName) &&
    !validateBio(bio) &&
    displayNameStatus === 'approved' &&
    acceptTerms &&
    acceptPrivacy;

  const handleDisplayNameChange = async text => {
    setDisplayName(text);
    const basicError = validateDisplayName(text);
    setErrors(prev => ({ ...prev, displayName: basicError }));
    if (!basicError && text.length >= 2) {
      debouncedCheckDisplayName(text);
    } else {
      setDisplayNameStatus(null);
      setDisplayNameSuggestions([]);
    }
  };

  const selectSuggestion = (suggestion) => {
    setDisplayName(suggestion);
    setDisplayNameSuggestions([]);
    checkDisplayNameAvailability(suggestion);
  };

  const renderDisplayNameInput = () => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: mutedText }]}>{t('createProfile.displayNameLabel')}</Text>
      <View style={styles.inputContainer}>
        <TextInput
          placeholder={t('createProfile.displayNamePlaceholder')}
          placeholderTextColor={mutedText}
          style={[
            styles.inputFull,
            errors.displayName && styles.inputErrorWrapper,
            {
              color: ui.inputColor,
              backgroundColor: ui.inputSurface,
              borderColor: border,
            },
          ]}
          value={displayName}
          onChangeText={handleDisplayNameChange}
        />
        <View style={styles.inputStatus}>
          {isCheckingDisplayName && (
            <View style={styles.loadingIndicator}>
              <Text style={styles.loadingText}>{t('createProfile.checkingDisplayName')}</Text>
            </View>
          )}
          {displayNameStatus === 'approved' && !isCheckingDisplayName && (
            <View style={styles.successIndicator}>
              <Icon name="check-circle" size={20} color="#10B981" />
            </View>
          )}
          {displayNameStatus === 'taken' && !isCheckingDisplayName && (
            <View style={styles.errorIndicator}>
              <Icon name="x-circle" size={20} color="#DC2626" />
            </View>
          )}
        </View>
      </View>

      {errors.displayName && displayNameStatus === 'taken' && (
        <Text style={styles.errorText}>{errors.displayName}</Text>
      )}

      {displayNameSuggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>{t('createProfile.suggestions')}</Text>
          <FlatList
            data={displayNameSuggestions}
            keyExtractor={(item, index) => index.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionChip}
                onPress={() => selectSuggestion(item)}
              >
                <Text style={styles.suggestionText}>{item}</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.suggestionsList}
          />
        </View>
      )}
    </View>
  );

  const renderTermsAndPrivacySection = () => (
    <View style={[styles.termsSection, cardStyle, { borderColor: border }]}>
      <Text style={[styles.termsSectionTitle, { color: ui.labelColor }]}>
        {t('createProfile.legalAgreements')}
      </Text>
      <Text style={[styles.termsSectionSubtitle, { color: mutedText }]}>
        {t('createProfile.legalAgreementsSubtitle')}
      </Text>

      {/* Terms and Conditions */}
      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          style={[
            styles.checkbox,
            { borderColor: border },
            acceptTerms && [styles.checkboxChecked, { backgroundColor: accent, borderColor: accent }],
          ]}
          onPress={() => {
            setAcceptTerms(!acceptTerms);
            setErrors(prev => ({ ...prev, terms: '' }));
          }}
        >
          {acceptTerms && <Icon name="check" size={14} color="#FFF" />}
        </TouchableOpacity>
        <View style={styles.checkboxTextContainer}>
          <Text style={[styles.checkboxLabel, { color: ui.labelColor }]}>
            {t('createProfile.termsLabel')}{' '}
            <Text style={[styles.linkText, { color: accent }]} onPress={() => naviGationButton('termsCondition')}>
              {t('createProfile.termsLink')}
            </Text>
            {' '}{t('createProfile.termsDescription')}
          </Text>
        </View>
      </View>
      {errors.terms && <Text style={styles.errorText}>{errors.terms}</Text>}

      {/* Privacy Policy */}
      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          style={[
            styles.checkbox,
            { borderColor: border },
            acceptPrivacy && [styles.checkboxChecked, { backgroundColor: accent, borderColor: accent }],
          ]}
          onPress={() => {
            setAcceptPrivacy(!acceptPrivacy);
            setErrors(prev => ({ ...prev, privacy: '' }));
          }}
        >
          {acceptPrivacy && <Icon name="check" size={14} color="#FFF" />}
        </TouchableOpacity>
        <View style={styles.checkboxTextContainer}>
          <Text style={[styles.checkboxLabel, { color: ui.labelColor }]}>
            {t('createProfile.privacyLabel')}{' '}
            <Text style={[styles.linkText, { color: accent }]} onPress={() => naviGationButton('privacyPolicy')}>
              {t('createProfile.privacyLink')}
            </Text>
            {' '}{t('createProfile.privacyDescription')}
          </Text>
        </View>
      </View>
      {errors.privacy && <Text style={styles.errorText}>{errors.privacy}</Text>}

      <View style={[styles.policyInfoBox, { backgroundColor: ui.policyInfoBg, borderLeftColor: accent }]}>
        <Icon name="info" size={16} color={accent} />
        <Text style={[styles.policyInfoText, { color: accent }]}>{t('createProfile.policyInfoText')}</Text>
      </View>
    </View>
  );

  const saveProfileToApi = async (data) => {
    const formData = new FormData();
    formData.append('userName', data.username || '');
    formData.append('displayName', data.displayName || '');
    formData.append('bio', data.bio || '');
    if (data?.image?.uri) {
      const img = data.image;
      const fileUri = Platform.OS === 'android' ? img.uri : img.uri.replace('file://', '');
      formData.append('image', {
        uri: fileUri,
        name: img.name || 'profile.jpg',
        type: img.type || 'image/jpeg',
      });
    } else if (data?.imageUri) {
      const uri = data.imageUri;
      const fileUri = Platform.OS === 'android' ? uri : uri.replace('file://', '');
      formData.append('image', { uri: fileUri, name: 'profile.jpg', type: 'image/jpeg' });
    }
    formData.append('gender', '');
    formData.append('age', '');
    formData.append('phoneNumber', '');
    return EditProfile(formData);
  };

  const continueNext = async () => {
    const termsErrors = validateTermsAndPrivacy();
    if (Object.keys(termsErrors).length > 0) {
      setErrors(prev => ({ ...prev, ...termsErrors }));
      Alert.alert(t('createProfile.agreementsRequired'), t('createProfile.agreementsMessage'));
      return;
    }
    if (!isValid) {
      Alert.alert(t('createProfile.invalidForm'), t('createProfile.fixErrors'));
      return;
    }
    const profileData = {
      username, displayName, bio, receiveEmails, imageUri,
      image: imageMeta, acceptTerms, acceptPrivacy,
      agreementTimestamp: new Date().toISOString()
    };
    const storedProfileType = await AsyncStorage.getItem('profile');
    const profileType = String(
      serverProfile?.data?.profile || storedProfileType || profileFromRoute || '',
    ).toLowerCase();
    if (profileType === 'company') {
      dispatch(showLoader());
      try {
        const response = await saveProfileToApi(profileData);
        console.log(response,'data in this api setup ')
        if (response?.statusCode === 200 && displayName) {
          await AsyncStorage.setItem('currentUsername', displayName);
        } else if (response?.statusCode !== 200) {
          toast.show(t('createProfile.saveError') || 'Failed to save profile', { type: 'danger' });
          return;
        }
      } catch (err) {
        toast.show(err?.message || t('createProfile.saveError') || 'Failed to save profile', { type: 'danger' });
        return;
      } finally {
        dispatch(hideLoader());
      }
      navigation.navigate('BusinessSetupAuth', { profileData, serverProfile, profile: profileFromRoute });
      return;
    }

    // Navigate to KYC verification for non-company users
    navigation.navigate('KycVerifyAuth', { profileData, serverProfile, profile: profileFromRoute });
    //  navigation.navigate('Wallet', { profileData, serverProfile });
  };

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={100}
        showsVerticalScrollIndicator={false}
        bounces={false}
        resetScrollToCoords={{ x: 0, y: 0 }}
        scrollEnabled={true}
      >
        <View style={styles.inner}>
          <StepHeader currentStep={1} />
          <Text style={[styles.title, { color: ui.labelColor }]}>{t('createProfile.screenTitle')}</Text>

          <View style={styles.avatarContainer}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.avatarCircle} />
            ) : (
              <LinearGradient colors={['#EA580C', '#FCD34D']} style={styles.avatarCircle} />
            )}
            <TouchableOpacity
              style={[styles.editButton, { backgroundColor: card, borderColor: border, borderWidth: 1 }]}
              onPress={() => refRBSheet.current.open()}
            >
              <Icon name="edit-2" size={16} color={ui.labelColor} />
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            {/* Username Field */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: mutedText }]}>{t('createProfile.usernameLabel')}</Text>
              <View
                style={[
                  styles.inputWrapper,
                  errors.username && styles.inputErrorWrapper,
                  {
                    backgroundColor: ui.inputSurface,
                    borderColor: border,
                  },
                ]}
              >
                <Text style={[styles.prefix, { color: mutedText }]}>@</Text>
                <TextInput
                  placeholder={t('createProfile.usernamePlaceholder')}
                  placeholderTextColor={mutedText}
                  style={[styles.input, { color: ui.inputColor }]}
                  value={username}
                  onChangeText={txt => {
                    setUsername(txt);
                    setErrors(prev => ({ ...prev, username: validateUsernameField(txt) }));
                  }}
                />
              </View>
              <Text style={[styles.helperText, { color: mutedText }]}>{t('signup.usernameHelper')}</Text>
              {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
            </View>

            {renderDisplayNameInput()}

            {/* Bio Field */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: mutedText }]}>{t('createProfile.bioLabel')}</Text>
              <TextInput
                placeholder={t('createProfile.bioPlaceholder')}
                placeholderTextColor={mutedText}
                style={[
                  styles.inputFull2,
                  errors.bio && styles.inputErrorWrapper,
                  {
                    color: ui.inputColor,
                    backgroundColor: ui.inputSurface,
                    borderColor: border,
                  },
                ]}
                multiline
                textAlignVertical="top"
                value={bio}
                onChangeText={txt => {
                  setBio(txt);
                  setErrors(prev => ({ ...prev, bio: validateBio(txt) }));
                }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {errors.bio && <Text style={styles.errorText}>{errors.bio}</Text>}
                <Text style={[styles.counter, { color: mutedText }]}>{bio.length}/250</Text>
              </View>
            </View>

            {renderTermsAndPrivacySection()}

            {/* Email Opt-in */}
            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={[
                  styles.checkbox,
                  { borderColor: border },
                  receiveEmails && [styles.checkboxChecked, { backgroundColor: accent, borderColor: accent }],
                ]}
                onPress={() => setReceiveEmails(!receiveEmails)}
              >
                {receiveEmails && <Icon name="check" size={14} color="#FFF" />}
              </TouchableOpacity>
              <Text style={[styles.checkboxLabel, { color: ui.labelColor }]}>
                {t('createProfile.emailOptIn')}
              </Text>
            </View>

            <TouchableOpacity
              onPress={continueNext}
              style={[
                styles.createButton,
                isValid && [styles.createButtonActive, { backgroundColor: accent }],
              ]}
              disabled={!isValid}
            >
              <Text style={[styles.createButtonText, isValid && styles.createButtonTextActive]}>
                {t('createProfile.connectButton')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareScrollView>

      <RBSheet
        ref={refRBSheet}
        draggable
        height={400}
        customModalProps={{ statusBarTranslucent: true }}
        customStyles={{
          container: {
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            paddingVertical: 10,
            backgroundColor: card,
          },
          draggableIcon: { width: 80, backgroundColor: border },
        }}
      >
        <View style={styles.bottomSheetContent}>
          <Text style={styles.bottomSheetTitle}>{t('createProfile.selectImage')}</Text>
          <Text style={styles.bottomSheetSubtitle}>{t('createProfile.selectImageSubtitle')}</Text>

          <View style={styles.optionsContainer}>
            <TouchableOpacity style={styles.optionButton} onPress={pickImageFromGallery}>
              <View style={styles.optionIconContainer}>
                <Icon name="image" size={24} color="#4F46E5" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>{t('createProfile.gallery')}</Text>
                <Text style={styles.optionSubtitle}>{t('createProfile.gallerySubtitle')}</Text>
              </View>
              <Icon name="chevron-right" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionButton} onPress={pickImageFromCamera}>
              <View style={styles.optionIconContainer}>
                <Icon name="camera" size={24} color="#059669" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>{t('createProfile.camera')}</Text>
                <Text style={styles.optionSubtitle}>{t('createProfile.cameraSubtitle')}</Text>
              </View>
              <Icon name="chevron-right" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={() => refRBSheet.current.close()}>
            <Text style={styles.cancelButtonText}>{t('createProfile.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </RBSheet>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowLogoutModal(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('createProfile.logoutTitle')}</Text>
            <Text style={styles.modalMessage}>{t('createProfile.logoutMessage')}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.modalCancelText}>{t('createProfile.logoutCancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleConfirmedLogout}
              >
                <Text style={styles.modalConfirmText}>{t('createProfile.logoutConfirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  contentContainer: { flexGrow: 1, paddingBottom: 50 },
  inner: { padding: 16, alignItems: 'center', minHeight: '100%' },
  title: { fontSize: 24, fontWeight: '600', marginVertical: 16, color: '#1F2937', textAlign: 'center' },
  avatarContainer: { marginBottom: 32, alignItems: 'center' },
  avatarCircle: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  editButton: {
    position: 'absolute', right: 0, bottom: 0,
    backgroundColor: '#FFF', padding: 8, borderRadius: 16, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  form: { width: '100%', maxWidth: 360 },
  field: { marginBottom: 24, width: '100%' },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, minHeight: 48,
  },
  input: { flex: 1, padding: 12, fontSize: 14, color: '#1F2937' },
  prefix: { marginLeft: 12, marginRight: 4, color: '#9CA3AF', fontSize: 14 },
  inputContainer: { position: 'relative' },
  inputFull: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8,
    padding: 12, paddingRight: 40, fontSize: 14, minHeight: 48, color: '#1F2937',
  },
  inputStatus: { position: 'absolute', right: 12, top: '50%', transform: [{ translateY: -10 }] },
  loadingIndicator: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#6B7280', fontSize: 18, fontWeight: 'bold' },
  successIndicator: { alignItems: 'center', justifyContent: 'center' },
  errorIndicator: { alignItems: 'center', justifyContent: 'center' },
  suggestionsContainer: { marginTop: 8 },
  suggestionsTitle: { fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: '500' },
  suggestionsList: { paddingVertical: 4 },
  suggestionChip: {
    backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, marginRight: 8, borderWidth: 1, borderColor: '#E5E7EB',
  },
  suggestionText: { color: '#374151', fontSize: 14, fontWeight: '500' },
  inputFull2: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8,
    padding: 12, minHeight: 100, fontSize: 14, color: '#1F2937',
  },
  counter: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  helperText: { color: '#6B7280', fontSize: 12, lineHeight: 18, marginTop: 8 },
  errorText: { color: '#DC2626', fontSize: 12, marginTop: 4 },
  inputErrorWrapper: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  checkboxContainer: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  checkbox: {
    width: 20, height: 20, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 4,
    alignItems: 'center', justifyContent: 'center', marginRight: 8, marginTop: 2,
  },
  checkboxChecked: { backgroundColor: '#1F2937', borderColor: '#1F2937' },
  checkboxLabel: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },
  checkboxTextContainer: { flex: 1 },
  termsSection: {
    marginTop: 8, marginBottom: 24, padding: 16,
    borderRadius: 12, borderWidth: 1,
  },
  termsSectionTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  termsSectionSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  linkText: { color: '#4F46E5', fontWeight: '500', textDecorationLine: 'underline' },
  policyInfoBox: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#EEF2FF',
    padding: 12, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#4F46E5', marginTop: 12,
  },
  policyInfoText: { flex: 1, fontSize: 12, color: '#4338CA', lineHeight: 16, marginLeft: 8 },
  createButton: {
    width: '100%', padding: 16, borderRadius: 8,
    backgroundColor: '#E5E7EB', alignItems: 'center', marginTop: 8,
  },
  createButtonActive: { backgroundColor: '#1F2937' },
  createButtonText: { fontSize: 16, fontWeight: '600', color: '#9CA3AF' },
  createButtonTextActive: { color: '#FFF' },
  bottomSheetContent: { flex: 1 },
  bottomSheetTitle: { fontSize: 18, fontWeight: '600', color: '#111827', textAlign: 'center', marginBottom: 8 },
  bottomSheetSubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  optionsContainer: { marginBottom: 20 },
  optionButton: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 4,
    marginBottom: 12, borderRadius: 12, backgroundColor: '#F9FAFB',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  optionIconContainer: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center', marginRight: 16,
  },
  optionTextContainer: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: '500', color: '#111827', marginBottom: 2 },
  optionSubtitle: { fontSize: 14, color: '#6B7280' },
  cancelButton: {
    width: '100%', paddingVertical: 12, alignItems: 'center',
    justifyContent: 'center', borderRadius: 8, backgroundColor: '#F3F4F6', marginTop: 'auto',
  },
  cancelButtonText: { fontSize: 16, fontWeight: '500', color: '#6B7280' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalContent: {
    width: '100%', maxWidth: 320, backgroundColor: '#FFFFFF',
    borderRadius: 16, padding: 24, elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4,
  },
  modalTitle: { fontSize: 20, fontWeight: '600', color: '#111827', textAlign: 'center', marginBottom: 12 },
  modalMessage: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  modalCancelButton: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center' },
  modalCancelText: { fontSize: 16, fontWeight: '500', color: '#6B7280' },
  modalConfirmButton: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#DC2626', alignItems: 'center' },
  modalConfirmText: { fontSize: 16, fontWeight: '500', color: '#FFFFFF' },
});
