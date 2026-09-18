import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import FastImage from 'react-native-fast-image';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n';
import { approveSellerCancellationRequest, declineSellerCancellationRequest, getSellerOrderDetails, getBuyerOrderDetail } from '../../services/myCloset';
import { useToast } from 'react-native-toast-notifications';
import { SafeAreaView } from 'react-native-safe-area-context';

const imageUri = image => {
  if (!image) return null;
  if (typeof image === 'string') return image;
  return image?.uri || image?.url || image?.path || null;
};

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
  firstImage(order?.image) ||
  null;

const pickFirstText = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
};

const extractOrderPayload = response => {
  const payload = response?.data?.data ?? response?.data ?? response;
  if (!payload || typeof payload !== 'object') return null;
  const nested = payload?.order ?? payload?.sellerOrder ?? payload?.orderDetails;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return { ...payload, ...nested };
  }
  return payload;
};

const mergeOrderRecords = (preview, fetched) => {
  const next = { ...(preview || {}), ...(fetched || {}) };
  [
    'buyerName',
    'buyerDisplayName',
    'buyerUserName',
    'buyerUsername',
    'buyerAvatar',
    'buyerImage',
    'itemName',
    'productName',
    'name',
    'productImage',
    'image',
    'orderNumber',
    'orderId',
    'cancellationReason',
    'cancellationDeclineReason',
    'cancellationStatus',
    'cancelledBy',
    'reason',
    'itemPrice',
    'price',
    'total',
  ].forEach(key => {
    if ((next[key] == null || next[key] === '') && preview?.[key] != null && preview[key] !== '') {
      next[key] = preview[key];
    }
  });
  return next;
};

const formatMoney = value => {
  const raw = String(value ?? '').replace(/[^0-9.]/g, '');
  const amount = Number(raw);
  if (!Number.isFinite(amount)) return `$${value || '0.00'}`;
  return `$${amount.toFixed(2)}`;
};

const formatRequestDate = value => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
};

