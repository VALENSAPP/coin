import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Icon from 'react-native-vector-icons/Ionicons';
import RBSheet from 'react-native-raw-bottom-sheet';
import { SafeAreaView } from 'react-native-safe-area-context';

import PostItem from '../../components/home/posts/PostItem';
import { extractPostMusicPayloadFromApi } from '../../utils/postSoundtracks';
import CommentSheet from '../../components/home/posts/CommentSheet';
import OptionsModal from '../../components/home/posts/OptionsModal';

import {
  getHidePost,
  unHidePost,
  likePost,
  follow,
  unfollow,
  getUserCredentials,
  savePost,
  unSavePost,
  deletePost,
} from '../../services/post';
import { buildPostMaps } from '../../utils/postMaps';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';

const HidePosts = ({ navigation }) => {
  const isScreenFocused = useIsFocused();
  const { t } = useLanguage();
  const [feedVisiblePostId, setFeedVisiblePostId] = useState(null);
  const [feedPlayingPostId, setFeedPlayingPostId] = useState(null);

  // Data
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Per-post UI state
  const [liked, setLiked] = useState({});
  const [postLikesCount, setPostLikesCount] = useState({});
  const [postCommentsCount, setPostCommentsCount] = useState({});

  // Hidden map
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
  const [currentUserId, setCurrentUserId] = useState(null);

  // Saved state (for OptionsModal save/unsave)
  const [savedById, setSavedById] = useState({});
  const [savingIds, setSavingIds] = useState(new Set());

  // Comments
  const [commentText, setCommentText] = useState('');
  const [commentPostId, setCommentPostId] = useState(null);
  const [commentPostOwnerId, setCommentPostOwnerId] = useState(null);
  const commentSheetRef = useRef(null);

  const [currentUsername, setCurrentUsername] = useState('user');
  const [profileOverride, setProfileOverride] = useState(undefined);
  const [userDetailsById, setUserDetailsById] = useState({});
  const userDetailsRequestIdRef = useRef(0);

  const toast = useToast();
  const { bgStyle, textStyle, cardStyle, text: themeText } = useAppTheme(profileOverride);

  // --- helpers ---
  const formatUrl = useCallback((url) => {
    if (!url || typeof url !== 'string') return '';
    if (url.startsWith('http')) return url;
    return `https://${url}`;
  }, []);

  const normalizeProfileType = useCallback((value) => {
    const lowered = String(value || '').trim().toLowerCase();
    if (lowered === 'company' || lowered === 'business') return 'company';
    return 'user';
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

  const getCurrentUsername = async () => {
    const username = await AsyncStorage.getItem('currentUsername');
    if (username) setCurrentUsername(username);
  };

  const loadCurrentUserThemeOverride = useCallback(async () => {
    try {
      const storedProfile = await AsyncStorage.getItem('profile');
      if (storedProfile) {
        setProfileOverride(normalizeProfileType(storedProfile));
      }

      const id = await AsyncStorage.getItem('userId');
      if (!id) return;
      setCurrentUserId(String(id));

      const res = await getUserCredentials(String(id));
      if (res?.statusCode !== 200) return;

      const user = res?.data?.user || res?.data || res || {};

      if (user?.displayName || user?.userName || user?.username) {
        setCurrentUsername(user?.displayName || user?.userName || user?.username);
      }
      setProfileOverride(normalizeProfileType(user?.profile));
    } catch (e) {
      // ignore; fallback to ThemeContext / AsyncStorage profile
    }
  }, [normalizeProfileType]);

  const ensureUserDetailsForPosts = useCallback(
    async (list) => {
      const requestId = Date.now();
      userDetailsRequestIdRef.current = requestId;

      const uniqueUserIds = Array.from(
        new Set(
          (Array.isArray(list) ? list : [])
            .map(p => p?.userId)
            .filter(Boolean)
            .map(id => String(id)),
        ),
      );

      const idsToFetch = uniqueUserIds.filter((id) => {
        if (userDetailsById[id]) return false;
        const post = (Array.isArray(list) ? list : []).find(p => String(p?.userId) === id);
        const missingProfile = !post?.profile;
        const missingName = !(post?.userName || post?.username);
        const missingImage = !(post?.userImage || post?.avatar);
        return missingProfile || missingName || missingImage;
      });

      if (!idsToFetch.length) return;

      const chunkSize = 6;
      const chunks = [];
      for (let i = 0; i < idsToFetch.length; i += chunkSize) {
        chunks.push(idsToFetch.slice(i, i + chunkSize));
      }

      const nextEntries = {};
      for (const chunk of chunks) {
        const results = await Promise.all(
          chunk.map(async (id) => {
            try {
              const res = await getUserCredentials(id);
              if (res?.statusCode !== 200) return null;
              const user = res?.data?.user || res?.data || res || {};
              return { id, user };
            } catch {
              return null;
            }
          }),
        );

        if (userDetailsRequestIdRef.current !== requestId) return;

        for (const entry of results) {
          if (!entry) continue;
          const user = entry.user || {};
          nextEntries[entry.id] = {
            userName: user?.userName || user?.username || user?.displayName || '',
            image: user?.image || user?.profilePic || user?.avatar || '',
            profile: normalizeProfileType(user?.profile),
          };
        }
      }

      if (userDetailsRequestIdRef.current !== requestId) return;
      if (Object.keys(nextEntries).length) {
        setUserDetailsById(prev => ({ ...prev, ...nextEntries }));
      }
    },
    [normalizeProfileType, userDetailsById],
  );

  const mapApiPostToPostItem = useCallback(
    (p) => {
      const userKey = String(p.userId ?? '');
      const normalizedProfile =
        String(p.profile || '')
          .trim()
          .toLowerCase() === 'company'
          ? 'company'
          : 'user';
      const cachedUser = userKey ? userDetailsById[userKey] : null;
      const resolvedProfile = normalizeProfileType(p.profile || cachedUser?.profile || normalizedProfile);
      return {
        id: p.id,
        username:
          p.userName ??
          p.username ??
          cachedUser?.userName ??
          currentUsername ??
          'Unknown',
        avatar: p.userImage
          ? formatUrl(p.userImage)
          : p.avatar
            ? formatUrl(p.avatar)
            : cachedUser?.image
              ? formatUrl(cachedUser.image)
              : 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
        media: (p.images || []).map((url) => ({ type: getMediaType(url), url: formatUrl(url) })),
        caption: p.caption || p.text || '',
        PostsProfile: p.PostsProfile ?? 'Vallow',
        profile: resolvedProfile,
        createdAt: p.createdAt,
        UserId: p.userId,
        userId: p.userId,
        boughtBy: p.boughtBy || [],
        follow:
          typeof followingByUserId[userKey] === 'boolean'
            ? followingByUserId[userKey]
            : !!p.isFollow,
        ...extractPostMusicPayloadFromApi(p),
      };
    },
    [followingByUserId, currentUsername, formatUrl, getMediaType, normalizeProfileType, userDetailsById]
  );

  const seedMapsFromPosts = useCallback((list) => {
    const maps = buildPostMaps(list, { includeSaved: false, includeHidden: true });
    setLiked(maps.nextLiked);
    setPostLikesCount(maps.nextLikeCounts);
    setPostCommentsCount(maps.nextCommentCounts);
    setHidden(maps.nextHidden);
    const nextSaved = {};
    for (const p of list || []) {
      if (!p?.id) continue;
      nextSaved[p.id] = !!(p.isSaved ?? p.saved ?? false);
    }
    setSavedById(nextSaved);
    if (Object.keys(maps.nextFollowing).length) {
      setFollowingByUserId((prev) => ({ ...prev, ...maps.nextFollowing }));
    }
  }, []);

  const handleHidePostsViewableChanged = useCallback(({ viewableItems }) => {
    if (!viewableItems?.length) {
      setFeedVisiblePostId(null);
      setFeedPlayingPostId(null);
      return;
    }
    let best = null;
    let bestPct = -1;
    for (const vi of viewableItems) {
      const pid = vi.item?.id ?? vi.item?._id;
      if (!vi.isViewable || pid == null) continue;
      const pct =
        typeof vi.percentVisible === 'number'
          ? vi.percentVisible
          : typeof vi.viewablePercent === 'number'
            ? vi.viewablePercent
            : 100;
      if (pct > bestPct) {
        bestPct = pct;
        best = vi.item;
      }
    }
    const id = best?.id ?? best?._id ?? null;
    setFeedVisiblePostId(id);
    setFeedPlayingPostId(id);
  }, []);

  const hidePostsViewableRef = useRef(handleHidePostsViewableChanged);
  useEffect(() => {
    hidePostsViewableRef.current = handleHidePostsViewableChanged;
  }, [handleHidePostsViewableChanged]);

  const hidePostsViewabilityPairs = useRef([
    {
      viewabilityConfig: {
        viewAreaCoveragePercentThreshold: 50,
        minimumViewTime: 50,
        waitForInteraction: false,
      },
      onViewableItemsChanged: info => hidePostsViewableRef.current?.(info),
    },
  ]);

  useEffect(() => {
    if (!posts.length) {
      setFeedVisiblePostId(null);
      setFeedPlayingPostId(null);
      return;
    }
    if (feedVisiblePostId != null) {
      const stillThere = posts.some(
        p => String(p.id ?? p._id) === String(feedVisiblePostId),
      );
      if (!stillThere) {
        const nextId = posts[0]?.id ?? posts[0]?._id ?? null;
        setFeedVisiblePostId(nextId);
        setFeedPlayingPostId(nextId);
      }
      return;
    }
    const firstId = posts[0]?.id ?? posts[0]?._id ?? null;
    if (firstId != null) {
      setFeedVisiblePostId(firstId);
      setFeedPlayingPostId(firstId);
    }
  }, [posts, feedVisiblePostId]);

  // --- fetch ---
  const fetchHiddenPosts = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      const response = await getHidePost();

      if (response?.success && response?.statusCode === 200) {
        const raw = Array.isArray(response.data) ? response.data : [];
        setPosts(raw);
        seedMapsFromPosts(raw);
        ensureUserDetailsForPosts(raw);
      } else {
        Alert.alert(
          t('hidePosts.errorTitle'),
          response?.message || t('hidePosts.fetchError'),
        );
      }
    } catch (err) {
      console.error('Error fetching hidden posts:', err);
      Alert.alert(t('hidePosts.errorTitle'), t('hidePosts.networkError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing, seedMapsFromPosts, ensureUserDetailsForPosts, t]);

  useFocusEffect(
    useCallback(() => {
      loadCurrentUserThemeOverride();
      getCurrentUsername();
      fetchHiddenPosts();
      return () => {};
    }, [fetchHiddenPosts, loadCurrentUserThemeOverride])
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
            res?.data?.message || res?.message || t('hidePosts.followUpdateError'),
          );
        } else if (typeof res?.data?.following === 'boolean') {
          setFollowingByUserId((prev) => ({ ...prev, [key]: res.data.following }));
        }
      } catch (e) {
        setFollowingByUserId((prev) => ({ ...prev, [key]: !shouldFollow }));
        showToastMessage(
          toast,
          'danger',
          e?.response?.data?.message || t('hidePosts.somethingWentWrong'),
        );
      } finally {
        setFollowingBusy((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [toast, followingBusy, t]
  );

  // --- like ---
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
            res?.data?.message || (serverLiked ? t('hidePosts.postLiked') : t('hidePosts.postUnliked')),
          );
        } else {
          setLiked((prev) => ({ ...prev, [postId]: wasLiked }));
          setPostLikesCount((prev) => ({ ...prev, [postId]: prevCount }));
          showToastMessage(
            toast,
            'danger',
            res?.data?.message || t('hidePosts.likeToggleFailed'),
          );
        }
      } catch (e) {
        setLiked((prev) => ({ ...prev, [postId]: wasLiked }));
        setPostLikesCount((prev) => ({ ...prev, [postId]: prevCount }));
        showToastMessage(
          toast,
          'danger',
          e?.response?.data?.message || t('hidePosts.somethingWentWrong'),
        );
      } finally {
        setLikingIds((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      }
    },
    [liked, postLikesCount, likingIds, toast, t]
  );

  // --- UNHIDE ---
  const handleToggleHide = useCallback(
    async (id) => {
      if (!id || unhidingIds.has(id)) return;

      setUnhidingIds((prev) => new Set(prev).add(id));
      try {
        const resp = await unHidePost(id);
        if (resp && resp.statusCode === 200 && resp.success) {
          showToastMessage(
            toast,
            'success',
            resp?.data?.message || t('hidePosts.postUnhidden'),
          );
          setHidden((prev) => ({ ...prev, [id]: false }));
          setPosts((prev) => prev.filter((p) => p.id !== id));
        } else {
          showToastMessage(
            toast,
            'danger',
            resp?.data?.message || t('hidePosts.unhideFailed'),
          );
        }
      } catch (err) {
        showToastMessage(
          toast,
          'danger',
          err?.response?.message ?? t('hidePosts.somethingWentWrong'),
        );
      } finally {
        setUnhidingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [unhidingIds, toast, t]
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

  const modalPost = useMemo(() => {
    if (!modalPostId) return null;
    return posts.find(p => String(p?.id || p?._id) === String(modalPostId)) || null;
  }, [modalPostId, posts]);

  const modalCanDelete = useMemo(() => {
    if (!modalPost) return false;
    if (!currentUserId) return false;
    return String(modalPost?.userId) === String(currentUserId);
  }, [currentUserId, modalPost]);

  const handleToggleSave = useCallback(
    async (id) => {
      if (!id) return;
      if (savingIds.has(id)) return;

      const isCurrentlySaved = !!savedById[id];
      setSavingIds(prev => new Set(prev).add(id));
      setSavedById(prev => ({ ...prev, [id]: !isCurrentlySaved }));

      try {
        const resp = isCurrentlySaved ? await unSavePost(id) : await savePost(id);
        if (resp?.statusCode === 200) {
          showToastMessage(
            toast,
            'success',
            resp?.data?.message ||
              (isCurrentlySaved ? t('hidePosts.postUnsaved') : t('hidePosts.postSaved')),
          );
        } else {
          setSavedById(prev => ({ ...prev, [id]: isCurrentlySaved }));
          showToastMessage(
            toast,
            'danger',
            resp?.data?.message || resp?.message || t('hidePosts.saveFailed'),
          );
        }
      } catch (e) {
        setSavedById(prev => ({ ...prev, [id]: isCurrentlySaved }));
        showToastMessage(
          toast,
          'danger',
          e?.response?.data?.message || t('hidePosts.somethingWentWrong'),
        );
      } finally {
        setSavingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [savedById, savingIds, toast, t],
  );

  const handlePostEdited = useCallback((updatedPost) => {
    if (!updatedPost?.id) return;
    setPosts(prev =>
      prev.map(p =>
        String(p?.id || p?._id) === String(updatedPost.id) ? { ...p, ...updatedPost } : p,
      ),
    );
  }, []);

  const onOptionsSelect = useCallback(
    async (action) => {
      if (!modalPostId) return;

      if (action === 'toggleSave') {
        await handleToggleSave(String(modalPostId));
        closeOptions();
        return;
      }

      if (action === 'copyAddress') {
        const deepLink = `com.valens://?af=dd&postId=${encodeURIComponent(String(modalPostId))}`;
        Clipboard.setString(deepLink);
        showToastMessage(toast, 'success', t('hidePosts.postCopied'));
        closeOptions();
        return;
      }

      if (action === 'editPost') {
        if (!modalCanDelete) {
          showToastMessage(toast, 'danger', t('hidePosts.cannotEditPost'));
          closeOptions();
          return;
        }

        const postToEdit = modalPost;
        closeOptions();
        if (!postToEdit) {
          showToastMessage(toast, 'danger', t('hidePosts.postNotFound'));
          return;
        }

        navigation.navigate('EditPost', {
          post: postToEdit,
          onSave: handlePostEdited,
        });
        return;
      }

      if (action === 'deletePost') {
        if (!modalCanDelete) {
          showToastMessage(toast, 'danger', t('hidePosts.cannotDeletePost'));
          closeOptions();
          return;
        }

        Alert.alert(
          t('hidePosts.deletePostTitle'),
          t('hidePosts.deletePostMessage'),
          [
            { text: t('hidePosts.cancel'), style: 'cancel' },
            {
              text: t('hidePosts.delete'),
              style: 'destructive',
              onPress: async () => {
                try {
                  const userId = currentUserId || (await AsyncStorage.getItem('userId'));
                  if (!userId) {
                    showToastMessage(toast, 'danger', t('hidePosts.noUserIdError'));
                    return;
                  }

                  setPosts(prev =>
                    prev.filter(p => String(p?.id || p?._id) !== String(modalPostId)),
                  );
                  closeOptions();

                  const res = await deletePost(String(modalPostId), String(userId));
                  if (res?.statusCode === 200 && res?.success) {
                    showToastMessage(
                      toast,
                      'success',
                      res?.data?.message || t('hidePosts.postDeleted'),
                    );
                  } else {
                    showToastMessage(
                      toast,
                      'danger',
                      res?.data?.message || res?.message || t('hidePosts.deleteFailed'),
                    );
                  }
                } catch (e) {
                  showToastMessage(
                    toast,
                    'danger',
                    e?.response?.data?.message || e?.message || t('hidePosts.deleteError'),
                  );
                }
              },
            },
          ],
        );

        return;
      }

      if (action === 'hidePost') {
        await handleToggleHide(String(modalPostId));
        closeOptions();
        return;
      }

      closeOptions();
    },
    [
      modalPostId,
      closeOptions,
      handleToggleHide,
      handleToggleSave,
      toast,
      modalCanDelete,
      modalPost,
      navigation,
      handlePostEdited,
      currentUserId,
      t,
    ]
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
    Alert.alert(t('hidePosts.commentedAlert'), commentText.trim());
    setCommentText('');
    commentSheetRef.current?.close();
  }, [commentText, t]);

  // --- render ---
  const renderPostItem = useCallback(
    ({ item }) => {
      const mapped = mapApiPostToPostItem(item);
      const postId = item.id ?? item._id;
      return (
        <PostItem
          item={mapped}
          liked={!!liked[item.id]}
          likesCount={postLikesCount[item.id] || 0}
          commentsCount={postCommentsCount[item.id] || 0}
          saved={!!hidden[item.id]}
          onToggleSave={() => handleToggleHide(item.id)}
          onToggleLike={() => toggleLike(item.id)}
          onToggleFollow={handleToggleFollow}
          followingBusy={followingBusy.has(String(mapped.UserId))}
          onComment={() => handleComment(item.id, mapped.UserId)}
          onOptions={() => openOptions(item.id)}
          onSuggest={[]}
          isVisible={String(postId) === String(feedVisiblePostId)}
          screenFocused={isScreenFocused}
          playingPostId={feedPlayingPostId}
          currentlyVisiblePostId={feedVisiblePostId}
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
      feedVisiblePostId,
      feedPlayingPostId,
      isScreenFocused,
    ]
  );

  const keyExtractor = useCallback(
    (item) => item.id?.toString() || item._id?.toString(),
    [],
  );

  const EmptyState = useCallback(
    () => (
      <View style={styles.emptyState}>
        <Icon
          name="eye-off-outline"
          size={80}
          color={
            typeof themeText === 'string' && themeText.startsWith('#') && themeText.length === 7
              ? `${themeText}55`
              : '#C7C7CC'
          }
        />
        <Text style={[styles.emptyTitle, textStyle]}>{t('hidePosts.emptyTitle')}</Text>
        <Text style={[styles.emptySubtitle, textStyle, { opacity: 0.7 }]}>
          {t('hidePosts.emptySubtitle')}
        </Text>
      </View>
    ),
    [textStyle, themeText, t]
  );

  return (
    <SafeAreaView style={[styles.container, bgStyle]} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={cardStyle?.backgroundColor || '#fff'}
      />
      <View style={[styles.header, cardStyle]}>
        <TouchableOpacity
          onPress={() => navigation?.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={24} color={themeText || '#262626'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]}>{t('hidePosts.headerTitle')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading && posts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeText || '#4d2a88'} />
          <Text style={[styles.loadingText, textStyle, { opacity: 0.7 }]}>
            {t('hidePosts.loadingText')}
          </Text>
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
          viewabilityConfigCallbackPairs={hidePostsViewabilityPairs.current}
        />
      )}

      <OptionsModal
        visible={modalVisible}
        onClose={closeOptions}
        fromHome={true}
        onSelect={onOptionsSelect}
        postId={modalPostId ?? ''}
        isSaved={!!(modalPostId && savedById[String(modalPostId)])}
        isHidden={!!(modalPostId && hidden[String(modalPostId)])}
        hideBusy={modalPostId ? unhidingIds.has(modalPostId) : false}
        canDelete={modalCanDelete}
        canEdit={modalCanDelete}
        onHiddenChange={(id, nextHidden) => {
          const key = String(id);
          setHidden(prev => ({ ...prev, [key]: nextHidden }));
          if (!nextHidden) {
            setPosts(prev =>
              prev.filter(item => String(item?.id || item?._id) !== key),
            );
          }
        }}
      />

      <RBSheet
        ref={commentSheetRef}
        height={500}
        openDuration={250}
        draggable
        closeOnPressMask
        customModalProps={{ statusBarTranslucent: true }}
        customStyles={{
          container: [
            {
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
            },
            bgStyle,
          ],
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
  container: { flex: 1 },
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
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
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
  loadingText: { fontSize: 16, marginTop: 10 },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 24, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
});

export default HidePosts;
