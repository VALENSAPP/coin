import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  Modal,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { getAllUser } from '../../services/users';
import { getposts } from '../../services/home';
import {
  useIsFocused,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../../components/displaytoastmessage';
import Video from 'react-native-video';
import styles from './Style';
import { useAppTheme } from '../../theme/useApptheme';
import { getProgressBarColor } from '../../utils/progressBarUtils';
import { getTotalDonationAmount } from '../../services/tokens';
import { exploretBattle } from '../../services/battle';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_PROFILE_AVATAR =
  'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const BATTLE_FEED_FILTERS = [
  { key: 'live', label: 'Live Battles' },
  { key: 'open', label: 'Open Battles' },
  { key: 'trending', label: 'Trending Battles' },
  { key: 'finished', label: 'Finished Battles' },
];

const parseNonNegativeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const calculateMissionStats = (post, raisedAmountOverride = null) => {
  const goalAmount =
    parseNonNegativeNumber(post?.raiseAmount, NaN) ||
    parseNonNegativeNumber(post?.goalAmount, NaN) ||
    10000;

  const currentRaised = parseNonNegativeNumber(
    raisedAmountOverride ?? post?.totalDonation ?? post?.tokenBalance,
    0,
  );
  const progressPercent =
    goalAmount > 0 ? (currentRaised / goalAmount) * 100 : 0;

  let daysLeft = 0;
  if (post?.end_time) {
    try {
      const end = new Date(post.end_time);
      const start = post?.start_time ? new Date(post.start_time) : null;
      const now = new Date();

      if (!Number.isNaN(end.getTime())) {
        // If campaign hasn't started yet, show full campaign window from start->end.
        const baseline =
          start && !Number.isNaN(start.getTime()) && now < start ? start : now;
        const diff = end - baseline;
        daysLeft = diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
      }
    } catch (err) {
      daysLeft = 0;
    }
  }

  return { goalAmount, currentRaised, progressPercent, daysLeft };
};

const formatAmount = value =>
  parseNonNegativeNumber(value, 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });

const pickBattleDisplayText = (...values) =>
  values.find(value => {
    if (value === undefined || value === null) {
      return false;
    }

    const normalized = `${value}`.trim().toLowerCase();
    return normalized && normalized !== 'null' && normalized !== 'undefined';
  });

const normalizeBattleOptionLabel = (option, index) => {
  if (typeof option === 'string') {
    return option.trim();
  }

  return pickBattleDisplayText(
    option?.label,
    option?.text,
    option?.value,
    option?.side,
    option?.name,
    `Option ${index + 1}`,
  );
};

const buildBattleOptions = battle => {
  const rawOptions = Array.isArray(battle?.options) ? battle.options : [];
  const normalizedOptions = rawOptions
    .map((option, index) => {
      const label = normalizeBattleOptionLabel(option, index);
      if (!label) {
        return null;
      }

      return {
        id: String(option?.id || option?._id || label || index),
        label,
      };
    })
    .filter(Boolean);

  if (normalizedOptions.length > 0) {
    return normalizedOptions;
  }

  if (String(battle?.format || '').toUpperCase() === 'HEAD_TO_HEAD') {
    return [getBattleParticipant(battle, 0), getBattleParticipant(battle, 1)]
      .map((participant, index) => {
        const label = pickBattleDisplayText(
          participant?.name,
          participant?.userName,
          `Option ${index + 1}`,
        );

        return {
          id: `fallback-${index + 1}`,
          label,
        };
      })
      .filter(item => item?.label);
  }

  return [];
};

const buildBattleFallbackParticipant = (battle, index) => {
  const optionLabel = normalizeBattleOptionLabel(battle?.options?.[index], index);

  if (index === 0) {
    return {
      userName: pickBattleDisplayText(
        battle?.creator?.userName,
        battle?.creator?.username,
        '',
      ),
      name: pickBattleDisplayText(
        optionLabel,
        battle?.creator?.displayName,
        battle?.creator?.name,
        battle?.creator?.userName,
        'Creator',
      ),
      avatar: pickBattleDisplayText(
        battle?.creator?.image,
        battle?.creator?.avatar,
        battle?.creator?.profilePicture,
        '',
      ),
    };
  }

  return {
    userName: pickBattleDisplayText(
      battle?.invitedUser?.userName,
      battle?.invitedUser?.username,
      battle?.opponent?.userName,
      battle?.opponent?.username,
      '',
    ),
    name: pickBattleDisplayText(
      optionLabel,
      battle?.invitedUser?.displayName,
      battle?.invitedUser?.name,
      battle?.opponent?.displayName,
      battle?.opponent?.name,
      'Opponent',
    ),
    avatar: pickBattleDisplayText(
      battle?.invitedUser?.image,
      battle?.invitedUser?.avatar,
      battle?.invitedUser?.profilePicture,
      battle?.opponent?.image,
      battle?.opponent?.avatar,
      battle?.opponent?.profilePicture,
      '',
    ),
  };
};

const getBattleParticipant = (battle, index) => {
  const participants =
    battle?.participants ||
    battle?.users ||
    battle?.challengers ||
    battle?.players ||
    [];

  const participant = Array.isArray(participants) ? participants[index] : null;

  if (participant) {
    return {
      userName:
        participant?.userName ||
        participant?.username ||
        participant?.handle ||
        `user${index + 1}`,
      name:
        participant?.name ||
        participant?.fullName ||
        participant?.displayName ||
        participant?.userName ||
        `User ${index + 1}`,
      avatar:
        participant?.avatar ||
        participant?.profilePicture ||
        participant?.image ||
        participant?.photo ||
        '',
    };
  }

  const directUser = battle?.[`user${index + 1}`];
  if (directUser) {
    return {
      userName:
        directUser?.userName || directUser?.username || `user${index + 1}`,
      name:
        directUser?.name ||
        directUser?.fullName ||
        directUser?.userName ||
        `User ${index + 1}`,
      avatar:
        directUser?.avatar ||
        directUser?.profilePicture ||
        directUser?.image ||
        '',
    };
  }

  return buildBattleFallbackParticipant(battle, index);
};

