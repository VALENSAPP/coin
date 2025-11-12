import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { View, FlatList, StyleSheet, Alert, Keyboard } from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
// Child components
import OptionsModal from './OptionsModal';
import CommentSheet from './CommentSheet';
import PostItem from './PostItem';
import Suggestion from './suggestion';

import {
  getPostlikes,
  likePost,
  savePost,
  unSavePost,
  deletePost,
  follow,
  unfollow,
  HidePost as apiHidePost,
  unHidePost as apiUnhidePost,
} from '../../../services/post';

import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../../displaytoastmessage';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { hideLoader, showLoader } from '../../../redux/actions/LoaderAction';
import { useDispatch } from 'react-redux';
import { getAllUser } from '../../../services/users';
import TokenPurchaseModal from '../../modals/TokenPurchaseModal';
import { following as apiFollowing, followers as apiFollowers } from '../../../services/profile';
import { useFocusEffect } from '@react-navigation/native';
import TokenSellModal from '../../modals/TokenSellModal';
import { getUserTokenInfoByBlockChain } from '../../../services/tokens';
import { getSuggestedUsers } from '../../../services/home';

export default function Posts({ postData = [], onRefresh, isBusinessProfile }) {
  // All state hooks first - maintain consistent order
  const [purchaseAutoFocus, setPurchaseAutoFocus] = useState(false);
  const [list, setList] = useState(postData);
  const [liked, setLiked] = useState({});
  const [saved, setSaved] = useState({});
  const [savingIds, setSavingIds] = useState(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [modalPostId, setModalPostId] = useState(null);
  const [postLikesCount, setPostLikesCount] = useState({});
  const [postCommentsCount, setPostCommentsCount] = useState({});
  const [likingIds, setLikingIds] = useState(new Set());
  const [postLikes, setPostLikes] = useState({});
  const [commentPostId, setCommentPostId] = useState(null);
  const [commentPostOwnerId, setCommentPostOwnerId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [followingByUserId, setFollowingByUserId] = useState({});
  const [followingBusy, setFollowingBusy] = useState(new Set());
  const [hiddenById, setHiddenById] = useState({});
  const [hidingIds, setHidingIds] = useState(new Set());
  const [isExecutingPurchase, setIsExecutingPurchase] = useState(false);
  const [followingIds, setFollowingIds] = useState(new Set());
  const [tokenAddress, setTokenAddress] = useState(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // -------- Token Purchase Modal States --------
  const [pendingFollowUserId, setPendingFollowUserId] = useState(null);
  const [pendingFollowAction, setPendingFollowAction] = useState(null);
  const [userFollowStatus, setUserFollowStatus] = useState({});

  // -------- Dynamic Followers State --------
  const [postFollowers, setPostFollowers] = useState({});

  // -------- suggestions state (local pagination) --------
  const SUGGEST_PAGE_SIZE = 10;
  const [suggestAllUsers, setSuggestAllUsers] = useState([]); // full list from API
  const [suggestPage, setSuggestPage] = useState(1); // visible pages (×10)
  const [suggestHasMore, setSuggestHasMore] = useState(true);
  const [suggestDismissed, setSuggestDismissed] = useState(new Set());
  const [userTokenBalance, setUserTokenBalance] = useState(0);

  const commentSheetRef = useRef();
  const purchaseSheetRef = useRef(null);
  const sellSheetRef = useRef(null);
  const toast = useToast();
  const dispatch = useDispatch();

  useEffect(() => {
    let timeout;

    const onKeyboardHide = () => {
      timeout = setTimeout(() => {
        // reset layout for both sheets
        purchaseSheetRef.current?.updateLayout?.({ height: 500 });
        commentSheetRef.current?.updateLayout?.({ height: 500 });
      }, 300); // wait until keyboard animation is done
    };

    const hideSub = Keyboard.addListener('keyboardDidHide', onKeyboardHide);

    return () => {
      hideSub.remove();
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  // Fetch following status for each post user
  useEffect(() => {
    const fetchFollowingStatus = async () => {
      if (!list || list.length === 0) return;

      const followingPromises = list.map(async (item) => {
        try {
          const res = await apiFollowing(item.userId);
          const rows = res?.data?.data ?? res?.data ?? [];

          // Check if current user is following this user
          const followingRow = Array.isArray(rows)
            ? rows.find(r => r.followingId === item.userId)
            : null;

          const isFollowing = !!followingRow;
          const tokenAddress = followingRow?.following?.userTokens?.[0]?.tokenAddress ?? null;
          const followingImage = followingRow?.following?.image ?? null;

          return {
            userId: item.userId,
            isFollowing,
            tokenAddress,
            image: followingImage
          };
        } catch (e) {
          console.log('Error checking follow status for user:', item.userId, e);
          return {
            userId: item.userId,
            isFollowing: false,
            tokenAddress: null,
            image: null
          };
        }
      });

      try {
        const results = await Promise.all(followingPromises);
        const followingMap = {};
        results.forEach(result => {
          followingMap[result.userId] = {
            isFollowing: result.isFollowing,
            tokenAddress: result.tokenAddress,
            image: result.image
          };
        });
        setUserFollowStatus(followingMap);
      } catch (error) {
        console.log('Error fetching following statuses:', error);
      }
    };

    fetchFollowingStatus();
  }, [list]);

  // -------- Fetch followers for each post (for "Vallowed by" section) --------
  useEffect(() => {
    const fetchPostFollowers = async () => {
      if (!list || list.length === 0) return;
      const followersPromises = list.map(async (item) => {
        try {
          // Call apiFollowers to get people who follow this user
          const res = await apiFollowers(item.userId);
          // Try different possible response structures
          let followersData = res?.data?.data || res?.data || [];
          // Extract the "follower" users (people who follow this user)
          const transformedFollowers = Array.isArray(followersData)
            ? followersData
              .filter(f => {
                const hasFollower = f.status === 'ACCEPTED' && f.follower;
                return hasFollower;
              })
              .map(f => {
                const follower = {
                  id: f.follower.id || f.followerId,
                  username: f.follower.userName || f.follower.displayName ||
                    (f.follower.email ? f.follower.email.split('@')[0] : 'User'),
                  avatar: f.follower.image || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
                };
                return follower;
              })
            : [];
          return {
            userId: item.userId,
            followers: transformedFollowers
          };
        } catch (e) {
          console.error('Error fetching followers for user:', item.userId, e);
          return {
            userId: item.userId,
            followers: []
          };
        }
      });

      try {
        const results = await Promise.all(followersPromises);
        const followersMap = {};
        results.forEach(result => {
          followersMap[result.userId] = result.followers;
        });
        setPostFollowers(followersMap);
      } catch (error) {
        console.error('Error fetching post followers:', error);
      }
    };

    fetchPostFollowers();
  }, [list]);

  // Update the mappedPosts useMemo to use the state instead of API calls
  const mappedPosts = useMemo(() => {

    return (list || [])
      .filter(item => !hiddenById[item.id])
      .map(item => {
        const followStatus = userFollowStatus[item.userId] || {};
        const isFollowing = followStatus.isFollowing || false;
        const tokenAddress = followStatus.tokenAddress || null;
        const followingImage = followStatus.image || null;

        // Get dynamic followers from API or use default
        const dynamicFollowers = postFollowers[item.userId] || [];
        const finalBoughtBy = dynamicFollowers.length > 0 ? dynamicFollowers : (item.buyers || []);

        return {
          UserId: item.userId,
          id: item.id,
          username: item.userName || 'Unknown User',
          avatar:
            followingImage ||
            item.userImage ||
            'https://cdn-icons-png.flaticon.com/512/149/149071.png',
          media: (item.images || []).map(url => ({ type: 'image', url })),
          caption: item.caption || '***',
          boughtBy: finalBoughtBy,
          follow: isFollowing || item.isFollow || false,
          userTokenAddress: tokenAddress || null,
          profile: item.profile || 'user',
          raiseAmount: item.raiseAmount || 0,
          goalAmount: item.goalAmount || 100000,
          link: item.link || null,
        };
      });
  }, [list, hiddenById, userFollowStatus, postFollowers]);

  // Optimize canDelete calculation
  const canDelete = useMemo(() => {
    if (!modalPostId || !currentUserId) return false;
    const post = mappedPosts.find(x => String(x.id) === String(modalPostId));
    if (!post) return false;
    return String(post.UserId) === String(currentUserId);
  }, [mappedPosts, modalPostId, currentUserId]);

  const dismissThen = useCallback(fn => {
    Keyboard.dismiss();
    requestAnimationFrame(() => fn?.());
  }, []);

  // All useCallback hooks - maintain consistent order
  const handleToggleLike = useCallback(
    async postId => {
      if (!postId) return;
      if (likingIds.has(postId)) return;

      const wasLiked = !!liked[postId];
      const prevCount = postLikesCount[postId] ?? 0;

      setLiked(prev => ({ ...prev, [postId]: !wasLiked }));
      setPostLikesCount(prev => ({
        ...prev,
        [postId]: wasLiked ? Math.max(0, prevCount - 1) : prevCount + 1,
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

          // showToastMessage(
          //   toast,
          //   'success',
          //   res?.data?.message || (serverLiked ? 'Post liked' : 'Post unliked'),
          // );
        } else {
          setLiked(prev => ({ ...prev, [postId]: wasLiked }));
          setPostLikesCount(prev => ({ ...prev, [postId]: prevCount }));
          showToastMessage(
            toast,
            'danger',
            res?.data?.message || 'Failed to toggle like',
          );
        }
      } catch (e) {
        setLiked(prev => ({ ...prev, [postId]: wasLiked }));
        setPostLikesCount(prev => ({ ...prev, [postId]: prevCount }));
        showToastMessage(
          toast,
          'danger',
          e?.response?.data?.message || 'Something went wrong',
        );
      } finally {
        setLikingIds(prev => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      }
    },
    [liked, postLikesCount, likingIds, toast],
  );

  const handleToggleSave = useCallback(
    async postId => {
      if (!postId) return;
      if (savingIds.has(postId)) return;

      setSavingIds(prev => new Set(prev).add(postId));
      const isCurrentlySaved = !!saved[postId];

      let resp;
      try {
        resp = isCurrentlySaved
          ? await unSavePost(postId)
          : await savePost(postId);
        if (resp && resp.statusCode == 200) {
          showToastMessage(toast, 'success', resp.data.message);
          setSaved(prev => ({ ...prev, [postId]: !isCurrentlySaved }));
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
          next.delete(postId);
          return next;
        });
      }
    },
    [saved, savingIds, toast],
  );

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

  const handleCommentCountUpdate = useCallback((postId, newCount) => {
    setPostCommentsCount(prev => ({
      ...prev,
      [postId]: Math.max(0, newCount),
    }));
  }, []);

  const handleComment = useCallback((postId, ownerId) => {
    setCommentPostId(postId);
    setCommentPostOwnerId(ownerId);
    commentSheetRef.current?.open();
  }, []);

  const handleCommentClose = useCallback(() => {
    commentSheetRef.current?.close();
    setCommentPostId(null);
  }, []);

  const openOptionsModal = useCallback(postId => {
    setModalPostId(postId);
    setModalVisible(true);
  }, []);

  const closeOptionsModal = useCallback(() => {
    setModalVisible(false);
    setModalPostId(null);
  }, []);

  const handleToggleFollow = useCallback(
    async (targetUserId, shouldFollow, userTokenAddress) => {
      if (!targetUserId) return;
      const key = String(targetUserId);
      if (followingBusy.has(key)) return;
      setPendingFollowUserId(targetUserId);

      if (shouldFollow) {
        setPendingFollowAction(shouldFollow);
        setTimeout(() => purchaseSheetRef.current?.open?.(), 0);
        return;
      }
      else {
        await fetchToken(targetUserId)
        setTimeout(() => sellSheetRef.current?.open?.(), 0);
      }
    },
    [followingBusy],
  );

  const fetchToken = useCallback(async (targetUserId) => {
    dispatch(showLoader());
    try {
      const response = await getUserTokenInfoByBlockChain(targetUserId);

      if (response?.statusCode === 200 && response?.data) {
        setTokenAddress(response.data.data?.tokenAddress);
      }
    } catch (err) {
      dispatch(hideLoader());
      console.error('Error fetching profile token info:', err);
    }
  }, []);

  const executeFollowAction = async (targetUserId, shouldFollow) => {
    if (!targetUserId) return;
    const key = String(targetUserId);

    setFollowingByUserId(prev => ({ ...prev, [key]: shouldFollow }));
    setFollowingBusy(prev => new Set(prev).add(key));

    try {
      const res = shouldFollow
        ? await follow(targetUserId)
        : await unfollow(targetUserId);

      const ok = res?.statusCode === 200 && (res?.success ?? true);

      if (!ok) {
        setFollowingByUserId(prev => ({ ...prev, [key]: !shouldFollow }));
        showToastMessage(
          toast,
          'danger',
          res?.data?.message || res?.message || 'Unable to update follow',
        );
      } else {
        const serverVal = res?.data?.following;
        if (typeof serverVal === 'boolean') {
          setFollowingByUserId(prev => ({ ...prev, [key]: serverVal }));
        }
        // showToastMessage(
        //   toast,
        //   'success',
        //   shouldFollow ? 'Successfully Vallowed!' : 'Unfollowed',
        // );
      }
    } catch (e) {
      setFollowingByUserId(prev => ({ ...prev, [key]: !shouldFollow }));
      showToastMessage(
        toast,
        'danger',
        e?.response?.data?.message || 'Something went wrong',
      );
    } finally {
      setFollowingBusy(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      onRefresh();
    }
  }

  const handleTokenPurchase = async () => {
    try {
      setIsExecutingPurchase(true);
      purchaseSheetRef.current?.close?.();
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.message || 'Token purchase failed',
      );
    } finally {
      dispatch(hideLoader());
      setPendingFollowUserId(null);
      setPendingFollowAction(null);
      setIsExecutingPurchase(false);
    }
  }

  const handleTokenSell = useCallback(() => {
    sellSheetRef.current?.close();
    showToastMessage(toast, 'success', 'Tokens sold successfully!');
    onRefresh();
  }, []);

  const handleTokenModalClose = () => {
    purchaseSheetRef.current?.close?.();
    setPendingFollowUserId(null);
    setPendingFollowAction(null);
  };

  const handleSellModalClose = () => {
    sellSheetRef.current?.close?.();
  };

  const onOptionsSelect = useCallback(
    async action => {
      if (!modalPostId) return;

      if (action === 'toggleSave') {
        await handleToggleSave(modalPostId);
        closeOptionsModal();
        return;
      }

      if (action === 'deletePost') {
        if (!canDelete) {
          showToastMessage(toast, 'danger', "You can't delete this post.");
          closeOptionsModal();
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
                closeOptionsModal();
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
        closeOptionsModal();
        return;
      }

      closeOptionsModal();
    },
    [
      modalPostId,
      canDelete,
      handleToggleSave,
      closeOptionsModal,
      toast,
      currentUserId,
      dispatch,
      handleToggleHide,
    ],
  );

  useFocusEffect(
    useCallback(() => {
      setList(postData || []);
    }, [postData])
  );

  useEffect(() => {
    (async () => {
      const id = await AsyncStorage.getItem('userId');
      setCurrentUserId(id ? String(id) : null);
    })();
  }, []);

  useEffect(() => {
    if (Array.isArray(list) && list.length) {
      const seededSaved = {};
      const seededLikeCount = {};
      const seededCommentCounts = {};
      const seededLiked = {};
      const seededFollowing = {};
      const seededHidden = {};
      for (const p of list) {
        if (p?.id) {
          seededSaved[p.id] = !!p.isSaved;
          seededLikeCount[p.id] = p.likeCount || 0;
          seededCommentCounts[p.id] = p.commentCount || 0;
          seededLiked[p.id] = !!(p.isLike ?? p.liked);
          seededHidden[p.id] = !!p.isHide;
        }
        if (p?.userId != null && typeof p.isFollow === 'boolean') {
          seededFollowing[String(p.userId)] = p.isFollow;
        }
      }
      setSaved(seededSaved);
      setPostLikesCount(seededLikeCount);
      setPostCommentsCount(seededCommentCounts);
      setLiked(seededLiked);
      setHiddenById(prev => ({ ...prev, ...seededHidden }));
      if (Object.keys(seededFollowing).length) {
        setFollowingByUserId(prev => ({ ...prev, ...seededFollowing }));
      }
    }
  }, [list]);

  useEffect(() => {
    setList(postData || []);
  }, [postData]);

  useEffect(() => {
    (async () => {
      const id = await AsyncStorage.getItem('userId');
      setCurrentUserId(id ? String(id) : null);
    })();
  }, []);

  const normalizeUser = useCallback(
    u => ({
      id: String(u.id),
      username:
        u.userName ||
        u.displayName ||
        (u.email ? u.email.split('@')[0] : 'User'),
      avatar: u.image || u.avatar || null,
      isFollow:
        typeof u.isFollow === 'boolean'
          ? u.isFollow
          : followingByUserId[String(u.id)] ?? false,
    }),
    [followingByUserId],
  );

  const loadSuggestions = useCallback(async (page = 1, isLoadMore = false) => {
    try {
      setIsLoadingSuggestions(true);
      // Request more records than displayed to check if there are more available
      const limit = 15;
      const res = await getSuggestedUsers(limit, page);

      const raw = res?.data?.suggestedUsers ?? res?.suggestedUsers ?? [];
      const me = currentUserId ? String(currentUserId) : null;
      const cleansed = raw
        .filter(u => !me || String(u.id) !== me)
        .map(normalizeUser);

      if (isLoadMore) {
        // Append new users to existing list
        setSuggestAllUsers(prev => {
          const updated = [...prev, ...cleansed];
          return updated;
        });
      } else {
        // Initial load
        setSuggestAllUsers(cleansed);
        setSuggestPage(1);
      }

      // If we got fewer records than requested, there are no more
      // Also check if we got any records at all
      const hasMore = cleansed.length >= limit;
      setSuggestHasMore(hasMore);
    } catch (e) {
      console.error('Error loading suggestions:', e);
      if (!isLoadMore) {
        setSuggestAllUsers([]);
        setSuggestHasMore(false);
      }
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [currentUserId, normalizeUser]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const visibleSuggestions = useMemo(() => {
    const count = suggestPage * SUGGEST_PAGE_SIZE;
    const sliced = suggestAllUsers.slice(0, count);
    return sliced.filter(u => !suggestDismissed.has(String(u.id)));
  }, [suggestAllUsers, suggestPage, suggestDismissed]);

  const handleDismissSuggestion = useCallback(userId => {
    setSuggestDismissed(prev => {
      const next = new Set(prev);
      next.add(String(userId));
      return next;
    });
  }, []);

  const handleSeeMoreSuggestions = useCallback(() => {
    const nextPage = suggestPage + 1;
    setSuggestPage(nextPage);
    const totalVisible = nextPage * SUGGEST_PAGE_SIZE;
    setSuggestHasMore(totalVisible < suggestAllUsers.length);
  }, [suggestPage, suggestAllUsers]);

  const feedItems = useMemo(() => {
    const posts = mappedPosts;
    if (posts.length <= 2 || visibleSuggestions.length === 0) return posts;
    const cloned = [...posts];
    cloned.splice(2, 0, { __type: 'suggestions' });
    return cloned;
  }, [mappedPosts, visibleSuggestions]);

  const renderItem = useCallback(
    ({ item }) => {
      if (item?.__type === 'suggestions') {
        return (
          <Suggestion
            users={visibleSuggestions}
            onToggleFollow={(uid, next) => handleToggleFollow(uid, next)}
            busyIds={followingBusy}
            onDismiss={handleDismissSuggestion}
            onSeeMore={handleSeeMoreSuggestions}
            hasMore={suggestHasMore}
            isBusinessProfile={isBusinessProfile}
            executeFollowAction={executeFollowAction}
          />
        );
      }

      return (
        <PostItem
          item={item}
          likesCount={postLikesCount[item.id] || 0}
          commentsCount={postCommentsCount[item.id] || 0}
          liked={!!liked[item.id]}
          saved={!!saved[item.id]}
          onToggleLike={() => handleToggleLike(item.id)}
          onToggleFollow={handleToggleFollow}
          followingBusy={followingBusy.has(String(item.UserId))}
          onToggleSave={() => handleToggleSave(item.id)}
          onComment={() => handleComment(item.id, item.UserId)}
          onOptions={() => openOptionsModal(item.id)}
          isBusinessProfile={isBusinessProfile}
          executeFollowAction={executeFollowAction}
          raiseAmount={item.raiseAmount}
          goalAmount={item.goalAmount || 100000000}
          link={item.link || null}
        />
      );
    },
    [
      postLikesCount,
      postCommentsCount,
      liked,
      saved,
      handleToggleLike,
      handleToggleSave,
      handleComment,
      openOptionsModal,
      handleToggleFollow,
      followingBusy,
      visibleSuggestions,
      handleDismissSuggestion,
      handleSeeMoreSuggestions,
      suggestHasMore,
    ],
  );

  return (
    <View style={styles.container}>
      {/* Posts List */}
      <FlatList
        data={feedItems}
        keyExtractor={(item, index) =>
          item?.__type === 'suggestions'
            ? `suggestions-${index}`
            : item.id?.toString()
        }
        showsVerticalScrollIndicator={false}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={21}
        initialNumToRender={5}
      />

      {/* Options Modal */}
      <OptionsModal
        visible={modalVisible}
        onClose={closeOptionsModal}
        fromHome={true}
        onSelect={onOptionsSelect}
        postId={modalPostId ?? ''}
        isSaved={!!(modalPostId && saved[modalPostId])}
        canDelete={!!canDelete}
        isHidden={!!(modalPostId && hiddenById[modalPostId])}
        hideBusy={modalPostId ? hidingIds.has(modalPostId) : false}
      />

      {/* Token Purchase Modal */}
      <RBSheet
        ref={purchaseSheetRef}
        height={500}
        openDuration={250}
        draggable={true}
        closeOnPressMask={true}
        customModalProps={{ statusBarTranslucent: true }}
        onOpen={() => setPurchaseAutoFocus(true)}
        onClose={() => {
          Keyboard.dismiss();
          setPurchaseAutoFocus(false);
          setPendingFollowUserId(null);
          setPendingFollowAction(null);
        }}
        customStyles={{
          container: {
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            backgroundColor: '#f8f2fd',
            bottom: -30,
          },
          draggableIcon: {
            backgroundColor: '#ccc',
            width: 60,
          },
        }}
      >
        <TokenPurchaseModal
          onClose={handleTokenModalClose}
          onPurchase={handleTokenPurchase}
          hasFollowing={true}
          autoFocus={purchaseAutoFocus}
          vendorid={pendingFollowUserId}
        />
      </RBSheet>

      {/* Token Sell Modal */}
      <RBSheet
        ref={sellSheetRef}
        height={550}
        openDuration={250}
        draggable={true}
        closeOnPressMask={true}
        customModalProps={{ statusBarTranslucent: true }}
        onOpen={() => setPurchaseAutoFocus(true)}
        onClose={() => {
          Keyboard.dismiss();
          setPurchaseAutoFocus(false);
          setPendingFollowUserId(null);
          setPendingFollowAction(null);
        }}
        customStyles={{
          container: {
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            backgroundColor: '#f8f2fd',
            bottom: -30,
          },
          draggableIcon: {
            backgroundColor: '#ccc',
            width: 60,
          },
        }}
      >
        <TokenSellModal
          onSell={handleTokenSell}
          userId={pendingFollowUserId}
          tokenAddress={tokenAddress}
        />
      </RBSheet>

      {/* Comment Sheet */}
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
    </View>
  );
}

// ---------------- STYLES ----------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f2fd',
  },
  listContent: {
    paddingTop: 0,
    paddingBottom: 0,
  },
});