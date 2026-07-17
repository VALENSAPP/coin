import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n';
import { getMarketPlaceEbook, getMarketplaceEbooksByClosetId } from '../../services/post';
import {
  getClosetItemsByClosetId,
  getMyClosetById,
  getMyClosetItems,
  getClosetBattlesPriority,
  getWishlist,
  addWishlistItem,
  deleteWishlistItem,
} from '../../services/myCloset';
import { Alert } from 'react-native';
import {
  buildClosetNavContext,
  buildClosetReturnTo,
  navigateToBattleLive,
  withClosetNavParams,
} from '../../utils/closetNavigation';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 48) / 3;

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (v) => {
  if (v == null || v === '') return '$0.00';
  const s = String(v).trim();
  if (s.startsWith('$')) return s;
  const n = Number(s);
  return Number.isNaN(n) ? s : `$${n.toFixed(2)}`;
};

const thumb = (item) => item?.images?.[0] || item?.image || item?.thumbnail || null;

const getWishlistPayload = response => response?.data?.data ?? response?.data ?? response ?? {};
const getWishlistsArray = response => {
  const payload = getWishlistPayload(response);
  if (Array.isArray(payload?.wishlists)) return payload.wishlists;
  if (Array.isArray(payload?.wishlist)) return payload.wishlist;
  if (Array.isArray(payload)) return payload;
  return [];
};
const findWishlistItemForProduct = (response, productId) => {
  const wishlists = getWishlistsArray(response);
  for (const wishlist of wishlists) {
    const match = (wishlist?.wishlistItems || []).find(w =>
      String(w?.product?.id || w?.product?._id || w?.productId || w?.id || w?._id) === String(productId),
    );
    if (match) return { match, wishlist };
  }
  return { match: null, wishlist: null };
};

const imageSource = (uri) =>
  uri
    ? {
      uri,
      priority: FastImage.priority.high,
      cache: FastImage.cacheControl.immutable,
    }
    : null;

const CachedImageBox = ({ uri, style, placeholderStyle, iconName, iconSize = 28 }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [uri]);

  if (!uri || failed) {
    return (
      <View style={[style, placeholderStyle]}>
        <Ionicons name={iconName} size={iconSize} color="#9b8c7a" />
      </View>
    );
  }

  return (
    <View style={style}>
      {!loaded && (
        <View style={s.imageLoadingOverlay}>
          <ActivityIndicator size="small" color="#9b8c7a" />
        </View>
      )}
      <FastImage
        source={imageSource(uri)}
        style={StyleSheet.absoluteFill}
        resizeMode={FastImage.resizeMode.cover}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setFailed(true);
          setLoaded(true);
        }}
        fadeDuration={0}
      />
    </View>
  );
};

const unwrapMyClosetResponse = (source) => {
  const level1 = source?.data ?? source;
  if (level1 && typeof level1 === 'object' && !Array.isArray(level1)) {
    if (level1.data && typeof level1.data === 'object') {
      return level1.data;
    }
    return level1;
  }
  return {};
};

const unwrapBattlesResponse = (source) => {
  const battles = source?.data?.battles ?? source?.battles ?? [];
  return Array.isArray(battles) ? battles : [];
};

const mapParticipant = (p = {}, closet) => {
  const product = p.product ?? {};
  return {
    participantId: p.id,
    name: product.name || '',
    price: fmt(product.price),
    image: thumb(product), // product.images[0]
    user: closet?.shopName || closet?.shopUsername || '',
    pct: Number(p.votePercentage ?? 0),
    isWinner: !!p.isWinner,
  };
};

const mapBattle = (b, i) => {
  const sorted = [...(b.participants ?? [])].sort((a, c) => (a.position ?? 0) - (c.position ?? 0));
  const [p1, p2] = sorted;
  return {
    id: String(b.id ?? i),
    title: b.title,
    left: mapParticipant(p1, b.closet),
    right: mapParticipant(p2, b.closet),
  };
};

// ── placeholder battle data (fallback while loading / on error) ──────────────

