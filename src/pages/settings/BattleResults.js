import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
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
import { getUserCredentials } from '../../services/post';
import { useAppTheme } from '../../theme/useApptheme';
import { normalizeProfileType } from '../../utils/supportEligibility';
import { battleWinner } from '../../services/battle';
import HexAvatar from '../../components/home/story.js/HexAvatar';
import trophyPng from '../../assets/icons/pngicons/trophy.png';
import { useLanguage } from '../../i18n';

const withAlpha = (hex, alpha) => {
  if (typeof hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return `${hex}${alpha}`;
  }
  return hex;
};

const normalizeCountKey = value => String(value || '').trim().toLowerCase();

const findCountByFlexibleKey = (countsMap, rawLabel) => {
  const normalizedLabel = normalizeCountKey(rawLabel);

  if (!normalizedLabel) {
    return undefined;
  }

  if (countsMap?.[normalizedLabel] !== undefined) {
    return countsMap[normalizedLabel];
  }

  const entries = Object.entries(countsMap || {});
  const partialMatch = entries.find(([key]) => {
    return (
      key.includes(normalizedLabel) ||
      normalizedLabel.includes(key)
    );
  });

  return partialMatch ? partialMatch[1] : undefined;
};

const formatStakeAmount = value => {
  const parsed = Number(value);
  const safeValue = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  return safeValue.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
};

