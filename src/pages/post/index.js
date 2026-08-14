import { useFocusEffect, useRoute } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Pressable, TextInput, Alert, ScrollView, Dimensions, Linking, Platform, DeviceEventEmitter } from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';
import Video from 'react-native-video';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import PostTypeModal from '../../components/modals/PostTypeModal';
import { useAppTheme } from '../../theme/useApptheme';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { useLanguage } from '../../i18n';

const { width, height: screenHeight } = Dimensions.get('window');
const FLIP_HEADER_HEIGHT = 58;
const gridItemSize = (width - 48) / 3;
const selectedGridItemSize = (width - 64) / 2;
const selectedPreviewWidth = width * 0.92;
const maxSelectedPreviewHeight = screenHeight * 0.5;

const getPreviewHeightForMedia = (media) => {
  const mediaWidth = Number(media?.width);
  const mediaHeight = Number(media?.height);
  if (!mediaWidth || !mediaHeight) {
    return maxSelectedPreviewHeight;
  }
  const aspectHeight = (selectedPreviewWidth * mediaHeight) / mediaWidth;
  return Math.min(maxSelectedPreviewHeight, Math.max(selectedPreviewWidth * 0.35, aspectHeight));
};

const normalizePreviewVideoUri = (uri) => {
  if (!uri || typeof uri !== 'string') return '';
  const trimmed = uri.trim();
  if (
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) return `file://${trimmed}`;
  return trimmed;
};

