import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import {
  getMyClosetItems,
  getSellerOrders,
  getBuyerOrders,
  getSellerDashboard,
  getMarketplaceOverview,
  getMyClosetMe,
  getClosetBattlesPriority,
  getbattlePerformance,
} from '../../services/myCloset';
import { getMarketplaceEbooksByClosetId } from '../../services/post';
import { EbookCard } from './AllEbooksScreen';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';

const mixWithWhite = (hex, amount = 0.88) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return '#f5f3ff';
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const mix = channel => Math.round(channel + (255 - channel) * amount);
  const toHex = channel => mix(channel).toString(16).padStart(2, '0');
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

// Formats a raw percent number (e.g. -100, 18, 0) into a signed display string ("+18%", "-100%", "0%").
// Returns null when there is no meaningful value yet, so the UI can hide the delta pill.
const formatDelta = percent => {
  if (percent == null || Number.isNaN(Number(percent))) return null;
  const value = Number(percent);
  if (value === 0) return '0%';
  return `${value > 0 ? '+' : ''}${value}%`;
};

// data here is the /dashboard/marketPlaceOverview payload:
// { viewsCount, likesCount, ordersCount, revenue, previousPeriod, changes }
const buildStatCards = (data, t) => ([
  {
    key: 'views',
    label: t('myClosetDashboard.stats.views'),
    value: String(data?.viewsCount ?? 0),
    delta: formatDelta(data?.changes?.viewsPercent),
    icon: 'eye-outline',
  },
  {
    key: 'likes',
    label: t('myClosetDashboard.stats.likes'),
    value: String(data?.likesCount ?? 0),
    delta: formatDelta(data?.changes?.likesPercent),
    icon: 'heart-outline',
  },
  {
    key: 'orders',
    label: t('myClosetDashboard.stats.orders'),
    value: String(data?.ordersCount ?? 0),
    delta: formatDelta(data?.changes?.ordersPercent),
    icon: 'bag-outline',
  },
  {
    key: 'revenue',
    label: t('myClosetDashboard.stats.revenue'),
    value: `$${Number(data?.revenue ?? 0).toFixed(0)}`,
    delta: formatDelta(data?.changes?.revenuePercent),
    icon: 'cash-outline',
  },
]);

// This still comes from the general /dashboard endpoint (totalItems/sold/rating aren't
// part of the marketplace overview by-range payload).
const buildOverviewCards = (data, t) => ([
  { key: 'items', label: t('myClosetDashboard.overview.items'), value: String(data?.totalItems ?? 0) },
  { key: 'sold', label: t('myClosetDashboard.overview.sold'), value: String(data?.sold ?? 0) },
  { key: 'earnings', label: t('myClosetDashboard.overview.earnings'), value: `$${Number(data?.revenue ?? 0).toFixed(0)}` },
  // { key: 'rating', label: t('myClosetDashboard.overview.rating'), value: data?.rating != null ? String(data.rating) : '—' },
]);

const buildBattleStats = (data, t) => ([
  { key: 'created', label: t('myClosetDashboard.battle.created'), value: String(data?.totalBattlesCreated ?? 0), icon: 'trophy-outline' },
  { key: 'votes', label: t('myClosetDashboard.battle.votes'), value: String(data?.totalVotes ?? 0), icon: 'people-outline' },
  { key: 'views', label: t('myClosetDashboard.battle.views'), value: String(data?.totalViews ?? 0), icon: 'eye-outline' },
]);

const unwrapBattlePriorityResponse = source => {
  const root = source?.data?.data ?? source?.data ?? source;
  const battles = root?.battles ?? root?.data?.battles ?? root?.items ?? root ?? [];
  return Array.isArray(battles) ? battles : [];
};

const formatCurrency = value => {
  if (value == null || value === '') return '$0.00';
  const textValue = String(value).trim();
  if (textValue.startsWith('$')) return textValue;
  const numericValue = Number(textValue);
  return Number.isNaN(numericValue) ? textValue : `$${numericValue.toFixed(0)}`;
};

const fastImageSource = uri =>
  uri
    ? {
        uri,
        priority: FastImage.priority.high,
        cache: FastImage.cacheControl.immutable,
      }
    : null;

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
    price: formatCurrency(primaryProduct?.price ?? battle?.price ?? 0),
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

const navigateToBattleList = (navigation, closetId) => {
  navigation?.navigate?.('ProfileMain', {
    screen: 'MyClosetBattles',
    params: {
      ...(closetId ? { closetId } : {}),
      isOwnProfile: true,
      returnTo: { tab: 'wallet', screen: 'Shop' },
    },
  });
};

const ORDER_STATUS_KEYS = {
  pending: 'myClosetDashboard.orderStatus.pending',
  confirmed: 'myClosetDashboard.orderStatus.confirmed',
  processing: 'myClosetDashboard.orderStatus.processing',
  shipped: 'myClosetDashboard.orderStatus.shipped',
  delivered: 'myClosetDashboard.orderStatus.delivered',
  cancelled: 'myClosetDashboard.orderStatus.cancelled',
};

