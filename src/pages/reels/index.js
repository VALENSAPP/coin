import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  useWindowDimensions,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StatusBar,
  Share,
  Animated,
  TouchableWithoutFeedback,
  Alert,
  ScrollView,
  Keyboard,
  Platform,
} from 'react-native';
import { FlatList as GestureFlatList } from 'react-native-gesture-handler';
import Video from 'react-native-video';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  useIsFocused,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';
import CommentSection from '../../components/comments/CommentSection';
import RBSheet from 'react-native-raw-bottom-sheet';
import CustomMarquee from '../../components/customMarquee/CustomMarquee';
import { getAllReels } from '../../services/reels';
import {
  likePost,
  savePost,
  unSavePost,
  follow,
  unfollow,
  deletePost,
} from '../../services/post';
import {
  hideLoader,
  showLoader,
} from '../../redux/actions/LoaderAction';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import { useDispatch } from 'react-redux';
import CommentSheet from '../../components/home/posts/CommentSheet';
import { useAppTheme } from '../../theme/useApptheme';
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
import {
  isSupportAllowed,
  normalizeProfileType,
} from '../../utils/supportEligibility';
import { Comments, ShareIcom, Thumbup } from '../../assets/icons';

import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
} from 'react-native-reanimated';
import HexAvatar from '../../components/home/story.js/HexAvatar';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_REEL_PINCH = 3.5;
const REEL_ZOOM_SPRING = {
  damping: 20,
  stiffness: 260,
  mass: 0.4,
  overshootClamping: true,
};
const FLIPS_PROGRESS_H_PADDING = 0;
const FLIPS_PROGRESS_TOP_GAP = 20;
const FLIPS_PROGRESS_STRIP_HEIGHT = 28;
const FLIPS_HEADER_AFTER_PROGRESS = 8;
const SPEED_STEPS = [0.5, 1, 1.5, 2];

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
          text: "Thanks! It's in the Swiss Alps! 🏔️",
          likes: 45,
          timestamp: '1h',
          isLiked: false,
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ReelPinchVideoBlock — properly memoized with correct syntax
// ─────────────────────────────────────────────────────────────────────────────
const ReelPinchVideoBlock = React.memo(
  function ReelPinchVideoBlock({
    item,
    isCurrent,
    isScreenFocused,
    playbackRate,
    paused,
    muted,
    isBuffering,
    onPinchLockChange,
    onVideoLoad,
    onVideoProgress,
    registerVideoRef,
    handleDoubleTapLeft,
    handleSingleTapToggle,
    heartAnimatingId,
    scaleAnim,
    thumbnailUri,
  }) {
    const [videoReady, setVideoReady] = useState(false);

    useEffect(() => {
      console.log('[Reels] thumbnailUri', {
        // itemId: item?.id,
        thumbnailUri,
      });
    }, [item?.id, thumbnailUri]);

    const pinchScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const gestureStartScale = useSharedValue(1);
    const panStartX = useSharedValue(0);
    const panStartY = useSharedValue(0);
    const zoomEndHandled = useSharedValue(0);

    useEffect(() => {
      if (!isCurrent) {
        pinchScale.value = 1;
        translateX.value = 0;
        translateY.value = 0;
        setVideoReady(false);
      }
    }, [isCurrent, pinchScale, translateX, translateY]);

    const transformStyle = useAnimatedStyle(() => ({
      transform: [
        { scale: pinchScale.value },
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    }));

    const onLockScroll = useCallback(() => {
      onPinchLockChange?.(true);
    }, [onPinchLockChange]);

    const onUnlockScroll = useCallback(() => {
      onPinchLockChange?.(false);
    }, [onPinchLockChange]);

    const composedGesture = useMemo(() => {
      const itemId = item.id;

      const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .maxDuration(280)
        .maxDistance(20)
        .onEnd(() => {
          runOnJS(handleDoubleTapLeft)(itemId);
        });

      const singleTap = Gesture.Tap()
        .numberOfTaps(1)
        .maxDuration(450)
        .maxDistance(22)
        .requireExternalGestureToFail(doubleTap)
        .onEnd(() => {
          runOnJS(handleSingleTapToggle)(itemId);
        });

      const onZoomGestureComplete = () => {
        'worklet';
        if (zoomEndHandled.value === 1) return;
        zoomEndHandled.value = 1;
        pinchScale.value = withSpring(1, REEL_ZOOM_SPRING);
        translateX.value = withSpring(0, REEL_ZOOM_SPRING);
        translateY.value = withSpring(0, REEL_ZOOM_SPRING);
        runOnJS(onUnlockScroll)();
      };

      const pinch = Gesture.Pinch()
        .onBegin(() => {
          zoomEndHandled.value = 0;
          gestureStartScale.value = Math.max(1, pinchScale.value);
          runOnJS(onLockScroll)();
        })
        .onUpdate(e => {
          const next = Math.min(
            Math.max(gestureStartScale.value * e.scale, 1),
            MAX_REEL_PINCH,
          );
          pinchScale.value = next;
        })
        .onEnd(() => {
          onZoomGestureComplete();
        });

      const pan2WithEnd = Gesture.Pan()
        .minPointers(2)
        .maxPointers(2)
        .enabled(true)
        .onBegin(() => {
          panStartX.value = translateX.value;
          panStartY.value = translateY.value;
        })
        .onUpdate(e => {
          const s = Math.max(1, pinchScale.value);
          const maxP = 180 * Math.sqrt(Math.min(s, MAX_REEL_PINCH));
          const nx0 = panStartX.value + e.translationX;
          const ny0 = panStartY.value + e.translationY;
          const nx = Math.max(-maxP, Math.min(maxP, nx0));
          const ny = Math.max(-maxP, Math.min(maxP, ny0));
          if (s <= 1.01) {
            translateX.value = 0;
            translateY.value = 0;
          } else {
            translateX.value = nx;
            translateY.value = ny;
          }
        })
        .onEnd(() => {
          onZoomGestureComplete();
        });

      const zoomAndPan = Gesture.Simultaneous(pinch, pan2WithEnd);
      return Gesture.Exclusive(
        zoomAndPan,
        Gesture.Exclusive(doubleTap, singleTap),
      );
    }, [
      item.id,
      handleDoubleTapLeft,
      handleSingleTapToggle,
      onLockScroll,
      onUnlockScroll,
    ]);

    const showThumbnailOverlay = !videoReady && !!thumbnailUri;
    const showLoaderOverlay = showThumbnailOverlay || isBuffering;
    const showPlayOverlay = paused === true && !showLoaderOverlay && videoReady;

    return (
      <View style={{ flex: 1, width: '100%' }} collapsable={false}>
        <GestureDetector gesture={composedGesture}>
          <Reanimated.View
            style={[
              styles.videoContainer,
              { overflow: 'visible' },
              transformStyle,
            ]}
            collapsable={false}>
            {/* Only mount native Video for the visible reel — paused neighbors still
                hold ExoPlayer/MediaCodec decoders and commonly OOM-crash on Android. */}
            {isCurrent ? (
              <>
                <Video
                  ref={registerVideoRef}
                  source={{ uri: item.video }}
                  style={styles.video}
                  resizeMode="cover"
                  repeat
                  rate={playbackRate ?? 1}
                  paused={!isScreenFocused || paused === true}
                  muted={!!muted}
                  onLoad={onVideoLoad}
                  onProgress={onVideoProgress}
                  progressUpdateInterval={500}
                  playWhenInactive={false}
                  ignoreSilentSwitch="obey"
                  onReadyForDisplay={() => setVideoReady(true)}   // ← fires once decoder is ready
                />

                {/* Thumbnail overlay — shown until video is ready to display */}
                {showThumbnailOverlay && (
                  <>
                    <Image
                      source={{ uri: thumbnailUri }}
                      style={[
                        styles.video,
                        {
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          resizeMode: 'cover',
                          zIndex: 10,
                        },
                      ]}
                      blurRadius={0}
                    />
                  </>
                )}
              </>
            ) : (
              /* Non-current slots: render thumbnail as a lightweight static placeholder
                 so the list looks populated without loading any video decoder */
              !!thumbnailUri ? (
                <Image
                  source={{ uri: thumbnailUri }}
                  style={[styles.video, { resizeMode: 'cover' }]}
                />
              ) : (
                <View
                  style={[styles.video, styles.videoPlaceholder]}
                  pointerEvents="none"
                />
              )
            )}

            {showLoaderOverlay && (
              <View style={styles.loadingContainer} pointerEvents="none">
                <ActivityIndicator size="large" color="#fff" />
              </View>
            )}

            {showPlayOverlay && (
              <View style={styles.playPauseOverlay} pointerEvents="none">
                <Icon name="play" size={80} color="rgba(255,255,255,0.8)" />
              </View>
            )}

            {heartAnimatingId === item.id && (
              <Animated.View
                style={[
                  styles.heartAnimation,
                  { transform: [{ scale: scaleAnim }] },
                ]}
                pointerEvents="none">
                <Icon name="heart" size={100} color="#ff3040" />
              </Animated.View>
            )}
          </Reanimated.View>
        </GestureDetector>
      </View>
    );
  },
  // Custom comparator — only re-render when props that affect output change
  (prev, next) => {
    return (
      prev.isCurrent === next.isCurrent &&
      prev.isScreenFocused === next.isScreenFocused &&
      prev.playbackRate === next.playbackRate &&
      prev.paused === next.paused &&
      prev.muted === next.muted &&
      prev.isBuffering === next.isBuffering &&
      prev.heartAnimatingId === next.heartAnimatingId &&
      prev.item.id === next.item.id &&
      prev.thumbnailUri === next.thumbnailUri &&
      prev.item.video === next.item.video &&
      prev.onVideoLoad === next.onVideoLoad &&
      prev.onVideoProgress === next.onVideoProgress &&
      prev.registerVideoRef === next.registerVideoRef &&
      prev.handleDoubleTapLeft === next.handleDoubleTapLeft &&
      prev.handleSingleTapToggle === next.handleSingleTapToggle &&
      prev.onPinchLockChange === next.onPinchLockChange
    );
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// ReelItem — extracted component so renderItem can use hooks per-item
// Memoized with a comparator that checks the specific slice of state it uses
// ─────────────────────────────────────────────────────────────────────────────
const ReelItem = React.memo(
  function ReelItem({
    item,
    index,
    currentIndex,
    windowWidth,
    viewportHeight,
    isFocused,
    playbackRateMap,
    pausedMap,
    mutedMap,
    isBufferingMap,
    likedMap,
    likesCountMap,
    commentsCountMap,
    savedMap,
    heartAnimatingId,
    scaleAnim,
    followingBusy,
    currentUserId,
    sideActionsBottom,
    bottomContentBottom,
    horizontalActionsBottom,
    // stable callbacks
    onPinchLockChange,
    handleVideoLoad,
    handleVideoProgress,
    registerVideoRef,
    stableDoubleTap,
    stableSingleTap,
    handleLike,
    handleComment,
    openShareSheet,
    handleMoreOptions,
    handleFollowPress,
    handleUserNavigate,
    togglePlaybackSpeed,
    getReelOwnerId,
    formatCount,
    text: textColor,
  }) {
    const isCurrent = currentIndex === index;
    const isOwnReel =
      currentUserId != null &&
      item?.userId != null &&
      String(currentUserId) === String(item.userId);

    // Stable per-item callbacks bound to item.id
    const onVideoLoad = useCallback(
      data => handleVideoLoad(item.id, data),
      [item.id, handleVideoLoad],
    );
    const onVideoProgress = useCallback(
      data => handleVideoProgress(item.id, data),
      [item.id, handleVideoProgress],
    );
    const onRegisterRef = useCallback(
      ref => registerVideoRef(item.id, ref),
      [item.id, registerVideoRef],
    );

    return (
      <View
        style={[
          styles.reelContainer,
          { width: windowWidth, height: viewportHeight },
        ]}>
        <ReelPinchVideoBlock
          item={item}
          isCurrent={isCurrent}
          isScreenFocused={isFocused}
          playbackRate={playbackRateMap[item.id] ?? 1}
          paused={pausedMap[item.id] === true}
          muted={mutedMap[item.id] === true}
          isBuffering={!!isBufferingMap[item.id]}
          onPinchLockChange={onPinchLockChange}
          onVideoLoad={onVideoLoad}
          onVideoProgress={onVideoProgress}
          registerVideoRef={onRegisterRef}
          handleDoubleTapLeft={stableDoubleTap}
          handleSingleTapToggle={stableSingleTap}
          heartAnimatingId={heartAnimatingId}
          scaleAnim={scaleAnim}
          thumbnailUri={item.thumbnail || item.thumbnails?.[0] || null}
        />

        {/* Horizontal actions */}
        <View
          style={[
            styles.horizontalActions,
            { bottom: horizontalActionsBottom },
          ]}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => togglePlaybackSpeed(item.id)}
            accessibilityLabel="Toggle playback speed">
            <Text style={styles.speedBadge}>
              {(playbackRateMap[item.id] ?? 1) + '×'}
            </Text>
            <Text style={styles.actionLabel}>Speed</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleLike(item.id)}>
            <Thumbup
              width={24}
              height={24}
              style={[
                styles.actionSvgIcon,
                !likedMap[item.id] && styles.actionSvgIconInactive,
              ]}
            />
            <Text style={styles.actionLabel}>
              {formatCount(likesCountMap[item.id] || 0)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleComment(item.id)}>
            <Comments width={22} height={22} style={styles.actionSvgIcon} />
            <Text style={styles.actionLabel}>
              {formatCount(commentsCountMap[item.id] || 0)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => openShareSheet()}>
            <ShareIcom width={22} height={22} style={styles.actionSvgIcon} />
            <Text style={styles.actionLabel}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleMoreOptions(item)}>
            <Icon name="ellipsis-vertical" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={[styles.sideActions, { bottom: sideActionsBottom }]}>
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
          <View style={styles.userInfo}>
            <TouchableOpacity
              style={styles.userRow}
              onPress={handleUserNavigate}>
              <HexAvatar
                uri={
                  item.avatar ||
                  require('../../assets/icons/pngicons/user.png')
                }
                size={45}
                borderWidth={0.5}
                borderColor={textColor}
              />
              <View style={styles.userTextColumn}>
                <View style={styles.usernameContainer}>
                  <Text style={styles.username}>{item.user}</Text>
                  {item.verified && (
                    <Icon
                      name="checkmark-circle"
                      size={15}
                      color="#1DA1F2"
                      style={styles.verifiedIcon}
                    />
                  )}
                </View>
                <View style={styles.musicRow}>
                  <Feather
                    name="music"
                    size={12}
                    color="#fff"
                    style={styles.musicIcon}
                  />
                  <CustomMarquee
                    speed={3}
                    loop
                    delay={1000}
                    style={styles.musicMarquee}
                    textStyle={{ fontSize: 13, color: 'white' }}>
                    {item.music}
                  </CustomMarquee>
                </View>
              </View>
              {!isOwnReel && (
                <TouchableOpacity
                  style={styles.followButton}
                  onPress={() => handleFollowPress(item)}
                  disabled={followingBusy.has(
                    String(getReelOwnerId(item)),
                  )}>
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
          <TouchableOpacity style={styles.likedBySection}>
            <Text style={styles.likedByText}>
              ❤️ Liked by{' '}
              <Text style={styles.likedByBold}>
                {(() => {
                  const likeCount = Number(
                    item.likes ?? item.likeCount ?? 0,
                  );
                  if (likeCount === 0) return 'no one yet';
                  if (likeCount === 1) return '1 person';
                  return `${likeCount} others`;
                })()}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  },
  (prev, next) => {
    const prevIsCurrent = prev.currentIndex === prev.index;
    const nextIsCurrent = next.currentIndex === next.index;
    const id = prev.item.id;
    return (
      prevIsCurrent === nextIsCurrent &&
      prev.isFocused === next.isFocused &&
      prev.item.isFollowing === next.item.isFollowing &&
      prev.playbackRateMap[id] === next.playbackRateMap[id] &&
      prev.pausedMap[id] === next.pausedMap[id] &&
      prev.mutedMap[id] === next.mutedMap[id] &&
      prev.isBufferingMap[id] === next.isBufferingMap[id] &&
      prev.likedMap[id] === next.likedMap[id] &&
      prev.likesCountMap[id] === next.likesCountMap[id] &&
      prev.commentsCountMap[id] === next.commentsCountMap[id] &&
      prev.savedMap[id] === next.savedMap[id] &&
      prev.heartAnimatingId === next.heartAnimatingId &&
      prev.followingBusy === next.followingBusy &&
      prev.windowWidth === next.windowWidth &&
      prev.viewportHeight === next.viewportHeight &&
      prev.horizontalActionsBottom === next.horizontalActionsBottom
    );
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// FlipsScreen
// ─────────────────────────────────────────────────────────────────────────────
export default function FlipsScreen() {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const route = useRoute();
  const toast = useToast();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { text } = useAppTheme();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [reels, setReels] = useState([]);
  /** Keeps latest reels for fetch callbacks — avoids stale closures without widening deps. */
  const reelsRef = useRef(reels);
  useEffect(() => {
    reelsRef.current = reels;
  }, [reels]);
  /** Before Explore→Flips handoff clears the feed; restored if the refresh fails. */
  const exploreScrollBackupRef = useRef([]);
  const [muted, setMuted] = useState({});
  const [paused, setPaused] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);
  const [liked, setLiked] = useState({});
  const [likesCount, setLikesCount] = useState({});
  const [commentsCount, setCommentsCount] = useState({});
  const [likingIds, setLikingIds] = useState(new Set());
  const [saved, setSaved] = useState({});
  const [savingIds, setSavingIds] = useState(new Set());
  const [heartAnimatingId, setHeartAnimatingId] = useState(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const [playbackRate, setPlaybackRate] = useState({});
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [pinchScrollLock, setPinchScrollLock] = useState(false);

  const onPinchLockChange = useCallback(locked => {
    setPinchScrollLock(!!locked);
  }, []);

  const flatListRef = useRef();
  // While opening Flips from Explore, FlatList can still report offset 0 before
  // scrollToIndex runs — handleScroll would clamp currentIndex to 0 and fight fetch.
  const suppressScrollDerivedIndexRef = useRef(false);
  const videoRefs = useRef({});
  // Raw currentTime values — never causes re-renders
  const videoProgressRef = useRef({});
  // Per-reel Animated.Values for the progress bar — drives UI without setState
  const videoProgressAnimRef = useRef({});
  // Per-reel duration in seconds
  const videoDurationSecRef = useRef({});
  const likedRef = useRef(liked);

  useEffect(() => {
    likedRef.current = liked;
  }, [liked]);

  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [commentsData, setCommentsData] = useState(mockComments);
  const [selectedReelId, setSelectedReelId] = useState(null);
  const commentSheetRef = useRef();
  const moreOptionsSheetRef = useRef();
  const notInterestedSheetRef = useRef();
  const musicTemplatesSheetRef = useRef();
  const reportSheetRef = useRef();
  const [isBuffering, setIsBuffering] = useState({});
  const progressBarWidthRef = useRef(windowWidth);
  const scrubbingReelIdRef = useRef(null);
  const [commentPostId, setCommentPostId] = useState(null);
  const [commentPostOwnerId, setCommentPostOwnerId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [supportDisclaimerVisible, setSupportDisclaimerVisible] =
    useState(false);
  const [purchaseAutoFocus, setPurchaseAutoFocus] = useState(false);
  const [pendingFollowUserId, setPendingFollowUserId] = useState(null);
  const [pendingFollowAction, setPendingFollowAction] = useState(null);
  const [followingBusy, setFollowingBusy] = useState(new Set());
  const [tokenAddress, setTokenAddress] = useState(null);
  const [currentUserProfileType, setCurrentUserProfileType] =
    useState('user');

  const { bgStyle } = useAppTheme();
  const { startSupportPayment } = useWalletConnectSupport();
  const shareRef = useRef(null);
  const purchaseSheetRef = useRef();
  const sellSheetRef = useRef();

  const viewportHeight = Math.max(1, windowHeight);
  const tabBarHeight = useBottomTabBarHeight();
  const isIOS = Platform.OS === 'ios';
  const bottomOverlayInset = tabBarHeight + (isIOS ? 6 : 8);
  const bottomContentBottom = isIOS
    ? Math.max(26, bottomOverlayInset + 2)
    : Math.max(6, bottomOverlayInset - 30);
  const sideActionsBottom = isIOS
    ? bottomContentBottom - 14
    : bottomContentBottom - 18;
  const horizontalActionsBottom = bottomContentBottom + (isIOS ? 112 : 100);

  const scrubAnim = useRef(new Animated.Value(0)).current;

  const onScrubStart = (activeId, locationX) => {
    setIsScrubbing(true);
    scrubbingReelIdRef.current = activeId;
    Animated.spring(scrubAnim, {
      toValue: 1,
      useNativeDriver: false,
      bounciness: 0,
      speed: 40,
    }).start();
    seekReelToLocationX(activeId, locationX);
  };

  useEffect(() => {
    if (!isFocused) {
      setIsScrubbing(false);
      setPinchScrollLock(false);
      scrubbingReelIdRef.current = null;
    }
  }, [isFocused]);

  const onScrubEnd = useCallback(() => {
    setIsScrubbing(false);
    scrubbingReelIdRef.current = null;
    Animated.spring(scrubAnim, {
      toValue: 0,
      useNativeDriver: false,
      bounciness: 0,
      speed: 20,
    }).start();
  }, [scrubAnim]);

  const trackHeight = scrubAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 8],
  });
  const trackOpacity = scrubAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });
  const thumbOpacity = scrubAnim;
  const thumbScale = scrubAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  const options = [
    "I don't like this post",
    "I've already seen this",
    "It's inappropriate",
    'Other',
  ];

  const formatCount = useCallback(count => {
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  }, []);

  const handleNotInterestedSelect = option => {
    notInterestedSheetRef.current?.close?.();
    if (selectedReelId) {
      setReels(prev => prev.filter(r => r.id !== selectedReelId));
      setSelectedReelId(null);
      showToastMessage(
        toast,
        'success',
        "Thanks — we'll show you fewer posts like this",
      );
    }
  };

  useEffect(() => {
    if (!isFocused) {
      try {
        Object.values(videoRefs.current).forEach(ref => {
          try {
            if (ref?.seek) ref.seek(0);
          } catch {
            /* native player may already be torn down */
          }
        });
      } catch {
        /* ignore */
      }
      scrubbingReelIdRef.current = null;
    }
  }, [isFocused]);

  const fetchAllReels = useCallback(
    async paramReel => {
      let showedGlobalLoader = false;
      try {
        // Empty list: full-screen loader only. When reels already exist (e.g. came back from
        // Explore), skip global loader — the current cell already shows thumbnail + spinner
        // until the native player is ready, and stacking both looked like “two loaders”.
        if (reelsRef.current.length === 0) {
          dispatch(showLoader());
          showedGlobalLoader = true;
        }
        const response = await getAllReels();
        if (response?.statusCode === 200) {
          const pickFirst = (...values) =>
            values.find(
              value =>
                value !== undefined && value !== null && value !== '',
            );

          const pickOwnerId = raw =>
            pickFirst(
              raw?.userId,
              raw?.UserId,
              raw?.ownerId,
              raw?.createdBy,
              raw?.creatorId,
              raw?.authorId,
              raw?.user?.id,
              raw?.User?.id,
            );

          const isVideoReel = raw => {
            const url =
              raw?.images?.[0] || raw?.video || raw?.image || '';
            return (
              typeof url === 'string' &&
              /\.(mp4|mov|avi|mkv|webm|m4v)(\?|#|$)/i.test(url)
            );
          };

          const normalizeReel = (
            raw,
            { fallbackIdPrefix, fallbackIndex } = {},
          ) => {
            const resolvedId = pickFirst(
              raw?.id,
              raw?._id,
              raw?.postId,
              raw?.reelId,
            );
            const fallbackId = `${fallbackIdPrefix || 'reel'}_${Date.now()}_${fallbackIndex ?? 0}`;
            const ownerId = pickOwnerId(raw);
            return {
              id: resolvedId || fallbackId,
              video: raw?.images?.[0] || raw?.video || '',
              thumbnails: Array.isArray(raw?.thumbnails)
                ? raw.thumbnails
                : [],
              thumbnail:
                raw?.thumbnails?.[0] ||
                raw?.thumbnail ||
                raw?.thumbNail ||
                raw?.videoThumbnail ||
                raw?.coverImage ||
                raw?.poster ||
                raw?.images?.[1] ||
                raw?.image ||
                raw?.images?.[0] ||
                '',
              user:
                raw?.userName ||
                raw?.username ||
                raw?.user ||
                'Unknown User',
              avatar:
                raw?.userImage ||
                raw?.avatar ||
                'https://randomuser.me/api/portraits/men/1.jpg',
              caption: raw?.caption || raw?.text || 'No caption',
              music: raw?.music || 'Original Audio',
              likes: raw?.likeCount || raw?.likes || 0,
              comments: raw?.commentCount || raw?.comments || 0,
              shares: raw?.shareCount || raw?.shares || 0,
              isLiked: raw?.isLike || raw?.isLiked || false,
              isFollowing: raw?.isFollow || raw?.isFollowing || false,
              views: formatCount(
                Math.floor(Math.random() * 1000000) + 100000,
              ),
              duration: 30000,
              verified: false,
              likedBy: [`${raw?.likeCount || raw?.likes || 0} others`],
              isRemixable: true,
              isSaved: raw?.isSaved || false,
              isHide: raw?.isHide || false,
              userId: ownerId,
              UserId: ownerId,
              profile: raw?.profile || 'user',
              walletAddress:
                raw?.walletAddress ||
                raw?.userWalletAddress ||
                raw?.creatorWalletAddress ||
                raw?.vendorWalletAddress ||
                raw?.receiverWalletAddress ||
                null,
              hashtag: raw?.hashtag || [],
              location: raw?.location || null,
              taggedPeople: raw?.taggedPeople || [],
            };
          };

          const contextUserId = pickFirst(
            route.params?.profileUserId,
            route.params?.sourceUserId,
          );

          const cameFromProfileContext =
            contextUserId != null &&
            String(contextUserId) !== '' &&
            Array.isArray(route.params?.profileReels);

          const filterByContextUser = reel => {
            if (!contextUserId) return true;
            const ownerId = pickOwnerId(reel);
            return (
              ownerId != null &&
              String(ownerId) === String(contextUserId)
            );
          };

          // When user opens Flips from a Profile, show ONLY that profile's reels.
          // (Some API items don't carry ownerId consistently, which can leak other reels.)
          const apiReels = cameFromProfileContext
            ? []
            : (Array.isArray(response.data) ? response.data : [])
                .filter(
                  item =>
                    !contextUserId || filterByContextUser(item),
                )
                .map((item, index) =>
                  normalizeReel(item, {
                    fallbackIdPrefix: 'api',
                    fallbackIndex: index,
                  }),
                );

          const profileReelsRaw = Array.isArray(
            route.params?.profileReels,
          )
            ? route.params.profileReels
            : [];

          // Profile-provided posts can be missing `userId/UserId` on some items even though they
          // belong to that profile. Keep video items, and only drop ones that *explicitly* belong
          // to a different user.
          const profileReels = profileReelsRaw
            .filter(item => {
              if (!isVideoReel(item)) return false;
              if (!contextUserId) return true;
              const ownerId = pickOwnerId(item);
              if (ownerId == null || ownerId === '') return true;
              return String(ownerId) === String(contextUserId);
            })
            .map((item, index) =>
              normalizeReel(item, {
                fallbackIdPrefix: 'profile',
                fallbackIndex: index,
              }),
            );

          const seen = new Set();
          const dedupedApiReels = [
            ...profileReels,
            ...apiReels,
          ].filter(r => {
            const key = String(r?.id || '');
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          if (!paramReel) {
            if (dedupedApiReels.length > 0)
              setReels(dedupedApiReels);
            return;
          }

          suppressScrollDerivedIndexRef.current = true;
          exploreScrollBackupRef.current = [];

          const normalizedParamReel = normalizeReel(paramReel, {
            fallbackIdPrefix: 'param',
            fallbackIndex: 0,
          });
          const paramId = String(normalizedParamReel.id);
          const matchIndex = dedupedApiReels.findIndex(
            r => String(r?.id) === paramId,
          );

          if (matchIndex >= 0) {
            const next = dedupedApiReels.map(r =>
              String(r?.id) === paramId
                ? { ...r, ...normalizedParamReel }
                : r,
            );
            setReels(next);
            setSelectedReelId(normalizedParamReel.id);
            setCurrentIndex(matchIndex);
            return;
          }

          const next = [
            normalizedParamReel,
            ...dedupedApiReels.filter(
              r => String(r?.id) !== paramId,
            ),
          ];
          setReels(next);
          setSelectedReelId(normalizedParamReel.id);
          setCurrentIndex(0);
        } else {
          showToastMessage(
            toast,
            'danger',
            response?.data?.message || 'Failed to fetch reels',
          );
          if (
            paramReel &&
            exploreScrollBackupRef.current.length > 0
          ) {
            setReels(exploreScrollBackupRef.current);
            setCurrentIndex(0);
          }
          suppressScrollDerivedIndexRef.current = false;
        }
      } catch (error) {
        showToastMessage(
          toast,
          'danger',
          error?.response?.message ?? 'Something went wrong',
        );
        if (
          paramReel &&
          exploreScrollBackupRef.current.length > 0
        ) {
          setReels(exploreScrollBackupRef.current);
          setCurrentIndex(0);
        }
        suppressScrollDerivedIndexRef.current = false;
      } finally {
        if (showedGlobalLoader) {
          dispatch(hideLoader());
        }
      }
    },
    [
      dispatch,
      formatCount,
      route.params?.profileReels,
      route.params?.profileUserId,
      route.params?.sourceUserId,
      toast,
    ],
  );

  useEffect(() => {
    const paramReel = route.params?.item;
    if (paramReel) {
      // Drop stale feed immediately so we don't play the wrong reel while getAllReels runs,
      // and while FlatList is still at offset 0 before scrollToIndex targets the tapped post.
      exploreScrollBackupRef.current =
        reelsRef.current.length > 0 ? [...reelsRef.current] : [];
      reelsRef.current = [];
      setReels([]);
      setCurrentIndex(0);
      setSelectedReelId(null);
      suppressScrollDerivedIndexRef.current = true;
      setPaused({});
      setMuted({});
    }
    fetchAllReels(paramReel);
  }, [
    fetchAllReels,
    formatCount,
    route.params?.item,
    route.params?.key,
    route.params?.uniqueKey,
  ]);

  const copyToClipboard = url => {
    if (!url) {
      showToastMessage(toast, 'danger', 'No link available to copy');
      return;
    }
    Clipboard.setString(url);
    showToastMessage(toast, 'success', 'Link copied to clipboard');
  };

  useEffect(() => {
    if (!Array.isArray(reels) || !reels.length) return;
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
  }, [reels]);

  const handleBackPress = useCallback(() => {
    const returnTo = route.params?.returnTo;
    const returnParams = route.params?.returnParams;
    if (returnTo) {
      navigation.navigate(returnTo, returnParams);
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('HomeMain');
    }
  }, [navigation, route.params]);

  // Single active <Video> uses `index === currentIndex`. Do NOT derive currentIndex from
  // viewableItems[0] — order is undefined, so nothing matched → permanent black screen.
  const handleScroll = useCallback(
    event => {
      const offsetY = event.nativeEvent.contentOffset.y || 0;
      const h = viewportHeight || 1;
      const pageIdx = Math.round(offsetY / h);
      const maxIndex = Math.max(0, reels.length - 1);
      const validIdx = Math.min(Math.max(0, pageIdx), maxIndex);
      if (!suppressScrollDerivedIndexRef.current) {
        setCurrentIndex(prev =>
          prev !== validIdx ? validIdx : prev,
        );
      }

      const maxScroll = maxIndex * viewportHeight;
      // reels can be [] during Explore→Flips handoff; reels.length - 1 would be -1 and crashes.
      if (
        reels.length > 0 &&
        offsetY > maxScroll + viewportHeight * 0.5
      ) {
        flatListRef.current?.scrollToIndex({
          index: reels.length - 1,
          animated: false,
        });
      }
    },
    [reels.length, viewportHeight],
  );

  const handleLike = useCallback(
    async id => {
      if (!id || likingIds.has(id)) return;
      const wasLiked = !!liked[id];
      const prevCount = likesCount[id] ?? 0;
      setLiked(prev => ({ ...prev, [id]: !wasLiked }));
      setLikesCount(prev => ({
        ...prev,
        [id]: wasLiked
          ? Math.max(0, prevCount - 1)
          : prevCount + 1,
      }));
      setLikingIds(prev => new Set(prev).add(id));
      try {
        const res = await likePost(id);
        const ok = res?.statusCode === 200 && res?.success;
        if (ok) {
          const serverLiked = !!res?.data?.liked;
          const serverCount =
            res?.data?.likesCount ?? res?.data?.totalLikes;
          setLiked(prev => ({ ...prev, [id]: serverLiked }));
          if (serverCount !== undefined)
            setLikesCount(prev => ({
              ...prev,
              [id]: serverCount,
            }));
        } else {
          setLiked(prev => ({ ...prev, [id]: wasLiked }));
          setLikesCount(prev => ({ ...prev, [id]: prevCount }));
          showToastMessage(
            toast,
            'danger',
            res?.data?.message || 'Failed to toggle like',
          );
        }
      } catch (e) {
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

  const getReelOwnerId = useCallback(
    reel => reel?.userId || reel?.UserId || null,
    [],
  );

  const executeFollowAction = useCallback(
    async (targetUserId, shouldFollow) => {
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
        const res = shouldFollow
          ? await follow(targetUserId)
          : await unfollow(targetUserId);
        const ok =
          res?.statusCode === 200 && (res?.success ?? true);
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
            res?.data?.message || 'Unable to update follow',
          );
          return false;
        }
        const resolvedFollowing =
          typeof res?.data?.following === 'boolean'
            ? res.data.following
            : shouldFollow;
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
    },
    [getReelOwnerId, toast],
  );

  const handleToggleFollow = useCallback(
    async (targetUserId, shouldFollow) => {
      if (!targetUserId) return false;
      const key = String(targetUserId);
      if (followingBusy.has(key)) return false;
      setPendingFollowUserId(targetUserId);
      setPendingFollowAction(shouldFollow);
      if (shouldFollow) {
        setTimeout(
          () => purchaseSheetRef.current?.open?.(),
          0,
        );
        return true;
      }
      return executeFollowAction(targetUserId, false);
    },
    [executeFollowAction, followingBusy],
  );

  const handleFollowPress = useCallback(
    async item => {
      const targetUserId = getReelOwnerId(item);
      if (
        !targetUserId ||
        String(targetUserId) === String(currentUserId) ||
        followingBusy.has(String(targetUserId))
      )
        return;
      const shouldFollow = !item.isFollowing;
      const result = await executeFollowAction(
        targetUserId,
        shouldFollow,
        item.userTokenAddress,
      );
      const success = typeof result === 'boolean' ? result : true;
      if (!success || !shouldFollow) return;
      const recipientProfile = normalizeProfileType(item?.profile);
      const supporterProfile = normalizeProfileType(
        currentUserProfileType,
      );
      if (isSupportAllowed({ supporterProfile, recipientProfile })) {
        setModalVisible(true);
      }
    },
    [
      currentUserId,
      executeFollowAction,
      followingBusy,
      getReelOwnerId,
      currentUserProfileType,
    ],
  );

  const handleTokenPurchase = useCallback(async () => {
    try {
      purchaseSheetRef.current?.close?.();
      if (
        pendingFollowUserId != null &&
        pendingFollowAction != null
      )
        await executeFollowAction(
          pendingFollowUserId,
          pendingFollowAction,
        );
    } finally {
      setPendingFollowUserId(null);
      setPendingFollowAction(null);
      setPurchaseAutoFocus(false);
    }
  }, [
    executeFollowAction,
    pendingFollowAction,
    pendingFollowUserId,
  ]);

  const handleTokenSell = useCallback(async () => {
    sellSheetRef.current?.close?.();
    if (pendingFollowUserId != null)
      await executeFollowAction(pendingFollowUserId, false);
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
  const activeReelId = selectedReelId || currentReel?.id || null;
  const activeReel = useMemo(
    () =>
      (activeReelId
        ? reels.find(r => String(r?.id) === String(activeReelId))
        : null) ||
      currentReel ||
      null,
    [activeReelId, currentReel, reels],
  );
  const canDeleteActiveReel = useMemo(() => {
    const ownerId = activeReel ? getReelOwnerId(activeReel) : null;
    return Boolean(
      activeReelId &&
      currentUserId &&
      ownerId &&
      String(ownerId) === String(currentUserId),
    );
  }, [activeReel, activeReelId, currentUserId, getReelOwnerId]);

  const recipientWalletAddress = getSupportRecipientWalletAddress(
    currentReel || {},
  );
  const supporterProfile = normalizeProfileType(currentUserProfileType);
  const recipientProfile = normalizeProfileType(currentReel?.profile);

  const handleSupportNow = useCallback(async () => {
    if (!recipientWalletAddress) {
      Alert.alert(
        'Wallet not connected',
        'This user has not connected a wallet yet. Follow is still active.',
      );
      return;
    }
    setSupportDisclaimerVisible(false);
    const receiverId =
      currentReel?.UserId ?? currentReel?.userId ?? '';
    await startSupportPayment(recipientWalletAddress, {
      senderId:
        currentUserId != null ? String(currentUserId) : '',
      receiverId:
        receiverId !== '' ? String(receiverId) : '',
      chain: 'POLYGON',
    });
  }, [
    currentReel,
    currentUserId,
    recipientWalletAddress,
    startSupportPayment,
  ]);

  const handleOpenSupportDisclaimer = useCallback(() => {
    if (
      !isSupportAllowed({ supporterProfile, recipientProfile })
    ) {
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

  const animateHeart = useCallback(
    id => {
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
    },
    [scaleAnim],
  );

  // ── Stable tap refs — callbacks update without changing identity ──
  const handleDoubleTapLeftRef = useRef(null);
  const handleSingleTapToggleRef = useRef(null);

  handleDoubleTapLeftRef.current = useCallback(
    id => {
      if (!likedRef.current[id]) handleLike(id);
      animateHeart(id);
    },
    [animateHeart, handleLike],
  );

  handleSingleTapToggleRef.current = useCallback(id => {
    setPaused(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // These never change identity — safe to pass to memoized children
  const stableDoubleTap = useCallback(id => {
    handleDoubleTapLeftRef.current?.(id);
  }, []);

  const stableSingleTap = useCallback(id => {
    handleSingleTapToggleRef.current?.(id);
  }, []);

  const getDurationSecForReel = useCallback(
    (id, fallbackMs = 30000) => {
      // Read from ref — no state dependency
      const fromRef = videoDurationSecRef.current[id];
      if (fromRef) return fromRef;
      const ms =
        reels.find(r => r.id === id)?.duration ?? fallbackMs;
      return Math.max(0.001, Number(ms) / 1000);
    },
    [reels],
  );

  const seekReelToLocationX = useCallback(
    (id, locationX) => {
      const videoRef = videoRefs.current[id];
      if (!videoRef?.seek) return;
      const outerW = progressBarWidthRef.current || windowWidth;
      const innerW = Math.max(
        1,
        outerW - 2 * FLIPS_PROGRESS_H_PADDING,
      );
      const x = Math.min(
        Math.max(locationX - FLIPS_PROGRESS_H_PADDING, 0),
        innerW,
      );
      const durSec = getDurationSecForReel(id);
      const ratio = Math.min(1, Math.max(0, x / innerW));
      const t = ratio * durSec;
      try {
        videoRef.seek(t);
        videoProgressRef.current[id] = t;
        // Update Animated.Value directly — zero setState, zero re-render
        if (videoProgressAnimRef.current[id]) {
          videoProgressAnimRef.current[id].setValue(ratio);
        }
      } catch (error) {
        // seek failed silently
      }
    },
    [getDurationSecForReel, windowWidth],
  );

  const togglePlaybackSpeed = useCallback(id => {
    setPlaybackRate(prev => {
      const current = prev[id] ?? 1;
      const currentIdx = SPEED_STEPS.indexOf(current);
      const nextIdx = (currentIdx + 1) % SPEED_STEPS.length;
      return { ...prev, [id]: SPEED_STEPS[nextIdx] };
    });
  }, []);

  const handleComment = useCallback(postId => {
    setCommentPostId(postId);
    setSelectedReelId(postId);
    commentSheetRef.current?.open();
  }, []);

  const handleToggleSave = useCallback(
    async reelId => {
      if (!reelId || savingIds.has(reelId)) return;
      setSavingIds(prev => new Set(prev).add(reelId));
      const isCurrentlySaved = !!saved[reelId];
      try {
        const resp = isCurrentlySaved
          ? await unSavePost(reelId)
          : await savePost(reelId);
        if (resp && resp.statusCode === 200) {
          showToastMessage(toast, 'success', resp.data.message);
          Alert.alert(resp?.data?.message);
          setSaved(prev => ({
            ...prev,
            [reelId]: !isCurrentlySaved,
          }));
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
    if (!flatListRef.current || !selectedReelId || reels.length === 0)
      return;
    const idx = reels.findIndex(
      r => String(r?.id) === String(selectedReelId),
    );
    if (idx < 0) {
      setSelectedReelId(null);
      suppressScrollDerivedIndexRef.current = false;
      return;
    }

    suppressScrollDerivedIndexRef.current = true;

    let attempts = 0;
    const scrollToTarget = () => {
      attempts += 1;
      try {
        const h = viewportHeight || 1;
        flatListRef.current.scrollToOffset({
          offset: Math.max(0, idx * h),
          animated: false,
        });
        setCurrentIndex(idx);
        setSelectedReelId(null);
        setTimeout(() => {
          suppressScrollDerivedIndexRef.current = false;
        }, 400);
      } catch {
        if (attempts < 10) {
          requestAnimationFrame(scrollToTarget);
        } else {
          setSelectedReelId(null);
          suppressScrollDerivedIndexRef.current = false;
        }
      }
    };

    requestAnimationFrame(() =>
      requestAnimationFrame(scrollToTarget),
    );
  }, [selectedReelId, reels, viewportHeight]);

  const handleShare = async item => {
    try {
      const result = await Share.share({
        message: `Check out this amazing reel by @${item.user}!\n\n"${item.caption}"\n\nShared via Flips`,
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
    } catch {
      Alert.alert('Error', 'Failed to share reel');
    }
  };

  const handleMoreOptions = useCallback(item => {
    setSelectedReelId(item.id);
    moreOptionsSheetRef.current?.open();
  }, []);

  const openShareSheet = useCallback(() => {
    shareRef.current?.open?.();
  }, []);

  const deleteReelById = useCallback(
    async reelId => {
      if (!reelId) return;
      try {
        const userId =
          currentUserId ??
          (await AsyncStorage.getItem('userId'));
        if (!userId) {
          showToastMessage(
            toast,
            'danger',
            'No user id found; cannot delete.',
          );
          return;
        }
        dispatch(showLoader());
        setReels(prev => {
          const next = prev.filter(
            r => String(r?.id) !== String(reelId),
          );
          const maxIdx = Math.max(0, next.length - 1);
          setCurrentIndex(ci =>
            Math.max(0, Math.min(ci, maxIdx)),
          );
          return next;
        });
        setSelectedReelId(null);
        moreOptionsSheetRef.current?.close?.();
        const res = await deletePost(
          String(reelId),
          String(userId),
        );
        if (res?.statusCode === 200 && (res?.success ?? true)) {
          showToastMessage(
            toast,
            'success',
            res?.data?.message || 'Flip deleted',
          );
        } else {
          showToastMessage(
            toast,
            'danger',
            res?.data?.message ||
            res?.message ||
            'Failed to delete reel',
          );
        }
      } catch (e) {
        showToastMessage(
          toast,
          'danger',
          e?.response?.data?.message ||
          e?.message ||
          'Error deleting reel',
        );
      } finally {
        dispatch(hideLoader());
      }
    },
    [currentUserId, dispatch, toast],
  );

  const confirmDeleteReel = useCallback(
    reelId => {
      Alert.alert(
        'Delete reel?',
        'This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteReelById(reelId),
          },
        ],
      );
    },
    [deleteReelById],
  );

  // ── Stable video callbacks — bound to itemId inside ReelItem ──
  const handleVideoLoad = useCallback((itemId, data) => {
    // Store duration in ref — no setState, no re-render
    const durSec = Math.max(0.001, data.duration);
    videoDurationSecRef.current[itemId] = durSec;
    // Create Animated.Value for this reel if not yet created
    if (!videoProgressAnimRef.current[itemId]) {
      videoProgressAnimRef.current[itemId] = new Animated.Value(0);
    }
  }, []);

  const handleVideoProgress = useCallback((itemId, data) => {
    if (scrubbingReelIdRef.current === itemId) return;
    const t = data.currentTime;
    videoProgressRef.current[itemId] = t;
    // Drive the progress bar via Animated.Value — zero setState
    const durSec = videoDurationSecRef.current[itemId];
    if (durSec && videoProgressAnimRef.current[itemId]) {
      const ratio = Math.min(1, Math.max(0, t / durSec));
      videoProgressAnimRef.current[itemId].setValue(ratio);
    }
  }, []);

  const registerVideoRef = useCallback((itemId, ref) => {
    if (ref == null) {
      delete videoRefs.current[itemId];
      delete videoProgressRef.current[itemId];
      delete videoDurationSecRef.current[itemId];
      delete videoProgressAnimRef.current[itemId];
      return;
    }
    videoRefs.current[itemId] = ref;
  }, []);

  const handleUserNavigate = useCallback(async () => {
    const userId =
      currentUserId ?? (await AsyncStorage.getItem('userId'));
    const currentReelItem = reels[currentIndex];
    const targetUserId =
      currentReelItem?.userId ||
      route.params?.item?.userId ||
      route.params?.item?.UserId;
    if (!targetUserId) return;
    if (String(userId) === String(targetUserId))
      navigation.navigate('ProfileMain', { screen: 'Profile' });
    else
      navigation.navigate('HomeMain', {
        screen: 'UsersProfile',
        params: { userId: targetUserId },
      });
  }, [
    currentIndex,
    currentUserId,
    navigation,
    reels,
    route.params?.item,
  ]);

  const renderMusicTemplate = ({ item }) => (
    <TouchableOpacity style={styles.templateItem}>
      <View style={styles.templateThumbnail}>
        <Image
          source={{ uri: item.thumbnail }}
          style={styles.templateImage}
        />
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
      } catch {
        if (isMounted) setCurrentUserId(null);
      }
    };
    const loadCurrentUserProfile = async () => {
      try {
        const profile = await AsyncStorage.getItem('profile');
        if (isMounted)
          setCurrentUserProfileType(
            normalizeProfileType(profile || 'user'),
          );
      } catch {
        if (isMounted) setCurrentUserProfileType('user');
      }
    };
    loadCurrentUserId();
    loadCurrentUserProfile();
    return () => {
      isMounted = false;
    };
  }, [isFocused]);

  // ── renderItem — thin wrapper, all heavy logic lives in ReelItem ──
  const renderItem = useCallback(
    ({ item, index }) => (
      <ReelItem
        item={item}
        index={index}
        currentIndex={currentIndex}
        windowWidth={windowWidth}
        viewportHeight={viewportHeight}
        isFocused={isFocused}
        playbackRateMap={playbackRate}
        pausedMap={paused}
        mutedMap={muted}
        isBufferingMap={isBuffering}
        likedMap={liked}
        likesCountMap={likesCount}
        commentsCountMap={commentsCount}
        savedMap={saved}
        heartAnimatingId={heartAnimatingId}
        scaleAnim={scaleAnim}
        followingBusy={followingBusy}
        currentUserId={currentUserId}
        sideActionsBottom={sideActionsBottom}
        bottomContentBottom={bottomContentBottom}
        horizontalActionsBottom={horizontalActionsBottom}
        onPinchLockChange={onPinchLockChange}
        handleVideoLoad={handleVideoLoad}
        handleVideoProgress={handleVideoProgress}
        registerVideoRef={registerVideoRef}
        stableDoubleTap={stableDoubleTap}
        stableSingleTap={stableSingleTap}
        handleLike={handleLike}
        handleComment={handleComment}
        openShareSheet={openShareSheet}
        handleMoreOptions={handleMoreOptions}
        handleFollowPress={handleFollowPress}
        handleUserNavigate={handleUserNavigate}
        togglePlaybackSpeed={togglePlaybackSpeed}
        getReelOwnerId={getReelOwnerId}
        formatCount={formatCount}
        text={text}
      />
    ),
    [
      currentIndex,
      windowWidth,
      viewportHeight,
      isFocused,
      playbackRate,
      paused,
      muted,
      isBuffering,
      liked,
      likesCount,
      commentsCount,
      saved,
      heartAnimatingId,
      scaleAnim,
      followingBusy,
      currentUserId,
      sideActionsBottom,
      bottomContentBottom,
      horizontalActionsBottom,
      onPinchLockChange,
      handleVideoLoad,
      handleVideoProgress,
      registerVideoRef,
      stableDoubleTap,
      stableSingleTap,
      handleLike,
      handleComment,
      openShareSheet,
      handleMoreOptions,
      handleFollowPress,
      handleUserNavigate,
      togglePlaybackSpeed,
      getReelOwnerId,
      formatCount,
      text,
    ],
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView
        style={styles.container}
        edges={['left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor="#020202ff" />
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              paddingTop:
                insets.top +
                FLIPS_PROGRESS_TOP_GAP +
                FLIPS_PROGRESS_STRIP_HEIGHT +
                FLIPS_HEADER_AFTER_PROGRESS,
            },
          ]}
          pointerEvents="box-none">
          <TouchableOpacity
            onPress={handleBackPress}
            style={styles.buttons}>
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerLeft}
            onPress={() => setDropdownVisible(v => !v)}>
            <Text style={styles.logo}>Flips</Text>
            <Icon
              name="chevron-down"
              size={18}
              color="#fff"
              style={styles.chevronIcon}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton}>
            <Feather name="camera" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Progress scrub bar — reads Animated.Value directly, no setState */}
        {reels.length > 0 && reels[currentIndex]?.id
          ? (() => {
            const activeId = reels[currentIndex].id;
            // Ensure Animated.Value exists for this reel
            if (!videoProgressAnimRef.current[activeId]) {
              videoProgressAnimRef.current[activeId] = new Animated.Value(0);
            }
            const fillAnim = videoProgressAnimRef.current[activeId];

            const scrubGesture = Gesture.Pan()
              .minDistance(0)
              .shouldCancelWhenOutside(false)
              .onBegin(e => {
                runOnJS(onScrubStart)(activeId, e.x);
              })
              .onUpdate(e => {
                runOnJS(seekReelToLocationX)(activeId, e.x);
              })
              .onFinalize(() => {
                runOnJS(onScrubEnd)();
              });

            // fillAnim is 0–1 ratio; convert to percentage string for width
            const fillWidth = fillAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
              extrapolate: 'clamp',
            });
            const thumbLeft = fillAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
              extrapolate: 'clamp',
            });

            return (
              <GestureDetector gesture={scrubGesture}>
                <View
                  style={[
                    styles.progressHitArea,
                    styles.progressScreenOverlay,
                    {
                      top: insets.top + FLIPS_PROGRESS_TOP_GAP,
                      left: -insets.left,
                      width: windowWidth,
                      height: 40,
                      justifyContent: 'center',
                    },
                  ]}
                  collapsable={false}
                  pointerEvents="box-only"
                  onLayout={e => {
                    progressBarWidthRef.current =
                      e.nativeEvent.layout.width;
                  }}>
                  <Animated.View
                    style={{
                      height: trackHeight,
                      backgroundColor: 'rgba(255,255,255,0.3)',
                      borderRadius: 4,
                      overflow: 'visible',
                    }}>
                    {/* Fill — width driven by Animated.Value */}
                    <Animated.View
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: fillWidth,
                        backgroundColor: '#fff',
                        borderRadius: 4,
                        opacity: trackOpacity,
                      }}
                    />
                    {/* Thumb */}
                    <Animated.View
                      style={{
                        position: 'absolute',
                        left: thumbLeft,
                        top: '50%',
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        backgroundColor: '#fff',
                        opacity: thumbOpacity,
                        transform: [
                          { translateX: -8 },
                          { translateY: -8 },
                          { scale: thumbScale },
                        ],
                        shadowColor: '#000',
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                        shadowOffset: { width: 0, height: 1 },
                        elevation: 3,
                      }}
                    />
                  </Animated.View>
                </View>
              </GestureDetector>
            );
          })()
          : null}

        <GestureFlatList
          key={
            route.params?.key != null
              ? String(route.params.key)
              : route.params?.item?.id != null
                ? String(route.params.item.id)
                : 'flips-default'
          }
          ref={flatListRef}
          data={reels}
          keyExtractor={(item, index) =>
            String(item?.id ?? index)
          }
          renderItem={renderItem}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          // Small window + single mounted Video (current row only).
          windowSize={3}
          initialNumToRender={3}
          maxToRenderPerBatch={2}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={e => {
            // While Explore→Flips alignment runs, the list can emit momentum-end at y=0
            // before scrollToOffset reaches the target — that used to force currentIndex to 0.
            if (suppressScrollDerivedIndexRef.current) {
              return;
            }
            if (reels.length === 0) {
              return;
            }
            const offsetY =
              e.nativeEvent.contentOffset.y || 0;
            const h = viewportHeight || 1;
            const idx = Math.round(offsetY / h);
            const maxIndex = reels.length - 1;
            const validIdx = Math.min(
              Math.max(0, idx),
              maxIndex,
            );
            setCurrentIndex(validIdx);
            if (idx > maxIndex && maxIndex >= 0) {
              flatListRef.current?.scrollToIndex({
                index: maxIndex,
                animated: true,
              });
            }
          }}
          snapToAlignment="start"
          snapToInterval={viewportHeight}
          getItemLayout={(_, index) => ({
            length: viewportHeight,
            offset: viewportHeight * index,
            index,
          })}
          overScrollMode="never"
          bounces={false}
          scrollEnabled={
            reels.length > 0 && !isScrubbing && !pinchScrollLock
          }
          removeClippedSubviews={false}
          nestedScrollEnabled={false}
          extraData={{
            viewportHeight,
            playbackRate,
            paused,
            currentIndex,
            pinchScrollLock,
          }}
        />

        {dropdownVisible && (
          <View style={styles.dropdownOverlay}>
            <TouchableWithoutFeedback
              onPress={() => setDropdownVisible(false)}>
              <View style={styles.dropdownBackdrop} />
            </TouchableWithoutFeedback>
            <View style={styles.dropdown}>
              <View style={styles.arrowUp} />
              <TouchableOpacity style={styles.dropdownOption}>
                <Icon
                  name="people-outline"
                  size={22}
                  color="#000"
                />
                <Text style={styles.dropdownText}>Following</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dropdownOption}>
                <Icon
                  name="location-outline"
                  size={22}
                  color="#000"
                />
                <Text style={styles.dropdownText}>Nearby</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <RBSheet
          ref={commentSheetRef}
          height={500}
          openDuration={250}
          draggable
          closeOnPressMask
          customModalProps={{ statusBarTranslucent: true }}
          onClose={() => {
            Keyboard.dismiss();
            setCommentPostId(null);
          }}
          customStyles={{
            container: [
              {
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
                bottom: -20,
              },
              bgStyle,
            ],
            draggableIcon: { backgroundColor: '#ccc', width: 60 },
          }}>
          <CommentSheet
            postId={commentPostId}
            onClose={handleCommentClose}
            onCommentCountUpdate={handleCommentCountUpdate}
            postOwnerId={commentPostOwnerId}
          />
        </RBSheet>

        <RBSheet
          ref={moreOptionsSheetRef}
          height={380}
          openDuration={250}
          customStyles={{
            container: {
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              backgroundColor: '#fff',
            },
          }}
          closeOnDragDown
          closeOnPressMask>
          <View style={styles.moreOptionsContainer}>
            <View style={styles.moreOptionsHeader}>
              <Text style={styles.moreOptionsTitle}>
                More Options
              </Text>
            </View>
            <ScrollView style={styles.moreOptionsList}>
              <TouchableOpacity
                style={styles.moreOption}
                onPress={() => {
                  handleToggleSave(
                    selectedReelId || reels[currentIndex]?.id,
                  );
                  moreOptionsSheetRef.current?.close();
                }}>
                <Icon
                  name={
                    saved[
                      selectedReelId || reels[currentIndex]?.id
                    ]
                      ? 'bookmark'
                      : 'bookmark-outline'
                  }
                  size={24}
                  color="#000"
                />
                <Text style={styles.moreOptionText}>
                  {saved[
                    selectedReelId || reels[currentIndex]?.id
                  ]
                    ? 'Saved'
                    : 'Save'}
                </Text>
              </TouchableOpacity>
              {canDeleteActiveReel && (
                <TouchableOpacity
                  style={styles.moreOption}
                  onPress={() => {
                    moreOptionsSheetRef.current?.close();
                    confirmDeleteReel(activeReelId);
                  }}>
                  <Icon
                    name="trash-outline"
                    size={24}
                    color="#000"
                  />
                  <Text style={styles.moreOptionText}>
                    Delete
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.moreOption}
                onPress={() => {
                  moreOptionsSheetRef.current?.close();
                  setTimeout(
                    () => reportSheetRef.current?.open(),
                    200,
                  );
                }}>
                <Icon
                  name="flag-outline"
                  size={24}
                  color="#000"
                />
                <Text style={styles.moreOptionText}>Report</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.moreOption}
                onPress={() => {
                  moreOptionsSheetRef.current?.close();
                  setTimeout(
                    () =>
                      notInterestedSheetRef.current?.open?.(),
                    220,
                  );
                }}>
                <Icon
                  name="eye-off-outline"
                  size={24}
                  color="#000"
                />
                <Text style={styles.moreOptionText}>
                  Not Interested
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.moreOption}
                onPress={() => {
                  const reel =
                    reels.find(r => r.id === selectedReelId) ||
                    reels[currentIndex];
                  copyToClipboard(
                    reel?.video ||
                    reel?.images?.[0] ||
                    reel?.image ||
                    '',
                  );
                  moreOptionsSheetRef.current?.close();
                }}>
                <Icon
                  name="copy-outline"
                  size={24}
                  color="#000"
                />
                <Text style={styles.moreOptionText}>
                  Copy Link
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </RBSheet>

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
          closeOnDragDown
          closeOnPressMask>
          <View style={styles.templatesContainer}>
            <View style={styles.templatesHeader}>
              <TouchableOpacity
                onPress={() =>
                  musicTemplatesSheetRef.current?.close()
                }>
                <Icon name="close" size={24} color="#000" />
              </TouchableOpacity>
              <Text style={styles.templatesTitle}>
                Music Templates
              </Text>
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

        <RBSheet
          ref={notInterestedSheetRef}
          height={360}
          openDuration={200}
          closeOnDragDown
          closeOnPressMask
          customStyles={{
            container: styles.sheetContainer,
            overlay: { backgroundColor: 'rgba(0,0,0,0.4)' },
          }}>
          <View style={styles.dragHandle} />
          <View style={styles.headerContainer}>
            <View style={styles.headerIcon}>
              <Icon name="eye-off" size={22} color="#5a2d82" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>
                Not Interested
              </Text>
              <Text style={styles.sheetSubtitle}>
                Tell us why you don't want to see this
              </Text>
            </View>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}>
            {options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={styles.reasonItem}
                onPress={() =>
                  handleNotInterestedSelect(option)
                }>
                <View style={styles.reasonIconWrapper}>
                  <Icon
                    name="eye-off"
                    size={18}
                    color="#5a2d82"
                  />
                </View>
                <Text style={styles.reasonText}>{option}</Text>
                <Icon
                  name="chevron-forward"
                  size={20}
                  color="#ccc"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </RBSheet>

        <ShareModal
          ref={shareRef}
          reel={reels[currentIndex]}
          reelId={reels[currentIndex]?.id}
        />
        <ReportFlowScreen
          ref={reportSheetRef}
          postId={selectedReelId || reels[currentIndex]?.id}
        />
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
          canSupport={recipientWalletAddress}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    bottom: SCREEN_HEIGHT > 800 && 25,
    backgroundColor: '#f8f2fc',
  },
  reelContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    position: 'relative',
    top: 0,
    overflow: 'visible',
  },
  progressHitArea: {
    position: 'absolute',
    height: FLIPS_PROGRESS_STRIP_HEIGHT,
    justifyContent: 'flex-start',
    paddingHorizontal: FLIPS_PROGRESS_H_PADDING,
    paddingTop: 2,
    paddingBottom: 10,
  },
  progressScreenOverlay: {
    zIndex: 400,
    elevation: 28,
  },
  progressTrack: {
    height: 3,
    borderRadius: 0,
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 0,
  },
  speedBadge: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  videoContainer: { flex: 1 },
  video: { width: '100%', height: '100%' },
  videoPlaceholder: { backgroundColor: '#000' },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -40 }, { translateY: -40 }],
  },
  heartAnimation: {
    position: 'absolute',
    top: '40%',
    left: '40%',
    right: '50',
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
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  logo: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  chevronIcon: { marginLeft: 8 },
  headerIconButton: { padding: 8 },
  buttons: { padding: 8 },
  horizontalActions: {
    position: 'absolute',
    left: 10,
    right: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 10,
    gap: 26,
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 8,
  },
  actionSvgIcon: { opacity: 1 },
  actionSvgIconInactive: { opacity: 0.7 },
  actionLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  musicDisc: { marginTop: 10, marginBottom: '10%' },
  discContainer: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  discImage: { width: '100%', height: '100%', borderRadius: 25 },
  musicIconWrapper: { position: 'absolute', top: 7, left: 5 },
  bottomContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  userInfo: { marginBottom: 4 },
  userRow: { flexDirection: 'row', alignItems: 'flex-start' },
  userTextColumn: {
    flex: 1,
    marginLeft: 8,
    justifyContent: 'center',
    marginTop: 1,
  },
  usernameContainer: {
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
  },
  verifiedIcon: { marginLeft: 6 },
  followButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginLeft: 10,
    marginTop: 2,
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
    marginBottom: 4,
    marginLeft: 0,
  },
  likedBySection: { marginBottom: 0, marginLeft: 0 },
  likedByText: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  likedByBold: { fontWeight: 'bold', color: '#fff' },
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  musicMarquee: { width: 110, maxWidth: 250, marginLeft: 8 },
  musicIcon: { marginTop: 0 },
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
  },
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
  },
  moreOptionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  moreOptionsList: { flex: 1, paddingTop: 8 },
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
    fontWeight: '400',
  },
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
  },
  templatesList: { paddingVertical: 10, paddingBottom: 30 },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
    minHeight: 80,
  },
  templateThumbnail: { position: 'relative', marginRight: 16 },
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
  },
  templateMusic: { fontSize: 14, color: '#666', marginBottom: 2 },
  templateUses: { fontSize: 12, color: '#999' },
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
  sheetSubtitle: { fontSize: 13, color: '#999' },
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
  sideActions: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
  },
});