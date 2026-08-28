import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { battleByUserId, battlePoint, filtterBattle } from '../../services/battle';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n';
import { sortBattlesLiveFirst } from '../../utils/battleCardUtils';
import {
  BATTLE_LEVELS,
  formatBattleLevelRequirement,
  getBattleLevelDragonflyIcon,
  resolveBattleLevel,
} from '../../utils/battleLevels';
import Svg, { Polygon } from 'react-native-svg';

const mixWithWhite = (hex, amount = 0.88) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return '#f5f3ff';
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const mix = channel => Math.round(channel + (255 - channel) * amount);
  const toHex = channel => mix(channel).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const withAlpha = (hex, alpha = 0.12) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return `rgba(201,161,90,${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const nestedSurface = (isDarkMode, accent) =>
  isDarkMode ? withAlpha(accent, 0.14) : mixWithWhite(accent, 0.92);

const pickFirst = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== '');

const normalizeBattleItem = (raw) => {
  const status = String(pickFirst(raw?.status, 'open')).toLowerCase();
  const options = Array.isArray(raw?.options) ? raw.options : [];
  const votes = Number(pickFirst(raw?._count?.participants, raw?.participantsCount, raw?.votes, 0));
  const stake = Number(pickFirst(raw?.stakeAmount, raw?.stake, raw?.pot, 0));
  const endTime = pickFirst(
    raw?.endTime,
    raw?.end_time,
    raw?.endsAt,
    raw?.ends_at,
    raw?.endDate,
    raw?.end_date,
    raw?.expiryTime,
    raw?.expiresAt,
    null,
  );
  const type = String(pickFirst(raw?.battleType, raw?.type, 'opinion')).toLowerCase();

  return {
    id: String(pickFirst(raw?.id, raw?._id, raw?.battleId, '')),
    title: pickFirst(raw?.title, raw?.question, 'Untitled battle'),
    status,
    format: String(pickFirst(raw?.format, 'POLL')).toUpperCase(),
    battleType: type,
    votes,
    stake,
    endTime,
    options: options.map((option, index) => ({
      id: String(pickFirst(option?.id, option?._id, index)),
      label:
        typeof option === 'string'
          ? option
          : pickFirst(option?.label, option?.text, option?.value, `Option ${index + 1}`),
    })),
  };
};

const emptySummary = {
  level: 'Rookie',
  totals: {
    totalBattlesJoined: 0,
    totalBattlesWon: 0,
    totalPredictionsCorrect: 0,
    totalPredictionsWrong: 0,
    totalArgumentLikes: 0,
  },
  predictionAccuracyPercent: 0,
  credibilityScore: 0,
  liveCount: 0,
  points: 0,
};

const formatDate = (value) => {
  if (!value) return null; // caller will use translation key
  const parsed =
    typeof value === 'number'
      ? new Date(value < 10_000_000_000 ? value * 1000 : value)
      : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString();
};

const isBattleExpired = (battle) => {
  const endTime = battle?.endTime;
  if (!endTime) return false;
  const parsed =
    typeof endTime === 'number'
      ? new Date(endTime < 10_000_000_000 ? endTime * 1000 : endTime)
      : new Date(endTime);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() <= Date.now();
};

const getStatusMeta = (battle) => {
  const status = String(battle?.status || '').toLowerCase();
  const expired = isBattleExpired(battle);

  if (status.includes('canceled') || status.includes('cancelled')) {
    return { labelKey: 'battleHub.statusCanceled', tone: '#DC2626' };
  }

  if (status.includes('pending_invite') || status.includes('pendinginvite')) {
    if (expired) return { labelKey: 'battleHub.statusClosed', tone: '#6B7280' };
    return { labelKey: 'battleHub.statusPendingInvite', tone: '#F59E0B' };
  }

  if (status.includes('live') || status.includes('progress')) {
    return { labelKey: 'battleHub.statusLive', tone: '#22C55E' };
  }
  if (
    status.includes('closed') ||
    status.includes('finished') ||
    status.includes('resolved')
  ) {
    return { labelKey: 'battleHub.statusFinished', tone: '#6B7280' };
  }
  if (expired) {
    return { labelKey: 'battleHub.statusClosed', tone: '#6B7280' };
  }
  if (status.includes('result')) {
    return { labelKey: 'battleHub.statusResult', tone: '#8B5CF6' };
  }
  return { labelKey: 'battleHub.statusOpen', tone: '#0F766E' };
};

const BATTLE_TRACKING_FILTERS = {
  myBattle: 'battle_live',
  battleArena: 'battle_arena',
  pastBattle: 'battle_past',
};

const getRawBattlesFromResponse = (response, filterKey) => {
  const payload = response?.data?.data ?? response?.data ?? response ?? {};
  return Array.isArray(payload)
    ? payload
    : payload?.[filterKey] ||
        payload?.battles ||
        payload?.data?.battles ||
        payload?.data?.[filterKey] ||
        payload?.data ||
        payload?.items ||
        response?.battles ||
        [];
};

export default function ProfileBattleHub({
  viewedUserId,
  isOwner = false,
  openBattleRoute = 'OpenBattle',
  profile,
  returnTo = 'Home',
  isCompanyProfile,
}) {
  const navigation = useNavigation();
  const { bgStyle, accent, border, mutedText } = useAppTheme(profile);
  const { isDarkMode } = useThemeContext();
  const { t } = useLanguage();
  const labelColor = isDarkMode ? '#ffffff' : '#111827';
  const inputSurface = isDarkMode ? 'rgba(255,255,255,0.08)' : '#f2f2f2';
  const surfaceBg = nestedSurface(isDarkMode, accent);
  const chipSurface = isDarkMode ? 'rgba(255,255,255,0.08)' : '#F3F4F6';
  const tabsSurface = isDarkMode ? 'rgba(255,255,255,0.06)' : '#F3F4F6';

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [battles, setBattles] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [battlePointSummary, setBattlePointSummary] = useState(emptySummary);
  const [activeTab, setActiveTab] = useState('myBattle');
  const [levelsModalVisible, setLevelsModalVisible] = useState(false);

  const PRIMARY_GRADIENT =
    profile === 'user' ? ['#513189bd', '#e54ba0'] : ['#C9A15a', '#C9A15a'];

  const loadBattles = useCallback(async () => {
    if (!isOwner && !viewedUserId) {
      setBattles([]);
      return;
    }
    setLoading(true);
    try {
      const filterKey = BATTLE_TRACKING_FILTERS[activeTab] ?? 'battle_live';
      const response = isOwner
        ? await filtterBattle({ filter: filterKey })
        : await battleByUserId({ params: { userId: viewedUserId } });
      const rawBattles = getRawBattlesFromResponse(response, filterKey);
      const normalized = Array.isArray(rawBattles)
        ? rawBattles.map(normalizeBattleItem).filter((item) => item.id)
        : [];
      setBattles(normalized);
    } catch (_error) {
      setBattles([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, isOwner, viewedUserId]);

  const getBattlePoint = useCallback(async () => {
    if (!viewedUserId) {
      setBattlePointSummary(emptySummary);
      return;
    }
    try {
      const response = await battlePoint({ params: { userId: viewedUserId } });
      const rawData = response?.data?.data || response?.data || response || {};
      const totals = rawData?.totals || {};
      const rawItems = Array.isArray(rawData?.items) ? rawData.items : [];
      setBattlePointSummary({
        level: String(rawData?.level || 'Rookie'),
        totals: {
          totalBattlesJoined: Number(totals?.totalBattlesJoined || 0),
          totalBattlesWon: Number(totals?.totalBattlesWon || 0),
          totalPredictionsCorrect: Number(totals?.totalPredictionsCorrect || 0),
          totalPredictionsWrong: Number(totals?.totalPredictionsWrong || 0),
          totalArgumentLikes: Number(totals?.totalArgumentLikes || 0),
        },
        predictionAccuracyPercent: Number(rawData?.predictionAccuracyPercent || 0),
        credibilityScore: Number(rawData?.credibilityScore || 0),
        liveCount: rawItems.filter((item) =>
          String(item?.status || '').toUpperCase().includes('LIVE'),
        ).length,
        points: Number(totals?.totalBattlePoints || 0),
      });
    } catch (_err) {
      setBattlePointSummary(emptySummary);
    }
  }, [viewedUserId]);

  useEffect(() => {
    loadBattles();
    getBattlePoint();
  }, [loadBattles, getBattlePoint]);

  useFocusEffect(
    useCallback(() => {
      loadBattles();
      getBattlePoint();
    }, [getBattlePoint, loadBattles]),
  );

  const currentBattleLevel = useMemo(
    () =>
      resolveBattleLevel({
        level: battlePointSummary.level,
        points: battlePointSummary.points,
        battlesWon: battlePointSummary.totals.totalBattlesWon,
        credibility: battlePointSummary.credibilityScore,
        accuracy: battlePointSummary.predictionAccuracyPercent,
      }),
    [battlePointSummary],
  );

  const levelInfo = useMemo(
    () => ({
      tier: currentBattleLevel.title,
      levelText: `LEVEL ${currentBattleLevel.level}`,
      color: currentBattleLevel.color,
      Icon: getBattleLevelDragonflyIcon(currentBattleLevel.iconId, isDarkMode),
    }),
    [currentBattleLevel, isDarkMode],
  );

  const requirementLabels = useMemo(
    () => ({
      points: t('battleHub.levelsModal.points'),
      battlesWon: t('battleHub.levelsModal.battlesWon'),
      credibility: t('battleHub.levelsModal.credibility'),
      accuracy: t('battleHub.levelsModal.accuracy'),
    }),
    [t],
  );

  const openLevelsModal = useCallback(() => setLevelsModalVisible(true), []);
  const closeLevelsModal = useCallback(() => setLevelsModalVisible(false), []);

  const DragonflyIcon = levelInfo.Icon;

  const stats = useMemo(
    () => [
      { key: 'level', label: t('battleHub.statLevel'), value: currentBattleLevel.title },
      { key: 'joined', label: t('battleHub.statJoined'), value: battlePointSummary.totals.totalBattlesJoined },
      { key: 'won', label: t('battleHub.statWon'), value: battlePointSummary.totals.totalBattlesWon },
      { key: 'accuracy', label: t('battleHub.statAccuracy'), value: `${battlePointSummary.predictionAccuracyPercent}%` },
      { key: 'points', label: t('battleHub.statPoints'), value: battlePointSummary.points },
      { key: 'credibility', label: t('battleHub.statCredibility'), value: battlePointSummary.credibilityScore },
    ],
    [battlePointSummary, currentBattleLevel.title, t],
  );

  const openBattle = useCallback(
    (battle) => {
      const params = { battleId: battle.id, battle, entryPoint: 'profile_battle_tab', profile };
      const parentNavigation = navigation.getParent?.();
      if (parentNavigation) {
        parentNavigation.navigate('ProfileMain', { screen: 'BattleInProgress', params });
        return;
      }
      navigation.navigate('BattleInProgress', params);
    },
    [navigation, profile],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadBattles();
      await getBattlePoint();
    } finally {
      setRefreshing(false);
    }
  }, [getBattlePoint, loadBattles]);

  const filteredBattles = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const matched = query
      ? battles.filter((battle) =>
        String(battle?.title || '').toLowerCase().includes(query),
      )
      : battles;
    return sortBattlesLiveFirst(matched);
  }, [battles, searchText]);

  return (
    <>
    <KeyboardAwareScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      enableOnAndroid
      extraScrollHeight={140}
      extraHeight={120}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Hero card */}
      <View style={[styles.heroCard, bgStyle, { borderColor: border }]}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroTextContainer}>
            <Text style={[styles.heroEyebrow, { color: accent }]}>
              {t('battleHub.heroEyebrow')}
            </Text>
            <Text style={[styles.heroTitle, { color: accent }]}>
              {t('battleHub.heroTitle')}
            </Text>
            <Text style={[styles.heroSubtitle, { color: mutedText }]}>
              {t('battleHub.heroSubtitle')}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.dragonflyContainer}
            onPress={openLevelsModal}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('battleHub.levelsModal.title')}
          >
            <View style={styles.hexagonWrapper}>
              <Svg width={84} height={84}>
                <Polygon
                  points="42,2 82,22 82,62 42,82 2,62 2,22"
                  stroke={levelInfo.color}
                  strokeWidth="2.5"
                  fill="transparent"
                  strokeLinejoin="round"
                />
              </Svg>
              <View style={styles.dragonflyIconInner}>
                <DragonflyIcon width={36} height={36} />
              </View>
            </View>
            <Text style={[styles.dragonflyTierText, { color: levelInfo.color }]}>
              {levelInfo.tier}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((item) => (
            <View
              key={item.key}
              style={[
                styles.statCard,
                { backgroundColor: surfaceBg },
              ]}
            >
              <Text style={[styles.statValue, { color: labelColor }]}>{item.value}</Text>
              <Text style={[styles.statLabel, { color: mutedText }]}>{item.label}</Text>
            </View>
          ))}
        </View>

        {isOwner && (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() =>
              navigation.navigate(
                openBattleRoute,
                { returnTo, profile },
                isCompanyProfile && isCompanyProfile,
              )
            }
          >
            <LinearGradient
              colors={PRIMARY_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>{t('battleHub.startNewBattle')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* Search */}
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: inputSurface,
            borderColor: border,
          },
        ]}
      >
        <Ionicons name="search" size={20} color={mutedText} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: labelColor }]}
          placeholder={t('battleHub.searchPlaceholder')}
          placeholderTextColor={mutedText}
          value={searchText}
          onChangeText={setSearchText}
          returnKeyType="search"
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearSearchBtn}>
            <Ionicons name="close-circle" size={20} color={mutedText} />
          </TouchableOpacity>
        )}
      </View>

      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: accent }]}>
          {t('battleHub.recentBattles')}
        </Text>
        <Text style={[styles.sectionSubtitle, { color: mutedText }]}>
          {t('battleHub.recentBattlesSubtitle')}
        </Text>
      </View>
      {isOwner ? (
        <View style={[styles.tabsContainer, { backgroundColor: tabsSurface }]}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'myBattle' && [styles.activeTabButton, { backgroundColor: accent }],
            ]}
            onPress={() => setActiveTab('myBattle')}
          >
            <Text
              style={[
                styles.tabText,
                { color: mutedText },
                activeTab === 'myBattle' && styles.activeTabText,
              ]}
            >
              My Battles
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'battleArena' && [styles.activeTabButton, { backgroundColor: accent }],
            ]}
            onPress={() => setActiveTab('battleArena')}
          >
            <Text
              style={[
                styles.tabText,
                { color: mutedText },
                activeTab === 'battleArena' && styles.activeTabText,
              ]}
            >
              Battle Arena
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'pastBattle' && [styles.activeTabButton, { backgroundColor: accent }],
            ]}
            onPress={() => setActiveTab('pastBattle')}
          >
            <Text
              style={[
                styles.tabText,
                { color: mutedText },
                activeTab === 'pastBattle' && styles.activeTabText,
              ]}
            >
              Past Battles
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {/* Battle list */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={accent} />
        </View>
      ) : filteredBattles.length > 0 ? (
        filteredBattles.map((battle) => {
          const statusMeta = getStatusMeta(battle);
          const dateLabel = formatDate(battle.endTime) ?? t('battleHub.noEndDate');
          return (
            <TouchableOpacity
              key={battle.id}
              activeOpacity={0.86}
              style={[
                styles.battleCard,
                { backgroundColor: surfaceBg, borderColor: border },
              ]}
              onPress={() => openBattle(battle)}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.statusPill, { backgroundColor: `${statusMeta.tone}18` }]}>
                  <Text style={[styles.statusText, { color: statusMeta.tone }]}>
                    {t(statusMeta.labelKey)}
                  </Text>
                </View>
                <Text style={[styles.cardMeta, { color: mutedText }]}>
                  {battle.battleType === 'prediction'
                    ? t('battleHub.typePrediction')
                    : t('battleHub.typeOpinion')}
                </Text>
              </View>

              <Text style={[styles.cardTitle, { color: labelColor }]}>{battle.title}</Text>

              {!!battle.options.length && (
                <View style={styles.optionRow}>
                  {battle.options.slice(0, 3).map((option) => (
                    <View
                      key={`${battle.id}-${option.id}`}
                      style={[styles.optionChip, { backgroundColor: chipSurface }]}
                    >
                      <Text style={[styles.optionText, { color: mutedText }]}>
                        {option.label}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.cardFooter}>
                <Text style={[styles.footerText, { color: mutedText }]}>{dateLabel}</Text>
              </View>
            </TouchableOpacity>
          );
        })
      ) : (
        <View
          style={[
            styles.emptyCard,
            { backgroundColor: surfaceBg, borderColor: border },
          ]}
        >
          <Ionicons name="trophy-outline" size={28} color={mutedText} />
          <Text style={[styles.emptyTitle, { color: accent }]}>
            {searchText.trim() ? t('battleHub.noResultsFound') : t('battleHub.noBattlesYet')}
          </Text>
          <Text style={[styles.emptySubtitle, { color: mutedText }]}>
            {searchText.trim()
              ? t('battleHub.noResultsSubtitle')
              : t('battleHub.noBattlesSubtitle')}
          </Text>
        </View>
      )}
    </KeyboardAwareScrollView>
      <Modal
        visible={levelsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeLevelsModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closeLevelsModal}
          />
          <View style={[styles.modalContent, bgStyle, { borderColor: border }]}>
            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.modalTitle, { color: labelColor }]}>
                {t('battleHub.levelsModal.title')}
              </Text>
              <Text style={[styles.modalSubtitle, { color: mutedText }]}>
                {t('battleHub.levelsModal.subtitle')}
              </Text>

              <View style={styles.levelsGrid}>
                {BATTLE_LEVELS.map((tier) => {
                  const isCurrent = tier.id === currentBattleLevel.id;
                  const requirements = formatBattleLevelRequirement(tier, requirementLabels);
                  const TierDragonflyIcon = getBattleLevelDragonflyIcon(tier.iconId, isDarkMode);
                  return (
                    <View
                      key={tier.id}
                      style={[
                        styles.levelCard,
                        {
                          backgroundColor: surfaceBg,
                          borderColor: isCurrent ? tier.color : border,
                        },
                        isCurrent && styles.levelCardCurrent,
                      ]}
                    >
                      {isCurrent ? (
                        <View style={[styles.currentBadge, { backgroundColor: tier.color }]}>
                          <Text style={styles.currentBadgeText}>
                            {t('battleHub.levelsModal.currentBadge')}
                          </Text>
                        </View>
                      ) : null}
                      <View style={[styles.levelPill, { backgroundColor: `${tier.color}22` }]}>
                        <Text style={[styles.levelPillText, { color: tier.color }]}>
                          {t('battleHub.levelsModal.levelPill', { level: tier.level })}
                        </Text>
                      </View>
                      <View style={styles.levelHexWrap}>
                        <Svg width={56} height={56}>
                          <Polygon
                            points="28,2 54,15 54,41 28,54 2,41 2,15"
                            stroke={tier.color}
                            strokeWidth="2"
                            fill="transparent"
                            strokeLinejoin="round"
                          />
                        </Svg>
                        <View style={styles.levelHexIcon}>
                          <TierDragonflyIcon width={24} height={24} />
                        </View>
                      </View>
                      <Text
                        style={[styles.levelTitle, { color: tier.color }]}
                        numberOfLines={2}
                      >
                        {tier.title}
                      </Text>
                      {requirements.map((req) => (
                        <View key={`${tier.id}-${req.key}`} style={styles.reqRow}>
                          <Ionicons
                            name={
                              req.key === 'points'
                                ? 'star'
                                : req.key === 'wins'
                                  ? 'trophy'
                                  : req.key === 'credibility'
                                    ? 'shield-checkmark'
                                    : 'speedometer'
                            }
                            size={12}
                            color={mutedText}
                            style={styles.reqIcon}
                          />
                          <Text style={[styles.reqText, { color: mutedText }]} numberOfLines={1}>
                            {req.text}
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>

              <Text style={[styles.modalFooter, { color: mutedText }]}>
                {t('battleHub.levelsModal.footer')}
              </Text>

              <TouchableOpacity
                style={[styles.modalCloseButton, { backgroundColor: accent }]}
                onPress={closeLevelsModal}
                activeOpacity={0.85}
              >
                <Text style={styles.modalCloseButtonText}>
                  {t('battleHub.levelsModal.gotIt')}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 45,
    padding: 10,
  },
  heroCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 6,
    lineHeight: 24,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    marginBottom: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statCard: {
    width: '48%',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1.5,
    borderRadius: 24,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  clearSearchBtn: {
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  loadingWrap: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  battleCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '900',
  },
  cardMeta: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  optionChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  optionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 8,
    marginBottom: '10%',
  },
  footerText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },

  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },

  activeTabButton: {},


  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },

  activeTabText: {
    color: '#FFF',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  heroTextContainer: {
    width: '68%',
  },
  dragonflyContainer: {
    width: '30%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hexagonWrapper: {
    width: 84,
    height: 84,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  dragonflyIconInner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragonflyTierText: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 6,
    textAlign: 'center',
  },
  dragonflyLevelText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8b8e9f',
    marginTop: 2,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalContent: {
    maxHeight: '88%',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
    lineHeight: 18,
  },
  levelsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  levelCard: {
    width: '48%',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  levelCardCurrent: {
    borderWidth: 2,
  },
  currentBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  currentBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  levelPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  levelPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  levelHexWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  levelHexIcon: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelTitle: {
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
    minHeight: 28,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 3,
  },
  reqIcon: {
    marginRight: 4,
  },
  reqText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '600',
  },
  modalFooter: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 16,
  },
  modalCloseButton: {
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
});
