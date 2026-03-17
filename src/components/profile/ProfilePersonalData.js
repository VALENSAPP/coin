import { Image, StyleSheet, Text, TouchableOpacity, View, Alert, Platform, PermissionsAndroid, Linking } from 'react-native';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import ProfileModal from '../modals/ProfileModal';
import UsernameModal from '../modals/UsernameModal';
import TradeModal from '../modals/TradeModal';
import SupportCreatorModal from '../modals/SupportCreatorModal';
import WelcomeValensModal from '../modals/WelcomeValensModal';
import WalletSelectionModal from '../modals/WalletSelectionModal';
import WalletConnectedModal from '../modals/WalletConnectedModal';
import { showLoader, hideLoader } from '../../redux/actions/LoaderAction';
import { useDispatch } from 'react-redux';
import { EditProfile, getProfile } from '../../services/createProfile';
import { PostStory } from '../../services/stories'; // Import PostStory API
import { WhiteDragonfly, Thread, BlueDragonfly, SoftGrayDragonfly, LilacDragonfly, GoldDragonfly, GoldLavenderDragonfly, Twitter, Tiktok, Linkedin } from '../../assets/icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setProfileImg } from '../../redux/actions/ProfileImgAction';
import { showToastMessage } from '../displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import StoryComposer from '../home/story.js/StoryComposer';
import { getUserCredentials } from '../../services/post';
import { useAppTheme } from '../../theme/useApptheme';
import { getSupportRecipientWalletAddress, openWalletPayment } from '../../utils/metaMaskSupport';
import { connectWalletLogin } from '../../pages/authentication/socialLogin';
import { updateWallet } from '../../services/wallet';

const KYC_WELCOME_SHOWN_KEY = 'kycWelcomeShownEver';
const LEGACY_KYC_WELCOME_SHOWN_KEY = 'kycWelcomeShown';

