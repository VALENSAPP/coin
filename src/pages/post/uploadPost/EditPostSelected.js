import React, { useState, useRef, useEffect } from 'react';
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

import {
  Grayscale,
  Sepia,
  Saturate,
  Contrast,
  Brightness,
} from 'react-native-color-matrix-image-filters';

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

const InstagramPostCreator = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const routeImages = route.params?.selectedMedia || [];
  const postType = route.params?.postType || 'regular'; // 'regular' or 'crowdfunding'
  const fromIcon = route.params?.fromIcon;
  const [selectedImages, setSelectedImages] = useState(routeImages);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('null');
  const bottomSheetRef = useRef();

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

  // Video related states
  const [videoPaused, setVideoPaused] = useState({});
  const [videoMuted, setVideoMuted] = useState(true);
  const videoRefs = useRef({});

  // Add refs for capturing filtered images
  const imageViewRefs = useRef({});

  // Store animated values separately to avoid modification issues
  const animatedValues = useRef({});

  const TEXT_OVERLAY_BOUNDS = {
    minX: 0,
    minY: 0,
    maxX: IMAGE_SIZE - 100,
    maxY: IMAGE_SIZE - 50,
  };

  const IMAGE_OVERLAY_BOUNDS = {
    minX: 0,
    minY: 0,
    maxX: IMAGE_SIZE - 100,
    maxY: IMAGE_SIZE - 100,
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
    // Hide filters if current media is video or filters are not shown
    if (!showFilters || isCurrentMediaVideo()) return null;

    const currentEdits = getCurrentImageEdits();

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
      >
        {filterOptions.map(opt => {
          const FilterComp = opt.component;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => handleFilterChange(opt.value)}
              style={styles.filterOption}
            >
              <View
                style={[
                  styles.filterPreview,
                  currentEdits.filter === opt.value && styles.selectedFilter,
                ]}
              >
                <FilterComp>
                  <Image
                    source={{
                      uri:
                        selectedImages[currentImageIndex]?.path ||
                        selectedImages[currentImageIndex]?.uri,
                    }}
                    style={styles.filterPreviewImage}
                  />
                </FilterComp>
              </View>
              <Text style={styles.filterName}>{opt.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  // Enhanced video play/pause handler
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
              // Store position as plain object, create animated value when needed
              position: { x: 50, y: 50 },
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
    const currentEdits = getCurrentImageEdits();
    const target = currentEdits.overlayImages.find(o => o.id === id);
    if (!target) {
      return PanResponder.create({ onStartShouldSetPanResponder: () => false });
    }

    // Get or create animated value for this overlay
    const animatedPosition = getAnimatedValue(currentImageIndex, id, target.position.x, target.position.y);

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) =>
        Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5,
      onPanResponderGrant: () => {
        animatedPosition.setOffset({
          x: animatedPosition.x._value,
          y: animatedPosition.y._value,
        });
        animatedPosition.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (evt, gestureState) => {
        const currentX = animatedPosition.x._offset + gestureState.dx;
        const currentY = animatedPosition.y._offset + gestureState.dy;

        const boundedX = Math.max(
          IMAGE_OVERLAY_BOUNDS.minX,
          Math.min(IMAGE_OVERLAY_BOUNDS.maxX, currentX),
        );
        const boundedY = Math.max(
          IMAGE_OVERLAY_BOUNDS.minY,
          Math.min(IMAGE_OVERLAY_BOUNDS.maxY, currentY),
        );

        animatedPosition.setValue({
          x: boundedX - animatedPosition.x._offset,
          y: boundedY - animatedPosition.y._offset,
        });
      },
      onPanResponderRelease: () => {
        animatedPosition.flattenOffset();
        // Update the stored position
        const currentEdits = getCurrentImageEdits();
        const updatedOverlays = currentEdits.overlayImages.map(overlay => {
          if (overlay.id === id) {
            return {
              ...overlay,
              position: {
                x: animatedPosition.x._value,
                y: animatedPosition.y._value,
              }
            };
          }
          return overlay;
        });
        updateCurrentImageEdits({ overlayImages: updatedOverlays });
      },
    });
  };

  const createTextPanResponder = (id) => {
    const currentEdits = getCurrentImageEdits();
    const overlay = currentEdits.textOverlays.find(o => o.id === id);
    if (!overlay) {
      return PanResponder.create({ onStartShouldSetPanResponder: () => false });
    }

    // Get or create animated value for this text overlay
    const animatedPosition = getAnimatedValue(currentImageIndex, id, overlay.position.x, overlay.position.y);

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gs) =>
        Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5,

      onPanResponderGrant: () => {
        animatedPosition.setOffset({
          x: animatedPosition.x._value,
          y: animatedPosition.y._value,
        });
        animatedPosition.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (evt, gestureState) => {
        const currentX = animatedPosition.x._offset + gestureState.dx;
        const currentY = animatedPosition.y._offset + gestureState.dy;

        const boundedX = Math.max(
          TEXT_OVERLAY_BOUNDS.minX,
          Math.min(TEXT_OVERLAY_BOUNDS.maxX, currentX),
        );
        const boundedY = Math.max(
          TEXT_OVERLAY_BOUNDS.minY,
          Math.min(TEXT_OVERLAY_BOUNDS.maxY, currentY),
        );

        animatedPosition.setValue({
          x: boundedX - animatedPosition.x._offset,
          y: boundedY - animatedPosition.y._offset,
        });
      },
      onPanResponderRelease: () => {
        animatedPosition.flattenOffset();
        // Update the stored position
        const currentEdits = getCurrentImageEdits();
        const updatedOverlays = currentEdits.textOverlays.map(textOverlay => {
          if (textOverlay.id === id) {
            return {
              ...textOverlay,
              position: {
                x: animatedPosition.x._value,
                y: animatedPosition.y._value,
              }
            };
          }
          return textOverlay;
        });
        updateCurrentImageEdits({ textOverlays: updatedOverlays });
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
      const boundedX = Math.max(
        TEXT_OVERLAY_BOUNDS.minX,
        Math.min(TEXT_OVERLAY_BOUNDS.maxX, x),
      );
      const boundedY = Math.max(
        TEXT_OVERLAY_BOUNDS.minY,
        Math.min(TEXT_OVERLAY_BOUNDS.maxY, y),
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

  const saveCurrentDrawing = () => {
    if (canvasRef.current && isDrawing) {
      try {
        canvasRef.current.save('png', false, 'Sketches', String(Date.now()), false, false, false);
      } catch (error) {
        console.log('Error calling save():', error);
      }
    }
  };

  const handleImageChange = async (newIndex) => {
    if (newIndex === currentImageIndex) return;

    // Save current drawing before switching
    await saveCurrentDrawing();

    setCurrentImageIndex(newIndex);

    // Load edits for the new image
    loadImageEdits(newIndex);
  };

  const handleNext = async () => {
    try {
      const processedImages = await Promise.all(
        selectedImages.map(async (image, index) => {
          const edits = imageEdits[index] || {
            textOverlays: [],
            overlayImages: [],
            filter: 'none',
            drawings: null,
          };

          let processedUri = image.path || image.uri;

          // Skip capture for videos or if no edits are applied
          const isVideo = isMediaVideo(image);
          const hasEdits =
            edits.textOverlays.length > 0 ||
            edits.overlayImages.length > 0 ||
            edits.drawings ||
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
        fromIcon: fromIcon
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
                };

                return {
                  ...image,
                  originalUri: image.path || image.uri,
                  processedUri: image.path || image.uri,
                  filter: edits.filter,
                  isVideo: isMediaVideo(image),
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
        {selectedImages.length > 0 ? (
          <View style={styles.mainImageContainer}>
            <ScrollView
              ref={mainScrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleMainImageScroll}
              scrollEventThrottle={16}
              style={styles.mainScrollView}
              contentContainerStyle={styles.mainScrollContent}
            >
              {selectedImages.map((image, index) => (
                <View key={index} style={[styles.imageSlide, { width: IMAGE_SIZE }]}>
                  <View
                    ref={ref => {
                      if (ref) {
                        imageViewRefs.current[index] = ref;
                      }
                    }}
                    style={{
                      width: IMAGE_SIZE,
                      height: IMAGE_SIZE,
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
                          resizeMode="cover"
                          paused={videoPaused[index] !== false}
                          muted={videoMuted}
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
                            onPress={() => setVideoMuted(!videoMuted)}
                          >
                            <Icon
                              name={videoMuted ? 'volume-mute' : 'volume-high'}
                              size={20}
                              color="white"
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      // Image with zoom functionality
                      <ImageZoom
                        {...(!isDrawing ? panResponder.panHandlers : {})}
                        cropWidth={IMAGE_SIZE}
                        cropHeight={IMAGE_SIZE}
                        imageWidth={IMAGE_SIZE}
                        imageHeight={IMAGE_SIZE}
                        enableImageZoom={!isDrawing}
                        minScale={0.5}
                        maxScale={4}
                        pinchToZoom={!isDrawing}
                        enableDoubleClickZoom={!isDrawing}
                        doubleClickInterval={175}
                        style={styles.imageZoomContainer}
                        onStartShouldSetPanResponder={evt => {
                          if (isDrawing) return false;
                          return (
                            evt.nativeEvent.target._owner?.memoizedProps?.testID !==
                            'overlay-element'
                          );
                        }}
                        onMoveShouldSetPanResponder={evt => {
                          if (isDrawing) return false;
                          return (
                            evt.nativeEvent.target._owner?.memoizedProps?.testID !==
                            'overlay-element'
                          );
                        }}
                        onPanResponderGrant={handleZoomStart}
                        onPanResponderRelease={handleZoomEnd}
                        onMove={({ scale }) => handleZoomChange(scale)}
                      >
                        {/* Filtered image */}
                        <FilterComponent>
                          <Image
                            source={{
                              uri: image.path || image.uri,
                            }}
                            style={styles.mainImage}
                            resizeMode="cover"
                          />
                        </FilterComponent>
                      </ImageZoom>
                    )}

                    {/* Only show overlays for current image */}
                    {index === currentImageIndex && (
                      <>
                        {/* Drawing Canvas - only for images, not videos */}
                        {isDrawing && !isMediaVideo(image) && (
                          <SketchCanvas
                            ref={canvasRef}
                            style={[
                              StyleSheet.absoluteFill,
                              {
                                backgroundColor: 'rgba(0,0,0,0)', // Completely transparent
                              }
                            ]}
                            strokeColor={drawColor}
                            strokeWidth={5}
                            pointerEvents="box-only"
                            // Force transparent background
                            defaultBackground="transparent"
                            backgroundColor="rgba(0,0,0,0)"
                            onStrokeEnd={() => {
                              setTimeout(() => {
                                saveCurrentDrawing();
                              }, 100);
                            }}
                            onSketchSaved={async (success, path) => {
                              if (success) {
                                const base64 = await RNFS.readFile(path, 'base64');
                                updateCurrentImageEdits({
                                  drawings: `data:image/png;base64,${base64}`,
                                });
                              }
                            }}
                          />
                        )}

                        {/* Overlay Images */}
                        {currentEdits.overlayImages.map(img => {
                          const panResponder = createPanResponder(img.id);
                          const animatedPosition = getAnimatedValue(currentImageIndex, img.id, img.position.x, img.position.y);
                          return (
                            <Animated.View
                              key={img.id}
                              {...panResponder.panHandlers}
                              testID="overlay-element"
                              style={[
                                {
                                  position: 'absolute',
                                  width: 100,
                                  height: 100,
                                  zIndex: 999,
                                },
                                animatedPosition.getLayout(),
                              ]}
                            >
                              <TouchableOpacity
                                onLongPress={() => removeOverlay(img.id)}
                                style={{ flex: 1 }}
                              >
                                <Image
                                  source={{ uri: img.uri }}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    opacity: 0.8,
                                    resizeMode: 'contain',
                                    borderWidth: 2,
                                    borderColor: 'rgba(255,255,255,0.5)',
                                    borderRadius: 4,
                                  }}
                                />
                              </TouchableOpacity>
                            </Animated.View>
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

                        {/* Current image drawing overlay - only for images */}
                        {currentEdits.drawings && !isMediaVideo(image) && (
                          <Image
                            source={{ uri: currentEdits.drawings }}
                            style={[
                              StyleSheet.absoluteFill,
                              {
                                backgroundColor: 'transparent',
                                // Use blend mode to only show colored pixels
                                mixBlendMode: 'multiply', // or 'overlay', 'screen'
                              }
                            ]}
                            resizeMode="cover"
                            // Make only non-white pixels visible
                            blendMode="normal"
                          />
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
                            style={{
                              position: 'absolute',
                              width: 100,
                              height: 100,
                              left: img.position?.x || 0,
                              top: img.position?.y || 0,
                              zIndex: 999,
                            }}
                          >
                            <Image
                              source={{ uri: img.uri }}
                              style={{
                                width: '100%',
                                height: '100%',
                                opacity: 0.8,
                                resizeMode: 'contain',
                                borderRadius: 4,
                              }}
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

                        {/* Show saved drawings for this specific image - only for images */}
                        {imageEdits[index]?.drawings && !isMediaVideo(selectedImages[index]) && (
                          <Image
                            source={{ uri: imageEdits[index].drawings }}
                            style={StyleSheet.absoluteFill}
                            resizeMode="cover"
                          />
                        )}
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
                      setTimeout(() => saveCurrentDrawing(), 100);
                    }
                  }}
                  style={styles.controlButton}
                >
                  <Text style={styles.controlButtonText}>↩</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (canvasRef.current) {
                      canvasRef.current.clear();
                      updateCurrentImageEdits({ drawings: null });
                    }
                  }}
                  style={[
                    styles.controlButton,
                    { backgroundColor: 'rgba(255,0,0,0.6)' },
                  ]}
                >
                  <Text style={styles.controlButtonText}>✕</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    await saveCurrentDrawing();
                    setIsDrawing(false);
                  }}
                  style={[
                    styles.controlButton,
                    { backgroundColor: 'rgba(0,128,0,0.7)' },
                  ]}
                >
                  <Text style={styles.controlButtonText}>✓</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Color palette - only show for images */}
            {isDrawing && !isCurrentMediaVideo() && (
              <ScrollView
                horizontal
                style={styles.colorPalette}
                contentContainerStyle={{ alignItems: 'center' }}
                showsHorizontalScrollIndicator={false}
              >
                {['red', 'blue', 'green', 'yellow', 'white', 'black'].map(
                  color => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        drawColor === color && styles.activeColorOption,
                      ]}
                      onPress={() => setDrawColor(color)}
                    />
                  ),
                )}
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
                    key={index}
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
                key={index}
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

  const renderEditingTabs = () => (
    <View style={styles.editingSection}>
      <View style={styles.tabContainer}>
        {[
          { title: 'Text', icon: 'text-outline', disabled: isCurrentMediaVideo() },
          { title: 'Overlay', icon: 'layers-outline', disabled: isCurrentMediaVideo() },
          { title: 'Filter', icon: 'color-filter-outline', disabled: isCurrentMediaVideo() },
          { title: 'Draw', icon: 'create-outline', disabled: isCurrentMediaVideo() },
        ].map(tab => (
          <TabButton
            key={tab.title}
            title={tab.title}
            icon={tab.icon}
            isActive={activeTab === tab.title}
            disabled={tab.disabled}
            onPress={() => {
              if (tab.disabled) return;
              
              setActiveTab(tab.title);
              if (tab.title === 'Filter') {
                setShowFilters(prev => !prev);
              } else if (tab.title === 'Draw') {
                setIsDrawing(prev => !prev);
              } else if (tab.title === 'Text') {
                setModalVisible2(true);
              } else if (tab.title === 'Overlay') {
                bottomSheetRef.current.open();
              } else {
                setShowFilters(false);
              }
            }}
          />
        ))}
      </View>

      <RBSheet
        ref={bottomSheetRef}
        closeOnDragDown={true}
        closeOnPressMask={true}
        height={350}
        customStyles={{
          container: {
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingHorizontal: 16,
          },
        }}
      >
        <View style={styles.tabContent}>
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

      <View style={styles.NextButtonView}>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>Next</Text>
          <Text style={styles.nextArrow}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
          <Text style={styles.headerButtonText}>×</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderImageCarousel()}
        {renderFilters()}
        {/* {renderZoomIndicator()} */}
      </ScrollView>
      {renderEditingTabs()}
    </SafeAreaView>
  );
};

// Add these styles to your existing StyleSheet
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f2fd',
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
  content: {
    flex: 1,
  },
  imageContainer: {
    marginBottom: 20,
    marginLeft: 15
    // alignItems: 'center',
    // paddingVertical: 16,
  },
  mainImageContainer: {
    position: 'relative',
  },
  mainScrollView: {
    width: IMAGE_SIZE,
    // height: IMAGE_SIZE,
  },
  mainScrollContent: {
    alignItems: 'center',
  },
  imageSlide: {
     height: IMAGE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 8,
  },
  videoContainer: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
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
    flex: 1,
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
    borderColor: '#fff',
  },
  filterPreviewImage: {
    width: '100%',
    height: '100%',
  },
  filterName: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
  editingSection: {
  backgroundColor: '#f8f2fd',
    paddingTop: 12,
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
  nextButton: {
    backgroundColor: '#5a2d82',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 8,
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