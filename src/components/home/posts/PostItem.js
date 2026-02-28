import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, Animated, StyleSheet, Dimensions, Linking, ActivityIndicator, Modal, TouchableWithoutFeedback, AppState } from 'react-native';
import { PanGestureHandler, PinchGestureHandler, TapGestureHandler, State } from 'react-native-gesture-handler';
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
import WalletSelectionModal from '../../modals/WalletSelectionModal';
import WalletConnectedModal from '../../modals/WalletConnectedModal';
import { getSupportRecipientWalletAddress, handleMetaMaskSupportFlow, openWalletPayment } from '../../../utils/metaMaskSupport';
import { connectWalletLogin } from '../../../pages/authentication/socialLogin';
import MissionSupportScreen from '../../modals/DonationModal';
import { getProgressBarColor } from '../../../utils/progressBarUtils';

const { width } = Dimensions.get('window');

/* ----------------------------------------- */
function InstagramZoomableImage({ uri, onZoomChange }) {
  const scale = useRef(new Animated.Value(1)).current;
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalImageLoaded, setModalImageLoaded] = useState(false);
  const imageSource = useMemo(
    () => ({
      uri,
      priority: FastImage.priority.high,           // ← helps a lot
      cache: FastImage.cacheControl.immutable,     // ← very important!
    }),
    [uri]
  );
  const AnimatedFastImage = Animated.createAnimatedComponent(FastImage);
  const [isZoomed, setIsZoomed] = useState(false);
 
 
  // useEffect(() => {
  //   if (uri) {
  //     Image.prefetch(uri).catch(err => console.warn('Prefetch failed:', err));
  //   }
  // }, [uri]);
 
  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale } }],
    { useNativeDriver: true }
  );
 
  const resetScale = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 0,
    }).start(() => {
      setIsModalVisible(false);
      setModalImageLoaded(false);
      onZoomChange?.(false);
    });
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
      setIsModalVisible(false);
      // setModalReady(false);
      onZoomChange?.(false);
      resetScale();
    }
  };