export default function BattleResults({ navigation }) {
  const route = useRoute();
  const { t } = useLanguage();
  const resolvedProfileType = normalizeProfileType(route?.params?.profile);
  const { bgStyle, text, card } = useAppTheme(resolvedProfileType);
  const { battle = {} } = route.params || {};
  const [winnerData, setWinnerData] = useState(null);
  console.log(battle, 'data in battle from prevois screenen')
  const predictionCounts =
    route?.params?.predictionCounts || battle?.predictionCounts || {};

  const winnerUserId =
    route?.params?.winnerUserId || battle?.winnerUserId || '';
  const winningSide =
    route?.params?.winningSide || battle?.winningSide || '';
  const optionVoteCount = route?.params?.optionVoteCount || battle?.optionVoteCount || {};
  const [winnerProfile, setWinnerProfile] = useState(null);
  const [winnerLoading, setWinnerLoading] = useState(false);
  const livePulseAnim = useState(() => new Animated.Value(1))[0];
  const battleId = battle?.id || battle?.battleId || route?.params?.battleId || '';
  const title = battle.title || 'Battle';
  const description = battle.question || '';
  const endedAt = battle.endTime || '';
  const totalVotes = battle.totalVotes || 0;

  const totalComments = battle.totalComments || 0;
  const stake = battle.stake || 0;
  const options = battle.options || [];
  const comments = battle.comments || [];
  const status = battle.status || 'LIVE';
  const normalizedStatus = String(status || '').trim().toUpperCase();
  const isLiveStatus =
    normalizedStatus.includes('LIVE') || normalizedStatus.includes('PROGRESS');
  const isFinishedStatus =
    normalizedStatus.includes('FINISH') ||
    normalizedStatus.includes('CLOSED') ||
    normalizedStatus.includes('RESULT');
  const isResolvedStatus =
    normalizedStatus === 'RESOLVED' || normalizedStatus.includes('RESOLVED');
  const endedByTime = useMemo(() => {
    if (!endedAt) {
      return false;
    }
    const parsed = new Date(endedAt);
    return !Number.isNaN(parsed.getTime()) && parsed.getTime() <= Date.now();
  }, [endedAt]);
  const heroStatus = useMemo(() => {
    if (isResolvedStatus) {
      return {
        badgeLabel: t('battleInProgress.statusResult'),
        badgeTone: '#FFD184',
        headline: t('battleResults.winnerDeclared'),
      };
    }
    if (isLiveStatus) {
      return {
        badgeLabel: t('battleInProgress.statusLive'),
        badgeTone: '#86EFAC',
        headline: t('battleResults.battleOngoing'),
      };
    }
    if (isFinishedStatus || endedByTime) {
      return {
        badgeLabel: t('battleInProgress.statusFinished'),
        badgeTone: '#F5F0E6',
        headline: t('battleResults.battleClosed'),
      };
    }
    return {
      badgeLabel: t('battleInProgress.statusOpen'),
      badgeTone: '#FFF3D0',
      headline: t('battleResults.battleOpen'),
    };
  }, [
    endedByTime,
    isFinishedStatus,
    isLiveStatus,
    isResolvedStatus,
    t,
  ]);
  const battleFormat = String(battle.format || '').toUpperCase().trim();
  const isPollFormat = battleFormat === 'POLL';
  const participants = battle.primaryCount || 0;
  const normalizedPredictionCounts = useMemo(() => {
    return Object.entries(predictionCounts || {}).reduce((acc, [key, value]) => {
      acc[normalizeCountKey(key)] = Number(value) || 0;
      return acc;
    }, {});
  }, [predictionCounts]);
  const normalizedOptionVoteCount = useMemo(() => {
    return Object.entries(optionVoteCount || {}).reduce((acc, [key, value]) => {
      acc[normalizeCountKey(key)] = Number(value) || 0;
      return acc;
    }, {});
  }, [optionVoteCount]);
  const getOptionVotes = item => {
    const predictionMappedVotes = findCountByFlexibleKey(
      normalizedPredictionCounts,
      item?.label,
    );

    if (predictionMappedVotes !== undefined && predictionMappedVotes !== null) {
      return Number(predictionMappedVotes) || 0;
    }

    const mappedVotes = findCountByFlexibleKey(
      normalizedOptionVoteCount,
      item?.label,
    );

    if (mappedVotes !== undefined && mappedVotes !== null) {
      return Number(mappedVotes) || 0;
    }

    return Number(item?.votes || 0);
  };
  const derivedPredictionTotal = useMemo(
    () =>
      Object.values(predictionCounts || {}).reduce(
        (sum, value) => sum + (Number(value) || 0),
        0,
      ),
    [predictionCounts],
  );
  const derivedOptionVoteTotal = useMemo(
    () => options.reduce((sum, item) => sum + getOptionVotes(item), 0),
    [options, normalizedPredictionCounts, normalizedOptionVoteCount],
  );
  const resolvedTotalVotes = Math.max(
    Number(totalVotes) || 0,
    derivedPredictionTotal,
    derivedOptionVoteTotal,
  );
  const getPercent = votes => {
    if (!resolvedTotalVotes) return 0;
    return Math.round((votes / resolvedTotalVotes) * 100);
  };

  const palette = useMemo(() => {
    const primary = text || '#5a2d82';
    const secondary =
      primary.toLowerCase() === '#d3b683' ? '#b8924f' : '#8f54f7';

    return {
      primary,
      secondary,
      surface: card || '#FFFFFF',
      muted: withAlpha(primary, 'A6'),
      soft: withAlpha(primary, '10'),
      softBorder: withAlpha(primary, '24'),
      whiteSoft: 'rgba(255,255,255,0.14)',
      warm: '#ffd184',
      track: withAlpha(primary, '18'),
    };
  }, [card, text]);

  useEffect(() => {
    if (!isLiveStatus) {
      livePulseAnim.setValue(1);
      return undefined;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulseAnim, {
          toValue: 0.35,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(livePulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    return () => pulse.stop();
  }, [isLiveStatus, livePulseAnim]);

  useEffect(() => {
    let active = true;

    const loadWinnerProfile = async () => {
      if (!winnerUserId) {
        if (active) {
          setWinnerProfile(null);
        }
        return;
      }

      setWinnerLoading(true);
      try {
        const response = await getUserCredentials(winnerUserId);
        const user =
          response?.data?.user ||
          response?.data?.data ||
          response?.data ||
          {};

        if (!active) {
          return;
        }

        setWinnerProfile({
          name:
            user?.name ||
            user?.fullName ||
            user?.displayName ||
            user?.userName ||
            user?.username ||
            'Winning User',
          image:
            user?.image ||
            user?.avatar ||
            user?.profilePic ||
            user?.profilePicture ||
            '',
        });
      } catch (_error) {
        if (active) {
          setWinnerProfile(null);
        }
      } finally {
        if (active) {
          setWinnerLoading(false);
        }
      }
    };

    loadWinnerProfile();

    return () => {
      active = false;
    };
  }, [winnerUserId]);
  const getWinner = async () => {
    if (!battleId) {
      return;
    }

    try {
      const response = await battleWinner(battleId);
      console.log(response, 'battle winner response');
      setWinnerData(response?.data || response);
    } catch (err) {
      console.log(err, 'erro here in this api ')
    }
  }
  useEffect(() => {
    getWinner();
  }, [battleId]);
  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      if (!battleId && !winnerUserId) return;

      setWinnerLoading(true);

      try {
        const [winnerRes, profileRes] = await Promise.all([
          battleId ? battleWinner(battleId) : null,
          winnerUserId ? getUserCredentials(winnerUserId) : null,
        ]);

        if (active && winnerRes) {
          setWinnerData(winnerRes?.data || winnerRes);
        }

        if (active && profileRes) {
          const user =
            profileRes?.data?.user ||
            profileRes?.data?.data ||
            profileRes?.data ||
            {};

          setWinnerProfile({
            name:
              user?.name ||
              user?.fullName ||
              user?.displayName ||
              user?.userName ||
              user?.username ||
              t('battleResults.winningUser'),
            image:
              user?.image ||
              user?.avatar ||
              user?.profilePic ||
              user?.profilePicture ||
              '',
          });
        }
      } catch (err) {
        console.log('Error fetching battle data:', err);
      } finally {
        if (active) setWinnerLoading(false);
      }
    };

    fetchData();

    return () => {
      active = false;
    };
  }, [battleId, winnerUserId]);

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <ScrollView
        style={[styles.scrollView, bgStyle]}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerIconBtn}
          >
            <Icon name="arrow-back-ios-new" size={20} color={text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: text }]}>
            {t('battleResults.headerTitle')}
          </Text>
          <View style={styles.headerIconBtn} />
        </View>

        <Text style={[styles.meta, { color: palette.muted }]}>
          {endedByTime || isFinishedStatus || isResolvedStatus
            ? t('battleResults.metaEnded')
            : t('battleResults.metaEnds')}{' '}
          {endedAt
            ? new Date(endedAt).toLocaleString()
            : t('battleResults.metaNotAvailable')}
        </Text>

        <Text style={[styles.title, { color: text }]}>{title}</Text>
        {!!description && (
          <Text style={[styles.desc, { color: palette.muted }]}>
            {description}
          </Text>
        )}

        {/* Creator row */}
        {!!battle.creator && (
          <TouchableOpacity
            activeOpacity={0.75}
            style={styles.creatorRow}
            onPress={() => {
              const creatorId = battle.creatorId || battle.creator?.id || '';
              if (!creatorId) return;
              navigation.navigate('HomeMain', {
                screen: 'UsersProfile',
                params: { userId: creatorId },
              });
            }}
          >
            <HexAvatar
              uri={battle.creator?.avatar || battle.creator?.image || ''}
              size={28}
              borderWidth={2}
              borderColor={text}
            />
            <View style={{ marginLeft: 8, flexShrink: 1 }}>
              <Text style={[styles.creatorName, { color: text }]} numberOfLines={1}>
                {battle.creator?.name || battle.creator?.displayName || battle.creator?.userName || ''}
              </Text>
              {!!(battle.creator?.handle || battle.creator?.userName) && (
                <Text style={[styles.creatorHandle, { color: palette.muted }]} numberOfLines={1}>
                  @{battle.creator?.handle || battle.creator?.userName}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}

        {/* Winner Profile Card */}
        {isResolvedStatus &&
          (winnerUserId || winnerLoading || winnerProfile) && (
            <View
              style={[
                styles.winnerProfileCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.softBorder,
                  shadowColor: palette.primary,
                },
              ]}
            >
              <View style={styles.winnerProfileRow}>
                {winnerLoading ? (
                  <View
                    style={[
                      styles.winnerAvatarFallback,
                      { backgroundColor: palette.soft },
                    ]}
                  >
                    <ActivityIndicator size="small" color={palette.primary} />
                  </View>
                ) : (
                  <HexAvatar
                    uri={winnerProfile?.image || require('../../assets/icons/pngicons/user.png')}
                    size={60}
                    borderWidth={1.5}
                    borderColor={text}
                  />
                )}

                <View style={styles.winnerProfileTextWrap}>
                  <Text
                    style={[styles.winnerProfileLabel, { color: palette.muted }]}
                  >
                    {t('battleResults.winningUser')}
                  </Text>
                  <Text style={[styles.winnerProfileName, { color: text }]}>
                    {winnerProfile?.name || t('battleResults.winningUser')}
                  </Text>

                  {!!winningSide && (
                    <Text
                      style={[styles.winnerProfileMeta, { color: palette.muted }]}
                    >
                      {t('battleResults.sideLabel')} {winningSide}
                    </Text>
                  )}
                  <View
                    style={[
                      styles.pointsContainer,
                      {
                        backgroundColor: palette.soft,
                        borderColor: palette.softBorder,
                      },
                    ]}
                  >
                    <Text style={[styles.pointsLabel, { color: palette.muted }]}>
                      {t('battleResults.pointsEarned')}
                    </Text>
                    <Text style={[styles.pointsValue, { color: palette.primary }]}>
                      {winnerData?.points || 0}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.trophyWrap}>
                <Image
                  source={trophyPng}
                  style={styles.trophyPng}
                  resizeMode="contain"
                />
              </View>
            </View>
          )}

        {/* Hero Banner */}
        <LinearGradient
          colors={[palette.secondary, palette.primary, palette.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View
            style={[
              styles.heroGlow,
              { backgroundColor: withAlpha('#FFFFFF', '14') },
            ]}
          />

          <View style={styles.heroTopRow}>
            <View
              style={[
                styles.heroIconWrap,
                { backgroundColor: palette.whiteSoft },
              ]}
            >
              <Ionicons name="trophy-outline" size={28} color={palette.warm} />
            </View>

            <View style={styles.metaPillsRow}>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: withAlpha(heroStatus.badgeTone, '33') },
                ]}
              >
                <Animated.View
                  style={[
                    styles.statusDot,
                    {
                      opacity: isLiveStatus ? livePulseAnim : 1,
                      backgroundColor: heroStatus.badgeTone,
                    },
                  ]}
                />
                <Text style={[styles.statusPillText, { color: heroStatus.badgeTone }]}>
                  {heroStatus.badgeLabel}
                </Text>
              </View>

              <View style={styles.stakePill}>
                <Ionicons name="flash" size={11} color={palette.warm} />
                <Text style={styles.stakeText}>
                  {t('battleResults.stakesLabel')}{' '}
                  <Text style={styles.stakeAmount}>{formatStakeAmount(stake)}</Text>
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.heroHeadline}>{heroStatus.headline}</Text>
          <Text style={styles.heroSubline}>
            {participants.toLocaleString()} {t('battleResults.participants')}
            {isPollFormat ? ` · ${t('battleInProgress.formatPoll')}` : ''}
          </Text>

          {isResolvedStatus && !!winningSide && (
            <Text style={styles.heroSubline}>
              {t('battleResults.winningSideLabel')} {winningSide}
            </Text>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{t('battleResults.statsVotes')}</Text>
              <Text style={styles.statValue}>
                {resolvedTotalVotes.toLocaleString()}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{t('battleResults.statsComments')}</Text>
              <Text style={styles.statValue}>
                {Number(totalComments).toLocaleString()}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Battle Options Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.surface,
              borderColor: palette.softBorder,
              shadowColor: palette.primary,
            },
          ]}
        >
          <Text style={[styles.section, { color: text }]}>
            {t('battleResults.battleOptions')}
          </Text>

          {options.length === 0 && (
            <Text style={[styles.metaText, { color: palette.muted }]}>
              {t('battleResults.noOptionsAvailable')}
            </Text>
          )}

          {options.map(item => (
            <View
              key={item.id}
              style={[
                styles.option,
                {
                  backgroundColor: palette.soft,
                  borderColor: palette.softBorder,
                },
              ]}
            >
              {(() => {
                const voteTotal = getOptionVotes(item);
                const percent = getPercent(voteTotal);

                return (
                  <>
                    <View style={styles.optionRow}>
                      <Text style={[styles.optionTitle, { color: text }]}>
                        {item.label}
                      </Text>
                      <Text style={[styles.optionPercent, { color: text }]}>
                        {percent}%
                      </Text>
                    </View>

                    <Text style={[styles.metaText, { color: palette.muted }]}>
                      {voteTotal} {t('battleResults.votesLabel')}
                    </Text>

                    <View
                      style={[styles.progressBg, { backgroundColor: palette.track }]}
                    >
                      <View
                        style={[
                          styles.progressFill,
                          {
                            backgroundColor: palette.primary,
                            width: `${Math.min(
                              Math.max(percent, voteTotal > 0 ? 8 : 0),
                              100,
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                  </>
                );
              })()}
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
    marginTop: Platform.OS === 'android' ? '10%' : 0,
    marginBottom: '10%'
  },
  scrollView: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 32,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  creatorName: {
    fontSize: 13,
    fontWeight: '700',
  },
  creatorHandle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  meta: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 32,
  },
  desc: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 14,
  },
  winnerProfileCard: {
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 2,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  winnerProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  winnerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  winnerAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  winnerProfileTextWrap: {
    flex: 1,
    marginLeft: 10,
  },
  winnerProfileLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  winnerProfileName: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  winnerProfileMeta: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  hero: {
    borderRadius: 20,
    padding: 16,
    marginVertical: 12,
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  heroGlow: {
    position: 'absolute',
    top: -24,
    right: -10,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaPillsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 2,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  stakePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  stakeText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
  },
  stakeAmount: {
    fontWeight: '800',
    color: '#FFE8B8',
  },
  heroHeadline: {
    fontSize: 24,
    lineHeight: 30,
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  heroSubline: {
    color: 'rgba(255,255,255,0.82)',
    marginTop: 6,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  statBox: {
    flex: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.26)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  card: {
    padding: 16,
    borderRadius: 22,
    marginTop: 12,
    borderWidth: 1,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  section: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  option: {
    marginBottom: 12,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionTitle: {
    fontWeight: '800',
    fontSize: 15,
  },
  optionPercent: {
    fontSize: 18,
    fontWeight: '900',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  progressBg: {
    height: 8,
    borderRadius: 999,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  reward: {
    fontSize: 28,
    fontWeight: '900',
  },
  comment: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
  },
  commentName: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  commentMessage: {
    fontSize: 13,
    lineHeight: 20,
  },
  pointsContainer: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pointsLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  pointsValue: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  trophyWrap: {
    position: 'absolute',
    right: 10,
    marginLeft: 10,
    top: 20,
    elevation: 10,

  },
  trophyPng: {
    width: 110,
    height: 110,
  },
});
