import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  useWindowDimensions,
  TouchableOpacity,
  Image,
  StatusBar,
  Share,
  Animated,
  TouchableWithoutFeedback,
  Alert,
  ScrollView,
  Keyboard,
  Platform,
} from 'react-native';
import Video from 'react-native-video';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import CommentSection from '../../components/comments/CommentSection';
import RBSheet from 'react-native-raw-bottom-sheet';
import CustomMarquee from '../../components/customMarquee/CustomMarquee';
import { getAllReels } from '../../services/reels';
import { likePost, savePost, unSavePost, follow, unfollow } from '../../services/post';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import { useDispatch } from 'react-redux';
import CommentSheet from '../../components/home/posts/CommentSheet';
import { useAppTheme } from '../../theme/useApptheme';
import HexAvatar from '../../components/home/story.js/HexAvatar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ShareModal from '../../components/modals/ShareModal';
import ReportFlowScreen from '../../components/modals/Report';
import Clipboard from '@react-native-clipboard/clipboard';
import TokenPurchaseModal from '../../components/modals/TokenPurchaseModal';
import TokenSellModal from '../../components/modals/TokenSellModal';
import SupportCreatorModal from '../../components/modals/SupportCreatorModal';
import { getUserTokenInfoByBlockChain } from '../../services/tokens';
import { getSupportRecipientWalletAddress } from '../../utils/walletPaymentSupport';
import { useWalletConnectSupport } from '../../context/WalletConnectSupportContext';
import { isSupportAllowed, normalizeProfileType } from '../../utils/supportEligibility';


const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Music Templates Data
const musicTemplates = [
  {
    id: 't1',
    name: 'Trending Dance Challenge',
    music: 'Viral Dance Mix 2025',
    uses: '2.3M',
    thumbnail: 'https://randomuser.me/api/portraits/women/10.jpg',
    category: 'Dance',
  },
  {
    id: 't2',
    name: 'Before & After Glow Up',
    music: 'Transformation Beat',
    uses: '1.8M',
    thumbnail: 'https://randomuser.me/api/portraits/men/15.jpg',
    category: 'Lifestyle',
  },
  {
    id: 't3',
    name: 'Recipe Quick Tips',
    music: 'Cooking Rhythm',
    uses: '956K',
    thumbnail: 'https://randomuser.me/api/portraits/women/20.jpg',
    category: 'Food',
  },
  {
    id: 't4',
    name: 'Workout Motivation',
    music: 'Beast Mode Activated',
    uses: '1.2M',
    thumbnail: 'https://randomuser.me/api/portraits/men/25.jpg',
    category: 'Fitness',
  },
];

const mockComments = {
  '1': [
    {
      id: 'c1',
      user: 'alex_explorer',
      avatar: 'https://randomuser.me/api/portraits/men/4.jpg',
      text: 'This place looks incredible! Where is this? 😍',
      likes: 124,
      timestamp: '2h',
      isLiked: false,
      replies: [
        {
          id: 'c1r1',
          user: 'ted_graham321',
          avatar: 'https://randomuser.me/api/portraits/men/99.jpg',
          text: 'Thanks! It\'s in the Swiss Alps! 🏔️',
          likes: 45,
          timestamp: '1h',
          isLiked: false,
        },
      ],
    },
  ],
};

