import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  FlatList,
  Image,
  Modal,
  TextInput,
  Platform,
  PanResponder,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Animated,
  Dimensions,
  StyleSheet,
  Keyboard,
  AppState,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Video, { ViewType } from 'react-native-video';
import VideoPlayer from '@iftek/react-native-video-player';
import YoutubePlayer from 'react-native-youtube-iframe';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import createStyles from '../../../pages/home/Style';
import HexAvatar from './HexAvatar';
import StoryComposer from './StoryComposer';
import {
  modalStyles,
  likeStyles,
  inputStyles,
  optStyles,
  burstStyles,
} from './Style';
import { getStoryByUser, PostStory, DeleteStory, getFollowingUserStories } from '../../../services/stories';
import { buildStoryMetaPayload } from '../../../utils/buildStoryMeta';
import {
  appendStoryAudioFiles,
  getStoryBuiltinLibraryUrl,
  prepareStoryClipsAudioForUpload,
} from '../../../utils/storyAudioUpload';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showToastMessage } from '../../displaytoastmessage';
import { Toast, useToast } from 'react-native-toast-notifications';
import { getUserCredentials } from '../../../services/post';
import Feather from 'react-native-vector-icons/Feather';
import { sendMessage as sendChatMessage } from '../../../services/chatMessage';

import { postCommentStory, postLikeStory } from '../../../services/stories';
import { useDispatch, useSelector } from 'react-redux';
import { hideLoader, showLoader } from '../../../redux/actions/LoaderAction';
import { setProfileImg } from '../../../redux/actions/ProfileImgAction';
import ShareModal from '../../modals/ShareModal';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const DOUBLE_TAP_DELAY = 300;

/** API may return `storyMeta` as object or JSON string */
function parseStoryMeta(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return typeof raw === 'object' ? raw : null;
}

/**
 * When `clips[idx].isVideo` is missing, infer from URL. CDN/signed URLs often have no
 * trailing extension, so we match known video substrings in the path (before `?`).
 */
function inferStoryMediaTypeFromUrl(url) {
  if (typeof url !== 'string') return 'image';
  const lower = url.toLowerCase().trim();
  const pathPart = lower.split('?')[0];
  const videoMarkers = [
    '.mp4',
    '.mov',
    '.m4v',
    '.avi',
    '.webm',
    '.mkv',
    '.flv',
    '.wmv',
    '.3gp',
    '.m3u8',
    '.mpg',
    '.mpeg',
  ];
  if (videoMarkers.some(m => pathPart.includes(m))) {
    return 'video';
  }
  if (pathPart.endsWith('/video') || lower.includes('/video/')) {
    return 'video';
  }
  if (
    lower.includes('type=video') ||
    lower.includes('content_type=video') ||
    lower.includes('format=mp4')
  ) {
    return 'video';
  }
  return 'image';
}

function looksLikeImageUrl(url) {
  if (typeof url !== 'string') return false;
  const pathPart = url.split('?')[0].toLowerCase();
  return /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(pathPart);
}

/** Story upload meta stores duration in seconds; some APIs may send ms. */
function clipDurationSuggestsVideo(clipMeta) {
  let d = Number(clipMeta?.duration);
  if (!Number.isFinite(d) || d <= 0) return false;
  if (d > 500) d = d / 1000;
  return d > 0.35 && d < 7200;
}

/**
 * Resolve image vs video: URL hints, `clips[].isVideo`, and duration from `storyMeta`
 * (needed when CDN URLs have no file extension — otherwise videos render as `<Image>`).
 */
function resolveStoryClipType(url, clipMeta) {
  const inferred = inferStoryMediaTypeFromUrl(url);
  const strUrl = typeof url === 'string' ? url : '';

  if (looksLikeImageUrl(strUrl)) {
    if (clipMeta?.isVideo === true) return 'video';
    return 'image';
  }

  if (clipMeta?.isVideo === true) return 'video';
  if (inferred === 'video') return 'video';

  if (clipMeta && typeof clipMeta.isVideo === 'boolean' && clipMeta.isVideo === false) {
    if (clipDurationSuggestsVideo(clipMeta)) return 'video';
    return 'image';
  }

  if (clipDurationSuggestsVideo(clipMeta)) return 'video';

  return inferred;
}

const storyYoutubeAudioStyle = {
  position: 'absolute',
  width: 200,
  height: 200,
  opacity: 0.02,
  left: -220,
  top: 0,
  zIndex: 5,
  overflow: 'hidden',
};

const storyVideoPlayerCustomStyles = {
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  videoWrapper: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  controls: {
    opacity: 0,
    height: 0,
    overflow: 'hidden',
  },
  playControl: {
    opacity: 0,
  },
  controlButton: {
    opacity: 0,
  },
  controlIcon: {
    opacity: 0,
  },
  playIcon: {
    opacity: 0,
  },
  seekBar: {
    opacity: 0,
    height: 0,
  },
  seekBarFullWidth: {
    opacity: 0,
    height: 0,
  },
  seekBarProgress: {
    opacity: 0,
    height: 0,
  },
  seekBarKnob: {
    opacity: 0,
    width: 0,
    height: 0,
  },
  seekBarBackground: {
    opacity: 0,
    height: 0,
  },
  thumbnail: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  playButton: {
    opacity: 0,
  },
  playArrow: {
    opacity: 0,
  },
};

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function resolveStoryDurationMs(storyLike) {
  const isVideo = storyLike?.type === 'video' || !!storyLike?.isVideo;
  const fallbackMs = isVideo ? 15000 : 5000;

  const explicitMs = toFiniteNumber(storyLike?.duration);
  if (explicitMs != null && explicitMs > 0) return explicitMs;

  const visualTrimStart = Math.max(0, toFiniteNumber(storyLike?.trim?.start) || 0);
  const visualTrimEndRaw = toFiniteNumber(storyLike?.trim?.end);
  const visualTrimSec =
    visualTrimEndRaw != null && visualTrimEndRaw > visualTrimStart
      ? visualTrimEndRaw - visualTrimStart
      : null;

  const audioTrimStart = Math.max(0, toFiniteNumber(storyLike?.audioTrim?.start) || 0);
  const audioTrimEndRaw = toFiniteNumber(storyLike?.audioTrim?.end);
  const audioTrimSec =
    audioTrimEndRaw != null && audioTrimEndRaw > audioTrimStart
      ? audioTrimEndRaw - audioTrimStart
      : null;

  const chosenSec = isVideo ? visualTrimSec : (audioTrimSec ?? visualTrimSec);
  if (chosenSec != null && chosenSec > 0) {
    return Math.max(1000, Math.round(chosenSec * 1000));
  }
  return fallbackMs;
}

function looksLikeUrl(v) {
  return typeof v === 'string' && /^(https?:)?\/\//i.test(v.trim());
}

function resolveStoryAudioPayload(storyLike) {
  const rawSrc =
    storyLike?.audio ??
    storyLike?.song ??
    storyLike?.music ??
    storyLike?.track ??
    null;
  let src = rawSrc;

  // Some APIs return nested audio metadata as a JSON string.
  if (typeof src === 'string') {
    const trimmed = src.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          src = parsed;
        }
      } catch (_e) {
        // keep string fallback handling below
      }
    }
  }

  if (typeof src === 'string') {
    const normalized = src.trim();
    if (!normalized || normalized.toLowerCase() === 'original') {
      return { directUrl: null, youtubeVideoId: null };
    }
    if (looksLikeUrl(normalized)) {
      return { directUrl: normalized, youtubeVideoId: null };
    }
    const builtinUrl = getStoryBuiltinLibraryUrl(normalized);
    if (builtinUrl) {
      return { directUrl: builtinUrl, youtubeVideoId: null };
    }
    return { directUrl: null, youtubeVideoId: normalized || null };
  }

  if (src && typeof src === 'object') {
    const normalizedMode =
      typeof src.mode === 'string' ? src.mode.trim().toLowerCase() : '';
    const libraryTrackId =
      typeof src.trackId === 'string'
        ? src.trackId
        : typeof src.libraryTrackId === 'string'
          ? src.libraryTrackId
          : typeof src.id === 'string'
            ? src.id
          : null;
    const libraryTitle =
      typeof src.title === 'string'
        ? src.title
        : typeof src.trackName === 'string'
          ? src.trackName
          : null;
    if (normalizedMode === 'library' || libraryTrackId || libraryTitle) {
      const builtinUrl = getStoryBuiltinLibraryUrl(libraryTrackId || libraryTitle);
      if (builtinUrl) {
        return { directUrl: builtinUrl, youtubeVideoId: null };
      }
    }
    const directUrl =
      src.audioUrl ||
      src.s3Url ||
      src.fileUrl ||
      src.url ||
      src.songUrl ||
      src.musicUrl ||
      src.previewUrl ||
      null;
    const youtubeVideoId =
      src.videoId ||
      src.youtubeVideoId ||
      src.ytVideoId ||
      null;
    return {
      directUrl: looksLikeUrl(directUrl) ? String(directUrl).trim() : null,
      youtubeVideoId:
        typeof youtubeVideoId === 'string' && youtubeVideoId.trim()
          ? youtubeVideoId.trim()
          : null,
    };
  }

  const storyLevelUrl =
    storyLike?.audioUrl ||
    storyLike?.songUrl ||
    storyLike?.musicUrl ||
    storyLike?.previewUrl ||
    null;
  return {
    directUrl: looksLikeUrl(storyLevelUrl) ? String(storyLevelUrl).trim() : null,
    youtubeVideoId:
      typeof storyLike?.videoId === 'string' && storyLike.videoId.trim()
        ? storyLike.videoId.trim()
        : null,
  };
}

function resolveStoryClipThumbnailUrl(storyLike, idx, clipMeta) {
  const candidate =
    clipMeta?.thumbnail ||
    clipMeta?.thumbnailUrl ||
    clipMeta?.thumb ||
    clipMeta?.thumbUrl ||
    clipMeta?.poster ||
    clipMeta?.posterUrl ||
    clipMeta?.cover ||
    clipMeta?.coverUrl ||
    (Array.isArray(storyLike?.thumbnails) ? storyLike.thumbnails[idx] : null) ||
    storyLike?.thumbnail ||
    storyLike?.thumbnailUrl ||
    storyLike?.thumb ||
    storyLike?.thumbUrl ||
    storyLike?.poster ||
    storyLike?.posterUrl ||
    storyLike?.cover ||
    storyLike?.coverUrl ||
    null;

  if (!looksLikeUrl(candidate)) return null;
  return String(candidate).trim();
}

