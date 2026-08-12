import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { useToast } from 'react-native-toast-notifications';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { showToastMessage } from '../displaytoastmessage';
import {
  getSellerOrderDetails,
  getBuyerOrderDetail,
  markOrderProcessing,
  markOrderShipped,
  markOrderDelivered,
  deliverLocalPickupOrder,
} from '../../services/myCloset';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n';
import { navigateToUserProfile } from '../../utils/navigateToUserProfile';
import ShippingDetailsModal from '../modals/ShippingDetailsModal';
import DeliverOtpModal from '../modals/DeliverOtpModal';
import { withAlpha } from '../../utils/closetTheme';
import { DetailImageCarousel } from './MyClosetBuyerFlow';

// ── Status meta + flow (kept in sync with the orders list screen) ─────────
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
  shipped: null,
  delivered: null,
  cancelled: null,
};

const getDetailFlowStep = (order, canUpdateStatus) => {
  if (!canUpdateStatus || !order) return null;
  if (order.isLocalPickup) {
    if (order.status === 'pending' || order.status === 'confirmed') {
      return { labelKey: 'myClosetOrderDetail.markAsProcessing', actionKey: 'processing' };
    }
    if (order.status === 'processing') {
      return { labelKey: 'myClosetOrderDetail.markAsDelivered', actionKey: 'deliver' };
    }
    return null;
  }
  return STATUS_FLOW[order.status];
};

const ACTION_BY_KEY = {
  processing: (id) => markOrderProcessing(id),
  shipped: (id, extra) => markOrderShipped(id, extra),
  delivered: (id, extra) => markOrderDelivered(id, extra),
};

const SHIP_TIMELINE_STEPS = ['pending', 'processing', 'shipped', 'delivered'];
const PICKUP_TIMELINE_STEPS = ['pending', 'processing', 'delivered'];

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

const toTitleCase = value =>
  String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

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

const getLineItemImage = line =>
  firstImage(line?.productImage) ||
  firstImage(line?.product?.images) ||
  firstImage(line?.product?.image) ||
  firstImage(line?.item?.productImage) ||
  firstImage(line?.item?.images) ||
  firstImage(line?.item?.image) ||
  firstImage(line?.images) ||
  firstImage(line?.image) ||
  null;

const getLineItemName = (line, t) =>
  line?.product?.name || line?.product?.title || line?.item?.name || line?.name || t('myClosetOrderDetail.defaultItemName');

const getLineItemPrice = line => line?.product?.price ?? line?.price ?? 0;