const ORDER_STATUS_COLORS = {
  pending: '#7c3aed',
  confirmed: '#0891b2',
  processing: '#d97706',
  shipped: '#2563eb',
  delivered: '#16a34a',
  cancelled: '#dc2626',
};

const normalizeOrderStatus = raw => {
  const value = String(raw || '').trim().toLowerCase();
  if (['delivered', 'shipped', 'processing', 'confirmed', 'cancelled'].includes(value)) {
    return value;
  }
  return 'pending';
};

const formatOrderPrice = value => {
  if (value == null || value === '') return '$0.00';
  const textValue = String(value).trim();
  if (textValue.startsWith('$')) return textValue;
  const numericValue = Number(textValue);
  return Number.isNaN(numericValue) ? textValue : `$${numericValue.toFixed(2)}`;
};

const unwrapOrderImage = item =>
  item?.productImage ||
  item?.product?.images?.[0] ||
  item?.product?.image ||
  item?.image ||
  item?.thumbnail ||
  null;

const getOrderThumbImage = order =>
  order?.items?.[0]?.productImage ||
  order?.items?.[0]?.product?.images?.[0] ||
  order?.items?.[0]?.product?.image ||
  order?.items?.[0]?.image ||
  order?.item?.images?.[0] ||
  order?.item?.image ||
  order?.product?.images?.[0] ||
  order?.image ||
  null;

const getOrderDisplayName = (order, t) => {
  if (order?.item?.name || order?.item?.title) return order.item.name || order.item.title;
  if (order?.product?.name) return order.product.name;
  if (order?.itemName) return order.itemName;
  const count = order?.totalItemCount;
  if (count) return t('myClosetDashboard.orderItemsCount', { count });
  return t('myClosetDashboard.orderItemFallback');
};

const getOrderAmount = order =>
  order?.totalAmount ?? order?.amount ?? order?.price ?? order?.item?.price ?? 0;

const normalizeBuyerOrder = (order, index, t) => {
  const status = normalizeOrderStatus(order?.orderStatus ?? order?.status);
  const items = Array.isArray(order?.items) ? order.items : [];
  const primaryItem = items[0] || order?.item || order?.product || null;
  const itemCount = Number(order?.totalItemCount ?? items.length ?? 0);
  return {
    key: String(order?.id || order?._id || index),
    id: order?.id || order?._id,
    name: getOrderDisplayName(order, t),
    buyerName: order?.buyerName || order?.buyer?.username || order?.buyer?.userName || 'Buyer',
    order: t('myClosetDashboard.orderNumber', {
      number: order?.orderNumber || order?.orderId || order?.id || order?._id || index + 1,
    }),
    orderNumber: order?.orderNumber || order?.orderId || order?.id || order?._id || index + 1,
    price: formatOrderPrice(getOrderAmount(order)),
    totalAmount: formatOrderPrice(order?.totalAmount ?? order?.amount ?? order?.total),
    status: t(ORDER_STATUS_KEYS[status]),
    statusKey: status,
    statusColor: ORDER_STATUS_COLORS[status],
    image: getOrderThumbImage(order),
    createdAt: order?.createdAt || order?.created_at || null,
    totalItemCount: itemCount,
    firstItem: primaryItem,
    itemImages: items.map(unwrapOrderImage).filter(Boolean),
    rawItems: items,
    raw: order,
  };
};

