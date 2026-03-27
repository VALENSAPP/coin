import React, { useMemo } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useRoute } from '@react-navigation/native';
import { useAppTheme } from '../../theme/useApptheme';

const withAlpha = (hex, alpha) => {
  if (typeof hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return `${hex}${alpha}`;
  }
  return hex;
};

const pickFirst = (...values) =>
  values.find(value => value !== undefined && value !== null && value !== '');

const normalizeOption = (option, index) => {
  if (typeof option === 'string') {
    return {
      id: `${index}`,
      label: option,
      votes: 0,
      likes: 0,
      percentage: 0,
    };
  }

  return {
    id: String(pickFirst(option?.id, option?._id, index)),
    label: pickFirst(
      option?.label,
      option?.text,
      option?.value,
      `Option ${index + 1}`,
    ),
    votes: Number(pickFirst(option?.votes, option?.voteCount, 0)),
    likes: Number(pickFirst(option?.likes, option?.likeCount, 0)),
    percentage: Number(
      pickFirst(option?.percentage, option?.votePercentage, 0),
    ),
  };
};

const buildResultData = battle => {
  const normalizedBattle = battle || {};
  const options = (
    Array.isArray(normalizedBattle.options) ? normalizedBattle.options : []
  ).map(normalizeOption);
  const battleType = String(
    pickFirst(normalizedBattle.battleType, 'OPINION'),
  ).toUpperCase();
  const winnerOption =
    options.slice().sort((a, b) => {
      if (battleType === 'PREDICTION') {
        const aMatch = a.label === normalizedBattle.resultValue ? 1 : 0;
        const bMatch = b.label === normalizedBattle.resultValue ? 1 : 0;
        if (bMatch !== aMatch) return bMatch - aMatch;
      }
      const voteDelta = Number(b.votes || 0) - Number(a.votes || 0);
      if (voteDelta !== 0) return voteDelta;
      return Number(b.likes || 0) - Number(a.likes || 0);
    })[0] || {};

  const points = Number(
    pickFirst(normalizedBattle.stake, normalizedBattle.stakeAmount, 0),
  );
  const winnerName = pickFirst(
    normalizedBattle.winnerName,
    normalizedBattle.winner?.name,
    normalizedBattle.creator?.name,
    winnerOption.label,
    'Battle Winner',
  );

  return {
    title: pickFirst(
      normalizedBattle.title,
      normalizedBattle.question,
      'Battle results',
    ),
    postedAgo: normalizedBattle.endTime
      ? new Date(normalizedBattle.endTime).toLocaleString()
      : 'Live update',
    winner: winnerName,
    winnerPoints: `${
      points || Math.max(Number(winnerOption.votes || 0), 1) * 10
    }`,
    bonusPoints: `${Math.max(Math.round(points * 0.2), 20)}`,
    winnerLogic:
      battleType === 'PREDICTION'
        ? 'Winner decided by actual result first, then engagement.'
        : 'Winner decided by votes plus likes and argument engagement.',
    metrics:
      options.length > 0
        ? options.slice(0, 3).map(option => ({
            label: option.label,
            value: `${option.votes} votes • ${option.likes} likes`,
          }))
        : [{ label: 'No vote data yet', value: 'Waiting for battle activity' }],
    total: `+${points || Math.max(Number(winnerOption.votes || 0), 1) * 10}`,
    stakeBreakdown:
      options.length > 0
        ? options.slice(0, 3).map((option, index) => ({
            label: option.label,
            value: `${option.votes} votes`,
            color: ['#f2994a', '#7c3aed', '#14B8A6'][index] || '#9CA3AF',
          }))
        : [{ label: 'Stake pool', value: `${points}`, color: '#7c3aed' }],
  };
};

