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
import Video from 'react-native-video';

const { width: screenWidth } = Dimensions.get('window');
const numColumns = 3;
const SPACING = 2;
const IMAGE_SIZE = (screenWidth - SPACING * (numColumns + 1)) / numColumns;

// URL normalization function
const normalizeImageUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('/')) return `http://35.174.167.92:3002${trimmed}`;
  return `http://35.174.167.92:3002/${trimmed}`;
};

// Check if URL is a video (mp4, mov, avi, etc.)
const isVideoUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext));
};

// Memoized image component for better performance
const PostImage = memo(({ item, index, onPress, themeTextStyle }) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = normalizeImageUrl(item?.images?.[0]);
  const isVideo = isVideoUrl(item?.images?.[0]);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);

  // Show placeholder for videos (camera icon)
  if (isVideo) {
    return (
      <View style={[styles.image, styles.placeholderImage]}>
        <Video
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
          paused={true}
          muted={true}
          resizeMode="cover"
          onLoad={() => setIsVideoLoading(false)} // Hide fallback when video loads
          onError={() => {
            setVideoError(true);
            setIsVideoLoading(false);
          }}
          playInBackground={false}
        />

        {/* FALLBACK / LOADING ICON: Shown while loading OR if error occurs */}
        {isVideoLoading && (
          <View style={[StyleSheet.absoluteFill, styles.placeholderImage]}>
            <Text style={[styles.placeholderText, themeTextStyle]}>🎬</Text>
          </View>
        )}

        {/* Play Icon Badge (only if loaded successfully) */}
        {!isVideoLoading && (
          <View style={styles.videoBadge}>
            <Text style={styles.videoBadgeText}>▶</Text>
          </View>
        )}
      </View>
    );
  }

  // 2. Final Fallback (if video error occurred OR it's a standard image)
  return (
    <View style={styles.image}>
      <Image
        source={{ uri: imageUrl }}
        style={styles.image}
        resizeMode="cover"
        onError={() => setVideoError(true)}
      />
      {/* If there's an error loading the image or video fallback, show the placeholder */}
      {(videoError || !imageUrl) && (
        <View style={[StyleSheet.absoluteFill, styles.placeholderImage]}>
          <Text style={[styles.placeholderText, themeTextStyle]}>🎬</Text>
        </View>
      )}
    </View>
  );
});

PostImage.displayName = 'PostImage';

const ReelsScreen = memo(({ postCheck, userData }) => {
  const [posts, setPosts] = useState([]);
  const navigation = useNavigation();
  const { bgStyle, textStyle, text } = useAppTheme(userData?.profile);

  useEffect(() => {
    // Filter posts to only show those with MP4 videos
    if (postCheck && Array.isArray(postCheck)) {
      const videoPosts = postCheck.filter(post => {
        const firstImage = post?.images?.[0];
        return firstImage && isVideoUrl(firstImage);
      });
      setPosts(videoPosts);
    }
  }, [postCheck]);

  const openPosts = useCallback((index) => {
    navigation.getParent().navigate('ProfileMain', {
      screen: 'PostView',
      params: {
        postData: posts,
        startIndex: index,
      },
    });
  }, [navigation, posts]);

  const renderItem = useCallback(({ item, index }) => (
    <TouchableOpacity
      style={[
        styles.imageContainer,
        { marginLeft: index % numColumns === 0 ? 0 : SPACING, shadowColor: text },
      ]}
      activeOpacity={0.95}
      onPress={() => openPosts(index)}
    >
      <PostImage item={item} index={index} themeTextStyle={textStyle} />
      <View style={styles.overlay} />
    </TouchableOpacity>
  ), [openPosts, text]);

  const keyExtractor = useCallback((item) => item.id.toString(), []);

  const getItemLayout = useCallback((data, index) => ({
    length: IMAGE_SIZE + SPACING,
    offset: (IMAGE_SIZE + SPACING) * Math.floor(index / numColumns),
    index,
  }), []);

  const renderEmptyComponent = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyTitle, textStyle]}>No video posts yet</Text>
      <Text style={styles.emptySubtitle}>Share your first video moment</Text>
    </View>
  ), [textStyle]);

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
        maxToRenderPerBatch={12}
        windowSize={5}
        initialNumToRender={12}
        getItemLayout={getItemLayout}
        updateCellsBatchingPeriod={50}
        disableVirtualization={false}
      />
    </View>
  );
});

ReelsScreen.displayName = 'ReelsScreen';

export default ReelsScreen;

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
    width: IMAGE_SIZE,
    marginBottom: SPACING,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginRight: 0,
    marginTop: 5
  },
  image: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE*1.5,
    backgroundColor: '#f0f0f0',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(90, 45, 130, 0.08)',
    opacity: 0,
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3e9fb',
  },
  placeholderText: {
    fontSize: 20,
    opacity: 0.7,
  },
  videoBadge: {
    flexDirection:'row',
    justifyContent:'center',
    alignSelf:'center',
    // position: 'absolute',
    // top: 8,
    // right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
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
