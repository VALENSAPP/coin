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
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import {
  navigateClosetReturn,
  useClosetTheme,
  withClosetNavParams,
  themeGradient,
} from '../../utils/closetNavigation';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useFocusEffect } from '@react-navigation/native';
import {
  getMyClosetItems,
  createMarketplaceBattle,
  getMarketplaceBattleDetails,
  getMarketplaceBattleInsights,
  voteOnBattle,
  getBattleVoters,
} from '../../services/myCloset';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Fallback palette — used only when the theme doesn't provide a value,
// so screens still look right before useAppTheme() resolves.
const PURPLE = '#5B2FB5';
const PURPLE_2 = '#7A49D6';
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
  shadowOpacity: 0.08,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 14 },
  elevation: 3,
  backgroundColor: '#fff',
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
const imageUri = img => (typeof img === 'string' ? img : img?.uri || null);

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

// --- Battle response normalization --------------------------------------
// Shapes the real GET /marketplace-battles/me response (battle.participants[].product)
// into the { items, leftVotePercent, daysLeft, ... } fields the battle screens render.

const daysLeftFromEndAt = endAt => {
  if (!endAt) return null;
  const diffMs = new Date(endAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
};

const participantToItem = participant => ({
  id: participant?.productId || participant?.product?.id,
  participantId: participant?.id,
  name: participant?.product?.name || '',
  price: currency(participant?.product?.price),
  image: itemImage(participant?.product) || participant?.product?.images?.[0] || null,
  voteCount: participant?.voteCount ?? 0,
  isWinner: !!participant?.isWinner,
});

const productToBattleItem = (product, fallback = {}) => ({
  id: product?.id || fallback?.id,
  participantId: fallback?.participantId || product?.participantId || product?.id,
  name: product?.name || fallback?.name || '',
  price: product?.price != null ? currency(product.price) : (fallback?.price || ''),
  image: itemImage(product) || fallback?.image || null,
});

const normalizeBattle = raw => {
  if (!raw) return null;
  const participants = [...(raw?.participants || [])].sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0));
  const items = participants.map(participantToItem);
  const totalVotes = raw?.totalVotes ?? participants.reduce((sum, p) => sum + (p?.voteCount ?? 0), 0);
  const leftVotes = items[0]?.voteCount ?? 0;
  const leftVotePercent = totalVotes > 0 ? Math.round((leftVotes / totalVotes) * 100) : 50;
  return {
    id: raw?.id,
    title: raw?.title,
    category: raw?.category,
    status: raw?.status,
    outcome: raw?.outcome,
    whoCanVote: raw?.whoCanVote,
    visibility: raw?.visibility,
    totalVotes,
    totalComments: raw?.totalComments ?? 0,
    daysLeft: daysLeftFromEndAt(raw?.endAt),
    items,
    leftVotePercent,
    createdBy: raw?.sellerId || raw?.createdBy || raw?.userId || null, // NEW — adjust field name if API differs
  };
};

export const Header = ({ title, onBack, rightIcon, subtitle, onShare, accentColor, titleColor }) => (
  <View style={styles.headerRow}>
    <TouchableOpacity onPress={onBack} activeOpacity={0.8} style={styles.iconBtn}>
      <Ionicons name="arrow-back" size={22} color={titleColor || TEXT} />
    </TouchableOpacity>
    <View style={styles.headerCenter}>
      <Text style={[styles.screenTitle, { color: titleColor || TEXT }]}>{title}</Text>
      {subtitle ? <Text style={styles.screenSubtitle}>{subtitle}</Text> : null}
    </View>
    <TouchableOpacity onPress={onShare} activeOpacity={0.8} style={styles.iconBtn}>
      <Ionicons name={rightIcon || 'share-social-outline'} size={20} color={accentColor || titleColor || TEXT} />
    </TouchableOpacity>
  </View>
);

