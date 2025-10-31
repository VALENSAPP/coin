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
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import RBSheet from 'react-native-raw-bottom-sheet';
import PostItem from '../../components/home/posts/PostItem';
import CommentSheet from '../../components/home/posts/CommentSheet';
import OptionsModal from '../../components/home/posts/OptionsModal';

import { getAllSavedPosts } from '../../services/settings';
import { likePost, savePost, unSavePost, follow, unfollow } from '../../services/post';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';

const SavedPostsScreen = ({ navigation }) => {
  // Data
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Per-post UI state (keep same shapes)
  const [liked, setLiked] = useState({});
  const [saved, setSaved] = useState({});
  const [postLikesCount, setPostLikesCount] = useState({});
  const [postCommentsCount, setPostCommentsCount] = useState({});

  // Follow state (same as Posts)
  const [followingByUserId, setFollowingByUserId] = useState({});
  const [followingBusy, setFollowingBusy] = useState(new Set());

  // In-flight guards
  const [likingIds, setLikingIds] = useState(new Set());
  const [savingIds, setSavingIds] = useState(new Set());

  // Options modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalPostId, setModalPostId] = useState(null);

  // Comments
  const [commentText, setCommentText] = useState('');
  const [commentPostId, setCommentPostId] = useState(null);
  const commentSheetRef = useRef(null);
  const [commentPostOwnerId, setCommentPostOwnerId] = useState(null);

  const toast = useToast();

  // Helpers (unchanged UI)
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

  // Normalize each API record to PostItem props (keep UI intact)
  const mapApiPostToPostItem = useCallback(
    (p) => {
      const userKey = String(p.userId ?? '');
      return {
        id: p.id,
        username: p.userName ?? 'Unknown',
        avatar: p.userImage ?? 'https://randomuser.me/api/portraits/men/4.jpg',
        media: (p.images || []).map((url) => ({
          type: getMediaType(url),
          url,
        })),
        caption: p.caption || p.text || '',
        PostsProfile: 'Vallow',
        createdAt: p.createdAt,
        // keep both keys; PostItem uses `UserId`
        UserId: p.userId,
        userId: p.userId,
        boughtBy: p.boughtBy || [],
        follow:
          typeof followingByUserId[userKey] === 'boolean'
            ? followingByUserId[userKey]
            : !!p.isFollow,
      };
    },
    [followingByUserId]
  );

  // Seed maps from API
  const seedMapsFromPosts = useCallback((list) => {
    const nextLiked = {};
    const nextSaved = {};
    const nextLikeCounts = {};
    const nextCommentCounts = {};
    const nextFollowing = {};

    for (const p of list) {
      if (!p?.id) continue;
      nextLiked[p.id] = !!(p.isLike ?? p.liked);
      nextSaved[p.id] = !!(p.isSaved ?? true);
      nextLikeCounts[p.id] = p.likesCount ?? p.likeCount ?? 0;
      nextCommentCounts[p.id] = p.commentCount ?? 0;

      if (p?.userId != null && typeof p.isFollow === 'boolean') {
        nextFollowing[String(p.userId)] = p.isFollow;
      }
    }

    setLiked(nextLiked);
    setSaved(nextSaved);
    setPostLikesCount(nextLikeCounts);
    setPostCommentsCount(nextCommentCounts);
    if (Object.keys(nextFollowing).length) {
      setFollowingByUserId((prev) => ({ ...prev, ...nextFollowing }));
    }
  }, []);

  // Fetch saved posts
  const fetchSavedPosts = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      const response = await getAllSavedPosts();

      if (response?.success && response?.statusCode === 200) {
        const raw = Array.isArray(response.data) ? response.data : [];
        setPosts(raw);            // keep raw to avoid UI changes
        seedMapsFromPosts(raw);   // seed auxiliary maps
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

  // Follow / Unfollow (same functionality as Posts)
  const handleToggleFollow = useCallback(
    async (targetUserId, shouldFollow) => {
      if (!targetUserId) return;
      const key = String(targetUserId);
      if (followingBusy.has(key)) return;

      // optimistic update
      setFollowingByUserId((prev) => ({ ...prev, [key]: shouldFollow }));
      setFollowingBusy((prev) => new Set(prev).add(key));

      try {
        const res = shouldFollow ? await follow(targetUserId) : await unfollow(targetUserId);
        const ok = res?.statusCode === 200 && (res?.success ?? true);

        if (!ok) {
          // revert on failure
          setFollowingByUserId((prev) => ({ ...prev, [key]: !shouldFollow }));
          showToastMessage(
            toast,
            'danger',
            res?.data?.message || res?.message || 'Unable to update follow'
          );
        } else {
          // trust server boolean if present
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

  // Like (unchanged functionality)
  const toggleLike = useCallback(
    async (postId) => {
      if (!postId) return;
      if (likingIds.has(postId)) return;

      const wasLiked = !!liked[postId];
      const prevCount = postLikesCount[postId] ?? 0;

      // Optimistic
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
          // revert
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

  // Save / Unsave (unchanged functionality)
  const handleToggleSave = useCallback(
    async (id) => {
      if (!id) return;
      if (savingIds.has(id)) return;

      setSavingIds((prev) => new Set(prev).add(id));
      const isCurrentlySaved = !!saved[id];

      try {
        const resp = isCurrentlySaved ? await unSavePost(id) : await savePost(id);
        if (resp && resp.statusCode === 200 && resp.success) {
          showToastMessage(toast, 'success', resp?.data?.message || 'Updated');
          setSaved((prev) => ({ ...prev, [id]: !isCurrentlySaved }));

          // If user unsaves from Saved screen, remove it from the list
          if (isCurrentlySaved) {
            setPosts((prev) => prev.filter((p) => p.id !== id));
          }
        } else {
          showToastMessage(toast, 'danger', resp?.data?.message || 'Failed');
        }
      } catch (err) {
        showToastMessage(toast, 'danger', err?.response?.message ?? 'Something went wrong');
      } finally {
        setSavingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [saved, savingIds, toast]
  );

  // Options modal
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
        await handleToggleSave(modalPostId);
        closeOptions();
        return;
      }

      Alert.alert('Action', String(action));
      closeOptions();
    },
    [closeOptions, handleToggleSave, modalPostId]
  );

  // Comments
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
    setPostCommentsCount((prev) => ({
      ...prev,
      [postId]: Math.max(0, newCount),
    }));
  }, []);

  const submitComment = useCallback(() => {
    if (!commentText.trim()) return;
    Alert.alert('Commented:', commentText.trim());
    setCommentText('');
    commentSheetRef.current?.close();
  }, [commentText]);

  // Render
  const renderPostItem = useCallback(
    ({ item }) => {
      // map here so follow flag reflects any latest local follow changes
      const mapped = mapApiPostToPostItem(item);
      return (
        <PostItem
          item={mapped}
          liked={!!liked[item.id]}
          likesCount={postLikesCount[item.id] || 0}
          commentsCount={postCommentsCount[item.id] || 0}
          saved={!!saved[item.id]}
          onToggleLike={() => toggleLike(item.id)}
          onToggleSave={() => handleToggleSave(item.id)}
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
      saved,
      postLikesCount,
      postCommentsCount,
      toggleLike,
      handleToggleSave,
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
        <Icon name="bookmark-outline" size={80} color="#C7C7CC" />
        <Text style={styles.emptyTitle}>No Saved Posts</Text>
        <Text style={styles.emptySubtitle}>
          When you save posts, you'll see them here{'\n'}Start exploring and save posts you love!
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
        <Text style={styles.headerTitle}>Saved Posts</Text>
      </View>

      {loading && posts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4d2a88" />
          <Text style={styles.loadingText}>Loading saved posts...</Text>
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
        isSaved={!!(modalPostId && saved[String(modalPostId)])}
      />

      <RBSheet
        ref={commentSheetRef}
        height={500}
        openDuration={250}
        draggable={true}
        closeOnPressMask={true}
        customModalProps={{ statusBarTranslucent: true }}
        customStyles={{
          container: {
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            backgroundColor: '#f8f2fd',
          },
          draggableIcon: {
            backgroundColor: '#ccc',
            width: 60,
          },
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
  loadingText: {
    color: '#9a8fb6',
    fontSize: 16,
    marginTop: 10,
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
    color: '#222',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default SavedPostsScreen;
