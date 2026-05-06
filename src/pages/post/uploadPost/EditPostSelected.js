import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  TextInput,
  Alert,
  StatusBar,
  Animated,
  PanResponder,
  Modal,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import ImagePicker from 'react-native-image-crop-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import RBSheet from 'react-native-raw-bottom-sheet';
import ImageZoom from 'react-native-image-pan-zoom';
import Feather from 'react-native-vector-icons/Feather';
import RNFS from 'react-native-fs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SketchCanvas } from '@sourcetoad/react-native-sketch-canvas';
import { captureRef } from 'react-native-view-shot';
import Video from 'react-native-video';
import { useToast } from 'react-native-toast-notifications';

import {
  Grayscale,
  Sepia,
  Saturate,
  Contrast,
  Brightness,
} from 'react-native-color-matrix-image-filters';
import { useAppTheme } from '../../../theme/useApptheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSelector } from 'react-redux';
import { downloadMedia, getMediaFilename, isVideoMedia } from '../../../utils/mediaDownload';
import { showToastMessage } from '../../../components/displaytoastmessage';
import { getAllUser } from '../../../services/users';
import HexAvatar from '../../../components/home/story.js/HexAvatar';
import {
  POST_SOUNDTRACKS,
  postImageEditsToStoryAudioSel,
  getPostSoundtrackUrl,
} from '../../../utils/postSoundtracks';
import YoutubePlayer from 'react-native-youtube-iframe';
import PostStoryMusicTrimModal from '../../../components/post/PostStoryMusicTrimModal';
import { searchYoutubeMusicTracks, getYoutubeSearchApiKey } from '../../../services/youtubeMusic';
import { useLanguage } from '../../../i18n';

const fonts = [
  { name: 'saffasbom', style: { fontFamily: 'SAlfaSlabOne-Regularystem' } },
  { name: 'bitcount', style: { fontFamily: 'BitcountPropSingle_Cursive-Regular' } },
  { name: 'fontfree', style: { fontFamily: 'FontsFree-Net-Billabong' } },
  { name: 'liber', style: { fontFamily: 'LibertinusMono-Regular' } },
  { name: 'opensans', style: { fontFamily: 'OpenSans-Regular' } },
  { name: 'pacifico', style: { fontFamily: 'Pacifico-Regular' } },
  { name: 'play1', style: { fontFamily: 'PlaywriteAUQLD-Regular' } },
  { name: 'play2', style: { fontFamily: 'PlaywriteHU-Regular' } },
  { name: 'play3', style: { fontFamily: 'PlaywritePL-Regular' } },
  { name: 'roboto', style: { fontFamily: 'Roboto-Regular' } },
  { name: 'tridon', style: { fontFamily: 'Triodion-Regular' } },
];

const colors = [
  '#fff', '#ff0000', '#00ff00', '#0000ff', '#ffff00',
  '#ff00ff', '#00ffff', '#000',
];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_SIZE = SCREEN_WIDTH;
const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

const FLIP_EMOJI_STICKERS = [
  '👏', '🔥', '❤️', '😂', '😍', '✨', '💯', '🎉', '👍', '🙌',
  '💪', '🎵', '⭐', '🙏', '😎', '🥳', '💬', '🎬',
];

const OVERLAY_TRASH_PREVIEW_SCALE = 0.42;
const TRASH_DROP_RADIUS_PX = 34;
const TEXT_OVERLAY_TAP_MAX_MOVE = 14;
const TEXT_OVERLAY_TAP_MAX_MS = 300;
const TEXT_OVERLAY_LONGPRESS_DELETE_MS = 500;

const createEmptyImageEdits = () => ({
  textOverlays: [],
  overlayImages: [],
  filter: 'none',
  drawings: null,
  uriBeforeAnyDrawing: null,
  processedImageUri: null,
  musicSource: 'none',
  musicId: 'none',
  musicTitle: null,
  musicArtist: null,
  musicYoutubeVideoId: null,
  musicYoutubeThumbUrl: null,
  musicYoutubeDurationSec: null,
  musicTrimStart: 0,
  musicTrimEnd: null,
  musicLyrics: null,
  musicBadge: null,
});

const ensureMediaDisplayUri = value => {
  if (!value || typeof value !== 'string') return '';
  if (/^(file|content|ph|assets-library|http|https|data):/i.test(value)) return value;
  if (value.startsWith('/')) return `file://${value}`;
  return value;
};