function resolveStoryVideoThumbnailSource(storyLike) {
  const candidate =
    storyLike?.thumbnail ||
    storyLike?.thumbnailUrl ||
    storyLike?.thumb ||
    storyLike?.thumbUrl ||
    storyLike?.poster ||
    storyLike?.posterUrl ||
    storyLike?.cover ||
    storyLike?.coverUrl ||
    (Array.isArray(storyLike?.thumbnails) ? storyLike.thumbnails[0] : null) ||
    storyLike?.videoThumbnail ||
    storyLike?.videoThumb ||
    null;
  if (!looksLikeUrl(candidate)) return null;
  return { uri: String(candidate).trim() };
}


// Story Analytics Modal Component
const StoryAnalytics = ({ visible, onClose, story, currentUser }) => {
  const [activeTab, setActiveTab] = useState('likes');

  const analyticsStyles = {
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: '#1a1a1a',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: SCREEN_HEIGHT * 0.7,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: '#333',
    },
    headerTitle: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
    },
    closeButton: {
      padding: 5,
    },
    tabContainer: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#333',
    },
    tab: {
      flex: 1,
      paddingVertical: 15,
      alignItems: 'center',
    },
    activeTab: {
      borderBottomWidth: 2,
      borderBottomColor: '#4da3ff',
    },
    tabText: {
      color: '#aaa',
      fontSize: 14,
      fontWeight: '600',
    },
    activeTabText: {
      color: '#4da3ff',
    },
    tabCount: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
      marginTop: 2,
    },
    listContainer: {
      maxHeight: SCREEN_HEIGHT * 0.4,
    },
    userItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    userAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 15,
    },
    userInfo: {
      flex: 1,
    },
    username: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    timestamp: {
      color: '#aaa',
      fontSize: 12,
      marginTop: 2,
    },
    commentText: {
      color: '#ddd',
      fontSize: 13,
      marginTop: 2,
    },
    emptyState: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      color: '#aaa',
      fontSize: 16,
      textAlign: 'center',
    },
  };

  const formatAnalyticsTime = (timestamp) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const renderUserItem = (item, type) => (
    <View key={item.id} style={analyticsStyles.userItem}>
      <Image source={{ uri: item.avatar }} style={analyticsStyles.userAvatar} />
      <View style={analyticsStyles.userInfo}>
        <Text style={analyticsStyles.username}>{item.username}</Text>
        <Text style={analyticsStyles.timestamp}>
          {formatAnalyticsTime(item.timestamp)}
        </Text>
        {type === 'comments' && item.text && (
          <Text style={analyticsStyles.commentText}>{item.text}</Text>
        )}
      </View>
    </View>
  );

  const renderEmptyState = (type) => (
    <View style={analyticsStyles.emptyState}>
      <Text style={analyticsStyles.emptyText}>
        {type === 'likes' && 'No likes yet'}
        {type === 'comments' && 'No comments yet'}
      </Text>
    </View>
  );

  const getTabData = () => {
    if (!story) return [];
    switch (activeTab) {
      case 'likes':
        return story.likes || [];
      case 'comments':
        return story.comments || [];
      default:
        return [];
    }
  };

  if (!visible || !story) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={analyticsStyles.backdrop}>
        <View style={analyticsStyles.container}>
          <View style={analyticsStyles.header}>
            <Text style={analyticsStyles.headerTitle}>Story Activity</Text>
            <TouchableOpacity onPress={onClose} style={analyticsStyles.closeButton}>
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={analyticsStyles.tabContainer}>
            {['likes', 'comments'].map((tab) => {
              const count = story[tab]?.length || 0;
              const isActive = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[analyticsStyles.tab, isActive && analyticsStyles.activeTab]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[analyticsStyles.tabText, isActive && analyticsStyles.activeTabText]}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                  <Text style={analyticsStyles.tabCount}>{count}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <FlatList
            style={analyticsStyles.listContainer}
            data={getTabData()}
            keyExtractor={(item, index) => `${activeTab}_${item.id || index}`}
            renderItem={({ item }) => renderUserItem(item, activeTab)}
            ListEmptyComponent={() => renderEmptyState(activeTab)}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    </Modal>
  );
};