export const PhoneFrame = ({ children }) => (
  <View style={[styles.phone, phoneBorder]}>
    <View style={styles.statusRow}>
      <Text style={styles.statusText}>{phoneStatus}</Text>
      <View style={styles.statusIcons}>
        <Ionicons name="cellular" size={10} color="#111" />
        <Ionicons name="wifi" size={10} color="#111" />
        <View style={styles.batteryPill}><Text style={styles.batteryText}>90</Text></View>
      </View>
    </View>
    {children}
  </View>
);

export const BattleCard = ({ left, right, showWinner = false, winnerPercent, accent = PURPLE, textColor = TEXT }) => {
  const { t } = useLanguage();
  return (
    <View style={styles.cardBlock}>
      {showWinner ? (
        <View style={styles.confettiCard}>
          <Text style={[styles.winnerBadge, { color: textColor }]}>🏆 {t('battle.winner')}</Text>
          <View style={styles.winnerRow}>
            <View style={styles.heroThumb}>
              <Image source={{ uri: left.image }} style={styles.itemThumb} />
            </View>
            <View style={styles.winnerCopy}>
              <Text style={[styles.winnerTitle, { color: textColor }]}>{left.name}</Text>
              <Text style={styles.winnerPrice}>{left.price}</Text>
            </View>
            <View style={[styles.percentPill, { backgroundColor: '#22C55E' }]}>
              <Text style={styles.percentText}>{winnerPercent != null ? `${winnerPercent}%` : '—'}</Text>
            </View>
          </View>
        </View>
      ) : null}
      <View style={styles.vsGrid}>
        <View style={styles.itemTile}>
          <Image source={{ uri: left.image }} style={styles.itemThumb} />
          <Text style={[styles.itemName, { color: textColor }]}>{left.name}</Text>
          <Text style={[styles.itemPrice, { color: accent }]}>{left.price}</Text>
        </View>
        <View style={[styles.vsBubble, { backgroundColor: accent }]}><Text style={styles.vsText}>{t('battle.vs')}</Text></View>
        <View style={styles.itemTile}>
          <Image source={{ uri: right.image }} style={styles.itemThumb} />
          <Text style={[styles.itemName, { color: textColor }]}>{right.name}</Text>
          <Text style={[styles.itemPrice, { color: accent }]}>{right.price}</Text>
        </View>
      </View>
    </View>
  );
};

export const VoteSplitBar = ({ leftPercent = 50, accent = PURPLE, totalVotes, leftLabel, rightLabel }) => {
  const { t } = useLanguage();
  const rightPercent = 100 - leftPercent;
  return (
    <View style={styles.splitBarWrap}>
      <View style={styles.splitBarTrack}>
        <View style={[styles.splitBarFill, { width: `${leftPercent}%`, backgroundColor: accent }]} />
        <View style={[styles.splitBarFill, { width: `${rightPercent}%`, backgroundColor: '#D9CBEF' }]} />
      </View>
      <View style={styles.splitBarLabels}>
        <Text style={[styles.splitBarLabelText, { color: accent }]}>{leftLabel} {leftPercent}%</Text>
        <Text style={styles.splitBarLabelText}>{rightPercent}% {rightLabel}</Text>
      </View>
      {typeof totalVotes === 'number' ? (
        <Text style={styles.splitBarTotal}>{t('battle.totalVotesCount', { count: totalVotes })}</Text>
      ) : null}
    </View>
  );
};

export const Stepper = ({ active = 1, labels, accent = PURPLE }) => {
  const { t } = useLanguage();
  const stepLabels = labels || [
    t('battle.stepper.items'),
    t('battle.stepper.setup'),
    t('battle.stepper.preview'),
  ];
  return (
    <View style={styles.stepper}>
      {stepLabels.map((label, index) => {
        const step = index + 1;
        const focused = active >= step;
        return (
          <React.Fragment key={label}>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, focused && { backgroundColor: accent, borderColor: accent }]}>
                <Text style={[styles.stepCircleText, focused && styles.stepCircleTextActive]}>{step}</Text>
              </View>
              <Text style={[styles.stepLabel, focused && { color: accent }]}>{label}</Text>
            </View>
            {index < stepLabels.length - 1 ? <View style={styles.stepLine} /> : null}
          </React.Fragment>
        );
      })}
    </View>
  );
};

