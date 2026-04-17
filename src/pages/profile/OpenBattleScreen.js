import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  PermissionsAndroid,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import DatePicker from 'react-native-date-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useToast } from 'react-native-toast-notifications';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { createBattle } from '../../services/battle';
import { getAllUser } from '../../services/users';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useAppTheme } from '../../theme/useApptheme';

const PRIMARY_GRADIENT = ['#513189bd', '#e54ba0']; // user
const COMPANY_GRADIENT = ['#D3B683', '#D3B683'];   // company
const BORDER = '#D1D5DB';
const SOFT = '#EEF2FF';
const MUTED = '#6B7280';
const ERROR = '#DC2626';

const createInitialForm = () => ({
  format: 'POLL',
  battleType: 'OPINION',
  question: '',
  options: [
    { text: '', image: null },
    { text: '', image: null },
  ],
  endTime: null,
  isPublic: true,
  invitedUserId: '',
  stake: '',
});

const pickFirst = (...values) =>
  values.find(value => value !== undefined && value !== null && value !== '');

const getFilledOptions = options =>
  (Array.isArray(options) ? options : [])
    .map(option => (typeof option === 'string' ? option.trim() : option.text?.trim() || ''))
    .filter(Boolean);

const formatDisplayDate = value => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const year = date.getFullYear();
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