const OptionsSheet = ({
  visible,
  onClose,
  isMuted,
  onToggleMute,
  onReport,
  username,
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}
  >
    <View style={optStyles.backdrop}>
      <View style={optStyles.sheet}>
        <View style={optStyles.handle} />
        <Text style={optStyles.title}>{username}</Text>

        <TouchableOpacity style={optStyles.row} onPress={onToggleMute}>
          <Icon
            name={isMuted ? 'volume-high-outline' : 'volume-mute-outline'}
            size={22}
            color="#fff"
          />
          <Text style={optStyles.rowText}>
            {isMuted ? 'Unmute' : 'Mute'} {username}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={optStyles.row} onPress={onReport}>
          <Icon name="flag-outline" size={22} color="#ff6969" />
          <Text style={[optStyles.rowText, { color: '#ff8b8b' }]}>
            Report {username}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[optStyles.row, optStyles.cancel]}
          onPress={onClose}
        >
          <Text style={optStyles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const StoryViewer = ({
  visible,
  stories,
  currentUserIndex,
  currentStoryIndex,
  onClose,
  onNext,
  onPrev,
  onNextUser,
  onPrevUser,
  likes,
  onToggleLike,
  onAddComment,
  onMuteUser,
  onReportUser,
  onDeleteStory,
  ownerProfileImage,
  onDrawerClose,
  onOpenUserProfile,
}) => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const [paused, setPaused] = useState(false);
  const [analyticsVisible, setAnalyticsVisible] = useState(false);
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const commentInputRef = useRef(null);
  /** Skip prev/next when tap was only meant to dismiss keyboard or blur message field. */
  const suppressOverlayNavRef = useRef(false);
  const keyboardVisibleRef = useRef(false);
  const lastTapRef = useRef(0);
  const tapTimerRef = useRef(null);
  const timerRef = useRef(null);
  const [currentProgress, setCurrentProgress] = useState(0);
  const videoRef = useRef(null);
  const youtubeRef = useRef(null);
  const directAudioRef = useRef(null);
  const directAudioDurationRef = useRef(0);
  const shareRef = useRef(null);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [isMediaReady, setIsMediaReady] = useState(false);
  const [isFirstFrameReady, setIsFirstFrameReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const mediaDurationRef = useRef(null);
  /** Video duration in seconds (from onLoad) — drives progress bar via onProgress, not a wall-clock timer. */
  const videoDurationSecRef = useRef(0);
  const [videoOverlayVisible, setVideoOverlayVisible] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  // FIX: ref to track whether progress animation has been started
  // for the current story, preventing double-start from onVideoLoaded
  // and the fallback timer firing simultaneously.
  const progressStartedRef = useRef(false);
  const mediaFullyLoadedRef = useRef(false);
  const videoReadyDurationRef = useRef(null);

  const kickPlayback = () => {
    try {
      videoRef.current?.resume?.();
    } catch (_e) {
      /* noop */
    }
  };

  // --- keep latest callbacks for PanResponder (fix slide stale-closure) ---
  const nextUserCb = useRef(onNextUser);
  const prevUserCb = useRef(onPrevUser);
  const closeCb = useRef(onClose);
  /** PanResponder is created once — keep latest "viewing own" flag for swipe-up → message. */
  const isViewingOwnStoryRef = useRef(false);
  useEffect(() => { nextUserCb.current = onNextUser; }, [onNextUser]);
  useEffect(() => { prevUserCb.current = onPrevUser; }, [onPrevUser]);
  useEffect(() => { closeCb.current = onClose; }, [onClose]);

  // --- refs to avoid stale paused/visible in media onLoad ---
  const pausedRef = useRef(paused);
  const visibleRef = useRef(visible);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { visibleRef.current = visible; }, [visible]);

  const heartScale = useRef(new Animated.Value(0)).current;
  const triggerHeart = () => {
    heartScale.setValue(0);
    Animated.sequence([
      Animated.spring(heartScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
        tension: 140,
      }),
      Animated.timing(heartScale, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const [emojiBursts, setEmojiBursts] = useState([]);
  const spawnEmojiBurst = emoji => {
    const id = `${Date.now()}_${Math.random()}`;
    const ty = new Animated.Value(0);
    const opacity = new Animated.Value(1);
    const scale = new Animated.Value(0.8);

    const minX = SCREEN_WIDTH * 0.15;
    const maxX = SCREEN_WIDTH * 0.85;
    const x = Math.random() * (maxX - minX) + minX;

    setEmojiBursts(prev => [...prev, { id, emoji, x, ty, opacity, scale }]);
    Animated.parallel([
      Animated.timing(ty, {
        toValue: -160,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1.3,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start(() => setEmojiBursts(prev => prev.filter(b => b.id !== id)));
  };

  const currentUser = stories[currentUserIndex];
  const currentStory = currentUser?.stories[currentStoryIndex];
  const isViewingOwnStory = currentUser?.isUser;
  useEffect(() => {
    isViewingOwnStoryRef.current = !!isViewingOwnStory;
  }, [isViewingOwnStory]);
  const currentStoryAudio = currentStory?.audio || null;
  const resolvedAudio = resolveStoryAudioPayload(currentStory);
  const youtubeVideoId = resolvedAudio.youtubeVideoId;
  const directAudioUrl = resolvedAudio.directUrl;
  const hasDirectAudio = typeof directAudioUrl === 'string' && directAudioUrl.length > 0;
  const hasOverlayAudio = hasDirectAudio || !!youtubeVideoId;
  const isYoutubeAudio =
    !hasDirectAudio &&
    !!youtubeVideoId;
  const isDirectAudio =
    hasDirectAudio;
  const audioTrimStartSec = Math.max(
    0,
    Number(currentStory?.audioTrim?.start) || 0,
  );
  const audioTrimEndSecRaw = Number(currentStory?.audioTrim?.end);
  const audioTrimEndSec =
    Number.isFinite(audioTrimEndSecRaw) && audioTrimEndSecRaw > audioTrimStartSec
      ? audioTrimEndSecRaw
      : null;
  const audioVolumePercent = Math.max(
    0,
    Math.min(100, Math.round((Number(currentStory?.volume) || 1) * 100)),
  );
  const currentStoryThumbnail = resolveStoryVideoThumbnailSource(currentStory);

  console.log(currentStoryThumbnail, "currentStoryThumbnailcurrentStoryThumbnail==>>>>>>>")

  // Helper: fully stop & clear timers/animation
  const stopAndResetProgress = (resetToZero = true) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    progressAnimation.stopAnimation();
    if (resetToZero) {
      progressAnimation.setValue(0);
      setCurrentProgress(0);
    }
  };

  // Reset progress when story changes
  useEffect(() => {
    if (!visible || !currentStory) return;

    // Reset all state for the incoming story
    progressStartedRef.current = false;
    mediaFullyLoadedRef.current = false;   // ← add this line
    mediaDurationRef.current = null;
    videoDurationSecRef.current = 0;

    // Stop any running animation and reset to 0
    progressAnimation.stopAnimation();
    progressAnimation.setValue(0);
    setCurrentProgress(0);

    // Clear any existing timers
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // For videos: start paused=false so the Video component
    // begins loading immediately. onVideoLoaded will start progress.
    // For images: same — onImageLoaded starts progress.
    setPaused(false);
    setIsMediaReady(false);
    setIsBuffering(false);
    setIsFirstFrameReady(false);
    dispatch(hideLoader());

    // Seek video to beginning when switching stories (seek can leave player paused on some devices)
    if (currentStory.type === 'video' && videoRef.current?.seek) {
      try {
        videoRef.current.seek(0);
        setTimeout(() => {
          try {
            videoRef.current?.resume?.();
          } catch (_e) { }
        }, 50);
      } catch (_e) { }
    }
    if (isDirectAudio && directAudioRef.current?.seek) {
      try { directAudioRef.current.seek(audioTrimStartSec || 0); } catch (_e) { }
    }

    // FALLBACK: if image never loads, start timer-based progress. Video progress is tied to
    // actual playback (onProgress); if video never loads, user taps to skip — no auto-skip.
    const isVideo = currentStory.type === 'video';
    const fallbackDelay = isVideo ? 60000 : 5000;
    const fallbackTimer = setTimeout(() => {
      if (
        isVideo ||
        pausedRef.current ||
        !visibleRef.current ||
        progressStartedRef.current ||
        mediaFullyLoadedRef.current
      ) {
        return;
      }
      progressStartedRef.current = true;
      const duration = resolveStoryDurationMs(currentStory);
      startProgress(duration);
    }, fallbackDelay);

    return () => {
      clearTimeout(fallbackTimer);
      // Stop animation on cleanup but don't reset value —
      // the next iteration of this effect resets it at the top.
      progressAnimation.stopAnimation();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, currentUserIndex, currentStoryIndex]);

  // Progress animation listener
  useEffect(() => {
    const listener = progressAnimation.addListener(({ value }) => {
      setCurrentProgress(value);
    });
    return () => progressAnimation.removeListener(listener);
  }, [progressAnimation]);

  // Clean timers on close
  useEffect(() => {
    if (!visible) {
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      stopAndResetProgress(true);
      setPaused(false);
      dispatch(showLoader());
      setOptionsOpen(false);
      setAnalyticsVisible(false);
      setCommentText('');
      setEmojiBursts([]);
      lastTapRef.current = 0;
      suppressOverlayNavRef.current = false;
      keyboardVisibleRef.current = false;
      dispatch(hideLoader());
    }
  }, [visible]);

  // Keyboard listener to pause/resume story
  useEffect(() => {
    if (!visible) return;

    const keyboardShowListener = Keyboard.addListener('keyboardDidShow', () => {
      keyboardVisibleRef.current = true;
      handlePause();
    });

    const keyboardHideListener = Keyboard.addListener('keyboardDidHide', () => {
      keyboardVisibleRef.current = false;
      handleResume();
    });

    return () => {
      keyboardShowListener?.remove();
      keyboardHideListener?.remove();
    };
  }, [visible]);

  // Keep retrying YouTube play commands when story is active
  useEffect(() => {
    if (!isYoutubeAudio || !visible || paused) return;
    let cancelled = false;
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

    const run = async () => {
      const delays = [0, 350, 900, 1600];
      for (const d of delays) {
        if (cancelled) return;
        if (d > 0) await wait(d);
        try {
          await youtubeRef.current?.setVolume?.(audioVolumePercent);
          await youtubeRef.current?.unMuteVideo?.();
          await youtubeRef.current?.playVideo?.();
          if (audioTrimStartSec > 0) {
            await youtubeRef.current?.seekTo?.(audioTrimStartSec, true);
          }
        } catch (_e) { }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [isYoutubeAudio, visible, paused, youtubeVideoId, audioVolumePercent, audioTrimStartSec]);

  const startProgress = (duration) => {
    Animated.timing(progressAnimation, {
      toValue: 1,
      duration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !pausedRef.current) onNext();
    });
  };

  const handlePause = () => {
    setPaused(true);
    stopAndResetProgress(false);
  };

  const handleResume = () => {
    if (!currentStory) return;
    setPaused(false);
    // Video: progress bar follows real playback (onProgress); only resume the player.
    if (currentStory.type === 'video') {
      kickPlayback();
      return;
    }
    const remaining = Math.max(0, 1 - currentProgress);
    const totalDuration = resolveStoryDurationMs(currentStory);
    const remainingDuration = totalDuration * remaining;
    if (remainingDuration > 50) {
      startProgress(remainingDuration);
    }
  };

  // Pan responder: swipe down to close, left/right to switch users
  const pan = useRef(new Animated.ValueXY()).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => {
        const { dx, dy } = g;
        // Require more movement and dominant direction before stealing gesture
        return (Math.abs(dx) > 15 || Math.abs(dy) > 15);
      },
      onStartShouldSetPanResponderCapture: () => false,   // ← never capture on start
      onMoveShouldSetPanResponderCapture: (_, g) => {
        const { dx, dy } = g;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        // Only capture if clearly a swipe (not a tap on a button)
        return (absDx > 15 || absDy > 15) && (absDx > 5 || absDy > 5);
      },
      onPanResponderGrant: () => {
        handlePause();
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, g) => {
        const { dx, dy, vx, vy } = g;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        const shouldClose =
          dy > 140 && absDy > absDx * 1.5 && vy > 0.8;

        const isHorizontal =
          (absDx > 80 || Math.abs(vx) > 0.6) && absDx > absDy * 1.2;

        if (shouldClose) {
          stopAndResetProgress(true);
          Animated.timing(pan, {
            toValue: { x: 0, y: SCREEN_HEIGHT },
            duration: 160,
            useNativeDriver: false,
          }).start(() => {
            pan.setValue({ x: 0, y: 0 });
            closeCb.current && closeCb.current();
          });
          return;
        }

        // Swipe up (dominant vertical) → focus message field + keyboard (others' stories only)
        const shouldOpenMessageComposer =
          !isViewingOwnStoryRef.current &&
          dy < -55 &&
          absDy > absDx * 1.25 &&
          (Math.abs(vy) > 0.35 ? vy < -0.15 : true);

        if (shouldOpenMessageComposer) {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              try {
                commentInputRef.current?.focus();
              } catch (_e) {
                /* noop */
              }
            });
          });
          return;
        }

        if (isHorizontal) {
          stopAndResetProgress(true);
          if (dx > 0) {
            prevUserCb.current && prevUserCb.current();
          } else {
            nextUserCb.current && nextUserCb.current();
          }
          Animated.timing(pan, {
            toValue: { x: 0, y: 0 },
            duration: 100,
            useNativeDriver: false,
          }).start();
          return;
        }

        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
        handleResume();
      },
      onPanResponderTerminate: () => {
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
        handleResume();
      },
    }),
  ).current;

  if (!visible || !currentUser || !currentStory) return null;

  const storyId = currentStory.id;
  const ownerId = currentUser.id;
  const storyKey = `${ownerId}:${storyId}`;
  const liked = !!likes[storyKey]?.liked;

  const dismissStoryKeyboard = () => {
    try {
      commentInputRef.current?.blur();
    } catch (_e) {
      /* noop */
    }
    Keyboard.dismiss();
  };

  const handleOverlayPressIn = () => {
    const inputFocused = commentInputRef.current?.isFocused?.() === true;
    if (inputFocused || keyboardVisibleRef.current) {
      suppressOverlayNavRef.current = true;
      dismissStoryKeyboard();
    }
  };

  const handleTap = (event) => {
    if (suppressOverlayNavRef.current) {
      suppressOverlayNavRef.current = false;
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      lastTapRef.current = 0;
      return;
    }
    // Fallback if Pressable had no hit area before fix, or platform skipped onPressIn
    if (
      keyboardVisibleRef.current ||
      commentInputRef.current?.isFocused?.() === true
    ) {
      dismissStoryKeyboard();
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      lastTapRef.current = 0;
      return;
    }

    const now = Date.now();
    const timeDiff = now - lastTapRef.current;

    if (timeDiff < DOUBLE_TAP_DELAY) {
      lastTapRef.current = 0;
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      onToggleLike(ownerId, storyId, true);
      triggerHeart();
      return;
    }

    lastTapRef.current = now;

    const tapX = event?.nativeEvent?.pageX || SCREEN_WIDTH / 2;
    const leftZone = SCREEN_WIDTH * 0.3;

    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
    }

    tapTimerRef.current = setTimeout(() => {
      stopAndResetProgress(true);
      if (tapX < leftZone) onPrev();
      else onNext();
      tapTimerRef.current = null;
    }, DOUBLE_TAP_DELAY);
  };

  const openOptions = () => {
    handlePause();
    setOptionsOpen(true);
  };

  const closeOptions = () => {
    setOptionsOpen(false);
    handleResume();
  };

  const openAnalytics = () => {
    handlePause();
    setAnalyticsVisible(true);
  };

  const handleOpenUserProfile = () => {
    if (isViewingOwnStory || !currentUser?.id) return;
    stopAndResetProgress(true);
    onClose?.();

    setTimeout(() => {
      if (onDrawerClose) onDrawerClose();
      onOpenUserProfile?.(currentUser);
    }, 120);
  };

  const closeAnalytics = () => {
    setAnalyticsVisible(false);
    handleResume();
  };

  const handleDeleteStory = () => {
    Alert.alert(
      'Delete Drop',
      'Are you sure you want to delete this drop?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDeleteStory(storyId);
            handleResume();
          }
        }
      ]
    );
  };

  // User story analytics styles
  const userAnalyticsStyles = {
    bottomContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'transparent',
      borderTopWidth: 0,
      borderTopColor: 'transparent',
      paddingHorizontal: 14,
      paddingTop: 10,
      // Keep actions close to the bottom while still respecting device insets.
      paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 10 : 8),
      zIndex: 20,
    },
    analyticsButton: {
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 25,
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
    },
    analyticsText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 8,
    },
    statsRow: {
      flexDirection: 'row',
      marginTop: 0,
      marginBottom: 8,
      flexWrap: 'wrap',
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    statItem: {
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 15,
      marginRight: 8,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
    },
    statText: {
      color: '#fff',
      fontSize: 12,
      marginLeft: 4,
    },
    deleteButton: {
      backgroundColor: 'rgba(255, 107, 107, 0.8)',
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 25,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
    },
    deleteText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 8,
    },
    shareButton: {
      backgroundColor: 'rgba(255,255,255,0.14)',
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 25,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
    },
    shareText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 8,
    },
  };

  /** Kick playback only — video stories use onProgress for the bar; images use startProgress timers. */
  const maybeStartVideoProgress = () => {
    if (!visibleRef.current || pausedRef.current) return;
    setIsFirstFrameReady(true); // ← first real frame is now on screen
    kickPlayback();
  };

  const onMainVideoProgress = ({ currentTime }) => {
    if (!visibleRef.current || pausedRef.current) return;
    const durSec =
      videoDurationSecRef.current > 0
        ? videoDurationSecRef.current
        : (mediaDurationRef.current ? mediaDurationRef.current / 1000 : 0);
    if (!durSec || durSec <= 0) return;
    const p = Math.min(1, Math.max(0, currentTime / durSec));
    progressAnimation.setValue(p);
  };

  const onImageLoaded = () => {
    dispatch(hideLoader());
    mediaFullyLoadedRef.current = true;
    setIsMediaReady(true);
    if (!progressStartedRef.current) {
      progressStartedRef.current = true;
      // rAF ensures the image has actually painted before bar moves
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {   // double rAF = after next paint
          if (visibleRef.current && !pausedRef.current) {
            startProgress(resolveStoryDurationMs(currentStory));
          }
        });
      });
    }
  };

  const onVideoLoaded = (meta) => {
    dispatch(hideLoader());
    const duration =
      (meta?.duration ? meta.duration * 1000 : null) ||
      currentStory?.duration ||
      15000;
    mediaDurationRef.current = duration;
    videoReadyDurationRef.current = duration;
    const durSec =
      meta?.duration != null && Number(meta.duration) > 0
        ? Number(meta.duration)
        : duration / 1000;
    videoDurationSecRef.current = durSec;
    mediaFullyLoadedRef.current = true;
    setIsMediaReady(true);
    setIsBuffering(false);
    progressAnimation.setValue(0);
    maybeStartVideoProgress();
    kickPlayback();
    requestAnimationFrame(kickPlayback);
    setTimeout(kickPlayback, 120);
    setTimeout(kickPlayback, 500);
  };

  const onMediaError = () => {
    dispatch(hideLoader());
    mediaFullyLoadedRef.current = true;
    setIsMediaReady(true);
    // Video: do not auto-advance on error — bar stays put; user taps to skip.
    if (currentStory?.type === 'video') return;
    if (visibleRef.current && !pausedRef.current && !progressStartedRef.current) {
      progressStartedRef.current = true;
      const duration = resolveStoryDurationMs(currentStory);
      startProgress(duration);
    }
  };

  // FIX: removed all progress animation logic from onVideoBuffer.
  // Toggling `paused` on buffer events causes the visible stutter — the
  // native player handles rebuffering silently on its own. We only track
  // the buffering state for a UI spinner if needed.
  const onVideoBuffer = ({ isBuffering: buffering }) => {
    setIsBuffering(buffering);
    // Do NOT restart progress here — it creates a second competing
    // Animated.timing() that fights the existing one and causes jumps.
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        stopAndResetProgress(true);
        onClose();
      }}
    >
      <View
        style={modalStyles.modalBg}
        {...panResponder.panHandlers}
      >
        {currentStory?.type === 'image' && currentStory?.uri ? (
          <Image
            key={`story_img_${storyKey}`}
            source={{ uri: currentStory.uri }}
            style={modalStyles.storyMediaFullscreen}
            resizeMode="contain"
            onLoadEnd={onImageLoaded}
            onError={onMediaError}
            pointerEvents="none"
          />
        ) : null}
        {/* Progress bars */}
        <View
          style={[
            modalStyles.progressContainer,
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              paddingTop: Math.max(insets.top, 6) + 6,
              zIndex: 100,
            },
          ]}
        >
          {currentUser.stories.map((_, idx) => (
            <View key={idx} style={modalStyles.progressBarBg}>
              <Animated.View
                style={[
                  modalStyles.progressBarFill,
                  {
                    width:
                      idx === currentStoryIndex
                        ? progressAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        })
                        : idx < currentStoryIndex
                          ? '100%'
                          : '0%',
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* Top bar */}
        <View
          style={[
            modalStyles.topBar,
            {
              position: 'absolute',
              top: Math.max(insets.top, 6) + 18,
              left: 0,
              right: 0,
              zIndex: 100,
            },
          ]}
          onStartShouldSetResponder={() => true}        // ← consume touch here
          onTouchStart={(e) => e.stopPropagation()}
        >
          <View style={modalStyles.userInfo}>
            <TouchableOpacity
              activeOpacity={isViewingOwnStory ? 1 : 0.7}
              onPress={handleOpenUserProfile}
              disabled={isViewingOwnStory}
            >
              <HexAvatar
                uri={isViewingOwnStory ? (ownerProfileImage || currentUser.image) : currentUser.image}
                isUser={!!currentUser.isUser}
                size={36}
                borderWidth={2}
                borderColor={isViewingOwnStory ? '#4da3ff' : '#000'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={isViewingOwnStory ? 1 : 0.7}
              onPress={handleOpenUserProfile}
              disabled={isViewingOwnStory}
            >
              <Text style={modalStyles.username}>{currentUser.username}</Text>
            </TouchableOpacity>
            <Text style={modalStyles.time}>
              {formatTime(currentStory.timestamp)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {!isViewingOwnStory && (
              <TouchableOpacity
                onPress={openOptions}
                style={modalStyles.closeBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Icon name="ellipsis-horizontal" size={26} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                stopAndResetProgress(true);
                onClose();
              }}
              style={modalStyles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              // ← These two stop the PanResponder from stealing the tap
              onStartShouldSetResponder={() => true}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <Icon name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Story content with tap handling */}
        <View
          style={[
            modalStyles.storyContent,
          ]}
        >
          {currentStory.type === 'image' ? null : (
            <View style={modalStyles.storyVideoWrap} pointerEvents="box-none">
              {/*
                Do not use renderLoader: it sets an internal full-screen layer that only
                clears on onReadyForDisplay — on some devices that never fires, so the video
                never appears to play. Loading UI is our overlay below instead.
              */}
              <VideoPlayer
                key={storyKey}
                ref={videoRef}
                video={{ uri: currentStory.uri }}
                videoWidth={SCREEN_WIDTH}
                videoHeight={SCREEN_HEIGHT}
                resizeMode="cover"
                autoplay
                paused={paused}
                rate={1}
                volume={1}
                muted={hasOverlayAudio}
                defaultMuted={false}
                ignoreSilentSwitch="ignore"
                mixWithOthers="mix"
                hideControlsOnStart
                disableSeek
                disableFullscreen
                pauseOnPress={false}
                fullScreenOnLongPress={false}
                {...(Platform.OS === 'android' ? { viewType: ViewType.TEXTURE } : {})}
                onLoadStart={() => {
                  setIsMediaReady(false);
                  setIsFirstFrameReady(false); // ← reset here too
                  setIsBuffering(true);
                }}
                onLoad={onVideoLoaded}
                onReadyForDisplay={maybeStartVideoProgress}
                onProgress={onMainVideoProgress}
                progressUpdateInterval={200}
                onBuffer={onVideoBuffer}
                onError={onMediaError}
                onEnd={() => {
                  progressAnimation.setValue(1);
                  stopAndResetProgress(true);
                  setTimeout(() => onNext(), 120);
                }}
                repeat={false}
                controls={false}
                playInBackground={false}
                playWhenInactive={false}
                bufferConfig={{
                  minBufferMs: 2000,
                  maxBufferMs: 50000,
                  bufferForPlaybackMs: 1200,
                  bufferForPlaybackAfterRebufferMs: 2000,
                }}
                customStyles={storyVideoPlayerCustomStyles}
                pointerEvents="none"
              />
              {!isFirstFrameReady && currentStoryThumbnail && (
                <Image
                  source={currentStoryThumbnail}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                  pointerEvents="none"
                />
              )}
              {!isMediaReady && (
                <View
                  style={[
                    modalStyles.storyVideoLoadingOverlay,
                    // currentStoryThumbnail ? modalStyles.storyVideoLoadingOverlayWithPoster : null,
                    currentStoryThumbnail
                      ? { backgroundColor: 'transparent' }
                      : modalStyles.storyVideoLoadingOverlayWithPoster,
                  ]}
                  pointerEvents="none"
                >
                  <ActivityIndicator size="large" color="#fff" />
                </View>
              )}
            </View>
          )}

          {isYoutubeAudio ? (
            <View
              style={storyYoutubeAudioStyle}
              pointerEvents="none"
              collapsable={false}
            >
              <YoutubePlayer
                ref={youtubeRef}
                key={`story_yt_${storyId}_${youtubeVideoId}`}
                height={200}
                width={200}
                videoId={youtubeVideoId}
                play={visible && !paused}
                mute={false}
                volume={audioVolumePercent}
                forceAndroidAutoplay
                initialPlayerParams={{
                  autoplay: true,
                  controls: false,
                  modestbranding: true,
                  rel: false,
                }}
                onReady={async () => {
                  try {
                    await youtubeRef.current?.setVolume?.(audioVolumePercent);
                    await youtubeRef.current?.unMuteVideo?.();
                    await youtubeRef.current?.playVideo?.();
                    if (audioTrimStartSec > 0) {
                      await youtubeRef.current?.seekTo?.(audioTrimStartSec, true);
                    }
                  } catch (_e) { }
                }}
                onChangeState={state => {
                  if (state === 'paused' || state === 'unstarted' || state === 'video cued') {
                    try {
                      youtubeRef.current?.playVideo?.();
                    } catch (_e) { }
                  }
                  if (state === 'ended') {
                    try {
                      youtubeRef.current?.seekTo?.(audioTrimStartSec, true);
                      youtubeRef.current?.playVideo?.();
                    } catch (_e) { }
                  }
                }}
                onError={e => {
                  console.warn('[StoryViewer] YouTube audio error', e);
                }}
              />
            </View>
          ) : null}

          {isDirectAudio ? (
            <Video
              ref={directAudioRef}
              source={{ uri: directAudioUrl }}
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
              paused={paused || !visible}
              muted={false}
              repeat={false}
              playInBackground={false}
              playWhenInactive={false}
              volume={Math.max(0, Math.min(1, Number(currentStory?.volume) || 1))}
              onLoad={data => {
                directAudioDurationRef.current = Number(data?.duration) || 0;
                if (audioTrimStartSec > 0) {
                  try { directAudioRef.current?.seek(audioTrimStartSec); } catch (_e) { }
                }
              }}
              onReadyForDisplay={() => {
                if (!progressStartedRef.current && visibleRef.current && !pausedRef.current) {
                  progressStartedRef.current = true;
                  const duration = videoReadyDurationRef.current || resolveStoryDurationMs(currentStory);
                  requestAnimationFrame(() => {
                    if (visibleRef.current && !pausedRef.current) {
                      startProgress(duration);
                    }
                  });
                }
              }}
              onProgress={({ currentTime }) => {
                const fallbackEnd = directAudioDurationRef.current || 0;
                const end = audioTrimEndSec != null ? audioTrimEndSec : fallbackEnd;
                if (end > 0 && currentTime >= end - 0.12) {
                  try { directAudioRef.current?.seek(audioTrimStartSec || 0); } catch (_e) { }
                }
              }}
              onEnd={() => {
                try { directAudioRef.current?.seek(audioTrimStartSec || 0); } catch (_e) { }
              }}
              onError={e => {
                console.warn('[StoryViewer] Direct audio error', e);
              }}
            />
          ) : null}

          <Pressable
            style={modalStyles.overlay}
            onPressIn={handleOverlayPressIn}
            onPress={handleTap}
            onLongPress={handlePause}
            onPressOut={handleResume}
            delayLongPress={150}
          />

          {/* Heart animation for likes */}
          {!isViewingOwnStory && (
            <Animated.View
              pointerEvents="none"
              style={[
                likeStyles.bigHeart,
                {
                  transform: [
                    {
                      scale: heartScale.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.4, 1],
                      }),
                    },
                  ],
                  opacity: heartScale,
                },
              ]}
            >
              <Icon name="heart" size={120} color="red" />
            </Animated.View>
          )}
        </View>

        {/* Show analytics for user's own stories */}
        {isViewingOwnStory && (
          <View style={userAnalyticsStyles.bottomContainer}>
            <View style={userAnalyticsStyles.statsRow}>
              {currentStory.likes?.length > 0 && (
                <View style={userAnalyticsStyles.statItem}>
                  <Icon name="heart" size={14} color="#ff6b6b" />
                  <Text style={userAnalyticsStyles.statText}>
                    {currentStory.likes.length}
                  </Text>
                </View>
              )}

              {currentStory.comments?.length > 0 && (
                <View style={userAnalyticsStyles.statItem}>
                  <Icon name="chatbubble-outline" size={14} color="#4da3ff" />
                  <Text style={userAnalyticsStyles.statText}>
                    {currentStory.comments.length}
                  </Text>
                </View>
              )}
            </View>

            <View style={userAnalyticsStyles.actionsRow}>
              <TouchableOpacity
                style={userAnalyticsStyles.deleteButton}
                onPress={handleDeleteStory}
              >
                <Icon name="trash-outline" size={18} color="#fff" />
                <Text style={userAnalyticsStyles.deleteText}>Delete</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={userAnalyticsStyles.shareButton}
                onPress={() => {
                  handlePause();
                  shareRef.current?.open?.();
                  const storyWithUser = {
                    ...currentStory,
                    userName: currentUser?.username,
                    userImage: currentUser?.avatar,
                    user: {
                      id: currentUser?.id,
                      displayName: currentUser?.username,
                      image: currentUser?.avatar
                    }
                  };
                  setSelectedPostId(storyWithUser);
                }}
              >
                <Feather name="send" size={18} color="#fff" />
                <Text style={userAnalyticsStyles.shareText}>Share</Text>
              </TouchableOpacity>
            </View>
            <ShareModal
              ref={shareRef}
              story={selectedPostId}
              onClose={() => {
                onClose();
              }}
              onShare={() => {
                stopAndResetProgress(true);
                onClose();
                setTimeout(() => {
                  if (onDrawerClose) onDrawerClose();
                }, 150);
              }}
            />
          </View>
        )}

        {/* Show interaction controls only for other users' stories */}
        {!isViewingOwnStory && (
          <>
            <View pointerEvents="none" style={burstStyles.layer}>
              {emojiBursts.map(b => (
                <Animated.Text
                  key={b.id}
                  style={[
                    burstStyles.emoji,
                    {
                      left: b.x - 14,
                      transform: [{ translateY: b.ty }, { scale: b.scale }],
                      opacity: b.opacity,
                    },
                  ]}
                >
                  {b.emoji}
                </Animated.Text>
              ))}
            </View>

            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
              style={[
                inputStyles.wrap,
                { paddingBottom: insets.bottom + 20 },
              ]}
            >
              <View style={inputStyles.quickRow}>
                {['👍', '👏', '🔥', '😍', '😂', '😮'].map(emo => (
                  <TouchableOpacity
                    key={emo}
                    style={inputStyles.quickBtn}
                    onPress={() => {
                      handlePause();
                      spawnEmojiBurst(emo);
                      onAddComment(ownerId, storyId, emo);
                      setTimeout(handleResume, 800);
                    }}
                  >
                    <Text style={inputStyles.quickText}>{emo}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={inputStyles.row}>
                <TouchableOpacity
                  style={likeStyles.actionBtn}
                  onPress={() => onToggleLike(ownerId, storyId, !liked)}
                >
                  <Icon
                    name={liked ? 'heart' : 'heart-outline'}
                    size={26}
                    color={liked ? 'red' : '#fff'}
                  />
                </TouchableOpacity>

                <TextInput
                  ref={commentInputRef}
                  placeholder="Send message"
                  placeholderTextColor="#aaa"
                  style={inputStyles.input}
                  value={commentText}
                  onChangeText={setCommentText}
                  onFocus={handlePause}
                  onBlur={handleResume}
                  onSubmitEditing={() => {
                    const text = commentText.trim();
                    if (text) {
                      onAddComment(ownerId, storyId, text);
                      setCommentText('');
                    }
                  }}
                  returnKeyType="send"
                />
                <TouchableOpacity
                  style={inputStyles.sendBtn}
                  onPress={() => {
                    const text = commentText.trim();
                    if (text) {
                      onAddComment(ownerId, storyId, text);
                      setCommentText('');
                      return;
                    }
                    Keyboard.dismiss();
                    setTimeout(() => {
                      shareRef.current?.open?.();
                      handlePause();
                      const storyWithUser = {
                        ...currentStory,
                        userName: currentUser?.username,
                        userImage: currentUser?.avatar,
                        user: {
                          id: currentUser?.id,
                          displayName: currentUser?.username,
                          image: currentUser?.avatar
                        }
                      };
                      setSelectedPostId(storyWithUser);
                    }, 150);
                  }}
                >
                  <Icon name="send" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
            <ShareModal
              ref={shareRef}
              story={selectedPostId}
              onClose={() => {
                onClose();
              }}
              onShare={() => {
                stopAndResetProgress(true);
                onClose();
                setTimeout(() => {
                  if (onDrawerClose) onDrawerClose();
                }, 150);
              }}
            />
          </>
        )}

        {/* Options sheet only for other users' stories */}
        {!isViewingOwnStory && (
          <OptionsSheet
            visible={optionsOpen}
            onClose={closeOptions}
            isMuted={currentUser.muted}
            onToggleMute={() => {
              onMuteUser(currentUser.id, !currentUser.muted);
              closeOptions();
            }}
            onReport={() => {
              onReportUser(currentUser.id);
              closeOptions();
            }}
            username={currentUser.username}
          />
        )}

        {/* Story Analytics Modal */}
        <StoryAnalytics
          visible={analyticsVisible}
          onClose={closeAnalytics}
          story={currentStory}
          currentUser={currentUser}
        />
      </View>
    </Modal>
  );
};

const formatTime = timestamp => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

export default function Stories({ refreshTick, sidebarMode = false, onDrawerClose }) {
  const styles = createStyles();
  const navigation = useNavigation();
  const [stories, setStories] = useState([]);
  const [likes, setLikes] = useState({});
  const [comments, setComments] = useState({});
  const [viewerVisible, setViewerVisible] = useState(false);
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [viewerSession, setViewerSession] = useState(0);
  const [composerVisible, setComposerVisible] = useState(false);
  const [composerMedia, setComposerMedia] = useState(null);
  const [composerList, setComposerList] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isUploadingStory, setIsUploadingStory] = useState(false);
  const [uploadProgress] = useState(new Animated.Value(0));
  const uploadAnimationRef = useRef(null);
  const profileImage = useSelector(state => state.profileImage?.profileImg);
  const toast = useToast();
  const dispatch = useDispatch();

  const fetchStories = async () => {
    try {
      const id = await AsyncStorage.getItem('userId');
      setCurrentUserId(id);
      dispatch(showLoader());

      const userStoriesResponse = await getStoryByUser(id);
      console.log(userStoriesResponse, 'respose for user storeis');

      let followingStoriesResponse;
      try {
        followingStoriesResponse = await getFollowingUserStories();
      } catch (followingError) {
        console.warn('Error fetching following stories:', followingError);
        followingStoriesResponse = { data: [] };
      }

      const userStoriesRaw = userStoriesResponse?.data
        ? (Array.isArray(userStoriesResponse.data)
          ? userStoriesResponse.data
          : [userStoriesResponse.data]
        )
        : [];

      const followingStoriesRaw = followingStoriesResponse?.data
        ? (Array.isArray(followingStoriesResponse.data) ? followingStoriesResponse.data : [followingStoriesResponse.data])
        : [];

      const currentUserBucket = {
        id: 'current_user',
        username: 'Your Drops',
        image: profileImage || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
        isUser: true,
        hasUnseenStory: false,
        muted: false,
        stories: userStoriesRaw.flatMap((story) => {
          const ts = new Date(story.createdAt || story.updatedAt || Date.now()).getTime();
          const meta = parseStoryMeta(story.storyMeta);
          return (story.media || []).map((url, idx) => {
            const clipMeta = meta?.clips?.[idx] || {};
            const mediaType = resolveStoryClipType(String(url), clipMeta);
            const thumbnailUrl = resolveStoryClipThumbnailUrl(story, idx, clipMeta);
            return {
              ...(() => {
                const fallbackAudio =
                  clipMeta.audio ??
                  meta?.audio ??
                  story?.audio ??
                  story?.song ??
                  story?.music ??
                  null;
                return {
                  ...clipMeta,
                  audio: fallbackAudio,
                  duration: resolveStoryDurationMs({
                    ...clipMeta,
                    type: mediaType,
                  }),
                };
              })(),
              thumbnail: thumbnailUrl,
              id: `${story.id}_${idx}`,
              type: mediaType,
              uri: String(url).trim(),
              timestamp: ts,
              seen: false,
              views: [],
              likes: [],
              comments: [],
            };
          });
        }),
      };

      const userStoriesMap = new Map();

      followingStoriesRaw.forEach((userStory) => {
        const userId = userStory.userId || userStory.id;
        const username = userStory.user?.displayName || userStory.user?.userName || userStory.user?.username || 'Unknown User';
        const userImage = userStory.user?.image || '';

        const ts = new Date(userStory.createdAt || userStory.updatedAt || Date.now()).getTime();
        const followingMeta = parseStoryMeta(userStory.storyMeta);

        const storyObjects = (userStory.media || []).map((url, idx) => {
          const clipMeta = followingMeta?.clips?.[idx] || {};
          const mediaType = resolveStoryClipType(String(url), clipMeta);
          const thumbnailUrl = resolveStoryClipThumbnailUrl(userStory, idx, clipMeta);
          return {
            ...(() => {
              const fallbackAudio =
                clipMeta.audio ??
                followingMeta?.audio ??
                userStory?.audio ??
                userStory?.song ??
                userStory?.music ??
                null;
              return {
                ...clipMeta,
                audio: fallbackAudio,
                duration: resolveStoryDurationMs({
                  ...clipMeta,
                  type: mediaType,
                }),
              };
            })(),
            thumbnail: thumbnailUrl,
            id: `${userStory.id}_${idx}`,
            type: mediaType,
            uri: String(url).trim(),
            timestamp: ts,
            seen: false,
            views: [],
            likes: [],
            comments: [],
          };
        });

        if (userStoriesMap.has(userId)) {
          const existingUser = userStoriesMap.get(userId);
          existingUser.stories.push(...storyObjects);
        } else {
          userStoriesMap.set(userId, {
            id: userId,
            username: username,
            image: userImage,
            isUser: false,
            hasUnseenStory: true,
            muted: false,
            stories: storyObjects,
          });
        }
      });

      const followingUsersBuckets = Array.from(userStoriesMap.values())
        .filter(user => user.stories.length > 0 && user.id);

      const transformedStories = [currentUserBucket, ...followingUsersBuckets];

      setStories(transformedStories);
    } catch (error) {
      console.error('Error fetching stories:', error);
      setStories([{
        id: 'current_user',
        username: 'Your Drops',
        image: 'https://via.placeholder.com/150',
        isUser: true,
        hasUnseenStory: false,
        muted: false,
        stories: []
      }]);
    } finally {
      dispatch(hideLoader());
    }
  };

  useEffect(() => {
    if (!profileImage) return;
    setStories(prev =>
      prev.map(u => u.isUser ? { ...u, image: profileImage } : u)
    );
  }, [profileImage]);

  const loadProfileData = async () => {
    try {
      const viewerId = await AsyncStorage.getItem('userId');
      if (!viewerId) return;
      const resp = await getUserCredentials(viewerId);
      if (resp?.statusCode === 200) {
        const raw = resp?.data?.image;
        console.log('innnnnnn load profile data----------', raw);
        dispatch(setProfileImg(raw));
      }
    } catch (e) {
      dispatch(hideLoader());
    }
  };

  useEffect(() => {
    fetchStories();
    loadProfileData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStories();
      loadProfileData();
    }, [])
  );

  useEffect(() => {
    if (isUploadingStory) {
      // Reset and start progress animation
      uploadProgress.setValue(0);
      const timing = Animated.timing(uploadProgress, {
        toValue: 0.95,
        duration: 8000, // Reach 95% over 8 seconds
        useNativeDriver: false,
      });
      timing.start();
      uploadAnimationRef.current = timing;
    } else {
      // Stop any running animation and immediately reset
      if (uploadAnimationRef.current) {
        uploadAnimationRef.current.stop();
        uploadAnimationRef.current = null;
      }
      uploadProgress.setValue(0);
    }
  }, [isUploadingStory, uploadProgress]);

  useEffect(() => {
    if (typeof refreshTick === 'number') {
      fetchStories();
    }
  }, [refreshTick]);

  // Restore upload state when returning to this screen
  useFocusEffect(
    useCallback(() => {
      const restoreUploadState = async () => {
        try {
          const isUploading = await AsyncStorage.getItem('storyUploadInProgress');
          if (isUploading === 'true') {
            console.log('Restoring upload state - upload still in progress');
            setIsUploadingStory(true);
          }
        } catch (error) {
          console.error('Error restoring upload state:', error);
        }
      };
      restoreUploadState();
    }, [])
  );

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

  const handleAddStory = () => {
    Alert.alert('Add Drops', 'Choose how to add your drops', [
      { text: 'Camera', onPress: () => openCamera() },
      { text: 'Gallery', onPress: () => openGallery() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleAddNewStory = () => {
    Alert.alert('Add New Drop', 'Choose how to add your new drop', [
      { text: 'Camera', onPress: () => openCamera() },
      { text: 'Gallery', onPress: () => openGallery() },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
    const options = {
      mediaType: 'mixed',
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      includeExtra: true,
      presentationStyle: 'fullScreen',
    };
    launchCamera(options, response => {
      if (response?.didCancel) {
        setComposerList([]);
        setComposerMedia(null);
        return;
      }
      if (response?.errorCode) {
        Alert.alert('Camera Error', response.errorMessage || 'Unknown error');
        return;
      }

      const asset = response?.assets?.[0];
      if (!asset?.uri) {
        Alert.alert('Error', 'Failed to capture media.');
        return;
      }
      const uri = asset.uri;

      const mediaItem = {
        uri: uri,
        type: asset.type?.startsWith('video') ? 'video' : 'image',
        duration: asset.duration ? asset.duration * 1000 : undefined,
      };

      setComposerList([mediaItem]);
      setComposerVisible(true);
    });
  };

  const openGallery = () => {
    const options = {
      mediaType: 'mixed',
      selectionLimit: 10,
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
    };
    launchImageLibrary(options, response => {
      if (response?.didCancel || response?.errorCode) {
        setComposerList([]);
        setComposerMedia(null);
        setComposerVisible(false);
        return;
      }
      const assets = response?.assets || [];
      if (!assets.length) {
        setComposerList([]);
        setComposerMedia(null);
        return;
      }

      const list = assets.map(a => ({
        uri: a.uri,
        type: a.type?.startsWith('video') ? 'video' : 'image',
        duration: a.duration ? a.duration * 1000 : undefined,
      }));
      setComposerList(list);
      setComposerVisible(true);
      handleMediaSelected(response);
    });
  };

  const handleMediaSelected = response => {
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
    setComposerMedia({ type, uri: asset.uri, duration });
    setComposerVisible(true);
  };

  // Check network connectivity and wait if offline
  const waitForNetworkConnectivity = async () => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      console.log('No network connection, waiting for network to be restored...');
      return new Promise((resolve) => {
        const unsubscribe = NetInfo.addEventListener(networkState => {
          console.log('Network state changed:', networkState.isConnected);
          if (networkState.isConnected) {
            console.log('Network restored! Resuming upload immediately...');
            unsubscribe();
            resolve();
          }
        });
      });
    }
  };

  // Retry logic with exponential backoff - ensures upload continues in background
  const retryWithBackoff = async (
    uploadFn,
    maxRetries = 15,
    baseDelayMs = 1000,
  ) => {
    let lastError;
    let isNetworkOffline = false;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Check network before attempting upload
        const netState = await NetInfo.fetch();
        if (!netState.isConnected) {
          console.log(`Attempt ${attempt + 1}: No network, waiting for connection...`);
          isNetworkOffline = true;
          await waitForNetworkConnectivity();
          console.log(`Network restored after attempt ${attempt + 1}, retrying immediately...`);
          // After network is restored, retry without delay
          attempt--; // Don't count this as an attempt
          continue;
        }

        isNetworkOffline = false;
        console.log(`Upload attempt ${attempt + 1}/${maxRetries}...`);
        const result = await uploadFn();

        // Check if API returned an error status
        if (result?.error === true || result?.statusCode === 0) {
          console.warn(`API error on attempt ${attempt + 1}:`, result?.message || result);
          throw new Error(`API Error: ${result?.message || 'Network Error'}`);
        }

        return result;
      } catch (error) {
        lastError = error;
        const isLastAttempt = attempt === maxRetries - 1;
        const errorMsg = error?.message || String(error);

        console.log(
          `Upload attempt ${attempt + 1} failed: ${errorMsg}`,
        );

        if (isLastAttempt) {
          throw error;
        }

        // For network errors, use longer backoff
        const isNetworkError =
          errorMsg.includes('Network') ||
          errorMsg.includes('timeout') ||
          errorMsg.includes('ECONNREFUSED') ||
          errorMsg.includes('ETIMEDOUT');

        // Faster retries: 1s, 2s, 4s, 8s, 16s, 32s, 64s...
        // If network was offline, don't add extra delay (already waited in waitForNetworkConnectivity)
        const delayMs = isNetworkOffline ? 0 : baseDelayMs * Math.pow(2, attempt);

        if (delayMs > 0) {
          console.log(
            `Waiting ${delayMs}ms before retry attempt ${attempt + 2}/${maxRetries}... (${isNetworkError ? 'Network' : 'Other'} error)`,
          );
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          console.log(`Network was offline, retrying immediately...`);
        }
      }
    }
    throw lastError;
  };

  // Store upload state for tracking and resumption
  const saveUploadState = async (clips) => {
    try {
      const uploadState = {
        clips: clips.map(clip => ({
          original: {
            uri: clip.original?.uri,
            duration: clip.original?.duration,
          },
          processedUri: clip.processedUri,
          isVideo: clip.isVideo,
          audio: clip.audio,
          audioTrim: clip.audioTrim,
          trim: clip.trim,
          volume: clip.volume,
          filterKey: clip.filterKey,
          stickers: clip.stickers,
          texts: clip.texts,
        })),
        timestamp: Date.now(),
        attempts: 0,
      };
      await AsyncStorage.setItem(
        'pendingStoryUpload',
        JSON.stringify(uploadState),
      );
      console.log('Upload state saved for resumption');
    } catch (error) {
      console.error('Failed to save upload state:', error);
    }
  };

  const clearUploadState = async () => {
    try {
      await AsyncStorage.removeItem('pendingStoryUpload');
      console.log('Upload state cleared');
    } catch (error) {
      console.error('Failed to clear upload state:', error);
    }
  };

  const getPendingUpload = async () => {
    try {
      const savedData = await AsyncStorage.getItem('pendingStoryUpload');
      if (savedData) {
        return JSON.parse(savedData);
      }
    } catch (error) {
      console.error('Failed to retrieve pending upload:', error);
    }
    return null;
  };

  // Resume pending upload when app comes to foreground
  const resumePendingUpload = useCallback(async () => {
    try {
      const pendingUpload = await getPendingUpload();
      if (pendingUpload && pendingUpload.clips && pendingUpload.clips.length > 0) {
        console.log('Resuming pending story upload from AsyncStorage...');
        setIsUploadingStory(true);
        await AsyncStorage.setItem('storyUploadInProgress', 'true');
        showToastMessage(toast, 'info', 'Resuming drop upload...');
        await performStoryUpload(pendingUpload.clips);
        setIsUploadingStory(false);
        await AsyncStorage.removeItem('storyUploadInProgress');
      }
    } catch (error) {
      console.error('Error resuming upload:', error);
      setIsUploadingStory(false);
      await AsyncStorage.removeItem('storyUploadInProgress');
    }
  }, [toast]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [resumePendingUpload]);

  const handleAppStateChange = (nextAppState) => {
    console.log('App state changed to:', nextAppState);
    if (nextAppState === 'active') {
      // App came to foreground, resume any pending uploads
      resumePendingUpload();
    }
  };

  const performStoryUpload = async (clips) => {
    // Clear upload state at the start to prevent duplicate uploads on resume
    await clearUploadState();

    const formData = new FormData();
    formData.append('caption', '');

    // New upload with clips data
    clips.forEach((item, index) => {
      const fileUri = item.processedUri || item.original.uri;
      const fileName = `story_${Date.now()}_${index}.${item.isVideo ? 'mp4' : 'jpg'
        }`;
      const fileType = item.isVideo ? 'video/mp4' : 'image/jpeg';

      formData.append('media', {
        uri: fileUri,
        type: fileType,
        name: fileName,
      });
    });

    formData.append(
      'storyMeta',
      JSON.stringify(buildStoryMetaPayload(clips)),
    );

    await appendStoryAudioFiles(formData, clips);

    // Perform upload with retry logic and timeout handling
    const response = await retryWithBackoff(
      () => {
        // Add timeout to individual requests (120 seconds for background uploads)
        return Promise.race([
          PostStory(formData),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Request timeout - network may be unstable')),
              120000,
            ),
          ),
        ]);
      },
      15,
      1000,
    );

    // Check for successful response - both success flag and no error flag
    const isSuccess = response?.success && !response?.error;
    const apiError = response?.message || response?.error;

    if (isSuccess) {
      setStories(prev =>
        prev.map(user =>
          user.isUser
            ? {
              ...user,
              hasUnseenStory: true,
              stories: [
                ...user.stories,
                ...clips.map(item => ({
                  id: `story_${Date.now()}_${Math.random()}`,
                  type: item.isVideo ? 'video' : 'image',
                  uri: item.processedUri || item.original.uri,
                  audio: item.audio || { mode: 'original' },
                  audioTrim: item.audioTrim || { start: 0, end: null },
                  trim: item.trim || { start: 0, end: null },
                  volume: item.volume ?? 1,
                  duration: resolveStoryDurationMs({
                    type: item.isVideo ? 'video' : 'image',
                    isVideo: item.isVideo,
                    duration: item.original?.duration,
                    trim: item.trim,
                    audioTrim: item.audioTrim,
                  }),
                  timestamp: Date.now(),
                  seen: false,
                  views: [],
                  likes: [],
                  comments: [],
                  edits: {
                    filterKey: item.filterKey,
                    stickers: item.stickers,
                    texts: item.texts,
                  },
                })),
              ],
            }
            : user,
        ),
      );

      // Show success toast and hide progress bar after toast is displayed
      showToastMessage(toast, 'success', 'Drop Uploaded Successfully');
      setTimeout(() => {
        setIsUploadingStory(false);
      }, 200); // Hide progress bar quickly after success toast
      fetchStories();
    } else {
      const errorMessage = typeof apiError === 'string' ? apiError : 'Unknown error';
      console.error('API returned error:', response);
      throw new Error(`Upload failed: ${errorMessage}`);
    }
  };

  const handleComposerDone = async (processedArray) => {
    try {
      const clips = await prepareStoryClipsAudioForUpload(processedArray);
      // Don't close composer here - keep it open to show upload progress
      // It will close after upload completes in performStoryUpload

      // Save upload state for resumption if needed
      await saveUploadState(clips);

      // Fire off upload in background without blocking UI
      uploadStoryInBackground(clips);
      setComposerVisible(false);
      // showToastMessage(
      //   toast,
      //   'info',
      //   'Drops uploading...',
      // );
    } catch (error) {
      console.error('Error preparing story:', error);
      showToastMessage(
        toast,
        'danger',
        'Failed to prepare drop. Please try again.',
      );
    }
  };

  // Background upload handler - continues even when app is backgrounded
  const uploadStoryInBackground = async (clips) => {
    try {
      setIsUploadingStory(true);
      await AsyncStorage.setItem('storyUploadInProgress', 'true');
      await performStoryUpload(clips);
      // Note: setIsUploadingStory(false) is called in performStoryUpload after toast is shown
      await AsyncStorage.removeItem('storyUploadInProgress');
    } catch (error) {
      console.error('Story upload failed after all retries:', error?.message || error);
      setIsUploadingStory(false);
      await AsyncStorage.removeItem('storyUploadInProgress');
      showToastMessage(
        toast,
        'danger',
        'Drops upload failed - will retry automatically when connection improves.',
      );
    }
  };

  const handleOpenStory = (user, userIndex) => {
    if (user.isUser && user.stories.length === 0) {
      handleAddStory();
      return;
    }

    if (user.isUser && user.stories.length > 0) {
      Alert.alert(
        'Your Drops',
        'What would you like to do?',
        [
          {
            text: 'View Your Drops',
            onPress: () => openStoryViewer(user, userIndex),
          },
          {
            text: 'Add Another Drops',
            onPress: () => handleAddNewStory(),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
        { cancelable: true }
      );
      return;
    }

    if (!user.stories?.length || user.muted) return;
    openStoryViewer(user, userIndex);
  };

  const openStoryViewer = (user, userIndex) => {
    const storiesToPrefetch = user.stories?.slice(0, 4) || [];
    console.log(storiesToPrefetch,"Stories==>>>>>>>>>>>>>>>>>>>>>>>4444444444444444444444444")
    storiesToPrefetch.forEach(story => {
      if (story?.uri) {
        try {
          if (story.type === 'image') {
            Image.prefetch(story.uri);
          }
        } catch (_e) { }
      }
    });

    storiesToPrefetch.forEach(story => {
      const audio = resolveStoryAudioPayload(story);
      if (audio?.directUrl) {
        try { Image.prefetch(audio.directUrl); } catch (_e) { }
      }
    });

    setCurrentUserIndex(userIndex);
    setCurrentStoryIndex(0);
    setViewerSession(s => s + 1);
    setViewerVisible(true);

    if (!user.isUser) {
      setTimeout(() => {
        markStoryAsSeen(user.id, 0);
      }, 500);
    }
  };

  const nextUserWithStories = fromIndex => {
    for (let i = fromIndex + 1; i < stories.length; i++)
      if (!stories[i].muted && stories[i].stories?.length) return i;
    return -1;
  };

  const prevUserWithStories = fromIndex => {
    for (let i = fromIndex - 1; i >= 0; i--)
      if (!stories[i].muted && stories[i].stories?.length) return i;
    return -1;
  };

  const handleNextStory = () => {
    const user = stories[currentUserIndex];
    if (!user) return handleCloseViewer();

    if (!user.isUser) {
      markStoryAsSeen(user.id, currentStoryIndex);
    }

    if (currentStoryIndex < (user.stories?.length || 0) - 1) {
      const nextStory = user.stories[currentStoryIndex + 1];
      if (nextStory?.uri) {
        try {
          nextStory.type === 'image' ? Image.prefetch(nextStory.uri) : null;
        } catch (_e) { }
      }
      setCurrentStoryIndex(i => i + 1);
      return;
    }
    const nextIdx = nextUserWithStories(currentUserIndex);
    if (nextIdx !== -1) {
      const nextUser = stories[nextIdx];
      const firstStory = nextUser?.stories?.[0];
      if (firstStory?.uri) {
        try {
          firstStory.type === 'image' ? Image.prefetch(firstStory.uri) : null;
        } catch (_e) { }
      }
      setCurrentUserIndex(nextIdx);
      setCurrentStoryIndex(0);
      return;
    }
    handleCloseViewer();
  };

  const handlePrevStory = () => {
    const user = stories[currentUserIndex];
    if (!user) return handleCloseViewer();
    if (currentStoryIndex > 0) {
      const prevStory = user.stories[currentStoryIndex - 1];
      if (prevStory?.uri) {
        try {
          prevStory.type === 'image' ? Image.prefetch(prevStory.uri) : null;
        } catch (_e) { }
      }
      setCurrentStoryIndex(i => i - 1);
      return;
    }
    const prevIdx = prevUserWithStories(currentUserIndex);
    if (prevIdx !== -1) {
      const prevUser = stories[prevIdx];
      const lastStory = prevUser?.stories?.[prevUser.stories.length - 1];
      if (lastStory?.uri) {
        try {
          lastStory.type === 'image' ? Image.prefetch(lastStory.uri) : null;
        } catch (_e) { }
      }
      setCurrentUserIndex(prevIdx);
      setCurrentStoryIndex(stories[prevIdx].stories.length - 1);
      return;
    }
    handleCloseViewer();
  };

  const markStoryAsSeen = (userId, storyIndex) => {
    setStories(prev =>
      prev.map(user =>
        user.id === userId
          ? {
            ...user,
            stories: user.stories.map((story, idx) =>
              idx === storyIndex ? { ...story, seen: true } : story
            ),
            hasUnseenStory: user.stories.some((story, idx) => idx !== storyIndex && !story.seen),
          }
          : user,
      ),
    );
  };

  const handleNextUser = () => {
    const nextIdx = nextUserWithStories(currentUserIndex);
    if (nextIdx !== -1) {
      const nextUser = stories[nextIdx];
      const firstStory = nextUser?.stories?.[0];
      if (firstStory?.uri) {
        try {
          firstStory.type === 'image' ? Image.prefetch(firstStory.uri) : null;
        } catch (_e) { }
      }
      setCurrentUserIndex(nextIdx);
      setCurrentStoryIndex(0);
    }
  };

  const handlePrevUser = () => {
    const prevIdx = prevUserWithStories(currentUserIndex);
    if (prevIdx !== -1) {
      const prevUser = stories[prevIdx];
      const lastStory = prevUser?.stories?.[prevUser.stories.length - 1];
      if (lastStory?.uri) {
        try {
          lastStory.type === 'image' ? Image.prefetch(lastStory.uri) : null;
        } catch (_e) { }
      }
      setCurrentUserIndex(prevIdx);
      setCurrentStoryIndex(stories[prevIdx].stories.length - 1);
    }
  };

  const handleCloseViewer = () => {
    setViewerVisible(false);
    setCurrentUserIndex(0);
    setCurrentStoryIndex(0);
    dispatch(hideLoader());
  };

  const handleOpenStoryUserProfile = useCallback((user) => {
    if (!user?.id || user?.isUser) return;
    navigation.navigate('UsersProfile', { userId: user.id });
  }, [navigation]);

  const handleDeleteStory = async (storyId) => {
    try {
      const response = await DeleteStory(storyId.replace('_0', ''));

      if (response?.success) {
        setStories(prev =>
          prev.map(user =>
            user.isUser
              ? {
                ...user,
                stories: user.stories.filter(story => story.id !== storyId),
                hasUnseenStory: user.stories.filter(story => story.id !== storyId).length > 0
              }
              : user
          )
        );

        showToastMessage(toast, 'success', 'Drop deleted successfully!');

        const currentUser = stories[currentUserIndex];
        if (!currentUser || currentUser.stories.length <= 1) {
          handleCloseViewer();
        } else if (currentStoryIndex >= currentUser.stories.length - 1) {
          setCurrentStoryIndex(Math.max(0, currentStoryIndex - 1));
        }

        fetchStories();
      } else {
        showToastMessage(toast, 'danger', 'Failed to delete drop. Please try again.');
      }
    } catch (error) {
      showToastMessage(toast, 'danger', 'Failed to delete drop. Please try again.');
    }
  };

  const onToggleLike = async (ownerId, storyId, nextLiked) => {
    try {
      const actualStoryId = storyId.replace('_0', '');
      const response = await postLikeStory({ storyId: actualStoryId });

      if (response?.success) {
        const key = `${ownerId}:${storyId}`;
        setLikes(prev => {
          const curr = prev[key] || { liked: false, count: 0 };
          let count = curr.count;
          if (nextLiked && !curr.liked) count += 1;
          if (!nextLiked && curr.liked && count > 0) count -= 1;
          return { ...prev, [key]: { liked: nextLiked, count } };
        });
      } else {
        console.error('Failed to like drop:', response);
        showToastMessage(toast, 'danger', 'Failed to like drop. Please try again.');
      }
    } catch (error) {
      console.error('Error liking story:', error);
      showToastMessage(toast, 'danger', 'Something went wrong. Please try again.');
    }
  };

  const onAddComment = async (ownerId, storyId, text) => {
    try {
      const actualStoryId = storyId.replace('_0', '');
      const cleanText = String(text || '').trim();

      if (!cleanText) return;

      const response = await postCommentStory({
        comment: cleanText,
        storyId: actualStoryId
      });

      if (response?.success) {
        const key = `${ownerId}:${storyId}`;
        setComments(prev => {
          const arr = prev[key] || [];
          return {
            ...prev,
            [key]: [...arr, { user: 'you', text: cleanText, ts: Date.now() }],
          };
        });

        try {
          if (ownerId && currentUserId && String(ownerId) !== String(currentUserId)) {
            await sendChatMessage({
              senderId: currentUserId,
              receiverId: ownerId,
              message: cleanText,
              type: 'CHAT',
            });
          }
        } catch (chatError) {
          console.warn('Failed to deliver story reply to inbox:', chatError);
        }
      } else {
        console.error('Failed to add comment:', response);
        showToastMessage(toast, 'danger', 'Failed to send comment. Please try again.');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      showToastMessage(toast, 'danger', 'Something went wrong. Please try again.');
    }
  };

  const onMuteUser = (userId, mute) => {
    setStories(prev =>
      prev.map(u => (u.id === userId ? { ...u, muted: !!mute } : u)),
    );
    Alert.alert(
      mute ? 'Muted' : 'Unmuted',
      mute
        ? 'You will no longer see their stories.'
        : 'You will see their stories again.',
    );
  };

  const onReportUser = userId => {
    const u = stories.find(s => s.id === userId);
    Alert.alert(
      'Report',
      `Thanks for letting us know. We'll review ${u?.username}'s story.`,
    );
  };

  const dataToShow = stories.filter(s => !s.muted);
  const ITEM_W = 80;
  const getItemLayout = (_, index) => ({
    length: ITEM_W,
    offset: ITEM_W * index,
    index,
  });

  const renderStoryItem = ({ item }) => (
    <TouchableOpacity
      style={sidebarMode ? sidebarStyles.verticalStoryItem : styles.storyItem}
      onPress={() =>
        handleOpenStory(
          item,
          stories.findIndex(s => s.id === item.id),
        )
      }
      activeOpacity={0.8}
    >
      <View style={[item.isUser && (sidebarMode ? sidebarStyles.verticalUserBorder : styles.userBorder)]}>
        {item.isUser && item.stories.length === 0 && (
          <Icon
            name="add-circle"
            size={sidebarMode ? 20 : 28}
            style={sidebarMode ? sidebarStyles.verticalAddIcon : styles.addIcon}
          />
        )}
        <View style={styles.positiom}>
          <View style={styles.avatarContainer}>
            <HexAvatar
              uri={item.isUser ? (profileImage || item.image) : item.image}
              isUser={!!item.isUser}
              size={sidebarMode ? 80 : 79}
              borderWidth={item.isUser ? 3 : 2}
              borderColor={item.isUser ? '#4da3ff' : '#000'}
            />

            {item.isUser && item.stories.length > 0 && (
              <TouchableOpacity
                style={sidebarMode ? sidebarStyles.verticalAddStoryOverlay : styles.addStoryOverlay}
                onPress={(e) => {
                  e.stopPropagation();
                  handleAddNewStory();
                }}
                activeOpacity={0.8}
              >
                <View style={sidebarMode ? sidebarStyles.verticalAddStoryButton : styles.addStoryButton}>
                  <Icon name="add" size={sidebarMode ? 12 : 16} color="#fff" />
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
      <Text
        style={
          item.isUser
            ? (sidebarMode ? sidebarStyles.verticalDropsText : styles.dropsText)
            : styles.storyUsername
        }
        numberOfLines={1}
      >
        {item.username || (item.isUser ? 'Drops' : '')}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.storiesContainer}>
      <FlatList
        horizontal={!sidebarMode}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        data={dataToShow}
        keyExtractor={item => item.id}
        initialNumToRender={10}
        windowSize={5}
        removeClippedSubviews
        contentContainerStyle={
          sidebarMode
            ? { paddingVertical: 8, paddingHorizontal: 8 }
            : { paddingHorizontal: 8 }
        }
        renderItem={renderStoryItem}
      />

      <StoryViewer
        key={`viewer-${viewerSession}`}
        visible={viewerVisible}
        stories={stories}
        currentUserIndex={currentUserIndex}
        currentStoryIndex={currentStoryIndex}
        onClose={handleCloseViewer}
        onNext={handleNextStory}
        onPrev={handlePrevStory}
        onNextUser={handleNextUser}
        onPrevUser={handlePrevUser}
        likes={likes}
        onToggleLike={onToggleLike}
        onAddComment={onAddComment}
        onMuteUser={onMuteUser}
        onReportUser={onReportUser}
        onDeleteStory={handleDeleteStory}
        ownerProfileImage={profileImage}
        onDrawerClose={onDrawerClose}
        onOpenUserProfile={handleOpenStoryUserProfile}
      />

      <StoryComposer
        modalVisible={composerVisible}
        mediaList={composerList}
        onCancel={() => {
          setComposerVisible(false);
          setComposerList([]);
          setComposerMedia(null);
        }}
        onDone={handleComposerDone}
      />

      {isUploadingStory && (
        <View
          style={{
            backgroundColor: '#f5f5f5',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderTopWidth: 1,
            borderTopColor: '#e0e0e0',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <ActivityIndicator size={16} color="#4da3ff" style={{ marginRight: 10 }} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#1a1a1a' }}>
              Uploading Drops...
            </Text>
          </View>
          <View
            style={{
              height: 4,
              backgroundColor: '#e0e0e0',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <Animated.View
              style={{
                height: '100%',
                backgroundColor: '#4da3ff',
                borderRadius: 2,
                width: uploadProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              }}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const sidebarStyles = StyleSheet.create({
  verticalStoriesContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  verticalStoryItem: {
    alignItems: 'center',
    marginVertical: -8,
    width: '100%',
  },
  verticalUserBorder: {
    position: 'relative',
  },
  verticalAddIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
  },
  verticalAddStoryOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    zIndex: 10,
  },
  verticalAddStoryButton: {
    backgroundColor: '#4da3ff',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  verticalDropsText: {
    marginTop: 2,
    fontSize: 12,
    color: '#6b6b6b',
    fontWeight: '600',
    textAlign: 'center',
  },
});
