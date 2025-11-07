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
} from 'react-native';
import {
  PanGestureHandler,
  PinchGestureHandler,
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
 * ZoomableImage: pinch to zoom + pan when zoomed
 * ---------------------------------------- */
function ZoomableImage({ uri, onZoomChange }) {
  const scale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const lastPanX = useRef(0);
  const lastPanY = useRef(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const pinchRef = useRef();
  const panRef = useRef();

  const onPinchEvent = Animated.event([{ nativeEvent: { scale: scale } }], { useNativeDriver: true });

  const onPinchStateChange = ({ nativeEvent }) => {
    if (nativeEvent.state === State.END || nativeEvent.state === State.CANCELLED) {
      let newScale = lastScale.current * nativeEvent.scale;
      newScale = Math.max(1, Math.min(3, newScale));
      lastScale.current = newScale;

      Animated.spring(scale, { toValue: newScale, useNativeDriver: true, friction: 5 }).start();

      if (newScale === 1) {
        Animated.spring(panX, { toValue: 0, useNativeDriver: true }).start();
        Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
        lastPanX.current = 0;
        lastPanY.current = 0;
        setIsZoomed(false);
        onZoomChange?.(false);
      } else {
        setIsZoomed(true);
        onZoomChange?.(true);
      }
    }
  };

  const onPanEvent = Animated.event(
    [{ nativeEvent: { translationX: panX, translationY: panY } }],
    { useNativeDriver: true }
  );

  const onPanStateChange = ({ nativeEvent }) => {
    if (nativeEvent.state === State.END) {
      const currentScale = lastScale.current;
      const boundX = ((width * currentScale) - width) / 2;
      const boundY = ((340 * currentScale) - 340) / 2;

      let finalX = lastPanX.current + nativeEvent.translationX;
      let finalY = lastPanY.current + nativeEvent.translationY;

      finalX = Math.max(-boundX, Math.min(boundX, finalX));
      finalY = Math.max(-boundY, Math.min(boundY, finalY));

      lastPanX.current = finalX;
      lastPanY.current = finalY;

      Animated.spring(panX, { toValue: finalX, useNativeDriver: true }).start();
      Animated.spring(panY, { toValue: finalY, useNativeDriver: true }).start();
    }
  };

  return (
    <PinchGestureHandler
      ref={pinchRef}
      simultaneousHandlers={panRef}
      onGestureEvent={onPinchEvent}
      onHandlerStateChange={onPinchStateChange}
    >
      <Animated.View style={{ flex: 1 }}>
        <PanGestureHandler
          ref={panRef}
          enabled={isZoomed}
          simultaneousHandlers={pinchRef}
          onGestureEvent={onPanEvent}
          onHandlerStateChange={onPanStateChange}
        >
          <Animated.View style={{ flex: 1 }}>
            <Animated.Image
              source={{ uri }}
              resizeMode="cover"
              style={{
                width: width,
                height: 340,
                transform: [
                  { translateX: Animated.add(panX, new Animated.Value(0)) },
                  { translateY: Animated.add(panY, new Animated.Value(0)) },
                  { scale: scale },
                ],
              }}
            />
          </Animated.View>
        </PanGestureHandler>
      </Animated.View>
    </PinchGestureHandler>
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
  executeFollowAction
}) {
  const heartScale = useRef(new Animated.Value(1)).current;
  const listRef = useRef(null);
  const [totalFollowers, setTotalFollowers] = useState(0);
  const [userProfile, setUserProfile] = useState('');
  // console.log('item----------------followers------------', item);
  const isCompanyProfile = userProfile === 'company';
  const DragonflyIcon = getDragonflyIcon(totalFollowers, isCompanyProfile);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [videoStates, setVideoStates] = useState({});
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const navigation = useNavigation();
  const [userId, setUserId] = useState(null);
  const shareRef = useRef(null);
  const dispatch = useDispatch();
  const toast = useToast();

  useEffect(() => {
    const fetchUserId = async () => {
      const id = await AsyncStorage.getItem('userId');
      setUserId(id);
    };
    fetchUserId();
    fetchAllData(); // Call a combined function
  }, []);

  // Combine both API calls to manage loader properly
  const fetchAllData = async () => {
    try {
      dispatch(showLoader());

      // Run both API calls in parallel
      const [dashboardResponse, profileResponse] = await Promise.all([
        getUserDashboard(item.UserId),
        getUserCredentials(item.UserId)
      ]);

      // Handle dashboard response
      if (dashboardResponse?.statusCode === 200) {
        setTotalFollowers(dashboardResponse.data.dashboardData.totalFollowers);
      } else {
        showToastMessage(toast, 'danger', dashboardResponse.data.message);
      }

      // Handle profile response
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

  const buyerList = (item.boughtBy || item.buyers) || [
    // { id: '1', username: 'Alice', avatar: 'https://placekitten.com/40/40' },
    // { id: '2', username: 'Bob', avatar: 'https://placekitten.com/41/41' },
    // { id: '3', username: 'Charlie', avatar: 'https://placekitten.com/42/42' },
  ];

  // Add this debug log
  // console.log(`PostItem ${item.id} buyerList:`, {
  //   count: buyerList.length,
  //   firstBuyer: buyerList[0]?.username,
  //   allBuyers: buyerList.map(b => b.username)
  // });

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

  // video pause/play based on index
  useEffect(() => {
    if (!item.media || item.media.length <= 0) return;
    setVideoStates(() => {
      const next = {};
      item.media.forEach((_, idx) => { next[idx] = idx !== currentIndex; });
      return next;
    });
  }, [currentIndex, item.media]);

  const onMomentumEnd = (e) => {
    const x = e?.nativeEvent?.contentOffset?.x ?? 0;
    const index = Math.round(x / width);
    if (index !== currentIndex) setCurrentIndex(index);
  };

  const renderMedia = ({ item: mediaItem, index }) => {
    const isVideo = mediaItem.type === 'video' || isVideoUrl(mediaItem.url);
    const isPaused = videoStates[index] ?? (index !== currentIndex);

    return (
      <View style={styles.mediaContainer}>
        {isVideo ? (
          <>
            <Video
              source={{ uri: mediaItem.url }}
              style={styles.postMedia}
              resizeMode="cover"
              repeat
              paused={isPaused}
              muted={false}
              controls={false}
              onError={() => { }}
            />
            <TouchableOpacity
              style={[styles.videoOverlay, !isPaused && styles.videoOverlayTransparent]}
              activeOpacity={0.7}
              onPress={() => setVideoStates((prev) => ({ ...prev, [index]: !prev[index] }))}
            >
              {isPaused && (
                <View style={styles.playButtonContainer}>
                  <Icon name="play" size={34} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.videoIndicator}>
              <Icon name="videocam" size={14} color="#fff" />
            </View>
          </>
        ) : (
          <ZoomableImage
            uri={mediaItem.url}
            onZoomChange={(zoomed) => setScrollEnabled(!zoomed)}
          />
        )}
      </View>
    );
  };

  return (
    <View style={styles.wrapper}>
      {/* Enhanced Post Card */}
      <View style={styles.postCard}>
        {/* Enhanced Header */}
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

        {/* Enhanced Media Wrapper */}
        <View style={styles.mediaWrapper}>
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

        {/* Enhanced Actions Row */}
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

        {/* Enhanced Buyers Section */}
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

        {/* Enhanced Caption Section */}
        <View style={styles.captionSection}>
          <View style={styles.userRow}>
            <Text style={styles.captionUsername}>{item.username} </Text>
            <DragonflyIcon width={22} height={22} style={styles.dragonflyIcon} />
          </View>
          <Text style={styles.captionText}>{item.caption}</Text>
        </View>
      </View>

      {/* Share Modal */}
      <ShareModal ref={shareRef} post={item} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#f8f2fd',
    paddingBottom: 8,
  },

  // Enhanced Post Card
  postCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },

  // Enhanced Header
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

  // Enhanced Media
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

  // Enhanced Actions
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

  // Enhanced Buyers Section
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

  // Enhanced Caption
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
});
