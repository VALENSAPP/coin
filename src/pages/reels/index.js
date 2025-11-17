import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Image,
  StatusBar,
  Share,
  Animated,
  TouchableWithoutFeedback,
  Alert,
  ScrollView,
} from 'react-native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Ionicons';
import { useIsFocused, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import CommentSection from '../../components/comments/CommentSection';
import RBSheet from 'react-native-raw-bottom-sheet';
import CustomMarquee from '../../components/customMarquee/CustomMarquee';
import { getAllReels } from '../../services/reels';
import { likePost } from '../../services/post';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import { useDispatch } from 'react-redux';
import CommentSheet from '../../components/home/posts/CommentSheet';


const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Music Templates Data
const musicTemplates = [
  {
    id: 't1',
    name: 'Trending Dance Challenge',
    music: 'Viral Dance Mix 2025',
    uses: '2.3M',
    thumbnail: 'https://randomuser.me/api/portraits/women/10.jpg',
    category: 'Dance',
  },
  {
    id: 't2',
    name: 'Before & After Glow Up',
    music: 'Transformation Beat',
    uses: '1.8M',
    thumbnail: 'https://randomuser.me/api/portraits/men/15.jpg',
    category: 'Lifestyle',
  },
  {
    id: 't3',
    name: 'Recipe Quick Tips',
    music: 'Cooking Rhythm',
    uses: '956K',
    thumbnail: 'https://randomuser.me/api/portraits/women/20.jpg',
    category: 'Food',
  },
  {
    id: 't4',
    name: 'Workout Motivation',
    music: 'Beast Mode Activated',
    uses: '1.2M',
    thumbnail: 'https://randomuser.me/api/portraits/men/25.jpg',
    category: 'Fitness',
  },
];

const mockComments = {
  '1': [
    {
      id: 'c1',
      user: 'alex_explorer',
      avatar: 'https://randomuser.me/api/portraits/men/4.jpg',
      text: 'This place looks incredible! Where is this? 😍',
      likes: 124,
      timestamp: '2h',
      isLiked: false,
      replies: [
        {
          id: 'c1r1',
          user: 'ted_graham321',
          avatar: 'https://randomuser.me/api/portraits/men/99.jpg',
          text: 'Thanks! It\'s in the Swiss Alps! 🏔️',
          likes: 45,
          timestamp: '1h',
          isLiked: false,
        },
      ],
    },
  ],
};

export default function FlipsScreen() {
  const isFocused = useIsFocused();
  const route = useRoute();
  const toast = useToast();
  const dispatch = useDispatch();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reels, setReels] = useState([]);
  const [muted, setMuted] = useState({});
  const [paused, setPaused] = useState({});

  // Dynamic interaction states - similar to Posts screen
  const [liked, setLiked] = useState({});
  const [likesCount, setLikesCount] = useState({});
  const [commentsCount, setCommentsCount] = useState({});
  const [likingIds, setLikingIds] = useState(new Set());

  // Animation states
  const [heartAnimatingId, setHeartAnimatingId] = useState(null);
  const [lastTap, setLastTap] = useState(0);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // UI states
  const flatListRef = useRef();
  const videoRefs = useRef({});
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [moreOptionsVisible, setMoreOptionsVisible] = useState(false);
  const [musicTemplatesVisible, setMusicTemplatesVisible] = useState(false);
  const [commentsData, setCommentsData] = useState(mockComments);
  const [selectedReelId, setSelectedReelId] = useState(null);
  const commentSheetRef = useRef();
  const moreOptionsSheetRef = useRef();
  const musicTemplatesSheetRef = useRef();
  const [videoProgress, setVideoProgress] = useState({});
  const [isBuffering, setIsBuffering] = useState({});

  const [commentPostId, setCommentPostId] = useState(null);
  const [commentPostOwnerId, setCommentPostOwnerId] = useState(null);

  // Progress bar animation
  useEffect(() => {
    const currentReel = reels[currentIndex];
    if (currentReel && !paused[currentReel.id] && isFocused) {
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: currentReel.duration,
        useNativeDriver: false,
      }).start();
    }
  }, [currentIndex, paused, isFocused]);

  useEffect(() => {
    if (!isFocused) {
      Object.values(videoRefs.current).forEach(ref => {
        if (ref && ref.seek) ref.seek(0);
      });
      progressAnim.stopAnimation();
    }
  }, [isFocused]);

  useEffect(() => {
    // Get reel from params if exists
    const paramReel = route.params?.item;
    
    if (paramReel) {
      // Transform param reel to match app structure
      const transformedParamReel = {
        id: paramReel.id || `param_${Date.now()}`,
        video: paramReel.images?.[0] || paramReel.video || '',
        user: paramReel.userName || 'Unknown User',
        avatar: paramReel.userImage || 'https://randomuser.me/api/portraits/men/1.jpg',
        caption: paramReel.caption || paramReel.text || 'No caption',
        music: paramReel.music || 'Original Audio',
        likes: paramReel.likeCount || 0,
        comments: paramReel.commentCount || 0,
        shares: paramReel.shareCount || 0,
        isLiked: paramReel.isLike || false,
        isFollowing: paramReel.isFollow || false,
        views: formatCount(Math.floor(Math.random() * 1000000) + 100000),
        duration: 30000,
        verified: false,
        likedBy: [`${paramReel.likeCount || 0} others`],
        isRemixable: true,
        isSaved: paramReel.isSaved || false,
        isHide: paramReel.isHide || false,
        userId: paramReel.userId,
        hashtag: paramReel.hashtag || [],
        location: paramReel.location || null,
        taggedPeople: paramReel.taggedPeople || [],
      };
      
      // Set param reel as first item
      setReels([transformedParamReel]);
    }
    
    // Fetch all reels (will be appended after param reel)
    fetchAllReels(paramReel);
  }, []);

  const fetchAllReels = async (paramReel) => {
    try {
      dispatch(showLoader());
      const response = await getAllReels();
      if (response?.statusCode === 200) {
        console.log('response in get reels--------', response);
        // Transform API response to match app structure
        const transformedReels = response.data.map((item, index) => ({
          id: item.id,
          video: item.images?.[0] || '',
          user: item.userName || 'Unknown User',
          avatar: item.userImage || 'https://randomuser.me/api/portraits/men/1.jpg',
          caption: item.caption || item.text || 'No caption',
          music: item.music || 'Original Audio',
          likes: item.likeCount || 0,
          comments: item.commentCount || 0,
          shares: item.shareCount || 0,
          isLiked: item.isLike || false,
          isFollowing: item.isFollow || false,
          views: formatCount(Math.floor(Math.random() * 1000000) + 100000),
          duration: 30000,
          verified: false,
          likedBy: [`${item.likeCount || 0} others`],
          isRemixable: true,
          isSaved: item.isSaved || false,
          isHide: item.isHide || false,
          userId: item.userId,
          hashtag: item.hashtag || [],
          location: item.location || null,
          taggedPeople: item.taggedPeople || [],
        }));

        // If param reel exists, append API reels after it
        if (paramReel) {
          setReels(prevReels => {
            // Filter out the param reel from API data if it exists (to avoid duplicates)
            const filteredApiReels = transformedReels.filter(
              apiReel => apiReel.id !== prevReels[0]?.id
            );
            return [...prevReels, ...filteredApiReels];
          });
        } else {
          // No param reel, just set API data
          if (transformedReels.length > 0) {
            setReels(transformedReels);
          }
        }
      } else {
        showToastMessage(toast, 'danger', response?.data?.message || 'Failed to fetch reels');
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

  // Initialize likes and comments count from reels data
  useEffect(() => {
    if (Array.isArray(reels) && reels.length) {
      const seededLiked = {};
      const seededLikesCount = {};
      const seededCommentsCount = {};

      for (const reel of reels) {
        if (reel?.id) {
          seededLiked[reel.id] = !!reel.isLiked;
          seededLikesCount[reel.id] = reel.likes || 0;
          seededCommentsCount[reel.id] = reel.comments || 0;
        }
      }

      setLiked(seededLiked);
      setLikesCount(seededLikesCount);
      setCommentsCount(seededCommentsCount);
    }
  }, [reels]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 80 });

  // Handlers
  const handleLike = useCallback(
    async (id) => {
      if (!id) return;
      if (likingIds.has(id)) return;

      const wasLiked = !!liked[id];
      const prevCount = likesCount[id] ?? 0;

      // Optimistic update
      setLiked(prev => ({ ...prev, [id]: !wasLiked }));
      setLikesCount(prev => ({
        ...prev,
        [id]: wasLiked ? Math.max(0, prevCount - 1) : prevCount + 1,
      }));

      setLikingIds(prev => new Set(prev).add(id));

      try {
        const res = await likePost(id);
        const ok = res?.statusCode === 200 && res?.success;

        if (ok) {
          const serverLiked = !!res?.data?.liked;
          const serverCount = res?.data?.likesCount ?? res?.data?.totalLikes;

          setLiked(prev => ({ ...prev, [id]: serverLiked }));
          if (serverCount !== undefined) {
            setLikesCount(prev => ({ ...prev, [id]: serverCount }));
          }
        } else {
          // Revert on failure
          setLiked(prev => ({ ...prev, [id]: wasLiked }));
          setLikesCount(prev => ({ ...prev, [id]: prevCount }));
          showToastMessage(
            toast,
            'danger',
            res?.data?.message || 'Failed to toggle like',
          );
        }
      } catch (e) {
        // Revert on error
        setLiked(prev => ({ ...prev, [id]: wasLiked }));
        setLikesCount(prev => ({ ...prev, [id]: prevCount }));
        showToastMessage(
          toast,
          'danger',
          e?.response?.data?.message || 'Something went wrong',
        );
      } finally {
        setLikingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [liked, likesCount, likingIds, toast],
  );

  const switchFollowing = (id) => {
    const updated = reels.map(item =>
      item.id === id ? { ...item, isFollowing: !item.isFollowing } : item
    );
    setReels(updated);
  };

  const animateHeart = (id) => {
    setHeartAnimatingId(id);
    scaleAnim.setValue(0);
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.2,
        useNativeDriver: true,
        tension: 100,
        friction: 3,
      }),
      Animated.delay(400),
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setHeartAnimatingId(null));
  };

  const handleDoubleTap = (id) => {
    const now = Date.now();
    if (lastTap && now - lastTap < 300) {
      // Only like if not already liked
      if (!liked[id]) {
        handleLike(id);
      }
      animateHeart(id);
    } else {
      handlePause(id);
    }
    setLastTap(now);
  };

  const handleComment = (postId) => {
    setCommentPostId(postId);
    setSelectedReelId(postId);
    commentSheetRef.current?.open();
  };

  const handleCommentClose = useCallback(() => {
    commentSheetRef.current?.close();
    setCommentPostId(null);
  }, []);

  const handleCommentCountUpdate = useCallback((postId, newCount) => {
    setCommentsCount(prev => ({
      ...prev,
      [postId]: Math.max(0, newCount),
    }));
  }, []);

  const handlePause = (id) => {
    setPaused(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleShare = async (item) => {
    try {
      const result = await Share.share({
        message: `Check out this amazing reel by @${item.user}!\n\n"${item.caption}"\n\nShared via Instagram Reels`,
        title: `Reel by @${item.user}`,
      });

      if (result.action === Share.sharedAction) {
        setReels(prev =>
          prev.map(reel =>
            reel.id === item.id
              ? { ...reel, shares: reel.shares + 1 }
              : reel,
          ),
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to share reel');
    }
  };

  const handleMoreOptions = (item) => {
    setSelectedReelId(item.id);
    moreOptionsSheetRef.current?.open();
  };

  const handleRemix = (item) => {
    Alert.alert('Try Remix', `Creating remix with "${item.music}"`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Use Template', onPress: () => setMusicTemplatesVisible(true) },
    ]);
  };

  const formatCount = (count) => {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    } else if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  };

  const renderMusicTemplate = ({ item }) => (
    <TouchableOpacity style={styles.templateItem}>
      <View style={styles.templateThumbnail}>
        <Image source={{ uri: item.thumbnail }} style={styles.templateImage} />
        <View style={styles.templatePlay}>
          <Icon name="play" size={20} color="#fff" />
        </View>
      </View>
      <View style={styles.templateInfo}>
        <Text style={styles.templateName}>{item.name}</Text>
        <Text style={styles.templateMusic}>♪ {item.music}</Text>
        <Text style={styles.templateUses}>{item.uses} uses</Text>
      </View>
      <TouchableOpacity style={styles.useTemplateBtn}>
        <Text style={styles.useTemplateBtnText}>Use</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderItem = ({ item, index }) => (
    <View style={styles.reelContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Progress bar */}
      <View style={styles.progressContainer}>
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

      <TouchableOpacity
        activeOpacity={1}
        onPress={() => handleDoubleTap(item.id)}
        style={styles.videoContainer}
      >
        <Video
          ref={ref => {
            videoRefs.current[item.id] = ref;
          }}
          source={{ uri: item.video }}
          style={styles.video}
          resizeMode="cover"
          repeat
          paused={!isFocused || currentIndex !== index || paused[item.id] === true}
          muted={muted[item.id] === true}
        />

        {/* Loading indicator */}
        {isBuffering[item.id] && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}

        {/* Play/Pause overlay */}
        {paused[item.id] === true && (
          <View style={styles.playPauseOverlay}>
            <Icon name="play" size={80} color="rgba(255,255,255,0.8)" />
          </View>
        )}

        {/* Double tap heart animation */}
        {heartAnimatingId === item.id && (
          <Animated.View
            style={[
              styles.heartAnimation,
              {
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Icon name="heart" size={100} color="#ff3040" />
          </Animated.View>
        )}
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerLeft}
          onPress={() => setDropdownVisible(v => !v)}
        >
          <Text style={styles.logo}>Reels</Text>
          <Icon name="chevron-down" size={18} color="#fff" style={styles.chevronIcon} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerIconButton}>
          <Feather name="camera" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Side actions */}
      <View style={styles.sideActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleLike(item.id)}
        >
          <Icon
            name={liked[item.id] ? 'heart' : 'heart-outline'}
            size={32}
            color={liked[item.id] ? '#ff3040' : '#fff'}
          />
          <Text style={styles.actionLabel}>{formatCount(likesCount[item.id] || 0)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleComment(item.id)}
        >
          <Icon name="chatbubble-outline" size={30} color="#fff" />
          <Text style={styles.actionLabel}>{formatCount(commentsCount[item.id] || 0)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleShare(item)}
        >
          <Icon name="paper-plane-outline" size={30} color="#fff" />
          <Text style={styles.actionLabel}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleMoreOptions(item)}
        >
          <Icon name="ellipsis-vertical" size={30} color="#fff" />
        </TouchableOpacity>

        {/* Music disc */}
        <TouchableOpacity style={styles.musicDisc}>
          <View style={styles.discContainer}>
            <Image source={{ uri: item.avatar }} style={styles.discImage} />
          </View>
          <View style={styles.musicIconWrapper}>
            <Feather name="music" size={15} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Bottom content */}
      <View style={styles.bottomContent}>
        {/* Try Remix button */}
        {item.isRemixable && (
          <TouchableOpacity
            style={styles.remixButton}
            onPress={() => handleRemix(item)}
          >
            <MaterialIcons name="auto-awesome" size={16} color="#fff" />
            <Text style={styles.remixText}>Try Remix</Text>
          </TouchableOpacity>
        )}

        {/* User info */}
        <View style={styles.userInfo}>
          <TouchableOpacity style={styles.userRow}>
            <Image source={{ uri: item.avatar }} style={styles.userAvatar} />
            <Text style={styles.username}>
              {item.user}
              {item.verified && (
                <Icon name="checkmark-circle" size={15} color="#1DA1F2" style={styles.verifiedIcon} />
              )}
              <View style={{ flexDirection: 'row', gap: 3 }}>
                <Feather name="music" size={12} color="#fff" style={styles.musicIcon} />
                <CustomMarquee
                  speed={3}
                  loop={true}
                  delay={1000}
                  style={{ width: 100, maxWidth: 300 }}
                  textStyle={{ fontSize: 13, color: 'white' }}
                >
                  {item.music}
                </CustomMarquee>

              </View>
            </Text>
            <TouchableOpacity style={styles.followButton} onPress={() => switchFollowing(item.id)}
            >
              <Text style={styles.followButtonText}>{!item.isFollowing ? 'Vallow' : 'Vallowing'}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        <Text style={styles.caption} numberOfLines={2}>
          {item.caption}
        </Text>

        {/* Liked by section */}
        <TouchableOpacity style={styles.likedBySection}>
          <Text style={styles.likedByText}>
            ❤️ Liked by{' '}
            <Text style={styles.likedByBold}>
              {item.likes === 0
                ? 'no one yet'
                : item.likes === 1
                  ? '1 person'
                  : `${item.likes} others`}
            </Text>
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bottom navigation placeholder */}
      <View style={styles.bottomNavPlaceholder}>
        <View style={styles.navIcon}>
          <Icon name="home" size={24} color="#fff" />
        </View>
        <View style={styles.navIcon}>
          <Icon name="search" size={24} color="#fff" />
        </View>
        <View style={styles.navIcon}>
          <Icon name="add-circle-outline" size={24} color="#fff" />
        </View>
        <View style={styles.navIcon}>
          <MaterialIcons name="movie" size={24} color="#fff" />
        </View>
        <View style={styles.navIcon}>
          <Icon name="person-circle-outline" size={24} color="#fff" />
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={reels}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate={0.98}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewConfigRef.current}
        snapToAlignment="start"
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
      />

      {/* Dropdown Menu */}
      {dropdownVisible && (
        <View style={styles.dropdownOverlay}>
          <TouchableWithoutFeedback onPress={() => setDropdownVisible(false)}>
            <View style={styles.dropdownBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.dropdown}>
            <View style={styles.arrowUp} />
            <TouchableOpacity style={styles.dropdownOption}>
              <Icon name="people-outline" size={22} color="#000" />
              <Text style={styles.dropdownText}>Vallowing</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownOption}>
              <Icon name="location-outline" size={22} color="#000" />
              <Text style={styles.dropdownText}>Nearby</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Comments Bottom Sheet */}
      <RBSheet
        ref={commentSheetRef}
        height={500}
        openDuration={250}
        draggable={true}
        closeOnPressMask={true}
        customModalProps={{ statusBarTranslucent: true }}
        onClose={() => { Keyboard.dismiss(); setCommentPostId(null); }}
        customStyles={{
          container: {
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            backgroundColor: '#f8f2fd',
            bottom: -20,
          },
          draggableIcon: {
            backgroundColor: '#ccc',
            width: 60,
          },
        }}
      >
        <CommentSheet
          postId={commentPostId}
          onClose={handleCommentClose}
          onCommentCountUpdate={handleCommentCountUpdate}
          postOwnerId={commentPostOwnerId}
        />
      </RBSheet>

      {/* More Options Bottom Sheet */}
      <RBSheet
        ref={moreOptionsSheetRef}
        height={400}
        openDuration={250}
        customStyles={{
          container: {
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            backgroundColor: '#fff',
          },
        }}
        closeOnDragDown={true}
        closeOnPressMask={true}
      >
        <View style={styles.moreOptionsContainer}>
          <View style={styles.moreOptionsHeader}>
            <Text style={styles.moreOptionsTitle}>More Options</Text>
          </View>
          <ScrollView style={styles.moreOptionsList}>
            <TouchableOpacity
              style={styles.moreOption}
              onPress={() => {
                moreOptionsSheetRef.current?.close();
                musicTemplatesSheetRef.current?.open();
              }}
            >
              <MaterialIcons name="library-music" size={24} color="#000" />
              <Text style={styles.moreOptionText}>Music Templates</Text>
              <Icon name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.moreOption}>
              <Icon name="bookmark-outline" size={24} color="#000" />
              <Text style={styles.moreOptionText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.moreOption}>
              <Icon name="flag-outline" size={24} color="#000" />
              <Text style={styles.moreOptionText}>Report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.moreOption}>
              <Icon name="eye-off-outline" size={24} color="#000" />
              <Text style={styles.moreOptionText}>Not Interested</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.moreOption}>
              <Icon name="copy-outline" size={24} color="#000" />
              <Text style={styles.moreOptionText}>Copy Link</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </RBSheet>

      {/* Music Templates Bottom Sheet */}
      <RBSheet
        ref={musicTemplatesSheetRef}
        height={SCREEN_HEIGHT * 0.8}
        openDuration={250}
        customStyles={{
          container: {
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            backgroundColor: '#fff',
          },
        }}
        closeOnDragDown={true}
        closeOnPressMask={true}
      >
        <View style={styles.templatesContainer}>
          <View style={styles.templatesHeader}>
            <TouchableOpacity onPress={() => musicTemplatesSheetRef.current?.close()}>
              <Icon name="close" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.templatesTitle}>Music Templates</Text>
            <View style={{ width: 24 }} />
          </View>
          <FlatList
            data={musicTemplates}
            keyExtractor={item => item.id}
            renderItem={renderMusicTemplate}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.templatesList}
          />
        </View>
      </RBSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  reelContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
    position: 'relative',
  },
  progressContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    zIndex: 10,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
  },
  videoContainer: {
    flex: 1,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -30 }, { translateY: -10 }],
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
  playPauseOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -40 }, { translateY: -40 }],
  },
  heartAnimation: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  chevronIcon: {
    marginLeft: 8,
  },
  headerIconButton: {
    padding: 8,
  },
  sideActions: {
    position: 'absolute',
    right: 12,
    bottom: 100,
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  musicDisc: {
    marginTop: 10,
  },
  discContainer: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  discImage: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  bottomContent: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 80,
    padding: 16,
  },
  remixButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  remixText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  userInfo: {
    marginBottom: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  username: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    flex: 1,
  },
  verifiedIcon: {
    marginLeft: 6,
  },
  followButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  followButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  caption: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 8,
  },
  likedBySection: {
    marginBottom: 4,
  },
  likedByText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  likedByBold: {
    fontWeight: 'bold',
    color: '#fff',
  },
  bottomNavPlaceholder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(0,0,0,0.8)',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 10,
  },
  navIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },

  // Dropdown Menu Styles
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dropdown: {
    position: 'absolute',
    top: 80,
    left: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 160,
    maxWidth: 200,
  },
  arrowUp: {
    position: 'absolute',
    top: -8,
    left: 30,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#fff',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
  },
  dropdownText: {
    fontSize: 16,
    color: '#000',
    marginLeft: 12,
    fontWeight: '500',
    fontFamily: 'System',
  },

  // More Options Bottom Sheet Styles
  moreOptionsContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  moreOptionsHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 16,
    alignItems: 'center',
    position: 'relative',
  },
  moreOptionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: 'System',
  },
  moreOptionsList: {
    flex: 1,
    paddingTop: 8,
  },
  moreOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
    minHeight: 60,
  },
  moreOptionText: {
    fontSize: 16,
    color: '#000',
    marginLeft: 16,
    flex: 1,
    fontFamily: 'System',
    fontWeight: '400',
  },

  // Music Templates Bottom Sheet Styles
  templatesContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  templatesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    height: 60,
  },
  templatesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: 'System',
  },
  templatesList: {
    paddingVertical: 10,
    paddingBottom: 30,
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
    minHeight: 80,
  },
  templateThumbnail: {
    position: 'relative',
    marginRight: 16,
  },
  templateImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  templatePlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -15 }, { translateY: -15 }],
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateInfo: {
    flex: 1,
    marginRight: 16,
    justifyContent: 'center',
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
    fontFamily: 'System',
  },
  templateMusic: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
    fontFamily: 'System',
  },
  templateUses: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'System',
  },
  useTemplateBtn: {
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  useTemplateBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'System',
  },

  // Additional Animation Styles
  slideUpAnimation: {
    transform: [{ translateY: 0 }],
  },
  slideDownAnimation: {
    transform: [{ translateY: 100 }],
  },

  // Loading States
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingSpinner: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },

  // Enhanced Interactive Elements
  touchableHighlight: {
    borderRadius: 8,
  },
  pressedState: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },

  // Accessibility Improvements
  accessibilityButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Responsive Design Adjustments
  smallScreen: {
    fontSize: 14,
    padding: 8,
  },
  largeScreen: {
    fontSize: 18,
    padding: 16,
  },

  // Shadow and Elevation Effects
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  lightShadow: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },

  // Gradient Effects (if using LinearGradient)
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },

  // Status Bar Styles
  statusBarSafe: {
    backgroundColor: '#000',
    paddingTop: StatusBar.currentHeight || 0,
  },

  // Error States
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  retryButton: {
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  musicIconWrapper: {
    position: 'absolute',
    top: 7,
    left: 5,
  },
  marqueeText: {
    fontSize: 12,
    color: '#fff',
    width: 100,
  },
  musicIcon: {
    marginTop: 4
  }
});