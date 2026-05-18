import { useNavigation } from '@react-navigation/native';
import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
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
import { useAppTheme } from '../../theme/useApptheme';
import Video from 'react-native-video';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { pinPost, unpinPost } from '../../services/post';
import { isPostPinned, setPostPinnedState, sortPostsByPinned } from '../../utils/postPinning';
import { useLanguage } from '../../i18n';

const { width: screenWidth } = Dimensions.get('window');
const numColumns = 3;
const SPACING = 2;
const IMAGE_SIZE = (screenWidth - SPACING * (numColumns + 1)) / numColumns;

const normalizeImageUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('/')) return `http://35.174.167.92:3002${trimmed}`;
  return `http://35.174.167.92:3002/${trimmed}`;
};

const isVideoUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext));
};

const getVideoPosts = postList =>
  (Array.isArray(postList) ? postList : []).filter(post => {
    const firstImage = post?.images?.[0];
    return firstImage && isVideoUrl(firstImage);
  });

const PostImage = memo(({ item, index, onPress, themeTextStyle }) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = normalizeImageUrl(item?.images?.[0]);
  const isVideo = isVideoUrl(item?.images?.[0]);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);

  if (isVideo) {
    return (
      <View style={[styles.image, styles.placeholderImage]}>
        <Video
          source={{ uri: imageUrl }}
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
        {isVideoLoading && (
          <View style={[StyleSheet.absoluteFill, styles.placeholderImage]}>
            <Text style={[styles.placeholderText, themeTextStyle]}>🎬</Text>
          </View>
        )}
        {!isVideoLoading && (
          <View style={styles.videoBadge}>
            <Text style={styles.videoBadgeText}>▶</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.image}>
      <Image
        source={{ uri: imageUrl }}
        style={styles.image}
        resizeMode="cover"
        onError={() => setVideoError(true)}
      />
      {(videoError || !imageUrl) && (
        <View style={[StyleSheet.absoluteFill, styles.placeholderImage]}>
          <Text style={[styles.placeholderText, themeTextStyle]}>🎬</Text>
        </View>
      )}
    </View>
  );
});

PostImage.displayName = 'PostImage';

const ReelsScreen = memo(({ postCheck, userData, isOwnProfile = false, onPostPinChanged }) => {
  const [posts, setPosts] = useState([]);
  const pinningPostIdRef = useRef('');
  const navigation = useNavigation();
  const { bgStyle, textStyle, text } = useAppTheme(userData?.profile);
  const { t } = useLanguage();

  useEffect(() => {
    setPosts(sortPostsByPinned(getVideoPosts(postCheck)));
  }, [postCheck]);

  const openPosts = useCallback((index) => {
    const reel = posts[index];
    if (!reel) return;

    const profileUserId = userData?.id || reel?.userId || reel?.UserId;
    const params = {
      item: reel,
      profileUserId,
      profileReels: posts,
      key: Date.now().toString(),
    };

    let targetNavigation = navigation;
    while (targetNavigation) {
      const routeNames = targetNavigation.getState?.()?.routeNames || [];
      if (routeNames.includes('FlipsScreen')) {
        targetNavigation.navigate('FlipsScreen', params);
        return;
      }
      targetNavigation = targetNavigation.getParent?.();
    }

    const parent = navigation.getParent?.();
    if (parent?.navigate) {
      parent.navigate('ProfileMain', {
        screen: 'FlipsScreen',
        params,
      });
      return;
    }

    navigation.navigate('FlipsScreen', params);
  }, [navigation, posts, userData?.id]);

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
      if (Array.isArray(refreshedPosts)) setPosts(sortPostsByPinned(getVideoPosts(refreshedPosts)));
    } catch (error) {
      Alert.alert(
        nextPinned ? t('reelsScreen.unableToPinTitle') : t('reelsScreen.unableToUnpinTitle'),
        error?.response?.data?.message || error?.message || t('reelsScreen.tryAgain'),
      );
    } finally {
      pinningPostIdRef.current = '';
    }
  }, [isOwnProfile, onPostPinChanged, t]);

  const confirmTogglePinPost = useCallback((post) => {
    if (!isOwnProfile) return;
    const pinned = isPostPinned(post);
    Alert.alert(
      pinned ? t('reelsScreen.unpinPost') : t('reelsScreen.pinPost'),
      pinned ? t('reelsScreen.unpinConfirm') : t('reelsScreen.pinConfirm'),
      [
        { text: t('reelsScreen.cancel'), style: 'cancel' },
        {
          text: pinned ? t('reelsScreen.unpin') : t('reelsScreen.pin'),
          onPress: () => handleTogglePinPost(post),
        },
      ],
    );
  }, [handleTogglePinPost, isOwnProfile, t]);

  const renderItem = useCallback(({ item, index }) => (
    <TouchableOpacity
      style={[
        styles.imageContainer,
        { marginLeft: index % numColumns === 0 ? 0 : SPACING, shadowColor: text },
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
          <Text style={styles.pinnedBadgeText}>{t('reelsScreen.pinned')}</Text>
        </View>
      )}
    </TouchableOpacity>
  ), [confirmTogglePinPost, openPosts, text, textStyle, t]);

  const keyExtractor = useCallback((item) => item.id.toString(), []);

  const getItemLayout = useCallback((data, index) => ({
    length: IMAGE_SIZE + SPACING,
    offset: (IMAGE_SIZE + SPACING) * Math.floor(index / numColumns),
    index,
  }), []);

  const renderEmptyComponent = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyTitle, textStyle]}>{t('reelsScreen.noPostsTitle')}</Text>
      <Text style={styles.emptySubtitle}>{t('reelsScreen.noPostsSubtitle')}</Text>
    </View>
  ), [textStyle, t]);

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