const BATTLES_FALLBACK = [
  {
    id: 'b1',
    left: { name: 'Gucci Ophidia Bag', price: '$850', user: 'Priya', pct: 68 },
    right: { name: 'Chanel Classic Bag', price: '$2,350', user: 'Ananya', pct: 32 },
  },
  {
    id: 'b2',
    left: { name: 'Prada Sunglasses', price: '$220', user: 'Rohan', pct: 55 },
    right: { name: 'Cartier Bracelet', price: '$3,200', user: 'Meera', pct: 45 },
  },
];

const BattleSlide = ({ battle, accent, t, onPress, card, border, textColor, mutedText, isDark }) => (
  <TouchableOpacity
    activeOpacity={0.9}
    style={[s.slide, { backgroundColor: card, borderColor: border }]}
    onPress={onPress}
  >
    <View style={s.battleHeader}>
      <Text style={[s.battleTitle, { color: textColor }]} numberOfLines={1}>
        {battle.title || t('myClosetShopFront.battlePicksTitle')}
      </Text>
    </View>

    <View style={s.battleBody}>
      <View style={s.fighter}>
        <View style={[s.fighterThumb, { backgroundColor: isDark ? border : '#f5f3ee' }]}>
          <CachedImageBox
            uri={battle.left.image}
            style={s.fighterImgWrap}
            placeholderStyle={s.fighterThumbPlaceholder}
            iconName="bag-outline"
            iconSize={34}
          />
        </View>
        <Text style={[s.fighterName, { color: textColor }]} numberOfLines={2}>{battle.left.name}</Text>
        <Text style={[s.fighterPrice, { color: textColor }]}>{battle.left.price}</Text>
        <View style={s.userRow}>
          <Text style={[s.pct, { color: accent }]}>{battle.left.pct}%</Text>
        </View>
      </View>

      <View style={[s.vsBubble, { backgroundColor: card, borderColor: border }]}>
        <Text style={[s.vsText, { color: textColor }]}>{t('myClosetShopFront.vs')}</Text>
      </View>

      <View style={s.fighter}>
        <View style={[s.fighterThumb, { backgroundColor: isDark ? border : '#f0eeec' }]}>
          <CachedImageBox
            uri={battle.right.image}
            style={s.fighterImgWrap}
            placeholderStyle={s.fighterThumbPlaceholder}
            iconName="bag-handle-outline"
            iconSize={34}
          />
        </View>
        <Text style={[s.fighterName, { color: textColor }]} numberOfLines={2}>{battle.right.name}</Text>
        <Text style={[s.fighterPrice, { color: textColor }]}>{battle.right.price}</Text>
        <View style={s.userRow}>
          <Text style={s.pctRed}>{battle.right.pct}%</Text>
        </View>
      </View>
    </View>
  </TouchableOpacity>
);