const mapBattleCard = battle => {
  const creator = {
    id: battle?.creator?.id || battle?.creatorId || '',
    userName:
      battle?.creator?.userName || battle?.creator?.username || 'creator',
    name:
      battle?.creator?.displayName ||
      battle?.creator?.name ||
      battle?.creator?.userName ||
      'Creator',
    avatar:
      battle?.creator?.image ||
      battle?.creator?.avatar ||
      battle?.creator?.profilePicture ||
      '',
  };

  return {
    id: String(battle?.id || battle?._id || battle?.battleId || ''),
    format: battle?.format || 'POLL',
    creator,
    user1: getBattleParticipant(battle, 0),
    user2: getBattleParticipant(battle, 1),
    title:
      battle?.title ||
      battle?.question ||
      battle?.headline ||
      'Untitled battle',
    options: buildBattleOptions(battle),
    isLive: Boolean(
      battle?.isLive ||
        battle?.live ||
        battle?.status === 'LIVE' ||
        battle?.status === 'live',
    ),
    status: battle?.status || '',
    stakeAmount: battle?.stakeAmount ?? battle?.stake ?? 0,
    totalParticipants: battle?._count?.participants ?? 0,
    totalComments:
      battle?._count?.comments ??
      battle?.commentsCount ??
      battle?.totalComments ??
      0,
    totalLikes:
      battle?._count?.likes ??
      battle?.likesCount ??
      battle?.totalLikes ??
      battle?._count?.votes ??
      battle?.votesCount ??
      0,
    totalVotes: battle?._count?.votes ?? battle?.votesCount ?? 0,
    endTime: battle?.endTime || null,
  };
};

const formatBattleDate = value => {
  if (!value) {
    return 'No end date';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No end date';
  }

  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');

  return `${day}/${month}`;
};

const formatBattleCount = value => {
  const count = Number(value || 0);
  if (!Number.isFinite(count) || count <= 0) {
    return '0';
  }

  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(count >= 10000000 ? 0 : 1)}M`;
  }

  if (count >= 1000) {
    return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`;
  }

  return `${count}`;
};

