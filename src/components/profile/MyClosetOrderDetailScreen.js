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
import { useThemeContext } from '../../theme/ThemeContext';

const withAlpha = (hex, alpha = 0.12) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return `rgba(90,35,134,${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const MUTED = '#6b7280';

// ── Status meta + flow (kept in sync with the orders list screen) ─────────
const STATUS_META = {
  pending: { label: 'To ship', color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
  confirmed: { label: 'Confirmed', color: '#0891b2', bg: 'rgba(8,145,178,0.12)' },
  processing: { label: 'Processing', color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
  shipped: { label: 'Shipped', color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
  delivered: { label: 'Delivered', color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
  cancelled: { label: 'Cancelled', color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
};

const STATUS_FLOW = {
  pending: { label: 'Mark as Processing', actionKey: 'processing' },
  confirmed: { label: 'Mark as Processing', actionKey: 'processing' },
  processing: { label: 'Mark as Shipped', actionKey: 'shipped' },
  shipped: { label: 'Mark as Delivered', actionKey: 'delivered' },
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

const getLineItemName = line =>
  line?.product?.name || line?.product?.title || line?.item?.name || line?.name || 'Item';

const getLineItemPrice = line => line?.product?.price ?? line?.price ?? 0;

const normalizeOrderDetail = order => {
  const lineItems = Array.isArray(order?.orderItems)
    ? order.orderItems
    : Array.isArray(order?.items)
      ? order.items
      : Array.isArray(order?.cartItems)
        ? order.cartItems
        : [];

  const normalizedLines = lineItems.map((line, index) => ({
    id: line?.id || line?._id || String(index),
    name: getLineItemName(line),
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
    buyerName: order?.buyerName || order?.buyer?.username || order?.buyer?.userName || 'Buyer',
    buyerId: order?.buyerId || order?.buyer?.id,
    totalAmount: currency(order?.totalAmount ?? order?.amount ?? order?.total),
    totalItemCount: order?.totalItemCount ?? normalizedLines.length,
    lines: normalizedLines,
    address,
    raw: order,
  };
};

// ── Shared atoms (mirroring the buyer flow's design system) ────────────────
const Header = ({ onBack, title }) => {
  const { accent, textStyle } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const chipSurface = isDarkMode ? 'rgba(255,255,255,0.08)' : '#ffffff';

  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack}
        style={[styles.iconButton, { backgroundColor: chipSurface }]}
        activeOpacity={0.8}
      >
        <Ionicons name="chevron-back" size={22} color={accent} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, textStyle]}>{title}</Text>
      <View style={styles.iconButton} />
    </View>
  );
};

const ImageBox = ({ uri, style, iconSize = 22 }) => {
  const { isDarkMode } = useThemeContext();
  const imageSurface = isDarkMode ? 'rgba(255,255,255,0.06)' : '#f6f0ee';

  return (
    <View style={[styles.imageBox, { backgroundColor: imageSurface }, style]}>
      {uri ? (
        <Image source={{ uri }} style={styles.coverImage} resizeMode="cover" />
      ) : (
        <Ionicons name="shirt-outline" size={iconSize} color="#9b8c7a" />
      )}
    </View>
  );
};

const SummaryRow = ({ label, value, bold }) => {
  const { textStyle, mutedTextStyle } = useAppTheme();
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, mutedTextStyle, bold && styles.summaryStrong]}>{label}</Text>
      <Text style={[styles.summaryValue, textStyle, bold && styles.summaryTotal]}>{value}</Text>
    </View>
  );
};

const BottomButton = ({ label, onPress, disabled }) => {
  const { accent } = useAppTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={disabled ? undefined : onPress}
      style={[styles.bottomButton, { backgroundColor: accent }, disabled && { opacity: 0.6 }]}
    >
      <Text style={styles.bottomButtonText}>{label}</Text>
    </TouchableOpacity>
  );
};

const StatusTimeline = ({ status }) => {
  const { accent, mutedTextStyle } = useAppTheme();
  const currentIndex = TIMELINE_STEPS.indexOf(status === 'cancelled' ? 'pending' : status);
  const connectorColor = withAlpha(accent, 0.25);

  return (
    <View style={styles.timelineWrap}>
      {TIMELINE_STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        const meta = STATUS_META[step];
        return (
          <React.Fragment key={step}>
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, (done || active) && { backgroundColor: accent }]}>
                {done ? <Ionicons name="checkmark" size={11} color="#fff" /> : null}
              </View>
              <Text style={[styles.timelineLabel, mutedTextStyle, active && { color: accent, fontWeight: '900' }]}>
                {meta.label}
              </Text>
            </View>
            {index < TIMELINE_STEPS.length - 1 && (
              <View
                style={[
                  styles.timelineConnector,
                  { backgroundColor: connectorColor },
                  index < currentIndex && { backgroundColor: accent },
                ]}
              />
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
  const { accent, bgStyle, cardStyle, textStyle, mutedTextStyle, border } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surface = isDarkMode ? withAlpha(accent, 0.1) : '#fbf8ff';

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [advancing, setAdvancing] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setError('Missing order reference.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await getSellerOrderDetails(orderId);
      const payload = response?.data?.data ?? response?.data ?? response;
      setOrder(normalizeOrderDetail(payload));
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Could not load order details.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

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
      showToastMessage(toast, 'success', 'Order status updated.');
      await loadOrder();
    } catch (err) {
      showToastMessage(
        toast,
        'danger',
        err?.response?.data?.message || err?.message || 'Unable to update order status.',
      );
    } finally {
      setAdvancing(false);
      dispatch(hideLoader());
    }
  }, [dispatch, loadOrder, order, toast]);

  const goBack = () => (navigation.canGoBack?.() ? navigation.goBack() : null);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, bgStyle]}>
        <Header onBack={goBack} title="Order Details" />
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={[styles.safeArea, bgStyle]}>
        <Header onBack={goBack} title="Order Details" />
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={34} color="#dc2626" />
          <Text style={[styles.emptyTitle, textStyle]}>Couldn't load order</Text>
          <Text style={[styles.emptyText, mutedTextStyle]}>{error}</Text>
          <TouchableOpacity activeOpacity={0.85} style={[styles.retryButton, { backgroundColor: accent }]} onPress={loadOrder}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const meta = STATUS_META[order.status];
  const flowStep = STATUS_FLOW[order.status];

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <Header onBack={goBack} title={`Order #${order.orderNumber}`} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Text style={[styles.orderDate, mutedTextStyle]}>{order.createdAt}</Text>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>

        {order.status !== 'cancelled' && <StatusTimeline status={order.status} />}

        <View style={[styles.card, cardStyle, { borderColor: border, backgroundColor: surface }]}>
          <Text style={[styles.cardTitle, textStyle]}>Buyer</Text>
          <View style={styles.buyerRow}>
            <View style={[styles.buyerAvatar, { backgroundColor: accent }]}>
              <Ionicons name="person" size={18} color="#fff" />
            </View>
            <Text style={[styles.buyerName, textStyle]}>{order.buyerName}</Text>
          </View>
        </View>

        {order.address ? (
          <View style={[styles.card, cardStyle, { borderColor: border, backgroundColor: surface }]}>
            <Text style={[styles.cardTitle, textStyle]}>Shipping Address</Text>
            <Text style={[styles.addressText, textStyle]}>{order.address.fullName}</Text>
            {order.address.phoneNumber ? (
              <Text style={[styles.addressSub, mutedTextStyle]}>{order.address.phoneNumber}</Text>
            ) : null}
            <Text style={[styles.addressSub, mutedTextStyle]}>{order.address.addressLine1}</Text>
            {order.address.addressLine2 ? (
              <Text style={[styles.addressSub, mutedTextStyle]}>{order.address.addressLine2}</Text>
            ) : null}
            <Text style={[styles.addressSub, mutedTextStyle]}>
              {[order.address.city, order.address.state, order.address.postalCode]
                .filter(Boolean)
                .join(', ')}
            </Text>
          </View>
        ) : null}

        <View style={[styles.card, cardStyle, { borderColor: border, backgroundColor: surface }]}>
          <Text style={[styles.cardTitle, textStyle]}>Items ({order.totalItemCount})</Text>
          {order.lines.length ? (
            order.lines.map(line => (
              <View key={line.id} style={styles.lineRow}>
                <ImageBox uri={line.image} style={styles.lineThumb} />
                <View style={styles.lineCopy}>
                  <Text style={[styles.lineName, textStyle]} numberOfLines={2}>
                    {line.name}
                  </Text>
                  <Text style={[styles.linePrice, mutedTextStyle]}>{line.price}</Text>
                  <Text style={[styles.lineQty, mutedTextStyle]}>Qty: {line.quantity}</Text>
                </View>
                <Text style={[styles.lineTotal, textStyle]}>{line.lineTotal}</Text>
              </View>
            ))
          ) : (
            <Text style={[styles.addressSub, mutedTextStyle]}>No item details available for this order.</Text>
          )}
        </View>

        <View style={[styles.card, cardStyle, { borderColor: border, backgroundColor: surface }]}>
          <SummaryRow label="Order total" value={order.totalAmount} bold />
        </View>

      {flowStep ? (
        <View style={[styles.bottomBar, { backgroundColor: bgStyle.backgroundColor, borderTopColor: withAlpha(accent, 0.2) }]}>
          <BottomButton
            label={advancing ? 'Updating…' : flowStep.label}
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
  retryButton: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
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
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 13, fontWeight: '900', marginBottom: 10 },

  buyerRow: { flexDirection: 'row', alignItems: 'center' },
  buyerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  buyerName: { fontSize: 13, fontWeight: '800' },

  addressText: { fontSize: 13, fontWeight: '900', marginBottom: 3 },
  addressSub: { fontSize: 12, lineHeight: 17 },

  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.15)',
  },
  lineThumb: { width: 52, height: 52, borderRadius: 10, marginRight: 10 },
  imageBox: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },
  lineCopy: { flex: 1 },
  lineName: { fontSize: 13, fontWeight: '800' },
  linePrice: { marginTop: 2, fontSize: 12, fontWeight: '800' },
  lineQty: { marginTop: 1, fontSize: 11, fontWeight: '600' },
  lineTotal: { fontSize: 13, fontWeight: '900' },

  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 13 },
  summaryValue: { fontSize: 13, fontWeight: '700' },
  summaryStrong: { fontSize: 16, fontWeight: '900' },
  summaryTotal: { fontSize: 18, fontWeight: '900' },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 60,
    borderTopWidth: 1,
  },
  bottomButton: {
    minHeight: 50,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomButtonText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});