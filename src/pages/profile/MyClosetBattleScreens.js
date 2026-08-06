import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Share,
  ActivityIndicator,
  Platform,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n';
import HexAvatar from '../../components/home/story.js/HexAvatar';
import {
  navigateClosetReturn,
  useClosetTheme,
  withClosetNavParams,
  themeGradient,
} from '../../utils/closetNavigation';
import { formSurfaces, selectedSurface, themedCard } from '../../utils/closetTheme';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Defs, ClipPath, Polygon, Image as SvgImage } from 'react-native-svg';
import {
  getMyClosetItems,
  createMarketplaceBattle,
  getMarketplaceBattleDetails,
  getMarketplaceBattleInsights,
  trackMarketplaceBattleView,
  voteOnBattle,
  getBattleVoters,
  getMarketplaceBattleComments,
  addMarketplaceBattleComment,
  deleteMarketplaceBattleComment,
  reactToMarketplaceBattleComment,
  getShops,
  challengeShop,
  getClosetItemsByClosetId,
  acceptMarketplaceBattle,
  declineMarketplaceBattle,
  getMarketplaceBattleChallengeStatus,
} from '../../services/myCloset';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllUser } from '../../services/users';

// Fallback palette — used only when the theme doesn't provide a value,
// so screens still look right before useAppTheme() resolves.
const PURPLE = '#5B2FB5';
const BORDER = '#E7DDF7';
const SOFT_BG = '#FBF7FF';
const TEXT = '#2F2259';
const MUTED = '#786D96';

const phoneStatus = '09:24';

const phoneBorder = {
  borderRadius: 30,
  borderWidth: 1,
  borderColor: '#EEE5FB',
  shadowColor: '#8A63D2',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.1,
  shadowRadius: 12,
  elevation: 5,
};

// Duration pill value -> ms, used to compute startAt/endAt for the create-battle payload
const DURATION_MS = {
  '24 HOURS': 24 * 60 * 60 * 1000,
  '3 DAYS': 3 * 24 * 60 * 60 * 1000,
  '7 DAYS': 7 * 24 * 60 * 60 * 1000,
};

// --- Closet item normalization helpers ---------------------------------
// These were missing before (normalizeItem referenced them but they were
// never defined/imported), which caused every normalize call to throw.

const numberFromPrice = value => {
  if (value == null || value === '') return 0;
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isNaN(numeric) ? 0 : numeric;
};

const currency = value => `$${numberFromPrice(value).toFixed(2)}`;

// Images from the API can arrive as plain strings or as { uri } objects — normalize either to a string.
const imageUri = img => {
  const uri = typeof img === 'string' ? img : img?.uri || null;
  if (!uri) return null;
  return String(uri).replace(/["'\s]+$/, '');
};

const itemImages = item =>
  (Array.isArray(item?.images) ? item.images : item?.image ? [item.image] : [])
    .map(imageUri)
    .filter(Boolean);

const itemImage = item => itemImages(item)[0] || null;

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
  quantityAvailable: Number(item?.quantity || item?.availableQuantity || 1) || 1,
  sellerName: item?.sellerName || item?.userName || item?.ownerName || '',
});

const normalizeItems = (items, t) =>
  (Array.isArray(items) ? items : []).map((item, index) => normalizeItem(item, index, t));

const prefetchImageUrls = async items => {
  const urls = (Array.isArray(items) ? items : [])
    .flatMap(item => item?.images || (item?.image ? [item.image] : []))
    .map(imageUri)
    .filter(Boolean);
  if (!urls.length) return;
  await Promise.allSettled([...new Set(urls)].map(url => Image.prefetch(url)));
};

const fastImageSource = uri =>
  uri
    ? {
      uri,
      priority: FastImage.priority.high,
      cache: FastImage.cacheControl.immutable,
    }
    : null;

const CachedImageBox = ({ uri, style, placeholderStyle, iconName, iconSize = 26 }) => {
  const { isDarkMode } = useThemeContext();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const iconColor = isDarkMode ? '#aaaaaa' : '#9b8c7a';
  const overlayBg = isDarkMode ? 'rgba(30,30,30,0.72)' : 'rgba(246,240,238,0.72)';

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [uri]);

  if (!uri || failed) {
    return (
      <View style={[style, placeholderStyle, isDarkMode && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
        <Ionicons name={iconName} size={iconSize} color={iconColor} />
      </View>
    );
  }

  return (
    <View style={style}>
      {!loaded && (
        <View style={[styles.imageLoadingOverlay, { backgroundColor: overlayBg }]}>
          <ActivityIndicator size="small" color={iconColor} />
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

// --- Battle response normalization --------------------------------------
// Shapes the real GET /marketplace-battles/me response (battle.participants[].product)
// into the { items, leftVotePercent, daysLeft, ... } fields the battle screens render.

const daysLeftFromEndAt = endAt => {
  if (!endAt) return null;
  const diffMs = new Date(endAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
};

const participantToItem = (participant, raw, idx) => {
  console.log('PTI DEBUG', {
    idx,
    productUserId: participant?.product?.userId,
    closetShopName: raw?.closet?.shopName,
    opponentClosetShopName: raw?.opponentCloset?.shopName,
    sellerId: raw?.seller?.id,
    opponentSellerId: raw?.opponentSellerId,
  });
  const product = participant?.product;
  let userName = '';
  let shopName = '';

  if (!shopName && raw && idx != null) {
    const hasOpponent = !!(raw?.opponentCloset || raw?.opponentSeller || raw?.opponentSellerId);

    if (!hasOpponent) {
      // SAME_CLOSET battles — both items belong to the same seller/closet.
      shopName = raw?.closet?.shopName || raw?.mine?.shopName || '';
      userName = userName || raw?.seller?.userName || raw?.seller?.displayName || raw?.mine?.userName || '';
    } else if (idx === 0) {
      shopName = raw?.closet?.shopName || raw?.mine?.shopName || '';
      userName = userName || raw?.seller?.userName || raw?.seller?.displayName || raw?.mine?.userName || '';
    } else if (idx === 1) {
      shopName = raw?.opponentCloset?.shopName || raw?.opponent?.shopName || '';
      userName = userName || raw?.opponentSeller?.userName || raw?.opponentSeller?.displayName || raw?.opponent?.userName || '';
    }
  }

  // Fallback — product.userId isn't reliably returned by the API, so use
  // position (0 = home/closet side, 1 = opponent side) to resolve shopName.
  if (!shopName && raw && idx != null) {
    if (idx === 0) {
      shopName = raw?.closet?.shopName || raw?.mine?.shopName || '';
      userName = userName || raw?.seller?.userName || raw?.seller?.displayName || raw?.mine?.userName || '';
    } else if (idx === 1) {
      shopName = raw?.opponentCloset?.shopName || raw?.opponent?.shopName || '';
      userName = userName || raw?.opponentSeller?.userName || raw?.opponentSeller?.displayName || raw?.opponent?.userName || '';
    }
  }

  return {
    id: participant?.productId || participant?.product?.id,
    participantId: participant?.id,
    name: participant?.product?.name || '',
    price: currency(participant?.product?.price),
    image: itemImage(participant?.product) || participant?.product?.images?.[0] || null,
    voteCount: participant?.voteCount ?? 0,
    votePercentage: participant?.votePercentage,
    pct: participant?.pct ?? participant?.votePercentage,
    isWinner: !!participant?.isWinner,
    userName,
    shopName,
    sellerName: raw?.sellerName,
  };
};

const productToBattleItem = (product, fallback = {}) => ({
  id: product?.id || fallback?.id,
  participantId: fallback?.participantId || product?.participantId || product?.id,
  name: product?.name || fallback?.name || '',
  price: product?.price != null ? currency(product.price) : (fallback?.price || ''),
  image: itemImage(product) || fallback?.images || null,
  shopName: product?.shopName || fallback?.shopName || '',
  userName: product?.userName || fallback?.userName || '',
  sellerName: product?.sellerName || fallback?.sellerName || '',
});

const normalizeBattle = raw => {
  console.log("raw in battle-----------------------", raw)
  if (!raw) return null;
  const participants = [...(raw?.participants || [])].sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0));
  const items = participants.map((p, idx) => participantToItem(p, raw, idx));
  const explicitWinnerParticipant = raw?.winner || participants.find(p => p?.isWinner) || null;
  const winnerParticipant = explicitWinnerParticipant || participants[0] || null;
  const loserParticipant = raw?.loser || participants.find(p => !p?.isWinner) || participants[1] || null;
  const winnerProduct = winnerParticipant?.product || null;
  const runnerUpProduct = loserParticipant?.product || null;
  const totalVotes = raw?.totalVotes ?? participants.reduce((sum, p) => sum + (p?.voteCount ?? 0), 0);
  const leftVotes = items[0]?.voteCount ?? 0;
  const leftVotePercent = totalVotes > 0 ? Math.round((leftVotes / totalVotes) * 100) : 50;
  const creatorAvatar =
    raw?.seller?.image ||
    raw?.seller?.avatar ||
    raw?.seller?.profileImage ||
    raw?.mine?.image ||
    raw?.closet?.shopLogo ||
    raw?.mine?.shopLogo ||
    null;
  const creatorName =
    raw?.seller?.displayName ||
    raw?.seller?.userName ||
    raw?.seller?.name ||
    raw?.mine?.displayName ||
    raw?.mine?.userName ||
    raw?.sellerName ||
    '';
  const creatorShopName =
    raw?.closet?.shopName ||
    raw?.mine?.shopName ||
    '';
  return {
    id: raw?.id,
    battleId: raw?.battleId || raw?.id,
    title: raw?.title,
    category: raw?.category,
    status: raw?.status,
    outcome: raw?.outcome,
    whoCanVote: raw?.whoCanVote,
    visibility: raw?.visibility,
    totalVotes,
    totalComments: raw?.totalComments ?? 0,
    totalViews: raw?.totalViews ?? raw?.viewCount ?? 0,
    totalLikes: raw?.totalLikes ?? raw?.likeCount ?? 0,
    daysLeft: daysLeftFromEndAt(raw?.endAt),
    items,
    leftVotePercent,
    winnerProduct,
    winnerParticipantId: explicitWinnerParticipant?.id || null,
    winnerProductId:
      explicitWinnerParticipant?.product?.id ||
      explicitWinnerParticipant?.product?._id ||
      explicitWinnerParticipant?.productId ||
      null,
    runnerUpProduct,
    winnerVotePercent: raw?.winner?.votePercentage ?? participants.find(p => p?.isWinner)?.votePercentage ?? null,
    createdBy: raw?.sellerId || raw?.createdBy || raw?.userId || null, // NEW — adjust field name if API differs
    sellerName: raw?.sellerName || raw?.seller?.userName || raw?.seller?.name,
    creatorAvatar,
    creatorName,
    creatorShopName,
  };
};

// --- Marketplace battle comment normalization ---------------------------
// Shapes GET /marketplace-battles/{battleId}/comments rows into what the
// BattleLiveScreen comment list renders (author, message, relative time).

const relativeTimeFromNow = value => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / (60 * 1000)));
  if (diffMinutes < 1) return 'now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
};

const normalizeMarketplaceComment = (comment = {}, index = 0) => ({
  id: String(comment?.id || comment?._id || comment?.commentId || `comment-${index}`),
  message: comment?.comment || comment?.message || comment?.text || '',
  userId: String(comment?.userId || comment?.user?.id || comment?.user?._id || ''),
  authorName: comment?.user?.name || comment?.user?.displayName || comment?.user?.userName || comment?.authorName || 'Valens User',
  avatar: comment?.user?.profileImage || comment?.user?.avatar || comment?.user?.image || comment?.user?.profilePicture || null,
  likes: Number(comment?.likeCount ?? comment?.likesCount ?? comment?._count?.likes ?? 0) || 0,
  dislikes: Number(comment?.dislikeCount ?? comment?.dislikesCount ?? comment?._count?.dislikes ?? 0) || 0,
  userReaction: comment?.userReaction || null,
  createdAt: comment?.createdAt || comment?.created_at || '',
  timeAgo: relativeTimeFromNow(comment?.createdAt || comment?.created_at),
});

const CommentAvatarCircle = ({ uri, size = 32 }) => {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [uri]);

  return (
    <View style={[liveStyles.commentAvatarCircle, liveStyles.commentAvatarFallback]}>
      {uri && !imageError ? (
        <FastImage
          source={fastImageSource(uri)}
          style={liveStyles.commentAvatarImage}
          resizeMode={FastImage.resizeMode.cover}
          fadeDuration={0}
          onError={() => setImageError(true)}
        />
      ) : (
        <Ionicons name="person-outline" size={14} color="#fff" />
      )}
    </View>
  );
};

export const Header = ({ title, onBack, rightIcon, subtitle, onShare, accentColor, titleColor, mutedColor }) => (
  <View style={styles.headerRow}>
    <TouchableOpacity onPress={onBack} activeOpacity={0.8} style={styles.iconBtn}>
      <Ionicons name="arrow-back" size={22} color={titleColor || TEXT} />
    </TouchableOpacity>
    <View style={styles.headerCenter}>
      <Text style={[styles.screenTitle, { color: titleColor || TEXT }]}>{title}</Text>
      {subtitle ? <Text style={[styles.screenSubtitle, mutedColor && { color: mutedColor }]}>{subtitle}</Text> : null}
    </View>
    <View>
      <Text>      </Text>
    </View>
    {/* <TouchableOpacity onPress={onShare} activeOpacity={0.8} style={styles.iconBtn}>
      <Ionicons name={rightIcon || 'share-social-outline'} size={20} color={accentColor || titleColor || TEXT} />
    </TouchableOpacity> */}
  </View>
);

const navigateBackToProfile = (navigation, returnToProfile) => {
  if (!returnToProfile || !navigation?.navigate) return false;

  if (typeof returnToProfile === 'string') {
    navigation.navigate('ProfileMain', { screen: returnToProfile });
    return true;
  }

  const tab = returnToProfile?.tab;
  const screen = returnToProfile?.screen;
  const params = returnToProfile?.params;
  if (tab) {
    navigation.navigate(tab, screen ? { screen, params } : undefined);
    return true;
  }
  if (screen) {
    if (screen === 'UsersProfile') {
      navigation.navigate('HomeMain', { screen, params });
      return true;
    }
    navigation.navigate('ProfileMain', { screen, params });
    return true;
  }

  return false;
};

const useBattleBackHandler = (navigation, route) =>
  useCallback(() => {
    if (navigateBackToProfile(navigation, route?.params?.returnToProfile)) {
      return;
    }
    navigation.goBack();
  }, [navigation, route?.params?.returnToProfile]);

export const PhoneFrame = ({ children }) => {
  const { card, border } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  return (
    <View
      style={[
        styles.phone,
        phoneBorder,
        {
          backgroundColor: isDarkMode ? card || '#1E1E1E' : '#fff',
          borderColor: isDarkMode ? border || '#333333' : '#EEE5FB',
        },
      ]}
    >
      <View style={styles.statusRow}>
        <Text style={[styles.statusText, isDarkMode && { color: '#fff' }]}>{phoneStatus}</Text>
        <View style={styles.statusIcons}>
          <Ionicons name="cellular" size={10} color={isDarkMode ? '#fff' : '#111'} />
          <Ionicons name="wifi" size={10} color={isDarkMode ? '#fff' : '#111'} />
          <View style={styles.batteryPill}><Text style={styles.batteryText}>90</Text></View>
        </View>
      </View>
      {children}
    </View>
  );
};

