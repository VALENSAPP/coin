import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, Animated, StyleSheet, Dimensions, Linking, ActivityIndicator, Modal, TouchableWithoutFeedback, AppState, Alert, Platform } from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, PinchGestureHandler, TapGestureHandler, State, FlatList } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import Video from 'react-native-video';
import { WhiteDragonfly } from '../../../assets/icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ShareModal from '../../modals/ShareModal';
import { getDragonflyIcon } from '../../profile/ProfilePersonalData';
import { showToastMessage } from '../../displaytoastmessage';
import { useDispatch } from 'react-redux';
import { useToast } from 'react-native-toast-notifications';
import { getUserCredentials, getUserDashboard } from '../../../services/post';
import { useAppTheme } from '../../../theme/useApptheme';
import { getTotalDonationAmount } from '../../../services/tokens';
import BuyersListModal from '../../modals/BuyerList';
import FastImage from 'react-native-fast-image'
import SupportCreatorModal from '../../modals/SupportCreatorModal';
import { getSupportRecipientWalletAddress } from '../../../utils/walletPaymentSupport';
import { useWalletConnectSupport } from '../../../context/WalletConnectSupportContext';
import MissionSupportScreen from '../../modals/DonationModal';
import { getProgressBarColor } from '../../../utils/progressBarUtils';
import { isSupportAllowed, normalizeProfileType } from '../../../utils/supportEligibility';
import HexAvatar from '../story.js/HexAvatar';
import YoutubePlayer from 'react-native-youtube-iframe';
import { parsePostMeta, getPostMusicForSlide } from '../../../utils/postSoundtracks';

const { width } = Dimensions.get('window');

/** Same window logic as post editor / Stories for looping feed soundtrack within trim. */
function getFeedMusicPlaybackWindow(trim, durationSec) {
  const prev = Math.max(0.1, Number(durationSec) || 30);
  const a = Math.max(0, Number(trim?.start) || 0);
  const rawEnd = trim?.end;
  const b =
    rawEnd == null || rawEnd === '' || !Number.isFinite(Number(rawEnd))
      ? Infinity
      : Number(rawEnd);
  const ovStart = Math.max(0, a);
  const ovEnd = Math.min(b, prev);
  if (ovEnd <= ovStart || ovStart >= prev) {
    return { start: 0, end: prev, hasOverlap: false };
  }
  return { start: ovStart, end: ovEnd, hasOverlap: true };
}

/* ----------------------------------------- */
function InstagramZoomableImage({ uri, onZoomChange }) {

  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalImageLoaded, setModalImageLoaded] = useState(false);
  const [imageHeight, setImageHeight] = useState(500);
  const screenWidth = Dimensions.get("window").width;
  useEffect(() => {
    if (!uri) return;

    Image.getSize(uri, (w, h) => {
      const ratio = screenWidth / w;
      const newHeight = h * ratio;

      const maxHeight = screenWidth * 2.2;
      const minHeight = screenWidth * 0.56;

      const finalHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));

      setImageHeight(finalHeight);
    });
  }, [uri]);


  const AnimatedFastImage = Animated.createAnimatedComponent(FastImage);

  const imageSource = useMemo(
    () => ({
      uri,
      priority: FastImage.priority.high,
      cache: FastImage.cacheControl.immutable,
    }),
    [uri]
  );

  const width = Dimensions.get("window").width;
  const halfWidth = width / 2;
  const halfHeight = imageHeight / 2;

  const onPinchEvent = Animated.event(
    [
      {
        nativeEvent: {
          scale: scale,
          focalX: translateX,
          focalY: translateY,
        },
      },
    ],
    { useNativeDriver: true }
  );

  const resetScale = () => {
    setIsModalVisible(false);
    setModalImageLoaded(false);
    onZoomChange?.(false);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 18,
        bounciness: 0,
      }),
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const onPinchStateChange = ({ nativeEvent }) => {
    const { state, oldState } = nativeEvent;

    if (state === State.BEGAN) {
      setIsModalVisible(true);
      onZoomChange?.(true);
    }

    if (
      oldState === State.ACTIVE &&
      (state === State.END ||
        state === State.CANCELLED ||
        state === State.FAILED)
    ) {
      resetScale();
    }
  };

  useEffect(() => {
    if (!uri) return;

    FastImage.preload([imageSource]);

    setTimeout(() => {
      FastImage.preload([
        { ...imageSource, priority: FastImage.priority.highest },
      ]);
    }, 400);
  }, [uri, imageSource]);

  return (
    <GestureHandlerRootView style={styles.mediaContainer}>
      {/* INLINE IMAGE */}
      <PinchGestureHandler
        onGestureEvent={onPinchEvent}
        onHandlerStateChange={onPinchStateChange}
      >
        <Animated.Image
          source={imageSource}
          style={[
            {
              width: '100%',
              height: imageHeight,
              resizeMode: "contain",
            },
            { opacity: isModalVisible && modalImageLoaded ? 0 : 1 },
          ]}
        />
      </PinchGestureHandler>

      {/* FULLSCREEN MODAL */}

      <Modal
        visible={isModalVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      >
        <GestureHandlerRootView style={styles.gestureModalRoot}>
          <View style={styles.modalBackground}>
            <PinchGestureHandler
              onGestureEvent={onPinchEvent}
              onHandlerStateChange={onPinchStateChange}
            >
              <AnimatedFastImage
                source={imageSource}
                resizeMode="contain"
                fadeDuration={0}
                onLoadStart={() => setModalImageLoaded(false)}
                onLoadEnd={() => setModalImageLoaded(true)}
                style={[
                  styles.fullScreenImage,
                  {
                    width: width,
                    height: imageHeight,
                    transform: [
                      { translateX: Animated.subtract(translateX, halfWidth) },
                      { translateY: Animated.subtract(translateY, halfHeight) },
                      { scale },
                      {
                        translateX: Animated.multiply(
                          Animated.subtract(translateX, halfWidth),
                          -1
                        ),
                      },
                      {
                        translateY: Animated.multiply(
                          Animated.subtract(translateY, halfHeight),
                          -1
                        ),
                      },
                    ],
                  },
                ]}
                renderToHardwareTextureAndroid
                shouldRasterizeIOS
              />
            </PinchGestureHandler>
          </View>
        </GestureHandlerRootView>
      </Modal>
    </GestureHandlerRootView>
  );
}