const normalizeOrderDetail = (order, t, viewType, isLocalPickupRoute = false) => {
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
  const coverImg =
    firstImage(order?.productImage) ||
    firstImage(order?.item?.productImage) ||
    firstImage(order?.items?.[0]?.productImage) ||
    firstImage(order?.items?.[0]?.product?.images) ||
    firstImage(order?.items?.[0]?.product?.image) ||
    firstImage(order?.items?.[0]?.images) ||
    firstImage(order?.items?.[0]?.image) ||
    firstImage(order?.image) ||
    null;

  const isLocalPickupVal = val => {
    if (!val) return false;
    const str = String(val).trim().toLowerCase();
    return (
      str === 'local-pickup' ||
      str === 'local_pickup' ||
      str === 'local_pick' ||
      str === 'localpick' ||
      str === 'pickup' ||
      str === 'local'
    );
  };

  const itemChoice =
    lineItems[0]?.selectedShippingChoice ||
    lineItems[0]?.shippingChoice ||
    lineItems[0]?.shippingOption ||
    lineItems[0]?.shippingType ||
    lineItems[0]?.product?.shippingOption ||
    order?.item?.selectedShippingChoice ||
    '';

  const shippingType =
    order?.shippingType ||
    order?.shippingOption ||
    order?.fulfillmentType ||
    order?.shippingChoice ||
    order?.selectedShippingChoice ||
    order?.deliveryType ||
    order?.orderType ||
    order?.shipping_type ||
    order?.shipping_option ||
    order?.shipping_choice ||
    itemChoice ||
    '';

  const isLocalPickup =
    Boolean(isLocalPickupRoute) ||
    Boolean(order?.isLocalPickup) ||
    isLocalPickupVal(shippingType) ||
    isLocalPickupVal(itemChoice) ||
    lineItems.some(it => isLocalPickupVal(it?.selectedShippingChoice || it?.shippingChoice || it?.shippingOption || it?.product?.shippingOption)) ||
    viewType === 'local-pickup';

  return {
    id: order?.id || order?._id,
    orderNumber: order?.orderNumber || order?.orderId || order?.id,
    status: normalizeStatus(order?.orderStatus ?? order?.status),
    createdAt: formatDate(order?.createdAt || order?.orderDate),
    buyerName: viewType === 'buyer'
      ? (order?.sellerName || order?.seller?.userName || order?.seller?.username || order?.seller?.name || order?.sellerUsername || order?.shop?.username || order?.shop?.userName || order?.shop?.name || t('myClosetOrderDetail.seller'))
      : (order?.buyerName || order?.buyer?.username || order?.buyer?.userName || order?.buyer?.name || order?.buyerUsername || order?.user?.username || order?.user?.userName || order?.user?.name || t('myClosetOrderDetail.buyer')),
    buyerId: viewType === 'buyer'
      ? (order?.seller?.id || order?.seller?._id || order?.sellerId || order?.shop?.id || order?.shop?._id)
      : (order?.buyer?.id || order?.buyer?._id || order?.buyerId || order?.user?.id || order?.user?._id || order?.userId),
    buyerImage: viewType === 'buyer'
      ? (order?.sellerProfileImage || order?.sellerImage || order?.seller?.profileImage || order?.seller?.image || order?.seller?.avatar || order?.seller?.profilePicture || order?.seller?.profilePic || order?.shop?.shopLogo || order?.shop?.logo || order?.shop?.profileImage || order?.shop?.image || order?.shop?.avatar || order?.shop?.profilePicture || order?.shop?.profilePic || order?.shopLogo || order?.logo)
      : (order?.buyerProfileImage || order?.buyerImage || order?.buyer?.profileImage || order?.buyer?.image || order?.buyer?.avatar || order?.buyer?.profilePicture || order?.buyer?.profilePic || order?.user?.profileImage || order?.user?.image || order?.user?.avatar || order?.user?.profilePicture || order?.user?.profilePic),
    totalAmount: currency(order?.totalAmount ?? order?.amount ?? order?.total),
    totalItemCount: order?.totalItemCount ?? normalizedLines.length,
    orderStatusLabel: t(`myClosetOrderDetail.status.${normalizeStatus(order?.orderStatus ?? order?.status)}`),
    coverImage: coverImg,
    images: Array.from(new Set([coverImg, ...normalizedLines.map(line => line.image)].filter(Boolean))),
    lines: normalizedLines,
    address,
    shippingType,
    isLocalPickup,
    raw: order,
  };
};

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

const ImageBox = ({ uri, style, iconSize = 22, resizeMode = FastImage.resizeMode.cover }) => {
  const [loading, setLoading] = useState(Boolean(uri));
  const { accent, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const imageSurface = isDarkMode ? 'rgba(255,255,255,0.06)' : '#f6f0ee';
  const loaderOverlay = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(251,248,255,0.35)';
  const source = fastImageSource(uri);

  return (
    <View style={[styles.imageBox, { backgroundColor: imageSurface }, style]}>
      {source ? (
        <>
          <FastImage
            source={source}
            style={styles.coverImage}
            resizeMode={resizeMode}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => setLoading(false)}
          />
          {loading ? (
            <View style={[styles.imageLoaderOverlay, { backgroundColor: loaderOverlay }]}>
              <ActivityIndicator size="small" color={accent} />
            </View>
          ) : null}
        </>
      ) : (
        <Ionicons name="shirt-outline" size={iconSize} color={mutedText || '#9b8c7a'} />
      )}
    </View>
  );
};

const SummaryRow = ({ label, value, bold }) => {
  const { textStyle, mutedTextStyle, accent } = useAppTheme();
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, mutedTextStyle, bold && styles.summaryStrong]}>{label}</Text>
      <Text style={[styles.summaryValue, textStyle, bold && styles.summaryTotal, bold && { color: accent }]}>
        {value}
      </Text>
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