export const BattleCard = ({ left, right, showWinner = false, winnerPercent, accent = PURPLE, textColor = TEXT, isDarkMode = false, card, border }) => {
  const { t } = useLanguage();
  const confettiBg = isDarkMode ? (card || 'rgba(255,255,255,0.08)') : '#FBF3FF';
  return (
    <View style={styles.cardBlock}>
      {showWinner ? (
        <View style={[styles.confettiCard, { backgroundColor: confettiBg, borderColor: border || BORDER }]}>
          <Text style={[styles.winnerBadge, { color: textColor }]}>🏆 {t('battle.winner')}</Text>
          <View style={styles.winnerRow}>
            <View style={styles.heroThumb}>
              <CachedImageBox
                uri={left.image}
                style={styles.itemThumb}
                placeholderStyle={styles.itemThumbPlaceholder}
                iconName="bag-outline"
              />
            </View>
            <View style={styles.winnerCopy}>
              <Text style={[styles.winnerTitle, { color: textColor }]}>{left.name}</Text>
              <Text style={[styles.winnerPrice, { color: textColor }]}>{left.price}</Text>
              {(left.shopName || left.userName || left.sellerName) ? (
                <Text style={[styles.winnerSeller, { color: isDarkMode ? '#AAAAAA' : '#666666', fontSize: 12, marginTop: 2 }]} numberOfLines={1}>
                  {left.shopName || left.userName || left.sellerName}
                </Text>
              ) : null}
            </View>
            <View style={[styles.percentPill, { backgroundColor: '#22C55E' }]}>
              <Text style={styles.percentText}>{winnerPercent != null ? `${winnerPercent}%` : '—'}</Text>
            </View>
          </View>
        </View>
      ) : null}
      <View style={styles.vsGrid}>
        <View style={styles.itemTile}>
          <CachedImageBox
            uri={left.image}
            style={styles.itemThumb}
            placeholderStyle={styles.itemThumbPlaceholder}
            iconName="bag-outline"
          />
          <Text style={[styles.itemName, { color: textColor }]}>{left.name}</Text>
          <Text style={[styles.itemPrice, { color: accent }]}>{left.price}</Text>
          {(left.shopName || left.userName || left.sellerName) ? (
            <Text style={[styles.itemSeller, { color: isDarkMode ? '#AAAAAA' : '#666666', fontSize: 12, marginTop: 4, textAlign: 'center' }]} numberOfLines={1}>
              {left.shopName || left.userName || left.sellerName}
            </Text>
          ) : null}
        </View>
        <View style={[styles.vsBubble, { backgroundColor: accent }]}><Text style={styles.vsText}>{t('battle.vs')}</Text></View>
        <View style={styles.itemTile}>
          <CachedImageBox
            uri={right.image}
            style={styles.itemThumb}
            placeholderStyle={styles.itemThumbPlaceholder}
            iconName="bag-handle-outline"
          />
          <Text style={[styles.itemName, { color: textColor }]}>{right.name}</Text>
          <Text style={[styles.itemPrice, { color: accent }]}>{right.price}</Text>
          {(right.shopName || right.userName || right.sellerName) ? (
            <Text style={[styles.itemSeller, { color: isDarkMode ? '#AAAAAA' : '#666666', fontSize: 12, marginTop: 4, textAlign: 'center' }]} numberOfLines={1}>
              {right.shopName || right.userName || right.sellerName}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
};

export const VoteSplitBar = ({ leftPercent = 50, accent = PURPLE, totalVotes, leftLabel, rightLabel, isDarkMode = false, border }) => {
  const { t } = useLanguage();
  const rightPercent = 100 - leftPercent;
  const rightFill = isDarkMode ? (border || '#333333') : '#D9CBEF';
  return (
    <View style={styles.splitBarWrap}>
      <View style={styles.splitBarTrack}>
        <View style={[styles.splitBarFill, { width: `${leftPercent}%`, backgroundColor: accent }]} />
        <View style={[styles.splitBarFill, { width: `${rightPercent}%`, backgroundColor: rightFill }]} />
      </View>
      <View style={styles.splitBarLabels}>
        <Text style={[styles.splitBarLabelText, { color: accent }]}>{leftLabel} {leftPercent}%</Text>
        <Text style={[styles.splitBarLabelText, isDarkMode && { color: '#aaaaaa' }]}>{rightPercent}% {rightLabel}</Text>
      </View>
      {typeof totalVotes === 'number' ? (
        <Text style={styles.splitBarTotal}>{t('battle.totalVotesCount', { count: totalVotes })}</Text>
      ) : null}
    </View>
  );
};

export const Stepper = ({ active = 1, labels, accent = PURPLE, isDarkMode = false }) => {
  const { t } = useLanguage();
  const surfaces = formSurfaces(isDarkMode);
  const stepLabels = labels || [
    t('battle.stepper.items'),
    t('battle.stepper.setup'),
    t('battle.stepper.preview'),
  ];
  // In dark mode accent is often white — use dark digits on the filled circle,
  // and bright digits/borders on idle circles so numbers stay readable.
  const activeNumberColor = isDarkMode ? '#111111' : '#ffffff';
  const idleNumberColor = isDarkMode ? '#ffffff' : '#8B7AAE';
  const idleBorder = isDarkMode ? 'rgba(255,255,255,0.45)' : '#D6C8EF';
  const idleLine = isDarkMode ? 'rgba(255,255,255,0.22)' : '#D6C8EF';

  return (
    <View style={styles.stepper}>
      {stepLabels.map((label, index) => {
        const step = index + 1;
        const focused = active >= step;
        return (
          <React.Fragment key={label}>
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  focused
                    ? { backgroundColor: accent, borderColor: accent }
                    : { backgroundColor: 'transparent', borderColor: idleBorder },
                ]}
              >
                <Text
                  style={[
                    styles.stepCircleText,
                    { color: focused ? activeNumberColor : idleNumberColor },
                  ]}
                >
                  {step}
                </Text>
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  {
                    color: focused
                      ? accent
                      : isDarkMode
                        ? surfaces.mutedColor
                        : MUTED,
                  },
                ]}
              >
                {label}
              </Text>
            </View>
            {index < stepLabels.length - 1 ? (
              <View style={[styles.stepLine, { backgroundColor: idleLine }]} />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
};

export const StatRow = ({ items, card, border, textColor, mutedColor }) => (
  <View style={styles.statsRow}>
    {items.map(item => (
      <View key={item.label} style={[styles.statCard, themedCard(card, border)]}>
        {item.icon ? <Ionicons name={item.icon} size={18} color={mutedColor || MUTED} style={{ marginBottom: 4 }} /> : null}
        <Text style={[styles.statValue, textColor && { color: textColor }]}>{item.value}</Text>
        <Text style={[styles.statLabel, mutedColor && { color: mutedColor }]}>{item.label}</Text>
      </View>
    ))}
  </View>
);

// ---------------------------------------------------------------------
// CreateBattleScreen — now loads real closet items from GET /mycloset/items
// ---------------------------------------------------------------------
export function CreateBattleScreen({ navigation, route }) {
  const { bgStyle, text, card, bg, border, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const idleSurface = card || surfaces.listSurface;
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const primaryText = text || TEXT;
  const subtleMuted = mutedText || surfaces.mutedColor;
  const ghostBorder = isDarkMode ? 'rgba(255,255,255,0.45)' : '#D8CBEF';

  // Passed from MyClosetDashboard's "Create Battle" CTA — falls back to
  // undefined, in which case getMyClosetItems() just omits the userId query param.
  const sellerId = route?.params?.sellerId;
  const headerTitle = route?.params?.headerTitle || t('battle.headerTitle');
  const nextRoute = route?.params?.nextRoute || 'BattleSetup';
  const handleBack = useCallback(() => {
    navigation.navigate('MainApp', {
      screen: 'wallet',
      params: { screen: 'MyCloset' },
    });
  }, [navigation]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const loadItems = useCallback(async () => {
    if (items.length) return;
    setLoading(true);
    setLoadError(null);
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
      const availableItems = nextItems.filter(
        item => Number(item.quantity) > 0
      );
      const normalized = normalizeItems(nextItems, t);
      prefetchImageUrls(nextItems);
      setItems(normalized);
      // setSelectedIds(normalized.slice(0, 2).map(i => i.id));
    } catch (err) {
      setItems([]);
      setLoadError(t('battle.errors.itemsLoadFailed') || 'Could not load your closet items.');
    } finally {
      setLoading(false);
    }
  }, [items.length, sellerId, t]);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  const selectedItems = useMemo(
    () => items.filter(item => selectedIds.includes(item.id)).slice(0, 2),
    [selectedIds, items],
  );

  const handleShare = async () => {
    try {
      await Share.share({ message: t('battle.sharePreviewMessage') });
    } catch {
      Alert.alert(t('battle.shareTitle'), t('battle.shareUnavailable'));
    }
  };

  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
      <Header title={headerTitle} onBack={handleBack} onShare={handleShare} accentColor={accent} titleColor={primaryText} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* <Stepper active={1} accent={accent} isDarkMode={isDarkMode} labels={[t('battle.stepper.step1', 'Choose your item'), t('battle.stepper.step2', 'Add your battle question'), t('battle.stepper.step3', 'Set battle details')]} /> */}
        <Text style={[styles.sectionTitle, { color: primaryText }]}>{t('battle.chooseItemsTitle', 'Choose items for battle')}</Text>
        <Text style={[styles.sectionHint, { color: subtleMuted }]}>{t('battle.chooseItemsHint', 'Select 1 item to challenge another shop, or 2 items to battle your own')}</Text>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={accent} />
        ) : loadError ? (
          <View style={styles.centeredNotice}>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity onPress={loadItems} style={[styles.retryBtn, { borderColor: accent }]}>
              <Text style={{ color: accent, fontWeight: '700' }}>{t('battle.retry') || 'Retry'}</Text>
            </TouchableOpacity>
          </View>
        ) : items.length === 0 ? (
          <Text style={[styles.sectionHint, { color: subtleMuted }]}>{t('battle.noItems') || 'No closet items found yet.'}</Text>
        ) : (
          <View style={styles.grid}>
            {items.map(item => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.9}
                onPress={() => {
                  setSelectedIds(prev => {
                    const isSelected = prev.includes(item.id);
                    if (isSelected) return prev.filter(id => id !== item.id);
                    // Max 2 items can be selected if they want to battle their own items
                    if (prev.length >= 2) return [prev[1], item.id];
                    return [...prev, item.id];
                  });
                }}
                style={[
                  styles.gridCard,
                  { backgroundColor: idleSurface, borderColor: border || surfaces.listBorder },
                  selectedIds.includes(item.id) && [styles.gridCardSelected, { borderColor: accent }],
                ]}
              >
                {selectedIds.includes(item.id) ? (
                  <View style={[styles.selectionDot, { backgroundColor: accent }]}>
                    <Ionicons name="checkmark" size={12} color={isDarkMode ? '#111' : '#fff'} />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.selectionDotGhost,
                      {
                        backgroundColor: isDarkMode ? 'rgba(0,0,0,0.35)' : 'transparent',
                        borderColor: ghostBorder,
                      },
                    ]}
                  />
                )}
                <FastImage source={fastImageSource(item.image)} style={styles.gridImage} resizeMode={FastImage.resizeMode.cover} />
                <Text style={[styles.gridName, { color: primaryText }]}>{item.name}</Text>
                <Text style={[styles.gridPrice, { color: subtleMuted }]}>{item.price}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ gap: 10, marginTop: 10 }}>
          <TouchableOpacity
            activeOpacity={0.9}
            disabled={selectedItems.length !== 2}
            onPress={() => navigation.navigate(nextRoute, { selectedItems, ...route?.params })}
          >
            <LinearGradient colors={[accent, text]} style={[styles.primaryButton, selectedItems.length !== 2 && { opacity: 0.5 }]}>
              <Text style={styles.primaryButtonText}>{t('battle.next', 'Next')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            disabled={selectedItems.length !== 1}
            onPress={() => navigation.navigate('ChallengeShopList', { selectedItems, ...route?.params })}
            style={[styles.secondaryButton, selectedItems.length !== 1 && { opacity: 0.5 }, { borderColor: accent, flexDirection: 'row', alignItems: 'center', gap: 6 }]}
          >
            <Ionicons name="storefront-outline" size={18} color={accent} />
            <Text style={[styles.secondaryButtonText, { color: accent }]}>{t('battle.challengeAnotherShop', 'Challenge another shop')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

export function BattleSetupScreen({ navigation, route }) {
  const { bgStyle, text, card, bg, border, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const idleSurface = card || surfaces.listSurface;
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const primaryText = text || TEXT;
  const subtleMuted = mutedText || surfaces.mutedColor;
  const initialQuestion = route?.params?.defaultQuestion || t('battle.defaultQuestion');
  const handleBack = useBattleBackHandler(navigation, route);
  const [question, setQuestion] = useState(initialQuestion);
  const [battleType, setBattleType] = useState('OPINION');
  const [duration, setDuration] = useState('3 DAYS');
  const [whoCanVote, setWhoCanVote] = useState(t('battle.public'));
  const [visibility, setVisibility] = useState(t('battle.public'));
  const [errors, setErrors] = useState({});

  const validate = () => {
    const nextErrors = {};
    if (!question.trim()) nextErrors.question = t('battle.errors.questionRequired');
    if (!battleType) nextErrors.battleType = t('battle.errors.typeRequired');
    if (!duration) nextErrors.duration = t('battle.errors.durationRequired');
    if (!whoCanVote) nextErrors.whoCanVote = t('battle.errors.visibilityRequired');
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handlePreview = () => {
    if (!validate()) return;
    const nextRoute = route?.params?.previewRoute || 'BattlePreview';
    navigation.navigate(nextRoute, {
      question,
      battleType,
      duration,
      whoCanVote,
      visibility,
      selectedItems: route?.params?.selectedItems,
    });
  };

  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
      <Header
        title={t('battle.headerTitle')}
        onBack={handleBack}
        accentColor={accent}
        titleColor={text}
        onShare={async () => {
          try {
            await Share.share({ message: t('battle.shareSetupMessage', { question }) });
          } catch {
            Alert.alert(t('battle.shareTitle'), t('battle.shareUnavailable'));
          }
        }}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        extraScrollHeight={20}
        keyboardShouldPersistTaps="handled"
      >
        <Stepper active={2} accent={accent} isDarkMode={isDarkMode} />
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: primaryText }]}>{t('battle.questionLabel')}</Text>
          <View
            style={[
              styles.inputCard,
              { backgroundColor: idleSurface, borderColor: border || surfaces.listBorder },
              errors.question && styles.inputCardError,
            ]}
          >
            <TextInput
              value={question}
              onChangeText={val => {
                setQuestion(val);
                if (errors.question) setErrors(prev => ({ ...prev, question: '' }));
              }}
              placeholder={t('battle.defaultQuestion')}
              placeholderTextColor={surfaces.placeholderColor}
              style={[styles.inputText, { color: surfaces.inputText }]}
            />
          </View>
          {errors.question ? <Text style={styles.errorText}>{errors.question}</Text> : null}
        </View>
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: primaryText }]}>{t('battle.typeLabel')}</Text>

          <TouchableOpacity
            onPress={() => setBattleType('OPINION')}
            activeOpacity={0.9}
            style={[
              styles.optionCard,
              { backgroundColor: idleSurface, borderColor: border || surfaces.listBorder },
              battleType === 'OPINION' && { borderColor: accent, backgroundColor: selectedSurface(accent, isDarkMode) },
            ]}
          >
            <View style={[styles.radioOuter, { borderColor: battleType === 'OPINION' ? accent : (isDarkMode ? 'rgba(255,255,255,0.45)' : '#D6C8EF') }]}>
              {battleType === 'OPINION' ? <View style={[styles.radioInner, { backgroundColor: accent }]} /> : null}
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={[styles.optionTitle, { color: primaryText }]}>{t('battle.opinionBattle')}</Text>
              <Text style={[styles.optionSub, { color: subtleMuted }]}>{t('battle.opinionBattleSub')}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setBattleType('STYLE')}
            activeOpacity={0.9}
            style={[
              styles.optionCard,
              { backgroundColor: idleSurface, borderColor: border || surfaces.listBorder },
              battleType === 'STYLE' && { borderColor: accent, backgroundColor: selectedSurface(accent, isDarkMode) },
            ]}
          >
            <View style={[styles.radioOuter, { borderColor: battleType === 'STYLE' ? accent : (isDarkMode ? 'rgba(255,255,255,0.45)' : '#D6C8EF') }]}>
              {battleType === 'STYLE' ? <View style={[styles.radioInner, { backgroundColor: accent }]} /> : null}
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={[styles.optionTitle, { color: primaryText }]}>{t('battle.styleBattle')}</Text>
              <Text style={[styles.optionSub, { color: subtleMuted }]}>{t('battle.styleBattleSub')}</Text>
            </View>
          </TouchableOpacity>

          {errors.battleType ? <Text style={styles.errorText}>{errors.battleType}</Text> : null}
        </View>
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: primaryText }]}>{t('battle.durationLabel')}</Text>
          <View style={styles.pillRow}>
            {[['24 HOURS', t('battle.duration24h')], ['3 DAYS', t('battle.duration3d')], ['7 DAYS', t('battle.duration7d')]].map(([value, label]) => (
              <TouchableOpacity
                key={value}
                onPress={() => setDuration(value)}
                style={[
                  styles.pill,
                  { backgroundColor: idleSurface, borderColor: border || surfaces.listBorder },
                  duration === value && [styles.pillActive, { borderColor: accent, backgroundColor: selectedSurface(accent, isDarkMode) }],
                ]}
              >
                <Text style={[styles.pillText, { color: primaryText }, duration === value && { color: accent, fontWeight: '800' }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.duration ? <Text style={styles.errorText}>{errors.duration}</Text> : null}
        </View>
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: primaryText }]}>{t('battle.whoCanVote')}</Text>
          <TouchableOpacity
            onPress={() => setWhoCanVote(prev => (prev === t('battle.public') ? t('battle.followersOnly') : t('battle.public')))}
            style={[styles.inlineRow, { borderBottomColor: border || surfaces.listBorder }]}
          >
            <Text style={[styles.inlineValue, { color: primaryText }]}>{whoCanVote}</Text>
            <Text style={[styles.inlineLink, { color: accent }]}>{t('battle.change')}</Text>
          </TouchableOpacity>
          {errors.whoCanVote ? <Text style={styles.errorText}>{errors.whoCanVote}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: primaryText }]}>{t('battle.visibilityLabel')}</Text>
          <TouchableOpacity
            onPress={() => setVisibility(prev => (prev === t('battle.public') ? t('battle.private') : t('battle.public')))}
            style={[styles.inlineRow, { borderBottomColor: border || surfaces.listBorder }]}
          >
            <Text style={[styles.inlineValue, { color: primaryText }]}>{visibility}</Text>
            <Text style={[styles.inlineLink, { color: accent }]}>{t('battle.change')}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity activeOpacity={0.9} onPress={handlePreview}>
          <LinearGradient colors={[accent, text]} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{t('battle.previewBattle')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------
// BattlePreviewScreen — "Launch Battle" now calls POST /marketplace-battles
// ---------------------------------------------------------------------
export function BattlePreviewScreen({ navigation, route }) {
  const { bgStyle, text, card, bg, border, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const primaryText = text || TEXT;
  const subtleMuted = mutedText || surfaces.mutedColor;
  const surface = card || surfaces.listSurface;
  const previewQuestion = route?.params?.question || t('battle.defaultQuestion');
  const selectedItems = route?.params?.selectedItems;
  const { duration, whoCanVote } = route?.params || {};
  const handleBack = useBattleBackHandler(navigation, route);

  // Maps the duration pill chosen in BattleSetupScreen to a days count for display.
  const DURATION_DAYS = { '24 HOURS': 1, '3 DAYS': 3, '7 DAYS': 7 };
  const daysLeft = DURATION_DAYS[duration] ?? 3;
  const voteAudienceText =
    whoCanVote === t('battle.followersOnly') ? whoCanVote : t('battle.everyoneCanVote');
  const [launching, setLaunching] = useState(false);

  if (!selectedItems || selectedItems.length < 2) {
    // Defensive guard: this screen requires two real closet items with ids.
    return (
      <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
        <Header title={t('battle.previewTitle')} onBack={handleBack} titleColor={text} />
        <View style={styles.centeredNotice}>
          <Text style={styles.errorText}>{t('battle.errors.missingItems') || 'Missing selected items.'}</Text>
        </View>
      </View>
    );
  }

  const buildBattlePayload = () => {
    const { battleType, duration, whoCanVote, visibility } = route?.params || {};
    const durationMs = DURATION_MS[duration] || DURATION_MS['3 DAYS'];
    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + durationMs);
    return {
      title: previewQuestion,
      description: previewQuestion,
      category: 'Fashion',
      visibility: visibility === t('battle.private') ? 'Private' : 'Everyone',
      whoCanVote: whoCanVote === t('battle.followersOnly') ? 'Followers' : 'Everyone',
      shareToFeed: false,
      productIds: selectedItems.map(item => item.id),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    };
  };

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      const payload = buildBattlePayload();
      const response = await createMarketplaceBattle(payload);
      console.log("createMarketplaceBattle-------------------", response)
      const data = response?.data?.data ?? response?.data ?? response;
      const battle = data?.battle ?? data;
      const battleId = battle?.id;

      const liveRoute = route?.params?.liveRoute || 'BattleLive';
      // navigation.navigate(liveRoute, {
      //   battleId,
      //   question: previewQuestion,
      //   selectedItems,
      //   launchedFromPreview: true,
      // });
      navigation.navigate('MainApp', {
        screen: 'wallet',
        params: { screen: 'MyCloset' }
      })
    } catch (err) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message;
      if (status === 400 && message === 'One or more products were not found') {
        Alert.alert(
          t('battle.errors.launchFailedTitle') || 'Could not launch battle',
          t('battle.errors.productsNotFound') ||
          'One or both items could not be found. They may have been removed — please go back and pick again.',
        );
      } else {
        Alert.alert(
          t('battle.errors.launchFailedTitle') || 'Could not launch battle',
          message || t('battle.errors.launchFailedGeneric') || 'Something went wrong. Please try again.',
        );
      }
    } finally {
      setLaunching(false);
    }
  };

  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
      <Header
        title={t('battle.previewTitle')}
        onBack={handleBack}
        accentColor={accent}
        titleColor={text}
        onShare={async () => {
          try {
            await Share.share({ message: t('battle.sharePreviewQuestionMessage', { question: previewQuestion }) });
          } catch {
            Alert.alert(t('battle.shareTitle'), t('battle.shareUnavailable'));
          }
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* <Stepper active={3} accent={accent} isDarkMode={isDarkMode} /> */}
        <Text style={[styles.sectionTitle, { color: primaryText }]}>{previewQuestion}</Text>
        <BattleCard
          left={selectedItems[0]}
          right={selectedItems[1]}
          accent={accent}
          textColor={primaryText}
          isDarkMode={isDarkMode}
          card={surface}
          border={border || surfaces.listBorder}
        />
        <View style={styles.infoRow}>
          <Text style={[styles.infoText, { color: subtleMuted }]}>{t('battle.daysLeft', { count: daysLeft })}</Text>
          <Text style={[styles.infoText, { color: subtleMuted }]}>{voteAudienceText}</Text>
        </View>
        <View style={[styles.aboutCard, themedCard(surface, border || surfaces.listBorder)]}>
          <Text style={[styles.aboutTitle, { color: primaryText }]}>{t('battle.aboutTitle')}</Text>
          <Text style={[styles.aboutText, { color: subtleMuted }]}>{t('battle.aboutTextPreview')}</Text>
        </View>
        <StatRow
          card={surface}
          border={border || surfaces.listBorder}
          textColor={primaryText}
          mutedColor={subtleMuted}
          items={[
            { label: t('battle.stats.votes'), value: '0', icon: 'checkmark-done-outline' },
            { label: t('battle.stats.views'), value: '0', icon: 'eye-outline' },
            { label: t('battle.stats.comments'), value: '0', icon: 'chatbubble-outline' },
          ]} />
        <TouchableOpacity activeOpacity={0.9} disabled={launching} onPress={handleLaunch}>
          <LinearGradient colors={[accent, text]} style={[styles.primaryButton, launching && { opacity: 0.6 }]}>
            {launching ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>{t('battle.launchBattle')}</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}


export function ChallengeBattleSetupScreen({ navigation, route }) {
  const { bgStyle, text, card, bg, border, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const idleSurface = card || surfaces.listSurface;
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const primaryText = text || TEXT;
  const subtleMuted = mutedText || surfaces.mutedColor;
  const initialQuestion = route?.params?.question || route?.params?.defaultQuestion || '';
  const handleBack = useBattleBackHandler(navigation, route);
  const [question, setQuestion] = useState(initialQuestion);
  const [errors, setErrors] = useState({});

  const selectedItems = route?.params?.selectedItems || [];
  const leftItem = selectedItems[0];
  const rightItem = selectedItems[1];

  const validate = () => {
    const nextErrors = {};
    if (!question.trim()) nextErrors.question = t('battle.errors.questionRequired', 'Question is required');
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;
    navigation.navigate('ChallengeBattleSettings', {
      ...route?.params,   // spread first, so it doesn't clobber below
      question,
      selectedItems,
    });
  };

  const exampleQuestions = [
    t('battle.example1', 'Which item is more stylish?'),
    t('battle.example2', 'Which item would you buy?'),
    t('battle.example3', 'Which item is better quality?'),
  ];

  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
      <Header
        title={t('battle.questionTitle', 'Battle Question')}
        onBack={handleBack}
        accentColor={accent}
        titleColor={text}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        extraScrollHeight={20}
        keyboardShouldPersistTaps="handled"
      >
        {/* <Stepper active={2} accent={accent} isDarkMode={isDarkMode} labels={[t('battle.stepper.step1', 'Choose your item'), t('battle.stepper.step2', 'Add your battle question'), t('battle.stepper.step3', 'Set battle details')]} /> */}
        <Text style={[styles.sectionHint, { color: subtleMuted, marginTop: 10, marginBottom: 10 }]}>{t('battle.questionHint', 'Add a question for the community to vote on.')}</Text>

        <Text style={[styles.fieldLabel, { color: primaryText, marginBottom: 8 }]}>{t('battle.yourItem', 'Your item')}</Text>
        <View style={[styles.itemTileHorizontal, { backgroundColor: idleSurface, borderColor: border || surfaces.listBorder, flexDirection: 'row', padding: 12, borderRadius: 14, borderWidth: 1, alignItems: 'center' }]}>
          <FastImage source={fastImageSource(leftItem?.image)} style={{ width: 64, height: 64, borderRadius: 10, marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.itemName, { color: primaryText, textAlign: 'left', fontSize: 14, fontWeight: '800' }]} numberOfLines={2}>{leftItem?.name}</Text>
            <Text style={[styles.itemPrice, { color: primaryText, textAlign: 'left', marginTop: 2 }]} numberOfLines={1}>{leftItem?.price}</Text>
            {leftItem?.shopName || leftItem?.userName || leftItem?.sellerName ? <Text style={[styles.itemSellerName, { color: subtleMuted, fontSize: 12, marginTop: 4 }]}>From {leftItem?.shopName || leftItem?.userName || leftItem?.sellerName}</Text> : null}
          </View>
        </View>

        <View style={{ alignItems: 'center', marginVertical: -10, zIndex: 10 }}>
          <View style={{ backgroundColor: bg || SOFT_BG, borderRadius: 18, padding: 4 }}>
            <View style={{ backgroundColor: idleSurface, borderColor: border || surfaces.listBorder, borderWidth: 1, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: primaryText, fontWeight: '900', fontSize: 14 }}>VS</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.fieldLabel, { color: primaryText, marginBottom: 8, marginTop: 8 }]}>{t('battle.challengerItem', 'Challenger item')}</Text>
        <View style={[styles.itemTileHorizontal, { backgroundColor: idleSurface, borderColor: border || surfaces.listBorder, flexDirection: 'row', padding: 12, borderRadius: 14, borderWidth: 1, alignItems: 'center' }]}>
          <FastImage source={fastImageSource(rightItem?.image)} style={{ width: 64, height: 64, borderRadius: 10, marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.itemName, { color: primaryText, textAlign: 'left', fontSize: 14, fontWeight: '800' }]} numberOfLines={2}>{rightItem?.name}</Text>
            <Text style={[styles.itemPrice, { color: primaryText, textAlign: 'left', marginTop: 2 }]} numberOfLines={1}>{rightItem?.price}</Text>
            {rightItem?.shopName || rightItem?.userName || rightItem?.sellerName ? <Text style={[styles.itemSellerName, { color: subtleMuted, fontSize: 12, marginTop: 4 }]}>From {rightItem?.shopName || rightItem?.userName || rightItem?.sellerName}</Text> : null}
          </View>
        </View>

        <View style={[styles.field, { marginTop: 20 }]}>
          <Text style={[styles.fieldLabel, { color: primaryText }]}>{t('battle.questionLabel', 'Battle Question')} *</Text>
          <View
            style={[
              styles.inputCard,
              { backgroundColor: idleSurface, borderColor: border || surfaces.listBorder, minHeight: 80 },
              errors.question && styles.inputCardError,
            ]}
          >
            <TextInput
              value={question}
              onChangeText={val => {
                setQuestion(val);
                if (errors.question) setErrors(prev => ({ ...prev, question: '' }));
              }}
              placeholder={t('battle.questionPlaceholder', 'Ask your question here...')}
              placeholderTextColor={surfaces.placeholderColor}
              style={[styles.inputText, { color: surfaces.inputText, textAlignVertical: 'top', minHeight: 60 }]}
              multiline
              maxLength={120}
            />
            <Text style={{ color: subtleMuted, fontSize: 12, textAlign: 'right', marginTop: 4 }}>{question.length}/120</Text>
          </View>
          {errors.question ? <Text style={styles.errorText}>{errors.question}</Text> : null}
        </View>

        <View style={{ marginTop: 16 }}>
          <Text style={[styles.fieldLabel, { color: primaryText, marginBottom: 8 }]}>{t('battle.examplesLabel', 'Examples:')}</Text>
          {exampleQuestions.map((q, idx) => (
            <TouchableOpacity key={idx} onPress={() => setQuestion(q)} style={{ backgroundColor: isDarkMode ? surfaces.listSurface : '#fff', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, marginBottom: 8 }}>
              <Text style={{ color: primaryText, fontWeight: '600', fontSize: 13 }}>{q}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity activeOpacity={0.9} onPress={handleNext} style={{ marginTop: 20 }}>
          <LinearGradient colors={[accent, text]} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{t('battle.next', 'Next')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </View>
  );
}

export function ChallengeBattleSettingsScreen({ navigation, route }) {
  const { bgStyle, text, card, bg, border, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const idleSurface = card || surfaces.listSurface;
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const primaryText = text || TEXT;
  const subtleMuted = mutedText || surfaces.mutedColor;
  const handleBack = useBattleBackHandler(navigation, route);

  const question = route?.params?.question || '';
  const selectedItems = route?.params?.selectedItems || [];

  const [duration, setDuration] = useState('3 DAYS');
  const [stake, setStake] = useState('0');
  const [isPublic, setIsPublic] = useState(true);
  const [launching, setLaunching] = useState(false);

  const handleNext = () => {
    navigation.navigate('ChallengeBattlePreview', {
      ...route?.params,
      duration,
      stake,
      isPublic
    });
  };

  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
      <Header title={t('battle.settingsTitle', 'Battle Settings')} onBack={handleBack} titleColor={text} />
      <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* <Stepper active={3} accent={accent} isDarkMode={isDarkMode} labels={[t('battle.stepper.step1', 'Choose your item'), t('battle.stepper.step2', 'Add your battle question'), t('battle.stepper.step3', 'Set battle details')]} /> */}

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: primaryText }]}>{t('battle.durationLabel')}</Text>
          <View style={styles.pillRow}>
            {[['24 HOURS', t('battle.duration24h')], ['3 DAYS', t('battle.duration3d')], ['7 DAYS', t('battle.duration7d')]].map(([value, label]) => (
              <TouchableOpacity
                key={value}
                onPress={() => setDuration(value)}
                style={[
                  styles.pill,
                  { backgroundColor: idleSurface, borderColor: border || surfaces.listBorder },
                  duration === value && [styles.pillActive, { borderColor: accent, backgroundColor: selectedSurface(accent, isDarkMode) }],
                ]}
              >
                <Text style={[styles.pillText, { color: primaryText }, duration === value && { color: accent, fontWeight: '800' }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: primaryText }]}>{t('battle.stake', 'Stake (Optional)')}</Text>
          <View style={[styles.inputCard, { backgroundColor: idleSurface, borderColor: border || surfaces.listBorder, paddingVertical: 12 }]}>
            <TextInput
              value={stake}
              onChangeText={setStake}
              keyboardType="numeric"
              style={[styles.inputText, { color: surfaces.inputText, padding: 0 }]}
            />
          </View>
          <Text style={[styles.sectionHint, { color: subtleMuted }]}>{t('battle.stakeHint', 'Add points as a stake to make it more exciting.')}</Text>
        </View>

        <View style={[styles.inputCard, { backgroundColor: idleSurface, borderColor: border || surfaces.listBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingVertical: 14 }]}>
          <Text style={[styles.fieldLabel, { color: primaryText, marginBottom: 0 }]}>{t('battle.publicBattle', 'Public Battle')}</Text>
          <TouchableOpacity onPress={() => setIsPublic(!isPublic)}>
            <Ionicons name={isPublic ? "toggle" : "toggle-outline"} size={32} color={isPublic ? accent : subtleMuted} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.sectionHint, { color: subtleMuted, marginTop: -2 }]}>{t('battle.publicHint', 'Keep this on to create a public battle.')}</Text>

        <View style={[styles.aboutCard, themedCard(idleSurface, border || surfaces.listBorder), { flexDirection: 'row', alignItems: 'flex-start', marginTop: 20 }]}>
          <Ionicons name="information-circle-outline" size={20} color={primaryText} style={{ marginRight: 8, marginTop: 2 }} />
          <Text style={[styles.aboutText, { color: primaryText, flex: 1 }]}>{t('battle.settingsInfo', 'The community will vote and the winner will be shown on both items.')}</Text>
        </View>

        <TouchableOpacity activeOpacity={0.9} onPress={handleNext} style={{ marginTop: 20 }}>
          <LinearGradient colors={[accent, text]} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{t('battle.next', 'Next')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </View>
  );
}