/** Pinch-to-zoom for feed video — same gesture + modal pattern as `InstagramZoomableImage`. */
function InstagramZoomableVideo({
  uri,
  videoHeight,
  paused,
  muted,
  repeat,
  onZoomChange,
  onVideoRef,
  onLoadStart,
  onLoad,
  onError,
  bufferConfig,
  maxBitRate,
  simultaneousHandlers,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalVideoReady, setModalVideoReady] = useState(false);

  const currentTimeRef = useRef(0);
  const modalVideoRef = useRef(null);
  const inlineVideoRef = useRef(null);

  const screenW = Dimensions.get('window').width;
  const halfWidth = screenW / 2;
  const halfHeight = videoHeight / 2;

  // KEY FIX 1: Only pause inline when modal video is actually ready and playing
  // Before modalVideoReady=true, keep inline playing to avoid black screen
  const inlinePaused = (isModalVisible && modalVideoReady) ? true : paused;

  // KEY FIX 2: Stable callback — never recreated, never causes Video remount
  const onProgressStable = useCallback(({ currentTime }) => {
    currentTimeRef.current = currentTime;
  }, []);

  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale, focalX: translateX, focalY: translateY } }],
    { useNativeDriver: true },
  );

  const resetScale = useCallback(() => {
    setIsModalVisible(false);
    setModalVideoReady(false);
    onZoomChange?.(false);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 0 }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
    ]).start();
  }, [scale, translateX, translateY, onZoomChange]);

  const onPinchStateChange = useCallback(({ nativeEvent }) => {
    const { state, oldState } = nativeEvent;

    if (state === State.BEGAN) {
      setModalVideoReady(false);
      setIsModalVisible(true);
      onZoomChange?.(true);
    }

    if (
      oldState === State.ACTIVE &&
      (state === State.END ||
        state === State.CANCELLED ||
        state === State.FAILED)
    ) {
      resetScale();
    }
  }, [resetScale, onZoomChange]);

  const modalTransformStyle = {
    width: screenW,
    height: videoHeight,
    transform: [
      { translateX: Animated.subtract(translateX, halfWidth) },
      { translateY: Animated.subtract(translateY, halfHeight) },
      { scale },
      { translateX: Animated.multiply(Animated.subtract(translateX, halfWidth), -1) },
      { translateY: Animated.multiply(Animated.subtract(translateY, halfHeight), -1) },
    ],
  };

  // KEY FIX 3: Stable modal load handler
  const onModalLoad = useCallback(() => {
    const seekTo = currentTimeRef.current || 0;
    if (seekTo > 0.5 && modalVideoRef.current?.seek) {
      modalVideoRef.current.seek(seekTo);
    }
  }, []);

  const onModalReady = useCallback(() => {
    setModalVideoReady(true);
  }, []);

  return (
    <GestureHandlerRootView style={styles.mediaContainer}>

      {/* ── INLINE VIDEO ── */}
      <PinchGestureHandler
        onGestureEvent={onPinchEvent}
        onHandlerStateChange={onPinchStateChange}
        simultaneousHandlers={simultaneousHandlers}
        minPointers={2}
      >
        <Animated.View
          style={{
            width: '100%',
            height: videoHeight,
            // Hide inline only after modal video is confirmed ready
            opacity: isModalVisible && modalVideoReady ? 0 : 1,
          }}
          collapsable={false}
        >
          <Video
            ref={(ref) => {
              inlineVideoRef.current = ref;
              onVideoRef?.(ref);
            }}
            source={{ uri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            repeat={repeat}
            paused={inlinePaused}
            muted={muted}
            controls={false}
            pointerEvents="none"
            onLoadStart={onLoadStart}
            onLoad={onLoad}
            onError={onError}
            playWhenInactive={false}
            progressUpdateInterval={1000}
            onProgress={onProgressStable}
            bufferConfig={bufferConfig}
            maxBitRate={maxBitRate}
          />
        </Animated.View>
      </PinchGestureHandler>

      {/* ── ZOOM MODAL ── */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
        onRequestClose={resetScale}
      >
        <GestureHandlerRootView style={styles.gestureModalRoot}>
          <View style={styles.modalBackground}>
            <PinchGestureHandler
              onGestureEvent={onPinchEvent}
              onHandlerStateChange={onPinchStateChange}
              minPointers={2}
            >
              <Animated.View
                collapsable={false}
                style={[
                  {
                    width: screenW,
                    height: videoHeight,
                    backgroundColor: '#000',
                  },
                  modalTransformStyle,
                ]}
              >
                <Video
                  ref={modalVideoRef}
                  source={{ uri }}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="contain"
                  repeat={repeat}
                  paused={false}
                  muted={muted}
                  controls={false}
                  pointerEvents="none"
                  playWhenInactive={false}
                  progressUpdateInterval={1000}
                  bufferConfig={{
                    minBufferMs: 5000,
                    maxBufferMs: 20000,
                    bufferForPlaybackMs: 200,
                    bufferForPlaybackAfterRebufferMs: 200,
                  }}
                  maxBitRate={maxBitRate}
                  onError={onError}
                  onLoad={onModalLoad}
                  onReadyForDisplay={onModalReady}
                  renderToHardwareTextureAndroid
                />
              </Animated.View>
            </PinchGestureHandler>
          </View>
        </GestureHandlerRootView>
      </Modal>

    </GestureHandlerRootView>
  );
}


function PostItem({
  item,
  likesCount,
  commentsCount,
  liked,
  saved,
  onToggleLike,
  onToggleSave,
  onToggleFollow,
  onComment,
  onOptions,
  followingBusy = false,
  isBusinessProfile,
  executeFollowAction,
  isVisible = false,
  screenFocused = true,
  playingPostId,
  currentlyVisiblePostId,
  returnTo,
  shareCount,
  taggedPeople,
  hideDonationButton = false, // Add this prop with default false
}) {
  const heartScale = useRef(new Animated.Value(1)).current;
  const listRef = useRef(null);
  const videoRefsMap = useRef({});
  const [totalFollowers, setTotalFollowers] = useState(0);
  const [userProfile, setUserProfile] = useState('');
  const [currentUserProfileType, setCurrentUserProfileType] = useState('user');
  const isCompanyProfile = userProfile === 'company';
  const DragonflyIcon = getDragonflyIcon(totalFollowers, isCompanyProfile);
  const [donation, setDonation] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [videoStates, setVideoStates] = useState({});
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [isZooming, setIsZooming] = useState(false);
  const [userId, setUserId] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showBuyersModal, setShowBuyersModal] = useState(false);
  const [showTaggedPeopleModal, setShowTaggedPeopleModal] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [videoHeight, setVideoHeight] = useState(500);
  const [videoLoaded, setVideoLoaded] = useState({});


  // New donation states
  const [totalDonation, setTotalDonation] = useState(0);
  const [isLoadingDonation, setIsLoadingDonation] = useState(false);
  const getDaysLeftFromEndTime = (endTime) => {
    if (!endTime) return 0;

    try {
      const now = new Date();
      const endDate = new Date(endTime);
      const diffTime = endDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    } catch (error) {
      console.error('Error calculating days left:', error);
      return 0;
    }
  };

  const [daysLeft, setDaysLeft] = useState(() => getDaysLeftFromEndTime(item?.end_time));
  const [walletAddress, setWalletAddress] = useState('');
  const [targetWalletAddress, setTargetWalletAddress] = useState('');
  const [supportDisclaimerVisible, setSupportDisclaimerVisible] = useState(false);
  const [isKycVerified, setIsKycVerified] = useState(false);
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const usernameText = item?.username || 'Unknown User';
  const captionValue = item?.caption?.trim() || '';
  const previewCaptionLength = Math.max(18, 60 - usernameText.length);
  const hasExpandableCaption = captionValue.length > previewCaptionLength;
  const collapsedCaption = hasExpandableCaption
    ? `${captionValue.slice(0, previewCaptionLength).trimEnd()}... `
    : captionValue;

  useEffect(() => {
    setExpanded(false);
  }, [item?.caption, item?.id, item?.UserId]);

  const navigation = useNavigation();
  const shareRef = useRef(null);
  const postFeedYoutubeRef = useRef(null);
  const postFeedMp3Ref = useRef(null);
  const postFeedMusicDurRef = useRef(180);
  const shouldPlayAudioRef = useRef(false);
  const dispatch = useDispatch();
  const toast = useToast();
  const { startSupportPayment } = useWalletConnectSupport();
  const { text } = useAppTheme();
  const isMountedRef = useRef(true);
  const route = useRoute();
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [dataFetched, setDataFetched] = useState(false); // To prevent redundant fetches
  const modalProfileType = normalizeProfileType(userProfile || item?.profile);

  if (!item || !item.id) {
    console.warn('PostItem received invalid item:', item);
    return null;
  }
  const width = Dimensions.get("window").width;
  useEffect(() => {
    const firstVideo = item?.media?.find(m => m.thumbnail);

    if (!firstVideo?.thumbnail) return;

    Image.getSize(firstVideo.thumbnail, (w, h) => {
      const ratio = width / w;
      setVideoHeight(h * ratio);
    });
  }, [item]);


  const safeMedia = item.media || [];
  const mediaLength = safeMedia.length;

  const parsedPostMeta = useMemo(() => parsePostMeta(item?.postMeta), [item?.postMeta]);

  const postMusic = useMemo(
    () => getPostMusicForSlide(item, currentIndex, parsedPostMeta),
    [
      currentIndex,
      parsedPostMeta,
      item?.id,
      item?.music,
      item?.youtubeMusicMeta,
      item?.postMeta,
      item?.media,
    ],
  );
  const taggedUsers = useMemo(
    () =>
      (Array.isArray(taggedPeople || item?.taggedPeople) ? (taggedPeople || item?.taggedPeople) : [])
        .filter(Boolean)
        .map((person, index) => {
          if (typeof person === 'string') {
            return {
              id: `tagged-${index}-${person}`,
              username: person,
            };
          }
          return {
            id: person?.id || `tagged-${index}`,
            username: person?.username || person?.userName || 'Unknown User',
            fullName: person?.fullName || person?.name || '',
            avatar: person?.avatar || person?.image || person?.userImage || null,
          };
        }),
    [item?.taggedPeople, taggedPeople],
  );

  // Calculate days left from current time to end_time
  const calculateDaysLeft = useCallback(() => {
    return getDaysLeftFromEndTime(item?.end_time);
  }, [item.end_time]);

  useEffect(() => {
    setDaysLeft(calculateDaysLeft());

    const timer = setInterval(() => {
      setDaysLeft(calculateDaysLeft());
    }, 60 * 1000);

    return () => clearInterval(timer);
  }, [calculateDaysLeft]);
  const handleDonationSuccess = useCallback(() => {
    // Refresh donation total after successful donation
    fetchTotalDonation();
  }, [fetchTotalDonation]);

  // Fetch total donation for this post
  const fetchTotalDonation = useCallback(async () => {
    if (!item.id) return;
    setIsLoadingDonation(true);
    try {
      const response = await getTotalDonationAmount({ postId: item.id });

      if (response.statusCode === 200) {
        const donationAmount = response.data?.totalDonation || 0;
        setTotalDonation(donationAmount);
      }
    } catch (error) {
      console.error('Error fetching total donation:', error);
      setTotalDonation(0);
    } finally {
      setIsLoadingDonation(false);
    }
  }, [item.id]);

  // Memoize fetchAllData
  const fetchAllData = useCallback(async () => {
    if (!item?.UserId) {
      console.warn('No UserId available for fetching data');
      return;
    }

    try {
      const [dashboardResponse, profileResponse] = await Promise.allSettled([
        getUserDashboard(item.UserId),
        getUserCredentials(item.UserId)
      ]);

      if (dashboardResponse.status === 'fulfilled') {
        const data = dashboardResponse.value;
        if (data?.statusCode === 200) {
          setTotalFollowers(data.data?.dashboardData?.totalFollowers || 0);
        } else {
          console.warn('Dashboard fetch failed:', data?.data?.message);
        }
      } else {
        console.error('Dashboard fetch rejected:', dashboardResponse.reason);
      }

      if (profileResponse.status === 'fulfilled') {
        const data = profileResponse.value;
        if (data?.statusCode === 200) {
          let userDataToSet;
          if (data.data && data.data.user) {
            userDataToSet = data.data.user;
          } else if (data.data) {
            userDataToSet = data.data;
          } else {
            userDataToSet = data;
          }
          setUserProfile(userDataToSet.profile || '');
          setTargetWalletAddress(getSupportRecipientWalletAddress(userDataToSet) || '');
          setIsKycVerified(userDataToSet?.kyc === true);
          setIsSubscriptionActive(String(userDataToSet?.subscriptionStatus || '').toUpperCase() === 'ACTIVE');
        } else {
          console.warn('Profile fetch failed:', data?.data?.message);
        }
      } else {
        console.error('Profile fetch rejected:', profileResponse.reason);
      }
    } catch (error) {
      console.error('Error in fetchAllData:', error);
      showToastMessage(
        toast,
        'danger',
        error?.response?.message ?? 'Failed to load user data',
      );
    } finally {
      // dispatch(hideLoader());
    }
  }, [item?.UserId, toast]);

  // Function to restore userId from AsyncStorage
  const restoreUserId = useCallback(async () => {
    try {
      const id = await AsyncStorage.getItem('userId');
      const currentUserId = userId ? String(userId) : null;
      const newUserId = id ? String(id) : null;
      if (newUserId !== currentUserId) {
        setUserId(newUserId);
      }
    } catch (error) {
      console.error('Error restoring userId:', error);
    }
  }, [userId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const storedProfile = await AsyncStorage.getItem('profile');
        if (!mounted) return;
        setCurrentUserProfileType(normalizeProfileType(storedProfile));
      } catch {
        // ignore; keep default
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const initializeData = async () => {
        try {
          const id = await AsyncStorage.getItem('userId');
          const storedWalletAddress = await AsyncStorage.getItem('walletAddress');
          if (isActive) setUserId(id ? String(id) : null);
          if (isActive) setWalletAddress(storedWalletAddress || '');

          if (item?.UserId && !dataFetched) {
            await fetchAllData();
            setDataFetched(true);
          }

          const days = calculateDaysLeft();
          if (isActive) setDaysLeft(days);

          if (!dataFetched) {
            await fetchTotalDonation();
          }
        } catch (error) {
          console.error('Error initializing PostItem data:', error);
        }
      };

      initializeData();

      return () => {
        isActive = false;
      };
    }, [item?.UserId, calculateDaysLeft, fetchTotalDonation, fetchAllData, dataFetched])
  );

  // Listen for app state changes to restore userId when returning from an external wallet app
  // useEffect(() => {
  //   const subscription = AppState.addEventListener('change', (nextAppState) => {
  //     if (nextAppState === 'active') {
  //       // App has come to the foreground, restore userId
  //       restoreUserId();
  //     }
  //   });

  //   // Also restore on mount
  //   restoreUserId();

  //   return () => {
  //     subscription?.remove();
  //   };
  // }, [restoreUserId]);

  const creatorWalletAddress = useMemo(
    () =>
      targetWalletAddress ||
      item?.walletAddress ||
      item?.walletId ||
      item?.wallet ||
      item?.userWalletAddress ||
      item?.creatorWalletAddress ||
      item?.vendorWalletAddress ||
      item?.receiverWalletAddress ||
      null,
    [targetWalletAddress, item],
  );

  const recipientWalletAddress = useMemo(
    () => getSupportRecipientWalletAddress({ ...item, walletAddress: creatorWalletAddress }),
    [item, creatorWalletAddress],
  );
  const canSupport = !!creatorWalletAddress;

  const supporterProfile = useMemo(
    () =>
      typeof isBusinessProfile === 'boolean'
        ? (isBusinessProfile ? 'company' : 'user')
        : currentUserProfileType,
    [isBusinessProfile, currentUserProfileType],
  );
  const recipientProfile = useMemo(
    () => normalizeProfileType(userProfile || item?.profile),
    [userProfile, item?.profile],
  );

  const handleSupportNow = useCallback(async () => {
    if (!canSupport) {
      Alert.alert('Wallet not connected', 'This user has not connected a wallet yet. Follow is still active.');
      return;
    }
    setSupportDisclaimerVisible(false);
    const receiverId =
      item?.UserId ?? item?.userId ?? item?.UserID ?? '';
    await startSupportPayment(recipientWalletAddress, {
      senderId: userId != null ? String(userId) : '',
      receiverId: receiverId !== '' ? String(receiverId) : '',
      chain: 'POLYGON',
    });
  }, [canSupport, recipientWalletAddress, startSupportPayment, userId, item]);

  const handleOpenSupportDisclaimer = useCallback(() => {
    if (!isSupportAllowed({ supporterProfile, recipientProfile })) {
      Alert.alert(
        'Support unavailable',
        'Tips are not available for business profiles.',
      );
      setModalVisible(false);
      return;
    }
    setModalVisible(false);
    setSupportDisclaimerVisible(true);
  }, [supporterProfile, recipientProfile]);

  const safeVideoPause = useCallback((index) => {
    try {
      const ref = videoRefsMap.current[index];
      if (ref && typeof ref.pause === 'function') {
        ref.pause();
      }
    } catch (error) {
      console.warn(`Error pausing video at index ${index}:`, error);
    }
  }, []);

  // Auto-mute whenever this post comes into active focus.
  // User can still unmute manually via speaker button.
  const wasPostActiveRef = useRef(false);
  useEffect(() => {
    const hasPlayingTarget = playingPostId !== undefined && playingPostId !== null;
    const isPostActive =
      isVisible &&
      screenFocused &&
      (!hasPlayingTarget || String(playingPostId) === String(item.id));

    if (isPostActive && !wasPostActiveRef.current) {
      setIsMuted(true);
    }

    wasPostActiveRef.current = isPostActive;
  }, [isVisible, screenFocused, playingPostId, currentlyVisiblePostId, item.id]);

  // useEffect(() => {
  //   if (mediaLength <= 0) return;

  //   const hasPlayingTarget = playingPostId !== undefined && playingPostId !== null;
  //   const nextStates = {};
  //   for (let idx = 0; idx < mediaLength; idx++) {
  //     const shouldPause = !(
  //       idx === currentIndex &&
  //       isVisible &&
  //       screenFocused &&
  //       (!hasPlayingTarget || String(playingPostId) === String(item.id))
  //     );
  //     nextStates[idx] = shouldPause;
  //   }

  //   setVideoStates(prev => {
  //     const hasChanged = Object.keys(nextStates).some(
  //       key => prev[key] !== nextStates[key]
  //     );
  //     return hasChanged ? nextStates : prev;
  //   });

  //   // Use requestAnimationFrame for better performance
  //   const rafId = requestAnimationFrame(() => {
  //     Object.entries(nextStates).forEach(([idx, shouldPause]) => {
  //       if (shouldPause) {
  //         safeVideoPause(parseInt(idx));
  //       }
  //     });
  //   });

  //   return () => cancelAnimationFrame(rafId);
  // }, [currentIndex, isVisible, screenFocused, playingPostId, item.id, mediaLength, safeVideoPause]);

  useEffect(() => {
    return () => {
      Object.keys(videoRefsMap.current).forEach(idx => {
        safeVideoPause(parseInt(idx));
      });
      videoRefsMap.current = {};
    };
  }, [safeVideoPause]);

  const handleUserProfile = useCallback((id) => {
    console.log("handleUserProfile==>>>>>")
    if (userId === id) {
      navigation.navigate('ProfileMain', { screen: 'Profile' });
    } else {
      // Navigate to UsersProfile with proper returnTo context
      // Return to the current route (e.g., PostView or ChatMessages)
      const currentRoute = route?.name || 'Home';
      navigation.navigate('HomeMain', {
        screen: 'UsersProfile',
        params: {
          userId: id,
          returnTo: currentRoute
        },
      });
      console.log(userId, 'can user id came heree')
    }
  }, [userId, navigation, route?.name]);

  const formatNumber = useCallback((n) => {
    if (typeof n !== 'number') n = Number(n) || 0;
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }, []);

  const currencyPrefix = useMemo(() => {
    const currencyCode = String(item?.currency || '').toUpperCase();
    const currencySymbols = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      INR: '₹',
      CAD: 'C$',
      AUD: 'A$',
      NZD: 'NZ$',
      JPY: '¥',
      CNY: '¥',
      KRW: '₩',
      SGD: 'S$',
      HKD: 'HK$',
      AED: 'د.إ',
      SAR: 'ر.س',
    };

    if (currencySymbols[currencyCode]) return currencySymbols[currencyCode];
    return currencyCode ? `${currencyCode} ` : '$';
  }, [item?.currency]);

  const isVideoUrl = useCallback((url) => {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase().split('?')[0];
    const exts = ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp', 'm4v'];
    return exts.some((ext) => lower.endsWith(`.${ext}`));
  }, []);

  const isCurrentSlideVideo = useMemo(() => {
    const m = safeMedia[currentIndex];
    if (!m) return false;
    return m.type === 'video' || isVideoUrl(m.url);
  }, [safeMedia, currentIndex, isVideoUrl]);

  /**
   * Video + attached music may play only when this post is visible in the feed and (if the parent
   * supplies playingPostId) this post is the designated one. Fixes: audio on all posts when
   * playingPostId was null, and music continuing after scroll-away.
   */
  const playbackEligible = useMemo(
    () =>
      screenFocused &&
      isVisible &&
      (playingPostId != null && playingPostId !== ''
        ? String(playingPostId) === String(item.id)
        : true),
    [screenFocused, isVisible, playingPostId, item.id],
  );

  const buyerList = useMemo(() => Array.isArray(item.boughtBy) ? item.boughtBy : Array.isArray(item.buyers) ? item.buyers : [], [item.boughtBy, item.buyers]);

  // Filter out the current logged-in user from buyer list for display
  const displayBuyerList = useMemo(() => {
    if (!buyerList || buyerList.length === 0 || !userId) return buyerList;
    const currentUserIdStr = String(userId);
    return buyerList.filter(buyer => {
      const buyerIdStr = buyer?.id ? String(buyer.id) : buyer?.userId ? String(buyer.userId) : null;
      return buyerIdStr !== currentUserIdStr;
    });
  }, [buyerList, userId]);

  const animateHeart = useCallback(() => {
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.2, duration: 80, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
  }, [heartScale]);

  const handleLike = useCallback(() => {
    onToggleLike?.(item.id);
    animateHeart();
  }, [onToggleLike, item.id, animateHeart]);

  // Use dynamic values for donation calculations
  const goalAmount = useMemo(() => {
    const parsedGoal = Number(item?.raiseAmount);
    return Number.isFinite(parsedGoal) && parsedGoal > 0 ? parsedGoal : 0;
  }, [item?.raiseAmount]);

  const currentRaised = useMemo(() => {
    const parsedRaised = Number(totalDonation);
    return Number.isFinite(parsedRaised) && parsedRaised > 0 ? parsedRaised : 0;
  }, [totalDonation]);

  const progressPercent = useMemo(
    () => goalAmount > 0 ? (currentRaised / goalAmount) * 100 : 0,
    [goalAmount, currentRaised]
  );

  const progressBarColor = useMemo(
    () => getProgressBarColor(progressPercent, item?.profile),
    [progressPercent, item?.profile]
  );

  const isGoalAmountRaised = goalAmount > 0 && currentRaised >= goalAmount;
  const isCampaignDaysCompleted = goalAmount > 0 && !!item?.end_time && daysLeft <= 0;
  const progressStatusLabel = isGoalAmountRaised
    ? 'GOAL AMOUNT RAISED'
    : isCampaignDaysCompleted
      ? 'DAYS COMPLETED'
      : '';

  const onMomentumEnd = useCallback((e) => {
    const x = e?.nativeEvent?.contentOffset?.x ?? 0;
    const index = Math.round(x / width);
    if (index !== currentIndex) setCurrentIndex(index);
  }, [currentIndex]);

  const handleOpenReel = useCallback((mediaItem) => {
    const uniqueKey = Date.now().toString();
    const allMediaUrls = Array.isArray(item?.media)
      ? item.media.map((m) => m?.url).filter(Boolean)
      : [];
    navigation.navigate('ProfileMain', {
      screen: 'FlipsScreen',
      params: {
        item: {
          ...item,
          image: mediaItem?.url,
          images: allMediaUrls.length > 0 ? allMediaUrls : (mediaItem?.url ? [mediaItem.url] : []),
          isVideo: true,
          type: 'video',
          mediaType: 'video',
          // Normalize user fields for FlipsScreen
          userName: item?.userName || item?.username || 'Unknown User',
          userImage: item?.userImage || item?.avatar || null,
          userId: item?.userId || item?.UserId || null,
        },
        key: uniqueKey,
        // Always return to the current screen context first (e.g. PostView/Home).
        returnTo: route?.name || returnTo,
        returnParams: route?.params || {},
      },
    });
  }, [item, navigation, returnTo, route?.name, route?.params]);

  const handleFollowPress = useCallback(async () => {
    if (!item?.UserId || item.UserId === userId || followingBusy) return;

    const shouldFollow = !item.follow;
    const followHandler = executeFollowAction || onToggleFollow;
    if (!followHandler) return;

    const result = await followHandler(item.UserId, shouldFollow, item.userTokenAddress);
    const success = typeof result === 'boolean' ? result : true;
    if (!success || !shouldFollow) return;

    if (isSupportAllowed({ supporterProfile, recipientProfile })) {
      setModalVisible(true);
    }
  }, [
    item?.UserId,
    item.follow,
    item.userTokenAddress,
    userId,
    followingBusy,
    executeFollowAction,
    onToggleFollow,
    supporterProfile,
    recipientProfile,
  ]);


  const renderMedia = useCallback(({ item: mediaItem, index }) => {
    const isVideo = mediaItem.type === 'video' || isVideoUrl(mediaItem.url);
    const isPaused = videoStates[index] ?? false;
    const isVideoReady = !!videoLoaded[index];

    const shouldPlay = index === currentIndex && playbackEligible && !isZooming;

    return (
      <View style={styles.mediaContainer}>
        {isVideo ? (
          <View style={{ width, height: videoHeight }}>
            {!isVideoReady && mediaItem.thumbnail && (
              <Image
                source={{ uri: mediaItem.thumbnail }}
                style={{
                  width: width,
                  height: videoHeight,
                  position: "absolute",
                }}
                resizeMode="cover"
              />
            )}
            <InstagramZoomableVideo
              uri={mediaItem.url}
              videoHeight={videoHeight}
              paused={!shouldPlay}
              muted={isMuted}
              repeat
              onVideoRef={(ref) => {
                if (ref) videoRefsMap.current[index] = ref;
              }}
              onLoadStart={() => {
                setVideoLoaded(prev => ({ ...prev, [index]: false }));
              }}
              onLoad={() => {
                setVideoLoaded(prev => ({ ...prev, [index]: true }));
              }}
              onError={(error) => {
                console.log('Video error:', error);
              }}
              bufferConfig={{
                minBufferMs: 2000,
                maxBufferMs: 10000,
                bufferForPlaybackMs: 1000,
                bufferForPlaybackAfterRebufferMs: 2000,
              }}
              maxBitRate={1200000}
              onZoomChange={(zoomed) => {
                setIsZooming(zoomed);
                setScrollEnabled(!zoomed);
              }}
              simultaneousHandlers={listRef}
            />
            {isPaused ? (
              <TouchableOpacity
                style={styles.videoOverlay}
                activeOpacity={1}
                onPress={() => handleOpenReel(mediaItem)}
              >
                <View style={styles.playButtonContainer}>
                  <Icon name="play" size={32} color="#fff" />
                </View>
              </TouchableOpacity>
            ) : (
              <View
                pointerEvents="none"
                style={[styles.videoOverlay, styles.videoOverlayTransparent]}
                collapsable={false}
              />
            )}
            <TouchableOpacity
              style={styles.speakerButton}
              onPress={() => setIsMuted((prev) => !prev)}
            >
              <Feather name={isMuted ? 'volume-x' : 'volume-2'} size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <InstagramZoomableImage
            uri={mediaItem.url}
            onZoomChange={(zoomed) => {
              setIsZooming(zoomed);
              setScrollEnabled(!zoomed);
            }}
          />
        )}
      </View>
    );
  }, [currentIndex, handleOpenReel, isVideoUrl, videoStates, isZooming, isMuted, playbackEligible]);

  const shouldPlayPostFeedMusic =
    Boolean(postMusic) && playbackEligible && !isZooming && !isCurrentSlideVideo;

  const shouldPlayAudio = shouldPlayPostFeedMusic && !isMuted;

  useEffect(() => {
    shouldPlayAudioRef.current = shouldPlayAudio;
  }, [shouldPlayAudio]);

  useEffect(() => {
    if (postMusic?.kind !== 'youtube') return;
    // Only unmute the player if it exists (rendered) and user has unmuted
    if (!isMuted && postFeedYoutubeRef.current?.unMute) {
      postFeedYoutubeRef.current?.unMute?.();
    }
  }, [isMuted, postMusic?.kind]);

  useEffect(() => {
    if (postMusic?.kind !== 'youtube') return;
    if (shouldPlayAudio) return;
    (async () => {
      try {
        await postFeedYoutubeRef.current?.pauseVideo?.();
      } catch (_) { }
    })();
  }, [shouldPlayAudio, postMusic?.kind]);

  useEffect(() => {
    if (!postMusic) return;
    return () => {
      try {
        postFeedYoutubeRef.current?.pauseVideo?.();
        postFeedMp3Ref.current?.pause?.();
      } catch (_) { }
    };
  }, [postMusic?.kind, postMusic?.videoId, postMusic?.audioUrl, item.id]);

  useEffect(() => {
    if (postMusic?.kind !== 'youtube' || !screenFocused) return;
    const trim = postMusic.trim;
    const tick = setInterval(() => {
      (async () => {
        try {
          if (!shouldPlayAudioRef.current) return;
          const cur = await postFeedYoutubeRef.current?.getCurrentTime?.();
          if (typeof cur !== 'number' || Number.isNaN(cur)) return;
          const dur = postFeedMusicDurRef.current || 180;
          const { start: playStart, end: playEnd, hasOverlap } = getFeedMusicPlaybackWindow(
            trim,
            dur,
          );
          const margin = Math.min(0.35, Math.max(0.08, (playEnd - playStart) * 0.02));
          if (hasOverlap && playEnd > playStart && cur >= playEnd - margin) {
            await postFeedYoutubeRef.current?.seekTo?.(playStart, true);
          }
        } catch (_) { }
      })();
    }, 320);
    return () => clearInterval(tick);
  }, [
    postMusic?.kind,
    postMusic?.videoId,
    postMusic?.trim?.start,
    postMusic?.trim?.end,
    screenFocused,
    item?.id,
  ]);

  return (

    <View style={styles.wrapper}>
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <TouchableOpacity onPress={() => handleUserProfile(item.UserId)} style={styles.avatarContainer}>
            <HexAvatar
              uri={item.avatar}
              size={42}
              borderWidth={2}
              borderColor={item?.profile === 'company' ? '#D3B683' : '#5a2d82'}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleUserProfile(item.UserId)} style={styles.userInfo}>
            <View style={styles.userRow}>
              <Text style={[styles.username, { color: item?.profile === "user" ? '#5a2d82' : '#D3B683' }]}>{item.username}</Text>
              {isKycVerified && (
                <View style={styles.dragonflyIcon}>
                  <DragonflyIcon width={18} height={18} />
                </View>
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.priceSection}>
            {/* <WhiteDragonfly width={20} height={20} style={styles.triangleIcon} /> */}
            {/* <Text style={[styles.priceText, { color: item?.profile === "user" ? '#5a2d82' : '#D3B683' }]}>${item.tokenBalance}</Text> */}
          </View>

          <TouchableOpacity onPress={() => onOptions?.(item.id)} style={styles.moreButton}>
            <Feather name="more-vertical" size={20} color="#374151" />
          </TouchableOpacity>
        </View>

        <View style={styles.mediaWrapper}>
          {postMusic?.kind === 'mp3' ? (
            <Video
              ref={postFeedMp3Ref}
              key={`feed_mp3_${item.id}_${postMusic.audioUrl}_${currentIndex}`}
              source={{ uri: postMusic.audioUrl }}
              style={styles.hiddenPostAudio}
              paused={!shouldPlayAudio}
              muted={!shouldPlayAudio}
              repeat={false}
              volume={shouldPlayAudio ? 1 : 0}
              resizeMode="contain"
              controls={false}
              playWhenInactive={false}
              ignoreSilentSwitch="ignore"
              onLoad={e => {
                const d = e?.duration > 0 ? e.duration : 180;
                postFeedMusicDurRef.current = d;
                const { start, hasOverlap } = getFeedMusicPlaybackWindow(postMusic.trim, d);
                const seekTo = hasOverlap ? start : 0;
                setTimeout(() => postFeedMp3Ref.current?.seek?.(seekTo), 80);
              }}
              onProgress={({ currentTime }) => {
                const dur = postFeedMusicDurRef.current || 180;
                const { start: ps, end: pe, hasOverlap } = getFeedMusicPlaybackWindow(
                  postMusic.trim,
                  dur,
                );
                const margin = Math.min(0.35, Math.max(0.08, (pe - ps) * 0.02));
                if (hasOverlap && pe > ps && currentTime >= pe - margin) {
                  postFeedMp3Ref.current?.seek?.(ps);
                }
              }}
            />
          ) : null}
          {postMusic?.kind === 'youtube' && !isMuted ? (
            <View style={styles.hiddenPostYoutube} pointerEvents="none" collapsable={false}>
              <YoutubePlayer
                ref={postFeedYoutubeRef}
                key={`feed_yt_${item.id}_${postMusic.videoId}`}
                height={200}
                width={200}
                videoId={postMusic.videoId}
                play={!isMuted}
                mute={false}
                volume={!isMuted ? 100 : 0}
                initialPlayerParams={{
                  controls: false,
                  modestbranding: true,
                  rel: false,
                }}
                onReady={async () => {
                  try {
                    // Ensure player is muted on load
                    if (isMuted) {
                      await postFeedYoutubeRef.current?.mute?.();
                    }

                    const d = await postFeedYoutubeRef.current?.getDuration?.();
                    if (typeof d === 'number' && d > 0) {
                      postFeedMusicDurRef.current = d;
                    } else if (
                      postMusic.durationSec != null &&
                      Number.isFinite(Number(postMusic.durationSec))
                    ) {
                      postFeedMusicDurRef.current = Number(postMusic.durationSec);
                    }
                    const dur = postFeedMusicDurRef.current || 180;
                    const { start: ps, hasOverlap } = getFeedMusicPlaybackWindow(
                      postMusic.trim,
                      dur,
                    );
                    const seekTo = hasOverlap ? ps : 0;
                    await postFeedYoutubeRef.current?.seekTo?.(seekTo, true);
                  } catch (_) { }
                }}
                onChangeState={state => {
                  // Don't auto-loop YouTube music - let it play once and stop
                  // if (state === 'ended' && shouldPlayAudioRef.current) {
                  //   const dur = postFeedMusicDurRef.current || 180;
                  //   const { start: ps, hasOverlap } = getFeedMusicPlaybackWindow(
                  //     postMusic.trim,
                  //     dur,
                  //   );
                  //   postFeedYoutubeRef.current?.seekTo?.(hasOverlap ? ps : 0, true);
                  //   postFeedYoutubeRef.current?.playVideo?.();
                  // }
                }}
              />
            </View>
          ) : null}
          {taggedUsers.length > 0 && (
            <TouchableOpacity
              style={styles.tagButton}
              onPress={() => setShowTaggedPeopleModal(true)}
              activeOpacity={0.8}
            >
              <Feather name="tag" size={18} color="#fff" />
            </TouchableOpacity>
          )}
          <FlatList
            ref={listRef}
            data={safeMedia}
            keyExtractor={(_, i) => `media-${i}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEnabled={scrollEnabled && safeMedia.length > 1}
            onMomentumScrollEnd={onMomentumEnd}
            decelerationRate="fast"
            snapToInterval={width}
            snapToAlignment="start"
            disableIntervalMomentum={true}
            getItemLayout={(_, index) => ({
              length: width,
              offset: width * index,
              index
            })}
            renderItem={renderMedia}
            removeClippedSubviews={Platform.OS === 'android'}
            maxToRenderPerBatch={2}
            windowSize={3}
            initialNumToRender={1}
          />

          {item.media && item.media.length > 1 && (
            <>
              <View style={styles.mediaCounter}>
                <Text style={styles.mediaCounterText}>
                  {currentIndex + 1}/{item.media.length}
                </Text>
              </View>

              <View style={styles.dotsContainer}>
                {item.media.map((_, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: idx === currentIndex ? text : 'rgba(255,255,255,0.5)',
                      },
                    ]}
                  />
                ))}
              </View>
            </>
          )}
          {postMusic && !isCurrentSlideVideo && (
            <TouchableOpacity
              style={styles.speakerButton}
              onPress={() => setIsMuted(prev => !prev)}
              accessibilityLabel={isMuted ? 'Unmute music' : 'Mute music'}
            >
              <Feather name={isMuted ? 'volume-x' : 'volume-2'} size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.actionsSection}>
          <View style={styles.leftActions}>
            <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Icon name={liked ? 'heart' : 'heart-outline'} size={26} color={liked ? '#ef4444' : '#374151'} />
              </Animated.View>
              <Text style={styles.actionCount}>{likesCount || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => onComment?.(item.id, item.UserId)} style={styles.actionButton}>
              <Feather name="message-circle" size={24} color="#374151" />
              <Text style={styles.actionCount}>{commentsCount || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { shareRef.current?.open?.(), setSelectedPostId(item) }} style={styles.actionButton}>
              <Feather name="send" size={24} color="#374151" />
              <Text style={styles.actionCount}>{shareCount}</Text>
            </TouchableOpacity>
          </View>

          {item.UserId !== userId && (
            // Convert both to strings for reliable comparison
            // const itemUserIdStr = String(item.UserId);
            // const currentUserIdStr = userId ? String(userId) : '';
            // // Show button if post is from a different user (or if userId is not set yet)
            // const isDifferentUser = !currentUserIdStr || itemUserIdStr !== currentUserIdStr;

            // if (!isDifferentUser) return null;
            // console.log(item,'item for follow ß')
            // return (
            <TouchableOpacity
              onPress={handleFollowPress}
              disabled={followingBusy}
              style={[
                styles.followButton,
                item.follow && styles.followingButton,
                { backgroundColor: item?.profile === "user" ? '#5a2d82' : '#D3B683' }
              ]}
            >
              {followingBusy ? (
                <ActivityIndicator size="small" color={item.follow ? text : '#FFFFFF'} />
              ) : (
                <Text style={[styles.followButtonText, item.follow && styles.followingButtonText]}>
                  {item.follow ? 'Followed' : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {(() => {
          const itemUserId = item?.UserId ? String(item.UserId) : null;
          const currentUserId = userId ? String(userId) : null;
          return itemUserId && itemUserId !== currentUserId;
        })() && (
            <>
              {displayBuyerList.length > 0 && (
                <TouchableOpacity
                  style={styles.buyersSection}
                  activeOpacity={0.8}
                  onPress={() => setShowBuyersModal(true)}
                >
                  <View style={styles.avatarsContainer}>
                    {displayBuyerList.slice(0, 3).map((buyer, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.buyerAvatarWrapper,
                          {
                            marginLeft: idx > 0 ? -10 : 0,
                            zIndex: 3 - idx,      // idx=0 → zIndex:3, idx=1 → zIndex:2, idx=2 → zIndex:1
                            elevation: 3 - idx,   // Android fix
                          }
                        ]}
                      >
                        <HexAvatar
                          uri={buyer.avatar}
                          size={28}
                          borderWidth={1.5}
                          borderColor={item?.profile === 'company' ? '#D3B683' : '#5a2d82'}
                        />
                      </View>
                    ))}
                  </View>
                  <Text style={styles.buyersText} numberOfLines={1}>
                    Followed by <Text style={[styles.buyerName, { color: item?.profile === "user" ? '#5a2d82' : '#D3B683' }]}>{displayBuyerList[0]?.username || '—'}</Text>
                    {displayBuyerList.length > 1 && <Text style={{ color: item?.profile === "user" ? '#5a2d82' : '#D3B683' }}> and {formatNumber(displayBuyerList.length - 1)} others</Text>}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

        <View style={styles.captionSection}>
          {!!captionValue && (
            <>
              {expanded ? (
                <Text style={styles.captionRow}>
                  <Text
                    onPress={() => handleUserProfile(item.UserId)}
                    style={[
                      styles.captionUsername,
                      { color: item?.profile === "user" ? "#5a2d82" : "#D3B683" }
                    ]}
                  >
                    {usernameText}{' '}
                  </Text>
                  <Text style={styles.captionText}>{captionValue}</Text>
                </Text>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={hasExpandableCaption ? () => setExpanded(true) : undefined}
                  disabled={!hasExpandableCaption}
                >
                  <Text style={styles.captionRow} numberOfLines={1} ellipsizeMode="tail">
                    <Text
                      onPress={() => handleUserProfile(item.UserId)}
                      style={[
                        styles.captionUsername,
                        { color: item?.profile === "user" ? "#5a2d82" : "#D3B683" }
                      ]}
                    >
                      {usernameText}{' '}
                    </Text>
                    <Text style={styles.captionText}>{collapsedCaption}</Text>
                    {hasExpandableCaption ? (
                      <Text style={styles.captionMoreText}>
                        see more
                      </Text>
                    ) : null}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {hasExpandableCaption && expanded && (
            <Text
              style={styles.captionToggleText}
              onPress={() => setExpanded(false)}
            >
              see less
            </Text>
          )}
          {item.link ? (
            <TouchableOpacity onPress={() => Linking.openURL(item.link)}>
              <Text style={styles.linkText}>Link - {item.link}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {goalAmount > 0 && (
          <View style={styles.progressSection}>
            {progressStatusLabel ? (
              <View style={styles.progressStatusBadge}>
                <Text style={styles.progressStatusBadgeText}>{progressStatusLabel}</Text>
              </View>
            ) : null}

            <View style={styles.progressBarWrapper}>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(progressPercent, 100)}%`,
                      backgroundColor: progressBarColor,
                    },
                  ]}
                />
              </View>

              <View style={styles.progressStatsContainer}>
                <View style={styles.statAtStart}>
                  <Text style={styles.statValueSmall}>
                    {isLoadingDonation ? '...' : `${Math.min(progressPercent, 100).toFixed(1)}% FUNDED`}
                  </Text>
                </View>
                <View style={styles.statAtCenter}>
                  <Text style={styles.statValueSmall}>
                    {isLoadingDonation
                      ? 'Loading...'
                      : `${currencyPrefix}${formatNumber(currentRaised)} / ${currencyPrefix}${formatNumber(goalAmount)} RAISED`}
                  </Text>
                </View>
                <View style={styles.statAtEnd}>
                  <Text style={styles.statValueSmall}>{daysLeft || 0} DAYS LEFT</Text>
                </View>
              </View>
              {!hideDonationButton && !isGoalAmountRaised && (item.UserId !== userId) && (daysLeft > 0) && item?.end_time && (
                <>
                  {console.log('=== DONATE BUTTON DEBUG ===', {
                    hideDonationButton,
                    isGoalAmountRaised,
                    itemUserId: item?.UserId,
                    currentUserId: userId,
                    daysLeft,
                    end_time: item?.end_time,
                    goalAmount,
                    currentRaised,
                    raiseAmount: item?.raiseAmount,
                  })}
                  <TouchableOpacity
                    onPress={() => {
                      setDonation(true);
                    }}
                    style={[{
                      backgroundColor: item?.profile === "user" ? '#5a2d82' : '#D3B683',
                      width: '25%',
                      left: '74%',
                      marginBottom: 5,
                      marginTop: -10,
                      paddingVertical: 8,
                      borderRadius: 8,
                      alignItems: 'center'
                    }]}
                  >
                    <Text style={styles.followButtonText}>
                      Donate
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}
      </View>
      <MissionSupportScreen
        visible={donation}
        onClose={() => setDonation(false)}
        item={item}
        onDonationSuccess={handleDonationSuccess}
      />

      <ShareModal ref={shareRef} post={selectedPostId} postId={item?.id} />
      <BuyersListModal
        visible={showBuyersModal}
        onClose={() => setShowBuyersModal(false)}
        buyers={displayBuyerList}
        profileType={modalProfileType}
        onUserPress={(id) => {
          setShowBuyersModal(false);
          handleUserProfile(id);
        }}
      />
      <BuyersListModal
        visible={showTaggedPeopleModal}
        onClose={() => setShowTaggedPeopleModal(false)}
        users={taggedUsers}
        title="Tagged people"
        enableSearch={false}
        showChevron={false}
        emptyTitle="No tagged people"
        emptyText="This post has no tagged people."
      />
      <SupportCreatorModal
        visible={modalVisible}
        creatorName={item?.username || 'Creator'}
        onClose={() => setModalVisible(false)}
        onSupport={handleOpenSupportDisclaimer}
      />
      <SupportCreatorModal
        visible={supportDisclaimerVisible}
        creatorName={item?.username || 'Creator'}
        variant="disclaimer"
        onClose={() => setSupportDisclaimerVisible(false)}
        onSupport={handleSupportNow}
        canSupport={canSupport}
      />
    </View>
  );
}

