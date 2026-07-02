import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { useToast } from 'react-native-toast-notifications';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { showToastMessage } from '../displaytoastmessage';
import {
  getSellerOrderDetails,
  markOrderProcessing,
  markOrderShipped,
  markOrderDelivered,
} from '../../services/myCloset';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';

// ── Same design tokens as the buyer checkout flow ──────────────────────────
const ACCENT = '#5A2386';
const MUTED = '#6b7280';
const BORDER = '#ebe4f3';
const SURFACE = '#fbf8ff';

// ── Status meta + flow (kept in sync with the orders list screen) ─────────
// Labels are stored as i18n keys and resolved with t() inside the components
// that render them, since these constants live outside any component.
const STATUS_META = {
  pending: { labelKey: 'myClosetOrderDetail.status.pending', color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
  confirmed: { labelKey: 'myClosetOrderDetail.status.confirmed', color: '#0891b2', bg: 'rgba(8,145,178,0.12)' },
  processing: { labelKey: 'myClosetOrderDetail.status.processing', color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
  shipped: { labelKey: 'myClosetOrderDetail.status.shipped', color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
  delivered: { labelKey: 'myClosetOrderDetail.status.delivered', color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
  cancelled: { labelKey: 'myClosetOrderDetail.status.cancelled', color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
};

const STATUS_FLOW = {
  pending: { labelKey: 'myClosetOrderDetail.markAsProcessing', actionKey: 'processing' },
  confirmed: { labelKey: 'myClosetOrderDetail.markAsProcessing', actionKey: 'processing' },
  processing: { labelKey: 'myClosetOrderDetail.markAsShipped', actionKey: 'shipped' },
  shipped: { labelKey: 'myClosetOrderDetail.markAsDelivered', actionKey: 'delivered' },
  delivered: null,
  cancelled: null,
};

const ACTION_BY_KEY = {
  processing: markOrderProcessing,
  shipped: markOrderShipped,
  delivered: markOrderDelivered,
};

const TIMELINE_STEPS = ['pending', 'processing', 'shipped', 'delivered'];

const normalizeStatus = raw => {
  const value = String(raw || '').trim().toLowerCase();
  if (['delivered', 'shipped', 'processing', 'confirmed', 'cancelled'].includes(value)) return value;
  return 'pending';
};

const currency = value => {
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
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' at ' +
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const imageUri = image => {
  if (!image) return null;
  if (typeof image === 'string') return image;
  return image?.uri || image?.url || image?.path || null;
};

const getLineItemImage = line =>
  imageUri(line?.product?.images?.[0]) ||
  imageUri(line?.product?.image) ||
  imageUri(line?.item?.images?.[0]) ||
  imageUri(line?.image) ||
  null;

const getLineItemName = (line, t) =>
  line?.product?.name || line?.product?.title || line?.item?.name || line?.name || t('myClosetOrderDetail.defaultItemName');

const getLineItemPrice = line => line?.product?.price ?? line?.price ?? 0;

const normalizeOrderDetail = (order, t) => {
  const lineItems = Array.isArray(order?.orderItems)
    ? order.orderItems
    : Array.isArray(order?.items)
      ? order.items
      : Array.isArray(order?.cartItems)
        ? order.cartItems
        : [];

  const normalizedLines = lineItems.map((line, index) => ({
    id: line?.id || line?._id || String(index),
    name: getLineItemName(line, t),
    image: getLineItemImage(line),
    quantity: Number(line?.quantity || 1),
    price: currency(getLineItemPrice(line)),
    lineTotal: currency(getLineItemPrice(line) * Number(line?.quantity || 1)),
  }));

  const address = order?.shippingAddress || order?.address || null;

  return {
    id: order?.id || order?._id,
    orderNumber: order?.orderNumber || order?.orderId || order?.id,
    status: normalizeStatus(order?.orderStatus ?? order?.status),
    createdAt: formatDate(order?.createdAt || order?.orderDate),
    buyerName: order?.buyerName || order?.buyer?.username || order?.buyer?.userName || t('myClosetOrderDetail.buyer'),
    buyerId: order?.buyerId || order?.buyer?.id,
    totalAmount: currency(order?.totalAmount ?? order?.amount ?? order?.total),
    totalItemCount: order?.totalItemCount ?? normalizedLines.length,
    lines: normalizedLines,
    address,
    raw: order,
  };
};

// ── Shared atoms (mirroring the buyer flow's design system) ────────────────
const Header = ({ onBack, title }) => (
  <View style={styles.header}>
    <TouchableOpacity onPress={onBack} style={styles.iconButton} activeOpacity={0.8}>
      <Ionicons name="chevron-back" size={22} color="#17072d" />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>{title}</Text>
    <View style={styles.iconButton} />
  </View>
);

const ImageBox = ({ uri, style, iconSize = 22 }) => (
  <View style={[styles.imageBox, style]}>
    {uri ? (
      <Image source={{ uri }} style={styles.coverImage} resizeMode="cover" />
    ) : (
      <Ionicons name="shirt-outline" size={iconSize} color="#9b8c7a" />
    )}
  </View>
);

const SummaryRow = ({ label, value, bold }) => (
  <View style={styles.summaryRow}>
    <Text style={[styles.summaryLabel, bold && styles.summaryStrong]}>{label}</Text>
    <Text style={[styles.summaryValue, bold && styles.summaryTotal]}>{value}</Text>
  </View>
);

const BottomButton = ({ label, onPress, disabled }) => (
  <TouchableOpacity
    activeOpacity={0.9}
    onPress={disabled ? undefined : onPress}
    style={[styles.bottomButton, disabled && { opacity: 0.6 }]}
  >
    <Text style={styles.bottomButtonText}>{label}</Text>
  </TouchableOpacity>
);

// Small horizontal progress tracker: Pending → Processing → Shipped → Delivered
const StatusTimeline = ({ status }) => {
  const { t } = useLanguage();
  const currentIndex = TIMELINE_STEPS.indexOf(status === 'cancelled' ? 'pending' : status);
  return (
    <View style={styles.timelineWrap}>
      {TIMELINE_STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        const meta = STATUS_META[step];
        return (
          <React.Fragment key={step}>
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, (done || active) && { backgroundColor: ACCENT }]}>
                {done ? <Ionicons name="checkmark" size={11} color="#fff" /> : null}
              </View>
              <Text style={[styles.timelineLabel, active && { color: ACCENT, fontWeight: '900' }]}>
                {t(meta.labelKey)}
              </Text>
            </View>
            {index < TIMELINE_STEPS.length - 1 && (
              <View style={[styles.timelineConnector, index < currentIndex && { backgroundColor: ACCENT }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const MyClosetOrderDetailScreen = ({ navigation, route }) => {
  const orderId = route?.params?.orderId;
  const toast = useToast();
  const dispatch = useDispatch();
  const { text, bgStyle } = useAppTheme();
  const { t } = useLanguage();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [advancing, setAdvancing] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setError(t('myClosetOrderDetail.missingOrderReference'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await getSellerOrderDetails(orderId);
      const payload = response?.data?.data ?? response?.data ?? response;
      setOrder(normalizeOrderDetail(payload, t));
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || t('myClosetOrderDetail.couldNotLoadOrder'));
    } finally {
      setLoading(false);
    }
  }, [orderId, t]);

  useFocusEffect(
    useCallback(() => {
      loadOrder();
    }, [loadOrder]),
  );

  const handleAdvance = useCallback(async () => {
    if (!order) return;
    const flowStep = STATUS_FLOW[order.status];
    const action = flowStep ? ACTION_BY_KEY[flowStep.actionKey] : null;
    if (!action) return;

    setAdvancing(true);
    dispatch(showLoader());
    try {
      await action(order.id);
      showToastMessage(toast, 'success', t('myClosetOrderDetail.orderStatusUpdated'));
      await loadOrder();
    } catch (err) {
      showToastMessage(
        toast,
        'danger',
        err?.response?.data?.message || err?.message || t('myClosetOrderDetail.unableToUpdateStatus'),
      );
    } finally {
      setAdvancing(false);
      dispatch(hideLoader());
    }
  }, [dispatch, loadOrder, order, t, toast]);

  const goBack = () => (navigation.canGoBack?.() ? navigation.goBack() : null);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header onBack={goBack} title={t('myClosetOrderDetail.headerTitle')} />
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={ACCENT} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header onBack={goBack} title={t('myClosetOrderDetail.headerTitle')} />
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={34} color="#dc2626" />
          <Text style={styles.emptyTitle}>{t('myClosetOrderDetail.couldntLoadOrder')}</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity activeOpacity={0.85} style={styles.retryButton} onPress={loadOrder}>
            <Text style={styles.retryText}>{t('myClosetOrderDetail.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const meta = STATUS_META[order.status];
  const flowStep = STATUS_FLOW[order.status];

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <Header onBack={goBack} title={t('myClosetOrderDetail.orderNumberTitle', { orderNumber: order.orderNumber })} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Text style={styles.orderDate}>{order.createdAt}</Text>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{t(meta.labelKey)}</Text>
          </View>
        </View>

        {order.status !== 'cancelled' && <StatusTimeline status={order.status} />}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('myClosetOrderDetail.buyer')}</Text>
          <View style={styles.buyerRow}>
            <View style={styles.buyerAvatar}>
              <Ionicons name="person" size={18} color="#fff" />
            </View>
            <Text style={styles.buyerName}>{order.buyerName}</Text>
          </View>
        </View>

        {order.address ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('myClosetOrderDetail.shippingAddress')}</Text>
            <Text style={styles.addressText}>{order.address.fullName}</Text>
            {order.address.phoneNumber ? (
              <Text style={styles.addressSub}>{order.address.phoneNumber}</Text>
            ) : null}
            <Text style={styles.addressSub}>{order.address.addressLine1}</Text>
            {order.address.addressLine2 ? (
              <Text style={styles.addressSub}>{order.address.addressLine2}</Text>
            ) : null}
            <Text style={styles.addressSub}>
              {[order.address.city, order.address.state, order.address.postalCode]
                .filter(Boolean)
                .join(', ')}
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('myClosetOrderDetail.items', { count: order.totalItemCount })}</Text>
          {order.lines.length ? (
            order.lines.map(line => (
              <View key={line.id} style={styles.lineRow}>
                <ImageBox uri={line.image} style={styles.lineThumb} />
                <View style={styles.lineCopy}>
                  <Text style={styles.lineName} numberOfLines={2}>
                    {line.name}
                  </Text>
                  <Text style={styles.linePrice}>{line.price}</Text>
                  <Text style={styles.lineQty}>{t('myClosetOrderDetail.qty', { count: line.quantity })}</Text>
                </View>
                <Text style={styles.lineTotal}>{line.lineTotal}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.addressSub}>{t('myClosetOrderDetail.noItemDetails')}</Text>
          )}
        </View>

        <View style={styles.card}>
          <SummaryRow label={t('myClosetOrderDetail.orderTotal')} value={order.totalAmount} bold />
        </View>

      {flowStep ? (
        <View style={styles.bottomBar}>
          <BottomButton
            label={advancing ? t('myClosetOrderDetail.updating') : t(flowStep.labelKey)}
            onPress={handleAdvance}
            disabled={advancing}
          />
        </View>
      ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

export default MyClosetOrderDetailScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, paddingTop: 40 },

  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '900',
    color: '#21083f',
  },

  content: { paddingHorizontal: 20, paddingBottom: 120 },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyTitle: { marginTop: 12, fontSize: 17, fontWeight: '900', color: '#17072d' },
  emptyText: { marginTop: 5, fontSize: 13, color: MUTED, textAlign: 'center' },
  retryButton: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: ACCENT, borderRadius: 10 },
  retryText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 18,
  },
  orderDate: { fontSize: 12, color: MUTED, fontWeight: '700' },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '800' },

  timelineWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 22,
  },
  timelineItem: { alignItems: 'center', width: 70 },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e5ddf0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLabel: { marginTop: 6, fontSize: 10, color: MUTED, fontWeight: '700', textAlign: 'center' },
  timelineConnector: { flex: 1, height: 2, backgroundColor: '#e5ddf0', marginTop: 11 },

  card: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
    backgroundColor: SURFACE,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 13, fontWeight: '900', color: '#21083f', marginBottom: 10 },

  buyerRow: { flexDirection: 'row', alignItems: 'center' },
  buyerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  buyerName: { fontSize: 13, fontWeight: '800', color: '#17072d' },

  addressText: { fontSize: 13, fontWeight: '900', color: '#17072d', marginBottom: 3 },
  addressSub: { fontSize: 12, color: '#43324f', lineHeight: 17 },

  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  lineThumb: { width: 52, height: 52, borderRadius: 10, marginRight: 10 },
  imageBox: { backgroundColor: '#f6f0ee', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },
  lineCopy: { flex: 1 },
  lineName: { fontSize: 13, fontWeight: '800', color: '#17072d' },
  linePrice: { marginTop: 2, fontSize: 12, color: ACCENT, fontWeight: '800' },
  lineQty: { marginTop: 1, fontSize: 11, color: MUTED, fontWeight: '600' },
  lineTotal: { fontSize: 13, fontWeight: '900', color: '#17072d' },

  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 13, color: '#43324f' },
  summaryValue: { fontSize: 13, color: '#17072d', fontWeight: '700' },
  summaryStrong: { fontSize: 16, fontWeight: '900', color: '#17072d' },
  summaryTotal: { fontSize: 18, fontWeight: '900', color: ACCENT },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 60,
  },
  bottomButton: {
    minHeight: 50,
    borderRadius: 13,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomButtonText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});