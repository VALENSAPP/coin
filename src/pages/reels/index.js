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
  DeviceEventEmitter,
  Modal,
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
import { useThemeContext } from '../../theme/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ShareModal from '../../components/modals/ShareModal';
import ReportFlowScreen from '../../components/modals/Report';
import Clipboard from '@react-native-clipboard/clipboard';
import TipSupportModal from '../../components/modals/TipSupportModal';
import TokenSellModal from '../../components/modals/TokenSellModal';
import SupportCreatorModal from '../../components/modals/SupportCreatorModal';
import { getUserTokenInfoByBlockChain } from '../../services/tokens';
import { getSupportRecipientWalletAddress } from '../../utils/walletPaymentSupport';
import { useWalletConnectSupport } from '../../context/WalletConnectSupportContext';
import { normalizePostHashtags } from '../../utils/hashtagUtils';
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
import { useLanguage } from '../../i18n';
import useScreenshotProtection, {
  shouldProtectScreenshot,
} from '../../hooks/useScreenshotProtection';
import YoutubePlayer from 'react-native-youtube-iframe';
import {
  getPostMusicForSlide,
  getMusicTrimPlaybackWindowFromTrim,
} from '../../utils/postSoundtracks';
import { downloadMedia, getMediaFilename, isVideoMedia } from '../../utils/mediaDownload';
import { BASE_URL } from '../../config/urls';

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

const looksLikeYoutubeVideoId = value =>
  /^[a-zA-Z0-9_-]{11}$/.test(String(value || '').trim());

const parseYoutubeMusicMeta = rawMeta => {
  if (!rawMeta) return null;
  if (typeof rawMeta === 'object') return rawMeta;
  if (typeof rawMeta !== 'string') return null;
  try {
    return JSON.parse(rawMeta);
  } catch {
    return null;
  }
};

const resolveReelMusicLabel = raw => {
  const ytm = parseYoutubeMusicMeta(
    raw?.youtubeMusicMeta ?? raw?.youtube_music_meta ?? raw?.YoutubeMusicMeta,
  );
  if (ytm?.title) {
    return ytm.artist || ytm.channelTitle
      ? `${ytm.title} · ${ytm.artist || ytm.channelTitle}`
      : String(ytm.title);
  }
  const music = raw?.music;
  if (music && !looksLikeYoutubeVideoId(music) && String(music).trim() !== '') {
    return String(music);
  }
  return 'Original Audio';
};

const isPrivateReel = reel => {
  if (!reel || typeof reel !== 'object') return false;
  const visibleTo = String(reel.visibleTo ?? reel.visible_to ?? '').trim();
  if (visibleTo) return true;
  const type = String(reel.postType ?? reel.post_type ?? reel.type ?? '').trim().toLowerCase();
  return type === 'private';
};

const normalizeReelMediaUrl = value => {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('file://') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) return `${BASE_URL}${trimmed}`;
  return `${BASE_URL}/${trimmed}`;
};

/**
 * Plays attached flip soundtrack (YouTube / builtin mp3) while the reel is on screen.
 * Original video audio is muted by the parent when this track exists.
 */
