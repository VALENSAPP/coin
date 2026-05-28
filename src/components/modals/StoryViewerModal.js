// components/chat/StoryViewerModal.js

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Text,
  Dimensions,
  Animated,
  PanResponder,
  StatusBar,
  ActivityIndicator,
  Image,
} from 'react-native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import HexAvatar from '../home/story.js/HexAvatar';
import { getUserCredentials } from '../../services/post';
import { useLanguage } from '../../i18n';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FALLBACK_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

const pickNonEmpty = (...values) => {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
};

const unwrapUserProfileResponse = (response) => {
  const payload = response?.data ?? response ?? {};
  return (
    payload?.data?.user ||
    payload?.data?.profile ||
    payload?.data ||
    payload?.user ||
    payload?.profile ||
    payload
  );
};

const StoryViewerModal = ({ visible, story, onClose, userName, userImage }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [duration, setDuration] = useState(5);
  const [, setCurrentTime] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [selfUserId, setSelfUserId] = useState(null);
  const [storyOwnerProfile, setStoryOwnerProfile] = useState(null);
  const { t } = useLanguage();

  useEffect(() => {
    (async () => {
      try {
        const id = await AsyncStorage.getItem('userId');
        setSelfUserId(id ? String(id) : null);
      } catch (_) {
        setSelfUserId(null);
      }
    })();
  }, []);

  const storyUserId = useMemo(() => {
    const candidate =
      story?.userId ||
      story?.UserId ||
      story?.user?._id ||
      story?.user?.id ||
      story?.user?.userId ||
      story?.senderId ||
      story?.sender?._id ||
      story?.sender?.id ||
      null;
    return candidate ? String(candidate) : null;
  }, [story]);

  useEffect(() => {
    let active = true;

    const fetchStoryOwnerProfile = async () => {
      if (!visible || !storyUserId) {
        if (active) setStoryOwnerProfile(null);
        return;
      }

      try {
        const response = await getUserCredentials(storyUserId);
        const rawUser = unwrapUserProfileResponse(response);

        if (!active) return;

        const displayName = pickNonEmpty(
          rawUser?.displayName,
          rawUser?.name,
          rawUser?.fullName,
          rawUser?.userName,
          rawUser?.username
        );
        const avatar = pickNonEmpty(
          rawUser?.image,
          rawUser?.avatar,
          rawUser?.profilePic,
          rawUser?.profilePicture,
          rawUser?.photoUrl,
          rawUser?.photoURL
        );

        setStoryOwnerProfile({ name: displayName, image: avatar });
      } catch (_error) {
        if (active) setStoryOwnerProfile(null);
      }
    };

    fetchStoryOwnerProfile();

    return () => {
      active = false;
    };
  }, [storyUserId, visible]);

  const storyUsername =
    pickNonEmpty(
      storyOwnerProfile?.name,
      userName,
      story?.userName,
      story?.username,
      story?.displayName,
      story?.user?.displayName,
      story?.user?.userName,
      story?.user?.username,
      story?.user?.name
    ) || t('storyViewer.unknownUser');

  const storyAvatar =
    storyOwnerProfile?.image ||
    userImage ||
    story?.userImage ||
    story?.avatar ||
    story?.profilePic ||
    story?.profilePicture ||
    story?.user?.image ||
    story?.user?.avatar ||
    story?.image ||
    FALLBACK_AVATAR;

  const isVideo =
    story?.type === 'video' ||
    (story?.media?.[0] && isVideoUrl(story.media[0])) ||
    (story?.uri && isVideoUrl(story.uri));

  const mediaUri = story?.uri || story?.media?.[0] || story?.thumbnail || story?.image;

  const storyCaption = story?.caption || story?.text || '';

  const stopProgress = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    stopProgress();
    onClose();
  }, [onClose, stopProgress]);

  const startProgress = useCallback(() => {
    stopProgress();

    if (isVideo) return;

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);

      setCurrentTime(elapsed);
      progressAnim.setValue(progress);

      if (progress >= 1) {
        stopProgress();
        handleClose();
      }
    }, 16);
  }, [duration, handleClose, isVideo, progressAnim, stopProgress]);

  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      setCurrentTime(0);
      progressAnim.setValue(0);
      startProgress();
    } else {
      stopProgress();
    }

    return () => {
      stopProgress();
    };
  }, [progressAnim, startProgress, stopProgress, visible]);

  const handleVideoProgress = (data) => {
    if (data.currentTime && data.seekableDuration) {
      const progress = data.currentTime / data.seekableDuration;
      setCurrentTime(data.currentTime);
      progressAnim.setValue(progress);

      if (progress >= 0.99) {
        handleClose();
      }
    }
  };

  const handleVideoLoad = (data) => {
    setIsLoading(false);
    if (data.duration) {
      setDuration(data.duration);
    }
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
    if (!isPaused) {
      stopProgress();
    } else {
      startProgress();
    }
  };

  const handleOpenStoryUserProfile = useCallback(() => {
    if (!storyUserId) return;

    handleClose();

    setTimeout(() => {
      if (selfUserId && String(storyUserId) === String(selfUserId)) {
        navigation.navigate('ProfileMain', { screen: 'Profile' });
        return;
      }

      navigation.navigate('HomeMain', {
        screen: 'UsersProfile',
        params: {
          userId: String(storyUserId),
          username: storyUsername || '',
        },
      });
    }, 150);
  }, [handleClose, navigation, selfUserId, storyUserId, storyUsername]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          // Swipe down gesture
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 && gestureState.vy > 0.5) {
          handleClose();
        }
      },
    })
  ).current;

  if (!visible || !story) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <StatusBar backgroundColor="#000" barStyle="light-content" />
      <View style={styles.container} {...panResponder.panHandlers}>
        <View style={styles.mediaLayer}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={togglePause}
            style={styles.contentContainer}
          >
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            )}

            {isVideo ? (
              <Video
                source={{ uri: mediaUri }}
                style={styles.media}
                resizeMode="contain"
                paused={isPaused || !visible}
                repeat={false}
                muted={false}
                volume={1}
                ignoreSilentSwitch="ignore"
                playWhenInactive={false}
                onLoad={handleVideoLoad}
                onProgress={handleVideoProgress}
                onError={() => setIsLoading(false)}
                controls={false}
              />
            ) : (
              <Image
                source={{ uri: mediaUri }}
                style={styles.media}
                resizeMode="contain"
                onLoad={() => setIsLoading(false)}
                onError={() => setIsLoading(false)}
              />
            )}

            {isPaused && (
              <View style={styles.pauseIndicator}>
                <Icon name="pause" size={60} color="rgba(255,255,255,0.8)" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {storyCaption && storyCaption.trim() !== '' && (
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={[styles.captionContainer, styles.captionZ]}
          >
            <Text style={styles.captionText}>{storyCaption}</Text>
          </LinearGradient>
        )}

        <View style={[styles.badge, styles.badgeZ]}>
          <Text style={styles.badgeText}>
            {isVideo
              ? t('storyViewer.videoStoryBadge')
              : t('storyViewer.photoStoryBadge')}
          </Text>
        </View>

        <View style={styles.uiLayer} pointerEvents="box-none">
          <View style={[styles.progressBarContainer, { top: insets.top + 6 }]}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>

          <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
            <View style={styles.headerContent}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.userPressable}
                onPress={handleOpenStoryUserProfile}
                disabled={!storyUserId}
              >
                <HexAvatar uri={storyAvatar} size={44} borderWidth={2} borderColor="#fff" />
                <View style={styles.userInfo}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {storyUsername}
                  </Text>
                  <Text style={styles.timeAgo}>
                    {formatTimeAgo(story.createdAt || new Date(), t)}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Icon name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const isVideoUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
  return videoExtensions.some((ext) => url.toLowerCase().includes(ext));
};

