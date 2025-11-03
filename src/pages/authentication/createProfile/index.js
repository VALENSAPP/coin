import React, { useState, useEffect, useRef } from 'react';
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
  FlatList,
  Linking
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useNavigation } from '@react-navigation/native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import StepHeader from './headerSection';
import { checkDisplayName, getProfile } from '../../../services/createProfile';
import { useToast } from 'react-native-toast-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RBSheet from 'react-native-raw-bottom-sheet';
import { useRoute } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const AVATAR_SIZE = 128;

export default function CreateProfile() {
  const navigation = useNavigation();
  const toast = useToast();
  const debounceRef = useRef(null);
  const route = useRoute();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [receiveEmails, setReceiveEmails] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false); // NEW: Terms acceptance
  const [acceptPrivacy, setAcceptPrivacy] = useState(false); // NEW: Privacy policy acceptance
  const [errors, setErrors] = useState({});
  const [imageUri, setImageUri] = useState(null);
  const [serverProfile, setServerProfile] = useState(null);
  const [displayNameStatus, setDisplayNameStatus] = useState(null); // 'approved', 'taken', 'checking', null
  const [displayNameSuggestions, setDisplayNameSuggestions] = useState([]);
  const [isCheckingDisplayName, setIsCheckingDisplayName] = useState(false);
  const refRBSheet = useRef();
  const [imageMeta, setImageMeta] = useState(null);

  const validateUsername = v => {
    if (!v) return 'Username is required';
    // const regex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
    // if (!regex.test(v))
    //   return 'Username must include letters, numbers, and special characters';
    // return '';
  };

  const validateDisplayName = v => (!v ? 'Display name is required' : '');

  const validateBio = v => {
    if (!v) return 'Bio is required';
    if (v.length < 5) return 'Bio must be at least 5 characters';
    if (v.length > 250) return 'Bio cannot exceed 250 characters';
    return '';
  };

  // NEW: Validation for terms and privacy
  const validateTermsAndPrivacy = () => {
    const errors = {};
    if (!acceptTerms) {
      errors.terms = 'You must accept the Terms and Conditions to continue';
    }
    if (!acceptPrivacy) {
      errors.privacy = 'You must accept the Privacy Policy to continue';
    }
    return errors;
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

          // If display name exists, check its status
          if (resp.data.displayName) {
            setDisplayNameStatus('approved');
          }
        } else {
          toast.show(resp.message, { type: 'danger' });
        }
      } catch (err) {
        if (isMounted) {
          toast.show(err.message, { type: 'danger' });
        }
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
      clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    const data = route.params?.agreementData;
    if (data) {
      setAcceptTerms(Boolean(data.acceptTerms));
      setAcceptPrivacy(Boolean(data.acceptPrivacy));
    }
  }, [route.params?.agreementData]);

  const pickImageFromGallery = () => {
    const options = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8,
    };

    launchImageLibrary(options, response => {
      refRBSheet.current.close();

      if (response.didCancel) {
      } else if (response.error) {
        Alert.alert('Error', 'Failed to pick image from gallery');
      } else if (response.assets && response.assets.length > 0) {
        const image = response.assets[0];
        setImageUri(image.uri);
        setImageMeta({
          uri: image.uri,
          type: image.type || 'image/jpeg',
          name: image.fileName || 'profile.jpg',
        });
      }
    });
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
    const options = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8,
      saveToPhotos: true, // Save captured photo to gallery
    };

    launchCamera(options, response => {
      refRBSheet.current.close();

      if (response.didCancel) {
      } else if (response.errorMessage) {
        Alert.alert('Camera Error', response.errorMessage);
      } else if (response.error) {
        Alert.alert('Camera Error', 'Failed to capture image');
      } else if (response.assets && response.assets.length > 0) {
        const image = response.assets[0];
        setImageUri(image.uri);
        setImageMeta({
          uri: image.uri,
          type: image.type || 'image/jpeg',
          name: image.fileName || 'profile.jpg',
        });
      }
    });
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
      console.log('Display name check response:', resp);

      if (resp && resp.statusCode === 200 && resp.success) {
        const { status, suggestions = [] } = resp.data;

        setDisplayNameStatus(status);

        if (status === 'taken') {
          setDisplayNameSuggestions(suggestions);
          setErrors(prev => ({
            ...prev,
            displayName: resp.data.message || 'Display name is already taken',
          }));
        } else if (status === 'approved') {
          setErrors(prev => ({ ...prev, displayName: '' }));
        }
      } else {
        // Handle unexpected response format
        setDisplayNameStatus(null);
        setErrors(prev => ({
          ...prev,
          displayName: 'Error checking display name availability',
        }));
      }
    } catch (err) {
      console.error('Display name check error:', err);
      setDisplayNameStatus(null);
      toast.show(err.message || 'Error checking display name', { type: 'danger' });
    } finally {
      setIsCheckingDisplayName(false);
    }
  };

  const naviGationButton = (data) => {
    if (data === 'termsCondition') {
      Linking.openURL('https://www.valens.app/terms-conditions')
    } else if (data === 'privacyPolicy') {
      Linking.openURL('https://www.valens.app/privacy-policy')
    } else {
      navigation.navigate('TermsCondition')
    }
  }

  const isValid =
    !validateUsername(username) &&
    !validateDisplayName(displayName) &&
    !validateBio(bio) &&
    displayNameStatus === 'approved' &&
    acceptTerms &&
    acceptPrivacy;

  const handleDisplayNameChange = async text => {
    setDisplayName(text);

    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Basic validation
    const basicError = validateDisplayName(text);
    setErrors(prev => ({ ...prev, displayName: basicError }));

    if (!basicError && text.length >= 2) {
      // Debounce API call
      debounceRef.current = setTimeout(() => {
        checkDisplayNameAvailability(text);
      }, 500);
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

  // NEW: Handle opening links
  const openLink = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        toast.show('Cannot open this link', { type: 'warning' });
      }
    } catch (error) {
      console.error('Error opening link:', error);
      toast.show('Error opening link', { type: 'danger' });
    }
  };

  const renderDisplayNameInput = () => {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>Display name</Text>
        <View style={styles.inputContainer}>
          <TextInput
            placeholder="Enter display name"
            placeholderTextColor="#6B7280"
            style={[
              styles.inputFull,
              errors.displayName && styles.inputErrorWrapper,
              // displayNameStatus === 'approved' && styles.inputSuccessWrapper,
            ]}
            value={displayName}
            onChangeText={handleDisplayNameChange}
          />
          <View style={styles.inputStatus}>
            {isCheckingDisplayName && (
              <View style={styles.loadingIndicator}>
                <Text style={styles.loadingText}>...</Text>
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

        {/* {displayNameStatus === 'approved' && !isCheckingDisplayName && (
          <Text style={styles.successText}>Display name is available!</Text>
        )} */}

        {/* Display Name Suggestions */}
        {displayNameSuggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>Suggestions:</Text>
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
  };

  // NEW: Render Terms and Privacy Policy Section
  const renderTermsAndPrivacySection = () => {
    return (
      <View style={styles.termsSection}>
        <Text style={styles.termsSectionTitle}>Legal Agreements</Text>
        <Text style={styles.termsSectionSubtitle}>
          Please read and accept our policies before continuing
        </Text>

        {/* Terms and Conditions */}
        <View style={styles.checkboxContainer}>
          <TouchableOpacity
            style={[styles.checkbox, acceptTerms && styles.checkboxChecked]}
            onPress={() => {
              setAcceptTerms(!acceptTerms);
              setErrors(prev => ({ ...prev, terms: '' }));
            }}
          >
            {acceptTerms && <Icon name="check" size={14} color="#FFF" />}
          </TouchableOpacity>
          <View style={styles.checkboxTextContainer}>
            <Text style={styles.checkboxLabel}>
              I agree to the{' '}
              <Text
                style={styles.linkText}
                onPress={() => naviGationButton('termsCondition')}
              >
                Terms and Conditions
              </Text>
              {' '}including platform rules, user conduct, coin system usage, and anti-discrimination policies.
            </Text>
          </View>
        </View>
        {errors.terms && (
          <Text style={styles.errorText}>{errors.terms}</Text>
        )}

        {/* Privacy Policy */}
        <View style={styles.checkboxContainer}>
          <TouchableOpacity
            style={[styles.checkbox, acceptPrivacy && styles.checkboxChecked]}
            onPress={() => {
              setAcceptPrivacy(!acceptPrivacy);
              setErrors(prev => ({ ...prev, privacy: '' }));
            }}
          >
            {acceptPrivacy && <Icon name="check" size={14} color="#FFF" />}
          </TouchableOpacity>
          <View style={styles.checkboxTextContainer}>
            <Text style={styles.checkboxLabel}>
              I accept the{' '}
              <Text
                style={styles.linkText}
                onPress={() => naviGationButton('privacyPolicy')}
              >
                Privacy Policy
              </Text>
              {' '}and understand how my data will be collected, used, and protected.
            </Text>
          </View>
        </View>
        {errors.privacy && (
          <Text style={styles.errorText}>{errors.privacy}</Text>
        )}

        {/* Additional Platform Policies Info */}
        <View style={styles.policyInfoBox}>
          <Icon name="info" size={16} color="#4F46E5" />
          <Text style={styles.policyInfoText}>
            Our platform promotes a safe, respectful environment. We strictly prohibit discrimination, harassment, and abuse. Violation of these policies may result in account suspension.
          </Text>
        </View>
      </View>
    );
  };

  const continueNext = () => {
    // Validate terms and privacy first
    const termsErrors = validateTermsAndPrivacy();

    if (Object.keys(termsErrors).length > 0) {
      setErrors(prev => ({ ...prev, ...termsErrors }));
      Alert.alert(
        'Agreements Required',
        'You must accept both the Terms and Conditions and Privacy Policy to continue.'
      );
      return;
    }

    if (!isValid) {
      Alert.alert('Invalid', 'Please fix errors before continuing.');
      return;
    }

    const profileData = {
      username,
      displayName,
      bio,
      receiveEmails,
      imageUri,
      image: imageMeta,
      acceptTerms,
      acceptPrivacy,
      agreementTimestamp: new Date().toISOString()
    };

    // Navigate to KYC verification instead of Wallet
    navigation.navigate('kycverify', { profileData, serverProfile });
    //  navigation.navigate('Wallet', { profileData, serverProfile });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
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
          <Text style={styles.title}>Complete your profile</Text>

          <View style={styles.avatarContainer}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.avatarCircle} />
            ) : (
              <LinearGradient
                colors={['#EA580C', '#FCD34D']}
                style={styles.avatarCircle}
              />
            )}
            <TouchableOpacity style={styles.editButton} onPress={() => refRBSheet.current.open()}>
              <Icon name="edit-2" size={16} color="#1F2937" backgroundColor='#f8f2fd' />
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            {/* Username Field */}
            <View style={styles.field}>
              <Text style={styles.label}>Username</Text>
              <View
                style={[
                  styles.inputWrapper,
                  errors.username && styles.inputErrorWrapper,
                ]}
              >
                <Text style={styles.prefix}>@</Text>
                <TextInput
                  placeholder="Enter username"
                  placeholderTextColor="#6B7280"
                  style={styles.input}
                  value={username}
                  onChangeText={txt => {
                    setUsername(txt);
                    setErrors(prev => ({
                      ...prev,
                      username: validateUsername(txt),
                    }));
                  }}
                />
              </View>
              {errors.username && (
                <Text style={styles.errorText}>{errors.username}</Text>
              )}
            </View>

            {/* Display Name Field with Enhanced UI */}
            {renderDisplayNameInput()}

            {/* Bio Field */}
            <View style={styles.field}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                placeholder="Something about yourself"
                placeholderTextColor="#6B7280"
                style={[styles.inputFull2, errors.bio && styles.inputErrorWrapper]}
                multiline
                textAlignVertical="top"
                value={bio}
                onChangeText={txt => {
                  setBio(txt);
                  setErrors(prev => ({
                    ...prev,
                    bio: validateBio(txt),
                  }));
                }}
              />
              <View
                style={{ flexDirection: 'row', justifyContent: 'space-between' }}
              >
                {errors.bio && <Text style={styles.errorText}>{errors.bio}</Text>}
                <Text style={styles.counter}>{bio.length}/250</Text>
              </View>
            </View>
            {/* NEW: Terms and Privacy Policy Section */}
            {renderTermsAndPrivacySection()}

            {/* Email Opt-in */}
            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={[styles.checkbox, receiveEmails && styles.checkboxChecked]}
                onPress={() => setReceiveEmails(!receiveEmails)}
              >
                {receiveEmails && <Icon name="check" size={14} color="#FFF" />}
              </TouchableOpacity>
              <Text style={styles.checkboxLabel}>
                I want to receive email updates on new features and promotions.
              </Text>
            </View>


            {/* Continue Button */}
            <TouchableOpacity
              onPress={continueNext}
              style={[styles.createButton, isValid && styles.createButtonActive]}
              disabled={!isValid}
            >
              <Text
                style={[
                  styles.createButtonText,
                  isValid && styles.createButtonTextActive,
                ]}
              >
                Connect to valens
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareScrollView>

      <RBSheet
        ref={refRBSheet}
        draggable
        height={400}
        customModalProps={{
          statusBarTranslucent: true,
        }}
        customStyles={{
          container: {
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            paddingVertical: 10,
            backgroundColor: '#fff',
          },
          draggableIcon: {
            width: 80,
            backgroundColor: '#ccc',
          },
        }}
      >
        <View style={styles.bottomSheetContent}>
          <Text style={styles.bottomSheetTitle}>Select Image</Text>
          <Text style={styles.bottomSheetSubtitle}>Choose how you want to add your profile picture</Text>

          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={pickImageFromGallery}
            >
              <View style={styles.optionIconContainer}>
                <Icon name="image" size={24} color="#4F46E5" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Gallery</Text>
                <Text style={styles.optionSubtitle}>Choose from your photos</Text>
              </View>
              <Icon name="chevron-right" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={pickImageFromCamera}
            >
              <View style={styles.optionIconContainer}>
                <Icon name="camera" size={24} color="#059669" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Camera</Text>
                <Text style={styles.optionSubtitle}>Take a new photo</Text>
              </View>
              <Icon name="chevron-right" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => refRBSheet.current.close()}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </RBSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f2fd',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 50,
  },
  inner: {
    padding: 16,
    alignItems: 'center',
    minHeight: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginVertical: 16,
    color: '#1F2937',
    textAlign: 'center',
  },
  avatarContainer: {
    marginBottom: 32,
    alignItems: 'center'
  },
  avatarCircle: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  editButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#FFF',
    padding: 8,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  form: {
    width: '100%',
    maxWidth: 360
  },
  field: {
    marginBottom: 24,
    width: '100%'
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#f8f2fd',
    minHeight: 48,
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 14,
    color: '#1F2937',
  },
  prefix: {
    marginLeft: 12,
    marginRight: 4,
    color: '#9CA3AF',
    fontSize: 14,
  },

  // Enhanced Display Name Input Styles
  inputContainer: {
    position: 'relative',
  },
  inputFull: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    paddingRight: 40,
    backgroundColor: '#f8f2fd',
    fontSize: 14,
    minHeight: 48,
    color: '#1F2937',
  },
  inputSuccessWrapper: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  inputStatus: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -10 }],
  },
  loadingIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 18,
    fontWeight: 'bold',
  },
  successIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  successText: {
    color: '#10B981',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },

  // Suggestions Styles
  suggestionsContainer: {
    marginTop: 8,
  },
  suggestionsTitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  suggestionsList: {
    paddingVertical: 4,
  },
  suggestionChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  suggestionText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },

  inputFull2: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    backgroundColor: '#f8f2fd',
    fontSize: 14,
    color: '#1F2937',
  },
  counter: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 4
  },
  inputErrorWrapper: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#1F2937',
    borderColor: '#1F2937',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  checkboxTextContainer: {
    flex: 1,
  },

  // NEW: Terms and Privacy Policy Styles
  termsSection: {
    marginTop: 8,
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#FAFBFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  termsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  termsSectionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
  },
  linkText: {
    color: '#4F46E5',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  policyInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEF2FF',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4F46E5',
    marginTop: 12,
  },
  policyInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#4338CA',
    lineHeight: 16,
    marginLeft: 8,
  },

  createButton: {
    width: '100%',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonActive: {
    backgroundColor: '#1F2937'
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF'
  },
  createButtonTextActive: {
    color: '#FFF'
  },

  // Bottom Sheet Styles
  bottomSheetContent: {
    flex: 1,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  bottomSheetSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  optionsContainer: {
    marginBottom: 20,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  cancelButton: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginTop: 'auto',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
});