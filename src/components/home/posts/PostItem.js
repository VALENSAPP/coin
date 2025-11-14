import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  Animated,
  StyleSheet,
  Dimensions,
  Linking
} from 'react-native';
import {
  PanGestureHandler,
  PinchGestureHandler,
  TapGestureHandler,
  State,
} from 'react-native-gesture-handler';
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

const { width } = Dimensions.get('window');

/* -----------------------------------------
 * InstagramZoomableImage: In-feed gesture detector
 * - Pinch begins: open fullscreen viewer (for true edge-to-edge pan/zoom)
 * - Double-tap: open fullscreen viewer
 * ---------------------------------------- */
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
    if (nativeEvent.state === State.BEGAN || nativeEvent.state === State.ACTIVE) {
      // Wait for threshold in onPinchEvent; do nothing here
    }
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
      <Animated.View style={{ flex: 1 }}>
        <TapGestureHandler numberOfTaps={2} onHandlerStateChange={onDoubleTapStateChange}>
          <Animated.View style={{ flex: 1 }}>
            <Image
              source={{ uri }}
              resizeMode="cover"
              style={{ width, height: 340 }}
            />
          </Animated.View>
        </TapGestureHandler>
      </Animated.View>
    </PinchGestureHandler>
  );
}

/* -----------------------------------------
 * InlineFullscreenViewer: Absolute overlay in same screen (no modal)
 * - Pinch to zoom, pan freely across entire screen
 * - Double-tap or scale≈1 on release closes
 * ---------------------------------------- */
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
      // On lift from pinch, always spring back to original and close
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
    <View
      pointerEvents="auto"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2000,
        // transparent backdrop to keep same screen feel
        backgroundColor: 'transparent',
      }}
    >
      <PinchGestureHandler
        ref={pinchRef}
        simultaneousHandlers={panRef}
        onGestureEvent={onPinchEvent}
        onHandlerStateChange={onPinchStateChange}
      >
        <Animated.View style={{ flex: 1 }}>
          <PanGestureHandler
            ref={panRef}
            simultaneousHandlers={pinchRef}
            onGestureEvent={onPanEvent}
            onHandlerStateChange={({ nativeEvent }) => {
              onPanStateChange({ nativeEvent });
              if (nativeEvent.state === State.END || nativeEvent.state === State.CANCELLED || nativeEvent.oldState === State.ACTIVE) {
                // On lift from pan, always spring back to original and close
                panOffsetX.current = 0;
                panOffsetY.current = 0;
                panX.setOffset(0);
                panY.setOffset(0);
                resetTransform(onRequestClose);
              }
            }}
          >
            <TapGestureHandler numberOfTaps={2} onHandlerStateChange={onDoubleTapStateChange}>
              <Animated.View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Animated.Image
                  source={{ uri }}
                  resizeMode="contain"
                  style={{
                    width: screen.width,
                    height: screen.height,
                    transform: [
                      { translateX: panX },
                      { translateY: panY },
                      { translateX: focalX },
                      { translateY: focalY },
                      { scale: clampedScale },
                      { translateX: Animated.multiply(focalX, -1) },
                      { translateY: Animated.multiply(focalY, -1) },
                    ],
                  }}
                />
              </Animated.View>
            </TapGestureHandler>
          </PanGestureHandler>
        </Animated.View>
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

  useEffect(() => {
    const fetchUserId = async () => {
      const id = await AsyncStorage.getItem('userId');
      setUserId(id);
    };
    fetchUserId();
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      dispatch(showLoader());

      const [dashboardResponse, profileResponse] = await Promise.all([
        getUserDashboard(item.UserId),
        getUserCredentials(item.UserId)
      ]);

      if (dashboardResponse?.statusCode === 200) {
        setTotalFollowers(dashboardResponse.data.dashboardData.totalFollowers);
      } else {
        showToastMessage(toast, 'danger', dashboardResponse.data.message);
      }

      if (profileResponse?.statusCode === 200) {
        let userDataToSet;
        if (profileResponse.data && profileResponse.data.user) {
          userDataToSet = profileResponse.data.user;
        } else if (profileResponse.data) {
          userDataToSet = profileResponse.data;
        } else {
          userDataToSet = profileResponse;
        }
        setUserProfile(userDataToSet.profile || '');
        console.log('User profile:', userDataToSet.profile);
      } else {
        showToastMessage(toast, 'danger', profileResponse.data.message);
      }

    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.message ?? 'Something went wrong',
      );
    } finally {
      dispatch(hideLoader());
    }
  };

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

  const buyerList = (item.boughtBy || item.buyers) || [];

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

  useEffect(() => {
    if (!item.media || item.media.length <= 0) return;
    setVideoStates(() => {
      const next = {};
      item.media.forEach((_, idx) => { next[idx] = idx !== currentIndex; });
      return next;
    });
  }, [currentIndex, item.media]);

  useEffect(() => {
    if (!isVisible) {
      // Stop all videos immediately
      setVideoStates(() => {
        const paused = {};
        (item.media || []).forEach((_, idx) => {
          paused[idx] = true;
        });
        return paused;
      });

      // Pause all video refs directly
      Object.values(videoRefsMap.current).forEach(ref => {
        if (ref) {
          ref.pause?.();
        }
      });

      setCurrentIndex(0);
      setIsMuted(true);
    }
  }, [isVisible, item.media]);

  // Pause/resume based on the global playingPostId from parent
  useEffect(() => {
    if (String(playingPostId) !== String(item.id)) {
      // if this post is not the playing one, pause everything
      Object.values(videoRefsMap.current).forEach(ref => {
        if (ref) ref.pause?.();
      });
      setVideoStates({});
    } else {
      // if this post becomes the playing one, ensure current index is unpaused
      setVideoStates(() => {
        const next = {};
        (item.media || []).forEach((_, idx) => { next[idx] = idx !== currentIndex; });
        return next;
      });
    }
  }, [playingPostId, item.id, currentIndex]);
  // Stop videos when screen loses focus
  useEffect(() => {
    if (!screenFocused) {
      // Pause all videos when screen loses focus
      setVideoStates(() => {
        const paused = {};
        (item.media || []).forEach((_, idx) => {
          paused[idx] = true;
        });
        return paused;
      });

      Object.values(videoRefsMap.current).forEach(ref => {
        if (ref) {
          ref.pause?.();
        }
      });
    }
  }, [screenFocused, item.media]);

  // Cleanup on unmount
  useEffect(() => {
    if (!item.media || item.media.length <= 0) return;

    setVideoStates(() => {
      const next = {};
      item.media.forEach((_, idx) => {
        // Only the current index video can play if post is visible
        next[idx] = !(idx === currentIndex && isVisible && screenFocused);
      });
      return next;
    });
  }, [currentIndex, item.media, isVisible, screenFocused]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(videoRefsMap.current).forEach(ref => {
        if (ref) {
          ref.pause?.();
        }
      });
      videoRefsMap.current = {};
    };
  }, []);

  const mockDonationData = {
    raisedAmount: item.raiseAmount ?? 0,     // Use value from API or fallback to 0
    goalAmount: item.goalAmount ?? 100000000,    // Temporary until API provides
    daysLeft: item.daysLeft ?? 0,
  };
  const postData = { ...item, ...mockDonationData };

  const progressPercent =
    postData.goalAmount > 0
      ? (postData.raisedAmount / postData.goalAmount) * 100
      : 0;

  const getProgressBarColor = () => {
    if (progressPercent >= 75) return '#5A2D82'; // Green
    if (progressPercent >= 50) return '#5A2D82'; // Blue
    if (progressPercent >= 25) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const onMomentumEnd = (e) => {
    const x = e?.nativeEvent?.contentOffset?.x ?? 0;
    const index = Math.round(x / width);
    if (index !== currentIndex) setCurrentIndex(index);
  };

  const renderMedia = ({ item: mediaItem, index }) => {
    const isVideo = mediaItem.type === 'video' || isVideoUrl(mediaItem.url);
    const isPaused = videoStates[index] ?? true; // Default to paused
    const shouldPlay =
      screenFocused &&
      String(playingPostId) === String(playingPostId) &&
      String(currentlyVisiblePostId) === String(playingPostId) &&
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
                if (ref) videoRefsMap.current[index] = ref;
              }}
              source={{ uri: mediaItem.url }}
              style={styles.postMedia}
              resizeMode="cover"
              repeat
              paused={!shouldPlay}
              muted={isMuted || isPaused}
              controls={false}
              onError={() => { }}
              playWhenInactive={false}
              progressUpdateInterval={500}
            />
            <TouchableOpacity
              style={[styles.videoOverlay, !isPaused && styles.videoOverlayTransparent]}
              activeOpacity={0.7}
              onPress={() => {
                // Only toggle if this post is visible
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
                  <Icon name="play" size={34} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.speakerButton}
              onPress={() => setIsMuted((prev) => !prev)}
            >
              <Icon
                name={isMuted ? 'volume-mute' : 'volume-high'}
                size={20}
                color="#fff"
              />
            </TouchableOpacity>

            <View style={styles.videoIndicator}>
              <Icon name="videocam" size={14} color="#fff" />
            </View>
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
      {isZooming && (
        <View
          pointerEvents="none"
          style={styles.zoomBackdrop}
        />
      )}

      <View style={[
        styles.postCard,
        isZooming && { overflow: 'visible', zIndex: 1000, elevation: 30 }
      ]}>
        <View style={styles.postHeader}>
          <TouchableOpacity onPress={() => handleUserProfile(item.UserId)} style={styles.avatarContainer}>
            <Image
              source={{ uri: item.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }}
              style={styles.avatar}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleUserProfile(item.UserId)} style={styles.userInfo}>
            <View style={styles.userRow}>
              <Text style={styles.username}>{item.username}</Text>
              <DragonflyIcon width={22} height={22} style={styles.dragonflyIcon} />
            </View>
          </TouchableOpacity>

          <View style={styles.priceSection}>
            <Icon name="triangle" size={20} color="#5a2d82" style={styles.triangleIcon} />
            <Text style={styles.priceText}>$556</Text>
          </View>

          <TouchableOpacity
            style={styles.moreButton}
            onPress={() => onOptions?.(item.id, item.UserId)}
          >
            <Icon name="ellipsis-horizontal" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <View style={[
          styles.mediaWrapper,
          isZooming && { overflow: 'visible', zIndex: 1001, elevation: 31 }
        ]}>
          <FlatList
            ref={listRef}
            data={item.media || []}
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
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            renderItem={renderMedia}
          />

          {item.media && item.media.length > 1 && (
            <>
              <View style={styles.mediaCounter}>
                <Text style={styles.mediaCounterText}>{currentIndex + 1}/{item.media.length}</Text>
              </View>

              <View style={styles.dotsContainer}>
                {item.media.map((_, idx) => (
                  <View
                    key={`dot-${idx}`}
                    style={[
                      styles.dot,
                      { backgroundColor: idx === currentIndex ? '#fff' : 'rgba(255,255,255,0.4)' },
                    ]}
                  />
                ))}
              </View>
            </>
          )}
        </View>

        <View style={styles.actionsSection}>
          <View style={styles.leftActions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Icon
                  name={liked ? 'heart' : 'heart-outline'}
                  size={26}
                  color={liked ? '#EF4444' : '#374151'}
                />
              </Animated.View>
              <Text style={styles.actionCount}>{likesCount || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => onComment?.()}>
              <Icon name="chatbubble-outline" size={24} color="#374151" />
              <Text style={styles.actionCount}>{commentsCount || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => shareRef.current?.open?.()}>
              <Feather name="share" size={22} color="#374151" />
              <Text style={styles.actionCount}>{item.sharesCount || 0}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.followButton,
              item.follow && styles.followingButton
            ]}
            disabled={followingBusy}
            onPress={() => {
              if (!isBusinessProfile && item.UserId !== userId) {
                if (item.profile === 'company') {
                  executeFollowAction(item.UserId, !item.follow);
                } else {
                  onToggleFollow?.(item.UserId, !item.follow, item.userTokenAddress);
                }
              }
            }}
          >
            {followingBusy ? (
              <ActivityIndicator size="small" color={item.follow ? '#5a2d82' : '#fff'} />
            ) : (
              <Text style={[
                styles.followButtonText,
                item.follow && styles.followingButtonText
              ]}>
                {
                  isBusinessProfile ? "Support" :
                    item.UserId == userId ? 'Support' : item.follow ? 'Vallowing' : 'Vallow'
                }
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.buyersSection}>
          {
            item.UserId != userId &&
            <>
              <View style={styles.avatarsContainer}>
                {buyerList.slice(0, 3).map((buyer, idx) => (
                  <View
                    key={buyer.id ?? `buyer-${idx}`}
                    style={[styles.buyerAvatarWrapper, { marginLeft: idx === 0 ? 0 : -8, zIndex: 100 + idx }]}
                  >
                    <Image
                      source={{ uri: buyer.avatar }}
                      style={styles.buyerAvatar}
                      resizeMode="cover"
                    />
                  </View>
                ))}
              </View>

              {buyerList.length > 0 &&
                <Text style={styles.buyersText} numberOfLines={1} ellipsizeMode="tail">
                  Vallowed by <Text style={styles.buyerName}>{buyerList[0]?.username || '—'}</Text>
                  {buyerList.length > 1 && (
                    <Text> and <Text style={styles.buyerName}>{formatNumber(buyerList.length - 1)} others</Text></Text>
                  )}
                </Text>
              }
            </>
          }
        </View>

        <View style={styles.captionSection}>
          <View style={styles.userRow}>
            <Text style={styles.captionUsername}>{item.username} </Text>
            <DragonflyIcon width={22} height={22} style={styles.dragonflyIcon} />
          </View>
          <Text style={styles.captionText}>{item.caption}</Text>
          {item.link ? (
            <Text
              style={styles.linkText}
              onPress={() => Linking.openURL(item.link)}
            >
              Link -  {item.link}
            </Text>
          ) : null}

         {postData.raisedAmount !== undefined && postData.raisedAmount > 0 &&
            <>
              <View style={styles.progressSection}>
                <View style={styles.progressBarWrapper}>
                  <View style={styles.progressBarBackground}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(progressPercent, 100)}%`,
                          backgroundColor: getProgressBarColor()
                        }
                      ]}
                    />
                  </View>

                  <View style={styles.progressStatsContainer}>
                    <View style={styles.statAtStart}>
                      <Text style={styles.statValueSmall}>
                        {Math.min(progressPercent, 100).toFixed(1)}%
                      </Text>
                      <Text style={styles.statLabelSmall}>FUNDED</Text>
                    </View>

                    {/* Amount at CENTER */}
                    <View style={styles.statAtCenter}>
                      <Text style={styles.statValueSmall}>
                        ${(postData.raisedAmount / 1000).toFixed(0)}K
                      </Text>
                      <Text style={styles.statLabelSmall}>RAISED</Text>
                    </View>

                    {/* Days Left at END (right) */}
                    <View style={styles.statAtEnd}>
                      <Text style={styles.statValueSmall}>
                        {postData.daysLeft || 0}
                      </Text>
                      <Text style={styles.statLabelSmall}>DAYS LEFT</Text>
                    </View>
                  </View>
                </View>
              </View>
            </>}
        </View>
      </View>

      <ShareModal ref={shareRef} post={item} />

      {viewerOpen && (
        <View
          pointerEvents="none"
          style={styles.zoomBackdrop}
        />
      )}

      <InlineFullscreenViewer
        uri={viewerUri}
        visible={viewerOpen}
        onRequestClose={() => {
          setViewerOpen(false);
          setScrollEnabled(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#f8f2fd',
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
    color: '#5a2d82',
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
    backgroundColor: '#5a2d82',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#5a2d82',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
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
  followingButtonText: {
    color: '#5a2d82',
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
    color: '#5a2d82',
  },
  captionSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  captionUsername: {
    fontWeight: '700',
    color: '#5a2d82',
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
    color: '#5A2D82',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});