export function ChallengeShopListScreen({ navigation, route }) {
  const { bgStyle, text, card, bg, border, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const idleSurface = card || surfaces.listSurface;
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const primaryText = text || TEXT;
  const subtleMuted = mutedText || surfaces.mutedColor;
  const handleBack = () => navigation.goBack();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchShops = async () => {
      setLoading(true);
      try {
        const res = await getShops();
        let payload = res?.data?.data ?? res?.data;
        console.log("resresresresresresresres in getShops", res)
        let finalUsers = Array.isArray(payload) ? payload : (payload?.shops || payload?.items || payload?.users || []);
        if (!Array.isArray(finalUsers)) finalUsers = [];
        setUsers(finalUsers);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchShops();
  }, []);

  const filteredUsers = users.filter(u => (u.shopName || u.name || u.userName || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
      <Header title={t('battle.challengeShopTitle', 'Battle Item')} onBack={handleBack} titleColor={text} />
      <View style={{ paddingHorizontal: 16 }}>
        <Text style={[styles.sectionTitle, { color: primaryText }]}>{t('battle.challengeShopHeading', 'Challenge another shop')}</Text>
        <Text style={[styles.sectionHint, { color: subtleMuted, marginBottom: 16 }]}>{t('battle.challengeShopSub', 'Choose a shop to challenge')}</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <View style={[styles.inputCard, { backgroundColor: idleSurface, borderColor: border || surfaces.listBorder, flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }]}>
            <Ionicons name="search" size={18} color={surfaces.placeholderColor} style={{ marginRight: 8 }} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('battle.searchShops', 'Search shops...')}
              placeholderTextColor={surfaces.placeholderColor}
              style={[styles.inputText, { flex: 1, color: surfaces.inputText, padding: 0 }]}
            />
          </View>
          {/* <TouchableOpacity style={{ marginLeft: 12, padding: 10, backgroundColor: isDarkMode ? surfaces.listSurface : '#F3EFFF', borderRadius: 12 }}>
            <Ionicons name="options-outline" size={20} color={accent} />
          </TouchableOpacity> */}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={accent} style={{ marginTop: 20 }} />
        ) : (
          filteredUsers.map(user => (
            <View key={user.id || user._id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: border || surfaces.listBorder }}>
              {user.shopLogo ? (
                <FastImage source={fastImageSource(user.shopLogo)} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#E0E0E0', borderWidth: 1, borderColor: accent }} />
              ) : (
                <FastImage source={fastImageSource(user.profileImage || user.avatar)} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#E0E0E0' }} />
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: primaryText }}>{user.shopName || user.name || 'Valens Closet'}</Text>
                <Text style={{ fontSize: 12, color: subtleMuted, marginTop: 2 }}>@{user.shopUsername || user.userName || 'shop'}</Text>
                <Text style={{ fontSize: 12, color: subtleMuted, marginTop: 2 }}>{user.activeItemCount ?? user.itemsCount ?? 0} items</Text>
              </View>
              <TouchableOpacity
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: accent }}
                onPress={() => navigation.navigate('ChallengeShopItems', { shop: user, ...route?.params })}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: accent }}>View</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <View style={{ padding: 16, paddingBottom: 30 }}>
        <View style={[styles.aboutCard, themedCard(idleSurface, border || surfaces.listBorder), { flexDirection: 'row', alignItems: 'flex-start' }]}>
          <Ionicons name="help-circle" size={24} color={accent} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.aboutTitle, { color: primaryText, fontSize: 14 }]}>{t('battle.howItWorks', 'How it works')}</Text>
            <Text style={[styles.aboutText, { color: subtleMuted, marginTop: 4 }]}>{t('battle.howItWorksText', 'You challenge a shop by selecting one of their items. The community will vote for their favorite!')}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export function ChallengeShopItemsScreen({ navigation, route }) {
  const { bgStyle, text, card, bg, border, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const idleSurface = card || surfaces.listSurface;
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const primaryText = text || TEXT;
  const subtleMuted = mutedText || surfaces.mutedColor;
  const handleBack = () => navigation.goBack();

  const shop = route?.params?.shop || {};
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      try {
        const closetId = shop.id || shop._id;
        const response = await getClosetItemsByClosetId(closetId);
        const payload = response?.data?.data ?? response?.data?.items ?? response?.data ?? response;
        const nextItems = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.data) ? payload.data : [];
        const normalized = normalizeItems(nextItems, t);
        setItems(normalized);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (shop.id || shop._id) fetchItems();
    else setLoading(false);
  }, [shop]);

  const filteredItems = items.filter(i => (i.name || '').toLowerCase().includes(search.toLowerCase()));

  const handleCreateBattle = () => {
    const shopSelectedItem = items.find(i => i.id === selectedId);
    shopSelectedItem.sellerName = shop.shopName || shop.name || shop.userName;
    const selectedItems = [route?.params?.selectedItems[0], shopSelectedItem];
    navigation.navigate('ChallengeBattleSetup', { ...route?.params, selectedItems });
  };

  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
      <Header title={t('battle.challengeShopTitle', 'Battle Item')} onBack={handleBack} titleColor={text} />
      <View style={{ paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          {shop.shopLogo ? (
            <FastImage source={fastImageSource(shop.shopLogo)} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#E0E0E0', borderWidth: 1, borderColor: accent }} />
          ) : (
            <FastImage source={fastImageSource(shop.profileImage || shop.avatar)} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#E0E0E0' }} />
          )}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: primaryText }}>{shop.shopName || shop.name || 'Valens Closet'}</Text>
            <Text style={{ fontSize: 12, color: subtleMuted }}>@{shop.shopUsername || shop.userName || 'shop'}</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: primaryText }}>{items.length} items</Text>
        </View>

        <View style={[styles.inputCard, { backgroundColor: idleSurface, borderColor: border || surfaces.listBorder, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, marginBottom: 16 }]}>
          <Ionicons name="search" size={18} color={surfaces.placeholderColor} style={{ marginRight: 8 }} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('battle.searchShopItems', 'Search items in this shop...')}
            placeholderTextColor={surfaces.placeholderColor}
            style={[styles.inputText, { flex: 1, color: surfaces.inputText, padding: 0 }]}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={accent} style={{ marginTop: 20 }} />
        ) : (
          <View style={styles.grid}>
            {filteredItems.map(item => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.9}
                onPress={() => setSelectedId(item.id)}
                style={[
                  styles.gridCard,
                  { backgroundColor: idleSurface, borderColor: border || surfaces.listBorder },
                  selectedId === item.id && [styles.gridCardSelected, { borderColor: accent }],
                ]}
              >
                {selectedId === item.id ? (
                  <View style={[styles.selectionDot, { backgroundColor: accent }]}>
                    <Ionicons name="checkmark" size={12} color={isDarkMode ? '#111' : '#fff'} />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.selectionDotGhost,
                      {
                        backgroundColor: isDarkMode ? 'rgba(0,0,0,0.35)' : 'transparent',
                        borderColor: isDarkMode ? 'rgba(255,255,255,0.45)' : '#D8CBEF',
                      },
                    ]}
                  />
                )}
                <FastImage source={fastImageSource(item.image)} style={styles.gridImage} resizeMode={FastImage.resizeMode.cover} />
                <Text style={[styles.gridName, { color: primaryText }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.gridPrice, { color: accent }]}>{item.price}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={{ padding: 16, paddingBottom: Platform.OS === 'android' ? 20 : 30 }}>
        <TouchableOpacity
          activeOpacity={0.9}
          disabled={!selectedId}
          onPress={handleCreateBattle}
        >
          <LinearGradient colors={[accent, text]} style={[styles.primaryButton, !selectedId && { opacity: 0.5 }]}>
            <Text style={styles.primaryButtonText}>{t('battle.createBattleBtn2', 'Create Battle')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function BattleLiveScreen({ navigation, route }) {
  const { bgStyle, text, card, bg, border, mutedText, accent: themeAccent } = useClosetTheme(route);
  const { isDarkMode } = useThemeContext();
  const { t } = useLanguage();
  const brandAccent = themeAccent || PURPLE;
  // Label/price color: profile text (purple/gold in light, white/gold in dark)
  const accent = text || brandAccent;
  const primaryText = text || TEXT;
  const subtleMuted = mutedText || MUTED;
  const surface = card || (isDarkMode ? '#1E1E1E' : '#fff');
  const voteIdleColors = isDarkMode ? [surface, surface] : ['#FFFFFF', '#FFFFFF'];
  const voteIdleBorder = isDarkMode ? (border || '#333') : '#E5E7EB';
  const battleId = route?.params?.battleId;
  const initialBattle = route?.params?.initialBattle || null;
  const returnTo = route?.params?.returnTo;
  const isOwnProfile = route?.params?.isOwnProfile ?? false;
  const launchedFromPreview = route?.params?.launchedFromPreview ?? false;
  const cameFromCard = !!initialBattle;
  const battleBack = useBattleBackHandler(navigation, route);

  console.log("-----------------initialBattle-----------------", initialBattle)
  const handleBack = useCallback(() => {
    if (returnTo?.screen === "SearchHome") {
      navigation.navigate('MainApp', {
        screen: 'Search',
      });
      return;
    }
    else if (returnTo?.screen === "HeartNotification"){
      navigation.navigate('HomeMain', { 
        screen: 'HeartNotification' 
      });
      return;
    }
    else {
      battleBack();
    }
  }, [returnTo, navigation, battleBack]);
  const handleDonePress = useCallback(() => {
    if (returnTo) {
      navigateClosetReturn(navigation, returnTo);
      return;
    }
    if (launchedFromPreview) {
      navigation.navigate('MainApp', {
        screen: 'wallet',
        params: { screen: 'MyCloset' },
      });
      return;
    }
    if (isOwnProfile) {
      navigation.navigate('MainApp', {
        screen: 'wallet',
        params: { screen: 'MyCloset' },
      });
      return;
    }
    if (navigation.canGoBack?.()) {
      navigation.goBack();
    }
  }, [navigation, returnTo, isOwnProfile, launchedFromPreview]);

  const handleBackPress = useCallback(() => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigateClosetReturn(navigation, returnTo);
  }, [navigation, returnTo]);

  const [battle, setBattle] = useState(() => (initialBattle ? normalizeBattle(initialBattle) : null));
  const [loading, setLoading] = useState(() => !!battleId && !initialBattle);
  const [loadError, setLoadError] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [votedParticipantId, setVotedParticipantId] = useState(null);
  const [votingParticipantId, setVotingParticipantId] = useState(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [checkingVote, setCheckingVote] = useState(false);

  // --- comments state ---------------------------------------------------
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState('');

  const question = battle?.title || route?.params?.question || t('battle.defaultQuestion');
  console.log("battle?.items-------------------------------------", battle)
  const selectedItems = battle?.items?.length ? battle.items : route?.params?.selectedItems || [];
  const isCreator = !!currentUserId && !!battle?.createdBy && currentUserId === battle.createdBy;
  const showResultsBar =
    hasVoted ||
    isOwnProfile ||
    isCreator ||
    !!route?.params?.showResultsBar ||
    cameFromCard ||
    (battle && (battle.status !== 'LIVE' || battle.outcome !== 'PENDING'));
  const voteAudienceText = battle?.whoCanVote === 'Followers' ? t('battle.followersOnly') : t('battle.everyoneCanVote');
  const isBattleLive = battle?.status === 'LIVE' && battle?.outcome === 'PENDING';
  const isBattleExpired =
    battle?.status === 'EXPIRED' ||
    battle?.outcome === 'EXPIRED' ||
    (!isBattleLive && battle?.daysLeft === 0);
  const isBattleFinished = ['COMPLETED', 'FINISHED', 'ENDED', 'CLOSED'].includes(String(battle?.status || '').toUpperCase());
  const isBattleVotingOpen = !isBattleExpired && battle?.outcome !== 'CANCELLED';
  const canVote = isBattleVotingOpen && !hasVoted && !checkingVote && !isOwnProfile && !isCreator;
  const liveScreenTitle = isBattleExpired ? (t('battleInProgress.battleEnded') || 'Battle Ended') : t('battle.liveTitle');
  const votedLabel = t('battle.voting') || 'Voting...';
  console.log("selectedItems---------------------------", selectedItems)
  const leftItem = selectedItems[0] || {};
  const rightItem = selectedItems[1] || {};
  const leftVoteCount = Number(leftItem?.voteCount ?? 0);
  const rightVoteCount = Number(rightItem?.voteCount ?? 0);
  const totalItemVotes = leftVoteCount + rightVoteCount;
  const leftPctValue = Number(leftItem?.votePercentage ?? leftItem?.pct);
  const rightPctValue = Number(rightItem?.votePercentage ?? rightItem?.pct);
  const leftVotePercent = totalItemVotes > 0
    ? Math.round((leftVoteCount / totalItemVotes) * 100)
    : Number.isFinite(leftPctValue)
      ? Math.round(leftPctValue)
      : (battle?.leftVotePercent ?? 50);
  const rightVotePercent = Number.isFinite(rightPctValue)
    ? Math.round(rightPctValue)
    : 100 - leftVotePercent;
  const battleIsResolved =
    isBattleExpired ||
    isBattleFinished ||
    ['WINNER', 'COMPLETED', 'FINISHED', 'ENDED', 'CLOSED'].includes(String(battle?.outcome || '').toUpperCase());
  const explicitWinnerSide = leftItem?.isWinner
    ? 'left'
    : rightItem?.isWinner
      ? 'right'
      : null;
  const winnerProductId = String(
    battle?.winnerProductId ||
    route?.params?.battleWinner?.productId ||
    '',
  );
  const winnerParticipantId = String(
    battle?.winnerParticipantId ||
    route?.params?.battleWinner?.participantId ||
    '',
  );
  const winnerParticipantSide = winnerParticipantId
    ? String(leftItem?.participantId || '') === winnerParticipantId
      ? 'left'
      : String(rightItem?.participantId || '') === winnerParticipantId
        ? 'right'
        : null
    : null;
  const winnerProductSide = winnerProductId
    ? String(leftItem?.id || leftItem?.productId || '') === winnerProductId
      ? 'left'
      : String(rightItem?.id || rightItem?.productId || '') === winnerProductId
        ? 'right'
      : null
    : null;
  const pctWinnerSide =
    battleIsResolved &&
    Number.isFinite(leftPctValue) &&
    Number.isFinite(rightPctValue) &&
    leftPctValue !== rightPctValue
      ? leftPctValue > rightPctValue
        ? 'left'
        : 'right'
      : null;
  const voteWinnerSide =
    battleIsResolved && totalItemVotes > 0 && leftVoteCount !== rightVoteCount
      ? leftVoteCount > rightVoteCount
        ? 'left'
        : 'right'
      : null;
  const winnerSide = explicitWinnerSide || winnerParticipantSide || winnerProductSide || voteWinnerSide || pctWinnerSide;
  const winnerItem = winnerSide === 'right' ? rightItem : leftItem;
  const runnerUpItem = winnerSide === 'right' ? leftItem : rightItem;
  const winnerPercent = winnerSide === 'right'
    ? Number(rightItem?.votePercentage ?? rightItem?.pct ?? rightVotePercent)
    : Number(leftItem?.votePercentage ?? leftItem?.pct ?? leftVotePercent);
  const showWinnerCard = battleIsResolved && !!winnerSide;

  const checkExistingVote = useCallback(async () => {
    if (!battleId) return;
    setCheckingVote(true);
    try {
      const userId = currentUserId || await AsyncStorage.getItem('userId');
      if (!userId) return;

      const response = await getBattleVoters(battleId, 1, 100);
      const data = response?.data?.data ?? response?.data ?? response;
      const voters = data?.voters || [];
      const myVote = voters.find(v => v?.user?.id === userId);
      if (myVote) {
        setHasVoted(true);
        setVotedParticipantId(myVote?.participant?.id ?? null);
      }
    } catch {
      // Non-fatal — if this fails, the user just sees the vote buttons again.
    } finally {
      setCheckingVote(false);
    }
  }, [battleId, currentUserId]);

  const loadBattle = useCallback(async () => {
    if (!battleId) return;
    setLoading(!initialBattle);
    setLoadError(null);
    try {
      const response = await getMarketplaceBattleDetails(battleId);
      const data = response?.data?.data ?? response?.data ?? response;
      const raw = data?.battle ?? data?.battles?.[0] ?? data;
      setBattle(normalizeBattle(raw));
    } catch {
      setLoadError(t('battle.errors.battleLoadFailed') || 'Could not load this battle.');
    } finally {
      setLoading(false);
    }
  }, [battleId, initialBattle, t]);

  // GET /marketplace-battles/{battleId}/comments
  const loadComments = useCallback(async (isSilent = false) => {
    if (!battleId) return;
    if (!isSilent) setCommentsLoading(true);
    setCommentsError(null);
    try {
      const response = await getMarketplaceBattleComments(battleId, 1, 20, 'desc');
      const data = response?.data?.data ?? response?.data ?? response;
      const rawComments = Array.isArray(data)
        ? data
        : Array.isArray(data?.comments)
          ? data.comments
          : Array.isArray(data?.items)
            ? data.items
            : [];
      setComments(rawComments.map((comment, index) => normalizeMarketplaceComment(comment, index)));
    } catch (err) {
      setCommentsError(t('battle.errors.commentsLoadFailed') || 'Could not load comments.');
    } finally {
      setCommentsLoading(false);
    }
  }, [battleId, t]);

  const trackBattleView = useCallback(async () => {
    if (!battleId || !currentUserId) return;
    if (String(currentUserId) === String(battle?.createdBy)) return;
    try {
      await trackMarketplaceBattleView(battleId);
      await loadBattle();
    } catch {
      // View tracking is best-effort and should never block the screen.
    }
  }, [battle?.createdBy, battleId, currentUserId, loadBattle]);

  const handleVote = async () => {
    const item = [leftItem, rightItem].find(entry => entry?.participantId === selectedParticipantId);
    if (checkingVote || hasVoted || votedParticipantId) {
      Alert.alert(
        t('battle.errors.voteFailedTitle') || 'Could not submit vote',
        t('battle.alreadyVoted') || 'You have already voted in this battle.',
      );
      return;
    }
    if (!battleId || !item?.participantId) {
      Alert.alert(
        t('battle.errors.voteFailedTitle') || 'Could not submit vote',
        t('battleInProgress.voteAlertSelectOption') || t('battle.errors.voteFailedGeneric') || 'Something went wrong. Please try again.',
      );
      return;
    }
    setVotingParticipantId(item.participantId);
    try {
      const response = await voteOnBattle(battleId, item.participantId);
      setHasVoted(true);
      setVotedParticipantId(item.participantId);
      await loadBattle();
    } catch (err) {
      const statusCode = err?.response?.data?.statusCode || err?.response?.status;
      const message = err?.response?.data?.message;
      const friendlyMessage =
        statusCode === 400 && /live marketplace battles/i.test(message || '')
          ? (t('battle.voteOnlyLiveBattles') || 'Voting is only allowed for live battles.')
          : (message || t('battle.errors.voteFailedGeneric') || 'Something went wrong. Please try again.');
      Alert.alert(
        t('battle.errors.voteFailedTitle') || 'Could not submit vote',
        friendlyMessage,
      );
    } finally {
      setVotingParticipantId(null);
    }
  };

  // POST /marketplace-battles/{battleId}/comments — { comment: string }
  const handlePostComment = async () => {
    const message = commentText.trim();
    if (!message || !battleId || postingComment || isBattleExpired) return;
    setPostingComment(true);
    try {
      const response = await addMarketplaceBattleComment(battleId, message);
      const isOk =
        (typeof response?.status === 'number' && response.status >= 200 && response.status < 300) ||
        (typeof response?.statusCode === 'number' && response.statusCode >= 200 && response.statusCode < 300) ||
        response?.success === true ||
        response;
      if (!isOk) {
        Alert.alert(
          t('battle.errors.commentNotPosted') || 'Could not post comment',
          response?.message || t('battleInProgress.tryAgain') || 'Please try again.',
        );
        return;
      }
      setCommentText('');
      await loadComments(true);
      setBattle(prev => (prev ? { ...prev, totalComments: (prev.totalComments || 0) + 1 } : prev));
    } catch (err) {
      Alert.alert(
        t('battle.errors.commentNotPosted') || 'Could not post comment',
        err?.response?.data?.message || err?.message || t('battleInProgress.tryAgain') || 'Please try again.',
      );
    } finally {
      setPostingComment(false);
    }
  };

  const confirmDeleteComment = (comment) => {
    if (!comment?.id || deletingCommentId) return;
    Alert.alert(
      t('battle.deleteCommentTitle') || 'Delete comment?',
      t('battle.deleteCommentMessage') || 'This comment will be removed permanently.',
      [
        {
          text: t('battle.cancel') || 'Cancel',
          style: 'cancel',
        },
        {
          text: t('battle.delete') || 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteComment(comment),
        },
      ],
    );
  };

  // DELETE /marketplace-battles/{battleId}/comments/{commentId} — own comment only
  const handleDeleteComment = async (comment) => {
    if (!battleId || !comment?.id || deletingCommentId) return;
    setDeletingCommentId(comment.id);
    const previousComments = comments;
    setComments(prev => prev.filter(c => c.id !== comment.id));
    try {
      const response = await deleteMarketplaceBattleComment(battleId, comment.id);
      const isOk =
        (typeof response?.status === 'number' && response.status >= 200 && response.status < 300) ||
        (typeof response?.statusCode === 'number' && response.statusCode >= 200 && response.statusCode < 300) ||
        response?.success === true ||
        response;
      if (!isOk) throw new Error(response?.message || 'Unable to delete comment.');
      setBattle(prev => (prev ? { ...prev, totalComments: Math.max((prev.totalComments || 1) - 1, 0) } : prev));
    } catch (err) {
      setComments(previousComments);
      Alert.alert(
        t('battle.errors.commentNotDeleted') || 'Could not delete comment',
        err?.response?.data?.message || err?.message || t('battleInProgress.tryAgain') || 'Please try again.',
      );
    } finally {
      setDeletingCommentId('');
    }
  };

  const handleReactToComment = useCallback(async (comment, reaction) => {
    if (!battleId || !comment?.id) return;

    const currentReaction = comment?.userReaction || null;
    const nextReaction = currentReaction === reaction ? 'NONE' : reaction;
    const previousComments = comments;

    setComments(prev =>
      prev.map(item => {
        if (item.id !== comment.id) return item;

        const wasLike = currentReaction === 'LIKE';
        const wasDislike = currentReaction === 'DISLIKE';
        const willLike = nextReaction === 'LIKE';
        const willDislike = nextReaction === 'DISLIKE';

        return {
          ...item,
          likes: Math.max(0, (item.likes || 0) - (wasLike ? 1 : 0) + (willLike ? 1 : 0)),
          dislikes: Math.max(0, (item.dislikes || 0) - (wasDislike ? 1 : 0) + (willDislike ? 1 : 0)),
          userReaction: nextReaction === 'NONE' ? null : nextReaction,
        };
      }),
    );

    try {
      const response = await reactToMarketplaceBattleComment(battleId, comment.id, nextReaction);
      console.log("-----------reactToMarketplaceBattleComment----------", response)
      const data = response?.data?.data ?? response?.data ?? response;
      setComments(prev =>
        prev.map(item =>
          item.id === comment.id
            ? {
              ...item,
              likes: Number(data?.likeCount ?? item.likes ?? 0) || 0,
              dislikes: Number(data?.dislikeCount ?? item.dislikes ?? 0) || 0,
              userReaction: data?.userReaction ?? item.userReaction ?? null,
            }
            : item,
        ),
      );
    } catch (err) {
      setComments(previousComments);
      Alert.alert(
        t('battle.errors.commentReactionFailed') || 'Could not update reaction.',
        err?.response?.data?.message || err?.message || t('battleInProgress.tryAgain') || 'Please try again.',
      );
    }
  }, [battleId, comments, t]);

  // All useEffects together, still before any early return
  useEffect(() => {
    AsyncStorage.getItem('userId').then(setCurrentUserId).catch(() => { });
  }, []);

  useEffect(() => {
    if (initialBattle) {
      setBattle(normalizeBattle(initialBattle));
      setLoadError(null);
    }
    loadBattle();
  }, [initialBattle, loadBattle]);

  useEffect(() => {
    checkExistingVote();
  }, [checkExistingVote]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  useFocusEffect(
    useCallback(() => {
      trackBattleView();
    }, [trackBattleView])
  );

  // Early returns come AFTER every hook above — nothing hook-related below this point
  if (loading) {
    return (
      <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG, justifyContent: 'center' }]}>
        <ActivityIndicator color={accent} />
      </View>
    );
  }

  if (loadError || selectedItems.length < 2) {
    return (
      <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
        <Header title={liveScreenTitle} onBack={handleBack} titleColor={text} />
        <View style={styles.centeredNotice}>
          <Text style={styles.errorText}>{loadError || t('battle.errors.missingItems')}</Text>
          {battleId ? (
            <TouchableOpacity onPress={loadBattle} style={[styles.retryBtn, { borderColor: accent }]}>
              <Text style={{ color: accent, fontWeight: '700' }}>{t('battle.retry') || 'Retry'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView
      style={[styles.screen, bgStyle]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      enableOnAndroid
      extraScrollHeight={20}
      keyboardShouldPersistTaps="handled"
    >
      <Header
        title={liveScreenTitle}
        onBack={handleBack}
        rightIcon="share-outline"
        accentColor={text}
        titleColor={text}
        onShare={async () => {
          try {
            await Share.share({ message: t('battle.shareLiveMessage') });
          } catch {
            Alert.alert(t('battle.shareTitle'), t('battle.shareUnavailable'));
          }
        }}
      />

      <View style={liveStyles.topRow}>
        <View style={[liveStyles.categoryPill, { borderColor: accent }]}>
          <Text style={[liveStyles.categoryPillText, { color: accent }]}>{battle?.category || t('battle.opinionBattle')}</Text>
        </View>
        <View style={liveStyles.daysLeftRow}>
          <Ionicons name="time-outline" size={13} color={subtleMuted} />
          <Text style={[liveStyles.daysLeftText, { color: subtleMuted }]}>{t('battle.daysLeft', { count: battle?.daysLeft ?? 0 })}</Text>
        </View>
      </View>

      {(battle?.creatorName || battle?.creatorAvatar || battle?.creatorShopName || battle?.sellerName) ? (
        <View style={liveStyles.creatorRow}>
          <HexAvatar uri={battle.creatorAvatar} size={44} borderWidth={1} borderColor={accent} />
          <View style={liveStyles.creatorDetails}>
            <Text style={[liveStyles.creatorLabel, { color: mutedText }]}>{t('battle.battleBy') || 'Battle By'}</Text>
            <Text style={[liveStyles.creatorName, { color: primaryText }]} numberOfLines={1}>
              {battle.creatorName || battle.sellerName || battle.creatorShopName || 'Valens User'}
            </Text>
            {battle.creatorShopName ? (
              <Text style={[liveStyles.creatorShop, { color: mutedText }]} numberOfLines={1}>
                {battle.creatorShopName}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
      <Text style={[liveStyles.question, { color: primaryText }]}>{question}</Text>
      <Text style={[liveStyles.questionSub, { color: subtleMuted }]}>{t('battle.voteSwipeHint') || 'Your vote swipe others decide'}</Text>

      <BattleCard
        left={showWinnerCard ? winnerItem : leftItem}
        right={showWinnerCard ? runnerUpItem : rightItem}
        showWinner={showWinnerCard}
        winnerPercent={Number.isFinite(winnerPercent) ? Math.round(winnerPercent) : null}
        accent={accent}
        textColor={primaryText}
        isDarkMode={isDarkMode}
        card={surface}
        border={border || BORDER}
      />

      {/* Vote choice buttons with live counts */}
      {!isOwnProfile && !isCreator ? (
        <View style={liveStyles.voteButtonsRow}>
          {[leftItem, rightItem].map((item, index) => {
            const isThisVoting = votingParticipantId === item?.participantId;
            const isThisVoted = votedParticipantId === item?.participantId;
            const isSelected = selectedParticipantId === item?.participantId;
            const sideLabel = index === 0 ? 'A' : 'B';
            return (
              <TouchableOpacity
                key={item?.participantId || item?.id || index}
                activeOpacity={0.9}
                disabled={!canVote || isThisVoting}
                onPress={() => setSelectedParticipantId(item?.participantId)}
                style={[
                  liveStyles.voteButtonWrap,
                  isSelected && liveStyles.voteButtonWrapSelected,
                  (!canVote || isThisVoting) && { opacity: 0.7 },
                ]}
              >
                <LinearGradient

                  colors={isThisVoted ? ['#22C55E', '#16A34A'] : isSelected ? [brandAccent, accent] : voteIdleColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    liveStyles.voteButtonInner,
                    {
                      borderWidth: 1,
                      borderColor: isThisVoted ? '#16A34A' : isSelected ? brandAccent : voteIdleBorder,
                    },
                  ]}
                >
                  {isThisVoting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons
                        name={isThisVoted ? 'checkmark-circle' : 'thumbs-up'}
                        size={16}
                        color={isThisVoted || isSelected ? '#fff' : accent}
                      />
                      <Text style={[liveStyles.voteButtonText, { color: isThisVoted || isSelected ? '#fff' : primaryText }]}>
                        {t('battle.vote') || 'Vote'}
                      </Text>
                      <Text style={[liveStyles.voteButtonCount, { color: isThisVoted || isSelected ? '#fff' : accent }]}>
                        {sideLabel}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}


      {canVote && !hasVoted ? (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleVote}
          disabled={!selectedParticipantId || votingParticipantId}
          style={[
            liveStyles.submitVoteWrap,
            (!selectedParticipantId || votingParticipantId) && { opacity: 0.5 },
          ]}
        >
          <LinearGradient

            colors={[brandAccent, accent]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={liveStyles.submitVoteButton}
          >
            {votingParticipantId ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={liveStyles.submitVoteText}>
                {t('battleInProgress.voteInBattle') || t('battle.vote') || 'Vote in battle'}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      ) : null}

      {showResultsBar ? (
        <View style={[liveStyles.progressCard, { borderColor: border || BORDER, backgroundColor: surface }]}>
          <View style={liveStyles.progressTopRow}>
            <View>
              <Text style={[liveStyles.progressPctLeft, { color: accent }]}>{leftVotePercent}%</Text>
              <Text style={[liveStyles.progressVotes, { color: subtleMuted }]}>
                {leftVoteCount} {t('battleInProgress.votesLabel')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={liveStyles.progressPctRight}>{rightVotePercent}%</Text>
              <Text style={[liveStyles.progressVotes, { color: subtleMuted }]}>
                {rightVoteCount} {t('battleInProgress.votesLabel')}
              </Text>
            </View>
          </View>
          <View style={liveStyles.progressBarTrack}>
            <View style={[liveStyles.progressBarLeft, { flex: leftVotePercent || 1, backgroundColor: brandAccent }]} />
            <View style={[liveStyles.progressBarRight, { flex: rightVotePercent || 1, backgroundColor: '#ef4444' }]} />
          </View>
          <View style={liveStyles.progressBottomRow}>
            <View style={[liveStyles.sideTagLeft, !isDarkMode && { backgroundColor: '#e8f5e9' }, isDarkMode && { backgroundColor: 'rgba(34,197,94,0.22)' }]}>
              <Text style={[liveStyles.sideTagText, isDarkMode ? { color: '#86EFAC' } : { color: '#374151' }]}>{leftItem?.name || leftItem?.label || 'Option 1'}</Text>
            </View>
            <View style={[liveStyles.sideTagRight, !isDarkMode && { backgroundColor: '#fde8e8' }, isDarkMode && { backgroundColor: 'rgba(239,68,68,0.22)' }]}>
              <Text style={[liveStyles.sideTagText, isDarkMode ? { color: '#FCA5A5' } : { color: '#374151' }]}>{rightItem?.name || rightItem?.label || 'Option 2'}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Stats row: views / comments / likes */}
      <View style={[liveStyles.statsRow, { backgroundColor: surface, borderColor: border || BORDER, borderWidth: StyleSheet.hairlineWidth }]}>
        <View style={liveStyles.statItem}>
          <Ionicons name="eye-outline" size={16} color={subtleMuted} />
          <Text style={[liveStyles.statValue, { color: primaryText }]}>{battle?.totalViews ?? 0}</Text>
          <Text style={[liveStyles.statLabel, { color: subtleMuted }]}>{t('battle.stats.views') || 'Views'}</Text>
        </View>
        <View style={[liveStyles.statDivider, { backgroundColor: border || BORDER }]} />
        <View style={liveStyles.statItem}>
          <Ionicons name="chatbubble-outline" size={16} color={subtleMuted} />
          <Text style={[liveStyles.statValue, { color: primaryText }]}>{battle?.totalComments ?? comments.length}</Text>
          <Text style={[liveStyles.statLabel, { color: subtleMuted }]}>{t('battle.stats.comments') || 'Comments'}</Text>
        </View>
        <View style={[liveStyles.statDivider, { backgroundColor: border || BORDER }]} />
        <View style={liveStyles.statItem}>
          <Ionicons name="heart-outline" size={16} color={subtleMuted} />
          <Text style={[liveStyles.statValue, { color: primaryText }]}>{battle?.totalLikes ?? 0}</Text>
          <Text style={[liveStyles.statLabel, { color: subtleMuted }]}>{t('battle.stats.likes') || 'Likes'}</Text>
        </View>
      </View>

      {/* Comments section — GET/POST/DELETE /marketplace-battles/{battleId}/comments */}
      <View style={[liveStyles.commentsCard, { backgroundColor: surface, borderColor: border || BORDER }]}>
        <View style={liveStyles.commentsHeaderRow}>
          <Text style={[liveStyles.commentsTitle, { color: primaryText }]}>
            {t('battle.commentsTitle') || 'Comments'} ({battle?.totalComments ?? comments.length})
          </Text>
        </View>

        {commentsLoading ? (
          <ActivityIndicator style={{ marginVertical: 16 }} color={accent} />
        ) : commentsError ? (
          <View style={liveStyles.commentsNotice}>
            <Text style={styles.errorText}>{commentsError}</Text>
            <TouchableOpacity onPress={() => loadComments()} style={[styles.retryBtn, { borderColor: accent }]}>
              <Text style={{ color: accent, fontWeight: '700' }}>{t('battle.retry') || 'Retry'}</Text>
            </TouchableOpacity>
          </View>
        ) : comments.length === 0 ? (
          <Text style={[liveStyles.emptyCommentsText, { color: subtleMuted }]}>
            {t('battle.noCommentsYet') || 'Be the first to share your thoughts.'}
          </Text>
        ) : (
          comments.map(comment => {
            const isOwnComment = currentUserId && comment.userId === String(currentUserId);
            return (
              <View key={comment.id} style={liveStyles.commentRow}>
                <CommentAvatarCircle uri={comment.avatar} size={32} />
                <View style={liveStyles.commentBody}>
                  <View style={liveStyles.commentTopRow}>
                    <Text style={[liveStyles.commentAuthor, { color: primaryText }]} numberOfLines={1}>
                      {comment.authorName}
                    </Text>
                    <Text style={[liveStyles.commentTime, { color: subtleMuted }]}>{comment.timeAgo}</Text>
                  </View>
                  <Text style={[liveStyles.commentMessage, { color: primaryText }]}>{comment.message}</Text>
                  <View style={liveStyles.commentActionsRow}>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => handleReactToComment(comment, 'LIKE')}
                      style={[
                        liveStyles.commentReactionChip,
                        {
                          backgroundColor:
                            comment.userReaction === 'LIKE'
                              ? selectedSurface(brandAccent, isDarkMode)
                              : isDarkMode
                                ? 'rgba(255,255,255,0.08)'
                                : (card || surface),
                        },
                      ]}
                    >
                      <Ionicons
                        name={comment.userReaction === 'LIKE' ? 'thumbs-up' : 'thumbs-up-outline'}
                        size={13}
                        color={comment.userReaction === 'LIKE' ? (isDarkMode ? '#93C5FD' : '#2563EB') : subtleMuted}
                      />
                      <Text
                        style={[
                          liveStyles.commentReactionText,
                          {
                            color:
                              comment.userReaction === 'LIKE'
                                ? isDarkMode
                                  ? '#93C5FD'
                                  : '#1D4ED8'
                                : subtleMuted,
                          },
                        ]}
                      >
                        {comment.likes}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => handleReactToComment(comment, 'DISLIKE')}
                      style={[
                        liveStyles.commentReactionChip,
                        {
                          backgroundColor:
                            comment.userReaction === 'DISLIKE'
                              ? selectedSurface(brandAccent, isDarkMode)
                              : isDarkMode
                                ? 'rgba(255,255,255,0.08)'
                                : (card || surface),
                        },
                      ]}
                    >
                      <Ionicons
                        name={comment.userReaction === 'DISLIKE' ? 'thumbs-down' : 'thumbs-down-outline'}
                        size={13}
                        color={comment.userReaction === 'DISLIKE' ? (isDarkMode ? '#FCA5A5' : '#DC2626') : subtleMuted}
                      />
                      <Text
                        style={[
                          liveStyles.commentReactionText,
                          {
                            color:
                              comment.userReaction === 'DISLIKE'
                                ? isDarkMode
                                  ? '#FCA5A5'
                                  : '#DC2626'
                                : subtleMuted,
                          },
                        ]}
                      >
                        {comment.dislikes}
                      </Text>
                    </TouchableOpacity>
                    {isOwnComment ? (
                      <TouchableOpacity
                        onPress={() => confirmDeleteComment(comment)}
                        disabled={deletingCommentId === comment.id}
                        style={liveStyles.commentDeleteBtn}
                      >
                        {deletingCommentId === comment.id ? (
                          <ActivityIndicator size="small" color="#DC2626" />
                        ) : (
                          <Text style={liveStyles.commentDeleteText}>{t('battle.delete') || 'Delete'}</Text>
                        )}
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })
        )}

        {/* Comment composer */}
        <View style={[liveStyles.composerRow, { borderColor: border || BORDER }]}>
          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder={t('battle.shareYourThoughts') || 'Share your thoughts...'}
            placeholderTextColor={subtleMuted}
            style={[
              liveStyles.composerInput,
              {
                color: isBattleExpired ? subtleMuted : primaryText,
                backgroundColor: isBattleExpired
                  ? (isDarkMode ? (border || '#333') : '#F3F4F6')
                  : (card || surface),
              },
            ]}
            multiline
            editable={!isBattleExpired}
          />
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!commentText.trim() || postingComment || isBattleExpired}
            onPress={handlePostComment}
            style={[
              liveStyles.composerSendBtn,
              {
                opacity: (!commentText.trim() || postingComment || isBattleExpired) ? 0.5 : 1,
                backgroundColor: isBattleExpired ? (isDarkMode ? border : '#D1D5DB') : brandAccent,
              },
            ]}
          >
            {postingComment ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={16} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footerActions}>
        <TouchableOpacity activeOpacity={0.9} onPress={handleDonePress} style={styles.footerActionFlex}>
          <LinearGradient colors={[brandAccent, accent]} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{t('battle.done') || 'Done'}</Text>
          </LinearGradient>
        </TouchableOpacity>
        {isBattleFinished ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('BattleResultsScreen', { battleId })}
            style={styles.footerActionFlex}
          >
            <LinearGradient colors={[brandAccent, accent]} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{t('battle.viewResults') || 'View Results'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}
      </View>
    </KeyboardAwareScrollView>
  );
}

// Styles specific to the redesigned BattleLiveScreen (kept separate from the
// legacy `styles` StyleSheet used by the other screens in this file).
const liveStyles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 10 },
  categoryPill: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  categoryPillText: { fontSize: 12, fontWeight: '800' },
  daysLeftRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  daysLeftText: { fontSize: 12, fontWeight: '600', color: MUTED },
  question: { fontSize: 19, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  questionSub: { fontSize: 12, fontWeight: '600', color: MUTED, textAlign: 'center', marginBottom: 14 },

  voteButtonsRow: { flexDirection: 'row', gap: 12, marginTop: 14, marginBottom: 4 },
  voteButtonWrap: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  voteButtonWrapSelected: { transform: [{ scale: 1.01 }] },
  voteButtonInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 46, paddingHorizontal: 10 },
  voteButtonText: { fontSize: 14, fontWeight: '800' },
  voteButtonCount: { fontSize: 14, fontWeight: '900', marginLeft: 2 },
  submitVoteWrap: { marginTop: 12, borderRadius: 16, overflow: 'hidden' },
  submitVoteButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  submitVoteText: { color: '#fff', fontSize: 15, fontWeight: '900' },

  progressCard: { borderRadius: 12, borderWidth: 1, borderColor: '#d3d1d1', padding: 12, marginTop: 14, marginBottom: 22, marginRight: 15, marginLeft: 5 },
  progressTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  progressPctLeft: { fontSize: 18, fontWeight: '700' },
  progressPctRight: { fontSize: 18, fontWeight: '700', color: '#ef4444' },
  progressVotes: { fontSize: 10, color: MUTED, marginTop: 1 },
  progressBarTrack: { height: 8, borderRadius: 99, overflow: 'hidden', flexDirection: 'row', gap: 1, marginBottom: 6 },
  progressBarLeft: { backgroundColor: '#22c55e', borderTopLeftRadius: 99, borderBottomLeftRadius: 99 },
  progressBarRight: { backgroundColor: '#ef4444', borderTopRightRadius: 99, borderBottomRightRadius: 99 },
  progressBottomRow: { flexDirection: 'row', justifyContent: 'space-between' },
  sideTagLeft: { backgroundColor: '#e8f5e9', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  sideTagRight: { backgroundColor: '#fde8e8', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  sideTagText: { fontSize: 10, fontWeight: '600', color: '#374151' },


  statsRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingVertical: 12, marginTop: 18, marginBottom: 14 },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statDivider: { width: 1, height: 28 },
  statValue: { fontSize: 14, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600' },

  commentsCard: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 16 },
  commentsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  creatorDetails: { flex: 1, justifyContent: 'center' },
  creatorLabel: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  creatorName: { fontSize: 15, fontWeight: '900' },
  creatorShop: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  commentsTitle: { fontSize: 15, fontWeight: '800' },
  commentsNotice: { alignItems: 'center', paddingVertical: 12, gap: 8 },
  emptyCommentsText: { fontSize: 12, fontWeight: '600', color: MUTED, textAlign: 'center', paddingVertical: 14 },

  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  commentAvatarCircle: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden' },
  commentAvatarImage: { width: '100%', height: '100%' },
  commentAvatarFallback: { backgroundColor: '#B6ABCF', alignItems: 'center', justifyContent: 'center' },
  commentBody: { flex: 1, minWidth: 0 },
  commentTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  commentAuthor: { fontSize: 12.5, fontWeight: '800', flexShrink: 1, marginRight: 8 },
  commentTime: { fontSize: 10, fontWeight: '600', color: MUTED },
  commentMessage: { fontSize: 12.5, color: TEXT, marginTop: 2, lineHeight: 17 },
  commentActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },

  commentReactionChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  commentReactionChipActive: { backgroundColor: '#E8F0FF' },
  commentReactionText: { fontSize: 11, fontWeight: '700', color: MUTED },
  commentReactionTextActive: { color: '#1D4ED8' },
  commentDeleteBtn: { paddingVertical: 2 },
  commentDeleteText: { fontSize: 11, fontWeight: '700', color: '#DC2626' },

  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderTopWidth: 1, paddingTop: 12, marginTop: 4 },
  composerInput: { flex: 1, minHeight: 36, maxHeight: 90, fontSize: 13, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  composerSendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});

export function BattleResultsScreen({ navigation, route }) {
  const { bgStyle, text, card, bg, border, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const { t } = useLanguage();
  const brandAccent = text || PURPLE;
  const accent = text || brandAccent;
  const primaryText = text || TEXT;
  const subtleMuted = mutedText || MUTED;
  const surface = card || (isDarkMode ? '#1E1E1E' : '#fff');
  const winnerSurface = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.55)';
  const loserSurface = isDarkMode ? (border || '#333') : '#fff';
  const insightRowBorder = isDarkMode ? (border || '#333') : '#F1E8FB';
  const battleId = route?.params?.battleId;
  const handleBack = useBattleBackHandler(navigation, route);

  const [battle, setBattle] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(!!battleId);
  const [loadError, setLoadError] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  const fallbackItems = route?.params?.selectedItems;
  const winnerItem = productToBattleItem(
    insights?.winner?.product,
    battle?.winnerProduct || fallbackItems?.[1],
  );
  const runnerUpItem = productToBattleItem(
    insights?.loser?.product,
    battle?.runnerUpProduct || fallbackItems?.[0],
  );
  console.log("insights----------------", insights)
  const winnerVotePercent = insights?.winner?.votePercentage ?? battle?.winnerVotePercent;
  const totalVotes = insights?.totalVotes ?? battle?.totalVotes ?? 0;
  const totalViews = insights?.viewCount ?? battle?.totalViews ?? 0;
  const totalComments = insights?.commentCount ?? battle?.totalComments ?? 0;
  const engagementCount = insights?.engagementCount ?? (totalVotes + totalComments);
  const voteDifference = insights?.voteDifference ?? null;
  const winningMarginPercentagePoints = insights?.winningMarginPercentagePoints ?? null;
  const battleStatus = insights?.status || battle?.status;
  const isBattleFinished = ['COMPLETED', 'FINISHED', 'ENDED', 'CLOSED'].includes(String(battleStatus || '').toUpperCase());
  const battleOutcome = insights?.outcome || battle?.outcome;
  const winnerDeclared = battleOutcome === 'WINNER' && !!insights?.winner?.product;
  const isCreator = !!currentUserId && !!battle?.createdBy && String(currentUserId) === String(battle.createdBy);
  const useInsightsCopy = battleStatus === 'COMPLETED' && battleOutcome === 'WINNER'
    ? (t('battle.useInsightsText') || 'This item is more desired by the community. Consider promoting it or creating similar items.')
    : (t('battle.useInsightsText') || 'Use these insights to understand performance.');

  const loadBattle = useCallback(async () => {
    if (!battleId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [detailsResponse, insightsResponse] = await Promise.allSettled([
        getMarketplaceBattleDetails(battleId),
        getMarketplaceBattleInsights(battleId),
      ]);

      if (detailsResponse.status === 'fulfilled') {
        const data = detailsResponse.value?.data?.data ?? detailsResponse.value?.data ?? detailsResponse.value;
        const rawBattle = data?.battle ?? data?.battles?.[0] ?? data;
        setBattle(normalizeBattle(rawBattle));
      }

      if (insightsResponse.status === 'fulfilled') {
        const data = insightsResponse.value?.data?.data ?? insightsResponse.value?.data ?? insightsResponse.value;
        setInsights(data);
      }

      if (detailsResponse.status !== 'fulfilled' && insightsResponse.status !== 'fulfilled') {
        throw new Error('Unable to load battle results');
      }
    } catch {
      setLoadError(t('battle.errors.battleLoadFailed') || 'Could not load results.');
    } finally {
      setLoading(false);
    }
  }, [battleId, t]);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem('userId')
      .then(userId => {
        if (mounted) setCurrentUserId(userId);
      })
      .catch(() => { });
    return () => {
      mounted = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBattle();
    }, [loadBattle])
  );

  if (loading) {
    return (
      <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG, justifyContent: 'center' }]}>
        <ActivityIndicator color={accent} />
      </View>
    );
  }

  if (loadError || !winnerItem || !runnerUpItem) {
    return (
      <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
        <Header title={t('battle.resultsTitle')} onBack={handleBack} titleColor={text} />
        <View style={styles.centeredNotice}>
          <Text style={styles.errorText}>{loadError || t('battle.errors.missingItems')}</Text>
          {battleId ? (
            <TouchableOpacity onPress={loadBattle} style={[styles.retryBtn, { borderColor: accent }]}>
              <Text style={{ color: accent, fontWeight: '700' }}>{t('battle.retry') || 'Retry'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
      <Header
        title={t('battle.resultsTitle')}
        onBack={handleBack}
        accentColor={accent}
        titleColor={text}
        onShare={async () => {
          try {
            await Share.share({ message: t('battle.shareResultsMessage') });
          } catch {
            Alert.alert(t('battle.shareTitle'), t('battle.shareUnavailable'));
          }
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {winnerDeclared ? (
          <View style={[styles.resultsHero, { backgroundColor: surface, borderColor: border || BORDER }]}>
            <View style={styles.confettiDotA} />
            <View style={styles.confettiDotB} />
            <View style={styles.confettiDotC} />
            <View style={styles.confettiDotD} />
            <Text style={[styles.winnerBadge, { color: primaryText }]}>🏆 {t('battle.winner')}</Text>
            <View style={[styles.resultsWinnerCard, { backgroundColor: winnerSurface }]}>
              <FastImage
                source={fastImageSource(winnerItem.image)}
                style={[styles.resultsThumb, isDarkMode && { backgroundColor: 'rgba(255,255,255,0.08)' }]}
                resizeMode={FastImage.resizeMode.cover}
              />
              <View style={styles.resultsCopy}>
                <Text style={[styles.resultsName, { color: primaryText }]} numberOfLines={2}>{winnerItem.name}</Text>
                <Text style={[styles.resultsPrice, { color: primaryText }]}>{winnerItem.price}</Text>
                {(winnerItem.shopName || winnerItem.userName || winnerItem.sellerName || battle?.sellerName) ? (
                  <Text style={{ color: subtleMuted, fontSize: 11, marginTop: 4 }} numberOfLines={1}>
                    From {winnerItem.shopName || winnerItem.userName || winnerItem.sellerName || battle?.sellerName}
                  </Text>
                ) : null}
              </View>
              <View style={styles.resultsPercentPill}>
                <Text style={styles.resultsPercentText}>{winnerVotePercent != null ? `${winnerVotePercent}%` : '—'}</Text>
              </View>
            </View>
            <View style={[styles.resultsLoserCard, { backgroundColor: loserSurface, borderColor: border || BORDER }]}>
              <FastImage
                source={fastImageSource(runnerUpItem.image)}
                style={[styles.resultsThumbSmall, isDarkMode && { backgroundColor: 'rgba(255,255,255,0.08)' }]}
                resizeMode={FastImage.resizeMode.cover}
              />
              <View style={styles.resultsCopy}>
                <Text style={[styles.resultsNameSmall, { color: primaryText }]} numberOfLines={2}>{runnerUpItem.name}</Text>
                <Text style={[styles.resultsPriceSmall, { color: primaryText }]}>{runnerUpItem.price}</Text>
                {(runnerUpItem.shopName || runnerUpItem.userName || runnerUpItem.sellerName || battle?.sellerName) ? (
                  <Text style={{ color: subtleMuted, fontSize: 10, marginTop: 2 }} numberOfLines={1}>
                    From {runnerUpItem.shopName || runnerUpItem.userName || runnerUpItem.sellerName || battle?.sellerName}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.resultsPercentPillMuted, isDarkMode && { backgroundColor: border || '#333' }]}>
                <Text style={[styles.resultsPercentTextMuted, { color: subtleMuted }]}>{Math.max(0, 100 - (winnerVotePercent ?? 0))}%</Text>
              </View>
            </View>
          </View>
        ) : null}
        <View style={[styles.resultsBlock, { backgroundColor: surface, borderColor: border || BORDER }]}>
          <Text style={[styles.sectionTitle, { color: primaryText }]}>{t('battle.battleInsights') || 'Battle Insights'}</Text>
          <View style={[styles.resultsRow, { borderBottomColor: insightRowBorder }]}><Text style={[styles.resultsLabel, { color: subtleMuted }]}>{t('battle.stats.totalVotes') || 'Total Votes'}</Text><Text style={[styles.resultsValue, { color: primaryText }]}>{totalVotes}</Text></View>
          <View style={[styles.resultsRow, { borderBottomColor: insightRowBorder }]}><Text style={[styles.resultsLabel, { color: subtleMuted }]}>{t('battle.stats.totalViews') || 'Total Views'}</Text><Text style={[styles.resultsValue, { color: primaryText }]}>{totalViews}</Text></View>
          <View style={[styles.resultsRow, styles.resultsRowLast]}><Text style={[styles.resultsLabel, { color: subtleMuted }]}>{t('battle.stats.comments') || 'Comments'}</Text><Text style={[styles.resultsValue, { color: primaryText }]}>{totalComments}</Text></View>
          {/* <View style={[styles.resultsRow, styles.resultsRowLast]}><Text style={styles.resultsLabel}>{t('battle.stats.shares') || 'Shares'}</Text><Text style={[styles.resultsValue, { color: primaryText }]}>{insights?.shareCount ?? 12}</Text></View> */}
        </View>
        {isCreator ? (
          <>
            <View style={[styles.aboutCard, { backgroundColor: surface, borderColor: border || BORDER }]}>
              <Text style={[styles.aboutTitle, { color: primaryText }]}>{t('battle.useInsightsTitle')}</Text>
              <Text style={[styles.aboutText, { color: subtleMuted }]}>{useInsightsCopy}</Text>
            </View>
            <View style={styles.actionRow}>
              {/* <TouchableOpacity activeOpacity={0.9} style={[styles.outlineBtn, { borderColor: accent }]} onPress={() => Share.share({ message: t('battle.shareResultsMessage') }).catch(() => { })}>
            <Text style={[styles.outlineBtnText, { color: accent }]}>{t('battle.shareResults')}</Text>
          </TouchableOpacity> */}
              {
                insights?.outcome !== "TIE" &&
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[styles.actionBtn, { backgroundColor: brandAccent }]}
                  onPress={() => navigation.navigate('BattleInsightsActions', { battleId, winnerItem, runnerUpItem, insights })}
                >
                  <Text style={styles.actionBtnText}>{t('battle.useInsights') || 'Use Insights'}</Text>
                </TouchableOpacity>
              }
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}


export function ChallengeBattlePreviewScreen({ navigation, route }) {
  const { bgStyle, text, card, bg, border, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const idleSurface = card || surfaces.listSurface;
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const primaryText = text || TEXT;
  const subtleMuted = mutedText || surfaces.mutedColor;
  const handleBack = () => navigation.goBack();

  const { question, selectedItems, duration, stake, isPublic } = route?.params || {};
  const leftItem = selectedItems?.[0];
  const rightItem = selectedItems?.[1];

  const [launching, setLaunching] = useState(false);

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      const durationMs = DURATION_MS[duration] || (3 * 24 * 60 * 60 * 1000);
      const startAt = new Date();
      const endAt = new Date(startAt.getTime() + durationMs);

      if (route?.params?.shop) {
        // Challenge Shop Flow
        const challengePayload = {
          opponentClosetId: route.params.shop.id || route.params.shop._id,
          myProductId: selectedItems[0]?.id || selectedItems[0]?._id,
          opponentProductId: selectedItems[1]?.id || selectedItems[1]?._id,
          question: question || 'Opinion Battle',
          stake: stake || 50,
          title: question || 'Shop Challenge',
          category: 'Fashion',
          shareToFeed: false,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          inviteExpiresInHours: 48,
        };
        await challengeShop(challengePayload);
      } else {
        // Standard Battle Flow
        const payload = {
          title: question || 'Opinion Battle',
          description: question || 'Opinion Battle',
          category: 'Fashion',
          visibility: isPublic ? 'Everyone' : 'Private',
          whoCanVote: isPublic ? 'Everyone' : 'Followers',
          shareToFeed: false,
          productIds: selectedItems ? selectedItems.map(item => item.id) : [],
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        };
        // await createMarketplaceBattle(payload);
      }

      if (!route?.params?.shop) {
        setTimeout(() => {
          setLaunching(false);
          navigation.navigate('BattleCreatedSuccess', { ...route?.params });
        }, 1000);
      } else {
        setLaunching(false);
        navigation.navigate('BattleCreatedSuccess', { ...route?.params });
      }

    } catch (err) {
      setLaunching(false);
      Alert.alert(t('battle.errors.launchFailedTitle', 'Could not launch battle'), t('battle.errors.launchFailedGeneric', 'Something went wrong. Please try again.'));
    }
  };

  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
      <Header title={t('battle.previewTitle', 'Battle Preview')} onBack={handleBack} titleColor={text} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* <Stepper active={4} accent={accent} isDarkMode={isDarkMode} labels={[t('battle.stepper.step1', 'Choose your item'), t('battle.stepper.step2', 'Add your battle question'), t('battle.stepper.step3', 'Set battle details'), t('battle.stepper.step4', 'Review your battle')]} /> */}

        <Text style={[styles.sectionTitle, { color: primaryText }]}>{t('battle.reviewTitle', 'Review your battle')}</Text>
        <Text style={[styles.sectionHint, { color: subtleMuted, marginBottom: 16 }]}>{t('battle.reviewHint', 'Make sure everything looks good before you publish.')}</Text>

        {question ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={[styles.fieldLabel, { color: primaryText, marginBottom: 8 }]}>{t('battle.battleQuestion', 'Battle Question')}</Text>
            <View style={[styles.inputCard, { backgroundColor: isDarkMode ? surfaces.listSurface : '#fff', borderColor: 'transparent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
              <Text style={{ color: primaryText, flex: 1, fontWeight: '600' }}>{question}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ChallengeBattleSetup', route.params)}>
                <Text style={{ color: accent, fontWeight: '800' }}>{t('battle.edit', 'Edit')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <FastImage source={fastImageSource(leftItem?.image)} style={{ width: 120, height: 120, borderRadius: 16 }} />
            <Text style={{ color: primaryText, fontWeight: '700', marginTop: 12 }}>{t('battle.yourItem', 'Your item')}</Text>
            <Text style={{ color: primaryText, fontWeight: '900', fontSize: 13, marginTop: 4, textAlign: 'center' }}>{leftItem?.name || 'Item Name'}</Text>
            <Text style={{ color: accent, fontWeight: '800', marginTop: 4 }}>{leftItem?.price || '$0.00'}</Text>
            <Text style={{ color: subtleMuted, fontSize: 11, marginTop: 6 }}>{t('battle.fromMyCloset')}</Text>
          </View>

          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: idleSurface, borderWidth: 1, borderColor: border || surfaces.listBorder, alignItems: 'center', justifyContent: 'center', marginTop: 40, marginHorizontal: -10, zIndex: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}>
            <Text style={{ color: primaryText, fontWeight: '900', fontSize: 14 }}>VS</Text>
          </View>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <FastImage source={fastImageSource(rightItem?.image)} style={{ width: 120, height: 120, borderRadius: 16 }} />
            <Text style={{ color: primaryText, fontWeight: '700', marginTop: 12 }}>{t('battle.challengerItem', 'Challenger item')}</Text>
            <Text style={{ color: primaryText, fontWeight: '900', fontSize: 13, marginTop: 4, textAlign: 'center' }}>{rightItem?.name || 'Item Name'}</Text>
            <Text style={{ color: accent, fontWeight: '800', marginTop: 4 }}>{rightItem?.price || '$0.00'}</Text>
            <Text style={{ color: subtleMuted, fontSize: 11, marginTop: 6 }}>From {rightItem?.shopName || rightItem?.userName || rightItem?.sellerName || 'Shop'}</Text>
          </View>
        </View>

        <View style={[styles.aboutCard, themedCard(idleSurface, border || surfaces.listBorder), { padding: 16, gap: 16, marginBottom: 20 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="calendar-outline" size={18} color={subtleMuted} />
              <Text style={{ color: subtleMuted, fontWeight: '600', fontSize: 13 }}>{t('battle.durationLabel', 'Duration')}</Text>
            </View>
            <Text style={{ color: primaryText, fontWeight: '800', fontSize: 13 }}>{duration || '3 DAYS'}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="cash-outline" size={18} color={subtleMuted} />
              <Text style={{ color: subtleMuted, fontWeight: '600', fontSize: 13 }}>{t('battle.stakeLabel', 'Stake')}</Text>
            </View>
            <Text style={{ color: primaryText, fontWeight: '800', fontSize: 13 }}>{stake || '100'} Points</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="globe-outline" size={18} color={subtleMuted} />
              <Text style={{ color: subtleMuted, fontWeight: '600', fontSize: 13 }}>{t('battle.publicBattleLabel', 'Public Battle')}</Text>
            </View>
            <Text style={{ color: primaryText, fontWeight: '800', fontSize: 13 }}>{isPublic ? 'Yes' : 'No'}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="people-outline" size={18} color={subtleMuted} />
              <Text style={{ color: subtleMuted, fontWeight: '600', fontSize: 13 }}>{t('battle.whoCanVoteLabel', 'Who can vote')}</Text>
            </View>
            <Text style={{ color: accent, fontWeight: '800', fontSize: 13 }}>Valens Community</Text>
          </View>
        </View>

        <TouchableOpacity activeOpacity={0.9} disabled={launching} onPress={handleLaunch}>
          <LinearGradient colors={launching ? ['#aaa', '#aaa'] : [accent, text]} style={[styles.primaryButton, launching && { opacity: 0.6 }]}>
            {launching ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{t('battle.publishBattle', 'Publish Battle')}</Text>}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.9} onPress={handleBack} style={{ marginTop: Platform.OS == "android" ? 12 : 0, height: 48, borderRadius: 14, borderWidth: 1, borderColor: accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: accent, fontSize: 15, fontWeight: '900' }}>{t('battle.backAndEdit', 'Back and Edit')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export function BattleCreatedSuccessScreen({ navigation, route }) {
  const { bgStyle, text, card, bg, border, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const idleSurface = card || surfaces.listSurface;
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const primaryText = text || TEXT;
  const subtleMuted = mutedText || surfaces.mutedColor;
  const handleBack = () => navigation.navigate('MainApp', { screen: 'wallet', params: { screen: 'MyCloset' } });

  const selectedItems = route?.params?.selectedItems || [];
  const leftItem = selectedItems?.[0];
  const rightItem = selectedItems?.[1];

  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
      {/* <Header title={t('battle.battleCreatedTitle', 'Battle Created')} onBack={handleBack} titleColor={text} /> */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', marginTop: 40, marginBottom: 30 }}>
          <View style={{ width: 140, height: 140, borderRadius: 70, backgroundColor: accent, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <Ionicons name="color-wand" size={64} color="#fff" style={{ position: 'absolute' }} />
            <Text style={{ fontSize: 60, position: 'absolute' }}>⚔️</Text>
            {/* simple confetti mock */}
            <View style={{ position: 'absolute', top: -10, left: -20, width: 8, height: 8, backgroundColor: '#FFD7A8', borderRadius: 4 }} />
            <View style={{ position: 'absolute', top: 20, right: -30, width: 10, height: 10, backgroundColor: '#D9C6FF', borderRadius: 5 }} />
            <View style={{ position: 'absolute', bottom: -10, left: 10, width: 6, height: 6, backgroundColor: '#B9E3FF', borderRadius: 3 }} />
            <View style={{ position: 'absolute', bottom: 30, right: -20, width: 8, height: 8, backgroundColor: '#F7A9D6', borderRadius: 4 }} />
          </View>

          <Text style={{ color: primaryText, fontSize: 24, fontWeight: '900', marginTop: 24 }}>{t('battle.battleCreatedSuccess', 'Battle Created!')}</Text>
          <Text style={{ color: primaryText, fontSize: 16, fontWeight: '700', marginTop: 8 }}>{t('battle.battleLive', { shopName: (rightItem?.shopName || rightItem?.userName || rightItem?.sellerName || 'Style Hub') })}</Text>
          <Text style={{ color: subtleMuted, fontSize: 14, fontWeight: '600', marginTop: 12, textAlign: 'center' }}>
            {t('battle.communityCanVote', 'The community can now vote.\nMay the best item win! 🏆')}
          </Text>
        </View>

        <View style={[styles.aboutCard, themedCard(idleSurface, border || surfaces.listBorder), { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <FastImage source={fastImageSource(leftItem?.image)} style={{ width: 80, height: 80, borderRadius: 12 }} />
            <Text style={{ color: primaryText, fontWeight: '800', fontSize: 12, marginTop: 8, textAlign: 'center' }} numberOfLines={2}>{leftItem?.name || 'Item Name'}</Text>
            <Text style={{ color: primaryText, fontWeight: '900', fontSize: 12, marginTop: 4 }}>{leftItem?.price || '$0.00'}</Text>
            <Text style={{ color: subtleMuted, fontSize: 10, marginTop: 2 }}>{t('battle.yourItem', 'Your item')}</Text>
          </View>

          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: idleSurface, borderWidth: 1, borderColor: border || surfaces.listBorder, alignItems: 'center', justifyContent: 'center', marginHorizontal: 10 }}>
            <Text style={{ color: accent, fontWeight: '900', fontSize: 12 }}>VS</Text>
          </View>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <FastImage source={fastImageSource(rightItem?.image)} style={{ width: 80, height: 80, borderRadius: 12 }} />
            <Text style={{ color: primaryText, fontWeight: '800', fontSize: 12, marginTop: 8, textAlign: 'center' }} numberOfLines={2}>{rightItem?.name || 'Item Name'}</Text>
            <Text style={{ color: primaryText, fontWeight: '900', fontSize: 12, marginTop: 4 }}>{rightItem?.price || '$0.00'}</Text>
            <Text style={{ color: subtleMuted, fontSize: 10, marginTop: 2 }}>{rightItem?.shopName || rightItem?.userName || rightItem?.sellerName || 'Style Hub'}</Text>
          </View>
        </View>

        <View style={{ alignItems: 'center', marginTop: 20, marginBottom: 20 }}>
          <Text style={{ color: primaryText, fontSize: 13, fontWeight: '700' }}>{t('battle.votingEndsIn', 'Voting ends in')}</Text>
          <View style={{ backgroundColor: isDarkMode ? surfaces.listSurface : '#F3EFFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="time-outline" size={16} color={accent} />
            <Text style={{ color: primaryText, fontWeight: '800', fontSize: 13 }}>3 Days</Text>
          </View>
        </View>

        <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('MainApp', {
          screen: 'wallet',
          params: { screen: 'MyCloset' }
        })}>
          <LinearGradient colors={[accent, text]} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{t('battle.backToCloset', 'Back To Closet')}</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* <TouchableOpacity activeOpacity={0.9} style={{ marginTop: 12, height: 48, borderRadius: 14, borderWidth: 1, borderColor: accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Ionicons name="share-social-outline" size={20} color={accent} />
          <Text style={{ color: accent, fontSize: 15, fontWeight: '900' }}>{t('battle.shareBattle', 'Share Battle')}</Text>
        </TouchableOpacity> */}
      </ScrollView>
    </View>
  );
}

export function ChallengeReceivedScreen({ navigation, route }) {
  const { bgStyle, text, card, bg, border, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const idleSurface = card || surfaces.listSurface;
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const primaryText = text || TEXT;
  const subtleMuted = mutedText || surfaces.mutedColor;
  const handleBack = () => navigation.navigate('HomeMain', { screen: 'HeartNotification' });

  const { battleId } = route?.params || {};

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [battle, setBattle] = useState(null);
  const [challengeStatus, setChallengeStatus] = useState(null);

  useEffect(() => {
    if (!battleId) {
      setLoading(false);
      return;
    }

    const fetchDetails = async () => {
      try {
        const res = await getMarketplaceBattleDetails(battleId);
        const raw = res?.data?.data || res?.data;
        setBattle(normalizeBattle(raw));

        try {
          const statusRes = await getMarketplaceBattleChallengeStatus(battleId);
          setChallengeStatus(statusRes?.data?.data || statusRes?.data);
        } catch (err) {
          console.error("Error fetching challenge status", err);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [battleId]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const response = await acceptMarketplaceBattle(battleId);
      console.log("response in acceptMarketplaceBattle-----------", response)
      navigation.replace('ChallengeAccepted', { battleId, battle });
    } catch (err) {
      Alert.alert('Error', 'Could not accept challenge. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    try {
      await declineMarketplaceBattle(battleId);
      navigation.replace('ChallengeAccepted', { battleId, battle, status: 'declined' });
    } catch (err) {
      Alert.alert('Error', 'Could not decline challenge. Please try again.');
    } finally {
      setDeclining(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.screen, bgStyle, { backgroundColor: bg || '#FBF8FF', justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={accent} />
      </View>
    );
  }

  if (!battle) {
    return (
      <View style={[styles.screen, bgStyle, { backgroundColor: bg || '#FBF8FF', justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: primaryText }}>Battle not found</Text>
        <TouchableOpacity onPress={handleBack} style={{ marginTop: 16 }}><Text style={{ color: accent, fontWeight: '700' }}>Go Back</Text></TouchableOpacity>
      </View>
    );
  }

  // Ensure items[1] is the recipient (Your item) and items[0] is the challenger
  // We'll just assume index 1 is 'Your item' based on position sorting
  const leftItem = battle.items?.[1] || battle.items?.[0];
  const rightItem = battle.items?.[0] || battle.items?.[1];

  console.log("------------battle battles---------------", battle)
  console.log("------------leftItem battles---------------", leftItem)
  console.log("------------rightItem battles---------------", rightItem)

  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || '#FBF8FF' }]}>
      <Header title="You got a challenge! ⚔️" onBack={handleBack} titleColor={text} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Banner */}
        <View style={[styles.aboutCard, { backgroundColor: idleSurface, borderColor: border || surfaces.listBorder, flexDirection: 'row', alignItems: 'center', marginBottom: 20 }]}>
          <FastImage source={fastImageSource(rightItem?.image)} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: '#E0E0E0' }} />
          <Text style={{ color: primaryText, flex: 1, fontSize: 13, fontWeight: '500' }}>
            <Text style={{ fontWeight: '800' }}>{rightItem?.shopName || rightItem?.userName || 'Valens Closet'}</Text> challenged your item in an Opinion Battle.
          </Text>
          <Ionicons name="shield-checkmark" size={28} color={accent} />
        </View>

        <Text style={[styles.fieldLabel, { color: primaryText, fontSize: 15, textAlign: 'center', marginTop: -7 }]}>{battle?.title}</Text>

        {/* Your item */}
        <Text style={[styles.fieldLabel, { color: primaryText, fontSize: 15 }]}>Your item</Text>
        <View style={[styles.aboutCard, { backgroundColor: idleSurface, borderColor: border || surfaces.listBorder, flexDirection: 'row', alignItems: 'flex-start', padding: 12, marginBottom: -10 }]}>
          <FastImage source={fastImageSource(leftItem?.image)} style={{ width: 90, height: 90, borderRadius: 12, marginRight: 16, backgroundColor: '#E0E0E0' }} />
          <View style={{ flex: 1, justifyContent: 'center', height: 90 }}>
            <Text style={{ color: primaryText, fontWeight: '900', fontSize: 14 }}>{leftItem?.name || 'Item Name'}</Text>
            <Text style={{ color: primaryText, fontWeight: '800', fontSize: 13, marginTop: 4 }}>{leftItem?.price || '$0.00'}</Text>
            <Text style={{ color: subtleMuted, fontSize: 12, marginTop: 8 }}>From your shop</Text>
            <Text style={{ color: subtleMuted, fontSize: 12 }}>{leftItem?.shopName || leftItem?.userName || 'Your Shop'}</Text>
          </View>
        </View>

        {/* VS Badge */}
        <View style={{ zIndex: 10, alignSelf: 'center', width: 36, height: 36, borderRadius: 18, backgroundColor: idleSurface, borderWidth: 1, borderColor: border || surfaces.listBorder, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}>
          <Text style={{ color: primaryText, fontWeight: '900', fontSize: 12 }}>VS</Text>
        </View>

        {/* Challenger's item */}
        <Text style={[styles.fieldLabel, { color: primaryText, marginTop: -6, fontSize: 15 }]}>Challenger's item</Text>
        <View style={[styles.aboutCard, { backgroundColor: idleSurface, borderColor: border || surfaces.listBorder, flexDirection: 'row', alignItems: 'flex-start', padding: 12, marginBottom: 20 }]}>
          <FastImage source={fastImageSource(rightItem?.image)} style={{ width: 90, height: 90, borderRadius: 12, marginRight: 16, backgroundColor: '#E0E0E0' }} />
          <View style={{ flex: 1, justifyContent: 'center', height: 90 }}>
            <Text style={{ color: primaryText, fontWeight: '900', fontSize: 14 }}>{rightItem?.name || 'Item Name'}</Text>
            <Text style={{ color: primaryText, fontWeight: '800', fontSize: 13, marginTop: 4 }}>{rightItem?.price || '$0.00'}</Text>
            <Text style={{ color: subtleMuted, fontSize: 12, marginTop: 8 }}>From {rightItem?.shopName || rightItem?.userName || 'Valens Closet'}</Text>
            <Text style={{ color: subtleMuted, fontSize: 12 }}>@{rightItem?.userName?.toLowerCase()?.replace(/\s+/g, '') || rightItem?.shopName?.toLowerCase()?.replace(/\s+/g, '') || 'valenscloset'}</Text>
          </View>
        </View>

        {/* Info Card */}
        <View style={[styles.aboutCard, { backgroundColor: '#fff', borderColor: 'transparent', flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }]}>
          <Ionicons name="information-circle-outline" size={20} color={accent} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.aboutTitle, { color: primaryText, fontSize: 14 }]}>This is an Opinion Battle.</Text>
            <Text style={[styles.aboutText, { color: primaryText, marginTop: 4 }]}>The community will vote to decide which item they prefer.</Text>
          </View>
        </View>

        {/* Expiry Card */}
        <View style={[styles.aboutCard, { backgroundColor: '#fff', borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', marginBottom: 24 }]}>
          <Ionicons name="time-outline" size={20} color={accent} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.aboutText, { color: primaryText }]}>Challenge expires in</Text>
            <Text style={[styles.aboutTitle, { color: primaryText, fontSize: 14, marginTop: 2 }]}>{battle.daysLeft ? `${battle.daysLeft} Days` : '24 Hours'}</Text>
          </View>
        </View>

        {/* Buttons */}
        {challengeStatus?.inviteStatus === 'PENDING' ? (
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
            <TouchableOpacity
              activeOpacity={0.9}
              disabled={declining || accepting}
              onPress={handleDecline}
              style={[styles.outlineBtn, { borderColor: accent }]}
            >
              {declining ? <ActivityIndicator color={accent} /> : <Text style={[styles.outlineBtnText, { color: accent }]}>Decline</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              disabled={accepting || declining}
              onPress={handleAccept}
              style={{ flex: 1 }}
            >
              <LinearGradient colors={accepting ? ['#aaa', '#aaa'] : [accent, text]} style={[styles.actionBtn, accepting && { opacity: 0.6 }]}>
                {accepting ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Accept Challenge</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ color: primaryText, textAlign: 'center', fontSize: 16, fontWeight: '600' }}>
              Challenge is {challengeStatus?.inviteStatus?.toLowerCase() || 'no longer available'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

export function ChallengeAcceptedScreen({ navigation, route }) {
  const { bgStyle, text, card, bg, border, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const idleSurface = card || surfaces.listSurface;
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const primaryText = text || TEXT;
  const subtleMuted = mutedText || surfaces.mutedColor;

  const { battleId, status = 'accepted' } = route?.params || {};
  const [battle, setBattle] = useState(route?.params?.battle || null);
  const [loading, setLoading] = useState(!route?.params?.battle && !!battleId);

  useEffect(() => {
    if (!battle && battleId) {
      getMarketplaceBattleDetails(battleId)
        .then(res => {
          const raw = res?.data?.data || res?.data;
          setBattle(normalizeBattle(raw));
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [battleId]);

  const leftItem = battle?.items?.[1] || battle?.items?.[0];
  const rightItem = battle?.items?.[0] || battle?.items?.[1];

  const isDeclined = status === 'declined';

  if (loading) {
    return (
      <View style={[styles.screen, bgStyle, { backgroundColor: bg || '#FBF8FF', justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={accent} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || '#FBF8FF' }]}>
      <Header title={isDeclined ? "Challenge Declined" : "Challenge Accepted"} onBack={() => navigation.navigate('HomeMain', { screen: 'HeartNotification' })} titleColor={text} />
      <ScrollView contentContainerStyle={[styles.scrollContent, { alignItems: 'center', paddingTop: 20 }]} showsVerticalScrollIndicator={false}>

        {/* Success / Error Icon */}
        <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: isDeclined ? '#EF4444' : '#4ADE80', alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: isDeclined ? '#EF4444' : '#4ADE80', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } }}>
          <Ionicons name={isDeclined ? "close" : "checkmark"} size={60} color="#fff" />
        </View>

        <Text style={{ color: primaryText, fontSize: 24, fontWeight: '900', marginBottom: 12 }}>{isDeclined ? "Challenge Declined" : "Challenge Accepted!"}</Text>

        {!isDeclined && <Text style={{ color: primaryText, fontSize: 15, fontWeight: '700', marginBottom: 6 }}>Your item is now in the battle.</Text>}

        <Text style={{ color: subtleMuted, fontSize: 13, textAlign: 'center', marginBottom: 30, paddingHorizontal: 20 }}>
          {isDeclined ? "You have declined this challenge. It will not proceed." : "The battle will go live once both items are accepted."}
        </Text>

        {/* Battle Preview Box */}
        {battle && (
          <View style={[styles.aboutCard, { backgroundColor: idleSurface, borderColor: border || surfaces.listBorder, width: '100%', padding: 16, marginBottom: 20, opacity: isDeclined ? 0.6 : 1 }]}>
            <Text style={[styles.fieldLabel, { color: primaryText, marginBottom: 16 }]}>Battle Preview</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <FastImage source={fastImageSource(leftItem?.image)} style={{ width: 100, height: 100, borderRadius: 12, backgroundColor: '#E0E0E0' }} />
                <Text style={{ color: primaryText, fontWeight: '900', fontSize: 13, marginTop: 12, textAlign: 'center' }}>{leftItem?.name || 'Item Name'}</Text>
                <Text style={{ color: primaryText, fontWeight: '800', fontSize: 12, marginTop: 4 }}>{leftItem?.price || '$0.00'}</Text>
                <Text style={{ color: subtleMuted, fontSize: 11, marginTop: 4 }}>Your Shop</Text>
              </View>

              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: idleSurface, borderWidth: 1, borderColor: border || surfaces.listBorder, alignItems: 'center', justifyContent: 'center', marginTop: 34, marginHorizontal: -5, zIndex: 10 }}>
                <Text style={{ color: primaryText, fontWeight: '900', fontSize: 11 }}>VS</Text>
              </View>

              <View style={{ flex: 1, alignItems: 'center' }}>
                <FastImage source={fastImageSource(rightItem?.image)} style={{ width: 100, height: 100, borderRadius: 12, backgroundColor: '#E0E0E0' }} />
                <Text style={{ color: primaryText, fontWeight: '900', fontSize: 13, marginTop: 12, textAlign: 'center' }}>{rightItem?.name || 'Item Name'}</Text>
                <Text style={{ color: primaryText, fontWeight: '800', fontSize: 12, marginTop: 4 }}>{rightItem?.price || '$0.00'}</Text>
                <Text style={{ color: subtleMuted, fontSize: 11, marginTop: 4 }}>{rightItem?.shopName || rightItem?.userName || rightItem?.sellerName || 'Valens Closet'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Notification Alert */}
        {!isDeclined && (
          <View style={[styles.aboutCard, { backgroundColor: '#F3EFFF', borderColor: 'transparent', flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24, width: '100%' }]}>
            <Ionicons name="notifications" size={20} color={accent} style={{ marginRight: 12 }} />
            <Text style={[styles.aboutText, { color: primaryText, flex: 1 }]}>You'll be notified when the battle goes live and when the results are in.</Text>
          </View>
        )}

        {/* Buttons */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('MainApp', { screen: 'wallet', params: { screen: 'MyCloset' } })}
          style={{ width: '100%', marginBottom: 12 }}
        >
          <LinearGradient colors={[accent, text]} style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>View My Battles</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* <TouchableOpacity 
          activeOpacity={0.9} 
          onPress={() => navigation.navigate('MainApp', { screen: 'wallet', params: { screen: 'MyCloset' } })} 
          style={[styles.outlineBtn, { borderColor: accent, width: '100%', height: 46 }]}
        >
          <Text style={[styles.outlineBtnText, { color: accent }]}>Back to Shop</Text>
        </TouchableOpacity> */}

      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 8, paddingBottom: 12 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  screenTitle: { fontSize: 18, fontWeight: '800' },
  screenSubtitle: { marginTop: 2, fontSize: 12, color: MUTED, fontWeight: '600' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 30, gap: 14 },
  phone: { padding: 14, marginTop: 2 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  statusText: { fontSize: 12, fontWeight: '800', color: '#111' },
  statusIcons: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  batteryPill: { borderWidth: 1, borderColor: '#111', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  batteryText: { fontSize: 8, fontWeight: '800' },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginTop: 4, marginBottom: 4 },
  sectionHint: { fontSize: 12, color: MUTED, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCard: { width: '48%', borderRadius: 18, borderWidth: 1, padding: 10 },
  gridCardSelected: { transform: [{ translateY: -2 }] },
  selectionDot: { position: 'absolute', top: 10, left: 10, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  selectionDotGhost: { position: 'absolute', top: 10, left: 10, width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: '#D8CBEF', zIndex: 1 },
  gridImage: { height: 120, borderRadius: 14, marginBottom: 8 },
  gridName: { fontSize: 12, fontWeight: '700' },
  gridPrice: { fontSize: 12, fontWeight: '800', marginTop: 4 },
  primaryButton: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  footerActions: { flexDirection: 'row', gap: 10, paddingBottom: Platform.OS === 'android' ? 20 : 0 },
  footerActionFlex: { flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
  stepItem: { alignItems: 'center', gap: 6 },
  stepCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#D6C8EF', alignItems: 'center', justifyContent: 'center' },
  stepCircleText: { color: '#8B7AAE', fontWeight: '800' },
  stepCircleTextActive: { color: '#fff' },
  stepLabel: { fontSize: 11, color: MUTED, fontWeight: '700' },
  stepLine: { flex: 1, height: 1, backgroundColor: '#D6C8EF', marginHorizontal: 10, marginBottom: 18 },
  field: { gap: 8, marginTop: 4 },
  fieldLabel: { fontSize: 14, fontWeight: '800' },
  inputCard: { borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 14 },
  inputCardError: { borderColor: '#ef4444' },
  inputText: { fontWeight: '600' },
  optionCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 14, marginTop: 10 },
  optionTitle: { fontWeight: '800' },
  optionTextWrap: { flex: 1 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  optionSub: { color: MUTED, fontSize: 12, marginTop: 3 },
  pillRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: BORDER },
  pillActive: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  pillText: { color: TEXT, fontWeight: '800', fontSize: 12 },
  inlineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 12 },
  inlineValue: { fontWeight: '700' },
  inlineLink: { fontWeight: '800' },
  errorText: { color: '#ef4444', fontSize: 12, fontWeight: '700', marginTop: 4 },
  vsGrid: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 0,
  },
  itemThumb: {
    width: 88,
    height: 88,
    borderRadius: 14,
    marginBottom: 8,
    alignSelf: 'center',
  },
  itemThumbPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  itemPrice: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
  },
  vsBubble: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 0 },
  vsText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  cardBlock: { gap: 12 },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(246,240,238,0.72)',
    zIndex: 2,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoText: { color: MUTED, fontSize: 12, fontWeight: '700' },
  aboutCard: { borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 14, gap: 4 },
  aboutTitle: { fontWeight: '900', fontSize: 14 },
  aboutText: { color: MUTED, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 12, alignItems: 'center' },
  statValue: { color: TEXT, fontWeight: '900', fontSize: 18 },
  statLabel: { color: MUTED, fontWeight: '700', fontSize: 11, marginTop: 2 },
  liveTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pillOutline: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: BORDER },
  pillOutlineText: { fontSize: 11, fontWeight: '800' },
  liveMuted: { color: MUTED, fontWeight: '700', fontSize: 12 },
  voteCopy: { gap: 4 },
  battleQuestion: { fontSize: 23, lineHeight: 28, fontWeight: '900', textAlign: 'center', marginTop: 8, marginBottom: 6 },
  voteHeadline: { fontSize: 14, fontWeight: '900', color: TEXT, marginTop: 8 },
  voteSub: { fontSize: 12, fontWeight: '600', color: MUTED, marginBottom: 8 },
  voteChoicesWrap: { gap: 10, marginTop: 8, borderWidth: 1, borderColor: BORDER, borderRadius: 18, padding: 16 },
  voteActionWrap: { borderRadius: 14, overflow: 'hidden' },
  voteActionPrimaryWrap: { borderWidth: 0 },
  voteActionSecondaryWrap: { borderWidth: 2, borderColor: '#C8B6E9' },
  voteActionInner: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  voteActionPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  voteActionSecondaryText: { fontSize: 16, fontWeight: '900', textAlign: 'center' },
  statsWrap: { marginTop: 6 },
  secondaryButton: { height: 46, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontWeight: '900' },
  splitBarWrap: { gap: 6 },
  splitBarTrack: { flexDirection: 'row', height: 10, borderRadius: 6, overflow: 'hidden' },
  splitBarFill: { height: '100%' },
  splitBarLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  splitBarLabelText: { fontSize: 11, fontWeight: '800', color: MUTED },
  splitBarTotal: { fontSize: 12, fontWeight: '800', color: TEXT, marginTop: 2 },
  confettiCard: { backgroundColor: '#FBF3FF', borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 14, gap: 12 },
  winnerBadge: { fontSize: 14, fontWeight: '900', textAlign: 'center' },
  winnerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroThumb: { width: 86, height: 86, borderRadius: 16, overflow: 'hidden' },
  winnerCopy: { flex: 1 },
  winnerTitle: { fontSize: 14, fontWeight: '900' },
  winnerPrice: { marginTop: 4, fontSize: 12, color: TEXT, fontWeight: '700' },
  percentPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  percentText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  resultsHero: { borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 14, gap: 10, position: 'relative', overflow: 'hidden' },
  confettiDotA: { position: 'absolute', top: 18, left: 18, width: 8, height: 8, borderRadius: 4, backgroundColor: '#D9C6FF', opacity: 0.55 },
  confettiDotB: { position: 'absolute', top: 28, right: 26, width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFD7A8', opacity: 0.7 },
  confettiDotC: { position: 'absolute', top: 60, right: 68, width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#F7A9D6', opacity: 0.6 },
  confettiDotD: { position: 'absolute', top: 86, left: 74, width: 6, height: 6, borderRadius: 3, backgroundColor: '#B9E3FF', opacity: 0.6 },
  resultsWinnerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 10 },
  resultsLoserCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 10, borderWidth: 1 },
  resultsThumb: { width: 78, height: 92, borderRadius: 12, backgroundColor: '#F3F0FA' },
  resultsThumbSmall: { width: 56, height: 68, borderRadius: 10, backgroundColor: '#F3F0FA' },
  resultsCopy: { flex: 1, gap: 4 },
  resultsName: { fontSize: 15, fontWeight: '800' },
  resultsNameSmall: { fontSize: 13, fontWeight: '800' },
  resultsPrice: { fontSize: 17, fontWeight: '900' },
  resultsPriceSmall: { fontSize: 14, fontWeight: '900' },
  resultsPercentPill: { minWidth: 46, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#37B26C', paddingHorizontal: 10 },
  resultsPercentPillMuted: { minWidth: 46, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2EEF8', paddingHorizontal: 10 },
  resultsPercentText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  resultsPercentTextMuted: { color: '#8B7AAE', fontWeight: '900', fontSize: 12 },
  resultsBlock: { gap: 2, borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 14 },
  resultsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1E8FB' },
  resultsRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  resultsLabel: { color: MUTED, fontWeight: '700' },
  resultsValue: { fontWeight: '900' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  outlineBtn: { flex: 1, height: 46, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', shadowColor: '#A788E6', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  outlineBtnText: { fontWeight: '900' },
  actionBtn: { flex: 1, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '900' },
});
