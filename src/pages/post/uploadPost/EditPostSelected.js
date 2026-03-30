import React, { useState, useRef, useEffect, useMemo } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
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

const fonts = [
  { name: 'saffasbom', style: { fontFamily: 'SAlfaSlabOne-Regularystem' } },
  {
    name: 'bitcount',
    style: { fontFamily: 'BitcountPropSingle_Cursive-Regular' },
  },
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
  '#fff',
  '#ff0000',
  '#00ff00',
  '#0000ff',
  '#ffff00',
  '#ff00ff',
  '#00ffff',
  '#000',
];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_SIZE = SCREEN_WIDTH - 32;

const FLIP_EMOJI_STICKERS = [
  '👏', '🔥', '❤️', '😂', '😍', '✨', '💯', '🎉', '👍', '🙌', '💪', '🎵', '⭐', '🙏', '😎', '🥳', '💬', '🎬',
];

const FLIP_MUSIC_LIBRARY = [
  { id: 'v1', title: 'Chill Beat', artist: 'Valens' },
  { id: 'v2', title: 'Energy Pop', artist: 'Valens' },
  { id: 'v3', title: 'Lo-Fi Dream', artist: 'Valens' },
  { id: 'none', title: 'Original sound only', artist: 'No track' },
];

const InstagramPostCreator = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const routeImages = useMemo(() => route.params?.selectedMedia || [], [route.params?.selectedMedia]);
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
  const canvasRef = useRef(null);
  const mainScrollViewRef = useRef(null);
  const [editingOverlayId, setEditingOverlayId] = useState(null);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);
  const [canvasKey, setCanvasKey] = useState(0);
  const [isOverlayTransforming, setIsOverlayTransforming] = useState(false);
  const [editorCanvasHeight, setEditorCanvasHeight] = useState(IMAGE_SIZE);
  const [tagSearch, setTagSearch] = useState('');
  const [selectedTaggedPeople, setSelectedTaggedPeople] = useState([]);
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const userSearchTimeoutRef = useRef(null);
  const activeSearchRequestIdRef = useRef(0);

  // Video related states
  const [videoPaused, setVideoPaused] = useState({});
  const [videoMuted, setVideoMuted] = useState(true);
  const videoRefs = useRef({});
  const profileAvatarUri = useSelector(state => state.profileImage?.profileImg);
  const [flipUserName, setFlipUserName] = useState('');
  const [flipVolumeByIndex, setFlipVolumeByIndex] = useState({});
  const [flipStickerModal, setFlipStickerModal] = useState(false);
  const [flipAudioModal, setFlipAudioModal] = useState(false);
  const [flipTrimModal, setFlipTrimModal] = useState(false);
  const [flipVolumeModal, setFlipVolumeModal] = useState(false);
  const [trimStartInput, setTrimStartInput] = useState('0');
  const [trimEndInput, setTrimEndInput] = useState('');
  const { bgStyle, textStyle, cardStyle, text: themeText } = useAppTheme();
  const toast = useToast();

  // Add refs for capturing filtered images
  const imageViewRefs = useRef({});
  const drawingSurfaceRefs = useRef({});

  useEffect(() => {
    if (userSearchTimeoutRef.current) {
      clearTimeout(userSearchTimeoutRef.current);
    }

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

        const users = Array.isArray(response?.data?.users) ? response.data.users : [];
        setUserSuggestions(
          users
            .map(user => ({
              ...user,
              _username: String(user?.userName || user?.username || '').trim().replace(/^@+/, ''),
            }))
            .filter(user => user._username && !selectedTaggedPeople.includes(user._username))
            .slice(0, 12),
        );
      } catch (error) {
        if (activeSearchRequestIdRef.current === requestId) {
          setUserSuggestions([]);
        }
      } finally {
        if (activeSearchRequestIdRef.current === requestId) {
          setIsSearchingUsers(false);
        }
      }
    }, 400);

    return () => {
      if (userSearchTimeoutRef.current) {
        clearTimeout(userSearchTimeoutRef.current);
      }
    };
  }, [activeTab, selectedTaggedPeople, tagSearch]);

  const handleSelectTagUser = user => {
    const username = String(user?._username || user?.userName || user?.username || '')
      .trim()
      .replace(/^@+/, '');
    if (!username) return;

    setSelectedTaggedPeople(prev => (prev.includes(username) ? prev : [...prev, username]));
    setTagSearch('');
    setUserSuggestions([]);
  };

  const handleRemoveTaggedPerson = username => {
    setSelectedTaggedPeople(prev => prev.filter(person => person !== username));
  };

  // Store animated values separately to avoid modification issues
  const animatedValues = useRef({});
  const overlayGestureState = useRef({});

  const TEXT_OVERLAY_BOUNDS = {
    minX: 0,
    minY: 0,
    maxX: IMAGE_SIZE - 100,
    maxY: IMAGE_SIZE - 50,
  };

  const getProfile = async () => {
    try {
      const value = await AsyncStorage.getItem('profile');
      console.log(value, 'value in here ');
      setProfile(value);
    } catch (e) {
      console.log(e);
    }
  };

  useEffect(() => {
    getProfile();
  }, []);

  useEffect(() => {
    if (!isFlipPost) return;
    (async () => {
      const u = await AsyncStorage.getItem('userName');
      const d = await AsyncStorage.getItem('displayName');
      setFlipUserName((u || d || '').trim() || 'Creator');
    })();
  }, [isFlipPost]);

  useEffect(() => {
    const currentMedia = selectedImages[currentImageIndex];
    if (!currentMedia) return;
    setEditorCanvasHeight(getCanvasHeightForMedia(currentMedia));
  }, [currentImageIndex, selectedImages]);

  useEffect(() => () => {
    if (zoomTimeout.current) {
      clearTimeout(zoomTimeout.current);
    }
  }, []);
  const IMAGE_OVERLAY_BOUNDS = {
    minX: 0,
    minY: 0,
    maxX: IMAGE_SIZE - 100,
    maxY: IMAGE_SIZE - 100,
  };

  const getMediaKey = (media, index) => {
    return media?.path || media?.uri || media?.sourceURL || `media-${index}`;
  };

  const getCanvasHeightForMedia = (media) => {
    const mediaWidth = Number(media?.width) || IMAGE_SIZE;
    const mediaHeight = Number(media?.height) || IMAGE_SIZE;
    if (!mediaWidth || !mediaHeight) {
      return IMAGE_SIZE;
    }

    return Math.min(450, Math.max(220, (IMAGE_SIZE * mediaHeight) / mediaWidth));
  };

  const getOverlayBounds = (size = 100) => ({
    minX: 0,
    minY: 0,
    maxX: Math.max(0, IMAGE_SIZE - size),
    maxY: Math.max(0, editorCanvasHeight - size),
  });

  const getTextBounds = () => ({
    minX: 0,
    minY: 0,
    maxX: IMAGE_SIZE - 50,  // Changed from IMAGE_SIZE - 140
    maxY: editorCanvasHeight - 50,  // Changed from editorCanvasHeight - 60
  });
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const getTouchDistance = (touches) => {
    if (!touches || touches.length < 2) return 0;
    const [a, b] = touches;
    return Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY);
  };

  const getTouchAngle = (touches) => {
    if (!touches || touches.length < 2) return 0;
    const [a, b] = touches;
    return Math.atan2(b.pageY - a.pageY, b.pageX - a.pageX);
  };

  const getTouchCenter = (touches) => {
    if (!touches || touches.length < 2) return { x: 0, y: 0 };
    const [a, b] = touches;
    return {
      x: (a.pageX + b.pageX) / 2,
      y: (a.pageY + b.pageY) / 2,
    };
  };

  const buildCanvasSource = (uri) => {
    if (!uri) return undefined;
    const normalized = String(uri).replace('file://', '');
    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash === -1) {
      return {
        filename: normalized,
        directory: '',
        mode: 'AspectFill',
      };
    }

    return {
      filename: normalized.slice(lastSlash + 1),
      directory: normalized.slice(0, lastSlash),
      mode: 'AspectFill',
    };
  };

  const handleDownload = async () => {
    try {
      const currentMedia = selectedImages[currentImageIndex];
      if (!currentMedia) {
        showToastMessage(toast, 'danger', 'No media selected');
        return;
      }

      const currentEdits = imageEdits[currentImageIndex] || {};
      const uriToDownload = currentEdits.processedImageUri || currentMedia.path || currentMedia.uri;
      if (!uriToDownload) {
        showToastMessage(toast, 'danger', 'No media URI available');
        return;
      }

      const isVideo = isVideoMedia(currentMedia);
      const filename = getMediaFilename(uriToDownload, currentImageIndex);

      showToastMessage(toast, 'default', 'Download started...', 1000);

      const downloadPath = await downloadMedia(uriToDownload, filename, isVideo, toast);

      showToastMessage(toast, 'success', `Saved: ${filename}`);
      console.log('Download saved to:', downloadPath);
    } catch (error) {
      console.error('Download error:', error);
      // Error toast/alert handled in downloadMedia
    }
  };
  const updateOverlayImageById = (imageIndex, overlayId, updater) => {
    setImageEdits(prev => {
      const imageEdit = prev[imageIndex] || {
        textOverlays: [],
        overlayImages: [],
        filter: 'none',
        drawings: null,
        processedImageUri: null,
      };

      return {
        ...prev,
        [imageIndex]: {
          ...imageEdit,
          overlayImages: imageEdit.overlayImages.map(overlay =>
            overlay.id === overlayId ? updater(overlay) : overlay
          ),
        },
      };
    });
  };

  // Helper function to check if current media is video
  const isCurrentMediaVideo = () => {
    const currentMedia = selectedImages[currentImageIndex];
    return isMediaVideo(currentMedia);
  };

  // Enhanced helper function to check if any media is video
  const isMediaVideo = (media) => {
    if (!media) return false;

    // Check by type first
    if (media.type && media.type.includes('video')) {
      return true;
    }

    // Check by file extension
    const uri = media.uri || media.path;
    if (uri) {
      const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
      return videoExtensions.some(ext => uri.toLowerCase().includes(ext));
    }

    // Check by duration property (videos usually have duration)
    if (media.duration && media.duration > 0) {
      return true;
    }

    return false;
  };

  const pan = useRef(new Animated.ValueXY()).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({ x: pan.x._value, y: pan.y._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    }),
  ).current;

  // Helper function to create new animated values
  const createAnimatedValue = (x = 0, y = 0) => {
    return new Animated.ValueXY({ x, y });
  };

  // Helper function to get or create animated value for overlay
  const getAnimatedValue = (imageIndex, overlayId, initialX = 50, initialY = 50) => {
    const key = `${imageIndex}_${overlayId}`;
    if (!animatedValues.current[key]) {
      animatedValues.current[key] = createAnimatedValue(initialX, initialY);
    }
    return animatedValues.current[key];
  };

  useEffect(() => {
    if (routeImages && routeImages.length > 0) {
      setSelectedImages(routeImages);
      setCurrentImageIndex(0);

      // Initialize edits for each image/video
      const initialEdits = {};
      const initialVideoPaused = {};
      routeImages.forEach((media, index) => {
        initialEdits[index] = {
          textOverlays: [],
          overlayImages: [],
          filter: 'none',
          drawings: null,
          processedImageUri: null,
        };
        // Start all videos paused
        initialVideoPaused[index] = true;
      });
      setImageEdits(initialEdits);
      setVideoPaused(initialVideoPaused);
    }
  }, [routeImages]);

  const getCurrentImageEdits = () => {
    return imageEdits[currentImageIndex] || {
      textOverlays: [],
      overlayImages: [],
      filter: 'none',
      drawings: null,
      processedImageUri: null,
    };
  };

  const updateCurrentImageEdits = (updates) => {
    setImageEdits(prev => ({
      ...prev,
      [currentImageIndex]: {
        ...getCurrentImageEdits(),
        ...updates
      }
    }));
  };

  // Load edits when switching images
  const loadImageEdits = (imageIndex) => {
    const edits = imageEdits[imageIndex] || {
      textOverlays: [],
      overlayImages: [],
      filter: 'none',
      drawings: null,
      processedImageUri: null,
    };

    setSelectedFilter(edits.filter);

    // Clear and reload canvas if drawing mode is active
    if (canvasRef.current && isDrawing) {
      canvasRef.current.clear();
      if (edits.drawings) {
        // You might need to implement a method to restore drawings
      }
    }
  };

  const handleFilterChange = (filterValue) => {
    setSelectedFilter(filterValue);
    updateCurrentImageEdits({ filter: filterValue });
  };

  const captureAndMergeDrawing = async (shouldExitDrawMode = true) => {
    if (!isDrawing || isCurrentMediaVideo() || !canvasRef.current) return;

    try {
      const drawingSurfaceRef = drawingSurfaceRefs.current[currentImageIndex];
      if (!drawingSurfaceRef) {
        throw new Error('Drawing surface not ready');
      }

      const mergedUri = await captureRef(drawingSurfaceRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      updateCurrentImageEdits({
        processedImageUri: mergedUri,
        drawings: mergedUri,
      });

      // Clear canvas after save completes
      if (canvasRef.current) {
        canvasRef.current.clear();
      }

      if (shouldExitDrawMode) {
        setIsDrawing(false);
        setIsScrollEnabled(true);
        setActiveTab('null');
        setCanvasKey(prev => prev + 1);
      }
    } catch (err) {
      console.error('Drawing save error:', err);
      Alert.alert('Error', 'Failed to save drawing.');
    }
  };
  const handleImageChange = async (newIndex) => {
    if (newIndex === currentImageIndex) return;

    // Auto-merge current drawing before switching
    if (isDrawing) {
      await captureAndMergeDrawing(false); // false = don't exit draw mode yet
    }

    setCurrentImageIndex(newIndex);
    loadImageEdits(newIndex);
    setCanvasKey(prev => prev + 1);
    if (isDrawing) {
      setCanvasKey(prev => prev + 1);
    }

    // Re-enter draw mode if user was drawing
    if (isDrawing) {
      setIsDrawing(true);
      setIsScrollEnabled(false);

    }
  };

  // Function to capture filtered image
  const captureFilteredImage = async (imageIndex) => {
    try {
      const viewRef = imageViewRefs.current[imageIndex];
      if (!viewRef) {
        console.log('No view ref found for image index:', imageIndex);
        return null;
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const uri = await captureRef(viewRef, {
        format: 'png',
        quality: 0.8,
        result: 'tmpfile',
      });

      console.log('Successfully captured filtered image:', uri);
      return uri;
    } catch (error) {
      console.log('Error capturing filtered image for index', imageIndex, ':', error.message);
      return null;
    }
  };


  const renderFilters = () => {
    if (!showFilters) return null;

    const currentEdits = getCurrentImageEdits();
    const imageUri = selectedImages[currentImageIndex]?.path || selectedImages[currentImageIndex]?.uri;
    const currentMediaIsVideo = isCurrentMediaVideo();

    // List of filter names (we'll show names + simple preview style instead of live filter)
    const filterPreviews = [
      { name: 'Original', value: 'none' },
      { name: 'Grayscale', value: 'grayscale' },
      { name: 'Sepia', value: 'sepia' },
      { name: 'Saturate', value: 'saturate' },
      { name: 'Contrast', value: 'contrast' },
      { name: 'Brightness', value: 'brightness' },
    ];

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
      >
        {filterPreviews.map((filter) => (
          <TouchableOpacity
            key={filter.value}
            onPress={() => handleFilterChange(filter.value)}
            style={styles.filterOption}
          >
            <View
              style={[
                styles.filterPreview,
                currentEdits.filter === filter.value && styles.selectedFilter,
              ]}
            >
              {currentMediaIsVideo ? (
                <View style={[styles.filterPreviewImage, styles.videoFilterPreview]}>
                  <Icon name="videocam" size={18} color="#fff" />
                </View>
              ) : (
                <Image
                  source={{ uri: imageUri }}
                  style={styles.filterPreviewImage}
                />
              )}
              {/* Visual indicator overlay for each filter */}
              <View style={[
                StyleSheet.absoluteFillObject,
                {
                  backgroundColor:
                    filter.value === 'grayscale' ? 'rgba(0,0,0,0.4)' :
                      filter.value === 'sepia' ? 'rgba(148, 175, 227, 0.3)' :
                        filter.value === 'saturate' ? 'rgba(255,0,255,0.1)' :
                          filter.value === 'contrast' ? 'rgba(0,0,0,0.3)' :
                            filter.value === 'brightness' ? 'rgba(255,255,255,0.3)' :
                              'transparent',
                },
              ]} />
            </View>
            <Text style={[styles.filterName, { color: '#000000' }]}>
              {filter.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  // Enhanced video play/pause handlerF
  const handleVideoPress = (index) => {
    setVideoPaused(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const addOverlayImage = () => {
    ImagePicker.openPicker({
      mediaType: 'photo',
      cropping: false,
      multiple: true,
    })
      .then(images => {
        if (!images || !Array.isArray(images)) {
          console.warn('Expected array of images, got:', images);
          return;
        }
        const overlays = images
          .map(img => {
            if (!img || !img.path) return null;
            const overlayId = Date.now().toString() + Math.random();
            return {
              id: overlayId,
              uri: img.path,
              position: { x: 50, y: 50 },
              scale: 1,
              rotation: 0,
              baseSize: 100,
            };
          })
          .filter(Boolean);

        const currentEdits = getCurrentImageEdits();
        updateCurrentImageEdits({
          overlayImages: [...currentEdits.overlayImages, ...overlays]
        });
      })
      .catch(error => console.log('Overlay image pick error:', error));
  };

  const createPanResponder = (id) => {
    const imageIndex = currentImageIndex;
    const currentEdits = imageEdits[imageIndex] || getCurrentImageEdits();
    const target = currentEdits.overlayImages.find(o => o.id === id);
    if (!target) {
      return PanResponder.create({ onStartShouldSetPanResponder: () => false });
    }

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        const currentOverlay = (imageEdits[imageIndex] || getCurrentImageEdits())
          .overlayImages
          .find(o => o.id === id) || target;

        overlayGestureState.current[id] = {
          mode: touches.length >= 2 ? 'transform' : 'drag',
          startPosition: { ...(currentOverlay.position || { x: 50, y: 50 }) },
          startScale: currentOverlay.scale || 1,
          startRotation: currentOverlay.rotation || 0,
          startDistance: getTouchDistance(touches),
          startAngle: getTouchAngle(touches),
          startCenter: getTouchCenter(touches),
        };

        setIsOverlayTransforming(true);
        setIsScrollEnabled(false);
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        const session = overlayGestureState.current[id];
        if (!session) return;
        const overlayBounds = getOverlayBounds(target.baseSize || 100);

        if (touches.length >= 2) {
          if (session.mode !== 'transform') {
            const currentOverlay = (imageEdits[imageIndex] || getCurrentImageEdits())
              .overlayImages
              .find(o => o.id === id) || target;

            session.mode = 'transform';
            session.startPosition = { ...(currentOverlay.position || { x: 50, y: 50 }) };
            session.startScale = currentOverlay.scale || 1;
            session.startRotation = currentOverlay.rotation || 0;
            session.startDistance = getTouchDistance(touches);
            session.startAngle = getTouchAngle(touches);
            session.startCenter = getTouchCenter(touches);
          }

          const distance = getTouchDistance(touches);
          const angle = getTouchAngle(touches);
          const center = getTouchCenter(touches);
          const scaleRatio = session.startDistance > 0 ? distance / session.startDistance : 1;

          updateOverlayImageById(imageIndex, id, overlay => ({
            ...overlay,
            position: {
              x: clamp(
                session.startPosition.x + (center.x - session.startCenter.x),
                overlayBounds.minX,
                overlayBounds.maxX,
              ),
              y: clamp(
                session.startPosition.y + (center.y - session.startCenter.y),
                overlayBounds.minY,
                overlayBounds.maxY,
              ),
            },
            scale: clamp(session.startScale * scaleRatio, 0.35, 4),
            rotation: session.startRotation + (angle - session.startAngle),
          }));
          return;
        }

        if (session.mode !== 'drag') {
          const currentOverlay = (imageEdits[imageIndex] || getCurrentImageEdits())
            .overlayImages
            .find(o => o.id === id) || target;
          session.mode = 'drag';
          session.startPosition = { ...(currentOverlay.position || { x: 50, y: 50 }) };
        }

        updateOverlayImageById(imageIndex, id, overlay => ({
          ...overlay,
          position: {
            x: clamp(
              session.startPosition.x + gestureState.dx,
              overlayBounds.minX,
              overlayBounds.maxX,
            ),
            y: clamp(
              session.startPosition.y + gestureState.dy,
              overlayBounds.minY,
              overlayBounds.maxY,
            ),
          },
        }));
      },
      onPanResponderRelease: () => {
        delete overlayGestureState.current[id];
        setIsOverlayTransforming(false);
        setIsScrollEnabled(true);
      },
      onPanResponderTerminate: () => {
        delete overlayGestureState.current[id];
        setIsOverlayTransforming(false);
        setIsScrollEnabled(true);
      },
    });
  };

  const createTextPanResponder = (id) => {
    const currentEdits = getCurrentImageEdits();
    const overlay = currentEdits.textOverlays.find(o => o.id === id);
    if (!overlay) {
      return PanResponder.create({ onStartShouldSetPanResponder: () => false });
    }

    const animatedPosition = getAnimatedValue(currentImageIndex, id, overlay.position.x, overlay.position.y);

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gs) => {
        return Math.abs(gs.dx) > 2 || Math.abs(gs.dy) > 2;
      },
      onPanResponderGrant: () => {
        setIsScrollEnabled(false);
        animatedPosition.setOffset({
          x: animatedPosition.x._value,
          y: animatedPosition.y._value,
        });
        animatedPosition.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: animatedPosition.x, dy: animatedPosition.y }],
        {
          useNativeDriver: false,
          // REMOVED the listener that was clamping values during drag
        }
      ),
      onPanResponderRelease: (evt, gestureState) => {
        setIsScrollEnabled(true);
        animatedPosition.flattenOffset();

        // Get the final position
        const finalX = animatedPosition.x._value;
        const finalY = animatedPosition.y._value;

        // Apply boundaries only on release
        const boundedX = Math.max(0, Math.min(IMAGE_SIZE - 50, finalX));
        const boundedY = Math.max(0, Math.min(editorCanvasHeight - 50, finalY));

        // Update the position
        const currentEdits = getCurrentImageEdits();
        const updatedOverlays = currentEdits.textOverlays.map(textOverlay => {
          if (textOverlay.id === id) {
            return {
              ...textOverlay,
              position: {
                x: boundedX,
                y: boundedY,
              }
            };
          }
          return textOverlay;
        });
        updateCurrentImageEdits({ textOverlays: updatedOverlays });
      },
      onPanResponderTerminate: () => {
        setIsScrollEnabled(true);
      },
    });
  };

  const filterOptions = [
    { name: 'Original', value: 'none', component: React.Fragment },
    { name: 'Grayscale', value: 'grayscale', component: Grayscale },
    { name: 'Sepia', value: 'sepia', component: Sepia },
    {
      name: 'Saturate',
      value: 'saturate',
      component: props => <Saturate amount={2} {...props} />,
    },
    {
      name: 'Contrast',
      value: 'contrast',
      component: props => <Contrast amount={2} {...props} />,
    },
    {
      name: 'Brightness',
      value: 'brightness',
      component: props => <Brightness amount={1.5} {...props} />,
    },
  ];

  const handleZoomStart = () => {
    setIsZooming(true);
    setShowZoomIndicator(true);
    Animated.timing(zoomIndicatorOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleZoomEnd = () => {
    setIsZooming(false);
    if (zoomTimeout.current) {
      clearTimeout(zoomTimeout.current);
    }
    zoomTimeout.current = setTimeout(() => {
      Animated.timing(zoomIndicatorOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setShowZoomIndicator(false);
      });
    }, 1000);
  };

  const handleZoomChange = scale => {
    setZoomLevel(scale);
    if (!showZoomIndicator) {
      setShowZoomIndicator(true);
      Animated.timing(zoomIndicatorOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  const addTextOverlay = () => {
    if (!text || text.trim() === '') {
      if (editingOverlayId) {
        const currentEdits = getCurrentImageEdits();
        updateCurrentImageEdits({
          textOverlays: currentEdits.textOverlays.filter(o => o.id !== editingOverlayId)
        });
        setEditingOverlayId(null);
      }
      setText('');
      setModalVisible2(false);
      return;
    }

    const currentEdits = getCurrentImageEdits();

    if (editingOverlayId) {
      updateCurrentImageEdits({
        textOverlays: currentEdits.textOverlays.map(o =>
          o.id === editingOverlayId
            ? {
              ...o,
              text,
              color: textColor,
              fontFamily: selectedFont.fontFamily || selectedFont,
              textAlign,
              highlightColor,
            }
            : o,
        )
      });
      setEditingOverlayId(null);
    } else {
      const { x, y } = pan.__getValue();
      const textBounds = getTextBounds();
      const boundedX = Math.max(
        textBounds.minX,
        Math.min(textBounds.maxX, x),
      );
      const boundedY = Math.max(
        textBounds.minY,
        Math.min(textBounds.maxY, y),
      );

      const newId = Date.now().toString() + Math.random();
      const newOverlay = {
        id: newId,
        text,
        fontSize: 28,
        color: textColor,
        fontFamily: selectedFont.fontFamily || selectedFont,
        textAlign,
        highlightColor,
        // Store position as plain object
        position: { x: boundedX, y: boundedY },
      };

      updateCurrentImageEdits({
        textOverlays: [...currentEdits.textOverlays, newOverlay]
      });
    }

    pan.setValue({ x: 0, y: 0 });
    pan.setOffset({ x: 0, y: 0 });
    setText('');
    setModalVisible2(false);
  };

  const pickImages = () => {
    ImagePicker.openPicker({
      multiple: true,
      mediaType: 'any', // Allow both photos and videos
      maxFiles: 10,
      quality: 0.8,
    })
      .then(images => {
        setSelectedImages(images);
        setCurrentImageIndex(0);

        // Clear existing animated values
        animatedValues.current = {};

        // Initialize edits and video states for new images
        const initialEdits = {};
        const initialVideoPaused = {};
        images.forEach((_, index) => {
          initialEdits[index] = {
            textOverlays: [],
            overlayImages: [],
            filter: 'none',
            drawings: null,
            processedImageUri: null,
          };
          initialVideoPaused[index] = true;
        });
        setImageEdits(initialEdits);
        setVideoPaused(initialVideoPaused);
      })
      .catch(error => {
        console.log('Image picker error:', error);
      });
  };

  /** Append more photos/videos (Instagram-style “Add clip”) */
  const addMoreClips = () => {
    ImagePicker.openPicker({
      multiple: true,
      mediaType: 'any',
      maxFiles: 10,
      quality: 0.8,
    })
      .then(newItems => {
        if (!newItems?.length) return;
        setSelectedImages(prev => {
          const start = prev.length;
          const merged = [...prev, ...newItems];
          setImageEdits(prevEdits => {
            const next = { ...prevEdits };
            newItems.forEach((_, i) => {
              next[start + i] = {
                textOverlays: [],
                overlayImages: [],
                filter: 'none',
                drawings: null,
                processedImageUri: null,
              };
            });
            return next;
          });
          setVideoPaused(prevPause => {
            const next = { ...prevPause };
            newItems.forEach((_, i) => {
              next[start + i] = true;
            });
            return next;
          });
          return merged;
        });
        showToastMessage(toast, 'success', 'Clips added', 1500);
      })
      .catch(() => {});
  };

  const addStickerEmoji = emoji => {
    const id = `${Date.now()}_${Math.random()}`;
    const ch = editorCanvasHeight || IMAGE_SIZE;
    const newOverlay = {
      id,
      text: emoji,
      fontSize: 52,
      color: '#fff',
      fontFamily: 'System',
      textAlign: 'center',
      position: { x: Math.max(16, IMAGE_SIZE / 2 - 28), y: Math.max(16, ch / 2 - 28) },
      highlightColor: 'transparent',
    };
    const cur = getCurrentImageEdits();
    updateCurrentImageEdits({ textOverlays: [...(cur.textOverlays || []), newOverlay] });
    setFlipStickerModal(false);
    showToastMessage(toast, 'success', 'Sticker added — drag to place', 1500);
  };

  const setFlipVolumeForCurrent = vol => {
    const v = Math.min(1, Math.max(0, vol));
    setFlipVolumeByIndex(prev => ({ ...prev, [currentImageIndex]: v }));
  };

  const removeOverlay = (id) => {
    const currentEdits = getCurrentImageEdits();
    updateCurrentImageEdits({
      overlayImages: currentEdits.overlayImages.filter(img => img.id !== id)
    });

    // Clean up animated value
    const key = `${currentImageIndex}_${id}`;
    if (animatedValues.current[key]) {
      delete animatedValues.current[key];
    }
  };

  const removeTextOverlay = (id) => {
    const currentEdits = getCurrentImageEdits();
    updateCurrentImageEdits({
      textOverlays: currentEdits.textOverlays.filter(overlay => overlay.id !== id)
    });

    // Clean up animated value
    const key = `${currentImageIndex}_${id}`;
    if (animatedValues.current[key]) {
      delete animatedValues.current[key];
    }
  };

  const handleNext = async () => {
    if (isDrawing) {
      await captureAndMergeDrawing(false);
    }
    try {
      const processedImages = await Promise.all(
        selectedImages.map(async (image, index) => {
          const edits = imageEdits[index] || {
            textOverlays: [],
            overlayImages: [],
            filter: 'none',
            drawings: null,
            processedImageUri: null,
          };
          let processedUri = edits.processedImageUri || image.path || image.uri;
          const isVideo = isMediaVideo(image);
          const hasEdits =
            edits.textOverlays.length > 0 ||
            edits.overlayImages.length > 0 ||
            edits.drawings ||
            edits.processedImageUri ||
            (edits.filter && edits.filter !== 'none');

          if (!isVideo && hasEdits) {
            try {
              const containerRef = imageViewRefs.current[index];

              if (containerRef) {
                const uri = await captureRef(containerRef, {
                  format: 'jpg',
                  quality: 0.8,
                  result: 'tmpfile',
                });
                processedUri = uri;
              } else {
                console.warn(`No ref found for image ${index}, using original`);
              }
            } catch (captureError) {
              console.log('Error capturing image with overlays:', captureError);
            }
          }

          return {
            ...image,
            originalUri: image.path || image.uri,
            processedUri: processedUri,
            filter: edits.filter,
            isVideo: isVideo,
            trimStart: edits.trimStart,
            trimEnd: edits.trimEnd,
            musicId: edits.musicId,
            musicTitle: edits.musicTitle,
            flipVolume: flipVolumeByIndex[index] ?? 1,
            // Convert to plain objects for serialization
            textOverlays: edits.textOverlays.map(overlay => ({
              ...overlay,
              position: overlay.position || { x: 0, y: 0 }
            })),
            overlayImages: edits.overlayImages.map(overlay => ({
              ...overlay,
              position: overlay.position || { x: 0, y: 0 }
            })),
            drawings: edits.drawings,
            imageIndex: index
          };
        })
      );

      console.log('Successfully processed images/videos with overlays', processedImages);

      navigation.navigate('PostEditor', {
        images: processedImages,
        imageEdits: imageEdits,
        postType: postType,
        fromIcon: fromIcon,
        taggedPeople: selectedTaggedPeople,
      });

    } catch (error) {
      console.log('Error processing images:', error);
      Alert.alert(
        'Processing Error',
        'Some edits may not be applied. Continue anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: () => {
              const fallbackImages = selectedImages.map((image, index) => {
                const edits = imageEdits[index] || {
                  textOverlays: [],
                  overlayImages: [],
                  filter: 'none',
                  drawings: null,
                  processedImageUri: null,
                };

                return {
                  ...image,
                  originalUri: image.path || image.uri,
                  processedUri: edits.processedImageUri || image.path || image.uri,
                  filter: edits.filter,
                  isVideo: isMediaVideo(image),
                  trimStart: edits.trimStart,
                  trimEnd: edits.trimEnd,
                  musicId: edits.musicId,
                  musicTitle: edits.musicTitle,
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
                  imageIndex: index
                };
              });

              navigation.navigate('PostEditor', {
                images: fallbackImages,
                imageEdits: imageEdits,
                postType: postType,
                fromIcon: fromIcon,
                taggedPeople: selectedTaggedPeople,
              });
            }
          }
        ]
      );
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const TabButton = ({ title, isActive, icon, onPress, disabled = false }) => (
    <TouchableOpacity
      style={[styles.tabButton, disabled && styles.disabledTabButton]}
      onPress={onPress}
      disabled={disabled}
    >
      <Icon name={icon} size={15} color={disabled ? '#555' : '#aaa'} style={{ marginBottom: 2 }} />
      <Text style={[styles.tabButtonText, disabled && styles.disabledTabButtonText]}>{title}</Text>
    </TouchableOpacity>
  );

  const renderZoomIndicator = () => {
    if (!showZoomIndicator) return null;

    return (
      <Animated.View
        style={[
          styles.zoomIndicator,
          {
            opacity: zoomIndicatorOpacity,
          },
        ]}
      >
        <View style={styles.zoomHashPattern}>
          {Array.from({ length: 9 }).map((_, index) => (
            <View key={index} style={styles.hashLine} />
          ))}
        </View>
        <Text style={styles.zoomText}>{Math.round(zoomLevel * 100)}%</Text>
      </Animated.View>
    );
  };

  const renderImageCarousel = () => {
    const currentEdits = getCurrentImageEdits();
    const currentCanvasHeight = getCanvasHeightForMedia(selectedImages[currentImageIndex]);
    const FilterComponent =
      filterOptions.find(f => f.value === selectedFilter)?.component ||
      React.Fragment;

    const handleMainImageScroll = async (event) => {
      const { contentOffset, layoutMeasurement } = event.nativeEvent;
      const newIndex = Math.round(contentOffset.x / layoutMeasurement.width);
      if (newIndex !== currentImageIndex && newIndex >= 0 && newIndex < selectedImages.length) {
        await handleImageChange(newIndex);
      }
    };

    const scrollToImage = async (index) => {
      await handleImageChange(index);
      if (mainScrollViewRef.current) {
        mainScrollViewRef.current.scrollTo({
          x: index * IMAGE_SIZE,
          animated: true,
        });
      }
    };

    return (
      <View style={styles.imageContainer}>
        {isFlipPost && selectedImages.length > 0 && (
          <View style={styles.flipHeaderOverlay} pointerEvents="box-none">
            <View style={styles.flipHeaderRow}>
              <HexAvatar
                uri={profileAvatarUri}
                size={38}
                borderWidth={2}
                borderColor="rgba(255,255,255,0.9)"
              />
              <View style={styles.flipHeaderTextCol}>
                <Text style={styles.flipHeaderTitle}>Your Drops</Text>
                <Text style={styles.flipHeaderSub} numberOfLines={1}>
                  {flipUserName || ' '}
                </Text>
              </View>
            </View>
            <View style={styles.flipSwipeHint}>
              <Icon name="chevron-up" size={16} color="rgba(255,255,255,0.9)" />
              <Text style={styles.flipSwipeHintText}>Swipe up to edit</Text>
            </View>
          </View>
        )}
        {selectedImages.length > 0 ? (
          <View style={[styles.mainImageContainer, { height: currentCanvasHeight }]}>
            <ScrollView
              ref={mainScrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleMainImageScroll}
              scrollEventThrottle={16}
              style={[styles.mainScrollView, { height: currentCanvasHeight }]}
              contentContainerStyle={[styles.mainScrollContent, { height: currentCanvasHeight }]}
              scrollEnabled={isScrollEnabled}   // ← THIS LINE
            >
              {selectedImages.map((image, index) => (
                <View
                  key={getMediaKey(image, index)}
                  style={[styles.imageSlide, { width: IMAGE_SIZE, height: currentCanvasHeight }]}
                >
                  <View
                    ref={ref => {
                      if (ref) {
                        imageViewRefs.current[index] = ref;
                      }
                    }}
                    onLayout={(event) => {
                      const { height } = event.nativeEvent.layout;
                      if (height > 0 && index === currentImageIndex && Math.abs(height - editorCanvasHeight) > 1) {
                        setEditorCanvasHeight(height);
                      }
                    }}
                    style={{
                      width: IMAGE_SIZE,
                      height: currentCanvasHeight,
                      position: 'relative'
                    }}
                    collapsable={false}
                  >
                    {isMediaVideo(image) ? (
                      // Enhanced Video Player with better controls
                      <View style={styles.videoContainer}>
                        <Video
                          ref={ref => {
                            if (ref) {
                              videoRefs.current[index] = ref;
                            }
                          }}
                          source={{ uri: image.path || image.uri }}
                          style={styles.mainImage}
                          resizeMode='cover'
                          paused={videoPaused[index] !== false}
                          muted={
                            isFlipPost
                              ? (flipVolumeByIndex[index] ?? 1) === 0
                              : videoMuted
                          }
                          volume={isFlipPost ? (flipVolumeByIndex[index] ?? 1) : 1}
                          repeat={true}
                          onLoad={(data) => {
                            console.log('Video loaded for index:', index, 'Duration:', data.duration);
                          }}
                          onError={(error) => console.log('Video error:', error)}
                          poster={image.thumbnail || undefined} // Show thumbnail if available
                        />

                        {/* Enhanced Play/Pause Button Overlay */}
                        <TouchableOpacity
                          style={styles.videoPlayButton}
                          onPress={() => handleVideoPress(index)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.playButtonBackground}>
                            <Icon
                              name={videoPaused[index] !== false ? 'play' : 'pause'}
                              size={40}
                              color="white"
                            />
                          </View>
                        </TouchableOpacity>

                        {/* Video indicator with duration if available */}
                        <View style={styles.videoIndicator}>
                          <Icon name="videocam" size={16} color="white" />
                          {image.duration && (
                            <Text style={styles.videoDuration}>
                              {Math.floor(image.duration / 1000)}s
                            </Text>
                          )}
                        </View>

                        {/* Video controls overlay */}
                        <View style={styles.videoControls}>
                          <TouchableOpacity
                            style={styles.muteButton}
                            onPress={() => {
                              if (isFlipPost) {
                                const v = flipVolumeByIndex[index] ?? 1;
                                setFlipVolumeByIndex(prev => ({
                                  ...prev,
                                  [index]: v === 0 ? 1 : 0,
                                }));
                              } else {
                                setVideoMuted(!videoMuted);
                              }
                            }}
                          >
                            <Icon
                              name={
                                isFlipPost
                                  ? (flipVolumeByIndex[index] ?? 1) === 0
                                    ? 'volume-mute'
                                    : 'volume-high'
                                  : videoMuted
                                    ? 'volume-mute'
                                    : 'volume-high'
                              }
                              size={20}
                              color="white"
                            />
                          </TouchableOpacity>
                        </View>

                        {selectedFilter !== 'none' && index === currentImageIndex && (
                          <View
                            pointerEvents="none"
                            style={[
                              StyleSheet.absoluteFillObject,
                              {
                                backgroundColor:
                                  selectedFilter === 'grayscale' ? 'rgba(0,0,0,0.6)' :
                                    selectedFilter === 'sepia' ? 'rgba(140, 171, 225, 0.4)' :
                                      selectedFilter === 'saturate' ? 'rgba(255,100,255,0.15)' :
                                        selectedFilter === 'contrast' ? 'rgba(0,0,0,0.35)' :
                                          selectedFilter === 'brightness' ? 'rgba(255,255,255,0.35)' :
                                            'transparent',
                              }
                            ]}
                          />
                        )}
                      </View>
                    ) : isDrawing && index === currentImageIndex ? (
                      <View
                        ref={ref => {
                          if (ref) {
                            drawingSurfaceRefs.current[index] = ref;
                          }
                        }}
                        collapsable={false}
                        style={styles.drawingSurface}
                      >
                        <View style={styles.staticImageCanvas}>
                          {(() => {
                            const slideEdits = imageEdits[index] || {};
                            const currentImageUri =
                              slideEdits.processedImageUri ||
                              image.path ||
                              image.uri;

                            return (
                              <Image
                                source={{ uri: currentImageUri }}
                                style={styles.mainImage}
                                resizeMode='cover'
                              />
                            );
                          })()}

                          {selectedFilter !== 'none' && (
                            <View
                              pointerEvents="none"
                              style={[
                                StyleSheet.absoluteFillObject,
                                styles.filterOverlay,
                                {
                                  backgroundColor:
                                    selectedFilter === 'grayscale' ? 'rgba(0,0,0,0.6)' :
                                      selectedFilter === 'sepia' ? 'rgba(140, 171, 225, 0.4)' :
                                        selectedFilter === 'saturate' ? 'rgba(255,100,255,0.15)' :
                                          selectedFilter === 'contrast' ? 'rgba(0,0,0,0.35)' :
                                            selectedFilter === 'brightness' ? 'rgba(255,255,255,0.35)' :
                                              'transparent',
                                }
                              ]}
                            />
                          )}
                        </View>

                        <SketchCanvas
                          key={`canvas-${currentImageIndex}-${canvasKey}`}
                          ref={canvasRef}
                          style={[StyleSheet.absoluteFill, styles.activeDrawCanvas]}
                          strokeColor={drawColor}
                          strokeWidth={5}
                          touchEnabled={true}
                          pointerEvents="auto"
                        />
                      </View>
                    ) : (
                      // Image with zoom functionality
                      <ImageZoom
                        {...(!isDrawing && !isOverlayTransforming ? panResponder.panHandlers : {})}
                        cropWidth={IMAGE_SIZE}
                        cropHeight={currentCanvasHeight}
                        imageWidth={IMAGE_SIZE}
                        imageHeight={currentCanvasHeight}
                        enableImageZoom={!isDrawing && !isOverlayTransforming}
                        minScale={0.5}
                        maxScale={4}
                        pinchToZoom={!isDrawing && !isOverlayTransforming}
                        enableDoubleClickZoom={!isDrawing && !isOverlayTransforming}
                        doubleClickInterval={175}
                        style={styles.imageZoomContainer}
                        onStartShouldSetPanResponder={evt => {
                          if (isDrawing) return false;
                          return (
                            evt.nativeEvent.target._owner?.memoizedProps?.testID !== 'overlay-element'
                          );
                        }}
                        onMoveShouldSetPanResponder={evt => {
                          if (isDrawing) return false;
                          return (
                            evt.nativeEvent.target._owner?.memoizedProps?.testID !== 'overlay-element'
                          );
                        }}
                        onPanResponderGrant={handleZoomStart}
                        onPanResponderRelease={handleZoomEnd}
                        onMove={({ scale }) => handleZoomChange(scale)}
                      >
                        <View style={styles.staticImageCanvas}>
                          {/* Use processedImageUri if drawing was saved, otherwise original */}
                          {(() => {
                            const slideEdits = imageEdits[index] || {};
                            const currentImageUri =
                              slideEdits.processedImageUri ||
                              image.path ||
                              image.uri;

                            return (
                              <Image
                                source={{ uri: currentImageUri }}
                                style={styles.mainImage}
                                resizeMode='cover'
                              />
                            );
                          })()}

                          {/* Fake filter overlay (your current visual effect) */}
                          {selectedFilter !== 'none' && (
                            <View
                              pointerEvents="none"
                              style={[
                                StyleSheet.absoluteFillObject,
                                styles.filterOverlay,
                                {
                                  backgroundColor:
                                    selectedFilter === 'grayscale' ? 'rgba(0,0,0,0.6)' :
                                      selectedFilter === 'sepia' ? 'rgba(140, 171, 225, 0.4)' :
                                        selectedFilter === 'saturate' ? 'rgba(255,100,255,0.15)' :
                                          selectedFilter === 'contrast' ? 'rgba(0,0,0,0.35)' :
                                            selectedFilter === 'brightness' ? 'rgba(255,255,255,0.35)' :
                                              'transparent',
                                }
                              ]}
                            />
                          )}
                        </View>
                      </ImageZoom>
                    )}

                    {index === currentImageIndex && (
                      <>
                        {currentEdits.overlayImages.map(img => {
                          const panResponder = createPanResponder(img.id);
                          return (
                            <View
                              key={img.id}
                              {...panResponder.panHandlers}
                              testID="overlay-element"
                              style={[
                                styles.overlayImageWrapper,
                                {
                                  left: img.position?.x || 0,
                                  top: img.position?.y || 0,
                                  width: img.baseSize || 100,
                                  height: img.baseSize || 100,
                                  transform: [
                                    { scale: img.scale || 1 },
                                    { rotate: `${img.rotation || 0}rad` },
                                  ],
                                },
                              ]}
                            >
                              <TouchableOpacity
                                onLongPress={() => removeOverlay(img.id)}
                                activeOpacity={1}
                                style={styles.overlayTouchTarget}
                              >
                                <Image
                                  source={{ uri: img.uri }}
                                  style={styles.overlayImage}
                                />
                              </TouchableOpacity>
                            </View>
                          );
                        })}

                        {/* Text Overlays */}
                        {currentEdits.textOverlays.map(overlay => {
                          const responder = createTextPanResponder(overlay.id);
                          const animatedPosition = getAnimatedValue(currentImageIndex, overlay.id, overlay.position.x, overlay.position.y);
                          return (
                            <Animated.View
                              key={overlay.id}
                              {...responder.panHandlers}
                              testID="overlay-element"
                              style={[
                                animatedPosition.getLayout(),
                                {
                                  position: 'absolute',
                                  zIndex: 1000,
                                  transform: [{ scale: 1 }],
                                },
                              ]}
                            >
                              <TouchableOpacity
                                onLongPress={() => removeTextOverlay(overlay.id)}
                                onPress={() => {
                                  setEditingOverlayId(overlay.id);
                                  setText(overlay.text);
                                  setTextColor(overlay.color);
                                  setHighlightColor(overlay.highlightColor);
                                  setTextAlign(overlay.textAlign);
                                  setSelectedFont({ fontFamily: overlay.fontFamily });
                                  setModalVisible2(true);
                                }}
                                style={{
                                  padding: 4,
                                  borderRadius: 4,
                                  backgroundColor: overlay.highlightColor || 'transparent',
                                  borderWidth: 1,
                                  borderColor: 'rgba(255,255,255,0.3)',
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: overlay.fontSize,
                                    color: overlay.color,
                                    fontFamily: overlay.fontFamily,
                                    textAlign: overlay.textAlign,
                                    textShadowColor: 'rgba(0,0,0,0.8)',
                                    textShadowOffset: { width: 1, height: 1 },
                                    textShadowRadius: 3,
                                    maxWidth: 200,
                                  }}
                                  numberOfLines={3}
                                >
                                  {overlay.text}
                                </Text>
                              </TouchableOpacity>
                            </Animated.View>
                          );
                        })}

                        {/* Text Preview while editing */}
                        {modalVisible2 && (
                          <Animated.View
                            {...panResponder.panHandlers}
                            style={[
                              pan.getLayout(),
                              {
                                position: 'absolute',
                                zIndex: 1001,
                                padding: 4,
                                borderRadius: 4,
                                borderWidth: 2,
                                borderColor: 'rgba(255,255,255,0.5)',
                                borderStyle: 'dashed',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                { fontSize: 28 },
                                selectedFont,
                                {
                                  color: textColor,
                                  textAlign,
                                  backgroundColor: highlightColor,
                                  textShadowColor: 'rgba(0,0,0,0.8)',
                                  textShadowOffset: { width: 1, height: 1 },
                                  textShadowRadius: 3,
                                  minWidth: 50,
                                },
                              ]}
                            >
                              {text || 'Type text...'}
                            </Text>
                          </Animated.View>
                        )}
                      </>
                    )}

                    {/* Show saved overlays for non-current images */}
                    {index !== currentImageIndex && imageEdits[index] && (
                      <>
                        {/* Show saved overlay images */}
                        {imageEdits[index].overlayImages?.map(img => (
                          <View
                            key={`saved-overlay-${img.id}`}
                            style={[
                              styles.overlayImageWrapper,
                              {
                                width: img.baseSize || 100,
                                height: img.baseSize || 100,
                                left: img.position?.x || 0,
                                top: img.position?.y || 0,
                                transform: [
                                  { scale: img.scale || 1 },
                                  { rotate: `${img.rotation || 0}rad` },
                                ],
                              },
                            ]}
                          >
                            <Image
                              source={{ uri: img.uri }}
                              style={styles.savedOverlayImage}
                            />
                          </View>
                        ))}

                        {/* Show saved text overlays */}
                        {imageEdits[index].textOverlays?.map(overlay => (
                          <View
                            key={`saved-text-${overlay.id}`}
                            style={{
                              position: 'absolute',
                              left: overlay.position?.x || 0,
                              top: overlay.position?.y || 0,
                              zIndex: 1000,
                              padding: 4,
                              borderRadius: 4,
                              backgroundColor: overlay.highlightColor || 'transparent',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: overlay.fontSize,
                                color: overlay.color,
                                fontFamily: overlay.fontFamily,
                                textAlign: overlay.textAlign,
                                textShadowColor: 'rgba(0,0,0,0.8)',
                                textShadowOffset: { width: 1, height: 1 },
                                textShadowRadius: 3,
                                maxWidth: 200,
                              }}
                              numberOfLines={3}
                            >
                              {overlay.text}
                            </Text>
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Draw controls - only show for images */}
            {isDrawing && !isCurrentMediaVideo() && (
              <View style={styles.drawControls}>
                <TouchableOpacity
                  onPress={() => {
                    if (canvasRef.current) {
                      canvasRef.current.undo();
                    }
                  }}
                  style={styles.controlButton}
                >
                  <Text style={styles.controlButtonText}>↩</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    // Always save/merge drawing first (even on cancel)
                    if (canvasRef.current) {
                      await captureAndMergeDrawing(false); // false = don't exit yet
                    }
                    // Then exit draw mode
                    setIsDrawing(false);
                    setIsScrollEnabled(true);
                    // setActiveTab('null');
                    // setCanvasKey(prev => prev + 1);
                  }}
                  style={[
                    styles.controlButton,
                    { backgroundColor: 'rgba(255,0,0,0.6)' },
                  ]}
                >
                  <Text style={styles.controlButtonText}>✕</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    captureAndMergeDrawing(true)
                  }} // Now just exits cleanly
                  style={[styles.controlButton, { backgroundColor: 'rgba(0,128,0,0.8)' }]}
                >
                  <Text style={styles.controlButtonText}>✓</Text>
                </TouchableOpacity>
              </View>
            )}

            {isDrawing && !isCurrentMediaVideo() && (
              <ScrollView
                horizontal
                style={styles.colorPalette}
                showsHorizontalScrollIndicator={false}
              >
                {['red', 'blue', 'green', 'yellow', 'white', 'black'].map(color => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      drawColor === color && styles.activeColorOption,
                    ]}
                    onPress={() => setDrawColor(color)}
                  />
                ))}
              </ScrollView>
            )}

            {/* Image Counter */}
            {selectedImages.length > 1 && (
              <View style={styles.imageCounter}>
                <Text style={styles.imageCounterText}>
                  {currentImageIndex + 1}/{selectedImages.length}
                </Text>
              </View>
            )}

            {/* Page Indicator Dots */}
            {selectedImages.length > 1 && (
              <View style={styles.pageIndicator}>
                {selectedImages.map((_, index) => (
                  <TouchableOpacity
                    key={`${getMediaKey(selectedImages[index], index)}-dot`}
                    onPress={() => scrollToImage(index)}
                    style={[
                      styles.dot,
                      index === currentImageIndex && styles.activeDot,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <TouchableOpacity style={styles.addImageButton} onPress={pickImages}>
            <View style={styles.addImageIcon}>
              <Text style={styles.addImageText}>+</Text>
            </View>
            <Text style={styles.addImageLabel}>Add Photos/Videos</Text>
          </TouchableOpacity>
        )}

        {/* Image/Video Thumbnails */}
        {selectedImages.length > 1 && (
          <ScrollView
            horizontal
            style={styles.thumbnailScrollView}
            showsHorizontalScrollIndicator={false}
          >
            {selectedImages.map((image, index) => (
              <TouchableOpacity
                key={`${getMediaKey(image, index)}-thumb`}
                onPress={() => scrollToImage(index)}
                style={[
                  styles.thumbnail,
                  index === currentImageIndex && styles.activeThumbnail,
                ]}
              >
                <Image
                  source={{
                    uri: image.path || image.uri || image.sourceURL,
                  }}
                  style={styles.thumbnailImage}
                />
                {/* Video indicator on thumbnail */}
                {isMediaVideo(image) && (
                  <View style={styles.thumbnailVideoIndicator}>
                    <Icon name="videocam" size={12} color="white" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  };

  const handleFlipToolPress = async key => {
    if (key !== 'Effects' && showFilters) {
      setShowFilters(false);
    }
    if (isDrawing) {
      await captureAndMergeDrawing(true);
    }
    switch (key) {
      case 'Text':
        setModalVisible2(true);
        break;
      case 'Sticker':
        setFlipStickerModal(true);
        break;
      case 'Audio':
        setFlipAudioModal(true);
        break;
      case 'Add':
        addMoreClips();
        break;
      case 'Overlay':
        setActiveTab('Overlay');
        bottomSheetRef.current?.open();
        break;
      case 'Effects':
        setShowFilters(prev => !prev);
        break;
      case 'Edit':
        if (isCurrentMediaVideo()) {
          const ed = getCurrentImageEdits();
          setTrimStartInput(
            ed.trimStart != null && ed.trimStart !== undefined ? String(ed.trimStart) : '0',
          );
          setTrimEndInput(ed.trimEnd != null && ed.trimEnd !== undefined ? String(ed.trimEnd) : '');
          setFlipTrimModal(true);
        } else {
          showToastMessage(toast, 'default', 'Trim is for video clips', 2000);
        }
        break;
      case 'Vol':
        setFlipVolumeModal(true);
        break;
      case 'Tag':
        setActiveTab('Tag');
        bottomSheetRef.current?.open();
        break;
      case 'Download':
        handleDownload();
        break;
      default:
        break;
    }
    setActiveTab(key);
  };

  const flipToolbarItems = [
    { key: 'Text', icon: 'text-outline', label: 'Text' },
    { key: 'Sticker', icon: 'happy-outline', label: 'Sticker' },
    { key: 'Audio', icon: 'musical-notes-outline', label: 'Audio' },
    { key: 'Add', icon: 'add-circle-outline', label: 'Add clip' },
    { key: 'Overlay', icon: 'layers-outline', label: 'Overlay' },
    { key: 'Effects', icon: 'color-filter-outline', label: 'Effects' },
    { key: 'Edit', icon: 'crop-outline', label: 'Edit' },
    { key: 'Vol', icon: 'volume-high-outline', label: 'Vol' },
    { key: 'Tag', icon: 'pricetag-outline', label: 'Tag' },
    { key: 'Download', icon: 'download-outline', label: 'Download' },
  ];

  const renderEditingTabs = () => (
    <View style={[styles.editingSection, bgStyle, isFlipPost && styles.editingSectionFlip]}>
      {isFlipPost ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.flipTabScroll}
          contentContainerStyle={styles.flipTabScrollContent}
        >
          {flipToolbarItems.map(t => (
            <TouchableOpacity
              key={t.key}
              style={styles.flipTabButton}
              onPress={() => handleFlipToolPress(t.key)}
              activeOpacity={0.75}
            >
              <Icon name={t.icon} size={22} color="#e5e5e5" style={{ marginBottom: 4 }} />
              <Text style={styles.flipTabLabel}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
      <View style={styles.tabContainer}>
        {[
          { title: 'Text', icon: 'text-outline', disabled: false },
          { title: 'Overlay', icon: 'layers-outline', disabled: false },
          { title: 'Filter', icon: 'color-filter-outline', disabled: false },
          { title: 'Tag', icon: 'pricetag-outline', disabled: false },
          { title: 'Download', icon: 'download-outline', disabled: false },
          ...(!isCurrentMediaVideo()
            ? [{ title: 'Draw', icon: 'create-outline', disabled: false }]

            : []),
        ].map(tab => (
          <TouchableOpacity
            key={tab.title}
            style={[styles.tabButton, tab.disabled && styles.disabledTabButton]}
            onPress={async () => {
              if (tab.disabled) return;
              if (tab.title !== 'Filter' && showFilters) {
                setShowFilters(false);
              }

              if (tab.title === 'Draw') {
                if (isDrawing) {
                  // Exiting draw mode → always save drawing first
                  await captureAndMergeDrawing(true);
                } else {
                  // Entering draw mode
                  setIsDrawing(true);
                  setIsScrollEnabled(false);
                  setCanvasKey(prev => prev + 1);
                }
              }
              else if (tab.title === 'Filter') {
                setShowFilters(prev => !prev);
                if (isDrawing) {
                  setIsDrawing(false);
                  setIsScrollEnabled(true);
                  setCanvasKey(prev => prev + 1);
                }
              }
              else if (tab.title === 'Text') {
                setModalVisible2(true);
                if (isDrawing) {
                  setIsDrawing(false);
                  setIsScrollEnabled(true);
                  setCanvasKey(prev => prev + 1);
                }
              }

              else if (tab.title === 'Overlay') {
                setActiveTab('Overlay');
                bottomSheetRef.current?.open();
                if (isDrawing) {
                  setIsDrawing(false);
                  setIsScrollEnabled(true);
                  setCanvasKey(prev => prev + 1);
                }
                return;
              }
              else if (tab.title === 'Tag') {
                setActiveTab('Tag');
                bottomSheetRef.current?.open();
                if (isDrawing) {
                  setIsDrawing(false);
                  setIsScrollEnabled(true);
                  setCanvasKey(prev => prev + 1);
                }
                return;
              }
              else if (tab.title === 'Download') {
                if (isDrawing) {
                  setIsDrawing(false);
                  setIsScrollEnabled(true);
                  setCanvasKey(prev => prev + 1);
                }
                handleDownload();
              }
              setActiveTab(tab.title);
            }}
            disabled={tab.disabled}
          >
            <Icon name={tab.icon} size={15} color={tab.disabled ? '#555' : '#aaa'} style={{ marginBottom: 2 }} />
            <Text style={[styles.tabButtonText, tab.disabled && styles.disabledTabButtonText]}>{tab.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
      )}
      <RBSheet
        ref={bottomSheetRef}
        closeOnDragDown={true}
        closeOnPressMask={true}
        height={480}
        customStyles={{
          container: {
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingHorizontal: 16,
            paddingTop: 10,
            backgroundColor: bgStyle?.backgroundColor || '#fff',
          },
        }}
      >
        <View key={activeTab} style={styles.tabContent}>
          {activeTab === 'Overlay' && (
            <View style={styles.overlayControls}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={addOverlayImage}
              >
                <Text style={styles.buttonText}>Pick Overlay Image(s)</Text>
              </TouchableOpacity>
              <ScrollView horizontal>
                {getCurrentImageEdits().overlayImages.map(img => (
                  <View key={img.id} style={{ margin: 8 }}>
                    <Image
                      source={{ uri: img.uri }}
                      style={{ width: 60, height: 60, borderRadius: 8 }}
                    />
                    <TouchableOpacity onPress={() => removeOverlay(img.id)}>
                      <Text
                        style={{
                          color: 'red',
                          fontSize: 12,
                          textAlign: 'center',
                        }}
                      >
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {activeTab === 'Tag' && (
            <View style={styles.tagSheet}>
              <View style={styles.tagSheetHeader}>
                <View>
                  <Text style={[styles.tagSheetTitle, textStyle]}>Tag people</Text>
                  <Text style={[styles.tagSheetSubtitle, textStyle, { opacity: 0.7 }]}>
                    Search and add usernames to your post
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setTagSearch('');
                    setUserSuggestions([]);
                    bottomSheetRef.current?.close();
                  }}
                >
                  <Text style={[styles.tagSheetDone, { color: themeText }]}>Done</Text>
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.tagSearchBar,
                  {
                    backgroundColor: cardStyle?.backgroundColor || '#fff',
                    borderColor: `${themeText}22`,
                  },
                ]}
              >
                <Icon name="search" size={16} color="#999" style={{ marginRight: 8 }} />
                <TextInput
                  value={tagSearch}
                  onChangeText={setTagSearch}
                  placeholder="Search users"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.tagSearchInput, textStyle]}
                />
              </View>

              {selectedTaggedPeople.length > 0 && (
                <View style={styles.tagChipsWrap}>
                  {selectedTaggedPeople.map(username => (
                    <View key={username} style={[styles.tagChip, { backgroundColor: themeText }]}>
                      <Text style={styles.tagChipText}>@{username}</Text>
                      <TouchableOpacity onPress={() => handleRemoveTaggedPerson(username)}>
                        <Icon name="close" size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {isSearchingUsers && (
                <Text style={[styles.tagSearchingText, textStyle, { opacity: 0.7 }]}>Searching…</Text>
              )}

              <FlatList
                data={userSuggestions}
                keyExtractor={(item, index) =>
                  String(item?._id || item?.id || item?._username || item?.userName || index)
                }
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const username = item?._username;
                  const displayName = String(item?.name || item?.fullName || item?.firstName || '').trim();
                  const avatar = item?.profilePic || item?.avatar || item?.image || item?.photo;

                  return (
                    <TouchableOpacity
                      style={[
                        styles.tagSuggestionRow,
                        {
                          backgroundColor: cardStyle?.backgroundColor || '#fff',
                          borderColor: `${themeText}1f`,
                        },
                      ]}
                      onPress={() => handleSelectTagUser(item)}
                    >
                      <View style={[styles.tagAvatar, { backgroundColor: `${themeText}66` }]}>
                        {avatar ? (
                          <Image source={{ uri: avatar }} style={styles.tagAvatarImg} />
                        ) : (
                          <Icon name="person" size={18} color="#fff" />
                        )}
                      </View>
                      <View style={styles.tagSuggestionTextWrap}>
                        <Text style={[styles.tagSuggestionUsername, textStyle]}>@{username}</Text>
                        {!!displayName && (
                          <Text style={[styles.tagSuggestionName, textStyle, { opacity: 0.7 }]} numberOfLines={1}>
                            {displayName}
                          </Text>
                        )}
                      </View>
                      <View style={[styles.tagAddPill, { backgroundColor: themeText }]}>
                        <Icon name="add" size={16} color="#fff" />
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  tagSearch.trim() ? (
                    <Text style={[styles.tagEmptyText, textStyle, { opacity: 0.7 }]}>No users found</Text>
                  ) : (
                    <Text style={[styles.tagEmptyText, textStyle, { opacity: 0.7 }]}>Type to search people</Text>
                  )
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
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.editorBox}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder=""
                placeholderTextColor="#ccc"
                style={[
                  styles.textInput,
                  selectedFont,
                  {
                    color: textColor,
                    textAlign,
                    backgroundColor: highlightColor,
                  },
                ]}
                multiline
              />

              {showFonts && (
                <FlatList
                  data={fonts}
                  horizontal
                  keyExtractor={item => item.name}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => setSelectedFont(item.style)}
                      style={styles.fontBtn}
                    >
                      <Text
                        style={[{ fontSize: 18, color: '#fff' }, item.style]}
                      >
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  )}
                  style={{ marginTop: 20 }}
                  showsHorizontalScrollIndicator={false}
                />
              )}

              {showColors && (
                <FlatList
                  data={colors}
                  horizontal
                  keyExtractor={(item, index) => index.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => setTextColor(item)}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: item, borderColor: '#fff' },
                      ]}
                    />
                  )}
                  style={{ marginTop: 15 }}
                  showsHorizontalScrollIndicator={false}
                />
              )}

              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={() => {
                    setShowFonts(!showFonts);
                    setShowColors(false);
                  }}
                  style={styles.iconBtn}
                >
                  <Feather name="type" size={26} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setShowColors(!showColors);
                    setShowFonts(false);
                  }}
                  style={styles.iconBtn}
                >
                  <Feather name="circle" size={26} color={textColor} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() =>
                    setTextAlign(
                      textAlign === 'center'
                        ? 'left'
                        : textAlign === 'left'
                          ? 'right'
                          : 'center',
                    )
                  }
                  style={styles.iconBtn}
                >
                  <Feather
                    name={
                      textAlign === 'center'
                        ? 'align-center'
                        : textAlign === 'left'
                          ? 'align-left'
                          : 'align-right'
                    }
                    size={26}
                    color="#fff"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() =>
                    setHighlightColor(
                      highlightColor === 'transparent'
                        ? 'black'
                        : highlightColor === 'black'
                          ? 'white'
                          : 'transparent',
                    )
                  }
                  style={styles.iconBtn}
                >
                  <MaterialCommunityIcons
                    name="format-color-highlight"
                    size={26}
                    color={highlightColor === 'transparent' ? 'white' : 'black'}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Instagram-style Flips modals */}
      <Modal visible={flipStickerModal} transparent animationType="fade" onRequestClose={() => setFlipStickerModal(false)}>
        <View style={styles.flipStickerModalRoot}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setFlipStickerModal(false)}
          />
          <View style={[styles.flipModalCard, { backgroundColor: cardStyle?.backgroundColor || '#1a1a1a' }]}>
            <Text style={[styles.flipModalTitle, textStyle]}>Stickers</Text>
            <View style={styles.flipEmojiGrid}>
              {FLIP_EMOJI_STICKERS.map(emoji => (
                <TouchableOpacity key={emoji} style={styles.flipEmojiCell} onPress={() => addStickerEmoji(emoji)}>
                  <Text style={styles.flipEmojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => setFlipStickerModal(false)} style={styles.flipModalClose}>
              <Text style={{ color: themeText, fontWeight: '600' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={flipAudioModal} transparent animationType="slide" onRequestClose={() => setFlipAudioModal(false)}>
        <View style={styles.flipModalBackdrop}>
          <View style={[styles.flipModalSheet, { backgroundColor: cardStyle?.backgroundColor || '#fff' }]}>
            <Text style={[styles.flipModalTitle, textStyle]}>Sound</Text>
            <Text style={[styles.flipModalHint, textStyle]}>
              Pick a style for your Flip. Full mix is applied when your backend supports audio tracks.
            </Text>
            {FLIP_MUSIC_LIBRARY.map(track => (
              <TouchableOpacity
                key={track.id}
                style={styles.flipMusicRow}
                onPress={() => {
                  updateCurrentImageEdits({ musicId: track.id, musicTitle: track.title });
                  setFlipAudioModal(false);
                  showToastMessage(toast, 'success', `Sound: ${track.title}`, 1500);
                }}
              >
                <Icon name="musical-notes" size={20} color={themeText} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[textStyle, { fontWeight: '600' }]}>{track.title}</Text>
                  <Text style={{ opacity: 0.6, color: '#666' }}>{track.artist}</Text>
                </View>
                <Icon name="chevron-forward" size={18} color="#999" />
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setFlipAudioModal(false)} style={styles.flipModalClose}>
              <Text style={{ color: themeText, fontWeight: '600' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={flipTrimModal} transparent animationType="fade" onRequestClose={() => setFlipTrimModal(false)}>
        <View style={styles.flipModalBackdrop}>
          <View style={[styles.flipModalCard, { backgroundColor: cardStyle?.backgroundColor || '#fff' }]}>
            <Text style={[styles.flipModalTitle, textStyle]}>Edit video</Text>
            <Text style={[styles.flipModalHint, textStyle]}>Trim range (seconds). Export uses these values when the server supports trim.</Text>
            <View style={styles.flipTrimRow}>
              <Text style={textStyle}>Start</Text>
              <TextInput
                style={styles.flipTrimInput}
                value={trimStartInput}
                onChangeText={setTrimStartInput}
                keyboardType="decimal-pad"
                placeholder="0"
              />
            </View>
            <View style={styles.flipTrimRow}>
              <Text style={textStyle}>End</Text>
              <TextInput
                style={styles.flipTrimInput}
                value={trimEndInput}
                onChangeText={setTrimEndInput}
                keyboardType="decimal-pad"
                placeholder="optional"
              />
            </View>
            <TouchableOpacity
              style={[styles.flipPrimaryBtn, { backgroundColor: themeText }]}
              onPress={() => {
                const start = parseFloat(trimStartInput) || 0;
                const endRaw = trimEndInput.trim();
                const end = endRaw === '' ? null : parseFloat(endRaw);
                updateCurrentImageEdits({ trimStart: start, trimEnd: end });
                setFlipTrimModal(false);
                showToastMessage(toast, 'success', 'Trim saved', 1500);
              }}
            >
              <Text style={styles.flipPrimaryBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFlipTrimModal(false)} style={styles.flipModalClose}>
              <Text style={{ color: themeText }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={flipVolumeModal} transparent animationType="fade" onRequestClose={() => setFlipVolumeModal(false)}>
        <View style={styles.flipModalBackdrop}>
          <View style={[styles.flipModalCard, { backgroundColor: cardStyle?.backgroundColor || '#fff' }]}>
            <Text style={[styles.flipModalTitle, textStyle]}>Volume</Text>
            <Text style={[styles.flipModalHint, textStyle]}>Original clip volume for this segment</Text>
            {[0, 0.25, 0.5, 0.75, 1].map(v => (
              <TouchableOpacity
                key={String(v)}
                style={styles.flipVolRow}
                onPress={() => {
                  setFlipVolumeForCurrent(v);
                  setFlipVolumeModal(false);
                }}
              >
                <Icon
                  name={v === 0 ? 'volume-mute' : 'volume-high'}
                  size={22}
                  color={themeText}
                />
                <Text style={[textStyle, { marginLeft: 10, flex: 1 }]}>
                  {v === 0 ? 'Mute' : `${Math.round(v * 100)}%`}
                </Text>
                {(flipVolumeByIndex[currentImageIndex] ?? 1) === v && (
                  <Icon name="checkmark-circle" size={22} color={themeText} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setFlipVolumeModal(false)} style={styles.flipModalClose}>
              <Text style={{ color: themeText }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={[styles.NextButtonView, isFlipPost && styles.NextButtonViewFlip]}>
        {isFlipPost && isCurrentMediaVideo() && (
          <TouchableOpacity
            style={styles.flipEditVideoPill}
            onPress={() => handleFlipToolPress('Edit')}
            activeOpacity={0.85}
          >
            <Text style={styles.flipEditVideoPillText}>Edit video</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.nextButton,
            isFlipPost && styles.nextButtonFlip,
            { backgroundColor: profile === 'company' ? '#D3B683' : isFlipPost ? '#2d7ff9' : '#5a2d82' },
          ]}
          onPress={handleNext}
        >
          <Text style={styles.nextButtonText}>Next</Text>
          <Text style={styles.nextArrow}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
          <Text style={styles.headerButtonText}>×</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: isFlipPost ? "75%" : "70%" }} showsVerticalScrollIndicator={false}>
        {renderFilters()}
        {renderImageCarousel()}
        {/* {renderZoomIndicator()} */}
      </View>
      {renderEditingTabs()}
    </SafeAreaView>
  );
};

// Add these styles to your existing StyleSheet
const styles = StyleSheet.create({
  container: {
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
    // flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '80%',
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 1,
    elevation: 1,
    // backgroundColor:'#ed1010ff'


  },
  mainImageContainer: {
    width: IMAGE_SIZE,
    height: '100%',
    // alignSelf: 'center',
    overflow: 'hidden',

  },
  mainScrollView: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
  },
  mainScrollContent: {
    alignItems: 'center',
    height: '100%',
    // alignSelf: 'center',
  },
  imageSlide: {
    //  height: '100%' ,
    // justifyContent: 'center',
    // alignItems: 'center',
    height: "100%",

  },
  mainImage: {
    width: IMAGE_SIZE,
    // height: IMAGE_SIZE,
    height: "100%",
    borderRadius: 8,
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
    backgroundColor: '#000',
  },
  staticImageCanvas: {
    width: IMAGE_SIZE,
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#000',
  },
  drawingSurface: {
    width: IMAGE_SIZE,
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#000',
  },
  filterOverlay: {
    borderRadius: 8,
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
    bottom: 10,
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
    marginTop: 12,
    height: 60,
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
    paddingTop: 12,

  },
  editingSectionFlip: {
    backgroundColor: '#000',
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2a2a2a',
  },
  flipTabScroll: {
    maxHeight: 104,
  },
  flipTabScrollContent: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'flex-start',
  },
  flipTabButton: {
    alignItems: 'center',
    marginHorizontal: 8,
    minWidth: 54,
  },
  flipTabLabel: {
    color: '#c4c4c4',
    fontSize: 10,
    textAlign: 'center',
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
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  tabButton: {
    alignItems: 'center',
    padding: 8,
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
});

export default InstagramPostCreator;
