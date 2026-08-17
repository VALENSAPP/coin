import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Image, TextInput } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { formSurfaces, selectedSurface, themedCard } from '../../utils/closetTheme';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { getMarketPlaceEbook, getMarketplaceEbooksByClosetId } from '../../services/post';
import { getMyClosetById } from '../../services/myCloset';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  if (typeof item.text === 'string') {
    try {
      const parsed = JSON.parse(item.text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed[0];
      }
    } catch (e) {
      return item.text || 'No description available';
    }
  }
  if (Array.isArray(item.text) && item.text.length > 0) {
    return item.text[0];
  }
  return item.description || 'No description available';
};

const SUCCESS_ACCENT = '#22c55e';

export const EbookCard = memo(({ item, isPurchased, isOwnProfile, onPress }) => {
  const { text, card, border, mutedText, icon, accent } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const brandAccent = accent || '#5A2D82';
  const primaryText = text || (isDarkMode ? '#ffffff' : '#111827');
  const muted = mutedText || surfaces.mutedColor;
  const surface = card || surfaces.listSurface;
  const surfaceBorder = border || surfaces.listBorder;
  const coverImage = getCoverImage(item);
  const title = item.caption || item.title || 'E-book';
  const description = getDescription(item);
  const palette = themeStyles[item.theme] || themeStyles.purple;

  const priceLabel = item.amount != null ? `$${parseFloat(item.amount).toFixed(2)}` : 'Free';
  const showPurchasedBadge = isOwnProfile || isPurchased;

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
        <Text style={[styles.title, { color: primaryText }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.desc, { color: muted }]} numberOfLines={2}>{description}</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: brandAccent }]}>📚 {item?.tableContent?.length || 0} Chapters</Text>
          {showPurchasedBadge ? (
            <View style={[styles.ownedBadge, { backgroundColor: selectedSurface(SUCCESS_ACCENT, isDarkMode) }]}>
              <Text style={[styles.ownedBadgeText, { color: isDarkMode ? '#86efac' : '#03543F' }]}>
                {isOwnProfile ? 'Owned' : 'Purchased'}
              </Text>
            </View>
          ) : (
            <Text style={[styles.priceTag, { color: brandAccent }]}>{priceLabel}</Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={muted || icon} />
    </TouchableOpacity>
  );
});

const AllEbooksScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();
  const { userData, loggedInUserId, isOwnProfile } = route.params || {};
  const resolvedClosetId = route?.params?.closetId || null;
  const resolvedUserId = loggedInUserId || userData?.id || userData?._id || null;
  const returnTo = route?.params?.returnTo;
  const fromScreen = route?.params?.from;

  const { bgStyle, text, card, border, mutedText, icon, accent } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const brandAccent = accent || '#5A2D82';
  const primaryText = text || (isDarkMode ? '#ffffff' : '#111827');
  const muted = mutedText || surfaces.mutedColor;
  const surface = card || surfaces.listSurface;
  const surfaceBorder = border || surfaces.listBorder;
  const resolvedAuthorName =
    route?.params?.username ||
    userData?.userName ||
    userData?.username ||
    userData?.displayName ||
    userData?.shopName ||
    userData?.shopUsername ||
    '';

  const [ebooks, setEbooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [purchasedMap, setPurchasedMap] = useState({});

  const fetchEbooks = useCallback(async (id, cId = null) => {
    try {
      setLoading(true);
      let closetIdToUse = cId || resolvedClosetId;
      if (!closetIdToUse && id) {
        const byUserRes = await getMyClosetById({ userId: id }).catch(() => null);
        const closetData = byUserRes?.data ?? byUserRes;
        const closetRecord = closetData?.closetDetails || closetData;
        closetIdToUse = closetData?.closetId ?? closetRecord?.id ?? closetRecord?._id ?? null;
      }

      if (!closetIdToUse) {
        setEbooks([]);
        setLoading(false);
        return;
      }

      console.log('Fetching marketplace ebooks in AllEbooksScreen for closetId:', closetIdToUse);
      const response = await getMarketplaceEbooksByClosetId(closetIdToUse);
      const payload =
        response?.data?.ebooks ??
        response?.ebooks ??
        response?.data?.posts ??
        response?.data?.data?.posts ??
        response?.data?.data ??
        response?.data ??
        response;

      const formattedData = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.posts)
          ? payload.posts
          : Array.isArray(payload?.ebooks)
            ? payload.ebooks
            : Array.isArray(payload?.data)
              ? payload.data
              : [];

      const ebookData = formattedData.filter((post) => {
        if (post?.ebookpdf) return true;
        const formatValue = String(post?.format || post?.type || '').toLowerCase();
        const imageUrl = String(post?.images?.[0] || post?.image || post?.video || '');
        const isPdf = /\.pdf(\?|$)/i.test(imageUrl);

        return (
          !post?.visibleTo || post.visibleTo === ''
        ) && (
            formatValue === 'ebook' || formatValue === 'book' || isPdf || formatValue === 'private'
          );
      });

      setEbooks(ebookData);

      // Load purchase status for all fetched ebooks
      const map = {};
      for (const item of ebookData) {
        const itemId = item.id || item._id;
        const purchased = item.isPurchased ?? (await AsyncStorage.getItem(`purchased_ebook_${itemId}`) === 'true');
        map[itemId] = !!purchased;
      }
      setPurchasedMap(map);

    } catch (error) {
      console.log('AllEbooksScreen fetch error:', error);
      setEbooks([]);
    } finally {
      setLoading(false);
    }
  }, [resolvedClosetId]);

  useEffect(() => {
    if (isFocused) {
      fetchEbooks(resolvedUserId, resolvedClosetId);
    }
  }, [resolvedUserId, resolvedClosetId, isFocused, fetchEbooks]);

  const filteredEbooks = useMemo(() => {
    if (!searchQuery.trim()) return ebooks;
    const query = searchQuery.toLowerCase();
    return ebooks.filter(item => {
      const title = (item.caption || item.title || '').toLowerCase();
      const description = getDescription(item).toLowerCase();
      return title.includes(query) || description.includes(query);
    });
  }, [ebooks, searchQuery]);

  const handleEbookPress = useCallback(async (item) => {
    const itemId = item.id || item._id;
    const isPurchased = purchasedMap[itemId] || isOwnProfile;
    const returnTo = route?.params?.returnTo || {
      tab: 'ProfileMain',
      screen: 'AllEbooks',
      params: {
        ...route?.params,
      },
    };
    const baseParams = {
      ebook: item,
      userData,
      loggedInUserId,
      from: fromScreen,
      returnTo,
      username: item?.userName || item?.username || item?.creator?.name || resolvedAuthorName,
      sourceScreen: 'AllEbooks',
      allEbooksParams: {
        ...route?.params,
      },
    };
    if (isPurchased) {
      navigation.push('EbookDetail', baseParams);
    } else {
      navigation.push('EbookBuyDetails', {
        ...baseParams,
      });
    }
  }, [purchasedMap, isOwnProfile, navigation, userData, loggedInUserId, route?.params, resolvedAuthorName]);

  const handleBackPress = () => {
    if (returnTo === 'MyClosetDashboard') {
      navigation.navigate('MainApp', {
        screen: 'wallet',
        params: { screen: 'MyCloset' },
      });
      return;
    }

    navigation.goBack();
  };

  if (loading && ebooks.length === 0) {
    return (
      <View style={[styles.screen, bgStyle, styles.loaderContainer]}>
        <ActivityIndicator size="large" color={brandAccent} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, bgStyle]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={icon || primaryText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: primaryText }]}>E-books</Text>
        <Text style={styles.cartBadgeText}></Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchBar,
            themedCard(isDarkMode ? surfaces.inputSurface : surface, surfaceBorder),
            { borderWidth: StyleSheet.hairlineWidth },
          ]}
        >
          <Ionicons name="search" size={18} color={muted} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: primaryText }]}
            placeholder="Search e-books"
            placeholderTextColor={surfaces.placeholderColor}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={muted} style={styles.clearIcon} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={[styles.sectionHeaderRow, { borderBottomColor: surfaceBorder }]}>
        <Text style={[styles.sectionTitle, { color: primaryText }]}>All E-books</Text>
        <Text style={[styles.sectionCount, { color: muted }]}>{filteredEbooks.length} items</Text>
      </View>

      {filteredEbooks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📚</Text>
          <Text style={[styles.emptyTitle, { color: primaryText }]}>No E-books Found</Text>
          <Text style={[styles.emptySubtitle, { color: muted }]}>
            We couldn't find any e-books matching your search.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredEbooks}
          keyExtractor={(item) => (item.id || item._id || Math.random()).toString()}
          renderItem={({ item }) => (
            <EbookCard
              item={item}
              isPurchased={purchasedMap[item.id || item._id]}
              isOwnProfile={isOwnProfile}
              onPress={() => handleEbookPress(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

export default AllEbooksScreen;

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: '10%' },
  loaderContainer: { justifyContent: 'center', alignItems: 'center' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  cartBtn: {
    padding: 4,
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  clearIcon: {
    marginLeft: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  sectionCount: { fontSize: 12, fontWeight: '700' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  coverContainer: {
    width: 68,
    height: 92,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 12,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  cover: {
    flex: 1,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPlaceholderText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  cardBody: { flex: 1 },
  title: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  desc: { fontSize: 12, lineHeight: 16, marginBottom: 8 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { fontSize: 11, fontWeight: '700' },
  priceTag: { fontSize: 13, fontWeight: '800' },
  ownedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ownedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: '10%',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
});
