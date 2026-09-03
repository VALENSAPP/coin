import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n';
import { approveSellerCancellationRequest, declineSellerCancellationRequest, getSellerOrderDetails, getBuyerOrderDetail } from '../../services/myCloset';
import { useToast } from 'react-native-toast-notifications';

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
  order?.image ||
  null;

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

  const targetOrderId = orderId || orderPreview?.id || orderPreview?._id || fullOrder?.id || fullOrder?._id;

  React.useEffect(() => {
    const fetchFullOrder = async () => {
      if (!targetOrderId) return;
      try {
        const orderData = viewType === 'seller' ? await getSellerOrderDetails(targetOrderId) : await getBuyerOrderDetail(targetOrderId);
        if (orderData) {
          setFullOrder(prev => ({ ...prev, ...orderData }));
        }
      } catch (err) {
        console.log('Failed to fetch full order for cancellation view', err);
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
    if (order?.item?.name || order?.item?.title) return order.item.name || order.item.title;
    if (order?.items?.[0]?.product?.name || order?.items?.[0]?.product?.title) {
      return order.items[0].product.name || order.items[0].product.title;
    }
    if (order?.items?.[0]?.name || order?.items?.[0]?.title) return order.items[0].name || order.items[0].title;
    if (order?.product?.name || order?.product?.title) return order.product.name || order.product.title;
    if (order?.itemName || order?.data?.itemName || order?.data?.name || order?.data?.productName) return order.itemName || order.data?.itemName || order.data?.name || order.data?.productName;
    const count = order?.totalItemCount || order?.items?.length;
    if (count) return `${count} item(s)`;
    return 'Order Item';
  };

  const getOrderPrice = (order) => {
    return order?.totalAmount ?? order?.amount ?? order?.price ?? order?.data?.total ?? order?.data?.price ?? order?.item?.price ?? '0.00';
  };

  const getOrderQty = (order) => {
    return order?.totalItemCount ?? order?.itemCount ?? order?.items?.[0]?.quantity ?? order?.items?.length ?? order?.data?.quantity ?? 1;
  };

  const getBuyerHandle = (order) => {
    return order?.buyerName || order?.data?.buyerUserName || order?.data?.buyerName || order?.buyer?.username || order?.buyer?.userName || order?.buyerUsername || order?.user?.username || 'Buyer';
  };

  const imageUrl = getOrderImage(fullOrder);
  const itemName = getOrderItemName(fullOrder);
  const price = getOrderPrice(fullOrder);
  const qty = getOrderQty(fullOrder);
  const buyerName = getBuyerHandle(fullOrder);

  const requestDate = fullOrder?.cancellationRequestedAt || fullOrder?.createdAt || fullOrder?.data?.createdAt;
  const requestedDateString = requestDate ? new Date(requestDate).toLocaleDateString() : 'N/A';
  const cancelReason = fullOrder?.cancellationReason || fullOrder?.data?.reason || fullOrder?.reason || 'N/A';

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
        <View style={styles.actionRequiredBadge}>
          <Ionicons name="hourglass-outline" size={12} color="#d97706" />
          <Text style={styles.actionRequiredText}>Action Required</Text>
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
              <Text style={[styles.bannerTitle, textStyle]}>Buyer requested to cancel this order</Text>
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
                <View style={styles.requestedBadge}>
                  <Text style={styles.requestedBadgeText}>Cancellation Requested</Text>
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
                <Ionicons name="person-outline" size={20} color="#9ca3af" style={styles.detailIcon} />
                <View>
                  <Text style={[styles.detailLabel, mutedTextStyle]}>Requested by</Text>
                  <Text style={[styles.detailValue, textStyle]}>Buyer</Text>
                  <Text style={[styles.detailSubValue, mutedTextStyle]}>@{buyerName}</Text>
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
              <View>
                <Text style={[styles.detailLabel, mutedTextStyle]}>Cancellation agreed by</Text>
                <Text style={[styles.detailValue, { color: '#d97706' }]}>Pending seller confirmation</Text>
              </View>
            </View>
          </View>

          {viewType === 'seller' && (
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
