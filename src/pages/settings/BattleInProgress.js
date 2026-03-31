import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  commentBattle,
  commentLike,
  commentUpload,
  getbattle,
  predictBattle,
  voteBattle,
} from '../../services/battle';
import { useAppTheme } from '../../theme/useApptheme';

const PRIMARY_GRADIENT = ['#513189bd', '#e54ba0'];

const isMeaningfulValue = value => {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return (
      !!trimmed &&
      trimmed.toLowerCase() !== 'undefined' &&
      trimmed.toLowerCase() !== 'null'
    );
  }

  return true;
};

const pickFirst = (...values) => values.find(isMeaningfulValue);

const withAlpha = (hex, alpha) => {
  if (typeof hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return `${hex}${alpha}`;
  }
  return hex;
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

  const label = pickFirst(
    option?.side,
    option?.label,
    option?.text,
    option?.value,
    option?.name,
    option?.title,
    option?.option,
    `Option ${index + 1}`,
  );

  return {
    id: String(pickFirst(option?.id, option?._id, index)),
    label: String(label),
    side: String(label),
    votes: Number(
      pickFirst(option?.votes, option?.voteCount, option?._count?.votes, 0),
    ),
    likes: Number(pickFirst(option?.likes, option?.likeCount, 0)),
    percentage: Number(
      pickFirst(option?.percentage, option?.votePercentage, 0),
    ),
  };
};

const normalizeSideKey = value => String(value || '').trim().toLowerCase();

const buildSideMetrics = entries => {
  return (Array.isArray(entries) ? entries : []).reduce((acc, entry) => {
    const key = normalizeSideKey(
      pickFirst(entry?.side, entry?.label, entry?.option, ''),
    );

    if (!key) {
      return acc;
    }

    if (!acc[key]) {
      acc[key] = { count: 0, likes: 0 };
    }

    acc[key].count += 1;
    acc[key].likes += Number(
      pickFirst(
        entry?.likesCount,
        entry?.likeCount,
        Array.isArray(entry?.likes) ? entry.likes.length : undefined,
        0,
      ),
    );

    return acc;
  }, {});
};

const normalizeComment = (comment, index = 0) => ({
  id: String(pickFirst(comment?.id, comment?._id, index)),
  message: pickFirst(comment?.message, comment?.comment, comment?.text, ''),
  likes: Number(
    pickFirst(
      comment?.likes,
      comment?.likeCount,
      Array.isArray(comment?.likes) ? comment.likes.length : undefined,
      0,
    ),
  ),
  isLiked: Boolean(pickFirst(comment?.isLiked, comment?.likedByMe, false)),
  authorName: pickFirst(
    comment?.user?.name,
    comment?.user?.displayName,
    comment?.user?.userName,
    comment?.author?.name,
    comment?.authorName,
    'Valens User',
  ),
  authorHandle: pickFirst(
    comment?.user?.userName,
    comment?.user?.username,
    comment?.author?.userName,
    comment?.authorHandle,
    '',
  ),
  avatar: pickFirst(
    comment?.user?.avatar,
    comment?.user?.image,
    comment?.user?.profilePicture,
    comment?.author?.avatar,
    '',
  ),
  createdAt: pickFirst(comment?.createdAt, comment?.updatedAt, ''),
});