export default function PostScreen({ navigation }) {
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [galleryImages, setGalleryImages] = useState([]);
  const [showTypeModal, setShowTypeModal] = useState(true);
  const [isCropping, setIsCropping] = useState(false);
  const [postType, setPostType] = useState('normal');
  const [visibleTo, setVisibleTo] = useState('');
  const [shared, setShared] = useState(false);
  const [flipVideoPaused, setFlipVideoPaused] = useState(false);
  const route = useRoute();
  const returnTo = route?.params?.returnTo;
  const rawPostTypeParam = route?.params?.postType;
  const rawMediaTypeParam = route?.params?.type;
  const isPrivateEntry = String(rawPostTypeParam || '').toLowerCase() === 'private';
  const isFlipEntry = String(rawMediaTypeParam || '').toLowerCase() === 'flips';
  const mediaType = rawMediaTypeParam;
  console.log('mediaTypemediaType',mediaType)
  console.log("isFlipEntryisFlipEntry",isFlipEntry)
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const isFlipWithVideo =
    postType === 'flip' && (selectedMedia?.length || 0) > 0;

  const flipPreviewHeight = useMemo(
    () =>
      Math.max(
        width * 1.2,
        screenHeight - insets.top - FLIP_HEADER_HEIGHT - tabBarHeight,
      ),
    [insets.top, tabBarHeight],
  );

  const { bgStyle, textStyle, text, card, cardStyle, border, mutedText, icon, accent } = useAppTheme();
  const dispatch = useDispatch();
  const { t } = useLanguage();

  // Track if we're coming back from EditPostSelected
  const fromEditPostSelectedRef = useRef(false);
  const flipVideoRef = useRef(null);

  const clearUploadState = useCallback(() => {
    fromEditPostSelectedRef.current = false;
    setSelectedMedia([]);
    setGalleryImages([]);
    setShared(false);
  }, []);


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
  setIsCropping(true); // unmount PostTypeModal completely

  setTimeout(() => {
    ImagePicker.openCropper({
  path: imageUri,
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
  compressImageQuality: 0.6,
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
        Alert.alert(t('post.cropError'), t('post.cropErrorMessage'));
      }
    })
    .finally(() => {
      setIsCropping(false); // remount PostTypeModal after cropper closes
    });
  }, 300);
};

  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const showPermissionDeniedAlert = (type = 'gallery') => {
    const title = type === 'gallery'
      ? t('post.permissionGalleryTitle')
      : t('post.permissionCameraTitle');
    const message = type === 'gallery'
      ? t('post.permissionGalleryMessage')
      : t('post.permissionCameraMessage');

    Alert.alert(
      title,
      message,
      [
        {
          text: t('post.cancel'),
          style: 'cancel',
        },
        {
          text: t('post.openSettings'),
          onPress: openSettings,
        },
      ]
    );
  };

  const openGallery = () => {
    const remainingSlots = 10 - (selectedMedia?.length || 0);
    const isFlip = postType === 'flip' || mediaType == 'video' || mediaType == 'Flips';
    dispatch(showLoader());
    ImagePicker.openPicker({
      mediaType: isFlip ? 'video' : 'any',
      multiple: !isFlip,
      maxFiles: isFlip ? 1 : remainingSlots > 0 ? remainingSlots : 1,
      includeBase64: false,
      compressImageQuality: 0.6,
      cropping: false,
    })
      .then((response) => {
        if (!response) {
          dispatch(hideLoader());
          return;
        }
        dispatch(hideLoader());
        const assets = Array.isArray(response) ? response : [response];

        let validAssets = assets;
        validAssets = assets.filter((asset) => {
          const isVideo = asset?.mime?.includes('video');

          if (postType === 'flip' && !isVideo) {
            Alert.alert(t('post.videoOnlyTitle'), t('post.videoOnlyFlipMessage'));
            return false;
          }

          if (!isVideo) return true;

          const durationMs = asset?.duration ?? 0;
          const durationSec = durationMs > 1000 ? durationMs / 1000 : durationMs;

          if (postType === 'flip') {
            if (durationSec < 14) {
              Alert.alert(t('post.shortVideoTitle'), t('post.shortVideoFlipMessage'));
              return false;
            }
            if (durationSec > 60) {
              Alert.alert(t('post.longVideoTitle'), t('post.longVideoFlipMessage'));
              return false;
            }
            return true;
          }

          if (durationSec > 600) {
            Alert.alert(t('post.longVideoTitle'), t('post.longVideoMessage'));
            return false;
          }

          return true;
        });

        if (validAssets.length === 0) {
          dispatch(hideLoader());
          return;
        }

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

        const currentSelection = selectedMedia || [];
        const filteredNewAssets = newAssets.filter(
          (newAsset) => !currentSelection.some((existing) => existing.uri === newAsset.uri)
        );

        const totalSelection =
          postType === 'flip' ? filteredNewAssets.slice(0, 1) : [...currentSelection, ...filteredNewAssets];

        if (postType !== 'flip' && totalSelection.length > 10) {
          setSelectedMedia(totalSelection.slice(0, 10));
          Alert.alert(t('post.selectionLimitTitle'), t('post.selectionLimitMessage'));
        } else {
          setSelectedMedia(totalSelection);
        }

        const updatedGalleryImages =
          postType === 'flip'
            ? mergeGalleryImages(newAssets, galleryImages, totalSelection)
            : mergeGalleryImages(
              [
                ...newAssets,
                ...Array.from({ length: 8 }, (_, i) => ({
                  ...newAssets[0],
                  uri: `${newAssets[0].uri}_sample_${i}`,
                  fileName: `sample_${i}.jpg`,
                })),
              ],
              galleryImages,
              totalSelection.length <= 10 ? totalSelection : totalSelection.slice(0, 10)
            );

        setGalleryImages(updatedGalleryImages);
        dispatch(hideLoader());
      })
      .catch((error) => {
        console.log('Gallery error:', error);
        dispatch(hideLoader());

        if (error.code === 'E_PICKER_CANCELLED') {
          return;
        } else if (
          error.code === 'E_NO_LIBRARY_PERMISSION' ||
          error.message?.includes('permission')
        ) {
          showPermissionDeniedAlert('gallery');
        } else {
          Alert.alert(t('post.errorTitle'), error.message || t('post.galleryOpenError'));
        }
      });
  };

  const openCamera = () => {
    const remainingSlots = 10 - (selectedMedia?.length || 0);

    if (remainingSlots <= 0) {
      Alert.alert(t('post.selectionLimitTitle'), t('post.selectionLimitReachedMessage'));
      return;
    }
    if (postType === 'flip' || mediaType == 'video' || mediaType == 'Flips') {
      captureMedia('video');
      return;
    }

    Alert.alert(
      t('post.cameraOptionsTitle'),
      t('post.cameraOptionsMessage'),
      [
        {
          text: t('post.cancel'),
          style: 'cancel',
        },
        {
          text: t('post.photo'),
          onPress: () => captureMedia('photo'),
        },
        {
          text: t('post.video'),
          onPress: () => captureMedia('video'),
        },
      ],
      { cancelable: true }
    );
  };

  const captureMedia = (mediaType) => {
    if (postType === 'flip' && mediaType !== 'video') {
      Alert.alert(t('post.videoOnlyTitle'), t('post.videoOnlyFlipMessage'));
      return;
    }

    dispatch(showLoader());
    const options = {
      mediaType,
      includeBase64: false,
      compressImageQuality: 0.6,
      cropping: false,
    };

    if (mediaType === 'video') {
      options.durationLimit = postType === 'flip' ? 60 : 600;
    }

    ImagePicker.openCamera(options)
      .then((response) => {
        if (!response) {
          dispatch(hideLoader());
          return;
        }
        dispatch(hideLoader());

        if (mediaType === 'video') {
          const duration = response?.duration || 0;
          const durationSec = duration > 1000 ? duration / 1000 : duration;

          if (postType === 'flip') {
            if (durationSec < 15) {
              dispatch(hideLoader());
              Alert.alert(t('post.shortVideoTitle'), t('post.shortVideoRecordMessage'));
              return;
            }

            if (durationSec > 60) {
              dispatch(hideLoader());
              Alert.alert(t('post.longVideoTitle'), t('post.longVideoRecordFlipMessage'));
              return;
            }
          } else if (durationSec > 600) {
            dispatch(hideLoader());
            Alert.alert(t('post.longVideoTitle'), t('post.longVideoRecordMessage'));
            return;
          }
        }

        const newAsset = {
          uri: response.path,
          type: response.mime,
          fileName:
            response.filename ||
            `${mediaType}_${Date.now()}.${mediaType === 'photo' ? 'jpg' : 'mp4'}`,
          duration: response.duration || 0,
          width: response.width,
          height: response.height,
          isCropped: false,
        };

        const currentSelection = selectedMedia || [];
        const totalSelection = postType === 'flip' ? [newAsset] : [...currentSelection, newAsset];

        if (postType !== 'flip' && totalSelection.length > 10) {
          dispatch(hideLoader());
          Alert.alert(t('post.selectionLimitTitle'), t('post.selectionLimitAddMessage'));
          return;
        }

        setSelectedMedia(totalSelection);

        if (postType === 'flip') {
          const updatedGalleryImages = mergeGalleryImages([newAsset], galleryImages, totalSelection);
          setGalleryImages(updatedGalleryImages);
        } else if (galleryImages.length === 0) {
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
        dispatch(hideLoader());

      })
      .catch((err) => {
        console.log('Camera cancelled or error:', err);
        dispatch(hideLoader());
      });
  };

  useFocusEffect(
    useCallback(() => {
      if (fromEditPostSelectedRef.current) {
        fromEditPostSelectedRef.current = false;
        return;
      }

      clearUploadState();

      if (isPrivateEntry) {
        setPostType('private');
        setShowTypeModal(false);
        return;
      }

      if (isFlipEntry) {
        setPostType('flip');
        setShowTypeModal(false);
        return;
      }

      setPostType('normal');
      setShowTypeModal(true);
    }, [clearUploadState, isPrivateEntry, isFlipEntry])
  );

  useEffect(() => {
    if (!selectedMedia?.[0]?.uri) return;
    setFlipVideoPaused(false);
  }, [selectedMedia?.[0]?.uri]);

  useFocusEffect(
    useCallback(() => {
      return () => setFlipVideoPaused(true);
    }, []),
  );

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('POST_UPLOAD_RESET', clearUploadState);
    return () => subscription.remove();
  }, [clearUploadState]);

  const galleryImagesRef = useRef([]);

  useEffect(() => {
    galleryImagesRef.current = galleryImages;
  }, [galleryImages]);

  useEffect(() => {
    if (!route.params?.privateCircleReady) return;
    setPostType('private');
    setVisibleTo('private_circle');
    setShowTypeModal(false);
    navigation.setParams({
      privateCircleReady: undefined,
      privateCircleMemberIds: undefined,
    });
  }, [route.params?.privateCircleReady, navigation]);

  useEffect(() => {
    if (galleryImagesRef.current.length === 0) return;

    const selectedUris = new Set((selectedMedia || []).map(item => item.uri));
    const updatedGalleryImages = galleryImagesRef.current.map(image => ({
      ...image,
      isSelected: selectedUris.has(image.uri)
    }));
    setGalleryImages(updatedGalleryImages);
  }, [selectedMedia]);

  const handleImageSelect = (asset) => {
    const isFlip = postType === 'flip';

    if (isFlip) {
      const isVideo = asset?.type?.startsWith('video');
      if (!isVideo) {
        Alert.alert(t('post.videoOnlyTitle'), t('post.videoOnlyFlipMessage'));
        return;
      }

      const newMedia = {
        uri: asset.uri,
        type: asset.type,
        fileName: asset.fileName,
        duration: asset.duration,
        isCropped: false,
      };
      setSelectedMedia([newMedia]);
      return;
    }
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
        Alert.alert(t('post.selectionLimitTitle'), t('post.selectionLimitTenMessage'));
      }
    }
  };

  const handleShare = () => {
    const currentSelection = selectedMedia || [];
    if (currentSelection.length === 0) {
      Alert.alert(
        t('post.noMediaTitle'),
        postType === 'flip' ? t('post.flipNoMediaMessage') : t('post.noMediaMessage'),
      );
      return;
    }
    fromEditPostSelectedRef.current = true;
    navigation.navigate('SelectedPost', { selectedMedia: currentSelection, postType: postType, fromIcon: mediaType, visibleTo: visibleTo, });
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
            <Image source={{ uri: asset.uri }} style={styles.gridImage} resizeMode='cover' />
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
            <View style={[styles.selectionNumber, { backgroundColor: accent }]}>
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

  const toggleFlipVideoPlayback = useCallback(() => {
    setFlipVideoPaused(prev => !prev);
  }, []);

  const renderFlipVideoPreview = () => {
    const media = selectedMedia?.[0];
    if (!media) return null;

    const videoUri = normalizePreviewVideoUri(media.uri);

    return (
      <View style={[styles.flipFullScreenContainer, { height: flipPreviewHeight, backgroundColor: bgStyle?.backgroundColor || '#f8f2fd' }]}>
        <Video
          ref={flipVideoRef}
          source={{ uri: videoUri }}
          style={styles.flipFullScreenVideo}
          paused={flipVideoPaused}
          muted
          repeat
          resizeMode="cover"
          posterResizeMode="cover"
          ignoreSilentSwitch="ignore"
          playWhenInactive={false}
          playInBackground={false}
          controls={false}
          onLoad={() => setFlipVideoPaused(false)}
          onError={(error) => {
            console.log('Flip preview video error:', error);
            setFlipVideoPaused(true);
          }}
        />
        <Pressable
          style={styles.flipTapLayer}
          onPress={toggleFlipVideoPlayback}
          accessibilityRole="button"
          accessibilityLabel={flipVideoPaused ? 'Play video' : 'Pause video'}
        >
          {flipVideoPaused ? (
            <View style={styles.flipPlayOverlay} pointerEvents="none">
              <Icon name="play" size={28} color="#fff" />
            </View>
          ) : null}
        </Pressable>
        <View style={styles.flipDurationBadge} pointerEvents="none">
          <Icon name="videocam" size={12} color="#fff" />
          <Text style={styles.selectedVideoDurationText}>
            {media.duration ? `${Math.floor(media.duration / 1000)}s` : '0:00'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.flipRemoveButton}
          onPress={() => {
            setFlipVideoPaused(true);
            setSelectedMedia([]);
            setGalleryImages([]);
          }}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Icon name="close-circle" size={28} color="#ff3040" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderSelectedMediaGrid = () => {
    const currentSelection = selectedMedia || [];
    if (currentSelection.length === 0) return null;

    return (
      <View style={[styles.selectedMediaSection, bgStyle]}>
        <Text style={[styles.selectedMediaTitle, textStyle]}>{t('post.selectedMedia')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.selectedMediaScrollContainer}
          style={styles.selectedMediaScroll}
        >
          {currentSelection.map((media, index) => {
            const isVideoMedia = media?.type && media.type.startsWith('video');
            const isHorizontalVideo =
              isVideoMedia &&
              Number(media?.width) > 0 &&
              Number(media?.height) > 0 &&
              Number(media.width) > Number(media.height);
            const previewHeight =
              postType === 'flip' || isHorizontalVideo
                ? screenHeight * .50
                : getPreviewHeightForMedia(media);
            return (
            <View
              key={`selected_${media.uri}_${index}`}
              style={[styles.selectedGridItemHorizontal, { height: previewHeight }]}
            >
              {isVideoMedia ? (
                <View style={styles.selectedVideoItem}>
                  <Video
                    source={{ uri: media.uri }}
                    style={[styles.selectedGridImageHorizontal, { height: previewHeight }]}
                    paused={true}
                    muted={true}
                    repeat={false}
                    resizeMode="cover"
                  />
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
                  <Image
                    source={{ uri: media.uri }}
                    style={[styles.selectedGridImageHorizontal, { height: previewHeight }]}
                    resizeMode="contain"
                  />
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
              <View style={[styles.selectedOrderIndicator, { backgroundColor: accent }]}>
                <Text style={styles.selectedOrderText}>{index + 1}</Text>
              </View>
            </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderInitialGalleryPrompt = () => (
    <View style={styles.galleryPrompt}>
      <TouchableOpacity
        style={[styles.galleryButton, cardStyle, { borderColor: border }]}
        onPress={openGallery}
      >
        <Icon name="images" size={60} color={accent} />
        <Text style={[styles.galleryButtonText, textStyle]}>{t('post.selectFromGallery')}</Text>
        <Text style={[styles.galleryButtonSubtext, { color: mutedText }]}>
          {postType === 'flip' ? t('post.flipGallerySubtext') : t('post.gallerySubtext')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.galleryButton, cardStyle, { borderColor: border }]}
        onPress={openCamera}
      >
        <Icon name="camera" size={60} color={accent} />
        <Text style={[styles.galleryButtonText, textStyle]}>{t('post.captureWithCamera')}</Text>
        <Text style={[styles.galleryButtonSubtext, { color: mutedText }]}>
          {postType === 'flip' ? t('post.flipCameraSubtext') : t('post.cameraSubtext')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderMainContent = () => {
    if (isFlipWithVideo) {
      return renderFlipVideoPreview();
    }

    return (
    <>
      {selectedMedia && selectedMedia.length > 0 && postType !== 'flip' && (
        <View style={[styles.selectionCounter, cardStyle, { shadowColor: text }]}>
          <Text style={[styles.selectionCounterText, textStyle]}>
            {t('post.itemsSelected', { count: selectedMedia.length })}
            {selectedMedia.length < 10 && ` (${10 - selectedMedia.length} ${t('post.moreAvailable')})`}
          </Text>
        </View>
      )}

      {renderSelectedMediaGrid()}

      {selectedMedia && selectedMedia.length < 10 && postType !== 'flip' && (
        <View style={[styles.addMoreSection, { marginTop: 0 }]}>
          <TouchableOpacity
            style={[styles.addMoreButton, cardStyle, { borderColor: border, shadowColor: text, marginTop: 10 }]}
            onPress={openGallery}
          >
            <Icon name="images" size={24} color={accent} />
            <Text style={[styles.addMoreText, textStyle]}>
              {t('post.addFromGallery')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addMoreButton, cardStyle, { borderColor: border, shadowColor: text, marginBottom: '20%', marginTop: 10 }]}
            onPress={openCamera}
          >
            <Icon name="camera" size={24} color={accent} />
            <Text style={[styles.addMoreText, textStyle]}>
              {t('post.captureWithCamera')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </>
    );
  };

  const handleSelectType = (type) => {
    setPostType(type);
    console.log('User chose post type:', type);
  };

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <View style={[styles.headerRow, bgStyle, { shadowColor: text, borderBottomColor: border }]}>
        <TouchableOpacity
          onPress={() => {
            setShowTypeModal(true);
            // if (navigation.canGoBack()) {
            //   navigation.goBack();
            //   return;
            // }

            // if (returnTo && typeof returnTo === 'object' && returnTo?.tab) {
            //   navigation.navigate(returnTo.tab);
            //   return;
            // }

            // if (typeof returnTo === 'string' && returnTo.length) {
            //   navigation.navigate(returnTo);
            //   return;
            // }

            // navigation.navigate('HomeMain');
          }}
          style={styles.headerIconBtn}
        >
          <Icon name="close" size={26} color={icon} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]}>
          {mediaType === 'Flips' ? t('post.newFlip') : postType === 'crowdfunding' ? t('post.missionMint') : t('post.newMint')}
        </Text>
        <TouchableOpacity
          onPress={handleShare}
          style={[styles.headerShareBtn, { backgroundColor: accent, shadowColor: accent, opacity: (selectedMedia && selectedMedia.length > 0) && !shared ? 1 : 0.5 }]}
          disabled={!selectedMedia || selectedMedia.length === 0 || shared}
        >
          <Text style={styles.headerShareText}>{t('post.next')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {galleryImages.length === 0 ? (
          renderInitialGalleryPrompt()
        ) : isFlipWithVideo ? (
          renderFlipVideoPreview()
        ) : (
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {renderMainContent()}
          </ScrollView>
        )}
      </View>
      {!isCropping && (
      <PostTypeModal
        visible={showTypeModal && !isPrivateEntry && !isFlipEntry}
        setShowTypeModal={setShowTypeModal}
        onClose={() => {
          setShowTypeModal(false);
          if (navigation.canGoBack()) {
            navigation.goBack();
            return;
          }

          if (returnTo && typeof returnTo === 'object' && returnTo?.tab) {
            navigation.navigate(returnTo.tab);
            return;
          }

          if (typeof returnTo === 'string' && returnTo.length) {
            navigation.navigate(returnTo);
            return;
          }

          navigation.navigate('HomeMain');
        }}
        onSelect={handleSelectType}
      />
)}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  scrollView: {
    flex: 1,
  },
  flipFullScreenContainer: {
    width: '100%',
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  flipFullScreenVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  flipTapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flipDurationBadge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    zIndex: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  flipRemoveButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 4,
    backgroundColor: '#fff',
    borderRadius: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  flipPlayOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 28,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
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
    // marginBottom: 24,
    marginTop: 10
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
    textAlign: 'center',
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
    gap: 24,
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
    textAlign: 'center',

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
    marginTop: 10,
  },
  selectedGridItemHorizontal: {
    width: selectedPreviewWidth,
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
    height: maxSelectedPreviewHeight,
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
