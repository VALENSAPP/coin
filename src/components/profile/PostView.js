import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  StackActions,
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import RBSheet from 'react-native-raw-bottom-sheet';
import PostItem from '../home/posts/PostItem';
import CommentSheet from '../home/posts/CommentSheet';
import OptionsModal from '../home/posts/OptionsModal';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  savePost,
  unSavePost,
  likePost,
  follow,
  unfollow,
  deletePost,
} from '../../services/post';
import { BASE_URL } from '../../config/urls';
import {
  HidePost as apiHidePost,
  unHidePost as apiUnhidePost,
  getPostById,
  pinPost,
  unpinPost,
} from '../../services/post';
import { showToastMessage } from '../displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { useAppTheme } from '../../theme/useApptheme';
import { getTotalDonationAmount } from '../../services/tokens';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  extractPostMusicPayloadFromApi,
  applyClientPostOverlayCache,
} from '../../utils/postSoundtracks';
import { useLanguage } from '../../i18n';
import { isPostPinned, setPostPinnedState } from '../../utils/postPinning';
import useScreenshotProtection, {
  shouldProtectScreenshot,
  SCREENSHOT_PROTECTED_SOURCES,
} from '../../hooks/useScreenshotProtection';
import { navigateToUserProfile } from '../../utils/navigateToUserProfile';
import { isPostVideoUrl } from '../../utils/postMediaFormat';

import {
  extractPostFromByIdResponse,
  mergeTrustPostFields,
  resolveIsTrustPost,
  resolveTrustPostFromSources,
  withTrustPostFields,
} from '../../utils/trustPost';

