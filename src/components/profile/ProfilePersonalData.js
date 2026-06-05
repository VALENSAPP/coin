import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  Modal,
  Pressable,
  Platform,
  PermissionsAndroid,
  Linking,
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import ImageZoom from 'react-native-image-pan-zoom';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import {
  pickProfileImageFromCamera,
  pickProfileImageFromGallery,
  uriFromCropPath,
} from '../../utils/profileImageCrop';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import ProfileModal from '../modals/ProfileModal';
import UsernameModal from '../modals/UsernameModal';
import TradeModal from '../modals/TradeModal';
import SupportCreatorModal from '../modals/SupportCreatorModal';
import WelcomeValensModal from '../modals/WelcomeValensModal';
import { showLoader, hideLoader } from '../../redux/actions/LoaderAction';
import { useDispatch } from 'react-redux';
import { EditProfile, getProfile } from '../../services/createProfile';
import { PostStory } from '../../services/stories';
import { buildStoryMetaPayload } from '../../utils/buildStoryMeta';
import {
  appendStoryAudioFiles,
  prepareStoryClipsAudioForUpload,
} from '../../utils/storyAudioUpload';
import {
  WhiteDragonfly,
  Thread,
  BlueDragonfly,
  SoftGrayDragonfly,
  LilacDragonfly,
  GoldDragonfly,
  GoldLavenderDragonfly,
  Twitter,
  Tiktok,
  Linkedin,
} from '../../assets/icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setProfileImg } from '../../redux/actions/ProfileImgAction';
import { showToastMessage } from '../displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import StoryComposer from '../home/story.js/StoryComposer';
import { getUserCredentials } from '../../services/post';
import { metaMaskRecived } from '../../services/wallet';
import { battleByUserId } from '../../services/battle';
import { isBattleLive } from '../../utils/battleCardUtils';
import { useAppTheme } from '../../theme/useApptheme';
import { getSupportRecipientWalletAddress } from '../../utils/walletPaymentSupport';
import { useWalletConnectSupport } from '../../context/WalletConnectSupportContext';
import { isSupportAllowed, normalizeProfileType } from '../../utils/supportEligibility';
import HexAvatar from '../home/story.js/HexAvatar';
import { useLanguage } from '../../i18n';

const KYC_WELCOME_SHOWN_KEY = 'kycWelcomeShownEver';
const LEGACY_KYC_WELCOME_SHOWN_KEY = 'kycWelcomeShown';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PROFILE_IMAGE_PREVIEW_SIZE = Math.min(SCREEN_WIDTH * 0.9, 340);
const TOTAL_SUPPORT_CARD_HEIGHT = 72;

function isProfileFullyIdentityVerified(user) {
  if (!user || user.kyc !== true) return false;
  if (typeof user.kyb === 'boolean') return user.kyb === true;
  return true;
}

export function getDragonflyIcon(followers) {
  const parsedFollowers = Number(followers);
  const safeFollowers = Number.isFinite(parsedFollowers) ? Math.max(0, parsedFollowers) : 0;
  if (safeFollowers <= 50) return WhiteDragonfly;
  if (safeFollowers <= 10000) return SoftGrayDragonfly;
  if (safeFollowers <= 500000) return LilacDragonfly;
  if (safeFollowers <= 1000000) return GoldDragonfly;
  if (safeFollowers >= 10000000) return GoldLavenderDragonfly;
  return WhiteDragonfly;
}

