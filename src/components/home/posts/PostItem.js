import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, Animated, StyleSheet, Dimensions, Linking } from 'react-native';
import { PanGestureHandler, PinchGestureHandler, TapGestureHandler, State } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import Video from 'react-native-video';
import { WhiteDragonfly } from '../../../assets/icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ShareModal from '../../modals/ShareModal';
import { ActivityIndicator } from 'react-native';
import { getDragonflyIcon } from '../../profile/ProfilePersonalData';
import { hideLoader, showLoader } from '../../../redux/actions/LoaderAction';
import { showToastMessage } from '../../displaytoastmessage';
import { useDispatch } from 'react-redux';
import { useToast } from 'react-native-toast-notifications';
import { getUserCredentials, getUserDashboard } from '../../../services/post';
import { useAppTheme } from '../../../theme/useApptheme';

const { width } = Dimensions.get('window');

/* ----------------------------------------- */
function InstagramZoomableImage({ uri, onZoomChange, onDoubleTap, onOpenViewer }) {
  const pinchRef = useRef();
  const hasOpenedRef = useRef(false);
  const MIN_SCALE_TO_OPEN = 0.8;

  const onPinchEvent = (e) => {
    const { scale = 1, numberOfPointers = 0, state } = e.nativeEvent || {};
    if (!hasOpenedRef.current && numberOfPointers >= 2 && scale > MIN_SCALE_TO_OPEN) {
      hasOpenedRef.current = true;
      onZoomChange?.(true);
      onOpenViewer?.(uri);
    }
  };

  const onPinchStateChange = ({ nativeEvent }) => {
    if (nativeEvent.oldState === State.ACTIVE) {
      onZoomChange?.(false);
      hasOpenedRef.current = false;
    }
  };

  const onDoubleTapStateChange = ({ nativeEvent }) => {
    if (nativeEvent.state === State.ACTIVE) {
      onDoubleTap?.(uri);
    }
  };

  return (
    <PinchGestureHandler
      ref={pinchRef}
      onGestureEvent={onPinchEvent}
      onHandlerStateChange={onPinchStateChange}
    >
      <TapGestureHandler
        numberOfTaps={2}
        onHandlerStateChange={onDoubleTapStateChange}
      >
        <Image source={{ uri }} style={styles.postMedia} resizeMode="cover" />
      </TapGestureHandler>
    </PinchGestureHandler>
  );
}

