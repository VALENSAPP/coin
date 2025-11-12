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
} from 'react-native';
import React, { useRef, useEffect, useState } from 'react';
import Feather from 'react-native-vector-icons/Feather';
import { Reels } from '../../assets/icons';
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { PostStory } from '../../services/stories';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../displaytoastmessage';
import StoryComposer from '../home/story.js/StoryComposer';

const SCREEN_HEIGHT = Dimensions.get('window').height;

const ProfileModal = ({ modalVisible, setModalVisible, onStoryUploaded }) => {
  const navigation = useNavigation();
  const toast = useToast();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Story composer state
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
      if (response?.didCancel) return;
      if (response?.errorCode) {
        Alert.alert(
          'Camera error',
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
      Alert.alert('Oops', 'Could not read the selected media.');
      return;
    }
    const type = asset.type?.startsWith('video') ? 'video' : 'image';
    const list = [{
      uri: asset.uri,
      type: type,
      duration: type === 'video'
        ? (asset.duration ? asset.duration * 1000 : 15000)
        : 5000,
    }];
    setComposerList(list);
    setComposerVisible(true);
  };

  const handleAddStory = () => {
    // Close the modal first
    hideModal();

    // Small delay to ensure modal animation completes
    setTimeout(() => {
      Alert.alert('Add Story', 'Choose how to add your story', [
        { text: 'Camera', onPress: () => openCamera() },
        { text: 'Gallery', onPress: () => openGallery() },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }, 300);
  };

  const handleComposerDone = async (processedArray) => {
    try {
      setComposerVisible(false);

      // Prepare FormData for API call
      const formData = new FormData();

      // Add caption (optional)
      formData.append('caption', '');

      // Add media files
      processedArray.forEach((item, index) => {
        const fileUri = item.processedUri || item.original.uri;
        const fileName = `story_${Date.now()}_${index}.${item.isVideo ? 'mp4' : 'jpg'}`;
        const fileType = item.isVideo ? 'video/mp4' : 'image/jpeg';

        formData.append('media', {
          uri: fileUri,
          type: fileType,
          name: fileName,
        });
      });

      // Call API to upload story
      const response = await PostStory(formData);

      if (response?.success) {
        showToastMessage(toast, 'success', 'Story Uploaded Successfully');

        // Notify parent component to refresh stories
        if (onStoryUploaded) {
          onStoryUploaded();
        }
      } else {
        showToastMessage(toast, 'danger', 'Failed to upload story please try again');
      }
    } catch (error) {
      console.error('Error uploading story:', error);
      showToastMessage(toast, 'danger', 'Something Went Wrong! Please try again');
    }
  };

  const handleNavigation = (type) => {
    switch (type) {
      case 'mint': // post
        navigation.navigate('Add');
        hideModal();
        break;
      case 'Flips': // reels
        navigation.navigate('Add', {
          screen: 'Add',
          params: { fromIcon: 'Flips' },
        });
        break;
      case 'ai':
        navigation.navigate('');
        hideModal();
        break;
      case 'drops': // Story
        handleAddStory();
        break;
      case 'drops highlights': // storyHighlight
        navigation.navigate('');
        hideModal();
        break;
      case 'live':
        navigation.navigate('');
        hideModal();
        break;
      default:
        break;
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 10;
      },
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
      <Modal transparent visible={modalVisible} animationType="none">
        <View style={styles.overlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={hideModal}
          />
          <Animated.View
            style={[styles.modalContainer, { transform: [{ translateY }] }]}
            {...panResponder.panHandlers}
          >
            <View style={styles.dragHandle} />

            <Text style={styles.title}>Create</Text>

            <View style={styles.list}>
              <TouchableOpacity style={styles.button} onPress={() => handleNavigation('Flips')}>
                <Reels width={20} height={20} />
                <Text style={styles.lText}>Flips</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={() => handleNavigation('mint')}>
                <Feather name="grid" size={20} color="#111100" />
                <Text style={styles.lText}>New Mint</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={() => handleNavigation('drops')}>
                <Image
                  source={require('../../assets/icons/pngicons/user-interface_14983775.png')}
                  style={{ width: 20, height: 20 }}
                  resizeMode="contain"
                />
                <Text style={styles.lText}>drops</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={() => handleNavigation('drops highlights')}>
                <Feather name="circle" size={20} color="#111100" />
                <Text style={styles.lText}>drops highlights</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={() => handleNavigation('live')}>
                <Image
                  source={require('../../assets/icons/pngicons/live.png')}
                  style={{ width: 20, height: 20 }}
                  resizeMode="contain"
                />
                <Text style={styles.lText}>Live</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={() => handleNavigation('ai')}>
                <Feather name="star" size={20} color="#111100" />
                <Text style={styles.lText}>AI</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Story Composer Modal */}
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
    height: 450,
    backgroundColor: '#f8f2fd',
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