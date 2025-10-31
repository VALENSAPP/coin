import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import RBSheet from 'react-native-raw-bottom-sheet';

import PostItem from '../../components/home/posts/PostItem';
import CommentSheet from '../../components/home/posts/CommentSheet';
import OptionsModal from '../../components/home/posts/OptionsModal';

import { getHidePost, unHidePost, likePost, follow, unfollow } from '../../services/post';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import { useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HidePosts = ({ navigation }) => {
  // Data
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Per-post UI state
  const [liked, setLiked] = useState({});
  const [postLikesCount, setPostLikesCount] = useState({});
  const [postCommentsCount, setPostCommentsCount] = useState({});

  // Hidden map (we’ll use the same `saved` prop in PostItem, but it means “isHidden” here)
  const [hidden, setHidden] = useState({});
  const [unhidingIds, setUnhidingIds] = useState(new Set());

  // Follow state
  const [followingByUserId, setFollowingByUserId] = useState({});
  const [followingBusy, setFollowingBusy] = useState(new Set());

  // In-flight like guards
  const [likingIds, setLikingIds] = useState(new Set());

  // Options modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalPostId, setModalPostId] = useState(null);

  // Comments
  const [commentText, setCommentText] = useState('');
  const [commentPostId, setCommentPostId] = useState(null);
  const [commentPostOwnerId, setCommentPostOwnerId] = useState(null);
  const commentSheetRef = useRef(null);

  const [currentUsername, setCurrentUsername] = useState('user');

  const profileImage = useSelector(state => state.profileImage?.profileImg);

  const toast = useToast();

  // --- helpers ---
  const getMediaType = (url) => {
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
  };

  const getCurrentUsername = async () => {
    console.log('Fetching currentUsername from AsyncStorage');
    const username = await AsyncStorage.getItem('currentUsername');
    console.log('Fetched currentUsername from AsyncStorage:', username);
    if (username) setCurrentUsername(username);
  };

  const mapApiPostToPostItem = useCallback(
    (p) => {
      const userKey = String(p.userId ?? '');
      return {
        id: p.id,
        username: currentUsername,
        avatar: profileImage,
        media: (p.images || []).map((url) => ({ type: getMediaType(url), url })),
        caption: p.caption || p.text || '',
        PostsProfile: 'Vallow',
        createdAt: p.createdAt,
        UserId: p.userId,
        userId: p.userId,
        boughtBy: p.boughtBy || [],
        follow:
          typeof followingByUserId[userKey] === 'boolean'
            ? followingByUserId[userKey]
            : !!p.isFollow,
      };
    },
    [followingByUserId, currentUsername]
  );

  const seedMapsFromPosts = useCallback((list) => {
    const nextLiked = {};
    const nextLikeCounts = {};
    const nextCommentCounts = {};
    const nextFollowing = {};
    const nextHidden = {};

    for (const p of list) {
      if (!p?.id) continue;
      nextLiked[p.id] = !!(p.isLike ?? p.liked);
      nextLikeCounts[p.id] = p.likesCount ?? p.likeCount ?? 0;
      nextCommentCounts[p.id] = p.commentCount ?? 0;
      nextHidden[p.id] = true; // this list is ONLY hidden posts
      if (p?.userId != null && typeof p.isFollow === 'boolean') {
        nextFollowing[String(p.userId)] = p.isFollow;
      }
    }

    setLiked(nextLiked);
    setPostLikesCount(nextLikeCounts);
    setPostCommentsCount(nextCommentCounts);
    setHidden(nextHidden);
    if (Object.keys(nextFollowing).length) {
      setFollowingByUserId((prev) => ({ ...prev, ...nextFollowing }));
    }
  }, []);

  // --- fetch ---
  const fetchHiddenPosts = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      const response = await getHidePost();
      console.log(posts, 'chceckposts')

      if (response?.success && response?.statusCode === 200) {
        const raw = Array.isArray(response.data) ? response.data : [];
        setPosts(raw);
        seedMapsFromPosts(raw);
      } else {
        Alert.alert('Error', response?.message || 'Failed to fetch hidden posts');
      }
    } catch (err) {
      console.error('Error fetching hidden posts:', err);
      Alert.alert('Error', 'Network error occurred while fetching posts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing, seedMapsFromPosts]);

  useFocusEffect(
    useCallback(() => {
      getCurrentUsername();
      fetchHiddenPosts();
      return () => {
      };
    }, [fetchHiddenPosts])
  );
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHiddenPosts();
  }, [fetchHiddenPosts]);

  // --- follow/unfollow ---
  const handleToggleFollow = useCallback(
    async (targetUserId, shouldFollow) => {
      if (!targetUserId) return;
      const key = String(targetUserId);
      if (followingBusy.has(key)) return;

      // optimistic
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
        } else if (typeof res?.data?.following === 'boolean') {
          setFollowingByUserId((prev) => ({ ...prev, [key]: res.data.following }));
        }
      } catch (e) {
        setFollowingByUserId((prev) => ({ ...prev, [key]: !shouldFollow }));
        showToastMessage(toast, 'danger', e?.response?.data?.message || 'Something went wrong');
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

  // --- like ---
  const toggleLike = useCallback(
    async (postId) => {
      if (!postId || likingIds.has(postId)) return;

      const wasLiked = !!liked[postId];
      const prevCount = postLikesCount[postId] ?? 0;

      // optimistic
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

  // --- UNHIDE (replaces save/unsave) ---
  const handleToggleHide = useCallback(
    async (id) => {
      if (!id || unhidingIds.has(id)) return;

      setUnhidingIds((prev) => new Set(prev).add(id));
      try {
        const resp = await unHidePost(id);
        if (resp && resp.statusCode === 200 && resp.success) {
          showToastMessage(toast, 'success', resp?.data?.message || 'Post unhidden');
          setHidden((prev) => ({ ...prev, [id]: false }));
          setPosts((prev) => prev.filter((p) => p.id !== id)); // remove from list
        } else {
          showToastMessage(toast, 'danger', resp?.data?.message || 'Failed to unhide');
        }
      } catch (err) {
        showToastMessage(toast, 'danger', err?.response?.message ?? 'Something went wrong');
      } finally {
        setUnhidingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [unhidingIds, toast]
  );

  // --- options modal ---
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
      // Reuse Saved’s action key; treat toggleSave/toggleHide as “unhide”
      if (action === 'toggleSave' || action === 'toggleHide' || action === 'hidePost') {
        await handleToggleHide(modalPostId);
        closeOptions();
        return;
      }
      Alert.alert('Action', String(action));
      closeOptions();
    },
    [modalPostId, handleToggleHide, closeOptions]
  );

  // --- comments ---
  const handleComment = useCallback((postId, ownerId) => {
    setCommentPostId(postId);
    setCommentPostOwnerId(ownerId);
    commentSheetRef.current?.open();
  }, []);
  const handleCommentClose = useCallback(() => {
    commentSheetRef.current?.close();
    setCommentPostId(null);
  }, []);
  const handleCommentCountUpdate = useCallback((postId, newCount) => {
    setPostCommentsCount((prev) => ({ ...prev, [postId]: Math.max(0, newCount) }));
  }, []);
  const submitComment = useCallback(() => {
    if (!commentText.trim()) return;
    Alert.alert('Commented:', commentText.trim());
    setCommentText('');
    commentSheetRef.current?.close();
  }, [commentText]);

  // --- render ---
  const renderPostItem = useCallback(
    ({ item }) => {
      const mapped = mapApiPostToPostItem(item);
      // Pass "saved" to keep PostItem UI identical; here it means "isHidden"
      return (
        <PostItem
          item={mapped}
          liked={!!liked[item.id]}
          likesCount={postLikesCount[item.id] || 0}
          commentsCount={postCommentsCount[item.id] || 0}
          saved={!!hidden[item.id]}
          onToggleSave={() => handleToggleHide(item.id)} // UNHIDE
          onToggleLike={() => toggleLike(item.id)}
          onToggleFollow={handleToggleFollow}
          followingBusy={followingBusy.has(String(mapped.UserId))}
          onComment={() => handleComment(item.id, mapped.UserId)}
          onOptions={() => openOptions(item.id)}
          onSuggest={[]}
        />
      );
    },
    [
      mapApiPostToPostItem,
      liked,
      hidden,
      postLikesCount,
      postCommentsCount,
      handleToggleHide,
      toggleLike,
      handleToggleFollow,
      followingBusy,
      handleComment,
      openOptions,
    ]
  );

  const keyExtractor = useCallback((item) => item.id?.toString() || item._id?.toString(), []);

  const EmptyState = useCallback(
    () => (
      <View style={styles.emptyState}>
        <Icon name="eye-off-outline" size={80} color="#C7C7CC" />
        <Text style={styles.emptyTitle}>No Hidden Posts</Text>
        <Text style={styles.emptySubtitle}>
          You haven't hidden any posts yet.{'\n'}Hide a post to see it here.
        </Text>
      </View>
    ),
    []
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()}>
          <Icon name="arrow-back" size={24} color="#262626" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hidden Posts</Text>
      </View>

      {loading && posts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4d2a88" />
          <Text style={styles.loadingText}>Loading hidden posts...</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPostItem}
          keyExtractor={keyExtractor}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={!loading ? <EmptyState /> : null}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={5}
          windowSize={10}
          initialNumToRender={3}
        />
      )}

      <OptionsModal
        visible={modalVisible}
        onClose={closeOptions}
        fromHome={true}
        onSelect={onOptionsSelect}
        postId={modalPostId ?? ''}
        isSaved={!!(modalPostId && hidden[String(modalPostId)])}
        isHidden={!!(modalPostId && hidden[String(modalPostId)])}
        hideBusy={modalPostId ? unhidingIds.has(modalPostId) : false}
        canDelete={true}
      />

      <RBSheet
        ref={commentSheetRef}
        height={500}
        openDuration={250}
        draggable
        closeOnPressMask
        customModalProps={{ statusBarTranslucent: true }}
        customStyles={{
          container: {
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            backgroundColor: '#f8f2fd',
          },
          draggableIcon: { backgroundColor: '#ccc', width: 60 },
        }}
      >
        <CommentSheet
          commentText={commentText}
          onChangeText={setCommentText}
          onSubmit={submitComment}
          onClose={handleCommentClose}
          onCommentCountUpdate={handleCommentCountUpdate}
          postId={commentPostId}
          postOwnerId={commentPostOwnerId}
        />
      </RBSheet>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f2fd' },
  header: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginTop: 20,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: 'black',
    marginLeft: 15,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    marginTop: 300,
  },
  loadingText: { color: '#9a8fb6', fontSize: 16, marginTop: 10 },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 24, fontWeight: '600', color: '#222', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 16, color: '#6b7280', textAlign: 'center', lineHeight: 24 },
});

export default HidePosts;
