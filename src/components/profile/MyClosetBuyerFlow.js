import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  SafeAreaView,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Ionicons from 'react-native-vector-icons/Ionicons';
import FastImage from 'react-native-fast-image';
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
  getClosetItemsByClosetId,
  setCartItemShippingChoice,
  getWishlist,
  addWishlistItem,
  deleteWishlistItem,
  createPaymentSession,
  getRecentPaymentDetails,
  getPaymentDetailsByPaymentId,
  getClosetBattlesPriority,
} from '../../services/myCloset';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { FlatList as GestureFlatList } from 'react-native-gesture-handler';
import InstagramZoomableImage from '../shared/InstagramZoomableImage';
import {
  buildClosetReturnTo,
  navigateToBattleLive,
  navigateClosetReturn,
  useClosetTheme,
  withClosetNavParams,
} from '../../utils/closetNavigation';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../displaytoastmessage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 12;
const GRID_ITEM_WIDTH = (SCREEN_WIDTH - 48) / 2;
const HERO_IMAGE_WIDTH = SCREEN_WIDTH - 40;
const HERO_IMAGE_HEIGHT = 220;
const MUTED = '#6b7280';
const BORDER = '#ebe4f3';
const SURFACE = '#fbf8ff';
const ERROR_COLOR = '#dc2626';
const ERROR_BG = '#fff5f5';
const SHIP_OPTION_SHIP = 'ship_items';
const SHIP_OPTION_LOCAL = 'local_pick';
const SHIP_OPTION_BOTH = 'both';

const allowedShippingChoices = shippingOption => {
  if (shippingOption === SHIP_OPTION_BOTH) return [SHIP_OPTION_SHIP, SHIP_OPTION_LOCAL];
  if (shippingOption === SHIP_OPTION_LOCAL) return [SHIP_OPTION_LOCAL];
  return [SHIP_OPTION_SHIP];
};

const resolveShippingOption = (shippingOptionsMap, item) =>
  shippingOptionsMap[cartItemProductId(item)] ?? item?.selectedShippingChoice ?? SHIP_OPTION_SHIP;

const cartRequiresShipping = (cartItemsSnapshot = [], shippingOptionsMap = {}) =>
  (Array.isArray(cartItemsSnapshot) ? cartItemsSnapshot : []).some(item => {
    const opt = resolveShippingOption(shippingOptionsMap, item);
    return opt === SHIP_OPTION_SHIP || opt === SHIP_OPTION_BOTH;
  });

const getShipOnlyCartItems = (cartItemsSnapshot = [], shippingOptionsMap = {}) =>
  (Array.isArray(cartItemsSnapshot) ? cartItemsSnapshot : []).filter(item => {
    const opt = resolveShippingOption(shippingOptionsMap, item);
    return opt === SHIP_OPTION_SHIP && item?.selectedShippingChoice !== SHIP_OPTION_SHIP;
  });

const cartItemProductId = ci => ci?.product?.id || ci?.product?._id || ci?.productId;
const wishlistItemProductId = item => item?.product?.id || item?.product?._id || item?.productId || item?.id || item?._id;

const getWishlistPayload = response => response?.data?.data ?? response?.data ?? response ?? {};

const getWishlistsArray = response => {
  const payload = getWishlistPayload(response);
  if (Array.isArray(payload?.wishlists)) return payload.wishlists;
  if (Array.isArray(payload?.wishlist)) return payload.wishlist;
  if (Array.isArray(payload)) return payload;
  return [];
};

const getWishlistRecordForSeller = (response, sellerId) => {
  const wishlists = getWishlistsArray(response);
  if (!wishlists.length) return null;
  if (!sellerId) return wishlists[0] || null;
  return wishlists.find(w => String(w?.sellerId) === String(sellerId)) || wishlists[0] || null;
};

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

const unwrapWishlistItems = response => getWishlistRecordForSeller(response)?.wishlistItems ?? [];

const fastImageSource = uri =>
  uri
    ? {
      uri,
      priority: FastImage.priority.high,
      cache: FastImage.cacheControl.immutable,
    }
    : null;

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

const CachedImageBox = ({ uri, style, placeholderStyle, iconName, iconSize = 26 }) => {
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
        <View style={styles.imageLoadingOverlay}>
          <ActivityIndicator size="small" color="#9b8c7a" />
        </View>
      )}
      <FastImage
        source={fastImageSource(uri)}
        style={StyleSheet.absoluteFill}
        resizeMode={FastImage.resizeMode.cover}
        fadeDuration={0}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setFailed(true);
          setLoaded(true);
        }}
      />
    </View>
  );
};

const unwrapBattlesResponse = source => {
  const battles = source?.data?.battles ?? source?.data?.data?.battles ?? source?.battles ?? [];
  return Array.isArray(battles) ? battles : [];
};

const fmt = value => {
  if (value == null || value === '') return '$0.00';
  const text = String(value).trim();
  if (text.startsWith('$')) return text;
  const numeric = Number(text);
  return Number.isNaN(numeric) ? text : `$${numeric.toFixed(2)}`;
};

const thumb = item => {
  if (!item) return null;
  if (Array.isArray(item.images) && item.images.length) return item.images[0];
  return item.image || item.thumbnail || null;
};

const mapParticipant = (participant = {}, closet) => {
  const product = participant.product ?? {};
  return {
    participantId: participant.id,
    name: product.name || '',
    price: fmt(product.price),
    image: thumb(product),
    user: closet?.shopName || closet?.shopUsername || '',
    pct: Number(participant.votePercentage ?? 0),
    isWinner: !!participant.isWinner,
  };
};

const mapBattle = (battle, index) => {
  const sorted = [...(battle?.participants ?? [])].sort(
    (left, right) => (left.position ?? 0) - (right.position ?? 0),
  );
  const [p1, p2] = sorted;

  return {
    id: String(battle?.id ?? index),
    title: battle?.title,
    left: mapParticipant(p1, battle?.closet),
    right: mapParticipant(p2, battle?.closet),
  };
};

const BattleSlide = ({ battle, accent, t, onPress }) => (
  <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.battleCard}>
    <Text style={styles.battleTitle} numberOfLines={1}>
      {battle.title || t('myClosetShopFront.battlePicksTitle')}
    </Text>
    <View style={styles.slide}>
      <View style={styles.fighter}>
        <View style={styles.fighterThumb}>
          <CachedImageBox
            uri={battle.left.image}
            style={styles.fighterImgWrap}
            placeholderStyle={styles.fighterThumbPlaceholder}
            iconName="bag-outline"
          />
        </View>
        <Text style={styles.fighterName} numberOfLines={2}>{battle.left.name}</Text>
        <Text style={styles.fighterPrice}>{battle.left.price}</Text>
        <Text style={[styles.pct, { color: accent }]}>{battle.left.pct}%</Text>
      </View>

      <View style={styles.vsBubble}>
        <Text style={styles.vsText}>{t('myClosetShopFront.vs')}</Text>
      </View>

      <View style={styles.fighter}>
        <View style={styles.fighterThumb}>
          <CachedImageBox
            uri={battle.right.image}
            style={styles.fighterImgWrap}
            placeholderStyle={styles.fighterThumbPlaceholder}
            iconName="bag-handle-outline"
          />
        </View>
        <Text style={styles.fighterName} numberOfLines={2}>{battle.right.name}</Text>
        <Text style={styles.fighterPrice}>{battle.right.price}</Text>
        <Text style={styles.pctRed}>{battle.right.pct}%</Text>
      </View>
    </View>
  </TouchableOpacity>
);

// `description`/`brand`/`condition` fall back to translated defaults when the API omits them.
const normalizeItem = (item = {}, index = 0, t) => ({
  id: String(item?.id || item?._id || `item-${index}`),
  raw: item,
  name: item?.name || item?.title || item?.itemName || t('myClosetBuyer.untitledItem'),
  price: currency(item?.price ?? item?.amount ?? item?.salePrice),
  priceValue: numberFromPrice(item?.price ?? item?.amount ?? item?.salePrice),
  image: itemImage(item),
  images: itemImages(item),
  brand: item?.brand || t('myClosetBuyer.defaultBrand'),
  category: item?.category || t('myClosetBuyer.defaultCategory'),
  condition: item?.condition || t('myClosetBuyer.defaultCondition'),
  description: item?.description || t('myClosetBuyer.defaultDescription'),
  quantityAvailable: Number(item?.quantity ?? item?.availableQuantity ?? 1) || 0,
  sellerName: item?.sellerName || item?.userName || item?.ownerName || '',
});

const normalizeItems = (items, t) =>
  (Array.isArray(items) ? items : []).map((item, index) => normalizeItem(item, index, t));

const getRouteItems = (route, t) =>
  normalizeItems(route?.params?.items || route?.params?.initialItems || [], t);

const buildCart = (route, t, overrides = {}) => {
  const item = normalizeItem(route?.params?.item || {}, 0, t);
  const quantity = Number(route?.params?.quantity || 1) || 1;
  const cartItemsSnapshot = route?.params?.cartItemsSnapshot || null;
  const breakdown = route?.params?.checkoutData?.breakdown ?? null;

  let fallbackItemTotal = item.priceValue * quantity;
  if (Array.isArray(cartItemsSnapshot) && cartItemsSnapshot.length > 0) {
    fallbackItemTotal = cartItemsSnapshot.reduce((sum, ci) => {
      const price = ci?.product?.price ?? ci?.price ?? item.priceValue;
      return sum + price * (ci.quantity || 1);
    }, 0);
  }
  const itemTotal = breakdown?.itemsSubtotal ?? route?.params?.itemTotal ?? fallbackItemTotal;
  const shipping = breakdown?.shippingAmount ?? Number(route?.params?.shippingAmount ?? route?.params?.shipping ?? 0);
  const taxAmount = breakdown?.taxAmount ?? 0;
  const platformFee = breakdown?.platformFee ?? 0;
  const discountAmount = breakdown?.discountAmount ?? 0;
  const total = breakdown?.totalAmountDue ?? route?.params?.total ?? (itemTotal + shipping + taxAmount + platformFee - discountAmount);

  return {
    item,
    quantity,
    note: route?.params?.note || '',
    seller: route?.params?.seller || {},
    items: route?.params?.items || [],
    cartItemsSnapshot,
    itemTotal,
    shipping,
    taxAmount,
    platformFee,
    discountAmount,
    total,
    ...overrides,
  };
};

const goBack = (navigation, returnTo) => {
  if (navigation.canGoBack?.()) {
    navigation.goBack();
    return;
  }
  navigateClosetReturn(navigation, returnTo);
};

// ─────────────────────────────────────────────────────────────────────────────
// Field validation rules — labels/messages are functions of `t` so components
// re-derive them via useMemo when the language changes.
// ─────────────────────────────────────────────────────────────────────────────
const getFieldRules = t => ({
  fullName: { required: true, label: t('myClosetBuyer.field.fullName') },
  phoneNumber: {
    required: true,
    label: t('myClosetBuyer.field.phoneNumber'),
    pattern: /^[+\d\s\-()]{7,20}$/,
    patternMsg: t('myClosetBuyer.field.invalidPhone'),
  },
  alternateNumber: {
    required: true,
    label: t('myClosetBuyer.field.alternateNumber'),
    pattern: /^[+\d\s\-()]{7,20}$/,
    patternMsg: t('myClosetBuyer.field.invalidPhone'),
  },
  addressLine1: { required: true, label: t('myClosetBuyer.field.addressLine1') },
  addressLine2: { required: true, label: t('myClosetBuyer.field.addressLine2') },
  city: { required: true, label: t('myClosetBuyer.field.city') },
  state: { required: true, label: t('myClosetBuyer.field.state') },
  country: { required: true, label: t('myClosetBuyer.field.country') },
  postalCode: {
    required: true,
    label: t('myClosetBuyer.field.postalCode'),
    pattern: /^\d{3,10}$/,
    patternMsg: t('myClosetBuyer.field.invalidPostalCode'),
  },
});

const validateField = (key, value, fieldRules, t) => {
  const rule = fieldRules[key];
  if (!rule) return null;
  const trimmed = String(value ?? '').trim();
  if (rule.required && !trimmed) return t('myClosetBuyer.field.required', { label: rule.label });
  if (trimmed && rule.pattern && !rule.pattern.test(trimmed)) return rule.patternMsg;
  return null;
};

