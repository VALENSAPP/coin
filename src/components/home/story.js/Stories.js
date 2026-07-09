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
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
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
import {
  getStoryByUser,
  PostStory,
  DeleteStory,
  getFollowingUserStories,
  postCommentStory,
  postLikeStory,
  viewStory,
} from '../../../services/stories';
import { buildStoryMetaPayload } from '../../../utils/buildStoryMeta';
import {
  appendStoryAudioFiles,
  prepareStoryClipsAudioForUpload,
} from '../../../utils/storyAudioUpload';
import {
  appendStoryThumbnailFiles,
  prepareStoryClipThumbnails,
  resolveClipThumbnailUri,
  resolveStoryVideoThumbnailSource,
} from '../../../utils/storyThumbnail';
import {
  resolveStoryAudioPayload,
  resolveStoryDurationMs,
  mapApiStoryRowToClips,
} from '../../../utils/storyAudioResolve';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showToastMessage } from '../../displaytoastmessage';
import { Toast, useToast } from 'react-native-toast-notifications';
import { getUserCredentials } from '../../../services/post';
import Feather from 'react-native-vector-icons/Feather';
import { sendMessage as sendChatMessage } from '../../../services/chatMessage';

import { useDispatch, useSelector } from 'react-redux';
import { hideLoader, showLoader } from '../../../redux/actions/LoaderAction';
import { setProfileImg } from '../../../redux/actions/ProfileImgAction';
import ShareModal from '../../modals/ShareModal';
import { useLanguage } from '../../../i18n';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const DOUBLE_TAP_DELAY = 300;

function inferStoryMediaTypeFromUrl(url) {
  if (typeof url !== 'string') return 'image';
  const lower = url.toLowerCase().trim();
  const pathPart = lower.split('?')[0];
  const videoMarkers = [
    '.mp4', '.mov', '.m4v', '.avi', '.webm', '.mkv',
    '.flv', '.wmv', '.3gp', '.m3u8', '.mpg', '.mpeg',
  ];
  if (videoMarkers.some(m => pathPart.includes(m))) return 'video';
  if (pathPart.endsWith('/video') || lower.includes('/video/')) return 'video';
  if (
    lower.includes('type=video') ||
    lower.includes('content_type=video') ||
    lower.includes('format=mp4')
  ) return 'video';
  return 'image';
}

function looksLikeImageUrl(url) {
  if (typeof url !== 'string') return false;
  const pathPart = url.split('?')[0].toLowerCase();
  return /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(pathPart);
}

function clipDurationSuggestsVideo(clipMeta) {
  let d = Number(clipMeta?.duration);
  if (!Number.isFinite(d) || d <= 0) return false;
  if (d > 500) d = d / 1000;
  return d > 0.35 && d < 7200;
}

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
  wrapper: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  videoWrapper: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  video: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  controls: { opacity: 0, height: 0, overflow: 'hidden' },
  playControl: { opacity: 0 },
  controlButton: { opacity: 0 },
  controlIcon: { opacity: 0 },
  playIcon: { opacity: 0 },
  seekBar: { opacity: 0, height: 0 },
  seekBarFullWidth: { opacity: 0, height: 0 },
  seekBarProgress: { opacity: 0, height: 0 },
  seekBarKnob: { opacity: 0, width: 0, height: 0 },
  seekBarBackground: { opacity: 0, height: 0 },
  thumbnail: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  playButton: { opacity: 0 },
  playArrow: { opacity: 0 },
};

const storyVideoThumbnailOverlayStyle = [
  StyleSheet.absoluteFillObject,
  { zIndex: 10, elevation: 10 },
];

const storyVideoLoadModalStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 12,
    backgroundColor: '#171717',
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  primaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: '#4da3ff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  secondaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  closeButton: {
    marginTop: 10,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 14,
    fontWeight: '600',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// StoryAnalytics Modal
