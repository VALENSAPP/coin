import React, { memo, useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
  AppState,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import Video from 'react-native-video';
import FastImage from 'react-native-fast-image';
import Svg, { ClipPath, Polygon, Image as SvgImage, Defs } from 'react-native-svg';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import { getPostByUser } from '../../services/post';
import {
  parsePrivateCircleSetup,
  isPrivateCircleApiSuccess,
  getPvtCircleMembers,
  recentActivity,
  getPrivateCircleDashboard,
  parsePrivateCircleDashboard,
} from '../../services/privatecircle';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';

// ─── Constants ───────────────────────────────────────────────────────────────
const { width: screenWidth } = Dimensions.get('window');
const numColumns = 3;
const SPACING = 2;
const IMAGE_SIZE = (screenWidth - SPACING * (numColumns + 1)) / numColumns;

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

const formatActivityTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return `${diffInSeconds}s`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  return `${Math.floor(diffInSeconds / 86400)}d`;
};

const mapInteractionAction = (item, t) => {
  if (item?.body) return item.body;
  if (item?.title) return item.title;
  const type = String(item?.type || '').toLowerCase();
  if (type.includes('comment')) return t('privateCircle.activityNewComment');
  if (type.includes('like')) return t('privateCircle.activityPostLiked');
  return t('privateCircle.activityInteracted');
};

const parseRecentActivities = (response, t) => {
  const data = response?.data ?? response ?? {};
  const notifications = data?.notifications ?? [];

  return (Array.isArray(notifications) ? notifications : []).map((item, index) => ({
    id: String(item?.id ?? index),
    name: item?.actorDisplayName || item?.actorUserName || t('privateCircle.unknownUser'),
    action: mapInteractionAction(item, t),
    body: item?.body || '',
    time: formatActivityTime(item?.createdAt),
  }));
};

// ─── PostImage ────────────────────────────────────────────────────────────────
const HexagonImage = ({ uri, size = 34, borderColor = 'rgba(124,58,237,0.28)' }) => {
  const points = `${size / 2},0 ${size},${size / 4} ${size},${(size * 3) / 4} ${size / 2},${size} 0,${(size * 3) / 4} 0,${size / 4}`;
  const clipId = `private-circle-hex-${size}`;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <ClipPath id={clipId}>
          <Polygon points={points} />
        </ClipPath>
      </Defs>
      <SvgImage
        x="0"
        y="0"
        width={size}
        height={size}
        href={{ uri }}
        clipPath={`url(#${clipId})`}
        preserveAspectRatio="xMidYMid slice"
      />
      <Polygon points={points} fill="none" stroke={borderColor} strokeWidth="1.5" />
    </Svg>
  );
};