const validateForm = (form, fieldRules, t) => {
  const errors = {};
  Object.keys(fieldRules).forEach(key => {
    const err = validateField(key, form[key], fieldRules, t);
    if (err) errors[key] = err;
  });
  return errors;
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI atoms
// ─────────────────────────────────────────────────────────────────────────────

const Header = ({ navigation, title, rightIcon, onRightPress, returnTo }) => (
  <View style={styles.header}>
    <TouchableOpacity
      onPress={() => goBack(navigation, returnTo)}
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

const BottomButton = ({ label, onPress, icon, accentColor, disabled = false }) => {
  const { text: fallbackAccent } = useAppTheme();
  const buttonColor = accentColor || fallbackAccent;
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.bottomButton,
        { backgroundColor: buttonColor },
        disabled && styles.bottomButtonDisabled,
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color="#fff" style={styles.buttonIcon} /> : null}
      <Text style={styles.bottomButtonText}>{label}</Text>
    </TouchableOpacity>
  );
};

const ImageBox = ({ uri, style, iconSize = 34 }) => (
  <View style={[styles.imageBox, style]}>
    {uri ? (
      <FastImage
        source={fastImageSource(uri)}
        style={styles.coverImage}
        fadeDuration={0}
        resizeMode={FastImage.resizeMode.cover}
      />
    ) : (
      <Ionicons name="shirt-outline" size={iconSize} color="#9b8c7a" />
    )}
  </View>
);

const DetailImageCarousel = ({ images, onZoomChange, accentColor }) => {
  const { text: fallbackAccent } = useAppTheme();
  const text = accentColor || fallbackAccent;
  const [activeIndex, setActiveIndex] = useState(0);
  const [fullScreenVisible, setFullScreenVisible] = useState(false);
  const [fullScreenIndex, setFullScreenIndex] = useState(0);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const listRef = useRef(null);
  const galleryImages = images.length ? images : [null];

  useEffect(() => {
    const urls = galleryImages.filter(Boolean);
    if (!urls.length) return;
    FastImage.preload(urls.map(uri => ({ uri, priority: FastImage.priority.high })));
  }, [galleryImages]);

  const onScroll = useCallback(event => {
    const nextIndex = Math.round(
      event.nativeEvent.contentOffset.x / HERO_IMAGE_WIDTH,
    );
    const clampedIndex = Math.max(0, Math.min(nextIndex, galleryImages.length - 1));
    if (clampedIndex !== activeIndex) {
      setActiveIndex(clampedIndex);
    }
  }, [activeIndex, galleryImages.length]);

  const handleZoomChange = useCallback(zoomed => {
    setScrollEnabled(!zoomed);
    onZoomChange?.(zoomed);
  }, [onZoomChange]);

  const openFullScreen = useCallback(index => {
    setFullScreenIndex(index);
    setFullScreenVisible(true);
  }, []);

  const closeFullScreen = useCallback(() => {
    setFullScreenVisible(false);
  }, []);

  const renderItem = useCallback(({ item, index }) => {
    if (!item) {
      return (
        <TouchableOpacity activeOpacity={0.9} style={styles.heroSlide} onPress={() => openFullScreen(index)}>
          <ImageBox uri={null} style={styles.heroImage} iconSize={64} />
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity activeOpacity={0.95} style={styles.heroSlide} onPress={() => openFullScreen(index)}>
        <InstagramZoomableImage
          uri={item}
          height={HERO_IMAGE_HEIGHT}
          width={HERO_IMAGE_WIDTH}
          resizeMode={FastImage.resizeMode.contain}
          onZoomChange={handleZoomChange}
          simultaneousHandlers={listRef}
        />
      </TouchableOpacity>
    );
  }, [handleZoomChange, openFullScreen]);

  const renderFullScreenItem = useCallback(({ item }) => {
    if (!item) {
      return (
        <View style={styles.fullScreenSlide}>
          <ImageBox uri={null} style={styles.fullScreenImageBox} iconSize={72} />
        </View>
      );
    }

    return (
      <View style={styles.fullScreenSlide}>
        <FastImage
          source={fastImageSource(item)}
          style={styles.fullScreenImage}
          resizeMode={FastImage.resizeMode.contain}
          fadeDuration={0}
        />
      </View>
    );
  }, []);

  const onFullScreenScroll = useCallback(event => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    const clampedIndex = Math.max(0, Math.min(nextIndex, galleryImages.length - 1));
    if (clampedIndex !== fullScreenIndex) {
      setFullScreenIndex(clampedIndex);
    }
  }, [fullScreenIndex, galleryImages.length]);

  return (
    <View>
      <GestureFlatList
        ref={listRef}
        data={galleryImages}
        keyExtractor={(uri, index) => `${uri || 'placeholder'}-${index}`}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={scrollEnabled && galleryImages.length > 1}
        onScroll={onScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={HERO_IMAGE_WIDTH}
        snapToAlignment="start"
        disableIntervalMomentum
        directionalLockEnabled
        nestedScrollEnabled
        removeClippedSubviews={false}
        initialNumToRender={galleryImages.length > 1 ? 2 : 1}
        maxToRenderPerBatch={2}
        windowSize={3}
        extraData={activeIndex}
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
      <Modal
        visible={fullScreenVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeFullScreen}>
        <View style={styles.fullScreenModal}>
          <View style={styles.fullScreenBackdrop} />
          <TouchableOpacity
            style={styles.fullScreenCloseButton}
            onPress={closeFullScreen}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Close full screen gallery">
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <GestureFlatList
            style={styles.fullScreenFlatList}
            data={galleryImages}
            keyExtractor={(uri, index) => `fullscreen-${uri || 'placeholder'}-${index}`}
            renderItem={renderFullScreenItem}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.min(fullScreenIndex, galleryImages.length - 1)}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            onScroll={onFullScreenScroll}
            scrollEventThrottle={16}
            decelerationRate="fast"
            snapToInterval={SCREEN_WIDTH}
            snapToAlignment="start"
            disableIntervalMomentum
            directionalLockEnabled
            nestedScrollEnabled
            removeClippedSubviews={false}
          />
        </View>
      </Modal>
    </View>
  );
};

const SummaryRow = ({ label, value, bold, accentColor }) => {
  const { text: fallbackAccent } = useAppTheme();
  const text = accentColor || fallbackAccent;
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && styles.summaryStrong]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && styles.summaryTotal, bold && { color: text }]}>
        {value}
      </Text>
    </View>
  );
};