const normalizeBattle = raw => {
  const creatorChoice = pickFirst(
    raw?.creatorChoice,
    raw?.creatorLockedOption,
    '',
  );
  const creatorId = String(
    pickFirst(
      raw?.creatorId,
      raw?.createdById,
      raw?.creator?.id,
      raw?.creator?._id,
      '',
    ),
  );
  const invitedUserId = String(
    pickFirst(
      raw?.invitedUserId,
      raw?.invitedUser?.id,
      raw?.invitedUser?._id,
      '',
    ),
  );
  const status = String(
    pickFirst(raw?.status, raw?.battleStatus, 'OPEN'),
  ).toUpperCase();
  const battleType = String(
    pickFirst(raw?.battleType, raw?.type, 'OPINION'),
  ).toUpperCase();
  const format = String(pickFirst(raw?.format, 'POLL')).toUpperCase();
  const participantEntries = Array.isArray(raw?.participants)
    ? raw.participants
    : [];
  const predictionEntries = Array.isArray(raw?.predictions)
    ? raw.predictions
    : [];
  const voteEntries = Array.isArray(raw?.votes) ? raw.votes : [];
  const sideMetrics = buildSideMetrics(
    format === 'POLL'
      ? predictionEntries.length > 0
        ? predictionEntries
        : participantEntries
      : voteEntries.length > 0
      ? voteEntries
      : participantEntries,
  );
  const rawOptions = Array.isArray(raw?.options) ? raw.options : [];
  const fallbackSides = [
    pickFirst(raw?.creatorChoice, raw?.creatorLockedOption, ''),
    pickFirst(raw?.invitedUserChoice, ''),
  ].filter(Boolean);
  const derivedSides = Object.keys(sideMetrics);
  const baseOptions = rawOptions.length > 0 ? rawOptions : fallbackSides;
  const optionsSource =
    baseOptions.length > 0 ? baseOptions : derivedSides.length > 0 ? derivedSides : [];
  const comments = (Array.isArray(raw?.comments) ? raw.comments : []).map(
    normalizeComment,
  );
  const options = optionsSource.map((option, index) => {
    const normalizedOption = normalizeOption(option, index);
    const sideKey = normalizeSideKey(
      pickFirst(normalizedOption?.side, normalizedOption?.label, ''),
    );
    const metric = sideMetrics[sideKey] || { count: 0, likes: 0 };

    return {
      ...normalizedOption,
      votes: Number(
        pickFirst(normalizedOption?.votes, metric.count, 0),
      ),
      likes: Number(
        pickFirst(normalizedOption?.likes, metric.likes, 0),
      ),
    };
  });
  const calculatedTotalVotes = options.reduce(
    (sum, option) => sum + Number(option.votes || 0),
    0,
  );
  const totalVotes = Number(
    pickFirst(
      raw?.totalVotes,
      raw?.votesCount,
      format === 'HEAD_TO_HEAD' ? raw?._count?.votes : undefined,
      format === 'POLL' ? raw?._count?.participants : undefined,
      format === 'POLL' && participantEntries.length > 0
        ? participantEntries.length
        : undefined,
      format === 'POLL' && predictionEntries.length > 0
        ? predictionEntries.length
        : undefined,
      format === 'HEAD_TO_HEAD' && voteEntries.length > 0
        ? voteEntries.length
        : undefined,
      calculatedTotalVotes,
      0,
    ),
  );
  const normalizedOptions = options.map(option => ({
    ...option,
    percentage:
      totalVotes > 0
        ? Math.round((Number(option.votes || 0) / totalVotes) * 100)
        : Number(option.percentage || 0),
  }));

  return {
    id: String(pickFirst(raw?.id, raw?._id, raw?.battleId, '')),
    title: pickFirst(raw?.title, raw?.question, 'Untitled battle'),
    question: pickFirst(raw?.question, raw?.title, 'Untitled battle'),
    description: pickFirst(raw?.description, raw?.caption, ''),
    format,
    battleType,
    status,
    options: normalizedOptions,
    totalVotes,
    primaryCount: totalVotes,
    primaryCountLabel: format === 'HEAD_TO_HEAD' ? 'votes' : 'participants',
    totalComments: Number(
      pickFirst(raw?.totalComments, raw?._count?.comments, comments.length, 0),
    ),
    stake: Number(pickFirst(raw?.stakeAmount, raw?.stake, raw?.pot, 0)),
    endTime: pickFirst(raw?.endTime, raw?.endsAt, ''),
    creatorChoice,
    invitedUserChoice: String(pickFirst(raw?.invitedUserChoice, '')),
    creatorId,
    invitedUserId,
    resultValue: pickFirst(
      raw?.resultValue,
      raw?.actualResult,
      raw?.winningOption,
      '',
    ),
    winnerName: pickFirst(
      raw?.winner?.name,
      raw?.winner?.displayName,
      raw?.winner?.userName,
      raw?.winnerName,
      '',
    ),
    creator: {
      name: pickFirst(
        raw?.creator?.name,
        raw?.creator?.displayName,
        raw?.creator?.userName,
        'Creator',
      ),
      handle: pickFirst(raw?.creator?.userName, raw?.creator?.username, ''),
      avatar: pickFirst(
        raw?.creator?.avatar,
        raw?.creator?.image,
        raw?.creator?.profilePicture,
        '',
      ),
    },
    invitedUser: {
      name: pickFirst(
        raw?.invitedUser?.name,
        raw?.invitedUser?.displayName,
        raw?.invitedUser?.userName,
        'Opponent',
      ),
      handle: pickFirst(
        raw?.invitedUser?.userName,
        raw?.invitedUser?.username,
        '',
      ),
      avatar: pickFirst(
        raw?.invitedUser?.avatar,
        raw?.invitedUser?.image,
        raw?.invitedUser?.profilePicture,
        '',
      ),
    },
    comments,
  };
};

