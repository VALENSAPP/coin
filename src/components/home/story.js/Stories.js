import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  Image,
  Modal,
  TextInput,
  Platform,
  PanResponder,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Animated,
  Dimensions,
  StyleSheet,
} from 'react-native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useFocusEffect } from '@react-navigation/native';

import createStyles from '../../../pages/home/Style';
import HexAvatar from './HexAvatar';
import StoryComposer from './StoryComposer';
import {
  modalStyles,
  likeStyles,
  inputStyles,
  optStyles,
  burstStyles,
} from './Style';
import { getStoryByUser, PostStory, DeleteStory, getFollowingUserStories } from '../../../services/stories';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showToastMessage } from '../../displaytoastmessage';
import { Toast, useToast } from 'react-native-toast-notifications';
import { getUserCredentials } from '../../../services/post';

// Import the new API functions
import { postCommentStory, postLikeStory } from '../../../services/stories'; // Adjust path as needed
import { useDispatch, useSelector } from 'react-redux';
import { hideLoader, showLoader } from '../../../redux/actions/LoaderAction';
import { setProfileImg } from '../../../redux/actions/ProfileImgAction';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const DOUBLE_TAP_DELAY = 300;

// Story Analytics Modal Component
const StoryAnalytics = ({ visible, onClose, story, currentUser }) => {
  const [activeTab, setActiveTab] = useState('likes'); // Default to 'likes', removed 'views'

  const analyticsStyles = {
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: '#1a1a1a',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: SCREEN_HEIGHT * 0.7,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: '#333',
    },
    headerTitle: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
    },
    closeButton: {
      padding: 5,
    },
    tabContainer: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#333',
    },
    tab: {
      flex: 1,
      paddingVertical: 15,
      alignItems: 'center',
    },
    activeTab: {
      borderBottomWidth: 2,
      borderBottomColor: '#4da3ff',
    },
    tabText: {
      color: '#aaa',
      fontSize: 14,
      fontWeight: '600',
    },
    activeTabText: {
      color: '#4da3ff',
    },
    tabCount: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
      marginTop: 2,
    },
    listContainer: {
      maxHeight: SCREEN_HEIGHT * 0.4,
    },
    userItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    userAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 15,
    },
    userInfo: {
      flex: 1,
    },
    username: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    timestamp: {
      color: '#aaa',
      fontSize: 12,
      marginTop: 2,
    },
    commentText: {
      color: '#ddd',
      fontSize: 13,
      marginTop: 2,
    },
    emptyState: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      color: '#aaa',
      fontSize: 16,
      textAlign: 'center',
    },
  };

  const formatAnalyticsTime = (timestamp) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const renderUserItem = (item, type) => (
    <View key={item.id} style={analyticsStyles.userItem}>
      <Image source={{ uri: item.avatar }} style={analyticsStyles.userAvatar} />
      <View style={analyticsStyles.userInfo}>
        <Text style={analyticsStyles.username}>{item.username}</Text>
        <Text style={analyticsStyles.timestamp}>
          {formatAnalyticsTime(item.timestamp)}
        </Text>
        {type === 'comments' && item.text && (
          <Text style={analyticsStyles.commentText}>{item.text}</Text>
        )}
      </View>
    </View>
  );

  const renderEmptyState = (type) => (
    <View style={analyticsStyles.emptyState}>
      <Text style={analyticsStyles.emptyText}>
        {type === 'likes' && 'No likes yet'}
        {type === 'comments' && 'No comments yet'}
      </Text>
    </View>
  );

  const getTabData = () => {
    if (!story) return [];
    switch (activeTab) {
      case 'likes':
        return story.likes || [];
      case 'comments':
        return story.comments || [];
      default:
        return [];
    }
  };

  if (!visible || !story) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={analyticsStyles.backdrop}>
        <View style={analyticsStyles.container}>
          <View style={analyticsStyles.header}>
            <Text style={analyticsStyles.headerTitle}>Story Activity</Text>
            <TouchableOpacity onPress={onClose} style={analyticsStyles.closeButton}>
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={analyticsStyles.tabContainer}>
            {['likes', 'comments'].map((tab) => {
              const count = story[tab]?.length || 0;
              const isActive = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[analyticsStyles.tab, isActive && analyticsStyles.activeTab]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[analyticsStyles.tabText, isActive && analyticsStyles.activeTabText]}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                  <Text style={analyticsStyles.tabCount}>{count}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <FlatList
            style={analyticsStyles.listContainer}
            data={getTabData()}
            keyExtractor={(item, index) => `${activeTab}_${item.id || index}`}
            renderItem={({ item }) => renderUserItem(item, activeTab)}
            ListEmptyComponent={() => renderEmptyState(activeTab)}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    </Modal>
  );
};

