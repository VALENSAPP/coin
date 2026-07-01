import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import {
  getMyClosetItems,
  postAddress,
  getAddress,
  updateAddress,
  deleteAddress,
  makeAddressDefault,
  addCartItem,
  getCart,
  updateCartItem,
  deleteCartItem,
  clearCart,
  checkoutCart,
} from '../../services/myCloset';
import { useAppTheme } from '../../theme/useApptheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 12;
const GRID_ITEM_WIDTH = (SCREEN_WIDTH - 48) / 2;
const HERO_IMAGE_WIDTH = SCREEN_WIDTH - 40;
const MUTED = '#6b7280';
const BORDER = '#ebe4f3';
const SURFACE = '#fbf8ff';
const ERROR_COLOR = '#dc2626';
const ERROR_BG = '#fff5f5';

const currency = value => {
  if (value == null || value === '') return '$0.00';
  const text = String(value).trim();
  if (text.startsWith('$')) return text;
  const numeric = Number(text);
  return Number.isNaN(numeric) ? text : `$${numeric.toFixed(2)}`;
};

const numberFromPrice = value => {
  const numeric = Number(String(value ?? 0).replace(/[^0-9.]/g, ''));
  return Number.isNaN(numeric) ? 0 : numeric;
};

const imageUri = image => {
  if (!image) return null;
  if (typeof image === 'string') return image;
  return image?.uri || image?.url || image?.path || null;
};

const itemImages = item => {
  const images = Array.isArray(item?.images)
    ? item.images.map(imageUri).filter(Boolean)
    : [];
  const fallback = imageUri(item?.image) || imageUri(item?.thumbnail);
  return images.length ? images : fallback ? [fallback] : [];
};

const itemImage = item => itemImages(item)[0] || null;

const prefetchImageUrls = async items => {
  const urls = (Array.isArray(items) ? items : [])
    .flatMap(item => item?.images || (item?.image ? [item.image] : []))
    .map(imageUri)
    .filter(Boolean);
  if (!urls.length) return;
  await Promise.allSettled([...new Set(urls)].map(url => Image.prefetch(url)));
};

const normalizeItem = (item = {}, index = 0) => ({
  id: String(item?.id || item?._id || `item-${index}`),
  raw: item,
  name: item?.name || item?.title || item?.itemName || 'Untitled item',
  price: currency(item?.price ?? item?.amount ?? item?.salePrice),
  priceValue: numberFromPrice(item?.price ?? item?.amount ?? item?.salePrice),
  image: itemImage(item),
  images: itemImages(item),
  brand: item?.brand || 'Valens Closet',
  category: item?.category || 'Accessories',
  condition: item?.condition || 'Like new',
  description:
    item?.description ||
    'Authentic closet item in excellent condition. Worn only a few times and ready for a new home.',
  quantityAvailable: Number(item?.quantity || item?.availableQuantity || 1) || 1,
  sellerName: item?.sellerName || item?.userName || item?.ownerName || '',
});

const normalizeItems = items =>
  (Array.isArray(items) ? items : []).map((item, index) => normalizeItem(item, index));

const getRouteItems = route =>
  normalizeItems(route?.params?.items || route?.params?.initialItems || []);

const buildCart = (route, overrides = {}) => {
  const item = normalizeItem(route?.params?.item || {}, 0);
  const quantity = Number(route?.params?.quantity || 1) || 1;
  const shipping = Number(route?.params?.shipping ?? 10);
  const serviceFee = Number(route?.params?.serviceFee ?? 5);
  const itemTotal = item.priceValue * quantity;
  return {
    item,
    quantity,
    note: route?.params?.note || '',
    seller: route?.params?.seller || {},
    items: route?.params?.items || [],
    shipping,
    serviceFee,
    itemTotal,
    total: itemTotal /*+ shipping + serviceFee*/,
    ...overrides,
  };
};

const goBack = navigation => {
  if (navigation.canGoBack?.()) navigation.goBack();
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI atoms
// ─────────────────────────────────────────────────────────────────────────────

const Header = ({ navigation, title, rightIcon, onRightPress }) => (
  <View style={styles.header}>
    <TouchableOpacity
      onPress={() => goBack(navigation)}
      style={styles.iconButton}
      activeOpacity={0.8}
    >
      <Ionicons name="chevron-back" size={22} color="#17072d" />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>{title}</Text>
    {rightIcon ? (
      <TouchableOpacity onPress={onRightPress} style={styles.iconButton} activeOpacity={0.8}>
        <Ionicons name={rightIcon} size={21} color="#17072d" />
      </TouchableOpacity>
    ) : (
      <View style={styles.iconButton} />
    )}
  </View>
);

const BottomButton = ({ label, onPress, icon }) => {
  const { text } = useAppTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.bottomButton, { backgroundColor: text }]}
    >
      {icon ? <Ionicons name={icon} size={16} color="#fff" style={styles.buttonIcon} /> : null}
      <Text style={styles.bottomButtonText}>{label}</Text>
    </TouchableOpacity>
  );
};

const ImageBox = ({ uri, style, iconSize = 34 }) => (
  <View style={[styles.imageBox, style]}>
    {uri ? (
      <Image
        source={{ uri }}
        style={styles.coverImage}
        fadeDuration={200}
        resizeMode="cover"
      />
    ) : (
      <Ionicons name="shirt-outline" size={iconSize} color="#9b8c7a" />
    )}
  </View>
);

const DetailImageCarousel = ({ images }) => {
  const { text } = useAppTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const galleryImages = images.length ? images : [null];

  const onScrollEnd = event => {
    const nextIndex = Math.round(
      event.nativeEvent.contentOffset.x / HERO_IMAGE_WIDTH,
    );
    setActiveIndex(Math.max(0, Math.min(nextIndex, galleryImages.length - 1)));
  };

  return (
    <View>
      <FlatList
        data={galleryImages}
        keyExtractor={(uri, index) => `${uri || 'placeholder'}-${index}`}
        renderItem={({ item }) => (
          <ImageBox uri={item} style={styles.heroImage} iconSize={64} />
        )}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={galleryImages.length > 1}
        onMomentumScrollEnd={onScrollEnd}
        initialNumToRender={1}
        windowSize={3}
        removeClippedSubviews={false}
        getItemLayout={(_, index) => ({
          length: HERO_IMAGE_WIDTH,
          offset: HERO_IMAGE_WIDTH * index,
          index,
        })}
      />
      {galleryImages.length > 1 ? (
        <View style={styles.photoDots}>
          {galleryImages.map((_, index) => (
            <View
              key={index}
              style={[styles.photoDot, index === activeIndex && { backgroundColor: text }]}
            />
          ))}
        </View>
      ) : (
        <View style={styles.photoDotsSpacer} />
      )}
    </View>
  );
};

const SummaryRow = ({ label, value, bold }) => {
  const { text } = useAppTheme();
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && styles.summaryStrong]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && styles.summaryTotal, bold && { color: text }]}>
        {value}
      </Text>
    </View>
  );
};