export default function FlipsScreen() {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const route = useRoute();
  const toast = useToast();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reels, setReels] = useState([]);
  const [muted, setMuted] = useState({});
  const [paused, setPaused] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);

  // Dynamic interaction states - similar to Posts screen
  const [liked, setLiked] = useState({});
  const [likesCount, setLikesCount] = useState({});
  const [commentsCount, setCommentsCount] = useState({});
  const [likingIds, setLikingIds] = useState(new Set());

  // Save state
  const [saved, setSaved] = useState({});
  const [savingIds, setSavingIds] = useState(new Set());

  // Animation states
  const [heartAnimatingId, setHeartAnimatingId] = useState(null);
  const [lastTap, setLastTap] = useState(0);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // UI states
  const flatListRef = useRef();
  const videoRefs = useRef({});
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [moreOptionsVisible, setMoreOptionsVisible] = useState(false);
  const [musicTemplatesVisible, setMusicTemplatesVisible] = useState(false);
  const [commentsData, setCommentsData] = useState(mockComments);
  const [selectedReelId, setSelectedReelId] = useState(null);
  const commentSheetRef = useRef();
  const moreOptionsSheetRef = useRef();
  const notInterestedSheetRef = useRef();
  const musicTemplatesSheetRef = useRef();
  const reportSheetRef = useRef();
  const [videoProgress, setVideoProgress] = useState({});
  const [isBuffering, setIsBuffering] = useState({});

  const [commentPostId, setCommentPostId] = useState(null);
  const [commentPostOwnerId, setCommentPostOwnerId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [supportDisclaimerVisible, setSupportDisclaimerVisible] = useState(false);
  const [purchaseAutoFocus, setPurchaseAutoFocus] = useState(false);
  const [pendingFollowUserId, setPendingFollowUserId] = useState(null);
  const [pendingFollowAction, setPendingFollowAction] = useState(null);
  const [followingBusy, setFollowingBusy] = useState(new Set());
  const [tokenAddress, setTokenAddress] = useState(null);
  const [currentUserProfileType, setCurrentUserProfileType] = useState('user');
  const { bgStyle, textStyle } = useAppTheme();
  const { startSupportPayment } = useWalletConnectSupport();
  const shareRef = useRef(null);
  const purchaseSheetRef = useRef();
  const sellSheetRef = useRef();
  const viewportHeight = Math.max(1, windowHeight);
  const tabBarHeight = useBottomTabBarHeight();
  const bottomOverlayInset = Math.max(
    tabBarHeight + (Platform.OS === 'ios' ? 28 : 12),
    insets.bottom + 32,
  );
  const sideActionsBottom = bottomOverlayInset + 8;
  const bottomContentBottom = bottomOverlayInset + 20;
  const options = [
    "I don't like this post",
    "I've already seen this",
    "It's inappropriate",
    "Other",
  ];

  const handleNotInterestedSelect = (option) => {
    // Close the not-interested sheet first
    notInterestedSheetRef.current?.close?.();

    // Remove the currently selected reel from the list (simple hide action)
    if (selectedReelId) {
      setReels(prev => prev.filter(r => r.id !== selectedReelId));
      setSelectedReelId(null);
      showToastMessage(toast, 'success', 'Thanks — we\'ll show you fewer posts like this');
      Alert.alert('success', 'Thanks — we\'ll show you fewer posts like this')
    }
    // You can extend this to call an API to report preference
    console.log('Not interested reason:', option);
  };
  // Progress bar animation
  useEffect(() => {
    const currentReel = reels[currentIndex];
    if (currentReel && !paused[currentReel.id] && isFocused) {
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: currentReel.duration,
        useNativeDriver: false,
      }).start();
    }
  }, [currentIndex, isFocused, paused, progressAnim, reels]);

  useEffect(() => {
    if (!isFocused) {
      Object.values(videoRefs.current).forEach(ref => {
        if (ref && ref.seek) ref.seek(0);
      });
      progressAnim.stopAnimation();
    }
  }, [isFocused, progressAnim]);

  const fetchAllReels = useCallback(async (paramReel) => {
    try {
      dispatch(showLoader());
      const response = await getAllReels();
      if (response?.statusCode === 200) {
        console.log('response in get reels--------', response);
        // Transform API response to match app structure
        const transformedReels = response.data.map((item, index) => ({
          id: item.id,
          video: item.images?.[0] || '',
          user: item.userName || 'Unknown User',
          avatar: item.userImage || 'https://randomuser.me/api/portraits/men/1.jpg',
          caption: item.caption || item.text || 'No caption',
          music: item.music || 'Original Audio',
          likes: item.likeCount || 0,
          comments: item.commentCount || 0,
          shares: item.shareCount || 0,
          isLiked: item.isLike || false,
          isFollowing: item.isFollow || false,
          views: formatCount(Math.floor(Math.random() * 1000000) + 100000),
          duration: 30000,
          verified: false,
          likedBy: [`${item.likeCount || 0} others`],
          isRemixable: true,
          isSaved: item.isSaved || false,
          isHide: item.isHide || false,
          userId: item.userId,
          UserId: item.UserId || item.userId,
          profile: item.profile || 'user',
          walletAddress:
            item.walletAddress ||
            item.userWalletAddress ||
            item.creatorWalletAddress ||
            item.vendorWalletAddress ||
            item.receiverWalletAddress ||
            null,
          hashtag: item.hashtag || [],
          location: item.location || null,
          taggedPeople: item.taggedPeople || [],
        }));

        // If param reel exists, append API reels after it
        if (paramReel) {
          setReels(prevReels => {
            // Filter out the param reel from API data if it exists (to avoid duplicates)
            const filteredApiReels = transformedReels.filter(
              apiReel => apiReel.id !== prevReels[0]?.id
            );
            return [...prevReels, ...filteredApiReels];
          });
        } else {
          // No param reel, just set API data
          if (transformedReels.length > 0) {
            setReels(transformedReels);
          }
        }
      } else {
        showToastMessage(toast, 'danger', response?.data?.message || 'Failed to fetch reels');
      }
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.message ?? 'Something went wrong',
      );
    } finally {
      dispatch(hideLoader());
    }
  }, [dispatch, toast]);

  useEffect(() => {
    // Get reel from params if exists — support both 'uniqueKey' and 'key' as callers may use either.
    const paramReel = route.params?.item;

    if (paramReel) {
      // Transform param reel to match app structure
      const transformedParamReel = {
        id: paramReel.id || `param_${Date.now()}`,
        video: paramReel.images?.[0] || paramReel.video || '',
        user: paramReel.userName || paramReel.username || 'Unknown User',
        avatar: paramReel.userImage || paramReel.avatar || 'https://randomuser.me/api/portraits/men/1.jpg',
        caption: paramReel.caption || paramReel.text || 'No caption',
        music: paramReel.music || 'Original Audio',
        likes: paramReel.likeCount || 0,
        comments: paramReel.commentCount || 0,
        shares: paramReel.shareCount || 0,
        isLiked: paramReel.isLike || false,
        isFollowing: paramReel.isFollow || false,
        views: formatCount(Math.floor(Math.random() * 1000000) + 100000),
        duration: 30000,
        verified: false,
        likedBy: [`${paramReel.likeCount || 0} others`],
        isRemixable: true,
        isSaved: paramReel.isSaved || false,
        isHide: paramReel.isHide || false,
        userId: paramReel.userId || paramReel.UserId,
        UserId: paramReel.UserId || paramReel.userId,
        profile: paramReel.profile || 'user',
        walletAddress:
          paramReel.walletAddress ||
          paramReel.userWalletAddress ||
          paramReel.creatorWalletAddress ||
          paramReel.vendorWalletAddress ||
          paramReel.receiverWalletAddress ||
          null,
        hashtag: paramReel.hashtag || [],
        location: paramReel.location || null,
        taggedPeople: paramReel.taggedPeople || [],
      };

      // Set param reel as first item and reset index so we open the selected reel
      setReels([transformedParamReel]);
      setSelectedReelId(transformedParamReel.id);
      setCurrentIndex(0);
      // Reset paused/muted states so the new reel plays correctly
      setPaused({});
      setMuted({});
    }

    // Fetch all reels (will be appended after param reel)
    fetchAllReels(paramReel);
  }, [fetchAllReels, route.params?.item, route.params?.key, route.params?.uniqueKey]);

  const copyToClipboard = (url) => {
    if (!url) {
      showToastMessage(toast, 'danger', 'No link available to copy');
      return;
    }
    Clipboard.setString(url);
    console.log("Copied to clipboard:", url);
    showToastMessage(toast, 'success', 'Link copied to clipboard');
  };
  // Initialize likes and comments count from reels data
  useEffect(() => {
    if (Array.isArray(reels) && reels.length) {
      const seededLiked = {};
      const seededLikesCount = {};
      const seededCommentsCount = {};
      const seededSaved = {};

      for (const reel of reels) {
        if (reel?.id) {
          seededLiked[reel.id] = !!reel.isLiked;
          seededLikesCount[reel.id] = reel.likes || 0;
          seededCommentsCount[reel.id] = reel.comments || 0;
          seededSaved[reel.id] = !!reel.isSaved;
        }
      }

      setLiked(seededLiked);
      setLikesCount(seededLikesCount);
      setCommentsCount(seededCommentsCount);
      setSaved(seededSaved);
    }
  }, [reels]);

  const handleBackPress = useCallback(() => {
    // Prefer stack back to return exactly to the previous screen instance.
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    const returnTo = route.params?.returnTo;
    const returnParams = route.params?.returnParams;

    if (returnTo) {
      // Check if returnParams has nested screen navigation
      if (returnParams?.screen) {
        // Navigate to the main stack and then to the nested screen
        navigation.navigate(returnTo, returnParams);
      } else {
        // Simple navigation
        navigation.navigate(returnTo, returnParams);
      }
    } else {
      navigation.navigate('HomeMain');
    }
  }, [navigation, route.params]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
  }).current;

  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 95 });

  // Handle scroll to prevent scrolling beyond last reel
  const handleScroll = useCallback((event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const maxScroll = (reels.length - 1) * viewportHeight;

    // If trying to scroll beyond the last reel, prevent it
    if (offsetY > maxScroll + 50) { // 50px threshold
      flatListRef.current?.scrollToIndex({
        index: reels.length - 1,
        animated: false
      });
    }
  }, [reels.length, viewportHeight]);

  const handleLike = useCallback(
    async (id) => {
      if (!id) return;
      if (likingIds.has(id)) return;

      const wasLiked = !!liked[id];
      const prevCount = likesCount[id] ?? 0;

      // Optimistic update
      setLiked(prev => ({ ...prev, [id]: !wasLiked }));
      setLikesCount(prev => ({
        ...prev,
        [id]: wasLiked ? Math.max(0, prevCount - 1) : prevCount + 1,
      }));

      setLikingIds(prev => new Set(prev).add(id));

      try {
        const res = await likePost(id);
        const ok = res?.statusCode === 200 && res?.success;

        if (ok) {
          const serverLiked = !!res?.data?.liked;
          const serverCount = res?.data?.likesCount ?? res?.data?.totalLikes;

          setLiked(prev => ({ ...prev, [id]: serverLiked }));
          if (serverCount !== undefined) {
            setLikesCount(prev => ({ ...prev, [id]: serverCount }));
          }
        } else {
          // Revert on failure
          setLiked(prev => ({ ...prev, [id]: wasLiked }));
          setLikesCount(prev => ({ ...prev, [id]: prevCount }));
          showToastMessage(
            toast,
            'danger',
            res?.data?.message || 'Failed to toggle like',
          );
        }
      } catch (e) {
        // Revert on error
        setLiked(prev => ({ ...prev, [id]: wasLiked }));
        setLikesCount(prev => ({ ...prev, [id]: prevCount }));
        showToastMessage(
          toast,
          'danger',
          e?.response?.data?.message || 'Something went wrong',
        );
      } finally {
        setLikingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [liked, likesCount, likingIds, toast],
  );

  const getReelOwnerId = useCallback((reel) => reel?.userId || reel?.UserId || null, []);

  const fetchToken = useCallback(async (targetUserId) => {
    dispatch(showLoader());
    try {
      const response = await getUserTokenInfoByBlockChain(targetUserId);
      if (response?.statusCode === 200 && response?.data) {
        setTokenAddress(response.data.data?.tokenAddress || null);
      }
    } catch (err) {
      console.error('Error fetching profile token info:', err);
    } finally {
      dispatch(hideLoader());
    }
  }, [dispatch]);

  const executeFollowAction = useCallback(async (targetUserId, shouldFollow) => {
    if (!targetUserId) return false;
    const key = String(targetUserId);

    setFollowingBusy(prev => new Set(prev).add(key));
    setReels(prev =>
      prev.map(reel =>
        String(getReelOwnerId(reel)) === key
          ? { ...reel, isFollowing: shouldFollow }
          : reel,
      ),
    );

    try {
      const res = shouldFollow ? await follow(targetUserId) : await unfollow(targetUserId);
      const ok = res?.statusCode === 200 && (res?.success ?? true);

      if (!ok) {
        setReels(prev =>
          prev.map(reel =>
            String(getReelOwnerId(reel)) === key
              ? { ...reel, isFollowing: !shouldFollow }
              : reel,
          ),
        );
        showToastMessage(
          toast,
          'danger',
          res?.data?.message || res?.message || 'Unable to update follow',
        );
        return false;
      }

      const resolvedFollowing =
        typeof res?.data?.following === 'boolean' ? res.data.following : shouldFollow;

      setReels(prev =>
        prev.map(reel =>
          String(getReelOwnerId(reel)) === key
            ? { ...reel, isFollowing: resolvedFollowing }
            : reel,
        ),
      );
      return true;
    } catch (e) {
      setReels(prev =>
        prev.map(reel =>
          String(getReelOwnerId(reel)) === key
            ? { ...reel, isFollowing: !shouldFollow }
            : reel,
        ),
      );
      showToastMessage(
        toast,
        'danger',
        e?.response?.data?.message || 'Something went wrong',
      );
      return false;
    } finally {
      setFollowingBusy(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [getReelOwnerId, toast]);

  const handleToggleFollow = useCallback(async (targetUserId, shouldFollow) => {
    if (!targetUserId) return false;
    const key = String(targetUserId);
    if (followingBusy.has(key)) return false;

    setPendingFollowUserId(targetUserId);
    setPendingFollowAction(shouldFollow);

    if (shouldFollow) {
      setTimeout(() => purchaseSheetRef.current?.open?.(), 0);
      return true;
    }

    return executeFollowAction(targetUserId, false);
  }, [executeFollowAction, followingBusy]);

  const handleFollowPress = useCallback(async (item) => {
    const targetUserId = getReelOwnerId(item);
    if (!targetUserId || String(targetUserId) === String(currentUserId) || followingBusy.has(String(targetUserId))) return;

    const shouldFollow = !item.isFollowing;
    const followHandler = executeFollowAction || handleToggleFollow;
    if (!followHandler) return;

    const result = await followHandler(targetUserId, shouldFollow, item.userTokenAddress);
    const success = typeof result === 'boolean' ? result : true;
    if (!success || !shouldFollow) return;

    setModalVisible(true);
  }, [
    currentUserId,
    executeFollowAction,
    followingBusy,
    getReelOwnerId,
    handleToggleFollow,
  ]);

  const handleTokenPurchase = useCallback(async () => {
    try {
      purchaseSheetRef.current?.close?.();
      if (pendingFollowUserId != null && pendingFollowAction != null) {
        await executeFollowAction(pendingFollowUserId, pendingFollowAction);
      }
    } finally {
      setPendingFollowUserId(null);
      setPendingFollowAction(null);
      setPurchaseAutoFocus(false);
    }
  }, [executeFollowAction, pendingFollowAction, pendingFollowUserId]);

  const handleTokenSell = useCallback(async () => {
    sellSheetRef.current?.close?.();
    if (pendingFollowUserId != null) {
      await executeFollowAction(pendingFollowUserId, false);
    }
    setPendingFollowUserId(null);
    setPendingFollowAction(null);
    showToastMessage(toast, 'success', 'Tokens sold successfully!');
  }, [executeFollowAction, pendingFollowUserId, toast]);

  const handleTokenModalClose = useCallback(() => {
    purchaseSheetRef.current?.close?.();
    setPendingFollowUserId(null);
    setPendingFollowAction(null);
    setPurchaseAutoFocus(false);
  }, []);

  const currentReel = reels[currentIndex] || null;
  const recipientWalletAddress = getSupportRecipientWalletAddress(currentReel || {});
  const supporterProfile = normalizeProfileType(currentUserProfileType);
  const recipientProfile = normalizeProfileType(currentReel?.profile);

  const handleSupportNow = useCallback(async () => {
    if (!recipientWalletAddress) {
      Alert.alert('Wallet not connected', 'This user has not connected a wallet yet. Follow is still active.');
      return;
    }

    setSupportDisclaimerVisible(false);
    const receiverId = currentReel?.UserId ?? currentReel?.userId ?? '';
    await startSupportPayment(recipientWalletAddress, {
      senderId: currentUserId != null ? String(currentUserId) : '',
      receiverId: receiverId !== '' ? String(receiverId) : '',
      chain: 'POLYGON',
    });
  }, [currentReel, currentUserId, recipientWalletAddress, startSupportPayment]);

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
  }, [recipientProfile, supporterProfile]);

  const animateHeart = (id) => {
    setHeartAnimatingId(id);
    scaleAnim.setValue(0);
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.2,
        useNativeDriver: true,
        tension: 100,
        friction: 3,
      }),
      Animated.delay(400),
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setHeartAnimatingId(null));
  };

  const handleDoubleTap = (id) => {
    const now = Date.now();
    if (lastTap && now - lastTap < 300) {
      // Only like if not already liked
      if (!liked[id]) {
        handleLike(id);
      }
      animateHeart(id);
    } else {
      handlePause(id);
    }
    setLastTap(now);
  };

  const handleComment = (postId) => {
    setCommentPostId(postId);
    setSelectedReelId(postId);
    commentSheetRef.current?.open();
  };

  const handleToggleSave = useCallback(
    async (reelId) => {
      if (!reelId) return;
      if (savingIds.has(reelId)) return;

      setSavingIds(prev => new Set(prev).add(reelId));
      const isCurrentlySaved = !!saved[reelId];

      let resp;
      try {
        resp = isCurrentlySaved
          ? await unSavePost(reelId)
          : await savePost(reelId);
        if (resp && resp.statusCode === 200) {
          showToastMessage(toast, 'success', resp.data.message);
          Alert.alert(resp?.data?.message)
          setSaved(prev => ({ ...prev, [reelId]: !isCurrentlySaved }));
        } else {
          showToastMessage(toast, 'danger', resp.data.message);
        }
      } catch (err) {
        showToastMessage(
          toast,
          'danger',
          err?.response?.data?.message ?? 'Something went wrong',
        );
      } finally {
        setSavingIds(prev => {
          const next = new Set(prev);
          next.delete(reelId);
          return next;
        });
      }
    },
    [saved, savingIds, toast],
  );

  const handleCommentClose = useCallback(() => {
    commentSheetRef.current?.close();
    setCommentPostId(null);
  }, []);

  const handleCommentCountUpdate = useCallback((postId, newCount) => {
    setCommentsCount(prev => ({
      ...prev,
      [postId]: Math.max(0, newCount),
    }));
  }, []);

  useEffect(() => {
    if (!flatListRef.current) return;
    // If a param-driven selected reel exists, scroll to it once; otherwise do not auto-scroll here.
    if (selectedReelId) {
      const idx = reels.findIndex(r => r.id === selectedReelId);
      if (idx >= 0) {
        try {
          flatListRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0 });
        } catch (error) {
          // fallback after a small delay
          setTimeout(() => {
            try {
              flatListRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0 });
            } catch (e) {
              // ignore
            }
          }, 200);
        }
        setSelectedReelId(null);
      }
    }
  }, [selectedReelId, reels]);

  const handlePause = (id) => {
    setPaused(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleShare = async (item) => {
    try {
      const result = await Share.share({
        message: `Check out this amazing reel by @${item.user}!\n\n"${item.caption}"\n\nShared via Instagram Reels`,
        title: `Reel by @${item.user}`,
      });

      if (result.action === Share.sharedAction) {
        setReels(prev =>
          prev.map(reel =>
            reel.id === item.id
              ? { ...reel, shares: reel.shares + 1 }
              : reel,
          ),
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to share reel');
    }
  };

  const handleMoreOptions = (item) => {
    setSelectedReelId(item.id);
    moreOptionsSheetRef.current?.open();
  };

  const handleRemix = (item) => {
    Alert.alert('Try Remix', `Creating remix with "${item.music}"`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Use Template', onPress: () => setMusicTemplatesVisible(true) },
    ]);
  };

  const formatCount = (count) => {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    } else if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  };

  const renderMusicTemplate = ({ item }) => (
    <TouchableOpacity style={styles.templateItem}>
      <View style={styles.templateThumbnail}>
        <Image source={{ uri: item.thumbnail }} style={styles.templateImage} />
        <View style={styles.templatePlay}>
          <Icon name="play" size={20} color="#fff" />
        </View>
      </View>
      <View style={styles.templateInfo}>
        <Text style={styles.templateName}>{item.name}</Text>
        <Text style={styles.templateMusic}>♪ {item.music}</Text>
        <Text style={styles.templateUses}>{item.uses} uses</Text>
      </View>
      <TouchableOpacity style={styles.useTemplateBtn}>
        <Text style={styles.useTemplateBtnText}>Use</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  useEffect(() => {
    let isMounted = true;
    const loadCurrentUserId = async () => {
      try {
        const id = await AsyncStorage.getItem('userId');
        if (isMounted) setCurrentUserId(id);
      } catch (e) {
        if (isMounted) setCurrentUserId(null);
      }
    };

    const loadCurrentUserProfile = async () => {
      try {
        const profile = await AsyncStorage.getItem('profile');
        if (isMounted) setCurrentUserProfileType(normalizeProfileType(profile || 'user'));
      } catch (e) {
        if (isMounted) setCurrentUserProfileType('user');
      }
    };

    loadCurrentUserId();
    loadCurrentUserProfile();
    return () => {
      isMounted = false;
    };
  }, [isFocused]);

  const renderItem = ({ item, index }) => {
    const isOwnReel =
      currentUserId != null &&
      item?.userId != null &&
      String(currentUserId) === String(item.userId);
      

    return (
      <View style={[styles.reelContainer, { width: windowWidth, height: viewportHeight }]}>
        <StatusBar barStyle="light-content" backgroundColor="#020202ff" />

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        <TouchableOpacity
          activeOpacity={1}
          onPress={() => handleDoubleTap(item.id)}
          style={styles.videoContainer}
        >
          <Video
            ref={ref => {
              videoRefs.current[item.id] = ref;
            }}
            source={{ uri: item.video }}
            style={styles.video}
            resizeMode="cover"
            repeat
            paused={!isFocused || currentIndex !== index || paused[item.id] === true}
            muted={muted[item.id] === true}
          />

          {/* Loading indicator */}
          {isBuffering[item.id] && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          )}

          {/* Play/Pause overlay */}
          {paused[item.id] === true && (
            <View style={styles.playPauseOverlay}>
              <Icon name="play" size={80} color="rgba(255,255,255,0.8)" />
            </View>
          )}

          {/* Double tap heart animation */}
          {heartAnimatingId === item.id && (
            <Animated.View
              style={[
                styles.heartAnimation,
                {
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              <Icon name="heart" size={100} color="#ff3040" />
            </Animated.View>
          )}
        </TouchableOpacity>

        {/* Side actions */}
        <View style={styles.horizontalActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleLike(item.id)}
          >
            <Icon
              name={liked[item.id] ? 'heart' : 'heart-outline'}
              size={22}
              color={liked[item.id] ? '#ff3040' : '#fff'}
            />
            <Text style={styles.actionLabel}>{formatCount(likesCount[item.id] || 0)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleComment(item.id)}
          >
            <Icon name="chatbubble-outline" size={20} color="#fff" />
            <Text style={styles.actionLabel}>{formatCount(commentsCount[item.id] || 0)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            // onPress={() => handleShare(item)}
            onPress={() => shareRef.current?.open?.()}
          >
            <Icon name="paper-plane-outline" size={20} color="#fff" />
            <Text style={styles.actionLabel}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleMoreOptions(item)}
          >
            <Icon name="ellipsis-vertical" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={[styles.sideActions, { bottom: sideActionsBottom }]}>


          {/* Music disc */}
          <TouchableOpacity style={styles.musicDisc}>
            <View style={styles.discContainer}>
              <Image source={{ uri: item.avatar }} style={styles.discImage} />
            </View>
            <View style={styles.musicIconWrapper}>
              <Feather name="music" size={15} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Bottom content */}
        <View style={[styles.bottomContent, { bottom: bottomContentBottom }]}>
          {/* Try Remix button */}
          {/* {item.isRemixable && (
          <TouchableOpacity
            style={styles.remixButton}
            onPress={() => handleRemix(item)}
          >
            <MaterialIcons name="auto-awesome" size={16} color="#fff" />
            <Text style={styles.remixText}>Try Remix</Text>
          </TouchableOpacity>
        )} */}

          {/* User info */}
          <View style={styles.userInfo}>
            <TouchableOpacity style={styles.userRow} onPress={handleUserNavigate}>
              <Image source={{ uri: item.avatar }} style={styles.userAvatar} />
              <Text style={styles.username}>
                {item.user}
                {item.verified && (
                  <Icon name="checkmark-circle" size={15} color="#1DA1F2" style={styles.verifiedIcon} />
                )}
                <View style={{ flexDirection: 'row', gap: 3 }}>
                  <Feather name="music" size={12} color="#fff" style={styles.musicIcon} />
                  <CustomMarquee
                    speed={3}
                    loop={true}
                    delay={1000}
                    style={{ width: 100, maxWidth: 300 }}
                    textStyle={{ fontSize: 13, color: 'white' }}
                  >
                    {item.music}
                  </CustomMarquee>

                </View>
              </Text>
              {!isOwnReel && (
                <TouchableOpacity
                  style={styles.followButton}
                  onPress={() => handleFollowPress(item)}
                  disabled={followingBusy.has(String(getReelOwnerId(item)))}
                >
                  <Text style={styles.followButtonText}>
                    {!item.isFollowing ? 'Follow' : 'Following'}
                  </Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.caption} numberOfLines={2}>
            {item.caption}
          </Text>

          {/* Liked by section */}
          <TouchableOpacity style={styles.likedBySection}>
            <Text style={styles.likedByText}>
              ❤️ Liked by{' '}
              <Text style={styles.likedByBold}>
                {(() => {
                  const likeCount = Number(item.likes ?? item.likeCount ?? 0);

                  if (likeCount === 0) return 'no one yet';
                  if (likeCount === 1) return '1 person';
                  return `${likeCount} others`;
                })()}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bottom navigation placeholder */}
        {/* <View style={styles.bottomNavPlaceholder}>
        <View style={styles.navIcon}>
          <Icon name="home" size={24} color="#fff" />
        </View>
        <View style={styles.navIcon}>
          <Icon name="search" size={24} color="#fff" />
        </View>
        <View style={styles.navIcon}>
          <Icon name="add-circle-outline" size={24} color="#fff" />
        </View>
        <View style={styles.navIcon}>
          <MaterialIcons name="movie" size={24} color="#fff" />
        </View>
        <View style={styles.navIcon}>
          <Icon name="person-circle-outline" size={24} color="#fff" />
        </View>
      </View> */}
      </View>
    );
  };

  const handleUserNavigate = async () => {
    const userId = currentUserId ?? (await AsyncStorage.getItem('userId'));
    const currentReel = reels[currentIndex];
    const targetUserId = currentReel?.userId || route.params?.item?.userId || route.params?.item?.UserId;

    if (!targetUserId) return;

    if (String(userId) === String(targetUserId)) {
      navigation.navigate('ProfileMain', { screen: 'Profile' });
    } else {
      navigation.navigate('HomeMain', {
        screen: 'UsersProfile',
        params: { userId: targetUserId }
      });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={handleBackPress}
          style={styles.buttons}
        >
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerLeft}
          onPress={() => setDropdownVisible(v => !v)}
        >
          <Text style={styles.logo}>Flips</Text>
          <Icon name="chevron-down" size={18} color="#fff" style={styles.chevronIcon} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerIconButton}>
          <Feather name="camera" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      <FlatList
        ref={flatListRef}
        data={reels}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate={0.98}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        onMomentumScrollEnd={(e) => {
          const offsetY = e.nativeEvent.contentOffset.y || 0;
          const idx = Math.round(offsetY / viewportHeight);
          const maxIndex = reels.length - 1;

          // Ensure we don't go beyond the last reel
          const validIdx = Math.min(idx, maxIndex);

          if (validIdx !== currentIndex) {
            setCurrentIndex(validIdx);
          }

          // If scrolled beyond last reel, snap back
          if (idx > maxIndex) {
            flatListRef.current?.scrollToIndex({
              index: maxIndex,
              animated: true
            });
          }
        }}
        viewabilityConfig={viewConfigRef.current}
        snapToAlignment="start"
        snapToInterval={viewportHeight}
        maxToRenderPerBatch={1}
        getItemLayout={(_, index) => ({
          length: viewportHeight,
          offset: viewportHeight * index,
          index,
        })}
        overScrollMode='never'
        bounces={false}
        scrollEnabled={reels.length > 0}
        removeClippedSubviews={true}
        extraData={viewportHeight}
      />

      {/* Dropdown Menu */}
      {dropdownVisible && (
        <View style={styles.dropdownOverlay}>
          <TouchableWithoutFeedback onPress={() => setDropdownVisible(false)}>
            <View style={styles.dropdownBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.dropdown}>
            <View style={styles.arrowUp} />
            <TouchableOpacity style={styles.dropdownOption}>
              <Icon name="people-outline" size={22} color="#000" />
              <Text style={styles.dropdownText}>Following</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownOption}>
              <Icon name="location-outline" size={22} color="#000" />
              <Text style={styles.dropdownText}>Nearby</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Comments Bottom Sheet */}
      <RBSheet
        ref={commentSheetRef}
        height={500}
        openDuration={250}
        draggable={true}
        closeOnPressMask={true}
        customModalProps={{ statusBarTranslucent: true }}
        onClose={() => { Keyboard.dismiss(); setCommentPostId(null); }}
        customStyles={{
          container: [{
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            bottom: -20,
          }, bgStyle],
          draggableIcon: {
            backgroundColor: '#ccc',
            width: 60,
          },
        }}
      >
        <CommentSheet
          postId={commentPostId}
          onClose={handleCommentClose}
          onCommentCountUpdate={handleCommentCountUpdate}
          postOwnerId={commentPostOwnerId}
        />
      </RBSheet>

      {/* More Options Bottom Sheet */}
      <RBSheet
        ref={moreOptionsSheetRef}
        height={350}
        openDuration={250}
        customStyles={{
          container: {
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            backgroundColor: '#fff',
          },
        }}
        closeOnDragDown={true}
        closeOnPressMask={true}
      >
        <View style={styles.moreOptionsContainer}>
          <View style={styles.moreOptionsHeader}>
            <Text style={styles.moreOptionsTitle}>More Options</Text>
          </View>
          <ScrollView style={styles.moreOptionsList}>
            {/* <TouchableOpacity
              style={styles.moreOption}
              onPress={() => {
                moreOptionsSheetRef.current?.close();
                musicTemplatesSheetRef.current?.open();
              }}
            >
              <MaterialIcons name="library-music" size={24} color="#000" />
              <Text style={styles.moreOptionText}>Music Templates</Text>
              <Icon name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity> */}
            <TouchableOpacity
              style={styles.moreOption}
              onPress={() => {
                const reelId = selectedReelId || reels[currentIndex]?.id;
                handleToggleSave(reelId);
                moreOptionsSheetRef.current?.close();
              }}
            >
              <Icon
                name={saved[selectedReelId || reels[currentIndex]?.id] ? 'bookmark' : 'bookmark-outline'}
                size={24}
                color="#000"
              />
              <Text style={styles.moreOptionText}>{saved[selectedReelId || reels[currentIndex]?.id] ? 'Saved' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.moreOption}
              onPress={() => {
                moreOptionsSheetRef.current?.close();
                setTimeout(() => reportSheetRef.current?.open(), 200);
              }}
            >
              <Icon name="flag-outline" size={24} color="#000" />
              <Text style={styles.moreOptionText}>Report</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.moreOption}
              onPress={() => {
                moreOptionsSheetRef.current?.close();
                // ensure selectedReelId is kept and open the not-interested sheet
                setTimeout(() => notInterestedSheetRef.current?.open?.(), 220);
              }}
            >
              <Icon name="eye-off-outline" size={24} color="#000" />
              <Text style={styles.moreOptionText}>Not Interested</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.moreOption}
              onPress={() => {
                const reel = reels.find(r => r.id === selectedReelId) || reels[currentIndex];
                const url = reel?.video || reel?.images?.[0] || reel?.image || '';
                copyToClipboard(url);
                moreOptionsSheetRef.current?.close();
              }}
            >
              <Icon name="copy-outline" size={24} color="#000" />
              <Text style={styles.moreOptionText}>Copy Link</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </RBSheet>

      {/* Music Templates Bottom Sheet */}
      <RBSheet
        ref={musicTemplatesSheetRef}
        height={SCREEN_HEIGHT * 0.8}
        openDuration={250}
        customStyles={{
          container: {
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            backgroundColor: '#fff',
          },
        }}
        closeOnDragDown={true}
        closeOnPressMask={true}
      >
        <View style={styles.templatesContainer}>
          <View style={styles.templatesHeader}>
            <TouchableOpacity onPress={() => musicTemplatesSheetRef.current?.close()}>
              <Icon name="close" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.templatesTitle}>Music Templates</Text>
            <View style={{ width: 24 }} />
          </View>
          <FlatList
            data={musicTemplates}
            keyExtractor={item => item.id}
            renderItem={renderMusicTemplate}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.templatesList}
          />
        </View>
      </RBSheet>
      {/* Not Interested Bottom Sheet */}
      <RBSheet
        ref={notInterestedSheetRef}
        height={360}
        openDuration={200}
        closeOnDragDown={true}
        closeOnPressMask={true}
        customStyles={{ container: styles.sheetContainer, overlay: { backgroundColor: 'rgba(0,0,0,0.4)' } }}
      >
        <View style={styles.dragHandle} />

        <View style={styles.headerContainer}>
          <View style={styles.headerIcon}>
            <Icon name="eye-off" size={22} color="#5a2d82" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetTitle}>Not Interested</Text>
            <Text style={styles.sheetSubtitle}>Tell us why you don't want to see this</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          {options.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={styles.reasonItem}
              onPress={() => handleNotInterestedSelect(option)}
            >
              <View style={styles.reasonIconWrapper}>
                <Icon name="eye-off" size={18} color="#5a2d82" />
              </View>
              <Text style={styles.reasonText}>{option}</Text>
              <Icon name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </RBSheet>

      {/* <RBSheet
        ref={purchaseSheetRef}
        height={500}
        openDuration={250}
        draggable={true}
        closeOnPressMask={true}
        customModalProps={{ statusBarTranslucent: true }}
        onOpen={() => setPurchaseAutoFocus(true)}
        onClose={() => {
          Keyboard.dismiss();
          setPurchaseAutoFocus(false);
          setPendingFollowUserId(null);
          setPendingFollowAction(null);
        }}
        customStyles={{
          container: [{
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            bottom: -30,
          }, bgStyle],
          draggableIcon: {
            backgroundColor: '#ccc',
            width: 60,
          },
        }}
      >
        <TokenPurchaseModal
          onClose={handleTokenModalClose}
          onPurchase={handleTokenPurchase}
          hasFollowing={true}
          autoFocus={purchaseAutoFocus}
          vendorid={pendingFollowUserId}
        />
      </RBSheet> */}
{/* 
      <RBSheet
        ref={sellSheetRef}
        height={550}
        openDuration={250}
        draggable={true}
        closeOnPressMask={true}
        customModalProps={{ statusBarTranslucent: true }}
        onOpen={() => setPurchaseAutoFocus(true)}
        onClose={() => {
          Keyboard.dismiss();
          setPurchaseAutoFocus(false);
          setPendingFollowUserId(null);
          setPendingFollowAction(null);
        }}
        customStyles={{
          container: [{
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            bottom: -30,
          }, bgStyle],
          draggableIcon: {
            backgroundColor: '#ccc',
            width: 60,
          },
        }}
      >
        <TokenSellModal
          onSell={handleTokenSell}
          userId={pendingFollowUserId}
          tokenAddress={tokenAddress}
        />
      </RBSheet> */}

      <ShareModal ref={shareRef} reel={reels[currentIndex]} reelId={reels[currentIndex]?.id} />
      <ReportFlowScreen ref={reportSheetRef} postId={selectedReelId || reels[currentIndex]?.id} />
      <SupportCreatorModal
        visible={modalVisible}
        creatorName={currentReel?.user || 'Creator'}
        onClose={() => setModalVisible(false)}
        onSupport={handleOpenSupportDisclaimer}
      />
      <SupportCreatorModal
        visible={supportDisclaimerVisible}
        creatorName={currentReel?.user || 'Creator'}
        variant="disclaimer"
        onClose={() => setSupportDisclaimerVisible(false)}
        onSupport={handleSupportNow}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    // marginBottom:'10%'
  },
  reelContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    position: 'relative',
  },
  progressContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    zIndex: 10,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
  },
  videoContainer: {
    flex: 1,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -30 }, { translateY: -10 }],
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
  playPauseOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -40 }, { translateY: -40 }],
  },
  heartAnimation: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  chevronIcon: {
    marginLeft: 8,
  },
  headerIconButton: {
    padding: 8,
  },
  buttons: {
    padding: 8,
  },
  sideActions: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
  },
  horizontalActions: {
    position: 'absolute',
    bottom: 200, // adjust based on your UI
    left: 16,
    right: 80, // keep space for right-side music icon
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal:10,
    gap:30,

  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  musicDisc: {
    marginTop: 10,
    marginBottom: '10%'
  },
  discContainer: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  discImage: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  bottomContent: {
    position: 'absolute',
    left: 0,
    right: 80,
    padding: 16,
  },
  remixButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  remixText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  userInfo: {
    marginBottom: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  username: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    flex: 1,
  },
  verifiedIcon: {
    marginLeft: 6,
  },
  followButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  followButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  caption: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 8,
  },
  likedBySection: {
    marginBottom: 4,
  },
  likedByText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  likedByBold: {
    fontWeight: 'bold',
    color: '#fff',
  },
  bottomNavPlaceholder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(0,0,0,0.8)',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 10,
  },
  navIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },

  // Dropdown Menu Styles
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dropdown: {
    position: 'absolute',
    top: 80,
    left: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 160,
    maxWidth: 200,
  },
  arrowUp: {
    position: 'absolute',
    top: -8,
    left: 30,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#fff',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
  },
  dropdownText: {
    fontSize: 16,
    color: '#000',
    marginLeft: 12,
    fontWeight: '500',
    fontFamily: 'System',
  },

  // More Options Bottom Sheet Styles
  moreOptionsContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  moreOptionsHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 16,
    alignItems: 'center',
    position: 'relative',
  },
  moreOptionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: 'System',
  },
  moreOptionsList: {
    flex: 1,
    paddingTop: 8,
  },
  moreOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
    minHeight: 60,
  },
  moreOptionText: {
    fontSize: 16,
    color: '#000',
    marginLeft: 16,
    flex: 1,
    fontFamily: 'System',
    fontWeight: '400',
  },

  // Music Templates Bottom Sheet Styles
  templatesContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  templatesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    height: 60,
  },
  templatesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: 'System',
  },
  templatesList: {
    paddingVertical: 10,
    paddingBottom: 30,
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
    minHeight: 80,
  },
  templateThumbnail: {
    position: 'relative',
    marginRight: 16,
  },
  templateImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  templatePlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -15 }, { translateY: -15 }],
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateInfo: {
    flex: 1,
    marginRight: 16,
    justifyContent: 'center',
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
    fontFamily: 'System',
  },
  templateMusic: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
    fontFamily: 'System',
  },
  templateUses: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'System',
  },
  useTemplateBtn: {
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  useTemplateBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'System',
  },

  // Additional Animation Styles
  slideUpAnimation: {
    transform: [{ translateY: 0 }],
  },
  slideDownAnimation: {
    transform: [{ translateY: 100 }],
  },

  // Loading States
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingSpinner: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },

  // Enhanced Interactive Elements
  touchableHighlight: {
    borderRadius: 8,
  },
  pressedState: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },

  // Accessibility Improvements
  accessibilityButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Responsive Design Adjustments
  smallScreen: {
    fontSize: 14,
    padding: 8,
  },
  largeScreen: {
    fontSize: 18,
    padding: 16,
  },

  // Shadow and Elevation Effects
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  lightShadow: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },

  // Gradient Effects (if using LinearGradient)
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },

  // Status Bar Styles
  statusBarSafe: {
    backgroundColor: '#000',
    paddingTop: StatusBar.currentHeight || 0,
  },

  // Error States
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  retryButton: {
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  musicIconWrapper: {
    position: 'absolute',
    top: 7,
    left: 5,
  },
  musicIcon: {
    marginTop: 4
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#DDD',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(90,45,130,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 2,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: '#999',
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  reasonIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(90,45,130,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reasonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  optionItem: {
    // kept for compatibility if referenced elsewhere
  },
  optionText: {
    // kept for compatibility
  }
});
