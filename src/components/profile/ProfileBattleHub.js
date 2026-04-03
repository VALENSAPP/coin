import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { battleByUserId, battlePoint } from '../../services/battle';
import { useAppTheme } from '../../theme/useApptheme';



const pickFirst = (...values) =>
  values.find(value => value !== undefined && value !== null && value !== '');

const normalizeBattleItem = raw => {
  const status = String(pickFirst(raw?.status, 'open')).toLowerCase();
  const options = Array.isArray(raw?.options) ? raw.options : [];
  const votes = Number(
    pickFirst(raw?._count?.participants, raw?.participantsCount, raw?.votes, 0),
  );
  const stake = Number(pickFirst(raw?.stakeAmount, raw?.stake, raw?.pot, 0));
  const endTime = pickFirst(raw?.endTime, raw?.endsAt, null);
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

const formatDate = value => {
  if (!value) return 'No end date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'No end date';
  return parsed.toLocaleDateString();
};

const getStatusMeta = battle => {
  if (battle.status.includes('live') || battle.status.includes('progress')) {
    return { label: 'LIVE', tone: '#EF4444' };
  }
  if (
    battle.status.includes('closed') ||
    battle.status.includes('finished') ||
    battle.status.includes('resolved')
  ) {
    return { label: 'FINISHED', tone: '#6B7280' };
  }
  if (battle.status.includes('result')) {
    return { label: 'RESULT', tone: '#8B5CF6' };
  }
  return { label: 'OPEN', tone: '#0F766E' };
};

export default function ProfileBattleHub({
  viewedUserId,
  isOwner = false,
  openBattleRoute = 'OpenBattle',
  profile
}) {
  const navigation = useNavigation();
  const { text, card } = useAppTheme(profile);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [battles, setBattles] = useState([]);
  const [battlePointSummary, setBattlePointSummary] = useState({
    level: 'Rookie',
    totals: {
      totalBattlesJoined: 0,
      totalBattlesWon: 0,
    },
    liveCount: 0,
  });

  const PRIMARY_GRADIENT =
    profile === 'user'
      ? ['#513189bd', '#e54ba0'] : ['#D3B683', '#D3B683'];

  const loadBattles = useCallback(async () => {
    if (!viewedUserId) {
      setBattles([]);
      return;
    }

    setLoading(true);
    try {
      const response = await battleByUserId({ params: { userId: viewedUserId } });
      console.log(response, 'reposne in battle by use id ')
      const rawBattles =
        response?.data?.battles ||
        response?.data?.data ||
        response?.data ||
        response?.battles ||
        [];

      const normalized = Array.isArray(rawBattles)
        ? rawBattles.map(normalizeBattleItem).filter(item => item.id)
        : [];

      setBattles(normalized);
    } catch (error) {
      setBattles([]);
    } finally {
      setLoading(false);
    }
  }, [viewedUserId]);

  const getBattlePoint = useCallback(async () => {
    if (!viewedUserId) {
      setBattlePointSummary({
        level: 'Rookie',
        totals: {
          totalBattlesJoined: 0,
          totalBattlesWon: 0,
        },
        liveCount: 0,
      });
      return;
    }

    try {
      const response = await battlePoint({ params: { userId: viewedUserId } });
      console.log(response, 'data in thi apia ');

      const rawData =
        response?.data?.data ||
        response?.data ||
        response ||
        {};
      const totals = rawData?.totals || {};
      const items = Array.isArray(rawData?.items) ? rawData.items : [];
      const liveCount = items.filter(item =>
        String(item?.status || '').toUpperCase() === 'LIVE',
      ).length;

      setBattlePointSummary({
        level: String(rawData?.level || 'Rookie'),
        totals: {
          totalBattlesJoined: Number(totals?.totalBattlesJoined || 0),
          totalBattlesWon: Number(totals?.totalBattlesWon || 0),
        },
        liveCount,
      });
    } catch (errr) {
      console.log(errr, 'fail to load dataa');
      setBattlePointSummary({
        level: 'Rookie',
        totals: {
          totalBattlesJoined: 0,
          totalBattlesWon: 0,
        },
        liveCount: 0,
      });
    }
  }, [viewedUserId]);

  useEffect(() => {
    loadBattles();
    getBattlePoint
  }, [loadBattles,getBattlePoint]);

  const stats = useMemo(() => {
    return [
      {
        key: 'level',
        label: 'Level',
        value: battlePointSummary.level,
      },
      {
        key: 'joined',
        label: 'Battle Joined',
        value: battlePointSummary.totals.totalBattlesJoined,
      },
      {
        key: 'won',
        label: 'Battle Won',
        value: battlePointSummary.totals.totalBattlesWon,
      },
      {
        key: 'live',
        label: 'Live',
        value: battlePointSummary.liveCount,
      },
    ];
  }, [battlePointSummary]);

  const openBattle = useCallback(
    battle => {
      const params = {
        battleId: battle.id,
        battle,
        entryPoint: 'profile_battle_tab',
        profile,
      };

      const parentNavigation = navigation.getParent?.();

      if (parentNavigation) {
        parentNavigation.navigate('ProfileMain', {
          screen: 'BattleInProgress',
          params,
        });
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

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      contentContainerStyle={styles.contentContainer}
    >
      <View style={[styles.heroCard, { backgroundColor: card || '#fff' }]}>
        <Text style={[styles.heroEyebrow, { color: `${text}AA` }]}>
          Battle Performance
        </Text>
        <Text style={[styles.heroTitle, { color: profile === 'user' ? '#5a2d82' : '#D3B683' }]}>
          Compete, predict, and build your Valens reputation.
        </Text>
        <Text style={styles.heroSubtitle}>
          Opinion battles reward votes and engagement. Prediction battles reward accuracy first.
        </Text>

        <View style={styles.statsGrid}>
          {stats.map(item => (
            <View key={item.key} style={styles.statCard}>
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {isOwner && (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => navigation.navigate(openBattleRoute)}
          >
            <LinearGradient
              colors={PRIMARY_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Start a New Battle</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: profile === 'user' ? '#5a2d82' : '#D3B683' }]}>Recent Battles</Text>
        <Text style={styles.sectionSubtitle}>Open any battle to continue the flow.</Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={text} />
        </View>
      ) : battles.length > 0 ? (
        battles.map(battle => {
          const statusMeta = getStatusMeta(battle);
          return (
            <TouchableOpacity
              key={battle.id}
              activeOpacity={0.86}
              style={styles.battleCard}
              onPress={() => openBattle(battle)}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.statusPill, { backgroundColor: `${statusMeta.tone}18` }]}>
                  <Text style={[styles.statusText, { color: statusMeta.tone }]}>
                    {statusMeta.label}
                  </Text>
                </View>
                <Text style={styles.cardMeta}>
                  {battle.battleType === 'prediction' ? 'Prediction' : 'Opinion'}
                </Text>
              </View>

              <Text style={styles.cardTitle}>{battle.title}</Text>

              {!!battle.options.length && (
                <View style={styles.optionRow}>
                  {battle.options.slice(0, 3).map(option => (
                    <View key={`${battle.id}-${option.id}`} style={styles.optionChip}>
                      <Text style={styles.optionText}>{option.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.cardFooter}>
                {/* <Text style={styles.footerText}>{battle.votes} votes</Text> */}
                {/* <Text style={styles.footerText}>{battle.stake} points</Text> */}
                <Text style={styles.footerText}>{formatDate(battle.endTime)}</Text>
              </View>
            </TouchableOpacity>
          );
        })
      ) : (
        <View style={styles.emptyCard}>
          <Ionicons name="trophy-outline" size={28} color="#9CA3AF" />
          <Text style={[styles.emptyTitle, { color: text }]}>No battles yet</Text>
          <Text style={styles.emptySubtitle}>
            Start with an opinion battle or invite someone into a head-to-head duel.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 20,
    padding: 10
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
    marginBottom: '10%'
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
});
