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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../../i18n';
import { createBattle, editBattle } from '../../services/battle';
import { getAllUser } from '../../services/users';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';

const PRIMARY_GRADIENT = ['#513189bd', '#e54ba0']; // user
const COMPANY_GRADIENT = ['#C9A15a', '#C9A15a'];   // company
const BORDER = '#D1D5DB';
const SOFT = '#EEF2FF';
const MUTED = '#6B7280';
const ERROR = '#DC2626';
const MAX_POLL_OPTIONS = 3;

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

const normalizeUserId = value =>
  String(value != null ? value : '')
    .trim();

/** Axios interceptor returns API body (not full axios response). */
const usersFromGetAllUserBody = body => {
  if (!(body?.statusCode === 200 || body?.status === 200)) {
    return [];
  }
  if (Array.isArray(body?.data?.users)) {
    return body.data.users;
  }
  if (Array.isArray(body?.users)) {
    return body.users;
  }
  return [];
};

const mergeUsersById = lists => {
  const map = new Map();
  for (const list of lists) {
    if (!Array.isArray(list)) {
      continue;
    }
    for (const user of list) {
      const id = normalizeUserId(pickFirst(user?.id, user?._id, user?.userId, ''));
      if (id && !map.has(id)) {
        map.set(id, user);
      }
    }
  }
  return [...map.values()];
};

const getFilledOptions = options =>
  (Array.isArray(options) ? options : [])
    .map(option => (typeof option === 'string' ? option.trim() : option.text?.trim() || ''))
    .filter(Boolean);

const isSuccessfulResponse = response =>
  (typeof response?.status === 'number' && response.status >= 200 && response.status < 300) ||
  (typeof response?.statusCode === 'number' && response.statusCode >= 200 && response.statusCode < 300) ||
  response?.success === true ||
  response?.error === false;