const ReelSoundtrackPlayer = React.memo(function ReelSoundtrackPlayer({
  music,
  play,
}) {
  const ytRef = useRef(null);
  const mp3Ref = useRef(null);
  const durRef = useRef(180);
  const playRef = useRef(play);
  playRef.current = play;

  useEffect(() => {
    if (music?.kind !== 'youtube') return;
    (async () => {
      try {
        if (play) {
          await ytRef.current?.unMute?.();
          await ytRef.current?.playVideo?.();
        } else {
          await ytRef.current?.pauseVideo?.();
        }
      } catch (_) {
        /* ignore player teardown */
      }
    })();
  }, [play, music?.kind, music?.videoId]);

  useEffect(() => {
    if (music?.kind !== 'youtube' || !play) return;
    const trim = music.trim;
    const tick = setInterval(() => {
      (async () => {
        try {
          if (!playRef.current) return;
          const cur = await ytRef.current?.getCurrentTime?.();
          if (typeof cur !== 'number' || Number.isNaN(cur)) return;
          const dur = durRef.current || 180;
          const { start: playStart, end: playEnd, hasOverlap } =
            getMusicTrimPlaybackWindowFromTrim(trim, dur);
          const margin = Math.min(0.35, Math.max(0.08, (playEnd - playStart) * 0.02));
          if (hasOverlap && playEnd > playStart && cur >= playEnd - margin) {
            await ytRef.current?.seekTo?.(playStart, true);
          }
        } catch (_) {
          /* ignore */
        }
      })();
    }, 320);
    return () => clearInterval(tick);
  }, [music?.kind, music?.videoId, music?.trim?.start, music?.trim?.end, play]);

  useEffect(() => {
    return () => {
      try {
        ytRef.current?.pauseVideo?.();
        mp3Ref.current?.pause?.();
      } catch (_) {
        /* ignore */
      }
    };
  }, [music?.kind, music?.videoId, music?.audioUrl]);

  if (!music) return null;

  if (music.kind === 'mp3' && music.audioUrl) {
    return (
      <Video
        ref={mp3Ref}
        key={`reel_mp3_${music.audioUrl}`}
        source={{ uri: music.audioUrl }}
        style={styles.hiddenReelAudio}
        paused={!play}
        muted={!play}
        repeat={false}
        volume={play ? 1 : 0}
        resizeMode="contain"
        controls={false}
        playWhenInactive={false}
        ignoreSilentSwitch="ignore"
        onLoad={e => {
          const d = e?.duration > 0 ? e.duration : 180;
          durRef.current = d;
          const { start, hasOverlap } = getMusicTrimPlaybackWindowFromTrim(
            music.trim,
            d,
          );
          setTimeout(() => mp3Ref.current?.seek?.(hasOverlap ? start : 0), 80);
        }}
        onProgress={({ currentTime }) => {
          const dur = durRef.current || 180;
          const { start: ps, end: pe, hasOverlap } =
            getMusicTrimPlaybackWindowFromTrim(music.trim, dur);
          const margin = Math.min(0.35, Math.max(0.08, (pe - ps) * 0.02));
          if (hasOverlap && pe > ps && currentTime >= pe - margin) {
            mp3Ref.current?.seek?.(ps);
          }
        }}
      />
    );
  }

  if (music.kind === 'youtube' && music.videoId) {
    return (
      <View style={styles.hiddenReelYoutube} pointerEvents="none" collapsable={false}>
        <YoutubePlayer
          ref={ytRef}
          key={`reel_yt_${music.videoId}`}
          height={200}
          width={200}
          videoId={music.videoId}
          play={!!play}
          mute={false}
          volume={play ? 100 : 0}
          forceAndroidAutoplay
          initialPlayerParams={{ controls: false, modestbranding: true, rel: false }}
          onReady={async () => {
            try {
              const d = await ytRef.current?.getDuration?.();
              if (typeof d === 'number' && d > 0) {
                durRef.current = d;
              } else if (
                music.durationSec != null &&
                Number.isFinite(Number(music.durationSec))
              ) {
                durRef.current = Number(music.durationSec);
              }
              const dur = durRef.current || 180;
              const { start: ps, hasOverlap } = getMusicTrimPlaybackWindowFromTrim(
                music.trim,
                dur,
              );
              await ytRef.current?.seekTo?.(hasOverlap ? ps : 0, true);
              if (playRef.current) {
                await ytRef.current?.unMute?.();
                await ytRef.current?.playVideo?.();
              }
            } catch (_) {
              /* ignore */
            }
          }}
          onChangeState={() => {}}
        />
      </View>
    );
  }

  return null;
});

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
// ReelPinchVideoBlock
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
                  volume={muted ? 0 : 1}
                  onLoad={onVideoLoad}
                  onProgress={onVideoProgress}
                  progressUpdateInterval={500}
                  playWhenInactive={false}
                  ignoreSilentSwitch="ignore"
                  onReadyForDisplay={() => setVideoReady(true)}
                />
                {showThumbnailOverlay && (
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
                )}
              </>
            ) : (
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
// ReelItem
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
    // i18n
    tFlips,
  }) {
    const isCurrent = currentIndex === index;
    const isOwnReel =
      currentUserId != null &&
      item?.userId != null &&
      String(currentUserId) === String(item.userId);

    const postMusic = useMemo(
      () =>
        getPostMusicForSlide(
          {
            id: item.id,
            music: item.musicId ?? item.music,
            youtubeMusicMeta: item.youtubeMusicMeta,
            postMeta: item.postMeta,
          },
          0,
          null,
        ),
      [item.id, item.musicId, item.music, item.youtubeMusicMeta, item.postMeta],
    );
    const hasSoundtrack = Boolean(postMusic);
    const videoPaused = pausedMap[item.id] === true;
    const shouldPlaySoundtrack =
      hasSoundtrack && isCurrent && isFocused && !videoPaused;

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
          paused={videoPaused}
          muted={mutedMap[item.id] === true || hasSoundtrack}
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

        {isCurrent && hasSoundtrack ? (
          <ReelSoundtrackPlayer music={postMusic} play={shouldPlaySoundtrack} />
        ) : null}
        {/* Horizontal actions */}
        <View
          style={[
            styles.horizontalActions,
            { bottom: horizontalActionsBottom },
          ]}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => togglePlaybackSpeed(item.id)}
            accessibilityLabel={tFlips('flips.toggleSpeed')}>
            <View style={styles.actionIconSlot}>
              <Text style={styles.speedBadge}>
                {(playbackRateMap[item.id] ?? 1) + '×'}
              </Text>
            </View>
            <Text style={styles.actionLabel} numberOfLines={1}>
              {tFlips('flips.speedLabel')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleLike(item.id)}>
            <View style={styles.actionIconSlot}>
              <Thumbup
                width={26}
                height={26}
                style={[
                  styles.actionSvgIcon,
                  !likedMap[item.id] && styles.actionSvgIconInactive,
                ]}
              />
            </View>
            <Text style={styles.actionLabel} numberOfLines={1}>
              {formatCount(likesCountMap[item.id] || 0)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleComment(item.id)}>
            <View style={styles.actionIconSlot}>
              <Comments width={26} height={26} style={styles.actionSvgIcon} />
            </View>
            <Text style={styles.actionLabel} numberOfLines={1}>
              {formatCount(commentsCountMap[item.id] || 0)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => openShareSheet()}>
            <View style={styles.actionIconSlot}>
              <ShareIcom width={26} height={26} style={styles.actionSvgIcon} />
            </View>
            <Text style={styles.actionLabel} numberOfLines={1}>
              {tFlips('flips.shareLabel')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleMoreOptions(item)}
            accessibilityLabel={tFlips('flips.moreOptions') || 'More'}>
            <View style={styles.actionIconSlot}>
              <Feather name="more-vertical" size={22} color="#fff" />
            </View>
            <Text style={[styles.actionLabel, styles.actionLabelHidden]} numberOfLines={1}>
              {'\u00A0'}
            </Text>
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
                    {!item.isFollowing ? tFlips('flips.follow') : tFlips('flips.following')}
                  </Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.caption} numberOfLines={2}>
            {item.caption}
          </Text>
          {(() => {
            const tags = normalizePostHashtags(item?.hashtag ?? item?.hashtags);
            if (!tags.length) return null;
            return (
              <Text style={styles.hashtagRow} numberOfLines={2}>
                {tags.map(tag => `#${tag}`).join('  ')}
              </Text>
            );
          })()}
          <TouchableOpacity style={styles.likedBySection}>
            <Text style={styles.likedByText}>
              ❤️ {tFlips('flips.likedBy')}{' '}
              <Text style={styles.likedByBold}>
                {(() => {
                  const likeCount = Number(
                    item.likes ?? item.likeCount ?? 0,
                  );
                  if (likeCount === 0) return tFlips('flips.likedByNone');
                  if (likeCount === 1) return tFlips('flips.likedByOne');
                  return `${likeCount} ${tFlips('flips.likedByOthers')}`;
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
  const { text, bgStyle, card, border, mutedText, accent } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const { t } = useLanguage();

  const sheetTheme = useMemo(() => ({
    backgroundColor: card,
    borderColor: border,
    labelColor: isDarkMode ? '#ffffff' : '#111827',
    iconColor: isDarkMode ? '#ffffff' : '#111827',
    mutedColor: mutedText,
    accentColor: accent,
    reasonItemBg: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F8F8F8',
    reasonIconBg: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(90,45,130,0.06)',
  }), [card, border, mutedText, accent, isDarkMode]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [reels, setReels] = useState([]);
  const reelsRef = useRef(reels);
  useEffect(() => {
    reelsRef.current = reels;
  }, [reels]);
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
  const suppressScrollDerivedIndexRef = useRef(false);
  const videoRefs = useRef({});
  const videoProgressRef = useRef({});
  const videoProgressAnimRef = useRef({});
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
  const [supportDisclaimerVisible, setSupportDisclaimerVisible] = useState(false);
  const [tipPurchaseVisible, setTipPurchaseVisible] = useState(false);
  const [purchaseAutoFocus, setPurchaseAutoFocus] = useState(false);
  const [pendingFollowUserId, setPendingFollowUserId] = useState(null);
  const [pendingFollowAction, setPendingFollowAction] = useState(null);
  const [followingBusy, setFollowingBusy] = useState(new Set());
  const [tokenAddress, setTokenAddress] = useState(null);
  const [currentUserProfileType, setCurrentUserProfileType] = useState('user');

  const { startSupportPayment } = useWalletConnectSupport();

  const shouldProtectPrivateContent = useMemo(() => {
    const currentReel = reels[currentIndex] ?? route.params?.item;
    return shouldProtectScreenshot({
      posts: currentReel ? [currentReel] : [],
      routeParams: route.params,
      currentUserId,
    });
  }, [currentIndex, reels, route.params, currentUserId]);

  useScreenshotProtection({
    enabled: shouldProtectPrivateContent,
    title: t('postView.screenshotWarningTitle'),
    message: t('postView.screenshotWarningMessage'),
  });

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

  const notInterestedOptions = [
    t('flips.notInterestedOption1'),
    t('flips.notInterestedOption2'),
    t('flips.notInterestedOption3'),
    t('flips.notInterestedOption4'),
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
      showToastMessage(toast, 'success', t('flips.notInterestedToast'));
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
              thumbnails: Array.isArray(raw?.thumbnails) ? raw.thumbnails : [],
              thumbnail:
                raw?.thumbnails?.[0] || raw?.thumbnail || raw?.thumbNail ||
                raw?.videoThumbnail || raw?.coverImage || raw?.poster ||
                raw?.images?.[1] || raw?.image || raw?.images?.[0] || '',
              user: raw?.userName || raw?.username || raw?.user || 'Unknown User',
              avatar: raw?.userImage || raw?.avatar || 'https://randomuser.me/api/portraits/men/1.jpg',
              caption: raw?.caption || raw?.text || 'No caption',
              music: resolveReelMusicLabel(raw),
              musicId: raw?.music ?? raw?.Music ?? null,
              youtubeMusicMeta:
                raw?.youtubeMusicMeta ??
                raw?.youtube_music_meta ??
                raw?.YoutubeMusicMeta ??
                null,
              postMeta: raw?.postMeta ?? raw?.post_meta ?? raw?.PostMeta ?? null,
              likes: raw?.likeCount || raw?.likes || 0,
              comments: raw?.commentCount || raw?.comments || 0,
              shares: raw?.shareCount || raw?.shares || 0,
              isLiked: raw?.isLike || raw?.isLiked || false,
              isFollowing: raw?.isFollow || raw?.isFollowing || false,
              views: formatCount(Math.floor(Math.random() * 1000000) + 100000),
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
                raw?.walletAddress || raw?.userWalletAddress ||
                raw?.creatorWalletAddress || raw?.vendorWalletAddress ||
                raw?.receiverWalletAddress || null,
              hashtag: raw?.hashtag ?? raw?.hashtags ?? [],
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
              normalizeReel(item, { fallbackIdPrefix: 'profile', fallbackIndex: index }),
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
            if (dedupedApiReels.length > 0) setReels(dedupedApiReels);
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
            ...dedupedApiReels.filter(r => String(r?.id) !== paramId),
          ];
          setReels(next);
          setSelectedReelId(normalizedParamReel.id);
          setCurrentIndex(0);
        } else {
          showToastMessage(
            toast,
            'danger',
            response?.data?.message || t('flips.fetchReelsFailed'),
          );
          if (paramReel && exploreScrollBackupRef.current.length > 0) {
            setReels(exploreScrollBackupRef.current);
            setCurrentIndex(0);
          }
          suppressScrollDerivedIndexRef.current = false;
        }
      } catch (error) {
        showToastMessage(
          toast,
          'danger',
          error?.response?.message ?? t('flips.somethingWentWrong'),
        );
        if (paramReel && exploreScrollBackupRef.current.length > 0) {
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
      t,
    ],
  );

  useEffect(() => {
    const paramReel = route.params?.item;
    if (paramReel) {
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
      showToastMessage(toast, 'danger', t('flips.noLinkToCopy'));
      return;
    }
    Clipboard.setString(url);
    showToastMessage(toast, 'success', t('flips.linkCopied'));
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
    const returnToTab = route.params?.returnToTab;
    const returnToScreen = route.params?.returnToScreen;

    if (returnToTab && returnToScreen) {
      navigation.navigate(returnToTab, { screen: returnToScreen, params: returnParams });
      return;
    }

    if (returnTo == "Search" || returnTo == "SearchHome") {
      // Search is a tab route (now a stack). Prefer goBack within Search stack.
      if (navigation.canGoBack()) {
        navigation.goBack();
        return;
      }
      const parentNav = navigation.getParent?.();
      if (parentNav?.navigate) {
        parentNav.navigate('Search', { screen: 'SearchHome', params: returnParams });
      } else {
        navigation.navigate('Search', { screen: 'SearchHome', params: returnParams });
      }
      return;
    }

    if (returnTo) {
      // Back-compat for older callers that only send a leaf route name.
      navigation.navigate('HomeMain', { screen: returnTo, params: returnParams });
      return;
    }

    // Prefer normal back behavior only when no explicit return target was provided.
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('HomeMain', { screen: 'Home' });
  }, [navigation, route.params]);

  const handleScroll = useCallback(
    event => {
      const offsetY = event.nativeEvent.contentOffset.y || 0;
      const h = viewportHeight || 1;
      const pageIdx = Math.round(offsetY / h);
      const maxIndex = Math.max(0, reels.length - 1);
      const validIdx = Math.min(Math.max(0, pageIdx), maxIndex);
      if (!suppressScrollDerivedIndexRef.current) {
        setCurrentIndex(prev => (prev !== validIdx ? validIdx : prev));
      }

      const maxScroll = maxIndex * viewportHeight;
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
          if (serverCount !== undefined)
            setLikesCount(prev => ({ ...prev, [id]: serverCount }));
        } else {
          setLiked(prev => ({ ...prev, [id]: wasLiked }));
          setLikesCount(prev => ({ ...prev, [id]: prevCount }));
          showToastMessage(
            toast, 'danger',
            res?.data?.message || t('flips.likeToggleFailed'),
          );
        }
      } catch (e) {
        setLiked(prev => ({ ...prev, [id]: wasLiked }));
        setLikesCount(prev => ({ ...prev, [id]: prevCount }));
        showToastMessage(
          toast, 'danger',
          e?.response?.data?.message || t('flips.somethingWentWrong'),
        );
      } finally {
        setLikingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [liked, likesCount, likingIds, toast, t],
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
            toast, 'danger',
            res?.data?.message || t('flips.followUpdateFailed'),
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
          toast, 'danger',
          e?.response?.data?.message || t('flips.somethingWentWrong'),
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
    [getReelOwnerId, toast, t],
  );

  const handleToggleFollow = useCallback(
    async (targetUserId, shouldFollow) => {
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
      ) return;
      const shouldFollow = !item.isFollowing;
      const result = await executeFollowAction(targetUserId, shouldFollow, item.userTokenAddress);
      const success = typeof result === 'boolean' ? result : true;
      if (!success || !shouldFollow) return;
      const recipientProfile = normalizeProfileType(item?.profile);
      const supporterProfile = normalizeProfileType(currentUserProfileType);
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
      if (pendingFollowUserId != null && pendingFollowAction != null)
        await executeFollowAction(pendingFollowUserId, pendingFollowAction);
    } finally {
      setPendingFollowUserId(null);
      setPendingFollowAction(null);
      setPurchaseAutoFocus(false);
    }
  }, [executeFollowAction, pendingFollowAction, pendingFollowUserId]);

  const handleTokenSell = useCallback(async () => {
    sellSheetRef.current?.close?.();
    if (pendingFollowUserId != null)
      await executeFollowAction(pendingFollowUserId, false);
    setPendingFollowUserId(null);
    setPendingFollowAction(null);
    showToastMessage(toast, 'success', t('flips.tokensSoldSuccess'));
  }, [executeFollowAction, pendingFollowUserId, toast, t]);

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
        : null) || currentReel || null,
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

  const recipientWalletAddress = getSupportRecipientWalletAddress(currentReel || {});
  const supporterProfile = normalizeProfileType(currentUserProfileType);
  const recipientProfile = normalizeProfileType(currentReel?.profile);

  const handleSupportNow = useCallback(async () => {
    if (!recipientWalletAddress) {
      const creatorName =
        currentReel?.user ||
        currentReel?.userName ||
        currentReel?.username ||
        currentReel?.displayName ||
        t('flips.creatorFallback');
      Alert.alert(
        t('flips.walletNotConnectedTitle'),
        t('flips.walletNotConnectedMessage', { name: creatorName }),
      );
      return;
    }
    setSupportDisclaimerVisible(false);
    const receiverId = currentReel?.UserId ?? currentReel?.userId ?? '';
    await startSupportPayment(recipientWalletAddress, {
      senderId: currentUserId != null ? String(currentUserId) : '',
      receiverId: receiverId !== '' ? String(receiverId) : '',
      chain: 'POLYGON',
    });
  }, [currentReel, currentUserId, recipientWalletAddress, startSupportPayment, t]);

  const handleOpenSupportDisclaimer = useCallback(() => {
    if (!isSupportAllowed({ supporterProfile, recipientProfile })) {
      Alert.alert(
        t('flips.supportUnavailableTitle'),
        t('flips.supportUnavailableMessage'),
      );
      setModalVisible(false);
      return;
    }
    setModalVisible(false);
    setSupportDisclaimerVisible(true);
  }, [recipientProfile, supporterProfile, t]);

  const handleSendTip = useCallback(() => {
    setSupportDisclaimerVisible(false);
    setTipPurchaseVisible(true);
  }, []);

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

  const stableDoubleTap = useCallback(id => {
    handleDoubleTapLeftRef.current?.(id);
  }, []);

  const stableSingleTap = useCallback(id => {
    handleSingleTapToggleRef.current?.(id);
  }, []);

  const getDurationSecForReel = useCallback(
    (id, fallbackMs = 30000) => {
      const fromRef = videoDurationSecRef.current[id];
      if (fromRef) return fromRef;
      const ms = reels.find(r => r.id === id)?.duration ?? fallbackMs;
      return Math.max(0.001, Number(ms) / 1000);
    },
    [reels],
  );

  const seekReelToLocationX = useCallback(
    (id, locationX) => {
      const videoRef = videoRefs.current[id];
      if (!videoRef?.seek) return;
      const outerW = progressBarWidthRef.current || windowWidth;
      const innerW = Math.max(1, outerW - 2 * FLIPS_PROGRESS_H_PADDING);
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
          setSaved(prev => ({ ...prev, [reelId]: !isCurrentlySaved }));
        } else {
          showToastMessage(toast, 'danger', resp.data.message);
        }
      } catch (err) {
        showToastMessage(
          toast, 'danger',
          err?.response?.data?.message ?? t('flips.somethingWentWrong'),
        );
      } finally {
        setSavingIds(prev => {
          const next = new Set(prev);
          next.delete(reelId);
          return next;
        });
      }
    },
    [saved, savingIds, toast, t],
  );

  const handleCommentClose = useCallback(() => {
    commentSheetRef.current?.close();
    setCommentPostId(null);
  }, []);

  const handleCommentCountUpdate = useCallback((postId, newCount) => {
    setCommentsCount(prev => ({ ...prev, [postId]: Math.max(0, newCount) }));
  }, []);

  const loopingReels = useMemo(
    () =>
      reels.length > 1
        ? [
            ...reels.map((item, index) => ({
              ...item,
              __loopKey: `reel-${String(item?.id ?? index)}`,
            })),
            {
              ...reels[0],
              __loopKey: 'reel-loop-sentinel',
            },
          ]
        : reels,
    [reels],
  );

  useEffect(() => {
    if (!flatListRef.current || !selectedReelId || reels.length === 0) return;
    const idx = reels.findIndex(r => String(r?.id) === String(selectedReelId));
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

    requestAnimationFrame(() => requestAnimationFrame(scrollToTarget));
  }, [selectedReelId, reels, viewportHeight]);

  const handleShare = async item => {
    try {
      const result = await Share.share({
        message: `${t('flips.shareMessage')} @${item.user}!\n\n"${item.caption}"\n\n${t('flips.shareVia')}`,
        title: `${t('flips.shareTitle')} @${item.user}`,
      });
      if (result.action === Share.sharedAction) {
        setReels(prev =>
          prev.map(reel =>
            reel.id === item.id ? { ...reel, shares: reel.shares + 1 } : reel,
          ),
        );
      }
    } catch {
      Alert.alert(t('flips.errorTitle'), t('flips.shareFailedMessage'));
    }
  };

  const handleMoreOptions = useCallback(item => {
    setSelectedReelId(item.id);
    moreOptionsSheetRef.current?.open();
  }, []);

  const handleDownloadReel = useCallback(
    async reel => {
      if (!reel || isPrivateReel(reel)) {
        showToastMessage(toast, 'danger', t('flips.somethingWentWrong'));
        return;
      }

      const mediaUrl = normalizeReelMediaUrl(
        reel?.video || reel?.images?.[0] || reel?.image || '',
      );
      if (!mediaUrl) {
        showToastMessage(toast, 'danger', t('flips.somethingWentWrong'));
        return;
      }

      console.log('[Flips] downloading reel media:', mediaUrl);
      await downloadMedia(
        mediaUrl,
        getMediaFilename(mediaUrl, 0),
        isVideoMedia({ uri: mediaUrl, type: reel?.type }),
        toast,
      );
    },
    [t, toast],
  );

  const openShareSheet = useCallback(() => {
    shareRef.current?.open?.();
  }, []);

  const deleteReelById = useCallback(
    async reelId => {
      if (!reelId) return;
      let removedReel = null;
      let removedIndex = -1;
      let nextReelsLength = 0;

      try {
        const userId = currentUserId ?? (await AsyncStorage.getItem('userId'));
        if (!userId) {
          showToastMessage(toast, 'danger', t('flips.noUserIdError'));
          return;
        }

        dispatch(showLoader());

        setReels(prev => {
          removedIndex = prev.findIndex(r => String(r?.id) === String(reelId));
          if (removedIndex >= 0) {
            removedReel = prev[removedIndex];
          }
          const next = prev.filter(r => String(r?.id) !== String(reelId));
          nextReelsLength = next.length;
          const maxIdx = Math.max(0, nextReelsLength - 1);
          setCurrentIndex(ci => Math.max(0, Math.min(ci, maxIdx)));
          return next;
        });

        setSelectedReelId(null);
        moreOptionsSheetRef.current?.close?.();

        const res = await deletePost(String(reelId), String(userId));

        if (res?.statusCode === 200 && (res?.success ?? true)) {
          showToastMessage(toast, 'success', res?.data?.message || t('flips.flipDeleted'));
          DeviceEventEmitter.emit('HOME_TAB_PRESS');

          if (nextReelsLength === 0) {
            handleBackPress();
          }
        } else {
          showToastMessage(
            toast, 'danger',
            res?.data?.message || res?.message || t('flips.deleteReelFailed'),
          );

          if (removedReel) {
            setReels(prev => {
              const restored = [...prev];
              restored.splice(Math.max(0, Math.min(removedIndex, restored.length)), 0, removedReel);
              return restored;
            });
          }
        }
      } catch (e) {
        showToastMessage(
          toast, 'danger',
          e?.response?.data?.message || e?.message || t('flips.deleteReelError'),
        );

        if (removedReel) {
          setReels(prev => {
            const restored = [...prev];
            restored.splice(Math.max(0, Math.min(removedIndex, restored.length)), 0, removedReel);
            return restored;
          });
        }
      } finally {
        dispatch(hideLoader());
      }
    },
    [currentUserId, dispatch, toast, t, handleBackPress],
  );

  const confirmDeleteReel = useCallback(
    reelId => {
      Alert.alert(
        t('flips.deleteReelTitle'),
        t('flips.deleteReelMessage'),
        [
          { text: t('flips.cancel'), style: 'cancel' },
          {
            text: t('flips.delete'),
            style: 'destructive',
            onPress: () => deleteReelById(reelId),
          },
        ],
      );
    },
    [deleteReelById, t],
  );

  const handleVideoLoad = useCallback((itemId, data) => {
    const durSec = Math.max(0.001, data.duration);
    videoDurationSecRef.current[itemId] = durSec;
    if (!videoProgressAnimRef.current[itemId]) {
      videoProgressAnimRef.current[itemId] = new Animated.Value(0);
    }
  }, []);

  const handleVideoProgress = useCallback((itemId, data) => {
    if (scrubbingReelIdRef.current === itemId) return;
    const t = data.currentTime;
    videoProgressRef.current[itemId] = t;
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
    const userId = currentUserId ?? (await AsyncStorage.getItem('userId'));
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
  }, [currentIndex, currentUserId, navigation, reels, route.params?.item]);

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
        <Text style={styles.templateUses}>{item.uses} {t('flips.templateUses')}</Text>
      </View>
      <TouchableOpacity style={styles.useTemplateBtn}>
        <Text style={styles.useTemplateBtnText}>{t('flips.templateUse')}</Text>
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
          setCurrentUserProfileType(normalizeProfileType(profile || 'user'));
      } catch {
        if (isMounted) setCurrentUserProfileType('user');
      }
    };
    loadCurrentUserId();
    loadCurrentUserProfile();
    return () => { isMounted = false; };
  }, [isFocused]);

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
        tFlips={t}
      />
    ),
    [
      currentIndex, windowWidth, viewportHeight, isFocused, playbackRate,
      paused, muted, isBuffering, liked, likesCount, commentsCount, saved,
      heartAnimatingId, scaleAnim, followingBusy, currentUserId, sideActionsBottom,
      bottomContentBottom, horizontalActionsBottom, onPinchLockChange,
      handleVideoLoad, handleVideoProgress, registerVideoRef, stableDoubleTap,
      stableSingleTap, handleLike, handleComment, openShareSheet, handleMoreOptions,
      handleFollowPress, handleUserNavigate, togglePlaybackSpeed, getReelOwnerId,
      formatCount, text, t,
    ],
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
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
          <TouchableOpacity onPress={handleBackPress} style={styles.buttons}>
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerLeft}
            onPress={() => setDropdownVisible(v => !v)}>
            <Text style={styles.logo}>{t('flips.screenTitle')}</Text>
            <Icon name="chevron-down" size={18} color="#fff" style={styles.chevronIcon} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton}>
            <Feather name="camera" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Progress scrub bar */}
        {reels.length > 0 && reels[currentIndex]?.id
          ? (() => {
            const activeId = reels[currentIndex].id;
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
                    progressBarWidthRef.current = e.nativeEvent.layout.width;
                  }}>
                  <Animated.View
                    style={{
                      height: trackHeight,
                      backgroundColor: 'rgba(255,255,255,0.3)',
                      borderRadius: 4,
                      overflow: 'visible',
                    }}>
                    <Animated.View
                      style={{
                        position: 'absolute',
                        left: 0, top: 0, bottom: 0,
                        width: fillWidth,
                        backgroundColor: '#fff',
                        borderRadius: 4,
                        opacity: trackOpacity,
                      }}
                    />
                    <Animated.View
                      style={{
                        position: 'absolute',
                        left: thumbLeft,
                        top: '50%',
                        width: 16, height: 16,
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
          data={loopingReels}
          keyExtractor={(item, index) =>
            String(item?.__loopKey ?? item?.id ?? index)
          }
          renderItem={renderItem}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          windowSize={3}
          initialNumToRender={3}
          maxToRenderPerBatch={2}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={e => {
            if (suppressScrollDerivedIndexRef.current) return;
            if (reels.length === 0) return;
            const offsetY = e.nativeEvent.contentOffset.y || 0;
            const h = viewportHeight || 1;
            const idx = Math.round(offsetY / h);
            const maxIndex = reels.length - 1;
            const loopSentinelIndex = reels.length;
            const validIdx = Math.min(Math.max(0, idx), maxIndex);
            setCurrentIndex(validIdx);

            // If the user lands on the duplicated first reel, snap back to the real first item.
            if (idx === loopSentinelIndex && reels.length > 1) {
              requestAnimationFrame(() => {
                flatListRef.current?.scrollToIndex({
                  index: 0,
                  animated: false,
                });
                setCurrentIndex(0);
              });
              return;
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
          scrollEnabled={reels.length > 0 && !isScrubbing && !pinchScrollLock}
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
            <TouchableWithoutFeedback onPress={() => setDropdownVisible(false)}>
              <View style={styles.dropdownBackdrop} />
            </TouchableWithoutFeedback>
            <View style={styles.dropdown}>
              <View style={styles.arrowUp} />
              <TouchableOpacity style={styles.dropdownOption}>
                <Icon name="people-outline" size={22} color="#000" />
                <Text style={styles.dropdownText}>{t('flips.dropdownFollowing')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dropdownOption}>
                <Icon name="location-outline" size={22} color="#000" />
                <Text style={styles.dropdownText}>{t('flips.dropdownNearby')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <RBSheet
          ref={commentSheetRef}
          height={560}
          openDuration={250}
          draggable
          closeOnPressMask
          customModalProps={{ statusBarTranslucent: true }}
          customAvoidingViewProps={{ enabled: false }}
          onClose={() => {
            Keyboard.dismiss();
            setCommentPostId(null);
          }}
          customStyles={{
            container: [
              { borderTopLeftRadius: 18, borderTopRightRadius: 18 },
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
              backgroundColor: sheetTheme.backgroundColor,
            },
          }}
          closeOnDragDown
          closeOnPressMask>
          <View style={[styles.moreOptionsContainer, { backgroundColor: sheetTheme.backgroundColor }]}>
            <View style={[styles.moreOptionsHeader, { borderBottomColor: sheetTheme.borderColor }]}>
              <Text style={[styles.moreOptionsTitle, { color: sheetTheme.labelColor }]}>
                {t('flips.moreOptionsTitle')}
              </Text>
            </View>
            <ScrollView style={styles.moreOptionsList}>
              <TouchableOpacity
                style={[styles.moreOption, { borderBottomColor: sheetTheme.borderColor }]}
                onPress={() => {
                  handleToggleSave(selectedReelId || reels[currentIndex]?.id);
                  moreOptionsSheetRef.current?.close();
                }}>
                <Icon
                  name={saved[selectedReelId || reels[currentIndex]?.id] ? 'bookmark' : 'bookmark-outline'}
                  size={24}
                  color={sheetTheme.iconColor}
                />
                <Text style={[styles.moreOptionText, { color: sheetTheme.labelColor }]}>
                  {saved[selectedReelId || reels[currentIndex]?.id]
                    ? t('flips.saved')
                    : t('flips.save')}
                </Text>
                </TouchableOpacity>
              {!isPrivateReel(activeReel) && (
                <TouchableOpacity
                  style={[styles.moreOption, { borderBottomColor: sheetTheme.borderColor }]}
                  onPress={() => {
                    const reel = reels.find(r => r.id === selectedReelId) || reels[currentIndex];
                    moreOptionsSheetRef.current?.close();
                    void handleDownloadReel(reel);
                  }}>
                  <Icon name="download-outline" size={24} color={sheetTheme.iconColor} />
                  <Text style={[styles.moreOptionText, { color: sheetTheme.labelColor }]}>
                    {t('Download')}
                  </Text>
                </TouchableOpacity>
              )}
              {canDeleteActiveReel && (
                <TouchableOpacity
                  style={[styles.moreOption, { borderBottomColor: sheetTheme.borderColor }]}
                  onPress={() => {
                    moreOptionsSheetRef.current?.close();
                    confirmDeleteReel(activeReelId);
                  }}>
                  <Icon name="trash-outline" size={24} color={sheetTheme.iconColor} />
                  <Text style={[styles.moreOptionText, { color: sheetTheme.labelColor }]}>
                    {t('flips.delete')}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.moreOption, { borderBottomColor: sheetTheme.borderColor }]}
                onPress={() => {
                  moreOptionsSheetRef.current?.close();
                  setTimeout(() => reportSheetRef.current?.open(), 200);
                }}>
                <Icon name="flag-outline" size={24} color={sheetTheme.iconColor} />
                <Text style={[styles.moreOptionText, { color: sheetTheme.labelColor }]}>
                  {t('flips.report')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.moreOption, { borderBottomColor: sheetTheme.borderColor }]}
                onPress={() => {
                  moreOptionsSheetRef.current?.close();
                  setTimeout(() => notInterestedSheetRef.current?.open?.(), 220);
                }}>
                <Icon name="eye-off-outline" size={24} color={sheetTheme.iconColor} />
                <Text style={[styles.moreOptionText, { color: sheetTheme.labelColor }]}>
                  {t('flips.notInterested')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.moreOption, { borderBottomColor: sheetTheme.borderColor }]}
                onPress={() => {
                  const reel =
                    reels.find(r => r.id === selectedReelId) || reels[currentIndex];
                  copyToClipboard(reel?.video || reel?.images?.[0] || reel?.image || '');
                  moreOptionsSheetRef.current?.close();
                }}>
                <Icon name="copy-outline" size={24} color={sheetTheme.iconColor} />
                <Text style={[styles.moreOptionText, { color: sheetTheme.labelColor }]}>
                  {t('flips.copyLink')}
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
              <TouchableOpacity onPress={() => musicTemplatesSheetRef.current?.close()}>
                <Icon name="close" size={24} color="#000" />
              </TouchableOpacity>
              <Text style={styles.templatesTitle}>{t('flips.musicTemplatesTitle')}</Text>
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
            container: {
              ...styles.sheetContainer,
              backgroundColor: sheetTheme.backgroundColor,
            },
            overlay: { backgroundColor: 'rgba(0,0,0,0.4)' },
          }}>
          <View style={[styles.dragHandle, { backgroundColor: sheetTheme.borderColor }]} />
          <View style={styles.headerContainer}>
            <View style={[styles.headerIcon, { backgroundColor: sheetTheme.reasonIconBg }]}>
              <Icon name="eye-off" size={22} color={sheetTheme.accentColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetTitle, { color: sheetTheme.labelColor }]}>
                {t('flips.notInterestedTitle')}
              </Text>
              <Text style={[styles.sheetSubtitle, { color: sheetTheme.mutedColor }]}>
                {t('flips.notInterestedSubtitle')}
              </Text>
            </View>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}>
            {notInterestedOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.reasonItem,
                  {
                    backgroundColor: sheetTheme.reasonItemBg,
                    borderColor: sheetTheme.borderColor,
                  },
                ]}
                onPress={() => handleNotInterestedSelect(option)}>
                <View style={[styles.reasonIconWrapper, { backgroundColor: sheetTheme.reasonIconBg }]}>
                  <Icon name="eye-off" size={18} color={sheetTheme.accentColor} />
                </View>
                <Text style={[styles.reasonText, { color: sheetTheme.labelColor }]}>{option}</Text>
                <Icon name="chevron-forward" size={20} color={sheetTheme.mutedColor} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </RBSheet>

        <ShareModal ref={shareRef} reel={reels[currentIndex]} reelId={reels[currentIndex]?.id} />
        <ReportFlowScreen ref={reportSheetRef} postId={selectedReelId || reels[currentIndex]?.id} />
        <SupportCreatorModal
          visible={modalVisible}
          creatorName={currentReel?.user || t('flips.creatorFallback')}
          onClose={() => setModalVisible(false)}
          onSupport={handleOpenSupportDisclaimer}
        />
        <SupportCreatorModal
          visible={supportDisclaimerVisible}
          creatorName={currentReel?.user || t('flips.creatorFallback')}
          variant="disclaimer"
          onClose={() => setSupportDisclaimerVisible(false)}
          onSupport={handleSupportNow}
          onTipSupport={handleSendTip}
          canSupport={!!recipientWalletAddress}
        />
        <TipSupportModal
          visible={tipPurchaseVisible}
          creatorName={currentReel?.user || t('flips.creatorFallback')}
          vendorId={currentReel?.UserId ?? currentReel?.userId}
          onClose={() => setTipPurchaseVisible(false)}
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
    lineHeight: 28,
    height: 28,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
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
    left: 8,
    right: 78,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  actionButton: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  actionIconSlot: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSvgIcon: { opacity: 1 },
  actionSvgIconInactive: { opacity: 0.7 },
  actionLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
    height: 16,
    lineHeight: 16,
    textAlign: 'center',
    width: '100%',
  },
  actionLabelHidden: {
    color: 'transparent',
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
  hiddenReelAudio: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    left: -9999,
    top: -9999,
  },
  hiddenReelYoutube: {
    position: 'absolute',
    width: 200,
    height: 200,
    opacity: 0.02,
    left: -400,
    top: -400,
    zIndex: -1,
  },
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
  hashtagRow: {
    color: '#9FDAFF',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 4,
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  moreOptionsHeader: {
    borderBottomWidth: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  moreOptionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  moreOptionsList: { flex: 1, paddingTop: 8 },
  moreOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    minHeight: 60,
  },
  moreOptionText: {
    fontSize: 16,
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
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  sheetSubtitle: { fontSize: 13 },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  reasonIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reasonText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  sideActions: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
  },
  tipModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 8, 20, 0.45)',
    justifyContent: 'flex-end',
  },
  tipModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 500,
    paddingBottom: 20,
  },
});