// ─────────────────────────────────────────────────────────────────────────────
const StoryAnalytics = ({ visible, onClose, story, currentUser }) => {
  const [activeTab, setActiveTab] = useState('likes');
  const { t } = useLanguage();

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
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    closeButton: { padding: 5 },
    tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#333' },
    tab: { flex: 1, paddingVertical: 15, alignItems: 'center' },
    activeTab: { borderBottomWidth: 2, borderBottomColor: '#4da3ff' },
    tabText: { color: '#aaa', fontSize: 14, fontWeight: '600' },
    activeTabText: { color: '#4da3ff' },
    tabCount: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 2 },
    listContainer: { maxHeight: SCREEN_HEIGHT * 0.4 },
    userItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
    userAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 15 },
    userInfo: { flex: 1 },
    username: { color: '#fff', fontSize: 14, fontWeight: '600' },
    timestamp: { color: '#aaa', fontSize: 12, marginTop: 2 },
    commentText: { color: '#ddd', fontSize: 13, marginTop: 2 },
    emptyState: { padding: 40, alignItems: 'center' },
    emptyText: { color: '#aaa', fontSize: 16, textAlign: 'center' },
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
        <Text style={analyticsStyles.timestamp}>{formatAnalyticsTime(item.timestamp)}</Text>
        {type === 'comments' && item.text && (
          <Text style={analyticsStyles.commentText}>{item.text}</Text>
        )}
      </View>
    </View>
  );

  const renderEmptyState = (type) => (
    <View style={analyticsStyles.emptyState}>
      <Text style={analyticsStyles.emptyText}>
        {type === 'likes' ? t('stories.noLikesYet') : t('stories.noCommentsYet')}
      </Text>
    </View>
  );

  // Tab labels keyed from translations
  const TAB_KEYS = [
    { key: 'likes', label: t('stories.likesTab') },
    { key: 'comments', label: t('stories.commentsTab') },
  ];

  const getTabData = () => {
    if (!story) return [];
    switch (activeTab) {
      case 'likes': return story.likes || [];
      case 'comments': return story.comments || [];
      default: return [];
    }
  };

  if (!visible || !story) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={analyticsStyles.backdrop}>
        <View style={analyticsStyles.container}>
          <View style={analyticsStyles.header}>
            <Text style={analyticsStyles.headerTitle}>{t('stories.storyActivityTitle')}</Text>
            <TouchableOpacity onPress={onClose} style={analyticsStyles.closeButton}>
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={analyticsStyles.tabContainer}>
            {TAB_KEYS.map(({ key, label }) => {
              const count = story[key]?.length || 0;
              const isActive = activeTab === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[analyticsStyles.tab, isActive && analyticsStyles.activeTab]}
                  onPress={() => setActiveTab(key)}
                >
                  <Text style={[analyticsStyles.tabText, isActive && analyticsStyles.activeTabText]}>
                    {label}
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


// ─────────────────────────────────────────────────────────────────────────────
// OptionsSheet
// ─────────────────────────────────────────────────────────────────────────────
const OptionsSheet = ({ visible, onClose, isMuted, onToggleMute, onReport, username }) => {
  const { t } = useLanguage();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={optStyles.backdrop}>
        <View style={optStyles.sheet}>
          <View style={optStyles.handle} />
          <Text style={optStyles.title}>{username}</Text>

          <TouchableOpacity style={optStyles.row} onPress={onToggleMute}>
            <Icon name={isMuted ? 'volume-high-outline' : 'volume-mute-outline'} size={22} color="#fff" />
            <Text style={optStyles.rowText}>
              {isMuted ? t('stories.optionsUnmute') : t('stories.optionsMute')} {username}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={optStyles.row} onPress={onReport}>
            <Icon name="flag-outline" size={22} color="#ff6969" />
            <Text style={[optStyles.rowText, { color: '#ff8b8b' }]}>
              {t('stories.optionsReport')} {username}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[optStyles.row, optStyles.cancel]} onPress={onClose}>
            <Text style={optStyles.cancelText}>{t('stories.optionsCancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// StoryViewer
// ─────────────────────────────────────────────────────────────────────────────
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
  currentUserId,          // ← add this
}) => {
  const insets = useSafeAreaInsets();
  const storyTopInset = Math.max(insets.top, Platform.OS === 'ios' ? 44 : 0);
  const storyProgressTop = storyTopInset + 6;
  const storyHeaderTop = storyProgressTop + 10;
  const dispatch = useDispatch();
  const { t } = useLanguage();
  const [paused, setPaused] = useState(false);
  const [analyticsVisible, setAnalyticsVisible] = useState(false);
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const commentInputRef = useRef(null);
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
  const overlayAudioTimeRef = useRef(0);
  const shareRef = useRef(null);
  const [selectedPostId, setSelectedPostId] = useState(null);

  // ── Media state ──────────────────────────────────────────────────────────
  const [isMediaReady, setIsMediaReady] = useState(false);
  const [isFirstFrameReady, setIsFirstFrameReady] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [videoLoadModalVisible, setVideoLoadModalVisible] = useState(false);
  const [videoRetryNonce, setVideoRetryNonce] = useState(0);
  const mediaDurationRef = useRef(null);
  const videoDurationSecRef = useRef(0);
  const progressStartedRef = useRef(false);
  const mediaFullyLoadedRef = useRef(false);
  const videoReadyDurationRef = useRef(null);
  const videoLoadWatchdogRef = useRef(null);

  const nextUserCb = useRef(onNextUser);
  const prevUserCb = useRef(onPrevUser);
  const closeCb = useRef(onClose);
  const isViewingOwnStoryRef = useRef(false);
  const lastViewedStoryKeyRef = useRef(null);
  useEffect(() => { nextUserCb.current = onNextUser; }, [onNextUser]);
  useEffect(() => { prevUserCb.current = onPrevUser; }, [onPrevUser]);
  useEffect(() => { closeCb.current = onClose; }, [onClose]);

  const pausedRef = useRef(paused);
  const visibleRef = useRef(visible);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { visibleRef.current = visible; }, [visible]);

  const heartScale = useRef(new Animated.Value(0)).current;
  const triggerHeart = () => {
    heartScale.setValue(0);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 140 }),
      Animated.timing(heartScale, { toValue: 0, duration: 260, useNativeDriver: true }),
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
      Animated.timing(ty, { toValue: -160, duration: 800, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 900, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1.3, friction: 6, tension: 120, useNativeDriver: true }),
    ]).start(() => setEmojiBursts(prev => prev.filter(b => b.id !== id)));
  };

  const currentUser = stories[currentUserIndex];
  const currentStory = currentUser?.stories[currentStoryIndex];
  const isViewingOwnStory = currentUser?.isUser;
  useEffect(() => { isViewingOwnStoryRef.current = !!isViewingOwnStory; }, [isViewingOwnStory]);

  // Call view API once per active story (per viewer session)
  useEffect(() => {
    if (!visible) {
      lastViewedStoryKeyRef.current = null;
      return;
    }

    if (!currentStory || isViewingOwnStory) return;
    if (!currentStory.storyId) return;

    const viewKey = `${currentUser?.id || ''}:${String(currentStory.storyId)}:${currentStoryIndex}`;

    if (lastViewedStoryKeyRef.current === viewKey) return;

    lastViewedStoryKeyRef.current = viewKey;

    (async () => {
      try {
        const response = await viewStory({
          storyId: currentStory.storyId,
        });

        console.log('viewStory response =>', response);

        // check response data here
        if (response?.success) {
          console.log('Story viewed successfully');
        }

      } catch (e) {
        console.warn(
          '[StoryViewer] viewStory failed:',
          e?.message || e
        );
      }
    })();
  }, [visible, currentUserIndex, currentStoryIndex]);

  const resolvedAudio = resolveStoryAudioPayload(currentStory);
  const youtubeVideoId = resolvedAudio.youtubeVideoId;
  const directAudioUrl = resolvedAudio.directUrl;
  const hasDirectAudio = typeof directAudioUrl === 'string' && directAudioUrl.length > 0;
  const hasOverlayAudio = hasDirectAudio || !!youtubeVideoId;
  const isYoutubeAudio = !hasDirectAudio && !!youtubeVideoId;
  const isDirectAudio = hasDirectAudio;
  const audioTrimStartSec = Math.max(0, Number(currentStory?.audioTrim?.start) || 0);
  const audioTrimEndSecRaw = Number(currentStory?.audioTrim?.end);
  const audioTrimEndSec =
    Number.isFinite(audioTrimEndSecRaw) && audioTrimEndSecRaw > audioTrimStartSec
      ? audioTrimEndSecRaw : null;
  const audioVolumePercent = Math.max(0, Math.min(100, Math.round((Number(currentStory?.volume) || 1) * 100)));
  const shouldPlayStoryAudio = visible && !paused && hasOverlayAudio;

  const currentStoryThumbnail = resolveStoryVideoThumbnailSource(currentStory);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const stopAndResetProgress = (resetToZero = true) => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    progressAnimation.stopAnimation();
    if (resetToZero) { progressAnimation.setValue(0); setCurrentProgress(0); }
  };

  const clearVideoLoadWatchdog = () => {
    if (videoLoadWatchdogRef.current) {
      clearTimeout(videoLoadWatchdogRef.current);
      videoLoadWatchdogRef.current = null;
    }
  };

  const showVideoLoadModal = () => {
    clearVideoLoadWatchdog();
    if (!visibleRef.current || currentStory?.type !== 'video') return;
    setStoryPaused(true);
    stopAndResetProgress(false);
    setVideoLoadModalVisible(true);
  };

  const startVideoLoadWatchdog = () => {
    clearVideoLoadWatchdog();
    if (currentStory?.type !== 'video') return;
    videoLoadWatchdogRef.current = setTimeout(() => {
      if (!visibleRef.current || pausedRef.current || isFirstFrameReady) return;
      showVideoLoadModal();
    }, 12000);
  };

  const retryVideoPlayback = () => {
    setVideoLoadModalVisible(false);
    setIsMediaReady(false);
    setIsFirstFrameReady(false);
    setIsBuffering(true);
    pausedRef.current = false;
    setPaused(false);
    progressAnimation.setValue(0);
    setCurrentProgress(0);
    setVideoRetryNonce(n => n + 1);
    startVideoLoadWatchdog();
  };

  const kickPlayback = () => {
    try { videoRef.current?.resume?.(); } catch (_e) { }
  };

  const startProgress = (duration) => {
    Animated.timing(progressAnimation, {
      toValue: 1,
      duration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !pausedRef.current) onNext();
    });
  };

  const pauseStoryVideo = () => {
    try { videoRef.current?.pause?.(); } catch (_e) { }
  };

  const pauseOverlayAudio = () => {
    try { youtubeRef.current?.pauseVideo?.(); } catch (_e) { }
    try { youtubeRef.current?.mute?.(); } catch (_e) { }
    try { directAudioRef.current?.pause?.(); } catch (_e) { }
  };

  const resolveOverlayAudioResumeSec = () => {
    const saved = Number(overlayAudioTimeRef.current);
    if (Number.isFinite(saved) && saved >= audioTrimStartSec) {
      if (audioTrimEndSec != null && saved >= audioTrimEndSec) return audioTrimStartSec;
      return saved;
    }
    return audioTrimStartSec;
  };

  const setStoryPaused = (nextPaused) => {
    if (nextPaused) {
      pauseStoryVideo();
      pauseOverlayAudio();
    }
    pausedRef.current = nextPaused;
    setPaused(nextPaused);
  };

  const handlePause = () => {
    setStoryPaused(true);
    stopAndResetProgress(false);
  };

  const handleResume = () => {
    if (!currentStory) return;
    pausedRef.current = false;
    setPaused(false);
    if (currentStory.type === 'video') {
      kickPlayback();
      return;
    }
    const remaining = Math.max(0, 1 - currentProgress);
    const totalDuration = resolveStoryDurationMs(currentStory);
    const remainingDuration = totalDuration * remaining;
    if (remainingDuration > 50) startProgress(remainingDuration);
  };

  // ── Story change: reset ALL state ─────────────────────────────────────────
  useEffect(() => {
    if (!visible || !currentStory) return;

    progressStartedRef.current = false;
    mediaFullyLoadedRef.current = false;
    mediaDurationRef.current = null;
    videoDurationSecRef.current = 0;

    progressAnimation.stopAnimation();
    progressAnimation.setValue(0);
    setCurrentProgress(0);
    overlayAudioTimeRef.current = audioTrimStartSec || 0;

    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }

    pausedRef.current = false;
    setPaused(false);
    setIsMediaReady(false);
    setIsBuffering(false);
    setVideoLoadModalVisible(false);
    setIsFirstFrameReady(false);
    setIsImageLoaded(false);
    dispatch(hideLoader());

    if (currentStory.type === 'video' && videoRef.current?.seek) {
      try {
        videoRef.current.seek(0);
        setTimeout(() => { try { videoRef.current?.resume?.(); } catch (_e) { } }, 50);
      } catch (_e) { }
    }
    if (isDirectAudio && directAudioRef.current?.seek) {
      try { directAudioRef.current.seek(audioTrimStartSec || 0); } catch (_e) { }
    }

    const isVideo = currentStory.type === 'video';
    if (isVideo) startVideoLoadWatchdog();
    const fallbackDelay = isVideo ? 60000 : 5000;
    const fallbackTimer = setTimeout(() => {
      if (
        isVideo ||
        pausedRef.current ||
        !visibleRef.current ||
        progressStartedRef.current ||
        mediaFullyLoadedRef.current
      ) return;
      progressStartedRef.current = true;
      startProgress(resolveStoryDurationMs(currentStory));
    }, fallbackDelay);

    return () => {
      clearTimeout(fallbackTimer);
      clearVideoLoadWatchdog();
      progressAnimation.stopAnimation();
      pauseOverlayAudio();
      pauseStoryVideo();
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [visible, currentUserIndex, currentStoryIndex]);

  useEffect(() => {
    const listener = progressAnimation.addListener(({ value }) => setCurrentProgress(value));
    return () => progressAnimation.removeListener(listener);
  }, [progressAnimation]);

  useEffect(() => {
    if (!visible) {
      if (tapTimerRef.current) { clearTimeout(tapTimerRef.current); tapTimerRef.current = null; }
      stopAndResetProgress(true);
      pausedRef.current = false;
      setPaused(false);
      pauseOverlayAudio();
      pauseStoryVideo();
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

  useEffect(() => {
    if (!visible) return;
    const show = Keyboard.addListener('keyboardDidShow', () => { keyboardVisibleRef.current = true; handlePause(); });
    const hide = Keyboard.addListener('keyboardDidHide', () => { keyboardVisibleRef.current = false; handleResume(); });
    return () => { show?.remove(); hide?.remove(); };
  }, [visible]);

  useEffect(() => {
    if (!visible || !isDirectAudio || shouldPlayStoryAudio) return;
    pauseOverlayAudio();
  }, [visible, isDirectAudio, shouldPlayStoryAudio, directAudioUrl]);

  useEffect(() => {
    if (!isYoutubeAudio || !shouldPlayStoryAudio) return;
    const tick = setInterval(() => {
      (async () => {
        try {
          const cur = await youtubeRef.current?.getCurrentTime?.();
          if (typeof cur === 'number' && !Number.isNaN(cur)) {
            overlayAudioTimeRef.current = cur;
          }
        } catch (_e) { }
      })();
    }, 280);
    return () => clearInterval(tick);
  }, [isYoutubeAudio, shouldPlayStoryAudio, youtubeVideoId]);

  // ── Pan responder ─────────────────────────────────────────────────────────
  const pan = useRef(new Animated.ValueXY()).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 15 || Math.abs(g.dy) > 15,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, g) => {
        const absDx = Math.abs(g.dx), absDy = Math.abs(g.dy);
        return (absDx > 15 || absDy > 15) && (absDx > 5 || absDy > 5);
      },
      onPanResponderGrant: () => handlePause(),
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        const { dx, dy, vx, vy } = g;
        const absDx = Math.abs(dx), absDy = Math.abs(dy);

        if (dy > 140 && absDy > absDx * 1.5 && vy > 0.8) {
          stopAndResetProgress(true);
          Animated.timing(pan, { toValue: { x: 0, y: SCREEN_HEIGHT }, duration: 160, useNativeDriver: false })
            .start(() => { pan.setValue({ x: 0, y: 0 }); closeCb.current?.(); });
          return;
        }

        const shouldOpenMessageComposer =
          !isViewingOwnStoryRef.current &&
          dy < -55 &&
          absDy > absDx * 1.25 &&
          (Math.abs(vy) > 0.35 ? vy < -0.15 : true);

        if (shouldOpenMessageComposer) {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
          requestAnimationFrame(() => requestAnimationFrame(() => {
            try { commentInputRef.current?.focus(); } catch (_e) { }
          }));
          return;
        }

        const isHorizontal = (absDx > 80 || Math.abs(vx) > 0.6) && absDx > absDy * 1.2;
        if (isHorizontal) {
          stopAndResetProgress(true);
          dx > 0 ? prevUserCb.current?.() : nextUserCb.current?.();
          Animated.timing(pan, { toValue: { x: 0, y: 0 }, duration: 100, useNativeDriver: false }).start();
          return;
        }

        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        handleResume();
      },
      onPanResponderTerminate: () => {
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        handleResume();
      },
    }),
  ).current;

