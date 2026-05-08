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
    normalizedStatus.includes('RESOLVED') ||
    normalizedStatus.includes('FINISH') ||
    normalizedStatus.includes('CLOSED') ||
    normalizedStatus.includes('RESULT');
  const statusBadgeLabel = isLiveStatus
    ? 'LIVE BATTLE'
    : isFinishedStatus
      ? 'FINISHED BATTLE'
      : 'BATTLE OPEN';
  const statusBadgeColor = isLiveStatus
    ? '#22C55E'
    : isFinishedStatus
      ? '#9CA3AF'
      : '#60A5FA';
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

  const winnerText =
    normalizedStatus === 'RESOLVED'
      ? 'Winner Declared'
      : isLiveStatus
        ? 'Battle Ongoing'
        : 'Battle Closed';
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
        // Call both APIs together
        const [winnerRes, profileRes] = await Promise.all([
          battleId ? battleWinner(battleId) : null,
          winnerUserId ? getUserCredentials(winnerUserId) : null,
        ]);

        // Handle winner API
        if (active && winnerRes) {
          setWinnerData(winnerRes?.data || winnerRes);
        }

        // Handle profile API
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
              'Winning User',
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
          <View style={styles.headerIconBtn} />
        </View>

        <Text style={[styles.meta, { color: palette.muted }]}>
          Ends: {endedAt ? new Date(endedAt).toLocaleString() : 'Not available'}
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
        {status === "RESOLVED" &&
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
                  // <Image
                  //   source={
                  //     winnerProfile?.image
                  //       ? { uri: winnerProfile.image }
                  //       : require('../../assets/icons/pngicons/user.png')
                  //   }
                  //   defaultSource={require('../../assets/icons/pngicons/user.png')}
                  //   style={styles.winnerAvatar}
                  // />
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
                    Winning User
                  </Text>
                  <Text style={[styles.winnerProfileName, { color: text }]}>
                    {winnerProfile?.name || 'Winning User'}
                  </Text>

                  {!!winningSide && (
                    <Text
                      style={[styles.winnerProfileMeta, { color: palette.muted }]}
                    >
                      Side: {winningSide}
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
                      Points Earned
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
          <View
            style={[
              styles.heroIconWrap,
              { backgroundColor: palette.whiteSoft },
            ]}
          >
            <Ionicons name="trophy-outline" size={34} color={palette.warm} />
          </View>

          <View style={styles.metaPillsRow}>
            <View
              style={[
                styles.liveStatusPill,
                { backgroundColor: withAlpha(statusBadgeColor, '2E') },
              ]}
            >
              <Animated.View
                style={[
                  styles.liveStatusDot,
                  {
                    opacity: isLiveStatus ? livePulseAnim : 1,
                    backgroundColor: statusBadgeColor,
                  },
                ]}
              />
              <Text style={[styles.liveStatusText, { color: statusBadgeColor }]}>
                {statusBadgeLabel}
              </Text>
            </View>

            <View style={styles.stakePill}>
              <Ionicons name="flash" size={11} color="#7F77DD" />
              <Text style={styles.stakeText}>
                Stakes: <Text style={styles.stakeAmount}>{formatStakeAmount(stake)}</Text>
              </Text>
            </View>
          </View>

          <Text style={styles.winner}>{winnerText}</Text>
          <Text style={styles.sub}>{participants} participants</Text>
          {status === "RESOLVED" && (
            <>
              {winningSide && (
                <Text style={styles.sub}>
                  Winning side: {winningSide}
                </Text>
              )}

              {/* {winnerUserId && (
                <Text style={styles.sub}>
                  Winner user: {String(winnerUserId).slice(0, 8)}
                </Text>
              )} */}
            </>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Text style={styles.statLabel}>Votes</Text>
              <Text style={styles.statValue}>{totalVotes}</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statLabel}>Comments</Text>
              <Text style={styles.statValue}>{totalComments}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* {isPollFormat && ( */}
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
          <Text style={[styles.section, { color: text }]}>Battle Options</Text>

          {options.length === 0 && (
            <Text style={[styles.metaText, { color: palette.muted }]}>
              No options available
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
                      {voteTotal} votes
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
        {/* )} */}
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
    borderRadius: 24,
    padding: 18,
    marginVertical: 12,
    overflow: 'hidden',
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
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  liveStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
    gap: 6,
  },
  metaPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  liveStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveStatusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  stakePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#F5F1FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stakeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5B5860',
  },
  stakeAmount: {
    fontWeight: '700',
    color: '#7F77DD',
  },
  winner: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  sub: {
    color: '#E9DEFF',
    marginTop: 4,
    marginBottom: 14,
    fontSize: 14,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    flexWrap: 'wrap',
    marginBottom: '10%'
  },
  statChip: {
    width: '31%',
    minWidth: 92,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  statLabel: {
    color: '#E9DEFF',
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