// Small horizontal progress tracker
const StatusTimeline = ({ status, isLocalPickup }) => {
  const { t } = useLanguage();
  const { accent, mutedTextStyle } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const steps = isLocalPickup ? PICKUP_TIMELINE_STEPS : SHIP_TIMELINE_STEPS;
  const currentIndex = steps.indexOf(status === 'cancelled' ? 'pending' : status);
  const connectorColor = withAlpha(accent, 0.25);
  const inactiveDot = isDarkMode ? 'rgba(255,255,255,0.12)' : '#e5ddf0';

  return (
    <View style={styles.timelineWrap}>
      {steps.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        const meta = STATUS_META[step];
        return (
          <React.Fragment key={step}>
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: inactiveDot }, (done || active) && { backgroundColor: accent }]}>
                {done ? <Ionicons name="checkmark" size={11} color="#fff" /> : null}
              </View>
              <Text style={[styles.timelineLabel, mutedTextStyle, active && { color: accent, fontWeight: '900' }]}>
                {t(meta.labelKey)}
              </Text>
            </View>
            {index < steps.length - 1 && (
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
  const returnTo = route?.params?.returnTo;
  const toast = useToast();
  const dispatch = useDispatch();
  const { accent, bgStyle, cardStyle, textStyle, mutedTextStyle, border, card } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surface = isDarkMode ? card : '#fbf8ff';
  const { t } = useLanguage();

  const isLocalPickupRoute = Boolean(
    route?.params?.isLocalPickup ||
    route?.params?.fulfillmentTab === 'local-pickup'
  );

  const handleUserProfile = useCallback(
    (id) => {
      const targetId = id != null ? String(id).trim() : '';
      if (!targetId) return;

      const currentRoute = route?.name || 'MyClosetOrderDetail';
      const returnToPayload = {
        tab: 'ProfileMain',
        screen: currentRoute,
        params: route?.params,
      };

      void navigateToUserProfile(navigation, targetId, {
        returnTo: returnToPayload,
      });
    },
    [navigation, route?.name, route?.params],
  );

  const orderPreview = route?.params?.orderPreview;
  const viewType = route?.params?.viewType;
  const canUpdateStatus = viewType !== 'buyer';

  const [order, setOrder] = useState(() =>
    orderPreview ? normalizeOrderDetail(orderPreview, t, viewType, isLocalPickupRoute) : null
  );
  const [loading, setLoading] = useState(!orderPreview);
  const [error, setError] = useState(null);
  const [advancing, setAdvancing] = useState(false);
  const [shippingModalVisible, setShippingModalVisible] = useState(false);
  const [otpModalVisible, setOtpModalVisible] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setError(t('myClosetOrderDetail.missingOrderReference'));
      setLoading(false);
      return;
    }
    setOrder(prev => {
      if (!prev) setLoading(true);
      return prev;
    });
    setError(null);
    try {
      const response = viewType === 'buyer'
        ? await getBuyerOrderDetail(orderId)
        : await getSellerOrderDetails(orderId);
      const payload = response?.data?.data ?? response?.data ?? response;
      setOrder(prev => {
        const newOrder = normalizeOrderDetail(payload, t, viewType, isLocalPickupRoute);
        if (prev?.buyerImage && !newOrder.buyerImage) newOrder.buyerImage = prev.buyerImage;
        if (prev?.buyerName && !newOrder.buyerName) newOrder.buyerName = prev.buyerName;
        if (prev?.buyerId && !newOrder.buyerId) newOrder.buyerId = prev.buyerId;
        return newOrder;
      });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || t('myClosetOrderDetail.couldNotLoadOrder'));
    } finally {
      setLoading(false);
    }
  }, [orderId, t, viewType, isLocalPickupRoute]);

  useFocusEffect(
    useCallback(() => {
      loadOrder();
    }, [loadOrder]),
  );

  const flowStep = getDetailFlowStep(order, canUpdateStatus);

  const handleAdvance = useCallback(async (extra) => {
    if (!canUpdateStatus || !order) return;
    const currentStep = getDetailFlowStep(order, canUpdateStatus);
    if (!currentStep) return;

    if (currentStep.actionKey === 'shipped' && !extra) {
      setShippingModalVisible(true);
      return;
    }

    if (currentStep.actionKey === 'deliver' && !extra && order.isLocalPickup) {
      setOtpModalVisible(true);
      return;
    }

    setAdvancing(true);
    dispatch(showLoader());
    try {
      let response;
      if (currentStep.actionKey === 'deliver' && order.isLocalPickup) {
        const otpVal = typeof extra === 'string' ? extra : extra?.otp;
        response = await deliverLocalPickupOrder(order.id, otpVal);
        showToastMessage(
          toast,
          'success',
          t('myClosetOrderDetail.deliverySuccess') || 'Order marked as delivered successfully.',
        );
      } else {
        const action = ACTION_BY_KEY[currentStep.actionKey];
        if (action) {
          response = await action(order.id, extra);
          if (response?.statusCode == 200 || response?.statusCode == 201) {
            showToastMessage(toast, 'success', t('myClosetOrderDetail.orderStatusUpdated'));
          } else if (response?.message) {
            showToastMessage(toast, 'danger', response.message);
          }
        }
      }
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
      setShippingModalVisible(false);
      setOtpModalVisible(false);
    }
  }, [canUpdateStatus, dispatch, loadOrder, order, t, toast]);

  const goBack = useCallback(() => {
    if (returnTo === 'MyClosetDashboard') {
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
      });
      return;
    }

    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }

    if (navigation?.popToTop) {
      navigation.popToTop();
      return;
    }

    navigation?.navigate?.('MyCloset');
  }, [navigation, returnTo]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, bgStyle]}>
        <Header onBack={goBack} title={t('myClosetOrderDetail.headerTitle')} />
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={[styles.safeArea, bgStyle]}>
        <Header onBack={goBack} title={t('myClosetOrderDetail.headerTitle')} />
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={34} color="#dc2626" />
          <Text style={[styles.emptyTitle, textStyle]}>{t('myClosetOrderDetail.couldntLoadOrder')}</Text>
          <Text style={[styles.emptyText, mutedTextStyle]}>{error}</Text>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.retryButton, { backgroundColor: accent }]}
            onPress={loadOrder}
          >
            <Text style={styles.retryText}>{t('myClosetOrderDetail.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const meta = STATUS_META[order.status];

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <Header onBack={goBack} title={t('myClosetOrderDetail.orderNumberTitle', { orderNumber: order.orderNumber })} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Text style={[styles.orderDate, mutedTextStyle]}>{order.createdAt}</Text>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{t(meta.labelKey)}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.metaPill, { backgroundColor: withAlpha(accent, 0.1) }]}>
            <Text style={[styles.metaLabel, mutedTextStyle]}>{t('myClosetOrderDetail.orderNumberLabel')}</Text>
            <Text style={[styles.metaValue, textStyle]}>#{order.orderNumber}</Text>
          </View>
          <View style={[styles.metaPill, { backgroundColor: withAlpha(accent, 0.1) }]}>
            <Text style={[styles.metaLabel, mutedTextStyle]}>{t('myClosetOrderDetail.itemsLabel')}</Text>
            <Text style={[styles.metaValue, textStyle]}>{t('myClosetOrderDetail.itemsCount', { count: order.totalItemCount })}</Text>
          </View>
          <View style={[styles.metaPill, { backgroundColor: withAlpha(accent, 0.1) }]}>
            <Text style={[styles.metaLabel, mutedTextStyle]}>{t('myClosetOrderDetail.totalLabel')}</Text>
            <Text style={[styles.metaValue, textStyle]}>{order.totalAmount}</Text>
          </View>
        </View>

        {order.status !== 'cancelled' && (
          <StatusTimeline status={order.status} isLocalPickup={order.isLocalPickup} />
        )}

        <View style={[styles.card, cardStyle, { borderColor: border, backgroundColor: surface }]}>
          <Text style={[styles.cardTitle, textStyle]}>
            {canUpdateStatus ? t('myClosetOrderDetail.buyer') : t('myClosetOrderDetail.seller')}
          </Text>
          <TouchableOpacity 
            style={styles.buyerRow}
            activeOpacity={0.7}
            onPress={() => handleUserProfile(order.buyerId)}
          >
            <View style={[styles.buyerAvatar, { backgroundColor: accent, overflow: 'hidden' }]}>
              {order.buyerImage ? (
                <FastImage
                  source={fastImageSource(imageUri(order.buyerImage))}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode={FastImage.resizeMode.cover}
                />
              ) : (
                <Ionicons name="person" size={18} color="#fff" />
              )}
            </View>
            <Text style={[styles.buyerName, textStyle]}>{toTitleCase(order.buyerName)}</Text>
          </TouchableOpacity>
        </View>

        {order.address ? (
          <View style={[styles.card, cardStyle, { borderColor: border, backgroundColor: surface }]}>
            <Text style={[styles.cardTitle, textStyle]}>{t('myClosetOrderDetail.shippingAddress')}</Text>
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
          <Text style={[styles.cardTitle, textStyle]}>{t('myClosetOrderDetail.items', { count: order.totalItemCount })}</Text>
          {order.images?.length ? (
            <View style={styles.coverWrap}>
              <DetailImageCarousel
                images={order.images}
                accentColor={accent}
                imageWidth={Dimensions.get('window').width - 60}
                imageHeight={220}
              />
            </View>
          ) : null}
          {order.lines.length ? (
            order.lines.map(line => (
              <View key={line.id} style={styles.lineRow}>
                <ImageBox uri={line.image} style={styles.lineThumb} />
                <View style={styles.lineCopy}>
                  <Text style={[styles.lineName, textStyle]} numberOfLines={2}>
                    {line.name}
                  </Text>
                  <Text style={[styles.linePrice, { color: accent }]}>{line.price}</Text>
                  <Text style={[styles.lineQty, mutedTextStyle]}>{t('myClosetOrderDetail.qty', { count: line.quantity })}</Text>
                </View>
                <Text style={[styles.lineTotal, textStyle]}>{line.lineTotal}</Text>
              </View>
            ))
          ) : (
            <Text style={[styles.addressSub, mutedTextStyle]}>{t('myClosetOrderDetail.noItemDetails')}</Text>
          )}
        </View>

        <View style={[styles.card, cardStyle, { borderColor: border, backgroundColor: surface }]}>
          <SummaryRow label={t('myClosetOrderDetail.orderTotal')} value={order.totalAmount} bold />
        </View>

        {canUpdateStatus && flowStep ? (
          <View style={[styles.bottomBar, { backgroundColor: bgStyle.backgroundColor, borderTopColor: withAlpha(accent, 0.2) }]}>
            <BottomButton
              label={advancing ? t('myClosetOrderDetail.updating') : (t(flowStep.labelKey) || flowStep.labelKey)}
              onPress={() => handleAdvance()}
              disabled={advancing}
            />
          </View>
        ) : null}
      </ScrollView>
      {canUpdateStatus ? (
        <>
          <ShippingDetailsModal
            visible={shippingModalVisible}
            text={accent}
            onCancel={() => setShippingModalVisible(false)}
            onSubmit={(payload) => handleAdvance(payload)}
          />
          <DeliverOtpModal
            visible={otpModalVisible}
            orderId={order.id}
            accent={accent}
            toast={toast}
            onCancel={() => setOtpModalVisible(false)}
            onSubmit={(otp) => handleAdvance(otp)}
          />
        </>
      ) : null}
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
  },

  content: { paddingHorizontal: 20, paddingBottom: 120 },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyTitle: { marginTop: 12, fontSize: 17, fontWeight: '900' },
  emptyText: { marginTop: 5, fontSize: 13, textAlign: 'center' },
  retryButton: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  retryText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 18,
  },
  orderDate: { fontSize: 12, fontWeight: '700' },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '800' },
  metaRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  metaPill: { flexGrow: 1, minWidth: '31%', borderRadius: 12, padding: 10 },

  metaLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  metaValue: { fontSize: 13, fontWeight: '800' },

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
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLabel: { marginTop: 6, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  timelineConnector: { flex: 1, height: 2, marginTop: 11 },

  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 13, fontWeight: '900', marginBottom: 10 },
  coverWrap: { marginBottom: 12, width: '100%' },

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
  imageBox: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
    alignSelf: 'stretch',
  },
  coverImage: { width: '100%', height: '100%' },
  imageLoaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
