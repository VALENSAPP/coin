import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  Dimensions,
  PanResponder,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import ImagePicker from 'react-native-image-crop-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import CameraView from './CameraView';
import Video from 'react-native-video';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const GalleryPickerScreen = () => {
  const navigation = useNavigation();
  const [tab, setTab] = useState('gallery');
  const [media, setMedia] = useState([]);
  const [selected, setSelected] = useState([]);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState('photo');
  
  // Crop feature states
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [cropData, setCropData] = useState({
    x: 0,
    y: 0,
    width: SCREEN_WIDTH - 40,
    height: SCREEN_WIDTH - 40,
  });
  const [imageData, setImageData] = useState({ width: 0, height: 0 });
  
  // Animation values for crop area
  const pan = useRef(new Animated.ValueXY()).current;
  const cropScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (tab === 'gallery') {
      setTimeout(() => {
        
        openGallery();
      }, 500);
      setShowCamera(false);
    } else {
      setCameraMode(tab);
      setShowCamera(true);
    }
  }, [tab, openGallery]);

  const openGallery = useCallback(async () => {
    try {
      const result = await ImagePicker.openPicker({
        multiple: true,
        mediaType: 'any',
        cropping: false, // We'll handle cropping manually
      });
      const files = Array.isArray(result) ? result : [result];
      const normalized = files.map(file => ({
        uri: file.path,
        type: file.mime,
        duration: file.duration || 0,
        width: file.width,
        height: file.height,
      }));
      setMedia(normalized);
      if (normalized.length > 0) {
        setSelected([normalized[0]]);
      }
    } catch (e) {
      console.warn(e);
    }
  }, []);

  const handleCameraCapture = (mediaItem) => {
    setShowCamera(false);
    setTab('gallery');
    setMedia(prev => [mediaItem, ...prev]);
    setSelected([mediaItem]);
  };

  const handleCameraCancel = () => {
    setShowCamera(false);
    setTab('gallery');
  };

  const handleSelect = (item) => {
    setSelected([item]);
  };

  const isVideo = (item) => item.type && item.type.startsWith('video');

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Crop functionality
  const openCropModal = useCallback((item) => {
    if (isVideo(item)) {
      Alert.alert('Info', 'Video cropping is not supported. Only images can be cropped.');
      return;
    }
    
    setImageToCrop(item);
    setShowCropModal(true);
    
    // Calculate initial crop area based on image dimensions
    const imageAspectRatio = item.width / item.height;
    const containerWidth = SCREEN_WIDTH - 40;
    const containerHeight = SCREEN_HEIGHT * 0.6;
    
    let displayWidth, displayHeight;
    if (imageAspectRatio > containerWidth / containerHeight) {
      displayWidth = containerWidth;
      displayHeight = containerWidth / imageAspectRatio;
    } else {
      displayHeight = containerHeight;
      displayWidth = containerHeight * imageAspectRatio;
    }
    
    setImageData({ width: displayWidth, height: displayHeight });
    setCropData({
      x: 0,
      y: 0,
      width: Math.min(displayWidth, displayHeight),
      height: Math.min(displayWidth, displayHeight),
    });
  }, []);

  const cropImage = useCallback(async () => {
    if (!imageToCrop) return;
    
    try {
      // Calculate crop parameters relative to original image size
      const scaleX = imageToCrop.width / imageData.width;
      const scaleY = imageToCrop.height / imageData.height;
      
      const cropParams = {
        path: imageToCrop.uri,
        width: Math.round(cropData.width * scaleX),
        height: Math.round(cropData.height * scaleY),
        cropX: Math.round(cropData.x * scaleX),
        cropY: Math.round(cropData.y * scaleY),
      };
      
      const croppedImage = await ImagePicker.openCropper(cropParams);
      
      // Update the selected image with cropped version
      const updatedImage = {
        ...imageToCrop,
        uri: croppedImage.path,
        width: croppedImage.width,
        height: croppedImage.height,
      };
      
      // Update media array
      const updatedMedia = media.map(item => 
        item.uri === imageToCrop.uri ? updatedImage : item
      );
      setMedia(updatedMedia);
      
      // Update selected array
      setSelected([updatedImage]);
      
      setShowCropModal(false);
      setImageToCrop(null);
      
      Alert.alert('Success', 'Image cropped successfully!');
    } catch (error) {
      console.error('Crop error:', error);
      Alert.alert('Error', 'Failed to crop image. Please try again.');
    }
  }, [imageToCrop, imageData, cropData, media]);

  // Pan responder for crop area
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        const newX = Math.max(0, Math.min(cropData.x + gestureState.dx, imageData.width - cropData.width));
        const newY = Math.max(0, Math.min(cropData.y + gestureState.dy, imageData.height - cropData.height));
        
        setCropData(prev => ({
          ...prev,
          x: newX,
          y: newY,
        }));
      },
      onPanResponderRelease: () => {
        // Reset pan animation
        pan.setValue({ x: 0, y: 0 });
      },
    })
  ).current;

  const renderCropModal = () => (
    <Modal
      visible={showCropModal}
      animationType="slide"
      onRequestClose={() => setShowCropModal(false)}
    >
      <SafeAreaView style={styles.cropContainer}>
        <View style={styles.cropHeader}>
          <TouchableOpacity
            onPress={() => setShowCropModal(false)}
            style={styles.cropButton}
          >
            <Text style={styles.cropButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.cropTitle}>Crop Image</Text>
          <TouchableOpacity
            onPress={cropImage}
            style={styles.cropButton}
          >
            <Text style={[styles.cropButtonText, styles.cropDoneText]}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cropImageContainer}>
          {imageToCrop && (
            <View style={styles.imageWrapper}>
              <Image
                source={{ uri: imageToCrop.uri }}
                style={[
                  styles.cropImage,
                  {
                    width: imageData.width,
                    height: imageData.height,
                  }
                ]}
                resizeMode="cover"
              />
              
              {/* Crop overlay */}
              <View style={styles.cropOverlay}>
                {/* Dark overlay areas */}
                <View style={[styles.overlayArea, { height: cropData.y }]} />
                <View style={styles.cropRow}>
                  <View style={[styles.overlayArea, { width: cropData.x }]} />
                  <View
                    style={[
                      styles.cropArea,
                      {
                        left: cropData.x,
                        top: cropData.y,
                        width: cropData.width,
                        height: cropData.height,
                      }
                    ]}
                    {...panResponder.panHandlers}
                  >
                    {/* Crop handles */}
                    <View style={[styles.cropHandle, styles.topLeft]} />
                    <View style={[styles.cropHandle, styles.topRight]} />
                    <View style={[styles.cropHandle, styles.bottomLeft]} />
                    <View style={[styles.cropHandle, styles.bottomRight]} />
                    
                    {/* Grid lines */}
                    <View style={[styles.gridLine, styles.gridLineVertical1]} />
                    <View style={[styles.gridLine, styles.gridLineVertical2]} />
                    <View style={[styles.gridLine, styles.gridLineHorizontal1]} />
                    <View style={[styles.gridLine, styles.gridLineHorizontal2]} />
                  </View>
                  <View style={[styles.overlayArea, { width: imageData.width - cropData.x - cropData.width }]} />
                </View>
                <View style={[styles.overlayArea, { height: imageData.height - cropData.y - cropData.height }]} />
              </View>
            </View>
          )}
        </View>

        <View style={styles.cropControls}>
          <Text style={styles.cropInstructions}>
            Drag the crop area to adjust. Tap Done to apply changes.
          </Text>
          
          {/* Aspect ratio buttons */}
          <View style={styles.aspectRatioContainer}>
            <TouchableOpacity
              style={styles.aspectRatioButton}
              onPress={() => {
                const size = Math.min(imageData.width, imageData.height);
                setCropData({
                  x: (imageData.width - size) / 2,
                  y: (imageData.height - size) / 2,
                  width: size,
                  height: size,
                });
              }}
            >
              <Text style={styles.aspectRatioText}>1:1</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.aspectRatioButton}
              onPress={() => {
                const height = (imageData.width * 4) / 3;
                setCropData({
                  x: 0,
                  y: Math.max(0, (imageData.height - height) / 2),
                  width: imageData.width,
                  height: Math.min(height, imageData.height),
                });
              }}
            >
              <Text style={styles.aspectRatioText}>4:3</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.aspectRatioButton}
              onPress={() => {
                const height = (imageData.width * 9) / 16;
                setCropData({
                  x: 0,
                  y: Math.max(0, (imageData.height - height) / 2),
                  width: imageData.width,
                  height: Math.min(height, imageData.height),
                });
              }}
            >
              <Text style={styles.aspectRatioText}>16:9</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );

  const renderItem = ({ item }) => {
    const selectedItem = selected[0]?.uri === item.uri;
    return (
      <TouchableOpacity onPress={() => handleSelect(item)}>
        <View style={styles.thumbnailContainer}>
          <Image
            source={{ uri: item.uri }}
            style={[styles.thumb, selectedItem && styles.selectedThumb]}
          />
          {isVideo(item) && (
            <View style={styles.videoOverlay}>
              <Icon name="play" size={16} color="#fff" />
              <Text style={styles.duration}>{formatDuration(item.duration)}</Text>
            </View>
          )}
          {selectedItem && <View style={styles.selectedOverlay} />}
          
          {/* Crop button for images */}
          {!isVideo(item) && (
            <TouchableOpacity
              style={styles.cropIcon}
              onPress={() => openCropModal(item)}
            >
              <Icon name="crop" size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {showCamera ? (
        <CameraView
          mode={cameraMode}
          onCapture={handleCameraCapture}
          onCancel={handleCameraCancel}
        />
      ) : (
        <>
          <View style={styles.topBar}>
            <TouchableOpacity>
              <Icon name="close" size={24} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity>
              <Text style={styles.folderTitle}>Recents</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (selected.length > 0) {
                  navigation.navigate('SelectedPost', { images: selected });
                }
              }}
            >
              <Text
                style={[
                  styles.nextBtn,
                  { opacity: selected.length > 0 ? 1 : 0.3 },
                ]}
              >
                Next
              </Text>
            </TouchableOpacity>
          </View>

          {/* Preview */}
          {selected.length > 0 && (
            <View style={styles.previewWrapper}>
              {isVideo(selected[0]) ? (
                <Video
                  source={{ uri: selected[0].uri }}
                  style={styles.previewImage}
                  resizeMode="cover"
                  repeat
                  muted
                />
              ) : (
                <View style={styles.previewImageContainer}>
                  <Image
                    source={{ uri: selected[0].uri }}
                    style={styles.previewImage}
                  />
                  {/* Crop button on preview */}
                  <TouchableOpacity
                    style={styles.previewCropButton}
                    onPress={() => openCropModal(selected[0])}
                  >
                    <Icon name="crop" size={20} color="#fff" />
                    <Text style={styles.previewCropText}>Crop</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Grid */}
          <FlatList
            data={media}
            renderItem={renderItem}
            keyExtractor={(item, i) => i.toString()}
            numColumns={3}
            contentContainerStyle={styles.grid}
          />

          {/* Tab Bar */}
          <View style={styles.tabBar}>
            {['gallery', 'photo', 'video'].map(t => (
              <TouchableOpacity key={t} onPress={() => setTab(t)}>
                <Text style={[styles.tabLabel, tab === t && styles.activeTab]}>
                  {t.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
      
      {/* Crop Modal */}
      {renderCropModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f2fd',},
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  folderTitle: { fontSize: 16, fontWeight: '500', color: '#000' },
  nextBtn: { fontSize: 16, color: '#007AFF' },
  previewWrapper: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#000',
  },
  previewImageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  previewCropButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  previewCropText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 4,
    fontWeight: '500',
  },
  grid: { paddingHorizontal: 4 },
  thumbnailContainer: {
    position: 'relative',
  },
  thumb: {
    width: (SCREEN_WIDTH - 24) / 3,
    aspectRatio: 1,
    margin: 2,
    borderRadius: 6,
  },
  selectedThumb: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  selectedOverlay: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    backgroundColor: 'rgba(0,123,255,0.3)',
    borderRadius: 6,
  },
  chevronIcon: {
    marginLeft: 8,
  },
  videoOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  duration: { color: '#fff', fontSize: 12, marginLeft: 4 },
  cropIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 4,
    borderRadius: 12,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#ddd',
  },
  tabLabel: { fontSize: 14, color: '#999' },
  activeTab: { color: '#000', fontWeight: 'bold', textDecorationLine: 'underline' },
  
  // Crop Modal Styles
  cropContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cropHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  cropButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cropButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  cropDoneText: {
    fontWeight: '600',
  },
  cropTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  cropImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  imageWrapper: {
    position: 'relative',
  },
  cropImage: {
    borderRadius: 8,
  },
  cropOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlayArea: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  cropRow: {
    flexDirection: 'row',
    flex: 1,
  },
  cropArea: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 4,
  },
  cropHandle: {
    position: 'absolute',
    width: 20,
    height: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  topLeft: { top: -10, left: -10 },
  topRight: { top: -10, right: -10 },
  bottomLeft: { bottom: -10, left: -10 },
  bottomRight: { bottom: -10, right: -10 },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  gridLineVertical1: {
    left: '33.33%',
    top: 0,
    bottom: 0,
    width: 1,
  },
  gridLineVertical2: {
    left: '66.66%',
    top: 0,
    bottom: 0,
    width: 1,
  },
  gridLineHorizontal1: {
    top: '33.33%',
    left: 0,
    right: 0,
    height: 1,
  },
  gridLineHorizontal2: {
    top: '66.66%',
    left: 0,
    right: 0,
    height: 1,
  },
  cropControls: {
    backgroundColor: '#fff',
    padding: 16,
  },
  cropInstructions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  aspectRatioContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  aspectRatioButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  aspectRatioText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
});

export default GalleryPickerScreen;