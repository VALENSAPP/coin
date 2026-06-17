import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { View, Text, FlatList, StyleSheet, Alert, Keyboard, RefreshControl } from 'react-native';
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
  sharePost,
} from '../../../services/post';

import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../../displaytoastmessage';

import AsyncStorage from '@react-native-async-storage/async-storage';
import Clipboard from '@react-native-clipboard/clipboard';
import { hideLoader, showLoader } from '../../../redux/actions/LoaderAction';
import { useDispatch } from 'react-redux';
import { getAllUser } from '../../../services/users';
import TokenPurchaseModal from '../../modals/TokenPurchaseModal';
import { following as apiFollowing, followers as apiFollowers } from '../../../services/profile';
import { useFocusEffect } from '@react-navigation/native';
import TokenSellModal from '../../modals/TokenSellModal';
import { getUserTokenInfoByBlockChain } from '../../../services/tokens';
import { getSuggestedUsers } from '../../../services/home';
import { useAppTheme } from '../../../theme/useApptheme';
import { log } from 'console';
import { extractPostMusicPayloadFromApi, applyClientPostOverlayCache } from '../../../utils/postSoundtracks';
import { useLanguage } from '../../../i18n';

const isTruthyTrustPost = value => value === true || value === 1 || String(value).toLowerCase() === 'true';

const isVideoMediaUrl = (url, postType) => {
  if (String(postType || '').toLowerCase() === 'reel') return true;
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase().split('?')[0];
  return ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp', 'm4v'].some(ext =>
    lower.endsWith(`.${ext}`),
  );
};

