import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useToast } from 'react-native-toast-notifications';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n';
import { showToastMessage } from '../../components/displaytoastmessage';
import {
  getMarketplaceBattleBoostByBattle,
  createMarketplaceBattleBoostIntent,
  createMarketplaceBattleBoostPaymentSession,
  createMarketplaceBattleWinnerPromotion,
  getMarketplaceBattleBoostPackages,
} from '../../services/myCloset';
import { Header, CHALLENGE_ITEMS } from './MyClosetBattleScreens';
import { formSurfaces, selectedSurface, themedCard } from '../../utils/closetTheme';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { BASE_URL } from '../../config/urls';

const PURPLE = '#5B2FB5';
const BORDER = '#E7DDF7';
const SOFT_BG = '#FBF7FF';
const TEXT = '#2F2259';
const MUTED = '#786D96';

const PROMOTION_WINDOW_DAYS = 7;
const PROMOTION_WINDOW_MS = PROMOTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const getPromotionCountdown = completedAt => {
  if (!completedAt) return null;
  const completedTime = new Date(completedAt).getTime();
  if (Number.isNaN(completedTime)) return null;

  const expiresAt = completedTime + PROMOTION_WINDOW_MS;
  const msRemaining = expiresAt - Date.now();

  return {
    expiresAt,
    msRemaining,
    // ceil so it reads 7 the moment the battle completes, then 6, 5, 4...
    daysRemaining: Math.max(0, Math.ceil(msRemaining / ONE_DAY_MS)),
    isExpired: msRemaining <= 0,
  };
};

const FALLBACK_BOOST_PACKAGES = [
  { id: 'starter', days: 3, priceLabel: '$4.99', viewsLabel: '~5K - 10K' },
  { id: 'growth', days: 7, priceLabel: '$9.99', viewsLabel: '~15K - 30K' },
  { id: 'boostPlus', days: 14, priceLabel: '$19.99', viewsLabel: '~40K - 80K' },
];

const PROMO_TYPES = [
  { id: 'discount24', icon: 'pricetag-outline' },
  { id: 'freeShipping', icon: 'car-outline' },
  // { id: 'exclusiveDrop', icon: 'flash-outline' },
  // { id: 'vipOnly', icon: 'star-outline' },
  // { id: 'winnerSale', icon: 'trophy-outline' },
];

const PROMO_TYPE_API_MAP = {
  discount24: 'DISCOUNT_10_PERCENT_24H',
  freeShipping: 'FREE_SHIPPING',
  // exclusiveDrop: 'EXCLUSIVE_DROP',
  // vipOnly: 'VIP_ONLY',
  // winnerSale: 'WINNER_SALE',
};

const imageUri = img => {
  if (Array.isArray(img) && img.length > 0) img = img[0];
  const raw = typeof img === 'string' ? img : img?.uri || null;
  if (!raw) return null;
  const t = String(raw).replace(/["'\s]+$/, '').trim();
  if (!t) return null;
  if (t.startsWith('http://') || t.startsWith('https://') || t.startsWith('data:') || t.startsWith('file://')) return t;
  if (t.startsWith('/')) return `${BASE_URL}${t}`;
  return `${BASE_URL}/${t}`;
};

const getPromoImage = item =>
  imageUri(item?.image) ||
  imageUri(item?.images?.[0]) ||
  imageUri(item?.thumbnail) ||
  imageUri(item?.thumbnailUrl) ||
  imageUri(item?.photoUrl) ||
  imageUri(item?.coverImage) ||
  null;

const getPromoPrice = item =>
  item?.price != null
    ? String(item.price)
    : item?.formattedPrice || item?.amount || item?.salePrice || '';

const fastImageSource = rawUri => {
  const uri = imageUri(rawUri);
  return uri
    ? {
      uri,
      priority: FastImage.priority.normal,
    }
    : null;
};

const ActionRow = ({ icon, title, subtitle, accent, onPress, cardBg, titleColor, borderColor, mutedColor }) => (
  <TouchableOpacity
    activeOpacity={0.85}
    onPress={onPress}
    style={[styles.actionRow, themedCard(cardBg, borderColor), { backgroundColor: cardBg || '#fff' }]}
  >
    <View style={[styles.actionIcon, { backgroundColor: `${accent}1A` }]}>
      <Ionicons name={icon} size={20} color={accent} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.actionTitle, { color: titleColor || TEXT }]}>{title}</Text>
      <Text style={[styles.actionSubtitle, mutedColor && { color: mutedColor }]}>{subtitle}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={mutedColor || MUTED} />
  </TouchableOpacity>
);

/**
 * Shared "Insights & Actions" hub shown right after Battle Results, and
 * again at the top of each sub-flow (Boost / Promotion / Challenge) so the
 * winning item stays visible while the user decides what to do next.
 */