export default function BattleResults({ navigation }) {
  const route = useRoute();
  const { bgStyle, text, card } = useAppTheme();
  const resultData = useMemo(
    () => buildResultData(route?.params?.battle),
    [route?.params?.battle],
  );
  const palette = useMemo(() => {
    const primary = text || '#5a2d82';
    const secondary =
      primary.toLowerCase() === '#d3b683' ? '#b8924f' : '#8f54f7';

    return {
      primary,
      secondary,
      surface: card || '#fff',
      muted: withAlpha(primary, 'AA'),
      warm: '#ffc778',
      warmSoft: '#fff3d1',
    };
  }, [card, text]);

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <ScrollView
        style={[styles.container, bgStyle]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerIconBtn}
          >
            <Icon name="arrow-back-ios-new" size={20} color={text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: text }]}>
            Battle Results
          </Text>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Ionicons name="person-outline" size={20} color={text} />
          </TouchableOpacity>
        </View>

        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: palette.muted }]}>
            Results for:
          </Text>
          <Text style={[styles.infoTime, { color: withAlpha(text, '88') }]}>
            {resultData.postedAgo}
          </Text>
        </View>
        <Text style={[styles.prompt, { color: text }]}>{resultData.title}</Text>
        <Text style={[styles.logicText, { color: palette.muted }]}>
          {resultData.winnerLogic}
        </Text>

        <LinearGradient
          colors={[palette.secondary, palette.primary, palette.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.resultCard}
        >
          <View style={styles.topTrophyRow}>
            <Ionicons name="trophy-outline" size={36} color={palette.warm} />
          </View>

          <LinearGradient
            colors={[palette.primary, palette.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.victoryBanner}
          >
            <Text style={styles.victoryText}>VICTORY!</Text>
          </LinearGradient>

          <View style={styles.scoreHeaderRow}>
            <Text style={styles.scoreHeaderName}>Player A</Text>
            <Text style={styles.scoreHeaderTeam}>Team</Text>
            <Text style={styles.scoreHeaderPoints}>
              {resultData.winnerPoints}
            </Text>
          </View>

          <View style={styles.playerWinnerRow}>
            <View style={styles.playerDotWrap}>
              <View style={styles.playerDot} />
              <Text style={styles.playerName}>{resultData.winner}</Text>
            </View>
            <Text style={styles.playerPoints}>{resultData.winnerPoints}</Text>
          </View>

          <View style={styles.metricsList}>
            {resultData.metrics.map(item => (
              <View key={item.label} style={styles.metricRow}>
                <View style={styles.metricLabelWrap}>
                  <Icon name="thumb-up" size={13} color="#ede2ff" />
                  <Text style={styles.metricLabel}>{item.label}</Text>
                </View>
                <Text style={styles.metricValue}>{item.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalBonus}>{resultData.total}</Text>
            <Text style={styles.totalPoints}>{resultData.winnerPoints}</Text>
          </View>
        </LinearGradient>

        <View
          style={[
            styles.rewardCard,
            { backgroundColor: palette.surface, shadowColor: palette.primary },
          ]}
        >
          <Text style={[styles.rewardTitle, { color: withAlpha(text, 'D0') }]}>
            You Win!
          </Text>
          <LinearGradient
            colors={[palette.warmSoft, '#ffd184', '#ffbf66']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.rewardBadge}
          >
            <Ionicons
              name="ribbon-outline"
              size={20}
              color="#97591a"
              style={styles.rewardEmojiIcon}
            />
            <Text style={styles.rewardValue}>
              {resultData.bonusPoints} Points
            </Text>
          </LinearGradient>
        </View>

        <View
          style={[
            styles.breakdownCard,
            { backgroundColor: palette.surface, shadowColor: palette.primary },
          ]}
        >
          <Text
            style={[styles.breakdownTitle, { color: withAlpha(text, 'D0') }]}
          >
            Stake Breakdown
          </Text>
          {resultData.stakeBreakdown.map(item => (
            <View key={item.label} style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <View
                  style={[styles.breakdownDot, { backgroundColor: item.color }]}
                />
                <Text
                  style={[
                    styles.breakdownName,
                    { color: withAlpha(text, 'BF') },
                  ]}
                >
                  {item.label}
                </Text>
              </View>
              <Text style={[styles.breakdownValue, { color: text }]}>
                {item.value}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    marginTop: '10%',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoTime: {
    fontSize: 11,
    fontWeight: '600',
  },
  prompt: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 25,
    marginBottom: 8,
  },
  logicText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginBottom: 16,
  },
  resultCard: {
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  topTrophyRow: {
    alignItems: 'center',
    marginBottom: 6,
  },
  victoryBanner: {
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  victoryText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  scoreHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  scoreHeaderName: {
    flex: 1,
    color: '#efe7ff',
    fontSize: 13,
    fontWeight: '700',
  },
  scoreHeaderTeam: {
    color: '#d4c5ff',
    fontSize: 13,
    fontWeight: '700',
    marginRight: 10,
  },
  scoreHeaderPoints: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  playerWinnerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  playerDotWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 8,
    backgroundColor: '#ffd470',
    borderWidth: 2,
    borderColor: '#fff1c2',
  },
  playerName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  playerPoints: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '900',
  },
  metricsList: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  metricLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    color: '#f3ecff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  metricValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  totalLabel: {
    color: '#d9ccff',
    fontSize: 13,
    fontWeight: '800',
  },
  totalBonus: {
    color: '#ffc778',
    fontSize: 26,
    fontWeight: '900',
  },
  totalPoints: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '900',
  },
  rewardCard: {
    marginTop: 14,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  rewardTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  rewardEmojiIcon: {
    marginRight: 8,
  },
  rewardValue: {
    color: '#97591a',
    fontSize: 25,
    fontWeight: '900',
  },
  breakdownCard: {
    marginTop: 14,
    borderRadius: 20,
    padding: 16,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
    marginBottom: '10%',
  },
  breakdownTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breakdownDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  breakdownName: {
    fontSize: 14,
    fontWeight: '600',
  },
  breakdownValue: {
    fontSize: 15,
    fontWeight: '800',
  },
});