const CancellationRequestScreen = ({ navigation, route }) => {
  const { orderPreview, viewType, orderId } = route.params || {};
  const { accent, bgStyle, textStyle, mutedTextStyle } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const { t } = useLanguage();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [showDeclineInput, setShowDeclineInput] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [fullOrder, setFullOrder] = useState(orderPreview || {});
  
  const scrollViewRef = React.useRef(null);

  // This screen can remain mounted in the navigation stack. Reset the decline
  // draft whenever it becomes visible again so a previous form is not shown.
  useFocusEffect(
    React.useCallback(() => {
      setShowDeclineInput(false);
      setDeclineReason('');
    }, []),
  );

  const targetOrderId =
    orderId ||
    orderPreview?.orderId ||
    orderPreview?.id ||
    orderPreview?._id ||
    fullOrder?.orderId ||
    fullOrder?.id ||
    fullOrder?._id;

  React.useEffect(() => {
    const fetchFullOrder = async () => {
      if (!targetOrderId) return;
      try {
        const orderData = viewType === 'seller' ? await getSellerOrderDetails(targetOrderId) : await getBuyerOrderDetail(targetOrderId);
        const fetched = extractOrderPayload(orderData);
        if (fetched) {
          setFullOrder(prev => mergeOrderRecords(prev, fetched));
        }
      } catch (err) {
        console.log(`Failed to fetch full order for cancellation view (${viewType})`, err);
        try {
          const fallbackData = viewType === 'seller' ? await getBuyerOrderDetail(targetOrderId) : await getSellerOrderDetails(targetOrderId);
          const fetched = extractOrderPayload(fallbackData);
          if (fetched) {
            setFullOrder(prev => mergeOrderRecords(prev, fetched));
          }
        } catch (fallbackErr) {
          console.log(`Fallback fetch also failed`, fallbackErr);
        }
      }
    };
    fetchFullOrder();
  }, [targetOrderId, viewType]);

  const handleDecline = async () => {
    if (!showDeclineInput) {
      setShowDeclineInput(true);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return;
    }
    if (!declineReason.trim()) {
      toast.show('Please provide a decline reason.', { type: 'danger' });
      return;
    }
    setLoading(true);
    try {
      await declineSellerCancellationRequest(targetOrderId, { declineReason: declineReason.trim() });
      toast.show('Cancellation request declined.', { type: 'success' });
      navigation.goBack();
    } catch (error) {
      toast.show(error?.response?.data?.message || 'Failed to decline cancellation.', { type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await approveSellerCancellationRequest(targetOrderId, { restock: true });
      toast.show('Cancellation request approved.', { type: 'success' });
      navigation.goBack();
    } catch (error) {
      toast.show(error?.response?.data?.message || 'Failed to approve cancellation.', { type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const getOrderItemName = (order) => {
    return pickFirstText(
      order?.itemName,
      order?.productName,
      order?.name,
      order?.item?.name,
      order?.item?.title,
      order?.items?.[0]?.product?.name,
      order?.items?.[0]?.product?.title,
      order?.items?.[0]?.name,
      order?.items?.[0]?.title,
      order?.product?.name,
      order?.product?.title,
      order?.data?.itemName,
      order?.data?.productName,
      order?.data?.name,
    ) || 'Order Item';
  };

  const getOrderPrice = (order) => {
    return order?.totalAmount ?? order?.total ?? order?.itemPrice ?? order?.amount ?? order?.price ?? order?.data?.total ?? order?.data?.price ?? order?.item?.price ?? '0.00';
  };

  const getOrderQty = (order) => {
    return order?.totalItemCount ?? order?.itemCount ?? order?.quantity ?? order?.items?.[0]?.quantity ?? order?.items?.length ?? order?.data?.quantity ?? 1;
  };

  const getBuyerDisplayName = (order) => {
    return pickFirstText(
      order?.buyerDisplayName,
      order?.buyerName,
      order?.data?.buyerName,
      order?.buyer?.displayName,
      order?.buyer?.name,
      order?.user?.displayName,
      order?.user?.name,
    ) || 'Buyer';
  };

  const getBuyerUsername = (order) => {
    return pickFirstText(
      order?.buyerUserName,
      order?.buyerUsername,
      order?.data?.buyerUserName,
      order?.buyer?.username,
      order?.buyer?.userName,
      order?.user?.username,
      order?.user?.userName,
    );
  };

  const imageUrl = getOrderImage(fullOrder);
  const itemName = getOrderItemName(fullOrder);
  const price = formatMoney(getOrderPrice(fullOrder));
  const qty = getOrderQty(fullOrder);
  const buyerName = getBuyerDisplayName(fullOrder);
  const buyerUsername = getBuyerUsername(fullOrder);
  const buyerAvatar = pickFirstText(
    fullOrder?.buyerAvatar,
    fullOrder?.buyerImage,
    fullOrder?.avatar,
    fullOrder?.buyer?.profileImage,
    fullOrder?.buyer?.image,
  );

  const requestDate = fullOrder?.cancellationRequestedAt || fullOrder?.createdAt || fullOrder?.data?.createdAt;
  const requestedDateString = formatRequestDate(requestDate);
  const cancelReason = pickFirstText(
    fullOrder?.cancellationReason,
    fullOrder?.reason,
    fullOrder?.data?.reason,
  ) || 'N/A';
  const declineReasonText = pickFirstText(
    fullOrder?.cancellationDeclineReason,
    fullOrder?.declineReason,
    fullOrder?.data?.cancellationDeclineReason,
  );
  const cancelledBy = pickFirstText(fullOrder?.cancelledBy, fullOrder?.data?.cancelledBy).toUpperCase() || 'BUYER';
  const requestedByLabel = cancelledBy === 'SELLER' ? 'Seller' : 'Buyer';
  const cancellationStatus = String(
    fullOrder?.cancellationStatus ??
    fullOrder?.data?.cancellationStatus ??
    fullOrder?.data?.data?.cancellationStatus ??
    orderPreview?.cancellationStatus ??
    '',
  ).trim().toUpperCase() || (
    fullOrder?.isCancellationApproved || fullOrder?.isCancelled || fullOrder?.iscancel
      ? 'APPROVED'
      : fullOrder?.isCancellationDeclined
        ? 'DECLINED'
        : fullOrder?.isCancellationPending
          ? 'REQUESTED'
          : ''
  );
  const canRespondToCancellation = viewType === 'seller' && cancellationStatus === 'REQUESTED';

  const statusMeta = cancellationStatus === 'APPROVED'
    ? { badge: 'Cancelled', color: '#16a34a', bg: '#dcfce7', icon: 'checkmark-circle-outline', agreed: 'Seller confirmed', agreedColor: '#16a34a', itemBadge: 'Cancelled' }
    : cancellationStatus === 'DECLINED'
      ? { badge: 'Declined', color: '#dc2626', bg: '#fee2e2', icon: 'close-circle-outline', agreed: 'Seller declined', agreedColor: '#dc2626', itemBadge: 'Request declined' }
      : { badge: 'Action Required', color: '#d97706', bg: '#ffedd5', icon: 'hourglass-outline', agreed: 'Pending seller confirmation', agreedColor: '#d97706', itemBadge: 'Cancellation Requested' };

  const bannerTitle = cancelledBy === 'SELLER'
    ? 'Seller requested to cancel this order'
    : `${buyerName} requested to cancel this order`;

  const cardBg = isDarkMode ? '#1e1e1e' : '#fff';
  const infoBg = isDarkMode ? '#2c2c2c' : '#f9f5ff';

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={textStyle.color} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, textStyle]}>Cancellation Request</Text>
          <Text style={[styles.headerSubtitle, mutedTextStyle]}>Order #{fullOrder?.orderNumber || fullOrder?.data?.orderNumber || targetOrderId?.slice(-6) || 'Unknown'}</Text>
        </View>
        <View style={[styles.actionRequiredBadge, { backgroundColor: statusMeta.bg }]}>
          <Ionicons name={statusMeta.icon} size={12} color={statusMeta.color} />
          <Text style={[styles.actionRequiredText, { color: statusMeta.color }]}>{statusMeta.badge}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Warning Banner */}
          <View style={[styles.banner, { backgroundColor: isDarkMode ? '#332400' : '#fffbeb', borderColor: '#fde68a' }]}>
            <View style={styles.bannerIcon}>
              <Ionicons name="people-outline" size={20} color="#d97706" />
            </View>
            <View style={styles.bannerTextContainer}>
              <Text style={[styles.bannerTitle, textStyle]}>{bannerTitle}</Text>
              <Text style={[styles.bannerSub, mutedTextStyle]}>
                Both buyer and seller must agree to cancel. Please review the request details below.
              </Text>
            </View>
            <Ionicons name="cube-outline" size={40} color="#d97706" style={{ opacity: 0.5 }} />
          </View>

          {/* Item Card */}
          <View style={[styles.itemCard, { backgroundColor: cardBg }]}>
            {imageUrl ? (
              <FastImage source={{ uri: imageUrl }} style={styles.itemImage} />
            ) : (
              <View style={[styles.itemImage, { backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="image-outline" size={24} color="#9ca3af" />
              </View>
            )}
            <View style={styles.itemInfo}>
              <View style={styles.itemRow}>
                <Text style={[styles.itemName, textStyle]} numberOfLines={1}>{itemName}</Text>
                <Text style={[styles.itemPriceLabel, mutedTextStyle]}>Order Total</Text>
              </View>
              <View style={styles.itemRow}>
                <Text style={[styles.itemPrice, textStyle]}>${price}</Text>
                <Text style={[styles.itemPriceBig, textStyle]}>${price}</Text>
              </View>
              <View style={styles.itemRow}>
                <Text style={[styles.itemQty, mutedTextStyle]}>Qty: {qty}</Text>
                <View style={[styles.requestedBadge, { backgroundColor: statusMeta.bg }]}>
                  <Text style={[styles.requestedBadgeText, { color: statusMeta.color }]}>{statusMeta.itemBadge}</Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={[styles.sectionTitle, textStyle]}>Cancellation request details</Text>
          <View style={[styles.detailsCard, { backgroundColor: cardBg }]}>
            <View style={styles.detailRowSplit}>
              <View style={styles.detailHalf}>
                <Ionicons name="calendar-outline" size={20} color="#9ca3af" style={styles.detailIcon} />
                <View>
                  <Text style={[styles.detailLabel, mutedTextStyle]}>Requested on</Text>
                  <Text style={[styles.detailValue, textStyle]}>
                    {requestedDateString}
                  </Text>
                </View>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailHalf}>
                {buyerAvatar ? (
                  <FastImage source={{ uri: buyerAvatar }} style={styles.buyerAvatar} />
                ) : (
                  <Ionicons name="person-outline" size={20} color="#9ca3af" style={styles.detailIcon} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailLabel, mutedTextStyle]}>Requested by</Text>
                  <Text style={[styles.detailValue, textStyle]}>{buyerName}</Text>
                  {buyerUsername ? (
                    <Text style={[styles.detailSubValue, mutedTextStyle]}>@{buyerUsername}</Text>
                  ) : (
                    <Text style={[styles.detailSubValue, mutedTextStyle]}>{requestedByLabel}</Text>
                  )}
                </View>
              </View>
            </View>
            
            <View style={styles.detailRow}>
              <Ionicons name="pricetag-outline" size={20} color="#9ca3af" style={styles.detailIcon} />
              <View>
                <Text style={[styles.detailLabel, mutedTextStyle]}>Reason</Text>
                <Text style={[styles.detailValue, textStyle]}>{cancelReason}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="hand-left-outline" size={20} color="#9ca3af" style={styles.detailIcon} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.detailLabel, mutedTextStyle]}>Cancellation agreed by</Text>
                <Text style={[styles.detailValue, { color: statusMeta.agreedColor }]}>{statusMeta.agreed}</Text>
              </View>
            </View>

            {cancellationStatus === 'DECLINED' && declineReasonText ? (
              <View style={styles.detailRow}>
                <Ionicons name="close-circle-outline" size={20} color="#9ca3af" style={styles.detailIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailLabel, mutedTextStyle]}>Decline reason</Text>
                  <Text style={[styles.detailValue, textStyle]}>{declineReasonText}</Text>
                </View>
              </View>
            ) : null}
          </View>

          {canRespondToCancellation && (
            <>
              <Text style={[styles.sectionTitle, textStyle]}>What you need to do</Text>
                    <View style={[styles.actionCard, { backgroundColor: infoBg }]}>
                      <Ionicons name="shield-checkmark-outline" size={24} color="#7c3aed" style={{ marginRight: 12 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.actionTitle, textStyle]}>Review the request and decide</Text>
                        <Text style={[styles.actionDesc, mutedTextStyle]}>If you agree, the order will be canceled and the buyer will receive a refund.</Text>
                      </View>
                    </View>

                    {showDeclineInput && (
                      <View style={styles.declineInputContainer}>
                        <Text style={[styles.declineInputLabel, textStyle]}>Reason for declining</Text>
                        <TextInput
                          style={[styles.textInput, { color: textStyle.color, backgroundColor: cardBg }]}
                          placeholder="E.g. Item is already packed and scheduled for carrier pickup"
                          placeholderTextColor="#9ca3af"
                          value={declineReason}
                          onChangeText={setDeclineReason}
                          multiline
                          autoFocus
                        />
                      </View>
                    )}

                    <View style={styles.buttonRow}>
                      <TouchableOpacity style={styles.declineBtn} onPress={handleDecline} disabled={loading}>
                        {loading && showDeclineInput ? <ActivityIndicator size="small" color="#374151" /> : <Text style={styles.declineBtnText}>{showDeclineInput ? 'Submit Decline' : 'Decline Cancellation'}</Text>}
                      </TouchableOpacity>
                      {!showDeclineInput && (
                        <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: accent }]} onPress={handleConfirm} disabled={loading}>
                          {loading ? <ActivityIndicator size="small" color="#fff" /> : (
                            <>
                              <Ionicons name="checkmark-circle-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                              <Text style={styles.confirmBtnText}>Confirm Cancellation</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                    {!showDeclineInput && (
                      <Text style={[styles.lockNote, mutedTextStyle]}>
                        <Ionicons name="lock-closed-outline" size={12} /> Orders can only be canceled when both buyer and seller agree.
                      </Text>
                    )}
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
  },
  actionRequiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffedd5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  actionRequiredText: {
    color: '#d97706',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  scrollContent: {
    padding: 16,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  bannerSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  itemCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  itemImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  itemPriceLabel: {
    fontSize: 12,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '500',
  },
  itemPriceBig: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemQty: {
    fontSize: 13,
  },
  requestedBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  requestedBadgeText: {
    color: '#dc2626',
    fontSize: 10,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  detailsCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  detailRowSplit: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  detailHalf: {
    flex: 1,
    flexDirection: 'row',
  },
  detailDivider: {
    width: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 16,
  },
  detailIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  buyerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 12,
    marginTop: 2,
  },
  detailRow: {
    flexDirection: 'row',
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 16,
  },
  detailLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  detailSubValue: {
    fontSize: 12,
    marginTop: 2,
  },
  actionCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  declineBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  declineBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  lockNote: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 30,
  },
  declineInputContainer: {
    marginBottom: 16,
  },
  declineInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  }
});

export default CancellationRequestScreen;