/* ----------------------------------------- */
function InlineFullscreenViewer({ uri, visible, onRequestClose }) {
  if (!visible) return null;

  const screen = Dimensions.get('window');
  const pinchScale = useRef(new Animated.Value(1)).current;
  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const focalX = useRef(new Animated.Value(0)).current;
  const focalY = useRef(new Animated.Value(0)).current;
  const panOffsetX = useRef(0);
  const panOffsetY = useRef(0);
  const pinchRef = useRef();
  const panRef = useRef();

  const clampedScale = pinchScale.interpolate({
    inputRange: [1, 4],
    outputRange: [1, 4],
    extrapolate: 'clamp',
  });

  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale: pinchScale, focalX: focalX, focalY: focalY } }],
    { useNativeDriver: false }
  );

  const onPanEvent = Animated.event(
    [{ nativeEvent: { translationX: panX, translationY: panY } }],
    { useNativeDriver: false }
  );

  const onPanStateChange = ({ nativeEvent }) => {
    if (nativeEvent.state === State.BEGAN) {
      panX.setOffset(panOffsetX.current);
      panY.setOffset(panOffsetY.current);
      panX.setValue(0);
      panY.setValue(0);
    }
    if (nativeEvent.state === State.END || nativeEvent.state === State.CANCELLED || nativeEvent.oldState === State.ACTIVE) {
      panOffsetX.current = panOffsetX.current + (nativeEvent.translationX || 0);
      panOffsetY.current = panOffsetY.current + (nativeEvent.translationY || 0);
      panX.setOffset(panOffsetX.current);
      panY.setOffset(panOffsetY.current);
      panX.setValue(0);
      panY.setValue(0);
    }
  };

  const resetTransform = (cb) => {
    Animated.parallel([
      Animated.spring(pinchScale, { toValue: 1, useNativeDriver: false }),
      Animated.spring(panX, { toValue: 0, useNativeDriver: false }),
      Animated.spring(panY, { toValue: 0, useNativeDriver: false }),
    ]).start(cb);
  };

  const onPinchStateChange = ({ nativeEvent }) => {
    if (nativeEvent.oldState === State.ACTIVE) {
      panOffsetX.current = 0;
      panOffsetY.current = 0;
      panX.setOffset(0);
      panY.setOffset(0);
      resetTransform(onRequestClose);
    }
  };

  const onDoubleTapStateChange = ({ nativeEvent }) => {
    if (nativeEvent.state === State.ACTIVE) {
      resetTransform(onRequestClose);
    }
  };

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', zIndex: 9999 }]}>
      <PinchGestureHandler
        ref={pinchRef}
        onGestureEvent={onPinchEvent}
        onHandlerStateChange={onPinchStateChange}
      >
        <PanGestureHandler
          ref={panRef}
          simultaneousHandlers={pinchRef}
          onGestureEvent={onPanEvent}
          onHandlerStateChange={(e) => {
            onPanStateChange({ nativeEvent: e.nativeEvent });
            if (e.nativeEvent.state === State.END || e.nativeEvent.state === State.CANCELLED || e.nativeEvent.oldState === State.ACTIVE) {
              panOffsetX.current = 0;
              panOffsetY.current = 0;
              panX.setOffset(0);
              panY.setOffset(0);
              resetTransform(onRequestClose);
            }
          }}
        >
          <TapGestureHandler
            numberOfTaps={2}
            onHandlerStateChange={onDoubleTapStateChange}
          >
            <Animated.Image
              source={{ uri }}
              style={{
                width: screen.width,
                height: screen.height,
                transform: [
                  { translateX: panX },
                  { translateY: panY },
                  { scale: clampedScale },
                ],
              }}
              resizeMode="contain"
            />
          </TapGestureHandler>
        </PanGestureHandler>
      </PinchGestureHandler>
    </View>
  );
}

