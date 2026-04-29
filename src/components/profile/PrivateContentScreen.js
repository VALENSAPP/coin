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
  AppState,
} from 'react-native';
import Video from 'react-native-video';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../theme/useApptheme';
import { getPostByUser } from '../../services/post';
import { getFansubscriptionStatus } from '../../services/stirpe';

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

const PostImage = memo(({ item, themeTextStyle }) => {
  const mediaUrl = normalizeImageUrl(item?.images?.[0]);
  const isVideo = isVideoUrl(item?.images?.[0]);
  const [imageError, setImageError] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);


  if (!mediaUrl) {
    return (
      <View style={[styles.image, styles.placeholderImage]}>
        <Text style={[styles.placeholderText, themeTextStyle]}>📷</Text>
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
          <View style={[StyleSheet.absoluteFill, styles.videoPlaceholderOverlay]}>
            <ActivityIndicator size="large" color="#5A2D82" />
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
        <Text style={[styles.placeholderText, themeTextStyle]}>📷</Text>
      </View>
    );
  }

  return (
    <View style={styles.image}>
      {isImageLoading && (
        <View style={[StyleSheet.absoluteFill, styles.imageLoadingOverlay]}>
          <ActivityIndicator size="large" color="#5A2D82" />
        </View>
      )}
      <Image
        source={{ uri: mediaUrl }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onError={() => {
          setImageError(true);
          setIsImageLoading(false);
        }}
        onLoad={() => setIsImageLoading(false)}
      />
    </View>
  );
});

const ItemSeparator = memo(() => <View style={styles.itemSeparator} />);

const PrivateContentScreen = ({ postCheck, userData, isSubscribed, loggedInUserId, onSubscribePress, isCompany, refreshKey }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [resolvedIsSubscribed, setResolvedIsSubscribed] = useState(false);
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { bgStyle, textStyle, text } = useAppTheme(userData?.profile);
  const normalizedIsSubscribed =
    isSubscribed === true ||
    String(isSubscribed || '').toUpperCase() === 'ACTIVE' ||
    String(isSubscribed || '').toLowerCase() === 'true';
  const isOwnProfile = String(loggedInUserId || '') === String(userData?.id || '');
  const canViewPrivateContent = isOwnProfile || resolvedIsSubscribed;

  const isActiveStatus = useCallback((value) => {
    if (value === true) return true;
    return String(value || '').toUpperCase() === 'ACTIVE';
  }, []);

  const getSubscriptionStatus = useCallback(async (id) => {
    if (!id) return false;
    try {
      const response = await getFansubscriptionStatus(id);
      const data = response?.data;

      if (
        isActiveStatus(response?.status) ||
        isActiveStatus(data?.status) ||
        isActiveStatus(data?.subscriptionStatus) ||
        isActiveStatus(data?.subscription?.status) ||
        isActiveStatus(data?.fanSubscription?.status)
      ) {
        return true;
      }

      if (typeof data?.isSubscribed === 'boolean') {
        return data.isSubscribed;
      }

      if (Array.isArray(data?.subscriptions)) {
        return data.subscriptions.some((sub) => isActiveStatus(sub?.status));
      }

      if (Array.isArray(data)) {
        return data.some((sub) => isActiveStatus(sub?.status));
      }
    } catch (error) {
      console.log('Private subscription status error:', error);
    }
    return false;
  }, [isActiveStatus]);

  useEffect(() => {
    setResolvedIsSubscribed(normalizedIsSubscribed);
  }, [normalizedIsSubscribed]);

  const fetchPosts = useCallback(async (id) => {
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
  }, []);

  useEffect(() => {
    if (userData?.id) {
      fetchPosts(userData.id); // 🔥 load posts instantly
    }
  }, [userData?.id]);
  const refreshStatusAndPosts = useCallback(async () => {
    if (!userData?.id) {
      setResolvedIsSubscribed(false);
      setPosts([]);
      setStatusLoading(false);
      return;
    }

    if (isOwnProfile) {
      setResolvedIsSubscribed(true);
      await fetchPosts(userData.id);
      setStatusLoading(false);
      return;
    }

    setStatusLoading(true);
    try {
      const active = await getSubscriptionStatus(userData.id);
      setResolvedIsSubscribed(active);

      if (active) {
        await fetchPosts(userData.id);
      } else {
        setPosts([]);
      }
    } finally {
      setStatusLoading(false);
    }
  }, [fetchPosts, getSubscriptionStatus, isOwnProfile, userData?.id]);

  // Initial load + refresh when switching profiles
  useEffect(() => {
    if (refreshKey !== undefined) {
      refreshStatusAndPosts(); // 🔥 main refresh function
    }
  }, [refreshKey]);

  // Refresh when user returns to this tab/screen (e.g. after completing payment)
  useFocusEffect(
    useCallback(() => {
      refreshStatusAndPosts();
    }, [refreshStatusAndPosts])
  );

  // Refresh when app resumes from background (e.g. coming back from payment webview/browser)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isFocused) {
        refreshStatusAndPosts();
      }
    });
    return () => sub.remove();
  }, [isFocused, refreshStatusAndPosts]);

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
        <PostImage item={item} themeTextStyle={textStyle} />
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
    <>
      {
        isCompany ?
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, textStyle]}>Marketplace</Text>
          </View>
          :
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, textStyle]}>No private posts yet</Text>
            <Text style={styles.emptySubtitle}>Private content will appear here</Text>
          </View>
      }
    </>
  ), [textStyle]);

  if (loading || statusLoading) {
    return (
      <View style={[styles.loaderContainer, bgStyle]}>
        <ActivityIndicator size="large" color="#5A2D82" />
      </View>
    );
  }

  return (
    <View style={[styles.screen, bgStyle]}>
      {!canViewPrivateContent ?
        <>
          {
            isCompany ?
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyTitle, textStyle]}>Marketplace</Text>
              </View>
              :
              <View style={[styles.screen, bgStyle, styles.lockedContainer]}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={onSubscribePress}
                  style={styles.lockedCard}
                >
                  <Text style={styles.lockedIcon}>🔒</Text>
                  <Text style={[styles.lockedTitle, textStyle]}>
                    Subscribe to unlock private content
                  </Text>
                  <Text style={styles.lockedSubtitle}>
                    Exclusive posts are available only for active subscribers.
                  </Text>
                </TouchableOpacity>
              </View>
          }
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
    marginTop: 5,
  },
  firstColumn: {
    marginLeft: 0,
  },
  otherColumn: {
    marginLeft: SPACING,
    marginRight: 0,
  },
  image: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE * 1.5,
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
  videoPlaceholderOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3e9fb',
  },
  imageLoadingOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3e9fb',
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
