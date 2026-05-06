// Create a new file: components/chat/StoryViewerModal.js

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Image,
  Text,
  Dimensions,
  Animated,
  PanResponder,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const StoryViewerModal = ({ visible, story, onClose, userName, userImage }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [duration, setDuration] = useState(5); // Default 5 seconds for images
  const [currentTime, setCurrentTime] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);
  const insets = useSafeAreaInsets();

  // Determine if story is video
  const isVideo = story?.type === 'video' ||
    (story?.media?.[0] && isVideoUrl(story.media[0])) ||
    (story?.uri && isVideoUrl(story.uri));

  const mediaUri = story?.uri ||
    story?.media?.[0] ||
    story?.thumbnail ||
    story?.image;

  const storyCaption = story?.caption || story?.text || '';

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
  }, [visible]);

  const startProgress = () => {
    stopProgress();

    if (isVideo) {
      // For videos, progress is handled by onProgress callback
      return;
    }

    // For images, use timer
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
    }, 16); // 60fps
  };

  const stopProgress = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

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

  function handleClose() {
    stopProgress();
    onClose();
  }

  // Pan responder for swipe down to close
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
      <SafeAreaView style={styles.container} {...panResponder.panHandlers}>
        {/* Progress Bar */}
        <View style={[
          styles.progressBarContainer,
          { top: insets.top } // 🔥 move below notch
        ]}>
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

        {/* Header */}
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'transparent']}
          style={[
            styles.header,
            { paddingTop: insets.top + 10 } // 🔥 fix
          ]}
        >
          <TouchableOpacity
            style={styles.topBackButton}
            activeOpacity={0.85}
            onPress={handleClose}
          >
            <Icon name="chevron-back" size={22} color="#fff" />
            <Text style={styles.topBackText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Image
              source={{ uri: userImage || 'https://via.placeholder.com/40' }}
              style={styles.userAvatar}
            />
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{userName || 'Unknown User'}</Text>
              <Text style={styles.timeAgo}>
                {formatTimeAgo(story.createdAt || new Date())}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Icon name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>

        {/* Story Content */}
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
              onLoad={handleVideoLoad}
              onProgress={handleVideoProgress}
              onError={(error) => {
                console.error('Video error:', error);
                setIsLoading(false);
              }}
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

          {/* Pause indicator */}
          {isPaused && (
            <View style={styles.pauseIndicator}>
              <Icon name="pause" size={60} color="rgba(255,255,255,0.8)" />
            </View>
          )}
        </TouchableOpacity>

        {/* Caption */}
        {storyCaption && storyCaption.trim() !== '' && (
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.captionContainer}
          >
            <Text style={styles.captionText}>{storyCaption}</Text>
          </LinearGradient>
        )}

        {/* Story Type Badge */}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {isVideo ? '🎬 Video Story' : '📷 Photo Story'}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.bottomBackButton,
            { bottom: insets.bottom + 20 } // 🔥 fix for gesture bar
          ]}
          activeOpacity={0.85}
          onPress={handleClose}
        >
          <Icon name="chevron-back" size={22} color="#fff" />
          <Text style={styles.bottomBackText}>Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
};

// Helper function to check if URL is video
const isVideoUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
  return videoExtensions.some(ext => url.toLowerCase().includes(ext));
};

// Helper function to format time ago
const formatTimeAgo = (timestamp) => {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  } catch (error) {
    return 'Recently';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  progressBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    zIndex: 100,
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
    zIndex: 120,
    elevation: 12,
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
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
