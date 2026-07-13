import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { useToast } from 'react-native-toast-notifications';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { showToastMessage } from '../displaytoastmessage';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n';
import {
  getSellerOrders,
  markOrderProcessing,
  markOrderShipped,
  markOrderDelivered,
  getBuyerOrders,
  cancelBuyerOrder,
} from '../../services/myCloset';
import ShippingDetailsModal from '../modals/ShippingDetailsModal';

// ── Status helpers ──────────────────────────────────────────────────────
// Colors stay fixed; the display label is resolved via t('myClosetOrders.status.<key>') at render time.
const STATUS_META = {
  pending: { color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
  confirmed: { color: '#0891b2', bg: 'rgba(8,145,178,0.12)' },
  processing: { color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
  shipped: { color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
  delivered: { color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
  cancelled: { color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
};

const normalizeStatus = raw => {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'delivered') return 'delivered';
  if (value === 'shipped') return 'shipped';
  if (value === 'processing') return 'processing';
  if (value === 'confirmed') return 'confirmed';
  if (value === 'cancelled') return 'cancelled';
  return 'pending';
};

const formatPrice = value => {
  if (value == null || value === '') return '$0.00';
  const text = String(value).trim();
  if (text.startsWith('$')) return text;
  const numeric = Number(text);
  return Number.isNaN(numeric) ? text : `$${numeric.toFixed(2)}`;
};

const formatDate = value => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const imageUri = image => {
  if (!image) return null;
  if (typeof image === 'string') return image;
  return image?.uri || image?.url || image?.path || null;
};

const fastImageSource = uri =>
  uri
    ? {
      uri,
      priority: FastImage.priority.high,
      cache: FastImage.cacheControl.immutable,
    }
    : null;

const firstImage = value => {
  if (Array.isArray(value)) return imageUri(value[0]);
  return imageUri(value);
};

const getOrderImage = order =>
  firstImage(order?.productImage) ||
  firstImage(order?.item?.productImage) ||
  firstImage(order?.item?.images) ||
  firstImage(order?.item?.image) ||
  firstImage(order?.item?.thumbnail) ||
  firstImage(order?.items?.[0]?.productImage) ||
  firstImage(order?.items?.[0]?.product?.images) ||
  firstImage(order?.items?.[0]?.product?.image) ||
  firstImage(order?.items?.[0]?.images) ||
  firstImage(order?.items?.[0]?.image) ||
  firstImage(order?.product?.images) ||
  firstImage(order?.product?.image) ||
  order?.image ||
  null;

const getItemCountLabel = (count, t) => t('myClosetOrders.itemCount', { count });

const getOrderItemName = (order, t) => {
  if (order?.item?.name || order?.item?.title) return order.item.name || order.item.title;
  if (order?.items?.[0]?.product?.name || order?.items?.[0]?.product?.title) {
    return order.items[0].product.name || order.items[0].product.title;
  }
  if (order?.items?.[0]?.name || order?.items?.[0]?.title) return order.items[0].name || order.items[0].title;
  if (order?.product?.name) return order.product.name;
  if (order?.itemName) return order.itemName;
  const count = order?.totalItemCount;
  if (count) return t('myClosetOrders.itemCount', { count });
  return t('myClosetOrders.orderItemFallback');
};

const getOrderPrice = order =>
  order?.totalAmount ?? order?.amount ?? order?.price ?? order?.item?.price ?? 0;

const getBuyerHandle = order =>
  order?.buyerName ||
  order?.buyer?.username ||
  order?.buyer?.userName ||
  order?.buyerUsername ||
  order?.user?.username ||
  '';

const getSellerHandle = order =>
  order?.sellerName ||
  order?.seller?.username ||
  order?.seller?.userName ||
  order?.sellerUsername ||
  order?.shop?.username ||
  '';

// `mode` is 'seller' | 'buyer' — controls which counterpart handle we surface on the card
const normalizeOrder = (order, index, mode, t) => ({
  id: order?.id || order?._id || String(index),
  orderNumber: order?.orderNumber || order?.orderId || order?.id || order?._id || index + 1,
  itemName: getOrderItemName(order, t),
  itemCount: order?.totalItemCount ?? null,
  price: formatPrice(getOrderPrice(order)),
  totalAmount: formatPrice(order?.totalAmount ?? order?.amount ?? order?.total),
  counterpart: mode === 'seller' ? getBuyerHandle(order) : getSellerHandle(order),
  date: formatDate(order?.createdAt || order?.orderDate || order?.date),
  status: normalizeStatus(order?.orderStatus ?? order?.status),
  buyerName: getBuyerHandle(order),
  sellerName: getSellerHandle(order),
  image: getOrderImage(order),
  raw: order,
});

// Cancellable statuses on the buyer side — adjust to match your backend's actual rules
const withAlpha = (hex, alpha = 0.12) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return `rgba(124,58,237,${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const BUYER_CANCELLABLE_STATUSES = ['pending', 'confirmed', 'processing'];

const OrdersHeader = ({ onBack, title, accent, textStyle }) => {
  const { isDarkMode } = useThemeContext();
  const chipSurface = isDarkMode ? 'rgba(255,255,255,0.08)' : '#ffffff';

  return (
    <View style={styles.headerRow}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onBack}
        style={[styles.headerIconButton, { backgroundColor: chipSurface, borderRadius: 19 }]}
      >
        <Ionicons name="chevron-back" size={22} color={accent} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, textStyle]}>{title}</Text>
      <View style={styles.headerIconButton} />
    </View>
  );
};

const OrderThumb = ({ uri, accent }) => {
  const [loading, setLoading] = useState(Boolean(uri));
  const { isDarkMode } = useThemeContext();
  const thumbSurface = isDarkMode ? 'rgba(255,255,255,0.06)' : '#f5f3ff';
  const source = fastImageSource(uri);

  return (
    <View style={[styles.orderThumb, { backgroundColor: thumbSurface }]}>
      {source ? (
        <>
          <FastImage
            source={source}
            style={styles.orderThumbImage}
            resizeMode={FastImage.resizeMode.contain}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => setLoading(false)}
          />
          {loading ? (
            <View style={styles.orderThumbLoader}>
              <ActivityIndicator size="small" color={accent} />
            </View>
          ) : null}
        </>
      ) : (
        <Ionicons name="shirt-outline" size={22} color={accent || '#9ca3af'} />
      )}
    </View>
  );
};

// Seller-side status progression — what happens when the seller taps the action button.
// `label` is resolved via t('myClosetOrders.action.<actionKey>') at render time.
const STATUS_FLOW = {
  pending: { next: 'processing', actionKey: 'processing' },
  confirmed: { next: 'processing', actionKey: 'processing' },
  processing: { next: 'shipped', actionKey: 'shipped' },
  shipped: { next: 'delivered', actionKey: 'delivered' },
  delivered: null,
  cancelled: null,
};

const OrderCard = ({
  order,
  mode,
  accent,
  cardStyle,
  textStyle,
  mutedTextStyle,
  border,
  onAdvance,
  onCancel,
  onOpen,
  advancing,
  t,
}) => {
  const meta = STATUS_META[order.status];
  const statusLabel = t(`myClosetOrders.status.${order.status}`);
  const flowStep = mode === 'seller' ? STATUS_FLOW[order.status] : null;
  const nextActionLabel = flowStep ? t(`myClosetOrders.action.${flowStep.actionKey}`) : null;
  const canCancel = mode === 'buyer' && BUYER_CANCELLABLE_STATUSES.includes(order.status);

  return (
    <View style={[styles.orderCard, cardStyle, { borderColor: border || withAlpha(accent, 0.12) }]}>
      <TouchableOpacity activeOpacity={0.8} onPress={() => onOpen(order)}>
        <View style={styles.orderCardTop}>
          <Text style={[styles.orderNumber, mutedTextStyle]}>#{order.orderNumber}</Text>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.orderCardBody}>
          <OrderThumb uri={order.image} accent={accent} />
          <View style={styles.orderCopy}>
            <Text style={[styles.orderItemName, textStyle]} numberOfLines={1}>
              {order.itemName}
            </Text>
            <Text style={[styles.orderPrice, { color: accent }]}>{order.totalAmount}</Text>
            {!!order.itemCount && (
              <Text style={[styles.orderMeta, mutedTextStyle]}>{getItemCountLabel(order.itemCount, t)}</Text>
            )}
            {!!order.counterpart && (
              <Text style={[styles.orderBuyer, mutedTextStyle]}>
                {mode === 'seller' ? t('myClosetOrders.buyerLabel') : t('myClosetOrders.sellerLabel')}: @{order.counterpart}
              </Text>
            )}
            {!!order.date && <Text style={[styles.orderDate, mutedTextStyle]}>{order.date}</Text>}
          </View>
          <Ionicons name="chevron-forward" size={18} color={mutedTextStyle?.color || '#9ca3af'} />
        </View>
      </TouchableOpacity>

      {nextActionLabel ? (
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={advancing}
          onPress={() => onAdvance(order)}
          style={[styles.advanceButton, { borderColor: accent, opacity: advancing ? 0.6 : 1 }]}
        >
          <Text style={[styles.advanceButtonText, { color: accent }]}>{nextActionLabel}</Text>
        </TouchableOpacity>
      ) : null}

      {canCancel ? (
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={advancing}
          onPress={() => onCancel(order)}
          style={[
            styles.advanceButton,
            { borderColor: '#dc2626', opacity: advancing ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.advanceButtonText, { color: '#dc2626' }]}>{t('myClosetOrders.cancelOrderButton')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const MyClosetOrdersScreen = ({ navigation, route }) => {
  const { accent, bgStyle, cardStyle, textStyle, mutedTextStyle, border } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const { t } = useLanguage();
  const toast = useToast();
  const dispatch = useDispatch();

  // Which side of the marketplace we're viewing — defaults to seller for backward compatibility
  const mode = route?.params?.viewType === 'buyer' ? 'buyer' : 'seller';

  const SELLER_TABS = [
    { key: 'all', status: null },
    { key: 'processing', status: 'PROCESSING' },
    { key: 'shipped', status: 'SHIPPED' },
    { key: 'delivered', status: 'DELIVERED' },
  ];

  const BUYER_TABS = [
    { key: 'all', status: null },
    { key: 'processing', status: 'PROCESSING' },
    { key: 'shipMe', status: 'SHIPPED' },
    { key: 'delivered', status: 'DELIVERED' },
  ];

  const tabs = mode === 'buyer' ? BUYER_TABS : SELLER_TABS;
  const [allOrders, setAllOrders] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [advancingId, setAdvancingId] = useState(null);
  const [shippingModalOrder, setShippingModalOrder] = useState(null);
  const [pageInfo, setPageInfo] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [counts, setCounts] = useState({ all: 0, pending: 0, processing: 0, shipped: 0, delivered: 0 });

  const extractList = payload => {
    const data = payload?.data?.data ?? payload?.data?.orders ?? payload?.data ?? payload;
    return Array.isArray(data)
      ? data
      : Array.isArray(data?.orders)
        ? data.orders
        : Array.isArray(data?.data)
          ? data.data
          : [];
  };

  const extractPagination = payload =>
    payload?.data?.pagination ?? payload?.pagination ?? null;

  // Picks the right list endpoint for the active mode
  const fetchOrdersPage = useCallback(
    (page, status) => {
      const params = { page, status: status || undefined };
      return mode === 'seller' ? getSellerOrders(params) : getBuyerOrders();
    },
    [mode],
  );

  // Loads orders for the currently active tab/status, server-side filtered & paginated
  const loadOrders = useCallback(
    async (page = 1, append = false) => {
      const tabConfig = tabs.find(tab => tab.key === activeTab) || tabs[0];
      append ? setLoadingMore(true) : setLoading(true);
      try {
        const response = await fetchOrdersPage(page, tabConfig.status);
        const list = extractList(response);
        const pagination = extractPagination(response);
        const normalized = list.map((order, index) => normalizeOrder(order, index, mode, t));

        if (mode === 'buyer') {
          setAllOrders(normalized);
        }

        setOrders(normalized);
        setPageInfo(prev => ({
          page: pagination?.page ?? page,
          limit: pagination?.limit ?? prev.limit,
          total: pagination?.total ?? normalized.length,
          totalPages: pagination?.totalPages ?? 1,
        }));
      } catch (error) {
        showToastMessage(
          toast,
          'danger',
          error?.response?.data?.message || error?.message || t('myClosetOrders.loadError'),
        );
        if (!append) setOrders([]);
      } finally {
        append ? setLoadingMore(false) : setLoading(false);
      }
    },
    [activeTab, fetchOrdersPage, mode, toast, t],
  );

  // Fetches accurate totals for every tab badge in one pass (limit=1, we only need `pagination.total`)
  const loadCounts = useCallback(async () => {
    try {
      const results = await Promise.all(
        tabs.map(tab => fetchOrdersPage(1, tab.status).then(res => {
          // limit isn't part of fetchOrdersPage's signature; request it directly here
          return res;
        })),
      );
      const nextCounts = {};
      tabs.forEach((tab, index) => {
        const pagination = extractPagination(results[index]);
        nextCounts[tab.key] = pagination?.total ?? 0;
      });
      setCounts(nextCounts);
    } catch (error) {
      // Counts are a nice-to-have; silently skip on failure rather than blocking the list
    }
  }, [fetchOrdersPage]);

useFocusEffect(
  useCallback(() => {
    loadOrders(1, false);

    if (mode === 'seller') {
      loadCounts();
    }
  }, [activeTab, mode]),
);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || pageInfo.page >= pageInfo.totalPages) return;
    loadOrders(pageInfo.page + 1, true);
  }, [loadOrders, loadingMore, pageInfo]);

  const handleOpenOrder = useCallback(
    order => {
      navigation?.navigate?.('MyClosetOrderDetail', {
        orderId: order.raw?.id || order.raw?._id || order.id,
        orderPreview: order.raw,
        viewType: mode,
      });
    },
    [navigation, mode],
  );

  // `orders` already reflects the active tab's server-side filter, so it doubles as `visibleOrders`.
  const visibleOrders = useMemo(() => {
    if (mode !== 'buyer') return orders;

    switch (activeTab) {
      case 'processing':
        return allOrders.filter(o => o.status === 'processing');

      case 'shipMe':
        return allOrders.filter(o => o.status === 'shipped');

      case 'delivered':
        return allOrders.filter(o => o.status === 'delivered');

      default:
        return allOrders;
    }
  }, [mode, activeTab, allOrders, orders]);

useEffect(() => {
  if (mode !== 'buyer') return;

  setCounts({
    all: allOrders.length,
    processing: allOrders.filter(o => o.status === 'processing').length,
    shipMe: allOrders.filter(o => o.status === 'shipped').length,
    delivered: allOrders.filter(o => o.status === 'delivered').length,
  });
}, [allOrders, mode]);

  const handleAdvance = useCallback(
    async (order, extra) => {
      const ACTION_BY_KEY = {
        processing: (id) => markOrderProcessing(id),
        shipped: (id) => markOrderShipped(id, extra),
        delivered: (id) => markOrderDelivered(id),
      };
      const flowStep = STATUS_FLOW[order.status];
      const action = flowStep ? ACTION_BY_KEY[flowStep.actionKey] : null;
      if (!action) return;

      // shipped needs carrier/trackingNumber first — open the modal instead of calling immediately
      if (flowStep.actionKey === 'shipped' && !extra) {
        setShippingModalOrder(order);
        return;
      }

      setAdvancingId(order.id);
      dispatch(showLoader());
      try {
        await action(order.raw?.id || order.raw?._id || order.id);
        showToastMessage(toast, 'success', t('myClosetOrders.statusUpdateSuccess'));
        await Promise.all([loadOrders(1, false), loadCounts()]);
      } catch (error) {
        showToastMessage(toast, 'danger', error?.response?.data?.message || error?.message || t('myClosetOrders.statusUpdateError'));
      } finally {
        setAdvancingId(null);
        dispatch(hideLoader());
        setShippingModalOrder(null);
      }
    },
    [dispatch, loadCounts, loadOrders, toast, t],
  );

  const handleCancel = useCallback(
    order => {
      Alert.alert(
        t('myClosetOrders.cancelConfirmTitle'),
        t('myClosetOrders.cancelConfirmMessage'),
        [
          { text: t('myClosetOrders.keepOrder'), style: 'cancel' },
          {
            text: t('myClosetOrders.cancelOrderButton'),
            style: 'destructive',
            onPress: async () => {
              setAdvancingId(order.id);
              dispatch(showLoader());
              try {
                await cancelBuyerOrder(order.raw?.id || order.raw?._id || order.id);
                showToastMessage(toast, 'success', t('myClosetOrders.cancelSuccess'));
                await Promise.all([loadOrders(1, false), loadCounts()]);
              } catch (error) {
                showToastMessage(
                  toast,
                  'danger',
                  error?.response?.data?.message || error?.message || t('myClosetOrders.cancelError'),
                );
              } finally {
                setAdvancingId(null);
                dispatch(hideLoader());
              }
            },
          },
        ],
      );
    },
    [dispatch, loadCounts, loadOrders, toast, t],
  );

  const headerTitle = mode === 'seller' ? t('myClosetOrders.headerSales') : t('myClosetOrders.headerPurchases');
  const emptyTitle = mode === 'seller' ? t('myClosetOrders.emptyTitleSeller') : t('myClosetOrders.emptyTitleBuyer');
  const emptyText =
    mode === 'seller'
      ? t('myClosetOrders.emptyTextSeller')
      : t('myClosetOrders.emptyTextBuyer');

  const handleBack = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'MainApp',
          params: {
            screen: 'wallet',
            params: { screen: 'MyCloset' },
          },
        },
      ],
    })
  }, [navigation]);

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <OrdersHeader
        onBack={handleBack}
        title={headerTitle}
        accent={accent}
        textStyle={textStyle}
      />

      <View style={[styles.tabsRow, { borderBottomColor: withAlpha(accent, isDarkMode ? 0.2 : 0.08) }]}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.key;
          const count = counts[tab.key];
          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.85}
              onPress={() => setActiveTab(tab.key)}
              style={styles.tabItem}
            >
              <Text style={[styles.tabLabel, mutedTextStyle, isActive && { color: accent, fontWeight: '800' }]}>
                {t(`myClosetOrders.tabs.${tab.key}`)}
                {tab.key !== 'all' ? ` (${count})` : ''}
              </Text>
              {isActive && <View style={[styles.tabUnderline, { backgroundColor: accent }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={accent} />
          </View>
        ) : visibleOrders.length ? (
          visibleOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              mode={mode}
              accent={accent}
              cardStyle={cardStyle}
              textStyle={textStyle}
              mutedTextStyle={mutedTextStyle}
              border={border}
              advancing={advancingId === order.id}
              onAdvance={handleAdvance}
              onCancel={handleCancel}
              onOpen={handleOpenOrder}
              t={t}
            />
          ))
        ) : (
          <View style={[styles.emptyCard, cardStyle, { borderColor: withAlpha(accent, 0.2) }]}>
            <Ionicons name="bag-outline" size={26} color={accent} />
            <Text style={[styles.emptyTitle, textStyle]}>{emptyTitle}</Text>
            <Text style={[styles.emptyText, mutedTextStyle]}>{emptyText}</Text>
          </View>
        )}

        {!loading && visibleOrders.length ? (
          <View style={styles.paginationFooter}>
            <Text style={[styles.paginationText, mutedTextStyle]}>
              {t('myClosetOrders.pagination', {
                page: pageInfo.page,
                totalPages: pageInfo.totalPages,
                total: pageInfo.total,
              })}
            </Text>
            {pageInfo.page < pageInfo.totalPages ? (
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={loadingMore}
                onPress={handleLoadMore}
                style={[styles.loadMoreButton, { borderColor: accent, opacity: loadingMore ? 0.6 : 1 }]}
              >
                {loadingMore ? (
                  <ActivityIndicator color={accent} size="small" />
                ) : (
                  <Text style={[styles.loadMoreText, { color: accent }]}>{t('myClosetOrders.loadMore')}</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      <ShippingDetailsModal
        visible={!!shippingModalOrder}
        text={accent}
        onCancel={() => setShippingModalOrder(null)}
        onSubmit={(payload) => handleAdvance(shippingModalOrder, payload)}
      />
    </SafeAreaView>
  );
};

export default MyClosetOrdersScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, paddingTop: 30 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800' },

  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 25,
    borderBottomWidth: 1,
    
    marginBottom: 8,
  },
  tabItem: {
    marginRight: 25,
    paddingBottom: 10,
  },
  tabLabel: { fontSize: 13, fontWeight: '600' },
  tabUnderline: {
    marginTop: 8,
    height: 2,
    borderRadius: 1,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 50,
  },
  loadingWrap: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },

  orderCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  orderCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  orderNumber: { fontSize: 13, fontWeight: '800' },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  orderCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderThumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
    
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 12,
    flexShrink: 0,
  },
  orderThumbImage: { width: '100%', height: '100%' },
  orderThumbLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,243,255,0.35)',
  },
  orderCopy: { flex: 1 },
  orderItemName: { fontSize: 14, fontWeight: '800' },
  orderPrice: { marginTop: 2, fontSize: 13, fontWeight: '700' },
  orderMeta: { marginTop: 2, fontSize: 11, fontWeight: '600' },
  orderBuyer: { marginTop: 3, fontSize: 12, fontWeight: '600' },
  orderDate: { marginTop: 1, fontSize: 11 },

  advanceButton: {
    marginTop: 12,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advanceButtonText: { fontSize: 13, fontWeight: '800' },

  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#e5e7eb',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginTop: 8,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginTop: 8 },
  emptyText: { fontSize: 12, marginTop: 4, textAlign: 'center' },

  paginationFooter: {
    alignItems: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  paginationText: { fontSize: 12, fontWeight: '600' },
  loadMoreButton: {
    minHeight: 40,
    minWidth: 140,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  loadMoreText: { fontSize: 13, fontWeight: '800' },
});