export function getDragonflyIcon(followers, isBusiness = false) {
  if (isBusiness) return GoldLavenderDragonfly;

  if (followers <= 50) return WhiteDragonfly;
  if (followers <= 10000) return SoftGrayDragonfly;
  if (followers <= 500000) return LilacDragonfly;
  if (followers <= 1000000) return GoldDragonfly;
  if (followers >= 10000000) return GoldLavenderDragonfly;

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
  onStoryUploaded, // Callback to refresh stories after upload
  userData,
  executeFollowAction,
  returnByTo
}) => {
  console.log(userData, 'userdTAA');



  // useEffect(() => {
  //   console.log(
  //     { userData },
  //     'ProfilePersonData props'
  //   );
  // }, [displayName, username, profilepic, bio, dashboard, fromUsersProfile, isFollowing, followBusy, targetUserId]);

  const navigation = useNavigation();
  const [profileImage, setProfileImage] = useState(null);

  useEffect(() => {
    setProfileImage(profilepic || null);
    fetchAllData();
  }, [profilepic]);

  const PLACEHOLDER_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
  const avatarUri = typeof profileImage === 'string' && profileImage.length ? profileImage : PLACEHOLDER_AVATAR;

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
  const [welcomeModalVisible, setWelcomeModalVisible] = useState(false);
  const [walletSelectionVisible, setWalletSelectionVisible] = useState(false);
  const [walletConnectedModalVisible, setWalletConnectedModalVisible] = useState(false);
  const [connectedWalletInfo, setConnectedWalletInfo] = useState({ name: '', address: '' });
  const [pendingSupportPromptAfterWalletConnect, setPendingSupportPromptAfterWalletConnect] = useState(false);
  const dispatch = useDispatch();
  const toast = useToast();
  const effectiveProfileType = profileType || userData?.profile;
  const normalizedProfileThemeType =
    typeof effectiveProfileType === 'string' ? effectiveProfileType.toLowerCase() : '';
  const isCompanyProfile = normalizedProfileThemeType === 'company';
  const profileActionGradient = isCompanyProfile
    ? ['#D3B683', '#D3B683']
    : ['#513189bd', '#e54ba0'];
  const { bgStyle, textStyle, text } = useAppTheme(effectiveProfileType);
  const route = useRoute();
  const isKycApproved =
    userData?.kyc === true
  // &&
  // userData?.kycStatus === "APPROVED";
  const isSubscriptionActive = userData?.subscriptionStatus == "ACTIVE";

  const Userdata = {
    Displayname: displayName || 'No Name',
    Username: username || 'Unknown User',
    profilePic: profileImage,
    Bio: bio,
    totalPost: dashboard?.totalPosts ?? 'NA',
    Followers: dashboard?.totalFollowers ?? 'NA',
    Followings: dashboard?.totalFollowing ?? 'NA',
    userId: userId,
  };

  const fetchAllData = async () => {
    try {
      dispatch(showLoader());

      // Run both API calls in parallel
      const [profileResponse] = await Promise.all([
        getUserCredentials(userData?.id)
      ]);

      // Handle profile response
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
        // console.log('User profile:', userDataToSet.profile);
      } else {
        // showToastMessage(toast, 'danger', profileResponse.data.message);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      dispatch(hideLoader());
    }
  };

  const requestCameraPermission = async () => {
    if (Platform.OS !== 'android') return true;
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
  };

  const handleProfileImagePress = () => {
    Alert.alert(
      'Upload Image',
      'What would you like to upload?',
      [
        {
          text: 'Add Drops',
          onPress: () => handleStoryUpload(),
        },
        {
          text: 'Profile Image',
          onPress: () => showImageSourceOptions(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const handleStoryUpload = () => {
    Alert.alert(
      'Add Drops',
      'Choose how to add your Drops',
      [
        { text: 'Camera', onPress: () => openStoryCamera() },
        { text: 'Gallery', onPress: () => openStoryGallery() },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const openStoryCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission Denied',
        'Camera permission is required to take photos.',
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
          'Camera error',
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
      Alert.alert('Oops', 'Could not read the selected media.');
      return;
    }
    const type = asset.type?.startsWith('video') ? 'video' : 'image';
    const duration =
      type === 'video'
        ? asset.duration
          ? asset.duration * 1000
          : 15000
        : 5000;

    // If single item, set it directly
    if (response?.assets?.length === 1) {
      setComposerList([{ type, uri: asset.uri, duration }]);
    }
    setComposerVisible(true);
  };

  const handleComposerDone = async (processedArray) => {
    try {
      setComposerVisible(false);

      // Prepare FormData for API call
      const formData = new FormData();

      // Add caption (optional)
      formData.append('caption', '');

      // Add media files
      processedArray.forEach((item, index) => {
        const fileUri = item.processedUri || item.original.uri;
        const fileName = `story_${Date.now()}_${index}.${item.isVideo ? 'mp4' : 'jpg'}`;
        const fileType = item.isVideo ? 'video/mp4' : 'image/jpeg';

        formData.append('media', {
          uri: fileUri,
          type: fileType,
          name: fileName,
        });
      });

      // Call API to upload story
      const response = await PostStory(formData);

      if (response?.success) {
        showToastMessage(toast, 'success', 'Drops Uploaded Successfully');

        // Call the callback to refresh stories if provided
        if (onStoryUploaded) {
          onStoryUploaded();
        }
      } else {
        showToastMessage(toast, 'danger', 'Failed to upload Drops please try again');
      }
    } catch (error) {
      console.error('Error uploading Drops:', error);
      showToastMessage(toast, 'danger', 'Something Went Wrong ! please try again');
    }
  };

  const showImageSourceOptions = () => {
    Alert.alert(
      'Select Image Source',
      'Choose where to pick your profile image from',
      [
        {
          text: 'Camera',
          onPress: () => openCamera(),
        },
        {
          text: 'Gallery',
          onPress: () => openGallery(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const openCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission Denied',
        'Camera permission is required to take photos.',
      );
      return;
    }
    try {
      launchCamera(
        {
          mediaType: 'photo',
          quality: 0.8,
          cameraType: 'back',
        },
        async response => {
          await processImageResponse(response);
        }
      );
    } catch (err) {
      console.error("Camera error:", err);
      showToastMessage(toast, 'danger', 'Failed to open camera');
    }
  };

  const openGallery = () => {
    try {
      launchImageLibrary(
        {
          mediaType: 'photo',
          quality: 0.8,
          selectionLimit: 1,
        },
        async response => {
          await processImageResponse(response);
        }
      );
    } catch (err) {
      console.error("Gallery error:", err);
      showToastMessage(toast, 'danger', 'Failed to open gallery');
    }
  };

  const processImageResponse = async (response) => {
    if (response?.didCancel) return;

    if (response?.errorCode) {
      console.warn("Image Picker Error:", response.errorMessage);
      showToastMessage(toast, 'danger', 'Failed to pick image');
      return;
    }

    const asset = response?.assets?.[0];
    if (!asset?.uri) {
      console.warn("No valid image URI found");
      showToastMessage(toast, 'danger', 'No image selected');
      return;
    }

    const pickedUri = asset.uri;
    setProfileImage(pickedUri);

    // Always provide fallbacks
    const fileName = asset.fileName || `profile_${Date.now()}.jpg`;
    const mimeType = asset.type || "image/jpeg";

    // Special case: Android content:// URIs
    const imageUri = pickedUri.startsWith("content://")
      ? pickedUri
      : pickedUri;

    const formData = new FormData();
    formData.append("image", {
      uri: imageUri,
      type: mimeType,
      name: fileName,
    });

    await handleSaveProfile(formData, pickedUri);
  };

  const handleSaveProfile = async (data, img) => {
    try {
      dispatch(showLoader());
      console.log(data, 'data to be sent handleSaveProfile');

      const res = await EditProfile(data);
      console.log(res, 'edit profile response');

      if (res.statusCode === 200) {
        dispatch(setProfileImg(img));
        showToastMessage(toast, 'success', res.data.message);
      } else {
        // showToastMessage(toast, 'danger', res.data.message);
      }
    } catch (err) {
      // showToastMessage(toast, 'danger', err.response?.data?.message || 'Error saving profile');
    } finally {
      dispatch(hideLoader());
    }
  };

  const UserMessageNavigation = () => {
    navigation.navigate('UserChat', {
      userId: targetUserId,
      user: userData
    });
  }

  const recipientWalletAddress = useMemo(
    () => getSupportRecipientWalletAddress(userData),
    [userData],
  );
  const canSupport = !!recipientWalletAddress;

  const ensureSupportFlowReady = useCallback(async ({ openSupportModalOnSuccess = false } = {}) => {
    const currentWalletAddress = walletAddress || await AsyncStorage.getItem('walletAddress');

    if (!currentWalletAddress) {
      if (openSupportModalOnSuccess) {
        setPendingSupportPromptAfterWalletConnect(true);
      }
      setWalletSelectionVisible(true);
      return false;
    }

    if (currentWalletAddress !== walletAddress) {
      setWalletAddress(currentWalletAddress);
    }

    if (!canSupport) {
      Alert.alert('Wallet not connected', 'This user has not connected a wallet yet. Follow is still active.');
      setPendingSupportPromptAfterWalletConnect(false);
      return false;
    }

    return true;
  }, [walletAddress, canSupport]);

  const handleWalletSelect = useCallback(async (wallet) => {
    setWalletSelectionVisible(false);

    try {
      const connectedAddress = await connectWalletLogin(toast, navigation, dispatch, {
        returnAddressOnly: true,
        walletType: wallet.id,
      });

      if (connectedAddress) {
        await AsyncStorage.setItem('walletAddress', connectedAddress);
        await AsyncStorage.setItem('walletType', wallet.id);
        setWalletAddress(connectedAddress);
        try {
          await updateWallet({ walletAddress: connectedAddress });
        } catch (walletUpdateError) {
          console.error('Wallet update API error:', walletUpdateError);
        }

        if (pendingSupportPromptAfterWalletConnect) {
          setPendingSupportPromptAfterWalletConnect(false);
          if (!canSupport) {
            Alert.alert('Wallet not connected', 'This user has not connected a wallet yet. Follow is still active.');
            return;
          }
          setSupportModalVisible(true);
          return;
        }

        setConnectedWalletInfo({
          name: wallet.name,
          address: connectedAddress,
        });
        setWalletConnectedModalVisible(true);
      }
    } catch (error) {
      console.error('Wallet connection error:', error);
      showToastMessage(toast, 'danger', 'Failed to connect wallet. Please try again.');
    }
  }, [toast, navigation, dispatch, pendingSupportPromptAfterWalletConnect, canSupport]);

  const handleWalletConnectedContinue = useCallback(async () => {
    setWalletConnectedModalVisible(false);
    const connectedWalletChainId = await AsyncStorage.getItem('walletChainId');
    const walletType = await AsyncStorage.getItem('walletType') || 'metamask';

    // Open payment flow with the connected wallet
    await openWalletPayment(recipientWalletAddress, connectedWalletChainId, walletType);
  }, [recipientWalletAddress]);

  const handleSupportNow = useCallback(async () => {
    if (!canSupport) {
      Alert.alert('Wallet not connected', 'This user has not connected a wallet yet. Follow is still active.');
      return;
    }
    setSupportDisclaimerVisible(false);
    const ready = await ensureSupportFlowReady();
    if (!ready) return;
    const connectedWalletChainId = await AsyncStorage.getItem('walletChainId');
    const walletType = await AsyncStorage.getItem('walletType') || 'metamask';
    await openWalletPayment(recipientWalletAddress, connectedWalletChainId, walletType);
  }, [canSupport, recipientWalletAddress, ensureSupportFlowReady]);

  const handleOpenSupportDisclaimer = useCallback(() => {
    setSupportModalVisible(false);
    setSupportDisclaimerVisible(true);
  }, []);

  const handleFollowButtonPress = useCallback(async () => {
    const shouldFollow = !isFollowing;
    const followHandler = executeFollowAction || onToggleFollow;
    const result = await followHandler?.();
    const success = typeof result === 'boolean' ? result : true;
    if (!success || !shouldFollow) return;

    // Match PostItem flow: always show intro support modal after a successful follow.
    // Wallet connection (if needed) is prompted only when the user chooses to support.
    setSupportModalVisible(true);
  }, [isFollowing, executeFollowAction, onToggleFollow]);

  useFocusEffect(
    useCallback(() => {
      // if (fromUsersProfile) return;
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
          if (!isActive) return;

          if (response.statusCode === 200 && response.data) {
            console.log('response in fetchProfile useFocusEffect:', response);
            if (!fromUsersProfile) {
              setData(response.data);
              if (response.data.image) {
                setProfileImage(response.data.image);
              }
            }
            setIsBusinessProfile(response?.data?.profile === 'company');

            // Check KYC approval status and show welcome modal
            if (!fromUsersProfile && response.data.kyc === true) {
              const hasShownWelcome = await AsyncStorage.getItem(KYC_WELCOME_SHOWN_KEY);
              const hasShownLegacy = await AsyncStorage.getItem(LEGACY_KYC_WELCOME_SHOWN_KEY);
              if (!hasShownWelcome) {
                if (hasShownLegacy) {
                  await AsyncStorage.setItem(KYC_WELCOME_SHOWN_KEY, 'true');
                  return;
                }
                // Show welcome modal after a short delay to ensure UI is ready
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
          if (isActive) {
            // Handle error
          }
        } finally {
          if (isActive) {
            dispatch(hideLoader());
          }
        }
      };

      fetchProfile();

      return () => {
        isActive = false;
      };
    }, [dispatch, fromUsersProfile]),
  );

  const handleNavigate = () => {
    if (data) {
      navigation.navigate('EditProfile', { userdata: data });
    } else {
      Alert.alert('Please wait', 'Profile data is still loading');
    }
  };

  const redirect = () => {
    const source = data?.id ? data : userData?.id ? userData : null;

    if (!source) {
      Alert.alert('Please wait', 'Profile data is still loading');
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

    const shareParams = {
      userData: normalizedSource,
      fromUsersProfile,
      targetUserId,
    };

    if (fromUsersProfile) {
      navigation.navigate('ProfileMain', {
        screen: 'ShareProfile',
        params: shareParams,
      });
      return;
    }

    navigation.navigate('ShareProfile', shareParams);
  };

  // const handleSupportPress = () => {
  //   const email = 'info@valens.app';
  //   const subject = 'App Support Request';
  //   const body = 'Hi team,\n\nI need help with...';

  //   const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  //   Linking.openURL(url).catch(() => {
  //     Alert.alert('Error', 'No mail app found');
  //   });
  // };
  const detectPlatformFromUrl = useCallback((url = '') => {
    const normalized = String(url).toLowerCase();
    if (normalized.includes('twitter.com') || normalized.includes('x.com')) return 'twitter';
    if (normalized.includes('tiktok.com')) return 'tiktok';
    if (normalized.includes('linkedin.com')) return 'linkedin';
    if (normalized.includes('instagram.com')) return 'instagram';
    return '';
  }, []);

  const getSocialPlatform = useCallback((platform = '', url = '') => {
    const normalizedPlatform = String(platform || '').trim().toLowerCase();
    if (normalizedPlatform) return normalizedPlatform;
    return detectPlatformFromUrl(url);
  }, [detectPlatformFromUrl]);

  const socialMediaLinks = useMemo(() => {
    const source =
      data?.social_media_links ??
      userData?.social_media_links ??
      data?.socialLinks ??
      userData?.socialLinks ??
      data?.social_links ??
      userData?.social_links;
    let list = [];
    try {
      if (Array.isArray(source)) {
        list = source;
      } else if (typeof source === 'string') {
        list = JSON.parse(source);
      }
    } catch (e) {
      list = [];
    }

    const knownPlatformKeys = ['twitter', 'tiktok', 'linkedin', 'instagram'];

    return list
      .map(item => {
        const objectItem = item && typeof item === 'object' ? item : {};
        const directUrl = String(
          objectItem?.url ||
          objectItem?.link ||
          objectItem?.value ||
          '',
        ).trim();
        const keyedPlatformEntry = knownPlatformKeys.find(key => objectItem?.[key]);
        const platform = String(
          objectItem?.platform ||
          keyedPlatformEntry ||
          '',
        ).toLowerCase();
        const derivedUrl = directUrl || String(objectItem?.[platform] || '').trim();
        const normalizedPlatform = getSocialPlatform(platform, derivedUrl);
        return { platform: normalizedPlatform, url: derivedUrl };
      })
      .filter(item => item.url);
  }, [
    data?.social_media_links,
    userData?.social_media_links,
    data?.socialLinks,
    userData?.socialLinks,
    data?.social_links,
    userData?.social_links,
    getSocialPlatform,
  ]);

  const renderSocialIcon = useCallback((platform) => {
    if (platform === 'tiktok') return <Tiktok width={25} height={25} />;
    if (platform === 'linkedin') return <Linkedin width={25} height={25} />;
    if (platform === 'twitter') return <Twitter width={25} height={25} />;
    if (platform === 'instagram') return <FontAwesome name="instagram" size={23} color="#E1306C" />;
    return <Feather name="link-2" size={22} color="#374151" />;
  }, []);

  const websiteLink = useMemo(() => {
    return String(
      userData?.website_link ??
      data?.website_link ??
      userData?.websiteLink ??
      data?.websiteLink ??
      '',
    ).trim();
  }, [userData?.website_link, data?.website_link, userData?.websiteLink, data?.websiteLink]);

  const handleOpenSocialUrl = async (url) => {
    const raw = String(url || '').trim();
    if (!raw) {
      Alert.alert('Error', 'Link is empty');
      return;
    }

    const normalizedUrl = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

    try {
      const supported = await Linking.canOpenURL(normalizedUrl);
      if (!supported) {
        Alert.alert('Error', 'Invalid link');
        return;
      }
      await Linking.openURL(normalizedUrl);
    } catch (e) {
      Alert.alert('Error', 'Unable to open link');
    }
  };

  const DragonflyIcon = getDragonflyIcon(Userdata.Followers, isCompanyProfile);
  const usernameModalData = useMemo(() => {
    return {
      ...(userData || {}),
      ...(data || {}),
      id: data?.id || userData?.id || targetUserId || userId,
      userId: data?.userId || userData?.userId || targetUserId || userId,
      userName: data?.userName || userData?.userName || username || displayName,
      displayName: data?.displayName || userData?.displayName || displayName || username,
      walletAddress:
        data?.walletAddress ||
        userData?.walletAddress ||
        userData?.walletId ||
        walletAddress ||
        '',
    };
  }, [data, userData, targetUserId, userId, username, displayName, walletAddress]);

  const handleBackPress = useCallback(() => {
    const returnTo = returnByTo;
    console.log('is this wokreing buy', returnTo)

    if (returnTo) {
      // console.log()
      navigation.navigate(returnTo);
      return;
    }
    // 3️⃣ Absolute fallback
    navigation.goBack();
  }, []);

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
                <TouchableOpacity
                  onPress={handleBackPress}
                >
                  <Ionicons
                    name="arrow-back-outline"
                    size={22}
                    color="#111100"
                    style={{ marginRight: 4 }}
                  />
                </TouchableOpacity>
              )}
              <View style={styles.userRow}>
                <Text style={[styles.headerText, textStyle]}>{Userdata.Username}</Text>
                {isKycApproved && (
                  <DragonflyIcon width={22} height={22} style={styles.icon} />
                )}
                {!fromUsersProfile && (
                  <Ionicons
                    name="chevron-down"
                    size={18}
                    color="#111100"
                    style={{ marginLeft: 4 }}
                  />
                )}
              </View>
            </TouchableOpacity>
          </View>
          <View style={styles.iconContainer}>
            {!fromUsersProfile && (
              <TouchableOpacity style={styles.iconButton} onPress={() => { navigation.navigate('wallet') }}>
                <Ionicons name="wallet-outline" size={25} color="#111100" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                redirect();
              }}
            >
              <Ionicons name="share-outline" size={25} color="#111100" />
            </TouchableOpacity>
            {!fromUsersProfile && (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setModalVisible(true)}
              >
                <FontAwesome name="plus-square-o" size={25} color="#111100" />
              </TouchableOpacity>
            )}

            {fromUsersProfile ? (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setUsernameModalVisible(true)}
              >
                <Ionicons
                  name="ellipsis-horizontal-outline"
                  size={25}
                  color="#111100"
                />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => navigation.navigate('Settings')}
              >
                <Feather name="menu" size={25} color="#111100" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Profile Info */}
        <View style={styles.profile}>
          <View style={styles.profileView}>
            <View style={styles.profileWraper}>
              <TouchableOpacity
                onPress={handleProfileImagePress}
                activeOpacity={0.8}
                style={{ marginBottom: 5 }}
              >
                <Image
                  source={{ uri: avatarUri }}
                  style={[styles.image, { borderColor: text }]}
                  resizeMode="cover"
                />
                {!fromUsersProfile && (
                  <TouchableOpacity
                    style={[styles.addbutton, { backgroundColor: text, shadowColor: text }]}
                    onPress={handleProfileImagePress}
                  >
                    <Ionicons name="add" size={15} color="white" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
              <View>
                <Text style={styles.displaynamee}>{Userdata.Displayname}</Text>
              </View>
            </View>

            <View style={styles.edit}>
              {fromUsersProfile ? (
                <>
                  {/* <TouchableOpacity disabled={followBusy} onPress={() => purchaseSheetRef.current?.open()}>
                    {
                      !isBusinessProfile && (
                        userData?.profile !== 'company' && (
                          isFollowing && (
                            <LinearGradient
                              colors={profileActionGradient}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={[styles.editbuttons, { shadowColor: text }]}
                            >
                              <Text style={styles.buttonText}>Buy</Text>
                            </LinearGradient>
                          )
                        )
                      )
                    }
                  </TouchableOpacity> */}
                  <TouchableOpacity
                    onPress={handleFollowButtonPress}
                    disabled={followBusy || isFollowing === null}
                  >
                    <LinearGradient
                      colors={profileActionGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.editbuttons, { shadowColor: text }]}
                    >
                      <Text style={styles.buttonText}>
                        {isFollowing ? 'Following' : 'Follow'}
                        {followBusy ? '...' : ''}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => UserMessageNavigation()}
                  >
                    <LinearGradient
                      colors={profileActionGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.editbuttons, { shadowColor: text }]}
                    >
                      <Text style={styles.buttonText}>
                        Message
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  {normalizedProfileThemeType !== 'company' && (
                    <TouchableOpacity >
                      <LinearGradient
                        colors={profileActionGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.editbuttons, { shadowColor: text }]}
                      >
                        <View style={styles.buttonContent}>
                          <Ionicons name="trending-up-outline" size={28} color="#f2f8f2" />
                          <Text style={styles.buttonText}>Total Support</Text>
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
                      <Text style={styles.buttonText}>Edit Profile</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate('Invite', {
                        referralCode: userData?.referCode ||'Valense123',
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
                      <Ionicons
                        name="person-add-sharp"
                        size={15}
                        color="white"
                      />
                      <Text style={styles.buttonText}> Invite</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  {!isBusinessProfile && (


                    <TouchableOpacity
                    >
                      <LinearGradient
                        colors={profileActionGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.editbuttons, { shadowColor: text }]}
                      >
                        <View style={styles.buttonContent}>
                          <Ionicons name="trending-up-outline" size={28} color="#f2f8f2" />
                          <Text style={styles.buttonText}>Total Support</Text>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>

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

        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.statItem}>
            <Ionicons name="add-circle-outline" size={16} color="#444" />
            <Text style={[styles.statText, { color: text }]}> Mint: {Userdata.totalPost}</Text>
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
                  },
                });
              } else {
                navigation.navigate('FollowersFollowingScreen', {
                  tab: 'followers',
                  params: {
                    userName: Userdata.Username,
                    userId: userId,
                  },
                });
              }
            }}
          >
            <FontAwesome name="user" size={16} color="#444" />
            <Text style={[styles.statText, { color: text }]}>
              {' '}
              Followers: {Userdata.Followers}
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
                  },
                });
              } else {
                navigation.navigate('FollowersFollowingScreen', {
                  tab: 'following',
                  params: {
                    userName: displayName,
                    userId: userId,
                  },
                });
              }
            }}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color="#444" />
            <Text style={[styles.statText, { color: text }]}>
              {' '}
              Following: {Userdata.Followings}
            </Text>
          </TouchableOpacity>
        </View>
        {/* <TouchableOpacity style={styles.infoButton}>
  <Ionicons name="information-circle-outline" size={22} color="#144c9b" />
</TouchableOpacity> */}
      </View>

      {/* Modals */}
      <ProfileModal
        modalVisible={modalVisible}
        setModalVisible={setModalVisible}
      />
      <UsernameModal
        visible={usernameModalVisible}
        onClose={() => setUsernameModalVisible(false)}
        data={usernameModalData}
      />
      {/* <TradeModal
        visible={tradeModalVisible}
        onClose={() => setTradeModalVisible(false)}
      /> */}

      {/* Story Composer Modal */}
      <StoryComposer
        modalVisible={composerVisible}
        mediaList={composerList}
        onCancel={() => setComposerVisible(false)}
        onDone={handleComposerDone}
      />
      <SupportCreatorModal
        visible={supportModalVisible}
        creatorName={username || userData?.userName || 'Creator'}
        onClose={() => setSupportModalVisible(false)}
        onSupport={handleOpenSupportDisclaimer}
      />
      <SupportCreatorModal
        visible={supportDisclaimerVisible}
        creatorName={username || userData?.userName || 'Creator'}
        variant="disclaimer"
        onClose={() => setSupportDisclaimerVisible(false)}
        onSupport={handleSupportNow}
      />
      <WelcomeValensModal
        visible={welcomeModalVisible}
        onClose={async () => {
          setWelcomeModalVisible(false);
          await AsyncStorage.multiSet([
            [KYC_WELCOME_SHOWN_KEY, 'true'],
            [LEGACY_KYC_WELCOME_SHOWN_KEY, 'true'],
          ]);
        }}
      />
      <WalletSelectionModal
        visible={walletSelectionVisible}
        onClose={() => setWalletSelectionVisible(false)}
        onSelectWallet={handleWalletSelect}
      />
      <WalletConnectedModal
        visible={walletConnectedModalVisible}
        onClose={() => setWalletConnectedModalVisible(false)}
        walletName={connectedWalletInfo.name}
        walletAddress={connectedWalletInfo.address}
        onContinue={handleWalletConnectedContinue}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  usernameTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 5,
  },
  icon: {
    marginTop: 1,
  },
  iconContainer: {
    flexDirection: 'row',
  },
  iconButton: {
    padding: 6,
    marginHorizontal: 2,
  },

  // --- Profile ---
  profile: {
    marginTop: 10,
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  profileView: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  profileWraper: {
    position: 'relative',
    alignItems: 'center',
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
    right: 0,
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
  displaynamee: {
    fontSize: 18,
    color: '#1F2937',
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
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
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
  },

  // --- Bio ---
  biobox: {
    width: '100%',
    paddingVertical: 6,
    marginTop: 6,
  },
  biotext: {
    fontStyle: 'italic',
    color: '#374151',
    fontSize: 14,
  },
  bioLinkWrap: {
    marginTop: 2,
    marginBottom: 6,
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

  // --- Stats ---
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 14,
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
});
