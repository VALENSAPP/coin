import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Image, TextInput } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
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

const EbookCard = memo(({ item, isPurchased, isOwnProfile, onPress, accentColor }) => {
  const coverImage = getCoverImage(item);
  const title = item.caption || item.title || 'E-book';
  const description = getDescription(item);
  const palette = themeStyles[item.theme] || themeStyles.purple;

  const priceLabel = item.amount != null ? `$${parseFloat(item.amount).toFixed(2)}` : 'Free';
  const showPurchasedBadge = isOwnProfile || isPurchased;

  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={styles.card}>
      <View style={styles.coverContainer}>
        {coverImage ? (
          <Image source={{ uri: coverImage }} style={styles.coverImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cover, { backgroundColor: palette.bg }]}>
            <Text style={styles.coverPlaceholderText}>{title.charAt(0).toUpperCase()}</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.desc} numberOfLines={2}>{description}</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: accentColor }]}>📚 {item?.tableContent?.length || 0} Chapters</Text>
          {showPurchasedBadge ? (
            <View style={styles.ownedBadge}>
              <Text style={styles.ownedBadgeText}>{isOwnProfile ? 'Owned' : 'Purchased'}</Text>
            </View>
          ) : (
            <Text style={[styles.priceTag, { color: accentColor }]}>{priceLabel}</Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#6b7280" />
    </TouchableOpacity>
  );
});

const AllEbooksScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();
  const { userData, loggedInUserId, isOwnProfile } = route.params || {};

  const { bgStyle, textStyle, text } = useAppTheme(userData?.profile);
  const accentColor = text || '#5A2D82';

  const [ebooks, setEbooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [purchasedMap, setPurchasedMap] = useState({});

  const fetchEbooks = useCallback(async (id, cId = null) => {
    try {
      setLoading(true);
      let resolvedClosetId = cId || route?.params?.closetId;
      if (!resolvedClosetId && id) {
        const byUserRes = await getMyClosetById({ userId: id }).catch(() => null);
        const closetData = byUserRes?.data ?? byUserRes;
        const closetRecord = closetData?.closetDetails || closetData;
        resolvedClosetId = closetData?.closetId ?? closetRecord?.id ?? closetRecord?._id ?? null;
      }

      if (!resolvedClosetId) {
        setEbooks([]);
        setLoading(false);
        return;
      }

      console.log('Fetching marketplace ebooks in AllEbooksScreen for closetId:', resolvedClosetId);
      const response = await getMarketplaceEbooksByClosetId(resolvedClosetId);
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
  }, [route?.params?.closetId]);

  useEffect(() => {
    if (userData?.id && isFocused) {
      fetchEbooks(userData.id, route?.params?.closetId);
    }
  }, [userData?.id, isFocused, fetchEbooks, route?.params?.closetId]);

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
    if (isPurchased) {
      navigation.navigate('EbookDetail', {
        ebook: item,
        userData,
        loggedInUserId,
        from: route?.params?.from || 'MyClosetShopFront',
        username: userData?.userName || userData?.username || item?.userName
      });
    } else {
      navigation.navigate('EbookBuyDetails', {
        ebook: item,
        userData,
        loggedInUserId,
        from: route?.params?.from || 'MyClosetShopFront',
        username: userData?.userName || userData?.username || item?.userName
      });
    }
  }, [purchasedMap, isOwnProfile, navigation, userData, loggedInUserId, route?.params?.from]);

  if (loading && ebooks.length === 0) {
    return (
      <View style={[styles.screen, bgStyle, styles.loaderContainer]}>
        <ActivityIndicator size="large" color={accentColor} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, bgStyle]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]}>E-books</Text>
        <Text style={styles.cartBadgeText}></Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search e-books"
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" style={styles.clearIcon} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, textStyle]}>All E-books</Text>
        <Text style={styles.sectionCount}>{filteredEbooks.length} items</Text>
      </View>

      {filteredEbooks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📚</Text>
          <Text style={[styles.emptyTitle, textStyle]}>No E-books Found</Text>
          <Text style={styles.emptySubtitle}>We couldn't find any e-books matching your search.</Text>
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
              accentColor={accentColor}
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
  screen: { flex: 1, backgroundColor: '#fff', paddingTop: '10%' },
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
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
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
    backgroundColor: '#F3F4F6',
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
    color: '#1f2937',
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
    borderBottomColor: '#f3f4f6',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  sectionCount: { fontSize: 12, color: '#6b7280', fontWeight: '700' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E1F3',
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
    backgroundColor: '#f3f4f6',
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
  title: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 4 },
  desc: { fontSize: 12, color: '#6b7280', lineHeight: 16, marginBottom: 8 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { fontSize: 11, fontWeight: '700' },
  priceTag: { fontSize: 13, fontWeight: '800' },
  ownedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#DEF7EC',
    borderRadius: 6,
  },
  ownedBadgeText: {
    color: '#03543F',
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
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
});