const formatBattleTime = value => {
  if (!value) return 'End time not set';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'End time not set';
  return parsed.toLocaleString();
};

const getStatusTone = status => {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('live') || normalized.includes('progress')) {
    return { label: 'LIVE', color: '#DC2626' };
  }
  if (
    normalized.includes('finish') ||
    normalized.includes('closed') ||
    normalized.includes('resolved')
  ) {
    return { label: 'FINISHED', color: '#4B5563' };
  }
  if (normalized.includes('result')) {
    return { label: 'RESULT', color: '#8B5CF6' };
  }
  return { label: 'OPEN', color: '#0F766E' };
};

const isSuccessfulResponse = response =>
  (typeof response?.status === 'number' &&
    response.status >= 200 &&
    response.status < 300) ||
  (typeof response?.statusCode === 'number' &&
    response.statusCode >= 200 &&
    response.statusCode < 300) ||
  response?.success === true ||
  response?.error === false;

export default function BattleInProgress() {
  const navigation = useNavigation();
  const route = useRoute();
  const { bgStyle, text, card } = useAppTheme();
  const routeBattle = route?.params?.battle || {};
  const battleId =
    route?.params?.battleId ||
    routeBattle.id ||
    routeBattle._id ||
    routeBattle.battleId ||
    '';

  const [currentUserId, setCurrentUserId] = useState('');
  const [battle, setBattle] = useState(() => normalizeBattle(routeBattle));
  const [selectedOption, setSelectedOption] = useState(
    () => String(route?.params?.selectedOption || ''),
  );
  const [argumentText, setArgumentText] = useState('');
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [likingCommentId, setLikingCommentId] = useState('');

  const palette = useMemo(() => {
    const primary = text || '#5a2d82';
    const secondary =
      primary.toLowerCase() === '#d3b683' ? '#b8924f' : '#8f54f7';
    return {
      primary,
      secondary,
      surface: card || '#FFFFFF',
      textMuted: withAlpha(primary, '99'),
      border: '#ECE7F6',
      soft: '#F8FAFC',
    };
  }, [card, text]);

  const statusMeta = useMemo(
    () => getStatusTone(battle.status),
    [battle.status],
  );
  const isPrediction = battle.format === "POLL";
  const isHeadToHead = battle.format === 'HEAD_TO_HEAD';
  const resolvedBattleId = String(
    pickFirst(
      battle?.id,
      route?.params?.battleId,
      routeBattle.id,
      routeBattle._id,
      routeBattle.battleId,
      '',
    ),
  );
  const isCreator =
    currentUserId &&
    battle.creatorId &&
    currentUserId === String(battle.creatorId);

  const enforcedOpponentOption = useMemo(() => {
    if (!isHeadToHead || !battle.creatorChoice || battle.options.length < 2) {
      return '';
    }

    if (isCreator) {
      return '';
    }

    const opposite = battle.options.find(
      option => option.label !== battle.creatorChoice,
    );
    return opposite?.label || '';
  }, [battle.creatorChoice, battle.options, isCreator, isHeadToHead]);

  const availableOptions = useMemo(() => {
    if (!enforcedOpponentOption) {
      return battle.options;
    }
    return battle.options.filter(
      option => option.label === enforcedOpponentOption,
    );
  }, [battle.options, enforcedOpponentOption]);

  const fetchBattle = useCallback(
    async (isSilent = false) => {
      if (!battleId) {
        setLoading(false);
        return;
      }

      if (!isSilent) {
        setLoading(true);
      }

      try {
        const response = await getbattle({ params: { battleId } });
        console.log(response, 'battle detal heree ')
        const rawBattle =
          response?.data?.battle ||
          response?.data?.data ||
          response?.data ||
          response?.battle ||
          routeBattle;

        setBattle(normalizeBattle(rawBattle || routeBattle));
      } catch (error) {
        if (!routeBattle || !Object.keys(routeBattle).length) {
          Alert.alert(
            'Unable to load battle',
            error?.response?.data?.message ||
            error?.message ||
            'Please try again.',
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [battleId, routeBattle],
  );

  useEffect(() => {
    AsyncStorage.getItem('userId').then(value =>
      setCurrentUserId(String(value || '')),
    );
  }, []);

  useEffect(() => {
    fetchBattle();
  }, [fetchBattle]);

  useEffect(() => {
    if (enforcedOpponentOption) {
      setSelectedOption(enforcedOpponentOption);
    }
  }, [enforcedOpponentOption]);

  useEffect(() => {
    const routeSelectedOption = String(route?.params?.selectedOption || '');
    if (routeSelectedOption) {
      setSelectedOption(routeSelectedOption);
    }
  }, [route?.params?.selectedOption]);

  const handleVote = async () => {
    console.log('🔥 Vote button clicked 1');
    const finalBattleId = resolvedBattleId || battleId;
    const finalSelectedOption = String(selectedOption || enforcedOpponentOption);
    const trimmedArgument = argumentText.trim();

    if (!finalBattleId) {
      Alert.alert('Unable to vote', 'Battle information is missing.');
      return;
    }

    if (!finalSelectedOption) {
      Alert.alert(
        'Select an option',
        isPrediction
          ? 'Choose one option before submitting your prediction.'
          : 'Choose one side before voting in this battle.',
      );
      return;
    }

    const selectedBattleOption = battle.options.find(option => {
      const optionSide = String(pickFirst(option?.side, option?.label, ''));
      return (
        optionSide === finalSelectedOption ||
        String(option?.id || '') === finalSelectedOption
      );
    });

    let payload;
    console.log('🔥 Vote button clicked2');
    if (isPrediction) {
      payload = {
        battleId: resolvedBattleId,
        side: selectedOption, // "Yes" or "No"
        justification: trimmedArgument || 'No justification provided',
        sourceUrl: ''// optional (add input later if needed)
      };
      console.log('🔥 Vote button clicked4');
    } else {
      payload = {
        battleId: finalBattleId,
        optionId: String(selectedBattleOption?.id || ''),
        side: finalSelectedOption,
        argument: trimmedArgument,
      };
    }

    console.log('🔥 Vote button clicked3');
    setSubmittingVote(true);
    try {
      let response;

      if (isPrediction) {
        response = await predictBattle(payload);
      } else {
        response = await voteBattle(payload);
      }
      console.log(response, 'in postr polll')
      if (!isSuccessfulResponse(response)) {
        Alert.alert(
          isPrediction ? 'Prediction not submitted' : 'Vote not submitted',
          response?.message || 'Please try again.',
        );
        return;
      }

      setArgumentText('');
      await fetchBattle(true);
      Alert.alert(
        isPrediction ? 'Prediction submitted' : 'Vote submitted',
        isPrediction
          ? 'Your prediction has been added to this battle.'
          : 'Your vote has been added to this battle.',
      );
    } catch (error) {
      Alert.alert(
        isPrediction ? 'Prediction not submitted' : 'Vote not submitted',
        error?.response?.data?.message || error?.message || 'Please try again.',
      );
    } finally {
      setSubmittingVote(false);
    }
  };

  const handlePostComment = async () => {
    const message = commentText.trim();
    if (!message || !battleId) {
      return;
    }

    setSubmittingComment(true);
    try {
      let response;
      try {
        response = await commentUpload({ battleId, comment: message, message });
      } catch (error) {
        response = await commentBattle({ battleId, comment: message, message });
      }

      const success = isSuccessfulResponse(response);

      if (!success) {
        Alert.alert(
          'Comment not posted',
          response?.message || 'Please try again.',
        );
        return;
      }

      setCommentText('');
      await fetchBattle(true);
    } catch (error) {
      Alert.alert(
        'Comment not posted',
        error?.response?.data?.message || error?.message || 'Please try again.',
      );
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCommentLike = async (commentId) => {
    if (!commentId || !battleId) return;

    setLikingCommentId(commentId);

    // ✅ 1. Instant UI update (IMPORTANT)
    setBattle(prevBattle => ({
      ...prevBattle,
      comments: prevBattle.comments.map(item => {
        if (item.id === commentId) {
          const currentLikes = Number(item.likes || 0);

          return {
            ...item,
            isLiked: !item.isLiked,
            likes: item.isLiked
              ? currentLikes - 1
              : currentLikes + 1,
          };
        }
        return item;
      }),
    }));

    try {
      const response = await commentLike({ battleId, commentId });
      console.log(response, 'like response');

      const success = isSuccessfulResponse(response);

      if (!success) {
        throw new Error('Like failed');
      }

      // ❌ REMOVE THIS (important)
      // await fetchBattle(true);

    } catch (error) {
      // ❌ Revert UI if API fails
      setBattle(prevBattle => ({
        ...prevBattle,
        comments: prevBattle.comments.map(item => {
          if (item.id === commentId) {
            const currentLikes = Number(item.likes || 0);

            return {
              ...item,
              isLiked: !item.isLiked,
              likes: item.isLiked
                ? currentLikes - 1
                : currentLikes + 1,
            };
          }
          return item;
        }),
      }));

      Alert.alert(
        'Unable to like comment',
        error?.response?.data?.message || error?.message || 'Please try again.'
      );
    } finally {
      setLikingCommentId('');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.loaderWrap, bgStyle]}>
        <ActivityIndicator size="large" color={text} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <ScrollView
        style={[styles.container, bgStyle]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={null}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerIconBtn}
          >
            <Icon name="arrow-back-ios-new" size={20} color={text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: text }]}>
            Battle In Progress
          </Text>
          <TouchableOpacity
            onPress={() => {
              setRefreshing(true);
              fetchBattle(true);
            }}
            style={styles.headerIconBtn}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={text} />
            ) : (
              <Ionicons name="refresh-outline" size={20} color={text} />
            )}
          </TouchableOpacity>
        </View>

        <LinearGradient
          colors={[palette.secondary, palette.primary, palette.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTopRow}>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: `${statusMeta.color}33` },
              ]}
            >
              <Text style={[styles.statusPillText, { color: '#FFFFFF' }]}>
                {statusMeta.label}
              </Text>
            </View>
            <View style={styles.heroMetaRight}>
              <Text style={styles.heroMetaText}>
                {battle.format === 'HEAD_TO_HEAD'
                  ? 'Head-to-Head'
                  : 'Battle Poll'}
              </Text>
              <Text style={styles.heroMetaText}>
                {isPrediction ? 'Prediction' : 'Opinion'}
              </Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>{battle.title}</Text>
          {!!battle.description && (
            <Text style={styles.heroDescription}>{battle.description}</Text>
          )}

          <View style={styles.heroInfoRow}>
            <Text style={styles.heroInfoText}>
              {battle.primaryCount} {battle.primaryCountLabel}
            </Text>
            <Text style={styles.heroInfoText}>{battle.stake} cred points</Text>
            <Text style={styles.heroInfoText}>
              {formatBattleTime(battle.endTime)}
            </Text>
          </View>

          {isHeadToHead && (
            <View style={styles.duelRow}>
              <View style={styles.duelPlayerCard}>
                {battle.creator.avatar ? (
                  <Image
                    source={{ uri: battle.creator.avatar }}
                    style={styles.playerAvatar}
                  />
                ) : (
                  <View
                    style={[styles.playerAvatar, styles.playerAvatarFallback]}
                  >
                    <Ionicons name="person-outline" size={18} color="#FFFFFF" />
                  </View>
                )}
                <Text style={styles.playerName}>{battle.creator.name}</Text>
                {!!battle.creatorChoice && (
                  <Text style={styles.playerChoice}>
                    Picked: {battle.creatorChoice}
                  </Text>
                )}
              </View>

              <View style={styles.duelVsWrap}>
                <Text style={styles.duelVsText}>VS</Text>
              </View>

              <View style={styles.duelPlayerCard}>
                {battle.invitedUser.avatar ? (
                  <Image
                    source={{ uri: battle.invitedUser.avatar }}
                    style={styles.playerAvatar}
                  />
                ) : (
                  <View
                    style={[styles.playerAvatar, styles.playerAvatarFallback]}
                  >
                    <Ionicons name="person-outline" size={18} color="#FFFFFF" />
                  </View>
                )}
                <Text style={styles.playerName}>{battle.invitedUser.name}</Text>
                {!!enforcedOpponentOption && (
                  <Text style={styles.playerChoice}>
                    Only side: {enforcedOpponentOption}
                  </Text>
                )}
              </View>
            </View>
          )}
        </LinearGradient>

        <View
          style={[
            styles.infoCard,
            { backgroundColor: palette.surface, shadowColor: palette.primary },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: text }]}>
            Winner Logic
          </Text>
          <Text style={styles.infoText}>
            {isPrediction
              ? 'Prediction battles rank the correct result first, with engagement used as support.'
              : 'Opinion battles rank the winner by votes plus likes and argument engagement.'}
          </Text>
          {!!battle.resultValue && (
            <Text style={styles.resultText}>
              Current result signal: {battle.resultValue}
            </Text>
          )}
          {!!battle.winnerName && (
            <Text style={styles.resultText}>Winner: {battle.winnerName}</Text>
          )}
        </View>

        <View
          style={[
            styles.infoCard,
            { backgroundColor: palette.surface, shadowColor: palette.primary },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: text }]}>
            {isPrediction ? 'Make Your Prediction' : 'Choose Your Side'}
          </Text>
          {isHeadToHead && !!enforcedOpponentOption && (
            <Text style={styles.sideRuleText}>
              The creator already locked {battle.creatorChoice}. You can only
              join on {enforcedOpponentOption}.
            </Text>
          )}

          <View style={styles.optionList}>
            {(availableOptions.length ? availableOptions : battle.options).map(
              option => {
                const optionSide = String(
                  pickFirst(option?.side, option?.label, ''),
                );
                const isSelected =
                  selectedOption === optionSide ||
                  selectedOption === option.id;
                return (
                  <TouchableOpacity
                    key={`${battle.id}-${option.id}`}
                    activeOpacity={0.88}
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionCardSelected,
                    ]}
                    onPress={() => setSelectedOption(option.label)}
                  >
                    <View style={styles.optionTopRow}>
                      <Text
                        style={[
                          styles.optionLabel,
                          isSelected && styles.optionLabelSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                      <View
                        style={[
                          styles.radioDot,
                          isSelected && styles.radioDotSelected,
                        ]}
                      />
                    </View>
                    {/* <View style={styles.optionMetaRow}>
                      <Text style={styles.optionMeta}>
                        {option.votes} votes
                      </Text>
                      <Text style={styles.optionMeta}>
                        {option.likes} likes
                      </Text>
                      <Text style={styles.optionMeta}>
                        {option.percentage ? `${option.percentage}%` : 'Open'}
                      </Text>
                    </View> */}
                  </TouchableOpacity>
                );
              },
            )}
          </View>

          <TextInput
            value={argumentText}
            onChangeText={setArgumentText}
            placeholder={
              isPrediction
                ? 'Add your prediction reasoning'
                : 'Add your argument'
            }
            placeholderTextColor="#9CA3AF"
            multiline
            style={styles.argumentInput}
          />

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleVote}
            disabled={submittingVote}
          >
            <LinearGradient
              colors={PRIMARY_GRADIENT}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.primaryButton}
            >
              {submittingVote ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isPrediction ? 'Submit Prediction' : 'Vote in Battle'}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.infoCard,
            { backgroundColor: palette.surface, shadowColor: palette.primary },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: text }]}>
            Battle Comments
          </Text>
          <View style={styles.commentComposer}>
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment or argument"
              placeholderTextColor="#9CA3AF"
              multiline
              style={styles.commentInput}
            />
            <TouchableOpacity
              style={[
                styles.commentButton,
                { backgroundColor: palette.primary },
              ]}
              onPress={handlePostComment}
              disabled={submittingComment}
            >
              {submittingComment ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.commentButtonText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>

          {battle.comments.length > 0 ? (
            battle.comments.map(comment => (
              <View key={comment.id} style={styles.commentCard}>
                <View style={styles.commentHeader}>
                  <View style={styles.commentAuthorRow}>
                    {comment.avatar ? (
                      <Image
                        source={{ uri: comment.avatar }}
                        style={styles.commentAvatar}
                      />
                    ) : (
                      <View
                        style={[
                          styles.commentAvatar,
                          styles.commentAvatarFallback,
                        ]}
                      >
                        <Ionicons
                          name="person-outline"
                          size={16}
                          color="#FFFFFF"
                        />
                      </View>
                    )}
                    <View style={styles.commentAuthorTextWrap}>
                      <Text style={styles.commentAuthorName}>
                        {comment.authorName}
                      </Text>
                      {!!comment.authorHandle && (
                        <Text style={styles.commentAuthorHandle}>
                          @{comment.authorHandle}
                        </Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.commentLikeButton}
                    onPress={() => handleCommentLike(comment.id)}
                    disabled={likingCommentId === comment.id}
                  >
                    {likingCommentId === comment.id ? (
                      <ActivityIndicator size="small" color={palette.primary} />
                    ) : (
                      <>
                        <Ionicons
                          name={comment.isLiked ? 'heart' : 'heart-outline'}
                          size={18}
                          color={comment.isLiked ? '#E11D48' : '#6B7280'}
                        />
                        <Text style={styles.commentLikeText}>
                          {comment.likes}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={styles.commentMessage}>{comment.message}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyCommentText}>
              No comments yet. Start the conversation and strengthen your side.
            </Text>
          )}
        </View>

        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: palette.primary }]}
            onPress={() =>
              navigation.navigate('BattleResults', {
                battleId: battle.id || battleId,
                battle,
                entryPoint: route?.params?.entryPoint || 'battle_progress',
              })
            }
          >
            <Text
              style={[styles.secondaryButtonText, { color: palette.primary }]}
            >
              View Results
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: palette.primary }]}
            onPress={() =>
              navigation.navigate('BattleReward', {
                battleId: battle.id || battleId,
                battle,
                entryPoint: route?.params?.entryPoint || 'battle_progress',
              })
            }
          >
            <Text
              style={[styles.secondaryButtonText, { color: palette.primary }]}
            >
              Cred Points
            </Text>
          </TouchableOpacity>
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
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
  heroCard: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroMetaRight: {
    alignItems: 'flex-end',
  },
  heroMetaText: {
    color: '#F3E8FF',
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 30,
  },
  heroDescription: {
    color: '#F5ECFF',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  heroInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
  },
  heroInfoText: {
    color: '#F3E8FF',
    fontSize: 12,
    fontWeight: '700',
  },
  duelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  duelPlayerCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    padding: 12,
    alignItems: 'center',
  },
  duelVsWrap: {
    paddingHorizontal: 10,
  },
  duelVsText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  playerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginBottom: 8,
  },
  playerAvatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  playerChoice: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
  infoCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#6B7280',
  },
  resultText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
    marginTop: 8,
  },
  sideRuleText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
    marginBottom: 12,
  },
  optionList: {
    gap: 10,
  },
  optionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  optionCardSelected: {
    borderColor: '#7C3AED',
    backgroundColor: '#F5F3FF',
  },
  optionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginRight: 10,
  },
  optionLabelSelected: {
    color: '#6D28D9',
  },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  radioDotSelected: {
    borderColor: '#7C3AED',
    backgroundColor: '#7C3AED',
  },
  optionMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  optionMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  argumentInput: {
    minHeight: 90,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    textAlignVertical: 'top',
    marginTop: 14,
    marginBottom: 14,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  commentComposer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  commentInput: {
    flex: 1,
    minHeight: 80,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    textAlignVertical: 'top',
    marginRight: 10,
  },
  commentButton: {
    minWidth: 70,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  commentButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  commentCard: {
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    padding: 14,
    marginBottom: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 10,
  },
  commentAvatarFallback: {
    backgroundColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAuthorTextWrap: {
    flex: 1,
  },
  commentAuthorName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  commentAuthorHandle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 2,
  },
  commentLikeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 44,
    justifyContent: 'flex-end',
  },
  commentLikeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginLeft: 6,
  },
  commentMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  emptyCommentText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: '10%',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