const OptionsSheet = ({
  visible,
  onClose,
  isMuted,
  onToggleMute,
  onReport,
  username,
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}
  >
    <View style={optStyles.backdrop}>
      <View style={optStyles.sheet}>
        <View style={optStyles.handle} />
        <Text style={optStyles.title}>{username}</Text>

        <TouchableOpacity style={optStyles.row} onPress={onToggleMute}>
          <Icon
            name={isMuted ? 'volume-high-outline' : 'volume-mute-outline'}
            size={22}
            color="#fff"
          />
          <Text style={optStyles.rowText}>
            {isMuted ? 'Unmute' : 'Mute'} {username}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={optStyles.row} onPress={onReport}>
          <Icon name="flag-outline" size={22} color="#ff6969" />
          <Text style={[optStyles.rowText, { color: '#ff8b8b' }]}>
            Report {username}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[optStyles.row, optStyles.cancel]}
          onPress={onClose}
        >
          <Text style={optStyles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const StoryViewer = ({
  visible,
  stories,
  currentUserIndex,
  currentStoryIndex,
  onClose,
  onNext,
  onPrev,
  onNextUser,
  onPrevUser,
  likes,
  onToggleLike,
  onAddComment,
  onMuteUser,
  onReportUser,
  onDeleteStory,
  ownerProfileImage,
}) => {
  const dispatch = useDispatch();
  const [paused, setPaused] = useState(false);
  const [analyticsVisible, setAnalyticsVisible] = useState(false);
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const lastTapRef = useRef(0);
  const tapTimerRef = useRef(null);
  const timerRef = useRef(null);
  const [currentProgress, setCurrentProgress] = useState(0);
  const videoRef = useRef(null);

  // --- keep latest callbacks for PanResponder (fix slide stale-closure) ---
  const nextUserCb = useRef(onNextUser);
  const prevUserCb = useRef(onPrevUser);
  const closeCb = useRef(onClose);
  useEffect(() => { nextUserCb.current = onNextUser; }, [onNextUser]);
  useEffect(() => { prevUserCb.current = onPrevUser; }, [onPrevUser]);
  useEffect(() => { closeCb.current = onClose; }, [onClose]);

  // --- refs to avoid stale paused/visible in media onLoad ---
  const pausedRef = useRef(paused);
  const visibleRef = useRef(visible);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { visibleRef.current = visible; }, [visible]);

  const heartScale = useRef(new Animated.Value(0)).current;
  const triggerHeart = () => {
    heartScale.setValue(0);
    Animated.sequence([
      Animated.spring(heartScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
        tension: 140,
      }),
      Animated.timing(heartScale, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const [emojiBursts, setEmojiBursts] = useState([]);
  const spawnEmojiBurst = emoji => {
    const id = `${Date.now()}_${Math.random()}`;
    const ty = new Animated.Value(0);
    const opacity = new Animated.Value(1);
    const scale = new Animated.Value(0.8);

    const minX = SCREEN_WIDTH * 0.15;
    const maxX = SCREEN_WIDTH * 0.85;
    const x = Math.random() * (maxX - minX) + minX;

    setEmojiBursts(prev => [...prev, { id, emoji, x, ty, opacity, scale }]);
    Animated.parallel([
      Animated.timing(ty, {
        toValue: -160,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1.3,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start(() => setEmojiBursts(prev => prev.filter(b => b.id !== id)));
  };

  const currentUser = stories[currentUserIndex];
  const currentStory = currentUser?.stories[currentStoryIndex];
  const isViewingOwnStory = currentUser?.isUser;

  // Helper: fully stop & clear timers/animation
  const stopAndResetProgress = (resetToZero = true) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    progressAnimation.stopAnimation();
    if (resetToZero) {
      progressAnimation.setValue(0);
      setCurrentProgress(0);
    }
  };

  // Reset progress when story changes
  useEffect(() => {
    if (!visible || !currentStory) return;

    dispatch(hideLoader());
    setPaused(false);
    stopAndResetProgress(true);

    // seek to start if video
    if (currentStory.type === 'video' && videoRef.current?.seek) {
      try { videoRef.current.seek(0); } catch (_e) { }
    }

    return () => {
      stopAndResetProgress(false);
    };
  }, [visible, currentUserIndex, currentStoryIndex]);

  // Progress animation listener
  useEffect(() => {
    const listener = progressAnimation.addListener(({ value }) => {
      setCurrentProgress(value);
    });
    return () => progressAnimation.removeListener(listener);
  }, [progressAnimation]);

  // Clean timers on close
  useEffect(() => {
    if (!visible) {
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      stopAndResetProgress(true);
      setPaused(false);
      dispatch(showLoader());
      setOptionsOpen(false);
      setAnalyticsVisible(false);
      setCommentText('');
      setEmojiBursts([]);
      lastTapRef.current = 0;
      dispatch(hideLoader());
    }
  }, [visible]);

  const startProgress = (duration) => {
    Animated.timing(progressAnimation, {
      toValue: 1,
      duration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !pausedRef.current) onNext();
    });
  };

  const handlePause = () => {
    setPaused(true);
    stopAndResetProgress(false);
  };

  const handleResume = () => {
    if (!currentStory) return;
    setPaused(false);
    // if (!loading) {
    const remaining = Math.max(0, 1 - currentProgress);
    const totalDuration =
      currentStory.type === 'video'
        ? (currentStory.duration || 15000)
        : 5000;
    const remainingDuration = totalDuration * remaining;
    if (remainingDuration > 50) {
      startProgress(remainingDuration);
    }
    // }
  };

  // Pan responder: swipe down to close, left/right to switch users
  const pan = useRef(new Animated.ValueXY()).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => {
        const { dx, dy } = g;
        return Math.abs(dx) > 10 || Math.abs(dy) > 10;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, g) => {
        const { dx, dy } = g;
        return Math.abs(dx) > 10 || Math.abs(dy) > 10;
      },
      onPanResponderGrant: () => {
        handlePause();
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, g) => {
        const { dx, dy, vx, vy } = g;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        const shouldClose =
          dy > 140 && absDy > absDx * 1.5 && vy > 0.8;

        const isHorizontal =
          (absDx > 80 || Math.abs(vx) > 0.6) && absDx > absDy * 1.2;

        if (shouldClose) {
          stopAndResetProgress(true);
          Animated.timing(pan, {
            toValue: { x: 0, y: SCREEN_HEIGHT },
            duration: 160,
            useNativeDriver: false,
          }).start(() => {
            pan.setValue({ x: 0, y: 0 });
            closeCb.current && closeCb.current();
          });
          return;
        }

        if (isHorizontal) {
          stopAndResetProgress(true);
          if (dx > 0) {
            prevUserCb.current && prevUserCb.current();
          } else {
            nextUserCb.current && nextUserCb.current();
          }
          Animated.timing(pan, {
            toValue: { x: 0, y: 0 },
            duration: 100,
            useNativeDriver: false,
          }).start();
          return;
        }

        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
        handleResume();
      },
      onPanResponderTerminate: () => {
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
        handleResume();
      },
    }),
  ).current;

  if (!visible || !currentUser || !currentStory) return null;

  const storyId = currentStory.id;
  const ownerId = currentUser.id;
  const storyKey = `${ownerId}:${storyId}`;
  const liked = !!likes[storyKey]?.liked;

  const handleTap = (event) => {
    const now = Date.now();
    const timeDiff = now - lastTapRef.current;

    if (timeDiff < DOUBLE_TAP_DELAY) {
      lastTapRef.current = 0;
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      onToggleLike(ownerId, storyId, true);
      triggerHeart();
      return;
    }

    lastTapRef.current = now;

    const tapX = event?.nativeEvent?.pageX || SCREEN_WIDTH / 2;
    const leftZone = SCREEN_WIDTH * 0.3;

    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
    }

    tapTimerRef.current = setTimeout(() => {
      stopAndResetProgress(true);
      if (tapX < leftZone) onPrev();
      else onNext();
      tapTimerRef.current = null;
    }, DOUBLE_TAP_DELAY);
  };

  const openOptions = () => {
    handlePause();
    setOptionsOpen(true);
  };

  const closeOptions = () => {
    setOptionsOpen(false);
    handleResume();
  };

  const openAnalytics = () => {
    handlePause();
    setAnalyticsVisible(true);
  };

  const closeAnalytics = () => {
    setAnalyticsVisible(false);
    handleResume();
  };

  const handleDeleteStory = () => {
    Alert.alert(
      'Delete Story',
      'Are you sure you want to delete this story?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDeleteStory(storyId);
            handleResume();
          }
        }
      ]
    );
  };

  // User story analytics styles
  const userAnalyticsStyles = {
    bottomContainer: {
      position: 'absolute',
      bottom: 100,
      left: 20,
      right: 20,
    },
    analyticsButton: {
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 25,
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
    },
    analyticsText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 8,
    },
    statsRow: {
      flexDirection: 'row',
      marginTop: 10,
      flexWrap: 'wrap',
    },
    statItem: {
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 15,
      marginRight: 8,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
    },
    statText: {
      color: '#fff',
      fontSize: 12,
      marginLeft: 4,
    },
    deleteButton: {
      backgroundColor: 'rgba(255, 107, 107, 0.8)',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 25,
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      marginTop: 10,
    },
    deleteText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 8,
    },
  };

  const onImageLoaded = () => {
    dispatch(hideLoader());
    if (visibleRef.current && !pausedRef.current) {
      startProgress(5000);
    }
  };

  const onVideoLoaded = () => {
    dispatch(hideLoader());
    const duration = currentStory.duration || 15000;
    if (visibleRef.current && !pausedRef.current) {
      startProgress(duration);
    }
  };

  const onMediaError = () => {
    dispatch(hideLoader());
    if (visibleRef.current && !pausedRef.current) {
      const duration = currentStory.type === 'video'
        ? (currentStory.duration || 15000)
        : 5000;
      startProgress(duration);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        stopAndResetProgress(true);
        onClose();
      }}
    >
      <View
        style={modalStyles.modalBg}
        {...panResponder.panHandlers}
      >
        {/* Progress bars */}
        <View style={modalStyles.progressContainer}>
          {currentUser.stories.map((_, idx) => (
            <View key={idx} style={modalStyles.progressBarBg}>
              <Animated.View
                style={[
                  modalStyles.progressBarFill,
                  {
                    width:
                      idx === currentStoryIndex
                        ? progressAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        })
                        : idx < currentStoryIndex
                          ? '100%'
                          : '0%',
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* Top bar */}
        <View style={modalStyles.topBar}>
          <View style={modalStyles.userInfo}>
            <HexAvatar
              uri={isViewingOwnStory ? (ownerProfileImage || currentUser.image) : currentUser.image}
              isUser={!!currentUser.isUser}
              size={36}
              borderWidth={2}
              borderColor={isViewingOwnStory ? '#4da3ff' : '#000'}
            />

            <Text style={modalStyles.username}>{currentUser.username}</Text>
            <Text style={modalStyles.time}>
              {formatTime(currentStory.timestamp)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {!isViewingOwnStory && (
              <TouchableOpacity
                onPress={openOptions}
                style={modalStyles.closeBtn}
              >
                <Icon name="ellipsis-horizontal" size={26} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                stopAndResetProgress(true);
                onClose();
              }}
              style={modalStyles.closeBtn}
            >
              <Icon name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Story content with tap handling */}
        <View style={modalStyles.storyContent}>

          {currentStory.type === 'image' ? (
            <Image
              source={{ uri: currentStory.uri }}
              style={modalStyles.storyMedia}
              resizeMode="contain"
              onLoad={onImageLoaded}
              onError={onMediaError}
              pointerEvents="none"
            />
          ) : (
            <Video
              ref={videoRef}
              source={{ uri: currentStory.uri }}
              style={modalStyles.storyMedia}
              resizeMode="contain"
              paused={paused}
              onLoad={onVideoLoaded}
              onError={onMediaError}
              onEnd={() => {
                stopAndResetProgress(true);
                setTimeout(() => onNext(), 120);
              }}
              repeat={false}
              muted={false}
              controls={false}
              playInBackground={false}
              playWhenInactive={false}
              pointerEvents="none"
            />
          )}

          <TouchableWithoutFeedback
            onPress={handleTap}
            onLongPress={handlePause}
            onPressOut={handleResume}
            delayLongPress={150}
          >
            <View style={modalStyles.overlay} />
          </TouchableWithoutFeedback>

          {/* Heart animation for likes */}
          {!isViewingOwnStory && (
            <Animated.View
              pointerEvents="none"
              style={[
                likeStyles.bigHeart,
                {
                  transform: [
                    {
                      scale: heartScale.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.4, 1],
                      }),
                    },
                  ],
                  opacity: heartScale,
                },
              ]}
            >
              <Icon name="heart" size={120} color="red" />
            </Animated.View>
          )}
        </View>

        {/* Show analytics for user's own stories */}
        {isViewingOwnStory && (
          <View style={userAnalyticsStyles.bottomContainer}>
            {/* <TouchableOpacity
              style={userAnalyticsStyles.analyticsButton}
              onPress={openAnalytics}
            >
              <Icon name="stats-chart-outline" size={18} color="#fff" />
              <Text style={userAnalyticsStyles.analyticsText}>
                Story Activity
              </Text>
            </TouchableOpacity> */}

            <View style={userAnalyticsStyles.statsRow}>
              {currentStory.likes?.length > 0 && (
                <View style={userAnalyticsStyles.statItem}>
                  <Icon name="heart" size={14} color="#ff6b6b" />
                  <Text style={userAnalyticsStyles.statText}>
                    {currentStory.likes.length}
                  </Text>
                </View>
              )}

              {currentStory.comments?.length > 0 && (
                <View style={userAnalyticsStyles.statItem}>
                  <Icon name="chatbubble-outline" size={14} color="#4da3ff" />
                  <Text style={userAnalyticsStyles.statText}>
                    {currentStory.comments.length}
                  </Text>
                </View>
              )}
            </View>

            {/* Delete Story Button */}
            <TouchableOpacity
              style={userAnalyticsStyles.deleteButton}
              onPress={handleDeleteStory}
            >
              <Icon name="trash-outline" size={18} color="#fff" />
              <Text style={userAnalyticsStyles.deleteText}>Delete Story</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Show interaction controls only for other users' stories */}
        {!isViewingOwnStory && (
          <>
            <View style={likeStyles.bottomBar}>
              <View style={likeStyles.leftActions} />
            </View>

            <View pointerEvents="none" style={burstStyles.layer}>
              {emojiBursts.map(b => (
                <Animated.Text
                  key={b.id}
                  style={[
                    burstStyles.emoji,
                    {
                      left: b.x - 14,
                      transform: [{ translateY: b.ty }, { scale: b.scale }],
                      opacity: b.opacity,
                    },
                  ]}
                >
                  {b.emoji}
                </Animated.Text>
              ))}
            </View>

            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
              style={inputStyles.wrap}
            >
              <View style={inputStyles.quickRow}>
                {['👍', '👏', '🔥', '😍', '😂', '😮'].map(emo => (
                  <TouchableOpacity
                    key={emo}
                    style={inputStyles.quickBtn}
                    onPress={() => {
                      handlePause();
                      spawnEmojiBurst(emo);
                      onAddComment(ownerId, storyId, emo);
                      setTimeout(handleResume, 800);
                    }}
                  >
                    <Text style={inputStyles.quickText}>{emo}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={inputStyles.row}>
                <TouchableOpacity
                  style={likeStyles.actionBtn}
                  onPress={() => onToggleLike(ownerId, storyId, !liked)}
                >
                  <Icon
                    name={liked ? 'heart' : 'heart-outline'}
                    size={26}
                    color={liked ? 'red' : '#fff'}
                  />
                </TouchableOpacity>

                <TextInput
                  placeholder="Send message"
                  placeholderTextColor="#aaa"
                  style={inputStyles.input}
                  value={commentText}
                  onChangeText={setCommentText}
                  onFocus={handlePause}
                  onBlur={handleResume}
                  onSubmitEditing={() => {
                    const text = commentText.trim();
                    if (text) {
                      onAddComment(ownerId, storyId, text);
                      setCommentText('');
                    }
                  }}
                  returnKeyType="send"
                />
                <TouchableOpacity
                  style={inputStyles.sendBtn}
                  onPress={() => {
                    const text = commentText.trim();
                    if (text) {
                      onAddComment(ownerId, storyId, text);
                      setCommentText('');
                    }
                  }}
                >
                  <Icon name="send" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </>
        )}

        {/* Options sheet only for other users' stories */}
        {!isViewingOwnStory && (
          <OptionsSheet
            visible={optionsOpen}
            onClose={closeOptions}
            isMuted={currentUser.muted}
            onToggleMute={() => {
              onMuteUser(currentUser.id, !currentUser.muted);
              closeOptions();
            }}
            onReport={() => {
              onReportUser(currentUser.id);
              closeOptions();
            }}
            username={currentUser.username}
          />
        )}

        {/* Story Analytics Modal */}
        <StoryAnalytics
          visible={analyticsVisible}
          onClose={closeAnalytics}
          story={currentStory}
          currentUser={currentUser}
        />
      </View>
    </Modal>
  );
};

const formatTime = timestamp => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

export default function Stories({ refreshTick, sidebarMode = false }) {
  const styles = createStyles();
  const [stories, setStories] = useState([]);
  const [likes, setLikes] = useState({});
  const [comments, setComments] = useState({});
  const [viewerVisible, setViewerVisible] = useState(false);
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [viewerSession, setViewerSession] = useState(0);
  const [composerVisible, setComposerVisible] = useState(false);
  const [composerMedia, setComposerMedia] = useState(null);
  const [composerList, setComposerList] = useState([]);
  const profileImage = useSelector(state => state.profileImage?.profileImg);
  const toast = useToast()
  const dispatch = useDispatch();

  // Fetch stories from API
  // Replace your existing fetchStories function with this corrected version

  const fetchStories = async () => {
    try {
      const id = await AsyncStorage.getItem('userId');
      dispatch(showLoader());

      // Fetch user's own stories
      const userStoriesResponse = await getStoryByUser(id);

      // Fetch following users' stories
      let followingStoriesResponse;
      try {
        followingStoriesResponse = await getFollowingUserStories();
      } catch (followingError) {
        console.warn('Error fetching following stories:', followingError);
        followingStoriesResponse = { data: [] };
      }

      // Process user's own stories
      const userStoriesRaw = userStoriesResponse?.data
        ? (Array.isArray(userStoriesResponse.data)
          ? userStoriesResponse.data
          : [userStoriesResponse.data]
        ).reverse()
        : [];

      // Process following users' stories
      const followingStoriesRaw = followingStoriesResponse?.data
        ? (Array.isArray(followingStoriesResponse.data) ? followingStoriesResponse.data : [followingStoriesResponse.data])
        : [];

      // Create current user bucket
      const currentUserBucket = {
        id: 'current_user',
        username: 'Your Drops',
        image: profileImage || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
        isUser: true,
        hasUnseenStory: false,
        muted: false,
        stories: userStoriesRaw.flatMap((story) => {
          const ts = new Date(story.createdAt || story.updatedAt || Date.now()).getTime();
          return (story.media || []).map((url, idx) => ({
            id: `${story.id}_${idx}`,
            type: (String(url).toLowerCase().includes('.mp4') || String(url).toLowerCase().includes('video')) ? 'video' : 'image',
            uri: String(url).trim(),
            duration: url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('video') ? 15000 : 5000,
            timestamp: ts,
            seen: false,
            views: [],
            likes: [],
            comments: [],
          }));
        }),
      };

      // Group following users' stories by userId
      const userStoriesMap = new Map();

      followingStoriesRaw.forEach((userStory) => {
        const userId = userStory.userId || userStory.id;
        const username = userStory.user?.displayName || userStory.user?.userName || userStory.user?.username || 'Unknown User';
        const userImage = userStory.user?.image || '';

        const ts = new Date(userStory.createdAt || userStory.updatedAt || Date.now()).getTime();

        // Create story objects for this user's media
        const storyObjects = (userStory.media || []).map((url, idx) => ({
          id: `${userStory.id}_${idx}`,
          type: (String(url).toLowerCase().includes('.mp4') || String(url).toLowerCase().includes('video')) ? 'video' : 'image',
          uri: String(url).trim(),
          duration: url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('video') ? 15000 : 5000,
          timestamp: ts,
          seen: false,
          views: [],
          likes: [],
          comments: [],
        }));

        // Check if this user already exists in the map
        if (userStoriesMap.has(userId)) {
          // Add stories to existing user
          const existingUser = userStoriesMap.get(userId);
          existingUser.stories.push(...storyObjects);
        } else {
          // Create new user entry
          userStoriesMap.set(userId, {
            id: userId,
            username: username,
            image: userImage,
            isUser: false,
            hasUnseenStory: true,
            muted: false,
            stories: storyObjects,
          });
        }
      });

      // Convert map to array and filter out users without stories
      const followingUsersBuckets = Array.from(userStoriesMap.values())
        .filter(user => user.stories.length > 0 && user.id);

      // Combine all stories: current user first, then following users
      const transformedStories = [currentUserBucket, ...followingUsersBuckets];

      setStories(transformedStories);
    } catch (error) {
      console.error('Error fetching stories:', error);
      setStories([{
        id: 'current_user',
        username: 'Your Drops',
        image: 'https://via.placeholder.com/150',
        isUser: true,
        hasUnseenStory: false,
        muted: false,
        stories: []
      }]);
    } finally {
      dispatch(hideLoader());
    }
  };

  useEffect(() => {
    if (!profileImage) return;
    setStories(prev =>
      prev.map(u => u.isUser ? { ...u, image: profileImage } : u)
    );
  }, [profileImage]);


  const loadProfileData = async () => {
    try {
      const viewerId = await AsyncStorage.getItem('userId');
      if (!viewerId) return;
      const resp = await getUserCredentials(viewerId);
      if (resp?.statusCode === 200) {
        const raw = resp?.data?.image;
        dispatch(setProfileImg(raw));
      }
    } catch (e) {
      dispatch(hideLoader());
    }
  };


  // Load stories on component mount
  useEffect(() => {
    fetchStories();
    loadProfileData();
  }, []);

  // Re-fetch whenever the screen gains focus
  useFocusEffect(
    useCallback(() => {
      fetchStories();
      loadProfileData();
    }, [])
  );

  // Re-fetch when HomeScreen triggers a refresh (pull-to-refresh)
  useEffect(() => {
    if (typeof refreshTick === 'number') {
      fetchStories();
    }
  }, [refreshTick]);

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

  const handleAddStory = () => {
    Alert.alert('Add Story', 'Choose how to add your story', [
      { text: 'Camera', onPress: () => openCamera() },
      { text: 'Gallery', onPress: () => openGallery() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleAddNewStory = () => {
    Alert.alert('Add New Story', 'Choose how to add your new story', [
      { text: 'Camera', onPress: () => openCamera() },
      { text: 'Gallery', onPress: () => openGallery() },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
      handleMediaSelected(response);
    });
  };

  const handleMediaSelected = response => {
    const asset = response?.assets?.[0];
    if (!asset || !asset.uri) {
      Alert.alert('Oops', 'Could not read the selected media.');
      return;
    }
    const type = asset.type?.startsWith('video') ? 'video' : 'image';
    const duration =
      type === 'video'
        ? asset.duration
          ? asset.duration * 1000
          : 15000
        : 5000;
    setComposerMedia({ type, uri: asset.uri, duration });
    setComposerVisible(true);
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
        // Update local state with new stories
        setStories(prev =>
          prev.map(user =>
            user.isUser
              ? {
                ...user,
                hasUnseenStory: true,
                stories: [
                  ...user.stories,
                  ...processedArray.map(item => ({
                    id: `story_${Date.now()}_${Math.random()}`,
                    type: item.isVideo ? 'video' : 'image',
                    uri: item.processedUri || item.original.uri,
                    duration: item.isVideo
                      ? item.original.duration || 15000
                      : 5000,
                    timestamp: Date.now(),
                    seen: false,
                    views: [],
                    likes: [],
                    comments: [],
                    edits: {
                      filterKey: item.filterKey,
                      stickers: item.stickers,
                      texts: item.texts,
                    },
                  })),
                ],
              }
              : user,
          ),
        );


        showToastMessage(toast, 'success', 'Story Uploaded Successfully');
        fetchStories();
      } else {
        showToastMessage(toast, 'danger', 'Failed to upload story please try again');
      }
    } catch (error) {
      console.error('Error uploading story:', error);
      showToastMessage(toast, 'danger', 'Something Went Wrong ! please try again');
    }
  };

  const handleOpenStory = (user, userIndex) => {
    // If user has no stories, directly open add story
    if (user.isUser && user.stories.length === 0) {
      handleAddStory();
      return;
    }

    // If user has stories, show options dialog
    if (user.isUser && user.stories.length > 0) {
      Alert.alert(
        'Your Story',
        'What would you like to do?',
        [
          {
            text: 'View Story',
            onPress: () => openStoryViewer(user, userIndex),
          },
          {
            text: 'Add Another Story',
            onPress: () => handleAddNewStory(),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
        { cancelable: true }
      );
      return;
    }

    // For other users' stories, directly open viewer
    if (!user.stories?.length || user.muted) return;
    openStoryViewer(user, userIndex);
  };

  const openStoryViewer = (user, userIndex) => {
    // Warm the image cache for the first item to reduce first-open delay
    const first = user.stories?.[0];
    if (first?.type === 'image' && first?.uri) {
      try { Image.prefetch(first.uri); } catch (_e) { }
    }
    setCurrentUserIndex(userIndex);
    setCurrentStoryIndex(0);
    // bump session to force a fresh StoryViewer mount (prevents "stuck" on reopen)
    setViewerSession(s => s + 1);
    setViewerVisible(true);

    // Mark first story as seen for following users (not for current user's own stories)
    if (!user.isUser) {
      setTimeout(() => {
        markStoryAsSeen(user.id, 0);
      }, 500);
    }
  };

  const nextUserWithStories = fromIndex => {
    for (let i = fromIndex + 1; i < stories.length; i++)
      if (!stories[i].muted && stories[i].stories?.length) return i;
    return -1;
  };

  const prevUserWithStories = fromIndex => {
    for (let i = fromIndex - 1; i >= 0; i--)
      if (!stories[i].muted && stories[i].stories?.length) return i;
    return -1;
  };

  const handleNextStory = () => {
    const user = stories[currentUserIndex];
    if (!user) return handleCloseViewer();

    // Mark current story as seen if it's not the user's own story
    if (!user.isUser) {
      markStoryAsSeen(user.id, currentStoryIndex);
    }

    if (currentStoryIndex < (user.stories?.length || 0) - 1) {
      setCurrentStoryIndex(i => i + 1);
      return;
    }
    const nextIdx = nextUserWithStories(currentUserIndex);
    if (nextIdx !== -1) {
      setCurrentUserIndex(nextIdx);
      setCurrentStoryIndex(0);
      return;
    }
    handleCloseViewer();
  };

  const handlePrevStory = () => {
    const user = stories[currentUserIndex];
    if (!user) return handleCloseViewer();
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(i => i - 1);
      return;
    }
    const prevIdx = prevUserWithStories(currentUserIndex);
    if (prevIdx !== -1) {
      setCurrentUserIndex(prevIdx);
      setCurrentStoryIndex(stories[prevIdx].stories.length - 1);
      return;
    }
    handleCloseViewer();
  };

  // Mark individual story as seen
  const markStoryAsSeen = (userId, storyIndex) => {
    setStories(prev =>
      prev.map(user =>
        user.id === userId
          ? {
            ...user,
            stories: user.stories.map((story, idx) =>
              idx === storyIndex ? { ...story, seen: true } : story
            ),
            // Check if all stories are seen to update hasUnseenStory
            hasUnseenStory: user.stories.some((story, idx) => idx !== storyIndex && !story.seen),
          }
          : user,
      ),
    );
  };

  // Go to next user (stop at last)
  const handleNextUser = () => {
    const nextIdx = nextUserWithStories(currentUserIndex);
    if (nextIdx !== -1) {
      setCurrentUserIndex(nextIdx);
      setCurrentStoryIndex(0);
    }
  };

  // Go to previous user (stop at first)
  const handlePrevUser = () => {
    const prevIdx = prevUserWithStories(currentUserIndex);
    if (prevIdx !== -1) {
      setCurrentUserIndex(prevIdx);
      setCurrentStoryIndex(stories[prevIdx].stories.length - 1);
    }
  };

  const handleCloseViewer = () => {
    setViewerVisible(false);
    setCurrentUserIndex(0);
    setCurrentStoryIndex(0);
    dispatch(hideLoader());
  };

  // Delete story function
  const handleDeleteStory = async (storyId) => {
    try {
      const response = await DeleteStory(storyId.replace('_0', ''));

      if (response?.success) {
        // Remove story from local state
        setStories(prev =>
          prev.map(user =>
            user.isUser
              ? {
                ...user,
                stories: user.stories.filter(story => story.id !== storyId),
                hasUnseenStory: user.stories.filter(story => story.id !== storyId).length > 0
              }
              : user
          )
        );

        showToastMessage(toast, 'success', 'Story deleted successfully!');

        // If this was the last story or only story, close viewer
        const currentUser = stories[currentUserIndex];
        if (!currentUser || currentUser.stories.length <= 1) {
          handleCloseViewer();
        } else if (currentStoryIndex >= currentUser.stories.length - 1) {
          // If we deleted the last story, go to previous one
          setCurrentStoryIndex(Math.max(0, currentStoryIndex - 1));
        }

        // Refresh stories from server
        fetchStories();
      } else {
        showToastMessage(toast, 'danger', 'Failed to delete story. Please try again.');
      }
    } catch (error) {
      showToastMessage(toast, 'danger', 'Failed to delete story. Please try again.');
    }
  };

  // API-integrated handlers
  const onToggleLike = async (ownerId, storyId, nextLiked) => {
    try {
      // Extract the actual story ID (remove the _0 suffix that was added for display)
      const actualStoryId = storyId.replace('_0', '');

      // Call the API
      const response = await postLikeStory({ storyId: actualStoryId });

      if (response?.success) {
        // Update local state on success
        const key = `${ownerId}:${storyId}`;
        setLikes(prev => {
          const curr = prev[key] || { liked: false, count: 0 };
          let count = curr.count;
          if (nextLiked && !curr.liked) count += 1;
          if (!nextLiked && curr.liked && count > 0) count -= 1;
          return { ...prev, [key]: { liked: nextLiked, count } };
        });

        // Show success feedback if needed
      } else {
        // Handle API error
        console.error('Failed to like story:', response);
        showToastMessage(toast, 'danger', 'Failed to like story. Please try again.');
      }
    } catch (error) {
      console.error('Error liking story:', error);
      showToastMessage(toast, 'danger', 'Something went wrong. Please try again.');
    }
  };

  const onAddComment = async (ownerId, storyId, text) => {
    try {
      // Extract the actual story ID (remove the _0 suffix that was added for display)
      const actualStoryId = storyId.replace('_0', '');
      // Call the API
      const response = await postCommentStory({
        comment: text,
        storyId: actualStoryId
      });

      if (response?.success) {
        // Update local state on success
        const key = `${ownerId}:${storyId}`;
        setComments(prev => {
          const arr = prev[key] || [];
          return {
            ...prev,
            [key]: [...arr, { user: 'you', text, ts: Date.now() }],
          };
        });

      } else {
        // Handle API error
        console.error('Failed to add comment:', response);
        showToastMessage(toast, 'danger', 'Failed to send comment. Please try again.');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      showToastMessage(toast, 'danger', 'Something went wrong. Please try again.');
    }
  };

  const onMuteUser = (userId, mute) => {
    setStories(prev =>
      prev.map(u => (u.id === userId ? { ...u, muted: !!mute } : u)),
    );
    Alert.alert(
      mute ? 'Muted' : 'Unmuted',
      mute
        ? 'You will no longer see their stories.'
        : 'You will see their stories again.',
    );
  };

  const onReportUser = userId => {
    const u = stories.find(s => s.id === userId);
    Alert.alert(
      'Report',
      `Thanks for letting us know. We'll review ${u?.username}'s story.`,
    );
  };

  const dataToShow = stories.filter(s => !s.muted);
  const ITEM_W = 80;
  const getItemLayout = (_, index) => ({
    length: ITEM_W,
    offset: ITEM_W * index,
    index,
  });

  const renderStoryItem = ({ item }) => (
    <TouchableOpacity
      style={sidebarMode ? sidebarStyles.verticalStoryItem : styles.storyItem}
      onPress={() =>
        handleOpenStory(
          item,
          stories.findIndex(s => s.id === item.id),
        )
      }
      activeOpacity={0.8}
    >
      <View style={[item.isUser && (sidebarMode ? sidebarStyles.verticalUserBorder : styles.userBorder)]}>
        {item.isUser && item.stories.length === 0 && (
          <Icon
            name="add-circle"
            size={sidebarMode ? 20 : 28}
            style={sidebarMode ? sidebarStyles.verticalAddIcon : styles.addIcon}
          />
        )}
        <HexAvatar
          uri={item.isUser ? (profileImage || item.image) : item.image}
          isUser={!!item.isUser}
          size={sidebarMode ? 56 : 65}
          borderWidth={item.isUser ? 3 : 2}
          borderColor={item.isUser ? '#4da3ff' : '#000'}
        />
        {item.isUser && item.stories.length > 0 && (
          <TouchableOpacity
            style={sidebarMode ? sidebarStyles.verticalAddStoryOverlay : styles.addStoryOverlay}
            onPress={(e) => {
              e.stopPropagation();
              handleAddNewStory();
            }}
            activeOpacity={0.8}
          >
            <View style={sidebarMode ? sidebarStyles.verticalAddStoryButton : styles.addStoryButton}>
              <Icon name="add" size={sidebarMode ? 12 : 16} color="#fff" />
            </View>
          </TouchableOpacity>
        )}
      </View>
      {!sidebarMode && (
        <Text style={styles.storyUsername} numberOfLines={1}>
          {item.username}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.storiesContainer}>
      <FlatList
        horizontal={!sidebarMode}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        data={dataToShow}
        keyExtractor={item => item.id}
        initialNumToRender={10}
        windowSize={5}
        removeClippedSubviews
        contentContainerStyle={
          sidebarMode
            ? { paddingVertical: 8, paddingHorizontal: 8 }
            : { paddingHorizontal: 8 }
        }
        renderItem={renderStoryItem}
      />

      <StoryViewer
        key={`viewer-${viewerSession}`}
        visible={viewerVisible}
        stories={stories}
        currentUserIndex={currentUserIndex}
        currentStoryIndex={currentStoryIndex}
        onClose={handleCloseViewer}
        onNext={handleNextStory}
        onPrev={handlePrevStory}
        onNextUser={handleNextUser}
        onPrevUser={handlePrevUser}
        likes={likes}
        onToggleLike={onToggleLike}
        onAddComment={onAddComment}
        onMuteUser={onMuteUser}
        onReportUser={onReportUser}
        onDeleteStory={handleDeleteStory}
        ownerProfileImage={profileImage}
      />

      <StoryComposer
        modalVisible={composerVisible}
        mediaList={composerList}
        onCancel={() => setComposerVisible(false)}
        onDone={handleComposerDone}
      />
    </View>
  );
}

const sidebarStyles = StyleSheet.create({
  verticalStoriesContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  verticalStoryItem: {
    alignItems: 'center',
    marginVertical: 8,
    width: '100%',
  },
  verticalUserBorder: {
    position: 'relative',
  },
  verticalAddIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
  },
  verticalAddStoryOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    zIndex: 10,
  },
  verticalAddStoryButton: {
    backgroundColor: '#4da3ff',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
});