/** Mission Progress Bar Component */
const MissionProgressBar = ({
  progressPercent = 0,
  goalAmount = 0,
  currentRaised = 0,
  daysLeft = 0,
  profile = 'user',
}) => {
  const fillColor = getProgressBarColor(progressPercent, profile);
  const normalizedProgress = Math.min(progressPercent, 100);

  return (
    <View style={styles.progressSection}>
      <View style={styles.progressBarWrapper}>
        <View style={styles.progressBarBackground}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${Math.min(progressPercent, 100)}%`,
                backgroundColor: fillColor,
              },
            ]}
          />
        </View>

        <View style={styles.progressStatsContainer}>
          <View style={styles.statAtStart}>
            <Text
              style={styles.statValueSmall}
              numberOfLines={2}
              ellipsizeMode="clip"
            >
              {normalizedProgress.toFixed(1)}% FUNDED
            </Text>
          </View>

          <View style={styles.statAtCenter}>
            <Text
              style={styles.statValueSmall}
              numberOfLines={2}
              ellipsizeMode="clip"
            >
              ${formatAmount(currentRaised)} / ${formatAmount(goalAmount)}{' '}
              {'\n'}RAISED
            </Text>
          </View>

          <View style={styles.statAtEnd}>
            <Text
              style={styles.statValueSmall}
              numberOfLines={2}
              ellipsizeMode="clip"
            >
              {daysLeft} DAYS LEFT
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const SearchScreen = () => {
  const dispatch = useDispatch();
  const toast = useToast();
  const navigation = useNavigation();
  const route = useRoute();

  const [userId, setUserId] = useState(null);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [posts, setPosts] = useState([]);
  const [playingVideoIndexes, setPlayingVideoIndexes] = useState(new Set());
  const [previewPost, setPreviewPost] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [isGrid, setIsGrid] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [donationTotals, setDonationTotals] = useState({});
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeExploreTab, setActiveExploreTab] = useState('live');
  const [liveBattles, setLiveBattles] = useState([]);
  const [loadingLiveBattles, setLoadingLiveBattles] = useState(false);
  const [selectedBattleOptions, setSelectedBattleOptions] = useState({});

  const searchTimeoutRef = useRef(null);
  const autoplayTimeoutRef = useRef(null);
  const scrollOffsetRef = useRef(0);
  const toastRef = useRef(toast);
  const activeSearchRequestIdRef = useRef(0);
  const { bgStyle, textStyle } = useAppTheme();
  const isScreenFocused = useIsFocused();
  const isSearchActive = searchText.trim().length > 0;

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  /** 🔍 User search logic */
  const searchUsers = useCallback(
    async searchQuery => {
      if (!searchQuery.trim()) {
        setFilteredUsers([]);
        setIsSearching(false);
        setHasSearched(false);
        return;
      }

      const requestId = Date.now();
      activeSearchRequestIdRef.current = requestId;
      setIsSearching(true);
      setHasSearched(false);

      try {
        // dispatch(showLoader());

        const res = await getAllUser({ userName: searchQuery });
        if (activeSearchRequestIdRef.current !== requestId) return;

        if (res.statusCode === 200 || res.status === 200) {
          setFilteredUsers(res?.data?.users ?? []);
          console.log(res, 'responsse user profile');
        } else {
          setFilteredUsers([]);
        }
      } catch (err) {
        if (activeSearchRequestIdRef.current !== requestId) return;
        console.error('Search error:', err);
        setFilteredUsers([]);
      } finally {
        if (activeSearchRequestIdRef.current === requestId) {
          setIsSearching(false);
          setHasSearched(true);
        }
        // dispatch(hideLoader());
      }
    },
    [dispatch],
  );

  /** Debounce for search */
  const handleSearch = useCallback(
    text => {
      setSearchText(text);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

      if (!text.trim()) {
        activeSearchRequestIdRef.current = 0;
        setFilteredUsers([]);
        setIsSearching(false);
        setHasSearched(false);
        return;
      }

      searchTimeoutRef.current = setTimeout(() => searchUsers(text), 500);
    },
    [searchUsers],
  );

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (autoplayTimeoutRef.current) clearTimeout(autoplayTimeoutRef.current);
    };
  }, []);

  /** 📸 Fetch posts (images + videos) */
  const fetchPosts = useCallback(async () => {
    try {
      dispatch(showLoader());
      const response = await getposts();
      console.log('Search response hereer darattatatatatata:', response);
      if (response?.statusCode === 200) {
        const postsData = response.data || [];
        // Transform posts: if a post has multiple images, create separate items for each
        const flattenedPosts = [];
        postsData.forEach(post => {
          if (
            post?.images &&
            Array.isArray(post.images) &&
            post.images.length > 0
          ) {
            // For each image in the post, create a grid item
            post.images.forEach((imageUrl, imgIndex) => {
              flattenedPosts.push({
                ...post,
                mediaUrl: imageUrl,
                imageIndex: imgIndex,
                isVideo:
                  imageUrl?.toLowerCase().includes('.mp4') ||
                  imageUrl?.toLowerCase().includes('.mov') ||
                  imageUrl?.toLowerCase().includes('.avi') ||
                  post?.type === 'video' ||
                  post?.mediaType === 'video',
              });
            });
          } else if (post?.image) {
            // Handle single image field
            flattenedPosts.push({
              ...post,
              mediaUrl: post.image,
              isVideo: false,
            });
          }
        });
        console.log('Flattened posts:', flattenedPosts.length);
        setPosts(flattenedPosts);

        const missionPostIds = [
          ...new Set(
            flattenedPosts
              .filter(
                post =>
                  post?.id &&
                  (post?.isMission === true ||
                    post?.type === 'crowdfunding' ||
                    Number(post?.raiseAmount) > 0),
              )
              .map(post => String(post.id)),
          ),
        ];

        if (missionPostIds.length > 0) {
          const responses = await Promise.allSettled(
            missionPostIds.map(postId => getTotalDonationAmount({ postId })),
          );

          const nextTotals = {};
          responses.forEach((res, idx) => {
            if (res.status === 'fulfilled' && res.value?.statusCode === 200) {
              const postId = missionPostIds[idx];
              nextTotals[postId] = Number(res.value?.data?.totalDonation) || 0;
            }
          });
          setDonationTotals(nextTotals);
        } else {
          setDonationTotals({});
        }
      } else {
        showToastMessage(
          toastRef.current,
          'danger',
          response?.data?.message || 'Failed to fetch posts',
        );
      }
    } catch (error) {
      console.log('Posts fetch error:', error);
      showToastMessage(
        toastRef.current,
        'danger',
        error?.response?.message ?? 'Something went wrong',
      );
    } finally {
      dispatch(hideLoader());
    }
  }, [dispatch]);

  const fetchExploreBattles = useCallback(async () => {
    try {
      setLoadingLiveBattles(true);
      const response = await exploretBattle();
      console.log(response,'respoens ein sercshs s ')

      if (response?.statusCode === 200 || response?.status === 200) {
        const rawBattles =
          response?.data?.battles ||
          response?.data?.data ||
          response?.data ||
          [];

        const normalizedBattles = Array.isArray(rawBattles)
          ? rawBattles.map(mapBattleCard).filter(item => item.id)
          : [];

        setLiveBattles(normalizedBattles);
      } else {
        setLiveBattles([]);
      }
    } catch (error) {
      console.log('Explore battles fetch error:', error);
      setLiveBattles([]);
    } finally {
      setLoadingLiveBattles(false);
    }
  }, []);

  useEffect(() => {
    const fetchUserId = async () => {
      const id = await AsyncStorage.getItem('userId');
      setUserId(id);
    };
    fetchUserId();
    fetchPosts();
    fetchExploreBattles();
  }, [fetchPosts, fetchExploreBattles]);

  /** 🏗️ Masonry layout: Organize posts into columns with some items spanning 2 rows */
  const masonryLayout = useMemo(() => {
    if (posts.length === 0) return { columns: [[], [], []], maxHeight: 0 };

    const NUM_COLUMNS = 3;
    const ITEM_SPACING = 2;
    // Calculate based on full screen width with only spacing between items
    const BASE_ITEM_SIZE =
      (SCREEN_WIDTH - ITEM_SPACING * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
    const TALL_ITEM_SIZE = BASE_ITEM_SIZE * 2 + ITEM_SPACING; // 2 rows + spacing

    const columns = [[], [], []];
    const columnHeights = [0, 0, 0];

    posts.forEach((post, index) => {
      // Determine if this item should be tall (spanning 2 rows)
      // Pattern: Creates dynamic visual rhythm - roughly every 4th item
      // This makes posts at positions 0, 4, 8, 12, 16, etc. tall
      // The masonry algorithm will distribute these across columns naturally
      const shouldBeTall = index % 4 === 0;
      const itemHeight = shouldBeTall ? TALL_ITEM_SIZE : BASE_ITEM_SIZE;

      // Find the column with the minimum height
      let minHeightIndex = 0;
      for (let i = 1; i < NUM_COLUMNS; i++) {
        if (columnHeights[i] < columnHeights[minHeightIndex]) {
          minHeightIndex = i;
        }
      }

      // Add item to the column with minimum height
      columns[minHeightIndex].push({
        post,
        index,
        height: itemHeight,
        top: columnHeights[minHeightIndex],
        columnIndex: minHeightIndex,
        width: BASE_ITEM_SIZE,
        spacing: ITEM_SPACING,
      });

      // Update column height
      columnHeights[minHeightIndex] += itemHeight + ITEM_SPACING;
    });

    const maxHeight = Math.max(...columnHeights);

    return {
      columns,
      maxHeight,
      itemSize: BASE_ITEM_SIZE,
      spacing: ITEM_SPACING,
    };
  }, [posts]);

  const masonryItems = useMemo(() => {
    if (!masonryLayout?.columns) return [];
    return masonryLayout.columns.flat();
  }, [masonryLayout]);

  /** 👤 Navigate to user profile */
  // const handleUserProfile = (id) => {
  //    if (userId === id) {
  //   navigation.navigate('HomeMain', {
  //     screen: 'ProfileStack',
  //     params: {
  //       screen: 'UserProfile', // 👈 profile screen only
  //     },
  //   // }); else {
  //   //   navigation.navigate('ProfileStack', {
  //   //     screen: 'FlipsScreen',
  //   //     params: { userId: id }
  //   //   });
  //   // }
  // };

  const handleUserProfile = useCallback(
    user => {
      const targetId = user?.id || user?.userId || user?._id;
      if (!targetId) {
        showToastMessage(toastRef.current, 'danger', 'Unable to open profile');
        return;
      }

      const derivedBattleLive =
        Boolean(user?.battleLive || user?.isBattleLive) ||
        Number(String(targetId).slice(-1)) % 3 === 0;

      navigation.navigate('HomeMain', {
        screen: 'UsersProfile',
        params: {
          userId: String(targetId),
          username: user?.userName || user?.username || '',
          returnTo: route?.name,
          battleLive: derivedBattleLive,
        },
      });
    },
    [navigation, route?.name],
  );

  /** 🎬 Handle post press (image or video) */
  const handlePostPress = useCallback(
    (item, isVideo) => {
      const uniqueKey = Date.now().toString();
      if (isVideo) {
        navigation.navigate('ProfileMain', {
          screen: 'FlipsScreen',
          params: {
            item: item,
            key: uniqueKey,
            returnTo: route.name,
            returnParams: route.params,
          },
        });
      } else {
        navigation.navigate('ProfileMain', {
          screen: 'PostView',
          params: {
            postData: item,
            startIndex: 0,
            returnTo: route.name,
            returnParams: route.params,
            hideTabBar: true,
          },
          fromSearch: true,
        });
      }
    },
    [navigation, route?.name, route?.params],
  );

  const isVideoPost = useCallback(post => {
    if (!post) return false;
    const mediaUrl =
      post?.mediaUrl ||
      post?.image ||
      (Array.isArray(post?.images) ? post.images[0] : '');
    const lowerMediaUrl = (mediaUrl || '').toLowerCase();
    return (
      post?.isVideo ||
      post?.type === 'video' ||
      post?.mediaType === 'video' ||
      lowerMediaUrl.includes('.mp4') ||
      lowerMediaUrl.includes('.mov') ||
      lowerMediaUrl.includes('.avi') ||
      lowerMediaUrl.includes('.mkv') ||
      lowerMediaUrl.includes('.webm')
    );
  }, []);

  const syncVisibleVideos = useCallback(
    (offsetY = 0) => {
      if (!isScreenFocused || previewVisible || isSearchActive) {
        setPlayingVideoIndexes(prev => (prev.size === 0 ? prev : new Set()));
        return;
      }

      const viewportTop = offsetY;
      const viewportBottom = offsetY + SCREEN_HEIGHT;
      const nextPlayingIndexes = new Set();

      for (const layoutItem of masonryItems) {
        if (!isVideoPost(layoutItem?.post)) continue;

        const itemTop = layoutItem?.top ?? 0;
        const itemBottom = itemTop + (layoutItem?.height ?? 0);
        const visibleHeight =
          Math.min(itemBottom, viewportBottom) - Math.max(itemTop, viewportTop);
        if (visibleHeight > 0) nextPlayingIndexes.add(layoutItem?.index);
      }

      setPlayingVideoIndexes(prev => {
        if (prev.size === nextPlayingIndexes.size) {
          let same = true;
          for (const idx of nextPlayingIndexes) {
            if (!prev.has(idx)) {
              same = false;
              break;
            }
          }
          if (same) return prev;
        }
        return nextPlayingIndexes;
      });
    },
    [
      isScreenFocused,
      previewVisible,
      isSearchActive,
      masonryItems,
      isVideoPost,
    ],
  );

  const onMasonryScroll = useCallback(
    event => {
      const offsetY = event?.nativeEvent?.contentOffset?.y ?? 0;
      scrollOffsetRef.current = offsetY;

      if (autoplayTimeoutRef.current) clearTimeout(autoplayTimeoutRef.current);
      autoplayTimeoutRef.current = setTimeout(() => {
        syncVisibleVideos(offsetY);
        autoplayTimeoutRef.current = null;
      }, 80);
    },
    [syncVisibleVideos],
  );

  useEffect(() => {
    syncVisibleVideos(scrollOffsetRef.current);
  }, [syncVisibleVideos]);

  /** Normalize image URL */
  const normalizeImageUrl = url => {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:')
    ) {
      return trimmed;
    }
    if (trimmed.startsWith('/')) {
      return `http://35.174.167.92:3002${trimmed}`;
    }
    return `http://35.174.167.92:3002/${trimmed}`;
  };

  const renderBattleAvatar = (
    avatarUrl,
    _name,
    imageStyle,
    _fallbackStyle,
    _fallbackTextStyle,
  ) => {
    return (
      <Image
        source={{ uri: normalizeImageUrl(avatarUrl) || DEFAULT_PROFILE_AVATAR }}
        style={imageStyle}
      />
    );
  };

  const previewMediaUrl = useMemo(() => {
    if (!previewPost) return null;
    return normalizeImageUrl(
      previewPost?.mediaUrl ||
        previewPost?.image ||
        (Array.isArray(previewPost?.images) ? previewPost.images[0] : null),
    );
  }, [previewPost]);

  const previewIsVideo = useMemo(() => {
    if (!previewPost) return false;
    return (
      previewPost?.isVideo ||
      previewPost?.type === 'video' ||
      previewPost?.mediaType === 'video'
    );
  }, [previewPost]);

  const openPreview = useCallback(post => {
    setPreviewPost(post);
    setPreviewVisible(true);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewVisible(false);
    setPreviewPost(null);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (searchText.trim().length > 0) {
        await searchUsers(searchText);
      } else {
        await Promise.all([fetchPosts(), fetchExploreBattles()]);
      }
    } finally {
      setRefreshing(false);
    }
  }, [searchText, searchUsers, fetchPosts, fetchExploreBattles]);

  /** 🔲 UI — render masonry post item */
  const renderMasonryItem = useCallback(
    layoutItem => {
      const { post, index, height, top, columnIndex, width, spacing } =
        layoutItem;
      const isVideo = isVideoPost(post);
      const shouldPlay =
        isScreenFocused &&
        !previewVisible &&
        !isSearchActive &&
        playingVideoIndexes.has(index);
      const imageUrl = normalizeImageUrl(
        post?.mediaUrl || post?.image || (post?.images && post.images[0]),
      );
      const isMissionPost =
        post?.isMission === true || post?.type === 'crowdfunding';
      const raisedAmount = donationTotals[String(post?.id)];

      if (!imageUrl) {
        return null;
      }

      const left = columnIndex * (width + spacing);

      return (
        <TouchableOpacity
          key={`${post?.id || index}_${columnIndex}`}
          activeOpacity={0.8}
          onPress={() => handlePostPress(post, isVideo)}
          onLongPress={() => openPreview(post)}
          delayLongPress={220}
          style={[
            styles.masonryItem,
            {
              position: 'absolute',
              left,
              top,
              width,
              height,
            },
          ]}
        >
          {isVideo ? (
            <View
              style={{ position: 'relative', width: '100%', height: '100%' }}
            >
              <Video
                source={{ uri: imageUrl }}
                style={styles.media}
                resizeMode="cover"
                repeat
                paused={!shouldPlay}
                muted={true}
              />
              <View style={styles.videoIconOverlay}>
                <Icon name="play-circle" size={20} color="#fff" />
              </View>
            </View>
          ) : (
            <Image
              source={{ uri: imageUrl }}
              style={styles.media}
              resizeMode="cover"
            />
          )}
          {isMissionPost && (
            <View style={styles.missionBadgeWrapper}>
              {(() => {
                const { goalAmount, currentRaised, progressPercent, daysLeft } =
                  calculateMissionStats(post, raisedAmount);
                return (
                  <MissionProgressBar
                    progressPercent={progressPercent}
                    goalAmount={goalAmount}
                    currentRaised={currentRaised}
                    daysLeft={daysLeft}
                    profile={post?.profile}
                  />
                );
              })()}
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [
      playingVideoIndexes,
      handlePostPress,
      openPreview,
      isVideoPost,
      isScreenFocused,
      previewVisible,
      isSearchActive,
      donationTotals,
    ],
  );

  /** 👥 Render empty state for search results */
  const renderEmptyState = useCallback(() => {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="search-outline" size={60} color="#ddd" />
        <Text style={styles.emptyTitle}>No users found</Text>
        <Text style={styles.emptySubtitle}>
          Try searching for a different user
        </Text>
      </View>
    );
  }, []);

  const renderLoadingState = useCallback(() => {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color="#999" />
        <Text style={styles.emptySubtitle}>Loading users...</Text>
      </View>
    );
  }, []);

  /** 👤 Render list  for user search results */
  const renderListItem = useCallback(
    ({ item }) => {
      return (
        <TouchableOpacity
          style={styles.userListItem}
          onPress={() => handleUserProfile(item)}
          activeOpacity={0.7}
        >
          <Image
            source={{
              uri: normalizeImageUrl(
                item?.image ? (
                  item?.image
                ) : (
                  <Text style={{ color: 'red', fontSize: 20 }}>
                    No data found
                  </Text>
                ),
              ),
            }}
            style={styles.userAvatar}
          />
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {item?.name || item?.userName}
            </Text>
            <Text style={styles.userHandle} numberOfLines={1}>
              @{item?.userName}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [handleUserProfile],
  );

  /** 📊 Render grid item for user search results */
  const renderGridItem = useCallback(
    ({ item }) => {
      return (
        <TouchableOpacity
          style={styles.userGridItem}
          onPress={() => handleUserProfile(item)}
          activeOpacity={0.7}
        >
          <Image
            source={{
              uri: normalizeImageUrl(item?.profilePicture || item?.avatar),
            }}
            style={styles.userGridAvatar}
          />
          <Text style={styles.userGridName} numberOfLines={1}>
            {item?.name || item?.userName}
          </Text>
        </TouchableOpacity>
      );
    },
    [handleUserProfile],
  );

  /** 📋 Render list header */
  const renderListHeader = useCallback(() => {
    return <Text style={styles.sectionTitle}>Search Results</Text>;
  }, []);

  const getBattleEndTimestamp = battle => {
    if (!battle?.endTime) {
      return Number.POSITIVE_INFINITY;
    }

    const value = new Date(battle.endTime).getTime();
    return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
  };

  const getBattleFeedType = battle => {
    const status = String(battle?.status || '')
      .trim()
      .toLowerCase();
    const now = Date.now();
    const endTime = getBattleEndTimestamp(battle);

    if (
      battle?.isLive ||
      ['live', 'active', 'in_progress', 'ongoing'].includes(status)
    ) {
      return 'live';
    }

    if (
      ['finished', 'closed', 'resolved', 'completed', 'ended'].includes(
        status,
      ) ||
      endTime < now
    ) {
      return 'finished';
    }

    if (
      ['open', 'pending', 'upcoming', 'queued'].includes(status) ||
      endTime >= now
    ) {
      return 'open';
    }

    return 'trending';
  };

  const getBattleFeedLabel = battle => {
    const type = getBattleFeedType(battle);
    if (type === 'live') return 'LIVE NOW';
    if (type === 'open') return 'OPEN';
    if (type === 'finished') return 'FINISHED';
    return 'TRENDING';
  };

  const battleFeedCards = useMemo(() => {
    const live = liveBattles
      .filter(item => getBattleFeedType(item) === 'live')
      .sort((a, b) => getBattleEndTimestamp(a) - getBattleEndTimestamp(b));

    const open = liveBattles
      .filter(item => getBattleFeedType(item) === 'open')
      .sort((a, b) => getBattleEndTimestamp(a) - getBattleEndTimestamp(b));

    const finished = liveBattles
      .filter(item => getBattleFeedType(item) === 'finished')
      .sort((a, b) => getBattleEndTimestamp(b) - getBattleEndTimestamp(a));

    const trending = [...liveBattles].sort((a, b) => {
      const participantDelta =
        Number(b.totalParticipants || 0) - Number(a.totalParticipants || 0);
      if (participantDelta !== 0) return participantDelta;
      return Number(b.stakeAmount || 0) - Number(a.stakeAmount || 0);
    });

    return {
      live,
      open,
      trending,
      finished,
    };
  }, [liveBattles]);

  const visibleBattleCards = useMemo(() => {
    const activeCards = battleFeedCards[activeExploreTab] || [];
    if (activeCards.length > 0) {
      return activeCards;
    }

    return battleFeedCards.trending || [];
  }, [activeExploreTab, battleFeedCards]);

  const updateSelectedBattleOption = useCallback((battleId, optionLabel) => {
    if (!battleId || !optionLabel) {
      return;
    }

    setSelectedBattleOptions(prev => ({
      ...prev,
      [battleId]: optionLabel,
    }));
  }, []);

  const battleCard = useCallback(
    (battleItem, selectedOption) => {
      navigation.navigate('ProfileMain', {
        screen: 'BattleInProgress',
        params: {
          battleId: battleItem?.id,
          battle: battleItem,
          entryPoint: 'search',
          selectedOption:
            selectedOption || selectedBattleOptions[battleItem?.id] || '',
        },
      });
    },
    [navigation, selectedBattleOptions],
  );

  return (
    <>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={[styles.container, bgStyle]}>
          {/* 🔍 Search bar */}
          <View style={styles.searchContainer}>
            <Icon
              name="search"
              size={20}
              color="#999"
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search users..."
              placeholderTextColor="#999"
              value={searchText}
              onChangeText={handleSearch}
              returnKeyType="search"
              onSubmitEditing={Keyboard.dismiss}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <Icon
                  name="close-circle"
                  size={20}
                  color="#999"
                  style={{ marginLeft: 8 }}
                />
              </TouchableOpacity>
            )}
          </View>

          {!isSearchActive && (
            <View>
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingTop: 2,
                  paddingBottom: 10,
                }}
              >
                {/* <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '800',
                    color: '#111827',
                  }}
                >
                  Battle Feed
                </Text> */}
                {/* <Text
                  style={{
                    fontSize: 13,
                    lineHeight: 19,
                    color: '#6B7280',
                    marginTop: 4,
                    marginBottom: 12,
                  }}
                >
                  Browse live, open, trending, and finished battles like a
                  discover feed.
                </Text> */}
{/* 
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    gap: 10,
                    paddingRight: 12,
                  }}
                >
                  {BATTLE_FEED_FILTERS.map(filter => {
                    const isActive = activeExploreTab === filter.key;
                    return (
                      <TouchableOpacity
                        key={filter.key}
                        activeOpacity={0.88}
                        onPress={() => setActiveExploreTab(filter.key)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: 999,
                          backgroundColor: isActive ? '#111827' : '#F3F4F6',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '800',
                            color: isActive ? '#FFFFFF' : '#374151',
                          }}
                        >
                          {filter.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView> */}
              </View>

              {true && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingHorizontal: 12,
                    paddingBottom: 4,
                    gap: 10,
                  }}
                >
                  {loadingLiveBattles ? (
                    <View
                      style={[
                        styles.card,
                        { alignItems: 'center', justifyContent: 'center' },
                      ]}
                    >
                      <ActivityIndicator size="small" color="#999" />
                    </View>
                  ) : visibleBattleCards.length > 0 ? (
                    visibleBattleCards.map(item => (
                      <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.85}
                        style={styles.card}
                        onPress={() => battleCard(item)}
                      >
                        {item.format === 'POLL' ? (
                          <>
                            <View style={styles.pollHeader}>
                              <View style={styles.pollCreatorRow}>
                                {renderBattleAvatar(
                                  item.creator.avatar,
                                  item.creator.name,
                                  styles.pollAvatar,
                                  styles.pollAvatarFallback,
                                  styles.pollAvatarFallbackText,
                                )}
                                <View style={styles.pollCreatorText}>
                                  <Text
                                    numberOfLines={1}
                                    style={styles.pollCreatorName}
                                  >
                                    {item.creator.name}
                                  </Text>
                                  <Text
                                    numberOfLines={1}
                                    style={styles.pollCreatorHandle}
                                  >
                                    @{item.creator.userName}
                                  </Text>
                                </View>
                              </View>

                              <View style={styles.pollFormatPill}>
                                <Text style={styles.pollFormatText}>
                                  {item.format}
                                </Text>
                              </View>
                            </View>

                            <Text numberOfLines={3} style={styles.pollQuestion}>
                              {item.title}
                            </Text>

                            {item.options?.length > 0 && (
                              <View style={styles.pollOptionsWrap}>
                                {item.options.slice(0, 3).map(option => {
                                  const optionLabel = option?.label || option;
                                  const isSelected =
                                    selectedBattleOptions[item.id] ===
                                    optionLabel;

                                  return (
                                    <TouchableOpacity
                                      key={`${item.id}-${option?.id || optionLabel}`}
                                      activeOpacity={0.9}
                                      style={[
                                        styles.pollOptionChip,
                                        isSelected &&
                                          styles.pollOptionChipSelected,
                                      ]}
                                      onPress={() =>
                                        updateSelectedBattleOption(
                                          item.id,
                                          optionLabel,
                                        )
                                      }
                                    >
                                      <Text
                                        style={[
                                          styles.pollOptionText,
                                          isSelected &&
                                            styles.pollOptionTextSelected,
                                        ]}
                                      >
                                        {optionLabel}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            )}
                          </>
                        ) : (
                          <>
                            {/* Top Row */}
                            <View style={styles.topRow}>
                              {/* User 1 */}
                              <View style={styles.userBox}>
                                {renderBattleAvatar(
                                  item.user1.avatar,
                                  item.user1.name,
                                  styles.avatar,
                                  styles.avatarFallback,
                                  styles.avatarFallbackText,
                                )}
                                <Text numberOfLines={1} style={styles.name}>
                                  {item.user1.name}
                                </Text>
                                {!!item.user1.userName && (
                                  <Text
                                    numberOfLines={1}
                                    style={styles.handleText}
                                  >
                                    @{item.user1.userName}
                                  </Text>
                                )}
                              </View>

                              {/* VS */}
                              <Text style={styles.vs}>⚔️</Text>

                              {/* User 2 */}
                              <View style={styles.userBox}>
                                {renderBattleAvatar(
                                  item.user2.avatar,
                                  item.user2.name,
                                  styles.avatar,
                                  styles.avatarFallback,
                                  styles.avatarFallbackText,
                                )}
                                <Text numberOfLines={1} style={styles.name}>
                                  {item.user2.name}
                                </Text>
                                {!!item.user2.userName && (
                                  <Text
                                    numberOfLines={1}
                                    style={styles.handleText}
                                  >
                                    @{item.user2.userName}
                                  </Text>
                                )}
                              </View>
                            </View>

                            {/* Title */}
                            <Text numberOfLines={2} style={styles.title}>
                              {item.title}
                            </Text>

                            {item.options?.length > 0 && (
                              <View style={styles.headToHeadOptionsWrap}>
                                {item.options.slice(0, 2).map(option => {
                                  const optionLabel = option?.label || option;
                                  const isSelected =
                                    selectedBattleOptions[item.id] ===
                                    optionLabel;

                                  return (
                                    <TouchableOpacity
                                      key={`${item.id}-${option?.id || optionLabel}`}
                                      activeOpacity={0.9}
                                      style={[
                                        styles.headToHeadOptionButton,
                                        isSelected &&
                                          styles.headToHeadOptionButtonSelected,
                                      ]}
                                      onPress={() =>
                                        updateSelectedBattleOption(
                                          item.id,
                                          optionLabel,
                                        )
                                      }
                                    >
                                      <Text
                                        style={[
                                          styles.headToHeadOptionText,
                                          isSelected &&
                                            styles.headToHeadOptionTextSelected,
                                        ]}
                                      >
                                        {optionLabel}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            )}
                          </>
                        )}

                        <View style={styles.battleMetaRow}>
                          <Text style={styles.battleMetaText}>
                            Stake: {formatAmount(item.stakeAmount || 0)}
                          </Text>
                          {item.format === 'POLL' && (
                            <Text style={styles.battleMetaText}>
                              Ends date: {formatBattleDate(item.endTime)}
                            </Text>
                          )}
                        </View>

                        {/* <TouchableOpacity
                          activeOpacity={0.88}
                          style={styles.battlePrimaryAction}
                          onPress={() =>
                            battleCard(
                              item,
                              selectedBattleOptions[item.id] || '',
                            )
                          }
                        >
                          <Text style={styles.battlePrimaryActionText}>
                            {item.format === 'HEAD_TO_HEAD'
                              ? 'Join Battle'
                              : 'Vote Now'}
                          </Text>
                        </TouchableOpacity> */}

                        <View style={styles.battleFooterDivider} />
                        <View style={styles.battleStatsRow}>
                          <View style={styles.battleStatItem}>
                            <Icon
                              name="people-outline"
                              size={16}
                              color="#6B7280"
                            />
                            <Text style={styles.battleStatText}>
                              {formatBattleCount(item.totalParticipants)}
                            </Text>
                          </View>
                          <Text style={styles.battleStatDot}>•</Text>
                          {/* <View style={styles.battleStatItem}>
                            <Icon
                              name="thumbs-up-outline"
                              size={15}
                              color="#6B7280"
                            />
                            <Text style={styles.battleStatText}>
                              {formatBattleCount(item.totalLikes)}
                            </Text>
                          </View>
                          <Text style={styles.battleStatDot}>•</Text> */}
                          <View style={styles.battleStatItem}>
                            <Icon
                              name="chatbox-ellipses-outline"
                              size={15}
                              color="#6B7280"
                            />
                            <Text style={styles.battleStatText}>
                              {formatBattleCount(item.totalComments)}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={[styles.card, { justifyContent: 'center' }]}>
                      <Text
                        numberOfLines={2}
                        style={[styles.title, { textAlign: 'center' }]}
                      >
                        No battles found
                      </Text>
                    </View>
                  )}
                </ScrollView>
              )}
            </View>
          )}

          {searchText.trim().length > 0 ? (
            <View style={styles.resultsContainer}>
              {isSearching ? (
                renderLoadingState()
              ) : filteredUsers.length > 0 ? (
                <FlatList
                  data={filteredUsers}
                  keyExtractor={(item, idx) => String(item.id ?? idx)}
                  renderItem={isGrid ? renderGridItem : renderListItem}
                  showsVerticalScrollIndicator={false}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                    />
                  }
                  ListHeaderComponent={renderListHeader}
                  contentContainerStyle={styles.listContent}
                  numColumns={isGrid ? 2 : 1}
                  key={isGrid ? 'grid' : 'list'}
                  columnWrapperStyle={isGrid ? styles.gridRow : null}
                  initialNumToRender={10}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  removeClippedSubviews={Platform.OS === 'android'}
                />
              ) : hasSearched ? (
                renderEmptyState()
              ) : null}
            </View>
          ) : null}

          {/* 🔲 Masonry Grid of posts — Show by default when no search is active */}
          {searchText.trim().length === 0 ? (
            posts.length > 0 ? (
              <View style={styles.masonryWrapper}>
                <FlatList
                  data={masonryItems}
                  renderItem={({ item }) => renderMasonryItem(item)}
                  keyExtractor={(item, idx) =>
                    item?.post?.id
                      ? `${item.post.id}-${idx}-${item.columnIndex}`
                      : `masonry-${idx}`
                  }
                  showsVerticalScrollIndicator={false}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                    />
                  }
                  contentContainerStyle={[
                    styles.masonryContainer,
                    { height: masonryLayout.maxHeight },
                  ]}
                  removeClippedSubviews={true}
                  initialNumToRender={12}
                  windowSize={10}
                  onScroll={onMasonryScroll}
                  scrollEventThrottle={16}
                />
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Icon name="images-outline" size={60} color="#ddd" />
                <Text style={styles.emptyTitle}>No posts available</Text>
              </View>
            )
          ) : null}
        </View>
      </TouchableWithoutFeedback>

      {previewVisible && previewPost ? (
        <Modal
          visible={previewVisible}
          transparent
          animationType="fade"
          onRequestClose={closePreview}
          onDismiss={closePreview}
        >
          <View style={styles.previewOverlay}>
            <TouchableWithoutFeedback onPress={closePreview}>
              <View style={styles.previewBackdrop} />
            </TouchableWithoutFeedback>

            <View style={styles.previewContent}>
              <View style={styles.previewMediaWrapper}>
                {previewMediaUrl ? (
                  previewIsVideo ? (
                    <Video
                      source={{ uri: previewMediaUrl }}
                      style={styles.previewMedia}
                      resizeMode="cover"
                      repeat
                      controls
                      paused={false}
                      muted={false}
                    />
                  ) : (
                    <Image
                      source={{ uri: previewMediaUrl }}
                      style={styles.previewMedia}
                      resizeMode="cover"
                    />
                  )
                ) : (
                  <View style={styles.previewFallback}>
                    <Text style={styles.previewFallbackText}>
                      Preview unavailable
                    </Text>
                  </View>
                )}
              </View>

              {/* <TouchableOpacity style={styles.previewCloseButton} onPress={closePreview}>
                {/* <Icon name="close" size={26} color="#fff" /> */}
              {/* </TouchableOpacity>  */}
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
};

// const localStyles = StyleSheet.create({
//   masonryWrapper: {
//     flex: 1,
//     width: SCREEN_WIDTH,
//     marginLeft: -12, // Offset container padding
//     marginRight: -12, // Offset container padding
//   },
//   masonryContainer: {
//     position: 'relative',
//     width: SCREEN_WIDTH,
//     paddingBottom: 10,
//   },
//   previewOverlay: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   previewBackdrop: {
//     position: 'absolute',
//     top: 0,
//     bottom: 0,
//     left: 0,
//     right: 0,
//     backgroundColor: 'rgba(0,0,0,0.85)',
//   },
//   previewContent: {
//     width: '100%',
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   previewMediaWrapper: {
//     width: SCREEN_WIDTH * 0.92,
//     maxHeight: SCREEN_HEIGHT * 0.85,
//     borderRadius: 18,
//     overflow: 'hidden',
//     backgroundColor: '#000',
//   },
//   previewMedia: {
//     width: '100%',
//     height: SCREEN_HEIGHT * 0.75,
//   },
//   previewFallback: {
//     width: '100%',
//     height: SCREEN_HEIGHT * 0.75,
//     alignItems: 'center',
//     justifyContent: 'center',
//     backgroundColor: '#222',
//   },
//   previewFallbackText: {
//     color: '#fff',
//     fontSize: 16,
//   },
//   previewCloseButton: {
//     position: 'absolute',
//     top: 40,
//     right: 24,
//     zIndex: 2,
//   },
//   masonryItem: {
//     borderRadius: 2,
//     overflow: 'hidden',
//     backgroundColor: '#f0f0f0',
//   },
//   gridItem: {
//     margin: 1,
//     borderRadius: 2,
//     overflow: 'hidden',
//     backgroundColor: '#f0f0f0',
//     width: (SCREEN_WIDTH - 32 - 6) / 3,
//     height: (SCREEN_WIDTH - 32 - 6) / 3,
//   },
//   media: {
//     width: '100%',
//     height: '100%',
//   },
//   videoIconOverlay: {
//     position: 'absolute',
//     top: 6,
//     right: 6,
//     backgroundColor: 'rgba(0,0,0,0.5)',
//     borderRadius: 4,
//     padding: 4,
//   },
//   emptyContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     paddingTop: 100,
//   },
//   emptyTitle: {
//     fontSize: 16,
//     color: '#666',
//     marginTop: 10,
//   },

// });

export default SearchScreen;