const ItemTile = ({ item, accent, onPress, onToggleWishlist, sellerId, card, border, textColor, mutedText, isDark }) => {
  const [liked, setLiked] = useState(false);
  const [updatingWishlist, setUpdatingWishlist] = useState(false);
  const [wishlistItemId, setWishlistItemId] = useState(null);

  useEffect(() => {
    let mounted = true;
    const loadWishlistState = async () => {
      const productId = item.raw?.id || item.raw?._id || item.raw?.productId || item.key;
      if (!productId) return;
      try {
        const response = await getWishlist(sellerId);
        const { match } = findWishlistItemForProduct(response, productId);
        if (mounted && match) {
          setLiked(true);
          setWishlistItemId(match.id || match._id || match.wishlistItemId || match.wishlistId || null);
        }
      } catch {
        // Keep local state if wishlist lookup fails.
      }
    };
    loadWishlistState();
    return () => { mounted = false; };
  }, [item.key, item.raw, sellerId]);

  const handleToggleWishlist = async () => {
    if (updatingWishlist) return;
    const nextLiked = !liked;
    setUpdatingWishlist(true);
    try {
      if (nextLiked) {
        await addWishlistItem(item.raw?.id || item.raw?._id || item.raw?.productId || item.key);
        const refresh = await getWishlist(sellerId);
        const { match } = findWishlistItemForProduct(refresh, item.raw?.id || item.raw?._id || item.raw?.productId || item.key);
        setWishlistItemId(match?.id || match?._id || match?.wishlistItemId || match?.wishlistId || null);
      } else {
        await deleteWishlistItem(wishlistItemId || item.raw?.wishlistItemId || item.raw?.wishlistId || item.raw?.wishlist_item_id || item.raw?.wishlistItem?.id);
      }
      setLiked(nextLiked);
      onToggleWishlist?.(item, nextLiked);
    } catch (err) {
      Alert.alert(
        'Wishlist',
        err?.response?.data?.message || 'Could not update wishlist.',
      );
    } finally {
      setUpdatingWishlist(false);
    }
  };

  return (
    <TouchableOpacity activeOpacity={0.85} style={s.tile} onPress={onPress}>
      <View style={[s.tileThumb, { backgroundColor: isDark ? border : '#f5f3ee' }]}>
        <CachedImageBox
          uri={item.image}
          style={s.tileImgWrap}
          placeholderStyle={[s.tileImgPlaceholder, { backgroundColor: isDark ? border : '#f5f3ee' }]}
          iconName="shirt-outline"
          iconSize={28}
        />
        <TouchableOpacity
          style={[s.heart, { backgroundColor: isDark ? `${card}cc` : '#ffffffcc' }]}
          onPress={handleToggleWishlist}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={updatingWishlist}
        >
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={18}
            color={liked ? accent : mutedText}
          />
        </TouchableOpacity>
      </View>
      <Text style={[s.tileName, { color: textColor }]} numberOfLines={1}>{item.name}</Text>
      <Text style={[s.tilePrice, { color: textColor }]}>{item.price}</Text>
    </TouchableOpacity>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────

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

const EbookRowItem = React.memo(({ item, isPurchased, isOwnProfile, accent, onPress }) => {
  const coverImage = getCoverImage(item);
  const title = item.caption || item.title || 'E-book';
  const description = getDescription(item);
  const palette = themeStyles[item.theme] || themeStyles.purple;
  const priceLabel = item.amount != null ? `$${parseFloat(item.amount).toFixed(2)}` : 'Free';
  const showPurchasedBadge = isOwnProfile || isPurchased;

  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={s.ebookCard}>
      <View style={s.ebookCoverContainer}>
        {coverImage ? (
          <Image source={{ uri: coverImage }} style={s.ebookCoverImage} resizeMode="cover" />
        ) : (
          <View style={[s.ebookCover, { backgroundColor: palette.bg }]}>
            <Text style={s.ebookCoverPlaceholderText}>{title.charAt(0).toUpperCase()}</Text>
          </View>
        )}
      </View>
      <View style={s.ebookCardBody}>
        <Text style={s.ebookTitle} numberOfLines={1}>{title}</Text>
        <Text style={s.ebookDesc} numberOfLines={2}>{description}</Text>
        <View style={s.ebookMetaRow}>
          <Text style={[s.ebookMeta, { color: accent }]}>📚 {item?.tableContent?.length || 0} Chapters</Text>
          {showPurchasedBadge ? (
            <View style={s.ebookOwnedBadge}>
              <Text style={s.ebookOwnedBadgeText}>{isOwnProfile ? 'Owned' : 'Purchased'}</Text>
            </View>
          ) : (
            <Text style={[s.ebookPriceTag, { color: accent }]}>{priceLabel}</Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#6b7280" />
    </TouchableOpacity>
  );
});

const MyClosetShopFront = ({ navigation, userData, shopDraft, isOwnProfile = true, loggedInUserId, closetNavContext }) => {
  const { t } = useLanguage();
  const [storedUsername, setStoredUsername] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dotIdx, setDotIdx] = useState(0);
  const [closetDetails, setClosetDetails] = useState(null);
  const [closetId, setClosetId] = useState(null);

  // E-books State and Fetch
  const [ebooks, setEbooks] = useState([]);
  const [ebooksLoading, setEbooksLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [purchasedMap, setPurchasedMap] = useState({});

  useEffect(() => {
    AsyncStorage.getItem('userId').then((id) => {
      if (id) setCurrentUserId(id);
    });
  }, []);

  const fetchEbooks = useCallback(async (userId, cId = null) => {
    if (!userId && !cId) {
      setEbooks([]);
      return;
    }
    setEbooksLoading(true);
    try {
      let resolvedClosetId = cId || closetId;
      if (!resolvedClosetId && userId) {
        const byUserRes = await getMyClosetById({ userId }).catch(() => null);
        const closetData = byUserRes?.data ?? byUserRes;
        const closetRecord = closetData?.closetDetails || closetData;
        resolvedClosetId = closetData?.closetId ?? closetRecord?.id ?? closetRecord?._id ?? null;
      }

      if (!resolvedClosetId) {
        setEbooks([]);
        setEbooksLoading(false);
        return;
      }

      console.log('Fetching marketplace ebooks for closetId:', resolvedClosetId);
      const response = await getMarketplaceEbooksByClosetId(resolvedClosetId);
      console.log("response of getMarketplaceEbooksByClosetId-----------", response);
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
    } catch (err) {
      console.log('MyClosetShopFront fetchEbooks error:', err);
      setEbooks([]);
    } finally {
      setEbooksLoading(false);
    }
  }, [closetId]);

  // ── battles state ──
  const [battles, setBattles] = useState([]);
  const [battlesLoading, setBattlesLoading] = useState(false);

  const targetUserId = userData?.id;

  const {
    textStyle,
    bgStyle,
    text,
    accent,
    card,
    border,
    mutedText,
    cardStyle,
  } = useAppTheme(userData?.profile);
  const { isDarkMode } = useThemeContext();
  const brand = accent || text;

  useEffect(() => {
    let ok = true;
    AsyncStorage.getItem('currentUsername')
      .then(v => { if (ok && v) setStoredUsername(v); })
      .catch(() => { });
    return () => { ok = false; };
  }, []);

  const loadBattles = useCallback(async (id) => {
    if (!id) {
      setBattles([]);
      return;
    }
    setBattlesLoading(true);
    try {
      const res = await getClosetBattlesPriority(id, { page: 1, limit: 10 });
      console.log('getClosetBattlesPriority response:', JSON.stringify(res, null, 2));
      const raw = unwrapBattlesResponse(res);
      setBattles(raw.map(mapBattle));
    } catch (err) {
      console.log('getClosetBattlesPriority error:', err);
      setBattles([]);
    } finally {
      setBattlesLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let resolvedClosetId = null;

      if (isOwnProfile) {
        const closetRes = await getMyClosetById({ userId: targetUserId }).catch(() => null);
        const apiCloset = unwrapMyClosetResponse(closetRes);
        const closetRecord = apiCloset?.closetDetails || apiCloset || null;
        setClosetDetails(closetRecord);

        resolvedClosetId = apiCloset?.closetId ?? closetRecord?.id ?? closetRecord?._id ?? null;
        setClosetId(resolvedClosetId);

        const res = await getMyClosetItems();
        const raw = res?.data?.data ?? res?.data?.items ?? res?.data ?? res;
        const list = Array.isArray(raw) ? raw
          : Array.isArray(raw?.items) ? raw.items
            : Array.isArray(raw?.data) ? raw.data
              : [];
        setItems(list);
      } else {
        // Step 1: get closetId for this user
        const byUserRes = await getMyClosetById({ userId: targetUserId });
        const closetData = unwrapMyClosetResponse(byUserRes);
        const closetRecord = closetData?.closetDetails || closetData;
        resolvedClosetId = closetData?.closetId ?? closetRecord?.id ?? null;

        if (!resolvedClosetId) {
          setItems([]);
          setClosetDetails(null);
          setClosetId(null);
          setBattles([]);
          return;
        }
        setClosetId(resolvedClosetId);
        setClosetDetails(closetRecord);

        // Step 2: fetch items using closetId
        const itemsRes = await getClosetItemsByClosetId(resolvedClosetId);
        const raw = itemsRes?.data?.data ?? itemsRes?.data ?? [];
        const list = Array.isArray(raw) ? raw
          : Array.isArray(raw?.items) ? raw.items
            : Array.isArray(raw?.data) ? raw.data
              : [];
        setItems(list);
      }

      // ── fetch battle picks once we know the closetId, for either profile type ──
      await loadBattles(resolvedClosetId);
      // fetch ebooks
      await fetchEbooks(targetUserId, resolvedClosetId);
    } catch {
      setItems([]);
      setClosetDetails(null);
      setBattles([]);
      setEbooks([]);
    } finally {
      setLoading(false);
    }
  }, [isOwnProfile, targetUserId, loadBattles, fetchEbooks]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    setItems([]);
    setClosetDetails(null);
    setClosetId(null);
    setDotIdx(0);
    setBattles([]);
    setEbooks([]);
    setPurchasedMap({});
  }, [targetUserId, isOwnProfile]);

  const shopName = useMemo(() =>
    closetDetails?.shopName
    || t('myClosetShopFront.defaultShopName'),
    [closetDetails?.shopName, t],
  );

  const shopDescription = useMemo(() => {
    return closetDetails?.description || '';
  }, [closetDetails?.description]);

  const shopLogo = useMemo(() => {
    return closetDetails?.shopLogo || '';
  }, [closetDetails?.shopLogo]);

  const tiles = useMemo(() =>
    items.slice(0, 6).map((it, i) => ({
      key: String(it?.id || it?._id || i),
      name: it?.name || it?.title || it?.itemName || t('myClosetShopFront.untitled'),
      price: fmt(it?.price ?? it?.amount ?? it?.salePrice),
      image: thumb(it),
      raw: it,
    })),
    [items, t],
  );

  // Use real battles once loaded; fall back to placeholder only while loading
  // and nothing has come back yet, so the section never looks empty on first paint.
  const displayBattles = battles.length > 0
    ? battles
    : (battlesLoading ? BATTLES_FALLBACK : battles);

  useEffect(() => {
    const urls = [
      ...tiles.map(t => t.image),
      ...displayBattles.flatMap(b => [b.left?.image, b.right?.image]),
    ].filter(Boolean);

    if (urls.length) {
      FastImage.preload([...new Set(urls)].map(uri => imageSource(uri)));
    }
  }, [displayBattles, tiles]);

  const onScroll = (e) => {
    setDotIdx(Math.round(e.nativeEvent.contentOffset.x / (SCREEN_W - 24)));
  };

  const seller = useMemo(() => ({
    id: userData?.id,
    displayName: userData?.displayName,
    userName: userData?.userName,
    image: userData?.image,
    profile: userData?.profile,
  }), [userData]);

  const navContext = useMemo(
    () =>
      closetNavContext ||
      buildClosetNavContext({
        isOwnProfile,
        sellerProfile: userData?.profile,
        sellerId: userData?.id,
        closetId,
        seller,
      }),
    [closetId, closetNavContext, isOwnProfile, seller, userData?.id, userData?.profile],
  );

  const goItems = () => navigation?.navigate?.('MyClosetBuyerItems', withClosetNavParams(
    { params: navContext },
    { items, seller, sellerId: userData?.id, closetId, isOwnProfile },
  ));

  const openItem = item => navigation?.navigate?.('MyClosetBuyerItemDetail', withClosetNavParams(
    { params: navContext },
    {
      item: item?.raw || item,
      items,
      seller,
      sellerId: userData?.id,
      closetId,
      isOwnProfile,
    },
  ));

  const goBattles = () => navigation?.navigate?.('ProfileMain', {
    screen: 'MyClosetBattles', // or whatever route name you register MyClosetBattlesScreen under
    params: { closetId },
  });
  const openBattle = battle => navigateToBattleLive(navigation, {
    battleId: battle?.id,
    initialBattle: battle,
    selectedItems: [battle?.left, battle?.right].filter(Boolean),
    returnToProfile: buildClosetReturnTo({
      isOwnProfile,
      sellerProfile: userData?.profile,
      sellerId: userData?.id,
    }),
  });
  const goStorefront = () => navigation?.navigate?.('ProfileMain', { screen: 'MyClosetStorefront' });
  const goAddFirst = (isFirstItem = true) => navigation?.navigate?.('ProfileMain', {
    screen: 'MyClosetAddItemPhotos', params: { draft: {}, isFirstItem },
  });

  const goAllEbooks = () => navigation?.navigate?.('AllEbooks', {
    userData,
    loggedInUserId: loggedInUserId || currentUserId,
    isOwnProfile,
    closetId,
    username: userData?.userName || userData?.username || userData?.displayName || userData?.shopUsername || shopHandle || '',
    from: 'MyClosetShopFront'
  });

  const handleEbookPress = async (item) => {
    try {
      const itemId = item.id || item._id;
      const purchased = await AsyncStorage.getItem(`purchased_ebook_${itemId}`);
      const isPurchased = purchased === 'true' || isOwnProfile || item.isPurchased === true || item.isPurchased === 'true';
      if (isPurchased) {
        navigation?.navigate?.('EbookDetail', {
          ebook: item,
          userData,
          loggedInUserId: loggedInUserId || currentUserId,
          from: 'MyClosetShopFront',
          returnTo: navContext?.returnTo,
          fromEbookPublisher: !isOwnProfile,
          username: userData?.userName || userData?.username || item?.userName
        });
      } else {
        navigation?.navigate?.('EbookBuyDetails', {
          ebook: item,
          userData,
          loggedInUserId: loggedInUserId || currentUserId,
          from: 'MyClosetShopFront',
          username: userData?.userName || userData?.username || item?.userName
        });
      }
    } catch (err) {
      console.log('Error checking ebook purchase:', err);
    }
  };

  console.log("userDatauserDatauserDatauserDatauserData", userData)

  return (
    <ScrollView style={[s.root, bgStyle]} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* ── Banner ── */}
      {userData?.profile !== 'user' ? (
        <TouchableOpacity
          activeOpacity={0.9}
          style={[s.banner, cardStyle, { borderColor: border, borderWidth: StyleSheet.hairlineWidth }]}
          onPress={goStorefront}
        >
          {shopLogo ? (
            <Image source={{ uri: shopLogo }} style={s.previewLogo} />
          ) : (
            <View style={[s.bannerIcon, { backgroundColor: `${brand}18` }]}>
              <Ionicons name="storefront-outline" size={26} color={brand} />
            </View>
          )}
          <View style={s.bannerBody}>
            <Text style={[s.bannerTitle, { color: brand }]}>{shopName}</Text>
            <Text style={[s.bannerSub, { color: mutedText }]}>
              {shopDescription ? shopDescription : t('myClosetShopFront.shopOwnerBannerSubtitle')}
            </Text>
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          activeOpacity={0.9}
          style={[s.banner, cardStyle, { borderColor: border, borderWidth: StyleSheet.hairlineWidth }]}
          onPress={goStorefront}
        >
          {shopLogo ? (
            <Image source={{ uri: shopLogo }} style={s.previewLogo} />
          ) : (
            <View style={[s.bannerIcon, { backgroundColor: `${brand}18` }]}>
              <Ionicons name="bag-handle" size={26} color={brand} />
            </View>
          )}
          <View style={s.bannerBody}>
            <Text style={[s.bannerTitle, { color: brand }]}>{shopName}</Text>
            <Text style={[s.bannerSub, { color: mutedText }]}>
              {shopDescription ? shopDescription : t('myClosetShopFront.userBannerSubtitle')}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ── E-books Section ── */}
      {(ebooksLoading || ebooks.length > 0) && (
        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={s.sectionLeft}>
              <Text style={s.sectionEmoji}>📚</Text>
              <Text style={[s.sectionTitle, textStyle]}>E-books</Text>
            </View>
            <TouchableOpacity onPress={goAllEbooks} activeOpacity={0.7}>
              <Text style={[s.seeAll, { color: brand }]}>{t('myClosetShopFront.seeAll')} ›</Text>
            </TouchableOpacity>
          </View>

          {ebooksLoading && ebooks.length === 0 ? (
            <View style={s.center}><ActivityIndicator color={brand} /></View>
          ) : (
            <View style={s.ebookList}>
              {ebooks.slice(0, 3).map(item => {
                const itemId = item.id || item._id;
                const purchased = purchasedMap[itemId] || item.isPurchased === true || item.isPurchased === 'true';
                return (
                  <EbookRowItem
                    key={itemId}
                    item={item}
                    isPurchased={purchased}
                    isOwnProfile={isOwnProfile}
                    accent={accent}
                    onPress={() => handleEbookPress(item)}
                  />
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ── Battle Picks ── */}
      {(battlesLoading || displayBattles.length > 0) && (
        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={s.sectionLeft}>
              <Text style={s.sectionEmoji}>⚔️</Text>
              <Text style={[s.sectionTitle, textStyle]}>{t('myClosetShopFront.battlePicksTitle')}</Text>
            </View>
            <TouchableOpacity onPress={goBattles} activeOpacity={0.7}>
              <Text style={[s.seeAll, { color: brand }]}>{t('myClosetShopFront.seeAll')} ›</Text>
            </TouchableOpacity>
          </View>

          {battlesLoading && battles.length === 0 ? (
            <View style={s.center}><ActivityIndicator color={brand} /></View>
          ) : (
            <>
              <FlatList
                data={displayBattles}
                keyExtractor={b => b.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                renderItem={({ item }) => (
                  <BattleSlide
                    battle={item}
                    accent={brand}
                    t={t}
                    onPress={() => openBattle(item)}
                    card={card}
                    border={border}
                    textColor={text}
                    mutedText={mutedText}
                    isDark={isDarkMode}
                  />
                )}
              />
              <View style={s.dots}>
                {displayBattles.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      s.dot,
                      i === dotIdx
                        ? { backgroundColor: brand, width: 16 }
                        : { backgroundColor: border },
                    ]}
                  />
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {/* ── My Items ── */}
      <View style={s.section}>
        <View style={s.sectionHead}>
          <Text style={[s.sectionTitle, textStyle]}>
            {isOwnProfile
              ? t('myClosetShopFront.myItemsTitle')
              : t('myClosetShopFront.userItemsTitle', {
                name: userData?.displayName || 'User',
              })}
          </Text>
          {(isOwnProfile || tiles.length > 0) && (
            <TouchableOpacity onPress={goItems} activeOpacity={0.7}>
              <Text style={[s.seeAll, { color: brand }]}>{t('myClosetShopFront.seeAll')} ›</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={s.center}><ActivityIndicator color={brand} /></View>
        ) : tiles.length === 0 ? (
          isOwnProfile ? (
            <View style={s.center}>
              <Ionicons name="shirt-outline" size={32} color={mutedText} />
              <Text style={[s.emptyTxt, { color: mutedText }]}>{t('myClosetShopFront.noItemsYet')}</Text>
              <TouchableOpacity style={[s.addBtn, { borderColor: brand }]} onPress={() => goAddFirst(true)}>
                <Text style={[s.addBtnTxt, { color: brand }]}>{t('myClosetShopFront.addFirstItem')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.center}>
              <Text style={[s.emptyTxt, { color: mutedText }]}>{t('myClosetShopFront.noItemsAvailable')}</Text>
            </View>
          )
        ) : (
          <View style={s.grid}>
            {tiles.map(it => (
              <ItemTile
                key={it.key}
                item={it}
                accent={brand}
                card={card}
                border={border}
                textColor={text}
                mutedText={mutedText}
                isDark={isDarkMode}
                sellerId={targetUserId}
                onPress={() => { openItem(it); }}
              />
            ))}
            {isOwnProfile && (
              <TouchableOpacity activeOpacity={0.85} style={s.tile} onPress={() => goAddFirst(false)}>
                <View style={[s.tileThumb, s.addTile, { borderColor: border, backgroundColor: isDarkMode ? card : '#fafafa' }]}>
                  <Ionicons name="add" size={28} color={brand} />
                </View>
                <Text style={[s.tileName, { color: brand }]} numberOfLines={1}>
                  {t('myClosetShopFront.addNewItem')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

    </ScrollView>
  );
};

export default MyClosetShopFront;

// ── styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: 60 },

  /* banner */
  previewLogo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#f5f3ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  banner: {
    flexDirection: 'row', alignItems: 'center',
    margin: 12, padding: 14,
    borderRadius: 16,
    
  },
  bannerIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  bannerBody: { flex: 1 },
  bannerTitle: { fontSize: 16, fontWeight: '800', marginBottom: 3 },
  bannerSub: { fontSize: 12, lineHeight: 17 },

  /* section */
  section: { marginBottom: 20 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionEmoji: { fontSize: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  seeAll: { fontSize: 13, fontWeight: '600' },

  /* battle slide */
  slide: {
    width: SCREEN_W - 24,
    marginLeft: 12,
    flexDirection: 'column',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  battleHeader: { width: '100%', marginBottom: 12, alignItems: 'center' },
  battleTitle: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
  battleBody: { flexDirection: 'row', alignItems: 'center' },
  fighter: { flex: 1, alignItems: 'center' },
  fighterThumb: { width: 100, height: 100, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8, overflow: 'hidden' },
  fighterImg: { width: '100%', height: '100%', borderRadius: 12 },
  fighterName: { fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 2 },
  fighterPrice: { fontSize: 14, fontWeight: '800', marginBottom: 6 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  avatar: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#d1d5db' },
  username: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  pct: { fontSize: 12, fontWeight: '800', marginLeft: 2 },
  pctRed: { fontSize: 12, fontWeight: '800', color: '#ef4444', marginLeft: 2 },
  vsBubble: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginHorizontal: 6, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  vsText: { fontSize: 12, fontWeight: '900' },

  /* dots */
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 },
  dot: { height: 7, width: 7, borderRadius: 4 },

  /* items grid */
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 12 },
  tile: { width: CARD_W },
  tileThumb: { width: '100%', aspectRatio: 1, borderRadius: 14, overflow: 'hidden', marginBottom: 6 },
  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  tileImgWrap: { width: '100%', height: '100%' },
  tileImgPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f3ee' },
  fighterImgWrap: { width: '100%', height: '100%' },
  fighterThumbPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  heart: { position: 'absolute', top: 7, right: 7, borderRadius: 20, padding: 4 },
  tileName: { fontSize: 12, fontWeight: '700' },
  tilePrice: { fontSize: 13, fontWeight: '800', marginTop: 1 },

  /* empty / loading */
  center: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,243,238,0.72)',
    zIndex: 2,
  },
  emptyTxt: { fontSize: 14, fontWeight: '600' },
  addBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5 },
  addBtnTxt: { fontSize: 13, fontWeight: '700' },

  /* Ebook Row Styles */
  ebookList: {
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  ebookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f0ece8',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  ebookCoverContainer: {
    width: 60,
    height: 84,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#f5f3ee',
  },
  ebookCoverImage: {
    width: '100%',
    height: '100%',
  },
  ebookCover: {
    flex: 1,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ebookCoverPlaceholderText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  ebookCardBody: {
    flex: 1,
  },
  ebookTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  ebookDesc: {
    fontSize: 11,
    color: '#6b7280',
    lineHeight: 15,
    marginBottom: 6,
  },
  ebookMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ebookMeta: {
    fontSize: 10,
    fontWeight: '700',
  },
  ebookPriceTag: {
    fontSize: 12,
    fontWeight: '800',
    marginRight: 4,
  },
  ebookOwnedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#DEF7EC',
    borderRadius: 6,
  },
  ebookOwnedBadgeText: {
    color: '#03543F',
    fontSize: 10,
    fontWeight: '800',
  },
});
