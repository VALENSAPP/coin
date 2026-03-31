import React, { useMemo } from 'react';
import {
  Platform,
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

const OPTION_COLORS = ['#F59E0B', '#8B5CF6', '#14B8A6', '#EC4899', '#3B82F6'];

const withAlpha = (hex, alpha) => {
  if (typeof hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return `${hex}${alpha}`;
  }
  return hex;
};

const pickFirst = (...values) =>
  values.find(value => value !== undefined && value !== null && value !== '');

const formatBattleTime = value => {
  if (!value) return 'End time not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'End time not available';
  return parsed.toLocaleString();
};

const formatCount = value => {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) {
    return '0';
  }
  return numericValue.toLocaleString();
};

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
    label: String(
      pickFirst(
        option?.side,
        option?.label,
        option?.text,
        option?.value,
        option?.name,
        option?.title,
        `Option ${index + 1}`,
      ),
    ),
    votes: Number(
      pickFirst(option?.votes, option?.voteCount, option?._count?.votes, 0),
    ),
    likes: Number(pickFirst(option?.likes, option?.likeCount, 0)),
    percentage: Number(
      pickFirst(option?.percentage, option?.votePercentage, 0),
    ),
  };
};

const buildResultData = battle => {
  const normalizedBattle = battle || {};
  const format = String(pickFirst(normalizedBattle.format, 'POLL')).toUpperCase();
  const battleType = String(
    pickFirst(
      normalizedBattle.battleType,
      normalizedBattle.type,
      format === 'POLL' ? 'PREDICTION' : 'OPINION',
    ),
  ).toUpperCase();
  const rawOptions = Array.isArray(normalizedBattle.options)
    ? normalizedBattle.options
    : [];
  const fallbackOptions = [
    pickFirst(
      normalizedBattle.creatorChoice,
      normalizedBattle.creatorLockedOption,
      '',
    ),
    pickFirst(normalizedBattle.invitedUserChoice, ''),
  ].filter(Boolean);
  const options = (rawOptions.length > 0 ? rawOptions : fallbackOptions).map(
    normalizeOption,
  );
  const totalVotes =
    Number(
      pickFirst(
        normalizedBattle.totalVotes,
        normalizedBattle.votesCount,
        normalizedBattle?._count?.votes,
        0,
      ),
    ) || options.reduce((sum, option) => sum + Number(option.votes || 0), 0);
  const totalComments = Number(
    pickFirst(
      normalizedBattle.totalComments,
      normalizedBattle?._count?.comments,
      Array.isArray(normalizedBattle.comments)
        ? normalizedBattle.comments.length
        : 0,
      0,
    ),
  );
  const resultValue = pickFirst(
    normalizedBattle.resultValue,
    normalizedBattle.actualResult,
    normalizedBattle.winningOption,
    '',
  );
  const rankedOptions = options
    .map((option, index) => {
      const rawPercentage = Number(option.percentage || 0);
      const computedPercentage =
        rawPercentage > 0
          ? rawPercentage
          : totalVotes > 0
            ? Math.round((Number(option.votes || 0) / totalVotes) * 100)
            : 0;

      return {
        ...option,
        percentage: computedPercentage,
        color: OPTION_COLORS[index % OPTION_COLORS.length],
        isResultMatch:
          !!resultValue && String(option.label) === String(resultValue),
      };
    })
    .sort((a, b) => {
      if (battleType === 'PREDICTION') {
        const resultDelta =
          Number(b.isResultMatch) - Number(a.isResultMatch);
        if (resultDelta !== 0) {
          return resultDelta;
        }
      }

      const voteDelta = Number(b.votes || 0) - Number(a.votes || 0);
      if (voteDelta !== 0) {
        return voteDelta;
      }

      const likeDelta = Number(b.likes || 0) - Number(a.likes || 0);
      if (likeDelta !== 0) {
        return likeDelta;
      }

      return Number(b.percentage || 0) - Number(a.percentage || 0);
    })
    .map((option, index) => ({
      ...option,
      rank: index + 1,
      highlight:
        option.isResultMatch && battleType === 'PREDICTION'
          ? 'Actual result'
          : index === 0
            ? 'Winner'
            : '',
    }));

  const winningOption = rankedOptions[0] || null;
  const stake = Number(
    pickFirst(
      normalizedBattle.stake,
      normalizedBattle.stakeAmount,
      normalizedBattle.pot,
      0,
    ),
  );
  const winnerPoints = stake || Math.max(Number(winningOption?.votes || 0), 1) * 10;
  const bonusPoints = Math.max(Math.round(winnerPoints * 0.2), 20);
  const winnerName = pickFirst(
    normalizedBattle.winnerName,
    normalizedBattle.winner?.name,
    normalizedBattle.winner?.displayName,
    normalizedBattle.winner?.userName,
    winningOption?.label,
    'Battle Winner',
  );
  const winningSide = pickFirst(resultValue, winningOption?.label, 'Pending');

  return {
    title: pickFirst(
      normalizedBattle.title,
      normalizedBattle.question,
      'Battle Results',
    ),
    description: pickFirst(
      normalizedBattle.description,
      normalizedBattle.caption,
      '',
    ),
    endedAt: formatBattleTime(
      pickFirst(normalizedBattle.endTime, normalizedBattle.endsAt, ''),
    ),
    formatLabel: format === 'HEAD_TO_HEAD' ? 'Head-to-Head' : 'Battle Poll',
    modeLabel:
      battleType === 'PREDICTION' || format === 'POLL'
        ? 'Prediction'
        : 'Opinion',
    winner: winnerName,
    winningSide,
    winnerPoints: formatCount(winnerPoints),
    bonusPoints: formatCount(bonusPoints),
    totalReward: formatCount(winnerPoints + bonusPoints),
    totalVotes: formatCount(totalVotes),
    totalComments: formatCount(totalComments),
    stake: formatCount(stake),
    winnerLogic:
      battleType === 'PREDICTION'
        ? 'The actual result ranks first, then engagement breaks ties between sides.'
        : 'Votes lead the result, then likes and argument engagement settle close battles.',
    actualResultText:
      battleType === 'PREDICTION' && resultValue
        ? `Actual result: ${resultValue}`
        : '',
    options: rankedOptions,
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
      surface: card || '#FFFFFF',
      muted: withAlpha(primary, 'A8'),
      soft: withAlpha(primary, '10'),
      softBorder: withAlpha(primary, '20'),
      warm: '#FFC778',
      warmSoft: '#FFF4D9',
      warmText: '#97591A',
      whiteSoft: 'rgba(255,255,255,0.16)',
    };
  }, [card, text]);

  const heroStats = useMemo(
    () => [
      { label: 'Votes', value: resultData.totalVotes },
      { label: 'Comments', value: resultData.totalComments },
      { label: 'Stake', value: resultData.stake },
    ],
    [resultData.stake, resultData.totalComments, resultData.totalVotes],
  );

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
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.metaRow}>
          <Text style={[styles.metaLabel, { color: palette.muted }]}>
            Battle concluded
          </Text>
          <Text style={[styles.metaTime, { color: palette.muted }]}>
            {resultData.endedAt}
          </Text>
        </View>

        <Text style={[styles.prompt, { color: text }]}>{resultData.title}</Text>
        {!!resultData.description && (
          <Text style={[styles.description, { color: palette.muted }]}>
            {resultData.description}
          </Text>
        )}
        <Text style={[styles.logicText, { color: palette.muted }]}>
          {resultData.winnerLogic}
        </Text>

        <View style={styles.heroCardShadow}>
          <LinearGradient
            colors={[palette.secondary, palette.primary, palette.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.resultCard}
          >
            <View style={styles.heroTopRow}>
              <View style={styles.heroChipRow}>
                <View style={[styles.heroChip, { backgroundColor: palette.whiteSoft }]}>
                  <Text style={styles.heroChipText}>RESULT</Text>
                </View>
                <View style={[styles.heroChip, { backgroundColor: 'rgba(0,0,0,0.14)' }]}>
                  <Text style={styles.heroChipText}>{resultData.formatLabel}</Text>
                </View>
              </View>
              <View
                style={[
                  styles.heroModePill,
                  { backgroundColor: withAlpha('#FFFFFF', '2A') },
                ]}
              >
                <Text style={styles.heroModeText}>{resultData.modeLabel}</Text>
              </View>
            </View>

            <View style={styles.winnerRow}>
              <View
                style={[
                  styles.trophyWrap,
                  { backgroundColor: withAlpha('#FFFFFF', '2A') },
                ]}
              >
                <Ionicons name="trophy-outline" size={30} color={palette.warm} />
              </View>
              <View style={styles.winnerCopy}>
                <Text style={styles.winnerLabel}>Winner</Text>
                <Text style={styles.winnerName}>{resultData.winner}</Text>
                <Text style={styles.winnerSubText}>
                  Winning side: {resultData.winningSide}
                </Text>
              </View>
            </View>

            <View style={styles.heroStatsRow}>
              {heroStats.map(item => (
                <View key={item.label} style={styles.heroStatCard}>
                  <Text style={styles.heroStatLabel}>{item.label}</Text>
                  <Text style={styles.heroStatValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>

        <View
          style={[
            styles.surfaceCard,
            { backgroundColor: palette.surface, shadowColor: palette.primary },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: text }]}>
              Leaderboard
            </Text>
            <Text style={[styles.sectionMeta, { color: palette.muted }]}>
              {resultData.options.length > 0
                ? `${resultData.options.length} sides`
                : 'No sides yet'}
            </Text>
          </View>

          {resultData.options.length > 0 ? (
            resultData.options.map(option => (
              <View
                key={option.id}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: withAlpha(option.color, '12'),
                    borderColor: withAlpha(option.color, '22'),
                  },
                ]}
              >
                <View style={styles.optionTopRow}>
                  <View style={styles.optionTitleWrap}>
                    <View
                      style={[
                        styles.optionRankBadge,
                        { backgroundColor: option.color },
                      ]}
                    >
                      <Text style={styles.optionRankText}>{option.rank}</Text>
                    </View>
                    <View style={styles.optionLabelBlock}>
                      <Text style={[styles.optionName, { color: text }]}>
                        {option.label}
                      </Text>
                      <Text style={[styles.optionMetaText, { color: palette.muted }]}>
                        {formatCount(option.votes)} votes • {formatCount(option.likes)} likes
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.optionPercent, { color: text }]}>
                    {option.percentage}%
                  </Text>
                </View>

                <View
                  style={[
                    styles.optionBarTrack,
                    { backgroundColor: withAlpha(option.color, '24') },
                  ]}
                >
                  <View
                    style={[
                      styles.optionBarFill,
                      {
                        backgroundColor: option.color,
                        width: `${Math.min(
                          Math.max(option.percentage, option.votes > 0 ? 8 : 0),
                          100,
                        )}%`,
                      },
                    ]}
                  />
                </View>

                {!!option.highlight && (
                  <View
                    style={[
                      styles.optionHighlight,
                      { backgroundColor: withAlpha(option.color, '18') },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionHighlightText,
                        { color: option.color },
                      ]}
                    >
                      {option.highlight}
                    </Text>
                  </View>
                )}
              </View>
            ))
          ) : (
            <Text style={[styles.emptyStateText, { color: palette.muted }]}>
              No result data has been passed to this screen yet.
            </Text>
          )}
        </View>

        <View
          style={[
            styles.surfaceCard,
            { backgroundColor: palette.surface, shadowColor: palette.primary },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: text }]}>
            Reward Snapshot
          </Text>
          <View style={styles.rewardRow}>
            <View
              style={[
                styles.rewardStatCardLeft,
                styles.rewardStatCard,
                { backgroundColor: palette.soft, borderColor: palette.softBorder },
              ]}
            >
              <Text style={[styles.rewardStatLabel, { color: palette.muted }]}>
                Total Reward
              </Text>
              <Text style={[styles.rewardPrimaryValue, { color: text }]}>
                {resultData.totalReward}
              </Text>
            </View>
            <View
              style={[
                styles.rewardStatCard,
                {
                  backgroundColor: palette.warmSoft,
                  borderColor: withAlpha('#D6A23A', '35'),
                },
              ]}
            >
              <Text style={[styles.rewardStatLabel, { color: palette.warmText }]}>
                Bonus Points
              </Text>
              <Text style={[styles.rewardWarmValue, { color: palette.warmText }]}>
                {resultData.bonusPoints}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.surfaceCard,
            { backgroundColor: palette.surface, shadowColor: palette.primary },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: text }]}>
            Result Logic
          </Text>
          <Text style={[styles.infoText, { color: palette.muted }]}>
            {resultData.winnerLogic}
          </Text>

          {!!resultData.actualResultText && (
            <View
              style={[
                styles.actualResultChip,
                { backgroundColor: withAlpha(palette.primary, '10') },
              ]}
            >
              <Ionicons name="sparkles-outline" size={14} color={palette.primary} />
              <Text
                style={[
                  styles.actualResultText,
                  { color: palette.primary },
                ]}
              >
                {resultData.actualResultText}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    marginTop: Platform.OS === 'android' ? '10%' : 0,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  metaTime: {
    fontSize: 11,
    fontWeight: '600',
  },
  prompt: {
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 32,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  logicText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 10,
    marginBottom: 16,
  },
  heroCardShadow: {
    width: '100%',
    borderRadius: 26,
    marginBottom: 16,
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
        }
      : {
          elevation: 6,
        }),
  },
  resultCard: {
    borderRadius: 26,
    width:'100%',
    height:300,
    padding:10
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  heroChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
    marginRight: 12,
  },
  heroChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  heroChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroModePill: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
   marginRight:20,
  },
  heroModeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  winnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  trophyWrap: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  winnerCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
  },
  winnerLabel: {
    color: '#E8DCFF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  winnerName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  winnerSubText: {
    color: '#F5ECFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 4,
  },
  heroStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginRight:20,
  },
  heroStatCard: {
    width: '31%',
    minWidth: 92,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  heroStatLabel: {
    color: '#E9DEFF',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroStatValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
   
  },
  surfaceCard: {
    marginTop: 14,
    borderRadius: 22,
    padding: 16,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionMeta: {
    fontSize: 12,
    fontWeight: '700',
  },
  optionCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  optionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  optionRankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  optionRankText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  optionLabelBlock: {
    flex: 1,
    minWidth: 0,
  },
  optionName: {
    fontSize: 15,
    fontWeight: '800',
  },
  optionMetaText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  optionPercent: {
    fontSize: 18,
    fontWeight: '900',
  },
  optionBarTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 12,
  },
  optionBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  optionHighlight: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 10,
  },
  optionHighlightText: {
    fontSize: 11,
    fontWeight: '800',
  },
  emptyStateText: {
    fontSize: 14,
    lineHeight: 21,
  },
  rewardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  rewardStatCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  rewardStatCardLeft: {
    marginRight: 10,
  },
  rewardStatLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  rewardPrimaryValue: {
    fontSize: 26,
    fontWeight: '900',
  },
  rewardWarmValue: {
    fontSize: 26,
    fontWeight: '900',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
  },
  actualResultChip: {
    marginTop: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actualResultText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
});
