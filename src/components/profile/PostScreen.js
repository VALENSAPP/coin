import { useNavigation } from '@react-navigation/native';
import React, { useState, useEffect, useCallback, memo, useRef, useMemo } from 'react';
import {
  Alert,
  View,
  FlatList,
  Image,
  StyleSheet,
  Dimensions,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import Video from 'react-native-video';
import { useAppTheme } from '../../theme/useApptheme';
import { getProgressBarColor } from '../../utils/progressBarUtils';
import { getTotalDonationAmount } from '../../services/tokens';
import { pinPost, unpinPost } from '../../services/post';
import { isPostPinned, setPostPinnedState, sortPostsByPinned } from '../../utils/postPinning';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useLanguage } from '../../i18n';

const { width: screenWidth } = Dimensions.get('window');
const numColumns = 3;
const SPACING = 1;
const IMAGE_SIZE = (screenWidth - SPACING * (numColumns - 1)) / numColumns;

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
  const progressPercent = goalAmount > 0 ? (currentRaised / goalAmount) * 100 : 0;

  let daysLeft = 0;
  if (post?.end_time) {
    try {
      const end = new Date(post.end_time);
      const start = post?.start_time ? new Date(post.start_time) : null;
      const now = new Date();

      if (!Number.isNaN(end.getTime())) {
        const baseline = start && !Number.isNaN(start.getTime()) && now < start ? start : now;
        const diff = end - baseline;
        daysLeft = diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
      }
    } catch (err) {
      daysLeft = 0;
    }
  }

  return { goalAmount, currentRaised, progressPercent, daysLeft };
};

const formatAmount = (value) =>
  parseNonNegativeNumber(value, 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

const MissionProgressBar = ({ progressPercent = 0, goalAmount = 0, currentRaised = 0, daysLeft = 0, profile = 'user' }) => {
  const fillColor = getProgressBarColor(progressPercent, profile);
  const normalizedProgress = Math.min(progressPercent, 100);

  return (
    <View style={styles.progressSection}>
      <View style={styles.progressBarWrapper}>
        <View style={styles.progressBarBackground}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.min(progressPercent, 100)}%`, backgroundColor: fillColor },
            ]}
          />
        </View>

        <View style={styles.progressStatsContainer}>
          <View style={styles.statAtStart}>
            <Text style={styles.statValueSmall} numberOfLines={2} ellipsizeMode="clip">{normalizedProgress.toFixed(1)}% FUNDED</Text>
          </View>
          <View style={styles.statAtCenter}>
            <Text style={[styles.statValueSmall,]} numberOfLines={2} ellipsizeMode="clip">${formatAmount(currentRaised)}/ ${formatAmount(goalAmount)} {'\n'}  RAISED</Text>
          </View>
          <View style={styles.statAtEnd}>
            <Text style={styles.statValueSmall} numberOfLines={2} ellipsizeMode="clip">{daysLeft} DAYS LEFT</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

// URL normalization function
const normalizeImageUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('/')) return `https://api.valens.app${trimmed}`;
  return `https://api.valens.app/${trimmed}`;
};

const isVideoUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return /\.(mp4|mov|avi|mkv|webm|m4v|3gp)(\?|$)/i.test(url);
};

const getPreviewMedia = (post) => {
  const mediaUrl = post?.images?.[0] || post?.image || post?.video;

  const thumbnailUrl = normalizeImageUrl(
    post?.thumbnails?.[0] ||
    post?.thumbnail ||
    post?.poster
  );

  const isVideo =
    post?.type === 'reel' ||
    /\.(mp4|mov|avi|mkv|webm|m4v|3gp)(\?|$)/i.test(mediaUrl || '');

  return {
    mediaUrl,
    thumbnailUrl,
    isVideo,
  };
};

const getImagePosts = postList =>
  (Array.isArray(postList) ? postList : []).filter((post) => {
    const type = String(post?.type || '').toLowerCase();

    return (
      type !== 'private' &&
      type !== 'reel'
    );
  });

// Memoized image component for better performance
const PostImage = memo(({ item, index, onPress, themeTextStyle }) => {
  const [imageError, setImageError] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const { mediaUrl, thumbnailUrl, isVideo } = getPreviewMedia(item);

  if (isVideo) {
    return (
      <View style={styles.image}>
        <Image
          source={{ uri: thumbnailUrl }}
          style={styles.image}
          resizeMode="cover"
        />

        <View
          style={[
            styles.videoBadge,
            {
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: [{ translateX: -15 }, { translateY: -15 }],
            },
          ]}
        >
          <Text style={styles.videoBadgeText}>▶</Text>
        </View>
      </View>
    );
  }

  if (!mediaUrl || imageError) {
    return (
      <View style={[styles.image, styles.placeholderImage]}>
        <Text style={[styles.placeholderText, themeTextStyle]}>📷</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: mediaUrl }}
      style={styles.image}
      resizeMode="cover"
      onError={() => setImageError(true)}
      onLoad={() => setImageError(false)}
    />
  );
});

