import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  PanResponder,
  Image,
  Alert,
  PermissionsAndroid,
  Platform,
  InteractionManager,
} from 'react-native';
import React, { useRef, useEffect, useState } from 'react';
import Feather from 'react-native-vector-icons/Feather';
import { Reels } from '../../assets/icons';
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { PostStory } from '../../services/stories';
import { buildStoryMetaPayload } from '../../utils/buildStoryMeta';
import {
  appendStoryAudioFiles,
  prepareStoryClipsAudioForUpload,
} from '../../utils/storyAudioUpload';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../displaytoastmessage';
import StoryComposer from '../home/story.js/StoryComposer';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';

const SCREEN_HEIGHT = Dimensions.get('window').height;

const ProfileModal = ({ modalVisible, setModalVisible, onStoryUploaded }) => {
  const navigation = useNavigation();
  const toast = useToast();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const { bgStyle, textStyle } = useAppTheme();
  const { t } = useLanguage();

  const [composerVisible, setComposerVisible] = useState(false);
  const [composerList, setComposerList] = useState([]);

  useEffect(() => {
    if (modalVisible) {
      showModal();
    }
  }, [modalVisible]);

  const showModal = () => {
    Animated.timing(translateY, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const hideModal = () => {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      if (modalVisible) {
        setModalVisible(false);
      }
    });
  };

  const hideModalImmediate = () => {
    translateY.stopAnimation();
    translateY.setValue(SCREEN_HEIGHT);
    setModalVisible(false);
  };

  const requestCameraPermission = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: t('profileModal.cameraPermissionTitle'),
          message: t('profileModal.cameraPermissionMessage'),
          buttonNeutral: t('profileModal.cameraPermissionNeutral'),
          buttonNegative: t('profileModal.cameraPermissionNegative'),
          buttonPositive: t('profileModal.cameraPermissionPositive'),
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  };

  const openCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert(
        t('profileModal.permissionDeniedTitle'),
        t('profileModal.permissionDeniedMessage'),
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
      if (response?.didCancel) return;
      if (response?.errorCode) {
        Alert.alert(
          t('profileModal.cameraErrorTitle'),
          response.errorMessage || response.errorCode,
        );
        return;
      }
      handleMediaSelected(response);
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
      if (response?.didCancel || response?.errorCode) return;
      const assets = response?.assets || [];
      if (!assets.length) return;

      const list = assets.map(a => ({
        uri: a.uri,
        type: a.type?.startsWith('video') ? 'video' : 'image',
        duration: a.duration ? a.duration * 1000 : undefined,
      }));
      setComposerList(list);
      setComposerVisible(true);
    });
  };

  const handleMediaSelected = response => {
    const asset = response?.assets?.[0];
    if (!asset || !asset.uri) {
      Alert.alert(
        t('profileModal.mediaReadErrorTitle'),
        t('profileModal.mediaReadErrorMessage'),
      );
      return;
    }
    const type = asset.type?.startsWith('video') ? 'video' : 'image';
    const list = [{
      uri: asset.uri,
      type,
      duration: type === 'video'
        ? (asset.duration ? asset.duration * 1000 : 15000)
        : 5000,
    }];
    setComposerList(list);
    setComposerVisible(true);
  };

  const handleAddStory = () => {
    hideModal();
    setTimeout(() => {
      Alert.alert(
        t('profileModal.addDropsTitle'),
        t('profileModal.addDropsMessage'),
        [
          { text: t('profileModal.cameraOption'), onPress: () => openCamera() },
          { text: t('profileModal.galleryOption'), onPress: () => openGallery() },
          { text: t('profileModal.cancelOption'), style: 'cancel' },
        ],
      );
    }, 300);
  };

  const handleComposerDone = async (processedArray) => {
    try {
      const clips = await prepareStoryClipsAudioForUpload(processedArray);
      setComposerVisible(false);

      const formData = new FormData();
      formData.append('caption', '');

      clips.forEach((item, index) => {
        const fileUri = item.processedUri || item.original.uri;
        const fileName = `story_${Date.now()}_${index}.${item.isVideo ? 'mp4' : 'jpg'}`;
        const fileType = item.isVideo ? 'video/mp4' : 'image/jpeg';
        formData.append('media', { uri: fileUri, type: fileType, name: fileName });
      });

      formData.append('storyMeta', JSON.stringify(buildStoryMetaPayload(clips)));
      await appendStoryAudioFiles(formData, clips);

      const response = await PostStory(formData);

      if (response?.success) {
        showToastMessage(toast, 'success', t('profileModal.storyUploadSuccess'));
        if (onStoryUploaded) {
          onStoryUploaded();
        }
      } else {
        showToastMessage(toast, 'danger', t('profileModal.storyUploadFailed'));
      }
    } catch (error) {
      console.error('Error uploading story:', error);
      showToastMessage(toast, 'danger', t('profileModal.storyUploadError'));
    }
  };

  const handleNavigation = (type) => {
    const closeThenNavigate = (target, params) => {
      hideModalImmediate();
      InteractionManager.runAfterInteractions(() => {
        requestAnimationFrame(() => {
          navigation.navigate(target, params);
        });
      });
    };

    const buildReturnTo = () => {
      try {
        const parent = navigation.getParent?.();
        const state = parent?.getState?.();
        const currentTab = state?.routes?.[state.index]?.name;
        return currentTab ? { tab: currentTab } : null;
      } catch {
        return null;
      }
    };

    switch (type) {
      case 'mint': // post
        closeThenNavigate('Add', {
          screen: 'Add',
          params: { returnTo: buildReturnTo() },
        });
        break;
      case 'Flips': // reels
        closeThenNavigate('Add', {
          screen: 'Add',
          params: { type: 'Flips', returnTo: buildReturnTo() },
        });
        break;
      case 'drops':
        handleAddStory();
        break;
      case 'drops highlights':
        closeThenNavigate('HighlightsScreen');
        break;
      default:
        break;
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 10,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 150) {
          hideModal();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  return (
    <>
      <Modal
        transparent
        visible={modalVisible}
        animationType="none"
        {...(Platform.OS === 'ios' ? { presentationStyle: 'overFullScreen' } : {})}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={hideModal}
          />
          <Animated.View
            style={[styles.modalContainer, { transform: [{ translateY }] }, bgStyle]}
            {...panResponder.panHandlers}
          >
            <View style={styles.dragHandle} />

            <Text style={styles.title}>{t('profileModal.createTitle')}</Text>

            <View style={styles.list}>
              <TouchableOpacity
                style={styles.button}
                onPress={() => handleNavigation('Flips')}
              >
                <Reels width={20} height={20} />
                <Text style={styles.lText}>{t('profileModal.flipsLabel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.button}
                onPress={() => handleNavigation('mint')}
              >
                <Feather name="grid" size={20} color="#111100" />
                <Text style={styles.lText}>{t('profileModal.newMintLabel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.button}
                onPress={() => handleNavigation('drops')}
              >
                <Image
                  source={require('../../assets/icons/pngicons/user-interface_14983775.png')}
                  style={{ width: 20, height: 20 }}
                  resizeMode="contain"
                />
                <Text style={styles.lText}>{t('profileModal.dropsLabel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.button}
                onPress={() => handleNavigation('drops highlights')}
              >
                <Feather name="circle" size={20} color="#111100" />
                <Text style={styles.lText}>{t('profileModal.dropsHighlightsLabel')}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <StoryComposer
        modalVisible={composerVisible}
        mediaList={composerList}
        onCancel={() => setComposerVisible(false)}
        onDone={handleComposerDone}
      />
    </>
  );
};

export default ProfileModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: 330,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#ccc',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  list: {
    marginTop: 10,
    gap: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderBottomWidth: 0.3,
    borderColor: '#ccc',
    paddingHorizontal: 5,
  },
  lText: {
    fontSize: 16,
    marginLeft: 10,
  },
});
