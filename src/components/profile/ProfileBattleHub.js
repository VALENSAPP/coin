import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
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
import { useLanguage } from '../../i18n';
import { sortBattlesLiveFirst } from '../../utils/battleCardUtils';

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
  const { text, bgStyle } = useAppTheme(profile);
  const { t } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [battles, setBattles] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [battlePointSummary, setBattlePointSummary] = useState(emptySummary);
  const [activeTab, setActiveTab] = useState('myBattle');

  const PRIMARY_GRADIENT =
    profile === 'user' ? ['#513189bd', '#e54ba0'] : ['#D3B683', '#D3B683'];

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

  const stats = useMemo(
    () => [
      { key: 'level', label: t('battleHub.statLevel'), value: battlePointSummary.level },
      { key: 'joined', label: t('battleHub.statJoined'), value: battlePointSummary.totals.totalBattlesJoined },
      { key: 'won', label: t('battleHub.statWon'), value: battlePointSummary.totals.totalBattlesWon },
      { key: 'accuracy', label: t('battleHub.statAccuracy'), value: `${battlePointSummary.predictionAccuracyPercent}%` },
      { key: 'points', label: t('battleHub.statPoints'), value: battlePointSummary.points },
      { key: 'credibility', label: t('battleHub.statCredibility'), value: battlePointSummary.credibilityScore },
    ],
    [battlePointSummary, t],
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
      <View style={[styles.heroCard, bgStyle]}>
        <Text style={[styles.heroEyebrow, { color: `${text}AA` }]}>
          {t('battleHub.heroEyebrow')}
        </Text>
        <Text style={[styles.heroTitle, { color: profile === 'user' ? '#5a2d82' : '#D3B683' }]}>
          {t('battleHub.heroTitle')}
        </Text>
        <Text style={styles.heroSubtitle}>{t('battleHub.heroSubtitle')}</Text>

        <View style={styles.statsGrid}>
          {stats.map((item) => (
            <View
              key={item.key}
              style={[
                styles.statCard,
                { backgroundColor: profile === 'user' ? '#f4e9fd' : '#f6f1e8' },
              ]}
            >
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
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
      <View style={[styles.searchContainer, bgStyle]}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('battleHub.searchPlaceholder')}
          placeholderTextColor="#999"
          value={searchText}
          onChangeText={setSearchText}
          returnKeyType="search"
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearSearchBtn}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: profile === 'user' ? '#5a2d82' : '#D3B683' }]}>
          {t('battleHub.recentBattles')}
        </Text>
        <Text style={styles.sectionSubtitle}>{t('battleHub.recentBattlesSubtitle')}</Text>
      </View>
      {isOwner ? (
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'myBattle' && styles.activeTabButton,
            ]}
            onPress={() => setActiveTab('myBattle')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'myBattle' && styles.activeTabText,
              ]}
            >
              My Battles
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'battleArena' && styles.activeTabButton,
            ]}
            onPress={() => setActiveTab('battleArena')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'battleArena' && styles.activeTabText,
              ]}
            >
              Battle Arena
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'pastBattle' && styles.activeTabButton,
            ]}
            onPress={() => setActiveTab('pastBattle')}
          >
            <Text
              style={[
                styles.tabText,
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
          <ActivityIndicator size="small" color={text} />
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
                { backgroundColor: profile === 'user' ? '#f4e9fd' : '#f6f1e8' },
              ]}
              onPress={() => openBattle(battle)}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.statusPill, { backgroundColor: `${statusMeta.tone}18` }]}>
                  <Text style={[styles.statusText, { color: statusMeta.tone }]}>
                    {t(statusMeta.labelKey)}
                  </Text>
                </View>
                <Text style={styles.cardMeta}>
                  {battle.battleType === 'prediction'
                    ? t('battleHub.typePrediction')
                    : t('battleHub.typeOpinion')}
                </Text>
              </View>

              <Text style={styles.cardTitle}>{battle.title}</Text>

              {!!battle.options.length && (
                <View style={styles.optionRow}>
                  {battle.options.slice(0, 3).map((option) => (
                    <View key={`${battle.id}-${option.id}`} style={styles.optionChip}>
                      <Text style={styles.optionText}>{option.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.cardFooter}>
                <Text style={styles.footerText}>{dateLabel}</Text>
              </View>
            </TouchableOpacity>
          );
        })
      ) : (
        <View
          style={[
            styles.emptyCard,
            { backgroundColor: profile === 'user' ? '#f4e9fd' : '#f6f1e8' },
          ]}
        >
          <Ionicons name="trophy-outline" size={28} color="#9CA3AF" />
          <Text style={[styles.emptyTitle, { color: text }]}>
            {searchText.trim() ? t('battleHub.noResultsFound') : t('battleHub.noBattlesYet')}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchText.trim()
              ? t('battleHub.noResultsSubtitle')
              : t('battleHub.noBattlesSubtitle')}
          </Text>
        </View>
      )}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 20,
    padding: 10,
  },
  heroCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEE7FF',
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
    color: '#6B7280',
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
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
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
    backgroundColor: '#f2f2f2',
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1.5,
    borderRadius: 24,
    borderColor: '#e6e6e6',
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#000',
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
    color: '#6B7280',
    marginTop: 4,
  },
  loadingWrap: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  battleCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECE7F6',
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
    color: '#6B7280',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
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
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  optionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
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
    color: '#6B7280',
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ECE7F6',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
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

  activeTabButton: {
    backgroundColor: '#5a2d82',
  },

  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },

  activeTabText: {
    color: '#FFF',
  },
});
