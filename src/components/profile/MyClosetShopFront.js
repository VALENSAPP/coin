import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { normalizeProfileType } from '../../utils/supportEligibility';
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
import { AutoScrollBattleRow } from '../search/Battlecard';

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

const withAlpha = (hex, amount = 0.12) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return hex;
  const num = Math.round(Math.min(Math.max(0, amount), 1) * 255);
  const hexAlpha = num.toString(16).padStart(2, '0').toUpperCase();
  return `#${normalized}${hexAlpha}`;
};

const fastImageSource = uri =>
  uri
    ? {
      uri,
      priority: FastImage.priority.high,
      cache: FastImage.cacheControl.immutable,
    }
    : null;

const AutoScrollCarousel = ({ children, snapInterval }) => {
  const scrollViewRef = React.useRef(null);
  const isDragging = React.useRef(false);
  const offsetRef = React.useRef(0);
  const lastFrameTsRef = React.useRef(0);
  const autoScrollFrameRef = React.useRef(null);
  const numItems = React.Children.count(children);
  const isCarouselEnabled = numItems > 1;
  const AUTO_SCROLL_SPEED = 0.04;

  const totalWidth = numItems * snapInterval;

  const stopAutoScroll = React.useCallback(() => {
    if (autoScrollFrameRef.current) cancelAnimationFrame(autoScrollFrameRef.current);
    autoScrollFrameRef.current = null;
    lastFrameTsRef.current = 0;
  }, []);

  const startAutoScroll = React.useCallback(() => {
    if (!isCarouselEnabled || isDragging.current) return;
    stopAutoScroll();
    
    const tick = (timestamp) => {
      if (isDragging.current || !isCarouselEnabled) {
        stopAutoScroll();
        return;
      }
      if (!lastFrameTsRef.current) lastFrameTsRef.current = timestamp;
      const deltaMs = timestamp - lastFrameTsRef.current;
      lastFrameTsRef.current = timestamp;
      
      let next = offsetRef.current + deltaMs * AUTO_SCROLL_SPEED;
      
      // If we've scrolled past the first set of items, jump back seamlessly
      if (totalWidth > 0 && next >= totalWidth) {
        next = next - totalWidth;
      }
      
      scrollViewRef.current?.scrollTo({ x: next, animated: false });
      offsetRef.current = next;
      
      autoScrollFrameRef.current = requestAnimationFrame(tick);
    };
    
    autoScrollFrameRef.current = requestAnimationFrame(tick);
  }, [isCarouselEnabled, stopAutoScroll, totalWidth]);

  React.useEffect(() => {
    if (numItems <= 1) return;
    const timer = setTimeout(() => startAutoScroll(), 300);
    return () => {
      clearTimeout(timer);
      stopAutoScroll();
    };
  }, [numItems, startAutoScroll, stopAutoScroll]);

  const handleScroll = (e) => {
    if (e?.nativeEvent?.contentOffset?.x !== undefined) {
      offsetRef.current = e.nativeEvent.contentOffset.x;
    }
  };

  const resumeTimerRef = React.useRef(null);

  const handleInteractionStart = () => {
    isDragging.current = true;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    stopAutoScroll();
  };

  const handleInteractionEnd = (e) => {
    isDragging.current = false;
    if (e?.nativeEvent?.contentOffset?.x !== undefined) {
      offsetRef.current = e.nativeEvent.contentOffset.x;
    }
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      startAutoScroll();
    }, 1000);
  };

  if (!isCarouselEnabled) {
    return (
      <View style={{ flexDirection: 'row', paddingRight: 12 }}>
        {children}
      </View>
    );
  }

  // Duplicate children for infinite scroll
  const allChildren = React.Children.toArray(children);
  const loopedChildren = [...allChildren, ...allChildren];

  return (
    <ScrollView
      ref={scrollViewRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={handleScroll}
      onTouchStart={handleInteractionStart}
      onScrollBeginDrag={handleInteractionStart}
      onScrollEndDrag={handleInteractionEnd}
      onMomentumScrollEnd={handleInteractionEnd}
      onTouchEnd={handleInteractionEnd}
      onTouchCancel={handleInteractionEnd}
      contentContainerStyle={{ paddingRight: 12 }}
    >
      {loopedChildren.map((child, idx) => React.cloneElement(child, { key: `carousel-item-${idx}` }))}
    </ScrollView>
  );
};

