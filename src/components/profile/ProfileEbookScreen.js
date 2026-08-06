import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Image } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { formSurfaces, themedCard } from '../../utils/closetTheme';
import { normalizeProfileType } from '../../utils/supportEligibility';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useLanguage } from '../../i18n';
import useScreenshotProtection from '../../hooks/useScreenshotProtection';
import { getPostByUser } from '../../services/post';
import PrivateContentHeader from './PrivateContentHeader';
const DEFAULT_EBOOKS = [
  {
    id: 'ebook-1',
    title: "The Creator's Playbook",
    author: 'Steven Austin',
    description: 'Build your brand. Create impact. Share your knowledge.',
    pages: 24,
    chapters: 5,
    theme: 'purple',
  },
  {
    id: 'ebook-2',
    title: 'Mindset Mastery',
    author: 'Steven Austin',
    description: 'Develop the right mindset to overcome challenges and achieve your goals.',
    pages: 18,
    chapters: 4,
    theme: 'sand',
  },
  {
    id: 'ebook-3',
    title: 'Content That Connects',
    author: 'Steven Austin',
    description: 'Learn how to create content that attracts, engages, and builds your audience.',
    pages: 32,
    chapters: 6,
    theme: 'forest',
  },
  {
    id: 'ebook-4',
    title: 'Monetize Your Impact',
    author: 'Steven Austin',
    description: 'Proven strategies to turn your knowledge and influence into sustainable income.',
    pages: 27,
    chapters: 5,
    theme: 'gold',
  },
  {
    id: 'ebook-5',
    title: 'Build Your Personal Brand',
    author: 'Steven Austin',
    description: 'Step-by-step guidance to build a brand that stands out and creates opportunities.',
    pages: 40,
    chapters: 8,
    theme: 'ink',
  },
];

const themeStyles = {
  purple: { bg: '#5A2D82', tint: '#EDE3FA' },
  sand: { bg: '#C08B47', tint: '#FFF1D9' },
  forest: { bg: '#274C3A', tint: '#DDEFE3' },
  gold: { bg: '#8A6B1C', tint: '#F8EBC2' },
  ink: { bg: '#1F2937', tint: '#E5E7EB' },
};

const getCoverImage = (item) => {
  if (!item) return null;
  const img = item.images?.[0] || item.image || item.thumbnail;
  if (typeof img === 'string') return img;
  if (img?.uri) return img.uri;
  if (img?.url) return img.url;
  return null;
};

const getDescription = (item) => {
  if (!item) return 'No description available';

  // If text is a JSON string, parse it
  if (typeof item.text === 'string') {
    try {
      const parsed = JSON.parse(item.text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed[0];
      }
    } catch (e) {
      // If parsing fails, return as is
      return item.text || 'No description available';
    }
  }

  // If text is already an array
  if (Array.isArray(item.text) && item.text.length > 0) {
    return item.text[0];
  }

  // Fallback to description field
  return item.description || 'No description available';
};

const EbookCard = memo(({
  item,
  onPress,
  profileThemeType,
  isCompanyProfile,
}) => {
  const { textStyle, mutedTextStyle, accent, card, border, mutedText } = useAppTheme(profileThemeType);
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const brandAccent = accent || '#5A2D82';
  const muted = mutedText || surfaces.mutedColor;
  const surface = card || surfaces.listSurface;
  const surfaceBorder = border || surfaces.listBorder;
  const coverImage = getCoverImage(item);
  const title = item.caption || item.title || 'E-book';
  const description = getDescription(item);
  const palette = themeStyles[item.theme] || (isCompanyProfile ? themeStyles.gold : themeStyles.purple);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[styles.card, themedCard(surface, surfaceBorder)]}
    >
      <View style={[styles.coverContainer, { backgroundColor: isDarkMode ? surfaces.inputSurface : surfaceBorder }]}>
        {coverImage ? (
          <Image source={{ uri: coverImage }} style={styles.coverImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cover, { backgroundColor: palette.bg }]}>
            <Text style={styles.coverPlaceholderText}>{title.charAt(0).toUpperCase()}</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.title, textStyle]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.desc, mutedTextStyle]} numberOfLines={2}>{description}</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: brandAccent }]}>
            📚  {item?.tableContent?.length || 0} Chapters
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={muted} />
    </TouchableOpacity>
  );
});

