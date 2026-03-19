import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
  Dimensions,
  Modal,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import RBSheet from 'react-native-raw-bottom-sheet';
import PostItem from '../../components/home/posts/PostItem';
import CommentSheet from '../../components/home/posts/CommentSheet';
import OptionsModal from '../../components/home/posts/OptionsModal';
import Clipboard from '@react-native-clipboard/clipboard';

import { getAllSavedPosts } from '../../services/settings';
import { likePost, savePost, unSavePost, follow, unfollow } from '../../services/post';
import { buildPostMaps } from '../../utils/postMaps';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import { useAppTheme } from '../../theme/useApptheme';
import Video from 'react-native-video';

const { width } = Dimensions.get('window');
const GRID_ITEM_SIZE = (width - 6) / 3;
const SavedPostsScreen = ({ navigation }) => {
  // Data
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Per-post UI state
  const [liked, setLiked] = useState({});
  const [saved, setSaved] = useState({});
  const [postLikesCount, setPostLikesCount] = useState({});
  const [postCommentsCount, setPostCommentsCount] = useState({});

  // Follow state
  const [followingByUserId, setFollowingByUserId] = useState({});
  const [followingBusy, setFollowingBusy] = useState(new Set());

  // In-flight guards
  const [likingIds, setLikingIds] = useState(new Set());
  const [savingIds, setSavingIds] = useState(new Set());

  // Options modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalPostId, setModalPostId] = useState(null);

  // Comments
  const [commentPostId, setCommentPostId] = useState(null);
  const commentSheetRef = useRef(null);
  const [commentPostOwnerId, setCommentPostOwnerId] = useState(null);

  // Full-screen post viewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [initialPostIndex, setInitialPostIndex] = useState(0);
  const flatListRef = useRef(null);

  // Grid video controls (Saved posts grid)
  const [gridPlayingPostId, setGridPlayingPostId] = useState(null);
  const [gridMutedByPostId, setGridMutedByPostId] = useState({});

  // Viewer (modal) video autoplay coordination (like main feed)
  const [viewerPlayingPostId, setViewerPlayingPostId] = useState(null);
  const [viewerVisiblePostId, setViewerVisiblePostId] = useState(null);

  const toast = useToast();
  const { bgStyle, textStyle, cardStyle, text: themeText } = useAppTheme();
  const insets = useSafeAreaInsets();
  const viewerHeaderPaddingTop = Math.max(insets.top, 12);

  const formatUrl = useCallback((url) => {
    if (!url || typeof url !== 'string') return '';
    if (url.startsWith('http')) return url;
    return `https://${url}`;
  }, []);

  const getMediaType = useCallback((url) => {
    if (!url || typeof url !== 'string') return 'image';
    const lowerUrl = url.toLowerCase();
    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp', 'm4v'];
    const ext = lowerUrl.split('.').pop() || '';
    const isVideo =
      videoExtensions.includes(ext) ||
      lowerUrl.includes('.mp4') ||
      lowerUrl.includes('video') ||
      lowerUrl.includes('/mp4/');
    return isVideo ? 'video' : 'image';
  }, []);

  const mapPostForPostItem = useCallback(({
    item,
    followingByUserId: followingMapByUserId = {},
    route,
  }) => {
    return {
      id: item.id,

      username: item.userName ?? 'Unknown',

      avatar: item.userImage
        ? formatUrl(item.userImage)
        : 'https://cdn-icons-png.flaticon.com/512/149/149071.png',

      media: (item.images || item.media || []).map(m =>
        typeof m === 'string'
          ? { type: getMediaType(m), url: formatUrl(m) }
          : { type: m.type, url: formatUrl(m.url) }
      ),

      caption: item.caption ?? '',

      PostsProfile: item.PostsProfile ?? 'Support',

      link: item.link,
      raiseAmount: item.raiseAmount ?? 0,
      goalAmount: item.goalAmount ?? 100000,
      daysLeft: item.daysLeft ?? 0,
      profile: item.profile,
      createdAt: item.createdAt,
      UserId: item.userId,
      userId: item.userId,
      boughtBy: item.boughtBy || [],
      returnTo: route?.params?.returnTo,
      tokenBalance: item.tokenBalance || 0,

      follow:
        typeof followingMapByUserId[String(item.userId)] === 'boolean'
          ? followingMapByUserId[String(item.userId)]
          : !!item.isFollow,
      shareCount: item.shareCount ?? 0,
    };
  }, [formatUrl, getMediaType]);

  const seedMapsFromPosts = useCallback((list) => {
    const maps = buildPostMaps(list, { includeSaved: true, includeHidden: false });
    setLiked(maps.nextLiked);
    setSaved(maps.nextSaved);
    setPostLikesCount(maps.nextLikeCounts);
    setPostCommentsCount(maps.nextCommentCounts);
    if (Object.keys(maps.nextFollowing).length) {
      setFollowingByUserId((prev) => ({ ...prev, ...maps.nextFollowing }));
    }
  }, []);

  const fetchSavedPosts = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      const response = await getAllSavedPosts();

      if (response?.success && response?.statusCode === 200) {
        const raw = Array.isArray(response.data) ? response.data : [];
        setPosts(raw);
        seedMapsFromPosts(raw);
      } else {
        Alert.alert('Error', response?.message || 'Failed to fetch saved posts');
      }
    } catch (err) {
      console.error('Error fetching saved posts:', err);
      Alert.alert('Error', 'Network error occurred while fetching posts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing, seedMapsFromPosts]);

  useEffect(() => {
    fetchSavedPosts();
  }, [fetchSavedPosts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSavedPosts();
  }, [fetchSavedPosts]);

  const handleToggleFollow = useCallback(
    async (targetUserId, shouldFollow) => {
      if (!targetUserId) return;
      const key = String(targetUserId);
      if (followingBusy.has(key)) return;

      setFollowingByUserId((prev) => ({ ...prev, [key]: shouldFollow }));
      setFollowingBusy((prev) => new Set(prev).add(key));

      try {
        const res = shouldFollow ? await follow(targetUserId) : await unfollow(targetUserId);
        const ok = res?.statusCode === 200 && (res?.success ?? true);

        if (!ok) {
          setFollowingByUserId((prev) => ({ ...prev, [key]: !shouldFollow }));
          showToastMessage(
            toast,
            'danger',
            res?.data?.message || res?.message || 'Unable to update follow'
          );
        } else {
          const serverVal = res?.data?.following;
          if (typeof serverVal === 'boolean') {
            setFollowingByUserId((prev) => ({ ...prev, [key]: serverVal }));
          }
        }
      } catch (e) {
        setFollowingByUserId((prev) => ({ ...prev, [key]: !shouldFollow }));
        showToastMessage(
          toast,
          'danger',
          e?.response?.data?.message || 'Something went wrong'
        );
      } finally {
        setFollowingBusy((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [toast, followingBusy]
  );

  const toggleLike = useCallback(
    async (postId) => {
      if (!postId || likingIds.has(postId)) return;

      const wasLiked = !!liked[postId];
      const prevCount = postLikesCount[postId] ?? 0;

      setLiked((prev) => ({ ...prev, [postId]: !wasLiked }));
      setPostLikesCount((prev) => ({
        ...prev,
        [postId]: wasLiked ? Math.max(0, prevCount - 1) : prevCount + 1,
      }));
      setLikingIds((prev) => new Set(prev).add(postId));

      try {
        const res = await likePost(postId);
        const ok = res?.statusCode === 200 && res?.success;

        if (ok) {
          const serverLiked = !!res?.data?.liked;
          const serverCount = res?.data?.likesCount ?? res?.data?.totalLikes;

          setLiked((prev) => ({ ...prev, [postId]: serverLiked }));
          if (serverCount !== undefined) {
            setPostLikesCount((prev) => ({ ...prev, [postId]: serverCount }));
          }
          showToastMessage(
            toast,
            'success',
            res?.data?.message || (serverLiked ? 'Post liked' : 'Post unliked')
          );
        } else {
          setLiked((prev) => ({ ...prev, [postId]: wasLiked }));
          setPostLikesCount((prev) => ({ ...prev, [postId]: prevCount }));
          showToastMessage(toast, 'danger', res?.data?.message || 'Failed to toggle like');
        }
      } catch (e) {
        setLiked((prev) => ({ ...prev, [postId]: wasLiked }));
        setPostLikesCount((prev) => ({ ...prev, [postId]: prevCount }));
        showToastMessage(toast, 'danger', e?.response?.data?.message || 'Something went wrong');
      } finally {
        setLikingIds((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      }
    },
    [liked, postLikesCount, likingIds, toast]
  );

  const handleToggleSave = useCallback(
    async (id) => {
      if (!id || savingIds.has(id)) return;

      const resolvedId = String(id);
      const matchesId = (post) =>
        String(post?.id ?? post?._id ?? '') === resolvedId;

      setSavingIds((prev) => new Set(prev).add(resolvedId));
      const isCurrentlySaved = !!saved[resolvedId];

      try {
        const resp = isCurrentlySaved ? await unSavePost(resolvedId) : await savePost(resolvedId);
        const ok = resp && resp.statusCode === 200 && (resp.success ?? true);
        if (ok) {
          showToastMessage(toast, 'success', resp?.data?.message || 'Updated');
          setSaved((prev) => ({ ...prev, [resolvedId]: !isCurrentlySaved }));

          if (isCurrentlySaved) {
            const nextPosts = posts.filter((p) => !matchesId(p));
            setPosts(nextPosts);

            if (viewerVisible) {
              if (!nextPosts.length) {
                closePostViewer();
              } else {
                const removedIndex = posts.findIndex(matchesId);
                const nextIndex = Math.max(0, Math.min(removedIndex, nextPosts.length - 1));
                setInitialPostIndex(nextIndex);

                const nextId = nextPosts[nextIndex]?.id ?? nextPosts[nextIndex]?._id;
                if (nextId != null) {
                  setViewerVisiblePostId(nextId);
                  setViewerPlayingPostId(nextId);
                }
              }
            }
          }
        } else {
          showToastMessage(toast, 'danger', resp?.data?.message || 'Failed');
        }
      } catch (err) {
        showToastMessage(toast, 'danger', err?.response?.message ?? 'Something went wrong');
      } finally {
        setSavingIds((prev) => {
          const next = new Set(prev);
          next.delete(resolvedId);
          return next;
        });
      }
    },
    [
      saved,
      savingIds,
      toast,
      viewerVisible,
      posts,
      closePostViewer,
    ]
  );

  const openOptions = useCallback((id) => {
    setModalPostId(id);
    setModalVisible(true);
  }, []);

  const closeOptions = useCallback(() => {
    setModalVisible(false);
    setModalPostId(null);
  }, []);

  const onOptionsSelect = useCallback(
    async (action) => {
      if (!modalPostId) return;
      if (action === 'toggleSave') {
        closeOptions();
        await handleToggleSave(modalPostId);
        return;
      }

      if (action === 'copyAddress') {
        const deepLink = `com.valens://?af=dd&postId=${encodeURIComponent(String(modalPostId))}`;
        Clipboard.setString(deepLink);
        showToastMessage(toast, 'success', 'Post copied');
        closeOptions();
        return;
      }

      // Other actions (report/hide) are handled inside OptionsModal.
      closeOptions();
    },
    [closeOptions, handleToggleSave, modalPostId, toast]
  );

  const handleComment = useCallback((postId, ownerId) => {
    setCommentPostId(postId);
    setCommentPostOwnerId(ownerId);
    commentSheetRef.current?.open();
  }, []);

  const handleCommentClose = useCallback(() => {
    commentSheetRef.current?.close();
    setCommentPostId(null);
    setCommentPostOwnerId(null);
  }, []);

  const handleCommentCountUpdate = useCallback((postId, newCount) => {
    setPostCommentsCount((prev) => ({
      ...prev,
      [postId]: Math.max(0, newCount),
    }));
  }, []);

  // Open full-screen viewer
  const openPostViewer = useCallback((index) => {
    setInitialPostIndex(index);
    setViewerVisible(true);
  }, []);

  // Close viewer
  const closePostViewer = useCallback(() => {
    handleCommentClose();
    closeOptions();
    setViewerVisible(false);
  }, [closeOptions, handleCommentClose]);

  // Stop any grid video when opening the full viewer
  useEffect(() => {
    if (viewerVisible) setGridPlayingPostId(null);
  }, [viewerVisible]);

  // Seed which post should autoplay when the viewer opens
  useEffect(() => {
    if (!viewerVisible) {
      setViewerPlayingPostId(null);
      setViewerVisiblePostId(null);
      return;
    }

    const seeded = posts?.[initialPostIndex];
    const seededId = seeded?.id ?? seeded?._id ?? null;
    if (seededId != null) {
      setViewerPlayingPostId(seededId);
      setViewerVisiblePostId(seededId);
    }
  }, [viewerVisible, initialPostIndex, posts]);

  useEffect(() => {
    if (!viewerVisible) return;
    if (!posts?.length) return;

    const index = Math.max(0, Math.min(initialPostIndex, posts.length - 1));
    let cancelled = false;

    const doScroll = (attempt = 0) => {
      if (cancelled) return;
      try {
        flatListRef.current?.scrollToIndex?.({ index, animated: false, viewPosition: 0 });
      } catch (e) {
        if (attempt >= 3) return;
        setTimeout(() => doScroll(attempt + 1), 120);
      }
    };

    const timeout = setTimeout(() => doScroll(0), 80);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [initialPostIndex, posts?.length, viewerVisible]);

  // Grid item renderer
  const renderGridItem = useCallback(
    ({ item, index }) => {
      const images = item.images || [];
      const firstMedia = images[0];
      const hasMultiple = images.length > 1;
      const isVideo = firstMedia ? getMediaType(firstMedia) === 'video' : false;
      const isGridVideoPlaying = String(gridPlayingPostId) === String(item?.id);
      const isGridMuted =
        typeof gridMutedByPostId[String(item?.id)] === 'boolean'
          ? gridMutedByPostId[String(item?.id)]
          : true;
      const formattedFirstMedia = firstMedia ? formatUrl(firstMedia) : '';

      // Fallback if no media
      if (!firstMedia) {
        return (
          <TouchableOpacity style={styles.gridItem} activeOpacity={0.7} onPress={() => openPostViewer(index)}>
            <View style={[styles.gridImage, { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }]}>
              <Icon name="image-outline" size={40} color="#555" />
            </View>
            {hasMultiple && <Icon name="copy-outline" size={20} color="#fff" style={styles.multiOverlay} />}
          </TouchableOpacity>
        );
      }

      return (
        <TouchableOpacity
          style={[styles.gridItem,{marginBottom:2}]}
          activeOpacity={0.7}
          onPress={() => openPostViewer(index)}
        >
          {/* Video: Show first frame as static thumbnail */}
          {isVideo ? (
            <Video
              source={{ uri: formattedFirstMedia }}
              style={styles.gridImage}
              resizeMode="cover"
              paused={!isGridVideoPlaying}
              muted={isGridMuted}
              repeat={true}
              controls={false}
              playInBackground={false}
              playWhenInactive={false}
              ignoreSilentSwitch="ignore"
              poster="https://via.placeholder.com/300/1a1a1a/666666?text=Video"
              onError={(e) => console.log('Video thumbnail error:', e)}
            />
          ) : (
            /* Image: Normal fast loading */
            <Image
              source={{ uri: formattedFirstMedia }}
              style={styles.gridImage}
              resizeMode="cover"
              defaultSource={{ uri: 'https://via.placeholder.com/300/1a1a1a/666666?text=Loading...' }}
            />
          )}

          {/* Play Button for Videos */}
          {isVideo && !isGridVideoPlaying && (
            <TouchableOpacity
              style={styles.videoOverlay}
              activeOpacity={0.85}
              onPress={() => setGridPlayingPostId(item?.id)}
            >
              <Icon name="play-circle" size={36} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Mute/Unmute for Videos */}
          {isVideo && (
            <TouchableOpacity
              style={styles.gridMuteButton}
              activeOpacity={0.85}
              onPress={() => {
                const key = String(item?.id);
                setGridMutedByPostId((prev) => ({ ...prev, [key]: !isGridMuted }));
                if (!isGridVideoPlaying) setGridPlayingPostId(item?.id);
              }}
            >
              <Icon name={isGridMuted ? 'volume-mute' : 'volume-high'} size={18} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Multiple Media Indicator */}
          {hasMultiple && (
            <View style={styles.multiOverlay}>
              <Icon name="copy-outline" size={20} color="#fff" />
            </View>
          )}

          {/* Token Price Overlay */}
        </TouchableOpacity>
      );
    },
    [formatUrl, getMediaType, gridMutedByPostId, gridPlayingPostId, openPostViewer]
  );


  // Full-screen post renderer
  const renderFullPost = useCallback(
    ({ item }) => {
      const mapped = mapPostForPostItem({
        item,
        followingByUserId,
      });
      const isThisPostVisible =
        viewerVisiblePostId != null && String(viewerVisiblePostId) === String(item?.id);

      return (
        <View style={styles.postContainer}>
          <PostItem
            item={mapped}
            liked={!!liked[item.id]}
            likesCount={postLikesCount[item.id] || 0}
            commentsCount={postCommentsCount[item.id] || 0}
            saved={!!saved[item.id]}
            onToggleLike={toggleLike}
            onToggleSave={handleToggleSave}
            onToggleFollow={handleToggleFollow}
            followingBusy={followingBusy.has(String(mapped.UserId))}
            onComment={handleComment}
            onOptions={openOptions}
            onSuggest={[]}
            shareCount={mapped.shareCount}
            hideDonationButton={true}
            // Autoplay only the visible post, start muted, user can unmute in PostItem
            isVisible={isThisPostVisible}
            screenFocused={viewerVisible}
            playingPostId={viewerPlayingPostId}
            currentlyVisiblePostId={viewerVisiblePostId}
          />
        </View>
      );
    },
    [
      viewerVisible,
      viewerPlayingPostId,
      viewerVisiblePostId,
      followingBusy,
      handleComment,
      handleToggleFollow,
      handleToggleSave,
      liked,
      mapPostForPostItem,
      openOptions,
      toggleLike,
      saved,
      postLikesCount,
      postCommentsCount,
      followingByUserId,
    ]
  );


  const keyExtractor = useCallback((item, index) => {
    return item.id?.toString() || item._id?.toString() || `post-${index}`;
  }, []);

  const EmptyState = useCallback(
    () => (
      <View style={styles.emptyState}>
        <Icon
          name="bookmark-outline"
          size={80}
          color={
            typeof themeText === 'string' && themeText.startsWith('#') && themeText.length === 7
              ? `${themeText}55`
              : '#C7C7CC'
          }
        />
        <Text style={[styles.emptyTitle, textStyle]}>No Saved Posts</Text>
        <Text style={[styles.emptySubtitle, textStyle, { opacity: 0.7 }]}>
          When you save posts, you'll see them here{'\n'}Start exploring and save posts you love!
        </Text>
      </View>
    ),
    [textStyle, themeText]
  );

  // Viewer viewability (pick the most visible post id to autoplay)
  const viewerViewabilityConfigRef = useRef({
    viewAreaCoveragePercentThreshold: 50,
    minimumViewTime: 50,
    waitForInteraction: false,
  });

  const handleViewerViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (!viewerVisible) return;
    if (!viewableItems || viewableItems.length === 0) return;

    let mostVisiblePost = null;
    let highestPercentage = -1;

    for (const v of viewableItems) {
      const postId = v?.item?.id ?? v?.item?._id;
      if (!v?.isViewable || postId == null) continue;

      const percentage =
        typeof v.percentVisible === 'number'
          ? v.percentVisible
          : typeof v.viewablePercent === 'number'
            ? v.viewablePercent
            : 100;

      if (percentage > highestPercentage) {
        highestPercentage = percentage;
        mostVisiblePost = postId;
      }
    }

    if (mostVisiblePost == null) return;
    setViewerVisiblePostId((prev) => (String(prev) === String(mostVisiblePost) ? prev : mostVisiblePost));
    setViewerPlayingPostId((prev) => (String(prev) === String(mostVisiblePost) ? prev : mostVisiblePost));
  }, [viewerVisible]);

  const viewerHandleViewableItemsChangedRef = useRef(handleViewerViewableItemsChanged);
  useEffect(() => {
    viewerHandleViewableItemsChangedRef.current = handleViewerViewableItemsChanged;
  }, [handleViewerViewableItemsChanged]);

  const viewerViewabilityConfigCallbackPairs = useRef([
    {
      viewabilityConfig: viewerViewabilityConfigRef.current,
      onViewableItemsChanged: (info) => viewerHandleViewableItemsChangedRef.current(info),
    },
  ]);

  return (
    <SafeAreaView style={[styles.container, bgStyle]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={cardStyle?.backgroundColor || '#fff'} />

      {/* Header */}
      <View style={[styles.header, cardStyle]}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={themeText || '#262626'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]}>Saved Posts</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Grid View */}
      {loading && posts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeText || '#4d2a88'} />
          <Text style={[styles.loadingText, textStyle, { opacity: 0.7 }]}>
            Loading saved posts...
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={renderGridItem}
          keyExtractor={keyExtractor}
          numColumns={3}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={themeText || '#4d2a88'}
            />
          }
          ListEmptyComponent={!loading ? <EmptyState /> : null}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={posts.length === 0 ? styles.emptyContainer : styles.gridContainer}
          columnWrapperStyle={posts.length > 0 ? styles.gridRow : null}
          removeClippedSubviews={true}
          maxToRenderPerBatch={12}
          windowSize={10}
          initialNumToRender={9}
        />
      )}

      {/* Full-screen Post Viewer Modal */}
      <Modal
        visible={viewerVisible}
        animationType="slide"
        onRequestClose={closePostViewer}
        statusBarTranslucent
      >
        <SafeAreaView style={[styles.modalContainer, bgStyle]} edges={['left', 'right', 'bottom']}>
          <StatusBar barStyle="dark-content" backgroundColor={cardStyle?.backgroundColor || '#fff'} />

          {/* Viewer Header */}
          <View
            style={[
              styles.viewerHeader,
              cardStyle,
              { paddingTop: viewerHeaderPaddingTop, paddingBottom: 12 },
            ]}
          >
            <TouchableOpacity onPress={closePostViewer} style={styles.closeButton}>
              <Icon name="arrow-back" size={24} color={themeText || '#262626'} />
            </TouchableOpacity>
            <Text style={[styles.viewerHeaderTitle, textStyle]}>All Posts</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Vertical Scrollable Posts */}
          <FlatList
            ref={flatListRef}
            data={posts}
            renderItem={renderFullPost}
            keyExtractor={keyExtractor}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: Math.max(12, insets.bottom) }}
            viewabilityConfigCallbackPairs={viewerViewabilityConfigCallbackPairs.current}
            onScrollToIndexFailed={(info) => {
              setTimeout(() => {
                flatListRef.current?.scrollToIndex({
                  index: info.index,
                  animated: false,
                });
              }, 100);
            }}
            removeClippedSubviews={true}
            maxToRenderPerBatch={3}
            windowSize={5}
            initialNumToRender={2}
          />

          {/* Options Modal (render inside modal for iOS) */}
          <OptionsModal
            visible={modalVisible}
            onClose={closeOptions}
            fromHome={true}
            onSelect={onOptionsSelect}
            postId={modalPostId ?? ''}
            canHide={false}
            isSaved={
              modalPostId != null && (saved[modalPostId] ?? saved[String(modalPostId)])
                ? true
                : false
            }
          />

          {/* Comment Sheet (render inside modal for iOS) */}
          <RBSheet
            ref={commentSheetRef}
            height={500}
            openDuration={250}
            draggable={true}
            closeOnPressMask={true}
            customModalProps={{ statusBarTranslucent: true, presentationStyle: 'overFullScreen' }}
            onClose={() => {
              setCommentPostId(null);
              setCommentPostOwnerId(null);
            }}
            customStyles={{
              container: {
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
                ...bgStyle,
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
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#262626',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
  },
  emptyContainer: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  // Grid styles
  gridContainer: {
    paddingVertical: 2,
    paddingBottom: 24,
  },
  gridRow: {
    gap: 2,
  },
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    position: 'relative',
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  multiOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
    padding: 4,
  },
  gridMuteButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    padding: 6,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    padding: 4,
    // marginLeft:4
  },
  viewerHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  postContainer: {
    paddingBottom: 16,
  },
});

export default SavedPostsScreen;
