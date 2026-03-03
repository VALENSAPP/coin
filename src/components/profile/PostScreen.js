import { useNavigation } from '@react-navigation/native';
import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  FlatList,
  Image,
  StyleSheet,
  Dimensions,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useAppTheme } from '../../theme/useApptheme';
import { getProgressBarColor } from '../../utils/progressBarUtils';

const { width: screenWidth } = Dimensions.get('window');
const numColumns = 3;
const SPACING = 1;
const IMAGE_SIZE = (screenWidth - SPACING * (numColumns + 1)) / numColumns;

const parseNonNegativeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const calculateMissionStats = (post) => {
  const goalAmount =
    parseNonNegativeNumber(post?.raiseAmount, NaN) ||
    parseNonNegativeNumber(post?.goalAmount, NaN) ||
    10000;

  const currentRaised = parseNonNegativeNumber(post?.totalDonation ?? post?.tokenBalance, 0);
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
            <Text style={styles.statValueSmall}>{normalizedProgress.toFixed(1)}% FUNDED</Text>
          </View>
          <View style={styles.statAtCenter}>
            <Text style={[styles.statValueSmall,]}>${formatAmount(currentRaised)} / ${formatAmount(goalAmount)} RAISED</Text>
          </View>
          <View style={styles.statAtEnd}>
            <Text style={styles.statValueSmall}>{daysLeft} DAYS LEFT</Text>
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
  if (trimmed.startsWith('/')) return `http://35.174.167.92:3002${trimmed}`;
  return `http://35.174.167.92:3002/${trimmed}`;
};

const isVideoUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return /\.(mp4|mov|avi|mkv|webm|m4v|3gp)(\?|$)/i.test(url);
};

// Memoized image component for better performance
const PostImage = memo(({ item, index, onPress }) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = normalizeImageUrl(item?.images?.[0]);
  const { bgStyle, textStyle, text } = useAppTheme();
  if (!imageUrl || imageError) {
    return (
      <View style={[styles.image, styles.placeholderImage]}>
        <Text style={[styles.placeholderText, textStyle]}>📷</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: imageUrl }}
      style={styles.image}
      resizeMode="cover"
      onError={() => setImageError(true)}
      onLoad={() => setImageError(false)}
    />
  );
});

PostImage.displayName = 'PostImage';

const PostScreen = memo(({ postCheck, userData }) => {
  console.log(postCheck,'dta is posts ');
  
  const [posts, setPosts] = useState(postCheck);
  const navigation = useNavigation();
  const { bgStyle, textStyle, text } = useAppTheme();

  useEffect(() => {
    const onlyImagePosts = (postCheck || []).filter((post) => {
      const firstMedia = post?.images?.[0] || '';
      return !isVideoUrl(firstMedia);
    });
    setPosts(onlyImagePosts);
  }, [postCheck]);

  const openPosts = useCallback((index) => {
    navigation.getParent().navigate('ProfileMain', {
      screen: 'PostView',
      params: {
        postData: posts,
        startIndex: index,
        hideTabBar: true,      // <<< ADD THIS
      },
    });
  }, [navigation, posts]);


  const renderItem = useCallback(({ item, index }) => {
    const isMissionPost =
      item?.isMission === true ||
      item?.type === 'crowdfunding' ||
      Number(item?.raiseAmount) > 0;
    const stats = isMissionPost ? calculateMissionStats(item) : null;

    return (
      <TouchableOpacity
        style={[
          styles.imageContainer,
          { marginLeft: index % numColumns === 0 ? 0 : SPACING, shadowColor: text },
        ]}
        activeOpacity={0.95}
        onPress={() => openPosts(index)}
      >
        <PostImage item={item} index={index} />
        <View style={styles.overlay} />
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
  }, [openPosts, text]);

  const keyExtractor = useCallback((item) => item.id.toString(), []);

  const getItemLayout = useCallback((data, index) => ({
    length: IMAGE_SIZE + SPACING,
    offset: (IMAGE_SIZE + SPACING) * Math.floor(index / numColumns),
    index,
  }), []);

  const renderEmptyComponent = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyTitle, textStyle]}>No posts yet</Text>
      <Text style={styles.emptySubtitle}>Share your first moment</Text>
    </View>
  ), []);

  if (!posts || posts.length === 0) {
    return (
      <View style={styles.screen}>
        {renderEmptyComponent()}
      </View>
    );
  }

  return (
    <View style={[styles.screen, bgStyle]}>
      <FlatList
        data={posts}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={numColumns}
        ListEmptyComponent={renderEmptyComponent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          posts.length === 0 && styles.emptyListContent,
        ]}
        ItemSeparatorComponent={() => <View style={{ height: SPACING }} />}
        removeClippedSubviews={true}
        maxToRenderPerBatch={12} // Reduced from 21 for better performance
        windowSize={5} // Reduced from 10 for better performance
        initialNumToRender={12} // Reduced from 21 for better performance
        getItemLayout={getItemLayout}
        updateCellsBatchingPeriod={50} // Batch updates for better performance
        disableVirtualization={false} // Keep virtualization enabled
      />
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
    padding: SPACING,
    paddingBottom: 100,
  },
  emptyListContent: {
    flexGrow: 1,
  },

  // --- Grid Images ---
  imageContainer: {
    marginBottom: SPACING,
    borderRadius: 12, // rounded corners
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginRight: 7,
    marginTop: 5
  },
  image: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE*1.2,
    backgroundColor: '#f0f0f0',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(90, 45, 130, 0.08)', // subtle purple tint
    opacity: 0,
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
  placeholderText: {
    fontSize: 22,
    opacity: 0.6,
  },

  // --- Empty State ---
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
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