export default function PostItem({
  item,
  likesCount,
  commentsCount,
  liked,
  saved,
  onToggleLike,
  onToggleSave,
  onToggleFollow,
  onComment,
  onOptions,
  followingBusy = false,
  isBusinessProfile,
  executeFollowAction,
  isVisible = false,
  screenFocused = true,
  playingPostId,
  currentlyVisiblePostId,
}) {
  const heartScale = useRef(new Animated.Value(1)).current;
  const listRef = useRef(null);
  const videoRefsMap = useRef({});
  const [totalFollowers, setTotalFollowers] = useState(0);
  const [userProfile, setUserProfile] = useState('');
  const isCompanyProfile = userProfile === 'company';
  const DragonflyIcon = getDragonflyIcon(totalFollowers, isCompanyProfile);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [videoStates, setVideoStates] = useState({});
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [isZooming, setIsZooming] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUri, setViewerUri] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isMuted, setIsMuted] = useState(true);

  const navigation = useNavigation();
  const shareRef = useRef(null);
  const dispatch = useDispatch();
  const toast = useToast();
  const { text } = useAppTheme();

  if (!item || !item.id) {
    console.warn('PostItem received invalid item:', item);
    return null;
  }

  const safeMedia = item.media || [];
  const mediaLength = safeMedia.length;

  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const id = await AsyncStorage.getItem('userId');
        setUserId(id);
      } catch (error) {
        console.error('Error fetching userId:', error);
      }
    };
    fetchUserId();

    if (item?.UserId) {
      fetchAllData();
    }
  }, [item?.UserId]);

  const fetchAllData = async () => {
    if (!item?.UserId) {
      console.warn('No UserId available for fetching data');
      return;
    }

    try {
      dispatch(showLoader());
      const [dashboardResponse, profileResponse] = await Promise.allSettled([
        getUserDashboard(item.UserId),
        getUserCredentials(item.UserId)
      ]);

      if (dashboardResponse.status === 'fulfilled') {
        const data = dashboardResponse.value;
        if (data?.statusCode === 200) {
          setTotalFollowers(data.data?.dashboardData?.totalFollowers || 0);
        } else {
          console.warn('Dashboard fetch failed:', data?.data?.message);
        }
      } else {
        console.error('Dashboard fetch rejected:', dashboardResponse.reason);
      }

      if (profileResponse.status === 'fulfilled') {
        const data = profileResponse.value;
        if (data?.statusCode === 200) {
          let userDataToSet;
          if (data.data && data.data.user) {
            userDataToSet = data.data.user;
          } else if (data.data) {
            userDataToSet = data.data;
          } else {
            userDataToSet = data;
          }
          setUserProfile(userDataToSet.profile || '');
        } else {
          console.warn('Profile fetch failed:', data?.data?.message);
        }
      } else {
        console.error('Profile fetch rejected:', profileResponse.reason);
      }
    } catch (error) {
      console.error('Error in fetchAllData:', error);
      showToastMessage(
        toast,
        'danger',
        error?.response?.message ?? 'Failed to load user data',
      );
    } finally {
      dispatch(hideLoader());
    }
  };

  // FIX 1: Add safe pause function with null checks
  const safeVideoPause = useCallback((index) => {
    try {
      const ref = videoRefsMap.current[index];
      if (ref && typeof ref.pause === 'function') {
        ref.pause();
      }
    } catch (error) {
      console.warn(`Error pausing video at index ${index}:`, error);
    }
  }, []);

  // FIX 2: Improved video state management with stable dependencies
  useEffect(() => {
    if (mediaLength <= 0) return;

    const nextStates = {};
    for (let idx = 0; idx < mediaLength; idx++) {
      const shouldPause = !(
        idx === currentIndex &&
        isVisible &&
        screenFocused &&
        String(playingPostId) === String(item.id)
      );
      nextStates[idx] = shouldPause;
    }

    setVideoStates(prev => {
      const hasChanged = Object.keys(nextStates).some(
        key => prev[key] !== nextStates[key]
      );
      return hasChanged ? nextStates : prev;
    });

    // FIX 3: Use safe pause with timeout to ensure refs are ready
    setTimeout(() => {
      Object.entries(nextStates).forEach(([idx, shouldPause]) => {
        if (shouldPause) {
          safeVideoPause(parseInt(idx));
        }
      });
    }, 100);

  }, [currentIndex, isVisible, screenFocused, playingPostId, item.id, mediaLength, safeVideoPause]);

  // FIX 4: Cleanup on unmount with safe pause
  useEffect(() => {
    return () => {
      Object.keys(videoRefsMap.current).forEach(idx => {
        safeVideoPause(parseInt(idx));
      });
      videoRefsMap.current = {};
    };
  }, [safeVideoPause]);

  const handleUserProfile = (id) => {
    if (userId === id) {
      navigation.navigate('ProfileMain', { screen: 'Profile' });
    } else {
      navigation.navigate('UsersProfile', { userId: id });
    }
  };

  const formatNumber = (n) => {
    if (typeof n !== 'number') n = Number(n) || 0;
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const isVideoUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase().split('?')[0];
    const exts = ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp', 'm4v'];
    return exts.some((ext) => lower.endsWith(`.${ext}`));
  };

  const buyerList = Array.isArray(item.boughtBy) ? item.boughtBy : Array.isArray(item.buyers) ? item.buyers : [];

  const animateHeart = () => {
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.2, duration: 80, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const handleLike = () => {
    onToggleLike?.();
    animateHeart();
  };

  const mockDonationData = {
    raisedAmount: item.raiseAmount ?? 0,
    goalAmount: item.goalAmount ?? 100000000,
    daysLeft: item.daysLeft ?? 0,
  };

  const postData = { ...item, ...mockDonationData };
  const progressPercent = postData.goalAmount > 0 ? (postData.raisedAmount / postData.goalAmount) * 100 : 0;

  const getProgressBarColor = () => {
    if (progressPercent >= 75) return (item?.profile == "user" ? '#5a2d82' : '#D3B683');
    if (progressPercent >= 50) return (item?.profile == "user" ? '#5a2d82' : '#D3B683');
    if (progressPercent >= 25) return '#FF9800';
    return '#F44336';
  };

  const onMomentumEnd = (e) => {
    const x = e?.nativeEvent?.contentOffset?.x ?? 0;
    const index = Math.round(x / width);
    if (index !== currentIndex) setCurrentIndex(index);
  };

  const renderMedia = ({ item: mediaItem, index }) => {
    const isVideo = mediaItem.type === 'video' || isVideoUrl(mediaItem.url);
    const isPaused = videoStates[index] ?? true;

    const shouldPlay = 
      screenFocused &&
      String(playingPostId) === String(item.id) &&
      String(currentlyVisiblePostId) === String(item.id) &&
      isVisible &&
      index === currentIndex &&
      !isPaused &&
      !isZooming;

    return (
      <View style={styles.mediaContainer}>
        {isVideo ? (
          <>
            <Video
              ref={(ref) => {
                // FIX 5: Only set ref if it's valid
                if (ref) {
                  videoRefsMap.current[index] = ref;
                }
              }}
              source={{ uri: mediaItem.url }}
              style={styles.postMedia}
              resizeMode="cover"
              repeat
              paused={!shouldPlay}
              muted={isMuted || isPaused}
              controls={false}
              onError={(error) => {
                console.log('Video error:', error);
              }}
              playWhenInactive={false}
              progressUpdateInterval={500}
            />
            <TouchableOpacity
              style={[styles.videoOverlay, isPaused ? {} : styles.videoOverlayTransparent]}
              activeOpacity={1}
              onPress={() => {
                if (isVisible && screenFocused) {
                  setVideoStates((prev) => ({
                    ...prev,
                    [index]: !prev[index]
                  }));
                }
              }}
            >
              {isPaused && (
                <View style={styles.playButtonContainer}>
                  <Icon name="play" size={32} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.speakerButton}
              onPress={() => setIsMuted((prev) => !prev)}
            >
              <Feather name={isMuted ? 'volume-x' : 'volume-2'} size={20} color="#fff" />
            </TouchableOpacity>
          </>
        ) : (
          <InstagramZoomableImage
            uri={mediaItem.url}
            onZoomChange={(zoomed) => {
              setIsZooming(zoomed);
              setScrollEnabled(!zoomed);
            }}
            onDoubleTap={(uri) => {
              setViewerUri(uri);
              setViewerOpen(true);
              setScrollEnabled(false);
            }}
            onOpenViewer={(uri) => {
              setViewerUri(uri);
              setViewerOpen(true);
              setScrollEnabled(false);
            }}
          />
        )}
      </View>
    );
  };

  return (
    <View style={styles.wrapper}>
      {isZooming && <View style={styles.zoomBackdrop} pointerEvents="none" />}

      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <TouchableOpacity onPress={() => handleUserProfile(item.UserId)} style={styles.avatarContainer}>
            <Image source={{ uri: item.userAvatar }} style={styles.avatar} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleUserProfile(item.UserId)} style={styles.userInfo}>
            <View style={styles.userRow}>
              <Text style={styles.username}>{item.username}</Text>
              <View style={styles.dragonflyIcon}>
                <DragonflyIcon width={18} height={18} />
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.priceSection}>
            <WhiteDragonfly width={20} height={20} style={styles.triangleIcon} />
            <Text style={[styles.priceText, {color: item?.profile == "user" ? '#5a2d82' : '#D3B683'}]}>$556</Text>
          </View>

          <TouchableOpacity onPress={() => onOptions?.(item.id, item.UserId)} style={styles.moreButton}>
            <Feather name="more-vertical" size={20} color="#374151" />
          </TouchableOpacity>
        </View>

        <View style={styles.mediaWrapper}>
          <FlatList
            ref={listRef}
            data={safeMedia}
            keyExtractor={(_, i) => `media-${i}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEnabled={scrollEnabled}
            onMomentumScrollEnd={onMomentumEnd}
            decelerationRate="fast"
            snapToInterval={width}
            snapToAlignment="start"
            disableIntervalMomentum={true}
            getItemLayout={(_, index) => ({
              length: width,
              offset: width * index,
              index
            })}
            renderItem={renderMedia}
          />

          {item.media && item.media.length > 1 && (
            <>
              <View style={styles.mediaCounter}>
                <Text style={styles.mediaCounterText}>
                  {currentIndex + 1}/{item.media.length}
                </Text>
              </View>

              <View style={styles.dotsContainer}>
                {item.media.map((_, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: idx === currentIndex ? text : 'rgba(255,255,255,0.5)',
                      },
                    ]}
                  />
                ))}
              </View>
            </>
          )}
        </View>

        <View style={styles.actionsSection}>
          <View style={styles.leftActions}>
            <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Icon name={liked ? 'heart' : 'heart-outline'} size={26} color={liked ? '#ef4444' : '#374151'} />
              </Animated.View>
              <Text style={styles.actionCount}>{likesCount || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => onComment?.()} style={styles.actionButton}>
              <Feather name="message-circle" size={24} color="#374151" />
              <Text style={styles.actionCount}>{commentsCount || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => shareRef.current?.open?.()} style={styles.actionButton}>
              <Feather name="send" size={24} color="#374151" />
              <Text style={styles.actionCount}>{item.sharesCount || 0}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => {
              if (!isBusinessProfile && item.UserId !== userId) {
                if (item.profile === 'company') {
                  executeFollowAction(item.UserId, !item.follow);
                } else {
                  onToggleFollow?.(item.UserId, !item.follow, item.userTokenAddress);
                }
              }
            }}
            style={[styles.followButton, item.follow && styles.followingButton, {backgroundColor: item?.profile == "user" ? '#5a2d82' : '#D3B683'}]}
          >
            {followingBusy ? (
              <ActivityIndicator size="small" color={item.follow ? text : '#FFFFFF'} />
            ) : (
              <Text style={[styles.followButtonText, item.follow && styles.followingButtonText]}>
                {isBusinessProfile ? "Support" : item.UserId == userId ? 'Support' : item.follow ? 'Vallowing' : 'Vallow'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {item.UserId != userId && (
          <>
            {buyerList.length > 0 && (
              <View style={styles.buyersSection}>
                <View style={styles.avatarsContainer}>
                  {buyerList.slice(0, 3).map((buyer, idx) => (
                    <View key={idx} style={[styles.buyerAvatarWrapper, { marginLeft: idx > 0 ? -8 : 0 }]}>
                      <Image source={{ uri: buyer.avatar }} style={styles.buyerAvatar} />
                    </View>
                  ))}
                </View>
                <Text style={styles.buyersText} numberOfLines={1}>
                  Vallowed by <Text style={[styles.buyerName,  {color: item?.profile == "user" ? '#5a2d82' : '#D3B683'}]}>{buyerList[0]?.username || '—'}</Text>
                  {buyerList.length > 1 && <Text style={{color: item?.profile == "user" ? '#5a2d82' : '#D3B683'}}> and {formatNumber(buyerList.length - 1)} others</Text>}
                </Text>
              </View>
            )}
          </>
        )}

        <View style={styles.captionSection}>
          <Text>
            <Text style={[styles.captionUsername, {color: item?.profile == "user" ? '#5a2d82' : '#D3B683'}]}>{item.username} </Text>
            <Text style={styles.captionText}>{item.caption}</Text>
          </Text>
          {item.link ? (
            <TouchableOpacity onPress={() => Linking.openURL(item.link)}>
              <Text style={styles.linkText}>Link - {item.link}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {postData.raisedAmount !== undefined && postData.raisedAmount > 0 && (
          <View style={styles.progressSection}>
            <View style={styles.progressBarWrapper}>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(progressPercent, 100)}%`,
                      backgroundColor: getProgressBarColor(),
                    },
                  ]}
                />
              </View>

              <View style={styles.progressStatsContainer}>
                <View style={styles.statAtStart}>
                  <Text style={styles.statValueSmall}>{Math.min(progressPercent, 100).toFixed(1)}% FUNDED</Text>
                </View>
                <View style={styles.statAtCenter}>
                  <Text style={styles.statValueSmall}>${(postData.raisedAmount / 1000).toFixed(0)}K RAISED</Text>
                </View>
                <View style={styles.statAtEnd}>
                  <Text style={styles.statValueSmall}>{postData.daysLeft || 0} DAYS LEFT</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>

      {viewerOpen && (
        <InlineFullscreenViewer
          uri={viewerUri}
          visible={viewerOpen}
          onRequestClose={() => {
            setViewerOpen(false);
            setScrollEnabled(true);
          }}
        />
      )}

      <ShareModal ref={shareRef} url={item.link} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingBottom: 8,
    position: 'relative',
  },
  zoomBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 999,
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    marginVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  userInfo: {
    flex: 1,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    fontWeight: '700',
    color: '#1F2937',
    fontSize: 16,
    marginRight: 6,
  },
  dragonflyIcon: {
    marginTop: 1,
  },
  priceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  triangleIcon: {
    marginRight: 6,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
  },
  moreButton: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  mediaWrapper: {
    position: 'relative',
    width: '100%',
    height: 340,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  mediaContainer: {
    width,
    height: 340,
    position: 'relative',
  },
  postMedia: {
    width,
    height: 340,
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoOverlayTransparent: {},
  playButtonContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },
  videoIndicator: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mediaCounter: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  mediaCounterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 3,
  },
  actionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginRight: 20,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionCount: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 2,
  },
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    // shadowOffset: { width: 0, height: 2 },
    // // shadowOpacity: 0.2,
    // shadowRadius: 4,
    // elevation: 3,
  },
  followingButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  buyersSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    marginTop: -10,
  },
  avatarsContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  buyerAvatarWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  buyerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  buyersText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '400',
    flexShrink: 1,
  },
  buyerName: {
    fontWeight: '600',
  },
  captionSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  captionUsername: {
    fontWeight: '700',
    fontSize: 15,
  },
  captionText: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 4,
  },
  progressContainer: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 3,
  },
  progressSection: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  progressBarWrapper: {
    position: 'relative',
  },
  progressBarBackground: {
    height: 10,
    backgroundColor: '#e0e0e0',
    overflow: 'hidden',
    marginBottom: 50,
  },
  progressBarFill: {
    height: '100%',
  },
  progressStatsContainer: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    height: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  statAtStart: {
    alignItems: 'flex-start',
  },
  statAtCenter: {
    alignItems: 'center',
  },
  statAtEnd: {
    alignItems: 'flex-end',
  },
  statValueSmall: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  statLabelSmall: {
    fontSize: 10,
    fontWeight: '500',
    color: '#666',
    letterSpacing: 0.3,
  },
  speakerButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  linkText: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});