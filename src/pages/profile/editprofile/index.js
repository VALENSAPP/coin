import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  PermissionsAndroid,
  FlatList,
} from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { CommonActions, useNavigation, useRoute } from '@react-navigation/native';
import { EditProfile, checkDisplayName } from '../../../services/createProfile';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../../../components/displaytoastmessage';
import RBSheet from 'react-native-raw-bottom-sheet';
import Icon from 'react-native-vector-icons/Feather';
import { setProfileImg } from '../../../redux/actions/ProfileImgAction';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../../redux/actions/LoaderAction';

const ProfileEditScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const userdata = route.params?.userdata;
  const returnTo = route.params?.returnTo;
  const returnScreen = route.params?.returnScreen;

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('OTHER');
  const [wallet, setWallet] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Display name validation states
  const [displayNameStatus, setDisplayNameStatus] = useState(null); // 'approved', 'taken', 'checking', null
  const [displayNameSuggestions, setDisplayNameSuggestions] = useState([]);
  const [isCheckingDisplayName, setIsCheckingDisplayName] = useState(false);
  const [originalDisplayName, setOriginalDisplayName] = useState(''); // To track if name changed

  const refRBSheet = useRef();
  const refRBSheet1 = useRef();
  const toast = useToast();
  const debounceRef = useRef(null);
  const dispatch = useDispatch();

  const genderOptions = [
    { label: 'Male', value: 'MALE', icon: '👨' },
    { label: 'Female', value: 'FEMALE', icon: '👩' },
    { label: 'Other', value: 'OTHER', icon: '⚧️' },
  ];

  useEffect(() => {
    if (userdata) {
      const u = userdata.user || userdata;
      const displayName = u.displayName || '';
      setName(displayName);
      setOriginalDisplayName(displayName);
      setUsername(u.userName || '');
      setBio(u.bio || '');
      setGender(u.gender || 'OTHER');
      setWallet(u.walletAddress || '');
      setProfileImage(u.image || null);

      // If display name exists and hasn't changed, mark as approved
      if (displayName) {
        setDisplayNameStatus('approved');
      }
    }
  }, [userdata]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const validateField = (field, value) => {
    const newErrors = { ...errors };
    if (field === 'name') {
      if (!value.trim()) {
        newErrors.name = 'Display name is required';
      } else {
        delete newErrors.name;
      }
    }
    if (field === 'username') {
      if (!value.trim()) {
        newErrors.username = 'Username is required';
      } else {
        delete newErrors.username;
      }
    }
    if (field === 'bio') {
      if (value.length > 200) {
        newErrors.bio = 'Bio must be less than 200 characters';
      } else {
        delete newErrors.bio;
      }
    }
    setErrors(newErrors);
  };

  const checkDisplayNameAvailability = async (displayName) => {
    // If it's the same as original, no need to check
    if (displayName.trim() === originalDisplayName.trim()) {
      setDisplayNameStatus('approved');
      setDisplayNameSuggestions([]);
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.name;
        return newErrors;
      });
      return;
    }

    if (!displayName || displayName.length < 2) {
      setDisplayNameStatus(null);
      setDisplayNameSuggestions([]);
      return;
    }

    setIsCheckingDisplayName(true);
    setDisplayNameStatus('checking');
    setDisplayNameSuggestions([]);

    try {
      const resp = await checkDisplayName({ displayName: displayName.trim() });
      console.log('Display name check response:', resp);

      if (resp && resp.statusCode === 200 && resp.success) {
        const { status, suggestions = [] } = resp.data;

        setDisplayNameStatus(status);

        if (status === 'taken') {
          setDisplayNameSuggestions(suggestions);
          setErrors(prev => ({
            ...prev,
            name: resp.data.message || 'Display name is already taken',
          }));
        } else if (status === 'approved') {
          setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors.name;
            return newErrors;
          });
        }
      } else {
        // Handle unexpected response format
        setDisplayNameStatus('taken');
        setErrors(prev => ({
          ...prev,
          name: resp.message || 'Display name is already taken',
        }));
      }
    } catch (err) {
      console.error('Display name check error:', err);
      setDisplayNameStatus('taken');
      setErrors(prev => ({
        ...prev,
        name: 'Display name is already taken',
      }));
    } finally {
      setIsCheckingDisplayName(false);
    }
  };

  const handleNameChange = (text) => {
    setName(text);

    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Basic validation first
    validateField('name', text);

    // If basic validation passes and length >= 2, check availability
    if (text.trim() && text.trim().length >= 2 && !errors.name) {
      // Debounce API call
      debounceRef.current = setTimeout(() => {
        checkDisplayNameAvailability(text.trim());
      }, 500);
    } else {
      setDisplayNameStatus(null);
      setDisplayNameSuggestions([]);
    }
  };

  const selectSuggestion = (suggestion) => {
    setName(suggestion);
    setDisplayNameSuggestions([]);
    checkDisplayNameAvailability(suggestion);
  };

  const handleUsernameChange = text => {
    const clean = text.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
    setUsername(clean);
    validateField('username', clean);
  };

  const handleBioChange = text => {
    setBio(text);
    validateField('bio', text);
  };

  const isFormValid = () => {
    return (
      !errors.name &&
      !errors.username &&
      !errors.bio &&
      name.trim() &&
      username.trim() &&
      displayNameStatus === 'approved'
    );
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={handleBack}
          style={{ marginLeft: 15 }}
        >
          <Icon name="arrow-left" size={24} color="#5a2d82" />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={handleSaveAll}
          style={[
            styles.headerButton,
            { opacity: (loading || !isFormValid()) ? 0.5 : 1 }
          ]}
          disabled={loading || !isFormValid()}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#0095F6" />
          ) : (
            <Text style={styles.headerButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      ),
    });
  }, [navigation, loading, isFormValid, handleSaveAll, returnTo, returnScreen]);

  const handleBack = () => {
    if (returnTo === 'wallet' && returnScreen) {
      // Navigate back to wallet stack's specific screen
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: 'wallet',
              state: {
                routes: [{ name: returnScreen }],
                index: 0
              }
            }
          ]
        })
      );
    } else {
      navigation.goBack();
    }
  };

  const pickImageFromGallery = () => {
    const options = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8,
    };

    launchImageLibrary(options, response => {
      refRBSheet1.current.close();

      if (response.didCancel) {
        console.log('User cancelled image selection');
      } else if (response.error) {
        console.log('ImagePicker Error: ', response.error);
        Alert.alert('Error', 'Failed to pick image from gallery');
      } else if (response.assets && response.assets.length > 0) {
        console.log('response.assets[0].uri', response.assets);
        const image = response.assets[0];
        setProfileImage(image.uri);
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
      refRBSheet1.current.close();

      if (response.didCancel) {
        console.log('User cancelled camera');
      } else if (response.errorMessage) {
        console.log('Camera Error: ', response.errorMessage);
        Alert.alert('Camera Error', response.errorMessage);
      } else if (response.error) {
        console.log('Camera Error: ', response.error);
        Alert.alert('Camera Error', 'Failed to capture image');
      } else if (response.assets && response.assets.length > 0) {
        console.log('Camera response.assets', response.assets);
        const image = response.assets[0];
        setProfileImage(image.uri);
      }
    });
  };

  const handleGenderSelect = value => {
    console.log(value, 'check value');
    setGender(value);
  };

  const getGenderDisplay = () => {
    const opt = genderOptions.find(o => o.value === gender);
    return opt ? `${opt.icon} ${opt.label}` : 'Select Gender';
  };

  const handleSaveAll = async () => {
    // Final validation
    validateField('name', name);
    validateField('username', username);
    validateField('bio', bio);

    if (!isFormValid()) {
      showToastMessage(toast, 'danger', 'Please fix all errors before saving');
      return;
    }

    dispatch(showLoader());
    try {
      const formData = new FormData();
      formData.append('displayName', name.trim());
      formData.append('userName', username.trim());
      formData.append('bio', bio.trim());
      formData.append('gender', gender);
      if (profileImage?.startsWith('file://')) {
        formData.append('image', {
          uri: profileImage,
          type: 'image/jpeg',
          name: 'profile.jpg',
        });
      }
      const res = await EditProfile(formData);
      console.log(res, 'checkresponse');
      if (res.statusCode === 200) {
        dispatch(setProfileImg(profileImage));
        showToastMessage(toast, 'success', res.data.message);
        // Update original display name after successful save
        setOriginalDisplayName(name.trim());

        setTimeout(() => {
          handleBack();
        }, 500);

      } else {
        showToastMessage(toast, 'danger', res.data.message);
      }
    } catch (err) {
      showToastMessage(toast, 'danger', err.response?.data?.message || 'Error saving profile');
    } finally {
      dispatch(hideLoader());
    }
  };

  const renderDisplayNameInput = () => {
    return (
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Display Name *</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={[
              styles.input,
              styles.inputWithStatus,
              errors.name && styles.inputError,
              // displayNameStatus === 'approved' && styles.inputSuccess,
            ]}
            placeholder="Enter your display name"
            value={name}
            onChangeText={handleNameChange}
            placeholderTextColor="#999"
          />
          <View style={styles.inputStatus}>
            {isCheckingDisplayName && (
              <View style={styles.loadingIndicator}>
                <ActivityIndicator size="small" color="#6B7280" />
              </View>
            )}
            {displayNameStatus === 'approved' && !isCheckingDisplayName && (
              <View style={styles.successIndicator}>
                <Icon name="check-circle" size={18} color="#10B981" />
              </View>
            )}
            {displayNameStatus === 'taken' && !isCheckingDisplayName && (
              <View style={styles.errorIndicator}>
                <Icon name="x-circle" size={18} color="#DC2626" />
              </View>
            )}
          </View>
        </View>

        {errors.name && displayNameStatus === 'taken' && (
          <Text style={styles.errorText}>{errors.name}</Text>
        )}
        {errors.name && displayNameStatus !== 'taken' && (
          <Text style={styles.errorText}>{errors.name}</Text>
        )}

        {/* Display Name Suggestions */}
        {displayNameSuggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>Suggestions:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsList}
            >
              {displayNameSuggestions.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionChip}
                  onPress={() => selectSuggestion(item)}
                >
                  <Text style={styles.suggestionText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarContainer}>
          <TouchableOpacity
            onPress={() => refRBSheet1.current.open()}
            style={styles.avatarTouchable}
          >
            <View style={styles.imageWrapper}>
              <Image
                source={
                  profileImage
                    ? { uri: profileImage }
                    : require('../../../assets/icons/pngicons/person.png')
                }
                style={styles.profileImage}
              />
              <View style={styles.cameraIcon} >
                <Text style={styles.cameraText}>📷</Text>
              </View>
            </View>
            <Text style={styles.avatarText}>Change profile picture</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formSection}>
          {/* Enhanced Display Name Input */}
          {renderDisplayNameInput()}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Username *</Text>
            <TextInput
              style={[styles.input, errors.username && styles.inputError, styles.inputDisabled]}
              placeholder="Enter your username"
              value={username}
              onChangeText={handleUsernameChange}
              placeholderTextColor="#999"
              editable={false}
            />
            {errors.username && (
              <Text style={styles.errorText}>{errors.username}</Text>
            )}
            <Text style={styles.helperText}>
              Your username cannot be changed
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[
                styles.input,
                styles.bioInput,
                errors.bio && styles.inputError,
              ]}
              placeholder="Tell us about yourself..."
              value={bio}
              onChangeText={handleBioChange}
              placeholderTextColor="#999"
              multiline
              maxLength={200}
            />
            <Text style={styles.characterCount}>{bio.length}/200</Text>
            {errors.bio && <Text style={styles.errorText}>{errors.bio}</Text>}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Gender</Text>
            <TouchableOpacity
              style={styles.genderSelector}
              onPress={() => refRBSheet.current.open()}
            >
              <Text style={styles.genderText}>{getGenderDisplay()}</Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Wallet Address (Read-only)</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={`${wallet.slice(0, 6)}...${wallet.slice(-25)}`}

              editable={false}
              placeholderTextColor="#999"
            />
            <Text style={styles.helperText}>
              Your wallet address cannot be changed here
            </Text>
          </View>
        </View>
      </ScrollView>

      <RBSheet
        ref={refRBSheet}
        draggable
        height={250}
        customModalProps={{
          statusBarTranslucent: true,
        }}
        customStyles={{
          container: {
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
          },
          draggableIcon: {
            width: 80,
          },
        }}
      >
        {/* Header */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Gender</Text>
          {/* <TouchableOpacity onPress={() => refRBSheet.current.close()}>
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity> */}
        </View>

        {/* Options */}
        {genderOptions.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.genderOption,
              gender === opt.value && styles.genderOptionSelected,
            ]}
            onPress={() => {
              handleGenderSelect(opt.value);
              refRBSheet.current.close();
            }}
          >
            <Text style={styles.genderOptionIcon}>{opt.icon}</Text>
            <Text
              style={[
                styles.genderOptionText,
                gender === opt.value && styles.genderOptionTextSelected,
              ]}
            >
              {opt.label}
            </Text>
            {gender === opt.value && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        ))}
      </RBSheet>

      <RBSheet
        ref={refRBSheet1}
        draggable
        height={370}
        // onClose={onClose} // Add this line - crucial for resetting state
        customModalProps={{
          statusBarTranslucent: true,
        }}
        customStyles={{
          container: {
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
          },
          draggableIcon: {
            width: 80,
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
    </>
  );
};

export default ProfileEditScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f2fd' },

  // --- Header Save button
  headerButton: { marginRight: 16, paddingHorizontal: 8, paddingVertical: 4 },
  headerButtonText: { color: '#5a2d82', fontSize: 16, fontWeight: '700' },

  // --- Avatar
  avatarContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f8f2fd',
  },
  avatarTouchable: { alignItems: 'center' },
  imageWrapper: { position: 'relative' },
  profileImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: '#5a2d82',
    backgroundColor: '#fff',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#5a2d82',
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#5a2d82',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  cameraText: { fontSize: 12, color: '#fff' },
  avatarText: {
    marginTop: 10,
    color: '#5a2d82',
    fontSize: 14,
    fontWeight: '600',
  },

  // --- Form section
  formSection: { paddingHorizontal: 20, paddingTop: 20 },
  inputContainer: { marginBottom: 18 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },

  // Inputs
  inputWrapper: { position: 'relative' },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#fff',
  },
  inputWithStatus: { paddingRight: 42 },
  inputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  inputDisabled: { backgroundColor: '#f3f0f7', color: '#6B7280' },

  // Status indicators
  inputStatus: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -10 }],
  },

  // Suggestions
  suggestionsContainer: { marginTop: 8 },
  suggestionsTitle: { fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: '500' },
  suggestionsList: { paddingVertical: 4 },
  suggestionChip: {
    backgroundColor: '#f3f0f7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  suggestionText: { color: '#5a2d82', fontSize: 14, fontWeight: '500' },

  bioInput: { height: 90, textAlignVertical: 'top' },
  characterCount: { fontSize: 12, color: '#6B7280', textAlign: 'right', marginTop: 4 },
  helperText: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  errorText: { color: '#EF4444', fontSize: 12, marginTop: 4 },

  // Gender dropdown
  genderSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  genderText: { fontSize: 16, color: '#374151' },
  dropdownArrow: { fontSize: 12, color: '#6B7280' },

  // Modals
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },

  genderOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  genderOptionSelected: { backgroundColor: '#f3f0f7' },
  genderOptionIcon: { fontSize: 18, marginRight: 12 },
  genderOptionText: { fontSize: 16, color: '#374151', flex: 1 },
  genderOptionTextSelected: { color: '#5a2d82', fontWeight: '600' },
  checkmark: { fontSize: 16, color: '#5a2d82', fontWeight: '600' },

  // Bottom sheet
  bottomSheetContent: { flex: 1, marginHorizontal: 15, marginBottom: 30 },
  bottomSheetTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', textAlign: 'center', marginBottom: 6 },
  bottomSheetSubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 },

  optionsContainer: { marginBottom: 20 },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#5a2d82',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  optionIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#f3f0f7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionTextContainer: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 2 },
  optionSubtitle: { fontSize: 14, color: '#6B7280' },

  cancelButton: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#f3f0f7',
  },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: '#374151' },
});