const CheckoutSteps = ({ current, includeShipping = true, accentColor }) => {
  const { text: fallbackAccent } = useAppTheme();
  const text = accentColor || fallbackAccent;
  const { t } = useLanguage();
  const steps = includeShipping
    ? [
      t('myClosetBuyer.steps.cart'),
      t('myClosetBuyer.steps.shipping'),
      t('myClosetBuyer.steps.payment'),
      t('myClosetBuyer.steps.review'),
    ]
    : [
      t('myClosetBuyer.steps.cart'),
      t('myClosetBuyer.steps.payment'),
      t('myClosetBuyer.steps.review'),
    ];
  return (
    <View style={styles.stepsWrap}>
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <React.Fragment key={step}>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, (done || active) && { backgroundColor: text, borderColor: text }]}>
                {done ? (
                  <Ionicons name="checkmark" size={12} color="#fff" />
                ) : (
                  <Text style={[styles.stepNumber, (done || active) && styles.stepNumberActive]}>{index + 1}</Text>
                )}
              </View>
              <Text style={[styles.stepLabel, active && { color: text }]}>{step}</Text>
            </View>
            {index < steps.length - 1 && (
              <View style={[styles.stepConnector, index < current && { backgroundColor: text }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const SellerCard = ({ seller, accentColor }) => {
  const { text: fallbackAccent } = useAppTheme();
  const text = accentColor || fallbackAccent;
  const { t } = useLanguage();
  return (
    <View style={styles.sellerCard}>
      <View style={[styles.sellerAvatar, { backgroundColor: text }]}>
        <CachedImageBox
          uri={seller?.image}
          style={styles.sellerAvatarImage}
          placeholderStyle={styles.sellerAvatarPlaceholder}
          iconName="person"
          iconSize={20}
        />
      </View>
      <View style={styles.sellerCopy}>
        <Text style={styles.sellerName}>
          {seller?.displayName || seller?.userName || t('myClosetBuyer.closetSellerFallback')}
        </Text>
        <Text style={styles.sellerMeta}>{t('myClosetBuyer.sellerActive2h')}</Text>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={12} color="#f59e0b" />
          <Text style={styles.ratingText}>4.8 (32)</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#17072d" />
    </View>
  );
};

const OrderSummary = ({ cart, editable, compact, onEditCart, accentColor, bgStyle }) => {
  const { text: fallbackAccent } = useAppTheme();
  const text = accentColor || fallbackAccent;
  const { t } = useLanguage();
  const lines = Array.isArray(cart.cartItemsSnapshot) && cart.cartItemsSnapshot.length
    ? cart.cartItemsSnapshot
    : null;

  return (
    <View style={[styles.card, compact && styles.compactCard, bgStyle, { borderColor: text, }]}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>{t('myClosetBuyer.orderSummary')}</Text>
        {editable ? (
          <TouchableOpacity activeOpacity={0.8} onPress={onEditCart}>
            <Text style={[styles.editText, { color: text }]}>{t('myClosetBuyer.editCart')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {lines ? (
        lines.map((ci, idx) => {
          const image =
            imageUri(ci?.product?.images?.[0]) || imageUri(ci?.product?.image) || null;
          const name = ci?.product?.name || ci?.product?.title || t('myClosetBuyer.itemFallback');
          const price = currency(ci?.product?.price ?? ci?.price ?? 0);
          const qty = ci.quantity || 1;
          return (
            <View key={ci.id || idx}>
              <View style={styles.summaryItemRow}>
                <ImageBox uri={image} style={styles.summaryThumb} iconSize={22} />
                <View style={styles.summaryItemCopy}>
                  <Text style={styles.summaryItemName} numberOfLines={2}>{name}</Text>
                  <Text style={[styles.summaryItemPrice, { color: text }]}>{price}</Text>
                  <Text style={styles.summaryItemQty}>{t('myClosetBuyer.qtyLabel', { qty })}</Text>
                </View>
              </View>
              {idx < lines.length - 1 ? <View style={[styles.divider, { backgroundColor: text }]} /> : null}
            </View>
          );
        })
      ) : (
        <View style={styles.summaryItemRow}>
          <ImageBox uri={cart.item.image} style={styles.summaryThumb} iconSize={22} />
          <View style={styles.summaryItemCopy}>
            <Text style={styles.summaryItemName} numberOfLines={2}>{cart.item.name}</Text>
            <Text style={[styles.summaryItemPrice, { color: text }]}>{cart.item.price}</Text>
            <Text style={styles.summaryItemQty}>{t('myClosetBuyer.qtyLabel', { qty: cart.quantity })}</Text>
          </View>
        </View>
      )}

      <View style={[styles.divider, { backgroundColor: text }]} />
      <SummaryRow label={t('myClosetBuyer.itemTotal')} value={currency(cart.itemTotal)} accentColor={text} />
      {cart.shipping > 0 ? (
        <SummaryRow label={t('myClosetBuyer.shippingFee')} value={currency(cart.shipping)} accentColor={text} />
      ) : null}
      {cart.taxAmount > 0 ? (
        <SummaryRow label={t('myClosetBuyer.taxAmount')} value={currency(cart.taxAmount)} accentColor={text} />
      ) : null}
      {cart.platformFee > 0 ? (
        <SummaryRow label={t('myClosetBuyer.platformFee')} value={currency(cart.platformFee)} accentColor={text} />
      ) : null}
      {cart.discountAmount > 0 ? (
        <SummaryRow label={t('myClosetBuyer.discountAmount')} value={`-${currency(cart.discountAmount)}`} accentColor={text} />
      ) : null}
      <SummaryRow label={t('myClosetBuyer.total')} value={currency(cart.total)} bold accentColor={text} />
    </View>
  );
};

const FixedShippingBadge = ({ choice, accentColor }) => {
  const { text: fallbackAccent } = useAppTheme();
  const text = accentColor || fallbackAccent;
  const { t } = useLanguage();
  const meta = SHIPPING_CHOICE_META[choice];
  return (
    <View style={styles.fixedShipCard}>
      <Ionicons name={meta.icon} size={16} color={text} />
      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text style={styles.fixedShipTitle}>{t(meta.titleKey)}</Text>
        <Text style={styles.fixedShipSub}>
          {choice === SHIP_OPTION_SHIP
            ? t('myClosetBuyer.fixedShipNote')
            : t('myClosetBuyer.fixedLocalNote')}
        </Text>
      </View>
    </View>
  );
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
const AddAddressModal = ({ visible, onClose, onSaved, editAddress, accentColor }) => {
  const { text: fallbackAccent } = useAppTheme();
  const accent = accentColor || fallbackAccent;
  const { t } = useLanguage();
  const isEdit = !!editAddress;
  const fieldRules = useMemo(() => getFieldRules(t), [t]);

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
      const err = validateField(key, value, fieldRules, t);
      setErrors(prev => ({ ...prev, [key]: err }));
    }
  }, [touched, fieldRules, t]);

  const handleBlur = useCallback(key => {
    setTouched(prev => ({ ...prev, [key]: true }));
    const err = validateField(key, form[key], fieldRules, t);
    setErrors(prev => ({ ...prev, [key]: err }));
  }, [form, fieldRules, t]);

  const handleSave = async () => {
    const allTouched = Object.keys(fieldRules).reduce((acc, k) => ({ ...acc, [k]: true }), {});
    setTouched(allTouched);
    const allErrors = validateForm(form, fieldRules, t);
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
      Alert.alert(t('myClosetBuyer.errorTitle'), err?.response?.data?.message || t('myClosetBuyer.addressSaveError'));
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
      <KeyboardAvoidingView
        style={styles.modalSafe}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleClose} style={styles.iconButton}>
              <Ionicons name="close" size={22} color="#17072d" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{isEdit ? t('myClosetBuyer.editAddressTitle') : t('myClosetBuyer.newAddressTitle')}</Text>
            <View style={styles.iconButton} />
          </View>
          <KeyboardAwareScrollView
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            enableOnAndroid
            // extraScrollHeight={24}
            keyboardOpeningTime={0}
          >
            <Field label={`${t('myClosetBuyer.field.fullName')} *`} fieldKey="fullName" placeholder="John Doe"
              value={form.fullName} onChangeText={v => set('fullName', v)}
              onBlur={() => handleBlur('fullName')} error={errors.fullName} />
            <Field label={`${t('myClosetBuyer.field.phoneNumber')} *`} fieldKey="phoneNumber" placeholder="+1 555 000 0000"
              keyboardType="phone-pad" value={form.phoneNumber} onChangeText={v => set('phoneNumber', v)}
              onBlur={() => handleBlur('phoneNumber')} error={errors.phoneNumber} />
            <Field label={`${t('myClosetBuyer.field.alternateNumber')} *`} fieldKey="alternateNumber"
              keyboardType="phone-pad" value={form.alternateNumber} onChangeText={v => set('alternateNumber', v)}
              onBlur={() => handleBlur('alternateNumber')} error={errors.alternateNumber} />
            <Field label={`${t('myClosetBuyer.field.addressLine1')} *`} fieldKey="addressLine1" placeholder="123 Main Street"
              value={form.addressLine1} onChangeText={v => set('addressLine1', v)}
              onBlur={() => handleBlur('addressLine1')} error={errors.addressLine1} />
            <Field label={`${t('myClosetBuyer.field.addressLine2')} *`} fieldKey="addressLine2" placeholder="Apt, Suite, Floor…"
              value={form.addressLine2} onChangeText={v => set('addressLine2', v)}
              onBlur={() => handleBlur('addressLine2')} error={errors.addressLine2} />
            <Field label={`${t('myClosetBuyer.field.city')} *`} fieldKey="city" placeholder="New York"
              value={form.city} onChangeText={v => set('city', v)}
              onBlur={() => handleBlur('city')} error={errors.city} />
            <Field label={`${t('myClosetBuyer.field.state')} *`} fieldKey="state" placeholder="NY"
              value={form.state} onChangeText={v => set('state', v)}
              onBlur={() => handleBlur('state')} error={errors.state} />
            <Field label={`${t('myClosetBuyer.field.country')} *`} fieldKey="country" placeholder="United States"
              value={form.country} onChangeText={v => set('country', v)}
              onBlur={() => handleBlur('country')} error={errors.country} />
            <Field label={`${t('myClosetBuyer.field.postalCode')} *`} fieldKey="postalCode" placeholder="10001"
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
                color={accent}
              />
              <Text style={styles.defaultLabel}>{t('myClosetBuyer.setAsDefaultAddress')}</Text>
            </TouchableOpacity>
          </KeyboardAwareScrollView>
          <View style={styles.modalBottomBar}>
            <BottomButton
              label={saving ? t('myClosetBuyer.saving') : isEdit ? t('myClosetBuyer.updateAddressButton') : t('myClosetBuyer.saveAddressButton')}
              onPress={saving ? undefined : handleSave}
              accentColor={accent}
            />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Screens
// ─────────────────────────────────────────────────────────────────────────────

const MyClosetBuyerItemsScreen = ({ navigation, route }) => {
  const { bgStyle, text } = useClosetTheme(route);
  const { t } = useLanguage();
  const [items, setItems] = useState(() => getRouteItems(route, t));
  const [loading, setLoading] = useState(false);
  const seller = useMemo(() => route?.params?.seller || {}, [route?.params?.seller]);
  const sellerId = route?.params?.sellerId || seller?.id;
  const accent = text;
  const returnTo = route?.params?.returnTo;

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
      const normalized = normalizeItems(nextItems, t);
      prefetchImageUrls(nextItems);
      setItems(normalized);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [items.length, sellerId, t]);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems]),
  );

  const openItem = useCallback(
    item => {
      navigation.navigate('MyClosetBuyerItemDetail', withClosetNavParams(route, {
        item: item.raw || item,
        seller,
        sellerId,
        items: route?.params?.items || items.map(row => row.raw || row),
        isOwnProfile: route?.params?.isOwnProfile,
      }));
    },
    [items, navigation, route, seller, sellerId],
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
      <Header navigation={navigation} title={t('myClosetBuyer.myClosetTitle')} returnTo={returnTo} />
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
                {t('myClosetBuyer.closetItemsHeading', {
                  name: seller?.displayName || seller?.userName || t('myClosetBuyer.closetFallback'),
                })}
              </Text>
              <Text style={styles.listSubtitle}>
                {t('myClosetBuyer.itemsAvailable', { count: items.length })}
              </Text>
            </View>
          )}
          ListEmptyComponent={(
            <View style={styles.emptyState}>
              <Ionicons name="shirt-outline" size={34} color="#c4b5d4" />
              <Text style={styles.emptyTitle}>{t('myClosetBuyer.noItemsAvailable')}</Text>
              <Text style={styles.emptyText}>
                {t('myClosetBuyer.noItemsAvailableText')}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

const MyClosetBattlesScreen = ({ navigation, route }) => {
  const { bgStyle, text: accent } = useClosetTheme(route);
  const { t } = useLanguage();
  const closetId = route?.params?.closetId;
  const isOwnProfile = route?.params?.isOwnProfile ?? false;
  const returnTo = route?.params?.returnTo;

  const [battles, setBattles] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const LIMIT = 10;

  const loadPage = useCallback(async (pageToLoad, replace = false) => {
    if (!closetId) return;
    try {
      const res = await getClosetBattlesPriority(closetId, { page: pageToLoad, limit: LIMIT });
      console.log('loadPage res:', res);
      const raw = unwrapBattlesResponse(res);
      const mapped = raw.map(mapBattle);
      setBattles(prev => (replace ? mapped : [...prev, ...mapped]));
      setHasMore(mapped.length === LIMIT);
    } catch {
      if (replace) setBattles([]);
      setHasMore(false);
    }
  }, [closetId]);

  const openBattle = useCallback((battle) => {
    navigateToBattleLive(navigation, withClosetNavParams(route, {
      battleId: battle?.id,
      initialBattle: battle,
      selectedItems: [battle?.left, battle?.right].filter(Boolean),
      returnToProfile: buildClosetReturnTo({
        isOwnProfile,
        sellerProfile: route?.params?.seller?.profile || route?.params?.sellerProfile,
        sellerId: route?.params?.seller?.id || route?.params?.sellerId,
      }),
    }));
  }, [navigation, isOwnProfile, route, route?.params?.seller?.id, route?.params?.seller?.profile, route?.params?.sellerId, route?.params?.sellerProfile]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setPage(1);
      loadPage(1, true).finally(() => setLoading(false));
    }, [loadPage]),
  );

  const loadMore = async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    await loadPage(nextPage, false);
    setPage(nextPage);
    setLoadingMore(false);
  };

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <Header navigation={navigation} title={t('myClosetShopFront.battlePicksTitle')} returnTo={returnTo} />
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={accent} />
        </View>
      ) : (
        <FlatList
          data={battles}
          keyExtractor={b => b.id}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 16 }}>
              <BattleSlide battle={item} accent={accent} t={t} onPress={() => openBattle(item)} />
            </View>
          )}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListFooterComponent={loadingMore ? (
            <View style={{ paddingVertical: 16 }}>
              <ActivityIndicator color={accent} />
            </View>
          ) : null}
          ListEmptyComponent={(
            <View style={styles.emptyState}>
              <Ionicons name="flash-outline" size={34} color="#c4b5d4" />
              <Text style={styles.emptyTitle}>{t('battleHub.noBattlesYet') || 'No battles yet'}</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

const MyClosetBuyerItemDetailScreen = ({ navigation, route }) => {
  const { text, bgStyle } = useClosetTheme(route);
  const { t } = useLanguage();
  const item = normalizeItem(route?.params?.item || {}, 0, t);
  const seller = route?.params?.seller || {};
  const isOwnProfile = route?.params?.isOwnProfile ?? false;
  const returnTo = route?.params?.returnTo;
  const [liked, setLiked] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [detailScrollEnabled, setDetailScrollEnabled] = useState(true);
  const isOutOfStock = Number(item.quantityAvailable) <= 0;
  const productId = item.raw?.id || item.raw?._id || item.id;

  useEffect(() => {
    let active = true;
    const loadWishlistState = async () => {
      if (!productId) return;
      try {
        const response = await getWishlist(route?.params?.sellerId);
        if (!active) return;
        const wishlistItems = unwrapWishlistItems(response);
        const match = wishlistItems.some(w => String(wishlistItemProductId(w)) === String(productId));
        setLiked(match);
      } catch {
        if (active) setLiked(false);
      }
    };
    loadWishlistState();
    return () => { active = false; };
  }, [productId, route?.params?.sellerId]);

  const handleWishlistPress = async () => {
    if (!productId || wishlistLoading) return;
    setWishlistLoading(true);
    try {
      if (liked) {
        const response = await getWishlist(route?.params?.sellerId);
        const wishlistItems = unwrapWishlistItems(response);
        const match = wishlistItems.find(w => String(wishlistItemProductId(w)) === String(productId));
        if (match) {
          await deleteWishlistItem(match.id || match._id || match.wishlistItemId || match.wishlistId);
        }
        setLiked(false);
      } else {
        await addWishlistItem(productId);
        setLiked(true);
      }
    } catch (err) {
      Alert.alert(t('myClosetBuyer.errorTitle'), err?.response?.data?.message || 'Could not update wishlist.');
    } finally {
      setWishlistLoading(false);
    }
  };

  const goOptions = () => {
    navigation.navigate('MyClosetBuyerOptions', withClosetNavParams(route, {
      item: item.raw,
      seller,
      sellerId: route?.params?.sellerId,
      items: route?.params?.items || [],
    }));
  };

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <Header
        navigation={navigation}
        title={t('myClosetBuyer.myClosetTitle')}
        rightIcon={liked ? 'heart' : 'heart-outline'}
        onRightPress={handleWishlistPress}
        returnTo={returnTo}
      />
      <ScrollView
        contentContainerStyle={styles.detailContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={detailScrollEnabled}
      >
        <DetailImageCarousel
          images={item.images}
          accentColor={text}
          onZoomChange={zoomed => setDetailScrollEnabled(!zoomed)}
        />
        <Text style={styles.detailName}>{item.name}</Text>
        <Text style={[styles.detailPrice, { color: text }]}>{item.price}</Text>
        {/* <SellerCard seller={seller} accentColor={text} /> */}
        <Text style={styles.sectionLabel}>{t('myClosetBuyer.description')}</Text>
        <Text style={styles.description}>{item.description}</Text>
        <View style={styles.attributeList}>
          {[
            { icon: 'shield-checkmark-outline', label: t('myClosetBuyer.condition'), value: item.condition },
            { icon: 'pricetag-outline', label: t('myClosetBuyer.brand'), value: item.brand },
            { icon: 'albums-outline', label: t('myClosetBuyer.category'), value: item.category },
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
          <BottomButton
            label={isOutOfStock ? 'Out of stock' : t('myClosetBuyer.buyNow')}
            onPress={goOptions}
            accentColor={text}
            disabled={isOutOfStock}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const MyClosetBuyerOptionsScreen = ({ navigation, route }) => {
  const { text, bgStyle } = useClosetTheme(route);
  const { t } = useLanguage();
  const returnTo = route?.params?.returnTo;
  const item = normalizeItem(route?.params?.item || {}, 0, t);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);
  const [syncingQty, setSyncingQty] = useState(false);
  const [existingCartItemId, setExistingCartItemId] = useState(null);
  const available = Math.max(1, item.quantityAvailable);

  const productId = item.raw?.id || item.raw?._id || item.id;

  useFocusEffect(
    useCallback(() => {
      if (!productId) return;
      let cancelled = false;
      (async () => {
        setSyncingQty(true);
        try {
          const dataToSend = { sellerId: route?.params?.sellerId }
          const response = await getCart(dataToSend);
          if (cancelled) return;
          const cartsArr = response?.data?.carts ?? [];
          const cartObj = cartsArr[0] ?? null;
          const cartItems = cartObj?.cartItems ?? [];
          const match = Array.isArray(cartItems)
            ? cartItems.find(ci => {
              const pid = ci?.product?.id || ci?.product?._id || ci?.productId;
              return String(pid) === String(productId);
            })
            : null;
          if (match) {
            setQuantity(Math.max(1, Math.min(available, Number(match.quantity) || 1)));
            setExistingCartItemId(match.id);
          } else {
            setExistingCartItemId(null);
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

  const goCart = async () => {
    if (!productId) {
      navigation.navigate('MyClosetBuyerCart', withClosetNavParams(route, {
        item: item.raw,
        seller: route?.params?.seller || {},
        sellerId: route?.params?.sellerId,
        items: route?.params?.items || [],
        quantity,
        note,
      }));
      return;
    }
    setAdding(true);
    try {
      if (existingCartItemId) {
        await updateCartItem(existingCartItemId, { quantity });
      } else {
        await addCartItem({ productId, quantity });
      }
    } catch (err) {
      setAdding(false);
      Alert.alert(t('myClosetBuyer.errorTitle'), err?.response?.data?.message || t('myClosetBuyer.addToCartError'));
      return;
    } finally {
      setAdding(false);
    }
    navigation.navigate('MyClosetBuyerCart', withClosetNavParams(route, {
      item: item.raw,
      seller: route?.params?.seller || {},
      sellerId: route?.params?.sellerId,
      items: route?.params?.items || [],
      quantity,
      note,
    }));
  };

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <Header
        navigation={navigation}
        title={t('myClosetBuyer.selectOptions')}
        rightIcon="close"
        onRightPress={() => goBack(navigation, returnTo)}
        returnTo={returnTo}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.formContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={24}
      >
        <View style={styles.optionProductRow}>
          <ImageBox uri={item.image} style={styles.optionThumb} iconSize={22} />
          <View>
            <Text style={styles.optionName}>{item.name}</Text>
            <Text style={styles.optionPrice}>{item.price}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>{t('myClosetBuyer.quantity')}</Text>
        <Text style={styles.helperText}>{t('myClosetBuyer.quantityHelper')}</Text>
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
        <Text style={styles.availabilityText}>{t('myClosetBuyer.onlyAvailable', { count: available })}</Text>

        <Text style={styles.sectionLabel}>{t('myClosetBuyer.addNoteOptional')}</Text>
        <View style={styles.noteBox}>
          <TextInput
            value={note}
            onChangeText={setNote}
            maxLength={100}
            multiline
            placeholder={t('myClosetBuyer.notePlaceholder')}
            placeholderTextColor="#a8a0b3"
            style={styles.noteInput}
            editable={!adding && !syncingQty}
          />
          <Text style={styles.counterText}>{note.length}/100</Text>
        </View>
      </KeyboardAwareScrollView>
      <View style={styles.bottomBar}>
        <BottomButton
          label={adding ? t('myClosetBuyer.adding') : syncingQty ? t('myClosetBuyer.loading') : t('myClosetBuyer.addToCart')}
          onPress={(adding || syncingQty) ? undefined : goCart}
          accentColor={text}
        />
      </View>
    </SafeAreaView>
  );
};

const SHIPPING_CHOICE_META = {
  [SHIP_OPTION_SHIP]: {
    icon: 'cube-outline',
    titleKey: 'myClosetBuyer.shipChoiceTitle',
    rows: [
      { icon: 'location-outline', textKey: 'myClosetBuyer.shipChoiceRow1' },
      { icon: 'car-outline', textKey: 'myClosetBuyer.shipChoiceRow2' },
    ],
  },
  [SHIP_OPTION_LOCAL]: {
    icon: 'storefront-outline',
    titleKey: 'myClosetBuyer.localChoiceTitle',
    rows: [
      { icon: 'walk-outline', textKey: 'myClosetBuyer.localChoiceRow1' },
      { icon: 'cash-outline', textKey: 'myClosetBuyer.localChoiceRow2' },
    ],
  },
};

const ShippingChoiceCard = ({ choice, selected, onPress, disabled, accentColor }) => {
  const { text: fallbackAccent, bgStyle } = useAppTheme();
  const text = accentColor || fallbackAccent;
  const { t } = useLanguage();
  const meta = SHIPPING_CHOICE_META[choice];
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.shipChoiceCard,
        selected && { borderColor: text },
        // bgStyle
      ]}
    >
      <View style={styles.shipChoiceHeaderRow}>
        <Ionicons name={meta.icon} size={18} color={text} />
        <Text style={styles.shipChoiceTitle}>{t(meta.titleKey)}</Text>
        <View style={[styles.shipChoiceCheck, selected && { backgroundColor: text, borderColor: text }]}>
          {selected ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
        </View>
      </View>
      {meta.rows.map(row => (
        <View key={row.textKey} style={styles.shipChoiceDetailRow}>
          <Ionicons name={row.icon} size={12} color={MUTED} />
          <Text style={styles.shipChoiceDetailText}>{t(row.textKey)}</Text>
        </View>
      ))}
    </TouchableOpacity>
  );
};

// One row per cart item that needs an explicit choice (shippingOption === 'both')
const ItemShippingChoicePicker = ({ item, selectedChoice, onSelect, loading, text }) => {
  const { t } = useLanguage();
  return (
    <View style={styles.shipChoiceItemBlock}>
      <Text style={styles.shipChoiceItemName} numberOfLines={1}>
        Item -
        <Text style={{ color: text }}> {item?.product?.name || item?.product?.title || t('myClosetBuyer.itemFallback')}</Text>
      </Text>
      <View style={styles.shipChoiceCardsRow}>
        {[SHIP_OPTION_SHIP, SHIP_OPTION_LOCAL].map(choice => (
          <ShippingChoiceCard
            key={choice}
            choice={choice}
            selected={selectedChoice === choice}
            disabled={loading}
            onPress={() => onSelect(item.id, choice)}
            accentColor={text}
          />
        ))}
      </View>
      {loading ? <ActivityIndicator size="small" style={{ marginTop: 6 }} /> : null}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Cart screen — GET /cart on mount, PATCH quantity, DELETE item, DELETE /cart
// ─────────────────────────────────────────────────────────────────────────────
const MyClosetBuyerCartScreen = ({ navigation, route }) => {
  const [closetId, setClosetId] = useState(null);
  const [shippingOptionsMap, setShippingOptionsMap] = useState({});
  const [shippingChoiceLoading, setShippingChoiceLoading] = useState(null);
  const [cartId, setCartId] = useState(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const { text, bgStyle } = useClosetTheme(route);
  const toast = useToast();
  const { t } = useLanguage();
  const returnTo = route?.params?.returnTo;
  const localCart = buildCart(route, t); // fallback data from route params

  // ── Server cart state ───────────────────────────────────────────────────
  const [cartItems, setCartItems] = useState([]); // array of items from GET /cart
  const [cartLoading, setCartLoading] = useState(true);
  const [cartError, setCartError] = useState(null);
  const [wishlistItems, setWishlistItems] = useState([]);
  const [wishlistLoading, setWishlistLoading] = useState(true);
  const [wishlistActionLoading, setWishlistActionLoading] = useState(null);
  const [wishlistCountOverride, setWishlistCountOverride] = useState(null);

  // Per-item action loading (cartItemId being updated/deleted)
  const [itemActionLoading, setItemActionLoading] = useState(null);
  const [clearingCart, setClearingCart] = useState(false);
  const [pickupAddressMap, setPickupAddressMap] = useState({});

  // ── GET /cart ─────────────────────────────────────────────────────────
  const fetchCart = useCallback(async () => {
    setCartLoading(true);
    setCartError(null);
    try {
      const dataToSend = { sellerId: route?.params?.sellerId };
      const response = await getCart(dataToSend);
      const cartsArr = response?.data?.data?.carts ?? response?.data?.carts ?? [];
      const cartObj = cartsArr[0] ?? null;
      const items = cartObj?.cartItems ?? [];
      setCartItems(Array.isArray(items) ? items : []);
      setClosetId(cartObj?.closetId ?? null);
      setCartId(cartObj?.id ?? null);

      // Pull the seller's items so we know each product's shipping option.
      if (cartObj?.closetId) {
        try {
          const closetRes = await getClosetItemsByClosetId(cartObj.closetId);
          const closetItems = closetRes?.data?.data ?? closetRes?.data ?? [];
          console.log('[DEBUG] raw closet item sample:', JSON.stringify(closetItems[0], null, 2));

          const map = {};
          const pickupMap = {};
          (Array.isArray(closetItems) ? closetItems : []).forEach(ci => {
            const pid = ci?.id || ci?._id;
            if (pid) {
              map[pid] = ci?.shippingOption ?? ci?.shippingOptions ?? SHIP_OPTION_SHIP;
              pickupMap[pid] = {
                pickupAddress: ci?.pickupAddress || '',
                pickupAvailableHours: ci?.pickupAvailableHours || '',
                sellerName: ci?.shopName || ci?.sellerName || '',
                itemName: ci?.name || ci?.title || '',
              };
            }
          });
          console.log('[DEBUG] shippingOptionsMap:', map);
          console.log('[DEBUG] cartItems productIds:', cartItems.map(ci => ({ id: ci.id, productId: cartItemProductId(ci) })));
          setShippingOptionsMap(map);
          setPickupAddressMap(pickupMap);
        } catch {
          setShippingOptionsMap({}); // non-fatal, falls back to ship-only per item
          setPickupAddressMap({});
        }
      } else {
        setShippingOptionsMap({});
        setPickupAddressMap({});
      }
    } catch (err) {
      setCartError(t('myClosetBuyer.cartLoadError'));
    } finally {
      setCartLoading(false);
    }
  }, [t, route?.params?.sellerId]);

  const fetchWishlist = useCallback(async () => {
    setWishlistLoading(true);
    try {
      const response = await getWishlist(route?.params?.sellerId);
      const wishlistRecord = getWishlistRecordForSeller(response, route?.params?.sellerId);
      const rawWishlistItems = wishlistRecord?.wishlistItems ?? [];
      let populatedItems = [...rawWishlistItems];

      if (rawWishlistItems.length > 0) {
        try {
          let closetItems = [];
          if (wishlistRecord?.closetId) {
            const closetRes = await getClosetItemsByClosetId(wishlistRecord.closetId);
            closetItems = closetRes?.data?.data ?? closetRes?.data?.items ?? closetRes?.data ?? [];
          }
          if (!closetItems.length) {
            const sellerIdToUse = route?.params?.sellerId || wishlistRecord?.sellerId;
            if (sellerIdToUse) {
              const closetRes = await getMyClosetItems(sellerIdToUse);
              closetItems = closetRes?.data?.data ?? closetRes?.data?.items ?? closetRes?.data ?? [];
            }
          }

          if (closetItems.length > 0) {
            populatedItems = rawWishlistItems.map(item => {
              const match = closetItems.find(
                ci => String(ci?.id || ci?._id) === String(item?.productId)
              );
              if (match) {
                return {
                  ...item,
                  product: match,
                };
              }
              return item;
            });
          }
        } catch (fetchErr) {
          console.log('[DEBUG] Failed to fetch closet items for wishlist population', fetchErr);
        }
      }

      setWishlistItems(populatedItems);
      setWishlistCountOverride(null);
    } catch (err) {
      setWishlistItems([]);
      setWishlistCountOverride(null);
    } finally {
      setWishlistLoading(false);
    }
  }, [route?.params?.sellerId]);

  useFocusEffect(
    useCallback(() => {
      fetchCart();
      fetchWishlist();
    }, [fetchCart, fetchWishlist]),
  );

  // ── PATCH /cart/items/{cartItemId} — update quantity ──────────────────
  const handleQtyChange = async (cartItemId, delta, currentQty, maxQty) => {
    // If already at 1 and decrementing → remove the item and go back if cart becomes empty
    if (delta === -1 && currentQty === 1) {
      const targetItem = cartItems.find(ci => ci.id === cartItemId);
      const name = targetItem?.product?.name || targetItem?.name || t('myClosetBuyer.thisItemFallback');
      Alert.alert(
        t('myClosetBuyer.removeItemTitle'),
        t('myClosetBuyer.removeItemMessage', { name }),
        [
          { text: t('myClosetBuyer.cancel'), style: 'cancel' },
          {
            text: t('myClosetBuyer.remove'),
            style: 'destructive',
            onPress: async () => {
              setItemActionLoading(cartItemId);
              try {
                await deleteCartItem(cartItemId);
                const remaining = cartItems.filter(ci => ci.id !== cartItemId);
                setCartItems(remaining);
                if (remaining.length === 0) {
                  goBack(navigation, returnTo);
                }
              } catch (err) {
                Alert.alert(t('myClosetBuyer.errorTitle'), err?.response?.data?.message || t('myClosetBuyer.removeItemError'));
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
      Alert.alert(t('myClosetBuyer.errorTitle'), err?.response?.data?.message || t('myClosetBuyer.updateQuantityError'));
    } finally {
      setItemActionLoading(null);
    }
  };

  const handleShippingChoiceChange = async (cartItemId, choice) => {
    const target = cartItems.find(ci => ci.id === cartItemId);
    if (!target || target.selectedShippingChoice === choice) return;
    const previous = target.selectedShippingChoice;

    setCartItems(prev =>
      prev.map(ci => (ci.id === cartItemId ? { ...ci, selectedShippingChoice: choice } : ci)),
    );
    setShippingChoiceLoading(cartItemId);
    try {
      await setCartItemShippingChoice(cartItemId, choice);
    } catch (err) {
      setCartItems(prev =>
        prev.map(ci => (ci.id === cartItemId ? { ...ci, selectedShippingChoice: previous } : ci)),
      );
      Alert.alert(
        t('myClosetBuyer.errorTitle'),
        err?.response?.data?.message || t('myClosetBuyer.updateShippingChoiceError'),
      );
    } finally {
      setShippingChoiceLoading(null);
    }
  };

  const requiresShipping = cartRequiresShipping(cartItems, shippingOptionsMap);

  // ── DELETE /cart/items/{cartItemId} — remove single item ─────────────
  const handleRemoveItem = cartItem => {
    const name = cartItem?.product?.name || cartItem?.name || t('myClosetBuyer.thisItemFallback');
    Alert.alert(
      t('myClosetBuyer.removeItemTitle'),
      t('myClosetBuyer.removeItemMessage', { name }),
      [
        { text: t('myClosetBuyer.cancel'), style: 'cancel' },
        {
          text: t('myClosetBuyer.remove'),
          style: 'destructive',
          onPress: async () => {
            setItemActionLoading(cartItem.id);
            try {
              await deleteCartItem(cartItem.id);
              setCartItems(prev => prev.filter(ci => ci.id !== cartItem.id));
            } catch (err) {
              Alert.alert(t('myClosetBuyer.errorTitle'), err?.response?.data?.message || t('myClosetBuyer.removeItemError'));
            } finally {
              setItemActionLoading(null);
            }
          },
        },
      ],
    );
  };

  const handleWishlistToggle = async item => {
    const productId = wishlistItemProductId(item);
    if (!productId) return;
    const existing = wishlistItems.find(w => String(wishlistItemProductId(w)) === String(productId));
    setWishlistActionLoading(productId);
    try {
      if (existing) {
        const prevItems = [...wishlistItems];
        setWishlistCountOverride(prev => {
          const currentCount = prev !== null ? prev : prevItems.length;
          return Math.max(0, currentCount - 1);
        });
        setWishlistItems(prev => prev.filter(w => (w?.id || w?._id) !== (existing?.id || existing?._id)));
        try {
          await deleteWishlistItem(existing.id || existing._id || existing.wishlistItemId || existing.wishlistId);
        } catch (apiErr) {
          setWishlistItems(prevItems);
          setWishlistCountOverride(prev => (prev !== null ? prev + 1 : null));
          throw apiErr;
        }
      } else {
        await addWishlistItem(productId);
        await fetchWishlist();
      }
    } catch (err) {
      Alert.alert(t('myClosetBuyer.errorTitle'), err?.response?.data?.message || t('myClosetBuyer.updateWishlistError'));
    } finally {
      setWishlistActionLoading(null);
    }
  };

  const handleAddWishlistToCart = async item => {
    const productId = wishlistItemProductId(item);
    if (!productId) return;
    const quantity = Math.max(1, Number(item?.quantity || 1));
    try {
      const response = await addCartItem({ productId, quantity });
      console.log('[DEBUG] addCartItem response:', response);
      if (response?.statusCode === 200 || response?.statusCode === 201) {
        await fetchCart();
      }
      else {
        showToastMessage(toast, 'danger', response?.message || t('myClosetBuyer.addToCartError'));
      }
    } catch (err) {
      Alert.alert(t('myClosetBuyer.errorTitle'), err?.response?.data?.message || t('myClosetBuyer.addToCartError'));
    }
  };

  // ── DELETE /cart — clear entire cart ─────────────────────────────────
  const handleClearCart = () => {
    Alert.alert(
      t('myClosetBuyer.clearCartTitle'),
      t('myClosetBuyer.clearCartMessage'),
      [
        { text: t('myClosetBuyer.cancel'), style: 'cancel' },
        {
          text: t('myClosetBuyer.clearAll'),
          style: 'destructive',
          onPress: async () => {
            setClearingCart(true);
            try {
              await clearCart();
              setCartItems([]);
            } catch (err) {
              Alert.alert(t('myClosetBuyer.errorTitle'), err?.response?.data?.message || t('myClosetBuyer.clearCartError'));
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

  const handleProceed = async () => {
    if (!cartId) {
      Alert.alert(t('myClosetBuyer.errorTitle'), t('myClosetBuyer.cartLoadError'));
      return;
    }
    // setCheckingOut(true);
    // try {
    //   const response = await checkoutCart(cartId);
    //   console.log('[DEBUG] checkout breakdown:', response);
    //   const checkout = response?.data?.checkout ?? null;

    //   if (checkout && checkout.isValid === false) {
    //     // Backend flagged an issue (e.g. quantity no longer available, item removed by seller)
    //     const message =
    //       checkout?.issues?.[0]?.message ||
    //       t('myClosetBuyer.checkoutError');
    //     Alert.alert(t('myClosetBuyer.errorTitle'), message);
    //     return;
    //   }

    //   const breakdown = checkout?.breakdown ?? null;
    //   console.log('[DEBUG] checkout breakdown:', JSON.stringify(breakdown, null, 2));
    navigation.navigate('MyClosetBuyerCheckout', withClosetNavParams(route, {
      cartId,
      cartItemsSnapshot: cartItems,
      shippingOptionsMap,
      pickupAddressMap,
      requiresShipping,
    }));
    // } catch (err) {
    //   Alert.alert(
    //     t('myClosetBuyer.errorTitle'),
    //     err?.response?.data?.message || t('myClosetBuyer.checkoutError'),
    //   );
    // } finally {
    //   setCheckingOut(false);
    // }
  };

  const handleOpenShippingStep = () => {
    navigation.navigate(
      'MyClosetBuyerShipping',
      withClosetNavParams(route, {
        cartId,
        cartItemsSnapshot: cartItems,
        shippingOptionsMap,
        pickupAddressMap,
        requiresShipping,
      }),
    );
  };

  const isEmpty = !cartLoading && cartItems.length === 0;
  const wishlistEmpty = !wishlistLoading && wishlistItems.length === 0;

  // ── Helper: resolve image + name from a cart item ────────────────────
  const cartItemImage = ci => imageUri(ci?.product?.images?.[0]) || imageUri(ci?.product?.image) || imageUri(ci?.image) || null;
  const cartItemName = ci => ci?.product?.name || ci?.product?.title || ci?.name || t('myClosetBuyer.itemFallback');
  const cartItemPrice = ci => currency(ci?.product?.price ?? ci?.price ?? 0);
  const cartItemMax = ci => Number(ci?.product?.quantity || ci?.product?.availableQuantity || 99) || 99;

  const totalQuantity = cartItems.reduce(
    (total, item) => total + (item.quantity || 0),
    0,
  );

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <Header
        navigation={navigation}
        title={
          cartLoading
            ? t('myClosetBuyer.cartTitle')
            : t('myClosetBuyer.cartTitleWithCount', {
              count: totalQuantity,
            })
        }
        rightIcon={cartItems.length > 0 ? 'trash-outline' : undefined}
        onRightPress={handleClearCart}
        returnTo={returnTo}
      />

      {cartLoading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={text} />
        </View>
      ) : cartError ? (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={36} color={ERROR_COLOR} />
          <Text style={styles.emptyTitle}>{t('myClosetBuyer.cartLoadErrorTitle')}</Text>
          <Text style={styles.emptyText}>{cartError}</Text>
          <TouchableOpacity onPress={fetchCart} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('myClosetBuyer.retry')}</Text>
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
              <Text style={styles.emptyTitle}>{t('myClosetBuyer.emptyCartTitle')}</Text>
              <Text style={styles.emptyText}>{t('myClosetBuyer.emptyCartText')}</Text>
            </View>
          ) : (
            <>
              {clearingCart ? (
                <View style={styles.cartClearingBanner}>
                  <ActivityIndicator size="small" color={text} />
                  <Text style={[styles.cartClearingText, { color: text }]}>{t('myClosetBuyer.clearingCart')}</Text>
                </View>
              ) : null}

              {cartItems.map(ci => {
                const isActing = itemActionLoading === ci.id;
                const qty = ci.quantity || 1;
                const maxQty = cartItemMax(ci);
                const opt = shippingOptionsMap[cartItemProductId(ci)] ?? SHIP_OPTION_SHIP;
                const shippingLabel =
                  opt === SHIP_OPTION_BOTH
                    ? t('myClosetBuyer.shippingChoosePending')
                    : opt === SHIP_OPTION_LOCAL
                      ? t('myClosetBuyer.localPickup')
                      : t('myClosetBuyer.shipToMe');

                return (
                  <View key={ci.id} style={styles.cartLineCard}>
                    {/* Top-right shipping badge */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={opt === SHIP_OPTION_BOTH ? handleOpenShippingStep : undefined}
                      disabled={opt !== SHIP_OPTION_BOTH}
                      style={styles.shippingBadge}
                    >
                      <Ionicons
                        name={opt === SHIP_OPTION_LOCAL ? 'storefront-outline' : 'cube-outline'}
                        size={11}
                        color={MUTED}
                      />
                      <Text style={styles.shippingBadgeText}>{shippingLabel}</Text>
                    </TouchableOpacity>

                    <ImageBox uri={cartItemImage(ci)} style={styles.cartThumb} iconSize={22} />
                    <View style={styles.cartCopy}>
                      <Text style={styles.cartItemName} numberOfLines={2}>
                        {cartItemName(ci)}
                      </Text>
                      <Text style={[styles.cartPrice, { color: text }]}>{cartItemPrice(ci)}</Text>
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
            </>
          )}

          <View style={styles.wishlistBlock}>
            <View style={styles.wishlistHeader}>
              <Text style={styles.wishlistTitle}>{t('myClosetBuyer.wishlistTitle')}</Text>
              <Text style={styles.wishlistCount}>
                {wishlistLoading ? '...' : `${wishlistCountOverride !== null ? wishlistCountOverride : wishlistItems.length}`}
              </Text>
            </View>

            {wishlistLoading ? (
              <ActivityIndicator color={text} />
            ) : wishlistEmpty ? (
              <Text style={styles.wishlistEmptyText}>{t('myClosetBuyer.wishlistEmpty')}</Text>
            ) : (
              wishlistItems.map(item => {
                const productId = wishlistItemProductId(item);
                const title = item?.product?.name || item?.name || item?.product?.title || t('myClosetBuyer.itemFallback');
                const price = currency(item?.product?.price ?? item?.price ?? 0);
                const thumb = imageUri(item?.product?.images?.[0]) || imageUri(item?.product?.image) || imageUri(item?.image);
                const inCart = cartItems.some(ci => String(cartItemProductId(ci)) === String(productId));
                const busy = wishlistActionLoading === productId;

                return (
                  <View key={String(productId || item.id || item._id)} style={styles.wishlistCard}>
                    <ImageBox uri={thumb} style={styles.wishlistThumb} iconSize={20} />
                    <View style={styles.wishlistCopy}>
                      <Text style={styles.wishlistItemName} numberOfLines={2}>{title}</Text>
                      <Text style={[styles.wishlistPrice, { color: text }]}>{price}</Text>
                    </View>
                    <View style={styles.wishlistActions}>
                      <TouchableOpacity
                        style={styles.wishlistHeartBtn}
                        onPress={() => handleWishlistToggle(item)}
                        disabled={busy}
                      >
                        <Ionicons name="heart" size={18} color="#e11d48" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.wishlistAddBtn, inCart && styles.wishlistAddBtnDisabled]}
                        onPress={() => handleAddWishlistToCart(item)}
                        disabled={inCart}
                      >
                        <Ionicons name="cart-outline" size={16} color={inCart ? '#9ca3af' : text} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {!isEmpty && (
            <>
              <View style={styles.summaryBlock}>
                <SummaryRow
                  label={t('myClosetBuyer.itemTotal')}
                  value={currency(computedItemTotal)}
                  accentColor={text}
                />
                <SummaryRow
                  label={t('myClosetBuyer.total')}
                  value={currency(total)}
                  bold
                  accentColor={text}
                />
              </View>

              <View style={styles.protectionCard}>
                <View style={styles.protectionIcon}>
                  <Ionicons name="shield-checkmark-outline" size={24} color={text} />
                </View>
                <Text style={[styles.protectionText, { color: text }]}>
                  {t('myClosetBuyer.purchaseProtection')}
                </Text>
                <Ionicons name="information-circle-outline" size={16} color="#8b5e9f" />
              </View>
            </>
          )}
        </ScrollView>
      )}

      {!isEmpty && !cartLoading && !cartError && (
        <View style={styles.bottomBar}>
          <BottomButton
            label={checkingOut ? t('myClosetBuyer.loading') : t('myClosetBuyer.continueShopping')}
            onPress={checkingOut ? undefined : handleProceed}
            accentColor={text}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const MyClosetBuyerCheckoutScreen = ({ navigation, route }) => {
  const { t } = useLanguage();
  const { bgStyle, text } = useClosetTheme(route);
  const returnTo = route?.params?.returnTo;
  const cart = buildCart(route, t);
  const derivedRequiresShipping = cartRequiresShipping(route?.params?.cartItemsSnapshot, route?.params?.shippingOptionsMap);
  const requiresShipping = derivedRequiresShipping || route?.params?.requiresShipping === true;
  const [continuing, setContinuing] = useState(false);

  const handleEditCart = () => navigation.navigate('MyClosetBuyerCart', withClosetNavParams(route));

  const handleContinue = async () => {
    const cartId = route?.params?.cartId;
    if (!cartId) {
      navigation.navigate('MyClosetBuyerShipping', withClosetNavParams(route));
      return;
    }

    setContinuing(true);
    try {
      const response = await checkoutCart(cartId);
      const checkout = response?.data?.data?.checkout ?? null;

      if (checkout && checkout.isValid === false) {
        const message = checkout?.issues?.[0]?.message || t('myClosetBuyer.checkoutError');
        Alert.alert(t('myClosetBuyer.errorTitle'), message);
        return;
      }

      const breakdown = checkout?.breakdown ?? null;

      navigation.navigate(
        'MyClosetBuyerShipping',
        withClosetNavParams(route, {
          checkoutData: checkout,
          itemTotal: breakdown?.itemsSubtotal ?? route?.params?.itemTotal,
          shippingAmount: breakdown?.shippingAmount ?? 0,
          total: breakdown?.totalAmountDue ?? route?.params?.total,
        }),
      );
    } catch (err) {
      Alert.alert(
        t('myClosetBuyer.errorTitle'),
        err?.response?.data?.message || t('myClosetBuyer.checkoutError'),
      );
    } finally {
      setContinuing(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <Header navigation={navigation} title={t('myClosetBuyer.checkoutTitle')} returnTo={returnTo} />
      <ScrollView contentContainerStyle={styles.checkoutContent} showsVerticalScrollIndicator={false}>
        <CheckoutSteps current={0} includeShipping={true} accentColor={text} />
        <OrderSummary cart={cart} editable onEditCart={handleEditCart} accentColor={text} />
      </ScrollView>
      <View style={styles.bottomBar}>
        <BottomButton
          label={
            continuing
              ? t('myClosetBuyer.loading')
              : t('myClosetBuyer.continueToShipping')
          }
          onPress={continuing ? undefined : handleContinue}
          accentColor={text}
        />
      </View>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Shipping screen — fetches real addresses from GET /address/getAddress
// ─────────────────────────────────────────────────────────────────────────────
const MyClosetBuyerShippingScreen = ({ navigation, route }) => {
  const { text, bgStyle } = useClosetTheme(route);
  const { t } = useLanguage();
  const toast = useToast();
  const returnTo = route?.params?.returnTo;
  const cart = buildCart(route, t);
  const [method, setMethod] = useState('standard');
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [continuing, setContinuing] = useState(false);

  // Real address list from API
  const [addresses, setAddresses] = useState([]);
  const [addressLoading, setAddressLoading] = useState(true);
  const [addressError, setAddressError] = useState(null);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState(0);
  const [actionLoading, setActionLoading] = useState(null); // addressId being acted upon

  const cartItemsSnapshot = route?.params?.cartItemsSnapshot || [];
  const shippingOptionsMap = route?.params?.shippingOptionsMap || {};
  const pickupAddressMap = route?.params?.pickupAddressMap || {};

  const [shippingChoices, setShippingChoices] = useState(() => {
    const initial = {};
    cartItemsSnapshot.forEach(ci => {
      initial[ci.id] = ci.selectedShippingChoice || null;
    });
    return initial;
  });
  const [choiceLoading, setChoiceLoading] = useState(null);

  // Items where the seller allows both, so the buyer must pick
  const itemsNeedingChoice = cartItemsSnapshot.filter(
    ci => (shippingOptionsMap[cartItemProductId(ci)] ?? SHIP_OPTION_SHIP) === SHIP_OPTION_BOTH,
  );

  const fixedChoiceItems = cartItemsSnapshot.filter(
    ci => (shippingOptionsMap[cartItemProductId(ci)] ?? SHIP_OPTION_SHIP) !== SHIP_OPTION_BOTH,
  );
  // Effective choice per item: explicit pick, or the only option the seller allows
  const effectiveChoice = ci => {
    const opt = shippingOptionsMap[cartItemProductId(ci)] ?? SHIP_OPTION_SHIP;
    if (opt === SHIP_OPTION_BOTH) return shippingChoices[ci.id] || null;
    return opt === SHIP_OPTION_LOCAL ? SHIP_OPTION_LOCAL : SHIP_OPTION_SHIP;
  };

  const allChoicesMade = itemsNeedingChoice.every(ci => !!shippingChoices[ci.id]);
  const requiresShipping = cartItemsSnapshot.some(ci => {
    const opt = shippingOptionsMap[cartItemProductId(ci)] ?? SHIP_OPTION_SHIP;
    if (opt === SHIP_OPTION_BOTH) return shippingChoices[ci.id] === SHIP_OPTION_SHIP;
    return opt === SHIP_OPTION_SHIP;
  });
  const pickupItems = cartItemsSnapshot.filter(ci => effectiveChoice(ci) === SHIP_OPTION_LOCAL);
  const pickupLocations = useMemo(() => {
    const seen = new Set();
    return pickupItems
      .map(ci => {
        const product = ci?.product ?? ci ?? {};
        const resolvedPickup = pickupAddressMap[cartItemProductId(ci)] || {};
        const address = resolvedPickup.pickupAddress || product?.pickupAddress || ci?.pickupAddress || null;
        const sellerName =
          resolvedPickup.sellerName ||
          product?.shopName ||
          product?.sellerName ||
          product?.user?.name ||
          '';
        const key = `${sellerName}::${address || ''}`;
        if (!address || seen.has(key)) return null;
        seen.add(key);
        return {
          id: ci.id,
          name: resolvedPickup.itemName || product?.name || product?.title || t('myClosetBuyer.itemFallback'),
          sellerName,
          address,
          hours: resolvedPickup.pickupAvailableHours || product?.pickupAvailableHours || ci?.pickupAvailableHours || null,
        };
      })
      .filter(Boolean);
  }, [pickupItems, pickupAddressMap, t]);

  const handleSelectChoice = async (cartItemId, choice) => {
    const previous = shippingChoices[cartItemId];
    if (previous === choice) return;
    setShippingChoices(prev => ({ ...prev, [cartItemId]: choice }));
    setChoiceLoading(cartItemId);
    try {
      await setCartItemShippingChoice(cartItemId, choice);
    } catch (err) {
      setShippingChoices(prev => ({ ...prev, [cartItemId]: previous }));
      Alert.alert(t('myClosetBuyer.errorTitle'), err?.response?.data?.message || t('myClosetBuyer.updateShippingChoiceError'));
    } finally {
      setChoiceLoading(null);
    }
  };

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
      setAddressError(t('myClosetBuyer.addressLoadError'));
    } finally {
      setAddressLoading(false);
    }
  }, [t]);

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
      t('myClosetBuyer.deleteAddressTitle'),
      t('myClosetBuyer.deleteAddressMessage', { name: addr.fullName, line: addr.addressLine1 }),
      [
        { text: t('myClosetBuyer.cancel'), style: 'cancel' },
        {
          text: t('myClosetBuyer.delete'),
          style: 'destructive',
          onPress: async () => {
            setActionLoading(addr.id);
            try {
              const response = await deleteAddress(addr.id);
              if (response?.statusCode === 200 || response?.statusCode === 201) {
                setAddresses(prev => {
                  const updated = prev.filter(a => a.id !== addr.id);
                  setSelectedAddressIndex(Math.max(0, updated.findIndex(a => a.isDefault)));
                  return updated;
                });
              }
              else {
                Alert.alert(response?.message || t('myClosetBuyer.deleteAddressError'));
              }
            } catch (err) {
              Alert.alert(t('myClosetBuyer.errorTitle'), err?.response?.data?.message || t('myClosetBuyer.deleteAddressError'));
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
      Alert.alert(t('myClosetBuyer.errorTitle'), err?.response?.data?.message || t('myClosetBuyer.setDefaultAddressError'));
    } finally {
      setActionLoading(null);
    }
  };

  const selectedAddress = addresses[selectedAddressIndex] ?? null;
  const isAddressComplete = !!(
    selectedAddress &&
    String(selectedAddress.fullName || '').trim() &&
    String(selectedAddress.phoneNumber || '').trim() &&
    String(selectedAddress.addressLine1 || '').trim() &&
    String(selectedAddress.city || '').trim()
  );
  const canContinue = !continuing && allChoicesMade && (!requiresShipping || isAddressComplete);

  const nextCart = {
    ...route.params,
    shipping: method === 'express' ? 20 : 10,
    total: cart.itemTotal /*+ (method === 'express' ? 20 : 10) + cart.serviceFee*/,
    shippingMethod: method,
    // Pass selected address forward so Review screen can display it
    shippingAddress: selectedAddress,
  };

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <Header navigation={navigation} title={t('myClosetBuyer.shippingInformationTitle')} returnTo={returnTo} />
      <ScrollView
        contentContainerStyle={styles.checkoutContent}
        showsVerticalScrollIndicator={false}
      >
        <CheckoutSteps current={1} accentColor={text} />

        {(itemsNeedingChoice.length > 0 || fixedChoiceItems.length > 0) && (
          <>
            <Text style={styles.sectionLabel}>{t('myClosetBuyer.chooseShippingTitle')}</Text>

            {/* Items where buyer must actively choose */}
            {itemsNeedingChoice.map(ci => (
              <ItemShippingChoicePicker
                text={text}
                key={ci.id}
                item={ci}
                selectedChoice={shippingChoices[ci.id]}
                onSelect={handleSelectChoice}
                loading={choiceLoading === ci.id}
              />
            ))}

            {/* Items where the seller already fixed the option — show it read-only so it's clear */}
            {fixedChoiceItems.map(ci => {
              const opt = shippingOptionsMap[cartItemProductId(ci)] ?? SHIP_OPTION_SHIP;
              const name = ci?.product?.name || ci?.product?.title || t('myClosetBuyer.itemFallback');
              return (
                <View key={ci.id} style={{ marginBottom: 12 }}>
                  <Text style={styles.shipChoiceItemName} numberOfLines={1}>Item -
                    <Text style={{ color: text }}> {name}</Text></Text>
                  <FixedShippingBadge
                    choice={opt === SHIP_OPTION_LOCAL ? SHIP_OPTION_LOCAL : SHIP_OPTION_SHIP}
                    accentColor={text}
                  />
                </View>
              );
            })}
          </>
        )}

        {requiresShipping && (
          <>
            <Text style={styles.sectionLabel}>{t('myClosetBuyer.shippingAddress')}</Text>

            {/* ── Address list states ── */}
            {addressLoading ? (
              <View style={styles.addressLoader}>
                <ActivityIndicator size="small" color={text} />
                <Text style={styles.addressLoaderText}>{t('myClosetBuyer.loadingAddresses')}</Text>
              </View>
            ) : addressError ? (
              <View style={styles.addressErrorBox}>
                <Ionicons name="alert-circle-outline" size={18} color={ERROR_COLOR} />
                <Text style={styles.addressErrorText}>{addressError}</Text>
                <TouchableOpacity onPress={fetchAddresses} style={styles.retryButton}>
                  <Text style={styles.retryText}>{t('myClosetBuyer.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : addresses.length === 0 ? (
              <View style={styles.noAddressBox}>
                <Ionicons name="location-outline" size={32} color="#c4b5d4" />
                <Text style={styles.noAddressTitle}>{t('myClosetBuyer.noSavedAddresses')}</Text>
                <Text style={styles.noAddressText}>{t('myClosetBuyer.addAddressToContinue')}</Text>
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
                              <Text style={[styles.defaultBadgeText, { color: text }]}>{t('myClosetBuyer.defaultBadge')}</Text>
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
                        <Text style={[styles.addressActionText, { color: text }]}>{t('myClosetBuyer.edit')}</Text>
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
                        <Text style={[styles.addressActionText, { color: ERROR_COLOR }]}>{t('myClosetBuyer.delete')}</Text>
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
                              {t('myClosetBuyer.setDefault')}
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
              <Text style={[styles.addAddressText, { color: text }]}>{t('myClosetBuyer.addNewAddress')}</Text>
            </TouchableOpacity>

          </>
        )}

        {pickupLocations.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>{t('myClosetBuyer.pickupAddress')}</Text>
            {pickupLocations.map(location => (
              <View key={`${location.id}-${location.address}`} style={styles.reviewCard}>
                {/* <Text style={styles.addressName}>{location.name}</Text> */}
                {location.sellerName ? (
                  <Text style={styles.addressPhone}>{location.sellerName}</Text>
                ) : null}
                <Text style={styles.addressText}>{location.address}</Text>
                {location.hours ? <Text style={styles.addressText}>{location.hours}</Text> : null}
              </View>
            ))}
          </>
        ) : null}

        {/* <Text style={styles.sectionLabel}>{t('myClosetBuyer.shippingMethod')}</Text>
        {[
          { key: 'standard', label: t('myClosetBuyer.standardShipping'), price: 10 },
          { key: 'express', label: t('myClosetBuyer.expressShipping'), price: 20 },
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
        ))} */}
      </ScrollView>

      <View style={styles.bottomBar}>
        <BottomButton
          label={continuing ? t('myClosetBuyer.loading') : t('myClosetBuyer.continueToPayment')}
          accentColor={text}
          disabled={!canContinue}
          onPress={canContinue ? async () => {
            if (!allChoicesMade) {
              Alert.alert(t('myClosetBuyer.selectShippingTitle'), t('myClosetBuyer.selectShippingMessage'));
              return;
            }
            if (requiresShipping && !isAddressComplete) {
              Alert.alert(t('myClosetBuyer.selectAddressTitle'), t('myClosetBuyer.selectAddressMessage'));
              return;
            }

            const cartId = route?.params?.cartId;
            if (!cartId) {
              navigation.navigate('MyClosetBuyerPayment', withClosetNavParams(route, { ...nextCart, requiresShipping }));
              return;
            }

            setContinuing(true);
            try {
              const response = await checkoutCart(cartId);
              const checkout = response?.data?.data?.checkout ?? null;

              if (checkout && checkout.isValid === false) {
                const message = checkout?.issues?.[0]?.message || t('myClosetBuyer.checkoutError');
                Alert.alert(t('myClosetBuyer.errorTitle'), message);
                return;
              }

              const breakdown = checkout?.breakdown ?? null;

              navigation.navigate('MyClosetBuyerPayment', withClosetNavParams(route, {
                ...nextCart,
                requiresShipping,
                checkoutData: checkout,
                itemTotal: breakdown?.itemsSubtotal ?? nextCart?.itemTotal,
                shippingAmount: breakdown?.shippingAmount ?? 0,
                total: breakdown?.totalAmountDue ?? nextCart?.total,
              }));
            } catch (err) {
              Alert.alert(
                t('myClosetBuyer.errorTitle'),
                err?.response?.data?.message || t('myClosetBuyer.checkoutError'),
              );
            } finally {
              setContinuing(false);
            }
          } : undefined}
        />
      </View>

      <AddAddressModal
        visible={showAddressModal}
        onClose={() => { setShowAddressModal(false); setEditingAddress(null); }}
        onSaved={editingAddress ? handleAddressUpdated : handleAddressSaved}
        editAddress={editingAddress}
        accentColor={text}
      />
    </SafeAreaView>
  );
};

const MyClosetBuyerPaymentScreen = ({ navigation, route }) => {
  const { text, bgStyle } = useClosetTheme(route);
  const { t } = useLanguage();
  const returnTo = route?.params?.returnTo;
  const [paymentMethod, setPaymentMethod] = useState('secure');
  const derivedRequiresShipping = cartRequiresShipping(route?.params?.cartItemsSnapshot, route?.params?.shippingOptionsMap);
  const requiresShipping = derivedRequiresShipping || route?.params?.requiresShipping === true;
  const cartId = route?.params?.cartId;

  // If we already have fresh checkout data (breakdown), use it as-is.
  // Otherwise, fetch it ourselves so the fee/tax/total are never stale or missing.
  const [checkoutData, setCheckoutData] = useState(route?.params?.checkoutData ?? null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(!route?.params?.checkoutData && !!cartId);
  const [breakdownError, setBreakdownError] = useState(null);

  useEffect(() => {
    if (route?.params?.checkoutData || !cartId) return;
    let cancelled = false;
    (async () => {
      setLoadingBreakdown(true);
      setBreakdownError(null);
      try {
        const response = await checkoutCart(cartId);
        const checkout = response?.data?.checkout ?? null;
        if (!cancelled) setCheckoutData(checkout);
      } catch (err) {
        if (!cancelled) setBreakdownError(t('myClosetBuyer.checkoutError'));
      } finally {
        if (!cancelled) setLoadingBreakdown(false);
      }
    })();
    return () => { cancelled = true; };
  }, [cartId, route?.params?.checkoutData, t]);

  const cart = buildCart({ params: { ...route.params, checkoutData } }, t);

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <Header navigation={navigation} title={t('myClosetBuyer.paymentTitle')} returnTo={returnTo} />
      <ScrollView
        contentContainerStyle={styles.checkoutContent}
        showsVerticalScrollIndicator={false}
      >
        <CheckoutSteps current={2} includeShipping={true} accentColor={text} />
        <Text style={styles.sectionLabel}>{t('myClosetBuyer.paymentMethod')}</Text>
        {[
          { key: 'secure', label: t('myClosetBuyer.secureCheckout'), sub: t('myClosetBuyer.secureCheckoutSub'), icon: 'shield-checkmark-outline' },
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

        {loadingBreakdown ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={text} />
          </View>
        ) : breakdownError ? (
          <View style={styles.addressErrorBox}>
            <Ionicons name="alert-circle-outline" size={18} color={ERROR_COLOR} />
            <Text style={styles.addressErrorText}>{breakdownError}</Text>
          </View>
        ) : (
          <OrderSummary cart={cart} compact accentColor={text} bgStyle={bgStyle} />
        )}
      </ScrollView>
      <View style={styles.bottomBar}>
        <BottomButton
          label={t('myClosetBuyer.continueToReview')}
          accentColor={text}
          onPress={() =>
            navigation.navigate('MyClosetBuyerReview', withClosetNavParams(route, { checkoutData, paymentMethod }))
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
  const { text, bgStyle } = useClosetTheme(route);
  const { t } = useLanguage();
  const returnTo = route?.params?.returnTo;
  const cart = buildCart(route, t);
  const [checking, setChecking] = useState(false);
  // shippingAddress passed from Shipping screen via nextCart
  const addr = route?.params?.shippingAddress ?? null;
  const derivedRequiresShipping = cartRequiresShipping(route?.params?.cartItemsSnapshot, route?.params?.shippingOptionsMap);
  const requiresShipping = derivedRequiresShipping || route?.params?.requiresShipping === true;
  const shipOnlyItemsNeedingSync = useMemo(
    () => getShipOnlyCartItems(route?.params?.cartItemsSnapshot, route?.params?.shippingOptionsMap),
    [route?.params?.cartItemsSnapshot, route?.params?.shippingOptionsMap],
  );

  const findPaymentId = useCallback(async (cartId) => {
    try {
      const response = await getRecentPaymentDetails();
      const list = response?.data?.data ?? response?.data ?? [];
      const payments = Array.isArray(list) ? list : list ? [list] : [];

      // The endpoint only ever returns the single most recent payment, so try to
      // match on cartId (top-level or nested in metadata) but fall back to that
      // one record if no match is found rather than returning null.
      const match =
        payments.find(p => p?.cartId === cartId || p?.metadata?.cartId === cartId) ??
        payments[0] ??
        null;
      return match?.id ?? null;
    } catch {
      return null;
    }
  }, []);

  const pollForPaidPayment = useCallback(async (paymentId, { attempts = 8, delayMs = 1500 } = {}) => {
    for (let i = 0; i < attempts; i += 1) {
      try {
        const response = await getPaymentDetailsByPaymentId(paymentId);
        const payment = response?.data ?? null;
        if (payment?.status === 'PAID') return payment;
      } catch {
        // ignore and retry
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return null;
  }, []);

  const finalizeOrder = useCallback(async (cartId) => {
    setChecking(true);
    try {
      const paymentId = await findPaymentId(cartId);
      if (!paymentId) {
        Alert.alert(t('myClosetBuyer.errorTitle'), t('myClosetBuyer.paymentNotConfirmedError'));
        return;
      }

      const payment = await pollForPaidPayment(paymentId);
      if (!payment) {
        Alert.alert(t('myClosetBuyer.errorTitle'), t('myClosetBuyer.paymentNotConfirmedError'));
        return;
      }

      navigation.navigate('MyClosetBuyerOrderReceived', withClosetNavParams(route, {
        payment,
        orderId: payment.orderId,
      }));
    } finally {
      setChecking(false);
    }
  }, [findPaymentId, pollForPaidPayment, navigation, route.params, t]);

  useEffect(() => {
    const cartId = route?.params?.cartId;
    if (!cartId) return undefined;

    const sub = DeviceEventEmitter.addListener('PAYMENT_COMPLETED', (payload) => {
      if (payload?.status === 'success') {
        finalizeOrder(cartId);
      }
    });
    return () => sub.remove();
  }, [route?.params?.cartId, finalizeOrder]);

  const handleContinue = async () => {
    const cartId = route?.params?.cartId;
    const addressId = addr?.id ?? null;

    if (!cartId) {
      Alert.alert(t('myClosetBuyer.errorTitle'), t('myClosetBuyer.checkoutError'));
      return;
    }
    // addressId is required only when this order actually needs shipping
    if (requiresShipping && !addressId) {
      Alert.alert(t('myClosetBuyer.selectAddressTitle'), t('myClosetBuyer.selectAddressMessage'));
      return;
    }

    setChecking(true);
    try {
      if (shipOnlyItemsNeedingSync.length > 0) {
        await Promise.all(
          shipOnlyItemsNeedingSync.map(item => setCartItemShippingChoice(item.id, SHIP_OPTION_SHIP)),
        );
      }

      const response = await createPaymentSession({
        cartId,
        addressId,
        currency: 'usd',
      });

      console.log('createPaymentSession response:', response);
      const session = response?.data?.data ?? response?.data ?? null;
      const checkoutUrl = session?.url ?? session?.checkoutUrl ?? session?.session?.url ?? null;

      if (!checkoutUrl) {
        Alert.alert(t('myClosetBuyer.errorTitle'), t('myClosetBuyer.checkoutError'));
        return;
      }

      const canOpen = await Linking.canOpenURL(checkoutUrl);
      if (canOpen) {
        if (await InAppBrowser.isAvailable()) {
          const result = await InAppBrowser.open(checkoutUrl, {
            dismissButtonStyle: 'close',
            preferredBarTintColor: '#ffffff',
            preferredControlTintColor: '#000000',
            readerMode: false,
            animated: true,
            modalPresentationStyle: 'fullScreen',
            modalTransitionStyle: 'coverVertical',
            enableBarCollapsing: false,
            showTitle: true,
            toolbarColor: '#ffffff',
            secondaryToolbarColor: '#f0f0f0',
            forceCloseOnRedirection: true,
          });
          // if (result.type === 'dismiss' || result.type === 'cancel') {
          //   startProgressBarAndFetch();
          // }
        } else {
          await Linking.openURL(checkoutUrl);
        }
      } else {
        Alert.alert(t('myClosetBuyer.errorTitle'), t('myClosetBuyer.checkoutError'));
      }
      // Note: actual order confirmation should happen after Stripe redirects back
      // (via deep link / webhook), not immediately here — see note below.
    } catch (err) {
      Alert.alert(t('myClosetBuyer.errorTitle'), err?.response?.data?.message || t('myClosetBuyer.checkoutError'));
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <Header navigation={navigation} title={t('myClosetBuyer.reviewOrderTitle')} returnTo={returnTo} />
      <ScrollView
        contentContainerStyle={styles.checkoutContent}
        showsVerticalScrollIndicator={false}
      >
        <CheckoutSteps current={3} includeShipping={true} accentColor={text} />
        {requiresShipping ? (
          <>
            <View style={styles.reviewSectionHeader}>
              <Text style={styles.sectionLabel}>{t('myClosetBuyer.shippingAddress')}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('MyClosetBuyerShipping', withClosetNavParams(route))}>
                <Text style={[styles.editText, { color: text }]}>{t('myClosetBuyer.edit')}</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.reviewCard, bgStyle, { borderColor: text }]}>
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
                <Text style={styles.addressText}>{t('myClosetBuyer.noAddressSelected')}</Text>
              )}
            </View>
          </>
        ) : (
          <View style={[styles.reviewLineCard, bgStyle, { borderColor: text }]}>
            <Ionicons name="storefront-outline" size={18} color={text} />
            <Text style={styles.radioLabel}>{t('myClosetBuyer.localPickupSelected')}</Text>
          </View>
        )}
        {/* <View style={styles.reviewSectionHeader}>
          <Text style={styles.sectionLabel}>{t('myClosetBuyer.shippingMethod')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('MyClosetBuyerShipping', withClosetNavParams(route))}>
            <Text style={[styles.editText, { color: text }]}>{t('myClosetBuyer.edit')}</Text>
          </TouchableOpacity>
        </View> */}
        {/* <View style={styles.reviewLineCard}>
          <Text style={styles.radioLabel}>
            {route?.params?.shippingMethod === 'express'
              ? t('myClosetBuyer.expressShipping')
              : t('myClosetBuyer.standardShipping')}
          </Text>
          <Text style={styles.radioPrice}>{currency(cart.shipping)}</Text>
        </View> */}
        <View style={styles.reviewSectionHeader}>
          <Text style={styles.sectionLabel}>{t('myClosetBuyer.paymentMethod')}</Text>
          {/* <TouchableOpacity onPress={() => navigation.navigate('MyClosetBuyerPayment', withClosetNavParams(route))}>
            <Text style={[styles.editText, { color: text }]}>{t('myClosetBuyer.edit')}</Text>
          </TouchableOpacity> */}
        </View>
        <View style={[styles.reviewLineCard, { borderColor: text }]}>
          <Ionicons name="shield-checkmark-outline" size={18} color={text} />
          <Text style={styles.radioLabel}>{t('myClosetBuyer.secureCheckout')}</Text>
        </View>
        <OrderSummary cart={cart} compact accentColor={text} />
        <Text style={styles.termsText}>
          {t('myClosetBuyer.termsText')}
        </Text>
      </ScrollView>
      <View style={styles.bottomBar}>
        <BottomButton
          label={checking ? t('myClosetBuyer.confirmingPayment') : t('myClosetBuyer.placeOrder')}
          icon="lock-closed-outline"
          onPress={checking ? undefined : handleContinue}
          accentColor={text}
        />
      </View>
    </SafeAreaView>
  );
};

const MyClosetBuyerOrderReceivedScreen = ({ navigation, route }) => {
  const { text, bgStyle } = useClosetTheme(route);
  const { t } = useLanguage();
  const returnTo = route?.params?.returnTo;
  const payment = route?.params?.payment ?? null;
  const cart = buildCart(route, t);

  console.log("MyClosetBuyerOrderReceivedScreen--------response ", route?.params)

  const orderId = payment?.orderId || route?.params?.orderId;
  const amount = payment?.amount != null ? payment.amount / 100 : cart.total; // amount is in cents per your sample
  const orderDate = payment?.createdAt ? new Date(payment.createdAt) : new Date();
  const items = payment?.metadata?.items ?? [];

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <ScrollView contentContainerStyle={styles.receivedContent} showsVerticalScrollIndicator={false}>
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
        <Text style={[styles.receivedTitle, { color: text }]}>{t('myClosetBuyer.orderReceivedTitle')}</Text>
        <Text style={styles.receivedSubtitle}>{t('myClosetBuyer.orderReceivedSubtitle')}</Text>
        <View style={styles.orderCard}>
          <View style={styles.orderCardHeader}>
            <View>
              <Text style={styles.orderId}>
                {t('myClosetBuyer.orderIdLabel', { id: orderId ? String(orderId).slice(-7).toUpperCase() : '—' })}
              </Text>
              <Text style={styles.orderDate}>
                {orderDate.toLocaleDateString()} at{' '}
                {orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            {/* <Text style={[styles.editText, { color: text }]}>{t('myClosetBuyer.viewDetails')}</Text> */}
          </View>
          <View style={styles.divider} />
          {items.length > 0 ? (
            items.map((it, idx) => (
              <Text key={idx} style={styles.addressText}>
                {it.name} × {it.quantity}
              </Text>
            ))
          ) : null}
          <Text style={[styles.receivedTotal, { color: text, marginTop: 10 }]}>
            {t('myClosetBuyer.totalLabel', { amount: currency(amount) })}
          </Text>
        </View>
      </ScrollView>
      <View style={styles.bottomBar}>
        <BottomButton
          label={t('myClosetBuyer.continueShopping')}
          onPress={() => navigateClosetReturn(navigation, returnTo)}
          accentColor={text}
        />
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.secondaryButton}
          onPress={() => navigation.reset({
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
          })}
        >
          <Text style={[styles.secondaryButtonText, { color: text }]}>{t('myClosetBuyer.goToMyOrders')}</Text>
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
  MyClosetBattlesScreen,
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

  battleCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 20,
    backgroundColor: '#fff',
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  battleTitle: {
    marginBottom: 10,
    fontSize: 14,
    fontWeight: '900',
    color: '#17072d',
  },
  slide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'nowrap',
  },
  fighter: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  fighterThumb: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: '#f6f0ee',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 8,
  },
  fighterImg: {
    width: '100%',
    height: '100%',
  },
  fighterImgWrap: {
    width: '100%',
    height: '100%',
  },
  fighterThumbPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fighterName: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
    color: '#17072d',
    textAlign: 'center',
    minHeight: 36,
  },
  fighterPrice: {
    marginTop: -10,
    fontSize: 14,
    fontWeight: '900',
    color: '#17072d',
  },
  userRow: {
    marginTop: 8,
  },
  username: {
    fontSize: 11,
    color: MUTED,
    fontWeight: '700',
  },
  pct: {
    fontSize: 11,
    fontWeight: '900',
  },
  pctRed: {
    fontSize: 11,
    fontWeight: '900',
    color: '#dc2626',
  },
  vsBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4ecfb',
    borderWidth: 1,
    borderColor: BORDER,
    alignSelf: 'center',
    marginHorizontal: 4,
  },
  vsText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#21083f',
  },

  imageBox: { backgroundColor: '#f6f0ee', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(246,240,238,0.72)',
    zIndex: 2,
  },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyTitle: { marginTop: 12, fontSize: 17, fontWeight: '900', color: '#17072d' },
  emptyText: { marginTop: 5, fontSize: 13, color: MUTED, textAlign: 'center' },

  // detail
  detailContent: { paddingHorizontal: 20, paddingBottom: 110 },
  heroImage: { width: HERO_IMAGE_WIDTH, height: HERO_IMAGE_HEIGHT, borderRadius: 18 },
  heroSlide: {
    width: HERO_IMAGE_WIDTH,
    height: HERO_IMAGE_HEIGHT,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#f3ede4',
  },
  fullScreenModal: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  fullScreenBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  fullScreenSlide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  fullScreenFlatList: {
    flex: 1,
  },
  fullScreenImage: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  fullScreenImageBox: {
    width: SCREEN_WIDTH,
    height: '100%',
    backgroundColor: '#000',
  },
  fullScreenCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoDots: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 18, marginBottom: 16 },
  photoDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#d7cce3' },
  photoDotsSpacer: { height: 42 },
  detailName: { fontSize: 22, fontWeight: '900', color: '#17072d' },
  detailPrice: { marginTop: 3, fontSize: 21, fontWeight: '900', marginBottom: 30 },

  sellerCard: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 16, marginBottom: 22, padding: 12,
    borderWidth: 1, borderColor: BORDER, borderRadius: 14, backgroundColor: '#fff',
  },
  sellerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  sellerAvatarImage: { width: '100%', height: '100%' },
  sellerAvatarPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
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
  modalBottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 22,
    backgroundColor: '#ffffffee',
    borderTopWidth: 1,
    borderTopColor: '#f0eaf6',
  },
  bottomButton: {
    minHeight: 50, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
  },
  bottomButtonDisabled: {
    opacity: 0.55,
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
    position: 'relative',           // ← add this
  },
  cartThumb: { width: 72, height: 58, borderRadius: 10 },
  cartCopy: { flex: 1, paddingHorizontal: 12 },
  cartItemName: { fontSize: 13, color: '#17072d', fontWeight: '900', width: '45%' },
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
  wishlistBlock: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    backgroundColor: '#fff',
    padding: 14,
  },
  wishlistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  wishlistTitle: { fontSize: 15, fontWeight: '900', color: '#17072d' },
  wishlistCount: { fontSize: 12, fontWeight: '800', color: MUTED },
  wishlistEmptyText: { fontSize: 13, color: MUTED, paddingVertical: 6 },
  wishlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  wishlistThumb: { width: 54, height: 54, borderRadius: 12 },
  wishlistCopy: { flex: 1, paddingHorizontal: 10 },
  wishlistItemName: { fontSize: 13, fontWeight: '800', color: '#17072d' },
  wishlistPrice: { marginTop: 3, fontSize: 13, fontWeight: '900' },
  wishlistActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wishlistHeartBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff1f3',
  },
  wishlistAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4eefb',
  },
  wishlistAddBtnDisabled: { opacity: 0.4 },

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

  card: { borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 14 },
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
    marginBottom: 10, backgroundColor: '#fff', overflow: 'hidden',
  },
  addressCardSelected: { backgroundColor: '#fff' },
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
  radioCardSelected: { backgroundColor: '#fff' },
  radioLabel: { flex: 1, marginLeft: 10, fontSize: 13, color: '#17072d', fontWeight: '800' },
  radioPrice: { fontSize: 12, color: '#17072d', fontWeight: '900' },

  paymentOption: {
    minHeight: 58, borderWidth: 1, borderColor: '#000', borderRadius: 13,
    padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 10, backgroundColor: '#fff',
  },
  paymentCopy: { flex: 1 },
  paymentSub: { marginLeft: 10, marginTop: 2, fontSize: 11, color: MUTED, fontWeight: '700' },

  reviewSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  reviewCard: { borderWidth: 1, borderRadius: 13, padding: 12, backgroundColor: '#fff', marginBottom: 8 },
  reviewLineCard: { minHeight: 48, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
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
  modalContent: { paddingHorizontal: 20, paddingTop: 16 },
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
  shippingChoiceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  shippingChoicePill: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fff',
  },
  shippingChoicePillActive: { backgroundColor: SURFACE },
  shippingChoiceText: { fontSize: 11, fontWeight: '700', color: MUTED },
  shippingChoiceTextActive: { fontWeight: '900' },
  shippingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    zIndex: 1,
  },
  shippingBadgeText: { fontSize: 10, color: MUTED, fontWeight: '700' },
  shipChoiceItemBlock: { marginBottom: 20 },
  shipChoiceItemName: { fontSize: 12, color: '#000', fontWeight: '700', marginBottom: 8 },
  shipChoiceCardsRow: { flexDirection: 'row', gap: 10 },
  shipChoiceCard: {
    flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 14,
    padding: 12, backgroundColor: '#fff',
  },
  shipChoiceHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  shipChoiceTitle: { flex: 1, fontSize: 13, fontWeight: '900', color: '#17072d' },
  shipChoiceCheck: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: '#d7cce3',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  shipChoiceDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  shipChoiceDetailText: { fontSize: 11, color: MUTED, fontWeight: '600' },
  fixedShipCard: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: BORDER, borderRadius: 12,
    padding: 10, backgroundColor: SURFACE, marginBottom: 8,
  },
  fixedShipTitle: { fontSize: 12, fontWeight: '900', color: '#17072d' },
  fixedShipSub: { fontSize: 11, color: MUTED, marginTop: 2 },
});