const buildFormFromBattle = battle => {
  const rawOptions = Array.isArray(battle?.options) ? battle.options : [];
  const optionImages = Array.isArray(battle?.optionImages) ? battle.optionImages : [];
  const mappedOptions = rawOptions.map((option, index) => {
    if (typeof option === 'string') {
      return { text: option, image: optionImages[index] || null };
    }

    return {
      text: pickFirst(option?.text, option?.label, option?.side, option?.value, ''),
      image: pickFirst(option?.image, option?.imageUrl, optionImages[index], null),
    };
  });

  const endTimeValue = pickFirst(battle?.endTime, battle?.endsAt, '');
  const parsedEndTime = endTimeValue ? new Date(endTimeValue) : null;

  return {
    format: pickFirst(battle?.format, 'POLL'),
    battleType: pickFirst(battle?.battleType, 'OPINION'),
    question: pickFirst(battle?.question, battle?.title, ''),
    options: mappedOptions.length >= 2
      ? mappedOptions
      : createInitialForm().options,
    endTime: parsedEndTime && !Number.isNaN(parsedEndTime.getTime()) ? parsedEndTime : null,
    isPublic: battle?.isPublic !== false,
    invitedUserId: String(pickFirst(battle?.invitedUserId, '')),
    stake: (() => {
      const stakeValue = pickFirst(battle?.stakeAmount, battle?.stake, '');
      return stakeValue === '' || stakeValue == null ? '' : String(stakeValue);
    })(),
  };
};

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
  const { t } = useLanguage();
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
  const [viewerUserId, setViewerUserId] = useState('');
  const imagePickerLaunchTimeoutRef = useRef(null);
  const tabBarHeight = useBottomTabBarHeight();
  const routeParams = useMemo(
    () => route?.params?.params || route?.params || {},
    [route?.params],
  );
  const isEditMode = Boolean(routeParams.editMode && routeParams.battleId);
  const editBattleId = String(routeParams.battleId || '');
  const { bgStyle, accent, card, border, mutedText } = useAppTheme(routeParams.profile);
  const { isDarkMode } = useThemeContext();
  const labelColor = isDarkMode ? '#ffffff' : '#111827';
  const inputBackground = isDarkMode ? 'rgba(255,255,255,0.08)' : (card || '#FFFFFF');
  const themeBorder = border || BORDER;
  const profile = routeParams.profile;
  const isCompanyProfile =
    routeParams?.isCompanyProfile === true ||
    String(routeParams?.isCompanyProfile).toLowerCase() === 'true';
  const isPoll = form.format === 'POLL';
  const isHeadToHead = form.format === 'HEAD_TO_HEAD';
  const filledOptions = useMemo(
    () => getFilledOptions(form.options),
    [form.options],
  );
  const gradientColors = profile !== 'user'
    ? COMPANY_GRADIENT
    : PRIMARY_GRADIENT;
  const bottomBarPaddingBottom = isKeyboardVisible ? 10 : Math.max(tabBarHeight + 8, 14);

  const formatOptions = useMemo(
    () => [
      {
        key: 'POLL',
        title: t('openBattle.formatPollTitle'),
        subtitle: t('openBattle.formatPollSubtitle'),
      },
      {
        key: 'HEAD_TO_HEAD',
        title: t('openBattle.formatHeadToHeadTitle'),
        subtitle: t('openBattle.formatHeadToHeadSubtitle'),
      },
    ],
    [t],
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
    let cancelled = false;
    (async () => {
      const me = normalizeUserId(await AsyncStorage.getItem('userId'));
      if (!cancelled) {
        setViewerUserId(me);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isEditMode || !routeParams.battle) {
      return;
    }

    const nextForm = buildFormFromBattle(routeParams.battle);
    setForm(nextForm);
    setErrors({});

    const invitedUser = routeParams.battle?.invitedUser;
    const invitedUserId = String(pickFirst(routeParams.battle?.invitedUserId, ''));
    if (invitedUser && invitedUserId) {
      setSelectedInviteUser({
        id: invitedUserId,
        name: pickFirst(invitedUser?.name, invitedUser?.displayName, invitedUser?.userName, 'User'),
        userName: pickFirst(invitedUser?.userName, invitedUser?.username, ''),
        avatar: pickFirst(invitedUser?.avatar, invitedUser?.image, invitedUser?.profilePicture, ''),
      });
      setInviteSearchText(
        invitedUser?.userName ? `@${invitedUser.userName}` : pickFirst(invitedUser?.name, ''),
      );
    }
  }, [isEditMode, routeParams.battle]);

  useEffect(() => {
    if (!Object.keys(routeParams).length || isEditMode) {
      return;
    }

    let cancelled = false;
    (async () => {
      const me = normalizeUserId(
        viewerUserId || (await AsyncStorage.getItem('userId')),
      );

      const routeInviteUser = routeParams.invitedUser;
      const routeInviteId = normalizeUserId(
        pickFirst(
          routeInviteUser?.id,
          routeInviteUser?._id,
          routeInviteUser?.userId,
          routeParams.invitedUserId,
          routeParams.invitedUser?.id,
        ),
      );
      const inviteIsSelf = Boolean(me && routeInviteId && routeInviteId === me);

      if (cancelled) {
        return;
      }

      if (routeInviteUser && !inviteIsSelf) {
        const normalizedInviteUser = {
          id: routeInviteId,
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
      } else if (inviteIsSelf) {
        setSelectedInviteUser(null);
        setInviteSearchText('');
      }

      setForm(prev => ({
        ...prev,
        format: routeParams.presetFormat || prev.format,
        invitedUserId: inviteIsSelf
          ? ''
          : String(
            pickFirst(
              routeParams.invitedUserId,
              routeParams.invitedUser?.id,
              routeParams.invitedUser?._id,
              prev.invitedUserId,
            ) ?? '',
          ),
      }));
    })();

    return () => {
      cancelled = true;
    };
  }, [isEditMode, routeParams, viewerUserId]);

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
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setInviteSearchResults([]);
      setInviteSearchLoading(false);
      return;
    }

    setInviteSearchLoading(true);
    try {
      const me = normalizeUserId(
        viewerUserId || (await AsyncStorage.getItem('userId')) || '',
      );
      const fetchInviteSlice = params =>
        getAllUser(params).catch(() => ({ statusCode: 0 }));
      const [byUserName, byDisplayName, byName] = await Promise.all([
        fetchInviteSlice({ userName: trimmed }),
        fetchInviteSlice({ displayName: trimmed }),
        fetchInviteSlice({ name: trimmed }),
      ]);
      const raw = mergeUsersById([
        usersFromGetAllUserBody(byUserName),
        usersFromGetAllUserBody(byDisplayName),
        usersFromGetAllUserBody(byName),
      ]);
      const filtered = raw.filter(user => {
        const uid = normalizeUserId(
          pickFirst(user?.id, user?._id, user?.userId, ''),
        );
        return !(me && uid && uid === me);
      });
      setInviteSearchResults(filtered);
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

  const handleSelectInviteUser = async user => {
    const me = normalizeUserId(
      viewerUserId || (await AsyncStorage.getItem('userId')) || '',
    );
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

    if (me && normalizeUserId(nextUser.id) === me) {
      return;
    }

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
            showToastMessage(toast, 'danger', t('openBattle.failedToPickImage'));
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
        t('openBattle.permissionDenied'),
        t('openBattle.cameraPermissionRequired'),
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
            showToastMessage(toast, 'danger', t('openBattle.failedToCaptureImage'));
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
          options: value === 'POLL'
            ? prev.options.slice(0, MAX_POLL_OPTIONS)
            : [
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

      const texts = options
        .map(opt => opt.text?.trim().toLowerCase())
        .filter(Boolean);

      const hasDuplicates = new Set(texts).size !== texts.length;

      setErrors(prevErrors => ({
        ...prevErrors,
        options: hasDuplicates ? t('openBattle.optionsDuplicate') : '',
      }));

      return {
        ...prev,
        options,
      };
    });
  };

  const addOption = () => {
    setForm(prev => {
      if (prev.format === 'POLL' && prev.options.length >= MAX_POLL_OPTIONS) {
        return prev;
      }

      return {
        ...prev,
        options: [...prev.options, { text: '', image: null }],
      };
    });
  };
  const removeOption = index => {
    setForm(prev => {
      if (prev.options.length <= 2) {
        return prev;
      }

      const options = prev.options.filter(
        (_, currentIndex) => currentIndex !== index,
      );
      const texts = options
        .map(opt => opt.text?.trim().toLowerCase())
        .filter(Boolean);
      const hasDuplicates = new Set(texts).size !== texts.length;

      setErrors(prevErrors => ({
        ...prevErrors,
        options: hasDuplicates ? t('openBattle.optionsDuplicate') : '',
      }));

      return {
        ...prev,
        options,
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
          { backgroundColor: inputBackground, borderColor: themeBorder },
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
          <Text style={[styles.userName, { color: labelColor }]} numberOfLines={1}>
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
      nextErrors.question = t('openBattle.questionRequired');
    }

    if (isPoll && options.length < 2) {
      nextErrors.options = t('openBattle.optionsMinTwo');
    }

    const lowerOptions = options.map(opt => opt.toLowerCase());
    const hasDuplicates = new Set(lowerOptions).size !== lowerOptions.length;

    if (hasDuplicates) {
      nextErrors.options = t('openBattle.optionsDuplicate');
    }

    if (!form.endTime) {
      nextErrors.endTime = t('openBattle.endTimeRequired');
    }

    if (form.endTime && new Date(form.endTime) <= new Date()) {
      nextErrors.endTime = t('openBattle.endTimeFuture');
    }

    if (isHeadToHead && !invitedUserId) {
      nextErrors.invitedUserId = t('openBattle.inviteUserRequired');
    }

    if (isHeadToHead && options.length < 2) {
      nextErrors.options = t('openBattle.headToHeadSidesRequired');
    }

    if (form.stake && Number.isNaN(Number(form.stake))) {
      nextErrors.stake = t('openBattle.stakeInvalid');
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (isEditMode) {
      const question = form.question.trim();
      const options = getFilledOptions(form.options);
      const nextErrors = {};

      if (!question) {
        nextErrors.question = t('openBattle.questionRequired');
      }

      if (options.length < 2) {
        nextErrors.options = isHeadToHead
          ? t('openBattle.headToHeadSidesRequired')
          : t('openBattle.optionsMinTwo');
      }

      const lowerOptions = options.map(opt => opt.toLowerCase());
      if (new Set(lowerOptions).size !== lowerOptions.length) {
        nextErrors.options = t('openBattle.optionsDuplicate');
      }

      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        showToastMessage(toast, 'danger', t('openBattle.fixFieldsError'));
        return;
      }

      if (!editBattleId) {
        showToastMessage(toast, 'danger', t('openBattle.battleUpdatedFail'));
        return;
      }

      setSubmitting(true);
      try {
        const response = await editBattle({
          battleId: editBattleId,
          question,
          options,
        });

        if (isSuccessfulResponse(response)) {
          showToastMessage(
            toast,
            'success',
            response?.message || t('openBattle.battleUpdatedSuccess'),
          );

          const updatedBattle = {
            ...(routeParams.battle || {}),
            ...(response?.data?.battle || response?.data || {}),
            id: editBattleId,
            question,
            title: question,
            options,
          };

          navigation.replace('BattleInProgress', {
            battleId: editBattleId,
            battle: updatedBattle,
            profile,
          });
          return;
        }

        showToastMessage(
          toast,
          'danger',
          response?.message || t('openBattle.battleUpdatedFail'),
        );
      } catch (error) {
        showToastMessage(
          toast,
          'danger',
          error?.message || t('openBattle.somethingWentWrong'),
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!validate()) {
      showToastMessage(toast, 'danger', t('openBattle.fixFieldsError'));
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
      const pollOptions = filledOptions.slice(0, MAX_POLL_OPTIONS);
      payload.options = pollOptions;
      payload.optionImages = form.options
        .slice(0, pollOptions.length)
        .map(opt => (opt.image));
    }

    if (isHeadToHead) {
      payload.invitedUserId = form.invitedUserId.trim();
      payload.options = filledOptions;
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
          response?.message || t('openBattle.battleCreatedSuccess'),
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
          battle: {
            ...(response?.data?.battle || response?.data || payload),
            createdAt: pickFirst(
              response?.data?.battle?.createdAt,
              response?.data?.createdAt,
              payload.createdAt,
              new Date().toISOString(),
            ),
            status: pickFirst(
              response?.data?.battle?.status,
              response?.data?.status,
              payload.status,
              'OPEN',
            ),
          },
          entryPoint: 'open_battle',
          profile,
        });
        return;
      }

      showToastMessage(
        toast,
        'danger',
        response?.message || t('openBattle.battleCreatedFail'),
      );
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.message || t('openBattle.somethingWentWrong'),
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
              } 
              // console.log()
              else if (route?.params?.returnByTo == "Search") {
                navigation.navigate('HomeMain', {
                screen: 'UsersProfile',
                params: {
                  userId: route?.params?.invitedUserId,
                  // username: user?.userName || user?.username || '',
                  returnTo: 'Search',
                },
              });
              } 
              else if (route?.params?.returnByTo == "Home") {
                navigation.navigate('HomeMain', {
                screen: 'UsersProfile',
                params: {
                  userId: route?.params?.invitedUserId,
                  // username: user?.userName || user?.username || '',
                  returnTo: 'Home',
                },
              });
              } 
              else {
                navigation.goBack();
              }
            }}
            style={styles.headerIconBtn}
          >
            <Ionicons name="chevron-back" size={24} color={accent} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: labelColor }]}>
            {isEditMode ? t('openBattle.editScreenTitle') : t('openBattle.screenTitle')}
          </Text>
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                t('openBattle.helpAlertTitle'),
                t('openBattle.helpAlertMessage'),
              )
            }
            style={styles.headerIconBtn}
          >
            <Ionicons name="help-circle-outline" size={22} color={accent} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={[styles.illustration, bgStyle]}>
              <Ionicons name="trophy-outline" size={30} color={accent} />
            </View>
            <Text style={[styles.heroTitle, { color: labelColor }]}>
              {isEditMode ? t('openBattle.editHeroTitle') : t('openBattle.heroTitle')}
            </Text>
            <Text style={styles.heroSubtitle}>
              {isEditMode ? t('openBattle.editHeroSubtitle') : t('openBattle.heroSubtitle')}
            </Text>
          </View>

          <View style={[styles.section, isEditMode && styles.readOnlySection]} pointerEvents={isEditMode ? 'none' : 'auto'}>
            <Text style={[styles.sectionTitle, { color: labelColor }]}>
              {t('openBattle.battleFormatSection')}
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
                    disabled={isEditMode}
                  >
                    <Wrapper
                      {...wrapperProps}
                      style={[
                        styles.formatCard,
                        !isSelected && {
                          backgroundColor: inputBackground,
                          borderColor: themeBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.formatTitle,
                          { color: isSelected ? '#fff' : labelColor },
                        ]}
                      >
                        {option.title}
                      </Text>
                      <Text
                        style={[
                          styles.formatSubtitle,
                          { color: isSelected ? '#F3F4F6' : mutedText },
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
            <Text style={[styles.label, { color: labelColor }]}>{t('openBattle.questionLabel')}</Text>
            <TextInput
              style={[
                styles.input,
                styles.questionInput,
                {
                  backgroundColor: inputBackground,
                  color: labelColor,
                  borderColor: errors.question ? ERROR : themeBorder,
                },
              ]}
              placeholder={t('openBattle.questionPlaceholder')}
              placeholderTextColor={mutedText}
              multiline
              value={form.question}
              onChangeText={value => updateField('question', value)}
            />
            {!!errors.question && (
              <Text style={[styles.errorText, { marginTop: 8 }]}>{errors.question}</Text>
            )}
          </View>

          {(isPoll || isHeadToHead) && (
            <View style={styles.section}>
              <View style={styles.rowBetween}>
                <Text style={[styles.label, { color: labelColor }]}>
                  {isHeadToHead ? t('openBattle.battleSidesLabel') : t('openBattle.optionsLabel')}
                </Text>
                {!isHeadToHead && form.options.length < MAX_POLL_OPTIONS &&
                  <TouchableOpacity onPress={addOption}>
                    <Text style={[styles.addOptionText, { color: labelColor }]}>{t('openBattle.addOption')}</Text>
                  </TouchableOpacity>
                }
              </View>

              {form.options.map((option, index) => (
                <View key={`option-${index}`} style={styles.optionSection}>
                  <View
                    style={[
                      styles.optionEditCard,
                      { backgroundColor: inputBackground, borderColor: themeBorder },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.optionImagePickerBtn}
                      onPress={() => openImagePicker(index)}
                      disabled={isEditMode}
                    >
                      {option.image ? (
                        <Image
                          source={{ uri: option.image }}
                          style={styles.optionEditImage}
                        />
                      ) : (
                        <View style={styles.optionImagePlaceholder}>
                          <Ionicons name="image-outline" size={20} color={mutedText} />
                        </View>
                      )}
                    </TouchableOpacity>

                    <TextInput
                      style={[
                        styles.input,
                        styles.optionEditTextField,
                        {
                          backgroundColor: 'transparent',
                          color: labelColor,
                          borderColor: errors.options ? ERROR : 'transparent',
                          borderWidth: 0,
                        },
                      ]}
                      placeholder={
                        isHeadToHead
                          ? t('openBattle.sidePlaceholder', { number: index + 1 })
                          : t('openBattle.optionPlaceholder', { number: index + 1 })
                      }
                      placeholderTextColor={mutedText}
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
                  {t('openBattle.battleSidesHelperText')}
                </Text>
              ) : null}
            </View>
          )}

          {isHeadToHead && (
            <View style={[styles.section, isEditMode && styles.readOnlySection]} pointerEvents={isEditMode ? 'none' : 'auto'}>
              <Text style={[styles.label, { color: labelColor }]}>{t('openBattle.inviteUserLabel')}</Text>
              <View
                style={[
                  styles.searchInputWrap,
                  {
                    backgroundColor: inputBackground,
                    borderColor: errors.invitedUserId ? ERROR : themeBorder,
                  },
                ]}
              >
                <Ionicons name="search" size={18} color={mutedText} />
                <TextInput
                  style={[styles.searchInput, { color: labelColor }]}
                  placeholder={t('openBattle.inviteSearchPlaceholder')}
                  placeholderTextColor={mutedText}
                  value={inviteSearchText}
                  onChangeText={handleInviteSearchChange}
                />
              </View>
              <Text style={styles.helperText}>
                {t('openBattle.inviteHelperText')}
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

          <View style={[styles.section, isEditMode && styles.readOnlySection]} pointerEvents={isEditMode ? 'none' : 'auto'}>
            <Text style={[styles.label, { color: labelColor }]}>{t('openBattle.endTimeLabel')}</Text>
            <TouchableOpacity
              style={[
                styles.input,
                styles.dateInput,
                {
                  backgroundColor: inputBackground,
                  borderColor: errors.endTime ? ERROR : themeBorder,
                },
              ]}
              onPress={() => {
                if (!isEditMode) {
                  setDatePickerOpen(true);
                }
              }}
              disabled={isEditMode}
            >
              <Text
                style={[
                  styles.dateText,
                  { color: form.endTime ? labelColor : mutedText },
                ]}
              >
                {form.endTime
                  ? formatDisplayDate(form.endTime)
                  : t('openBattle.endTimePlaceholder')}
              </Text>
              <Ionicons name="calendar-outline" size={20} color={mutedText} />
            </TouchableOpacity>
            {!!errors.endTime && (
              <Text style={[styles.errorText, { marginTop: 8 }]}>{errors.endTime}</Text>
            )}
          </View>

          <View style={[styles.section, isEditMode && styles.readOnlySection]} pointerEvents={isEditMode ? 'none' : 'auto'}>
            <Text style={[styles.label, { color: labelColor }]}>
              {t('openBattle.stakeLabel')}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: inputBackground,
                  color: labelColor,
                  borderColor: errors.stake ? ERROR : themeBorder,
                },
              ]}
              placeholder={t('openBattle.stakePlaceholder')}
              placeholderTextColor={mutedText}
              keyboardType="numeric"
              value={form.stake}
              onChangeText={value => updateField('stake', value)}
              editable={!isEditMode}
            />
            {!!errors.stake && (
              <Text style={styles.errorText}>{errors.stake}</Text>
            )}
          </View>

          <View style={[styles.section, isEditMode && styles.readOnlySection]} pointerEvents={isEditMode ? 'none' : 'auto'}>
            <View
              style={[
                styles.publicCard,
                { backgroundColor: inputBackground, borderColor: themeBorder },
              ]}
            >
              <View style={styles.publicCopy}>
                <Text style={[styles.label, { color: labelColor, marginBottom: 4 }]}>
                  {t('openBattle.publicBattleLabel')}
                </Text>
                <Text style={styles.helperText}>
                  {t('openBattle.publicBattleHelper')}
                </Text>
              </View>
              <Switch
                value={form.isPublic}
                onValueChange={value => updateField('isPublic', value)}
                trackColor={{ false: '#CBD5E1', true: '#CBD5E1' }}
                thumbColor={form.isPublic ? accent : '#F8FAFC'}
                disabled={isEditMode}
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
                <Text style={styles.createBtnText}>
                  {isEditMode ? t('openBattle.updateButton') : t('openBattle.createButton')}
                </Text>
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
            <Text style={[styles.imagePickerTitle, { color: labelColor }]}>
              {t('openBattle.addImageTitle')}
            </Text>
          </View>

          <View style={styles.imagePickerDivider} />

          <TouchableOpacity
            style={styles.imagePickerOptionBtn}
            onPress={handlePickFromGallery}
            activeOpacity={0.7}
          >
            <View style={[styles.imagePickerOptionIcon, bgStyle]}>
              <Ionicons name="images-outline" size={28} color={accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.imagePickerOptionTitle, { color: labelColor }]}>
                {t('openBattle.chooseFromGallery')}
              </Text>
              <Text style={styles.imagePickerOptionSubtitle}>
                {t('openBattle.chooseFromGallerySubtitle')}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.imagePickerOptionBtn}
            onPress={handlePickFromCamera}
            activeOpacity={0.7}
          >
            <View style={[styles.imagePickerOptionIcon, bgStyle]}>
              <Ionicons name="camera-outline" size={28} color={accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.imagePickerOptionTitle, { color: labelColor }]}>
                {t('openBattle.takeAPhoto')}
              </Text>
              <Text style={styles.imagePickerOptionSubtitle}>
                {t('openBattle.takeAPhotoSubtitle')}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.imagePickerCancelBtn}
            onPress={() => imagePickerSheetRef.current?.close()}
            activeOpacity={0.7}
          >
            <Text style={styles.imagePickerCancelText}>{t('openBattle.cancel')}</Text>
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
  readOnlySection: {
    opacity: 0.55,
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
