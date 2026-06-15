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
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useLanguage } from '../../i18n';
import FastImage from 'react-native-fast-image';
import useScreenshotProtection, {
  SCREENSHOT_PROTECTED_SOURCES,
} from '../../hooks/useScreenshotProtection';

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

const mixWithWhite = (hex, amount = 0.85) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return '#f3f4f6';
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  const toHex = (c) => mix(c).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const withAlpha = (hex, alpha = 0.12) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return `rgba(124,58,237,${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
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
      <FastImage
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

const PrivateContentScreen = ({
  postCheck,
  userData,
  isSubscribed,
  loggedInUserId,
  onSubscribePress,
  isCompany,
  refreshKey,
}) => {
  const [posts, setPosts] = useState([]);
  console.log([posts,'data in pvt content'])
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [resolvedIsSubscribed, setResolvedIsSubscribed] = useState(false);
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { bgStyle, textStyle, text, cardStyle } = useAppTheme(userData?.profile);
  const { t } = useLanguage();

  const normalizedIsSubscribed =
    isSubscribed === true ||
    String(isSubscribed || '').toUpperCase() === 'ACTIVE' ||
    String(isSubscribed || '').toLowerCase() === 'true';
  const isOwnProfile = String(loggedInUserId || '') === String(userData?.id || '');
  const canViewPrivateContent = isOwnProfile || resolvedIsSubscribed;

  useScreenshotProtection({
    enabled: isFocused && !isCompany && canViewPrivateContent && !isOwnProfile,
    title: t('postView.screenshotWarningTitle'),
    message: t('postView.screenshotWarningMessage'),
  });

  const isActiveStatus = useCallback((value) => {
    if (value === true) return true;
    return String(value || '').toUpperCase() === 'ACTIVE';
  }, []);

  const getSubscriptionStatus = useCallback(
    async (id) => {
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
        if (typeof data?.isSubscribed === 'boolean') return data.isSubscribed;
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
    },
    [isActiveStatus],
  );

  useEffect(() => {
    setResolvedIsSubscribed(normalizedIsSubscribed);
  }, [normalizedIsSubscribed]);

  const fetchPosts = useCallback(async (id) => {
    try {
      setLoading(true);
      const response = await getPostByUser(id, 'private');
      const payload =
        response?.data?.posts ??
        response?.data?.data?.posts ??
        response?.data?.data ??
        response?.data ??
        response;

      const formattedData = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.posts)
          ? payload.posts
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
      const filteredData = formattedData.filter(
        (post) => !post?.visibleTo || post.visibleTo === ''
      );
      setPosts(filteredData);
    } catch (error) {
      console.log(error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isCompany) return;
    if (userData?.id) fetchPosts(userData.id);
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
      console.log(active, 'data in this')
      setResolvedIsSubscribed(active);
      if (active) await fetchPosts(userData.id);
      else setPosts([]);
    } finally {
      setStatusLoading(false);
    }
  }, [fetchPosts, getSubscriptionStatus, isOwnProfile, userData?.id]);

  useEffect(() => {
    if (isCompany) return;
    if (refreshKey !== undefined) refreshStatusAndPosts();
  }, [refreshKey]);

  useFocusEffect(
    useCallback(() => {
      if (isCompany) return () => { };
      refreshStatusAndPosts();
    }, [refreshStatusAndPosts]),
  );

  useEffect(() => {
    if (isCompany) return () => { };
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isFocused) refreshStatusAndPosts();
    });
    return () => sub.remove();
  }, [isFocused, refreshStatusAndPosts]);

  const openContent = useCallback(
    async (index) => {
      const item = posts[index];
      if (!item) return;

      const isReel = item?.format === 'reel';

      if (isReel) {
        const params = {
          item,
          profileUserId: userData?.id,
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
        return;
      }

      // Image post navigation
      const imagePosts = posts.filter((p) => p?.format !== 'reel');
      const nextIndex = Math.max(
        0,
        imagePosts.findIndex((p) => String(p?.id) === String(item?.id)),
      );

      navigation.getParent().navigate('ProfileMain', {
        screen: 'PostView',
        params: {
          postData: imagePosts,
          startIndex: nextIndex,
          hideTabBar: true,
          userId: userData?.id,
          screenshotProtectionSource: SCREENSHOT_PROTECTED_SOURCES.PRIVATE_CONTENT,
        },
      });
    },
    [navigation, posts, userData?.id],
  );

  const renderItem = useCallback(
    ({ item, index }) => (
      <TouchableOpacity
        style={[
          styles.imageContainer,
          index % numColumns === 0 ? styles.firstColumn : styles.otherColumn,
          { shadowColor: text },
        ]}
        activeOpacity={0.95}
        onPress={() => openContent(index)}
      >
        <PostImage item={item} themeTextStyle={textStyle} />
        <View style={styles.overlay} />
      </TouchableOpacity>
    ),
    [openContent, text],
  );

  const keyExtractor = useCallback(
    (item, index) => item?.id?.toString() || index.toString(),
    [],
  );

  const getItemLayout = useCallback(
    (data, index) => ({
      length: IMAGE_SIZE + SPACING,
      offset: (IMAGE_SIZE + SPACING) * Math.floor(index / numColumns),
      index,
    }),
    [],
  );

  // ── Shop card (empty state / no-access) ──────────────────────────────────
  const ShopCard = useCallback(
    ({ marginTopOverride } = {}) => (
      <View style={[styles.marketingContainer, bgStyle, marginTopOverride && { marginTop: marginTopOverride }]}>
        <View style={[styles.marketingCard, cardStyle, { borderColor: withAlpha(text, 0.12) }]}>
          <LinearGradient
            colors={[withAlpha(text, 0.16), withAlpha(text, 0.06)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.leftRail}
          >
            <View
              style={[
                styles.railIconBubble,
                { backgroundColor: mixWithWhite(text, 0.9), marginTop: marginTopOverride ? '80%' : '50%' },
              ]}
            >
              <Ionicons name="bag-handle" size={34} color={text} />
            </View>
          </LinearGradient>

          <View style={styles.marketingBody}>
            {isOwnProfile ? (
              <>
                <Text style={[styles.marketingTitle, textStyle]}>{t('privateContent.shopTitle')}</Text>
                <Text style={[styles.marketingText, textStyle]}>{t('privateContent.shopWelcome')}</Text>
                <Text style={[styles.marketingText, textStyle]}>{t('privateContent.shopOwnDescription')}</Text>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={onSubscribePress}
                  style={[styles.ctaButton, { backgroundColor: text }]}
                >
                  <Text style={styles.ctaText}>{t('privateContent.startNowButton')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[styles.marketingTitle, textStyle]}>
                  {(userData?.displayName || userData?.userName || t('privateContent.businessFallback'))}{' '}
                  {t('privateContent.shopSuffix')}
                </Text>
                <Text style={[styles.marketingText, textStyle]}>{t('privateContent.shopGuestWelcome')}</Text>
                <Text style={[styles.marketingText, textStyle]}>{t('privateContent.shopGuestDescription')}</Text>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={onSubscribePress}
                  style={[styles.ctaButton, { backgroundColor: text }]}
                >
                  <Text style={styles.ctaText}>{t('privateContent.shopNowButton')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    ),
    [bgStyle, cardStyle, text, textStyle, isOwnProfile, onSubscribePress, userData, t],
  );

  // ── Locked card ───────────────────────────────────────────────────────────
  const LockedCard = useCallback(
    () => (
      <View style={[styles.screen, bgStyle, styles.lockedContainer]}>
        <TouchableOpacity activeOpacity={0.9} onPress={onSubscribePress} style={styles.lockedCard}>
          <Text style={styles.lockedIcon}>🔒</Text>
          <Text style={[styles.lockedTitle, textStyle]}>{t('privateContent.lockedTitle')}</Text>
          <Text style={styles.lockedSubtitle}>{t('privateContent.lockedSubtitle')}</Text>
        </TouchableOpacity>
      </View>
    ),
    [bgStyle, textStyle, onSubscribePress, t],
  );

  const renderEmptyComponent = useCallback(
    () => {
      if (canViewPrivateContent) {
        return (
          <View style={[styles.screen, bgStyle, styles.lockedContainer]}>
            <View style={[styles.lockedCard, { opacity: 0.92 }]}>
              <Text style={styles.lockedIcon}>📭</Text>
              <Text style={[styles.lockedTitle, textStyle]}>No private posts yet</Text>
              <Text style={styles.lockedSubtitle}>Check back later.</Text>
            </View>
          </View>
        );
      }
      return <LockedCard />;
    },
    [LockedCard, bgStyle, canViewPrivateContent, textStyle],
  );

  if (isCompany) {
    return (
      <View style={[styles.screen, bgStyle]}>
        <ShopCard marginTopOverride={0} />
      </View>
    );
  }

  if (loading || statusLoading) {
    return (
      <View style={[styles.loaderContainer, bgStyle]}>
        <ActivityIndicator size="large" color="#5A2D82" />
      </View>
    );
  }

  return (
    <View style={[styles.screen, bgStyle]}>
      {!canViewPrivateContent ? (
        <LockedCard />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          numColumns={numColumns}
          ListEmptyComponent={renderEmptyComponent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, posts.length === 0 && styles.emptyListContent]}
          ItemSeparatorComponent={ItemSeparator}
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          getItemLayout={getItemLayout}
          updateCellsBatchingPeriod={50}
          disableVirtualization={false}
        />
      )}
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
  marketingContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingBottom: 24,
    paddingTop: 5,
  },
  marketingCard: {
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    flexDirection: 'row',
  },
  leftRail: {
    width: 92,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  railIconBubble: {
    height: 58,
    width: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railMiniBubble: {
    height: 34,
    width: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marketingBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  marketingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  marketingText: {
    fontSize: 12,
    lineHeight: 14,
    marginBottom: 10,
  },
  ctaButton: {
    borderRadius: 18,
    alignItems: 'center',
    minHeight: 30, // ✅ ensures full visibility
    justifyContent: 'center',
    marginTop: 8
  },
  ctaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