const PostImage = memo(({ item, themeTextStyle }) => {
  const mediaUrl = normalizeImageUrl(item?.images?.[0]);
  const isVideo = isVideoUrl(item?.images?.[0]);
  const [imageError, setImageError] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const { text } = useAppTheme();

  if (!mediaUrl) {
    return (
      <View style={[gridStyles.image, gridStyles.placeholderImage]}>
        <Text style={[gridStyles.placeholderText, themeTextStyle]}>📷</Text>
      </View>
    );
  }

  if (isVideo) {
    return (
      <View style={[gridStyles.image, gridStyles.placeholderImage]}>
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
          <View style={[StyleSheet.absoluteFill, gridStyles.videoPlaceholderOverlay]}>
            <ActivityIndicator size="large" color="#5A2D82" />
          </View>
        )}
        {!isVideoLoading && !videoError && (
          <View style={gridStyles.videoBadge}>
            <Text style={gridStyles.videoBadgeText}>▶</Text>
          </View>
        )}
      </View>
    );
  }

  if (imageError) {
    return (
      <View style={[gridStyles.image, gridStyles.placeholderImage]}>
        <Text style={[gridStyles.placeholderText, themeTextStyle]}>📷</Text>
      </View>
    );
  }

  return (
    <View style={gridStyles.image}>
      {isImageLoading && (
        <View style={[StyleSheet.absoluteFill, gridStyles.imageLoadingOverlay]}>
          <ActivityIndicator size="large" color={text} />
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

const ItemSeparator = memo(() => <View style={gridStyles.itemSeparator} />);

// ─── Main Component ───────────────────────────────────────────────────────────
const PrivateCircle = memo(({ isOwnProfile = false, onStartPress, route, userData, loggedInUserId }) => {
  const { bgStyle, textStyle, text, cardStyle } = useAppTheme(userData?.profile);
  const { t } = useLanguage();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const skipPrivateCircleApi = route?.params?.skipPrivateCircleApi === true;

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recentActivities, setRecentActivities] = useState([]);
  const [dashboardMembers, setDashboardMembers] = useState([]);
  const [dashboardMemberCount, setDashboardMemberCount] = useState(0);
  const [dashboardPostCount, setDashboardPostCount] = useState(0);
  const [circleAccessActive, setCircleAccessActive] = useState(null);
  // null = not yet checked, true = is member, false = not a member
  const [isMember, setIsMember] = useState(null);

  // ── Pure post fetcher ─────────────────────────────────────────────────────
  const fetchPostsOnly = useCallback(async (id) => {
    try {
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

      // Only posts where visibleTo has a non-empty value = Private Circle posts
      const filteredData = formattedData.filter(
        (post) => post?.visibleTo && post.visibleTo !== '',
      );

      setPosts(filteredData);
    } catch (error) {
      console.log('PrivateCircle fetchPosts error:', error);
      setPosts([]);
    }
  }, []);

  // ── Membership check → then fetch if allowed ─────────────────────────────
  const checkMembershipAndFetch = useCallback(async () => {
    if (skipPrivateCircleApi) {
      setIsMember(false);
      setPosts([]);
      setLoading(false);
      return;
    }

    if (!userData?.id) return;

    try {
      setLoading(true);

      // Own profile → always a member, show all posts
      if (isOwnProfile) {
        setIsMember(true);
        await fetchPostsOnly(userData.id);
        return;
      }

      // Guest profile → call privateSetup to get the owner's members list
      const response = await getPvtCircleMembers(userData?.id);
      console.log('PrivateCircle membership API response:', response);
      if (!isPrivateCircleApiSuccess(response)) {
        // API failed or not set up → not a member
        setIsMember(false);
        setPosts([]);
        return;
      }

      const { members } = parsePrivateCircleSetup(response);

      // Check if the logged-in user is in the members list
      const found = Array.isArray(members)
        ? members.some((m) => String(m?.id) === String(loggedInUserId || ''))
        : false;

      console.log('PrivateCircle member check:', { found, loggedInUserId, members });

      setIsMember(found);

      if (found) {
        await fetchPostsOnly(userData.id);
      } else {
        setPosts([]);
      }
    } catch (error) {
      console.log('PrivateCircle membership check error:', error);
      setIsMember(false);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [skipPrivateCircleApi, userData?.id, isOwnProfile, loggedInUserId, fetchPostsOnly]);

  const fetchRecentActivities = useCallback(async () => {
    try {
      const response = await recentActivity();
      console.log(response,'  PrivateCircle recentActivity API response:');
      if (!isPrivateCircleApiSuccess(response)) {
        setRecentActivities([]);
        return;
      }
      setRecentActivities(parseRecentActivities(response, t));
    } catch (error) {
      console.log('PrivateCircle recentActivity error:', error);
      setRecentActivities([]);
    }
  }, [t]);

  const fetchPrivateCircleDashboard = useCallback(async () => {
    try {
      const response = await getPrivateCircleDashboard();
      console.log(response,'  PrivateCircle dashboard API response:');
      if (!isPrivateCircleApiSuccess(response)) {
        setDashboardMembers([]);
        setDashboardMemberCount(0);
        setDashboardPostCount(0);
        setCircleAccessActive(null);
        return;
      }

      const { members, count, postCount, isActive } = parsePrivateCircleDashboard(response);
      setDashboardMembers(
        members.map((member) => ({
          id: member.id,
          name: member.username,
          image: normalizeImageUrl(member.avatar) || member.avatar,
        })),
      );
      setDashboardMemberCount(count);
      setDashboardPostCount(postCount);
      setCircleAccessActive(isActive);
    } catch (error) {
      console.log('PrivateCircle dashboard error:', error);
      setDashboardMembers([]);
      setDashboardMemberCount(0);
      setDashboardPostCount(0);
      setCircleAccessActive(null);
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    await Promise.all([fetchRecentActivities(), fetchPrivateCircleDashboard()]);
  }, [fetchRecentActivities, fetchPrivateCircleDashboard]);
  useEffect(() => {
    checkMembershipAndFetch();
  }, [checkMembershipAndFetch]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useFocusEffect(
    useCallback(() => {
      checkMembershipAndFetch();
      fetchDashboardData();
      return () => { };
    }, [checkMembershipAndFetch, fetchDashboardData]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isFocused) checkMembershipAndFetch();
    });
    return () => sub.remove();
  }, [isFocused, checkMembershipAndFetch]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const openContent = useCallback(
    (index) => {
      const item = posts[index];
      if (!item) return;
      const isReel = isVideoUrl(item?.images?.[0]);
      if (isReel) {
        const parent = navigation.getParent?.();
        if (parent?.navigate) {
          parent.navigate('FlipsScreen', { item });
          return;
        }
        navigation.navigate('FlipsScreen', { item });
        return;
      }
      const imagePosts = posts.filter((p) => !isVideoUrl(p?.images?.[0]));
      const nextIndex = Math.max(
        0,
        imagePosts.findIndex((p) => String(p?.id) === String(item?.id)),
      );
      navigation.getParent().navigate('ProfileMain', {
        screen: 'PostView',
        params: { postData: imagePosts, startIndex: nextIndex, hideTabBar: true },
      });
    },
    [navigation, posts],
  );

  // ── Grid render ───────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item, index }) => (
      <TouchableOpacity
        style={[
          gridStyles.imageContainer,
          index % numColumns === 0 ? gridStyles.firstColumn : gridStyles.otherColumn,
          { shadowColor: text },
        ]}
        activeOpacity={0.95}
        onPress={() => openContent(index)}
      >
        <PostImage item={item} themeTextStyle={textStyle} />
        <View style={gridStyles.overlay} />
      </TouchableOpacity>
    ),
    [openContent, text, textStyle],
  );

  const keyExtractor = useCallback(
    (item, index) => item?.id?.toString() || index.toString(),
    [],
  );

  const getItemLayout = useCallback(
    (_data, index) => ({
      length: IMAGE_SIZE + SPACING,
      offset: (IMAGE_SIZE + SPACING) * Math.floor(index / numColumns),
      index,
    }),
    [],
  );

  const bullets = useMemo(
    () => [
      t('privateCircle.bulletCloseFriends'),
      t('privateCircle.bulletImportantMoments'),
      t('privateCircle.bulletVipFollowers'),
      t('privateCircle.bulletPrivateUpdates'),
    ],
    [t],
  );

  const previewMembers = dashboardMembers;
  const isAccessActive = circleAccessActive ?? isMember;

  // ── Info card (shown when not a member OR no posts) ───────────────────────
  const InfoCard = useCallback(
    () => (
      <ScrollView
        style={[styles.container, bgStyle]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {isOwnProfile ? (
          <View style={[styles.card, cardStyle, { borderColor: withAlpha(text, 0.12) }]}>
            <LinearGradient
              colors={[withAlpha(text, 0.16), withAlpha(text, 0.06)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.leftRail}
            >
              <View
                style={[
                  styles.railIconBubble,
                  { backgroundColor: mixWithWhite(text, 0.9), marginTop: '200%' },
                ]}
              >
                <Ionicons name="lock-closed" size={34} color={text} />
              </View>
            </LinearGradient>

            <View style={styles.cardBody}>
              <Text style={[styles.title, textStyle]}>{t('privateCircle.ownTitle')}</Text>
              <Text style={[styles.paragraph, textStyle]}>{t('privateCircle.ownComingSoon')}</Text>
              <Text style={[styles.paragraph, textStyle]}>{t('privateCircle.ownChoose')}</Text>
              <Text style={[styles.paragraph, textStyle]}>{t('privateCircle.ownDescription')}</Text>

              <Text style={[styles.sectionTitle, textStyle]}>{t('privateCircle.perfectFor')}</Text>
              {bullets.map((bullet) => (
                <Text key={bullet} style={[styles.bullet, textStyle]}>
                  • {bullet}
                </Text>
              ))}

              <Text style={[styles.paragraph, textStyle]}>{t('privateCircle.ownYourSpace')}</Text>
              <Text style={[styles.paragraph, textStyle]}>{t('privateCircle.ownComingSoonProfile')}</Text>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => typeof onStartPress === 'function' && onStartPress()}
                style={[styles.ctaButton, { backgroundColor: text }]}
              >
                <Text style={styles.ctaText}>{t('privateCircle.startNowButton')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View>
            <View style={[styles.card, cardStyle, { borderColor: withAlpha(text, 0.12) }]}>
              <LinearGradient
                colors={[withAlpha(text, 0.16), withAlpha(text, 0.06)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.leftRail}
              >
                <View
                  style={[
                    styles.railIconBubble,
                    { backgroundColor: mixWithWhite(text, 0.9), marginTop: '100%' },
                  ]}
                >
                  <Ionicons name="lock-closed" size={34} color={text} />
                </View>
              </LinearGradient>

              <View style={styles.cardBody}>
                <View style={styles.statusHeader}>
                  <View style={styles.statusCopy}>
                    <Text style={[styles.title, textStyle]}>{t('privateCircle.guestTitle')}</Text>
                    <Text style={[styles.paragraph, textStyle]}>{t('privateCircle.guestNotPublic')}</Text>
                    <Text style={[styles.paragraph, textStyle]}>{t('privateCircle.guestNeedInvite')}</Text>
                    <Text style={[styles.paragraph, textStyle]}>{t('privateCircle.guestAudience')}</Text>
                    <Text style={[styles.paragraph, textStyle]}>{t('privateCircle.guestInviteOnly')}</Text>
                    <Text style={[styles.paragraph, textStyle]}>{t('privateCircle.guestStayConnected')}</Text>

                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: isAccessActive ? '#DCFCE7' : '#FEE2E2',
                        borderColor: isAccessActive ? '#86EFAC' : '#FCA5A5',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: isAccessActive ? '#22C55E' : '#EF4444' },
                      ]}
                    />
                    <Text style={[styles.statusPillText, { color: isAccessActive ? '#15803D' : '#B91C1C' }]}>
                      {isAccessActive ? t('privateCircle.statusActive') : t('privateCircle.statusInactive')}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.dashboardWrap}>
              <View style={[styles.dashboardPanel, cardStyle, { borderColor: withAlpha(text, 0.1) }]}>
                <Text style={[styles.miniSectionTitle, textStyle]}>{t('privateCircle.overview')}</Text>
                <View style={styles.overviewGrid}>
                  <View style={[styles.overviewTile, { borderColor: withAlpha(text, 0.12) }]}>
                    <Ionicons name="people-outline" size={18} color={text} />
                    <Text style={[styles.overviewNumber, textStyle]}>{dashboardMemberCount}</Text>
                    <Text style={styles.overviewLabel}>{t('privateCircle.members')}</Text>
                  </View>
                  <View style={[styles.overviewTile, { borderColor: withAlpha(text, 0.12) }]}>
                    <Ionicons name="document-text-outline" size={18} color={text} />
                    <Text style={[styles.overviewNumber, textStyle]}>{dashboardPostCount}</Text>
                    <Text style={styles.overviewLabel}>{t('privateCircle.posts')}</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.dashboardPanel, cardStyle, { borderColor: withAlpha(text, 0.1) }]}>
                <View style={styles.previewSectionHeader}>
                  <Text style={[styles.miniSectionTitle, textStyle]}>{t('privateCircle.recentActivity')}</Text>
                  {/* <Text style={[styles.previewLink, { color: text }]}>View all</Text> */}
                </View>
                {recentActivities.map((activity) => (
                  <View key={activity.id} style={styles.activityRow}>
                    <View style={[styles.activityDot, { backgroundColor: text }]} />
                    <View style={styles.activityTextWrap}>
                      <Text style={[styles.activityName, textStyle]}>{activity.name}</Text>
                      <Text style={styles.activityMeta}>{activity.body || activity.action}</Text>
                    </View>
                    <Text style={styles.activityTime}>{activity.time}</Text>
                  </View>
                ))}
              </View>

              <View style={[styles.dashboardPanel, cardStyle, { borderColor: withAlpha(text, 0.1) }]}>
                <View style={styles.previewSectionHeader}>
                  <Text style={[styles.miniSectionTitle, textStyle]}>{t('privateCircle.members')}</Text>
                  {/* <TouchableOpacity
                    activeOpacity={0.85}
                    style={[styles.inviteButton, { backgroundColor: withAlpha(text, 0.1) }]}
                  >
                    <Ionicons name="person-add-outline" size={13} color={text} />
                    <Text style={[styles.inviteButtonText, { color: text }]}>Add member</Text>
                  </TouchableOpacity> */}
                </View>
                {previewMembers.map((member) => (
                  <View key={member.id} style={styles.memberRow}>
                    <HexagonImage uri={member.image} size={34} borderColor={withAlpha(text, 0.28)} />
                    <Text style={[styles.memberName, textStyle]} numberOfLines={1}>
                      {member.name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    ),
    [bgStyle, cardStyle, text, textStyle, isOwnProfile, onStartPress, bullets, t, isAccessActive, dashboardMemberCount, dashboardPostCount, previewMembers, recentActivities],
  );

  if (skipPrivateCircleApi) {
    return <InfoCard />;
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading || isMember === null) {
    return (
      <View style={[gridStyles.loaderContainer, bgStyle]}>
        <ActivityIndicator size="large" color="#5A2D82" />
      </View>
    );
  }

  // ── Not a member → info card ──────────────────────────────────────────────
  if (!isMember) {
    return <InfoCard />;
  }

  // ── Member but no posts → info card ──────────────────────────────────────
  if (posts.length === 0) {
    return <InfoCard />;
  }

  // ── Member + posts → grid ─────────────────────────────────────────────────
  return (
    <View style={[gridStyles.screen, bgStyle]}>
      <FlatList
        data={posts}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={numColumns}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={gridStyles.listContent}
        ItemSeparatorComponent={ItemSeparator}
        removeClippedSubviews
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={5}
        getItemLayout={getItemLayout}
        updateCellsBatchingPeriod={50}
      />
    </View>
  );
});

PrivateCircle.displayName = 'PrivateCircle';
export default PrivateCircle;

// ─── Styles: Info card ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 10,
    paddingTop: 5,
    paddingBottom: 40,
  },
  card: {
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
  cardBody: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 14,
    flexShrink: 1,
  },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  paragraph: {
    fontSize: 12,
    lineHeight: 14,
    marginBottom: 2,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 6, marginBottom: 8 },
  bullet: { fontSize: 12, textAlign: 'left', lineHeight: 14, marginBottom: 4 },
  ctaButton: {
    borderRadius: 18,
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
    marginTop: 8,
  },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  statusCopy: { flex: 1, minWidth: 0 },
  statusSubtitle: { fontSize: 11, lineHeight: 15, opacity: 0.78 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 0,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusPillText: { fontSize: 10, fontWeight: '800' },
  dashboardWrap: {
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
    marginTop: 12,
  },
  dashboardPanel: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  miniSectionTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  overviewGrid: { flexDirection: 'row', gap: 8 },
  overviewTile: {
    flex: 1,
    minHeight: 76,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  overviewNumber: { fontSize: 24, fontWeight: '900', marginTop: 5 },
  overviewLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginTop: 2 },
  previewSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  previewLink: { fontSize: 12, fontWeight: '800' },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 34,
  },
  activityDot: { width: 5, height: 5, borderRadius: 3, marginRight: 8 },
  activityTextWrap: { flex: 1, minWidth: 0 },
  activityName: { fontSize: 14, fontWeight: '800' },
  activityMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  activityTime: { fontSize: 10, color: '#9CA3AF', marginLeft: 8 },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inviteButtonText: { fontSize: 10, fontWeight: '800', marginLeft: 4 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
  },
  memberName: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: '800', marginLeft: 9 },
});

// ─── Styles: Grid ─────────────────────────────────────────────────────────────
const gridStyles = StyleSheet.create({
  screen: { flex: 1, width: screenWidth },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  listContent: { paddingBottom: 20 },
  imageContainer: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    overflow: 'hidden',
    borderRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  firstColumn: { marginLeft: SPACING, marginRight: SPACING / 2 },
  otherColumn: { marginLeft: SPACING / 2, marginRight: SPACING / 2 },
  image: { width: '100%', height: '100%' },
  placeholderImage: {
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: { fontSize: 28 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  videoBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  videoBadgeText: { color: '#fff', fontSize: 10 },
  videoPlaceholderOverlay: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageLoadingOverlay: {
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemSeparator: { height: SPACING },
});