PostImage.displayName = 'PostImage';

const PostScreen = memo(({ scrollEnabled = true, postCheck, userData: propUserData, isOwnProfile = false, onPostPinChanged, activeMediaFilter = 'photo' }) => {
  const [posts, setPosts] = useState([]);
  const [donationTotals, setDonationTotals] = useState({});
  const pinningPostIdRef = useRef('');
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useLanguage();
  const userData = route?.params?.userData || propUserData;
  const { bgStyle, textStyle, text } = useAppTheme(userData?.profile);

  // ✅ Move ALL hooks/useMemo/useCallback BEFORE any early returns
  const filteredPosts = useMemo(() => {
    if (activeMediaFilter === 'video') return posts.filter((post) => isVideoUrl(post?.images?.[0] || post?.image || post?.video));
    if (activeMediaFilter === 'ebook') return posts.filter((post) => /\.pdf(\?|$)/i.test(String(post?.images?.[0] || post?.image || post?.video || '')) || ['ebook', 'book'].includes(String(post?.type || post?.format || '').toLowerCase()));
    // if (activeMediaFilter === 'reel') return posts.filter((post) => String(post?.type || '').toLowerCase() === 'reel');
    // if (activeMediaFilter === 'all') return posts;
    return posts.filter((post) => !isVideoUrl(post?.images?.[0] || post?.image || post?.video) && !(/\.pdf(\?|$)/i.test(String(post?.images?.[0] || post?.image || post?.video || ''))));
  }, [activeMediaFilter, posts]);

  const rows = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < filteredPosts.length; i += numColumns) {
      chunks.push(filteredPosts.slice(i, i + numColumns));
    }
    return chunks;
  }, [filteredPosts]);

  const calculatedHeight = useMemo(() => {
    return Math.ceil(filteredPosts.length / numColumns) * (IMAGE_SIZE + SPACING) + 120;
  }, [filteredPosts.length]);

  useEffect(() => {
    setPosts(sortPostsByPinned(getImagePosts(postCheck)));
  }, [postCheck]);

  useEffect(() => {
    let isActive = true;
    const fetchDonationTotals = async () => {
      const missionPostIds = [
        ...new Set(
          (posts || [])
            .filter(post =>
              post?.id &&
              (post?.isMission === true || post?.type === 'crowdfunding' || Number(post?.raiseAmount) > 0),
            )
            .map(post => String(post.id)),
        ),
      ];
      if (missionPostIds.length === 0) {
        if (isActive) setDonationTotals({});
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
      setDonationTotals(nextTotals);
    };
    fetchDonationTotals();
    return () => { isActive = false; };
  }, [posts]);

  const openPosts = useCallback((index) => {
    const selectedPost = posts?.[index];
    if (!selectedPost) return;
    const { isVideo } = getPreviewMedia(selectedPost);
    // if (isVideo) {
    //   navigation.getParent().navigate('ProfileMain', {
    //     screen: 'FlipsScreen',
    //     params: { item: selectedPost, key: Date.now().toString() },
    //   });
    //   return;
    // }
    navigation.getParent().navigate('ProfileMain', {
      screen: 'PostView',
      params: { postData: filteredPosts, startIndex: index, hideTabBar: true, userData },
    });
  }, [navigation, filteredPosts, userData]);

  const handleTogglePinPost = useCallback(async (post) => {
    const postId = String(post?.id || post?._id || '');
    if (!isOwnProfile || !postId || pinningPostIdRef.current) return;
    const nextPinned = !isPostPinned(post);
    pinningPostIdRef.current = postId;
    try {
      const payload = { postId };
      if (nextPinned) await pinPost(payload);
      else await unpinPost(payload);
      setPosts(prevPosts => setPostPinnedState(prevPosts, postId, nextPinned));
      const refreshedPosts = await onPostPinChanged?.(postId, nextPinned);
      if (Array.isArray(refreshedPosts)) setPosts(sortPostsByPinned(getImagePosts(refreshedPosts)));
    } catch (error) {
      Alert.alert(
        nextPinned ? t('postScreen.unableToPinTitle') : t('postScreen.unableToUnpinTitle'),
        error?.response?.data?.message || error?.message || t('postScreen.tryAgain'),
      );
    } finally {
      pinningPostIdRef.current = '';
    }
  }, [isOwnProfile, onPostPinChanged, t]);

  const confirmTogglePinPost = useCallback((post) => {
    if (!isOwnProfile) return;
    const pinned = isPostPinned(post);
    Alert.alert(
      pinned ? t('postScreen.unpinPost') : t('postScreen.pinPost'),
      pinned ? t('postScreen.unpinConfirm') : t('postScreen.pinConfirm'),
      [
        { text: t('postScreen.cancel'), style: 'cancel' },
        {
          text: pinned ? t('postScreen.unpin') : t('postScreen.pin'),
          onPress: () => handleTogglePinPost(post),
        },
      ],
    );
  }, [handleTogglePinPost, isOwnProfile, t]);

  const renderEmptyComponent = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyTitle, textStyle]}>{t('postScreen.noPostsTitle')}</Text>
      <Text style={styles.emptySubtitle}>{t('postScreen.noPostsSubtitle')}</Text>
    </View>
  ), [textStyle, t]);

  // ✅ Early return AFTER all hooks
  if (!posts || posts.length === 0) {
    return (
      <View style={styles.screen}>
        {renderEmptyComponent()}
      </View>
    );
  }

  return (
    <View style={[styles.screen, bgStyle, { height: calculatedHeight }]}>
      <View style={[styles.grid, { height: calculatedHeight }]}>
        {rows.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.row}>
            {row.map((item, colIndex) => {
              const index = rowIndex * numColumns + colIndex;
              const isMissionPost =
                item?.isMission === true ||
                item?.type === 'crowdfunding' ||
                Number(item?.raiseAmount) > 0;
              const raisedAmount = donationTotals[String(item?.id)];
              const stats = isMissionPost ? calculateMissionStats(item, raisedAmount) : null;

              return (
                <TouchableOpacity
                  key={item.id?.toString()}
                  style={[
                    styles.imageContainer,
                    colIndex === 0 ? { marginLeft: 0 } : { marginLeft: SPACING },
                  ]}
                  activeOpacity={0.95}
                  onPress={() => openPosts(index)}
                  onLongPress={() => confirmTogglePinPost(item)}
                  delayLongPress={450}
                >
                  <PostImage item={item} index={index} themeTextStyle={textStyle} />
                  <View style={styles.overlay} />
                  {isPostPinned(item) && (
                    <View style={styles.pinnedBadge}>
                      <Ionicons name="pin" size={12} color="#FFFFFF" />
                      <Text style={styles.pinnedBadgeText}>{t('postScreen.pinned')}</Text>
                    </View>
                  )}
                  {isMissionPost && stats && (
                    <View style={styles.missionBadgeWrapper}>
                      <MissionProgressBar
                        progressPercent={stats.progressPercent}
                        goalAmount={stats.goalAmount}
                        currentRaised={stats.currentRaised}
                        daysLeft={stats.daysLeft}
                        profile={item?.profile}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            {row.length < numColumns &&
              Array(numColumns - row.length).fill(null).map((_, i) => (
                <View key={`empty-${i}`} style={[styles.imageContainer, { marginLeft: SPACING }]} />
              ))}
          </View>
        ))}
      </View>
    </View>
  );
});

PostScreen.displayName = 'PostScreen';

export default PostScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  listContent: {
    paddingHorizontal: SPACING,
    paddingBottom: 120,                 // ✅ breathing room at bottom
    flexGrow: 1,                        // 👈 add this
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    marginBottom: SPACING,
    width: screenWidth,   // 👈 ensure row takes full screen width
  },
  grid: {
    flexDirection: 'column',
    paddingBottom: 120,
    width: screenWidth,   // 👈 ensure grid takes full screen width
  },
  imageContainer: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: IMAGE_SIZE,    // 👈 must match IMAGE_SIZE exactly
    height: IMAGE_SIZE,   // 👈 must match IMAGE_SIZE exactly
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(90, 45, 130, 0.08)', // subtle purple tint
    opacity: 0,
  },
  pinnedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.82)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
    gap: 3,
  },
  pinnedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  missionBadgeWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 10,
  },
  progressSection: {
    marginTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  progressBarWrapper: {
    position: 'relative',
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#4B5563',
    overflow: 'hidden',
    marginBottom: 8,
    borderRadius: 3,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  statAtStart: {
    flex: 1,
    alignItems: 'flex-start',
  },
  statAtCenter: {
    flex: 1,
    alignItems: 'center',
  },
  statAtEnd: {
    flex: 1,
    alignItems: 'flex-end',
  },
  statValueSmall: {
    fontSize: 7,
    fontWeight: '400',
    color: '#FFFFFF',

  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3e9fb', // soft purple pastel
  },
  videoPlaceholderOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3e9fb',
  },
  placeholderText: {
    fontSize: 22,
    opacity: 0.6,
    textAlign: 'center',
    includeFontPadding: false,
  },
  videoBadge: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  videoBadgeOverlay: {
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },

  // --- Empty State ---
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: '25%'
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
});