const CheckoutSteps = ({ current }) => {
  const { text } = useAppTheme();
  const steps = ['Cart', 'Shipping', 'Payment', 'Review'];
  return (
    <View style={styles.stepsWrap}>
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <React.Fragment key={step}>
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  (done || active) && { backgroundColor: text, borderColor: text },
                ]}
              >
                {done ? (
                  <Ionicons name="checkmark" size={12} color="#fff" />
                ) : (
                  <Text style={[styles.stepNumber, (done || active) && styles.stepNumberActive]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text style={[styles.stepLabel, active && { color: text }]}>{step}</Text>
            </View>
            {index < steps.length - 1 && (
              <View
                style={[
                  styles.stepConnector,
                  index < current && { backgroundColor: text },
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const SellerCard = ({ seller }) => {
  const { text } = useAppTheme();
  return (
    <View style={styles.sellerCard}>
      <View style={[styles.sellerAvatar, { backgroundColor: text }]}>
        {seller?.image ? (
          <Image source={{ uri: seller.image }} style={styles.coverImage} />
        ) : (
          <Ionicons name="person" size={20} color="#fff" />
        )}
      </View>
      <View style={styles.sellerCopy}>
        <Text style={styles.sellerName}>
          {seller?.displayName || seller?.userName || 'Closet seller'}
        </Text>
        <Text style={styles.sellerMeta}>Active 2h ago</Text>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={12} color="#f59e0b" />
          <Text style={styles.ratingText}>4.8 (32)</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#17072d" />
    </View>
  );
};

const OrderSummary = ({ cart, editable, compact, onEditCart }) => {
  const { text } = useAppTheme();
  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>Order Summary</Text>
        {editable ? (
          <TouchableOpacity activeOpacity={0.8} onPress={onEditCart}>
            <Text style={[styles.editText, { color: text }]}>Edit Cart</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.summaryItemRow}>
        <ImageBox uri={cart.item.image} style={styles.summaryThumb} iconSize={22} />
        <View style={styles.summaryItemCopy}>
          <Text style={styles.summaryItemName} numberOfLines={2}>
            {cart.item.name}
          </Text>
          <Text style={[styles.summaryItemPrice, { color: text }]}>{cart.item.price}</Text>
          <Text style={styles.summaryItemQty}>Qty: {cart.quantity}</Text>
        </View>
      </View>
      <View style={styles.divider} />
      <SummaryRow label="Item total" value={currency(cart.itemTotal)} />
      {/* <SummaryRow label="Shipping" value={currency(cart.shipping)} />
      <SummaryRow label="Service fee" value={currency(cart.serviceFee)} /> */}
      <SummaryRow label="Total" value={currency(cart.total)} bold />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Field validation rules
// ─────────────────────────────────────────────────────────────────────────────
const FIELD_RULES = {
  fullName: { required: true, label: 'Full Name' },
  phoneNumber: { required: true, label: 'Phone Number', pattern: /^[+\d\s\-()]{7,20}$/, patternMsg: 'Enter a valid phone number' },
  alternateNumber: { required: false, label: 'Alternate Number', pattern: /^[+\d\s\-()]{7,20}$/, patternMsg: 'Enter a valid phone number' },
  addressLine1: { required: true, label: 'Address Line 1' },
  addressLine2: { required: false, label: 'Address Line 2' },
  city: { required: true, label: 'City' },
  state: { required: false, label: 'State / Province' },
  country: { required: false, label: 'Country' },
  postalCode: { required: false, label: 'Postal Code', pattern: /^\d{3,10}$/, patternMsg: 'Enter a valid postal code' },
};

const validateField = (key, value) => {
  const rule = FIELD_RULES[key];
  if (!rule) return null;
  const trimmed = String(value ?? '').trim();
  if (rule.required && !trimmed) return `${rule.label} is required`;
  if (trimmed && rule.pattern && !rule.pattern.test(trimmed)) return rule.patternMsg;
  return null;
};

const validateForm = form => {
  const errors = {};
  Object.keys(FIELD_RULES).forEach(key => {
    const err = validateField(key, form[key]);
    if (err) errors[key] = err;
  });
  return errors;
};

// ─────────────────────────────────────────────────────────────────────────────
// Field component with inline red validation
// ─────────────────────────────────────────────────────────────────────────────
const Field = ({ label, fieldKey, placeholder, keyboardType, value, onChangeText, error, onBlur }) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.fieldInput, error ? styles.fieldInputError : null]}
      value={value}
      onChangeText={onChangeText}
      onBlur={onBlur}
      placeholder={placeholder || label}
      placeholderTextColor="#a8a0b3"
      keyboardType={keyboardType || 'default'}
      autoCapitalize="words"
    />
    {error ? (
      <View style={styles.fieldErrorRow}>
        <Ionicons name="alert-circle" size={13} color={ERROR_COLOR} />
        <Text style={styles.fieldErrorText}>{error}</Text>
      </View>
    ) : null}
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// AddAddressModal — handles both ADD (POST) and EDIT (PATCH) modes
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_ADDRESS = {
  fullName: '',
  phoneNumber: '',
  alternateNumber: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
  isDefault: false,
};

// editAddress prop: if passed, modal opens in edit mode pre-filled with that address
const AddAddressModal = ({ visible, onClose, onSaved, editAddress }) => {
  const { text } = useAppTheme();
  const isEdit = !!editAddress;

  const [form, setForm] = useState(EMPTY_ADDRESS);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);

  // Pre-fill form when opening in edit mode
  useEffect(() => {
    if (visible && editAddress) {
      setForm({
        fullName: editAddress.fullName || '',
        phoneNumber: editAddress.phoneNumber || '',
        alternateNumber: editAddress.alternateNumber || '',
        addressLine1: editAddress.addressLine1 || '',
        addressLine2: editAddress.addressLine2 || '',
        city: editAddress.city || '',
        state: editAddress.state || '',
        country: editAddress.country || '',
        postalCode: editAddress.postalCode || '',
        isDefault: editAddress.isDefault || false,
      });
    }
    if (visible && !editAddress) {
      setForm(EMPTY_ADDRESS);
    }
    setErrors({});
    setTouched({});
  }, [visible, editAddress]);

  const set = useCallback((key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (touched[key]) {
      const err = validateField(key, value);
      setErrors(prev => ({ ...prev, [key]: err }));
    }
  }, [touched]);

  const handleBlur = useCallback(key => {
    setTouched(prev => ({ ...prev, [key]: true }));
    const err = validateField(key, form[key]);
    setErrors(prev => ({ ...prev, [key]: err }));
  }, [form]);

  const handleSave = async () => {
    const allTouched = Object.keys(FIELD_RULES).reduce((acc, k) => ({ ...acc, [k]: true }), {});
    setTouched(allTouched);
    const allErrors = validateForm(form);
    setErrors(allErrors);
    if (Object.keys(allErrors).length > 0) return;

    setSaving(true);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        alternateNumber: form.alternateNumber.trim(),
        addressLine1: form.addressLine1.trim(),
        addressLine2: form.addressLine2.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        country: form.country.trim(),
        postalCode: form.postalCode.trim(),
        isDefault: form.isDefault,
      };
      if (isEdit) {
        // PATCH /address/updateAddress/{addressId}
        await updateAddress(editAddress.id, payload);
        onSaved?.({ ...payload, id: editAddress.id });
      } else {
        // POST /address/addAddress
        await postAddress(payload);
        onSaved?.(payload);
      }
      setForm(EMPTY_ADDRESS);
      setErrors({});
      setTouched({});
      onClose();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not save address. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setForm(EMPTY_ADDRESS);
    setErrors({});
    setTouched({});
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={handleClose} style={styles.iconButton}>
            <Ionicons name="close" size={22} color="#17072d" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEdit ? 'Edit Address' : 'New Address'}</Text>
          <View style={styles.iconButton} />
        </View>
        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <Field label="Full Name *" fieldKey="fullName" placeholder="John Doe"
            value={form.fullName} onChangeText={v => set('fullName', v)}
            onBlur={() => handleBlur('fullName')} error={errors.fullName} />
          <Field label="Phone Number *" fieldKey="phoneNumber" placeholder="+1 555 000 0000"
            keyboardType="phone-pad" value={form.phoneNumber} onChangeText={v => set('phoneNumber', v)}
            onBlur={() => handleBlur('phoneNumber')} error={errors.phoneNumber} />
          <Field label="Alternate Number" fieldKey="alternateNumber"
            keyboardType="phone-pad" value={form.alternateNumber} onChangeText={v => set('alternateNumber', v)}
            onBlur={() => handleBlur('alternateNumber')} error={errors.alternateNumber} />
          <Field label="Address Line 1 *" fieldKey="addressLine1" placeholder="123 Main Street"
            value={form.addressLine1} onChangeText={v => set('addressLine1', v)}
            onBlur={() => handleBlur('addressLine1')} error={errors.addressLine1} />
          <Field label="Address Line 2" fieldKey="addressLine2" placeholder="Apt, Suite, Floor…"
            value={form.addressLine2} onChangeText={v => set('addressLine2', v)}
            onBlur={() => handleBlur('addressLine2')} error={errors.addressLine2} />
          <Field label="City *" fieldKey="city" placeholder="New York"
            value={form.city} onChangeText={v => set('city', v)}
            onBlur={() => handleBlur('city')} error={errors.city} />
          <Field label="State / Province" fieldKey="state" placeholder="NY"
            value={form.state} onChangeText={v => set('state', v)}
            onBlur={() => handleBlur('state')} error={errors.state} />
          <Field label="Country" fieldKey="country" placeholder="United States"
            value={form.country} onChangeText={v => set('country', v)}
            onBlur={() => handleBlur('country')} error={errors.country} />
          <Field label="Postal Code" fieldKey="postalCode" placeholder="10001"
            keyboardType="numeric" value={form.postalCode} onChangeText={v => set('postalCode', v)}
            onBlur={() => handleBlur('postalCode')} error={errors.postalCode} />

          <TouchableOpacity
            style={styles.defaultRow}
            activeOpacity={0.8}
            onPress={() => set('isDefault', !form.isDefault)}
          >
            <Ionicons
              name={form.isDefault ? 'checkbox' : 'square-outline'}
              size={20}
              color={text}
            />
            <Text style={styles.defaultLabel}>Set as default address</Text>
          </TouchableOpacity>
        </ScrollView>
        <View style={styles.bottomBar}>
          <BottomButton
            label={saving ? 'Saving…' : isEdit ? 'Update Address' : 'Save Address'}
            onPress={saving ? undefined : handleSave}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Screens
// ─────────────────────────────────────────────────────────────────────────────

const MyClosetBuyerItemsScreen = ({ navigation, route }) => {
  const { bgStyle, text } = useAppTheme(route?.params?.seller?.profile);
  const [items, setItems] = useState(() => getRouteItems(route));
  const [loading, setLoading] = useState(false);
  const seller = useMemo(() => route?.params?.seller || {}, [route?.params?.seller]);
  const sellerId = route?.params?.sellerId || seller?.id;
  const accent = text;

  const loadItems = useCallback(async () => {
    if (items.length) return;
    setLoading(true);
    try {
      const response = await getMyClosetItems(sellerId);
      const payload =
        response?.data?.data ?? response?.data?.items ?? response?.data ?? response;
      const nextItems = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
      const normalized = normalizeItems(nextItems);
      prefetchImageUrls(nextItems);
      setItems(normalized);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [items.length, sellerId]);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems]),
  );

  const openItem = useCallback(
    item => {
      navigation.navigate('MyClosetBuyerItemDetail', {
        item: item.raw || item,
        seller,
        sellerId,
        items: route?.params?.items || items.map(row => row.raw || row),
        isOwnProfile: route?.params?.isOwnProfile,
      });
    },
    [items, navigation, route?.params?.items, seller, sellerId],
  );

  const renderItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.88}
      style={styles.gridCard}
      onPress={() => openItem(item)}
    >
      <ImageBox uri={item.image} style={styles.gridImage} />
      <Text style={styles.gridTitle} numberOfLines={2}>
        {item.name}
      </Text>
      <Text style={[styles.gridPrice, { color: accent }]}>{item.price}</Text>
      <Text style={styles.gridMeta} numberOfLines={1}>
        {item.condition}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <Header navigation={navigation} title="My Closet" />
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={accent} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews
          ListHeaderComponent={(
            <View style={styles.listIntro}>
              <Text style={styles.listTitle}>
                {seller?.displayName || seller?.userName || 'Closet'} items
              </Text>
              <Text style={styles.listSubtitle}>
                {items.length} item{items.length === 1 ? '' : 's'} available
              </Text>
            </View>
          )}
          ListEmptyComponent={(
            <View style={styles.emptyState}>
              <Ionicons name="shirt-outline" size={34} color="#c4b5d4" />
              <Text style={styles.emptyTitle}>No items available</Text>
              <Text style={styles.emptyText}>
                This closet does not have any listed items yet.
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

const MyClosetBuyerItemDetailScreen = ({ navigation, route }) => {
  const { text, bgStyle } = useAppTheme();
  const item = normalizeItem(route?.params?.item || {}, 0);
  const seller = route?.params?.seller || {};
  const isOwnProfile = route?.params?.isOwnProfile ?? false;
  const [liked, setLiked] = useState(false);

  const goOptions = () => {
    navigation.navigate('MyClosetBuyerOptions', {
      item: item.raw,
      seller,
      sellerId: route?.params?.sellerId,
      items: route?.params?.items || [],
    });
  };

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <Header
        navigation={navigation}
        title="My Closet"
        rightIcon={liked ? 'heart' : 'heart-outline'}
        onRightPress={() => setLiked(prev => !prev)}
      />
      <ScrollView
        contentContainerStyle={styles.detailContent}
        showsVerticalScrollIndicator={false}
      >
        <DetailImageCarousel images={item.images} />
        <Text style={styles.detailName}>{item.name}</Text>
        <Text style={[styles.detailPrice, { color: text }]}>{item.price}</Text>
        <SellerCard seller={seller} />
        <Text style={styles.sectionLabel}>Description</Text>
        <Text style={styles.description}>{item.description}</Text>
        <View style={styles.attributeList}>
          {[
            { icon: 'shield-checkmark-outline', label: 'Condition', value: item.condition },
            { icon: 'pricetag-outline', label: 'Brand', value: item.brand },
            { icon: 'albums-outline', label: 'Category', value: item.category },
          ].map(attr => (
            <View key={attr.label} style={styles.attributeRow}>
              <Ionicons name={attr.icon} size={15} color={text} />
              <Text style={styles.attributeLabel}>{attr.label}</Text>
              <Text style={styles.attributeValue}>{attr.value}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      {!isOwnProfile && (
        <View style={styles.bottomBar}>
          <BottomButton label="Buy Now" onPress={goOptions} />
        </View>
      )}
    </SafeAreaView>
  );
};

const MyClosetBuyerOptionsScreen = ({ navigation, route }) => {
  const { text } = useAppTheme();
  const item = normalizeItem(route?.params?.item || {}, 0);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);
  const [syncingQty, setSyncingQty] = useState(false);
  const available = Math.max(1, item.quantityAvailable);

  const productId = item.raw?.id || item.raw?._id || item.id;

  useFocusEffect(
    useCallback(() => {
      if (!productId) return;
      let cancelled = false;
      (async () => {
        setSyncingQty(true);
        try {
          const response = await getCart();
          if (cancelled) return;
          const cartObj = response?.data?.cart;
          const cartItems = cartObj?.cartItems ?? [];
          const match = Array.isArray(cartItems)
            ? cartItems.find(ci => {
              const pid = ci?.product?.id || ci?.product?._id || ci?.productId;
              return String(pid) === String(productId);
            })
            : null;
          if (match) {
            setQuantity(Math.max(1, Math.min(available, Number(match.quantity) || 1)));
          }
        } catch {
          // silently ignore — keep whatever quantity was set
        } finally {
          if (!cancelled) setSyncingQty(false);
        }
      })();
      return () => { cancelled = true; };
    }, [productId, available]),
  );

  const updateQuantity = delta => {
    setQuantity(prev => Math.min(available, Math.max(1, prev + delta)));
  };

  // ── POST /cart/items — add item to server cart ───────────────────────────
  const goCart = async () => {
    if (!productId) {
      navigation.navigate('MyClosetBuyerCart', {
        item: item.raw,
        seller: route?.params?.seller || {},
        sellerId: route?.params?.sellerId,
        items: route?.params?.items || [],
        quantity,
        note,
      });
      return;
    }
    setAdding(true);
    try {
      await addCartItem({ productId, quantity });
    } catch (err) {
      setAdding(false);
      Alert.alert('Error', err?.response?.data?.message || 'Could not add item to cart.');
      return;
    } finally {
      setAdding(false);
    }
    navigation.navigate('MyClosetBuyerCart', {
      item: item.raw,
      seller: route?.params?.seller || {},
      sellerId: route?.params?.sellerId,
      items: route?.params?.items || [],
      quantity,
      note,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        navigation={navigation}
        title="Select Options"
        rightIcon="close"
        onRightPress={() => goBack(navigation)}
      />
      <ScrollView
        contentContainerStyle={styles.formContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.optionProductRow}>
          <ImageBox uri={item.image} style={styles.optionThumb} iconSize={22} />
          <View>
            <Text style={styles.optionName}>{item.name}</Text>
            <Text style={styles.optionPrice}>{item.price}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Quantity</Text>
        <Text style={styles.helperText}>How many would you like?</Text>
        <View style={styles.quantityBox}>
          <TouchableOpacity
            style={styles.qtyButton}
            onPress={() => updateQuantity(-1)}
            activeOpacity={0.8}
            disabled={adding || syncingQty}
          >
            <Ionicons name="remove" size={17} color={text} />
          </TouchableOpacity>
          {syncingQty ? (
            <ActivityIndicator size="small" color={text} />
          ) : (
            <Text style={styles.quantityText}>{quantity}</Text>
          )}
          <TouchableOpacity
            style={styles.qtyButton}
            onPress={() => updateQuantity(1)}
            activeOpacity={0.8}
            disabled={adding || syncingQty}
          >
            <Ionicons name="add" size={17} color={text} />
          </TouchableOpacity>
        </View>
        <Text style={styles.availabilityText}>Only {available} available</Text>

        <Text style={styles.sectionLabel}>Add a note (optional)</Text>
        <View style={styles.noteBox}>
          <TextInput
            value={note}
            onChangeText={setNote}
            maxLength={100}
            multiline
            placeholder="e.g. gift wrap, message to seller..."
            placeholderTextColor="#a8a0b3"
            style={styles.noteInput}
            editable={!adding && !syncingQty}
          />
          <Text style={styles.counterText}>{note.length}/100</Text>
        </View>
      </ScrollView>
      <View style={styles.bottomBar}>
        <BottomButton
          label={adding ? 'Adding…' : syncingQty ? 'Loading…' : 'Add to Cart'}
          onPress={(adding || syncingQty) ? undefined : goCart}
        />
      </View>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Cart screen — GET /cart on mount, PATCH quantity, DELETE item, DELETE /cart
// ─────────────────────────────────────────────────────────────────────────────
const MyClosetBuyerCartScreen = ({ navigation, route }) => {
  const { text } = useAppTheme();
  const localCart = buildCart(route); // fallback data from route params

  // ── Server cart state ───────────────────────────────────────────────────
  const [cartItems, setCartItems] = useState([]); // array of items from GET /cart
  const [cartLoading, setCartLoading] = useState(true);
  const [cartError, setCartError] = useState(null);

  // Per-item action loading (cartItemId being updated/deleted)
  const [itemActionLoading, setItemActionLoading] = useState(null);
  const [clearingCart, setClearingCart] = useState(false);

  // ── GET /cart ─────────────────────────────────────────────────────────
  const fetchCart = useCallback(async () => {
    setCartLoading(true);
    setCartError(null);
    try {
      const response = await getCart();
      const cartObj = response?.data?.cart;
      const items = cartObj?.cartItems ?? [];
      setCartItems(Array.isArray(items) ? items : []);
    } catch (err) {
      setCartError('Could not load cart. Please try again.');
    } finally {
      setCartLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCart();
    }, [fetchCart]),
  );

  // ── PATCH /cart/items/{cartItemId} — update quantity ──────────────────
  const handleQtyChange = async (cartItemId, delta, currentQty, maxQty) => {
    // If already at 1 and decrementing → remove the item and go back if cart becomes empty
    if (delta === -1 && currentQty === 1) {
      const targetItem = cartItems.find(ci => ci.id === cartItemId);
      const name = targetItem?.product?.name || targetItem?.name || 'this item';
      Alert.alert(
        'Remove item',
        `Remove "${name}" from cart?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              setItemActionLoading(cartItemId);
              try {
                await deleteCartItem(cartItemId);
                const remaining = cartItems.filter(ci => ci.id !== cartItemId);
                setCartItems(remaining);
                if (remaining.length === 0) {
                  goBack(navigation);
                }
              } catch (err) {
                Alert.alert('Error', err?.response?.data?.message || 'Could not remove item.');
              } finally {
                setItemActionLoading(null);
              }
            },
          },
        ],
      );
      return;
    }

    const nextQty = Math.min(maxQty, Math.max(1, currentQty + delta));
    if (nextQty === currentQty) return;

    // Optimistic update
    setCartItems(prev =>
      prev.map(ci => (ci.id === cartItemId ? { ...ci, quantity: nextQty } : ci)),
    );
    setItemActionLoading(cartItemId);
    try {
      await updateCartItem(cartItemId, { quantity: nextQty });
    } catch (err) {
      // Revert on failure
      setCartItems(prev =>
        prev.map(ci => (ci.id === cartItemId ? { ...ci, quantity: currentQty } : ci)),
      );
      Alert.alert('Error', err?.response?.data?.message || 'Could not update quantity.');
    } finally {
      setItemActionLoading(null);
    }
  };

  // ── DELETE /cart/items/{cartItemId} — remove single item ─────────────
  const handleRemoveItem = cartItem => {
    const name = cartItem?.product?.name || cartItem?.name || 'this item';
    Alert.alert(
      'Remove item',
      `Remove "${name}" from cart?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setItemActionLoading(cartItem.id);
            try {
              await deleteCartItem(cartItem.id);
              setCartItems(prev => prev.filter(ci => ci.id !== cartItem.id));
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.message || 'Could not remove item.');
            } finally {
              setItemActionLoading(null);
            }
          },
        },
      ],
    );
  };

  // ── DELETE /cart — clear entire cart ─────────────────────────────────
  const handleClearCart = () => {
    Alert.alert(
      'Clear Cart',
      'Remove all items from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setClearingCart(true);
            try {
              await clearCart();
              setCartItems([]);
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.message || 'Could not clear cart.');
            } finally {
              setClearingCart(false);
            }
          },
        },
      ],
    );
  };

  // ── Totals computed from server cart ──────────────────────────────────
  const computedItemTotal = cartItems.reduce((sum, ci) => {
    const price = ci?.product?.price ?? ci?.price ?? localCart.item.priceValue;
    return sum + price * (ci.quantity || 1);
  }, 0);
  const shipping = localCart.shipping;
  const serviceFee = localCart.serviceFee;
  const total = computedItemTotal /* + shipping + serviceFee*/;

  const handleProceed = () => {
    navigation.navigate('MyClosetBuyerCheckout', {
      ...route.params,
      itemTotal: computedItemTotal,
      total,
    });
  };

  const isEmpty = !cartLoading && cartItems.length === 0;

  // ── Helper: resolve image + name from a cart item ────────────────────
  const cartItemImage = ci => imageUri(ci?.product?.images?.[0]) || imageUri(ci?.product?.image) || imageUri(ci?.image) || null;
  const cartItemName = ci => ci?.product?.name || ci?.product?.title || ci?.name || 'Item';
  const cartItemPrice = ci => currency(ci?.product?.price ?? ci?.price ?? 0);
  const cartItemMax = ci => Number(ci?.product?.quantity || ci?.product?.availableQuantity || 99) || 99;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        navigation={navigation}
        title={cartLoading ? 'Cart' : `Cart (${cartItems.length})`}
        rightIcon={cartItems.length > 0 ? 'trash-outline' : undefined}
        onRightPress={handleClearCart}
      />

      {cartLoading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={text} />
        </View>
      ) : cartError ? (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={36} color={ERROR_COLOR} />
          <Text style={styles.emptyTitle}>Couldn't load cart</Text>
          <Text style={styles.emptyText}>{cartError}</Text>
          <TouchableOpacity onPress={fetchCart} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.checkoutContent}
          showsVerticalScrollIndicator={false}
        >
          {isEmpty ? (
            <View style={styles.emptyState}>
              <Ionicons name="cart-outline" size={40} color="#c4b5d4" />
              <Text style={styles.emptyTitle}>Your cart is empty</Text>
              <Text style={styles.emptyText}>Items you add will appear here.</Text>
            </View>
          ) : (
            <>
              {clearingCart ? (
                <View style={styles.cartClearingBanner}>
                  <ActivityIndicator size="small" color={text} />
                  <Text style={[styles.cartClearingText, { color: text }]}>Clearing cart…</Text>
                </View>
              ) : null}

              {cartItems.map(ci => {
                const isActing = itemActionLoading === ci.id;
                const qty = ci.quantity || 1;
                const maxQty = cartItemMax(ci);
                return (
                  <View key={ci.id} style={styles.cartLineCard}>
                    <ImageBox uri={cartItemImage(ci)} style={styles.cartThumb} iconSize={22} />
                    <View style={styles.cartCopy}>
                      <Text style={styles.cartItemName} numberOfLines={2}>
                        {cartItemName(ci)}
                      </Text>
                      <Text style={[styles.cartPrice, { color: text }]}>{cartItemPrice(ci)}</Text>
                      {/* Inline quantity editor → PATCH /cart/items/{cartItemId} */}
                      <View style={styles.cartQtyRow}>
                        <TouchableOpacity
                          style={[styles.cartQtyBtn, isActing && styles.cartQtyBtnDisabled]}
                          onPress={() => handleQtyChange(ci.id, -1, qty, maxQty)}
                          activeOpacity={0.8}
                          disabled={isActing}
                        >
                          <Ionicons name="remove" size={14} color={text} />
                        </TouchableOpacity>
                        {isActing ? (
                          <ActivityIndicator size="small" color={text} style={{ minWidth: 18 }} />
                        ) : (
                          <Text style={styles.cartQtyText}>{qty}</Text>
                        )}
                        <TouchableOpacity
                          style={[styles.cartQtyBtn, isActing && styles.cartQtyBtnDisabled]}
                          onPress={() => handleQtyChange(ci.id, +1, qty, maxQty)}
                          activeOpacity={0.8}
                          disabled={isActing}
                        >
                          <Ionicons name="add" size={14} color={text} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {/* DELETE /cart/items/{cartItemId} */}
                    <TouchableOpacity
                      onPress={() => handleRemoveItem(ci)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      activeOpacity={0.7}
                      disabled={isActing}
                    >
                      <Ionicons name="trash-outline" size={20} color="#8b5e9f" />
                    </TouchableOpacity>
                  </View>
                );
              })}

              <View style={styles.summaryBlock}>
                <SummaryRow label="Item total" value={currency(computedItemTotal)} />
                {/* <SummaryRow label="Shipping" value={currency(shipping)} />
                <SummaryRow label="Service fee" value={currency(serviceFee)} /> */}
                <SummaryRow label="Total" value={currency(total)} bold />
              </View>

              <View style={styles.protectionCard}>
                <View style={styles.protectionIcon}>
                  <Ionicons name="shield-checkmark-outline" size={24} color={text} />
                </View>
                <Text style={[styles.protectionText, { color: text }]}>
                  You're protected with Valens Purchase Protection
                </Text>
                <Ionicons name="information-circle-outline" size={16} color="#8b5e9f" />
              </View>
            </>
          )}
        </ScrollView>
      )}

      {!isEmpty && !cartLoading && !cartError && (
        <View style={styles.bottomBar}>
          <BottomButton label="Proceed to Checkout" onPress={handleProceed} />
        </View>
      )}
    </SafeAreaView>
  );
};

const MyClosetBuyerCheckoutScreen = ({ navigation, route }) => {
  const cart = buildCart(route);

  const handleEditCart = () => {
    navigation.navigate('MyClosetBuyerCart', route.params);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header navigation={navigation} title="Checkout" />
      <ScrollView
        contentContainerStyle={styles.checkoutContent}
        showsVerticalScrollIndicator={false}
      >
        <CheckoutSteps current={0} />
        <OrderSummary cart={cart} editable onEditCart={handleEditCart} />
      </ScrollView>
      <View style={styles.bottomBar}>
        <BottomButton
          label="Continue to Shipping"
          onPress={() => navigation.navigate('MyClosetBuyerShipping', route.params)}
        />
      </View>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Shipping screen — fetches real addresses from GET /address/getAddress
// ─────────────────────────────────────────────────────────────────────────────
const MyClosetBuyerShippingScreen = ({ navigation, route }) => {
  const { text } = useAppTheme();
  const cart = buildCart(route);
  const [method, setMethod] = useState('standard');
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null); // address being edited

  // Real address list from API
  const [addresses, setAddresses] = useState([]);
  const [addressLoading, setAddressLoading] = useState(true);
  const [addressError, setAddressError] = useState(null);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState(0);
  const [actionLoading, setActionLoading] = useState(null); // addressId being acted upon

  // ── Fetch addresses from GET /address/getAddress ────────────────────────
  const fetchAddresses = useCallback(async () => {
    setAddressLoading(true);
    setAddressError(null);
    try {
      const response = await getAddress();
      const list =
        response?.data?.data?.addresses ??
        response?.data?.addresses ??
        response?.addresses ??
        [];
      const arr = Array.isArray(list) ? list : [];
      setAddresses(arr);
      const defaultIdx = arr.findIndex(a => a.isDefault);
      setSelectedAddressIndex(defaultIdx >= 0 ? defaultIdx : 0);
    } catch (err) {
      setAddressError('Could not load addresses. Please try again.');
    } finally {
      setAddressLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  // ── ADD: optimistic add + re-fetch ────────────────────────────────────────
  const handleAddressSaved = newAddress => {
    setAddresses(prev => {
      const updated = [...prev, newAddress];
      setSelectedAddressIndex(updated.length - 1);
      return updated;
    });
    fetchAddresses();
  };

  // ── EDIT: open modal pre-filled ───────────────────────────────────────────
  const handleEdit = addr => {
    setEditingAddress(addr);
    setShowAddressModal(true);
  };

  // ── UPDATE: optimistic update after PATCH ─────────────────────────────────
  const handleAddressUpdated = updatedAddress => {
    setAddresses(prev =>
      prev.map(a => (a.id === updatedAddress.id ? { ...a, ...updatedAddress } : a)),
    );
    fetchAddresses();
  };

  // ── DELETE: PATCH /address/deleteAddress/{addressId} ──────────────────────
  const handleDelete = addr => {
    Alert.alert(
      'Delete Address',
      `Remove "${addr.fullName}" (${addr.addressLine1})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(addr.id);
            try {
              await deleteAddress(addr.id);
              setAddresses(prev => {
                const updated = prev.filter(a => a.id !== addr.id);
                setSelectedAddressIndex(Math.max(0, updated.findIndex(a => a.isDefault)));
                return updated;
              });
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.message || 'Could not delete address.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  };

  // ── MAKE DEFAULT: PATCH /address/makeAddressDefault/{addressId} ───────────
  const handleMakeDefault = async addr => {
    if (addr.isDefault) return; // already default
    setActionLoading(addr.id);
    try {
      await makeAddressDefault(addr.id);
      // Update local state: unset old default, set new one
      setAddresses(prev =>
        prev.map(a => ({ ...a, isDefault: a.id === addr.id })),
      );
      const newIdx = addresses.findIndex(a => a.id === addr.id);
      if (newIdx >= 0) setSelectedAddressIndex(newIdx);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not set default address.');
    } finally {
      setActionLoading(null);
    }
  };

  const selectedAddress = addresses[selectedAddressIndex] ?? null;

  const nextCart = {
    ...route.params,
    shipping: method === 'express' ? 20 : 10,
    total: cart.itemTotal /*+ (method === 'express' ? 20 : 10) + cart.serviceFee*/,
    shippingMethod: method,
    // Pass selected address forward so Review screen can display it
    shippingAddress: selectedAddress,
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header navigation={navigation} title="Shipping Information" />
      <ScrollView
        contentContainerStyle={styles.checkoutContent}
        showsVerticalScrollIndicator={false}
      >
        <CheckoutSteps current={1} />

        <Text style={styles.sectionLabel}>Shipping Address</Text>

        {/* ── Address list states ── */}
        {addressLoading ? (
          <View style={styles.addressLoader}>
            <ActivityIndicator size="small" color={text} />
            <Text style={styles.addressLoaderText}>Loading addresses…</Text>
          </View>
        ) : addressError ? (
          <View style={styles.addressErrorBox}>
            <Ionicons name="alert-circle-outline" size={18} color={ERROR_COLOR} />
            <Text style={styles.addressErrorText}>{addressError}</Text>
            <TouchableOpacity onPress={fetchAddresses} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : addresses.length === 0 ? (
          <View style={styles.noAddressBox}>
            <Ionicons name="location-outline" size={32} color="#c4b5d4" />
            <Text style={styles.noAddressTitle}>No saved addresses</Text>
            <Text style={styles.noAddressText}>Add an address to continue checkout.</Text>
          </View>
        ) : (
          addresses.map((addr, idx) => {
            const isSelected = selectedAddressIndex === idx;
            const isActing = actionLoading === addr.id;
            return (
              <View
                key={addr.id || idx}
                style={[
                  styles.addressCard,
                  isSelected && styles.addressCardSelected,
                  isSelected && { borderColor: text },
                ]}
              >
                {/* Tap row selects address */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setSelectedAddressIndex(idx)}
                  style={styles.addressCardContent}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.addressNameRow}>
                      <Text style={styles.addressName}>{addr.fullName}</Text>
                      {addr.isDefault ? (
                        <View style={styles.defaultBadge}>
                          <Text style={[styles.defaultBadgeText, { color: text }]}>Default</Text>
                        </View>
                      ) : null}
                    </View>
                    {addr.phoneNumber ? (
                      <Text style={styles.addressPhone}>{addr.phoneNumber}</Text>
                    ) : null}
                    <Text style={styles.addressText}>{addr.addressLine1}</Text>
                    {addr.addressLine2 ? (
                      <Text style={styles.addressText}>{addr.addressLine2}</Text>
                    ) : null}
                    <Text style={styles.addressText}>
                      {[addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')}
                    </Text>
                    {addr.country ? (
                      <Text style={styles.addressText}>{addr.country}</Text>
                    ) : null}
                  </View>
                  {isActing ? (
                    <ActivityIndicator size="small" color={text} style={{ marginLeft: 8 }} />
                  ) : (
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={text}
                    />
                  )}
                </TouchableOpacity>

                {/* Action row: Edit · Delete · Set Default */}
                <View style={styles.addressActionsRow}>
                  {/* Edit */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.addressActionBtn}
                    onPress={() => handleEdit(addr)}
                    disabled={isActing}
                  >
                    <Ionicons name="create-outline" size={14} color={text} />
                    <Text style={[styles.addressActionText, { color: text }]}>Edit</Text>
                  </TouchableOpacity>

                  <View style={styles.addressActionDivider} />

                  {/* Delete */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.addressActionBtn}
                    onPress={() => handleDelete(addr)}
                    disabled={isActing}
                  >
                    <Ionicons name="trash-outline" size={14} color={ERROR_COLOR} />
                    <Text style={[styles.addressActionText, { color: ERROR_COLOR }]}>Delete</Text>
                  </TouchableOpacity>

                  {/* Set as Default (hidden if already default) */}
                  {!addr.isDefault ? (
                    <>
                      <View style={styles.addressActionDivider} />
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={styles.addressActionBtn}
                        onPress={() => handleMakeDefault(addr)}
                        disabled={isActing}
                      >
                        <Ionicons name="star-outline" size={14} color="#f59e0b" />
                        <Text style={[styles.addressActionText, { color: '#b45309' }]}>
                          Set Default
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                </View>
              </View>
            );
          })
        )}

        {/* Add new address */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.addAddressButton}
          onPress={() => setShowAddressModal(true)}
        >
          <Ionicons name="add-circle-outline" size={18} color={text} />
          <Text style={[styles.addAddressText, { color: text }]}>Add new address</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Shipping Method</Text>
        {[
          { key: 'standard', label: 'Standard Shipping (3-5 days)', price: 10 },
          { key: 'express', label: 'Express Shipping (1-2 days)', price: 20 },
        ].map(option => (
          <TouchableOpacity
            key={option.key}
            activeOpacity={0.85}
            onPress={() => setMethod(option.key)}
            style={[
              styles.radioCard,
              method === option.key && styles.radioCardSelected,
              method === option.key && { borderColor: text },
            ]}
          >
            <Ionicons
              name={method === option.key ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={method === option.key ? text : '#c4b5d4'}
            />
            <Text style={styles.radioLabel}>{option.label}</Text>
            <Text style={styles.radioPrice}>{currency(option.price)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.bottomBar}>
        <BottomButton
          label="Continue to Payment"
          onPress={() => {
            if (!selectedAddress && addresses.length > 0) {
              Alert.alert('Select address', 'Please select a shipping address to continue.');
              return;
            }
            navigation.navigate('MyClosetBuyerPayment', nextCart);
          }}
        />
      </View>

      <AddAddressModal
        visible={showAddressModal}
        onClose={() => { setShowAddressModal(false); setEditingAddress(null); }}
        onSaved={editingAddress ? handleAddressUpdated : handleAddressSaved}
        editAddress={editingAddress}
      />
    </SafeAreaView>
  );
};

const MyClosetBuyerPaymentScreen = ({ navigation, route }) => {
  const { text } = useAppTheme();
  const cart = buildCart(route);
  const [paymentMethod, setPaymentMethod] = useState('secure');

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header navigation={navigation} title="Payment" />
      <ScrollView
        contentContainerStyle={styles.checkoutContent}
        showsVerticalScrollIndicator={false}
      >
        <CheckoutSteps current={2} />
        <Text style={styles.sectionLabel}>Payment Method</Text>
        {[
          { key: 'secure', label: 'Valens Secure Checkout', sub: 'Pay securely on Valens', icon: 'shield-checkmark-outline' },
          // { key: 'card', label: 'Credit / Debit Card', sub: 'VISA  Mastercard  AMEX', icon: 'card-outline' },
          // { key: 'apple', label: 'Apple Pay', sub: '', icon: 'logo-apple' },
        ].map(option => (
          <TouchableOpacity
            key={option.key}
            activeOpacity={0.85}
            onPress={() => setPaymentMethod(option.key)}
            style={[
              styles.paymentOption,
              paymentMethod === option.key && styles.radioCardSelected,
              paymentMethod === option.key && { borderColor: text },
            ]}
          >
            <Ionicons
              name={paymentMethod === option.key ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={paymentMethod === option.key ? text : '#c4b5d4'}
            />
            <View style={styles.paymentCopy}>
              <Text style={styles.radioLabel}>{option.label}</Text>
              {option.sub ? <Text style={styles.paymentSub}>{option.sub}</Text> : null}
            </View>
            <Ionicons name={option.icon} size={18} color={text} />
          </TouchableOpacity>
        ))}
        <OrderSummary cart={cart} compact />
      </ScrollView>
      <View style={styles.bottomBar}>
        <BottomButton
          label="Continue to Review"
          onPress={() =>
            navigation.navigate('MyClosetBuyerReview', { ...route.params, paymentMethod })
          }
        />
      </View>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Review screen — shows dynamically selected address instead of hardcoded one
// ─────────────────────────────────────────────────────────────────────────────
const MyClosetBuyerReviewScreen = ({ navigation, route }) => {
  const { text } = useAppTheme();
  const cart = buildCart(route);
  const [checking, setChecking] = useState(false);  
  // shippingAddress passed from Shipping screen via nextCart
  const addr = route?.params?.shippingAddress ?? null;

  const handleContinue = async () => {
    setChecking(true);
    try {
      const response = await checkoutCart();
      const checkoutData = response?.data?.data?.checkout ?? null;
      navigation.navigate('MyClosetBuyerOrderReceived', {
        ...route.params,
        checkoutData,
      });
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not proceed to checkout. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header navigation={navigation} title="Review Order" />
      <ScrollView
        contentContainerStyle={styles.checkoutContent}
        showsVerticalScrollIndicator={false}
      >
        <CheckoutSteps current={3} />
        <View style={styles.reviewSectionHeader}>
          <Text style={styles.sectionLabel}>Shipping Address</Text>
          <TouchableOpacity onPress={() => navigation.navigate('MyClosetBuyerShipping', route.params)}>
            <Text style={[styles.editText, { color: text }]}>Edit</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.reviewCard}>
          {addr ? (
            <>
              <Text style={styles.addressName}>{addr.fullName}</Text>
              {addr.phoneNumber ? <Text style={styles.addressPhone}>{addr.phoneNumber}</Text> : null}
              <Text style={styles.addressText}>{addr.addressLine1}</Text>
              {addr.addressLine2 ? <Text style={styles.addressText}>{addr.addressLine2}</Text> : null}
              <Text style={styles.addressText}>
                {[addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')}
              </Text>
              {addr.country ? <Text style={styles.addressText}>{addr.country}</Text> : null}
            </>
          ) : (
            <Text style={styles.addressText}>No address selected</Text>
          )}
        </View>
        <View style={styles.reviewSectionHeader}>
          <Text style={styles.sectionLabel}>Shipping Method</Text>
          <TouchableOpacity onPress={() => navigation.navigate('MyClosetBuyerShipping', route.params)}>
            <Text style={[styles.editText, { color: text }]}>Edit</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.reviewLineCard}>
          <Text style={styles.radioLabel}>
            {route?.params?.shippingMethod === 'express'
              ? 'Express Shipping (1-2 days)'
              : 'Standard Shipping (3-5 days)'}
          </Text>
          <Text style={styles.radioPrice}>{currency(cart.shipping)}</Text>
        </View>
        <View style={styles.reviewSectionHeader}>
          <Text style={styles.sectionLabel}>Payment Method</Text>
          <TouchableOpacity onPress={() => navigation.navigate('MyClosetBuyerPayment', route.params)}>
            <Text style={[styles.editText, { color: text }]}>Edit</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.reviewLineCard}>
          <Ionicons name="shield-checkmark-outline" size={18} color={text} />
          <Text style={styles.radioLabel}>Valens Secure Checkout</Text>
        </View>
        <OrderSummary cart={cart} compact />
        <Text style={styles.termsText}>
          By placing this order, you agree to Valens Terms of Service and Privacy Policy.
        </Text>
      </ScrollView>
      <View style={styles.bottomBar}>
        <BottomButton
          label="Place Order"
          icon="lock-closed-outline"
          onPress={() => handleContinue()}
        />
      </View>
    </SafeAreaView>
  );
};

const MyClosetBuyerOrderReceivedScreen = ({ navigation, route }) => {
  const { text } = useAppTheme();
  const cart = buildCart(route);
  const today = new Date();
  const orderId = useMemo(() => `V${String(Date.now()).slice(-7)}`, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.receivedContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.confettiArea}>
          {[...Array(18)].map((_, index) => (
            <View
              key={index}
              style={[
                styles.confetti,
                {
                  left: `${(index * 17) % 92}%`,
                  top: 12 + ((index * 23) % 120),
                  backgroundColor: ['#a78bfa', '#f472b6', '#facc15', '#7dd3fc'][index % 4],
                },
              ]}
            />
          ))}
          <View style={[styles.checkCircle, { backgroundColor: text }]}>
            <Ionicons name="checkmark" size={48} color="#fff" />
          </View>
        </View>
        <Text style={[styles.receivedTitle, { color: text }]}>Order Received!</Text>
        <Text style={styles.receivedSubtitle}>
          Thank you for your purchase. Your order has been placed successfully.
        </Text>
        <View style={styles.orderCard}>
          <View style={styles.orderCardHeader}>
            <View>
              <Text style={styles.orderId}>Order #{orderId}</Text>
              <Text style={styles.orderDate}>
                {today.toLocaleDateString()} at{' '}
                {today.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <Text style={[styles.editText, { color: text }]}>View Details</Text>
          </View>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Estimated Delivery</Text>
          <Text style={styles.addressText}>May 13 - May 15, 2026</Text>
          <Text style={[styles.receivedTotal, { color: text }]}>Total {currency(cart.total)}</Text>
        </View>
      </ScrollView>
      <View style={styles.bottomBar}>
        <BottomButton label="Continue Shopping" onPress={() => navigation.popToTop?.()} />
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.secondaryButton}
          onPress={() => navigation.popToTop?.()}
        >
          <Text style={[styles.secondaryButtonText, { color: text }]}>Go to My Orders</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export {
  MyClosetBuyerCartScreen,
  MyClosetBuyerCheckoutScreen,
  MyClosetBuyerItemDetailScreen,
  MyClosetBuyerItemsScreen,
  MyClosetBuyerOptionsScreen,
  MyClosetBuyerOrderReceivedScreen,
  MyClosetBuyerPaymentScreen,
  MyClosetBuyerReviewScreen,
  MyClosetBuyerShippingScreen,
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff', paddingTop: 40 },
  modalSafe: { flex: 1, backgroundColor: '#fff' },

  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  modalHeader: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
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

  // grid
  gridContent: { paddingHorizontal: 18, paddingBottom: 110 },
  gridRow: { gap: GRID_GAP },
  listIntro: { paddingTop: 8, paddingBottom: 14 },
  listTitle: { fontSize: 22, fontWeight: '900', color: '#17072d' },
  listSubtitle: { marginTop: 4, fontSize: 13, color: MUTED, fontWeight: '600' },
  gridCard: { width: GRID_ITEM_WIDTH, marginBottom: 18 },
  gridImage: { width: '100%', aspectRatio: 1, borderRadius: 16 },
  gridTitle: { marginTop: 8, minHeight: 36, fontSize: 14, lineHeight: 18, color: '#17072d', fontWeight: '800' },
  gridPrice: { marginTop: 4, fontSize: 15, fontWeight: '900' },
  gridMeta: { marginTop: 3, fontSize: 12, color: MUTED },

  imageBox: { backgroundColor: '#f6f0ee', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyTitle: { marginTop: 12, fontSize: 17, fontWeight: '900', color: '#17072d' },
  emptyText: { marginTop: 5, fontSize: 13, color: MUTED, textAlign: 'center' },

  // detail
  detailContent: { paddingHorizontal: 20, paddingBottom: 110 },
  heroImage: { width: HERO_IMAGE_WIDTH, height: 220, borderRadius: 18 },
  photoDots: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 18, marginBottom: 16 },
  photoDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#d7cce3' },
  photoDotsSpacer: { height: 42 },
  detailName: { fontSize: 22, fontWeight: '900', color: '#17072d' },
  detailPrice: { marginTop: 3, fontSize: 21, fontWeight: '900' },

  sellerCard: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 16, marginBottom: 22, padding: 12,
    borderWidth: 1, borderColor: BORDER, borderRadius: 14, backgroundColor: '#fff',
  },
  sellerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  sellerCopy: { flex: 1, paddingHorizontal: 12 },
  sellerName: { fontSize: 13, fontWeight: '900', color: '#17072d' },
  sellerMeta: { marginTop: 2, fontSize: 11, color: MUTED },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  ratingText: { marginLeft: 4, fontSize: 11, color: '#17072d', fontWeight: '700' },

  sectionLabel: { fontSize: 14, fontWeight: '900', color: '#21083f', marginBottom: 8 },
  description: { fontSize: 13, lineHeight: 19, color: '#43324f', marginBottom: 16 },
  attributeList: { gap: 8 },
  attributeRow: { flexDirection: 'row', alignItems: 'center' },
  attributeLabel: { marginLeft: 8, width: 90, fontSize: 12, color: MUTED, fontWeight: '700' },
  attributeValue: { flex: 1, fontSize: 12, color: '#17072d', fontWeight: '800' },

  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 22,
    backgroundColor: '#ffffffee', borderTopWidth: 1, borderTopColor: '#f0eaf6',
  },
  bottomButton: {
    minHeight: 50, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
  },
  bottomButtonText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  buttonIcon: { marginRight: 7 },

  formContent: { paddingHorizontal: 20, paddingBottom: 110 },
  optionProductRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 26 },
  optionThumb: { width: 76, height: 58, borderRadius: 10, marginRight: 14 },
  optionName: { fontSize: 15, fontWeight: '900', color: '#17072d' },
  optionPrice: { marginTop: 4, fontSize: 16, fontWeight: '900', color: '#17072d' },
  helperText: { fontSize: 12, color: MUTED, marginBottom: 10 },
  quantityBox: {
    width: 142, height: 44, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 10, backgroundColor: '#fff',
  },
  qtyButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  quantityText: { fontSize: 16, fontWeight: '900', color: '#17072d' },
  availabilityText: { marginTop: 10, marginBottom: 22, fontSize: 12, color: MUTED },
  noteBox: {
    minHeight: 104, borderWidth: 1, borderColor: BORDER,
    borderRadius: 13, paddingHorizontal: 12, paddingTop: 10, backgroundColor: '#fff',
  },
  noteInput: { minHeight: 64, color: '#17072d', fontSize: 13, textAlignVertical: 'top' },
  counterText: { alignSelf: 'flex-end', fontSize: 11, color: MUTED, marginBottom: 8 },

  checkoutContent: { paddingHorizontal: 20, paddingBottom: 120 },

  // cart
  cartLineCard: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: BORDER, borderRadius: 14,
    padding: 10, marginBottom: 20, backgroundColor: '#fff',
  },
  cartThumb: { width: 72, height: 58, borderRadius: 10 },
  cartCopy: { flex: 1, paddingHorizontal: 12 },
  cartItemName: { fontSize: 13, color: '#17072d', fontWeight: '900' },
  cartPrice: { marginTop: 3, fontSize: 13, fontWeight: '900' },
  cartQtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  cartQtyBtn: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff',
  },
  cartQtyBtnDisabled: { opacity: 0.4 },
  cartQtyText: { fontSize: 13, fontWeight: '900', color: '#17072d', minWidth: 18, textAlign: 'center' },
  cartClearingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: SURFACE, borderRadius: 10, padding: 12, marginBottom: 14,
    borderWidth: 1, borderColor: BORDER,
  },
  cartClearingText: { fontSize: 13, fontWeight: '700' },

  summaryBlock: { borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 16 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  summaryLabel: { fontSize: 13, color: '#43324f' },
  summaryValue: { fontSize: 13, color: '#17072d', fontWeight: '700' },
  summaryStrong: { fontSize: 16, fontWeight: '900', color: '#17072d' },
  summaryTotal: { fontSize: 18, fontWeight: '900' },

  protectionCard: {
    flexDirection: 'row', alignItems: 'center', marginTop: 12,
    borderWidth: 1, borderColor: BORDER, borderRadius: 13, padding: 12, backgroundColor: SURFACE,
  },
  protectionIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  protectionText: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '800' },

  stepsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
    paddingHorizontal: 4,
  },
  stepItem: { alignItems: 'center' },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#d7cce3',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  stepNumber: { fontSize: 12, color: '#a99aba', fontWeight: '800' },
  stepNumberActive: { color: '#fff' },
  stepLabel: { marginTop: 6, fontSize: 10, color: MUTED, fontWeight: '700' },
  stepConnector: { flex: 1, height: 2, backgroundColor: '#e5ddf0', marginBottom: 14 },

  card: { borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 14, backgroundColor: SURFACE },
  compactCard: { marginTop: 14 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  cardTitle: { fontSize: 14, color: '#21083f', fontWeight: '900' },
  editText: { fontSize: 12, fontWeight: '900' },
  summaryItemRow: { flexDirection: 'row', alignItems: 'center' },
  summaryThumb: { width: 76, height: 76, borderRadius: 10 },
  summaryItemCopy: { flex: 1, paddingLeft: 12 },
  summaryItemName: { fontSize: 13, color: '#17072d', fontWeight: '900' },
  summaryItemPrice: { marginTop: 3, fontSize: 13, fontWeight: '900' },
  summaryItemQty: { marginTop: 3, fontSize: 11, color: MUTED, fontWeight: '700' },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 16 },

  addressCard: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 13,
    marginBottom: 10, backgroundColor: SURFACE, overflow: 'hidden',
  },
  addressCardSelected: { backgroundColor: '#f5f0ff' },
  addressCardContent: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: 14,
  },
  addressActionsRow: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: BORDER,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  addressActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 4, paddingHorizontal: 6,
  },
  addressActionText: {
    fontSize: 12, fontWeight: '800',
  },
  addressActionDivider: {
    width: 1, height: 14, backgroundColor: BORDER, marginHorizontal: 6,
  },
  addressNameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' },
  addressName: { fontSize: 13, color: '#17072d', fontWeight: '900', marginRight: 8 },
  addressPhone: { fontSize: 12, color: MUTED, marginBottom: 3 },
  addressText: { fontSize: 12, color: '#43324f', lineHeight: 17 },
  defaultBadge: {
    backgroundColor: '#ede9f8', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  defaultBadgeText: { fontSize: 10, fontWeight: '800' },

  // Address loading / error / empty states
  addressLoader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, gap: 10 },
  addressLoaderText: { fontSize: 13, color: MUTED },
  addressErrorBox: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    backgroundColor: ERROR_BG, borderRadius: 12, padding: 12, marginBottom: 12, gap: 8,
  },
  addressErrorText: { flex: 1, fontSize: 13, color: ERROR_COLOR },
  retryButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: ERROR_COLOR, borderRadius: 8 },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  noAddressBox: { alignItems: 'center', paddingVertical: 28 },
  noAddressTitle: { marginTop: 10, fontSize: 15, fontWeight: '900', color: '#17072d' },
  noAddressText: { marginTop: 4, fontSize: 12, color: MUTED, textAlign: 'center' },

  addAddressButton: {
    minHeight: 48, borderWidth: 1, borderColor: BORDER, borderRadius: 13,
    paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 20,
  },
  addAddressText: { marginLeft: 10, fontSize: 13, fontWeight: '900' },

  radioCard: {
    minHeight: 58, borderWidth: 1, borderColor: BORDER, borderRadius: 13,
    paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 12, backgroundColor: '#fff',
  },
  radioCardSelected: { backgroundColor: SURFACE },
  radioLabel: { flex: 1, marginLeft: 10, fontSize: 13, color: '#17072d', fontWeight: '800' },
  radioPrice: { fontSize: 12, color: '#17072d', fontWeight: '900' },

  paymentOption: {
    minHeight: 58, borderWidth: 1, borderColor: BORDER, borderRadius: 13,
    padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 10, backgroundColor: '#fff',
  },
  paymentCopy: { flex: 1 },
  paymentSub: { marginLeft: 10, marginTop: 2, fontSize: 11, color: MUTED, fontWeight: '700' },

  reviewSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  reviewCard: { borderWidth: 1, borderColor: BORDER, borderRadius: 13, padding: 12, backgroundColor: SURFACE, marginBottom: 8 },
  reviewLineCard: { minHeight: 48, borderWidth: 1, borderColor: BORDER, borderRadius: 13, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 8, backgroundColor: SURFACE },
  termsText: { marginTop: 12, fontSize: 11, lineHeight: 16, color: MUTED },

  // order received
  receivedContent: { paddingHorizontal: 20, paddingBottom: 170, alignItems: 'center' },
  confettiArea: { width: '100%', height: 190, alignItems: 'center', justifyContent: 'flex-end' },
  confetti: { position: 'absolute', width: 5, height: 5, borderRadius: 3 },
  checkCircle: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  receivedTitle: { marginTop: 24, fontSize: 28, fontWeight: '900', textAlign: 'center' },
  receivedSubtitle: { marginTop: 8, fontSize: 14, lineHeight: 20, color: MUTED, textAlign: 'center' },
  orderCard: { alignSelf: 'stretch', marginTop: 26, borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 14, backgroundColor: '#fff' },
  orderCardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  orderId: { fontSize: 13, color: '#17072d', fontWeight: '900' },
  orderDate: { marginTop: 4, fontSize: 11, color: MUTED },
  receivedTotal: { marginTop: 12, fontSize: 13, fontWeight: '900' },

  secondaryButton: { minHeight: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: BORDER, backgroundColor: '#fff', marginTop: 10 },
  secondaryButtonText: { fontSize: 14, fontWeight: '900' },

  // add address modal form
  modalContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: '#21083f', marginBottom: 5 },
  fieldInput: {
    height: 46, borderWidth: 1, borderColor: BORDER, borderRadius: 11,
    paddingHorizontal: 13, fontSize: 13, color: '#17072d', backgroundColor: '#fff',
  },
  // ── Red border on error ──
  fieldInputError: {
    borderColor: ERROR_COLOR,
    backgroundColor: ERROR_BG,
  },
  // ── Red inline error text ──
  fieldErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 5,
  },
  fieldErrorText: {
    fontSize: 11,
    color: ERROR_COLOR,
    fontWeight: '700',
    flex: 1,
  },
  defaultRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 10 },
  defaultLabel: { fontSize: 13, fontWeight: '700', color: '#17072d' },
});