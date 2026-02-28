import React, { memo, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Video from 'react-native-video';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../theme/useApptheme';
import { getPostByUser } from '../../services/post';

const { width: screenWidth } = Dimensions.get('window');
const numColumns = 3;
const SPACING = 2;
const IMAGE_SIZE = (screenWidth - SPACING * (numColumns + 1)) / numColumns;

const normalizeImageUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) return `http://35.174.167.92:3002${trimmed}`;
  return `http://35.174.167.92:3002/${trimmed}`;
};

const isVideoUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return /\.(mp4|mov|avi|mkv|webm|m4v)(\?|$)/i.test(url);
};

const PostImage = memo(({ item }) => {
  const mediaUrl = normalizeImageUrl(item?.images?.[0]);
  const isVideo = isVideoUrl(item?.images?.[0]);
  const { textStyle } = useAppTheme();
  const [imageError, setImageError] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);

  
  if (!mediaUrl) {
    return (
      <View style={[styles.image, styles.placeholderImage]}>
        <Text style={[styles.placeholderText, textStyle]}>📷</Text>
      </View>
    );
  }

  if (isVideo) {
    return (
      <View style={[styles.image, styles.placeholderImage]}>
        <Video
          source={{ uri: mediaUrl }}
          style={StyleSheet.absoluteFill}
          paused={true}
          muted={true}
          resizeMode="cover"
          onLoad={() => setIsVideoLoading(false)}
          onError={() => {
            setVideoError(true);
            setIsVideoLoading(false);
          }}
          playInBackground={false}
        />

        {(isVideoLoading || videoError) && (
          <View style={[StyleSheet.absoluteFill, styles.placeholderImage]}>
            <Text style={[styles.placeholderText, textStyle]}>🎬</Text>
          </View>
        )}

        {!isVideoLoading && !videoError && (
          <View style={styles.videoBadge}>
            <Text style={styles.videoBadgeText}>▶</Text>
          </View>
        )}
      </View>
    );
  }

  if (imageError) {
    return (
      <View style={[styles.image, styles.placeholderImage]}>
        <Text style={[styles.placeholderText, textStyle]}>📷</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: mediaUrl }}
      style={styles.image}
      resizeMode="cover"
      onError={() => setImageError(true)}
    />
  );
});

const ItemSeparator = memo(() => <View style={styles.itemSeparator} />);

const PrivateContentScreen = ({ postCheck, userData, isSubscribed, loggedInUserId }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const { bgStyle, textStyle, text } = useAppTheme();
  const normalizedIsSubscribed =
    isSubscribed === true ||
    String(isSubscribed || '').toUpperCase() === 'ACTIVE' ||
    String(isSubscribed || '').toLowerCase() === 'true';
  const isOwnProfile = String(loggedInUserId || '') === String(userData?.id || '');
  const canViewPrivateContent = isOwnProfile || normalizedIsSubscribed;

  useEffect(() => {
    if (userData?.id && canViewPrivateContent) {
      fetchPosts(userData.id);
    } else {
      setPosts([]);
      setLoading(false);
    }
  }, [userData?.id, canViewPrivateContent]);

  const fetchPosts = async (id) => {
    try {
      setLoading(true);
      const response = await getPostByUser(id, 'private');
      const formattedData = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response)
          ? response
          : [];
      setPosts(formattedData);
    } catch (error) {
      // console.log('Fetch posts error:', error?.message);
      console.log(error);
      
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const openPosts = useCallback(
    (index) => {
      navigation.getParent().navigate('ProfileMain', {
        screen: 'PostView',
        params: {
          postData: posts,
          startIndex: index,
          hideTabBar: true,
        },
      });
    },
    [navigation, posts]
  );

  const renderItem = useCallback(({ item, index }) => {
    return (
      <TouchableOpacity
        style={[
          styles.imageContainer,
          index % numColumns === 0 ? styles.firstColumn : styles.otherColumn,
          { shadowColor: text },
        ]}
        activeOpacity={0.95}
        onPress={() => openPosts(index)}
      >
        <PostImage item={item} />
        <View style={styles.overlay} />
      </TouchableOpacity>
    );
  }, [openPosts, text]);

  const keyExtractor = useCallback(
    (item, index) => item?.id?.toString() || index.toString(),
    []
  );

  const getItemLayout = useCallback((data, index) => ({
    length: IMAGE_SIZE + SPACING,
    offset: (IMAGE_SIZE + SPACING) * Math.floor(index / numColumns),
    index,
  }), []);

  const renderEmptyComponent = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyTitle, textStyle]}>No private posts yet</Text>
      <Text style={styles.emptySubtitle}>Private content will appear here</Text>
    </View>
  ), [textStyle]);

  if (loading) {
    return (
      <View style={[styles.loaderContainer, bgStyle]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.screen, bgStyle]}>
      {!canViewPrivateContent ?
      <>
      <View style={[styles.screen, bgStyle, styles.lockedContainer]}>
        <View style={styles.lockedCard}>
          <Text style={styles.lockedIcon}>🔒</Text>
          <Text style={[styles.lockedTitle, textStyle]}>
            Subscribe to unlock private content
          </Text>
          <Text style={styles.lockedSubtitle}>
            Exclusive posts are available only for active subscribers.
          </Text>
        </View>
      </View>
      </>
      :
      <FlatList
        data={posts}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={numColumns}
        ListEmptyComponent={renderEmptyComponent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          posts.length === 0 && styles.emptyListContent,
        ]}
        ItemSeparatorComponent={ItemSeparator}
        removeClippedSubviews
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={5}
        getItemLayout={getItemLayout}
        updateCellsBatchingPeriod={50}
        disableVirtualization={false}
      />
}
    </View>
  );
};

export default memo(PrivateContentScreen);
const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  listContent: {
    padding: SPACING,
    paddingBottom: 100,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  itemSeparator: {
    height: SPACING,
  },
  imageContainer: {
    marginBottom: SPACING,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginRight: 7,
    marginTop: 5,
  },
  firstColumn: {
    marginLeft: 0,
  },
  otherColumn: {
    marginLeft: SPACING,
  },
  image: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
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
    fontSize: 22,
    opacity: 0.6,
  },
  videoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
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
  lockedContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  lockedCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  lockedIcon: {
    fontSize: 28,
    marginBottom: 10,
  },
  lockedTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  lockedSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