const ProfilePersonData = ({
  displayName,
  username,
  profilepic,
  bio,
  profileType,
  dashboard,
  fromUsersProfile = false,
  isFollowing = null,
  onToggleFollow,
  followBusy = false,
  targetUserId,
  purchaseSheetRef,
  onStoryUploaded,
  userData,
  executeFollowAction,
  returnByTo,
  screenParams,
  compactLocked = false,
}) => {
  const navigation = useNavigation();
  const { t } = useLanguage();
  const [profileImage, setProfileImage] = useState(null);

  const collapseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(collapseAnim, {
      toValue: compactLocked ? 0 : 1,
      duration: compactLocked ? 80 : 200,
      useNativeDriver: false,
    }).start();
  }, [collapseAnim, compactLocked]);

  const animatedMaxHeight = collapseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 260],
  });

  const animatedOpacity = collapseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const fetchAllData = useCallback(async () => {
    try {
      dispatch(showLoader());
      const [profileResponse] = await Promise.all([getUserCredentials(userData?.id)]);
      if (profileResponse?.statusCode === 200) {
        let userDataToSet;
        if (profileResponse.data && profileResponse.data.user) {
          userDataToSet = profileResponse.data.user;
        } else if (profileResponse.data) {
          userDataToSet = profileResponse.data;
        } else {
          userDataToSet = profileResponse;
        }
        setUserProfile(userDataToSet.profile || '');
        await AsyncStorage.setItem('profile', userDataToSet.profile);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      dispatch(hideLoader());
    }
  }, [dispatch, userData?.id]);

  useEffect(() => {
    setProfileImage(profilepic || null);
    fetchAllData();
  }, [profilepic, fetchAllData]);

  const PLACEHOLDER_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
  const avatarUri =
    typeof profileImage === 'string' && profileImage.length ? profileImage : PLACEHOLDER_AVATAR;

  const [modalVisible, setModalVisible] = useState(false);
  const [usernameModalVisible, setUsernameModalVisible] = useState(false);
  const [tradeModalVisible, setTradeModalVisible] = useState(false);
  const [composerVisible, setComposerVisible] = useState(false);
  const [composerList, setComposerList] = useState([]);
  const [data, setData] = useState(null);
  const [userId, setUserId] = useState(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [isBusinessProfile, setIsBusinessProfile] = useState(false);
  const [userProfile, setUserProfile] = useState('');
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [supportDisclaimerVisible, setSupportDisclaimerVisible] = useState(false);
  const [followActionsOpen, setFollowActionsOpen] = useState(false);
  const [welcomeModalVisible, setWelcomeModalVisible] = useState(false);
  const [totalSupportOpen, setTotalSupportOpen] = useState(false);
  const [totalSupportLoading, setTotalSupportLoading] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [totalSupportAmount, setTotalSupportAmount] = useState(0);
  const [hasLiveBattle, setHasLiveBattle] = useState(false);
  const totalSupportAnim = useRef(new Animated.Value(0)).current;
  const followActionsAnim = useRef(new Animated.Value(0)).current;
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState('battle');
  const toast = useToast();
  const { startSupportPayment } = useWalletConnectSupport();
  const effectiveProfileType = userData?.profile ? userData?.profile : profileType;
  const normalizedProfileThemeType =
    typeof effectiveProfileType === 'string' ? effectiveProfileType.toLowerCase() : '';
  const isCompanyProfile = normalizedProfileThemeType === 'company';
  const profileActionGradient = isCompanyProfile
    ? ['#D3B683', '#D3B683']
    : ['#513189bd', '#e54ba0'];
  const { bgStyle, textStyle, text, card, bg } = useAppTheme(effectiveProfileType);
  const route = useRoute();
  const showIdentityVerified = isProfileFullyIdentityVerified(userData);
  const isSubscriptionActive = userData?.subscriptionStatus == 'ACTIVE';
  const battleStatusPulseAnim = useRef(new Animated.Value(1)).current;

  const viewedBattleUserId = useMemo(
    () =>
      String(
        targetUserId || userData?.id || userData?._id || userData?.userId || userId || '',
      ).trim(),
    [targetUserId, userData?.id, userData?._id, userData?.userId, userId],
  );

  const resolvedDisplayName =
    displayName ||
    userData?.displayName ||
    userData?.businessName ||
    userData?.companyProfile?.businessName ||
    userData?.company?.businessName;

  const Userdata = {
    Displayname: resolvedDisplayName || t('profilePersonData.noName'),
    Username: username || t('profilePersonData.unknownUser'),
    profilePic: profileImage,
    Bio: bio == 'null' ? '' : bio,
    totalPost: dashboard?.totalPosts ?? t('profilePersonData.notAvailable'),
    Followers: dashboard?.totalFollowers ?? t('profilePersonData.notAvailable'),
    Followings: dashboard?.totalFollowing ?? t('profilePersonData.notAvailable'),
    userId: userId,
  };
  

  console.log(Userdata.Bio, 'BIOOOO');

  const requestCameraPermission = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: t('profilePersonData.cameraPermissionTitle'),
          message: t('profilePersonData.cameraPermissionMessage'),
          buttonNeutral: t('profilePersonData.cameraPermissionNeutral'),
          buttonNegative: t('profilePersonData.cameraPermissionNegative'),
          buttonPositive: t('profilePersonData.cameraPermissionPositive'),
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  };

  const handleProfileImagePress = () => {
    if (fromUsersProfile) {
      setImageViewerVisible(true);
      return;
    }
    Alert.alert(
      t('profilePersonData.uploadImageTitle'),
      t('profilePersonData.uploadImageMessage'),
      [
        { text: t('profilePersonData.viewProfile'), onPress: () => setImageViewerVisible(true) },
        { text: t('profilePersonData.addDrops'), onPress: () => handleStoryUpload() },
        { text: t('profilePersonData.profileImage'), onPress: () => showImageSourceOptions() },
        { text: t('profilePersonData.cancel'), style: 'cancel' },
      ],
      { cancelable: true },
    );
  };

  const handleStoryUpload = () => {
    Alert.alert(
      t('profilePersonData.addDropsTitle'),
      t('profilePersonData.addDropsMessage'),
      [
        { text: t('profilePersonData.camera'), onPress: () => openStoryCamera() },
        { text: t('profilePersonData.gallery'), onPress: () => openStoryGallery() },
        { text: t('profilePersonData.cancel'), style: 'cancel' },
      ],
    );
  };

  const openStoryCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert(
        t('profilePersonData.permissionDeniedTitle'),
        t('profilePersonData.cameraPermissionDeniedMessage'),
      );
      return;
    }
    const options = {
      mediaType: 'mixed',
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      includeExtra: true,
      presentationStyle: 'fullScreen',
    };
    launchCamera(options, response => {
      if (response?.didCancel) return;
      if (response?.errorCode) {
        Alert.alert(
          t('profilePersonData.cameraErrorTitle'),
          response.errorMessage || response.errorCode,
        );
        return;
      }
      handleStoryMediaSelected(response);
    });
  };

  const openStoryGallery = () => {
    const options = {
      mediaType: 'mixed',
      selectionLimit: 10,
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
    };
    launchImageLibrary(options, response => {
      if (response?.didCancel || response?.errorCode) return;
      const assets = response?.assets || [];
      if (!assets.length) return;
      const list = assets.map(a => ({
        uri: a.uri,
        type: a.type?.startsWith('video') ? 'video' : 'image',
        duration: a.duration ? a.duration * 1000 : undefined,
      }));
      setComposerList(list);
      setComposerVisible(true);
      handleStoryMediaSelected(response);
    });
  };

  const handleStoryMediaSelected = response => {
    const asset = response?.assets?.[0];
    if (!asset || !asset.uri) {
      Alert.alert(t('profilePersonData.oops'), t('profilePersonData.couldNotReadMedia'));
      return;
    }
    const type = asset.type?.startsWith('video') ? 'video' : 'image';
    const duration =
      type === 'video' ? (asset.duration ? asset.duration * 1000 : 15000) : 5000;
    if (response?.assets?.length === 1) {
      setComposerList([{ type, uri: asset.uri, duration }]);
    }
    setComposerVisible(true);
  };

  const handleComposerDone = async processedArray => {
    try {
      const clips = await prepareStoryClipsAudioForUpload(processedArray);
      setComposerVisible(false);

      const formData = new FormData();
      formData.append('caption', '');
      clips.forEach((item, index) => {
        const fileUri = item.processedUri || item.original.uri;
        const fileName = `story_${Date.now()}_${index}.${item.isVideo ? 'mp4' : 'jpg'}`;
        const fileType = item.isVideo ? 'video/mp4' : 'image/jpeg';
        formData.append('media', { uri: fileUri, type: fileType, name: fileName });
      });
      formData.append('storyMeta', JSON.stringify(buildStoryMetaPayload(clips)));
      await appendStoryAudioFiles(formData, clips);

      const response = await PostStory(formData);
      if (response?.success) {
        showToastMessage(toast, 'success', t('profilePersonData.dropsUploadedSuccess'));
        if (onStoryUploaded) onStoryUploaded();
      } else {
        showToastMessage(toast, 'danger', t('profilePersonData.dropsUploadFailed'));
      }
    } catch (error) {
      console.error('Error uploading Drops:', error);
      showToastMessage(toast, 'danger', t('profilePersonData.somethingWentWrong'));
    }
  };

  const showImageSourceOptions = () => {
    Alert.alert(
      t('profilePersonData.selectImageSourceTitle'),
      t('profilePersonData.selectImageSourceMessage'),
      [
        { text: t('profilePersonData.camera'), onPress: () => openCamera() },
        { text: t('profilePersonData.gallery'), onPress: () => openGallery() },
        { text: t('profilePersonData.cancel'), style: 'cancel' },
      ],
      { cancelable: true },
    );
  };

  const openCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert(
        t('profilePersonData.permissionDeniedTitle'),
        t('profilePersonData.cameraPermissionDeniedMessage'),
      );
      return;
    }
    try {
      const image = await pickProfileImageFromCamera();
      await uploadCroppedProfileImage(image);
    } catch (e) {
      if (e?.code === 'E_PICKER_CANCELLED') return;
      console.error('Camera error:', e);
      showToastMessage(toast, 'danger', e?.message || t('profilePersonData.failedOpenCamera'));
    }
  };

  const openGallery = async () => {
    try {
      const image = await pickProfileImageFromGallery();
      await uploadCroppedProfileImage(image);
    } catch (e) {
      if (e?.code === 'E_PICKER_CANCELLED') return;
      console.error('Gallery error:', e);
      showToastMessage(toast, 'danger', e?.message || t('profilePersonData.failedOpenGallery'));
    }
  };

  const uploadCroppedProfileImage = async image => {
    if (!image?.path) {
      showToastMessage(toast, 'danger', t('profilePersonData.noImageToUpload'));
      return;
    }
    const pickedUri = uriFromCropPath(image.path);
    if (!pickedUri) {
      showToastMessage(toast, 'danger', t('profilePersonData.invalidImagePath'));
      return;
    }
    setProfileImage(pickedUri);
    const fileName = image.filename || `profile_${Date.now()}.jpg`;
    const mimeType = image.mime || 'image/jpeg';
    const formData = new FormData();
    formData.append('image', { uri: pickedUri, type: mimeType, name: fileName });
    await handleSaveProfile(formData, pickedUri);
  };

  const handleSaveProfile = async (data, img) => {
    try {
      dispatch(showLoader());
      const res = await EditProfile(data);
      if (res.statusCode === 200) {
        dispatch(setProfileImg(img));
        showToastMessage(toast, 'success', res.data.message);
      }
    } catch (err) {
      // silent
    } finally {
      dispatch(hideLoader());
    }
  };

  const UserMessageNavigation = () => {
    navigation.navigate('UserChat', { userId: targetUserId, user: userData });
  };

  const openUserHighlights = useCallback(() => {
    if (!targetUserId) return;
    navigation.navigate('ProfileMain', {
      screen: 'HighlightsScreen',
      params: {
        userId: targetUserId,
        readOnly: true,
        profileType: userData?.profile,
        title: userData?.displayName || userData?.userName || t('profilePersonData.highlights'),
      },
    });
  }, [navigation, targetUserId, userData?.displayName, userData?.profile, userData?.userName, t]);

  const recipientWalletAddress = useMemo(
    () => getSupportRecipientWalletAddress(userData),
    [userData],
  );
  const canSupport = !!recipientWalletAddress;

  const handleSupportNow = useCallback(async () => {
    if (!canSupport) {
      Alert.alert(
        t('profilePersonData.walletNotConnectedTitle'),
        t('profilePersonData.walletNotConnectedMessage'),
      );
      return;
    }
    setSupportDisclaimerVisible(false);
    const receiverId = targetUserId ?? userData?.userId ?? userData?.UserId ?? userData?.id ?? '';
    await startSupportPayment(recipientWalletAddress, {
      senderId: userId != null ? String(userId) : '',
      receiverId: receiverId !== '' ? String(receiverId) : '',
      chain: 'POLYGON',
    });
  }, [canSupport, recipientWalletAddress, startSupportPayment, userId, targetUserId, userData, t]);

  const handleOpenSupportDisclaimer = useCallback(() => {
    const supporterProfile = isBusinessProfile ? 'company' : 'user';
    const recipientProfile = normalizeProfileType(
      effectiveProfileType || userProfile || userData?.profile,
    );
    if (!isSupportAllowed({ supporterProfile, recipientProfile })) {
      Alert.alert(
        t('profilePersonData.supportUnavailableTitle'),
        t('profilePersonData.supportUnavailableMessage'),
      );
      setSupportModalVisible(false);
      return;
    }
    setSupportModalVisible(false);
    setSupportDisclaimerVisible(true);
  }, [isBusinessProfile, effectiveProfileType, userProfile, userData?.profile, t]);

  const handleFollowButtonPress = useCallback(async () => {
    const shouldFollow = !isFollowing;
    const followHandler = executeFollowAction || onToggleFollow;
    const result = await followHandler?.();
    const success = typeof result === 'boolean' ? result : true;
    if (!success || !shouldFollow) return;
    const supporterProfile = isBusinessProfile ? 'company' : 'user';
    const recipientProfile = normalizeProfileType(
      effectiveProfileType || userProfile || userData?.profile,
    );
    if (isSupportAllowed({ supporterProfile, recipientProfile })) {
      setSupportModalVisible(true);
    }
  }, [
    isFollowing,
    executeFollowAction,
    onToggleFollow,
    isBusinessProfile,
    effectiveProfileType,
    userProfile,
    userData?.profile,
  ]);

  const openSupportIntroModal = useCallback(() => {
    const supporterProfile = isBusinessProfile ? 'company' : 'user';
    const recipientProfile = normalizeProfileType(
      effectiveProfileType || userProfile || userData?.profile,
    );
    if (!isSupportAllowed({ supporterProfile, recipientProfile })) {
      Alert.alert(
        t('profilePersonData.supportUnavailableTitle'),
        t('profilePersonData.supportUnavailableMessage'),
      );
      return;
    }
    setSupportModalVisible(true);
  }, [
    isBusinessProfile,
    effectiveProfileType,
    userProfile,
    userData?.profile,
    t,
  ]);

  const handleFollowButtonPressWithActions = useCallback(() => {
    if (followBusy || isFollowing == null) return;
    if (isFollowing) {
      setFollowActionsOpen(prev => !prev);
      return;
    }
    handleFollowButtonPress();
  }, [followBusy, isFollowing, handleFollowButtonPress]);

  const closeFollowActions = useCallback(() => {
    setFollowActionsOpen(false);
  }, []);

  const fetchReceivedSupportAmount = useCallback(async () => {
    try {
      setTotalSupportLoading(true);
      const response = await metaMaskRecived();
      const rawValue =
        response?.data?.totalAmount ??
        response?.data?.data?.totalAmount ??
        response?.data?.amount ??
        response?.data?.data?.amount ??
        response?.data?.totalSupportReceived ??
        response?.data?.data?.totalSupportReceived ??
        0;
      setTotalSupportAmount(Number(rawValue) || 0);
    } catch (error) {
      console.error('Error fetching total support amount:', error);
      setTotalSupportAmount(0);
    } finally {
      setTotalSupportLoading(false);
    }
  }, []);

  const handleToggleTotalSupport = useCallback(() => {
    if (!totalSupportOpen) {
      fetchReceivedSupportAmount();
      setTotalSupportOpen(true);
    } else {
      setTotalSupportOpen(false);
    }
  }, [totalSupportOpen, fetchReceivedSupportAmount]);

  useEffect(() => {
    Animated.timing(totalSupportAnim, {
      toValue: totalSupportOpen ? 1 : 0,
      duration: totalSupportOpen ? 220 : 150,
      easing: totalSupportOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [totalSupportAnim, totalSupportOpen]);

  useEffect(() => {
    Animated.timing(followActionsAnim, {
      toValue: followActionsOpen ? 1 : 0,
      duration: followActionsOpen ? 200 : 140,
      easing: followActionsOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [followActionsAnim, followActionsOpen]);

  useEffect(() => {
    if (compactLocked && totalSupportOpen) setTotalSupportOpen(false);
  }, [compactLocked, totalSupportOpen]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const fetchProfile = async () => {
        try {
          dispatch(showLoader());
          const id = await AsyncStorage.getItem('userId');
          const storedWalletAddress = await AsyncStorage.getItem('walletAddress');
          setUserId(id);
          setWalletAddress(storedWalletAddress || '');
          if (!id) return;

          const response = await getProfile(id);
          console.log(response,'data in this didieeeieiei')
          if (!isActive) return;

          if (response.statusCode === 200 && response.data) {
            if (!fromUsersProfile) {
              setData(response.data);
              if (response.data.image) setProfileImage(response.data.image);
            }
            setIsBusinessProfile(response?.data?.profile === 'company');

            if (!fromUsersProfile && response.data.kyc === true) {
              const hasShownWelcome = await AsyncStorage.getItem(KYC_WELCOME_SHOWN_KEY);
              const hasShownLegacy = await AsyncStorage.getItem(LEGACY_KYC_WELCOME_SHOWN_KEY);
              if (!hasShownWelcome) {
                if (hasShownLegacy) {
                  await AsyncStorage.setItem(KYC_WELCOME_SHOWN_KEY, 'true');
                  return;
                }
                setTimeout(() => {
                  setWelcomeModalVisible(true);
                  AsyncStorage.multiSet([
                    [KYC_WELCOME_SHOWN_KEY, 'true'],
                    [LEGACY_KYC_WELCOME_SHOWN_KEY, 'true'],
                  ]);
                }, 500);
              }
            }
          }
        } catch (err) {
          // handled
        } finally {
          if (isActive) dispatch(hideLoader());
        }
      };
      fetchProfile();
      return () => { isActive = false; };
    }, [dispatch, fromUsersProfile]),
  );

  const fetchLiveBattleStatus = useCallback(async () => {
    if (!viewedBattleUserId) { setHasLiveBattle(false); return; }
    try {
      const response = await battleByUserId({ params: { userId: viewedBattleUserId } });
      const payload =
        response?.data?.data ?? response?.data?.battles ?? response?.data ?? response ?? [];
      const rawBattles = Array.isArray(payload)
        ? payload
        : payload?.battles || payload?.data?.battles || payload?.data || response?.battles || [];
      const liveBattleFound = (Array.isArray(rawBattles) ? rawBattles : []).some(isBattleLive);
      setHasLiveBattle(liveBattleFound);
    } catch (_error) {
      setHasLiveBattle(false);
    }
  }, [viewedBattleUserId]);

  useFocusEffect(
    useCallback(() => { fetchLiveBattleStatus(); }, [fetchLiveBattleStatus]),
  );

  useEffect(() => {
    if (!hasLiveBattle) { battleStatusPulseAnim.setValue(1); return undefined; }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(battleStatusPulseAnim, { toValue: 0.35, duration: 500, useNativeDriver: true }),
        Animated.timing(battleStatusPulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [hasLiveBattle, battleStatusPulseAnim]);

  const handleNavigate = () => {
    if (data) {
      navigation.navigate('EditProfile', { userdata: data });
    } else {
      Alert.alert(t('profilePersonData.pleaseWait'), t('profilePersonData.profileStillLoading'));
    }
  };

  const handleOpenBattlePress = useCallback(() => {
    if (fromUsersProfile) {
      navigation.navigate('ProfileMain', {
        screen: 'OpenBattle',
        params: {
          returnTo: 'UserProfile',
          isCompanyProfile,
          profile: effectiveProfileType || userProfile || userData?.profile || 'user',
        },
      });
      return;
    }
    navigation.navigate('OpenBattle', {
      returnTo: 'Home',
      isCompanyProfile,
      profile: effectiveProfileType || userProfile || userData?.profile || 'user',
    });
  }, [
    effectiveProfileType,
    fromUsersProfile,
    isCompanyProfile,
    navigation,
    userData?.profile,
    userProfile,
  ]);

  const handleInviteBattlePress = useCallback(async () => {
    const storedMe = String((await AsyncStorage.getItem('userId')) || '').trim();
    const profileUserId = String(targetUserId || userData?.id || userData?._id || '').trim();
    const isOwnProfileInvite =
      !fromUsersProfile && profileUserId && storedMe && profileUserId === storedMe;

    if (isOwnProfileInvite) {
      navigation.navigate('OpenBattle', {
        presetFormat: 'HEAD_TO_HEAD',
        returnTo: 'Home',
        isCompanyProfile,
        profile: effectiveProfileType || userProfile || userData?.profile || 'user',
      });
      return;
    }

    const invitedUser = {
      id: profileUserId,
      name:
        userData?.displayName || userData?.name || userData?.fullName ||
        userData?.userName || displayName || t('profilePersonData.userFallback'),
      userName: userData?.userName || userData?.username || username || '',
      avatar: userData?.image || userData?.avatar || userData?.profilePicture || profileImage || '',
    };

    const params = {
      presetFormat: 'HEAD_TO_HEAD',
      invitedUserId: invitedUser.id,
      invitedUser,
      returnTo: fromUsersProfile ? 'UserProfile' : 'Home',
    };

    if (fromUsersProfile) {
      navigation.navigate('ProfileMain', {
        screen: 'OpenBattle',
        params: {
          ...params,
          isCompanyProfile,
          profile: effectiveProfileType || userProfile || userData?.profile || 'user',
        },
      });
      return;
    }

    navigation.navigate('OpenBattle', {
      ...params,
      isCompanyProfile,
      profile: effectiveProfileType || userProfile || userData?.profile || 'user',
    });
  }, [
    displayName,
    fromUsersProfile,
    isCompanyProfile,
    navigation,
    profileImage,
    targetUserId,
    userData?.avatar,
    userData?.displayName,
    userData?.fullName,
    userData?._id,
    userData?.id,
    userData?.image,
    userData?.name,
    userData?.profilePicture,
    userData?.userName,
    userData?.username,
    username,
    userData?.profile,
    userProfile,
    effectiveProfileType,
  ]);

  const handleBattleTabPress = useCallback(() => {
    navigation.navigate('ProfileBattleScreen', {
      profile: effectiveProfileType || userProfile || userData?.profile || 'user',
      viewedUserId: String(targetUserId || userData?.id || userId || ''),
      isOwner: !fromUsersProfile,
      title: fromUsersProfile
        ? `${displayName || t('profilePersonData.userFallback')} ${t('profilePersonData.battlesLabel')}`
        : t('profilePersonData.myBattles'),
      returnTo: fromUsersProfile ? 'UserProfile' : 'Home',
      isCompanyProfile,
    });
  }, [
    navigation, targetUserId, userData?.id, userData?.profile, userId,
    fromUsersProfile, displayName, effectiveProfileType, userProfile, t,
  ]);

  const redirect = () => {
    const source = data?.id ? data : userData?.id ? userData : null;
    if (!source) {
      Alert.alert(t('profilePersonData.pleaseWait'), t('profilePersonData.profileStillLoading'));
      return;
    }
    const normalizedSource = {
      ...source,
      id: source?.id || source?.userId || targetUserId,
      userId: source?.userId || source?.id || targetUserId,
      userName: source?.userName || username || displayName || '',
      displayName: source?.displayName || displayName || source?.userName || '',
      image: source?.image || profileImage || '',
    };
    const shareParams = { userData: normalizedSource, fromUsersProfile, targetUserId };
    navigation.navigate('ShareProfile', shareParams);
  };

  const detectPlatformFromUrl = useCallback((url = '') => {
    const normalized = String(url).toLowerCase();
    if (normalized.includes('twitter.com') || normalized.includes('x.com')) return 'twitter';
    if (normalized.includes('tiktok.com')) return 'tiktok';
    if (normalized.includes('linkedin.com')) return 'linkedin';
    if (normalized.includes('instagram.com')) return 'instagram';
    return '';
  }, []);

  const getSocialPlatform = useCallback(
    (platform = '', url = '') => {
      const normalizedPlatform = String(platform || '').trim().toLowerCase();
      if (normalizedPlatform) return normalizedPlatform;
      return detectPlatformFromUrl(url);
    },
    [detectPlatformFromUrl],
  );

  const socialMediaLinks = useMemo(() => {
    const source =
      data?.social_media_links ?? userData?.social_media_links ??
      data?.socialLinks ?? userData?.socialLinks ??
      data?.social_links ?? userData?.social_links;
    let list = [];
    try {
      if (Array.isArray(source)) list = source;
      else if (typeof source === 'string') list = JSON.parse(source);
    } catch (e) { list = []; }

    const knownPlatformKeys = ['twitter', 'tiktok', 'linkedin', 'instagram'];
    return list
      .map(item => {
        const objectItem = item && typeof item === 'object' ? item : {};
        const directUrl = String(objectItem?.url || objectItem?.link || objectItem?.value || '').trim();
        const keyedPlatformEntry = knownPlatformKeys.find(key => objectItem?.[key]);
        const platform = String(objectItem?.platform || keyedPlatformEntry || '').toLowerCase();
        const derivedUrl = directUrl || String(objectItem?.[platform] || '').trim();
        const normalizedPlatform = getSocialPlatform(platform, derivedUrl);
        return { platform: normalizedPlatform, url: derivedUrl };
      })
      .filter(item => item.url);
  }, [
    data?.social_media_links, userData?.social_media_links,
    data?.socialLinks, userData?.socialLinks,
    data?.social_links, userData?.social_links,
    getSocialPlatform,
  ]);

  const renderSocialIcon = useCallback(platform => {
    if (platform === 'tiktok') return <Tiktok width={25} height={25} />;
    if (platform === 'linkedin') return <Linkedin width={25} height={25} />;
    if (platform === 'twitter') return <Twitter width={25} height={25} />;
    if (platform === 'instagram') return <FontAwesome name="instagram" size={23} color="#E1306C" />;
    return <Feather name="link-2" size={22} color="#374151" />;
  }, []);

  const websiteLink = useMemo(() => String(
    userData?.website_link ?? data?.website_link ??
    userData?.websiteLink ?? data?.websiteLink ?? '',
  ).trim(), [userData?.website_link, data?.website_link, userData?.websiteLink, data?.websiteLink]);

  const handleOpenSocialUrl = async url => {
    const raw = String(url || '').trim();
    if (!raw) { Alert.alert(t('profilePersonData.error'), t('profilePersonData.linkEmpty')); return; }
    const normalizedUrl = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const supported = await Linking.canOpenURL(normalizedUrl);
      if (!supported) { Alert.alert(t('profilePersonData.error'), t('profilePersonData.invalidLink')); return; }
      await Linking.openURL(normalizedUrl);
    } catch (e) {
      Alert.alert(t('profilePersonData.error'), t('profilePersonData.unableToOpenLink'));
    }
  };

  const DragonflyIcon = getDragonflyIcon(Userdata.Followers, isCompanyProfile);
  const totalSupportCardHeight = totalSupportAnim.interpolate({
    inputRange: [0, 1], outputRange: [0, TOTAL_SUPPORT_CARD_HEIGHT],
  });
  const totalSupportCardOpacity = totalSupportAnim.interpolate({
    inputRange: [0, 0.35, 1], outputRange: [0, 0, 1],
  });
  const totalSupportCardTranslateY = totalSupportAnim.interpolate({
    inputRange: [0, 1], outputRange: [-8, 0],
  });
  const totalSupportCardScale = totalSupportAnim.interpolate({
    inputRange: [0, 1], outputRange: [0.96, 1],
  });

  const followActionsCardHeight = followActionsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 96],
  });
  const followActionsCardOpacity = followActionsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const followActionsCardTranslateY = followActionsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-4, 0],
  });
  const followActionsCardScale = followActionsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });
  const usernameModalData = useMemo(() => ({
    ...(userData || {}),
    ...(data || {}),
    id: data?.id || userData?.id || targetUserId || userId,
    userId: data?.userId || userData?.userId || targetUserId || userId,
    userName: data?.userName || userData?.userName || username || displayName,
    displayName: data?.displayName || userData?.displayName || displayName || username,
    walletAddress: data?.walletAddress || userData?.walletAddress || userData?.walletId || walletAddress || '',
  }), [data, userData, targetUserId, userId, username, displayName, walletAddress]);

  const handleBackPress = useCallback(() => {
    const profileBattleReturnRoutes = new Set([
      'BattleInProgress', 'BattleResults', 'BattleReward', 'ProfileBattleScreen', 'OpenBattle',
    ]);

    if (returnByTo && typeof returnByTo === 'object') {
      const tab = returnByTo?.tab;
      const screen = returnByTo?.screen;
      const params = returnByTo?.params;
      if (tab) {
        const parentNav = navigation.getParent?.();
        if (parentNav?.jumpTo) {
          parentNav.jumpTo(tab);
          if (screen) parentNav.navigate(tab, { screen, params });
        } else {
          navigation.navigate(tab, screen ? { screen, params } : undefined);
        }
        return;
      }
    }

    if (profileBattleReturnRoutes.has(returnByTo)) {
      navigation.navigate('ProfileMain', { screen: returnByTo });
      return;
    } else if (returnByTo == 'Search') {
      navigation.navigate(returnByTo);
      return;
    } else if (returnByTo === 'PostView') {
      // If the user opened this profile from a post inside ProfileMain,
      // go back there instead of dropping them on Home.
      const params = screenParams?.returnParams || screenParams?.postViewParams || undefined;
      navigation.navigate('ProfileMain', { screen: 'PostView', params });
      return;
    } else if (returnByTo === 'Add') {
      const parentNav = navigation.getParent?.();
      if (parentNav?.jumpTo) parentNav.jumpTo('Add');
      else navigation.navigate('Add');
      return;
    }
    navigation.goBack();
  }, [navigation, returnByTo, screenParams]);

  return (
    <View style={{ marginLeft: 5, marginRight: 5, marginTop: 5 }}>
      <View style={[styles.container, bgStyle]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.usernameRow}>
            <TouchableOpacity
              style={styles.usernameTouchable}
              activeOpacity={0.5}
              onPress={() => setUsernameModalVisible(true)}
            >
              {fromUsersProfile && (
                <TouchableOpacity onPress={handleBackPress}>
                  <Ionicons name="arrow-back-outline" size={22} color="#111100" style={{ marginRight: 4 }} />
                </TouchableOpacity>
              )}
              <View style={styles.userRow}>
                <Text
                  style={[styles.headerText, textStyle]}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {Userdata.Username}
                </Text>
                {showIdentityVerified && (
                  <DragonflyIcon width={30} height={30} style={styles.icon} />
                )}
                {!fromUsersProfile && (
                  <Ionicons name="chevron-down" size={18} color="#111100" style={styles.headerChevron} />
                )}
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.iconContainer}>
            {fromUsersProfile && (
              <TouchableOpacity style={styles.iconButton} onPress={openUserHighlights}>
                <Feather name="circle" size={25} color="#111100" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.iconButton} onPress={() => redirect()}>
              <Ionicons name="share-outline" size={25} color="#111100" />
            </TouchableOpacity>
            {!fromUsersProfile && (
              <TouchableOpacity style={styles.iconButton} onPress={() => setModalVisible(true)}>
                <FontAwesome name="plus-square-o" size={25} color="#111100" />
              </TouchableOpacity>
            )}
            {fromUsersProfile ? (
              <TouchableOpacity style={styles.iconButton} onPress={() => setUsernameModalVisible(true)}>
                <Ionicons name="ellipsis-horizontal-outline" size={25} color="#111100" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => { AsyncStorage.setItem('profile', userData?.profile); navigation.navigate('Settings'); }}
              >
                <Feather name="menu" size={25} color="#111100" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Profile Info */}
        <View style={styles.profile}>
          <View style={[styles.profileView, { position: 'relative' }]}>
            <View style={styles.profileTopRow}>
              <View style={styles.profileWraper}>
                <TouchableOpacity
                  onPress={handleProfileImagePress}
                  activeOpacity={0.8}
                  style={{ marginBottom: 5 }}
                >
                  <View style={styles.avatarWithBadge}>
                    <HexAvatar uri={avatarUri} size={110} borderWidth={2} borderColor={text} />
                    {showIdentityVerified && (
                      <View
                        style={styles.verifiedAvatarBadge}
                        accessibilityLabel={t('profilePersonData.verifiedAccount')}
                        pointerEvents="none"
                      >
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                  {!fromUsersProfile && (
                    <TouchableOpacity
                      style={[styles.addbutton, { backgroundColor: text, shadowColor: text }]}
                      onPress={handleProfileImagePress}
                    >
                      <Ionicons name="add" size={15} color="white" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.edit}>
                {fromUsersProfile ? (
                  <>
                    <View style={styles.followButtonWrap}>
                      <TouchableOpacity
                        onPress={handleFollowButtonPressWithActions}
                        disabled={followBusy || isFollowing === null}
                      >
                        <LinearGradient
                          colors={profileActionGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[styles.editbuttons, { shadowColor: text }]}
                        >
                          <Text style={styles.buttonText}>
                            {isFollowing
                              ? t('profilePersonData.following')
                              : t('profilePersonData.follow')}
                            {followBusy ? '...' : ''}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>

                      <Animated.View
                        pointerEvents={followActionsOpen ? 'auto' : 'none'}
                        style={[
                          styles.followActionsPopover,
                          {
                            height: followActionsCardHeight,
                            opacity: followActionsCardOpacity,
                            transform: [
                              { translateY: followActionsCardTranslateY },
                              { scale: followActionsCardScale },
                            ],
                          },
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.followActionsItem}
                          onPress={() => {
                            closeFollowActions();
                            openSupportIntroModal();
                          }}
                        >
                          <Text style={[styles.followActionsItemText, { color: text }]}>
                            {t('supportCreator.supportNowButton')}
                          </Text>
                        </TouchableOpacity>

                        <View style={styles.followActionsDivider} />

                        <TouchableOpacity
                          style={styles.followActionsItem}
                          onPress={() => {
                            closeFollowActions();
                            void handleFollowButtonPress();
                          }}
                        >
                          <Text style={[styles.followActionsItemText, { color: text }]}>
                            {t('profilePersonData.unfollow')}
                          </Text>
                        </TouchableOpacity>
                      </Animated.View>
                    </View>

                    <TouchableOpacity onPress={() => UserMessageNavigation()}>
                      <LinearGradient
                        colors={profileActionGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.editbuttons, { shadowColor: text }]}
                      >
                        <Text style={styles.buttonText}>{t('profilePersonData.message')}</Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    {normalizedProfileThemeType !== 'company' && (
                      <TouchableOpacity onPress={handleToggleTotalSupport}>
                        <LinearGradient
                          colors={profileActionGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[styles.editbuttons, { shadowColor: text }]}
                        >
                          <View style={styles.buttonContent}>
                            <Ionicons name="trending-up-outline" size={28} color="#f2f8f2" />
                            <Text style={styles.buttonText}>{t('profilePersonData.totalSupport')}</Text>
                          </View>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <>
                    <TouchableOpacity onPress={() => handleNavigate()}>
                      <LinearGradient
                        colors={profileActionGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.editbuttons, { shadowColor: text }]}
                      >
                        <Text style={styles.buttonText}>{t('profilePersonData.editProfile')}</Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate('Invite', {
                          referralCode: userData?.referCode || 'Valense123',
                          avatar: Userdata.profilePic,
                        })
                      }
                    >
                      <LinearGradient
                        colors={profileActionGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.editbuttons, { shadowColor: text }]}
                      >
                        <Ionicons name="person-add-sharp" size={15} color="white" />
                        <Text style={styles.buttonText}> {t('profilePersonData.invite')}</Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    {!isBusinessProfile && (
                      <TouchableOpacity onPress={handleToggleTotalSupport}>
                        <LinearGradient
                          colors={profileActionGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[styles.editbuttons, { shadowColor: text }]}
                        >
                          <View style={styles.buttonContent}>
                            <Ionicons name="trending-up-outline" size={28} color="#f2f8f2" />
                            <Text style={styles.buttonText}>{t('profilePersonData.totalSupport')}</Text>
                          </View>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            </View>

            <Animated.View
              pointerEvents={totalSupportOpen ? 'auto' : 'none'}
              style={[
                styles.totalSupportPopover,
                {
                  height: totalSupportCardHeight,
                  opacity: totalSupportCardOpacity,
                  transform: [
                    { translateY: totalSupportCardTranslateY },
                    { scale: totalSupportCardScale },
                  ],
                },
              ]}
            >
              {totalSupportLoading ? (
                <ActivityIndicator size="small" color="#513189" />
              ) : (
                <>
                  <Text style={styles.totalSupportPopoverLabel}>
                    {t('profilePersonData.totalSupportReceived')}
                  </Text>
                  <Text style={styles.totalSupportPopoverAmount}>
                    $ {totalSupportAmount.toFixed(2)}
                  </Text>
                </>
              )}
            </Animated.View>

            <Text style={styles.displaynamee} numberOfLines={2}>
              {Userdata.Displayname}
            </Text>
          </View>

          <Animated.View
            style={[styles.collapsibleProfileMiddle, { maxHeight: animatedMaxHeight, opacity: animatedOpacity }]}
          >
            <View style={styles.biobox}>
              <Text style={styles.biotext}>{Userdata.Bio}</Text>
              <View style={styles.socialRow}>
                {socialMediaLinks.map(item => (
                  <TouchableOpacity
                    key={`${item.platform}-${item.url}`}
                    style={styles.socialIconButton}
                    activeOpacity={0.7}
                    onPress={() => handleOpenSocialUrl(item.url)}
                  >
                    {renderSocialIcon(item.platform)}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {!!websiteLink && (
              <TouchableOpacity
                style={styles.bioLinkWrap}
                activeOpacity={0.7}
                onPress={() => handleOpenSocialUrl(websiteLink)}
              >
                <Text style={styles.bioLinkText}>{websiteLink}</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>

        <Animated.View
          style={[styles.collapsibleProfileMiddle, { maxHeight: animatedMaxHeight, opacity: animatedOpacity }]}
        >
          {/* Battle LIVE — shown above Open Battle when a battle is active */}
          <View style={[styles.tabContainer, { marginBottom: -8, height: 50 }]}>
            <TouchableOpacity
              style={[styles.tab, { backgroundColor: text, borderColor: text }]}
              onPress={handleBattleTabPress}
            >
              <View style={styles.tabContentRow}>
                <Text style={[styles.tabText, styles.activeTabText, { color: '#fff' }]}>
                  {t('profilePersonData.battle')}
                </Text>
                {hasLiveBattle && (
                  <View style={styles.liveBadge}>
                    <Animated.View
                      style={[styles.liveBadgeDot, { opacity: battleStatusPulseAnim }]}
                    />
                    <Text style={styles.liveBadgeText}>{t('profilePersonData.live')}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* Open Battle / Invite to Battle */}
          <View style={[styles.tabContainer, { height: 50 }]}>
            {fromUsersProfile ? (
              <TouchableOpacity
                style={[styles.battleBtnWrapper, { backgroundColor: text, borderColor: text }]}
                onPress={handleInviteBattlePress}
              >
                <LinearGradient
                  colors={profileActionGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.battleBtn}
                >
                  <Text style={styles.battleBtnText}>{t('profilePersonData.inviteToBattle')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.battleBtnWrapper, { backgroundColor: text, borderColor: text }]}
                onPress={handleOpenBattlePress}
              >
                <LinearGradient
                  colors={profileActionGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.battleBtn}
                >
                  <Text style={styles.battleBtnText}>{t('profilePersonData.openBattle')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statItem}>
              <Ionicons name="add-circle-outline" size={16} color="#444" />
              <Text style={[styles.statText, { color: text }]}>
                {' '}{t('profilePersonData.mint')}: {Userdata.totalPost}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statItem}
              activeOpacity={0.5}
              onPress={() => {
                if (fromUsersProfile) {
                  navigation.navigate('ProfileMain', {
                    screen: 'FollowersFollowingScreen',
                    tab: 'followers',
                    params: {
                      userName: Userdata.Username,
                      userId: fromUsersProfile ? targetUserId : userId,
                      returnTo: 'Home',
                      screenParams,
                    },
                  });
                } else {
                  navigation.navigate('FollowersFollowingScreen', {
                    tab: 'followers',
                    params: { userName: Userdata.Username, userId, returnTo: 'UserProfile' },
                  });
                }
              }}
            >
              <FontAwesome name="user" size={16} color="#444" />
              <Text style={[styles.statText, { color: text }]}>
                {' '}{t('profilePersonData.followers')}: {Userdata.Followers}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statItem}
              onPress={() => {
                if (fromUsersProfile) {
                  navigation.navigate('ProfileMain', {
                    screen: 'FollowersFollowingScreen',
                    tab: 'following',
                    params: {
                      userName: displayName,
                      userId: fromUsersProfile ? targetUserId : userId,
                      returnTo: 'Home',
                      screenParams,
                    },
                  });
                } else {
                  navigation.navigate('FollowersFollowingScreen', {
                    tab: 'following',
                    params: { userName: displayName, userId, returnTo: 'UserProfile' },
                  });
                }
              }}
            >
              <Ionicons name="swap-horizontal-outline" size={16} color="#444" />
              <Text style={[styles.statText, { color: text }]}>
                {' '}{t('profilePersonData.following')}: {Userdata.Followings}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>

      {/* Modals */}
      <ProfileModal modalVisible={modalVisible} setModalVisible={setModalVisible} />
      <UsernameModal
        visible={usernameModalVisible}
        onClose={() => setUsernameModalVisible(false)}
        data={usernameModalData}
      />
      <StoryComposer
        modalVisible={composerVisible}
        mediaList={composerList}
        onCancel={() => setComposerVisible(false)}
        onDone={handleComposerDone}
      />
      <SupportCreatorModal
        visible={supportModalVisible}
        creatorName={username || userData?.userName || t('profilePersonData.creatorFallback')}
        onClose={() => setSupportModalVisible(false)}
        onSupport={handleOpenSupportDisclaimer}
      />
      <SupportCreatorModal
        visible={supportDisclaimerVisible}
        creatorName={username || userData?.userName || t('profilePersonData.creatorFallback')}
        variant="disclaimer"
        onClose={() => setSupportDisclaimerVisible(false)}
        onSupport={handleSupportNow}
      />

      {/* Profile Image Viewer */}
      <Modal
        visible={imageViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageViewerVisible(false)}
      >
        <Pressable
          style={styles.profileImagePreviewOverlay}
          onPress={() => setImageViewerVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setImageViewerVisible(false)}
            style={styles.profileImagePreviewCloseBtn}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          <Pressable
            style={styles.profileImagePreviewZoomHost}
            onPress={e => e?.stopPropagation?.()}
          >
            <ImageZoom
              cropWidth={SCREEN_WIDTH}
              cropHeight={SCREEN_HEIGHT}
              imageWidth={PROFILE_IMAGE_PREVIEW_SIZE}
              imageHeight={PROFILE_IMAGE_PREVIEW_SIZE}
              enableCenterFocus
            >
              <View style={styles.profileImagePreviewHexWrap}>
                <View style={styles.avatarWithBadge}>
                  <HexAvatar
                    uri={avatarUri}
                    size={PROFILE_IMAGE_PREVIEW_SIZE}
                    borderWidth={2}
                    borderColor={text}
                  />
                </View>
              </View>
            </ImageZoom>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

export default ProfilePersonData;

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 16,
  },

  // --- Header ---
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  usernameRow: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  usernameTouchable: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userRow: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '700',
    marginRight: 5,
  },
  headerChevron: {
    marginLeft: 4,
    flexShrink: 0,
  },
  icon: {
    marginTop: 1,
    flexShrink: 0,
  },
  iconContainer: {
    flexDirection: 'row',
    flexShrink: 0,
    alignItems: 'center',
  },
  iconButton: {
    padding: 6,
    marginHorizontal: 2,
  },

  // --- Profile ---
  profile: {
    marginTop: 2,
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  profileView: {
    flexDirection: 'column',   // ← changed from 'row' to 'column'
    width: '100%',
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  profileWraper: {
    alignItems: 'flex-start',  // ← avatar stays left
    flexShrink: 1,
  },
  avatarWithBadge: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  verifiedAvatarBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 22,
    height: 22,
    borderRadius: 14,
    backgroundColor: '#1D9BF0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    zIndex: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2,
  },
  verifiedAvatarBadgeLarge: {
    top: 10,
    left: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
  },
  displaynamee: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '700',
    marginTop: 6,
    // textAlign: 'center',       // ← name centered across full width
    width: '100%',
  },
  image: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    backgroundColor: '#fff',
  },
  addbutton: {
    position: 'absolute',
    bottom: 0,
    right: 10,
    borderRadius: 20,
    width: 26,
    height: 26,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },

  // --- Buttons ---
  edit: {
    flexDirection: 'column',
    width: '50%',
    gap: 6,
  },
  editbuttons: {
    height: 36,
    width: '100%',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  followButtonWrap: {
    position: 'relative',
    width: '100%',
  },
  followActionsPopover: {
    position: 'absolute',
    top: 42,
    left: 0,
    right: 0,
    zIndex: 999,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#513189',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 10,
    elevation: 10,
  },
  followActionsItem: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  followActionsItemText: {
    fontSize: 14,
    fontWeight: '700',
  },
  followActionsDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    width: '100%',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
  },
  totalSupportPopover: {
    position: 'absolute',
    top: 120,
    right: 0,
    width: '50%',
    zIndex: 999,
    overflow: 'hidden',
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#513189',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  totalSupportPopoverLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  totalSupportPopoverAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: '#513189',
  },

  // --- Bio ---
  biobox: {
    width: '100%',
    paddingVertical: 6,
    marginTop: 2,
  },
  biotext: {
    fontStyle: 'italic',
    color: '#374151',
    fontSize: 14,
  },
  bioLinkWrap: {
    marginTop: 2,
    marginBottom: 2,
  },
  bioLinkText: {
    color: '#1D9BF0',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
    alignSelf: 'flex-end',
    marginTop: 2,
    marginBottom: 2,
  },
  socialIconButton: {
    marginLeft: 10,
  },
  collapsibleProfileMiddle: {
    overflow: 'hidden',
  },
  // collapsibleProfileMiddleExpanded: {
  //   maxHeight: 260,
  //   opacity: 1,
  //   transform: [{ translateY: 0 }],
  // },
  // collapsibleProfileMiddleCollapsed: {
  //   maxHeight: 0,
  //   opacity: 0,
  //   transform: [{ translateY: -12 }],
  // },

  // --- Stats ---
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 1,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  statText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  infoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F1FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  battleActionWrapper: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    alignSelf: 'stretch',
    marginHorizontal: 6,
    marginTop: 2,
  },

  battleBtnWrapper: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 12,
    // borderWidth: 1,
  },

  battleBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        paddingVertical: 0,
      },
      android: {
        paddingVertical: 6,
      },
    }),
  },

  battleBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    ...Platform.select({
      ios: {
        lineHeight: 18,
      },
      android: {
        lineHeight: 18,
      },
    }),
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
    marginTop: 2,
    padding: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  liveBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    marginRight: 5,
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '600',
  },
  totalSupportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  totalSupportModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
  },
  totalSupportModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  totalSupportModalLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  totalSupportModalAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#513189',
    marginBottom: 20,
  },
  totalSupportModalButton: {
    backgroundColor: '#513189',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  totalSupportModalButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  profileImagePreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  profileImagePreviewCloseBtn: {
    position: 'absolute',
    top: 44,
    right: 18,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    zIndex: 10,
  },
  profileImagePreviewZoomHost: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImagePreviewHexWrap: {
    width: PROFILE_IMAGE_PREVIEW_SIZE,
    height: PROFILE_IMAGE_PREVIEW_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