const normalizeIncomingMediaItem = media => {
  if (!media) return media;
  const rawUri =
    media.uri || media.path || media.sourceURL || media.originalUri || media.processedUri || '';
  const normalizedUri = ensureMediaDisplayUri(rawUri);
  const normalizedPath =
    typeof media.path === 'string'
      ? media.path.replace(/^file:\/\//, '')
      : typeof rawUri === 'string' && rawUri.startsWith('file://')
        ? rawUri.replace(/^file:\/\//, '')
        : rawUri;
  return { ...media, uri: normalizedUri || media.uri, path: normalizedPath || media.path };
};

const getAnimatedNumericValue = (animatedNode, fallback = 0) => {
  const directValue =
    typeof animatedNode?.__getValue === 'function'
      ? animatedNode.__getValue()
      : animatedNode?._value;
  return Number.isFinite(directValue) ? directValue : fallback;
};

const getAnimatedPositionValue = (animatedPosition, fallback = { x: 0, y: 0 }) => ({
  x: getAnimatedNumericValue(animatedPosition?.x, fallback.x),
  y: getAnimatedNumericValue(animatedPosition?.y, fallback.y),
});

const slideHasLibraryMusic = edits =>
  !!(edits && edits.musicId && edits.musicId !== 'none' && edits.musicSource && edits.musicSource !== 'none');

function getBgPlaybackWindow(trimStart, trimEnd, previewDur) {
  const prev = Math.max(0.1, Number(previewDur) || 30);
  const a = Math.max(0, Number(trimStart) || 0);
  const rawEnd = trimEnd;
  const b =
    rawEnd == null || rawEnd === '' || !Number.isFinite(Number(rawEnd)) ? Infinity : Number(rawEnd);
  const ovStart = Math.max(0, a);
  const ovEnd = Math.min(b, prev);
  if (ovEnd <= ovStart || ovStart >= prev) return { start: 0, end: prev, hasOverlap: false };
  return { start: ovStart, end: ovEnd, hasOverlap: true };
}

const FLIP_MUSIC_LIBRARY = [
  { id: 'flip-track-1', title: 'Night Drive', artist: 'Valens Mix' },
  { id: 'flip-track-2', title: 'City Lights', artist: 'Valens Mix' },
  { id: 'flip-track-3', title: 'Golden Hour', artist: 'Valens Mix' },
  { id: 'flip-track-4', title: 'Afterglow', artist: 'Valens Mix' },
];

const InstagramPostCreator = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useLanguage();

  const routeImages = useMemo(
    () => {
      const incoming = route.params?.selectedMedia || route.params?.images || [];
      return Array.isArray(incoming)
        ? incoming.map(normalizeIncomingMediaItem).filter(Boolean)
        : [];
    },
    [route.params?.selectedMedia, route.params?.images],
  );

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ gestureEnabled: false, animationEnabled: true });
      return () => { navigation.setOptions({ gestureEnabled: true }); };
    }, [navigation])
  );

  const postType = route.params?.postType || 'regular';
  const fromIcon = route.params?.fromIcon;
  const isFlipPost = fromIcon === 'Flips';
  const [selectedImages, setSelectedImages] = useState(routeImages);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('null');
  const bottomSheetRef = useRef();
  const [profile, setProfile] = useState(null);

  const [selectedFilter, setSelectedFilter] = useState('none');
  const [isZooming, setIsZooming] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const zoomIndicatorOpacity = useRef(new Animated.Value(0)).current;
  const zoomTimeout = useRef(null);
  const [showFilters, setShowFilters] = useState(false);
  const [modalVisible2, setModalVisible2] = useState(false);
  const [text, setText] = useState('');
  const [selectedFont, setSelectedFont] = useState(fonts[0].style);
  const [showFonts, setShowFonts] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [textColor, setTextColor] = useState('#fff');
  const [textAlign, setTextAlign] = useState('center');
  const [highlightColor, setHighlightColor] = useState('transparent');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawColor, setDrawColor] = useState('red');
  const [imageEdits, setImageEdits] = useState({});
  const imageEditsRef = useRef(imageEdits);
  const currentImageIndexRef = useRef(currentImageIndex);
  imageEditsRef.current = imageEdits;
  currentImageIndexRef.current = currentImageIndex;

  const canvasRef = useRef(null);
  const mainScrollViewRef = useRef(null);
  const [editingOverlayId, setEditingOverlayId] = useState(null);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);
  const [canvasKey, setCanvasKey] = useState(0);
  const [isOverlayTransforming, setIsOverlayTransforming] = useState(false);
  const [editorRegionLayoutHeight, setEditorRegionLayoutHeight] = useState(0);
  const [tagSearch, setTagSearch] = useState('');
  const [selectedTaggedPeople, setSelectedTaggedPeople] = useState([]);
  // username -> userId (so backend can notify tagged users)
  const [selectedTaggedPeopleIds, setSelectedTaggedPeopleIds] = useState({});
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const userSearchTimeoutRef = useRef(null);
  const activeSearchRequestIdRef = useRef(0);

  const [videoPaused, setVideoPaused] = useState({});
  const [videoMuted, setVideoMuted] = useState(true);
  const videoRefs = useRef({});
  const profileAvatarUri = useSelector(state => state.profileImage?.profileImg);
  const [flipUserName, setFlipUserName] = useState('');
  const [flipVolumeByIndex, setFlipVolumeByIndex] = useState({});
  const [flipStickerModal, setFlipStickerModal] = useState(false);
  const [flipAudioModal, setFlipAudioModal] = useState(false);
  const [postMusicQuery, setPostMusicQuery] = useState('');
  const [postMusicResults, setPostMusicResults] = useState([]);
  const [postMusicLoading, setPostMusicLoading] = useState(false);
  const postMusicSearchTimer = useRef(null);
  const [flipTrimModal, setFlipTrimModal] = useState(false);
  const [flipVolumeModal, setFlipVolumeModal] = useState(false);
  const [trimStartInput, setTrimStartInput] = useState('0');
  const [trimEndInput, setTrimEndInput] = useState('');
  const { bgStyle, textStyle, cardStyle, text: themeText } = useAppTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [postStorySoundTrimVisible, setPostStorySoundTrimVisible] = useState(false);
  const postBgYoutubeRef = useRef(null);
  const postBgBuiltinVideoRef = useRef(null);
  const postBgMusicDurRef = useRef(30);

  const imageViewRefs = useRef({});
  const drawingSurfaceRefs = useRef({});
  const animatedPositionRefs = useRef({});
  const overlayImageScaleRefs = useRef({});
  const overlayImageRotationRefs = useRef({});
  const textOverlayScaleRefs = useRef({});
  const textOverlayRotationRefs = useRef({});
  const textOverlayLayoutRefs = useRef({});
  const textOverlayTransformActiveRef = useRef(false);
  const recentDragTimestamps = useRef({});
  const overlayPanResponderRefs = useRef({});
  const textPanResponderRefs = useRef({});
  const trashZoneRef = useRef(null);
  const [trashRect, setTrashRect] = useState(null);
  const [showTrashZone, setShowTrashZone] = useState(false);

  useEffect(() => {
    if (userSearchTimeoutRef.current) clearTimeout(userSearchTimeoutRef.current);
    if (activeTab !== 'Tag' || !tagSearch.trim()) {
      activeSearchRequestIdRef.current = 0;
      setUserSuggestions([]);
      setIsSearchingUsers(false);
      return undefined;
    }
    userSearchTimeoutRef.current = setTimeout(async () => {
      const requestId = Date.now();
      activeSearchRequestIdRef.current = requestId;
      setIsSearchingUsers(true);
      try {
        const response = await getAllUser({ userName: tagSearch.trim() });
        if (activeSearchRequestIdRef.current !== requestId) return;

        // Backend responses vary; support common wrappers:
        // - { data: { users: [...] } }
        // - { data: { data: { users: [...] } } }
        const users = Array.isArray(response?.data?.users)
          ? response.data.users
          : Array.isArray(response?.data?.data?.users)
            ? response.data.data.users
            : Array.isArray(response?.data?.result?.users)
              ? response.data.result.users
              : [];
        setUserSuggestions(
          users
            .map(user => ({
              ...user,
              _username: String(user?.userName || user?.username || '').trim().replace(/^@+/, ''),
              _userId: String(user?._id || user?.id || user?.userId || user?.userid || '').trim(),
            }))
            .filter(user => user._username && !selectedTaggedPeople.includes(user._username))
            .slice(0, 12),
        );
      } catch (error) {
        if (activeSearchRequestIdRef.current === requestId) setUserSuggestions([]);
      } finally {
        if (activeSearchRequestIdRef.current === requestId) setIsSearchingUsers(false);
      }
    }, 400);
    return () => { if (userSearchTimeoutRef.current) clearTimeout(userSearchTimeoutRef.current); };
  }, [activeTab, selectedTaggedPeople, tagSearch]);

  useEffect(() => {
    if (!flipAudioModal) return;
    setPostMusicQuery('');
    setPostMusicResults([]);
    setPostMusicLoading(false);
  }, [flipAudioModal]);

  const bgSlideEdits = imageEdits[currentImageIndex] || createEmptyImageEdits();
  const bgYoutubeId =
    slideHasLibraryMusic(bgSlideEdits) && bgSlideEdits.musicSource === 'youtube'
      ? bgSlideEdits.musicYoutubeVideoId : null;
  const bgTrimStart = Number(bgSlideEdits.musicTrimStart) || 0;
  const bgTrimEnd = bgSlideEdits.musicTrimEnd;

  useEffect(() => {
    if (postStorySoundTrimVisible || !bgYoutubeId || selectedImages.length === 0) return;
    const tick = setInterval(() => {
      (async () => {
        try {
          const cur = await postBgYoutubeRef.current?.getCurrentTime?.();
          if (typeof cur !== 'number' || Number.isNaN(cur)) return;
          const dur = postBgMusicDurRef.current || 180;
          const { start: playStart, end: playEnd, hasOverlap } = getBgPlaybackWindow(bgTrimStart, bgTrimEnd, dur);
          const margin = Math.min(0.35, Math.max(0.08, (playEnd - playStart) * 0.02));
          if (hasOverlap && playEnd > playStart && cur >= playEnd - margin) {
            await postBgYoutubeRef.current?.seekTo?.(playStart, true);
          }
        } catch (_) {}
      })();
    }, 320);
    return () => clearInterval(tick);
  }, [bgYoutubeId, bgTrimStart, bgTrimEnd, postStorySoundTrimVisible, selectedImages.length]);

  useEffect(() => {
    if (!flipAudioModal) return;
    if (!postMusicQuery.trim()) { setPostMusicResults([]); setPostMusicLoading(false); return; }
    let cancelled = false;
    if (postMusicSearchTimer.current) clearTimeout(postMusicSearchTimer.current);
    postMusicSearchTimer.current = setTimeout(async () => {
      if (!getYoutubeSearchApiKey()) { setPostMusicResults([]); setPostMusicLoading(false); return; }
      setPostMusicLoading(true);
      setPostMusicResults([]);
      try {
        const r = await searchYoutubeMusicTracks(postMusicQuery.trim());
        if (!cancelled) setPostMusicResults(Array.isArray(r) ? r : []);
      } catch { if (!cancelled) setPostMusicResults([]); }
      finally { if (!cancelled) setPostMusicLoading(false); }
    }, 450);
    return () => { cancelled = true; if (postMusicSearchTimer.current) clearTimeout(postMusicSearchTimer.current); };
  }, [postMusicQuery, flipAudioModal]);

  const getOrCreatePanResponder = (id) => {
    if (!overlayPanResponderRefs.current[id]) {
      overlayPanResponderRefs.current[id] = createPanResponder(id);
    }
    return overlayPanResponderRefs.current[id];
  };

  const getOrCreateTextPanResponder = (id) => {
    if (!textPanResponderRefs.current[id]) {
      textPanResponderRefs.current[id] = createTextPanResponder(id);
    }
    return textPanResponderRefs.current[id];
  };

  const handleSelectPostBuiltinTrack = track => {
    if (track.id === 'none') {
      updateCurrentImageEdits({ musicSource: 'none', musicId: 'none', musicTitle: null, musicArtist: null, musicYoutubeVideoId: null, musicYoutubeThumbUrl: null, musicYoutubeDurationSec: null, musicTrimStart: 0, musicTrimEnd: null, musicLyrics: null, musicBadge: null });
    } else {
      updateCurrentImageEdits({ musicSource: 'builtin', musicId: track.id, musicTitle: track.title, musicArtist: track.artist, musicYoutubeVideoId: null, musicYoutubeThumbUrl: null, musicYoutubeDurationSec: null, musicTrimStart: 0, musicTrimEnd: null, musicLyrics: null, musicBadge: null });
    }
    setFlipAudioModal(false);
    showToastMessage(toast, 'success', track.id === 'none' ? t('selectedPost.originalSound') : `${t('selectedPost.sound')}: ${track.title}`, 1500);
  };

  const handleSelectPostYoutubeTrack = yt => {
    if (!yt?.videoId) return;
    updateCurrentImageEdits({ musicSource: 'youtube', musicId: `yt:${yt.videoId}`, musicTitle: yt.title, musicArtist: yt.channelTitle, musicYoutubeVideoId: yt.videoId, musicYoutubeThumbUrl: yt.thumbnailUrl || null, musicYoutubeDurationSec: yt.durationSec != null && Number.isFinite(Number(yt.durationSec)) ? Number(yt.durationSec) : null, musicTrimStart: 0, musicTrimEnd: null, musicLyrics: null, musicBadge: null });
    setFlipAudioModal(false);
    showToastMessage(toast, 'success', `${t('selectedPost.sound')}: ${yt.title}`, 1500);
  };

  const openPostMusicTrimModal = () => {
    const e = getCurrentImageEdits();
    if (!slideHasLibraryMusic(e)) {
      showToastMessage(toast, 'info', t('selectedPost.pickTrackFirst'), 1500);
      return;
    }
    setFlipAudioModal(false);
    setPostStorySoundTrimVisible(true);
  };

  const openTextModal = () => {
    const centerX = IMAGE_SIZE / 2 - 80;
    const centerY = (editorCanvasHeight || IMAGE_SIZE) / 2 - 20;
    pan.setValue({ x: centerX, y: centerY });
    pan.setOffset({ x: 0, y: 0 });
    setModalVisible2(true);
  };

  const handleSelectTagUser = user => {
    const username = String(user?._username || user?.userName || user?.username || '').trim().replace(/^@+/, '');
    if (!username) return;

    const userIdRaw = user?._userId || user?._id || user?.id || user?.userId || user?.userid;
    const userId = String(userIdRaw || '').trim();

    setSelectedTaggedPeople(prev => (prev.includes(username) ? prev : [...prev, username]));
    if (userId) {
      setSelectedTaggedPeopleIds(prev => ({ ...(prev || {}), [username]: userId }));
    }
    setTagSearch('');
    setUserSuggestions([]);
  };

  const handleRemoveTaggedPerson = username => {
    setSelectedTaggedPeople(prev => prev.filter(person => person !== username));
    setSelectedTaggedPeopleIds(prev => {
      if (!prev || typeof prev !== 'object') return {};
      const next = { ...prev };
      delete next[username];
      return next;
    });
  };

  const overlayGestureState = useRef({});
  const textOverlayGestureState = useRef({});

  const getProfile = async () => {
    try {
      const value = await AsyncStorage.getItem('profile');
      setProfile(value);
    } catch (e) { console.log(e); }
  };

  useEffect(() => { getProfile(); }, []);

  useEffect(() => {
    if (!isFlipPost) return;
    (async () => {
      const u = await AsyncStorage.getItem('userName');
      const d = await AsyncStorage.getItem('displayName');
      setFlipUserName((u || d || '').trim() || t('selectedPost.creator'));
    })();
  }, [isFlipPost]);

  useEffect(() => () => { if (zoomTimeout.current) clearTimeout(zoomTimeout.current); }, []);

  const IMAGE_OVERLAY_BOUNDS = { minX: 0, minY: 0, maxX: IMAGE_SIZE - 100, maxY: IMAGE_SIZE - 100 };

  const getMediaKey = (media, index) => media?.path || media?.uri || media?.sourceURL || `media-${index}`;

  const getMediaDisplayUri = (media, preferredUri = null) =>
    ensureMediaDisplayUri(preferredUri || media?.processedImageUri || media?.uri || media?.path || media?.sourceURL || media?.originalUri || '');

  const getCanvasHeightForMedia = (media) => {
    const mediaWidth = Number(media?.width) || IMAGE_SIZE;
    const mediaHeight = Number(media?.height) || IMAGE_SIZE;
    if (!mediaWidth || !mediaHeight) return IMAGE_SIZE;
    return Math.min(450, Math.max(220, (IMAGE_SIZE * mediaHeight) / mediaWidth));
  };

  const editorCanvasHeight = useMemo(() => {
    if (editorRegionLayoutHeight > 0) return Math.max(200, Math.floor(editorRegionLayoutHeight));
    const currentMedia = selectedImages[currentImageIndex];
    return getCanvasHeightForMedia(currentMedia);
  }, [editorRegionLayoutHeight, currentImageIndex, selectedImages]);

  const getOverlayBounds = (size = 100) => ({ minX: 0, minY: 0, maxX: Math.max(0, IMAGE_SIZE - size), maxY: Math.max(0, editorCanvasHeight - size) });
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const containsEmoji = value => EMOJI_REGEX.test(String(value || ''));
  const resolveOverlayFontFamily = (value, requestedFontFamily) => containsEmoji(value) ? undefined : (requestedFontFamily || undefined);
  const getTextStyleWithFont = (value, requestedFontFamily) => {
    const resolvedFontFamily = resolveOverlayFontFamily(value, requestedFontFamily);
    return resolvedFontFamily ? { fontFamily: resolvedFontFamily } : {};
  };

  const getTextOverlayLayoutKey = (imageIndex, overlayId) => `${imageIndex}:${overlayId}`;

  const estimateTextOverlaySize = overlay => {
    const fontSize = Number(overlay?.fontSize) || 28;
    const scale = Number(overlay?.scale ?? 1) || 1;
    const lines = String(overlay?.text || '').split('\n').slice(0, 3);
    const longestLineLength = lines.reduce((longest, line) => Math.max(longest, Array.from(line).length), 0) || 1;
    const emojiHeavy = containsEmoji(overlay?.text) && longestLineLength <= 4;
    const baseWidth = emojiHeavy ? fontSize * Math.max(1.15, longestLineLength * 0.95) + 18 : Math.min(220, Math.max(fontSize + 24, longestLineLength * fontSize * 0.62 + 24));
    const baseHeight = Math.max(fontSize + 14, lines.length * fontSize * 1.2 + 14);
    return { width: baseWidth * scale, height: baseHeight * scale };
  };

  const getTextOverlayFootprint = (imageIndex, overlay) => {
    const layoutKey = getTextOverlayLayoutKey(imageIndex, overlay?.id || 'draft');
    const measured = textOverlayLayoutRefs.current[layoutKey];
    const scale = Number(overlay?.scale ?? 1) || 1;
    if (measured?.width && measured?.height) return { width: measured.width * scale, height: measured.height * scale };
    return estimateTextOverlaySize(overlay);
  };

  const getTextOverlayBounds = (imageIndex, overlay) => {
    const footprint = getTextOverlayFootprint(imageIndex, overlay);
    return {
      minX: Math.min(0, -footprint.width * 0.5), minY: Math.min(0, -footprint.height * 0.5),
      maxX: Math.max(0, IMAGE_SIZE - footprint.width * 0.5), maxY: Math.max(0, editorCanvasHeight - footprint.height * 0.5),
    };
  };

  const clampPositionToBounds = (position, bounds) => ({ x: clamp(position.x, bounds.minX, bounds.maxX), y: clamp(position.y, bounds.minY, bounds.maxY) });

  const getAnimatedValue = (imageIndex, overlayId, initialX = 0, initialY = 0) => {
    const key = `${imageIndex}:${overlayId}`;
    if (!animatedPositionRefs.current[key]) animatedPositionRefs.current[key] = new Animated.ValueXY({ x: initialX, y: initialY });
    return animatedPositionRefs.current[key];
  };

  const getAnimatedOverlayImageScale = (imageIndex, overlayId, initialScale = 1) => {
    const key = `${imageIndex}:imgscale:${overlayId}`;
    if (!overlayImageScaleRefs.current[key]) overlayImageScaleRefs.current[key] = new Animated.Value(initialScale);
    return overlayImageScaleRefs.current[key];
  };

  const getAnimatedOverlayImageRotation = (imageIndex, overlayId, initialRad = 0) => {
    const key = `${imageIndex}:imgrot:${overlayId}`;
    if (!overlayImageRotationRefs.current[key]) {
      const v = new Animated.Value(initialRad);
      overlayImageRotationRefs.current[key] = { value: v, rotate: v.interpolate({ inputRange: [-62.83, 62.83], outputRange: ['-62.83rad', '62.83rad'] }) };
    }
    return overlayImageRotationRefs.current[key];
  };

  const getAnimatedTextOverlayScale = (imageIndex, overlayId, initialScale = 1) => {
    const key = `${imageIndex}:textscale:${overlayId}`;
    if (!textOverlayScaleRefs.current[key]) textOverlayScaleRefs.current[key] = new Animated.Value(initialScale);
    return textOverlayScaleRefs.current[key];
  };

  const getAnimatedTextOverlayRotation = (imageIndex, overlayId, initialRad = 0) => {
    const key = `${imageIndex}:textrot:${overlayId}`;
    if (!textOverlayRotationRefs.current[key]) {
      const v = new Animated.Value(initialRad);
      textOverlayRotationRefs.current[key] = { value: v, rotate: v.interpolate({ inputRange: [-62.83, 62.83], outputRange: ['-62.83rad', '62.83rad'] }) };
    }
    return textOverlayRotationRefs.current[key];
  };

  const getTouchDistance = (touches) => { if (!touches || touches.length < 2) return 0; const [a, b] = touches; return Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY); };
  const getTouchAngle = (touches) => { if (!touches || touches.length < 2) return 0; const [a, b] = touches; return Math.atan2(b.pageY - a.pageY, b.pageX - a.pageX); };
  const getTouchCenter = (touches) => { if (!touches || touches.length < 2) return { x: 0, y: 0 }; const [a, b] = touches; return { x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2 }; };

  const buildCanvasSource = (uri) => {
    if (!uri) return undefined;
    const normalized = String(uri).replace('file://', '');
    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash === -1) return { filename: normalized, directory: '', mode: 'AspectFill' };
    return { filename: normalized.slice(lastSlash + 1), directory: normalized.slice(0, lastSlash), mode: 'AspectFill' };
  };

  const handleDownload = async () => {
    try {
      const currentMedia = selectedImages[currentImageIndex];
      if (!currentMedia) { showToastMessage(toast, 'danger', t('selectedPost.noMediaSelected')); return; }
      const currentEdits = imageEdits[currentImageIndex] || {};
      const uriToDownload = getMediaDisplayUri(currentMedia, currentEdits.processedImageUri);
      if (!uriToDownload) { showToastMessage(toast, 'danger', t('selectedPost.noMediaUri')); return; }
      const isVideo = isVideoMedia(currentMedia);
      const filename = getMediaFilename(uriToDownload, currentImageIndex);
      showToastMessage(toast, 'default', t('selectedPost.downloadStarted'), 1000);
      const downloadPath = await downloadMedia(uriToDownload, filename, isVideo, toast);
      showToastMessage(toast, 'success', t('selectedPost.savedToGallery'));
    } catch (error) { console.error('Download error:', error); }
  };

  const updateOverlayImageById = (imageIndex, overlayId, updater) => {
    setImageEdits(prev => {
      const imageEdit = prev[imageIndex] || { textOverlays: [], overlayImages: [], filter: 'none', drawings: null, processedImageUri: null };
      return { ...prev, [imageIndex]: { ...imageEdit, overlayImages: imageEdit.overlayImages.map(overlay => overlay.id === overlayId ? updater(overlay) : overlay) } };
    });
  };

  const updateTextOverlayById = (imageIndex, overlayId, updater) => {
    setImageEdits(prev => {
      const imageEdit = prev[imageIndex] || { textOverlays: [], overlayImages: [], filter: 'none', drawings: null, processedImageUri: null };
      return { ...prev, [imageIndex]: { ...imageEdit, textOverlays: imageEdit.textOverlays.map(overlay => overlay.id === overlayId ? updater(overlay) : overlay) } };
    });
  };

  const isCurrentMediaVideo = () => isMediaVideo(selectedImages[currentImageIndex]);

  const isMediaVideo = (media) => {
    if (!media) return false;
    if (media.type && media.type.includes('video')) return true;
    const uri = media.uri || media.path;
    if (uri) { const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v']; return videoExtensions.some(ext => uri.toLowerCase().includes(ext)); }
    if (media.duration && media.duration > 0) return true;
    return false;
  };

  const pan = useRef(new Animated.ValueXY()).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { pan.setOffset({ x: pan.x._value, y: pan.y._value }); pan.setValue({ x: 0, y: 0 }); },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => { pan.flattenOffset(); },
    }),
  ).current;

  useEffect(() => {
    if (routeImages && routeImages.length > 0) {
      setSelectedImages(routeImages);
      setCurrentImageIndex(0);
      const initialEdits = {};
      const initialVideoPaused = {};
      routeImages.forEach((media, index) => { initialEdits[index] = createEmptyImageEdits(); initialVideoPaused[index] = true; });
      setImageEdits(initialEdits);
      setVideoPaused(initialVideoPaused);
    }
  }, [routeImages]);

  useEffect(() => {
    if (isOverlayTransforming) return;
    const currentEdits = imageEdits[currentImageIndex];
    if (!currentEdits) return;

    if (!textOverlayTransformActiveRef.current) {
      currentEdits.textOverlays?.forEach(overlay => {
        const nextPosition = overlay.position || { x: 0, y: 0 };
        const animatedPosition = getAnimatedValue(currentImageIndex, overlay.id, nextPosition.x, nextPosition.y);
        const currentPosition = getAnimatedPositionValue(animatedPosition, nextPosition);
        if (Math.abs(currentPosition.x - nextPosition.x) > 1 || Math.abs(currentPosition.y - nextPosition.y) > 1) animatedPosition.setValue(nextPosition);
        const nextScale = overlay.scale ?? 1;
        const nextRot = overlay.rotation ?? 0;
        const scaleAnim = getAnimatedTextOverlayScale(currentImageIndex, overlay.id, nextScale);
        const rotAnim = getAnimatedTextOverlayRotation(currentImageIndex, overlay.id, nextRot);
        if (Math.abs(getAnimatedNumericValue(scaleAnim, nextScale) - nextScale) > 0.001) scaleAnim.setValue(nextScale);
        if (Math.abs(getAnimatedNumericValue(rotAnim.value, nextRot) - nextRot) > 0.002) rotAnim.value.setValue(nextRot);
      });
    }

    currentEdits.overlayImages?.forEach(overlay => {
      const nextPosition = overlay.position || { x: 50, y: 50 };
      const animatedPosition = getAnimatedValue(currentImageIndex, `image-${overlay.id}`, nextPosition.x, nextPosition.y);
      const currentPosition = getAnimatedPositionValue(animatedPosition, nextPosition);
      if (Math.abs(currentPosition.x - nextPosition.x) > 1 || Math.abs(currentPosition.y - nextPosition.y) > 1) animatedPosition.setValue(nextPosition);
      const nextScale = overlay.scale ?? 1;
      const nextRot = overlay.rotation ?? 0;
      const scaleAnim = getAnimatedOverlayImageScale(currentImageIndex, overlay.id, nextScale);
      const rotAnim = getAnimatedOverlayImageRotation(currentImageIndex, overlay.id, nextRot);
      if (Math.abs(getAnimatedNumericValue(scaleAnim, nextScale) - nextScale) > 0.001) scaleAnim.setValue(nextScale);
      if (Math.abs(getAnimatedNumericValue(rotAnim.value, nextRot) - nextRot) > 0.002) rotAnim.value.setValue(nextRot);
    });
  }, [currentImageIndex, imageEdits, isOverlayTransforming]);

  const getCurrentImageEdits = () => imageEdits[currentImageIndex] || createEmptyImageEdits();
  const getLatestImageEditsForIndex = idx => imageEditsRef.current[idx] || createEmptyImageEdits();
  const getLatestOverlayImageById = overlayId => { const edits = getLatestImageEditsForIndex(currentImageIndexRef.current); return edits.overlayImages?.find(o => o.id === overlayId) ?? null; };
  const getLatestTextOverlayById = overlayId => { const edits = getLatestImageEditsForIndex(currentImageIndexRef.current); return edits.textOverlays?.find(o => o.id === overlayId) ?? null; };

  const updateCurrentImageEdits = (updates) => {
    setImageEdits(prev => ({ ...prev, [currentImageIndex]: { ...getCurrentImageEdits(), ...updates } }));
  };

  const loadImageEdits = (imageIndex) => {
    const edits = imageEdits[imageIndex] || createEmptyImageEdits();
    setSelectedFilter(edits.filter);
    if (canvasRef.current && isDrawing) canvasRef.current.clear();
  };

  const handleFilterChange = (filterValue) => { setSelectedFilter(filterValue); updateCurrentImageEdits({ filter: filterValue }); };

  const captureAndMergeDrawing = async (shouldExitDrawMode = true) => {
    if (!isDrawing || isCurrentMediaVideo() || !canvasRef.current) return;
    try {
      const drawingSurfaceRef = drawingSurfaceRefs.current[currentImageIndex];
      if (!drawingSurfaceRef) throw new Error('Drawing surface not ready');
      const mergedUri = await captureRef(drawingSurfaceRef, { format: 'png', quality: 1, result: 'tmpfile' });
      updateCurrentImageEdits({ processedImageUri: mergedUri, drawings: mergedUri });
      if (canvasRef.current) canvasRef.current.clear();
      if (shouldExitDrawMode) { setIsDrawing(false); setIsScrollEnabled(true); setActiveTab('null'); setCanvasKey(prev => prev + 1); }
    } catch (err) {
      console.error('Drawing save error:', err);
      Alert.alert(t('selectedPost.errorTitle'), t('selectedPost.drawingSaveError'));
    }
  };

  const exitDrawMode = useCallback(({ clearUnsavedStrokes = false } = {}) => {
    if (!isDrawing) return;
    if (clearUnsavedStrokes && canvasRef.current) canvasRef.current.clear();
    setIsDrawing(false); setIsScrollEnabled(true); setActiveTab('null'); setCanvasKey(prev => prev + 1);
  }, [isDrawing]);

  const handleImageChange = async (newIndex) => {
    if (newIndex === currentImageIndex) return;
    overlayPanResponderRefs.current = {};
    textPanResponderRefs.current = {};
    if (isDrawing) await captureAndMergeDrawing(false);
    setCurrentImageIndex(newIndex);
    loadImageEdits(newIndex);
    setCanvasKey(prev => prev + 1);
    if (isDrawing) { setCanvasKey(prev => prev + 1); setIsDrawing(true); setIsScrollEnabled(false); }
  };

  const captureFilteredImage = async (imageIndex) => {
    try {
      const viewRef = imageViewRefs.current[imageIndex];
      if (!viewRef) return null;
      await new Promise(resolve => setTimeout(resolve, 100));
      return await captureRef(viewRef, { format: 'png', quality: 0.8, result: 'tmpfile' });
    } catch (error) { return null; }
  };

  const renderFilters = () => {
    if (!showFilters) return null;
    const currentEdits = getCurrentImageEdits();
    const imageUri = getMediaDisplayUri(selectedImages[currentImageIndex]);
    const currentMediaIsVideo = isCurrentMediaVideo();
    const filterPreviews = [
      { name: t('selectedPost.filterOriginal'), value: 'none' },
      { name: t('selectedPost.filterGrayscale'), value: 'grayscale' },
      { name: t('selectedPost.filterSepia'), value: 'sepia' },
      { name: t('selectedPost.filterSaturate'), value: 'saturate' },
      { name: t('selectedPost.filterContrast'), value: 'contrast' },
      { name: t('selectedPost.filterBrightness'), value: 'brightness' },
    ];

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
        {filterPreviews.map((filter) => (
          <TouchableOpacity key={filter.value} onPress={() => handleFilterChange(filter.value)} style={styles.filterOption}>
            <View style={[styles.filterPreview, currentEdits.filter === filter.value && styles.selectedFilter]}>
              {currentMediaIsVideo ? (
                <View style={[styles.filterPreviewImage, styles.videoFilterPreview]}>
                  <Icon name="videocam" size={18} color="#fff" />
                </View>
              ) : (
                <Image source={{ uri: imageUri }} style={styles.filterPreviewImage} />
              )}
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: filter.value === 'grayscale' ? 'rgba(0,0,0,0.4)' : filter.value === 'sepia' ? 'rgba(148, 175, 227, 0.3)' : filter.value === 'saturate' ? 'rgba(255,0,255,0.1)' : filter.value === 'contrast' ? 'rgba(0,0,0,0.3)' : filter.value === 'brightness' ? 'rgba(255,255,255,0.3)' : 'transparent' }]} />
            </View>
            <Text style={[styles.filterName, { color: '#000000' }]}>{filter.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const handleVideoPress = (index) => { setVideoPaused(prev => ({ ...prev, [index]: !prev[index] })); };

  const addOverlayImage = () => {
    ImagePicker.openPicker({ mediaType: 'photo', cropping: false, multiple: true })
      .then(images => {
        if (!images || !Array.isArray(images)) return;
        const overlays = images.map(img => {
          if (!img || !img.path) return null;
          return { id: Date.now().toString() + Math.random(), uri: img.path, position: { x: 50, y: 50 }, scale: 1, rotation: 0, baseSize: 100 };
        }).filter(Boolean);
        const currentEdits = getCurrentImageEdits();
        updateCurrentImageEdits({ overlayImages: [...currentEdits.overlayImages, ...overlays] });
      })
      .catch(error => console.log('Overlay image pick error:', error));
  };

  // ─── PanResponder factories (unchanged logic, omitted for brevity — same as original) ───
  const createPanResponder = (id) => {
    const imageIndex = currentImageIndex;
    const currentEdits = imageEdits[imageIndex] || getCurrentImageEdits();
    const target = currentEdits.overlayImages.find(o => o.id === id);
    if (!target) return PanResponder.create({ onStartShouldSetPanResponder: () => false });
    const animatedPosition = getAnimatedValue(imageIndex, `image-${id}`, target.position?.x || 50, target.position?.y || 50);
    const animatedScale = getAnimatedOverlayImageScale(imageIndex, id, target.scale ?? 1);
    const animatedRotation = getAnimatedOverlayImageRotation(imageIndex, id, target.rotation ?? 0);
    const fallbackPosition = target.position || { x: 50, y: 50 };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        const currentOverlay = getLatestOverlayImageById(id) || target;
        if (!currentOverlay) return;
        const safePosition = getAnimatedPositionValue(animatedPosition, currentOverlay.position || fallbackPosition);
        animatedPosition.setOffset(safePosition);
        animatedPosition.setValue({ x: 0, y: 0 });
        const startDist = getTouchDistance(touches);
        const startCenter = getTouchCenter(touches);
        overlayGestureState.current[id] = { mode: touches.length >= 2 ? 'transform' : 'drag', startPosition: safePosition, startScale: currentOverlay.scale || 1, startRotation: currentOverlay.rotation || 0, startDistance: startDist, startAngle: getTouchAngle(touches), startCenter, pinchBaselineReady: touches.length >= 2 && startDist > 1e-4, didPinchGesture: false, moved: false, enteredTrashZone: false, deleteLongPressTimer: null, overlayTransformRaf: null };
        const nextS = currentOverlay.scale ?? 1;
        const nextR = currentOverlay.rotation ?? 0;
        if (Math.abs(getAnimatedNumericValue(animatedScale, nextS) - nextS) > 1e-4) animatedScale.setValue(nextS);
        if (Math.abs(getAnimatedNumericValue(animatedRotation.value, nextR) - nextR) > 1e-4) animatedRotation.value.setValue(nextR);
        const rafId = requestAnimationFrame(() => { setIsOverlayTransforming(true); setIsScrollEnabled(false); const s = overlayGestureState.current[id]; if (s) s.overlayTransformRaf = null; });
        overlayGestureState.current[id].overlayTransformRaf = rafId;
        overlayGestureState.current[id].deleteLongPressTimer = setTimeout(() => {
          if (Date.now() - (recentDragTimestamps.current[`image-${id}`] || 0) < 800) return;
          const sess = overlayGestureState.current[id];
          if (sess?.overlayTransformRaf != null) cancelAnimationFrame(sess.overlayTransformRaf);
          removeOverlay(id); delete overlayGestureState.current[id]; setShowTrashZone(false); setIsOverlayTransforming(false); setIsScrollEnabled(true);
        }, 900);
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        const session = overlayGestureState.current[id];
        if (!session) return;
        if (session.deleteLongPressTimer && (touches.length >= 2 || Math.abs(gestureState.dx) > 1.5 || Math.abs(gestureState.dy) > 1.5)) { clearTimeout(session.deleteLongPressTimer); session.deleteLongPressTimer = null; }
        if (touches.length >= 2) {
          session.didPinchGesture = true;
          if (session.deleteLongPressTimer) { clearTimeout(session.deleteLongPressTimer); session.deleteLongPressTimer = null; }
          if (!session.pinchBaselineReady) { session.pinchBaselineReady = true; const co = getLatestOverlayImageById(id); session.startDistance = Math.max(getTouchDistance(touches), 1e-4); session.startCenter = getTouchCenter(touches); session.startScale = co?.scale ?? 1; session.startRotation = co?.rotation ?? 0; session.startAngle = getTouchAngle(touches); session.startPosition = getAnimatedPositionValue(animatedPosition, co?.position || fallbackPosition); }
          const distance = getTouchDistance(touches); const angle = getTouchAngle(touches); const center = getTouchCenter(touches);
          const scaleRatio = session.startDistance > 0 ? distance / session.startDistance : 1;
          const nextScale = clamp(session.startScale * scaleRatio, 0.35, 4);
          const dx = center.x - session.startCenter.x; const dy = center.y - session.startCenter.y;
          animatedPosition.setValue({ x: dx, y: dy });
          const nextPosition = { x: session.startPosition.x + dx, y: session.startPosition.y + dy };
          const pendingRotation = session.startRotation + (angle - session.startAngle);
          session.pendingRotation = pendingRotation;
          const dragPoint = center; const isTouchOverTrash = isPointInTrashZone(dragPoint);
          const displayScale = isTouchOverTrash ? nextScale * OVERLAY_TRASH_PREVIEW_SCALE : nextScale;
          animatedScale.setValue(displayScale); animatedRotation.value.setValue(pendingRotation);
          session.enteredTrashZone = session.enteredTrashZone || isTouchOverTrash;
          setShowTrashZone(prev => prev === isTouchOverTrash ? prev : isTouchOverTrash);
          session.pendingPosition = nextPosition; session.pendingScale = nextScale; session.pendingTrashPoint = dragPoint; session.moved = true;
          return;
        }
        const dx = gestureState.dx; const dy = gestureState.dy;
        animatedPosition.setValue({ x: dx, y: dy });
        const nextPosition = { x: session.startPosition.x + dx, y: session.startPosition.y + dy };
        const dragPoint = { x: gestureState.moveX, y: gestureState.moveY };
        const isTouchOverTrash = isPointInTrashZone(dragPoint);
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2 || isTouchOverTrash || session.enteredTrashZone) session.moved = true;
        session.enteredTrashZone = session.enteredTrashZone || isTouchOverTrash;
        setShowTrashZone(prev => prev === isTouchOverTrash ? prev : isTouchOverTrash);
        session.pendingPosition = nextPosition; session.pendingTrashPoint = dragPoint;
        animatedScale.setValue(isTouchOverTrash ? (session.startScale ?? 1) * OVERLAY_TRASH_PREVIEW_SCALE : (session.startScale ?? 1));
      },
      onPanResponderRelease: () => {
        const session = overlayGestureState.current[id];
        if (session?.overlayTransformRaf != null) cancelAnimationFrame(session.overlayTransformRaf);
        if (session?.deleteLongPressTimer) clearTimeout(session.deleteLongPressTimer);
        if (shouldDeleteOnDrop(session)) { removeOverlay(id); delete overlayGestureState.current[id]; setShowTrashZone(false); setIsOverlayTransforming(false); setIsScrollEnabled(true); return; }
        animatedPosition.flattenOffset();
        const finalRawPosition = session?.pendingPosition || getAnimatedPositionValue(animatedPosition, getLatestOverlayImageById(id)?.position || fallbackPosition);
        updateOverlayImageById(currentImageIndexRef.current, id, overlay => ({ ...overlay, position: finalRawPosition, scale: session?.pendingScale ?? overlay.scale, rotation: session?.pendingRotation ?? overlay.rotation }));
        const restoredScale = session?.pendingScale != null ? session.pendingScale : session?.startScale ?? getLatestOverlayImageById(id)?.scale ?? 1;
        animatedScale.setValue(restoredScale);
        if (session?.moved) recentDragTimestamps.current[`image-${id}`] = Date.now();
        delete overlayGestureState.current[id]; setIsOverlayTransforming(false); setIsScrollEnabled(true); setShowTrashZone(false);
      },
      onPanResponderTerminate: () => {
        const session = overlayGestureState.current[id];
        if (session?.overlayTransformRaf != null) cancelAnimationFrame(session.overlayTransformRaf);
        if (session?.deleteLongPressTimer) clearTimeout(session.deleteLongPressTimer);
        if (shouldDeleteOnDrop(session)) { removeOverlay(id); delete overlayGestureState.current[id]; setShowTrashZone(false); setIsOverlayTransforming(false); setIsScrollEnabled(true); return; }
        animatedPosition.flattenOffset();
        const finalRawPosition = session?.pendingPosition || getAnimatedPositionValue(animatedPosition, getLatestOverlayImageById(id)?.position || fallbackPosition);
        updateOverlayImageById(currentImageIndexRef.current, id, overlay => ({ ...overlay, position: finalRawPosition, scale: session?.pendingScale ?? overlay.scale, rotation: session?.pendingRotation ?? overlay.rotation }));
        animatedScale.setValue(session?.pendingScale != null ? session.pendingScale : session?.startScale ?? getLatestOverlayImageById(id)?.scale ?? 1);
        delete overlayGestureState.current[id]; setIsOverlayTransforming(false); setIsScrollEnabled(true); setShowTrashZone(false);
      },
    });
  };

  const createTextPanResponder = id => {
    const imageIndex = currentImageIndex;
    const currentEdits = imageEdits[imageIndex] || getCurrentImageEdits();
    const target = currentEdits.textOverlays.find(o => o.id === id);
    if (!target) return PanResponder.create({ onStartShouldSetPanResponder: () => false });
    const fallbackPosition = target.position || { x: 0, y: 0 };
    const animatedPosition = getAnimatedValue(imageIndex, id, fallbackPosition.x, fallbackPosition.y);
    const animatedScale = getAnimatedTextOverlayScale(imageIndex, id, target.scale ?? 1);
    const animatedRotation = getAnimatedTextOverlayRotation(imageIndex, id, target.rotation ?? 0);

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: evt => {
        textOverlayTransformActiveRef.current = true;
        setIsOverlayTransforming(true); setIsScrollEnabled(false);
        const touches = evt.nativeEvent.touches;
        const currentOverlay = getLatestTextOverlayById(id) || target;
        const safePosition = getAnimatedPositionValue(animatedPosition, currentOverlay.position || fallbackPosition);
        animatedPosition.setOffset(safePosition); animatedPosition.setValue({ x: 0, y: 0 });
        const startDist = getTouchDistance(touches); const startCenter = getTouchCenter(touches); const touchT0 = Date.now();
        textOverlayGestureState.current[id] = { mode: touches.length >= 2 ? 'transform' : 'drag', startPosition: safePosition, startScale: currentOverlay.scale ?? 1, startRotation: currentOverlay.rotation ?? 0, startDistance: startDist, startCenter, startAngle: getTouchAngle(touches), pinchBaselineReady: touches.length >= 2 && startDist > 1e-4, didPinchGesture: false, moved: false, maxPointerMove: 0, touchStartTime: touchT0, enteredTrashZone: false, longPressDeleteTimer: null };
        const nextS = currentOverlay.scale ?? 1; if (Math.abs(getAnimatedNumericValue(animatedScale, nextS) - nextS) > 1e-4) animatedScale.setValue(nextS);
        const nextR = currentOverlay.rotation ?? 0; if (Math.abs(getAnimatedNumericValue(animatedRotation.value, nextR) - nextR) > 1e-4) animatedRotation.value.setValue(nextR);
        textOverlayGestureState.current[id].longPressDeleteTimer = setTimeout(() => {
          if (Date.now() - (recentDragTimestamps.current[`text-${id}`] || 0) < 800) return;
          const s = textOverlayGestureState.current[id];
          if (!s || s.didPinchGesture || s.moved || s.maxPointerMove > TEXT_OVERLAY_TAP_MAX_MOVE) return;
          textOverlayTransformActiveRef.current = false; setIsOverlayTransforming(false); setIsScrollEnabled(true); setShowTrashZone(false);
          removeTextOverlay(id); delete textOverlayGestureState.current[id];
        }, TEXT_OVERLAY_LONGPRESS_DELETE_MS);
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches; const session = textOverlayGestureState.current[id]; if (!session) return;
        if (touches.length >= 2) {
          if (session.longPressDeleteTimer) { clearTimeout(session.longPressDeleteTimer); session.longPressDeleteTimer = null; }
          session.didPinchGesture = true;
          if (!session.pinchBaselineReady) { session.pinchBaselineReady = true; const co = getLatestTextOverlayById(id) || target; session.startDistance = Math.max(getTouchDistance(touches), 1e-4); session.startCenter = getTouchCenter(touches); session.startScale = co?.scale ?? 1; session.startRotation = co?.rotation ?? 0; session.startAngle = getTouchAngle(touches); session.startPosition = getAnimatedPositionValue(animatedPosition, co?.position || fallbackPosition); }
          const distance = getTouchDistance(touches); const center = getTouchCenter(touches); const angle = getTouchAngle(touches);
          const scaleRatio = session.startDistance > 0 ? distance / session.startDistance : 1;
          const nextScale = clamp(session.startScale * scaleRatio, 0.3, 4.5);
          const pendingRotation = session.startRotation + (angle - session.startAngle); session.pendingRotation = pendingRotation;
          const dx = center.x - session.startCenter.x; const dy = center.y - session.startCenter.y;
          animatedPosition.setValue({ x: dx, y: dy });
          const nextPosition = { x: session.startPosition.x + dx, y: session.startPosition.y + dy };
          const dragPoint = center; const isTouchOverTrash = isPointInTrashZone(dragPoint);
          const displayScale = isTouchOverTrash ? nextScale * OVERLAY_TRASH_PREVIEW_SCALE : nextScale;
          animatedScale.setValue(displayScale); animatedRotation.value.setValue(pendingRotation);
          session.enteredTrashZone = session.enteredTrashZone || isTouchOverTrash;
          setShowTrashZone(prev => prev === isTouchOverTrash ? prev : isTouchOverTrash);
          session.pendingPosition = nextPosition; session.pendingScale = nextScale; session.pendingTrashPoint = dragPoint; session.moved = true;
          return;
        }
        const m = Math.hypot(gestureState.dx, gestureState.dy); session.maxPointerMove = Math.max(session.maxPointerMove || 0, m);
        if (session.longPressDeleteTimer && (Math.abs(gestureState.dx) > 1.5 || Math.abs(gestureState.dy) > 1.5)) { clearTimeout(session.longPressDeleteTimer); session.longPressDeleteTimer = null; }
        animatedPosition.setValue({ x: gestureState.dx, y: gestureState.dy });
        const nextPosition = { x: session.startPosition.x + gestureState.dx, y: session.startPosition.y + gestureState.dy };
        const dragPoint = { x: gestureState.moveX, y: gestureState.moveY }; const isTouchOverTrash = isPointInTrashZone(dragPoint);
        if (Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2 || isTouchOverTrash || session.enteredTrashZone) session.moved = true;
        session.enteredTrashZone = session.enteredTrashZone || isTouchOverTrash;
        setShowTrashZone(prev => prev === isTouchOverTrash ? prev : isTouchOverTrash);
        session.pendingPosition = nextPosition; session.pendingTrashPoint = dragPoint;
        animatedScale.setValue(isTouchOverTrash ? (session.startScale ?? 1) * OVERLAY_TRASH_PREVIEW_SCALE : (session.startScale ?? 1));
      },
      onPanResponderRelease: () => {
        const session = textOverlayGestureState.current[id];
        if (session?.longPressDeleteTimer) clearTimeout(session.longPressDeleteTimer);
        if (!session) { textOverlayTransformActiveRef.current = false; return; }
        if (shouldDeleteOnDrop(session)) { textOverlayTransformActiveRef.current = false; removeTextOverlay(id); delete textOverlayGestureState.current[id]; setShowTrashZone(false); setIsOverlayTransforming(false); setIsScrollEnabled(true); return; }
        animatedPosition.flattenOffset();
        const finalPosition = session?.pendingPosition || getAnimatedPositionValue(animatedPosition, getLatestTextOverlayById(id)?.position || fallbackPosition);
        updateTextOverlayById(currentImageIndexRef.current, id, overlay => ({ ...overlay, position: finalPosition, scale: session?.pendingScale ?? overlay.scale, rotation: session?.pendingRotation ?? overlay.rotation }));
        animatedScale.setValue(session?.pendingScale != null ? session.pendingScale : session?.startScale ?? getLatestTextOverlayById(id)?.scale ?? 1);
        animatedRotation.value.setValue(session?.pendingRotation != null ? session.pendingRotation : getLatestTextOverlayById(id)?.rotation ?? session?.startRotation ?? 0);
        if (session?.moved) recentDragTimestamps.current[`text-${id}`] = Date.now();
        const tapToEdit = !session.didPinchGesture && (session.maxPointerMove || 0) < TEXT_OVERLAY_TAP_MAX_MOVE && Date.now() - (session.touchStartTime || 0) < TEXT_OVERLAY_TAP_MAX_MS;
        if (tapToEdit && Date.now() - (recentDragTimestamps.current[`text-${id}`] || 0) > 120) {
          const o = getLatestTextOverlayById(id);
          if (o) { setEditingOverlayId(o.id); setText(o.text); setTextColor(o.color); setHighlightColor(o.highlightColor); setTextAlign(o.textAlign); setSelectedFont({ fontFamily: o.fontFamily }); setModalVisible2(true); }
        }
        textOverlayTransformActiveRef.current = false; delete textOverlayGestureState.current[id]; setIsOverlayTransforming(false); setIsScrollEnabled(true); setShowTrashZone(false);
      },
      onPanResponderTerminate: () => {
        const session = textOverlayGestureState.current[id];
        if (session?.longPressDeleteTimer) clearTimeout(session.longPressDeleteTimer);
        if (!session) { textOverlayTransformActiveRef.current = false; return; }
        if (shouldDeleteOnDrop(session)) { textOverlayTransformActiveRef.current = false; removeTextOverlay(id); delete textOverlayGestureState.current[id]; setShowTrashZone(false); setIsOverlayTransforming(false); setIsScrollEnabled(true); return; }
        animatedPosition.flattenOffset();
        const finalPosition = session?.pendingPosition || getAnimatedPositionValue(animatedPosition, getLatestTextOverlayById(id)?.position || fallbackPosition);
        updateTextOverlayById(currentImageIndexRef.current, id, overlay => ({ ...overlay, position: finalPosition, scale: session?.pendingScale ?? overlay.scale, rotation: session?.pendingRotation ?? overlay.rotation }));
        animatedScale.setValue(session?.pendingScale != null ? session.pendingScale : session?.startScale ?? getLatestTextOverlayById(id)?.scale ?? 1);
        animatedRotation.value.setValue(session?.pendingRotation != null ? session.pendingRotation : getLatestTextOverlayById(id)?.rotation ?? session?.startRotation ?? 0);
        if (session?.moved) recentDragTimestamps.current[`text-${id}`] = Date.now();
        textOverlayTransformActiveRef.current = false; delete textOverlayGestureState.current[id]; setIsOverlayTransforming(false); setIsScrollEnabled(true); setShowTrashZone(false);
      },
    });
  };

  const filterOptions = [
    { name: 'Original', value: 'none', component: React.Fragment },
    { name: 'Grayscale', value: 'grayscale', component: Grayscale },
    { name: 'Sepia', value: 'sepia', component: Sepia },
    { name: 'Saturate', value: 'saturate', component: props => <Saturate amount={2} {...props} /> },
    { name: 'Contrast', value: 'contrast', component: props => <Contrast amount={2} {...props} /> },
    { name: 'Brightness', value: 'brightness', component: props => <Brightness amount={1.5} {...props} /> },
  ];

  const handleZoomStart = () => { setIsZooming(true); setShowZoomIndicator(true); Animated.timing(zoomIndicatorOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start(); };
  const handleZoomEnd = () => {
    setIsZooming(false);
    if (zoomTimeout.current) clearTimeout(zoomTimeout.current);
    zoomTimeout.current = setTimeout(() => { Animated.timing(zoomIndicatorOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => { setShowZoomIndicator(false); }); }, 1000);
  };
  const handleZoomChange = scale => {
    setZoomLevel(scale);
    if (!showZoomIndicator) { setShowZoomIndicator(true); Animated.timing(zoomIndicatorOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start(); }
  };

  const addTextOverlay = () => {
    if (!text || text.trim() === '') {
      if (editingOverlayId) { const currentEdits = getCurrentImageEdits(); updateCurrentImageEdits({ textOverlays: currentEdits.textOverlays.filter(o => o.id !== editingOverlayId) }); setEditingOverlayId(null); }
      setText(''); setModalVisible2(false); return;
    }
    const currentEdits = getCurrentImageEdits();
    if (editingOverlayId) {
      updateCurrentImageEdits({ textOverlays: currentEdits.textOverlays.map(o => o.id === editingOverlayId ? { ...o, text, color: textColor, fontFamily: resolveOverlayFontFamily(text, selectedFont.fontFamily || selectedFont), textAlign, highlightColor } : o) });
      setEditingOverlayId(null);
    } else {
      const { x, y } = pan.__getValue();
      const newId = Date.now().toString() + Math.random();
      const boundedPosition = clampPositionToBounds({ x, y }, getTextOverlayBounds(currentImageIndex, { id: newId, text, fontSize: 28, scale: 1 }));
      updateCurrentImageEdits({ textOverlays: [...currentEdits.textOverlays, { id: newId, text, fontSize: 28, scale: 1, rotation: 0, color: textColor, fontFamily: resolveOverlayFontFamily(text, selectedFont.fontFamily || selectedFont), textAlign, highlightColor, position: boundedPosition }] });
    }
    pan.setValue({ x: 0, y: 0 }); pan.setOffset({ x: 0, y: 0 }); setText(''); setModalVisible2(false);
  };

  const pickImages = () => {
    ImagePicker.openPicker({ multiple: true, mediaType: 'any', maxFiles: 10, quality: 0.8 })
      .then(images => {
        setSelectedImages(images); setCurrentImageIndex(0);
        const initialEdits = {}; const initialVideoPaused = {};
        images.forEach((_, index) => { initialEdits[index] = createEmptyImageEdits(); initialVideoPaused[index] = true; });
        setImageEdits(initialEdits); setVideoPaused(initialVideoPaused);
      })
      .catch(error => console.log('Image picker error:', error));
  };

  const addMoreClips = () => {
    ImagePicker.openPicker({ multiple: true, mediaType: 'any', maxFiles: 10, quality: 0.8 })
      .then(newItems => {
        if (!newItems?.length) return;
        setSelectedImages(prev => {
          const start = prev.length;
          const merged = [...prev, ...newItems];
          setImageEdits(prevEdits => { const next = { ...prevEdits }; newItems.forEach((_, i) => { next[start + i] = createEmptyImageEdits(); }); return next; });
          setVideoPaused(prevPause => { const next = { ...prevPause }; newItems.forEach((_, i) => { next[start + i] = true; }); return next; });
          return merged;
        });
        showToastMessage(toast, 'success', t('selectedPost.clipsAdded'), 1500);
      })
      .catch(() => {});
  };

  const addStickerEmoji = emoji => {
    const id = `${Date.now()}_${Math.random()}`;
    const ch = editorCanvasHeight || IMAGE_SIZE;
    const newOverlay = { id, text: emoji, fontSize: 52, scale: 1, rotation: 0, color: '#fff', fontFamily: 'System', textAlign: 'center', position: { x: Math.max(16, IMAGE_SIZE / 2 - 28), y: Math.max(16, ch / 2 - 28) }, highlightColor: 'transparent' };
    const cur = getCurrentImageEdits();
    updateCurrentImageEdits({ textOverlays: [...(cur.textOverlays || []), newOverlay] });
    setFlipStickerModal(false);
    showToastMessage(toast, 'success', t('selectedPost.stickerAdded'), 1500);
  };

  const setFlipVolumeForCurrent = vol => { const v = Math.min(1, Math.max(0, vol)); setFlipVolumeByIndex(prev => ({ ...prev, [currentImageIndex]: v })); };

  const removeOverlay = (id) => {
    delete overlayPanResponderRefs.current[id];
    const idx = currentImageIndexRef.current;
    delete overlayImageScaleRefs.current[`${idx}:imgscale:${id}`];
    delete overlayImageRotationRefs.current[`${idx}:imgrot:${id}`];
    setImageEdits(prev => { const base = prev[idx] || createEmptyImageEdits(); return { ...prev, [idx]: { ...base, overlayImages: base.overlayImages.filter(img => img.id !== id) } }; });
  };

  const removeTextOverlay = (id) => {
    const s = textOverlayGestureState.current[id];
    if (s?.longPressDeleteTimer) clearTimeout(s.longPressDeleteTimer);
    delete textOverlayGestureState.current[id];
    textOverlayTransformActiveRef.current = false;
    delete textPanResponderRefs.current[id];
    const idx = currentImageIndexRef.current;
    delete textOverlayScaleRefs.current[`${idx}:textscale:${id}`];
    delete textOverlayRotationRefs.current[`${idx}:textrot:${id}`];
    const currentEdits = getCurrentImageEdits();
    updateCurrentImageEdits({ textOverlays: currentEdits.textOverlays.filter(overlay => overlay.id !== id) });
  };

  const measureTrashZone = useCallback(() => {
    if (trashZoneRef.current) { trashZoneRef.current.measure((x, y, width, height, pageX, pageY) => { setTrashRect({ x: pageX, y: pageY, width, height }); }); }
  }, []);

  const isPointInTrashZone = (point) => {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
    if (trashRect && trashRect.width > 0 && trashRect.height > 0 && Number.isFinite(trashRect.x) && Number.isFinite(trashRect.y)) {
      const cx = trashRect.x + trashRect.width / 2; const cy = trashRect.y + trashRect.height / 2;
      return Math.hypot(point.x - cx, point.y - cy) <= TRASH_DROP_RADIUS_PX;
    }
    return point.y >= SCREEN_HEIGHT * 0.78 && point.x >= SCREEN_WIDTH * 0.40 && point.x <= SCREEN_WIDTH * 0.60;
  };

  const shouldDeleteOnDrop = session => !!(session?.moved && !session?.didPinchGesture && isPointInTrashZone(session?.pendingTrashPoint));
  const getDraggedPosition = (startPosition, deltaX, deltaY, bounds, allowOverflow = false) => ({ x: allowOverflow ? startPosition.x + deltaX : clamp(startPosition.x + deltaX, bounds.minX, bounds.maxX), y: allowOverflow ? startPosition.y + deltaY : clamp(startPosition.y + deltaY, bounds.minY, bounds.maxY) });
  const exitDrawModeDiscardStrokes = () => { if (canvasRef.current) canvasRef.current.clear(); setIsDrawing(false); setIsScrollEnabled(true); setActiveTab('null'); setCanvasKey(prev => prev + 1); };

  const handleNext = async () => {
    setVideoMuted(true); setVideoPaused(true);
    if (isDrawing) exitDrawModeDiscardStrokes();
    try {
      const processedImages = await Promise.all(
        selectedImages.map(async (image, index) => {
          const edits = imageEdits[index] || createEmptyImageEdits();
          let processedUri = edits.processedImageUri || getMediaDisplayUri(image);
          const isVideo = isMediaVideo(image);
          const hasEdits = edits.textOverlays.length > 0 || edits.overlayImages.length > 0 || edits.drawings || edits.processedImageUri || (edits.filter && edits.filter !== 'none');
          if (!isVideo && (hasEdits || selectedImages.length === 1)) {
            try { const uri = await captureFilteredImage(index); if (uri) processedUri = uri; } catch (captureError) { console.log('Error capturing image with overlays:', captureError); }
          }
          return { ...image, originalUri: getMediaDisplayUri(image), processedUri, filter: edits.filter, isVideo, trimStart: edits.trimStart, trimEnd: edits.trimEnd, musicId: edits.musicId, musicTitle: edits.musicTitle, musicArtist: edits.musicArtist, musicSource: edits.musicSource, musicYoutubeVideoId: edits.musicYoutubeVideoId, musicYoutubeThumbUrl: edits.musicYoutubeThumbUrl, musicYoutubeDurationSec: edits.musicYoutubeDurationSec, musicTrimStart: edits.musicTrimStart ?? 0, musicTrimEnd: edits.musicTrimEnd ?? null, musicLyrics: edits.musicLyrics ?? null, musicBadge: edits.musicBadge ?? null, flipVolume: flipVolumeByIndex[index] ?? 1, textOverlays: edits.textOverlays.map(overlay => ({ ...overlay, position: overlay.position || { x: 0, y: 0 } })), overlayImages: edits.overlayImages.map(overlay => ({ ...overlay, position: overlay.position || { x: 0, y: 0 } })), drawings: edits.drawings, uriBeforeAnyDrawing: edits.uriBeforeAnyDrawing, imageIndex: index };
        })
      );

      console.log('Successfully processed images/videos with overlays', processedImages);

      navigation.navigate('PostEditor', {
        images: processedImages,
        imageEdits: imageEdits,
        postType: postType,
        fromIcon: fromIcon,
        taggedPeople: selectedTaggedPeople,
        taggedPeopleIds: selectedTaggedPeople
          .map(username => selectedTaggedPeopleIds?.[username])
          .filter(Boolean),
        taggedPeopleMeta: selectedTaggedPeople.map(username => ({
          username,
          userId: selectedTaggedPeopleIds?.[username] || null,
        })),
      });

    } catch (error) {
      console.log('Error processing images:', error);
      Alert.alert(
        t('selectedPost.processingErrorTitle'),
        t('selectedPost.processingErrorMessage'),
        [
          { text: t('selectedPost.cancel'), style: 'cancel' },
          {
            text: t('selectedPost.continueAnyway'),
            onPress: () => {
              const fallbackImages = selectedImages.map((image, index) => {
                const edits = imageEdits[index] || createEmptyImageEdits();

                return {
                  ...image,
                  originalUri: getMediaDisplayUri(image),
                  processedUri: edits.processedImageUri || getMediaDisplayUri(image),
                  filter: edits.filter,
                  isVideo: isMediaVideo(image),
                  trimStart: edits.trimStart,
                  trimEnd: edits.trimEnd,
                  musicId: edits.musicId,
                  musicTitle: edits.musicTitle,
                  musicArtist: edits.musicArtist,
                  musicSource: edits.musicSource,
                  musicYoutubeVideoId: edits.musicYoutubeVideoId,
                  musicYoutubeThumbUrl: edits.musicYoutubeThumbUrl,
                  musicYoutubeDurationSec: edits.musicYoutubeDurationSec,
                  musicTrimStart: edits.musicTrimStart ?? 0,
                  musicTrimEnd: edits.musicTrimEnd ?? null,
                  musicLyrics: edits.musicLyrics ?? null,
                  musicBadge: edits.musicBadge ?? null,
                  flipVolume: flipVolumeByIndex[index] ?? 1,
                  textOverlays: edits.textOverlays.map(overlay => ({
                    ...overlay,
                    position: overlay.position || { x: 0, y: 0 }
                  })),
                  overlayImages: edits.overlayImages.map(overlay => ({
                    ...overlay,
                    position: overlay.position || { x: 0, y: 0 }
                  })),
                  drawings: edits.drawings,
                  uriBeforeAnyDrawing: edits.uriBeforeAnyDrawing,
                  imageIndex: index
                };
              });

              navigation.navigate('PostEditor', {
                images: fallbackImages,
                imageEdits: imageEdits,
                postType: postType,
                fromIcon: fromIcon,
                taggedPeople: selectedTaggedPeople,
                taggedPeopleIds: selectedTaggedPeople
                  .map(username => selectedTaggedPeopleIds?.[username])
                  .filter(Boolean),
                taggedPeopleMeta: selectedTaggedPeople.map(username => ({
                  username,
                  userId: selectedTaggedPeopleIds?.[username] || null,
                })),
              });
              navigation.navigate('PostEditor', { images: fallbackImages, imageEdits, postType, fromIcon, taggedPeople: selectedTaggedPeople });
            }
          }
        ]
      );
    }
  };

  const handleBack = () => { if (isDrawing) { exitDrawMode({ clearUnsavedStrokes: true }); return; } navigation.goBack(); };

  const TabButton = ({ title, isActive, icon, onPress, disabled = false }) => (
    <TouchableOpacity style={[styles.tabButton, disabled && styles.disabledTabButton]} onPress={onPress} disabled={disabled}>
      <Icon name={icon} size={15} color={disabled ? '#555' : '#aaa'} style={{ marginBottom: 2 }} />
      <Text style={[styles.tabButtonText, disabled && styles.disabledTabButtonText]}>{title}</Text>
    </TouchableOpacity>
  );

  const renderZoomIndicator = () => {
    if (!showZoomIndicator) return null;
    return (
      <Animated.View style={[styles.zoomIndicator, { opacity: zoomIndicatorOpacity }]}>
        <View style={styles.zoomHashPattern}>{Array.from({ length: 9 }).map((_, index) => <View key={index} style={styles.hashLine} />)}</View>
        <Text style={styles.zoomText}>{Math.round(zoomLevel * 100)}%</Text>
      </Animated.View>
    );
  };

  const renderImageCarousel = () => {
    const currentEdits = getCurrentImageEdits();
    const currentCanvasHeight = editorCanvasHeight;
    const isSquareDrawingSurface = isDrawing && Platform.OS === 'ios';
    const FilterComponent = filterOptions.find(f => f.value === selectedFilter)?.component || React.Fragment;

    const handleMainImageScroll = async (event) => {
      const { contentOffset, layoutMeasurement } = event.nativeEvent;
      const newIndex = Math.round(contentOffset.x / layoutMeasurement.width);
      if (newIndex !== currentImageIndex && newIndex >= 0 && newIndex < selectedImages.length) await handleImageChange(newIndex);
    };

    const scrollToImage = async (index) => {
      await handleImageChange(index);
      if (mainScrollViewRef.current) mainScrollViewRef.current.scrollTo({ x: index * IMAGE_SIZE, animated: true });
    };

    return (
      <View style={styles.imageContainer} onLayout={e => { const h = e.nativeEvent.layout.height; if (h > 0 && Math.abs(h - editorRegionLayoutHeight) > 0.5) setEditorRegionLayoutHeight(h); }}>
        {selectedImages.length > 0 ? (
          <>
            <View style={[styles.mainImageContainer, { height: currentCanvasHeight }, isDrawing && styles.mainImageContainerWhileDrawing, isSquareDrawingSurface && styles.mainImageContainerSquareDrawing]}>
              <ScrollView ref={mainScrollViewRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={handleMainImageScroll} scrollEventThrottle={16} style={[styles.mainScrollView, { height: currentCanvasHeight }]} contentContainerStyle={[styles.mainScrollContent, { height: currentCanvasHeight }]} scrollEnabled={isScrollEnabled} removeClippedSubviews={!isDrawing}>
                {selectedImages.map((image, index) => {
                  const slideEditsForMute = imageEdits[index] || {};
                  const hasLibMusicOnSlide = slideHasLibraryMusic(slideEditsForMute);
                  return (
                    <View key={getMediaKey(image, index)} style={[styles.imageSlide, { width: IMAGE_SIZE, height: currentCanvasHeight }]}>
                      <View ref={ref => { if (ref) imageViewRefs.current[index] = ref; }} style={{ width: IMAGE_SIZE, height: currentCanvasHeight, position: 'relative' }} collapsable={false}>
                        {isMediaVideo(image) ? (
                          <View style={styles.videoContainer}>
                            <Video ref={ref => { if (ref) videoRefs.current[index] = ref; }} source={{ uri: getMediaDisplayUri(image) }} style={styles.mainImage} resizeMode='cover' paused={videoPaused[index] !== false} muted={isFlipPost ? (flipVolumeByIndex[index] ?? 1) === 0 || (hasLibMusicOnSlide && index === currentImageIndex) : videoMuted || (hasLibMusicOnSlide && index === currentImageIndex)} volume={isFlipPost ? (flipVolumeByIndex[index] ?? 1) : 1} repeat={true} onError={(error) => console.log('Video error:', error)} poster={image.thumbnail || undefined} />
                            <TouchableOpacity style={styles.videoPlayButton} onPress={() => handleVideoPress(index)} activeOpacity={0.8}>
                              <View style={styles.playButtonBackground}><Icon name={videoPaused[index] !== false ? 'play' : 'pause'} size={40} color="white" /></View>
                            </TouchableOpacity>
                            <View style={styles.videoIndicator}>
                              <Icon name="videocam" size={16} color="white" />
                              {image.duration && <Text style={styles.videoDuration}>{Math.floor(image.duration / 1000)}s</Text>}
                            </View>
                            <View style={styles.videoControls}>
                              <TouchableOpacity style={styles.muteButton} onPress={() => { if (isFlipPost) { const v = flipVolumeByIndex[index] ?? 1; setFlipVolumeByIndex(prev => ({ ...prev, [index]: v === 0 ? 1 : 0 })); } else { setVideoMuted(!videoMuted); } }}>
                                <Icon name={isFlipPost ? (flipVolumeByIndex[index] ?? 1) === 0 ? 'volume-mute' : 'volume-high' : videoMuted ? 'volume-mute' : 'volume-high'} size={20} color="white" />
                              </TouchableOpacity>
                            </View>
                            {selectedFilter !== 'none' && index === currentImageIndex && <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: selectedFilter === 'grayscale' ? 'rgba(0,0,0,0.6)' : selectedFilter === 'sepia' ? 'rgba(140, 171, 225, 0.4)' : selectedFilter === 'saturate' ? 'rgba(255,100,255,0.15)' : selectedFilter === 'contrast' ? 'rgba(0,0,0,0.35)' : selectedFilter === 'brightness' ? 'rgba(255,255,255,0.35)' : 'transparent' }]} />}
                          </View>
                        ) : isDrawing && index === currentImageIndex ? (
                          <View ref={ref => { if (ref) drawingSurfaceRefs.current[index] = ref; }} collapsable={false} style={[styles.drawingSurface, { width: IMAGE_SIZE, height: currentCanvasHeight }]}>
                            <View style={[styles.staticImageCanvas, { width: IMAGE_SIZE, height: currentCanvasHeight }, isSquareDrawingSurface && styles.staticImageCanvasSquareDrawing]}>
                              {(() => { const slideEdits = imageEdits[index] || {}; const currentImageUri = getMediaDisplayUri(image, slideEdits.processedImageUri); return <Image source={{ uri: currentImageUri }} style={[styles.mainImage, { width: IMAGE_SIZE, height: currentCanvasHeight }, isSquareDrawingSurface && styles.mainImageSquareDrawing]} resizeMode='cover' />; })()}
                              {selectedFilter !== 'none' && <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.filterOverlay, isSquareDrawingSurface && styles.filterOverlaySquareDrawing, { backgroundColor: selectedFilter === 'grayscale' ? 'rgba(0,0,0,0.6)' : selectedFilter === 'sepia' ? 'rgba(140, 171, 225, 0.4)' : selectedFilter === 'saturate' ? 'rgba(255,100,255,0.15)' : selectedFilter === 'contrast' ? 'rgba(0,0,0,0.35)' : selectedFilter === 'brightness' ? 'rgba(255,255,255,0.35)' : 'transparent' }]} />}
                            </View>
                            <SketchCanvas key={`canvas-${currentImageIndex}-${canvasKey}`} ref={canvasRef} style={[StyleSheet.absoluteFill, styles.activeDrawCanvas]} strokeColor={drawColor} strokeWidth={5} touchEnabled={true} pointerEvents="auto" />
                          </View>
                        ) : (
                          <ImageZoom {...(!isDrawing && !isOverlayTransforming ? panResponder.panHandlers : {})} cropWidth={IMAGE_SIZE} cropHeight={currentCanvasHeight} imageWidth={IMAGE_SIZE} imageHeight={currentCanvasHeight} panToMove={!isDrawing && !isOverlayTransforming} minScale={0.5} maxScale={4} pinchToZoom={!isDrawing && !isOverlayTransforming} enableDoubleClickZoom={!isDrawing && !isOverlayTransforming} doubleClickInterval={175} style={[styles.imageZoomContainer, { width: IMAGE_SIZE, height: currentCanvasHeight }]} onPanResponderGrant={handleZoomStart} onPanResponderRelease={handleZoomEnd} onMove={({ scale }) => handleZoomChange(scale)}>
                            <View style={[styles.staticImageCanvas, { width: IMAGE_SIZE, height: currentCanvasHeight }, isSquareDrawingSurface && styles.staticImageCanvasSquareDrawing]}>
                              {(() => { const slideEdits = imageEdits[index] || {}; const currentImageUri = getMediaDisplayUri(image, slideEdits.processedImageUri); return <Image source={{ uri: currentImageUri }} style={[styles.mainImage, { width: IMAGE_SIZE, height: currentCanvasHeight }, isSquareDrawingSurface && styles.mainImageSquareDrawing]} resizeMode='cover' />; })()}
                              {selectedFilter !== 'none' && <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.filterOverlay, isSquareDrawingSurface && styles.filterOverlaySquareDrawing, { backgroundColor: selectedFilter === 'grayscale' ? 'rgba(0,0,0,0.6)' : selectedFilter === 'sepia' ? 'rgba(140, 171, 225, 0.4)' : selectedFilter === 'saturate' ? 'rgba(255,100,255,0.15)' : selectedFilter === 'contrast' ? 'rgba(0,0,0,0.35)' : selectedFilter === 'brightness' ? 'rgba(255,255,255,0.35)' : 'transparent' }]} />}
                            </View>
                          </ImageZoom>
                        )}

                        {index === currentImageIndex && (
                          <>
                            {currentEdits.overlayImages.map(img => {
                              const overlayPanResponder = getOrCreatePanResponder(img.id);
                              const animatedPosition = getAnimatedValue(currentImageIndex, `image-${img.id}`, img.position?.x || 50, img.position?.y || 50);
                              const overlayScaleAnim = getAnimatedOverlayImageScale(currentImageIndex, img.id, img.scale ?? 1);
                              const overlayRotationAnim = getAnimatedOverlayImageRotation(currentImageIndex, img.id, img.rotation ?? 0);
                              return (
                                <Animated.View key={img.id} {...overlayPanResponder.panHandlers} testID="overlay-element" style={[styles.overlayImageWrapper, { width: img.baseSize || 100, height: img.baseSize || 100, transform: [...animatedPosition.getTranslateTransform(), { scale: overlayScaleAnim }, { rotate: overlayRotationAnim.rotate }] }]}>
                                  <View style={styles.overlayTouchTarget}><Image source={{ uri: img.uri }} style={styles.overlayImage} /></View>
                                </Animated.View>
                              );
                            })}
                            {currentEdits.textOverlays.map(overlay => {
                              const responder = getOrCreateTextPanResponder(overlay.id);
                              const animatedPosition = getAnimatedValue(currentImageIndex, overlay.id, overlay.position?.x ?? 0, overlay.position?.y ?? 0);
                              const textScaleAnim = getAnimatedTextOverlayScale(currentImageIndex, overlay.id, overlay.scale ?? 1);
                              const textRotationAnim = getAnimatedTextOverlayRotation(currentImageIndex, overlay.id, overlay.rotation ?? 0);
                              return (
                                <Animated.View key={overlay.id} {...responder.panHandlers} testID="overlay-element" onLayout={event => { const layoutKey = getTextOverlayLayoutKey(currentImageIndex, overlay.id); const { width, height } = event.nativeEvent.layout; const prev = textOverlayLayoutRefs.current[layoutKey]; if (!prev || Math.abs(prev.width - width) > 1 || Math.abs(prev.height - height) > 1) textOverlayLayoutRefs.current[layoutKey] = { width, height }; }} style={{ position: 'absolute', zIndex: 1000, transform: [...animatedPosition.getTranslateTransform(), { scale: textScaleAnim }, { rotate: textRotationAnim.rotate }] }}>
                                  <View style={{ padding: 4, borderRadius: 4, backgroundColor: overlay.highlightColor || 'transparent' }} collapsable={false}>
                                    <Text style={[getTextStyleWithFont(overlay.text, overlay.fontFamily), { fontSize: overlay.fontSize, color: overlay.color, textAlign: overlay.textAlign, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3, maxWidth: 200 }]} numberOfLines={3}>{overlay.text}</Text>
                                  </View>
                                </Animated.View>
                              );
                            })}
                            {modalVisible2 && (
                              <Animated.View {...panResponder.panHandlers} style={[pan.getLayout(), { position: 'absolute', zIndex: 1001, padding: 4, borderRadius: 4 }]}>
                                <Text style={[{ fontSize: 28 }, getTextStyleWithFont(text, selectedFont.fontFamily || selectedFont), { color: textColor, textAlign, backgroundColor: highlightColor, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3, minWidth: 50 }]}>{text || t('selectedPost.typeText')}</Text>
                              </Animated.View>
                            )}
                          </>
                        )}

                        {index !== currentImageIndex && imageEdits[index] && (
                          <>
                            {imageEdits[index].overlayImages?.map(img => (
                              <View key={`saved-overlay-${img.id}`} style={[styles.overlayImageWrapper, { width: img.baseSize || 100, height: img.baseSize || 100, left: img.position?.x || 0, top: img.position?.y || 0, transform: [{ scale: img.scale || 1 }, { rotate: `${img.rotation || 0}rad` }] }]}>
                                <Image source={{ uri: img.uri }} style={styles.savedOverlayImage} />
                              </View>
                            ))}
                            {imageEdits[index].textOverlays?.map(overlay => (
                              <View key={`saved-text-${overlay.id}`} style={{ position: 'absolute', left: overlay.position?.x || 0, top: overlay.position?.y || 0, zIndex: 1000, padding: 4, borderRadius: 4, backgroundColor: overlay.highlightColor || 'transparent', transform: [{ scale: overlay.scale ?? 1 }, { rotate: `${overlay.rotation || 0}rad` }] }}>
                                <Text style={[getTextStyleWithFont(overlay.text, overlay.fontFamily), { fontSize: overlay.fontSize, color: overlay.color, textAlign: overlay.textAlign, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3, maxWidth: 200 }]} numberOfLines={3}>{overlay.text}</Text>
                              </View>
                            ))}
                          </>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              {isDrawing && !isCurrentMediaVideo() && (
                <>
                  <View style={styles.drawControls}>
                    <TouchableOpacity onPress={() => { if (canvasRef.current) canvasRef.current.undo(); }} style={styles.controlButton}><Text style={styles.controlButtonText}>↩</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => { if (canvasRef.current) canvasRef.current.clear(); }} style={[styles.controlButton, { backgroundColor: 'rgba(255,0,0,0.6)' }]}><Text style={styles.controlButtonText}>✕</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => { captureAndMergeDrawing(true); }} style={[styles.controlButton, { backgroundColor: 'rgba(0,128,0,0.8)' }]}><Text style={styles.controlButtonText}>✓</Text></TouchableOpacity>
                  </View>
                  <ScrollView horizontal style={styles.colorPalette} showsHorizontalScrollIndicator={false}>
                    {['red', 'blue', 'green', 'yellow', 'white', 'black'].map(color => (
                      <TouchableOpacity key={color} style={[styles.colorOption, { backgroundColor: color }, drawColor === color && styles.activeColorOption]} onPress={() => setDrawColor(color)} />
                    ))}
                  </ScrollView>
                </>
              )}

              {selectedImages.length > 1 && (
                <View style={styles.imageCounter}>
                  <Text style={styles.imageCounterText}>{currentImageIndex + 1}/{selectedImages.length}</Text>
                </View>
              )}
              {selectedImages.length > 1 && (
                <View style={styles.pageIndicator}>
                  {selectedImages.map((_, index) => (
                    <TouchableOpacity key={`${getMediaKey(selectedImages[index], index)}-dot`} onPress={() => scrollToImage(index)} style={[styles.dot, index === currentImageIndex && styles.activeDot]} />
                  ))}
                </View>
              )}
            </View>

            {(() => {
              if (!slideHasLibraryMusic(currentEdits) || postStorySoundTrimVisible) return null;
              const builtinUrl = currentEdits.musicSource === 'builtin' ? getPostSoundtrackUrl(currentEdits.musicId) : null;
              const ytId = currentEdits.musicSource === 'youtube' && currentEdits.musicYoutubeVideoId ? currentEdits.musicYoutubeVideoId : null;
              if (!builtinUrl && !ytId) return null;
              const trimStart = Number(currentEdits.musicTrimStart) || 0;
              const trimEnd = currentEdits.musicTrimEnd;
              return (
                <View style={styles.postEditorMusicBgHost} pointerEvents="none" collapsable={false}>
                  {builtinUrl ? <View style={styles.hiddenPostMusicPlayer}><Video ref={postBgBuiltinVideoRef} key={`post_bg_builtin_${currentEdits.musicId}_${currentImageIndex}`} source={{ uri: builtinUrl }} paused={false} repeat={false} muted={false} volume={1} ignoreSilentSwitch="ignore" resizeMode="contain" style={{ width: 2, height: 2 }} onLoad={d => { const dur = d?.duration || 30; postBgMusicDurRef.current = dur; const { start, hasOverlap } = getBgPlaybackWindow(trimStart, trimEnd, dur); setTimeout(() => postBgBuiltinVideoRef.current?.seek?.(hasOverlap ? start : 0), 80); }} onProgress={({ currentTime }) => { const dur = postBgMusicDurRef.current || 30; const { start: ps, end: pe, hasOverlap } = getBgPlaybackWindow(trimStart, trimEnd, dur); const margin = Math.min(0.35, Math.max(0.08, (pe - ps) * 0.02)); if (hasOverlap && pe > ps && currentTime >= pe - margin) postBgBuiltinVideoRef.current?.seek?.(ps); }} /></View> : null}
                  {ytId ? <View style={styles.hiddenPostYoutubePlayer} pointerEvents="none"><YoutubePlayer ref={postBgYoutubeRef} key={`post_bg_yt_${ytId}_${currentImageIndex}`} height={200} width={200} videoId={ytId} play mute={false} volume={100} forceAndroidAutoplay initialPlayerParams={{ controls: false, modestbranding: true, rel: false }} onReady={async () => { try { const d = await postBgYoutubeRef.current?.getDuration?.(); if (typeof d === 'number' && d > 0) postBgMusicDurRef.current = d; else if (currentEdits.musicYoutubeDurationSec != null && Number.isFinite(Number(currentEdits.musicYoutubeDurationSec))) postBgMusicDurRef.current = Number(currentEdits.musicYoutubeDurationSec); const dur = postBgMusicDurRef.current || 180; const { start: ps, hasOverlap } = getBgPlaybackWindow(trimStart, trimEnd, dur); await postBgYoutubeRef.current?.seekTo?.(hasOverlap ? ps : 0, true); } catch (_) {} }} onChangeState={state => { if (state === 'ended') { const dur = postBgMusicDurRef.current || 180; const { start: ps, hasOverlap } = getBgPlaybackWindow(trimStart, trimEnd, dur); postBgYoutubeRef.current?.seekTo?.(hasOverlap ? ps : 0, true); postBgYoutubeRef.current?.playVideo?.(); } }} /></View> : null}
                </View>
              );
            })()}

            {isOverlayTransforming && (
              <View ref={trashZoneRef} onLayout={measureTrashZone} style={[styles.storyTrashZone, showTrashZone ? styles.storyTrashZoneHot : styles.storyTrashZoneIdle]} pointerEvents="none">
                <View style={[styles.storyTrashIconWrap, showTrashZone && styles.storyTrashIconWrapHot]}>
                  <Icon name="trash" size={24} color={showTrashZone ? '#ffffff' : '#999999'} />
                </View>
                <Text style={[styles.storyTrashHint, showTrashZone && styles.storyTrashHintActive]}>{t('selectedPost.dropToDelete')}</Text>
              </View>
            )}
          </>
        ) : (
          <TouchableOpacity style={styles.addImageButton} onPress={pickImages}>
            <View style={styles.addImageIcon}><Text style={styles.addImageText}>+</Text></View>
            <Text style={styles.addImageLabel}>{t('selectedPost.addPhotosVideos')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const handleFlipToolPress = async key => {
    if (key !== 'Effects' && showFilters) setShowFilters(false);
    if (isDrawing) await captureAndMergeDrawing(true);
    switch (key) {
      case 'Text': setModalVisible2(true); openTextModal(); break;
      case 'Sticker': setFlipStickerModal(true); break;
      case 'Audio': setFlipAudioModal(true); break;
      case 'Sound': openPostMusicTrimModal(); break;
      case 'Overlay': setActiveTab('Overlay'); addOverlayImage(); break;
      case 'Effects': setShowFilters(prev => !prev); break;
      case 'Edit':
        if (isCurrentMediaVideo()) {
          const ed = getCurrentImageEdits();
          setTrimStartInput(ed.trimStart != null ? String(ed.trimStart) : '0');
          setTrimEndInput(ed.trimEnd != null ? String(ed.trimEnd) : '');
          setFlipTrimModal(true);
        } else {
          const img = selectedImages[currentImageIndex];
          const pathForCrop = img?.path || img?.uri;
          if (!pathForCrop) { showToastMessage(toast, 'default', t('selectedPost.cropUnavailable'), 2000); break; }
          try {
            const cropped = await ImagePicker.openCropper({ path: pathForCrop, mediaType: 'photo', cropping: true, freeStyleCropEnabled: true, compressImageQuality: 0.85, cropperActiveWidgetColor: '#4da3ff', cropperStatusBarColor: '#000000', cropperToolbarColor: '#000000', cropperToolbarWidgetColor: '#ffffff', enableRotationGesture: true });
            const newUri = cropped.path?.startsWith('file') ? cropped.path : `file://${cropped.path}`;
            setSelectedImages(prev => { const next = [...prev]; const idx = currentImageIndex; next[idx] = { ...next[idx], ...cropped, path: cropped.path, uri: newUri }; return next; });
            setImageEdits(prev => { const ed = prev[currentImageIndex] || {}; return { ...prev, [currentImageIndex]: { ...ed, processedImageUri: null, uriBeforeAnyDrawing: null, drawings: null } }; });
          } catch (e) { if (e?.code !== 'E_PICKER_CANCELLED') showToastMessage(toast, 'danger', e?.message || t('selectedPost.cropFailed'), 2000); }
        }
        break;
      case 'Vol': setFlipVolumeModal(true); break;
      case 'Tag': setActiveTab('Tag'); bottomSheetRef.current?.open(); break;
      case 'Download': handleDownload(); break;
      default: break;
    }
    setActiveTab(key);
  };

  const flipToolbarItems = [
    { key: 'Text', icon: 'text-outline', label: t('selectedPost.toolText') },
    { key: 'Sticker', icon: 'happy-outline', label: t('selectedPost.toolSticker') },
    { key: 'Audio', icon: 'musical-notes-outline', label: t('selectedPost.toolAudio') },
    { key: 'Sound', icon: 'timer-outline', label: t('selectedPost.toolSound') },
    { key: 'Overlay', icon: 'layers-outline', label: t('selectedPost.toolOverlay') },
    { key: 'Effects', icon: 'color-filter-outline', label: t('selectedPost.toolEffects') },
    { key: 'Edit', icon: 'crop-outline', label: t('selectedPost.toolEdit') },
    { key: 'Vol', icon: 'volume-high-outline', label: t('selectedPost.toolVol') },
    { key: 'Tag', icon: 'pricetag-outline', label: t('selectedPost.toolTag') },
    { key: 'Download', icon: 'download-outline', label: t('selectedPost.toolDownload') },
  ];

  const regularTabItems = [
    { title: t('selectedPost.toolText'), icon: 'text-outline' },
    { title: t('selectedPost.toolOverlay'), icon: 'layers-outline' },
    { title: t('selectedPost.tabMusic'), icon: 'musical-notes-outline' },
    { title: t('selectedPost.toolSound'), icon: 'timer-outline' },
    { title: t('selectedPost.tabFilter'), icon: 'color-filter-outline' },
    { title: t('selectedPost.toolTag'), icon: 'pricetag-outline' },
    { title: t('selectedPost.toolDownload'), icon: 'download-outline' },
    ...(!isCurrentMediaVideo() ? [{ title: t('selectedPost.tabDraw'), icon: 'create-outline' }] : []),
  ];

  const renderEditingTabs = () => (
    <View style={[styles.editingSection, bgStyle, isFlipPost && styles.editingSectionFlip]}>
      {isFlipPost ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.flipTabScroll} contentContainerStyle={styles.flipTabScrollContent}>
          {flipToolbarItems.map(t_item => (
            <TouchableOpacity key={t_item.key} style={styles.flipTabButton} onPress={() => handleFlipToolPress(t_item.key)} activeOpacity={0.75}>
              <Icon name={t_item.icon} size={17} color="#e5e5e5" style={{ marginBottom: 3 }} />
              <Text style={styles.flipTabLabel}>{t_item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent} keyboardShouldPersistTaps="handled">
          {regularTabItems.map(tab => (
            <TouchableOpacity key={tab.title} style={styles.tabButton} onPress={async () => {
              if (tab.title !== t('selectedPost.tabFilter') && showFilters) setShowFilters(false);
              if (tab.title === t('selectedPost.tabDraw')) {
                if (isDrawing) { await captureAndMergeDrawing(true); }
                else { const ce = getCurrentImageEdits(); const img = selectedImages[currentImageIndex]; const snap = ce.processedImageUri || getMediaDisplayUri(img); if (!ce.uriBeforeAnyDrawing) updateCurrentImageEdits({ uriBeforeAnyDrawing: snap }); setIsDrawing(true); setIsScrollEnabled(false); setCanvasKey(prev => prev + 1); }
              } else if (tab.title === t('selectedPost.tabFilter')) { setShowFilters(prev => !prev); if (isDrawing) { setIsDrawing(false); setIsScrollEnabled(true); setCanvasKey(prev => prev + 1); } }
              else if (tab.title === t('selectedPost.toolText')) { setModalVisible2(true); openTextModal(); if (isDrawing) { setIsDrawing(false); setIsScrollEnabled(true); setCanvasKey(prev => prev + 1); } }
              else if (tab.title === t('selectedPost.toolOverlay')) { setActiveTab(t('selectedPost.toolOverlay')); addOverlayImage(); if (isDrawing) { setIsDrawing(false); setIsScrollEnabled(true); setCanvasKey(prev => prev + 1); } return; }
              else if (tab.title === t('selectedPost.tabMusic')) { setFlipAudioModal(true); if (isDrawing) { setIsDrawing(false); setIsScrollEnabled(true); setCanvasKey(prev => prev + 1); } return; }
              else if (tab.title === t('selectedPost.toolSound')) { openPostMusicTrimModal(); if (isDrawing) { setIsDrawing(false); setIsScrollEnabled(true); setCanvasKey(prev => prev + 1); } return; }
              else if (tab.title === t('selectedPost.toolTag')) { setActiveTab(t('selectedPost.toolTag')); bottomSheetRef.current?.open(); if (isDrawing) { setIsDrawing(false); setIsScrollEnabled(true); setCanvasKey(prev => prev + 1); } return; }
              else if (tab.title === t('selectedPost.toolDownload')) { if (isDrawing) { setIsDrawing(false); setIsScrollEnabled(true); setCanvasKey(prev => prev + 1); } handleDownload(); }
              setActiveTab(tab.title);
            }}>
              <Icon name={tab.icon} size={15} color="#aaa" style={{ marginBottom: 2 }} />
              <Text style={styles.tabButtonText}>{tab.title}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <RBSheet ref={bottomSheetRef} closeOnDragDown={true} closeOnPressMask={true} height={480} customStyles={{ container: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 10, backgroundColor: bgStyle?.backgroundColor || '#fff' } }}>
        <View key={activeTab} style={styles.tabContent}>
          {activeTab === t('selectedPost.toolOverlay') && (
            <View style={styles.overlayControls}>
              <TouchableOpacity style={styles.editButton} onPress={addOverlayImage}>
                <Text style={styles.buttonText}>{t('selectedPost.pickOverlayImages')}</Text>
              </TouchableOpacity>
              <ScrollView horizontal>
                {getCurrentImageEdits().overlayImages.map(img => (
                  <View key={img.id} style={{ margin: 8 }}>
                    <Image source={{ uri: img.uri }} style={{ width: 60, height: 60, borderRadius: 8 }} />
                    <TouchableOpacity onPress={() => removeOverlay(img.id)}>
                      <Text style={{ color: 'red', fontSize: 12, textAlign: 'center' }}>{t('selectedPost.remove')}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {activeTab === t('selectedPost.toolTag') && (
            <View style={styles.tagSheet}>
              <View style={styles.tagSheetHeader}>
                <View>
                  <Text style={[styles.tagSheetTitle, textStyle]}>{t('selectedPost.tagPeople')}</Text>
                  <Text style={[styles.tagSheetSubtitle, textStyle, { opacity: 0.7 }]}>{t('selectedPost.tagPeopleSubtitle')}</Text>
                </View>
                <TouchableOpacity onPress={() => { setTagSearch(''); setUserSuggestions([]); bottomSheetRef.current?.close(); }}>
                  <Text style={[styles.tagSheetDone, { color: themeText }]}>{t('selectedPost.done')}</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.tagSearchBar, { backgroundColor: cardStyle?.backgroundColor || '#fff', borderColor: `${themeText}22` }]}>
                <Icon name="search" size={16} color="#999" style={{ marginRight: 8 }} />
                <TextInput value={tagSearch} onChangeText={setTagSearch} placeholder={t('selectedPost.searchUsers')} placeholderTextColor="#999" autoCapitalize="none" autoCorrect={false} style={[styles.tagSearchInput, textStyle]} />
              </View>

              {selectedTaggedPeople.length > 0 && (
                <View style={styles.tagChipsWrap}>
                  {selectedTaggedPeople.map(username => (
                    <View key={username} style={[styles.tagChip, { backgroundColor: themeText }]}>
                      <Text style={styles.tagChipText}>@{username}</Text>
                      <TouchableOpacity onPress={() => handleRemoveTaggedPerson(username)}><Icon name="close" size={14} color="#fff" /></TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {isSearchingUsers && <Text style={[styles.tagSearchingText, textStyle, { opacity: 0.7 }]}>{t('selectedPost.searching')}</Text>}

              <FlatList
                data={userSuggestions}
                keyExtractor={(item, index) => String(item?._id || item?.id || item?._username || item?.userName || index)}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const username = item?._username;
                  const displayName = String(item?.name || item?.fullName || item?.firstName || '').trim();
                  const avatar = item?.profilePic || item?.avatar || item?.image || item?.photo;
                  return (
                    <TouchableOpacity style={[styles.tagSuggestionRow, { backgroundColor: cardStyle?.backgroundColor || '#fff', borderColor: `${themeText}1f` }]} onPress={() => handleSelectTagUser(item)}>
                      <View style={[styles.tagAvatar, { backgroundColor: `${themeText}66` }]}>
                        {avatar ? <Image source={{ uri: avatar }} style={styles.tagAvatarImg} /> : <Icon name="person" size={18} color="#fff" />}
                      </View>
                      <View style={styles.tagSuggestionTextWrap}>
                        <Text style={[styles.tagSuggestionUsername, textStyle]}>@{username}</Text>
                        {!!displayName && <Text style={[styles.tagSuggestionName, textStyle, { opacity: 0.7 }]} numberOfLines={1}>{displayName}</Text>}
                      </View>
                      <View style={[styles.tagAddPill, { backgroundColor: themeText }]}><Icon name="add" size={16} color="#fff" /></View>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  tagSearch.trim()
                    ? <Text style={[styles.tagEmptyText, textStyle, { opacity: 0.7 }]}>{t('selectedPost.noUsersFound')}</Text>
                    : <Text style={[styles.tagEmptyText, textStyle, { opacity: 0.7 }]}>{t('selectedPost.typeToSearch')}</Text>
                }
                style={{ marginTop: 10 }}
              />
            </View>
          )}
        </View>
      </RBSheet>

      {modalVisible2 && (
        <Modal visible={modalVisible2} animationType="fade" transparent>
          <View style={styles.fullScreenOverlay}>
            <View style={styles.doneView}>
              <TouchableOpacity style={styles.doneBtn} onPress={addTextOverlay}>
                <Text style={styles.doneText}>{t('selectedPost.done')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.editorBox}>
              <TextInput value={text} onChangeText={setText} placeholder="" placeholderTextColor="#ccc" style={[styles.textInput, getTextStyleWithFont(text, selectedFont.fontFamily || selectedFont), { color: textColor, textAlign, backgroundColor: highlightColor }]} multiline />
              {showFonts && <FlatList data={fonts} horizontal keyExtractor={item => item.name} renderItem={({ item }) => <TouchableOpacity onPress={() => setSelectedFont(item.style)} style={styles.fontBtn}><Text style={[{ fontSize: 18, color: '#fff' }, item.style]}>{item.name}</Text></TouchableOpacity>} style={{ marginTop: 20 }} showsHorizontalScrollIndicator={false} />}
              {showColors && <FlatList data={colors} horizontal keyExtractor={(item, index) => index.toString()} renderItem={({ item }) => <TouchableOpacity onPress={() => setTextColor(item)} style={[styles.colorCircle, { backgroundColor: item, borderColor: '#fff' }]} />} style={{ marginTop: 15 }} showsHorizontalScrollIndicator={false} />}
              <View style={styles.actionRow}>
                <TouchableOpacity onPress={() => { setShowFonts(!showFonts); setShowColors(false); }} style={styles.iconBtn}><Feather name="type" size={26} color="#fff" /></TouchableOpacity>
                <TouchableOpacity onPress={() => { setShowColors(!showColors); setShowFonts(false); }} style={styles.iconBtn}><Feather name="circle" size={26} color={textColor} /></TouchableOpacity>
                <TouchableOpacity onPress={() => setTextAlign(textAlign === 'center' ? 'left' : textAlign === 'left' ? 'right' : 'center')} style={styles.iconBtn}><Feather name={textAlign === 'center' ? 'align-center' : textAlign === 'left' ? 'align-left' : 'align-right'} size={26} color="#fff" /></TouchableOpacity>
                <TouchableOpacity onPress={() => setHighlightColor(highlightColor === 'transparent' ? 'black' : highlightColor === 'black' ? 'white' : 'transparent')} style={styles.iconBtn}><MaterialCommunityIcons name="format-color-highlight" size={26} color={highlightColor === 'transparent' ? 'white' : 'black'} /></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      <Modal visible={flipStickerModal} transparent animationType="fade" onRequestClose={() => setFlipStickerModal(false)}>
        <View style={styles.flipStickerModalRoot}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setFlipStickerModal(false)} />
          <View style={[styles.flipModalCard, { backgroundColor: cardStyle?.backgroundColor || '#1a1a1a' }]}>
            <Text style={[styles.flipModalTitle, textStyle]}>{t('selectedPost.toolSticker')}</Text>
            <View style={styles.flipEmojiGrid}>
              {FLIP_EMOJI_STICKERS.map(emoji => <TouchableOpacity key={emoji} style={styles.flipEmojiCell} onPress={() => addStickerEmoji(emoji)}><Text style={styles.flipEmojiText}>{emoji}</Text></TouchableOpacity>)}
            </View>
            <TouchableOpacity onPress={() => setFlipStickerModal(false)} style={styles.flipModalClose}>
              <Text style={{ color: themeText, fontWeight: '600' }}>{t('selectedPost.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={flipAudioModal} transparent animationType="slide" onRequestClose={() => setFlipAudioModal(false)}>
        <View style={styles.flipModalBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setFlipAudioModal(false)} />
          <View style={[styles.flipModalSheet, { backgroundColor: cardStyle?.backgroundColor || '#fff' }]}>
            <Text style={[styles.flipModalTitle, textStyle]}>{t('selectedPost.musicTitle')}</Text>
            <Text style={[styles.flipModalHint, textStyle]}>{t('selectedPost.musicHint')}</Text>
            {!getYoutubeSearchApiKey() ? <Text style={[styles.postMusicApiHint, textStyle]}>{t('selectedPost.musicApiUnavailable')}</Text> : null}
            <TextInput placeholder={t('selectedPost.musicSearchPlaceholder')} placeholderTextColor="#999" style={[styles.postMusicSearchInput, textStyle, { borderColor: `${themeText}33`, color: themeText }]} value={postMusicQuery} onChangeText={setPostMusicQuery} autoCorrect={false} autoCapitalize="none" />
            <FlatList
              style={[styles.postMusicResultsList, { maxHeight: SCREEN_HEIGHT * 0.42 }]}
              keyboardShouldPersistTaps="handled"
              data={postMusicQuery.trim() ? postMusicResults : []}
              keyExtractor={it => String(it.videoId)}
              ListHeaderComponent={
                !postMusicQuery.trim() ? (
                  <View style={styles.postMusicQuickBlock}>
                    <Text style={[styles.postMusicQuickTitle, textStyle]}>{t('selectedPost.quickPicks')}</Text>
                    {POST_SOUNDTRACKS.map(track => {
                      const cur = getCurrentImageEdits();
                      const selected = track.id === 'none' ? (cur.musicSource === 'none' || cur.musicId === 'none') : cur.musicSource === 'builtin' && cur.musicId === track.id;
                      return (
                        <TouchableOpacity key={track.id} style={styles.flipMusicRow} onPress={() => handleSelectPostBuiltinTrack(track)} activeOpacity={0.7}>
                          <Icon name="musical-notes" size={20} color={themeText} />
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={[textStyle, { fontWeight: '600' }]}>{track.title}</Text>
                            <Text style={{ opacity: 0.6, color: '#666' }}>{track.artist}</Text>
                          </View>
                          {selected ? <Icon name="checkmark-circle" size={22} color={themeText} /> : <Icon name="chevron-forward" size={18} color="#999" />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null
              }
              renderItem={({ item: yt }) => {
                const cur = getCurrentImageEdits();
                const selected = cur.musicSource === 'youtube' && cur.musicYoutubeVideoId === yt.videoId;
                return (
                  <TouchableOpacity style={styles.postMusicYtRow} onPress={() => handleSelectPostYoutubeTrack(yt)} activeOpacity={0.7}>
                    {yt.thumbnailUrl ? <Image source={{ uri: yt.thumbnailUrl }} style={styles.postMusicThumb} /> : <View style={[styles.postMusicThumb, styles.postMusicThumbPh]}><Icon name="musical-notes" size={18} color={themeText} /></View>}
                    <View style={styles.postMusicYtText}>
                      <Text style={[textStyle, styles.postMusicYtTitle]} numberOfLines={2}>{yt.title}</Text>
                      <Text style={[styles.postMusicYtSub, textStyle]} numberOfLines={1}>{yt.channelTitle}</Text>
                    </View>
                    {selected ? <Icon name="checkmark-circle" size={22} color={themeText} /> : <Icon name="play-circle-outline" size={24} color={themeText} />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                postMusicQuery.trim() ? (
                  <View style={styles.postMusicEmptyWrap}>
                    {postMusicLoading ? <ActivityIndicator color={themeText} /> : !getYoutubeSearchApiKey() ? <Text style={[styles.postMusicEmptyText, textStyle]}>{t('selectedPost.searchUnavailable')}</Text> : <Text style={[styles.postMusicEmptyText, textStyle]}>{t('selectedPost.noSongsFound')}</Text>}
                  </View>
                ) : null
              }
            />
            <TouchableOpacity onPress={() => setFlipAudioModal(false)} style={styles.flipModalClose}>
              <Text style={{ color: themeText, fontWeight: '600' }}>{t('selectedPost.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <PostStoryMusicTrimModal
        visible={postStorySoundTrimVisible}
        audioSel={postImageEditsToStoryAudioSel(getCurrentImageEdits())}
        lyricsBundle={getCurrentImageEdits().musicLyrics}
        initialTrim={{ start: getCurrentImageEdits().musicTrimStart ?? 0, end: getCurrentImageEdits().musicTrimEnd }}
        onCancel={() => setPostStorySoundTrimVisible(false)}
        onDone={({ start, end }) => { updateCurrentImageEdits({ musicTrimStart: start, musicTrimEnd: end != null && Number.isFinite(end) ? end : null }); setPostStorySoundTrimVisible(false); showToastMessage(toast, 'success', t('selectedPost.musicTrimSaved'), 1500); }}
        onDelete={() => { updateCurrentImageEdits({ musicSource: 'none', musicId: 'none', musicTitle: null, musicArtist: null, musicYoutubeVideoId: null, musicYoutubeThumbUrl: null, musicYoutubeDurationSec: null, musicTrimStart: 0, musicTrimEnd: null, musicLyrics: null, musicBadge: null }); setPostStorySoundTrimVisible(false); showToastMessage(toast, 'success', t('selectedPost.musicRemoved'), 1500); }}
      />

      <Modal visible={flipTrimModal} transparent animationType="fade" onRequestClose={() => setFlipTrimModal(false)}>
        <View style={styles.flipModalBackdrop}>
          <View style={[styles.flipModalCard, { backgroundColor: cardStyle?.backgroundColor || '#fff' }]}>
            <Text style={[styles.flipModalTitle, textStyle]}>{t('selectedPost.editVideoTitle')}</Text>
            <Text style={[styles.flipModalHint, textStyle]}>{t('selectedPost.editVideoHint')}</Text>
            <View style={styles.flipTrimRow}>
              <Text style={textStyle}>{t('selectedPost.trimStart')}</Text>
              <TextInput style={styles.flipTrimInput} value={trimStartInput} onChangeText={setTrimStartInput} keyboardType="decimal-pad" placeholder="0" />
            </View>
            <View style={styles.flipTrimRow}>
              <Text style={textStyle}>{t('selectedPost.trimEnd')}</Text>
              <TextInput style={styles.flipTrimInput} value={trimEndInput} onChangeText={setTrimEndInput} keyboardType="decimal-pad" placeholder={t('selectedPost.trimEndPlaceholder')} />
            </View>
            <TouchableOpacity style={[styles.flipPrimaryBtn, { backgroundColor: themeText }]} onPress={() => { const start = parseFloat(trimStartInput) || 0; const endRaw = trimEndInput.trim(); const end = endRaw === '' ? null : parseFloat(endRaw); updateCurrentImageEdits({ trimStart: start, trimEnd: end }); setFlipTrimModal(false); showToastMessage(toast, 'success', t('selectedPost.trimSaved'), 1500); }}>
              <Text style={styles.flipPrimaryBtnText}>{t('selectedPost.save')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFlipTrimModal(false)} style={styles.flipModalClose}>
              <Text style={{ color: themeText }}>{t('selectedPost.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={flipVolumeModal} transparent animationType="fade" onRequestClose={() => setFlipVolumeModal(false)}>
        <View style={styles.flipModalBackdrop}>
          <View style={[styles.flipModalCard, { backgroundColor: cardStyle?.backgroundColor || '#fff' }]}>
            <Text style={[styles.flipModalTitle, textStyle]}>{t('selectedPost.volumeTitle')}</Text>
            <Text style={[styles.flipModalHint, textStyle]}>{t('selectedPost.volumeHint')}</Text>
            {[0, 0.25, 0.5, 0.75, 1].map(v => (
              <TouchableOpacity key={String(v)} style={styles.flipVolRow} onPress={() => { setFlipVolumeForCurrent(v); setFlipVolumeModal(false); }}>
                <Icon name={v === 0 ? 'volume-mute' : 'volume-high'} size={22} color={themeText} />
                <Text style={[textStyle, { marginLeft: 10, flex: 1 }]}>{v === 0 ? t('selectedPost.mute') : `${Math.round(v * 100)}%`}</Text>
                {(flipVolumeByIndex[currentImageIndex] ?? 1) === v && <Icon name="checkmark-circle" size={22} color={themeText} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setFlipVolumeModal(false)} style={styles.flipModalClose}>
              <Text style={{ color: themeText }}>{t('selectedPost.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={[styles.NextButtonView, isFlipPost && styles.NextButtonViewFlip]}>
        {isFlipPost && isCurrentMediaVideo() && (
          <TouchableOpacity style={styles.flipEditVideoPill} onPress={() => handleFlipToolPress('Edit')} activeOpacity={0.85}>
            <Text style={styles.flipEditVideoPillText}>{t('selectedPost.editVideoTitle')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.nextButton, isFlipPost && styles.nextButtonFlip, { backgroundColor: isFlipPost ? '#2d7ff9' : themeText }]} onPress={handleNext}>
          <Text style={styles.nextButtonText}>{t('selectedPost.next')}</Text>
          <Text style={styles.nextArrow}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, bgStyle]}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
            <Text style={styles.headerButtonText}>×</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.editorWorkspace}>
          {renderFilters()}
          {renderImageCarousel()}
        </View>
        {renderEditingTabs()}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// Add these styles to your existing StyleSheet
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  editorWorkspace: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    padding: 8,
  },
  headerButtonText: {
    color: '#000',
    fontSize: 24,
    fontWeight: 'bold',
  },
  imageContainer: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    justifyContent: 'flex-start',
    alignItems: 'center',
    // paddingHorizontal: 16,
    paddingBottom: 0,
    zIndex: 1,
    elevation: 1,
  },
  /** Host for hidden soundtrack players; sibling of mainImageContainer so overflow:hidden does not clip YouTube. */
  postEditorMusicBgHost: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
    zIndex: 5,
  },
  hiddenPostMusicPlayer: {
    position: 'absolute',
    width: 2,
    height: 2,
    opacity: 0,
    left: 0,
    top: 0,
  },
  hiddenPostYoutubePlayer: {
    position: 'absolute',
    width: 200,
    height: 200,
    opacity: 0.02,
    left: -220,
    top: 0,
    overflow: 'hidden',
  },
  mainImageContainer: {
    width: IMAGE_SIZE,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  mainImageContainerWhileDrawing: {
    overflow: 'visible',
  },
  mainImageContainerSquareDrawing: {
    overflow: 'visible',
  },
  mainScrollView: {
    width: IMAGE_SIZE,
    flex: 1,
  },
  mainScrollContent: {
    alignItems: 'center',
    flexGrow: 1,
  },
  imageSlide: {
    height: "100%",
  },
  mainImage: {
    width: IMAGE_SIZE,
    // height: IMAGE_SIZE,
    height: "100%",
    borderRadius: 8,
  },
  mainImageSquareDrawing: {
    borderRadius: 0,
  },
  videoContainer: {
    width: IMAGE_SIZE,
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    height: "100%",

  },
  videoPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -30 }, { translateY: -30 }],
    zIndex: 1000,
  },
  playButtonBackground: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
  },
  videoIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  videoDuration: {
    color: 'white',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  videoControls: {
    position: 'absolute',
    bottom: 12,
    right: 12,
  },
  muteButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 20,
  },
  imageZoomContainer: {
    width: IMAGE_SIZE,
    height: '100%',
    // backgroundColor: '#000',
  },
  staticImageCanvas: {
    width: IMAGE_SIZE,
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 8,
    // backgroundColor: '#000',
  },
  staticImageCanvasSquareDrawing: {
    overflow: 'visible',
    borderRadius: 0,
  },
  drawingSurface: {
    width: IMAGE_SIZE,
    height: '100%',
    position: 'relative',
    /** Visible overflow so strokeWidth isn’t clipped at edges when tracing a square */
    overflow: 'visible',
    borderRadius: 0,
    // backgroundColor: '#000',
  },
  filterOverlay: {
    borderRadius: 8,
  },
  filterOverlaySquareDrawing: {
    borderRadius: 0,
  },
  activeDrawCanvas: {
    zIndex: 3000,
    elevation: 20,
  },
  overlayImageWrapper: {
    position: 'absolute',
    zIndex: 999,
  },
  overlayTouchTarget: {
    flex: 1,
  },
  overlayImage: {
    width: '100%',
    height: '100%',
    opacity: 0.9,
    resizeMode: 'contain',
    // borderWidth: 2,
    // borderColor: 'rgba(255,255,255,0.55)',
    // borderRadius: 4,
  },
  savedOverlayImage: {
    width: '100%',
    height: '100%',
    opacity: 0.9,
    resizeMode: 'contain',
    borderRadius: 4,
  },
  drawControls: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    gap: 8,
    zIndex: 5001,
    elevation: 50,
  },
  controlButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 20,
    minWidth: 36,
    alignItems: 'center',
  },
  controlButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  colorPalette: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    height: 50,
    zIndex: 5001,
    elevation: 50,
  },
  colorOption: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginHorizontal: 5,
    borderWidth: 2,
    borderColor: 'white',
  },
  activeColorOption: {
    borderWidth: 3,
    borderColor: '#ffff00',
  },
  imageCounter: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageCounterText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  pageIndicator: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  activeDot: {
    backgroundColor: '#fff',
  },
  thumbnailScrollView: {
    marginTop: -2,
    height: 54,
  },
  thumbnail: {
    width: 50,
    height: 50,
    marginRight: 8,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeThumbnail: {
    borderColor: '#fff',

  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    zIndex: 20,
    elevation: 20,
    flexGrow: 0,
  },
  filterOption: {
    alignItems: 'center',
    marginRight: 16,
  },
  filterPreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedFilter: {
    borderColor: '#000',
  },
  filterPreviewImage: {
    width: '100%',
    height: '100%',
  },
  videoFilterPreview: {
    backgroundColor: '#1f1f1f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterName: {
    fontSize: 12,
    marginTop: 4,
    color: '#000',
  },
  editingSection: {
    paddingTop: 4,
    paddingBottom: 4,
    marginTop: -2,
  },
  editingSectionFlip: {
    backgroundColor: '#000',
    paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2a2a2a',
  },
  flipTabScroll: {
    maxHeight: 76,
  },
  flipTabScrollContent: {
    paddingHorizontal: 7,
    paddingVertical: 7,
    alignItems: 'center',
  },
  flipTabButton: {
    alignItems: 'center',
    marginHorizontal: 6,
    minWidth: 41,
  },
  flipTabLabel: {
    color: '#c4c4c4',
    fontSize: 8,
    textAlign: 'center',
    lineHeight: 10,
  },
  flipHeaderOverlay: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    zIndex: 60,
    elevation: 8,
  },
  flipHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flipHeaderTextCol: {
    marginLeft: 10,
    flex: 1,
  },
  flipHeaderTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  flipHeaderSub: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  flipSwipeHint: {
    marginTop: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  flipSwipeHintText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 6,
  },
  flipStickerModalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  flipModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  flipModalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    padding: 18,
  },
  flipModalSheet: {
    width: '100%',
    maxWidth: 400,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    maxHeight: '80%',
    zIndex: 2,
    elevation: 8,
  },
  flipModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  flipModalHint: {
    fontSize: 12,
    opacity: 0.75,
    marginBottom: 12,
  },
  postMusicApiHint: {
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 10,
    lineHeight: 17,
  },
  postMusicSearchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 10,
  },
  postMusicResultsList: {
    marginBottom: 4,
  },
  postMusicQuickBlock: {
    paddingBottom: 4,
  },
  postMusicQuickTitle: {
    fontSize: 13,
    fontWeight: '700',
    opacity: 0.85,
    marginBottom: 6,
  },
  postMusicYtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8e8e8',
  },
  postMusicThumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
    // backgroundColor: '#eee',
  },
  postMusicThumbPh: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  postMusicYtText: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  postMusicYtTitle: {
    fontWeight: '600',
    fontSize: 15,
  },
  postMusicYtSub: {
    fontSize: 13,
    opacity: 0.65,
    marginTop: 2,
  },
  postMusicEmptyWrap: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postMusicEmptyText: {
    fontSize: 14,
    opacity: 0.7,
  },
  postMusicPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  postMusicPresetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(90,45,130,0.12)',
  },
  postMusicPresetChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  flipEmojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  flipEmojiCell: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 6,
  },
  flipEmojiText: {
    fontSize: 32,
  },
  flipModalClose: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 8,
  },
  flipMusicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  flipTrimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  flipTrimInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 120,
    fontSize: 16,
    color: '#111',
  },
  flipPrimaryBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  flipPrimaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  flipVolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  flipEditVideoPill: {
    flex: 1,
    backgroundColor: '#2c2c2e',
    justifyContent: 'center',
    borderRadius: 24,
    marginRight: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  flipEditVideoPillText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 15,
  },
  tabScroll: {
    marginBottom: 12,
    maxHeight: 76,
    flexGrow: 0,
  },
  tabScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tabButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 4,
  },
  tabButtonText: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 2,
  },
  tabContent: {
    padding: 16,
    flex: 1,
  },
  tagSheet: {
    flex: 1,
  },
  tagSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tagSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  tagSheetSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#777',
  },
  tagSheetDone: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5a2d82',
  },
  tagSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  tagSearchInput: {
    flex: 1,
    paddingVertical: 10,
    color: '#000',
    fontSize: 14,
  },
  tagChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5a2d82',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  tagChipText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 6,
  },
  tagSearchingText: {
    marginTop: 10,
    color: '#777',
    fontSize: 12,
  },
  tagSuggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  tagAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  tagAvatarImg: {
    width: '100%',
    height: '100%',
  },
  tagSuggestionTextWrap: {
    flex: 1,
  },
  tagSuggestionUsername: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
  tagSuggestionName: {
    color: '#777',
    fontSize: 12,
    marginTop: 2,
  },
  tagAddPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagEmptyText: {
    marginTop: 16,
    color: '#777',
    fontSize: 13,
    textAlign: 'center',
  },
  overlayControls: {
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#333',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
  },
  doneView: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
  },
  doneBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  doneText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  editorBox: {
    margin: 20,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  textInput: {
    fontSize: 24,
    color: '#fff',
    textAlign: 'center',
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
  },
  fontBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#333',
    marginRight: 8,
    borderRadius: 6,
  },
  colorCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
    borderWidth: 2,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  iconBtn: {
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  NextButtonView: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  NextButtonViewFlip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
  nextButton: {
    // backgroundColor: '#5a2d82',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 8,
  },
  nextButtonFlip: {
    flex: 1,
    borderRadius: 24,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  nextArrow: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  zoomIndicator: {
    position: 'absolute',
    top: 50,
    left: 50,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoomHashPattern: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  hashLine: {
    position: 'absolute',
    backgroundColor: '#fff',
    width: 1,
    height: 20,
  },
  zoomText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  storyTrashZone: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
    left: '36%',
    justifyContent: 'center',
    zIndex: 100,
    paddingBottom: 8,
    paddingTop: 6,
    minHeight: 64,
    width: '28%',
  },
  storyTrashZoneIdle: {
    backgroundColor: 'transparent',
  },
  storyTrashZoneHot: {
    backgroundColor: 'rgba(220, 38, 38, 0.28)',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#dc2626',
  },
  storyTrashIconWrap: {
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  storyTrashIconWrapHot: {
    backgroundColor: '#dc2626',
  },
  storyTrashHint: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.42)',
    letterSpacing: 0.3,
  },
  storyTrashHintActive: {
    color: '#fecaca',
  },
});

export default InstagramPostCreator;