export default React.memo(PostItem);

const styles = StyleSheet.create({
  wrapper: {
    paddingBottom: 8,
    position: 'relative',
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    marginVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  userInfo: {
    flex: 1,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    fontWeight: '700',
    // color: '#1F2937',
    fontSize: 16,
    marginRight: 6,
  },
  dragonflyIcon: {
    marginTop: 1,
  },
  priceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  triangleIcon: {
    marginRight: 6,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
  },
  moreButton: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  // mediaWrapper: {
  //   position: 'relative',
  //   // width: '100%',

  //   // height: 500,
  //   backgroundColor: '#000',
  //   overflow: 'hidden',
  // },
  mediaWrapper: {
    width: '100%',
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'visible',
  },
  // mediaContainer: {
  //   width,
  //   height: 500,
  //   position: 'relative',
  // },
  mediaContainer: {
    width,
    justifyContent: "center",
    alignItems: "center",
  },
  postMedia: {
    width: width,
    // height: 500,
    // resizeMode: 'contain',
    // height: 450,
    aspectRatio: 1,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  videoOverlayTransparent: {},
  playButtonContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },
  videoIndicator: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mediaCounter: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    justifyContent: 'center'
  },
  mediaCounterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  tagButton: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 3,
  },
  actionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginRight: 20,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionCount: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 2,
  },
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    backgroundColor: '#5a2d82'
  },
  followingButtonText: {
    color: '#fff',
  },

  followingButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  buyersSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    marginTop: -10,
  },
  avatarsContainer: {
    flexDirection: 'row',
    marginRight: 8,
    overflow: 'visible',
  },
  buyerAvatarWrapper: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor: '#FFFFFF',
  },
  buyerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  buyersText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '400',
    flexShrink: 1,
  },
  buyerName: {
    fontWeight: '600',
  },
  captionSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  captionRow: {
    lineHeight: 20,
  },
  captionUsername: {
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 20,
  },
  captionText: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '400',
    lineHeight: 20,
  },
  captionMoreText: {
    color: '#999',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  captionToggleText: {
    color: '#999',
    marginTop: 2,
    fontSize: 14,
    fontWeight: '500',
  },
  progressContainer: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 3,
  },
  progressSection: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  progressBarWrapper: {
    position: 'relative',
  },
  progressStatusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DC2626',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
    width: '100%'
  },
  progressStatusBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textAlign: 'center'
  },
  progressBarBackground: {
    height: 10,
    backgroundColor: '#e0e0e0',
    overflow: 'hidden',
    marginBottom: 50,
    borderRadius: 5,
  },
  progressBarFill: {
    height: '100%',
  },
  progressStatsContainer: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    height: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  statAtStart: {
    alignItems: 'flex-start',
  },
  statAtCenter: {
    alignItems: 'center',
  },
  statAtEnd: {
    alignItems: 'flex-end',
  },
  statValueSmall: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  statLabelSmall: {
    fontSize: 10,
    fontWeight: '500',
    color: '#666',
    letterSpacing: 0.3,
  },
  hiddenPostAudio: {
    position: 'absolute',
    width: 2,
    height: 2,
    opacity: 0,
    left: 0,
    top: 0,
    zIndex: 0,
    pointerEvents: 'none',
  },
  hiddenPostYoutube: {
    position: 'absolute',
    width: 200,
    height: 200,
    opacity: 0.02,
    left: -220,
    top: 0,
    zIndex: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  speakerButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 20,
    // justifyContent: 'center',
    // alignItems: 'center',
    zIndex: 10,
  },
  linkText: {
    fontWeight: '600',
    // textDecorationLine: 'underline',
  },
  gestureModalRoot: {
    flex: 1,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: width,
    height: 500,
    resizeMode: 'contain',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});
