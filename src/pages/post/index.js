import { useFocusEffect, useRoute } from '@react-navigation/native';
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, Alert, ScrollView, Dimensions, Linking, Platform } from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import PostTypeModal from '../../components/modals/PostTypeModal';
import { useAppTheme } from '../../theme/useApptheme';

const { width } = Dimensions.get('window');
const gridItemSize = (width - 48) / 3;
const selectedGridItemSize = (width - 64) / 2;

export default function PostScreen({ navigation }) {
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [galleryImages, setGalleryImages] = useState([]);
  const [showTypeModal, setShowTypeModal] = useState(true);
  const [postType, setPostType] = useState('normal');
  const [shared, setShared] = useState(false);
  const route = useRoute();
  const fromIcon = route?.params?.fromIcon;
  const { bgStyle, textStyle, text } = useAppTheme();

  const mergeGalleryImages = (newAssets, existingGallery, selectedItems) => {
    const existingUris = new Set(existingGallery.map(img => img.uri));
    const selectedUris = new Set(selectedItems.map(item => item.uri));

    const newUniqueImages = newAssets.filter(asset => !existingUris.has(asset.uri));
    const mergedImages = [...newUniqueImages, ...existingGallery];

    return mergedImages.map(image => ({
      ...image,
      isSelected: selectedUris.has(image.uri)
    }));
  };

  const cropImage = (imageUri, index) => {
    ImagePicker.openCropper({
      path: imageUri,
      width: 800,
      height: 800,
      cropping: true,
      cropperActiveWidgetColor: '#0095f6',
      cropperStatusBarColor: '#0095f6',
      cropperToolbarColor: '#0095f6',
      cropperToolbarWidgetColor: '#ffffff',
      freeStyleCropEnabled: true,
      showCropGuidelines: true,
      showCropFrame: true,
      hideBottomControls: false,
      enableRotationGesture: true,
      compressImageQuality: 0.8,
    })
      .then((croppedImage) => {
        setSelectedMedia(prev => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            uri: croppedImage.path,
            originalUri: imageUri,
            isCropped: true,
            width: croppedImage.width,
            height: croppedImage.height,
          };
          return updated;
        });
      })
      .catch((error) => {
        if (error.code !== 'E_PICKER_CANCELLED') {
          Alert.alert('Crop Error', 'Could not crop the image. Please try again.');
        }
      });
  };

  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const showPermissionDeniedAlert = (type = 'gallery') => {
    const title = type === 'gallery' ? 'Photo Library Permission Required' : 'Camera Permission Required';
    const message = type === 'gallery'
      ? 'Please grant photo library access in Settings to select photos and videos.'
      : 'Please grant camera access in Settings to take photos and videos.';

    Alert.alert(
      title,
      message,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Open Settings',
          onPress: openSettings,
        },
      ]
    );
  };

  const openGallery = () => {
    const remainingSlots = 10 - (selectedMedia?.length || 0);

    ImagePicker.openPicker({
      mediaType: postType === 'flip' ? 'video' : 'any',
      multiple: postType !== 'flip', // single video in flip mode
      maxFiles: postType === 'flip' ? 1 : remainingSlots > 0 ? remainingSlots : 1,
      includeBase64: false,
      compressImageQuality: 0.8,
      cropping: false,
    })
      .then((response) => {
        if (!response) return;

        const assets = Array.isArray(response) ? response : [response];

        // 🧠 For Flip posts: validate duration
        let validAssets = assets;
        if (postType === 'flip') {
          validAssets = assets.filter((asset) => {
            const durationMs = asset?.duration ?? 0;
            const durationSec = durationMs > 1000 ? durationMs / 1000 : durationMs;

            if (durationSec < 15) {
              Alert.alert('Short Video', 'Please select a video of at least 15 seconds.');
              return false;
            } else if (durationSec > 60) {
              Alert.alert('Long Video', 'Please select a video shorter than 60 seconds.');
              return false;
            }
            return true;
          });

          if (validAssets.length === 0) return;
        }

        // ✅ Create new asset objects
        const newAssets = validAssets.map((asset) => ({
          uri: asset.path,
          type: asset.mime,
          fileName:
            asset.filename || `video_${Date.now()}.${asset.mime?.includes('video') ? 'mp4' : 'jpg'}`,
          duration: asset.duration || 0,
          width: asset.width,
          height: asset.height,
          isCropped: false,
        }));

        // ✅ Merge with existing selection
        const currentSelection = selectedMedia || [];
        const filteredNewAssets = newAssets.filter(
          (newAsset) => !currentSelection.some((existing) => existing.uri === newAsset.uri)
        );
        const totalSelection = [...currentSelection, ...filteredNewAssets];

        if (totalSelection.length > 10) {
          setSelectedMedia(totalSelection.slice(0, 10));
          Alert.alert('Selection Limit', 'Only first 10 items were selected due to limit.');
        } else {
          setSelectedMedia(totalSelection);
        }

        // ✅ Update gallery
        const sampleImages = [
          ...newAssets,
          ...Array.from({ length: 8 }, (_, i) => ({
            ...newAssets[0],
            uri: `${newAssets[0].uri}_sample_${i}`,
            fileName: `sample_${i}.jpg`,
          })),
        ];

        const updatedGalleryImages = mergeGalleryImages(
          sampleImages,
          galleryImages,
          totalSelection.length <= 10 ? totalSelection : totalSelection.slice(0, 10)
        );

        setGalleryImages(updatedGalleryImages);
      })
      .catch((error) => {
        console.log('Gallery error:', error);

        if (error.code === 'E_PICKER_CANCELLED') {
          if ((!selectedMedia || selectedMedia.length === 0) && navigation?.goBack) {
            navigation.goBack();
          } else if (selectedMedia.length === 0) {
            Alert.alert('No media selected', 'You must select photos or videos to create a post.');
          }
        } else if (
          error.code === 'E_NO_LIBRARY_PERMISSION' ||
          error.message?.includes('permission')
        ) {
          showPermissionDeniedAlert('gallery');
        } else {
          Alert.alert('Error', error.message || 'Could not open gallery.');
        }
      });
  };

  const openCamera = () => {
    const remainingSlots = 10 - (selectedMedia?.length || 0);

    if (remainingSlots <= 0) {
      Alert.alert('Selection Limit', 'You have already selected the maximum number of items (10).');
      return;
    }
    if (postType === 'flip') {
      // Only allow video capture in Flip mode
      captureMedia('video');
      return;
    }

    Alert.alert(
      'Camera Options',
      'What would you like to capture?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Photo',
          onPress: () => captureMedia('photo'),
        },
        {
          text: 'Video',
          onPress: () => captureMedia('video'),
        },
      ],
      { cancelable: true }
    );
  };

  const captureMedia = (mediaType) => {
    const options = {
      mediaType,
      includeBase64: false,
      compressImageQuality: 0.8,
      cropping: false,
    };

    // Optional upper recording time limit
    if (mediaType === 'video') {
      options.durationLimit = postType === 'flip' ? 60 : 300; // 60s for flips, 5min otherwise
    }

    ImagePicker.openCamera(options)
      .then((response) => {
        if (!response) return;

        // 🧠 Duration validation for Flip-type videos
        if (mediaType === 'video' && postType === 'flip') {
          const duration = response?.duration || 0; // milliseconds or seconds depending on platform

          // Sometimes ImagePicker returns duration in seconds — normalize to seconds
          const durationSec = duration > 1000 ? duration / 1000 : duration;

          if (durationSec < 15) {
            Alert.alert('Short Video', 'Please record at least 15 seconds.');
            return;
          }

          if (durationSec > 60) {
            Alert.alert('Long Video', 'Please record less than 60 seconds.');
            return;
          }
        }

        // ✅ Create new asset object
        const newAsset = {
          uri: response.path,
          type: response.mime,
          fileName:
            response.filename ||
            `${mediaType}_${Date.now()}.${mediaType === 'photo' ? 'jpg' : 'mp4'
            }`,
          duration: response.duration || 0,
          width: response.width,
          height: response.height,
          isCropped: false,
        };

        // ✅ Handle selection logic
        const currentSelection = selectedMedia || [];
        const totalSelection = [...currentSelection, newAsset];

        if (totalSelection.length > 10) {
          Alert.alert('Selection Limit', 'Cannot add more items. Maximum limit is 10.');
          return;
        }

        setSelectedMedia(totalSelection);

        // ✅ Sample images for preview UI (optional)
        if (galleryImages.length === 0) {
          const sampleRecentImages = [
            newAsset,
            ...Array.from({ length: 8 }, (_, i) => ({
              ...newAsset,
              uri: `${newAsset.uri}_sample_${i}`,
              fileName: `sample_${i}.jpg`,
            })),
          ];
          setGalleryImages(sampleRecentImages);
        }
      })
      .catch((err) => {
        console.log('Camera cancelled or error:', err);
      });
  };

  useFocusEffect(
    useCallback(() => {
      if (fromIcon === 'Flips') {
        setShowTypeModal(false);
        setPostType('flip');
      } else {
        setShowTypeModal(true);
      }
    }, [fromIcon])
  );

  useFocusEffect(
    useCallback(() => {
      if (galleryImages.length > 0) {
        const selectedUris = new Set((selectedMedia || []).map(item => item.uri));
        const updatedGalleryImages = galleryImages.map(image => ({
          ...image,
          isSelected: selectedUris.has(image.uri)
        }));
        setGalleryImages(updatedGalleryImages);
      }
    }, [selectedMedia])
  );

  const handleImageSelect = (asset) => {
    const currentSelection = selectedMedia || [];
    const isSelected = currentSelection.some(media => media.uri === asset.uri);

    if (isSelected) {
      setSelectedMedia(prev => (prev || []).filter(media => media.uri !== asset.uri));
    } else {
      if (currentSelection.length < 10) {
        const newMedia = {
          uri: asset.uri,
          type: asset.type,
          fileName: asset.fileName,
          duration: asset.duration,
          isCropped: false,
        };
        setSelectedMedia(prev => [...(prev || []), newMedia]);
      } else {
        Alert.alert('Selection Limit', 'You can select up to 10 items only.');
      }
    }
  };

  const handleShare = () => {
    const currentSelection = selectedMedia || [];
    if (currentSelection.length === 0) {
      Alert.alert('No media selected', 'Please select at least one photo or video to share.');
      return;
    }
    navigation.navigate('SelectedPost', { selectedMedia: currentSelection, postType: postType, fromIcon: fromIcon });
  };

  const renderGridItem = (asset, index) => {
    const currentSelection = selectedMedia || [];
    const isSelected = currentSelection.some(media => media.uri === asset.uri);
    const selectionOrder = currentSelection.findIndex(media => media.uri === asset.uri) + 1;

    return (
      <TouchableOpacity
        key={`${asset.uri}_${index}`}
        style={[
          styles.gridItem,
          {
            borderColor: isSelected ? text : 'transparent',
            borderWidth: isSelected ? 3 : 2
          }
        ]}
        onPress={() => handleImageSelect(asset)}
      >
        {asset.type && asset.type.startsWith('video') ? (
          <View style={styles.videoGridItem}>
            <Image source={{ uri: asset.uri }} style={styles.gridImage} />
            <View style={styles.videoDurationBadge}>
              <Icon name="videocam" size={12} color="#fff" />
              <Text style={styles.videoDurationText}>
                {asset.duration ? Math.floor(asset.duration / 1000) + 's' : '0:00'}
              </Text>
            </View>
          </View>
        ) : (
          <Image source={{ uri: asset.uri }} style={styles.gridImage} />
        )}
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <View style={[styles.selectionNumber, { backgroundColor: text }]}>
              <Text style={styles.selectionNumberText}>{selectionOrder}</Text>
            </View>
          </View>
        )}
        {isSelected && (
          <View style={styles.selectedOverlay} />
        )}
      </TouchableOpacity>
    );
  };

  const renderSelectedMediaGrid = () => {
    const currentSelection = selectedMedia || [];
    if (currentSelection.length === 0) return null;

    return (
      <View style={[styles.selectedMediaSection, bgStyle]}>
        <Text style={styles.selectedMediaTitle}>Selected Media</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.selectedMediaScrollContainer}
          style={styles.selectedMediaScroll}
        >
          {currentSelection.map((media, index) => (
            <View key={`selected_${media.uri}_${index}`} style={styles.selectedGridItemHorizontal}>
              {media.type && media.type.startsWith('video') ? (
                <View style={styles.selectedVideoItem}>
                  <Image source={{ uri: media.uri }} style={styles.selectedGridImageHorizontal} />
                  <View style={styles.selectedVideoPlay}>
                    <Icon name="play" size={20} color="#fff" />
                  </View>
                  <View style={styles.selectedVideoDurationBadge}>
                    <Icon name="videocam" size={10} color="#fff" />
                    <Text style={styles.selectedVideoDurationText}>
                      {media.duration ? Math.floor(media.duration / 1000) + 's' : '0:00'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.selectedImageContainer}>
                  <Image source={{ uri: media.uri }} style={styles.selectedGridImageHorizontal} />
                  <TouchableOpacity
                    style={styles.cropButton}
                    onPress={() => cropImage(media.uri, index)}
                  >
                    <Icon name="crop" size={16} color="#fff" />
                  </TouchableOpacity>
                  {media.isCropped && (
                    <View style={styles.croppedIndicator}>
                      <Icon name="checkmark-circle" size={16} color="#4CAF50" />
                    </View>
                  )}
                </View>
              )}
              <TouchableOpacity
                style={styles.selectedRemoveButton}
                onPress={() => setSelectedMedia(prev => (prev || []).filter((_, i) => i !== index))}
              >
                <Icon name="close-circle" size={20} color="#ff3040" />
              </TouchableOpacity>
              <View style={[styles.selectedOrderIndicator, {backgroundColor: text}]}>
                <Text style={styles.selectedOrderText}>{index + 1}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderInitialGalleryPrompt = () => (
    <View style={styles.galleryPrompt}>
      <TouchableOpacity style={styles.galleryButton} onPress={openGallery}>
        <Icon name="images" size={60} color={text} />
        <Text style={[styles.galleryButtonText, textStyle]}>Select from Gallery</Text>
        <Text style={styles.galleryButtonSubtext}>Choose photos and videos (up to 10)</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.galleryButton} onPress={openCamera}>
        <Icon name="camera" size={60} color={text} />
        <Text style={[styles.galleryButtonText, textStyle]}>Capture with Camera</Text>
        <Text style={styles.galleryButtonSubtext}>Take photos or record videos (up to 10)</Text>
      </TouchableOpacity>
    </View>
  );

  const renderMainContent = () => (
    <>
      {selectedMedia && selectedMedia.length > 0 && (
        <View style={[styles.selectionCounter, { shadowColor: text }]}>
          <Text style={[styles.selectionCounterText, textStyle]}>
            {selectedMedia.length} item{selectedMedia.length > 1 ? 's' : ''} selected
            {selectedMedia.length < 10 && ` (${10 - selectedMedia.length} more available)`}
          </Text>
        </View>
      )}

      {renderSelectedMediaGrid()}

      {selectedMedia && selectedMedia.length < 10 && (
        <View style={styles.addMoreSection}>
          <TouchableOpacity style={[styles.addMoreButton, { shadowColor: text }]} onPress={openGallery}>
            <Icon name="images" size={24} color={text} />
            <Text style={[styles.addMoreText, textStyle]}>
              Add from Gallery
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[[styles.addMoreButton, { shadowColor: text }], { marginTop: 12 }]} onPress={openCamera}>
            <Icon name="camera" size={24} color={text} />
            <Text style={[styles.addMoreText, textStyle]}>
              Capture with Camera
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  const handleSelectType = (type) => {
    setPostType(type);
    console.log('User chose post type:', type);
  };

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <View style={[styles.headerRow, bgStyle, { shadowColor: text }]}>
        <TouchableOpacity
          onPress={() => {
            if (navigation && navigation.goBack) navigation.goBack();
          }}
          style={styles.headerIconBtn}
        >
          <Icon name="close" size={26} color="#222" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]}>{fromIcon === 'Flips' ? 'New Flip' : 'New Mint'}</Text>
        <TouchableOpacity
          onPress={handleShare}
          style={[styles.headerShareBtn, { backgroundColor: text, shadowColor: text, opacity: (selectedMedia && selectedMedia.length > 0) && !shared ? 1 : 0.5 }]}
          disabled={!selectedMedia || selectedMedia.length === 0 || shared}
        >
          <Text style={styles.headerShareText}>Next</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {galleryImages.length === 0 ? renderInitialGalleryPrompt() : renderMainContent()}
      </ScrollView>
      <PostTypeModal
        visible={showTypeModal}
        setShowTypeModal={setShowTypeModal}
        onClose={() => { setShowTypeModal(false); navigation.goBack(); }}
        onSelect={handleSelectType}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#dbdbdb',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  headerIconBtn: {
    padding: 4,
  },
  headerTitle: {
    fontWeight: 'bold',
    fontSize: 17,
    flex: 1,
    textAlign: 'center',
    // marginLeft: -30,
  },
  headerShareBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  headerShareText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  selectionCounter: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  selectionCounterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectedMediaTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginBottom: 12,
    marginLeft: 15
  },
  selectedMediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  selectedGridItem: {
    width: selectedGridItemSize,
    height: selectedGridItemSize,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f8f9fa',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  selectedGridImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  selectedVideoItem: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  selectedImageContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  cropButton: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  croppedIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  selectedVideoDurationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedVideoDurationText: {
    color: '#fff',
    fontSize: 11,
    marginLeft: 3,
    fontWeight: '600',
  },
  selectedOrderText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  captionInput: {
    width: '90%',
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#222',
    marginTop: 18,
    alignSelf: 'center',
    marginBottom: 24,
  },
  addMoreSection: {
    marginHorizontal: 16,
    marginBottom: 24,
    marginTop: 20
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  addMoreText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  recentsSection: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  recentsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginBottom: 12,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: gridItemSize,
    height: gridItemSize,
    marginBottom: 2,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoGridItem: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  videoDurationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoDurationText: {
    color: '#fff',
    fontSize: 10,
    marginLeft: 2,
    fontWeight: '500',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  selectionNumber: {
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  selectionNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  selectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(90, 45, 130, 0.1)',
  },
  galleryPrompt: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: '20%'
  },
  galleryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginBottom: 30,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
    width: '100%',
    maxWidth: 280,
  },
  galleryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 4,
  },
  galleryButtonSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  selectedMediaScroll: {
    marginTop: 4,
  },
  selectedMediaScrollContainer: {
    paddingHorizontal: 16,
    paddingRight: 32,
  },
  selectedMediaSection: {
    marginTop: 16,
  },
  selectedGridItemHorizontal: {
    width: 170,
    height: 170,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f8f9fa',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  selectedGridImageHorizontal: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  selectedVideoPlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -10 }, { translateY: -10 }],
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedRemoveButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#fff',
    borderRadius: 10, // Smaller radius
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  selectedOrderIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
});