const normalizePriorityBattle = battle => {
  const participants = Array.isArray(battle?.participants) ? [...battle.participants] : [];
  participants.sort((a, b) => Number(a?.position ?? 0) - Number(b?.position ?? 0));
  const [left, right] = participants;
  const winnerParticipant = participants.find(participant => participant?.isWinner) || null;
  const winnerProduct = battle?.winner?.product ?? battle?.winner?.item ?? winnerParticipant?.product ?? null;
  const primaryProduct = winnerProduct || left?.product || right?.product || null;

  return {
    id: String(battle?.id || battle?._id || ''),
    title: battle?.title || 'Pinned Item',
    price: fmt(primaryProduct?.price ?? battle?.price ?? 0),
    image: primaryProduct?.images?.[0] || primaryProduct?.image || null,
    badge: battle?.hasWinnerBadge ? 'Winner' : null,
    promoLabel: battle?.hasTenPercentOffPromotion
      ? '10% OFF + 2 GM'
      : battle?.hasFreeShippingPromotion
        ? 'Free Shipping'
        : null,
    pinLabel: battle?.isPinnedOnTop ? 'Pin' : null,
    raw: battle,
  };
};

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

const CachedImageBox = ({ uri, style, placeholderStyle, iconName, iconSize = 28, mutedColor = '#9b8c7a', loadingOverlayColor = 'rgba(245,243,238,0.72)' }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [uri]);

  if (!uri || failed) {
    return (
      <View style={[style, placeholderStyle]}>
        <Ionicons name={iconName} size={iconSize} color={mutedColor} />
      </View>
    );
  }

  return (
    <View style={style}>
      {!loaded && (
        <View style={[s.imageLoadingOverlay, { backgroundColor: loadingOverlayColor }]}>
          <ActivityIndicator size="small" color={mutedColor} />
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
    id: p.id,
    participantId: p.id,
    productId: product?.id || product?._id || p.productId || null,
    raw: p,
    name: product.name || '',
    price: fmt(product.price),
    image: thumb(product), // product.images[0]
    user: closet?.shopName || closet?.shopUsername || '',
    pct: Number(p.votePercentage ?? 0),
    isWinner: !!p.isWinner,
  };
};

export const mapBattle = (b, i) => {
  const sorted = [...(b.participants ?? [])].sort((a, c) => (a.position ?? 0) - (c.position ?? 0));
  const [p1, p2] = sorted;
  const winner = b?.winner || sorted.find(p => p?.isWinner) || null;
  const totalVotes = sorted.reduce(
    (sum, p) => sum + Number(p?.voteCount ?? p?.votesCount ?? p?.totalVotes ?? 0),
    0,
  );
  return {
    id: String(b.id ?? i),
    title: b.title,
    left: mapParticipant(p1, b.closet),
    right: mapParticipant(p2, b.closet),
    participants: sorted,
    winnerParticipantId: winner?.id || null,
    winnerProductId:
      winner?.product?.id ||
      winner?.product?._id ||
      winner?.productId ||
      winner?.raw?.productId ||
      null,
    winnerPct: Number(winner?.votePercentage ?? winner?.voteCount ?? winner?.pct ?? 0),
    totalVotes,
    status: b.status,
    outcome: b.outcome,
    sellerName: b.seller?.name
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

export const BattleSlide = ({ battle, accent, t, onPress, card, border, textColor, mutedText, isDark, thumbSurface, mutedColor, loadingOverlayColor, customWidth, imageSize }) => {
  let winnerSide = battle?.left?.isWinner ? 'left' : battle?.right?.isWinner ? 'right' : null;
  const isPending = battle?.status === 'LIVE' || battle?.outcome === 'PENDING';
  if (!winnerSide && !isPending) {
    if (battle?.winnerParticipantId) {
      if (battle.winnerParticipantId === battle?.left?.participantId) winnerSide = 'left';
      else if (battle.winnerParticipantId === battle?.right?.participantId) winnerSide = 'right';
    } else if (battle?.left?.pct !== undefined && battle?.right?.pct !== undefined) {
      if (battle.left.pct > battle.right.pct) winnerSide = 'left';
      else if (battle.right.pct > battle.left.pct) winnerSide = 'right';
    }
  }
  const showWinnerBadge = side => winnerSide === side;
  const winnerName = winnerSide === 'left' ? battle?.left?.name : battle?.right?.name;

  const renderWinnerBadge = (side) => {
    if (!winnerSide) return null;
    const isWinner = showWinnerBadge(side);
    const pct = side === 'left' ? battle?.left?.pct : battle?.right?.pct;
    return (
      <TouchableOpacity
        activeOpacity={isWinner ? 0.85 : 1}
        disabled={!isWinner}
        style={[s.winnerBadge, !isWinner && { opacity: 0 }]}
        onPress={() => isWinner && Alert.alert(
          t('myClosetShopFront.battleWinnerTitle') || 'Battle Winner',
          `${winnerName || 'This item'} won with ${pct}% of the votes.`,
        )}
      >
        <Text style={s.winnerBadgeText}>🏆 Winner</Text>
      </TouchableOpacity>
    );
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[
        s.slide,
        customWidth
          ? { width: customWidth, marginLeft: 0 }
          : null,
        { backgroundColor: card, borderColor: border },
      ]}
      onPress={onPress}
    >
      <View style={s.battleHeader}>
        <Text style={[s.battleTitle, { color: textColor }]} numberOfLines={1}>
          {battle.title || t('myClosetShopFront.battlePicksTitle')}
        </Text>
      </View>

      <View style={s.battleBody}>
        <View style={s.fighter}>
          <View style={[s.fighterThumb, imageSize ? { width: imageSize, height: imageSize } : {}, { backgroundColor: thumbSurface }]}>
            <CachedImageBox
              uri={battle.left.image}
              style={s.fighterImgWrap}
              placeholderStyle={s.fighterThumbPlaceholder}
              iconName="bag-outline"
              iconSize={34}
              mutedColor={mutedColor}
              loadingOverlayColor={loadingOverlayColor}
            />
          </View>
          <Text style={[s.fighterName, { color: textColor }]} numberOfLines={2}>{battle.left.name}</Text>
          <Text style={[s.fighterPrice, { color: textColor }]}>{battle.left.price}</Text>
          <View style={s.userRow}>
            <Text style={[s.pct, { color: accent }]}>{battle.left.pct}%</Text>
          </View>
          {renderWinnerBadge('left')}
        </View>

        <View style={[s.vsBubble, { backgroundColor: card, borderColor: border }]}>
          <Text style={[s.vsText, { color: textColor }]}>{t('myClosetShopFront.vs')}</Text>
        </View>

        <View style={s.fighter}>
          <View style={[s.fighterThumb, imageSize ? { width: imageSize, height: imageSize } : {}, { backgroundColor: thumbSurface }]}>
            <CachedImageBox
              uri={battle.right.image}
              style={s.fighterImgWrap}
              placeholderStyle={s.fighterThumbPlaceholder}
              iconName="bag-handle-outline"
              iconSize={34}
              mutedColor={mutedColor}
              loadingOverlayColor={loadingOverlayColor}
            />
          </View>
          <Text style={[s.fighterName, { color: textColor }]} numberOfLines={2}>{battle.right.name}</Text>
          <Text style={[s.fighterPrice, { color: textColor }]}>{battle.right.price}</Text>
          <View style={s.userRow}>
            <Text style={[s.pctRed, {color: accent}]}>{battle.right.pct}%</Text>
          </View>
          {renderWinnerBadge('right')}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const ItemTile = ({
  item,
  accent,
  onPress,
  onToggleWishlist,
  sellerId,
  winnerMeta,
  onWinnerPress,
  card,
  border,
  textColor,
  mutedText,
  isDark,
  thumbSurface,
  mutedColor,
  loadingOverlayColor,
  isOwnProfile
}) => {
  const [liked, setLiked] = useState(false);
  const [updatingWishlist, setUpdatingWishlist] = useState(false);
  const [wishlistItemId, setWishlistItemId] = useState(null);
  console.log("------------winnerMeta---------------", winnerMeta)

  useEffect(() => {
    let mounted = true;
    const loadWishlistState = async () => {
      const productId = item.raw?.productId || item.raw?.product?.id || item.raw?.id || item.raw?._id || item.key;
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
      const productId = item.raw?.productId || item.raw?.product?.id || item.raw?.id || item.raw?._id || item.key;
      if (nextLiked) {
        await addWishlistItem(productId);
        const refresh = await getWishlist(sellerId);
        const { match } = findWishlistItemForProduct(refresh, productId);
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
      <View style={[s.tileThumb, { backgroundColor: thumbSurface }]}>
        <CachedImageBox
          uri={item.image}
          style={s.tileImgWrap}
          placeholderStyle={[s.tileImgPlaceholder, { backgroundColor: thumbSurface }]}
          iconName="shirt-outline"
          iconSize={28}
          mutedColor={mutedColor}
          loadingOverlayColor={loadingOverlayColor}
        />
        {winnerMeta ? (
          <TouchableOpacity
            activeOpacity={0.85}
            style={s.winnerChip}
            onPress={onWinnerPress}
          >
            <Text style={s.winnerChipText}>🏆 Winner</Text>
          </TouchableOpacity>
        ) : null}
        {!isOwnProfile &&
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
        }
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

const EbookRowItem = React.memo(({
  item,
  isPurchased,
  isOwnProfile,
  accent,
  text,
  mutedText,
  card,
  border,
  onPress,
}) => {
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
      style={[s.ebookCard, { backgroundColor: card, borderColor: border }]}
    >
      <View style={[s.ebookCoverContainer, { backgroundColor: border }]}>
        {coverImage ? (
          <Image source={{ uri: coverImage }} style={s.ebookCoverImage} resizeMode="cover" />
        ) : (
          <View style={[s.ebookCover, { backgroundColor: palette.bg }]}>
            <Text style={s.ebookCoverPlaceholderText}>{title.charAt(0).toUpperCase()}</Text>
          </View>
        )}
      </View>
      <View style={s.ebookCardBody}>
        <Text style={[s.ebookTitle, { color: text }]} numberOfLines={1}>{title}</Text>
        <Text style={[s.ebookDesc, { color: mutedText }]} numberOfLines={2}>{description}</Text>
        <View style={s.ebookMetaRow}>
          <Text style={[s.ebookMeta, { color: text }]}>📚 {item?.tableContent?.length || 0} Chapters</Text>
          {showPurchasedBadge ? (
            <View style={s.ebookOwnedBadge}>
              <Text style={s.ebookOwnedBadgeText}>{isOwnProfile ? 'Owned' : 'Purchased'}</Text>
            </View>
          ) : (
            <Text style={[s.ebookPriceTag, { color: text }]}>{priceLabel}</Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={mutedText} />
    </TouchableOpacity>
  );
});

const MyClosetShopFront = ({ navigation, userData, shopDraft, isOwnProfile = true, loggedInUserId, closetNavContext }) => {
  const { t } = useLanguage();
  const [storedUsername, setStoredUsername] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
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
  const [pinnedItems, setPinnedItems] = useState([]);

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
  } = useAppTheme(normalizeProfileType(userData?.profile) === 'company' ? 'company' : 'user');
  const { isDarkMode } = useThemeContext();
  const brand = accent || text;
  const thumbSurface = isDarkMode ? border : '#f5f3ee';
  const loadingOverlayColor = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(245,243,238,0.72)';
  const logoSurface = isDarkMode ? 'rgba(255,255,255,0.08)' : '#f5f3ff';

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
      setPinnedItems(raw.filter(b => b?.isPinnedOnTop).map(normalizePriorityBattle).filter(b => b.id));
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

  const battleWinnerMap = useMemo(() => {
    const map = new Map();
    battles.forEach(battle => {
      const winner = battle?.left?.isWinner ? battle.left : battle?.right?.isWinner ? battle.right : null;
      const pct = Number(battle?.winnerPct ?? winner?.pct ?? 0);
      const meta = {
        pct,
        battleId: battle.id,
        battleTitle: battle.title,
        totalVotes: battle.totalVotes,
      };
      const ids = [
        battle?.winnerProductId,
        winner?.productId,
        winner?.raw?.productId,
        winner?.raw?.product?.id,
        winner?.raw?.product?._id,
        winner?.participantId,
        winner?.id,
      ].filter(Boolean);
      ids.forEach(id => {
        map.set(String(id), meta);
      });
    });
    return map;
  }, [battles]);

  useEffect(() => {
    const urls = [
      ...tiles.map(t => t.image),
      ...displayBattles.flatMap(b => [b.left?.image, b.right?.image]),
    ].filter(Boolean);

    if (urls.length) {
      FastImage.preload([...new Set(urls)].map(uri => imageSource(uri)));
    }
  }, [displayBattles, tiles]);

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
    { items, seller, sellerId: userData?.id, closetId, isOwnProfile, battles },
  ));

  const openItem = (item, winnerMeta) => navigation?.navigate?.('MyClosetBuyerItemDetail', withClosetNavParams(
    { params: navContext },
    {
      item: item?.raw || item,
      items,
      seller,
      sellerId: userData?.id,
      closetId,
      isOwnProfile,
      battleWinner: winnerMeta || null,
    },
  ));

  const route = useRoute();
  const itemIdToOpen = route?.params?.itemId || route?.params?.params?.itemId || closetNavContext?.itemId;
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  useEffect(() => {
    if (itemIdToOpen && !hasAutoOpened && items.length > 0) {
      const targetItem = items.find(i => String(i.id || i._id) === String(itemIdToOpen));
      if (targetItem) {
        setHasAutoOpened(true);
        openItem(targetItem);
      } else {
        setHasAutoOpened(true);
      }
    }
  }, [itemIdToOpen, hasAutoOpened, items]);

  const goBattles = () => navigation?.navigate?.('ProfileMain', {
    screen: 'MyClosetBattles', // or whatever route name you register MyClosetBattlesScreen under
    params: { closetId, userProfile: userData?.profile },
  });
  const openBattle = battle => navigateToBattleLive(navigation, {
    battleId: battle?.id,
    initialBattle: battle,
    userProfile: userData?.profile,
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

  console.log("displayBattlesdisplayBattlesdisplayBattlesdisplayBattlesdisplayBattles", displayBattles)
  console.log("tilestilestilestilestilestilestilestiles", tiles)

  return (
    <ScrollView
      style={[s.root, bgStyle]}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >

      {/* ── Banner ── */}
      {userData?.profile !== 'user' ? (
        <TouchableOpacity
          activeOpacity={0.9}
          style={[s.banner, cardStyle, { borderColor: border, borderWidth: StyleSheet.hairlineWidth }]}
          onPress={goStorefront}
        >
          {shopLogo ? (
            <Image source={{ uri: shopLogo }} style={[s.previewLogo, { backgroundColor: logoSurface }]} />
          ) : (
            <View style={[s.bannerIcon, { backgroundColor: `${brand}18` }]}>
              <Ionicons name="storefront-outline" size={26} color={brand} />
            </View>
          )}
          <View style={s.bannerBody}>
            <Text style={[s.bannerTitle, { color: text }]}>{shopName}</Text>
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
            <Image source={{ uri: shopLogo }} style={[s.previewLogo, { backgroundColor: logoSurface }]} />
          ) : (
            <View style={[s.bannerIcon, { backgroundColor: `${brand}18` }]}>
              <Ionicons name="bag-handle" size={26} color={brand} />
            </View>
          )}
          <View style={s.bannerBody}>
            <Text style={[s.bannerTitle, { color: text }]}>{shopName}</Text>
            <Text style={[s.bannerSub, { color: mutedText }]}>
              {shopDescription ? shopDescription : t('myClosetShopFront.userBannerSubtitle')}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ── E-books Section ── */}
      {(ebooksLoading || ebooks.length > 0) && (
        <View style={[s.section, { marginTop: 12 }]}>
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
                    text={text}
                    mutedText={mutedText}
                    card={card}
                    border={border}
                    onPress={() => handleEbookPress(item)}
                  />
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ── Pinned Item ── */}
      {(battlesLoading || pinnedItems.length > 0) && (
        <>
          <View style={[s.sectionHead, { marginTop: -15 }]}>
            <Text style={s.sectionTitle}>
              {t('myClosetDashboard.pinnedItemTitle') || 'Pinned Item'}
            </Text>
            {(pinnedItems.length > 3) && (
              <TouchableOpacity activeOpacity={0.8} onPress={goBattles}>
                <Text style={[s.seeAll, { color: accent }]}>{t('myClosetShopFront.seeAll')} ›</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={[s.pinnedSection, { backgroundColor: '#fff' }, { borderColor: withAlpha(text, 0.12) }]}>
            {battlesLoading && pinnedItems.length === 0 ? (
              <View style={s.itemsLoadingWrap}>
                <ActivityIndicator color={text} />
              </View>
            ) : (
              pinnedItems.slice(0, 3).map(item => (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.8}
                  onPress={() => openBattle(item)}
                >
                  <View style={s.pinnedCard}>
                    <View style={s.pinnedThumbWrap}>
                      {item.image ? (
                        <FastImage
                          source={fastImageSource(item.image)}
                          style={s.pinnedThumb}
                          resizeMode={FastImage.resizeMode.cover}
                        />
                      ) : (
                        <View style={[s.pinnedThumb, s.pinnedThumbPlaceholder]}>
                          <Ionicons name="shirt-outline" size={26} color={text} />
                        </View>
                      )}
                    </View>

                    <View style={s.pinnedBody}>
                      <View style={s.pinnedTopRow}>
                        <Text style={[s.pinnedTitle, { color: text }]} numberOfLines={1}>{item.title}</Text>
                        {item.badge ? (
                          <View style={s.pinnedWinnerBadge}>
                            <Text style={s.pinnedWinnerBadgeText}>🏆 {item.badge}</Text>
                          </View>
                        ) : null}
                      </View>

                      <Text style={[s.pinnedPrice, { color: text }]}>{item.price}</Text>

                      <View style={s.pinnedBottomRow}>
                        {/* {item.promoLabel ? (
                          <View style={s.promoPill}>
                            <Text style={s.promoPillText}>{item.promoLabel}</Text>
                          </View>
                        ) : <View />} */}

                        {item.pinLabel ? (
                          <View style={s.pinPill}>
                            <Ionicons name="pin-outline" size={14} color={text} />
                            <Text style={[s.pinPillText, { color: text }]}>{item.pinLabel}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </>
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
            <View style={{ marginBottom: 12 }}>
              <AutoScrollCarousel snapInterval={SCREEN_W - 12}>
                {displayBattles.map((item) => (
                  <View key={item.id} style={{ width: SCREEN_W - 12 }}>
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
                      thumbSurface={thumbSurface}
                      mutedColor={mutedText}
                      loadingOverlayColor={loadingOverlayColor}
                    />
                  </View>
                ))}
              </AutoScrollCarousel>
            </View>
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
            {tiles.map(it => {
              const itemId = String(it.raw?.productId || it.raw?.product?.id || it.raw?.id || it.raw?._id || it.key);
              const winnerMeta = battleWinnerMap.get(itemId) || null;
              return (
                <ItemTile
                  key={it.key}
                  item={it}
                  accent={brand}
                  card={card}
                  border={border}
                  textColor={text}
                  mutedText={mutedText}
                  isDark={isDarkMode}
                  thumbSurface={thumbSurface}
                  mutedColor={mutedText}
                  loadingOverlayColor={loadingOverlayColor}
                  sellerId={targetUserId}
                  winnerMeta={winnerMeta}
                  isOwnProfile={isOwnProfile}
                  onWinnerPress={() => {
                    if (!winnerMeta) return;
                    Alert.alert(
                      t('myClosetShopFront.battleWinnerTitle') || 'Battle Winner',
                      `${it.name} won with ${winnerMeta.pct}% of the votes.`,
                    );
                  }}
                  onPress={() => { openItem(it, winnerMeta); }}
                />
              );
            })}
            {isOwnProfile && (
              <TouchableOpacity activeOpacity={0.85} style={s.tile} onPress={() => goAddFirst(false)}>
                <View style={[s.tileThumb, s.addTile, { borderColor: border, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#fafafa' }]}>
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
  pinnedSection: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginBottom: 30,
    marginHorizontal: 12,
  },
  pinnedCard: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  pinnedThumbWrap: {
    width: 84,
    height: 84,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f5f3ef',
  },
  pinnedThumb: {
    width: '100%',
    height: '100%',
  },
  pinnedThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinnedBody: {
    flex: 1,
    justifyContent: 'center',
  },
  pinnedTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  pinnedTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  pinnedPrice: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '900',
  },
  pinnedWinnerBadge: {
    backgroundColor: '#fde68a',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pinnedWinnerBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7c2d12',
  },
  pinnedBottomRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  promoPill: {
    backgroundColor: '#f97316',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  promoPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  pinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f5f3ff',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pinPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  sectionMeta: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  itemsLoadingWrap: { padding: 20, alignItems: 'center', justifyContent: 'center' },
  root: { flex: 1 },
  content: { paddingBottom: 60 },

  /* banner */
  previewLogo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    overflow: 'hidden',
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
  winnerBadge: {
    backgroundColor: '#fbbf24',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  winnerBadgeText: { fontSize: 10, fontWeight: '900', color: '#111827', letterSpacing: 0.2, textAlign: 'center' },
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
  tileImgPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  winnerChip: {
    position: 'absolute',
    width: '100%',
    bottom: 0,
    zIndex: 5,
    backgroundColor: '#fbbf24',
    paddingVertical: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  winnerChipText: { fontSize: 9, fontWeight: '900', color: '#111827', letterSpacing: 0.2 },
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
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
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
    marginBottom: 4,
  },
  ebookDesc: {
    fontSize: 11,
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