const MyClosetDashboard = ({ navigation, userData, shopDraft }) => {
  const { t } = useLanguage();
  const [storedUsername, setStoredUsername] = useState('');
  const [closetItems, setClosetItems] = useState([]);
  const [shopName, setShopName] = useState('');
  const [shopHandle, setShopHandle] = useState('');
  const [closetId, setClosetId] = useState(null);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [recentOrders, setRecentOrders] = useState([]);            // Seller: orders received
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [buyerOrders, setBuyerOrders] = useState([]);         // Buyer: orders placed
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [buyerOrdersLoading, setBuyerOrdersLoading] = useState(false);

  // Marketplace overview (views/likes/orders/revenue by range) — GET /dashboard/marketPlaceOverview
  const [overviewRange, setOverviewRange] = useState('weekly'); // 'weekly' | 'monthly'
  const [marketplaceOverview, setMarketplaceOverview] = useState(null);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [battlePerformance, setBattlePerformance] = useState(null);
  const [battlePerformanceLoading, setBattlePerformanceLoading] = useState(false);
  const [priorityBattles, setPriorityBattles] = useState([]);
  const [priorityBattlesLoading, setPriorityBattlesLoading] = useState(false);
  const [currentUserName, setCurrentUserName] = useState('');
  const [dashboardEbooks, setDashboardEbooks] = useState([]);
  const [ebooksLoading, setEbooksLoading] = useState(false);

  const { bgStyle, textStyle, text, cardStyle } = useAppTheme();
  const battleStats = useMemo(() => buildBattleStats(battlePerformance, t), [battlePerformance, t]);

  const dispatch = useDispatch();

  useEffect(() => {
    let isMounted = true;
    const loadUsername = async () => {
      try {
        const value = await AsyncStorage.getItem('currentUsername');
        setCurrentUserName(value)
        if (isMounted && value) setStoredUsername(value);
      } catch {
        // Ignore storage read issues
      }
    };
    loadUsername();
    return () => { isMounted = false; };
  }, []);

  const loadRecentOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const response = await getSellerOrders({ page: 1, limit: 3 });
      const payload =
        response?.data?.data ??
        response?.data?.orders ??
        response?.data ??
        response;

      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.orders)
          ? payload.orders
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

      setRecentOrders(list.slice(0, 3).map((order, index) => normalizeBuyerOrder(order, index, t)));
    } catch (error) {
      console.warn('Unable to load recent orders:', error);
      setRecentOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [t]);

  const loadBuyerOrders = useCallback(async () => {
    setBuyerOrdersLoading(true);
    try {
      const response = await getBuyerOrders();
      const payload =
        response?.data?.data ??
        response?.data?.orders ??
        response?.data ??
        response;

      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.orders)
          ? payload.orders
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

      setBuyerOrders(list.slice(0, 3).map((order, index) => normalizeBuyerOrder(order, index, t)));
    } catch (error) {
      console.warn('Unable to load buyer orders:', error);
      setBuyerOrders([]);
    } finally {
      setBuyerOrdersLoading(false);
    }
  }, [t]);

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const response = await getSellerDashboard();
      const data = response?.data?.data ?? response?.data ?? response;
      setDashboardData(data);
    } catch (error) {
      console.warn('Unable to load dashboard stats:', error);
      setDashboardData(null);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  // Fetches GET /dashboard/marketPlaceOverview?range=weekly|monthly
  const loadMarketplaceOverview = useCallback(async range => {
    setMarketplaceLoading(true);
    try {
      const response = await getMarketplaceOverview(range);
      const data = response?.data?.data ?? response?.data ?? response;
      setMarketplaceOverview(data);
    } catch (error) {
      console.warn('Unable to load marketplace overview:', error);
      setMarketplaceOverview(null);
    } finally {
      setMarketplaceLoading(false);
    }
  }, []);

  const loadBattlePerformance = useCallback(async () => {
    setBattlePerformanceLoading(true);
    try {
      const response = await getbattlePerformance();
      const data = response?.data?.data ?? response?.data ?? response;
      setBattlePerformance(data);
    } catch (error) {
      console.warn('Unable to load battle performance:', error);
      setBattlePerformance(null);
    } finally {
      setBattlePerformanceLoading(false);
    }
  }, []);

  const resolvedClosetId = closetId || userData?.closetId || userData?.myClosetId || userData?.closet?.id || userData?.closet?._id;

  const loadPriorityBattles = useCallback(async () => {
    if (!resolvedClosetId) {
      setPriorityBattles([]);
      return;
    }

    setPriorityBattlesLoading(true);
    try {
      const response = await getClosetBattlesPriority(resolvedClosetId, { page: 1, limit: 10 });
      const battles = unwrapBattlePriorityResponse(response)
        .filter(battle => battle?.isPinnedOnTop)
        .map(normalizePriorityBattle)
        .filter(battle => battle.id);
      setPriorityBattles(battles);
    } catch (error) {
      console.warn('Unable to load closet battle priority:', error);
      setPriorityBattles([]);
    } finally {
      setPriorityBattlesLoading(false);
    }
  }, [closetId, userData?.closetId, userData?.myClosetId, userData?.closet?.id, userData?.closet?._id]);

  const loadEbooks = useCallback(async () => {
    if (!resolvedClosetId) {
      setDashboardEbooks([]);
      return;
    }
    setEbooksLoading(true);
    try {
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
      setDashboardEbooks(ebookData.slice(0, 3));
    } catch (error) {
      console.warn('Unable to load ebooks:', error);
      setDashboardEbooks([]);
    } finally {
      setEbooksLoading(false);
    }
  }, [resolvedClosetId]);

  const loadClosetItems = useCallback(async () => {
    setItemsLoading(true);
    try {
      const response = await getMyClosetItems();
      const payload =
        response?.data?.data ??
        response?.data?.items ??
        response?.data ??
        response;

      const items = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

      setClosetItems(items);
    } catch (error) {
      console.warn('Unable to load closet items:', error);
      setClosetItems([]);
    } finally {
      setItemsLoading(false);
    }
  }, []);

  const checkShopState = async () => {
    dispatch(showLoader());
    try {
      const response = await getMyClosetMe();
      const data = response?.data?.data ?? response?.data ?? {};
      setShopName(data?.shopName);
      setShopHandle(data?.shopUsername);
      setClosetId(data?.closetId ?? data?.id ?? data?._id ?? data?.closet?.id ?? data?.closet?._id ?? null);
    } catch (error) {
      console.warn('Unable to load closet items:', error);
    } finally {
      dispatch(hideLoader());
    }
  };

  useFocusEffect(
    useCallback(() => {
      checkShopState();
      loadClosetItems();
      loadRecentOrders();
      loadBuyerOrders();
      loadDashboard();
      loadMarketplaceOverview(overviewRange);
      loadBattlePerformance();
    }, [loadClosetItems, loadRecentOrders, loadBuyerOrders, loadDashboard, loadMarketplaceOverview, loadBattlePerformance, overviewRange]),
  );

  useEffect(() => {
    if (!closetId) return;
    loadPriorityBattles();
    loadEbooks();
  }, [closetId, loadPriorityBattles, loadEbooks]);

  const statCards = useMemo(() => buildStatCards(marketplaceOverview, t), [marketplaceOverview, t]);
  const overviewCards = useMemo(() => buildOverviewCards(dashboardData, t), [dashboardData, t]);

  const handleToggleRange = () => {
    setOverviewRange(prev => (prev === 'weekly' ? 'monthly' : 'weekly'));
  };

  const avatarUri =
    shopDraft?.logo?.uri ||
    userData?.image ||
    userData?.avatar ||
    userData?.profilePicture ||
    null;

  const handleAddItemPress = () => {
    navigation?.navigate?.('ProfileMain', {
      screen: 'MyClosetAddItemPhotos',
      params: {
        draft: {},
        isFirstItem: closetItems.length === 0,
      },
    });
  };

  const handleSharePress = () => {
    navigation?.navigate?.('ProfileMain', {
      screen: 'ShareProfile',
      params: { userData, initialTab: 'closet', shopHandle },
    });
  };

  // sellerId is threaded through to CreateBattleScreen so it can call
  // GET /mycloset/items?userId=... for the right seller's closet.
  const handleCreateBattlePress = () => {
    navigation?.navigate?.('ProfileMain', {
      screen: 'CreateBattle', // same — must exist in ProfileStack
      params: {
        sellerId: userData?.id || userData?._id,
      },
    });
  };

  const handleViewAllBattles = () => {
    navigateToBattleList(navigation, resolvedClosetId);
  };

  const handleViewAllItems = () => {
    navigation?.navigate?.('ProfileMain', {
      screen: 'MyClosetItemsManagement',
      params: { section: 'items' },
    });
  };

  const handleViewAllEbooks = () => {
    const username = currentUserName;
    navigation?.navigate?.('ProfileMain', {
      screen: 'AllEbooks',
      params: {
        userData,
        loggedInUserId: userData?.id || userData?._id,
        isOwnProfile: true,
        closetId: resolvedClosetId,
        username,
        from: 'MyClosetDashboard',
        returnTo: 'MyClosetDashboard',
      },
    });
  };

  const handleViewAllOrders = () => {
    navigation?.navigate?.('ProfileMain', {
      screen: 'MyClosetOrders',
      params: { viewType: 'seller' },
    });
  };

  const handleOpenAnalytics = () => {
    navigation?.navigate?.('wallet', {
      screen: 'MarketplaceAnalytics',
    });
  };

  const handleOpenEarnings = () => {
    navigation?.navigate?.('MyClosetEarnings');
  };

  const handleOpenOrder = order => {
    navigation?.navigate?.('ProfileMain', {
      screen: 'MyClosetOrderDetail',
      params: {
        orderId: order.raw?.id || order.raw?._id || order.id,
        orderPreview: order.raw,
        viewType: 'seller',
      },
    });
  };

  const handleViewAllBuyerOrders = () => {
    navigation?.navigate?.('ProfileMain', {
      screen: 'MyClosetOrders',
      params: { viewType: 'buyer' },
    });
  };

  const handleOpenBuyerOrder = order => {
    navigation?.navigate?.('ProfileMain', {
      screen: 'MyClosetOrderDetail',
      params: {
        orderId: order.raw?.id || order.raw?._id || order.id,
        orderPreview: order.raw,
        viewType: 'buyer',
        returnTo: 'MyClosetDashboard'
      },
    });
  };

  const formatPrice = value => {
    if (value == null || value === '') return '$0.00';
    const textValue = String(value).trim();
    if (textValue.startsWith('$')) return textValue;
    const numericValue = Number(textValue);
    if (Number.isNaN(numericValue)) return textValue;
    return `$${numericValue.toFixed(2)}`;
  };

  const getItemImage = item => item?.images?.[0] || item?.image || item?.thumbnail || null;

  const displayItems = closetItems.slice(0, 6).map((item, index) => ({
    key: String(item?.id || item?._id || index),
    name: item?.name || item?.title || item?.itemName || t('myClosetDashboard.untitledItem'),
    price: formatPrice(item?.price ?? item?.amount ?? item?.salePrice),
    image: getItemImage(item),
    raw: item,
  }));
  const pinnedItems = priorityBattles.slice(0, 3);
  const showPinnedViewAll = priorityBattles.length > pinnedItems.length;

  return (
    <ScrollView
      style={[styles.container, bgStyle]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero Profile Card ── */}
      <View style={[styles.heroCard, cardStyle, { borderColor: withAlpha(text, 0.12) }]}>
        <View style={styles.heroTop}>
          <View style={styles.heroLeft}>
            <View style={[styles.heroBadge, { backgroundColor: mixWithWhite(text) }]}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.heroAvatar} />
              ) : (
                <Ionicons name="bag-handle" size={30} color={text} />
              )}
              <View style={[styles.verifiedDot, { backgroundColor: text }]}>
                <Ionicons name="checkmark" size={9} color="#fff" />
              </View>
            </View>
            <View style={styles.heroMeta}>
              <Text style={[styles.heroTitle, textStyle]}>{shopName}</Text>
              <Text style={styles.heroHandle}>valens.app/{String(shopHandle).toLowerCase().replace(/\s+/g, '')}</Text>
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleSharePress}
            style={[styles.shareButton, { borderColor: withAlpha(text, 0.25) }]}
          >
            <Text style={[styles.shareButtonText, { color: text }]}>{t('myClosetDashboard.shareShop')}</Text>
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={styles.heroStatsRow}>
          {overviewCards.map((card, idx) => (
            <React.Fragment key={card.key}>
              <TouchableOpacity
                activeOpacity={card.key === 'earnings' ? 0.8 : 1}
                onPress={card.key === 'earnings' ? handleOpenEarnings : undefined}
                style={card.key === 'earnings' ? styles.heroStatTouchable : undefined}
              >
                <View style={styles.heroStatItem}>
                  <Text style={[styles.heroStatValue, textStyle]}>{card.value}</Text>
                  <Text style={styles.heroStatLabel}>{card.label}</Text>
                </View>
              </TouchableOpacity>
              {idx < overviewCards.length - 1 && (
                <View style={[styles.heroStatDivider, { backgroundColor: withAlpha(text, 0.12) }]} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* Live banner */}
        <View style={[styles.liveBanner, { backgroundColor: mixWithWhite(text, 0.94) }]}>
          <Ionicons name="bag-handle-outline" size={16} color={text} />
          <Text style={[styles.liveBannerText, { color: text }]}>
            {t('myClosetDashboard.liveBannerTitle')}{'  '}
            <Text style={styles.liveBannerSub}>{t('myClosetDashboard.liveBannerSubtitle')}</Text>
          </Text>
        </View>
      </View>

      {/* ── Pinned Item ── */}
      {(priorityBattlesLoading || pinnedItems.length > 0) && (
        <View style={[styles.pinnedSection, cardStyle, { borderColor: withAlpha(text, 0.12) }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, textStyle]}>{t('myClosetDashboard.pinnedItemTitle') || 'Pinned Item'}</Text>
            {showPinnedViewAll && (
              <TouchableOpacity activeOpacity={0.8} onPress={() => navigateToBattleList(navigation, resolvedClosetId)}>
                <Text style={styles.sectionMeta}>{t('myClosetDashboard.viewAllPinned')} ›</Text>
              </TouchableOpacity>
            )}
          </View>
          {priorityBattlesLoading && pinnedItems.length === 0 ? (
            <View style={styles.itemsLoadingWrap}>
              <ActivityIndicator color={text} />
            </View>
          ) : (
            pinnedItems.map(item => (
              <View key={item.id} style={styles.pinnedCard}>
                <View style={styles.pinnedThumbWrap}>
                  {item.image ? (
                    <FastImage
                      source={fastImageSource(item.image)}
                      style={styles.pinnedThumb}
                      resizeMode={FastImage.resizeMode.cover}
                    />
                  ) : (
                    <View style={[styles.pinnedThumb, styles.pinnedThumbPlaceholder]}>
                      <Ionicons name="shirt-outline" size={26} color={text} />
                    </View>
                  )}
                </View>

                <View style={styles.pinnedBody}>
                  <View style={styles.pinnedTopRow}>
                    <Text style={[styles.pinnedTitle, textStyle]} numberOfLines={1}>{item.title}</Text>
                    {item.badge ? (
                      <View style={styles.winnerBadge}>
                        <Text style={styles.winnerBadgeText}>🏆 {item.badge}</Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={[styles.pinnedPrice, textStyle]}>{item.price}</Text>

                  <View style={styles.pinnedBottomRow}>
                    {item.promoLabel ? (
                      <View style={styles.promoPill}>
                        <Text style={styles.promoPillText}>{item.promoLabel}</Text>
                      </View>
                    ) : <View />}

                    {item.pinLabel ? (
                      <View style={styles.pinPill}>
                        <Ionicons name="pin-outline" size={14} color={text} />
                        <Text style={[styles.pinPillText, {color: text}]}>{item.pinLabel}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* ── Overview (by range) ── */}
      <View style={[styles.sectionCard, cardStyle, { borderColor: withAlpha(text, 0.12) }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, textStyle]}>{t('myClosetDashboard.overviewTitle')}</Text>
          <TouchableOpacity activeOpacity={0.8} onPress={handleOpenAnalytics}>
            <Text style={styles.sectionMeta}>{t('myClosetDashboard.viewAll')} ›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity activeOpacity={0.8} onPress={handleToggleRange} style={{ marginBottom: 12 }}>
          <Text style={styles.sectionMeta}>
            {overviewRange === 'weekly' ? t('myClosetDashboard.thisWeek') : t('myClosetDashboard.thisMonth')} ▾
          </Text>
        </TouchableOpacity>

        <View style={styles.quickGrid}>
          {marketplaceLoading ? (
            <View style={styles.itemsLoadingWrap}>
              <ActivityIndicator color={text} />
            </View>
          ) : (
            <View style={styles.quickGrid}>
              {statCards.map(card => (
                <View key={card.key} style={[styles.quickCard, { backgroundColor: mixWithWhite(text, 0.95) }]}>
                  <Ionicons name={card.icon} size={18} color={text} />
                  <Text style={[styles.quickValue, textStyle]}>{card.value}</Text>
                  <Text style={styles.quickLabel}>{card.label}</Text>
                  {card.delta != null && (
                    <Text
                      style={[
                        styles.quickDelta,
                        { color: card.delta.startsWith('-') ? '#dc2626' : '#16a34a' },
                      ]}
                    >
                      {card.delta}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* ── Battle Performance ── */}
      <View style={[styles.sectionCard, cardStyle, { borderColor: withAlpha(text, 0.12) }]}>
        <View style={styles.sectionHeader}>
          <View style={styles.rowCenter}>
            <Ionicons name="flame-outline" size={16} color={text} style={{ marginRight: 5 }} />
            <Text style={[styles.sectionTitle, textStyle]}>{t('myClosetDashboard.battlePerformanceTitle')}</Text>
            <Ionicons name="information-circle-outline" size={14} color="#9ca3af" style={{ marginLeft: 4 }} />
          </View>
          <TouchableOpacity activeOpacity={0.8} onPress={handleViewAllBattles}>
            <Text style={styles.sectionMeta}>{t('myClosetDashboard.viewAllBattles')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.battleGrid}>
          {battleStats.map(stat => (
            <View key={stat.key} style={[styles.battleCard, { backgroundColor: mixWithWhite(text, 0.95) }]}>
              <Ionicons name={stat.icon} size={20} color={text} />
              <Text style={[styles.battleValue, textStyle]}>{stat.value}</Text>
              <Text style={styles.battleLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Seller Order History (orders you've received) ── */}
      <View style={[styles.sectionCard, cardStyle, { borderColor: withAlpha(text, 0.12) }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, textStyle]}>{t('myClosetDashboard.sellerOrdersTitle')}</Text>
          <TouchableOpacity activeOpacity={0.8} onPress={handleViewAllOrders}>
            <Text style={styles.sectionMeta}>{t('myClosetDashboard.viewAll')} ›</Text>
          </TouchableOpacity>
        </View>

        {ordersLoading ? (
          <View style={styles.itemsLoadingWrap}>
            <ActivityIndicator color={text} />
          </View>
        ) : recentOrders.length ? (
          <View style={styles.itemList}>
            {recentOrders.map(item => (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.8}
                style={styles.orderRow}
                onPress={() => handleOpenOrder(item)}
              >
                <View style={[styles.itemThumb, { backgroundColor: withAlpha(text, 0.1) }]}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.itemGridImage} />
                  ) : (
                    <Ionicons name="shirt-outline" size={18} color={text} />
                  )}
                </View>
                <View style={styles.itemCopy}>
                  <Text style={[styles.itemName, textStyle]} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.itemOrder}>{item.order}</Text>
                  <Text style={styles.itemMeta} numberOfLines={1}>
                    {item.buyerName}
                    {item.createdAt ? ` • ${new Date(item.createdAt).toLocaleDateString()}` : ''}
                  </Text>
                </View>
                <View style={styles.orderRight}>
                  <View style={[styles.statusBadge, { backgroundColor: `${item.statusColor}18` }]}>
                    <Text style={[styles.statusText, { color: item.statusColor }]}>{item.status}</Text>
                  </View>
                  <Text style={[styles.orderPrice, textStyle]}>{item.totalAmount}</Text>
                  <Text style={styles.orderCount}>{item.totalItemCount} item{item.totalItemCount === 1 ? '' : 's'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyItemsCard}>
            <Ionicons name="bag-outline" size={24} color={text} />
            <Text style={[styles.emptyItemsText, textStyle]}>{t('myClosetDashboard.noOrdersYet')}</Text>
          </View>
        )}
      </View>

      {/* ── Buyer Order History (orders you've placed) ── */}
      <View style={[styles.sectionCard, cardStyle, { borderColor: withAlpha(text, 0.12) }]}>
        <View style={styles.sectionHeader}>
          <View style={styles.rowCenter}>
            <Ionicons name="cart-outline" size={16} color={text} style={{ marginRight: 5 }} />
            <Text style={[styles.sectionTitle, textStyle]}>{t('myClosetDashboard.buyerOrdersTitle')}</Text>
          </View>
          <TouchableOpacity activeOpacity={0.8} onPress={handleViewAllBuyerOrders}>
            <Text style={styles.sectionMeta}>{t('myClosetDashboard.viewAll')} ›</Text>
          </TouchableOpacity>
        </View>

        {buyerOrdersLoading ? (
          <View style={styles.itemsLoadingWrap}>
            <ActivityIndicator color={text} />
          </View>
        ) : buyerOrders.length ? (
          <View style={styles.itemList}>
            {buyerOrders.map(item => (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.8}
                style={styles.orderRow}
                onPress={() => handleOpenBuyerOrder(item)}
              >
                <View style={[styles.itemThumb, { backgroundColor: withAlpha(text, 0.1) }]}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.itemGridImage} />
                  ) : (
                    <Ionicons name="shirt-outline" size={18} color={text} />
                  )}
                </View>
                <View style={styles.itemCopy}>
                  <Text style={[styles.itemName, textStyle]} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.itemOrder}>{item.order}</Text>
                  <Text style={styles.itemMeta} numberOfLines={1}>
                    {/* {item.buyerName} */}
                    {item.createdAt ? ` ${new Date(item.createdAt).toLocaleDateString()}` : ''}
                  </Text>
                </View>
                <View style={styles.orderRight}>
                  <View style={[styles.statusBadge, { backgroundColor: `${item.statusColor}18` }]}>
                    <Text style={[styles.statusText, { color: item.statusColor }]}>{item.status}</Text>
                  </View>
                  <Text style={[styles.orderPrice, textStyle]}>{item.totalAmount}</Text>
                  <Text style={styles.orderCount}>{item.totalItemCount} item{item.totalItemCount === 1 ? '' : 's'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyItemsCard}>
            <Ionicons name="cart-outline" size={24} color={text} />
            <Text style={[styles.emptyItemsText, textStyle]}>{t('myClosetDashboard.noPurchasesYet')}</Text>
          </View>
        )}
      </View>

      {/* ── Your Items Grid ── */}
      <View style={[styles.sectionCard, cardStyle, { borderColor: withAlpha(text, 0.12) }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, textStyle]}>{t('myClosetDashboard.yourItemsTitle')}</Text>
          <TouchableOpacity activeOpacity={0.8} onPress={handleViewAllItems}>
            <Text style={styles.sectionMeta}>{t('myClosetDashboard.viewAll')} ›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.itemsGrid}>
          {itemsLoading ? (
            <View style={styles.itemsLoadingWrap}>
              <ActivityIndicator color={text} />
            </View>
          ) : displayItems.length ? (
            displayItems.map(item => (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.85}
                style={styles.itemGridCard}
                onPress={() =>
                  navigation?.navigate?.('ProfileMain', {
                    screen: 'MyClosetItemEditor',
                    params: {
                      item: item.raw || item,
                      returnTo: 'MyClosetDashboard',
                    },
                  })
                }
              >
                <View style={[styles.itemGridThumb, { backgroundColor: withAlpha(text, 0.08) }]}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.itemGridImage} />
                  ) : (
                    <Ionicons name="shirt-outline" size={28} color={text} />
                  )}
                </View>
                <Text style={[styles.itemGridName, textStyle]} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemGridPrice}>{item.price}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyItemsCard}>
              <Ionicons name="shirt-outline" size={24} color={text} />
              <Text style={[styles.emptyItemsText, textStyle]}>{t('myClosetDashboard.noItemsYet')}</Text>
            </View>
          )}

          {/* Add New Item tile */}
          <TouchableOpacity activeOpacity={0.85} style={styles.itemGridCard} onPress={handleAddItemPress}>
            <View style={[styles.itemGridThumb, styles.addItemThumb, { borderColor: withAlpha(text, 0.2) }]}>
              <Ionicons name="add" size={28} color={text} />
            </View>
            <Text style={[styles.itemGridName, { color: text, fontWeight: '700' }]}>{t('myClosetDashboard.addNewItem')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.sectionCard, cardStyle, { borderColor: withAlpha(text, 0.12) }]}>
        <View style={styles.sectionHeader}>
          <View style={styles.ebooksCtaCopy}>
            <Ionicons name="book-outline" size={18} color={text} style={{ marginRight: 8 }} />
            <Text style={[styles.ebooksCtaTitle, textStyle]}>My E-books</Text>
          </View>
          <TouchableOpacity activeOpacity={0.8} onPress={handleViewAllEbooks}>
            <Text style={styles.sectionMeta}>{t('myClosetDashboard.viewAll')} ›</Text>
          </TouchableOpacity>
        </View>

        <View style={{ gap: 2, marginTop: 8 }}>
          {ebooksLoading ? (
            <View style={styles.itemsLoadingWrap}>
              <ActivityIndicator color={text} />
            </View>
          ) : dashboardEbooks.length ? (
            dashboardEbooks.map(item => (
              <EbookCard
                key={String(item.id || item._id)}
                item={item}
                isPurchased={true}
                isOwnProfile={true}
                accentColor={text}
                onPress={() => {
                  navigation?.navigate?.('EbookDetail', {
                    ebook: item,
                    userData,
                    loggedInUserId: userData?.id || userData?._id,
                    from: 'MyClosetDashboard',
                    returnTo: 'MyClosetDashboard',
                    username: currentUserName || userData?.userName || userData?.username || item?.userName || item?.creator?.name,
                  })
                }}
              />
            ))
          ) : (
            <View style={styles.emptyItemsCard}>
              <Ionicons name="book-outline" size={24} color={text} />
              <Text style={[styles.emptyItemsText, textStyle]}>No E-books yet</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Battle Item CTA ── */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleCreateBattlePress}
        style={[styles.battleCta, { backgroundColor: text }]}
      >
        <View style={styles.battleCtaLeft}>
          <Ionicons name="flame" size={20} color="#fff" />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.battleCtaTitle}>{t('myClosetDashboard.battleCtaTitle')}</Text>
            <Text style={styles.battleCtaSub}>{t('myClosetDashboard.battleCtaSubtitle')}</Text>
          </View>
        </View>
        <View style={[styles.battleCtaButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Text style={styles.battleCtaButtonText}>{t('myClosetDashboard.createBattleButton')}</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, marginBottom: 50 },
  content: { paddingHorizontal: 12, paddingTop: 8 },

  // Hero
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
    padding: 14,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  heroLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  heroBadge: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 10,
  },
  heroAvatar: { width: '100%', height: '100%' },
  verifiedDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  heroMeta: { flex: 1 },
  heroTitle: { fontSize: 18, fontWeight: '800' },
  heroHandle: { marginTop: 2, color: '#6b7280', fontSize: 12 },
  shareButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  shareButtonText: { fontWeight: '700', fontSize: 13 },

  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 14,
  },
  heroStatItem: { alignItems: 'center', flex: 1 },
  heroStatValue: { fontSize: 18, fontWeight: '800' },
  heroStatLabel: { marginTop: 2, color: '#6b7280', fontSize: 12, fontWeight: '600' },
  heroStatDivider: { width: 1, height: 32 },

  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  liveBannerText: { fontSize: 13, fontWeight: '700', flex: 1 },
  liveBannerSub: { fontWeight: '500', color: '#6b7280' },

  pinnedSection: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  pinnedCard: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
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
  winnerBadge: {
    backgroundColor: '#fde68a',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  winnerBadgeText: {
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

  // Section card
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  sectionMeta: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },

  // Overview quick cards
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    width: '31%',
    borderRadius: 18,
    padding: 12,
    gap: 4,
  },
  quickValue: { fontSize: 18, fontWeight: '800' },
  quickLabel: { color: '#6b7280', fontSize: 12, fontWeight: '600' },
  quickDelta: { color: '#16a34a', fontSize: 12, fontWeight: '700' },

  // Battle
  battleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  battleCard: {
    width: '31%',
    borderRadius: 16,
    padding: 12,
    gap: 4,
    alignItems: 'flex-start',
  },
  battleValue: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  battleLabel: { color: '#6b7280', fontSize: 11, fontWeight: '600' },

  // Orders
  itemList: { gap: 6 },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  itemThumb: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemCopy: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '700' },
  itemOrder: { marginTop: 2, color: '#6b7280', fontSize: 12, fontWeight: '500' },
  itemMeta: { marginTop: 2, color: '#9ca3af', fontSize: 11, fontWeight: '500' },
  orderRight: { alignItems: 'flex-end', gap: 4 },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  orderPrice: { fontSize: 13, fontWeight: '700' },
  orderCount: { color: '#9ca3af', fontSize: 11, fontWeight: '600' },

  // Items grid
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  itemGridCard: {
    width: '31%',
  },
  itemGridThumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    position: 'relative',
  },
  itemGridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  addItemThumb: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  itemMoreDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemGridName: { fontSize: 12, fontWeight: '700', textAlign: 'left' },
  itemGridPrice: { marginTop: 1, color: '#6b7280', fontSize: 11, fontWeight: '600' },
  ebooksCta: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
  },
  ebooksCtaCopy: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ebooksCtaTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  itemsLoadingWrap: {
    width: '100%',
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyItemsCard: {
    width: '100%',
    minHeight: 110,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 2,
  },
  emptyItemsText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Battle CTA
  battleCta: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  battleCtaLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  battleCtaTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  battleCtaSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 1, width: '75%', },
  battleCtaButton: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  battleCtaButtonText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  quickDelta: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
  },
});

export default MyClosetDashboard;