const ProfileEbookScreen = ({
  userData,
  isSubscribed,
  loggedInUserId,
  onSubscribePress,
  isCompany,
  refreshKey,
  isActiveTab = false,
  onOpenEbook,
}) => {
  const [ebooks, setEbooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resolvedIsSubscribed, setResolvedIsSubscribed] = useState(false);
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const profileThemeType = normalizeProfileType(userData?.profile);
  const isCompanyProfile = profileThemeType === 'company';
  const { bgStyle, text, card, border, mutedText, accent } =
    useAppTheme(profileThemeType);
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const brandAccent = accent || '#5A2D82';
  const primaryText = text || (isDarkMode ? '#ffffff' : '#111827');
  const muted = mutedText || surfaces.mutedColor;
  const surface = card || surfaces.listSurface;
  const surfaceBorder = border || surfaces.listBorder;
  const { t } = useLanguage();
  const normalizedIsSubscribed =
    isSubscribed === true ||
    String(isSubscribed || '').toUpperCase() === 'ACTIVE' ||
    String(isSubscribed || '').toLowerCase() === 'true';
  const isOwnProfile = String(loggedInUserId || '') === String(userData?.id || '');
  const canViewPrivateContent = isOwnProfile || resolvedIsSubscribed;

  useScreenshotProtection({
    enabled: isFocused && isActiveTab && !isCompany && canViewPrivateContent && !isOwnProfile,
    title: t('postView.screenshotWarningTitle'),
    message: t('postView.screenshotWarningMessage'),
  });

  useEffect(() => {
    setResolvedIsSubscribed(normalizedIsSubscribed);
  }, [normalizedIsSubscribed]);

  const fetchEbooks = useCallback(async (id) => {
    try {
      setLoading(true);
      const response = await getPostByUser(id, 'private');
      console.log(resolvedIsSubscribed, 'data in this apiaaaaaaaaaaaaiai')
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

      const ebookData = formattedData.filter((post) => {
        const formatValue = String(post?.format || post?.type || '').toLowerCase();
        const imageUrl = String(post?.images?.[0] || post?.image || post?.video || '');
        const isPdf = /\.pdf(\?|$)/i.test(imageUrl);

        return (
          !post?.visibleTo || post.visibleTo === ''
        ) && (
            formatValue === 'ebook' || formatValue === 'book' || isPdf
          );
      });

      setEbooks(ebookData);
    } catch (error) {
      console.log('ProfileEbookScreen fetch error:', error);
      setEbooks([]);
    } finally {
      setLoading(false);
    }
  }, [resolvedIsSubscribed]);

  useEffect(() => {
    if (!userData?.id || !isFocused || !isActiveTab) return;
    fetchEbooks(userData.id);
  }, [refreshKey, userData?.id, isFocused, isActiveTab, normalizedIsSubscribed, fetchEbooks]);

  const renderEmpty = () => {
    if (!canViewPrivateContent) {
      return (
        <View style={[styles.emptyWrapper, bgStyle]}>
          <View style={[styles.lockedCard, themedCard(surface, surfaceBorder)]}>
            <Text style={styles.lockedIcon}>🔒</Text>
            <Text style={[styles.lockedTitle, { color: primaryText }]}>Premium E-books</Text>
            <Text style={[styles.lockedSubtitle, { color: muted }]}>
              Subscribe to unlock exclusive e-books and premium content from this creator.
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onSubscribePress}
              style={[styles.ctaButton, { backgroundColor: brandAccent }]}
            >
              <Text style={styles.ctaText}>Subscribe Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.emptyWrapper, bgStyle]}>
        <View style={[styles.lockedCard, themedCard(surface, surfaceBorder)]}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>📚</Text>
          <Text style={[styles.lockedTitle, { color: primaryText }]}>No E-books Yet</Text>
          <Text style={[styles.lockedSubtitle, { color: muted }]}>
            This creator hasn't published any e-books yet. Check back soon for exclusive content!
          </Text>
        </View>
      </View>
    );
  };

  const data = useMemo(() => (Array.isArray(ebooks) ? ebooks : []), [ebooks]);
  const openEbook = (item) => {
    console.log('📖 EbookCard clicked:', item?.caption);
    onOpenEbook?.(item);
  };

  if (loading) {
    return (
      <View style={[styles.screen, bgStyle, styles.loaderContainer]}>
        <ActivityIndicator size="large" color={brandAccent} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, bgStyle]}>
      <PrivateContentHeader
        message={userData?.privateContentMessage}
        messageType={'ebooks'}
        canEdit={isOwnProfile}
        userId={userData?.id}
        onSave={(text) => {
          console.log('Saved ebook private message:', text);
        }}
      />
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: primaryText }]}>E-books</Text>
        <Text style={[styles.headerCount, { color: muted }]}>{data.length} E-books</Text>
      </View>
      {data.length === 0 ? (
        renderEmpty()
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id?.toString() || item?.userId || Math.random().toString()}
          renderItem={({ item }) => (
            <EbookCard
              item={item}
              onPress={() => openEbook(item)}
              profileThemeType={profileThemeType}
              isCompanyProfile={isCompanyProfile}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

export default memo(ProfileEbookScreen);

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  headerCount: { fontSize: 12, fontWeight: '700' },
  listContent: { paddingHorizontal: 12, paddingBottom: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  cover: {
    width: 68,
    height: 92,
    borderRadius: 12,
    padding: 8,
    justifyContent: 'space-between',
    marginRight: 12,
  },
  coverContainer: {
    width: 68,
    height: 92,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholderText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  coverTitle: { color: '#fff', fontWeight: '800', fontSize: 12 },
  coverAuthor: { color: '#fff', fontSize: 10, opacity: 0.9 },
  cardBody: { flex: 1 },
  title: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  desc: { fontSize: 12, lineHeight: 16, marginBottom: 8 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap' },
  meta: { fontSize: 11, fontWeight: '700', marginRight: 10, marginBottom: 2 },
  emptyWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  lockedCard: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  lockedIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  lockedTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  lockedSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  ctaButton: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
});
