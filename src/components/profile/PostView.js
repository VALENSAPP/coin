import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import RBSheet from 'react-native-raw-bottom-sheet';
import PostItem from '../home/posts/PostItem';
import CommentSheet from '../home/posts/CommentSheet';
import OptionsModal from '../home/posts/OptionsModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  savePost,
  unSavePost,
  likePost,
  follow,
  unfollow,
  deletePost,
  HidePost as apiHidePost,
  unHidePost as apiUnhidePost,
} from '../../services/post';
import { showToastMessage } from '../displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';

export default function PostView({ postData = [] }) {
  // ─── All hooks at the very top ───────────────────────────────
  const route = useRoute();
  const navigation = useNavigation();

  // Extract params including the source screen info
  const { postData: navPosts, startIndex, fromScreen } = route.params || {};
  const posts =
    Array.isArray(navPosts) && navPosts.length ? navPosts : postData;

  const [liked, setLiked] = useState({});
  const [saved, setSaved] = useState({});
  const [savingIds, setSavingIds] = useState(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [modalPostId, setModalPostId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [postLikesCount, setPostLikesCount] = useState({});
  const [postCommentsCount, setPostCommentsCount] = useState({});
  const [commentPostId, setCommentPostId] = useState(null);
  const [commentPostOwnerId, setCommentPostOwnerId] = useState(null);
  const [likingIds, setLikingIds] = useState(new Set());
  const [currentUserId, setCurrentUserId] = useState(null);
  const [hiddenById, setHiddenById] = useState({});
  const [hidingIds, setHidingIds] = useState(new Set());
  const [list, setList] = useState(posts);

  // follow state
  const [followingByUserId, setFollowingByUserId] = useState({});
  const [followingBusy, setFollowingBusy] = useState(new Set());

  const toast = useToast();
  const dispatch = useDispatch();
  const commentSheetRef = useRef();
  const flatListRef = useRef();

  useEffect(() => {
    (async () => {
      const id = await AsyncStorage.getItem('userId');
      setCurrentUserId(id ? String(id) : null);
    })();
  }, []);

  // ─── Handle Back Button Press ────────────────────────────────
  const handleBackPress = useCallback(() => {
    // if (fromScreen) {
    //   // If we know where we came from, navigate there specifically
    //   // navigation.navigate(fromScreen);
    //   navigation.getParent()?.navigate('HomeMain', {
    //     screen: 'Home'
    //   });
    // } else {
      // Otherwise, use goBack as fallback
      navigation.goBack();
    // }
  }, [navigation, fromScreen]);

  const getMediaType = url => {
    if (!url || typeof url !== 'string') return 'image';
    const lowerUrl = url.toLowerCase();
    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp', 'm4v'];
    const urlParts = lowerUrl.split('.');
    const extension = urlParts[urlParts.length - 1];
    const isVideo =
      videoExtensions.includes(extension) ||
      lowerUrl.includes('.mp4') ||
      lowerUrl.includes('video') ||
      lowerUrl.includes('/mp4/');
    return isVideo ? 'video' : 'image';
  };

  const formatUrl = (url) => {
    if (!url || typeof url !== 'string') return url;
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) return trimmed;
    if (trimmed.startsWith('/')) return `http://35.174.167.92:3002${trimmed}`;
    return `http://35.174.167.92:3002/${trimmed}`;
  };

  // ─── Seed maps from posts (saved, liked, counts, follow, hidden) ─────
  useEffect(() => {
    if (Array.isArray(posts) && posts.length) {
      const seededSaved = {};
      const seededLiked = {};
      const seededLikeCount = {};
      const seededCommentCounts = {};
      const seededFollowing = {};
      const seededHidden = {};
      for (const p of posts) {
        if (p?.id) {
          seededSaved[p.id] = !!p.isSaved;
          seededLiked[p.id] = !!(p.isLike ?? p.liked);
          seededLikeCount[p.id] = p.likesCount ?? p.likeCount ?? 0;
          seededCommentCounts[p.id] = p.commentCount ?? 0;
          seededHidden[p.id] = !!p.isHide;
        }
        if (p?.userId != null && typeof p.isFollow === 'boolean') {
          seededFollowing[String(p.userId)] = p.isFollow;
        }
      }
      setSaved(seededSaved);
      setLiked(seededLiked);
      setPostLikesCount(seededLikeCount);
      setPostCommentsCount(seededCommentCounts);
      setHiddenById(prev => ({ ...prev, ...seededHidden }));
      if (Object.keys(seededFollowing).length) {
        setFollowingByUserId(prev => ({ ...prev, ...seededFollowing }));
      }
    }
  }, [posts]);

  // Update list when posts change
  useEffect(() => {
    setList(posts || []);
  }, [posts]);

  // ─── Auto-scroll to startIndex when component mounts ────────
  useEffect(() => {
    if (
      startIndex !== undefined &&
      startIndex >= 0 &&
      startIndex < posts.length
    ) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: startIndex,
          animated: true,
          viewPosition: 0,
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [startIndex, posts.length]);

  // ─── Handle scroll to index errors ─────────────────────────
  const onScrollToIndexFailed = useCallback(info => {
    const wait = new Promise(resolve => setTimeout(resolve, 500));
    wait.then(() => {
      flatListRef.current?.scrollToIndex({
        index: info.index,
        animated: true,
        viewPosition: 0,
      });
    });
  }, []);

  // ─── Like ───────────────────────────────────────────────────
  const toggleLike = async (postId) => {
    if (!postId) return;
    if (likingIds.has(postId)) return;

    const wasLiked = !!liked[postId];
    const prevCount = postLikesCount[postId] ?? 0;

    setLiked(prev => ({ ...prev, [postId]: !wasLiked }));
    setPostLikesCount(prev => ({
      ...prev,
      [postId]: wasLiked ? Math.max(0, prevCount - 1) : prevCount + 1
    }));

    setLikingIds(prev => new Set(prev).add(postId));

    try {
      const res = await likePost(postId);
      const ok = res?.statusCode === 200 && res?.success;

      if (ok) {
        const serverLiked = !!res?.data?.liked;
        const serverCount = res?.data?.likesCount ?? res?.data?.totalLikes;

        setLiked(prev => ({ ...prev, [postId]: serverLiked }));
        if (serverCount !== undefined) {
          setPostLikesCount(prev => ({ ...prev, [postId]: serverCount }));
        }
      } else {
        setLiked(prev => ({ ...prev, [postId]: wasLiked }));
        setPostLikesCount(prev => ({ ...prev, [postId]: prevCount }));
        showToastMessage(toast, 'danger', res?.data?.message || 'Failed to toggle like');
      }
    } catch (e) {
      setLiked(prev => ({ ...prev, [postId]: wasLiked }));
      setPostLikesCount(prev => ({ ...prev, [postId]: prevCount }));
      showToastMessage(toast, 'danger', e?.response?.data?.message || 'Something went wrong');
    } finally {
      setLikingIds(prev => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  // ─── Save / Unsave ──────────────────────────────────────────
  const handleToggleSave = async id => {
    if (!id) return;
    if (savingIds.has(id)) return;

    setSavingIds(prev => new Set(prev).add(id));
    const isCurrentlySaved = !!saved[id];

    try {
      const resp = isCurrentlySaved ? await unSavePost(id) : await savePost(id);
      if (resp && resp.statusCode == 200) {
        showToastMessage(toast, 'success', resp.data.message);
        setSaved(prev => ({ ...prev, [id]: !isCurrentlySaved }));
      } else {
        showToastMessage(toast, 'danger', resp.data.message);
      }
    } catch (err) {
      showToastMessage(
        toast,
        'danger',
        err?.response?.message ?? 'Something went wrong',
      );
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // ─── Hide / Unhide ──────────────────────────────────────────
  const handleToggleHide = useCallback(
    async postId => {
      if (!postId) return;
      if (hidingIds.has(postId)) return;

      const isHidden = !!hiddenById[postId];
      setHiddenById(prev => ({ ...prev, [postId]: !isHidden }));
      setHidingIds(prev => new Set(prev).add(postId));

      try {
        dispatch(showLoader());
        const resp = isHidden
          ? await apiUnhidePost(postId)
          : await apiHidePost(postId);
        const ok = resp?.statusCode === 200 && (resp?.success ?? true);
        if (!ok) {
          setHiddenById(prev => ({ ...prev, [postId]: isHidden }));
          showToastMessage(
            toast,
            'danger',
            resp?.data?.message ||
            resp?.message ||
            `Failed to ${isHidden ? 'unhide' : 'hide'} post`,
          );
        } else {
          showToastMessage(
            toast,
            'success',
            resp?.data?.message || (isHidden ? 'Post unhidden' : 'Post hidden'),
          );
        }
      } catch (e) {
        setHiddenById(prev => ({ ...prev, [postId]: isHidden }));
        showToastMessage(
          toast,
          'danger',
          e?.response?.data?.message || 'Something went wrong',
        );
      } finally {
        dispatch(hideLoader());
        setHidingIds(prev => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      }
    },
    [hiddenById, hidingIds, toast, dispatch],
  );

  const handleToggleFollow = useCallback(
    async (targetUserId, shouldFollow) => {
      if (!targetUserId) return;
      const key = String(targetUserId);
      if (followingBusy.has(key)) return;
      setFollowingByUserId(prev => ({ ...prev, [key]: shouldFollow }));
      setFollowingBusy(prev => new Set(prev).add(key));

      try {
        const res = shouldFollow ? await follow(targetUserId) : await unfollow(targetUserId);
        const ok = res?.statusCode === 200 && (res?.success ?? true);

        if (!ok) {
          setFollowingByUserId(prev => ({ ...prev, [key]: !shouldFollow }));
          showToastMessage(
            toast,
            'danger',
            res?.data?.message || res?.message || 'Unable to update follow'
          );
        } else {
          const serverVal = res?.data?.following;
          if (typeof serverVal === 'boolean') {
            setFollowingByUserId(prev => ({ ...prev, [key]: serverVal }));
          }
          showToastMessage(
            toast,
            'success',
            shouldFollow ? 'Successfully Vallowed!' : 'Unfollowed',
          );
        }
      } catch (e) {
        setFollowingByUserId(prev => ({ ...prev, [key]: !shouldFollow }));
        showToastMessage(
          toast,
          'danger',
          e?.response?.data?.message || 'Something went wrong'
        );
      } finally {
        setFollowingBusy(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [toast, followingBusy]
  );

  // ─── Options ──────────────────────────────────────────
  const openOptions = id => {
    setModalPostId(id);
    setModalVisible(true);
  };

  const closeOptions = () => {
    setModalVisible(false);
    setModalPostId(null);
  };

  // Optimize canDelete calculation
  const canDelete = useMemo(() => {
    if (!modalPostId || !currentUserId) return false;
    const post = list.find(x => String(x.id) === String(modalPostId));
    if (!post) return false;
    return String(post.userId) === String(currentUserId);
  }, [list, modalPostId, currentUserId]);

  const onSheetAction = useCallback(
    async action => {
      if (!modalPostId) return;

      if (action === 'toggleSave') {
        await handleToggleSave(modalPostId);
        closeOptions();
        return;
      }

      if (action === 'deletePost') {
        if (!canDelete) {
          showToastMessage(toast, 'danger', "You can't delete this post.");
          closeOptions();
          return;
        }

        Alert.alert('Delete post?', 'This action cannot be undone.', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                dispatch(showLoader());
                let userId = currentUserId;
                if (!userId) {
                  const id = await AsyncStorage.getItem('userId');
                  if (!id) {
                    showToastMessage(
                      toast,
                      'danger',
                      'No user id found; cannot delete.',
                    );
                    return;
                  }
                  userId = String(id);
                }
                setList(prev =>
                  prev.filter(p => String(p.id) !== String(modalPostId)),
                );
                const res = await deletePost(modalPostId, userId);
                closeOptions();
                if (res?.statusCode === 200 && res?.success) {
                  showToastMessage(
                    toast,
                    'success',
                    res?.data?.message || 'Post deleted',
                  );
                } else {
                  showToastMessage(
                    toast,
                    'danger',
                    res?.data?.message || res?.message || 'Failed to delete',
                  );
                }
              } catch (err) {
                showToastMessage(
                  toast,
                  'danger',
                  err?.response?.data?.message ||
                  err?.message ||
                  'Error deleting post',
                );
              } finally {
                dispatch(hideLoader());
              }
            },
          },
        ]);

        return;
      }

      if (action === 'hidePost') {
        await handleToggleHide(modalPostId);
        closeOptions();
        return;
      }

      closeOptions();
    },
    [
      modalPostId,
      canDelete,
      handleToggleSave,
      closeOptions,
      toast,
      currentUserId,
      dispatch,
      handleToggleHide,
    ],
  );

  // ─── Comments ───────────────────────────────────────────────
  const handleComment = (postId, ownerId) => {
    setCommentPostId(postId);
    setCommentPostOwnerId(ownerId);
    commentSheetRef.current?.open();
  };

  const submitComment = () => {
    if (!commentText.trim()) return;
    Alert.alert('Commented:', commentText.trim());
    setCommentText('');
    commentSheetRef.current?.close();
  };

  // ─── Renderer ───────────────────────────────────────────────
  const renderFeedItem = useCallback(
    ({ item }) => {
      const mapped = {
        id: item.id,
        username: item.userName ?? 'Unknown',
        avatar:
          item.userImage == null
            ? 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
            : formatUrl(item.userImage),
        media: (item.images || []).map(url => ({
          type: getMediaType(url),
          url: formatUrl(url),
        })),
        caption: item.caption,
        PostsProfile: 'Support',
        createdAt: item.createdAt,
        UserId: item.userId,
        userId: item.userId,
        boughtBy: item.boughtBy || [],
        follow:
          typeof followingByUserId[String(item.userId)] === 'boolean'
            ? followingByUserId[String(item.userId)]
            : !!item.isFollow,
      };

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
      liked,
      saved,
      postLikesCount,
      postCommentsCount,
      followingByUserId,
      followingBusy,
      handleToggleFollow,
    ],
  );

  // ─── Get initial scroll index for FlatList ──────────────────
  const getInitialScrollIndex = () => {
    if (
      startIndex !== undefined &&
      startIndex >= 0 &&
      startIndex < posts.length
    ) {
      return startIndex;
    }
    return 0;
  };

  // ─── Dynamic item height calculation ─────────────────────────
  const getItemLayout = useCallback((data, index) => {
    const baseHeight = 150;
    const mediaHeight = 300;
    const totalHeight = baseHeight + mediaHeight;
    return { length: totalHeight, offset: totalHeight * index, index };
  }, []);

  const handleCommentClose = () => {
    commentSheetRef.current?.close();
    setCommentPostId(null);
  };

  const handleCommentCountUpdate = useCallback((postId, newCount) => {
    setPostCommentsCount(prev => ({
      ...prev,
      [postId]: Math.max(0, newCount)
    }));
  }, []);

  return (
    <>
      <SafeAreaView style={styles.container}>
        <View style={styles.headerSection}>
          <TouchableOpacity
            onPress={handleBackPress}
            style={styles.buttons}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.userText}>{posts[0]?.userName || 'Posts'}</Text>
          <View style={styles.placeholder} />
        </View>

        <FlatList
          ref={flatListRef}
          data={list.filter(item => !hiddenById[item.id])}
          keyExtractor={p => p.id?.toString() || Math.random().toString()}
          renderItem={renderFeedItem}
          contentContainerStyle={styles.feedContainer}
          showsVerticalScrollIndicator={false}
          initialScrollIndex={getInitialScrollIndex()}
          onScrollToIndexFailed={onScrollToIndexFailed}
          getItemLayout={getItemLayout}
          removeClippedSubviews={true}
          maxToRenderPerBatch={3}
          windowSize={5}
        />
      </SafeAreaView>

      {/* Options Modal */}
      <OptionsModal
        visible={modalVisible}
        onClose={closeOptions}
        onSelect={onSheetAction}
        fromHome={true}
        postId={modalPostId ?? ''}
        isSaved={!!(modalPostId && saved[modalPostId])}
        canDelete={!!canDelete}
        isHidden={!!(modalPostId && hiddenById[modalPostId])}
        hideBusy={modalPostId ? hidingIds.has(modalPostId) : false}
      />

      {/* Comment Bottom Sheet */}
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f2fd',
  },
  feedContainer: {
    // paddingBottom: 20,
  },
  headerSection: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingTop: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
  },
  buttons: {
    padding: 5,
  },
  userText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 34,
  },
});