export const StatRow = ({ items }) => (
  <View style={styles.statsRow}>
    {items.map(item => (
      <View key={item.label} style={styles.statCard}>
        {item.icon ? <Ionicons name={item.icon} size={18} color={MUTED} style={{ marginBottom: 4 }} /> : null}
        <Text style={styles.statValue}>{item.value}</Text>
        <Text style={styles.statLabel}>{item.label}</Text>
      </View>
    ))}
  </View>
);

// ---------------------------------------------------------------------
// CreateBattleScreen — now loads real closet items from GET /mycloset/items
// ---------------------------------------------------------------------
export function CreateBattleScreen({ navigation, route }) {
  const { bgStyle, text, card, bg } = useAppTheme();
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const primaryText = text || TEXT;

  // Passed from MyClosetDashboard's "Create Battle" CTA — falls back to
  // undefined, in which case getMyClosetItems() just omits the userId query param.
  const sellerId = route?.params?.sellerId;
  const headerTitle = route?.params?.headerTitle || t('battle.headerTitle');
  const nextRoute = route?.params?.nextRoute || 'BattleSetup';

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
      const normalized = normalizeItems(availableItems, t);
      prefetchImageUrls(availableItems);
      setItems(normalized);
      setSelectedIds(normalized.slice(0, 2).map(i => i.id));
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
    <View style={[styles.screen, bgStyle]}>
      <Header title={headerTitle} onBack={() => navigation.goBack()} onShare={handleShare} accentColor={accent} titleColor={primaryText} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: primaryText }]}>{t('battle.chooseItemsTitle')}</Text>
        <Text style={styles.sectionHint}>{t('battle.chooseItemsHint')}</Text>

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
          <Text style={styles.sectionHint}>{t('battle.noItems') || 'No closet items found yet.'}</Text>
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
                    if (prev.length >= 2) return [prev[1], item.id];
                    return [...prev, item.id];
                  });
                }}
                style={[
                  styles.gridCard,
                  { backgroundColor: card || '#fff', borderColor: BORDER },
                  selectedIds.includes(item.id) && [styles.gridCardSelected, { borderColor: accent }],
                ]}
              >
                {selectedIds.includes(item.id) ? (
                  <View style={[styles.selectionDot, { backgroundColor: accent }]}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                ) : (
                  <View style={styles.selectionDotGhost} />
                )}
                <Image source={{ uri: item.image }} style={styles.gridImage} />
                <Text style={[styles.gridName, { color: primaryText }]}>{item.name}</Text>
                <Text style={[styles.gridPrice, { color: accent }]}>{item.price}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.9}
          disabled={selectedItems.length < 2}
          onPress={() => navigation.navigate(nextRoute, { selectedItems, ...route?.params })}
        >
          <LinearGradient colors={[accent, PURPLE_2]} style={[styles.primaryButton, selectedItems.length < 2 && { opacity: 0.5 }]}>
            <Text style={styles.primaryButtonText}>{t('battle.next')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export function BattleSetupScreen({ navigation, route }) {
  const { bgStyle, text, card, bg } = useAppTheme();
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const primaryText = text || TEXT;
  const initialQuestion = route?.params?.defaultQuestion || t('battle.defaultQuestion');
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
        onBack={() => navigation.goBack()}
        accentColor={accent}
        titleColor={primaryText}
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
        <Stepper active={2} accent={accent} />
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: primaryText }]}>{t('battle.questionLabel')}</Text>
          <View style={[styles.inputCard, { backgroundColor: card || '#fff' }, errors.question && styles.inputCardError]}>
            <TextInput
              value={question}
              onChangeText={val => {
                setQuestion(val);
                if (errors.question) setErrors(prev => ({ ...prev, question: '' }));
              }}
              placeholder={t('battle.defaultQuestion')}
              placeholderTextColor="#ccc"
              style={[styles.inputText, { color: primaryText }]}
            />
          </View>
          {errors.question ? <Text style={styles.errorText}>{errors.question}</Text> : null}
        </View>
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: primaryText }]}>{t('battle.typeLabel')}</Text>

          <TouchableOpacity
            onPress={() => setBattleType('OPINION')}
            activeOpacity={0.9}
            style={[styles.optionCard, battleType === 'OPINION' && { borderColor: accent, backgroundColor: card || '#F7F2FF' }]}
          >
            <View style={[styles.radioOuter, { borderColor: battleType === 'OPINION' ? accent : '#D6C8EF' }]}>
              {battleType === 'OPINION' ? <View style={[styles.radioInner, { backgroundColor: accent }]} /> : null}
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={[styles.optionTitle, { color: primaryText }]}>{t('battle.opinionBattle')}</Text>
              <Text style={styles.optionSub}>{t('battle.opinionBattleSub')}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setBattleType('STYLE')}
            activeOpacity={0.9}
            style={[styles.optionCard, battleType === 'STYLE' && { borderColor: accent, backgroundColor: card || '#F7F2FF' }]}
          >
            <View style={[styles.radioOuter, { borderColor: battleType === 'STYLE' ? accent : '#D6C8EF' }]}>
              {battleType === 'STYLE' ? <View style={[styles.radioInner, { backgroundColor: accent }]} /> : null}
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={[styles.optionTitle, { color: primaryText }]}>{t('battle.styleBattle')}</Text>
              <Text style={styles.optionSub}>{t('battle.styleBattleSub')}</Text>
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
                style={[styles.pill, duration === value && [styles.pillActive, { borderColor: accent, backgroundColor: card || '#F7F2FF' }]]}
              >
                <Text style={[styles.pillText, duration === value && { color: accent, fontWeight: '800' }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.duration ? <Text style={styles.errorText}>{errors.duration}</Text> : null}
        </View>
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: primaryText }]}>{t('battle.whoCanVote')}</Text>
          <TouchableOpacity
            onPress={() => setWhoCanVote(prev => (prev === t('battle.public') ? t('battle.followersOnly') : t('battle.public')))}
            style={styles.inlineRow}
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
            style={styles.inlineRow}
          >
            <Text style={[styles.inlineValue, { color: primaryText }]}>{visibility}</Text>
            <Text style={[styles.inlineLink, { color: accent }]}>{t('battle.change')}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity activeOpacity={0.9} onPress={handlePreview}>
          <LinearGradient colors={[accent, PURPLE_2]} style={styles.primaryButton}>
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
  const { bgStyle, text, card, bg } = useAppTheme();
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const primaryText = text || TEXT;
  const previewQuestion = route?.params?.question || t('battle.defaultQuestion');
  const selectedItems = route?.params?.selectedItems;
  const { duration, whoCanVote } = route?.params || {};

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
        <Header title={t('battle.previewTitle')} onBack={() => navigation.goBack()} titleColor={primaryText} />
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
      const data = response?.data?.data ?? response?.data ?? response;
      const battle = data?.battle ?? data;
      const battleId = battle?.id;

      const liveRoute = route?.params?.liveRoute || 'BattleLive';
      navigation.navigate(liveRoute, { battleId, question: previewQuestion, selectedItems });
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
        onBack={() => navigation.goBack()}
        accentColor={accent}
        titleColor={primaryText}
        onShare={async () => {
          try {
            await Share.share({ message: t('battle.sharePreviewQuestionMessage', { question: previewQuestion }) });
          } catch {
            Alert.alert(t('battle.shareTitle'), t('battle.shareUnavailable'));
          }
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Stepper active={3} accent={accent} />
        <Text style={[styles.sectionTitle, { color: primaryText }]}>{previewQuestion}</Text>
        <BattleCard left={selectedItems[0]} right={selectedItems[1]} accent={accent} textColor={primaryText} />
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>{t('battle.daysLeft', { count: daysLeft })}</Text>
          <Text style={styles.infoText}>{voteAudienceText}</Text>
        </View>
        <View style={[styles.aboutCard, { backgroundColor: card || '#fff' }]}>
          <Text style={[styles.aboutTitle, { color: primaryText }]}>{t('battle.aboutTitle')}</Text>
          <Text style={styles.aboutText}>{t('battle.aboutTextPreview')}</Text>
        </View>
        <StatRow items={[
          { label: t('battle.stats.votes'), value: '0', icon: 'checkmark-done-outline' },
          { label: t('battle.stats.views'), value: '0', icon: 'eye-outline' },
          { label: t('battle.stats.comments'), value: '0', icon: 'chatbubble-outline' },
        ]} />
        <TouchableOpacity activeOpacity={0.9} disabled={launching} onPress={handleLaunch}>
          <LinearGradient colors={[accent, PURPLE_2]} style={[styles.primaryButton, launching && { opacity: 0.6 }]}>
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

export function BattleLiveScreen({ navigation, route }) {
  const { bgStyle, text, card, bg } = useClosetTheme(route);
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const primaryText = text || TEXT;
  const battleId = route?.params?.battleId;
  const initialBattle = route?.params?.initialBattle || null;
  const cameFromCard = !!initialBattle;
  const returnTo = route?.params?.returnTo;
  const isOwnProfile = route?.params?.isOwnProfile;

  const handleDonePress = useCallback(() => {
    if (returnTo) {
      navigateClosetReturn(navigation, returnTo);
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
  }, [navigation, returnTo, isOwnProfile]);

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
  const [currentUserId, setCurrentUserId] = useState(null);
  const [checkingVote, setCheckingVote] = useState(false);

  const question = battle?.title || route?.params?.question || t('battle.defaultQuestion');
  const selectedItems = battle?.items?.length ? battle.items : route?.params?.selectedItems || [];
  const showResultsBar =
    hasVoted ||
    !!route?.params?.showResultsBar ||
    cameFromCard ||
    (battle && (battle.status !== 'LIVE' || battle.outcome !== 'PENDING'));
  const voteAudienceText = battle?.whoCanVote === 'Followers' ? t('battle.followersOnly') : t('battle.everyoneCanVote');
  const isCreator = !!currentUserId && !!battle?.createdBy && currentUserId === battle.createdBy;
  const isBattleLive = battle?.status === 'LIVE' && battle?.outcome === 'PENDING';
  const canVote = isBattleLive && !isCreator && !hasVoted && !checkingVote;
  const votedLabel = t('battle.voting') || 'Voting...';

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

  const handleVote = async (item) => {
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
        t('battle.errors.voteFailedGeneric') || 'Something went wrong. Please try again.',
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
        <Header title={t('battle.liveTitle')} onBack={handleBackPress} titleColor={primaryText} />
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
        title={t('battle.liveTitle')}
        onBack={handleBackPress}
        rightIcon="share-outline"
        accentColor={accent}
        titleColor={primaryText}
        onShare={async () => {
          try {
            await Share.share({ message: t('battle.shareLiveMessage') });
          } catch {
            Alert.alert(t('battle.shareTitle'), t('battle.shareUnavailable'));
          }
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.liveTopRow}>
          <View style={[styles.pillOutline, { borderColor: accent }]}>
            <Text style={[styles.pillOutlineText, { color: primaryText }]}>{battle?.category || t('battle.opinionBattle')}</Text>
          </View>
          <Text style={styles.liveMuted}>{t('battle.daysLeft', { count: battle?.daysLeft ?? 0 })}</Text>
        </View>
        <Text style={[styles.battleQuestion, { color: primaryText }]}>{question}</Text>
        <BattleCard left={selectedItems[0]} right={selectedItems[1]} accent={accent} textColor={primaryText} />
        {canVote ? (
          <View style={[styles.voteChoicesWrap, { backgroundColor: card || '#fff' }]}>
            <Text style={[styles.voteHeadline, { color: primaryText }]}>{t('battle.voteAndSeeResults') || 'Vote and see results'}</Text>
            <Text style={styles.voteSub}>{t('battle.voteHelpsDecide') || 'Your vote helps others decide!'}</Text>
            {[selectedItems[0], selectedItems[1]].map((item, index) => (
              <TouchableOpacity
                key={item?.participantId || item?.id || index}
                activeOpacity={0.9}
                disabled={votingParticipantId === item?.participantId}
                onPress={() => handleVote(item)}
                style={[
                  styles.voteActionWrap,
                  index === 0 ? styles.voteActionPrimaryWrap : [styles.voteActionSecondaryWrap, { borderColor: accent }],
                  votingParticipantId === item?.participantId && { opacity: 0.6 },
                ]}
              >
                {index === 0 ? (
                  <LinearGradient colors={themeGradient(accent)} style={styles.voteActionInner}>
                    <Text style={styles.voteActionPrimaryText} numberOfLines={1}>
                      {votingParticipantId === item?.participantId
                        ? votedLabel
                        : (item?.name || item?.title || (t('battle.voteLeft') || 'Vote Jacket'))}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.voteActionInner}>
                    <Text style={[styles.voteActionSecondaryText, { color: accent }]} numberOfLines={1}>
                      {votingParticipantId === item?.participantId
                        ? votedLabel
                        : (item?.name || item?.title || (t('battle.voteRight') || 'Vote Bag'))}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        <View style={styles.statsWrap}>
          <StatRow items={[
            { label: t('battle.stats.votes') || 'Votes', value: String(battle?.totalVotes ?? 0), icon: 'checkmark-done-outline' },
            { label: t('battle.stats.views') || 'Views', value: String(battle?.totalViews ?? 0), icon: 'eye-outline' },
            { label: t('battle.stats.comments') || 'Comments', value: String(battle?.totalComments ?? 0), icon: 'chatbubble-outline' },
          ]} />
        </View>
        <View style={styles.footerActions}>
          <TouchableOpacity activeOpacity={0.9} onPress={handleDonePress} style={styles.footerActionFlex}>
            <LinearGradient colors={themeGradient(accent)} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{t('battle.done') || 'Done'}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('BattleResultsScreen', withClosetNavParams(route, { battleId }))}
            style={styles.footerActionFlex}
          >
            <LinearGradient colors={themeGradient(accent)} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{t('battle.viewResults') || 'View Results'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

export function BattleResultsScreen({ navigation, route }) {
  const { bgStyle, text, card, bg } = useClosetTheme(route);
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const primaryText = text || TEXT;
  const battleId = route?.params?.battleId;
  const returnTo = route?.params?.returnTo;

  const handleBackPress = useCallback(() => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigateClosetReturn(navigation, returnTo);
  }, [navigation, returnTo]);

  const [battle, setBattle] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(!!battleId);
  const [loadError, setLoadError] = useState(null);

  const fallbackItems = route?.params?.selectedItems;
  const winnerItem = productToBattleItem(
    insights?.winner?.product,
    battle?.winnerProduct || fallbackItems?.[1],
  );
  const runnerUpItem = productToBattleItem(
    insights?.loser?.product,
    battle?.runnerUpProduct || fallbackItems?.[0],
  );
  const winnerVotePercent = insights?.winner?.votePercentage ?? battle?.winnerVotePercent;
  const totalVotes = insights?.totalVotes ?? battle?.totalVotes ?? 0;
  const totalViews = insights?.viewCount ?? battle?.totalViews ?? 0;
  const totalComments = insights?.commentCount ?? battle?.totalComments ?? 0;
  const engagementCount = insights?.engagementCount ?? (totalVotes + totalComments);
  const voteDifference = insights?.voteDifference ?? null;
  const winningMarginPercentagePoints = insights?.winningMarginPercentagePoints ?? null;
  const battleStatus = insights?.status || battle?.status;
  const battleOutcome = insights?.outcome || battle?.outcome;
  const winnerDeclared = battleOutcome === 'WINNER' && !!insights?.winner?.product;

  const loadBattle = useCallback(async () => {
    if (!battleId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [detailsResponse, insightsResponse] = await Promise.allSettled([
        getMarketplaceBattleDetails(battleId),
        getMarketplaceBattleInsights(battleId),
      ]);

      console.log("detailsResponse-------------------",detailsResponse)
      console.log("insightsResponse-------------------",insightsResponse)

      if (detailsResponse.status === 'fulfilled') {
        const data = detailsResponse.value?.data?.data ?? detailsResponse.value?.data ?? detailsResponse.value;
        setBattle(data);
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
        <Header title={t('battle.resultsTitle')} onBack={handleBackPress} titleColor={primaryText} />
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
        onBack={handleBackPress}
        accentColor={accent}
        titleColor={primaryText}
        onShare={async () => {
          try {
            await Share.share({ message: t('battle.shareResultsMessage') });
          } catch {
            Alert.alert(t('battle.shareTitle'), t('battle.shareUnavailable'));
          }
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.resultsBlock, { backgroundColor: card || '#fff' }]}>
          <Text style={[styles.sectionTitle, { color: primaryText }]}>{t('battle.battleInsights') || 'Battle Insights'}</Text>
          <View style={styles.resultsRow}><Text style={styles.resultsLabel}>{t('battle.stats.totalVotes') || 'Votes'}</Text><Text style={[styles.resultsValue, { color: primaryText }]}>{totalVotes}</Text></View>
          <View style={styles.resultsRow}><Text style={styles.resultsLabel}>{t('battle.stats.totalViews') || 'Views'}</Text><Text style={[styles.resultsValue, { color: primaryText }]}>{totalViews}</Text></View>
          <View style={styles.resultsRow}><Text style={styles.resultsLabel}>{t('battle.stats.comments') || 'Comments'}</Text><Text style={[styles.resultsValue, { color: primaryText }]}>{totalComments}</Text></View>
          <View style={styles.resultsRow}><Text style={styles.resultsLabel}>{t('battle.stats.engagement') || 'Engagement'}</Text><Text style={[styles.resultsValue, { color: primaryText }]}>{engagementCount}</Text></View>
          {voteDifference != null ? (
            <View style={styles.resultsRow}><Text style={styles.resultsLabel}>{t('battle.stats.voteDifference') || 'Vote Difference'}</Text><Text style={[styles.resultsValue, { color: primaryText }]}>{voteDifference}</Text></View>
          ) : null}
          {winningMarginPercentagePoints != null ? (
            <View style={styles.resultsRow}><Text style={styles.resultsLabel}>{t('battle.stats.winningMargin') || 'Winning Margin'}</Text><Text style={[styles.resultsValue, { color: primaryText }]}>{winningMarginPercentagePoints}%</Text></View>
          ) : null}
        </View>
        {winnerDeclared ? (
          <>
            <BattleCard
              left={winnerItem}
              right={runnerUpItem}
              showWinner
              winnerPercent={winnerVotePercent}
              accent={accent}
              textColor={primaryText}
            />
            <View style={[styles.aboutCard, { backgroundColor: card || '#fff' }]}>
              <Text style={[styles.aboutTitle, { color: primaryText }]}>{t('battle.useInsightsTitle')}</Text>
              <Text style={styles.aboutText}>
                {battleStatus === 'COMPLETED' && battleOutcome === 'WINNER'
                  ? (t('battle.useInsightsText') || 'Use these insights to understand what won and why.')
                  : (t('battle.useInsightsText') || 'Use these insights to understand performance.')}
              </Text>
            </View>
            <View style={styles.actionRow}>
              <TouchableOpacity activeOpacity={0.9} style={[styles.outlineBtn, { borderColor: accent }]} onPress={() => Share.share({ message: t('battle.shareResultsMessage') }).catch(() => { })}>
                <Text style={[styles.outlineBtnText, { color: accent }]}>{t('battle.shareResults')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.actionBtn, { backgroundColor: accent }]}
                onPress={() => navigation.navigate('BattleInsightsActions', withClosetNavParams(route, { winnerItem, runnerUpItem }))}
              >
                <Text style={styles.actionBtnText}>{t('battle.useInsights')}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  screenTitle: { fontSize: 18, fontWeight: '800' },
  screenSubtitle: { marginTop: 2, fontSize: 12, color: MUTED, fontWeight: '600' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 30, gap: 12 },
  phone: { padding: 14, marginTop: 2 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  statusText: { fontSize: 12, fontWeight: '800', color: '#111' },
  statusIcons: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  batteryPill: { borderWidth: 1, borderColor: '#111', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  batteryText: { fontSize: 8, fontWeight: '800' },
  sectionTitle: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  sectionHint: { fontSize: 12, color: MUTED, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCard: { width: '48%', borderRadius: 18, borderWidth: 1, padding: 10 },
  gridCardSelected: { transform: [{ translateY: -2 }] },
  selectionDot: { position: 'absolute', top: 10, left: 10, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  selectionDotGhost: { position: 'absolute', top: 10, left: 10, width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: '#D8CBEF', backgroundColor: '#fff', zIndex: 1 },
  gridImage: { height: 120, borderRadius: 14, marginBottom: 8 },
  gridName: { fontSize: 12, fontWeight: '700' },
  gridPrice: { fontSize: 12, fontWeight: '800', marginTop: 4 },
  primaryButton: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  footerActions: { flexDirection: 'row', gap: 10 },
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
  optionCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 14, backgroundColor: '#fff', marginTop: 10 },
  optionTitle: { fontWeight: '800' },
  optionTextWrap: { flex: 1 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  optionSub: { color: MUTED, fontSize: 12, marginTop: 3 },
  pillRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: '#fff' },
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
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoText: { color: MUTED, fontSize: 12, fontWeight: '700' },
  aboutCard: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 14, gap: 4 },
  aboutTitle: { fontWeight: '900', fontSize: 14 },
  aboutText: { color: MUTED, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 12, alignItems: 'center' },
  statValue: { color: TEXT, fontWeight: '900', fontSize: 18 },
  statLabel: { color: MUTED, fontWeight: '700', fontSize: 11, marginTop: 2 },
  liveTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pillOutline: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: BORDER, backgroundColor: '#fff' },
  pillOutlineText: { fontSize: 11, fontWeight: '800' },
  liveMuted: { color: MUTED, fontWeight: '700', fontSize: 12 },
  voteCopy: { gap: 4 },
  battleQuestion: { fontSize: 23, lineHeight: 28, fontWeight: '900', textAlign: 'center', marginTop: 8, marginBottom: 6 },
  voteHeadline: { fontSize: 14, fontWeight: '900', color: TEXT, marginTop: 8 },
  voteSub: { fontSize: 12, fontWeight: '600', color: MUTED, marginBottom: 8 },
  voteChoicesWrap: { gap: 10, marginTop: 8, borderWidth: 1, borderColor: BORDER, borderRadius: 18, padding: 16 },
  voteActionWrap: { borderRadius: 14, overflow: 'hidden' },
  voteActionPrimaryWrap: { borderWidth: 0 },
  voteActionSecondaryWrap: { borderWidth: 2, borderColor: '#C8B6E9', backgroundColor: '#fff' },
  voteActionInner: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14},
  voteActionPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  voteActionSecondaryText: { fontSize: 16, fontWeight: '900', textAlign: 'center' },
  statsWrap: { marginTop: 6 },
  secondaryButton: { height: 46, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
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
  resultsBlock: { gap: 10, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 14 },
  resultsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1E8FB' },
  resultsLabel: { color: MUTED, fontWeight: '700' },
  resultsValue: { fontWeight: '900' },
  actionRow: { flexDirection: 'row', gap: 10 },
  outlineBtn: { flex: 1, height: 46, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  outlineBtnText: { fontWeight: '900' },
  actionBtn: { flex: 1, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '900' },
});