export default function OpenBattleScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const toast = useToast();
  const { bgStyle, text, card } = useAppTheme();
  const [form, setForm] = useState(createInitialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [inviteSearchText, setInviteSearchText] = useState('');
  const [inviteSearchResults, setInviteSearchResults] = useState([]);
  const [inviteSearchLoading, setInviteSearchLoading] = useState(false);
  const [selectedInviteUser, setSelectedInviteUser] = useState(null);
  const [imagePickerIndex, setImagePickerIndex] = useState(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const inviteSearchTimeoutRef = useRef(null);
  const imagePickerSheetRef = useRef(null);
  const imagePickerLaunchTimeoutRef = useRef(null);
  const tabBarHeight = useBottomTabBarHeight();
  const routeParams = useMemo(
    () => route?.params?.params || route?.params || {},
    [route?.params],
  );
  const isCompanyProfile =
    routeParams?.isCompanyProfile === true ||
    String(routeParams?.isCompanyProfile).toLowerCase() === 'true';

  const inputBackground = card || '#FFFFFF';
  const isPoll = form.format === 'POLL';
  const isHeadToHead = form.format === 'HEAD_TO_HEAD';
  const filledOptions = useMemo(
    () => getFilledOptions(form.options),
    [form.options],
  );
  const gradientColors = isCompanyProfile
    ? COMPANY_GRADIENT
    : PRIMARY_GRADIENT;
  const bottomBarPaddingBottom = isKeyboardVisible ? 10 : Math.max(tabBarHeight + 8, 14);
  const formatOptions = useMemo(
    () => [
      {
        key: 'POLL',
        title: 'Battle Poll',
        subtitle: 'Add question and answer options',
      },
      {
        key: 'HEAD_TO_HEAD',
        title: 'Head to Head',
        subtitle: 'Add question and invite another user',
      },
    ],
    [],
  );

  const battleTypeOptions = useMemo(
    () => [
      {
        key: 'OPINION',
        title: 'Opinion Battle',
        subtitle: 'Winner by votes and engagement',
      },
      {
        key: 'PREDICTION',
        title: 'Prediction Battle',
        subtitle: 'Winner by outcome accuracy first',
      },
    ],
    [],
  );

  useEffect(() => {
    if (!Object.keys(routeParams).length) {
      return;
    }

    const routeInviteUser = routeParams.invitedUser;
    if (routeInviteUser) {
      const normalizedInviteUser = {
        id: String(
          pickFirst(
            routeInviteUser?.id,
            routeInviteUser?._id,
            routeInviteUser?.userId,
            routeParams.invitedUserId,
            '',
          ),
        ),
        name: pickFirst(
          routeInviteUser?.name,
          routeInviteUser?.displayName,
          routeInviteUser?.fullName,
          routeInviteUser?.userName,
          'User',
        ),
        userName: pickFirst(
          routeInviteUser?.userName,
          routeInviteUser?.username,
          '',
        ),
        avatar: pickFirst(
          routeInviteUser?.avatar,
          routeInviteUser?.image,
          routeInviteUser?.profilePicture,
          '',
        ),
      };

      if (normalizedInviteUser.id) {
        setSelectedInviteUser(normalizedInviteUser);
        setInviteSearchText(
          normalizedInviteUser.userName
            ? `@${normalizedInviteUser.userName}`
            : normalizedInviteUser.name,
        );
      }
    }

    setForm(prev => ({
      ...prev,
      format: routeParams.presetFormat || prev.format,
      invitedUserId:
        routeParams.invitedUserId ||
        routeParams.invitedUser?.id ||
        prev.invitedUserId,
    }));
  }, [routeParams]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (inviteSearchTimeoutRef.current) {
        clearTimeout(inviteSearchTimeoutRef.current);
      }
      if (imagePickerLaunchTimeoutRef.current) {
        clearTimeout(imagePickerLaunchTimeoutRef.current);
        imagePickerLaunchTimeoutRef.current = null;
      }
    };
  }, []);

  const searchInviteUsers = async searchQuery => {
    if (!searchQuery.trim()) {
      setInviteSearchResults([]);
      setInviteSearchLoading(false);
      return;
    }

    setInviteSearchLoading(true);
    try {
      const response = await getAllUser({ userName: searchQuery.trim() });
      if (response?.statusCode === 200 || response?.status === 200) {
        setInviteSearchResults(
          Array.isArray(response?.data?.users) ? response.data.users : [],
        );
      } else {
        setInviteSearchResults([]);
      }
    } catch (error) {
      setInviteSearchResults([]);
    } finally {
      setInviteSearchLoading(false);
    }
  };

  const handleInviteSearchChange = value => {
    setInviteSearchText(value);
    setSelectedInviteUser(null);
    updateField('invitedUserId', '');

    if (inviteSearchTimeoutRef.current) {
      clearTimeout(inviteSearchTimeoutRef.current);
    }

    if (!value.trim()) {
      setInviteSearchResults([]);
      setInviteSearchLoading(false);
      return;
    }

    inviteSearchTimeoutRef.current = setTimeout(() => {
      searchInviteUsers(value);
    }, 400);
  };

  const handleSelectInviteUser = user => {
    const nextUser = {
      id: String(pickFirst(user?.id, user?._id, user?.userId, '')),
      name: pickFirst(
        user?.name,
        user?.displayName,
        user?.fullName,
        user?.userName,
        'User',
      ),
      userName: pickFirst(user?.userName, user?.username, ''),
      avatar: pickFirst(user?.image, user?.avatar, user?.profilePicture, ''),
    };

    setSelectedInviteUser(nextUser);
    setInviteSearchText(
      nextUser.userName ? `@${nextUser.userName}` : nextUser.name,
    );
    setInviteSearchResults([]);
    updateField('invitedUserId', nextUser.id);
  };

  const openImagePicker = index => {
    setImagePickerIndex(index);
    imagePickerSheetRef.current?.open();
  };

  const requestCameraPermission = async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

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
    } catch (error) {
      console.warn('Camera permission error:', error);
      return false;
    }
  };

  const closeSheetBeforeOpeningPicker = callback => {
    imagePickerSheetRef.current?.close();
    if (imagePickerLaunchTimeoutRef.current) {
      clearTimeout(imagePickerLaunchTimeoutRef.current);
    }

    imagePickerLaunchTimeoutRef.current = setTimeout(() => {
      imagePickerLaunchTimeoutRef.current = null;
      callback?.();
    }, 250);
  };

  const handlePickFromGallery = async () => {
    closeSheetBeforeOpeningPicker(() => {
      launchImageLibrary(
        {
          mediaType: 'photo',
          maxWidth: 800,
          maxHeight: 800,
        },
        response => {
          if (response?.didCancel) {
            return;
          }
          if (response?.errorCode || response?.errorMessage) {
            showToastMessage(toast, 'danger', 'Failed to pick image');
            return;
          }

          const asset = response?.assets?.[0];
          if (asset?.uri && imagePickerIndex !== null) {
            updateOptionImage(imagePickerIndex, asset.uri);
            setImagePickerIndex(null);
          }
        },
      );
    });
  };

  const handlePickFromCamera = async () => {
    const hasCameraPermission = await requestCameraPermission();
    if (!hasCameraPermission) {
      Alert.alert(
        'Permission Denied',
        'Camera permission is required to take photos.',
      );
      return;
    }

    closeSheetBeforeOpeningPicker(() => {
      launchCamera(
        {
          mediaType: 'photo',
          maxWidth: 800,
          maxHeight: 800,
        },
        response => {
          if (response?.didCancel) {
            return;
          }
          if (response?.errorCode || response?.errorMessage) {
            showToastMessage(toast, 'danger', 'Failed to capture image');
            return;
          }

          const asset = response?.assets?.[0];
          if (asset?.uri && imagePickerIndex !== null) {
            updateOptionImage(imagePickerIndex, asset.uri);
            setImagePickerIndex(null);
          }
        },
      );
    });
  };

  const updateOptionImage = (index, imageUri) => {
    setForm(prev => {
      const options = [...prev.options];
      options[index] = {
        ...options[index],
        image: imageUri,
      };
      return {
        ...prev,
        options,
      };
    });
  };

  const updateField = (field, value) => {
    setForm(prev => {
      if (field === 'format') {
        return {
          ...prev,
          format: value,
          invitedUserId: value === 'HEAD_TO_HEAD' ? prev.invitedUserId : '',
          options: value === 'POLL' ? prev.options : [
            { text: '', image: null },
            { text: '', image: null },
          ],
        };
      }

      if (field === 'isPublic') {
        return {
          ...prev,
          isPublic: value,
        };
      }

      return {
        ...prev,
        [field]: value,
      };
    });

    setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

 const updateOption = (index, value) => {
  setForm(prev => {
    const options = [...prev.options];
    options[index] = {
      ...options[index],
      text: value,
    };

    // ✅ Live duplicate check
    const texts = options
      .map(opt => opt.text?.trim().toLowerCase())
      .filter(Boolean);

    const hasDuplicates = new Set(texts).size !== texts.length;

    setErrors(prevErrors => ({
      ...prevErrors,
      options: hasDuplicates ? 'Duplicate options are not allowed' : '',
    }));

    return {
      ...prev,
      options,
    };
  });
};
  const addOption = () => {
    setForm(prev => ({
      ...prev,
      options: [...prev.options, { text: '', image: null }],
    }));
  };

  const removeOption = index => {
    setForm(prev => {
      if (prev.options.length <= 2) {
        return prev;
      }

      return {
        ...prev,
        options: prev.options.filter(
          (_, currentIndex) => currentIndex !== index,
        ),
      };
    });
  };

  const renderInviteUserRow = user => {
    const userId = String(pickFirst(user?.id, user?._id, user?.userId, ''));
    const name = pickFirst(
      user?.name,
      user?.displayName,
      user?.fullName,
      user?.userName,
      'User',
    );
    const userName = pickFirst(user?.userName, user?.username, '');
    const avatar = pickFirst(
      user?.image,
      user?.avatar,
      user?.profilePicture,
      '',
    );

    return (
      <TouchableOpacity
        key={userId || `${name}-${userName}`}
        activeOpacity={0.85}
        style={[
          styles.userResultCard,
          { backgroundColor: inputBackground, borderColor: BORDER },
        ]}
        onPress={() => handleSelectInviteUser(user)}
      >
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.userAvatar} />
        ) : (
          <View style={styles.userAvatarFallback}>
            <Ionicons name="person-outline" size={18} color="#FFFFFF" />
          </View>
        )}
        <View style={styles.userCopy}>
          <Text style={[styles.userName, { color: text }]} numberOfLines={1}>
            {name}
          </Text>
          {!!userName && (
            <Text style={styles.userHandle} numberOfLines={1}>
              @{userName}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const validate = () => {
  const nextErrors = {};
  const question = form.question.trim();
  const invitedUserId = form.invitedUserId.trim();

  const options = getFilledOptions(form.options);

  if (!question) {
    nextErrors.question = 'Question is required';
  }

  if (isPoll && options.length < 2) {
    nextErrors.options = 'Please add at least 2 options';
  }

  // ✅ NEW: Duplicate check
  const lowerOptions = options.map(opt => opt.toLowerCase());
  const hasDuplicates = new Set(lowerOptions).size !== lowerOptions.length;

  if (hasDuplicates) {
    nextErrors.options = 'Duplicate options are not allowed';
  }

  if (!form.endTime) {
    nextErrors.endTime = 'End time is required';
  }

  if (form.endTime && new Date(form.endTime) <= new Date()) {
    nextErrors.endTime = 'End time must be in the future';
  }

  if (isHeadToHead && !invitedUserId) {
    nextErrors.invitedUserId = 'Please add the user you want to invite';
  }

  if (isHeadToHead && options.length < 2) {
    nextErrors.options = 'Please add 2 battle sides for head-to-head';
  }

  if (form.stake && Number.isNaN(Number(form.stake))) {
    nextErrors.stake = 'Stake must be a valid number';
  }

  setErrors(nextErrors);
  return Object.keys(nextErrors).length === 0;
};

  const handleSubmit = async () => {
    if (!validate()) {
      showToastMessage(toast, 'danger', 'Please fix the highlighted fields.');
      return;
    }

    const payload = {
      format: form.format,
      battleType: form.battleType,
      question: form.question,
      endTime: new Date(form.endTime).toISOString(),
      isPublic: form.isPublic,
    };

    if (isPoll) {
      payload.options = filledOptions;
      // Include image metadata if needed
      payload.optionImages = form.options
        .slice(0, filledOptions.length)
        .map(opt => (opt.image));
    }

    if (isHeadToHead) {
      payload.invitedUserId = form.invitedUserId.trim();
      payload.options = filledOptions;
      // Include image metadata if needed
      payload.optionImages = form.options
        .slice(0, filledOptions.length)
        .map(opt => (opt.image));
    }

    if (form.stake !== '' && !Number.isNaN(Number(form.stake))) {
      payload.stake = Number(form.stake);
    }

    setSubmitting(true);
    console.log('Submitting battle with payload:', payload);
    try {
      const response = await createBattle(payload);
      console.log('Received response:', response);
      if (
        (response?.statusCode >= 200 && response?.statusCode < 300) ||
        response?.success ||
        response?.error === false
      ) {
        showToastMessage(
          toast,
          'success',
          response?.message || 'Battle created successfully',
        );
        setForm(createInitialForm());
        setErrors({});
        navigation.replace('BattleInProgress', {
          battleId:
            response?.data?.battle?.id ||
            response?.data?.battle?._id ||
            response?.data?.id ||
            response?.data?._id ||
            '',
          battle: response?.data?.battle || response?.data || payload,
          entryPoint: 'open_battle',
        });
        return;
      }

      showToastMessage(
        toast,
        'danger',
        response?.message || 'Failed to create battle',
      );
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.message || 'Something went wrong',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (route?.params?.fromUsersProfile) {
                navigation.navigate('ProfileMain', {
                  screen: 'Profile',
                });
              } else {
                navigation.goBack();
              }
            }}
            style={styles.headerIconBtn}
          >
            <Ionicons name="chevron-back" size={24} color={text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: text }]}>
            Create Battle
          </Text>
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'Battle Format',
                'Poll needs a question and options. Head to head needs a question, two sides, and the invited user.',
              )
            }
            style={styles.headerIconBtn}
          >
            <Ionicons name="help-circle-outline" size={22} color={text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={[styles.illustration, bgStyle]}>
              <Ionicons name="trophy-outline" size={30} color={text} />
            </View>
            <Text style={[styles.heroTitle, { color: text }]}>
              Set up your battle
            </Text>
            <Text style={styles.heroSubtitle}>
              Choose the format, add the required details, and publish.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: text }]}>
              Battle Format
            </Text>
            <View style={styles.formatRow}>
              {formatOptions.map(option => {
                const isSelected = form.format === option.key;
                const Wrapper = isSelected ? LinearGradient : View;
                const wrapperProps = isSelected
                  ? {
                    colors: gradientColors,
                    start: { x: 0, y: 0 },
                    end: { x: 1, y: 0 },
                  }
                  : {};

                return (
                  <TouchableOpacity
                    key={option.key}
                    style={styles.formatCell}
                    onPress={() => updateField('format', option.key)}
                    activeOpacity={0.88}
                  >
                    <Wrapper
                      {...wrapperProps}
                      style={[
                        styles.formatCard,
                        !isSelected && {
                          backgroundColor: SOFT,
                          borderColor: BORDER,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.formatTitle,
                          { color: isSelected ? '#fff' : '#111827' },
                        ]}
                      >
                        {option.title}
                      </Text>
                      <Text
                        style={[
                          styles.formatSubtitle,
                          { color: isSelected ? '#F3F4F6' : MUTED },
                        ]}
                      >
                        {option.subtitle}
                      </Text>
                    </Wrapper>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: text }]}>
              Winner Logic
            </Text>
            <View style={styles.formatRow}>
              {battleTypeOptions.map(option => {
                const isSelected = form.battleType === option.key;
                const Wrapper = isSelected ? LinearGradient : View;
                const wrapperProps = isSelected
                  ? {
                    colors: gradientColors,
                    start: { x: 0, y: 0 },
                    end: { x: 1, y: 0 },
                  }
                  : {};

                return (
                  <TouchableOpacity
                    key={option.key}
                    style={styles.formatCell}
                    onPress={() => updateField('battleType', option.key)}
                    activeOpacity={0.88}
                  >
                    <Wrapper
                      {...wrapperProps}
                      style={[
                        styles.formatCard,
                        !isSelected && {
                          backgroundColor: SOFT,
                          borderColor: BORDER,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.formatTitle,
                          { color: isSelected ? '#fff' : '#111827' },
                        ]}
                      >
                        {option.title}
                      </Text>
                      <Text
                        style={[
                          styles.formatSubtitle,
                          { color: isSelected ? '#F3F4F6' : MUTED },
                        ]}
                      >
                        {option.subtitle}
                      </Text>
                    </Wrapper>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: text }]}>Question</Text>
            <TextInput
              style={[
                styles.input,
                styles.questionInput,
                {
                  backgroundColor: inputBackground,
                  color: text,
                  borderColor: errors.question ? ERROR : BORDER,
                },
              ]}
              placeholder="Write your battle question"
              placeholderTextColor={MUTED}
              multiline
              value={form.question}
              onChangeText={value => updateField('question', value)}
            />
            {!!errors.question && (
              <Text style={[styles.errorText, {marginTop: 8}]}>{errors.question}</Text>
            )}
          </View>

          {(isPoll || isHeadToHead) && (
            <View style={styles.section}>
              <View style={styles.rowBetween}>
                <Text style={[styles.label, { color: text }]}>
                  {isHeadToHead ? 'Battle Sides' : 'Options'}
                </Text>
                <TouchableOpacity onPress={addOption}>
                  <Text style={[styles.addOptionText, { color: text}]}>+ Add Option</Text>
                </TouchableOpacity>
              </View>

              {form.options.map((option, index) => (
                <View key={`option-${index}`} style={styles.optionSection}>
                  <View
                    style={[
                      styles.optionEditCard,
                      { backgroundColor: inputBackground, borderColor: BORDER },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.optionImagePickerBtn}
                      onPress={() => openImagePicker(index)}
                    >
                      {option.image ? (
                        <Image
                          source={{ uri: option.image }}
                          style={styles.optionEditImage}
                        />
                      ) : (
                        <View style={styles.optionImagePlaceholder}>
                          <Ionicons name="image-outline" size={20} color={MUTED} />
                        </View>
                      )}
                    </TouchableOpacity>

                    <TextInput
                      style={[
                        styles.input,
                        styles.optionEditTextField,
                        {
                          backgroundColor: 'transparent',
                          color: text,
                          borderColor: errors.options ? ERROR : 'transparent',
                          borderWidth: 0,
                        },
                      ]}
                      placeholder={
                        isHeadToHead ? `Side ${index + 1}` : `Option ${index + 1}`
                      }
                      placeholderTextColor={MUTED}
                      value={option.text}
                      onChangeText={value => updateOption(index, value)}
                    />

                    <TouchableOpacity
                      onPress={() => removeOption(index)}
                      disabled={form.options.length <= 2}
                      style={styles.optionRemoveBtn}
                    >
                      <Ionicons
                        name="close-circle"
                        size={24}
                        color={form.options.length <= 2 ? '#CBD5E1' : '#EF4444'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {!!errors.options && (
                <Text style={styles.errorText}>{errors.options}</Text>
              )}
              {isHeadToHead ? (
                <Text style={styles.helperText}>
                  Add the two sides for this duel. Users will choose a side from
                  battle in progress.
                </Text>
              ) : null}
            </View>
          )}

          {isHeadToHead && (
            <View style={styles.section}>
              <Text style={[styles.label, { color: text }]}>Invite User</Text>
              <View
                style={[
                  styles.searchInputWrap,
                  {
                    backgroundColor: inputBackground,
                    borderColor: errors.invitedUserId ? ERROR : BORDER,
                  },
                ]}
              >
                <Ionicons name="search" size={18} color={MUTED} />
                <TextInput
                  style={[styles.searchInput, { color: text }]}
                  placeholder="Search username"
                  placeholderTextColor={MUTED}
                  value={inviteSearchText}
                  onChangeText={handleInviteSearchChange}
                />
              </View>
              <Text style={styles.helperText}>
                Head to head needs the other user you want to challenge. Select
                a user and we will use that user id for the invite.
              </Text>
              {!!errors.invitedUserId && (
                <Text style={styles.errorText}>{errors.invitedUserId}</Text>
              )}

              {selectedInviteUser ? (
                <View
                  style={[
                    styles.selectedUserCard,
                    { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' },
                  ]}
                >
                  <View style={styles.selectedUserInfo}>
                    {selectedInviteUser.avatar ? (
                      <Image
                        source={{ uri: selectedInviteUser.avatar }}
                        style={styles.userAvatar}
                      />
                    ) : (
                      <View style={styles.userAvatarFallback}>
                        <Ionicons
                          name="person-outline"
                          size={18}
                          color="#FFFFFF"
                        />
                      </View>
                    )}
                    <View style={styles.userCopy}>
                      <Text style={styles.selectedUserTitle}>
                        {selectedInviteUser.name}
                      </Text>
                      {!!selectedInviteUser.userName && (
                        <Text style={styles.selectedUserSubtitle}>
                          @{selectedInviteUser.userName}
                        </Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedInviteUser(null);
                      setInviteSearchText('');
                      updateField('invitedUserId', '');
                    }}
                  >
                    <Ionicons name="close-circle" size={22} color="#7C3AED" />
                  </TouchableOpacity>
                </View>
              ) : null}

              {!selectedInviteUser && inviteSearchLoading ? (
                <View style={styles.searchStateWrap}>
                  <ActivityIndicator size="small" color="#7C3AED" />
                </View>
              ) : null}

              {!selectedInviteUser && inviteSearchResults.length > 0 ? (
                <View style={styles.userResultsWrap}>
                  {inviteSearchResults.slice(0, 6).map(renderInviteUserRow)}
                </View>
              ) : null}
            </View>
          )}

          <View style={styles.section}>
            <Text style={[styles.label, { color: text }]}>End Time</Text>
            <TouchableOpacity
              style={[
                styles.input,
                styles.dateInput,
                {
                  backgroundColor: inputBackground,
                  borderColor: errors.endTime ? ERROR : BORDER,
                },
              ]}
              onPress={() => setDatePickerOpen(true)}
            >
              <Text
                style={[
                  styles.dateText,
                  { color: form.endTime ? text : MUTED },
                ]}
              >
                {form.endTime
                  ? formatDisplayDate(form.endTime)
                  : 'Select end time'}
              </Text>
              <Ionicons name="calendar-outline" size={20} color={MUTED} />
            </TouchableOpacity>
            {!!errors.endTime && (
              <Text style={[styles.errorText, {marginTop: 8}]}>{errors.endTime}</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: text }]}>
              Stake (Optional)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: inputBackground,
                  color: text,
                  borderColor: errors.stake ? ERROR : BORDER,
                },
              ]}
              placeholder="0"
              placeholderTextColor={MUTED}
              keyboardType="numeric"
              value={form.stake}
              onChangeText={value => updateField('stake', value)}
            />
            {!!errors.stake && (
              <Text style={styles.errorText}>{errors.stake}</Text>
            )}
          </View>

          <View style={styles.section}>
            <View
              style={[
                styles.publicCard,
                { backgroundColor: inputBackground, borderColor: BORDER },
              ]}
            >
              <View style={styles.publicCopy}>
                <Text style={[styles.label, { color: text, marginBottom: 4 }]}>
                  Public Battle
                </Text>
                <Text style={styles.helperText}>
                  Keep this on to create a public battle.
                </Text>
              </View>
              <Switch
                value={form.isPublic}
                onValueChange={value => updateField('isPublic', value)}
                trackColor={{ false: '#CBD5E1', true: '#CBD5E1' }}
                thumbColor={form.isPublic ? text : '#F8FAFC'}
              />
            </View>
          </View>
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: bottomBarPaddingBottom }]}>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.createBtn}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createBtnText}>CREATE BATTLE</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <DatePicker
          modal
          mode="datetime"
          open={datePickerOpen}
          date={form.endTime || new Date(Date.now() + 60 * 60 * 1000)}
          minimumDate={new Date()}
          onCancel={() => setDatePickerOpen(false)}
          onConfirm={date => {
            updateField('endTime', date);
            setDatePickerOpen(false);
          }}
        />

        <RBSheet
          ref={imagePickerSheetRef}
          height={310}
          draggable={true}
          customModalProps={{
            statusBarTranslucent: true,
            presentationStyle: 'overFullScreen',
          }}
          customStyles={{
            container: {
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 8,
              backgroundColor: card,
            },
          }}
          onClose={() => { }}
        >

          <View style={styles.imagePickerHeader}>
            <Text style={[styles.imagePickerTitle, { color: text }]}>
              Add Image
            </Text>
          </View>

          <View style={styles.imagePickerDivider} />

          <TouchableOpacity
            style={styles.imagePickerOptionBtn}
            onPress={handlePickFromGallery}
            activeOpacity={0.7}
          >
            <View style={[styles.imagePickerOptionIcon, bgStyle]}>
              <Ionicons name="images-outline" size={28} color={text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.imagePickerOptionTitle, { color: text }]}>
                Choose from Gallery
              </Text>
              <Text style={styles.imagePickerOptionSubtitle}>
                Select an existing image
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.imagePickerOptionBtn}
            onPress={handlePickFromCamera}
            activeOpacity={0.7}
          >
            <View style={[styles.imagePickerOptionIcon, bgStyle]}>
              <Ionicons name="camera-outline" size={28} color={text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.imagePickerOptionTitle, { color: text }]}>
                Take a Photo
              </Text>
              <Text style={styles.imagePickerOptionSubtitle}>
                Capture a new image
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.imagePickerCancelBtn}
            onPress={() => imagePickerSheetRef.current?.close()}
            activeOpacity={0.7}
          >
            <Text style={styles.imagePickerCancelText}>Cancel</Text>
          </TouchableOpacity>
        </RBSheet>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 14,
    paddingBottom: 20,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  illustration: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: MUTED,
    textAlign: 'center',
  },
  section: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  formatRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formatCell: {
    flex: 1,
  },
  formatCard: {
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 5,
    borderWidth: 1,
    minHeight: 82,
  },
  formatTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  formatSubtitle: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  searchInputWrap: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  questionInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addOptionText: {
    fontWeight: '800',
    fontSize: 13,
  },
  helperText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 6,
  },
  sideChoiceWrap: {
    marginTop: 8,
    gap: 10,
  },
  searchStateWrap: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userResultsWrap: {
    marginTop: 10,
    gap: 8,
  },
  userResultCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedUserCard: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  userAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCopy: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '800',
  },
  userHandle: {
    fontSize: 12,
    fontWeight: '600',
    color: MUTED,
    marginTop: 2,
  },
  selectedUserTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#5B21B6',
  },
  selectedUserSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7C3AED',
    marginTop: 2,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  publicCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  publicCopy: {
    flex: 1,
  },
  errorText: {
    color: ERROR,
    fontSize: 12,
    fontWeight: '600',
    marginTop: -2,
    // paddingHorizontal: 8,
    marginBottom: 6,
  },
  bottomBar: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  createBtn: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 1,
  },
  optionSection: {
    marginBottom: 16,
  },
  optionEditCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  optionImagePickerBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  optionEditImage: {
    width: '100%',
    height: '100%',
  },
  optionImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
  },
  optionEditTextField: {
    flex: 1,
    paddingHorizontal: 0,
    paddingVertical: 0,
    fontSize: 14,
    fontWeight: '600',
  },
  optionRemoveBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionPreviewCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  optionPreviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  optionBadgeWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionImageWrapper: {
    position: 'relative',
    width: 48,
    height: 48,
  },
  optionImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  imageCloseBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionBadgeInfo: {
    flex: 1,
  },
  optionNameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  optionPreviewName: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  optionPreviewRight: {
    alignItems: 'flex-end',
  },
  optionPercentage: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  optionVoteCount: {
    fontSize: 11,
    fontWeight: '600',
    color: MUTED,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  imagePickerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  imagePickerHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  imagePickerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  imagePickerDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 8,
  },
  imagePickerOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  imagePickerOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePickerOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  imagePickerOptionSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: MUTED,
  },
  imagePickerCancelBtn: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  imagePickerCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  sidePreviewCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sideBadgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sideImageWrapper: {
    position: 'relative',
    width: 48,
    height: 48,
  },
  sideImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  sideImageCloseBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideBadgeInfo: {
    flex: 1,
  },
  sideNameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  sidePreviewName: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  sideChoiceMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
    marginTop: 2,
  },
});