const Posts = forwardRef(function Posts(
  { postData = [], onRefresh, isBusinessProfile, refreshing = false },
  ref,
) {
  const { t } = useLanguage();

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
  const [currentlyVisiblePostId, setCurrentlyVisiblePostId] = useState(null);
  const [screenFocused, setScreenFocused] = useState(true);
  const [playingPostId, setPlayingPostId] = useState(null);

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
  const feedListRef = useRef(null);

  const commentSheetRef = useRef();
  const purchaseSheetRef = useRef(null);
  const sellSheetRef = useRef(null);
  const toast = useToast();
  const dispatch = useDispatch();
  const { bgStyle, textStyle } = useAppTheme();

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

  // Track screen focus - pause all videos when screen loses focus
  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => {
        setScreenFocused(false);
      };
    }, [])
  );

  // Fetch following status for each post user
  useEffect(() => {
    const fetchFollowingStatus = async () => {
      if (!list || list.length === 0) return;

      // Extract unique user IDs to avoid duplicate API calls
      const uniqueUserIds = [...new Set(list.map(item => item?.userId).filter(Boolean))];

      if (uniqueUserIds.length === 0) return;

      const followingPromises = uniqueUserIds.map(async (userId) => {
        try {
          const res = await apiFollowing(userId);
          const rows = res?.data?.data ?? res?.data ?? [];

          const followingRow = Array.isArray(rows)
            ? rows.find(r => r?.followingId === userId)
            : null;

          const isFollowing = !!followingRow;
          const tokenAddress = followingRow?.following?.userTokens?.[0]?.tokenAddress ?? null;
          const followingImage = followingRow?.following?.image ?? null;

          return {
            userId,
            isFollowing,
            tokenAddress,
            image: followingImage
          };
        } catch (e) {
          console.log('Error checking follow status for user:', userId, e);
          // Return safe default instead of throwing
          return {
            userId,
            isFollowing: false,
            tokenAddress: null,
            image: null
          };
        }
      });

      try {
        const results = await Promise.allSettled(followingPromises);
        const followingMap = {};

        results.forEach(result => {
          if (result.status === 'fulfilled' && result.value?.userId) {
            followingMap[result.value.userId] = {
              isFollowing: result.value.isFollowing,
              tokenAddress: result.value.tokenAddress,
              image: result.value.image
            };
          }
        });

        setUserFollowStatus(followingMap);
      } catch (error) {
        console.log('Error fetching following statuses:', error);
        setUserFollowStatus({});
      }
    };

    // Debounce to prevent rapid successive calls
    const timer = setTimeout(() => {
      fetchFollowingStatus();
      loadSuggestions();
    }, 300);

    return () => clearTimeout(timer);
  }, [list]);

  // -------- Fetch followers for each post (for "Followed by" section) - optimized --------
  useEffect(() => {
    const fetchPostFollowers = async () => {
      if (!list || list.length === 0) return;

      // Extract unique user IDs
      const uniqueUserIds = [...new Set(list.map(item => item?.userId).filter(Boolean))];

      if (uniqueUserIds.length === 0) return;

      const followersPromises = uniqueUserIds.map(async (userId) => {
        try {
          const res = await apiFollowers(userId);
          let followersData = res?.data?.data || res?.data || [];

          if (!Array.isArray(followersData)) {
            console.warn('Non-array followers data:', followersData);
            return { userId, followers: [] };
          }

          const transformedFollowers = followersData
            .filter(f => f?.status === 'ACCEPTED' && f?.follower)
            .map(f => {
              const follower = f.follower;
              return {
                id: follower?.id || f.followerId,
                username: follower?.userName || follower?.displayName ||
                  (follower?.email ? follower.email.split('@')[0] : t('posts.user')),
                avatar: follower?.image || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
              };
            });

          return {
            userId,
            followers: transformedFollowers
          };
        } catch (e) {
          console.error('Error fetching followers for user:', userId, e);
          return { userId, followers: [] };
        }
      });

      try {
        const results = await Promise.allSettled(followersPromises);
        const followersMap = {};

        results.forEach(result => {
          if (result.status === 'fulfilled' && result.value?.userId) {
            followersMap[result.value.userId] = result.value.followers;
          }
        });

        setPostFollowers(followersMap);
      } catch (error) {
        console.error('Error fetching post followers:', error);
        setPostFollowers({});
      }
    };

    // Debounce to prevent rapid successive calls
    const timer = setTimeout(fetchPostFollowers, 300);
    return () => clearTimeout(timer);
  }, [list]);

  // Update the mappedPosts useMemo to use the state instead of API calls
  const mappedPosts = useMemo(() => {
    return (list || [])
      .filter(item => !hiddenById[item.id])
      .map(rawItem => {
        const item = applyClientPostOverlayCache(rawItem);
        const userIdKey = String(item.userId);
        const followStatus = userFollowStatus[item.userId] || {};
        const hasLocalFollowState = Object.prototype.hasOwnProperty.call(
          followingByUserId,
          userIdKey,
        );
        const isFollowing = hasLocalFollowState
          ? !!followingByUserId[userIdKey]
          : (followStatus.isFollowing || item.isFollow || false);
        const tokenAddress = followStatus.tokenAddress || null;
        const followingImage = followStatus.image || null;

        // Get dynamic followers from API or use default
        const dynamicFollowers = postFollowers[item.userId] || [];
        const finalBoughtBy = dynamicFollowers.length > 0 ? dynamicFollowers : (item.buyers || []);

        return {
          UserId: item.userId,
          id: item.id,
          username: item.userName || t('posts.unknownUser'),
          avatar:
            followingImage ||
            item.userImage ||
            'https://cdn-icons-png.flaticon.com/512/149/149071.png',
          media: (item.images || []).map((url, index) => ({
            type: isVideoMediaUrl(url, item.type) ? 'video' : 'image',
            url,
            thumbnail:
              item.thumbnails?.[index] ??
              item.thumbnails?.[0] ??
              null,
          })),
          caption: item.caption || '***',
          boughtBy: finalBoughtBy,
          follow: isFollowing,
          userTokenAddress: tokenAddress || null,
          profile: item.profile || 'user',
          raiseAmount: item.raiseAmount || 0,
          link: item.link || null,
          start_time: item.start_time || null,
          end_time: item.end_time || null,
          tokenBalance: item.tokenBalance || 0,
          shareCount: item.shareCount || 0,
          isTrustPost: isTruthyTrustPost(item.isTrustPost),
          taggedPeople: Array.isArray(item.taggedPeople) ? item.taggedPeople : [],
          ...extractPostMusicPayloadFromApi(item),
        };
      });
  }, [list, hiddenById, userFollowStatus, postFollowers, followingByUserId, t]);

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
        } else {
          setLiked(prev => ({ ...prev, [postId]: wasLiked }));
          setPostLikesCount(prev => ({ ...prev, [postId]: prevCount }));
          showToastMessage(
            toast,
            'danger',
            res?.data?.message || t('posts.failedToToggleLike'),
          );
        }
      } catch (e) {
        setLiked(prev => ({ ...prev, [postId]: wasLiked }));
        setPostLikesCount(prev => ({ ...prev, [postId]: prevCount }));
        showToastMessage(
          toast,
          'danger',
          e?.response?.data?.message || t('posts.somethingWentWrong'),
        );
      } finally {
        setLikingIds(prev => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      }
    },
    [liked, postLikesCount, likingIds, toast, t],
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
          err?.response?.message ?? t('posts.somethingWentWrong'),
        );
      } finally {
        setSavingIds(prev => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      }
    },
    [saved, savingIds, toast, t],
  );

  const handleToggleHide = useCallback(
    async postId => {
      if (!postId) return;
      if (hidingIds.has(postId)) return;

      const isHidden = !!hiddenById[postId];
      setHiddenById(prev => ({ ...prev, [postId]: !isHidden }));
      setHidingIds(prev => new Set(prev).add(postId));

      try {
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
            t(isHidden ? 'optionsModal.errorUnhideFailed' : 'optionsModal.errorHideFailed'),
          );
          console.log(resp, 'hide the post in homese');
        } else {
          showToastMessage(
            toast,
            'success',
            resp?.data?.message || t(isHidden ? 'optionsModal.successUnhidden' : 'optionsModal.successHidden'),
          );
        }
      } catch (e) {
        setHiddenById(prev => ({ ...prev, [postId]: isHidden }));
        showToastMessage(
          toast,
          'danger',
          e?.response?.data?.message || t('posts.somethingWentWrong'),
        );
      } finally {
        setHidingIds(prev => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      }
    },
    [hiddenById, hidingIds, toast, dispatch, t],
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
      } else {
        await fetchToken(targetUserId);
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
    setUserFollowStatus(prev => ({
      ...prev,
      [targetUserId]: {
        ...(prev[targetUserId] || {}),
        isFollowing: shouldFollow,
      },
    }));
    setFollowingBusy(prev => new Set(prev).add(key));

    try {
      const res = shouldFollow
        ? await follow(targetUserId)
        : await unfollow(targetUserId);

      const ok = res?.statusCode === 200 && (res?.success ?? true);

      if (!ok) {
        setFollowingByUserId(prev => ({ ...prev, [key]: !shouldFollow }));
        setUserFollowStatus(prev => ({
          ...prev,
          [targetUserId]: {
            ...(prev[targetUserId] || {}),
            isFollowing: !shouldFollow,
          },
        }));
        showToastMessage(
          toast,
          'danger',
          res?.data?.message || res?.message || t('posts.ableToUpdateFollow'),
        );
        return false;
      } else {
        const serverVal = res?.data?.following;
        const resolvedFollowing = typeof serverVal === 'boolean' ? serverVal : shouldFollow;
        setFollowingByUserId(prev => ({ ...prev, [key]: resolvedFollowing }));
        setUserFollowStatus(prev => ({
          ...prev,
          [targetUserId]: {
            ...(prev[targetUserId] || {}),
            isFollowing: resolvedFollowing,
          },
        }));
        return true;
      }
    } catch (e) {
      setFollowingByUserId(prev => ({ ...prev, [key]: !shouldFollow }));
      setUserFollowStatus(prev => ({
        ...prev,
        [targetUserId]: {
          ...(prev[targetUserId] || {}),
          isFollowing: !shouldFollow,
        },
      }));
      showToastMessage(
        toast,
        'danger',
        e?.response?.data?.message || t('posts.somethingWentWrong'),
      );
      return false;
    } finally {
      setFollowingBusy(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleTokenPurchase = async () => {
    try {
      setIsExecutingPurchase(true);
      purchaseSheetRef.current?.close?.();
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.message || t('posts.tokenPurchaseFailed'),
      );
    } finally {
      dispatch(hideLoader());
      setPendingFollowUserId(null);
      setPendingFollowAction(null);
      setIsExecutingPurchase(false);
    }
  };

  const handleTokenSell = useCallback(() => {
    sellSheetRef.current?.close();
    showToastMessage(toast, 'success', t('posts.tokensSoldSuccess'));
    onRefresh();
  }, [t]);

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

      if (action === 'copyAddress') {
        if (!modalPostId) {
          showToastMessage(toast, 'danger', t('posts.postIdNotFound'));
          closeOptionsModal();
          return;
        }

        const post = mappedPosts.find(p => String(p.id) === String(modalPostId));
        const deepLink = `https://api.valens.app/postshare/${encodeURIComponent(String(modalPostId))}`;

        const parsedGoal = Number(post?.raiseAmount);
        const isMissionPost = Number.isFinite(parsedGoal) && parsedGoal > 0;

        let copyText;
        if (isMissionPost) {
          const username = post?.userName ?? post?.username ?? '';
          copyText = t('postView.copyMissionText', { username, link: deepLink });
        } else {
          copyText = t('postView.copyPostText', { link: deepLink });
        }

        Clipboard.setString(copyText);
        showToastMessage(toast, 'success', t('posts.postCopied'));
        closeOptionsModal();
        return;
      }

      if (action === 'deletePost') {
        if (!canDelete) {
          showToastMessage(toast, 'danger', t('posts.cannotDeletePost'));
          closeOptionsModal();
          return;
        }

        Alert.alert(
          t('posts.deletePostTitle'),
          t('posts.deletePostMessage'),
          [
            { text: t('posts.deletePostCancel'), style: 'cancel' },
            {
              text: t('posts.deletePostConfirm'),
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
                        t('posts.noUserIdFound'),
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
                      res?.data?.message || t('posts.deletePostSuccess'),
                    );
                  } else {
                    showToastMessage(
                      toast,
                      'danger',
                      res?.data?.message || res?.message || t('posts.deletePostFailed'),
                    );
                  }
                } catch (err) {
                  showToastMessage(
                    toast,
                    'danger',
                    err?.response?.data?.message ||
                    err?.message ||
                    t('posts.errorDeletingPost'),
                  );
                } finally {
                  dispatch(hideLoader());
                }
              },
            },
          ],
        );

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
      mappedPosts,
      handleToggleSave,
      closeOptionsModal,
      toast,
      currentUserId,
      dispatch,
      handleToggleHide,
      t,
    ],
  );

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
      try {
        const id = await AsyncStorage.getItem('userId');
        setCurrentUserId(id ? String(id) : null);
      } catch (error) {
        console.error('Error fetching userId:', error);
        setCurrentUserId(null);
      }
    })();
  }, []);

  const normalizeUser = useCallback(
    u => {
      if (!u) return null;
      return {
        id: String(u.id),
        username:
          u.userName ||
          u.displayName ||
          (u.email ? u.email.split('@')[0] : t('posts.user')),
        avatar: u.image || u.avatar || null,
        isFollow: typeof u.isFollow === 'boolean' ? u.isFollow : false,
        profile: u.profile,
      };
    },
    [t],
  );

  const loadSuggestions = useCallback(async (page = 1, isLoadMore = false) => {
    // Prevent duplicate calls
    if (isLoadingSuggestions) return;

    try {
      setIsLoadingSuggestions(true);
      const limit = 15;
      const res = await getSuggestedUsers(limit, page);

      const raw = res?.data?.suggestedUsers ?? res?.suggestedUsers ?? [];

      if (!Array.isArray(raw)) {
        console.warn('Suggestions not an array:', raw);
        if (!isLoadMore) {
          setSuggestAllUsers([]);
          setSuggestHasMore(false);
        }
        return;
      }

      const me = currentUserId ? String(currentUserId) : null;
      const cleansed = raw
        .filter(u => u && (!me || String(u.id) !== me))
        .map(normalizeUser)
        .filter(Boolean);

      if (isLoadMore) {
        setSuggestAllUsers(prev => [...prev, ...cleansed]);
      } else {
        setSuggestAllUsers(cleansed);
        setSuggestPage(1);
      }

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
  }, [currentUserId, normalizeUser, isLoadingSuggestions]);

  useEffect(() => {
    loadSuggestions(1, false);
  }, []);

  const visibleSuggestions = useMemo(() => {
    const count = suggestPage * SUGGEST_PAGE_SIZE;
    const sliced = suggestAllUsers.slice(0, count);
    return sliced
      .filter(u => !suggestDismissed.has(String(u.id)))
      .map(u => {
        const key = String(u.id);
        if (typeof followingByUserId[key] === 'boolean') {
          return { ...u, isFollow: followingByUserId[key] };
        }
        return u;
      });
  }, [suggestAllUsers, suggestPage, suggestDismissed, followingByUserId]);

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

  // Require most of the row to be on-screen; ignore tiny / jitter scrolls.
  const MIN_VISIBLE_PERCENT_TO_FOCUS = 50;
  const viewabilityDebounceRef = useRef(null);

  const handleViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewabilityDebounceRef.current) {
      clearTimeout(viewabilityDebounceRef.current);
    }

    viewabilityDebounceRef.current = setTimeout(() => {
      if (!viewableItems || viewableItems.length === 0) {
        setCurrentlyVisiblePostId(null);
        setPlayingPostId(null);
        return;
      }

      const candidates = [];
      for (const v of viewableItems) {
        if (v.item?.__type === 'suggestions') continue;
        if (!v.isViewable || v.item?.id == null) continue;
        const pct =
          typeof v.percentVisible === 'number'
            ? v.percentVisible
            : typeof v.viewablePercent === 'number'
              ? v.viewablePercent
              : 100;
        if (pct < MIN_VISIBLE_PERCENT_TO_FOCUS) continue;
        candidates.push({
          id: v.item.id,
          pct,
        });
      }

      if (candidates.length === 0) {
        setCurrentlyVisiblePostId(null);
        setPlayingPostId(null);
        return;
      }

      const mostVisiblePost = candidates.reduce((a, b) => (a.pct >= b.pct ? a : b)).id;

      setCurrentlyVisiblePostId(prev =>
        String(prev) === String(mostVisiblePost) ? prev : mostVisiblePost,
      );
      setPlayingPostId(prev =>
        String(prev) === String(mostVisiblePost) ? prev : mostVisiblePost,
      );
    }, 120);
  }, []);

  useEffect(() => {
    return () => {
      if (viewabilityDebounceRef.current) {
        clearTimeout(viewabilityDebounceRef.current);
      }
    };
  }, []);

  const feedItems = useMemo(() => {
    const posts = mappedPosts;
    if (posts.length <= 2 || visibleSuggestions.length === 0) return posts;
    const cloned = [...posts];
    cloned.splice(2, 0, { __type: 'suggestions' });
    return cloned;
  }, [mappedPosts, visibleSuggestions]);

  const renderItem = useCallback(
    ({ item }) => {
      // Add safety check
      if (!item) return null;

      if (item.__type === 'suggestions') {
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

      // Add safety check for item.id
      if (!item.id) {
        console.warn('Post item missing id:', item);
        return null;
      }

      const isPostVisible = String(item.id) === String(currentlyVisiblePostId);

      return (
        <PostItem
          item={item}
          likesCount={postLikesCount[item.id] || 0}
          commentsCount={postCommentsCount[item.id] || 0}
          liked={!!liked[item.id]}
          saved={!!saved[item.id]}
          onToggleLike={handleToggleLike}
          onToggleFollow={handleToggleFollow}
          followingBusy={followingBusy.has(String(item.UserId))}
          onToggleSave={handleToggleSave}
          onComment={handleComment}
          onOptions={openOptionsModal}
          isBusinessProfile={isBusinessProfile}
          executeFollowAction={executeFollowAction}
          raiseAmount={item.raiseAmount}
          goalAmount={item.goalAmount || 100000000}
          link={item.link || null}
          isVisible={isPostVisible}
          screenFocused={screenFocused}
          playingPostId={playingPostId}
          shareCount={item.shareCount}
          isTrustPost={item.isTrustPost}
          taggedPeople={item.taggedPeople}
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
      screenFocused,
      followingBusy,
      visibleSuggestions,
      handleDismissSuggestion,
      handleSeeMoreSuggestions,
      suggestHasMore,
      currentlyVisiblePostId,
      playingPostId,
    ],
  );

  const listKeyExtractor = useCallback(
    (item, index) =>
      item?.__type === 'suggestions' ? `suggestions-${index}` : item.id?.toString(),
    []
  );

  const viewabilityConfigRef = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 200,
    waitForInteraction: false,
  });

  const handleViewableItemsChangedRef = useRef(handleViewableItemsChanged);
  useEffect(() => {
    handleViewableItemsChangedRef.current = handleViewableItemsChanged;
  }, [handleViewableItemsChanged]);

  const viewabilityConfigCallbackPairs = useRef([
    {
      viewabilityConfig: viewabilityConfigRef.current,
      onViewableItemsChanged: (info) => handleViewableItemsChangedRef.current(info),
    },
  ]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToTop: () => {
        feedListRef.current?.scrollToOffset?.({ offset: 0, animated: true });
      },
    }),
    [],
  );

  useEffect(() => {
    if (!mappedPosts.length) return;
    if (currentlyVisiblePostId != null) return;
    const firstId = mappedPosts[0]?.id;
    if (!firstId) return;
    setCurrentlyVisiblePostId(firstId);
    setPlayingPostId(firstId);
  }, [mappedPosts, currentlyVisiblePostId]);

  const safeRender = () => {
    try {
      return (
        <View style={[styles.container, bgStyle]}>
          {/* Posts List */}
          <FlatList
            ref={feedListRef}
            data={feedItems}
            keyExtractor={listKeyExtractor}
            showsVerticalScrollIndicator={false}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              onRefresh
                ? (
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={['#783eb9a9']}
                  />
                )
                : undefined
            }
            removeClippedSubviews={false}
            maxToRenderPerBatch={4}
            windowSize={9}
            initialNumToRender={3}
            updateCellsBatchingPeriod={100}
            viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
            scrollEventThrottle={16}
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
            onHiddenChange={(id, nextHidden) => {
              setHiddenById(prev => ({ ...prev, [id]: nextHidden }));
            }}
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
              container: [{
                borderTopLeftRadius: 30,
                borderTopRightRadius: 30,
                bottom: -30,
              }, bgStyle],
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
              container: [{
                borderTopLeftRadius: 30,
                borderTopRightRadius: 30,
                bottom: -30,
              }, bgStyle],
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
              container: [{
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
                bottom: -20,
              }, bgStyle],
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
    } catch (error) {
      console.error('Render error in Posts:', error);
      return (
        <View style={styles.container}>
          <Text>{t('posts.errorLoadingPosts')}</Text>
        </View>
      );
    }
  };

  return safeRender();
});

// ---------------- STYLES ----------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: 0,
    paddingBottom: 0,
  },
});

export default Posts;