console.log('VIEWER currentUser:', currentUser?.id, currentUser?.username, 'isUser:', currentUser?.isUser);


  if (!visible || !currentUser || !currentStory) return null;

  const storyId = currentStory.id;
  const ownerId = currentUser.id;
  const storyKey = `${ownerId}:${storyId}`;
  const liked = !!likes[storyKey]?.liked;

  const dismissStoryKeyboard = () => {
    try { commentInputRef.current?.blur(); } catch (_e) { }
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
      if (tapTimerRef.current) { clearTimeout(tapTimerRef.current); tapTimerRef.current = null; }
      lastTapRef.current = 0;
      return;
    }
    if (keyboardVisibleRef.current || commentInputRef.current?.isFocused?.() === true) {
      dismissStoryKeyboard();
      if (tapTimerRef.current) { clearTimeout(tapTimerRef.current); tapTimerRef.current = null; }
      lastTapRef.current = 0;
      return;
    }

    const now = Date.now();
    const timeDiff = now - lastTapRef.current;
    if (timeDiff < DOUBLE_TAP_DELAY) {
      lastTapRef.current = 0;
      if (tapTimerRef.current) { clearTimeout(tapTimerRef.current); tapTimerRef.current = null; }
      onToggleLike(ownerId, storyId, true);
      triggerHeart();
      return;
    }

    lastTapRef.current = now;
    const tapX = event?.nativeEvent?.pageX || SCREEN_WIDTH / 2;
    const leftZone = SCREEN_WIDTH * 0.3;
    if (tapTimerRef.current) { clearTimeout(tapTimerRef.current); tapTimerRef.current = null; }
    tapTimerRef.current = setTimeout(() => {
      pauseOverlayAudio();
      pauseStoryVideo();
      stopAndResetProgress(true);
      tapX < leftZone ? onPrev() : onNext();
      tapTimerRef.current = null;
    }, DOUBLE_TAP_DELAY);
  };

  const openOptions = () => { handlePause(); setOptionsOpen(true); };
  const closeOptions = () => { setOptionsOpen(false); handleResume(); };
  const openAnalytics = () => { handlePause(); setAnalyticsVisible(true); };
  const closeAnalytics = () => { setAnalyticsVisible(false); handleResume(); };

  const handleOpenUserProfile = () => {
    if (isViewingOwnStory || !currentUser?.id) return;
    stopAndResetProgress(true);
    onClose?.();
    setTimeout(() => { if (onDrawerClose) onDrawerClose(); onOpenUserProfile?.(currentUser); }, 120);
  };

  const handleDeleteStory = () => {
    Alert.alert(
      t('stories.deleteDropTitle'),
      t('stories.deleteDropMessage'),
      [
        { text: t('stories.deleteDropCancel'), style: 'cancel' },
        {
          text: t('stories.deleteDropConfirm'),
          style: 'destructive',
          onPress: () => { onDeleteStory(storyId); handleResume(); },
        },
      ],
    );
  };

  // ── Video media callbacks ─────────────────────────────────────────────────
  const markVideoFrameReady = () => {
    if (!visibleRef.current || pausedRef.current) return;
    clearVideoLoadWatchdog();
    setVideoLoadModalVisible(false);
    setIsFirstFrameReady(true);
    setIsMediaReady(true);
    setIsBuffering(false);
    kickPlayback();
  };

  const onMainVideoProgress = ({ currentTime }) => {
    if (!visibleRef.current || pausedRef.current) return;
    if (!isFirstFrameReady && Number(currentTime) > 0) {
      markVideoFrameReady();
    }
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
    setIsImageLoaded(true);
    mediaFullyLoadedRef.current = true;
    setIsMediaReady(true);
    if (!progressStartedRef.current) {
      progressStartedRef.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (visibleRef.current && !pausedRef.current) {
          startProgress(resolveStoryDurationMs(currentStory));
        }
      }));
    }
  };

  const onVideoLoaded = (meta) => {
    dispatch(hideLoader());
    const duration =
      (meta?.duration ? meta.duration * 1000 : null) || currentStory?.duration || 15000;
    mediaDurationRef.current = duration;
    videoReadyDurationRef.current = duration;
    const durSec =
      meta?.duration != null && Number(meta.duration) > 0
        ? Number(meta.duration)
        : duration / 1000;
    videoDurationSecRef.current = durSec;
    mediaFullyLoadedRef.current = true;
    setIsMediaReady(false);
    progressAnimation.setValue(0);

    kickPlayback();
    requestAnimationFrame(kickPlayback);
    setTimeout(kickPlayback, 120);
    setTimeout(kickPlayback, 500);
  };

  const onMediaError = (error) => {
    dispatch(hideLoader());
    console.warn('[StoryViewer] media failed to load:', {
      storyId: currentStory?.id,
      type: currentStory?.type,
      uri: currentStory?.uri,
      error,
    });
    mediaFullyLoadedRef.current = true;
    setIsMediaReady(true);
    if (currentStory?.type === 'video') {
      showVideoLoadModal();
      return;
    }
    // Image failed — keep the progress bar still; user can tap to skip.
    setStoryPaused(true);
    stopAndResetProgress(true);
  };

  const onVideoBuffer = ({ isBuffering: buffering }) => {
    setIsBuffering(buffering);
    if (buffering && currentStory?.type === 'video' && !isFirstFrameReady) {
      startVideoLoadWatchdog();
    }
  };

  // ── User analytics bottom UI styles ──────────────────────────────────────
  const userAnalyticsStyles = {
    bottomContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'transparent',
      paddingHorizontal: 14,
      paddingTop: 10,
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
    analyticsText: { color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 8 },
    statsRow: { flexDirection: 'row', marginTop: 0, marginBottom: 8, flexWrap: 'wrap' },
    actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
    statText: { color: '#fff', fontSize: 12, marginLeft: 4 },
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
    deleteText: { color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 8 },
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
    shareText: { color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 8 },
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => { stopAndResetProgress(true); onClose(); }}
    >
      <View style={modalStyles.modalBg} {...panResponder.panHandlers}>

        {/* ── IMAGE story (black placeholder always present) ──────────────── */}
        {currentStory?.type === 'image' ? (
          <View style={modalStyles.storyMediaFullscreen} pointerEvents="none">
            {currentStoryThumbnail && !isImageLoaded ? (
              <Image
                source={currentStoryThumbnail}
                style={modalStyles.storyMediaFill}
                resizeMode="cover"
                pointerEvents="none"
              />
            ) : null}
            {currentStory?.uri ? (
              <Image
                key={`story_img_${storyKey}`}
                source={{ uri: currentStory.uri }}
                style={[
                  modalStyles.storyMediaFill,
                  currentStoryThumbnail && !isImageLoaded
                    ? { opacity: 0, position: 'absolute' }
                    : null,
                ]}
                resizeMode="cover"
                onLoadEnd={onImageLoaded}
                onError={onMediaError}
              />
            ) : null}
          </View>
        ) : null}

        {/* ── Fixed UI overlay: progress + header ─────────────────────────── */}
        <View style={modalStyles.storyUiOverlay} pointerEvents="box-none">
          <View style={[modalStyles.progressContainer, { paddingTop: storyProgressTop }]}>
            {currentUser.stories.map((_, idx) => (
              <View key={idx} style={modalStyles.progressBarBg}>
                <Animated.View
                  style={[
                    modalStyles.progressBarFill,
                    {
                      width:
                        idx === currentStoryIndex
                          ? progressAnimation.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                          : idx < currentStoryIndex ? '100%' : '0%',
                    },
                  ]}
                />
              </View>
            ))}
          </View>

          <View
            style={[modalStyles.topBar, { top: storyHeaderTop }]}
            onStartShouldSetResponder={() => true}
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
                <Text style={modalStyles.username}>
                  {isViewingOwnStory ? t('stories.yourDrops') : currentUser.username}
                </Text>
              </TouchableOpacity>
              <Text style={modalStyles.time}>{formatTime(currentStory.timestamp)}</Text>
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
                onPress={() => { stopAndResetProgress(true); onClose(); }}
                style={modalStyles.closeBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                onStartShouldSetResponder={() => true}
                onTouchStart={(e) => e.stopPropagation()}
              >
                <Icon name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Story content ───────────────────────────────────────────────── */}
        <View style={[modalStyles.storyContent]}>

          {/* VIDEO story ──────────────────────────────────────────────────── */}
          {currentStory.type !== 'image' && (
            <View style={modalStyles.storyVideoWrap} pointerEvents="box-none">
              <View
                style={[
                  StyleSheet.absoluteFillObject,
                  { opacity: isFirstFrameReady ? 1 : 0, zIndex: 1, elevation: 1 },
                ]}
                pointerEvents="none"
              >
              <VideoPlayer
                key={`${storyKey}:${videoRetryNonce}`}
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
                  setIsFirstFrameReady(false);
                  setIsBuffering(true);
                  startVideoLoadWatchdog();
                }}
                onLoad={onVideoLoaded}
                onReadyForDisplay={markVideoFrameReady}
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
              </View>

              {!isFirstFrameReady && currentStoryThumbnail && (
                <Image
                  source={currentStoryThumbnail}
                  style={storyVideoThumbnailOverlayStyle}
                  resizeMode="cover"
                  pointerEvents="none"
                />
              )}

              {!isMediaReady && !currentStoryThumbnail && (
                <View style={modalStyles.storyVideoLoadingOverlay} pointerEvents="none">
                  <ActivityIndicator size="large" color="#fff" />
                </View>
              )}

              {!isMediaReady && !!currentStoryThumbnail && (
                <View
                  style={[
                    modalStyles.storyVideoLoadingOverlay,
                    modalStyles.storyVideoLoadingOverlayWithPoster,
                  ]}
                  pointerEvents="none"
                >
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.75)" />
                </View>
              )}
            </View>
          )}

          {/* YouTube audio (hidden) — unmount while paused so playback cannot continue */}
          {isYoutubeAudio && shouldPlayStoryAudio ? (
            <View style={storyYoutubeAudioStyle} pointerEvents="none" collapsable={false}>
              <YoutubePlayer
                ref={youtubeRef}
                key={`story_yt_${storyId}_${youtubeVideoId}`}
                height={200}
                width={200}
                videoId={youtubeVideoId}
                play
                mute={false}
                volume={audioVolumePercent}
                initialPlayerParams={{ autoplay: true, controls: false, modestbranding: true, rel: false }}
                onReady={async () => {
                  if (pausedRef.current || !visibleRef.current) return;
                  try {
                    const resumeSec = resolveOverlayAudioResumeSec();
                    await youtubeRef.current?.setVolume?.(audioVolumePercent);
                    await youtubeRef.current?.unMuteVideo?.();
                    if (resumeSec > 0) await youtubeRef.current?.seekTo?.(resumeSec, true);
                    await youtubeRef.current?.playVideo?.();
                  } catch (_e) { }
                }}
                onChangeState={state => {
                  if (pausedRef.current || !visibleRef.current) {
                    if (state === 'playing') pauseOverlayAudio();
                    return;
                  }
                  if (state === 'ended') {
                    try {
                      youtubeRef.current?.seekTo?.(audioTrimStartSec, true);
                      if (!pausedRef.current) youtubeRef.current?.playVideo?.();
                    } catch (_e) { }
                  }
                }}
                onError={e => console.warn('[StoryViewer] YouTube audio error', e)}
              />
            </View>
          ) : null}

          {/* Direct audio (hidden) — unmount while paused so playback cannot continue */}
          {isDirectAudio && shouldPlayStoryAudio ? (
            <Video
              ref={directAudioRef}
              key={`story_audio_${storyId}`}
              source={{ uri: directAudioUrl }}
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
              paused={false}
              muted={false}
              repeat={false}
              playInBackground={false}
              playWhenInactive={false}
              ignoreSilentSwitch="ignore"
              volume={Math.max(0, Math.min(1, Number(currentStory?.volume) || 1))}
              onLoad={data => {
                directAudioDurationRef.current = Number(data?.duration) || 0;
                const resumeSec = resolveOverlayAudioResumeSec();
                try { directAudioRef.current?.seek(resumeSec); } catch (_e) { }
              }}
              onReadyForDisplay={() => {
                if (!progressStartedRef.current && visibleRef.current && !pausedRef.current) {
                  progressStartedRef.current = true;
                  const duration = videoReadyDurationRef.current || resolveStoryDurationMs(currentStory);
                  requestAnimationFrame(() => {
                    if (visibleRef.current && !pausedRef.current) startProgress(duration);
                  });
                }
              }}
              onProgress={({ currentTime }) => {
                overlayAudioTimeRef.current = currentTime;
                const fallbackEnd = directAudioDurationRef.current || 0;
                const end = audioTrimEndSec != null ? audioTrimEndSec : fallbackEnd;
                if (end > 0 && currentTime >= end - 0.12) {
                  try { directAudioRef.current?.seek(audioTrimStartSec || 0); } catch (_e) { }
                }
              }}
              onEnd={() => {
                try { directAudioRef.current?.seek(audioTrimStartSec || 0); } catch (_e) { }
              }}
              onError={e => console.warn('[StoryViewer] Direct audio error', e)}
            />
          ) : null}

          {/* Tap overlay */}
          <Pressable
            style={modalStyles.overlay}
            onPressIn={handleOverlayPressIn}
            onPress={handleTap}
            onLongPress={handlePause}
            onPressOut={handleResume}
            delayLongPress={150}
          />

          {/* Video load error modal */}
          {videoLoadModalVisible && currentStory?.type === 'video' && (
            <View
              style={storyVideoLoadModalStyles.backdrop}
              onStartShouldSetResponder={() => true}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <View style={storyVideoLoadModalStyles.card}>
                <Text style={storyVideoLoadModalStyles.title}>
                  {t('stories.videoCouldNotPlay')}
                </Text>
                <Text style={storyVideoLoadModalStyles.message}>
                  {t('stories.videoLoadMessage')}
                </Text>
                <View style={storyVideoLoadModalStyles.actions}>
                  <TouchableOpacity
                    style={storyVideoLoadModalStyles.secondaryButton}
                    onPress={() => {
                      setVideoLoadModalVisible(false);
                      stopAndResetProgress(true);
                      onNext();
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={storyVideoLoadModalStyles.secondaryText}>
                      {t('stories.videoSkip')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={storyVideoLoadModalStyles.primaryButton}
                    onPress={retryVideoPlayback}
                    activeOpacity={0.85}
                  >
                    <Text style={storyVideoLoadModalStyles.primaryText}>
                      {t('stories.videoRetryLabel')}
                    </Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={storyVideoLoadModalStyles.closeButton}
                  onPress={() => {
                    setVideoLoadModalVisible(false);
                    stopAndResetProgress(true);
                    onClose();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={storyVideoLoadModalStyles.closeText}>
                    {t('stories.videoCloseViewer')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Heart burst */}
          {!isViewingOwnStory && (
            <Animated.View
              pointerEvents="none"
              style={[
                likeStyles.bigHeart,
                {
                  transform: [{
                    scale: heartScale.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
                  }],
                  opacity: heartScale,
                },
              ]}
            >
              <Icon name="heart" size={120} color="red" />
            </Animated.View>
          )}
        </View>

        {/* ── Own story: analytics + delete + share ───────────────────────── */}
        {isViewingOwnStory && (
          <View style={userAnalyticsStyles.bottomContainer}>
            <View style={userAnalyticsStyles.statsRow}>
              {currentStory.likes?.length > 0 && (
                <View style={userAnalyticsStyles.statItem}>
                  <Icon name="heart" size={14} color="#ff6b6b" />
                  <Text style={userAnalyticsStyles.statText}>{currentStory.likes.length}</Text>
                </View>
              )}
              {currentStory.comments?.length > 0 && (
                <View style={userAnalyticsStyles.statItem}>
                  <Icon name="chatbubble-outline" size={14} color="#4da3ff" />
                  <Text style={userAnalyticsStyles.statText}>{currentStory.comments.length}</Text>
                </View>
              )}
            </View>

            <View style={userAnalyticsStyles.actionsRow}>
              <TouchableOpacity style={userAnalyticsStyles.deleteButton} onPress={handleDeleteStory}>
                <Icon name="trash-outline" size={18} color="#fff" />
                <Text style={userAnalyticsStyles.deleteText}>{t('stories.deleteStoryLabel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={userAnalyticsStyles.shareButton}
                onPress={() => {
                  handlePause();
                  shareRef.current?.open?.();
                  setSelectedPostId({
                    ...currentStory,
                    userName: currentUser?.username,
                    userImage: ownerProfileImage || currentUser?.image,
                    user: {
                      id: currentUserId,                               // ← real userId
                      displayName: currentUser?.username,
                      image: ownerProfileImage || currentUser?.image   // ← .image not .avatar
                    },
                  });
                }}
              >
                <Feather name="send" size={18} color="#fff" />
                <Text style={userAnalyticsStyles.shareText}>{t('stories.shareStoryLabel')}</Text>
              </TouchableOpacity>
            </View>

            <ShareModal
              ref={shareRef}
              story={selectedPostId}
              onClose={handleResume}
            />
          </View>
        )}

        {/* ── Other users' story: emoji bursts + message input ────────────── */}
        {!isViewingOwnStory && (
          <>
            <View pointerEvents="none" style={burstStyles.layer}>
              {emojiBursts.map(b => (
                <Animated.Text
                  key={b.id}
                  style={[
                    burstStyles.emoji,
                    { left: b.x - 14, transform: [{ translateY: b.ty }, { scale: b.scale }], opacity: b.opacity },
                  ]}
                >
                  {b.emoji}
                </Animated.Text>
              ))}
            </View>

            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
              style={[inputStyles.wrap, { paddingBottom: insets.bottom + 20 }]}
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
                  <Icon name={liked ? 'heart' : 'heart-outline'} size={26} color={liked ? 'red' : '#fff'} />
                </TouchableOpacity>

                <TextInput
                  ref={commentInputRef}
                  placeholder={t('stories.sendMessagePlaceholder')}
                  placeholderTextColor="#aaa"
                  style={inputStyles.input}
                  value={commentText}
                  onChangeText={setCommentText}
                  onFocus={handlePause}
                  onBlur={handleResume}
                  onSubmitEditing={() => {
                    const text = commentText.trim();
                    if (text) { onAddComment(ownerId, storyId, text); setCommentText(''); }
                  }}
                  returnKeyType="send"
                />

                <TouchableOpacity
                  style={inputStyles.sendBtn}
                  onPress={() => {
                    const text = commentText.trim();
                    if (text) { onAddComment(ownerId, storyId, text); setCommentText(''); return; }
                    Keyboard.dismiss();
                    setTimeout(() => {
                      shareRef.current?.open?.();
                      handlePause();
                      setSelectedPostId({
                        ...currentStory,
                        userName: currentUser?.username,
                        userImage: currentUser?.image || currentUser?.avatar,
                        user: {
                          id: currentUser?.isUser ? currentUserId : currentUser?.id,
                          displayName: currentUser?.username,
                          image: currentUser?.image || currentUser?.avatar
                        },
                      });
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
              onClose={handleResume}
            />
          </>
        )}

        {/* Options sheet */}
        {!isViewingOwnStory && (
          <OptionsSheet
            visible={optionsOpen}
            onClose={closeOptions}
            isMuted={currentUser.muted}
            onToggleMute={() => { onMuteUser(currentUser.id, !currentUser.muted); closeOptions(); }}
            onReport={() => { onReportUser(currentUser.id); closeOptions(); }}
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


// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const formatTime = timestamp => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};


// ─────────────────────────────────────────────────────────────────────────────
// Stories (main export)
// ─────────────────────────────────────────────────────────────────────────────
export default function Stories({ refreshTick, sidebarMode = false, onDrawerClose }) {
  const styles = createStyles();
  const navigation = useNavigation();
  const { t } = useLanguage();
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
  const route = useRoute();

  useEffect(() => {
    console.log('[Stories] stories state updated:', stories);
  }, [stories]);

  // Auto-open story from deep link
  useEffect(() => {
  const sharedStoryId = route?.params?.sharedStoryId;
  console.log('DEEP LINK EFFECT sharedStoryId:', sharedStoryId, 'stories count:', stories.length);
  if (!sharedStoryId || !stories.length) return;

  for (let userIdx = 0; userIdx < stories.length; userIdx++) {
    const user = stories[userIdx];
    for (let storyIdx = 0; storyIdx < user.stories.length; storyIdx++) {
      const story = user.stories[storyIdx];
      if (
        String(story.storyId) === String(sharedStoryId) ||
        String(story.id).replace(/_\d+$/, '') === String(sharedStoryId)
      ) {
        // ── if the matched bucket is the current user's own
        // following bucket (isUser is false but id matches currentUserId)
        // force it to open the own bucket at index 0 instead
        const resolvedUserIdx =
          !user.isUser && String(user.id) === String(currentUserId)
            ? 0
            : userIdx;

        setCurrentUserIndex(resolvedUserIdx);
        setCurrentStoryIndex(storyIdx);
        setViewerSession(s => s + 1);
        setViewerVisible(true);
        navigation.setParams({ sharedStoryId: undefined });
        return;
      }
    }
  }
}, [route?.params?.sharedStoryId, stories]);

  const fetchStories = async () => {
    try {
      const id = await AsyncStorage.getItem('userId');
      setCurrentUserId(id);
      dispatch(showLoader());

      const userStoriesResponse = await getStoryByUser(id);

      let followingStoriesResponse;
      try {
        followingStoriesResponse = await getFollowingUserStories();
      } catch (followingError) {
        console.warn('Error fetching following stories:', followingError);
        followingStoriesResponse = { data: [] };
      }

      const userStoriesRaw = userStoriesResponse?.data
        ? (Array.isArray(userStoriesResponse.data) ? userStoriesResponse.data : [userStoriesResponse.data])
        : [];

      const followingStoriesRaw = followingStoriesResponse?.data
        ? (Array.isArray(followingStoriesResponse.data) ? followingStoriesResponse.data : [followingStoriesResponse.data])
        : [];

      const currentUserBucket = {
        id: 'current_user',
        username: t('stories.yourDrops'),
        image: profileImage || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
        isUser: true,
        hasUnseenStory: false,
        muted: false,
        stories: userStoriesRaw.flatMap(story => mapApiStoryRowToClips(story)),
      };

      const userStoriesMap = new Map();
      followingStoriesRaw.forEach((userStory) => {
        const userId = userStory.userId || userStory.id;
        const username =
          userStory.user?.displayName ||
          userStory.user?.userName ||
          userStory.user?.username ||
          t('stories.unknownUser');
        const userImage = userStory.user?.image || '';
        const storyObjects = mapApiStoryRowToClips(userStory);

        if (userStoriesMap.has(userId)) {
          userStoriesMap.get(userId).stories.push(...storyObjects);
        } else {
          userStoriesMap.set(userId, {
            id: userId,
            username,
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

      setStories([currentUserBucket, ...followingUsersBuckets]);
    } catch (error) {
      console.error('Error fetching stories:', error);
      setStories([{
        id: 'current_user',
        username: t('stories.yourDrops'),
        image: 'https://via.placeholder.com/150',
        isUser: true,
        hasUnseenStory: false,
        muted: false,
        stories: [],
      }]);
    } finally {
      dispatch(hideLoader());
    }
  };

  useEffect(() => {
    if (!profileImage) return;
    setStories(prev => prev.map(u => u.isUser ? { ...u, image: profileImage } : u));
  }, [profileImage]);

  const loadProfileData = async () => {
    try {
      const viewerId = await AsyncStorage.getItem('userId');
      if (!viewerId) return;
      const resp = await getUserCredentials(viewerId);
      if (resp?.statusCode === 200) dispatch(setProfileImg(resp?.data?.image));
    } catch (e) {
      dispatch(hideLoader());
    }
  };

  useEffect(() => { fetchStories(); loadProfileData(); }, []);

  useFocusEffect(useCallback(() => { fetchStories(); loadProfileData(); }, []));

  useEffect(() => {
    if (isUploadingStory) {
      uploadProgress.setValue(0);
      const timing = Animated.timing(uploadProgress, { toValue: 0.95, duration: 8000, useNativeDriver: false });
      timing.start();
      uploadAnimationRef.current = timing;
    } else {
      uploadAnimationRef.current?.stop();
      uploadAnimationRef.current = null;
      uploadProgress.setValue(0);
    }
  }, [isUploadingStory, uploadProgress]);

  useEffect(() => {
    if (typeof refreshTick === 'number') fetchStories();
  }, [refreshTick]);

  useFocusEffect(useCallback(() => {
    const restoreUploadState = async () => {
      try {
        const isUploading = await AsyncStorage.getItem('storyUploadInProgress');
        if (isUploading === 'true') setIsUploadingStory(true);
      } catch (error) {
        console.error('Error restoring upload state:', error);
      }
    };
    restoreUploadState();
  }, []));

  const requestCameraPermission = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
        title: t('stories.cameraPermissionTitle'),
        message: t('stories.cameraPermissionMessage'),
        buttonNeutral: t('stories.cameraPermissionAskLater'),
        buttonNegative: t('stories.cameraPermissionCancel'),
        buttonPositive: 'OK',
      });
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  };

  const handleAddStory = () => {
    Alert.alert(
      t('stories.addDropsTitle'),
      t('stories.addDropsMessage'),
      [
        { text: t('stories.addDropsCamera'), onPress: () => openCamera() },
        { text: t('stories.addDropsGallery'), onPress: () => openGallery() },
        { text: t('stories.addDropsCancel'), style: 'cancel' },
      ],
    );
  };

  const handleAddNewStory = () => {
    Alert.alert(
      t('stories.addNewDropTitle'),
      t('stories.addNewDropMessage'),
      [
        { text: t('stories.addDropsCamera'), onPress: () => openCamera() },
        { text: t('stories.addDropsGallery'), onPress: () => openGallery() },
        { text: t('stories.addDropsCancel'), style: 'cancel' },
      ],
    );
  };

  const openCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert(t('stories.permissionDeniedTitle'), t('stories.permissionDeniedMessage'));
      return;
    }
    launchCamera({
      mediaType: 'mixed', includeBase64: false, maxHeight: 2000, maxWidth: 2000,
      includeExtra: true, presentationStyle: 'fullScreen',
    }, response => {
      if (response?.didCancel) { setComposerList([]); setComposerMedia(null); return; }
      if (response?.errorCode) {
        Alert.alert(t('stories.cameraErrorTitle'), response.errorMessage || t('stories.somethingWentWrong'));
        return;
      }
      const asset = response?.assets?.[0];
      if (!asset?.uri) { Alert.alert(t('stories.cameraErrorTitle'), t('stories.mediaReadError')); return; }
      const mediaItem = {
        uri: asset.uri,
        type: asset.type?.startsWith('video') ? 'video' : 'image',
        duration: asset.duration ? asset.duration * 1000 : undefined,
      };
      setComposerList([mediaItem]);
      setComposerVisible(true);
    });
  };

  const openGallery = () => {
    launchImageLibrary({ mediaType: 'mixed', selectionLimit: 10, includeBase64: false, maxHeight: 2000, maxWidth: 2000 }, response => {
      if (response?.didCancel || response?.errorCode) {
        setComposerList([]); setComposerMedia(null); setComposerVisible(false); return;
      }
      const assets = response?.assets || [];
      if (!assets.length) { setComposerList([]); setComposerMedia(null); return; }
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
    if (!asset || !asset.uri) { Alert.alert('Oops', t('stories.mediaReadError')); return; }
    const type = asset.type?.startsWith('video') ? 'video' : 'image';
    const duration = type === 'video' ? (asset.duration ? asset.duration * 1000 : 15000) : 5000;
    setComposerMedia({ type, uri: asset.uri, duration });
    setComposerVisible(true);
  };

  const waitForNetworkConnectivity = async () => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      return new Promise((resolve) => {
        const unsubscribe = NetInfo.addEventListener(networkState => {
          if (networkState.isConnected) { unsubscribe(); resolve(); }
        });
      });
    }
  };

  const retryWithBackoff = async (uploadFn, maxRetries = 15, baseDelayMs = 1000) => {
    let lastError;
    let isNetworkOffline = false;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const netState = await NetInfo.fetch();
        if (!netState.isConnected) {
          isNetworkOffline = true;
          await waitForNetworkConnectivity();
          attempt--;
          continue;
        }
        isNetworkOffline = false;
        const result = await uploadFn();
        if (result?.error === true || result?.statusCode === 0) throw new Error(`API Error: ${result?.message || 'Network Error'}`);
        return result;
      } catch (error) {
        lastError = error;
        if (attempt === maxRetries - 1) throw error;
        const delayMs = isNetworkOffline ? 0 : baseDelayMs * Math.pow(2, attempt);
        if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    throw lastError;
  };

  const saveUploadState = async (clips) => {
    try {
      await AsyncStorage.setItem('pendingStoryUpload', JSON.stringify({
        clips: clips.map(clip => ({
          original: { uri: clip.original?.uri, duration: clip.original?.duration },
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
      }));
    } catch (error) {
      console.error('Failed to save upload state:', error);
    }
  };

  const clearUploadState = async () => {
    try { await AsyncStorage.removeItem('pendingStoryUpload'); } catch (error) { console.error('Failed to clear upload state:', error); }
  };

  const getPendingUpload = async () => {
    try {
      const savedData = await AsyncStorage.getItem('pendingStoryUpload');
      if (savedData) return JSON.parse(savedData);
    } catch (error) { console.error('Failed to retrieve pending upload:', error); }
    return null;
  };

  const resumePendingUpload = useCallback(async () => {
    try {
      const pendingUpload = await getPendingUpload();
      if (pendingUpload?.clips?.length > 0) {
        setIsUploadingStory(true);
        await AsyncStorage.setItem('storyUploadInProgress', 'true');
        showToastMessage(toast, 'info', t('stories.resumingUpload'));
        await performStoryUpload(pendingUpload.clips);
        setIsUploadingStory(false);
        await AsyncStorage.removeItem('storyUploadInProgress');
      }
    } catch (error) {
      console.error('Error resuming upload:', error);
      setIsUploadingStory(false);
      await AsyncStorage.removeItem('storyUploadInProgress');
    }
  }, [toast, t]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') resumePendingUpload();
    });
    return () => subscription.remove();
  }, [resumePendingUpload]);

  const performStoryUpload = async (clips) => {
    await clearUploadState();
    const formData = new FormData();
    formData.append('caption', '');
    clips.forEach((item, index) => {
      const fileUri = item.processedUri || item.original.uri;
      const fileName = `story_${Date.now()}_${index}.${item.isVideo ? 'mp4' : 'jpg'}`;
      formData.append('media', { uri: fileUri, type: item.isVideo ? 'video/mp4' : 'image/jpeg', name: fileName });
    });
    formData.append('storyMeta', JSON.stringify(buildStoryMetaPayload(clips)));
    await appendStoryAudioFiles(formData, clips);
    appendStoryThumbnailFiles(formData, clips);

    const response = await retryWithBackoff(() =>
      Promise.race([
        PostStory(formData),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 120000)),
      ]),
      15, 1000,
    );

    if (response?.success && !response?.error) {
      setStories(prev => prev.map(user =>
        user.isUser ? {
          ...user,
          hasUnseenStory: true,
          stories: [
            ...user.stories,
            ...clips.map(item => ({
              id: `story_${Date.now()}_${Math.random()}`,
              type: item.isVideo ? 'video' : 'image',
              uri: item.processedUri || item.original.uri,
              thumbnail: resolveClipThumbnailUri(item),
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
              edits: { filterKey: item.filterKey, stickers: item.stickers, texts: item.texts },
            })),
          ],
        } : user
      ));
      showToastMessage(toast, 'success', t('stories.dropUploadedSuccess'));
      setTimeout(() => setIsUploadingStory(false), 200);
      fetchStories();
    } else {
      throw new Error(`Upload failed: ${response?.message || 'Unknown error'}`);
    }
  };

  const handleComposerDone = async (processedArray) => {
    try {
      const withAudio = await prepareStoryClipsAudioForUpload(processedArray);
      const clips = await prepareStoryClipThumbnails(withAudio);
      await saveUploadState(clips);
      uploadStoryInBackground(clips);
      setComposerVisible(false);
    } catch (error) {
      console.error('Error preparing story:', error);
      showToastMessage(toast, 'danger', t('stories.failedToPrepare'));
    }
  };

  const uploadStoryInBackground = async (clips) => {
    try {
      setIsUploadingStory(true);
      await AsyncStorage.setItem('storyUploadInProgress', 'true');
      await performStoryUpload(clips);
      await AsyncStorage.removeItem('storyUploadInProgress');
    } catch (error) {
      console.error('Story upload failed after all retries:', error?.message || error);
      setIsUploadingStory(false);
      await AsyncStorage.removeItem('storyUploadInProgress');
      showToastMessage(toast, 'danger', t('stories.dropUploadFailed'));
    }
  };

  const handleOpenStory = (user, userIndex) => {
    if (user.isUser && user.stories.length === 0) { handleAddStory(); return; }
    if (user.isUser && user.stories.length > 0) {
      Alert.alert(
        t('stories.viewDropsTitle'),
        t('stories.viewDropsMessage'),
        [
          { text: t('stories.viewDropsView'), onPress: () => openStoryViewer(user, userIndex) },
          { text: t('stories.viewDropsAdd'), onPress: () => handleAddNewStory() },
          { text: t('stories.viewDropsCancel'), style: 'cancel' },
        ],
        { cancelable: true },
      );
      return;
    }
    if (!user.stories?.length || user.muted) return;
    openStoryViewer(user, userIndex);
  };

  const openStoryViewer = (user, userIndex) => {
    const storiesToPrefetch = user.stories?.slice(0, 4) || [];
    storiesToPrefetch.forEach(story => {
      if (story?.uri && story.type === 'image') {
        try { Image.prefetch(story.uri); } catch (_e) { }
      }
      if (story?.thumbnail) {
        try { Image.prefetch(story.thumbnail); } catch (_e) { }
      }
    });
    storiesToPrefetch.forEach(story => {
      const audio = resolveStoryAudioPayload(story);
      if (audio?.directUrl) { try { Image.prefetch(audio.directUrl); } catch (_e) { } }
    });

    setCurrentUserIndex(userIndex);
    setCurrentStoryIndex(0);
    setViewerSession(s => s + 1);
    setViewerVisible(true);
    if (!user.isUser) setTimeout(() => markStoryAsSeen(user.id, 0), 500);
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
    if (!user.isUser) markStoryAsSeen(user.id, currentStoryIndex);
    if (currentStoryIndex < (user.stories?.length || 0) - 1) {
      const nextStory = user.stories[currentStoryIndex + 1];
      if (nextStory?.uri && nextStory.type === 'image') { try { Image.prefetch(nextStory.uri); } catch (_e) { } }
      if (nextStory?.thumbnail) { try { Image.prefetch(nextStory.thumbnail); } catch (_e) { } }
      setCurrentStoryIndex(i => i + 1);
      return;
    }
    const nextIdx = nextUserWithStories(currentUserIndex);
    if (nextIdx !== -1) {
      const firstStory = stories[nextIdx]?.stories?.[0];
      if (firstStory?.uri && firstStory.type === 'image') { try { Image.prefetch(firstStory.uri); } catch (_e) { } }
      if (firstStory?.thumbnail) { try { Image.prefetch(firstStory.thumbnail); } catch (_e) { } }
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
      setCurrentStoryIndex(i => i - 1);
      return;
    }
    const prevIdx = prevUserWithStories(currentUserIndex);
    if (prevIdx !== -1) {
      setCurrentUserIndex(prevIdx);
      setCurrentStoryIndex(stories[prevIdx].stories.length - 1);
      return;
    }
    handleCloseViewer();
  };

  const markStoryAsSeen = (userId, storyIndex) => {
    setStories(prev => prev.map(user =>
      user.id === userId ? {
        ...user,
        stories: user.stories.map((story, idx) => idx === storyIndex ? { ...story, seen: true } : story),
        hasUnseenStory: user.stories.some((story, idx) => idx !== storyIndex && !story.seen),
      } : user
    ));
  };

  const handleNextUser = () => {
    const nextIdx = nextUserWithStories(currentUserIndex);
    if (nextIdx !== -1) { setCurrentUserIndex(nextIdx); setCurrentStoryIndex(0); }
  };

  const handlePrevUser = () => {
    const prevIdx = prevUserWithStories(currentUserIndex);
    if (prevIdx !== -1) { setCurrentUserIndex(prevIdx); setCurrentStoryIndex(stories[prevIdx].stories.length - 1); }
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
        setStories(prev => prev.map(user =>
          user.isUser ? {
            ...user,
            stories: user.stories.filter(story => story.id !== storyId),
            hasUnseenStory: user.stories.filter(story => story.id !== storyId).length > 0,
          } : user
        ));
        showToastMessage(toast, 'success', t('stories.dropDeletedSuccess'));
        const currentUser = stories[currentUserIndex];
        if (!currentUser || currentUser.stories.length <= 1) {
          handleCloseViewer();
        } else if (currentStoryIndex >= currentUser.stories.length - 1) {
          setCurrentStoryIndex(Math.max(0, currentStoryIndex - 1));
        }
        fetchStories();
      } else {
        showToastMessage(toast, 'danger', t('stories.dropDeleteFailed'));
      }
    } catch (error) {
      showToastMessage(toast, 'danger', t('stories.dropDeleteFailed'));
    }
  };

  const onToggleLike = async (ownerId, storyId, nextLiked) => {
    try {
      const response = await postLikeStory({ storyId: storyId.replace('_0', '') });
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
        showToastMessage(toast, 'danger', t('stories.failedToLike'));
      }
    } catch (error) {
      showToastMessage(toast, 'danger', t('stories.somethingWentWrong'));
    }
  };

  const onAddComment = async (ownerId, storyId, text) => {
    try {
      const cleanText = String(text || '').trim();
      if (!cleanText) return;
      const response = await postCommentStory({ comment: cleanText, storyId: storyId.replace('_0', '') });
      if (response?.success) {
        const key = `${ownerId}:${storyId}`;
        setComments(prev => ({ ...prev, [key]: [...(prev[key] || []), { user: 'you', text: cleanText, ts: Date.now() }] }));
        try {
          if (ownerId && currentUserId && String(ownerId) !== String(currentUserId)) {
            await sendChatMessage({ senderId: currentUserId, receiverId: ownerId, message: cleanText, type: 'CHAT' });
          }
        } catch (chatError) {
          console.warn('Failed to deliver story reply to inbox:', chatError);
        }
      } else {
        showToastMessage(toast, 'danger', t('stories.failedToComment'));
      }
    } catch (error) {
      showToastMessage(toast, 'danger', t('stories.somethingWentWrong'));
    }
  };

  const onMuteUser = (userId, mute) => {
    setStories(prev => prev.map(u => u.id === userId ? { ...u, muted: !!mute } : u));
    Alert.alert(
      mute ? t('stories.mutedTitle') : t('stories.unmutedTitle'),
      mute ? t('stories.mutedMessage') : t('stories.unmutedMessage'),
    );
  };

  const onReportUser = userId => {
    const u = stories.find(s => s.id === userId);
    Alert.alert(
      t('stories.reportTitle'),
      t('stories.reportMessage', { username: u?.username }),
    );
  };

  const dataToShow = stories.filter(s => !s.muted);

  const renderStoryItem = ({ item }) => (
    <TouchableOpacity
      style={sidebarMode ? sidebarStyles.verticalStoryItem : styles.storyItem}
      onPress={() => handleOpenStory(item, stories.findIndex(s => s.id === item.id))}
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
                onPress={(e) => { e.stopPropagation(); handleAddNewStory(); }}
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
        style={item.isUser ? (sidebarMode ? sidebarStyles.verticalDropsText : styles.dropsText) : styles.storyUsername}
        numberOfLines={1}
      >
        {item.username || (item.isUser ? t('stories.drops') : '')}
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
          sidebarMode ? { paddingVertical: 8, paddingHorizontal: 8 } : { paddingHorizontal: 8 }
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
        currentUserId={currentUserId}        // ← add this
      />

      <StoryComposer
        modalVisible={composerVisible}
        mediaList={composerList}
        onCancel={() => { setComposerVisible(false); setComposerList([]); setComposerMedia(null); }}
        onDone={handleComposerDone}
      />

      {isUploadingStory && (
        <View style={{ backgroundColor: '#f5f5f5', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#e0e0e0' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <ActivityIndicator size={16} color="#4da3ff" style={{ marginRight: 10 }} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#1a1a1a' }}>
              {t('stories.uploadingDrops')}
            </Text>
          </View>
          <View style={{ height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
            <Animated.View
              style={{
                height: '100%',
                backgroundColor: '#4da3ff',
                borderRadius: 2,
                width: uploadProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              }}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const sidebarStyles = StyleSheet.create({
  verticalStoriesContainer: { flex: 1, backgroundColor: 'transparent' },
  verticalStoryItem: { alignItems: 'center', marginVertical: -8, width: '100%' },
  verticalUserBorder: { position: 'relative' },
  verticalAddIcon: { position: 'absolute', bottom: 0, right: 0, zIndex: 10, backgroundColor: '#fff', borderRadius: 14 },
  verticalAddStoryOverlay: { position: 'absolute', bottom: -2, right: -2, zIndex: 10 },
  verticalAddStoryButton: { backgroundColor: '#4da3ff', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  verticalDropsText: { marginTop: 2, fontSize: 12, color: '#6b6b6b', fontWeight: '600', textAlign: 'center' },
});