const formatTimeAgo = (timestamp, t) => {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return t('storyViewer.timeJustNow');
    if (diffInSeconds < 3600)
      return t('storyViewer.timeMinutesAgo', { count: Math.floor(diffInSeconds / 60) });
    if (diffInSeconds < 86400)
      return t('storyViewer.timeHoursAgo', { count: Math.floor(diffInSeconds / 3600) });
    return t('storyViewer.timeDaysAgo', { count: Math.floor(diffInSeconds / 86400) });
  } catch (error) {
    return t('storyViewer.timeRecently');
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mediaLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    elevation: 1,
    backgroundColor: '#000',
  },
  uiLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  progressBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    zIndex: 10000,
    elevation: 10000,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10001,
    elevation: 10001,
    minHeight: 92,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  topBackButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.74)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  topBackText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 2,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  userPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
    minWidth: 0,
  },
  userName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  timeAgo: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  contentContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  media: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  pauseIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -30 }, { translateY: -30 }],
  },
  captionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  captionText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  captionZ: {
    zIndex: 30,
  },
  badgeZ: {
    zIndex: 31,
  },
  badge: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomBackButton: {
    position: 'absolute',
    right: 20,
    bottom: 42,
    zIndex: 30,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBackText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default StoryViewerModal;

/* ============================================
   HOW TO INTEGRATE INTO USERCHAT COMPONENT
   ============================================ */

// 1. Import the StoryViewerModal at the top of UserChat.js:
// import StoryViewerModal from '../../components/chat/StoryViewerModal';

// 2. Add state to control the modal (add with other useState declarations):
// const [storyViewerVisible, setStoryViewerVisible] = useState(false);
// const [selectedStory, setSelectedStory] = useState(null);

// 3. Replace the story share TouchableOpacity onPress in renderMessage:
/*
<TouchableOpacity
  style={[styles.sharedPostContainer, isUser && styles.userSharedPost]}
  onPress={() => {
    if (storyExists && storyData) {
      // Open story viewer
      setSelectedStory({
        ...storyData,
        userName: storyUser.displayName,
        userImage: storyUser.image,
      });
      setStoryViewerVisible(true);
    } else {
      Alert.alert('Story Unavailable', 'This story is no longer available');
    }
  }}
  activeOpacity={0.7}
>
  {/* ... rest of the story card UI ... *-/}
</TouchableOpacity>
*/

// 4. Add the StoryViewerModal component before the closing </SafeAreaView>:
/*
<StoryViewerModal
  visible={storyViewerVisible}
  story={selectedStory}
  onClose={() => {
    setStoryViewerVisible(false);
    setSelectedStory(null);
  }}
  userName={selectedStory?.userName}
  userImage={selectedStory?.userImage}
/>
*/