export default function PostView({ postData = [], userData = {} }) {
  // ─── All hooks at the very top ───────────────────────────────
  const route = useRoute();
  const navigation = useNavigation();
  const { t } = useLanguage();

  // Extract params including the source screen info
  const routeParams = route.params || {};
  const { startIndex, userChat, userData: routeUserData, openCommentsOnMount } = routeParams;
  const routeLoggedInUserId = routeParams.loggedInUserId; // ← add this

  const navPostData = routeParams.postData;
  const returnTo = route?.params?.returnTo;

  const normalizePosts = useCallback((candidate, fallback = []) => {
    let raw = [];
    if (Array.isArray(candidate) && candidate.length) raw = candidate;
    else if (candidate && typeof candidate === 'object') raw = [candidate];
    else if (Array.isArray(fallback) && fallback.length) raw = fallback;

    const routeTrustHint = resolveTrustPostFromSources(routeParams)
      ? { isTrustPost: true, communityTrustPost: true }
      : {};

    return raw.map(post =>
      mergeTrustPostFields(
        routeTrustHint,
        applyClientPostOverlayCache(withTrustPostFields(post)),
      ),
    );
  }, [routeParams?.isTrustPost, routeParams?.communityTrustPost]);

  const [posts, setPosts] = useState(() => normalizePosts(navPostData, postData));

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
  const [currentlyVisiblePostId, setCurrentlyVisiblePostId] = useState(null);
  const [screenFocused, setScreenFocused] = useState(true);
  const [playingPostId, setPlayingPostId] = useState(null);
  // follow state
  const [followingByUserId, setFollowingByUserId] = useState({});
  const [followingBusy, setFollowingBusy] = useState(new Set());
  const [donationTotalsByPostId, setDonationTotalsByPostId] = useState({});

  const toast = useToast();
  const dispatch = useDispatch();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const commentSheetRef = useRef();
  const flatListRef = useRef();
  const playingDebounceRef = useRef(null);
  const pinningPostIdRef = useRef('');
  const pendingInitialScrollRef = useRef(false);
  const didAutoOpenCommentsRef = useRef(false);
  const [listViewportHeight, setListViewportHeight] = useState(0);
  const { bgStyle, text, border } = useAppTheme();
  const [isReady, setIsReady] = useState(false);

  const paramsKey = routeParams?.key;
  useEffect(() => {
    if (!paramsKey) {
      setIsReady(true);
      return;
    }
    setIsReady(false);
    const nextPosts = normalizePosts(navPostData, postData);
    setPosts(nextPosts);
    setList(nextPosts);
    setLiked({});
    setSaved({});
    setPostLikesCount({});
    setPostCommentsCount({});
    setHiddenById({});
    setFollowingByUserId({});
    setCurrentlyVisiblePostId(null);
    setPlayingPostId(null);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsReady(true);
      });
    });
  }, [paramsKey]);

  useEffect(() => {
    (async () => {
      const id = await AsyncStorage.getItem('userId');
      const resolved = id ? String(id) : null;
      setCurrentUserId(routeLoggedInUserId ? String(routeLoggedInUserId) : resolved);
    })();
  }, [routeLoggedInUserId]);
  useEffect(() => {
    const nextPosts = normalizePosts(navPostData, postData);
    setPosts(prev => {
      if (prev.length === nextPosts.length) {
        let same = true;
        for (let i = 0; i < prev.length; i += 1) {
          if (String(prev[i]?.id ?? '') !== String(nextPosts[i]?.id ?? '')) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      return nextPosts;
    });
  }, [navPostData, postData, normalizePosts]);

  useEffect(() => {
    (async () => {
      const id = await AsyncStorage.getItem('userId');
      setCurrentUserId(id ? String(id) : null);
    })();
  }, []);

  // ─── Hydrate post from API (chat, shared trust posts, etc.) ─
  useEffect(() => {
    const sourcePost = normalizePosts(navPostData, postData)[0];
    const postId = sourcePost?.id;
    if (!postId) return undefined;

    let cancelled = false;

    const hydratePostFromApi = async () => {
      try {
        const response = await getPostById(String(postId));
        const fetched = extractPostFromByIdResponse(response);
        if (!fetched || cancelled) return;

        const trustFromRoute = resolveTrustPostFromSources(routeParams, sourcePost);
        const merged = mergeTrustPostFields(
          mergeTrustPostFields(sourcePost, {
            isTrustPost: trustFromRoute,
            communityTrustPost: trustFromRoute,
          }),
          fetched,
        );

        setList(prev =>
          prev.map(post => (String(post.id) === String(postId) ? merged : post)),
        );
        setPosts(prev =>
          prev.map(post => (String(post.id) === String(postId) ? merged : post)),
        );

        setSaved(prev => ({ ...prev, [merged.id]: !!merged.isSaved }));
        setLiked(prev => ({ ...prev, [merged.id]: !!merged.isLike }));
        setPostLikesCount(prev => ({ ...prev, [merged.id]: merged.likeCount ?? 0 }));
        setPostCommentsCount(prev => ({ ...prev, [merged.id]: merged.commentCount ?? 0 }));
        setHiddenById(prev => ({ ...prev, [merged.id]: !!merged.isHide }));

        if (merged.userId != null && typeof merged.isFollow === 'boolean') {
          setFollowingByUserId(prev => ({ ...prev, [String(merged.userId)]: merged.isFollow }));
        }
      } catch (error) {
        console.error('Error hydrating post in PostView:', error);
        if (userChat) {
          showToastMessage(
            toast,
            'danger',
            error?.response?.data?.message || t('postView.failedLoadPostGeneric'),
          );
        }
      }
    };

    hydratePostFromApi();
    return () => { cancelled = true; };
  }, [paramsKey, navPostData, postData, normalizePosts, routeParams?.isTrustPost, routeParams?.communityTrustPost, userChat, toast, t]);

  // ─── Refetch post data ──────────────────────────────────────
  const refetchPostData = useCallback(async (postId) => {
    if (!postId || !userChat) return;

    try {
      const response = await getPostById(postId);

      const freshPost = extractPostFromByIdResponse(response);

      if (freshPost && freshPost.id) {
        setList(prev => prev.map(p =>
          String(p.id) === String(postId)
            ? mergeTrustPostFields(p, freshPost)
            : p,
        ));
        setPosts(prev => prev.map(p =>
          String(p.id) === String(postId)
            ? mergeTrustPostFields(p, freshPost)
            : p,
        ));

        setSaved(prev => ({ ...prev, [freshPost.id]: !!freshPost.isSaved }));
        setLiked(prev => ({ ...prev, [freshPost.id]: !!freshPost.isLike }));
        setPostLikesCount(prev => ({ ...prev, [freshPost.id]: freshPost.likeCount ?? 0 }));
        setPostCommentsCount(prev => ({ ...prev, [freshPost.id]: freshPost.commentCount ?? 0 }));
        setHiddenById(prev => ({ ...prev, [freshPost.id]: !!freshPost.isHide }));

        if (freshPost.userId != null && typeof freshPost.isFollow === 'boolean') {
          setFollowingByUserId(prev => ({ ...prev, [String(freshPost.userId)]: freshPost.isFollow }));
        }
      }
    } catch (error) {
      console.error('Error refetching post:', error);
    }
  }, [userChat]);

  // ─── Handle Back Button Press ────────────────────────────────
  const handleBackPress = useCallback(() => {
    const backTarget = route.params?.returnTo;
    const returnParams = route.params?.returnParams;
    const fromScreen = route.params?.fromScreen;
    const userId = route.params?.userId;

    if (backTarget) {
      if (returnParams?.screen) {
        navigation.navigate(backTarget, returnParams);
      } else {
        navigation.navigate(backTarget, returnParams);
      }
      return;
    }

    if (fromScreen === 'Notifications') {
      navigation.dispatch(StackActions.pop(1));
      navigation.getParent()?.navigate('HomeMain', {
        screen: 'HeartNotification',
      });
      return;
    }

    if (fromScreen === 'UserChat') {
      navigation.dispatch(StackActions.pop(1));
      navigation.getParent()?.navigate('HomeMain', {
        screen: 'UserChat',
        params: {
          userId: userId,
        },
      });
      return;
    }

    // Prefer the native stack: this preserves the original entry route
    // (Explore/Search/UserProfile/etc) instead of forcing a Home redirect.

    // Fallbacks when PostView is opened as a root (rare).
    if (routeUserData) {
      const targetUserId = String(routeUserData?.id ?? routeUserData?.userId ?? '');
      if (targetUserId) {
        void navigateToUserProfile(navigation, targetUserId, {
          loggedInUserId: currentUserId,
        });
      }
      return;
    }

    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('HomeMain');
  }, [navigation, currentUserId, route.params, routeUserData]);

  const getMediaType = url => (isPostVideoUrl(url) ? 'video' : 'image');

  const formatUrl = (url) => {
    if (!url || typeof url !== 'string') return url;
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) return trimmed;
    if (trimmed.startsWith('/')) return `http://35.174.167.92:3002${trimmed}`;
    return `http://35.174.167.92:3002/${trimmed}`;
  };

  // ─── Seed maps from posts ──────────────────────────────────
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

  useEffect(() => {
    setList(posts || []);
  }, [posts]);

  const visiblePosts = useMemo(
    () => list.filter(item => !hiddenById[item.id]),
    [list, hiddenById],
  );

  const isOnlyVisiblePost = useCallback(
    postId => {
      if (!postId || visiblePosts.length !== 1) return false;
      return String(visiblePosts[0]?.id) === String(postId);
    },
    [visiblePosts],
  );

  const shouldProtectPrivateContent = useMemo(
    () =>
      shouldProtectScreenshot({
        posts: visiblePosts,
        routeParams,
        currentUserId,
        contentUserId: routeUserData?.id ?? routeUserData?.userId ?? userData?.id,
      }),
    [visiblePosts, routeParams, currentUserId, routeUserData, userData?.id],
  );

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => {
        setScreenFocused(false);
        setPlayingPostId(null);
      };
    }, [])
  );

  useScreenshotProtection({
    enabled: shouldProtectPrivateContent,
    title: t('postView.screenshotWarningTitle'),
    message: t('postView.screenshotWarningMessage'),
  });

  // ─── Fetch latest raised amount for mission posts ──────────
  useEffect(() => {
    let isActive = true;

    const fetchDonationTotals = async () => {
      const sourcePosts = Array.isArray(posts) ? posts : [];
      const missionPostIds = [
        ...new Set(
          sourcePosts
            .filter(post =>
              post?.id &&
              (
                post?.isMission === true ||
                post?.type === 'crowdfunding' ||
                Number(post?.raiseAmount) > 0
              ),
            )
            .map(post => String(post.id)),
        ),
      ];

      if (missionPostIds.length === 0) {
        if (isActive) setDonationTotalsByPostId({});
        return;
      }

      const responses = await Promise.allSettled(
        missionPostIds.map(postId => getTotalDonationAmount({ postId })),
      );

      if (!isActive) return;

      const nextTotals = {};
      responses.forEach((res, idx) => {
        if (res.status === 'fulfilled' && res.value?.statusCode === 200) {
          const postId = missionPostIds[idx];
          nextTotals[postId] = Number(res.value?.data?.totalDonation) || 0;
        }
      });

      setDonationTotalsByPostId(nextTotals);
    };

    fetchDonationTotals();

    return () => {
      isActive = false;
    };
  }, [posts]);

  // ─── Auto-scroll to startIndex ──────────────────────────────
  const startPostId = useMemo(() => {
    if (
      startIndex !== undefined &&
      startIndex >= 0 &&
      startIndex < posts.length
    ) {
      return String(posts[startIndex]?.id ?? '');
    }
    return '';
  }, [startIndex, posts]);

  const resolvedInitialIndex = useMemo(() => {
    if (!visiblePosts.length) return -1;
    if (startPostId) {
      const visibleIndex = visiblePosts.findIndex(
        post => String(post?.id ?? '') === startPostId,
      );
      if (visibleIndex >= 0) return visibleIndex;
    }
    if (
      startIndex !== undefined &&
      startIndex >= 0 &&
      startIndex < visiblePosts.length
    ) {
      return startIndex;
    }
    return 0;
  }, [startIndex, startPostId, visiblePosts]);

  const scrollToStartIndex = useCallback(
    (animated = false) => {
      if (!flatListRef.current || resolvedInitialIndex < 0 || visiblePosts.length === 0) {
        return;
      }
      flatListRef.current?.scrollToIndex({
        index: resolvedInitialIndex,
        animated,
        viewPosition: 0,
      });
    },
    [resolvedInitialIndex, visiblePosts.length],
  );

  useEffect(() => {
    if (resolvedInitialIndex >= 0 && visiblePosts.length > 0) {
      pendingInitialScrollRef.current = true;
      const timer = setTimeout(() => {
        scrollToStartIndex(false);
      }, 0);
      return () => clearTimeout(timer);
    }
    pendingInitialScrollRef.current = false;
  }, [resolvedInitialIndex, scrollToStartIndex, visiblePosts.length]);

  const onScrollToIndexFailed = useCallback(info => {
    if (!flatListRef.current || visiblePosts.length === 0) {
      pendingInitialScrollRef.current = false;
      return;
    }
    const safeIndex = Math.max(0, Math.min(info.index, visiblePosts.length - 1));
    const wait = new Promise(resolve => setTimeout(resolve, 500));
    wait.then(() => {
      flatListRef.current?.scrollToIndex({
        index: safeIndex,
        animated: true,
        viewPosition: 0,
      });
    });
  }, [visiblePosts.length]);

  const handleContentSizeChange = useCallback(() => {
    if (pendingInitialScrollRef.current && visiblePosts.length > 0) {
      scrollToStartIndex(false);
    }
  }, [scrollToStartIndex, visiblePosts.length]);

  const handleScrollBeginDrag = useCallback(() => {
    pendingInitialScrollRef.current = false;
  }, []);

  // ─── Like ───────────────────────────────────────────────────
  const toggleLike = useCallback(async (postId) => {
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
        if (userChat) {
          await refetchPostData(postId);
        } else {
          const serverLiked = !!res?.data?.liked;
          const serverCount = res?.data?.likesCount ?? res?.data?.totalLikes;

          setLiked(prev => ({ ...prev, [postId]: serverLiked }));
          if (serverCount !== undefined) {
            setPostLikesCount(prev => ({ ...prev, [postId]: serverCount }));
          }
        }
      } else {
        setLiked(prev => ({ ...prev, [postId]: wasLiked }));
        setPostLikesCount(prev => ({ ...prev, [postId]: prevCount }));
        showToastMessage(toast, 'danger', res?.data?.message || t('postView.failedToggleLike'));
      }
    } catch (e) {
      setLiked(prev => ({ ...prev, [postId]: wasLiked }));
      setPostLikesCount(prev => ({ ...prev, [postId]: prevCount }));
      showToastMessage(toast, 'danger', e?.response?.data?.message || t('postView.somethingWentWrong'));
    } finally {
      setLikingIds(prev => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  }, [liked, likingIds, postLikesCount, refetchPostData, toast, userChat, t]);

  // ─── Save / Unsave ──────────────────────────────────────────
  const handleToggleSave = useCallback(async id => {
    if (!id) return;
    if (savingIds.has(id)) return;

    setSavingIds(prev => new Set(prev).add(id));
    const isCurrentlySaved = !!saved[id];

    try {
      const resp = isCurrentlySaved ? await unSavePost(id) : await savePost(id);
      if (resp && resp.statusCode === 200) {
        showToastMessage(toast, 'success', resp.data.message);

        if (userChat) {
          await refetchPostData(id);
        } else {
          setSaved(prev => ({ ...prev, [id]: !isCurrentlySaved }));
        }
      } else {
        showToastMessage(toast, 'danger', resp.data.message);
      }
    } catch (err) {
      showToastMessage(
        toast,
        'danger',
        err?.response?.message ?? t('postView.somethingWentWrong'),
      );
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [refetchPostData, saved, savingIds, toast, userChat, t]);

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
        console.log(ok, resp, 'ok respose in this ');
        if (!ok) {
          setHiddenById(prev => ({ ...prev, [postId]: isHidden }));
          showToastMessage(
            toast,
            'danger',
            resp?.data?.message ||
            resp?.message ||
            t(isHidden ? 'postView.failedUnhidePost' : 'postView.failedHidePost'),
          );
          console.log(ok, resp, 'hide post here chcek the data ');
        } else {
          showToastMessage(
            toast,
            'success',
            resp?.data?.message || t(isHidden ? 'postView.postUnhidden' : 'postView.postHidden'),
          );

          if (userChat) {
            await refetchPostData(postId);
          }
        }
      } catch (e) {
        setHiddenById(prev => ({ ...prev, [postId]: isHidden }));
        showToastMessage(
          toast,
          'danger',
          e?.response?.data?.message || t('postView.somethingWentWrong'),
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
    [hiddenById, hidingIds, toast, dispatch, userChat, refetchPostData, t],
  );

  const handleToggleFollow = useCallback(
    async (targetUserId, shouldFollow) => {
      if (!targetUserId) return false;
      const key = String(targetUserId);
      if (followingBusy.has(key)) return false;
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
            res?.data?.message || res?.message || t('postView.unableToUpdateFollow'),
          );
          return false;
        } else {
          if (userChat && list[0]?.id) {
            await refetchPostData(list[0].id);
          } else {
            const serverVal = res?.data?.following;
            if (typeof serverVal === 'boolean') {
              setFollowingByUserId(prev => ({ ...prev, [key]: serverVal }));
            }
          }
          showToastMessage(
            toast,
            'success',
            shouldFollow ? t('postView.followSuccess') : t('postView.unfollowSuccess'),
          );
          return true;
        }
      } catch (e) {
        setFollowingByUserId(prev => ({ ...prev, [key]: !shouldFollow }));
        showToastMessage(
          toast,
          'danger',
          e?.response?.data?.message || t('postView.somethingWentWrong'),
        );
        return false;
      } finally {
        setFollowingBusy(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [toast, followingBusy, userChat, list, refetchPostData, t],
  );

  // ─── Options ──────────────────────────────────────────
  const openOptions = id => {
    setModalPostId(id);
    setModalVisible(true);
  };

  const closeOptions = useCallback(() => {
    setModalVisible(false);
    setModalPostId(null);
  }, []);

  const handlePostEdited = useCallback(updatedPost => {
    if (!updatedPost?.id) return;

    setList(prev =>
      prev.map(post =>
        String(post.id) === String(updatedPost.id)
          ? { ...post, ...updatedPost }
          : post,
      ),
    );
  }, []);

  const handleLocationUpdate = useCallback((postId, location) => {
    setList(prev =>
      prev.map(post =>
        String(post.id) === String(postId) ? { ...post, location } : post,
      ),
    );
  }, []);

  const canDelete = useMemo(() => {
    if (!modalPostId || !currentUserId) return false;
    const post = list.find(x => String(x.id) === String(modalPostId));
    if (!post) return false;
    return String(post.userId) === String(currentUserId);
  }, [list, modalPostId, currentUserId]);

  const canHide = useMemo(() => {
    if (!modalPostId || !currentUserId) return false;
    const post = list.find(x => String(x.id) === String(modalPostId));
    if (!post) return false;
    const viewerId = String(currentUserId);
    const postOwnerId = String(post.userId ?? post.UserId ?? '');
    // Show Hide only when YOU own the post
    return postOwnerId === viewerId;
  }, [list, modalPostId, currentUserId]);

  const modalPost = useMemo(() => {
    if (!modalPostId) return null;
    return list.find(post => String(post.id) === String(modalPostId)) || null;
  }, [list, modalPostId]);

  const handleTogglePinPost = useCallback(async post => {
    const postId = String(post?.id || post?._id || '');
    if (!canDelete || !postId || pinningPostIdRef.current) return;

    const nextPinned = !isPostPinned(post);
    pinningPostIdRef.current = postId;

    try {
      const payload = { postId };
      if (nextPinned) await pinPost(payload);
      else await unpinPost(payload);
      setList(prevPosts => setPostPinnedState(prevPosts, postId, nextPinned));
    } catch (error) {
      Alert.alert(
        nextPinned ? t('postScreen.unableToPinTitle') : t('postScreen.unableToUnpinTitle'),
        error?.response?.data?.message || error?.message || t('postScreen.tryAgain'),
      );
    } finally {
      pinningPostIdRef.current = '';
    }
  }, [canDelete, t]);

  const onSheetAction = useCallback(
    async action => {
      if (!modalPostId) return;

      if (action === 'toggleSave') {
        await handleToggleSave(modalPostId);
        closeOptions();
        return;
      }

      if (action === 'copyAddress') {
        if (!modalPostId) {
          showToastMessage(toast, 'danger', t('postView.postIdNotFound'));
          closeOptions();
          return;
        }

        const post = list.find(p => String(p.id) === String(modalPostId));
        const deepLink = `${BASE_URL}/postshare/${encodeURIComponent(String(modalPostId))}`;

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
        showToastMessage(toast, 'success', t('postView.postCopied'));
        closeOptions();
        return;
      }

      if (action === 'editPost') {
        if (!canDelete) {
          showToastMessage(toast, 'danger', t('postView.cantEditPost'));
          closeOptions();
          return;
        }

        const postToEdit = list.find(p => String(p.id) === String(modalPostId));
        closeOptions();

        if (!postToEdit) {
          showToastMessage(toast, 'danger', t('postView.postNotFound'));
          return;
        }

        navigation.navigate('EditPost', {
          post: postToEdit,
          onSave: handlePostEdited,
        });
        return;
      }

      if (action === 'togglePinPost') {
        if (!canDelete || !modalPost) {
          closeOptions();
          return;
        }

        const postToToggle = modalPost;
        const pinned = isPostPinned(postToToggle);
        closeOptions();
        Alert.alert(
          pinned ? t('postScreen.unpinPost') : t('postScreen.pinPost'),
          pinned ? t('postScreen.unpinConfirm') : t('postScreen.pinConfirm'),
          [
            { text: t('postScreen.cancel'), style: 'cancel' },
            {
              text: pinned ? t('postScreen.unpin') : t('postScreen.pin'),
              onPress: () => handleTogglePinPost(postToToggle),
            },
          ],
        );
        return;
      }

      if (action === 'deletePost') {
        if (!canDelete) {
          showToastMessage(toast, 'danger', t('postView.cantDeletePost'));
          closeOptions();
          return;
        }

        Alert.alert(t('postView.deletePostTitle'), t('postView.deletePostMessage'), [
          { text: t('postView.cancel'), style: 'cancel' },
          {
            text: t('postView.delete'),
            style: 'destructive',
            onPress: async () => {
              const previousList = list;
              const nextList = previousList.filter(
                p => String(p.id) !== String(modalPostId),
              );
              const nextVisiblePosts = nextList.filter(
                p => !hiddenById[p.id],
              );
              try {
                dispatch(showLoader());
                let userId = currentUserId;
                if (!userId) {
                  const id = await AsyncStorage.getItem('userId');
                  if (!id) {
                    showToastMessage(
                      toast,
                      'danger',
                      t('postView.noUserIdDelete'),
                    );
                    return;
                  }
                  userId = String(id);
                }
                setList(nextList);
                const res = await deletePost(modalPostId, userId);
                closeOptions();
                if (res?.statusCode === 200 && res?.success) {
                  showToastMessage(
                    toast,
                    'success',
                    res?.data?.message || t('postView.postDeleted'),
                  );
                  if (nextVisiblePosts.length === 0) {
                    handleBackPress();
                  }
                } else {
                  setList(previousList);
                  showToastMessage(
                    toast,
                    'danger',
                    res?.data?.message || res?.message || t('postView.failedDelete'),
                  );
                }
              } catch (err) {
                setList(previousList);
                showToastMessage(
                  toast,
                  'danger',
                  err?.response?.data?.message ||
                  err?.message ||
                  t('postView.errorDeletingPost'),
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
        const isLastVisible =
          visiblePosts.length === 1 &&
          String(visiblePosts[0]?.id) === String(modalPostId);
        await handleToggleHide(modalPostId);
        closeOptions();
        if (isLastVisible) {
          handleBackPress();
        }
        return;
      }

      closeOptions();
    },
    [
      modalPostId,
      canDelete,
      handleToggleSave,
      closeOptions,
      list,
      modalPost,
      navigation,
      handlePostEdited,
      handleTogglePinPost,
      toast,
      currentUserId,
      dispatch,
      handleToggleHide,
      hiddenById,
      handleBackPress,
      t,
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
    Alert.alert(t('postView.commentedLabel'), commentText.trim());
    setCommentText('');
    commentSheetRef.current?.close();
  };

  const handleCommentClose = () => {
    commentSheetRef.current?.close();
    setCommentPostId(null);
  };

  useEffect(() => {
    if (!openCommentsOnMount || didAutoOpenCommentsRef.current) return;
    const targetPostId = routeParams?.commentPostId || routeParams?.postId || navPostData?.id || posts?.[0]?.id;
    if (!targetPostId) return;

    didAutoOpenCommentsRef.current = true;
    const timer = setTimeout(() => {
      handleComment(String(targetPostId), routeParams?.commentPostOwnerId || routeUserData?.id || routeUserData?.userId || null);
    }, 250);

    return () => clearTimeout(timer);
  }, [
    openCommentsOnMount,
    routeParams?.commentPostId,
    routeParams?.postId,
    routeParams?.commentPostOwnerId,
    navPostData,
    posts,
    routeUserData,
  ]);

  const handleCommentCountUpdate = useCallback((postId, newCount) => {
    setPostCommentsCount(prev => ({
      ...prev,
      [postId]: Math.max(0, newCount),
    }));

    if (userChat) {
      refetchPostData(postId);
    }
  }, [userChat, refetchPostData]);

  // ─── Renderer ───────────────────────────────────────────────
  const renderFeedItem = useCallback(
    ({ item }) => {
      const itemIsTrustPost = resolveTrustPostFromSources(item, routeParams);
      const mapped = {
        id: item.id,
        username: item.userName ?? 'Unknown',
        avatar:
          item.userImage == null
            ? 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
            : formatUrl(item.userImage),
        media: (item.images || []).map((url, mediaIndex) => ({
          type: getMediaType(url),
          url: formatUrl(url),
          thumbnail: formatUrl(
            item.thumbnails?.[mediaIndex] ??
            item.thumbnails?.[0] ??
            null,
          ),
        })),
        caption: item.caption,
        hashtag: item.hashtag ?? item.hashtags ?? [],
        PostsProfile: 'Support',
        link: item.link,
        raiseAmount: item.raiseAmount ?? 0,
        goalAmount: item.goalAmount ?? 100000,
        daysLeft: item.daysLeft ?? 0,
        start_time: item.start_time ?? item.startTime ?? null,
        end_time: item.end_time ?? item.endTime ?? null,
        tokenBalance: item.tokenBalance ?? 0,
        totalDonation: donationTotalsByPostId[String(item.id)] ?? item.totalDonation ?? 0,
        profile:
          typeof item?.profile === 'string' && item.profile.toLowerCase() === 'company'
            ? 'company'
            : 'user',
        createdAt: item.createdAt ?? item.created_at ?? null,
        created_at: item.created_at ?? item.createdAt ?? null,
        location: item.location || item.Location || '',
        type: item.type || item.postType || 'normal',
        postType: item.postType || item.type || 'normal',
        UserId: item.userId,
        userId: item.userId,
        boughtBy: item.boughtBy || [],
        taggedPeople: Array.isArray(item.taggedPeople) ? item.taggedPeople : [],
        isTrustPost: itemIsTrustPost,
        communityTrustPost: itemIsTrustPost,
        returnTo,
        follow:
          typeof followingByUserId[String(item.userId)] === 'boolean'
            ? followingByUserId[String(item.userId)]
            : !!item.isFollow,
        ...extractPostMusicPayloadFromApi(item),
        visibleTo: item.visibleTo,
      };
      const isPostVisible = String(item.id) === String(currentlyVisiblePostId);
      return (
        <View
          style={[
            styles.feedItemPage,
            // listViewportHeight > 0 && { minHeight: listViewportHeight },
          ]}
        >
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
            returnTo={returnTo}
            shareCount={item.shareCount}
            taggedPeople={mapped.taggedPeople}
            isTrustPost={mapped.isTrustPost}
            isVisible={isPostVisible}
            screenFocused={screenFocused}
            onLocationUpdate={handleLocationUpdate}
            playingPostId={playingPostId}
            currentlyVisiblePostId={currentlyVisiblePostId}
          />
        </View>
      );
    },
    [
      liked,
      saved,
      postLikesCount,
      postCommentsCount,
      donationTotalsByPostId,
      followingByUserId,
      followingBusy,
      handleToggleFollow,
      handleToggleSave,
      returnTo,
      routeParams,
      toggleLike,
      currentlyVisiblePostId,
      screenFocused,
      playingPostId,
      listViewportHeight,
      handleLocationUpdate,
    ],
  );

  const getInitialScrollIndex = () => {
    return resolvedInitialIndex >= 0 ? resolvedInitialIndex : 0;
  };

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }) => {
      if (!viewableItems || viewableItems.length === 0) {
        setCurrentlyVisiblePostId(null);
        setPlayingPostId(null);
        return;
      }

      let mostVisiblePost = null;
      let highestPercentage = 0;
      let topMostViewable = null;
      for (const viewableItem of viewableItems) {
        if (viewableItem.index == null) continue;
        if (!topMostViewable || viewableItem.index < topMostViewable.index) {
          topMostViewable = viewableItem;
        }
      }
      const isStartPostAtTop =
        pendingInitialScrollRef.current &&
        startPostId &&
        String(topMostViewable?.item?.id ?? '') === startPostId;

      for (const viewableItem of viewableItems) {
        if (viewableItem.isViewable && viewableItem.item?.id) {
          const percentage = viewableItem.percentVisible ?? 100;
          if (percentage > highestPercentage) {
            highestPercentage = percentage;
            mostVisiblePost = viewableItem.item.id;
          }
        }
      }

      if (isStartPostAtTop) {
        pendingInitialScrollRef.current = false;
      }

      if (mostVisiblePost !== currentlyVisiblePostId) {
        setCurrentlyVisiblePostId(mostVisiblePost);

        if (playingDebounceRef.current) {
          clearTimeout(playingDebounceRef.current);
        }

        setPlayingPostId(null);
        playingDebounceRef.current = setTimeout(() => {
          setPlayingPostId(mostVisiblePost);
          playingDebounceRef.current = null;
        }, 250);
      }
    },
    [currentlyVisiblePostId, startPostId],
  );

  const viewabilityConfigRef = useRef({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 250,
    waitForInteraction: false,
  });
  const viewabilityConfig = viewabilityConfigRef.current;

  useEffect(() => {
    return () => {
      if (playingDebounceRef.current) {
        clearTimeout(playingDebounceRef.current);
      }
    };
  }, []);

  const headerPost = list[0] || posts[0] || visiblePosts[0];
  const showHeaderTrustBadge = resolveTrustPostFromSources(headerPost, routeParams);

  return (
    <>
      <SafeAreaView style={[styles.container, bgStyle]}>
        <View style={[styles.headerSection, { borderBottomColor: border }]}>
          <TouchableOpacity
            onPress={handleBackPress}
            style={styles.buttons}
          >
            <Ionicons name="arrow-back" size={24} color={text} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.userText, { color: text }]}>
              {headerPost?.userName || t('postView.postsHeaderFallback')}
            </Text>
            {showHeaderTrustBadge && (
              <View style={styles.headerTrustBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#059669" />
                <Text style={styles.headerTrustText}>{t('postItem.trust')}</Text>
              </View>
            )}
          </View>
          <View style={styles.placeholder} />
        </View>

        {isReady ? (
          <FlatList
          ref={flatListRef}
          data={visiblePosts}
          keyExtractor={(p, i) => p.id?.toString() ?? `post-${i}`}
          renderItem={renderFeedItem}
          contentContainerStyle={[styles.feedContainer, { paddingBottom: Math.max(50, insets.bottom + 34) }]}
          onLayout={event => {
            const nextHeight = Math.round(event?.nativeEvent?.layout?.height || 0);
            // Ignore tiny height changes that destabilize snapping.
            if (nextHeight > 0 && Math.abs(nextHeight - listViewportHeight) > 2) {
              setListViewportHeight(nextHeight);
            }
          }}
          showsVerticalScrollIndicator={false}
          initialScrollIndex={visiblePosts.length > 0 ? getInitialScrollIndex() : undefined}
          onContentSizeChange={handleContentSizeChange}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScrollToIndexFailed={onScrollToIndexFailed}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={handleViewableItemsChanged}
          scrollEventThrottle={16}
          // For smooth finger-follow scrolling, avoid snap/paging settings here.
          removeClippedSubviews={false}
          initialNumToRender={4}
          maxToRenderPerBatch={6}
          windowSize={9}
          nestedScrollEnabled
        />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={text} />
          </View>
        )}
      </SafeAreaView>

      {/* Options Modal */}
      <OptionsModal
        visible={modalVisible}
        onClose={closeOptions}
        onSelect={onSheetAction}
        fromHome={true}
        postId={modalPostId ?? ''}
        isSaved={!!(modalPostId && saved[modalPostId])}
        isPinned={!!(modalPost && isPostPinned(modalPost))}
        canDelete={!!canDelete}
        canEdit={!!canDelete}
        canHide={canHide}
        isHidden={!!(modalPostId && hiddenById[modalPostId])}
        hideBusy={modalPostId ? hidingIds.has(modalPostId) : false}
        onHiddenChange={(id, nextHidden) => {
          const isLastVisible =
            visiblePosts.length === 1 &&
            String(visiblePosts[0]?.id) === String(id);

          setHiddenById(prev => ({ ...prev, [id]: nextHidden }));

          if (nextHidden && isLastVisible) {
            handleBackPress();
          }
        }}
      />

      {/* Comment Bottom Sheet */}
      <RBSheet
        ref={commentSheetRef}
        height={560}
        openDuration={250}
        draggable={true}
        closeOnPressMask={true}
        customModalProps={{ statusBarTranslucent: true }}
        customAvoidingViewProps={{ enabled: false }}
        customStyles={{
          container: [{
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
          }, bgStyle],
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
          returnTo="PostView"
          returnParams={{
            ...routeParams,
            returnTo: routeParams?.returnTo,
            returnParams: routeParams?.returnParams,
          }}
        />
      </RBSheet>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  feedContainer: {
    // Avoid padding with snapping (can cause bounce/jitter).
    paddingBottom: 0,
  },
  feedItemPage: {
    justifyContent: 'flex-start',
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
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTrustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  headerTrustText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  userText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  placeholder: {
    width: 34,
  },
});