useEffect(() => {
    if (!uri) return;
 
    // 1. Normal priority preload (good enough for most cases)
    FastImage.preload([imageSource]);
 
    // 2. Optional: even more aggressive (sometimes helps on slow networks)
    setTimeout(() => FastImage.preload([{ ...imageSource, priority: FastImage.priority.highest }]), 400);
 
  }, [uri, imageSource]);
  return (
    <View style={styles.mediaContainer}>
      {/* INLINE IMAGE */}
      <PinchGestureHandler
        onGestureEvent={onPinchEvent}
        onHandlerStateChange={onPinchStateChange}
      >
        <Animated.Image
          source={imageSource}
          style={[
            styles.postMedia,
            { opacity: isModalVisible && modalImageLoaded ? 0 : 1 },
            // {opacity:1}
          ]}
        />
      </PinchGestureHandler>
 
      {/* FULLSCREEN MODAL */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="none"
        statusBarTranslucent
      // onShow={() => setModalReady(true)}
      >
        <View style={styles.modalBackground}>
          <PinchGestureHandler
            onGestureEvent={onPinchEvent}
            onHandlerStateChange={onPinchStateChange}
          >
            <AnimatedFastImage
              // key={uri}
              source={imageSource}
              resizeMode="contain"
              resizeMethod='resize'
              fadeDuration={0}
              //  onLoadEnd={() => setModalImageLoaded(true)}
              style={[
                styles.fullScreenImage,
                {
                  width: width,
                  height: 500,
                  transform: [{ scale }],
                },
              ]}
            />
          </PinchGestureHandler>
        </View>
      </Modal>
    </View>
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
  hideDonationButton = false, // Add this prop with default false

}) {
  const heartScale = useRef(new Animated.Value(1)).current;
  const listRef = useRef(null);
  const videoRefsMap = useRef({});
  const [totalFollowers, setTotalFollowers] = useState(0);
  const [userProfile, setUserProfile] = useState('');
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
  const [modalVisible, setModalVisible] = useState(false);


  // New donation states
  const [totalDonation, setTotalDonation] = useState(0);
  const [isLoadingDonation, setIsLoadingDonation] = useState(false);
  const [daysLeft, setDaysLeft] = useState(0);
  const [walletAddress, setWalletAddress] = useState('');
  const [targetWalletAddress, setTargetWalletAddress] = useState('');
  const [walletSelectionVisible, setWalletSelectionVisible] = useState(false);
  const [walletConnectedModalVisible, setWalletConnectedModalVisible] = useState(false);
  const [connectedWalletInfo, setConnectedWalletInfo] = useState({ name: '', address: '' });
  const [supportDisclaimerVisible, setSupportDisclaimerVisible] = useState(false);
  const [isKycVerified, setIsKycVerified] = useState(false);
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(false);

  const navigation = useNavigation();
  const shareRef = useRef(null);
  const dispatch = useDispatch();
  const toast = useToast();
  const { text } = useAppTheme();
  const isMountedRef = useRef(true);
  const route = useRoute();
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [dataFetched, setDataFetched] = useState(false); // To prevent redundant fetches

  if (!item || !item.id) {
    console.warn('PostItem received invalid item:', item);
    return null;
  }

  const safeMedia = item.media || [];
  const mediaLength = safeMedia.length;

  // Calculate days left from start_time and end_time
  const calculateDaysLeft = useCallback(() => {
    if (!item.start_time || !item.end_time) return 0;

    try {
      const now = new Date();
      const endDate = new Date(item.end_time);
      const diffTime = endDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    } catch (error) {
      console.error('Error calculating days left:', error);
      return 0;
    }
  }, [item.start_time, item.end_time]);
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
        console.log('getUserCredentials API response:', data);
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

  // Listen for app state changes to restore userId when returning from MetaMask
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

  const recipientWalletAddress = useMemo(
    () => getSupportRecipientWalletAddress({ ...item, walletAddress: targetWalletAddress || item?.walletAddress }),
    [item, targetWalletAddress],
  );
  const canSupport = !!recipientWalletAddress;

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
        
        // Show success modal with wallet info
        setConnectedWalletInfo({
          name: wallet.name,
          address: connectedAddress,
        });
        setWalletConnectedModalVisible(true);
        
        const connectedWalletChainId = await AsyncStorage.getItem('walletChainId');
        const walletType = await AsyncStorage.getItem('walletType') || 'metamask';
        
        // Open payment flow with the connected wallet after user acknowledges
        // This will be handled in the modal's onContinue callback
      }
    } catch (error) {
      console.error('Wallet connection error:', error);
      showToastMessage(toast, 'danger', 'Failed to connect wallet. Please try again.');
    }
  }, [toast, navigation, dispatch, setWalletAddress]);

  const handleWalletConnectedContinue = useCallback(async () => {
    setWalletConnectedModalVisible(false);
    const connectedWalletChainId = await AsyncStorage.getItem('walletChainId');
    const walletType = await AsyncStorage.getItem('walletType') || 'metamask';
    
    // Open payment flow with the connected wallet
    await openWalletPayment(recipientWalletAddress, connectedWalletChainId, walletType);
  }, [recipientWalletAddress]);

  const handleSupportNow = useCallback(async () => {
    if (!canSupport) return;
    setSupportDisclaimerVisible(false);
    await handleMetaMaskSupportFlow({
      recipientWalletAddress,
      walletAddress,
      setWalletAddress,
      toast,
      navigation,
      dispatch,
      onShowWalletSelection: () => setWalletSelectionVisible(true),
    });
  }, [canSupport, recipientWalletAddress, walletAddress, toast, navigation, dispatch]);

  const handleOpenSupportDisclaimer = useCallback(() => {
    setModalVisible(false);
    setSupportDisclaimerVisible(true);
  }, []);

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

  useEffect(() => {
    if (mediaLength <= 0) return;

    const nextStates = {};
    for (let idx = 0; idx < mediaLength; idx++) {
      const shouldPause = !(
        idx === currentIndex &&
        isVisible &&
        screenFocused &&
        String(playingPostId) === String(item.id)
      );
      nextStates[idx] = shouldPause;
    }

    setVideoStates(prev => {
      const hasChanged = Object.keys(nextStates).some(
        key => prev[key] !== nextStates[key]
      );
      return hasChanged ? nextStates : prev;
    });

    // Use requestAnimationFrame for better performance
    const rafId = requestAnimationFrame(() => {
      Object.entries(nextStates).forEach(([idx, shouldPause]) => {
        if (shouldPause) {
          safeVideoPause(parseInt(idx));
        }
      });
    });

    return () => cancelAnimationFrame(rafId);
  }, [currentIndex, isVisible, screenFocused, playingPostId, item.id, mediaLength, safeVideoPause]);

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
    // const origin = {
    //   returnTo: returnTo,
    //   returnParams: route.params?.returnParams,
    // };
    if (userId === id) {

      navigation.navigate('ProfileMain', { screen: 'Profile' });
    } else {
      navigation.navigate('HomeMain', {
        screen: 'UsersProfile',
        params: { userId: id, returnTo },

      });
      console.log(userId, 'can user id came heree')
    }
  }, [userId, navigation, returnTo]);

  const formatNumber = useCallback((n) => {
    if (typeof n !== 'number') n = Number(n) || 0;
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }, []);

  const isVideoUrl = useCallback((url) => {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase().split('?')[0];
    const exts = ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp', 'm4v'];
    return exts.some((ext) => lower.endsWith(`.${ext}`));
  }, []);

  const buyerList = useMemo(() => Array.isArray(item.boughtBy) ? item.boughtBy : Array.isArray(item.buyers) ? item.buyers : [], [item.boughtBy, item.buyers]);

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
  const goalAmount = item.raiseAmount || 0; // Target amount to raise
  const currentRaised = totalDonation || 0; // Current amount raised from API
  const progressPercent = useMemo(() => goalAmount > 0 ? (currentRaised / goalAmount) * 100 : 0, [goalAmount, currentRaised]);

  const progressBarColor = useMemo(
    () => getProgressBarColor(progressPercent, item?.profile),
    [progressPercent, item?.profile]
  );

  const onMomentumEnd = useCallback((e) => {
    const x = e?.nativeEvent?.contentOffset?.x ?? 0;
    const index = Math.round(x / width);
    if (index !== currentIndex) setCurrentIndex(index);
  }, [currentIndex]);

  const handleFollowPress = useCallback(async () => {
    if (!item?.UserId || item.UserId === userId || followingBusy) return;

    if (isBusinessProfile) {
      await handleSupportNow();
      return;
    }

    const shouldFollow = !item.follow;
    const followHandler = executeFollowAction || onToggleFollow;
    if (!followHandler) return;
    const result = await followHandler(item.UserId, shouldFollow, item.userTokenAddress);
    const success = typeof result === 'boolean' ? result : true;
    if (success && shouldFollow && canSupport) {
      setModalVisible(true);
    }
  }, [item?.UserId, item.follow, item.userTokenAddress, userId, followingBusy, executeFollowAction, onToggleFollow, isBusinessProfile, handleSupportNow, canSupport]);

  const renderMedia = useCallback(({ item: mediaItem, index }) => {
    const isVideo = mediaItem.type === 'video' || isVideoUrl(mediaItem.url);
    const isPaused = videoStates[index] ?? true;

    // Simplified shouldPlay - only check if not paused and current index
    const shouldPlay = index === currentIndex && !isPaused && !isZooming;

    return (
      <View style={styles.mediaContainer}>
        {isVideo ? (
          <View style={{ flex: 1 }}>
            <Video
              ref={(ref) => {
                if (ref) {
                  videoRefsMap.current[index] = ref;
                }
              }}
              source={{ uri: mediaItem.url }}
              style={styles.postMedia}
              resizeMode="contain"
              repeat
              paused={!shouldPlay}
              muted={isMuted}
              controls={false}
              onError={(error) => {
                console.log('Video error:', error);
              }}
              playWhenInactive={false}
              progressUpdateInterval={1000}
              bufferConfig={{
                minBufferMs: 15000,
                maxBufferMs: 50000,
                bufferForPlaybackMs: 2500,
                bufferForPlaybackAfterRebufferMs: 5000
              }}
              maxBitRate={2000000}
            />
            <TouchableOpacity
              style={[styles.videoOverlay, isPaused ? {} : styles.videoOverlayTransparent]}
              activeOpacity={1}
              onPress={() => {
                console.log('Video overlay pressed, current isPaused:', isPaused);
                setVideoStates((prev) => {
                  const newState = {
                    ...prev,
                    [index]: !prev[index]
                  };
                  console.log('New video state for index', index, ':', newState[index]);
                  return newState;
                });
              }}
            >
              {isPaused && (
                <View style={styles.playButtonContainer}>
                  <Icon name="play" size={32} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
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
  }, [currentIndex, isVideoUrl, videoStates, isZooming, isMuted]);
  
  return (
    
    <View style={styles.wrapper}>
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <TouchableOpacity onPress={() => handleUserProfile(item.UserId)} style={styles.avatarContainer}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleUserProfile(item.UserId)} style={styles.userInfo}>
            <View style={styles.userRow}>
              <Text style={styles.username}>{item.username}</Text>
              {isKycVerified && isSubscriptionActive && (
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
            removeClippedSubviews={true}
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
                  {isBusinessProfile ? "Support" : item.follow ? 'Followed' : 'Follow'}
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
            {buyerList.length > 0 && (
              <TouchableOpacity
                style={styles.buyersSection}
                activeOpacity={0.8}
                onPress={() => setShowBuyersModal(true)}
              >
                <View style={styles.avatarsContainer}>
                  {buyerList.slice(0, 3).map((buyer, idx) => (
                    <View key={idx} style={[styles.buyerAvatarWrapper, { marginLeft: idx > 0 ? -8 : 0 }]}>
                      <Image source={{ uri: buyer.avatar }} style={styles.buyerAvatar} />
                    </View>
                  ))}
                </View>
                <Text style={styles.buyersText} numberOfLines={1}>
                  Followed by <Text style={[styles.buyerName, { color: item?.profile === "user" ? '#5a2d82' : '#D3B683' }]}>{buyerList[0]?.username || '—'}</Text>
                  {buyerList.length > 1 && <Text style={{ color: item?.profile === "user" ? '#5a2d82' : '#D3B683' }}> and {formatNumber(buyerList.length - 1)} others</Text>}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <View style={styles.captionSection}>
          <Text>
            <Text style={[styles.captionUsername, { color: item?.profile === "user" ? '#5a2d82' : '#D3B683' }]}>{item.username} </Text>
            <Text style={styles.captionText}>{item.caption}</Text>
          </Text>
          {item.link ? (
            <TouchableOpacity onPress={() => Linking.openURL(item.link)}>
              <Text style={styles.linkText}>Link - {item.link}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {goalAmount > 0 && (
          <View style={styles.progressSection}>
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
                    {isLoadingDonation ? 'Loading...' : `$${(goalAmount / 1000).toFixed(0)}K RAISED`}
                  </Text>
                </View>
                <View style={styles.statAtEnd}>
                  <Text style={styles.statValueSmall}>{daysLeft || 0} DAYS LEFT</Text>
                </View>
              </View>
              { !hideDonationButton &&((totalDonation < goalAmount) && (item.UserId !== userId)) && (
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
        buyers={buyerList}
        profileType={item?.profile}
        onUserPress={(id) => {
          setShowBuyersModal(false);
          handleUserProfile(id);
        }}
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
    color: '#1F2937',
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
  mediaWrapper: {
    position: 'relative',
    width: width,
    height: 500,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  mediaContainer: {
    width,
    height: 500,
    position: 'relative',
  },
  postMedia: {
    width: '100%',
    height: 500,
    resizeMode: 'contain',
    // aspectRatio:1,
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
  },
  buyerAvatarWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
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
  captionUsername: {
    fontWeight: '700',
    fontSize: 15,
  },
  captionText: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 4,
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
  progressBarBackground: {
    height: 10,
    backgroundColor: '#e0e0e0',
    overflow: 'hidden',
    marginBottom: 50,
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
    fontSize: 13,
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
  speakerButton: {
    position: 'absolute',
    bottom: -130,
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
    textDecorationLine: 'underline',
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