export function BattleInsightsActionsScreen({ navigation, route }) {
  const { bgStyle, text, card, bg, border, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const subtleMuted = mutedText || surfaces.mutedColor;
  const surface = card || surfaces.listSurface;
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const winnerItem = route?.params?.winnerItem || {
    name: 'Mini Shoulder Bag',
    price: '$85',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80',
  };
  const insights = route?.params?.insights
  const battleId = route?.params?.battleId || route?.params?.id || winnerItem?.battleId;

  const completedAt = insights?.completedAt || route?.params?.completedAt || winnerItem?.completedAt;

  const [countdown, setCountdown] = useState(() => getPromotionCountdown(completedAt));

  useEffect(() => {
    setCountdown(getPromotionCountdown(completedAt));
    if (!completedAt) return undefined;

    const interval = setInterval(() => {
      setCountdown(getPromotionCountdown(completedAt));
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [completedAt]);

  const isExpired = !!countdown?.isExpired;
  const daysRemaining = countdown?.daysRemaining ?? PROMOTION_WINDOW_DAYS;

  if (isExpired) {
    return (
      <PromotionExpiredScreen
        navigation={navigation}
        winnerItem={winnerItem}
        battleId={battleId}
      />
    );
  }

  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
      <Header title={t('battleInsights.headerTitle')} onBack={() => navigation.goBack()} accentColor={accent} titleColor={text || TEXT} rightIcon="ellipsis-horizontal" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[accent, text]} start={{ x: 0.05, y: 0.05 }} end={{ x: 0.95, y: 0.95 }} style={[styles.promoBanner, { minHeight: 167, paddingTop: 0, paddingBottom: 18, marginTop: 8 }]}>
          <View style={styles.promoBannerGlowA} />
          <View style={styles.promoBannerGlowB} />
          {/* <Text style={[styles.promoBannerTag, { marginBottom: 12 }]}>{t('battleInsights.headerTitle')?.toUpperCase?.() || 'BATTLE WINNER'}</Text> */}
          <View style={styles.promoBannerItemRow}>
            {getPromoImage(winnerItem) ? <FastImage source={fastImageSource(getPromoImage(winnerItem))} style={styles.promoBannerImage} resizeMode={FastImage.resizeMode.cover} /> : <View style={styles.promoBannerImagePlaceholder} />}
            <View style={styles.promoBannerItemCopy}>
              <Text style={styles.promoBannerItemName} numberOfLines={2}>{winnerItem?.name}</Text>
              {getPromoPrice(winnerItem) ? <Text style={styles.promoBannerItemPrice}>${getPromoPrice(winnerItem)}</Text> : null}
              <Text style={styles.promoBannerItemMeta}>🏆 {t('battleInsights.winner')}</Text>
            </View>
          </View>
        </LinearGradient>

        <Text style={[styles.sectionLabel, { color: text || TEXT }]}>{t('battleInsights.whatNext')}</Text>

        <ActionRow
          icon="rocket-outline"
          accent={accent}
          cardBg={surface}
          borderColor={border || surfaces.listBorder}
          mutedColor={subtleMuted}
          titleColor={text}
          title={t('battleInsights.boostTitle')}
          subtitle={t('battleInsights.boostSubtitle')}
          onPress={() => navigation.navigate('BoostWinningItem', { winnerItem, battleId })}
        />
        <ActionRow
          icon="pricetag-outline"
          accent={accent}
          cardBg={surface}
          borderColor={border || surfaces.listBorder}
          mutedColor={subtleMuted}
          titleColor={text}
          title={t('battleInsights.promotionTitle')}
          subtitle={t('battleInsights.promotionSubtitle')}
          onPress={() => navigation.navigate('CreateWinnerPromotion', { winnerItem, battleId })}
        />
        <ActionRow
          icon="flash-outline"
          accent={accent}
          cardBg={surface}
          borderColor={border || surfaces.listBorder}
          mutedColor={subtleMuted}
          titleColor={text}
          title={t('battleInsights.challengeTitle')}
          subtitle={t('battleInsights.challengeSubtitle')}
          onPress={() =>
            navigation.navigate('CreateBattle', {
              items: CHALLENGE_ITEMS,
              headerTitle: t('battleInsights.challengeHeaderTitle'),
              defaultQuestion: t('battleInsights.challengeDefaultQuestion'),
              nextRoute: 'BattleSetup',
              previewRoute: 'BattlePreview',
              liveRoute: 'BattleLive',
            })
          }
        />
        <View
          style={[
            styles.winnerNotice,
            themedCard(surface, border || surfaces.listBorder),
            { backgroundColor: `${accent}10` },
          ]}
        >
          <View style={styles.winnerNoticeHeader}>
            <View style={[styles.winnerNoticeIcon, { backgroundColor: `${accent}15` }]}>
              <Ionicons name="sparkles-outline" size={20} color={accent} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.winnerNoticeTitle, { color: text || TEXT }]}>
                🎉 {t('battleInsights.heyWinner') || 'Hey Winner!'}
              </Text>

              <Text style={[styles.winnerNoticeText, { color: subtleMuted }]}>
                {t('battleInsights.winnerMessage', { days: daysRemaining, unit: 'days' }) ||
                  `You have ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} to choose how you'd like to promote your winning product.`}
              </Text>

              <Text style={[styles.winnerNoticeText, { color: subtleMuted, marginTop: 6 }]}>
                {t('battleInsights.winnerExpiry') ||
                  "If not used in time, it will expire and can't be used."}
              </Text>

              <Text style={[styles.winnerNoticeFooter, { color: accent }]}>
                ❤️ {t('battleInsights.winnerFooter') || "We're here to help you shine! ✨"}
              </Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

export function PromotionExpiredScreen({ navigation, winnerItem, battleId }) {
  const { bgStyle, text, card, bg, border, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const subtleMuted = mutedText || surfaces.mutedColor;
  const surface = card || surfaces.listSurface;
  const { t } = useLanguage();
  const accent = text || PURPLE;

  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
      <Header
        title={t('battleInsights.promotionExpiredTitle') || 'Promotion Expired'}
        onBack={() => navigation.goBack()}
        accentColor={accent}
        titleColor={text || TEXT}
      />
      <ScrollView contentContainerStyle={styles.expiredScrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.expiredIconWrap}>
          <View style={[styles.expiredIconCircle, { backgroundColor: `${accent}15` }]}>
            <Ionicons name="alarm-outline" size={64} color={accent} />
          </View>
          <View style={[styles.expiredTrophyBadge, { backgroundColor: '#FFB020' }]}>
            <Ionicons name="trophy" size={18} color="#fff" />
            <View style={[styles.expiredTrophyX, { backgroundColor: accent }]}>
              <Ionicons name="close" size={10} color="#fff" />
            </View>
          </View>
          <Ionicons name="sparkles" size={16} color={accent} style={styles.sparkleTopLeft} />
          <Ionicons name="sparkles" size={12} color={accent} style={styles.sparkleBottomRight} />
        </View>

        <Text style={[styles.expiredTitle, { color: text || TEXT }]}>
          {t('battleInsights.oopsTimesUp') || "Oops... Time's up! ⏳"}
        </Text>
        <Text style={[styles.expiredSubtitle, { color: subtleMuted }]}>
          {t('battleInsights.expiredSubtitle') || 'Your Winner Promotion has expired.'}
        </Text>

        <View style={[styles.expiredNoticeCard, themedCard(surface, border || surfaces.listBorder)]}>
          <Ionicons name="calendar-outline" size={18} color={accent} style={{ marginTop: 2 }} />
          <Text style={[styles.expiredNoticeText, { color: subtleMuted }]}>
            {t('battleInsights.expiredWindowNotice', { days: PROMOTION_WINDOW_DAYS }) ||
              `Your ${PROMOTION_WINDOW_DAYS}-day promotion window has ended, so this reward is no longer available.`}
          </Text>
        </View>

        <View style={[styles.dontWorryCard, themedCard(surface, border || surfaces.listBorder), { backgroundColor: `${accent}0D` }]}>
          <View style={styles.dontWorryHeader}>
            <View style={[styles.dontWorryEmojiCircle, { backgroundColor: `${accent}1A` }]}>
              <Text style={{ fontSize: 20 }}>😊</Text>
            </View>
            <Text style={[styles.dontWorryTitle, { color: text || TEXT }]}>
              {t('battleInsights.dontWorryTitle') || "But don't worry! 🎉"}
            </Text>
          </View>
          <Text style={[styles.dontWorryText, { color: subtleMuted }]}>
            {t('battleInsights.dontWorryText') ||
              "That's just one battle. Create a new Battle, let the community vote again, and if your product wins, you'll unlock a brand-new promotion opportunity."}
          </Text>

          <View style={styles.nextWinnerTipRow}>
            <Ionicons name="rocket-outline" size={16} color={accent} />
            <Text style={[styles.nextWinnerTipText, { color: subtleMuted }]}>
              {t('battleInsights.nextWinnerTip') || 'Who knows? Your next winner might become your best-selling item yet. 😊'}
            </Text>
          </View>
        </View>

        <View style={styles.readyRow}>
          <Ionicons name="star" size={14} color={accent} />
          <Text style={[styles.readyText, { color: text || TEXT }]}>
            {t('battleInsights.readyRoundTwo') || 'Ready for round two?'}
          </Text>
          <Ionicons name="star-outline" size={14} color={accent} />
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() =>
            navigation.navigate('CreateBattle', {
              items: CHALLENGE_ITEMS,
              headerTitle: t('battleInsights.challengeHeaderTitle'),
              defaultQuestion: t('battleInsights.challengeDefaultQuestion'),
              nextRoute: 'BattleSetup',
              previewRoute: 'BattlePreview',
              liveRoute: 'BattleLive',
            })
          }
        >
          <LinearGradient colors={[accent, text]} style={[styles.primaryButton, {flexDirection: 'row', paddingHorizontal: 85}]}>
            <Ionicons name="flash-outline" size={16} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.primaryButtonText}>
              {t('battleInsights.createNewBattle') || 'Create New Battle'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('wallet', { screen: 'MyCloset' })}
          style={[styles.secondaryButton, { borderColor: border || surfaces.listBorder, backgroundColor: surface }]}
        >
          <Ionicons name="refresh-outline" size={16} color={accent} style={{ marginRight: 8 }} />
          <Text style={[styles.secondaryButtonText, { color: accent }]}>
            {t('battleInsights.goToMyCloset') || 'Go to My Closet'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

/* ----------------------------- Boost flow ----------------------------- */

export function BoostWinningItemScreen({ navigation, route }) {
  const { bgStyle, text, card, bg, border, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const idleSurface = card || surfaces.inputSurface;
  const subtleMuted = mutedText || surfaces.mutedColor;
  const surface = card || surfaces.listSurface;
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const winnerItem = route?.params?.winnerItem;
  const battleId = route?.params?.battleId;
  const [showBadge, setShowBadge] = useState(true);
  const [pinOnTop, setPinOnTop] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState('growth');
  const [packages, setPackages] = useState(FALLBACK_BOOST_PACKAGES);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const loadPackages = async () => {
      setLoadingPackages(true);
      setError('');
      try {
        const response = await getMarketplaceBattleBoostPackages();
        const items = Array.isArray(response?.data?.data) ? response.data.data : Array.isArray(response?.data) ? response.data : [];
        if (!mounted) return;
        if (items.length) {
          setPackages(
            items.map((item, index) => {
              const priceValue = item?.price != null ? Number(item.price) : 0;
              const durationHours = Number(item?.durationHours ?? item?.duration ?? 0) || 0;
              return {
                id: item?.id || item?._id || `package-${index}`,
                days: durationHours > 0 ? Math.max(1, Math.round(durationHours / 24)) : (item?.days || 0),
                priceLabel: item?.currency && priceValue ? `${item.currency === 'USD' ? '$' : item.currency}${priceValue.toFixed(2)}` : item?.price ? `$${Number(item.price).toFixed(2)}` : '$0.00',
                viewsLabel: item?.description || item?.viewsLabel || '',
              };
            })
          );
          setSelectedPackage(items[0]?.id);
        }
      } catch (e) {
        if (mounted) setError(t('boost.tryAgain') || 'Could not load boost packages.');
      } finally {
        if (mounted) setLoadingPackages(false);
      }
    };
    loadPackages();
    return () => {
      mounted = false;
    };
  }, [t]);

  const pkg = packages.find(p => p.id === selectedPackage) || packages[0];

  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
      <Header title={t('boost.headerTitle')} onBack={() => navigation.goBack()} accentColor={accent} titleColor={text || TEXT} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionHint, { color: subtleMuted }]}>{t('boost.headerHint')}</Text>

        <View style={[styles.toggleRow, themedCard(surface, border || surfaces.listBorder)]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleTitle, { color: text || TEXT }]}>{t('boost.badgeTitle')}</Text>
            <Text style={[styles.toggleSub, { color: subtleMuted }]}>{t('boost.badgeSubtitle')}</Text>
          </View>
          <Switch value={showBadge} onValueChange={setShowBadge} thumbColor="#fff" trackColor={{ true: accent, false: isDarkMode ? '#333333' : '#D8CBEF' }} />
        </View>

        <View style={[styles.toggleRow, themedCard(surface, border || surfaces.listBorder)]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleTitle, { color: text || TEXT }]}>{t('boost.pinTitle')}</Text>
            <Text style={[styles.toggleSub, { color: subtleMuted }]}>{t('boost.pinSubtitle')}</Text>
          </View>
          <Switch value={pinOnTop} onValueChange={setPinOnTop} thumbColor="#fff" trackColor={{ true: accent, false: isDarkMode ? '#333333' : '#D8CBEF' }} />
        </View>

        <Text style={[styles.sectionLabel, { color: text || TEXT }]}>{t('boost.packageTitle')}</Text>
        {loadingPackages ? <Text style={[styles.sectionHint, { color: subtleMuted }]}>{t('boost.loading') || 'Loading packages...'}</Text> : null}
        {error ? <Text style={[styles.sectionHint, { color: '#C2410C' }]}>{error}</Text> : null}
        <View style={styles.packageRow}>
          {packages.map(p => {
            const selected = p.id === selectedPackage;
            return (
              <TouchableOpacity
                key={p.id}
                activeOpacity={0.9}
                onPress={() => setSelectedPackage(p.id)}
                style={[
                  styles.packageCard,
                  { backgroundColor: idleSurface, borderColor: border || surfaces.listBorder },
                  selected && { borderColor: accent, backgroundColor: selectedSurface(accent, isDarkMode) },
                ]}
              >
                <Text style={[styles.packageDays, { color: text || TEXT }]}>{t('boost.days', { count: p.days })}</Text>
                <Text style={[styles.packagePrice, { color: accent }]}>{p.priceLabel}</Text>
                <Text style={[styles.packageViews, { color: subtleMuted }]}>{p.viewsLabel}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() =>
            navigation.navigate('ReviewBoost', {
              winnerItem,
              battleId,
              showBadge,
              pinOnTop,
              selectedPackage,
              boostPackage: pkg,
            })
          }
        >
          <LinearGradient colors={[accent, text]} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{t('boost.continue')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export function ReviewBoostScreen({ navigation, route }) {
  const { bgStyle, text, card, bg, border, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const subtleMuted = mutedText || surfaces.mutedColor;
  const surface = card || surfaces.listSurface;
  const rowBorder = isDarkMode ? (border || surfaces.listBorder) : '#F1E8FB';
  const { t } = useLanguage();
  const toast = useToast();
  const accent = text || PURPLE;
  const { winnerItem, showBadge, pinOnTop, selectedPackage, battleId, boostPackage } = route?.params || {};
  const [submitting, setSubmitting] = useState(false);
  const pkg = boostPackage || FALLBACK_BOOST_PACKAGES.find(p => p.id === selectedPackage) || FALLBACK_BOOST_PACKAGES[1];

  const handleBoostNow = async () => {
    if (!battleId) {
      showToastMessage(toast, 'danger', 'Missing battle id');
      return;
    }
    try {
      setSubmitting(true);
      const lookupRes = await getMarketplaceBattleBoostByBattle(battleId);
      const lookupStatus = lookupRes?.status || lookupRes?.statusCode;
      if (![200, 201].includes(lookupStatus)) {
        throw new Error(lookupRes?.data?.message || lookupRes?.message || 'Unable to check boost status');
      }

      const lookupData = lookupRes?.data?.data || lookupRes?.data || {};
      let boostId = lookupData?.boostId || lookupData?.id || lookupData?._id || lookupData?.data?.id;

      if (!boostId) {
        const intentRes = await createMarketplaceBattleBoostIntent(battleId, {
          packageId: selectedPackage,
          pinOnTop: !!pinOnTop,
          winnerBadge: !!showBadge,
        });
        const intentStatus = intentRes?.status || intentRes?.statusCode;
        if (![200, 201].includes(intentStatus)) {
          throw new Error(intentRes?.data?.message || intentRes?.message || 'Unable to create boost');
        }
        boostId = intentRes?.data?.data?.id || intentRes?.data?.id || intentRes?.data?.boostId;
      }

      if (!boostId) throw new Error('Boost id missing from response');

      const paymentRes = await createMarketplaceBattleBoostPaymentSession(boostId);
      const paymentStatus = paymentRes?.status || paymentRes?.statusCode;
      if (![200, 201].includes(paymentStatus)) {
        throw new Error(paymentRes?.data?.message || paymentRes?.message || 'Unable to start payment session');
      }
      const paymentData = paymentRes?.data?.data || paymentRes?.data || {};
      const paymentUrl =
        paymentData?.url ||
        paymentData?.checkoutUrl ||
        paymentData?.paymentUrl ||
        paymentData?.payment?.checkoutUrl ||
        paymentData?.payment?.url;
      if (paymentUrl) {
        if (await InAppBrowser.isAvailable()) {
          await InAppBrowser.open(paymentUrl, {
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
        } else {
          await Linking.openURL(paymentUrl);
        }

        let isPaid = false;
        try {
          for (let i = 0; i < 4; i++) {
            const checkRes = await getMarketplaceBattleBoostByBattle(battleId);
            const checkData = checkRes?.data?.data || checkRes?.data || {};
            const st = String(checkData?.paymentStatus || checkData?.status || checkData?.state || '').toLowerCase();

            if (st === 'paid' || st === 'active' || st === 'success' || st === 'completed') {
              isPaid = true;
              break;
            }
            if (st === 'failed' || st === 'cancelled' || st === 'canceled') {
              break;
            }
            await new Promise(r => setTimeout(r, 1500));
          }
        } catch (e) {
          console.error('Error checking boost status:', e);
        }

        if (isPaid) {
          Alert.alert(t('boost.boostedTitle'), t('boost.boostedMessage'), [
            { text: t('boost.done'), onPress: () => navigation.navigate('wallet', { screen: 'MyCloset', params: { boostedItemId: winnerItem?.id } }) },
          ]);
        }
        return;
      }

      throw new Error('Payment URL missing from response');
    } catch (error) {
      Alert.alert(error?.response?.data?.message || error?.message || 'Please try again.');
      // showToastMessage(toast, 'danger', error?.response?.data?.message || error?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
      <Header title={t('boost.reviewTitle')} onBack={() => navigation.goBack()} accentColor={accent} titleColor={text || TEXT} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.reviewItemCard, themedCard(surface, border || surfaces.listBorder)]}>
          <FastImage source={fastImageSource(getPromoImage(winnerItem))} style={styles.winnerImage} resizeMode={FastImage.resizeMode.cover} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.winnerName, { color: text || TEXT }]}>{winnerItem?.name}</Text>
            <Text style={[styles.winnerPrice, { color: subtleMuted }]}>${winnerItem?.price}</Text>
          </View>
        </View>

        <View style={[styles.reviewBlock, themedCard(surface, border || surfaces.listBorder)]}>
          <View style={[styles.reviewRow, { borderBottomColor: rowBorder }]}>
            <Text style={[styles.reviewLabel, { color: subtleMuted }]}>{t('boost.badgeTitle')}</Text>
            <Text style={[styles.reviewValue, { color: accent }]}>{showBadge ? `✓ ${t('boost.on')}` : t('boost.off')}</Text>
          </View>
          <View style={[styles.reviewRow, { borderBottomColor: rowBorder }]}>
            <Text style={[styles.reviewLabel, { color: subtleMuted }]}>{t('boost.pinTitle')}</Text>
            <Text style={[styles.reviewValue, { color: accent }]}>{pinOnTop ? `✓ ${t('boost.on')}` : t('boost.off')}</Text>
          </View>
          <View style={[styles.reviewRow, { borderBottomColor: rowBorder }]}>
            <Text style={[styles.reviewLabel, { color: subtleMuted }]}>{t('boost.packageLabel')}</Text>
            <Text style={[styles.reviewValue, { color: text || TEXT }]}>{t('boost.days', { count: pkg.days })}</Text>
          </View>
          <View style={[styles.reviewRow, { borderBottomColor: rowBorder }]}>
            <Text style={[styles.reviewLabel, { color: subtleMuted }]}>{t('boost.estimatedViews')}</Text>
            <Text style={[styles.reviewValue, { color: text || TEXT }]}>{pkg.viewsLabel}</Text>
          </View>
          <View style={[styles.reviewRow, { borderBottomColor: rowBorder }]}>
            <Text style={[styles.reviewLabel, { color: subtleMuted }]}>{t('boost.starts')}</Text>
            <Text style={[styles.reviewValue, { color: text || TEXT }]}>{t('boost.immediately')}</Text>
          </View>
          <View style={[styles.reviewRow, { borderBottomColor: rowBorder, borderBottomWidth: 0 }]}>
            <Text style={[styles.reviewLabel, { color: subtleMuted }]}>{t('boost.total')}</Text>
            <Text style={[styles.reviewValue, { color: accent, fontSize: 16 }]}>{pkg.priceLabel}</Text>
          </View>
        </View>

        <TouchableOpacity activeOpacity={0.9} onPress={handleBoostNow} disabled={submitting}>
          <LinearGradient colors={[accent, text]} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{submitting ? (t('boost.loading') || 'Loading...') : t('boost.boostNow')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

/* --------------------------- Promotion flow ---------------------------- */

export function CreateWinnerPromotionScreen({ navigation, route }) {
  const { bgStyle, text, card, bg, border, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const idleSurface = card || surfaces.inputSurface;
  const subtleMuted = mutedText || surfaces.mutedColor;
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const winnerItem = route?.params?.winnerItem;
  const battleId = route?.params?.battleId;
  const [selectedType, setSelectedType] = useState('discount24');

  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
      <Header title={t('promotion.headerTitle')} onBack={() => navigation.goBack()} accentColor={accent} titleColor={text || TEXT} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionLabel, { color: text || TEXT }]}>{t('promotion.chooseType')}</Text>
        {PROMO_TYPES.map(promo => {
          const selected = promo.id === selectedType;
          return (
            <TouchableOpacity
              key={promo.id}
              activeOpacity={0.9}
              onPress={() => setSelectedType(promo.id)}
              style={[
                styles.promoTypeCard,
                { backgroundColor: idleSurface, borderColor: border || surfaces.listBorder },
                selected && { borderColor: accent, backgroundColor: selectedSurface(accent, isDarkMode) },
              ]}
            >
              <View style={[styles.actionIcon, { backgroundColor: `${accent}1A` }]}>
                <Ionicons name={promo.icon} size={18} color={accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.promoTypeTitle, { color: text || TEXT }]}>{t(`promotion.types.${promo.id}.title`)}</Text>
                <Text style={[styles.promoTypeSub, { color: subtleMuted }]}>{t(`promotion.types.${promo.id}.subtitle`)}</Text>
              </View>
              {selected ? <Ionicons name="checkmark-circle" size={20} color={accent} /> : null}
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('PromotionDetails', { winnerItem, promotionType: selectedType, battleId })}
        >
          <LinearGradient colors={[accent, text]} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{t('promotion.next')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export function PromotionDetailsScreen({ navigation, route }) {
  const { bgStyle, text, card, bg, border, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const idleSurface = card || surfaces.inputSurface;
  const subtleMuted = mutedText || surfaces.mutedColor;
  const surface = card || surfaces.listSurface;
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const { winnerItem, promotionType, battleId } = route?.params || {};
  const isFreeShipping = promotionType === 'freeShipping';
  const defaultFreeShippingMsg = 'Thank you for voting! Enjoy free shipping on our battle winner.';
  const defaultMsg = isFreeShipping
    ? (t('promotion.defaultFreeShippingMessage') || defaultFreeShippingMsg)
    : t('promotion.defaultMessage');

  const [discount, setDiscount] = useState('10');
  const [duration, setDuration] = useState('24 HOURS');
  const [message, setMessage] = useState(defaultMsg);

  return (
    <KeyboardAvoidingView style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={t('promotion.detailsTitle')} onBack={() => navigation.goBack()} accentColor={accent} titleColor={text || TEXT} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[accent, text]} start={{ x: 0.05, y: 0.05 }} end={{ x: 0.95, y: 0.95 }} style={styles.promoBanner}>
          <View style={styles.promoBannerGlowA} />
          <View style={styles.promoBannerGlowB} />
          <Text style={styles.promoBannerTag}>{t('promotion.bannerTag')}</Text>
          {isFreeShipping ? (
            <Text style={styles.promoBannerDiscount}>
              <Text style={[styles.promoBannerDiscountValue, { fontSize: 32 }]}>{t('promotion.types.freeShipping.title')}</Text>
            </Text>
          ) : (
            <Text style={styles.promoBannerDiscount}>
              <Text style={styles.promoBannerDiscountValue}>{discount}%</Text>
              <Text style={styles.promoBannerDiscountSuffix}> OFF</Text>
            </Text>
          )}
          <Text style={styles.promoBannerSub}>{t('promotion.bannerSub', { duration: duration?.toLowerCase?.() || duration })}</Text>
          <View style={styles.promoBannerItemRow}>
            {getPromoImage(winnerItem) ? <FastImage source={fastImageSource(getPromoImage(winnerItem))} style={styles.promoBannerImage} resizeMode={FastImage.resizeMode.cover} /> : <View style={styles.promoBannerImagePlaceholder} />}
            <View style={styles.promoBannerItemCopy}>
              <Text style={styles.promoBannerItemName} numberOfLines={2}>{winnerItem?.name}</Text>
              {getPromoPrice(winnerItem) ? <Text style={styles.promoBannerItemPrice}>${getPromoPrice(winnerItem)}</Text> : null}
              <Text style={styles.promoBannerItemMeta}>🏆 {t('battleInsights.winner')}</Text>
            </View>
          </View>
        </LinearGradient>

        {promotionType !== 'freeShipping' ? (
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: text || TEXT }]}>{t('promotion.discountLabel')}</Text>
            <View style={[styles.inputCard, { backgroundColor: idleSurface, borderColor: border || surfaces.listBorder }]}>
              <TextInput
                value={discount}
                onChangeText={setDiscount}
                keyboardType="number-pad"
                placeholderTextColor={surfaces.placeholderColor}
                style={[styles.inputText, { color: surfaces.inputText }]}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: text || TEXT }]}>{t('promotion.durationLabel')}</Text>
          <View style={styles.pillRow}>
            {[['24 HOURS', t('battle.duration24h')], ['3 DAYS', t('battle.duration3d')], ['7 DAYS', t('battle.duration7d')]].map(([value, label]) => (
              <TouchableOpacity
                key={value}
                onPress={() => setDuration(value)}
                style={[
                  styles.pill,
                  { backgroundColor: idleSurface, borderColor: border || surfaces.listBorder },
                  duration === value && { borderColor: accent, backgroundColor: selectedSurface(accent, isDarkMode) },
                ]}
              >
                <Text style={[styles.pillText, { color: text || TEXT }, duration === value && { color: accent, fontWeight: '800' }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: text || TEXT }]}>{t('promotion.messageLabel')}</Text>
          <View style={[styles.inputCard, { backgroundColor: idleSurface, borderColor: border || surfaces.listBorder }]}>
            <TextInput
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={100}
              placeholderTextColor={surfaces.placeholderColor}
              style={[styles.inputText, { color: surfaces.inputText, minHeight: 60 }]}
            />
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() =>
            navigation.navigate('PreviewPromotion', {
              winnerItem,
              promotionType,
              discount,
              duration,
              message,
              battleId,
            })
          }
        >
          <LinearGradient colors={[accent, text]} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{t('promotion.preview')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function PreviewPromotionScreen({ navigation, route }) {
  const { bgStyle, text, card, bg, border, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const subtleMuted = mutedText || surfaces.mutedColor;
  const surface = card || surfaces.listSurface;
  const { t } = useLanguage();
  const toast = useToast();
  const accent = text || PURPLE;
  const { winnerItem, discount, duration, message, promotionType, battleId } = route?.params || {};
  const isFreeShipping = promotionType === 'freeShipping';
  const promoImage = getPromoImage(winnerItem);
  const promoPrice = getPromoPrice(winnerItem);
  const promoDiscount = `${String(discount ?? '').replace('%', '')}%`;
  const [launching, setLaunching] = useState(false);

  const handleLaunch = async () => {
    if (!battleId) {
      showToastMessage(toast, 'danger', 'Missing battle id');
      return;
    }
    try {
      setLaunching(true);
      const response = await createMarketplaceBattleWinnerPromotion(battleId, {
        promoType: PROMO_TYPE_API_MAP[promotionType] || String(promotionType || '').toUpperCase(),
        discount: isFreeShipping ? undefined : discount,
        duration,
        message: message || t('promotion.defaultMessage'),
      });
      const status = response?.status || response?.statusCode;
      if (![200, 201].includes(status)) {
        throw new Error(response?.data?.message || response?.message || 'Unable to launch promotion');
      }
      Alert.alert(t('promotion.liveTitle'), t('promotion.liveMessage'), [
        { text: t('boost.done'), onPress: () => navigation.navigate('wallet', { screen: 'MyCloset', params: { promotedItemId: winnerItem?.id } }) },
      ]);
    } catch (error) {
      showToastMessage(toast, 'danger', error?.response?.data?.message || error?.message || 'Please try again.');
    } finally {
      setLaunching(false);
    }
  };

  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
      <Header title={t('promotion.previewTitle')} onBack={() => navigation.goBack()} accentColor={accent} titleColor={text || TEXT} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[accent, text]} start={{ x: 0.05, y: 0.05 }} end={{ x: 0.95, y: 0.95 }} style={styles.promoBanner}>
          <View style={styles.promoBannerGlowA} />
          <View style={styles.promoBannerGlowB} />
          <Text style={styles.promoBannerTag}>{t('promotion.bannerTag')}</Text>
          {isFreeShipping ? (
            <Text style={styles.promoBannerDiscount}>
              <Text style={[styles.promoBannerDiscountValue, { fontSize: 32 }]}>{t('promotion.types.freeShipping.title')}</Text>
            </Text>
          ) : (
            <Text style={styles.promoBannerDiscount}>
              <Text style={styles.promoBannerDiscountValue}>{promoDiscount}</Text>
              <Text style={styles.promoBannerDiscountSuffix}> OFF</Text>
            </Text>
          )}
          <Text style={styles.promoBannerSub}>{t('promotion.bannerSub', { duration: duration?.toLowerCase?.() || duration })}</Text>
          <View style={styles.promoBannerItemRow}>
            {promoImage ? <FastImage source={fastImageSource(promoImage)} style={styles.promoBannerImage} resizeMode={FastImage.resizeMode.cover} /> : <View style={styles.promoBannerImagePlaceholder} />}
            <View style={styles.promoBannerItemCopy}>
              <Text style={styles.promoBannerItemName} numberOfLines={2}>{winnerItem?.name}</Text>
              {promoPrice ? <Text style={styles.promoBannerItemPrice}>{promoPrice}</Text> : null}
              <Text style={styles.promoBannerItemMeta}>🏆 {t('battleInsights.winner')}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={[styles.reviewBlock, themedCard(surface, border || surfaces.listBorder)]}>
          <View style={styles.reviewMetaRow}>
            <View style={styles.reviewMetaCol}>
              <Text style={[styles.reviewLabel, { color: subtleMuted }]}>{t('promotion.starts')}</Text>
              <Text style={[styles.reviewValue, { color: text || TEXT }]}>{t('promotion.startsValue')}</Text>
            </View>
            <View style={styles.reviewMetaCol}>
              <Text style={[styles.reviewLabel, { color: subtleMuted }]}>{t('promotion.ends')}</Text>
              <Text style={[styles.reviewValue, { color: text || TEXT }]}>{t('promotion.endsValue', { duration })}</Text>
            </View>
          </View>
          {message ? (
            <View style={{ paddingTop: 8 }}>
              <Text style={[styles.reviewLabel, { color: subtleMuted }]}>{t('promotion.messageLabel')}</Text>
              <Text style={[styles.aboutText, { marginTop: 4, color: subtleMuted }]}>{message}</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity activeOpacity={0.9} onPress={handleLaunch} disabled={launching}>
          <LinearGradient colors={[accent, text]} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{launching ? (t('boost.loading') || 'Loading...') : t('promotion.launch')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 40 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 28, gap: 12 },
  sectionHint: { fontSize: 12, color: MUTED, fontWeight: '600' },
  sectionLabel: { fontSize: 15, fontWeight: '800', marginTop: 6 },

  winnerNotice: { marginTop: 20, borderRadius: 20, padding: 18 },
  winnerNoticeHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  winnerNoticeIcon: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  winnerNoticeTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  winnerNoticeText: { fontSize: 14, lineHeight: 22 },
  winnerNoticeFooter: { marginTop: 14, fontSize: 14, fontWeight: '600' },

  winnerCard: { flexDirection: 'row', gap: 12, borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 12, alignItems: 'center' },
  winnerImage: { width: 64, height: 64, borderRadius: 14 },
  winnerPill: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4 },
  winnerPillText: { fontSize: 11, fontWeight: '800', color: '#7A5B00' },
  winnerName: { fontSize: 15, fontWeight: '800' },
  winnerPrice: { fontSize: 13, fontWeight: '700', color: MUTED, marginTop: 2 },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 14 },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontWeight: '800', fontSize: 14 },
  actionSubtitle: { color: MUTED, fontSize: 12, fontWeight: '600', marginTop: 2 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 14 },
  toggleTitle: { fontWeight: '800', fontSize: 14 },
  toggleSub: { color: MUTED, fontSize: 12, fontWeight: '600', marginTop: 2 },

  packageRow: { flexDirection: 'row', gap: 10 },
  packageCard: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 12, alignItems: 'center', gap: 4 },
  packageDays: { fontWeight: '800', fontSize: 13 },
  packagePrice: { fontWeight: '900', fontSize: 15 },
  packageViews: { fontSize: 10, color: MUTED, fontWeight: '700', textAlign: 'center' },

  primaryButton: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '900' },

  reviewItemCard: { flexDirection: 'row', gap: 12, alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 12 },
  reviewBlock: { gap: 4, borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 14 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1E8FB' },
  reviewLabel: { color: MUTED, fontWeight: '700', fontSize: 13 },
  reviewValue: { fontWeight: '800', fontSize: 13 },

  promoTypeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 12 },
  promoTypeTitle: { fontWeight: '800', fontSize: 13 },
  promoTypeSub: { color: MUTED, fontSize: 11, fontWeight: '600', marginTop: 2 },

  field: { gap: 8, marginTop: 4 },
  fieldLabel: { fontSize: 14, fontWeight: '800' },
  inputCard: { borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 14 },
  inputText: { fontWeight: '600' },
  pillRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: BORDER },
  pillText: { color: TEXT, fontWeight: '800', fontSize: 12 },

  promoBanner: {
    borderRadius: 22,
    padding: 18,
    marginHorizontal: -15,
    minHeight: 335,
    overflow: 'hidden',
    justifyContent: 'flex-start',
    gap: 8,
  },
  promoBannerGlowA: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.14)',
    top: -70,
    right: -60,
  },
  promoBannerGlowB: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.08)',
    bottom: 78,
    left: -52,
  },
  promoBannerTag: { color: '#F6EFFF', fontWeight: '900', fontSize: 13, letterSpacing: 1.2, marginTop: 4 },
  promoBannerDiscount: { color: '#fff', marginTop: 2, lineHeight: 58 },
  promoBannerDiscountValue: { color: '#fff', fontWeight: '900', fontSize: 58, letterSpacing: -1.5 },
  promoBannerDiscountSuffix: { color: '#fff', fontWeight: '900', fontSize: 30, letterSpacing: 0.5 },
  promoBannerSub: { color: '#F6EFFF', fontWeight: '800', fontSize: 14, marginTop: -2 },
  promoBannerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 16,
    padding: 12,
    marginTop: 22,
    marginRight: 30
  },
  promoBannerImage: { width: 78, height: 78, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)' },
  promoBannerImagePlaceholder: { width: 78, height: 78, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)' },
  promoBannerItemCopy: { flex: 1, justifyContent: 'center' },
  promoBannerItemName: { color: '#fff', fontWeight: '800', fontSize: 17, lineHeight: 21 },
  promoBannerItemPrice: { color: '#fff', fontWeight: '900', fontSize: 16, marginTop: 6 },
  promoBannerItemMeta: { color: '#F6EFFF', fontWeight: '800', fontSize: 12, marginTop: 8 },
  reviewMetaRow: { flexDirection: 'row', gap: 18 },
  reviewMetaCol: { flex: 1, gap: 4 },
  aboutText: { color: MUTED, fontSize: 12, lineHeight: 18, fontWeight: '600' },

  expiredScrollContent: { paddingHorizontal: 20, paddingBottom: 28, alignItems: 'center', gap: 10 },
  expiredIconWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginTop: 12, marginBottom: 4 },
  expiredIconCircle: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  expiredTrophyBadge: { position: 'absolute', right: 6, bottom: 10, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  expiredTrophyX: { position: 'absolute', right: -4, top: -4, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sparkleTopLeft: { position: 'absolute', top: 4, left: 6 },
  sparkleBottomRight: { position: 'absolute', bottom: 8, right: 4 },
  expiredTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center', marginTop: 6 },
  expiredSubtitle: { fontSize: 14, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  expiredNoticeCard: { flexDirection: 'row', gap: 10, borderRadius: 16, padding: 14, width: '100%' },
  expiredNoticeText: { flex: 1, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  dontWorryCard: { width: '100%', borderRadius: 18, padding: 16, gap: 10 },
  dontWorryHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dontWorryEmojiCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dontWorryTitle: { fontSize: 15, fontWeight: '800' },
  dontWorryText: { fontSize: 13, lineHeight: 20, fontWeight: '600' },
  nextWinnerTipRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  nextWinnerTipText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  readyText: { fontSize: 14, fontWeight: '800' },
  secondaryButton: { height: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', width: '100%', marginTop: 4 },
  secondaryButtonText: { fontSize: 15, fontWeight: '800' },
});
