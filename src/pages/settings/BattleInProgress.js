import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Svg, { ClipPath, Polygon, Image as SvgImage, Defs } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  commentLike,
  commentUpload,
  getbattle,
  predictBattle,
  replyCommentBattle,
  voteBattle,
} from '../../services/battle';
import { getUserCredentials } from '../../services/post';
import { useAppTheme } from '../../theme/useApptheme';
import { normalizeProfileType } from '../../utils/supportEligibility';

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

const HexagonImage = ({ uri, size = 110, borderColor = 'rgba(255,255,255,0.4)', fallback }) => {
  const hexagonPoints = `${size / 2},0 ${size},${size / 4} ${size},${(size * 3) / 4} ${size / 2},${size} 0,${(size * 3) / 4} 0,${size / 4}`;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <ClipPath id="hexagon">
          <Polygon points={hexagonPoints} />
        </ClipPath>
      </Defs>
      {uri ? (
        <SvgImage
          x="0"
          y="0"
          width={size}
          height={size}
          href={{ uri }}
          clipPath="url(#hexagon)"
          preserveAspectRatio="xMidYMid slice"
        />
      ) : fallback ? (
        fallback
      ) : null}
      <Polygon
        points={hexagonPoints}
        fill="none"
        stroke={borderColor}
        strokeWidth="2"
      />
    </Svg>
  );
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

const resolveEntityId = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  return String(
    pickFirst(
      value?.id,
      value?._id,
      value?.userId,
      value?.UserId,
      value?.user?.id,
      value?.user?._id,
      '',
    ),
  );
};

const normalizeLikeCount = (comment) => {
  if (Array.isArray(comment?.likes)) {
    return comment.likes.length;
  }

  const numericCount = Number(
    pickFirst(
      comment?.likeCount,
      comment?.likesCount,
      comment?._count?.likes,
      comment?.likes,
      0,
    ),
  );

  return Number.isFinite(numericCount) ? numericCount : 0;
};

const normalizeCommentLikedState = (comment, currentUserId = '') => {
  const explicitLikeState = pickFirst(
    comment?.isLiked,
    comment?.likedByMe,
    comment?.isLike,
    comment?.hasLiked,
    undefined,
  );

  if (typeof explicitLikeState === 'boolean') {
    return explicitLikeState;
  }

  if (typeof explicitLikeState === 'string') {
    const normalizedValue = explicitLikeState.trim().toLowerCase();
    if (normalizedValue === 'true') return true;
    if (normalizedValue === 'false') return false;
  }

  if (!currentUserId) {
    return false;
  }

  const likesList = Array.isArray(comment?.likes)
    ? comment.likes
    : Array.isArray(comment?.likedUsers)
      ? comment.likedUsers
      : [];

  return likesList.some((entry) => resolveEntityId(entry) === String(currentUserId));
};

const getCommentReplyEntries = comment => {
  if (Array.isArray(comment?.replies)) {
    return comment.replies;
  }

  if (Array.isArray(comment?.children)) {
    return comment.children;
  }

  return [];
};

const enrichBattleCommentLikes = (comments = [], storedId = '') =>
  (Array.isArray(comments) ? comments : []).map(comment => ({
    ...comment,
    isLiked:
      Array.isArray(comment?.likes) &&
      comment.likes.some(
        like => String(like?.userId) === String(storedId),
      ),
    replies: enrichBattleCommentLikes(getCommentReplyEntries(comment), storedId),
  }));

const flattenReplies = (entries, currentUserId = '') =>
  (Array.isArray(entries) ? entries : []).reduce((acc, reply, index) => {
    const normalizedReply = normalizeComment(reply, index, currentUserId);
    const nestedReplies = Array.isArray(normalizedReply.replies)
      ? normalizedReply.replies
      : [];

    acc.push({
      ...normalizedReply,
      replies: [],
    });

    if (nestedReplies.length > 0) {
      acc.push(...flattenReplies(nestedReplies, currentUserId));
    }

    return acc;
  }, []);

const normalizeComment = (comment, index = 0, currentUserId = '') => ({
  id: String(pickFirst(comment?.id, comment?._id, index)),
  parentId: String(pickFirst(comment?.parentId, comment?.parentCommentId, '')),
  message: pickFirst(comment?.message, comment?.comment, comment?.text, ''),
  likes: normalizeLikeCount(comment),
  isLiked: normalizeCommentLikedState(comment, currentUserId),
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
  replies: flattenReplies(getCommentReplyEntries(comment), currentUserId),
});

const updateCommentTree = (comments, targetId, updater) =>
  (Array.isArray(comments) ? comments : []).map(comment => {
    if (comment.id === targetId) {
      return updater(comment);
    }

    if (Array.isArray(comment.replies) && comment.replies.length > 0) {
      return {
        ...comment,
        replies: updateCommentTree(comment.replies, targetId, updater),
      };
    }

    return comment;
  });

const findCommentInTree = (comments, targetId) => {
  for (const comment of Array.isArray(comments) ? comments : []) {
    if (comment.id === targetId) {
      return comment;
    }

    const nestedMatch = findCommentInTree(comment.replies, targetId);
    if (nestedMatch) {
      return nestedMatch;
    }
  }

  return null;
};

const normalizeBattle = (raw, currentUserId = '') => {
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
      raw?.id,
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
    (comment, index) => normalizeComment(comment, index, currentUserId),
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
    participants: participantEntries,
    predictions: predictionEntries,
    votes: voteEntries,
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
    winningSide: String(
      pickFirst(raw?.winningSide, raw?.resultValue, raw?.actualResult, ''),
    ),
    winnerUserId: String(
      pickFirst(raw?.winnerUserId, raw?.winner?.id, raw?.winner?._id, ''),
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
    predictionCounts:
      raw?.predictionCounts && typeof raw.predictionCounts === 'object'
        ? raw.predictionCounts
        : {},
    optionImages: Array.isArray(raw?.optionImages)
      ? raw.optionImages.filter(Boolean)
      : [],
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
  const { profile, } = route.params || {};
  const resolvedProfileType = normalizeProfileType(profile);
  const { bgStyle, textStyle, cardStyle, text, card } = useAppTheme(resolvedProfileType);
  const routeBattle = route?.params?.battle || {};
  const hasInitialBattleData = Object.keys(routeBattle || {}).length > 0;
  const battleId =
    route?.params?.battleId ||
    routeBattle.id ||
    routeBattle._id ||
    routeBattle.battleId ||
    '';
  const [currentUserId, setCurrentUserId] = useState('');
  const [battle, setBattle] = useState(() => normalizeBattle(routeBattle, ''));
  const [selectedOption, setSelectedOption] = useState(
    () => String(route?.params?.selectedOption || ''),
  );
  const [argumentText, setArgumentText] = useState('');
  const [commentText, setCommentText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyingToComment, setReplyingToComment] = useState(null);
  const [expandedReplies, setExpandedReplies] = useState({});
  const [loading, setLoading] = useState(!hasInitialBattleData);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [likingCommentId, setLikingCommentId] = useState('');
  const [keepActiveSelectedStyle, setKeepActiveSelectedStyle] = useState(false);
  const [participantUserData, setParticipantUserData] = useState({});
  const replyInputRef = useRef(null);
  const scrollRef = useRef(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const palette = useMemo(() => {
    const primary = text || '#5a2d82';
    const secondary =
      primary.toLowerCase() === '#d3b683' ? '#b8924f' : '#8f54f7';
    return {
      primary,
      secondary,
      surface: card || '#FFFFFF',
      textMuted: withAlpha(primary, '99'),
      border: withAlpha(primary, '22'),
      soft: withAlpha(primary, '10'),
      buttonGradient:
        primary.toLowerCase() === '#d3b683'
          ? ['#b8924f', '#D3B683']
          : ['#513189', '#8f54f7'],
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
  const userVotedSelection = useMemo(() => {
    if (!currentUserId) {
      return { side: '', optionId: '' };
    }

    const matchByUserId = entry =>
      String(
        pickFirst(
          entry?.userId,
          entry?.user?.id,
          entry?.user?._id,
          entry?.user?.userId,
          entry?.user?.UserId,
          '',
        ),
      ) === String(currentUserId);

    const allEntries = [
      ...(Array.isArray(battle?.participants) ? battle.participants : []),
      ...(Array.isArray(battle?.predictions) ? battle.predictions : []),
      ...(Array.isArray(battle?.votes) ? battle.votes : []),
    ];

    const matchedEntry = allEntries.find(matchByUserId);
    if (!matchedEntry) {
      return { side: '', optionId: '' };
    }

    return {
      side: String(
        pickFirst(
          matchedEntry?.side,
          matchedEntry?.label,
          matchedEntry?.option,
          '',
        ),
      ),
      optionId: String(pickFirst(matchedEntry?.optionId, '')),
    };
  }, [battle?.participants, battle?.predictions, battle?.votes, currentUserId]);

  const hasUserVoted = useMemo(
    () => Boolean(userVotedSelection.side || userVotedSelection.optionId),
    [userVotedSelection.optionId, userVotedSelection.side],
  );

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

      if (!isSilent && !hasInitialBattleData) {
        setLoading(true);
      }

      try {
        const response = await getbattle({ params: { battleId } });
        const storedId = await AsyncStorage.getItem('userId');
        console.log(response, 'reposne in battle ')
        const rawBattle =
          response?.data?.battle ||
          response?.data?.data ||
          response?.data ||
          response?.battle ||
          routeBattle;
        const enrichedBattle = {
          ...rawBattle,
          comments: enrichBattleCommentLikes(rawBattle?.comments || [], storedId),
        };
        setBattle(normalizeBattle(enrichedBattle, storedId || currentUserId));
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
    [battleId, currentUserId, hasInitialBattleData, routeBattle],
  );

  useEffect(() => {
    getbattle();
  }, []);
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

  // Fetch user credentials for participants
  useEffect(() => {
    const fetchParticipantData = async () => {
      if (!Array.isArray(battle.participants) || battle.participants.length < 2) {
        return;
      }

      try {
        const participant0 = battle.participants[0];
        const participant1 = battle.participants[1];

        const [res0, res1] = await Promise.all([
          getUserCredentials(participant0?.userId),
          getUserCredentials(participant1?.userId),
        ]);

        const userData0 = res0?.statusCode === 200 
          ? (res0.data?.user || res0.data || {})
          : {};
        const userData1 = res1?.statusCode === 200 
          ? (res1.data?.user || res1.data || {})
          : {};

        // Format image URLs
        const formatImageUrl = (image) => {
          if (!image) return '';
          let url = String(image).trim();
          if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
          } else if (url.startsWith('/')) {
            return `http://35.174.167.92:3002${url}`;
          } else {
            return `http://35.174.167.92:3002/${url}`;
          }
        };

        setParticipantUserData({
          [participant0?.userId]: {
            name: userData0?.displayName || userData0?.name || 'User',
            image: formatImageUrl(userData0?.image),
          },
          [participant1?.userId]: {
            name: userData1?.displayName || userData1?.name || 'User',
            image: formatImageUrl(userData1?.image),
          },
        });
      } catch (error) {
        console.error('Error fetching participant credentials:', error);
      }
    };

    fetchParticipantData();
  }, [battle.participants]);

  useEffect(() => {
    if (userVotedSelection.optionId) {
      setSelectedOption(userVotedSelection.optionId);
      return;
    }

    if (userVotedSelection.side) {
      setSelectedOption(userVotedSelection.side);
    }
  }, [userVotedSelection.optionId, userVotedSelection.side]);

  const handleOpenReply = useCallback(comment => {
    setReplyingToComment({
      id: comment?.id || '',
      authorName: comment?.authorName || 'User',
    });
    setReplyText('');

    setTimeout(() => {
      replyInputRef.current?.focus?.();
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }, []);

  const toggleReplies = useCallback(commentId => {
    setExpandedReplies(prev => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  }, []);

  const handleHeroCardPressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handleHeroCardPressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

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
        console.log(response, 'dta hree')
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
      setKeepActiveSelectedStyle(true);
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
      const response = await commentUpload({ battleId, comment: message, message });

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

  const handlePostReply = async () => {
    const message = replyText.trim();
    if (!message || !battleId || !replyingToComment?.id) {
      return;
    }

    const parentCommentId = replyingToComment.id;

    setSubmittingComment(true);
    try {
      const response = await replyCommentBattle({
        battleId,
        comment: message,
        parentCommentId,
      });

      const success = isSuccessfulResponse(response);

      if (!success) {
        Alert.alert(
          'Reply not posted',
          response?.message || 'Please try again.',
        );
        return;
      }

      setReplyText('');
      setReplyingToComment(null);
      setExpandedReplies(prev => ({
        ...prev,
        [parentCommentId]: false,
      }));
      await fetchBattle(true);
    } catch (error) {
      Alert.alert(
        'Reply not posted',
        error?.response?.data?.message || error?.message || 'Please try again.',
      );
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCommentLike = async (commentId) => {
    if (!commentId || !battleId) return;

    const targetComment = findCommentInTree(battle.comments, commentId);
    if (!targetComment) {
      return;
    }

    setLikingCommentId(commentId);
    const previousCommentState = {
      isLiked: !!targetComment.isLiked,
      likes: Number.isFinite(Number(targetComment.likes))
        ? Number(targetComment.likes)
        : 0,
    };

    // Instant UI update
    setBattle(prevBattle => ({
      ...prevBattle,
      comments: updateCommentTree(prevBattle.comments, commentId, item => {
        return {
          ...item,
          isLiked: !previousCommentState.isLiked,
          likes: previousCommentState.isLiked
            ? Math.max(previousCommentState.likes - 1, 0)
            : previousCommentState.likes + 1,
        };
      }),
    }));

    try {
      const response = await commentLike({ battleId, commentId });
      console.log(response, 'liek in respoane ')
      const success = isSuccessfulResponse(response);

      if (!success) {
        throw new Error('Like failed');
      }

      await fetchBattle(true);

    } catch (error) {
      setBattle(prevBattle => ({
        ...prevBattle,
        comments: updateCommentTree(prevBattle.comments, commentId, item => ({
          ...item,
          isLiked: previousCommentState.isLiked,
          likes: previousCommentState.likes,
        })),
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

  const renderReplyItem = reply => (
    <View
      key={reply.id}
      style={[
        styles.replyCard,
        {
          backgroundColor: withAlpha(palette.primary, '08'),
          borderColor: palette.border,
        },
      ]}
    >
      <View style={styles.commentHeader}>
        <View style={styles.commentAuthorRow}>
          {reply.avatar ? (
            <Image
              source={{ uri: reply.avatar }}
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
            <Text style={[styles.commentAuthorName, textStyle]}>
              {reply.authorName}
            </Text>
            {!!reply.authorHandle && (
              <Text style={[styles.commentAuthorHandle, { color: palette.textMuted }]}>
                @{reply.authorHandle}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.replyTrigger}
            onPress={() => handleOpenReply(reply)}
          >
            <Text
              style={[
                styles.replyTriggerText,
                { color: palette.primary },
              ]}
            >
              Reply
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.commentLikeButton}
          onPress={() => handleCommentLike(reply.id)}
          disabled={likingCommentId === reply.id}
        >
          {likingCommentId === reply.id ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <>
              <Ionicons
                name={reply.isLiked ? 'heart' : 'heart-outline'}
                size={18}
                color={reply.isLiked ? '#E11D48' : '#6B7280'}
              />
              <Text
                style={[
                  styles.commentLikeText,
                  { color: reply.isLiked ? '#E11D48' : '#6B7280' },
                ]}
              >
                {Number.isFinite(Number(reply.likes)) ? Number(reply.likes) : 0}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Text style={[styles.commentMessage, textStyle]}>{reply.message}</Text>

      {replyingToComment?.id === reply.id && (
        <View style={styles.replyComposer}>
          <Text
            style={[
              styles.replyComposerLabel,
              { color: palette.textMuted },
            ]}
          >
            Replying to {replyingToComment.authorName}
          </Text>
          <TextInput
            ref={replyInputRef}
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Write your reply"
            placeholderTextColor="#9CA3AF"
            multiline
            style={[
              styles.replyInput,
              textStyle,
              cardStyle,
              { borderColor: palette.border },
            ]}
          />
          <View style={styles.replyActions}>
            <TouchableOpacity
              style={[
                styles.replySecondaryButton,
                { borderColor: palette.border },
              ]}
              onPress={() => {
                setReplyingToComment(null);
                setReplyText('');
              }}
            >
              <Text
                style={[
                  styles.replySecondaryButtonText,
                  { color: palette.textMuted },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.replyPrimaryButton,
                { backgroundColor: palette.primary },
              ]}
              onPress={handlePostReply}
              disabled={submittingComment}
            >
              {submittingComment ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.replyPrimaryButtonText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const renderCommentItem = comment => {
    const hasReplies = Array.isArray(comment.replies) && comment.replies.length > 0;
    const isExpanded = !!expandedReplies[comment.id];
    const visibleReplies = hasReplies && isExpanded ? comment.replies : [];
    const repliesCount = hasReplies ? comment.replies.length : 0;

    return (
      <View
        key={comment.id}
        style={[
          styles.commentCard,
          {
            backgroundColor: palette.soft,
            borderColor: palette.border,
          },
        ]}
      >
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
              <Text style={[styles.commentAuthorName, textStyle]}>
                {comment.authorName}
              </Text>
              {!!comment.authorHandle && (
                <Text style={[styles.commentAuthorHandle, { color: palette.textMuted }]}>
                  @{comment.authorHandle}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.replyTrigger}
              onPress={() => handleOpenReply(comment)}
            >
              <Text
                style={[
                  styles.replyTriggerText,
                  { color: palette.primary },
                ]}
              >
                Reply
              </Text>
            </TouchableOpacity>
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
                <Text
                  style={[
                    styles.commentLikeText,
                    { color: comment.isLiked ? '#E11D48' : '#6B7280' },
                  ]}
                >
                  {Number.isFinite(Number(comment.likes)) ? Number(comment.likes) : 0}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={[styles.commentMessage, textStyle]}>{comment.message}</Text>

        {hasReplies && !isExpanded ? (
          <TouchableOpacity
            style={styles.viewRepliesButton}
            onPress={() => toggleReplies(comment.id)}
          >
            <Text style={[styles.viewRepliesText, { color: palette.primary }]}>
              View replies ({repliesCount})
            </Text>
          </TouchableOpacity>
        ) : null}

        {hasReplies && isExpanded ? (
          <TouchableOpacity
            style={styles.viewRepliesButton}
            onPress={() => toggleReplies(comment.id)}
          >
            <Text style={[styles.viewRepliesText, { color: palette.primary }]}>
              Hide replies
            </Text>
          </TouchableOpacity>
        ) : null}

        {replyingToComment?.id === comment.id && (
          <View style={styles.replyComposer}>
            <Text
              style={[
                styles.replyComposerLabel,
                { color: palette.textMuted },
              ]}
            >
              Replying to {replyingToComment.authorName}
            </Text>
            <TextInput
              ref={replyInputRef}
              value={replyText}
              onChangeText={setReplyText}
              placeholder="Write your reply"
              placeholderTextColor="#9CA3AF"
              multiline
              style={[
                styles.replyInput,
                textStyle,
                cardStyle,
                { borderColor: palette.border },
              ]}
            />
            <View style={styles.replyActions}>
              <TouchableOpacity
                style={[
                  styles.replySecondaryButton,
                  { borderColor: palette.border },
                ]}
                onPress={() => {
                  setReplyingToComment(null);
                  setReplyText('');
                }}
              >
                <Text
                  style={[
                    styles.replySecondaryButtonText,
                    { color: palette.textMuted },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.replyPrimaryButton,
                  { backgroundColor: palette.primary },
                ]}
                onPress={handlePostReply}
                disabled={submittingComment}
              >
                {submittingComment ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.replyPrimaryButtonText}>Post</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {Array.isArray(visibleReplies) && visibleReplies.length > 0 ? (
          <View style={styles.repliesSection}>
            {visibleReplies.map(renderReplyItem)}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            style={[styles.container, bgStyle]}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={null}
            ref={scrollRef}
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

            <Animated.View
              style={{
                transform: [{ scale: scaleAnim }],
              }}
            >
              <TouchableOpacity
                activeOpacity={0.9}
                onPressIn={handleHeroCardPressIn}
                onPressOut={handleHeroCardPressOut}
              >
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
                    {/* <Text style={styles.heroInfoText}>{battle.stake} cred points</Text> */}
                    <Text style={styles.heroInfoText}>
                      {formatBattleTime(battle.endTime)}
                    </Text>
                  </View>

                  {isHeadToHead && Array.isArray(battle.participants) && battle.participants.length >= 2 && (
                    <View style={styles.duelRow}>
                      {(() => {
                        const participant0 = battle.participants[0];
                        const participant1 = battle.participants[1];
                        
                        const player0Data = participantUserData[participant0?.userId] || {};
                        const player1Data = participantUserData[participant1?.userId] || {};

                        return (
                          <>
                            <TouchableOpacity
                              activeOpacity={0.75}
                              onPress={() => {
                                if (currentUserId === participant0?.userId) {
                                  navigation.navigate('ProfileMain', { screen: 'Profile' });
                                } else {
                                  const currentRoute = route?.name || 'BattleInProgress';
                                  navigation.navigate('HomeMain', {
                                    screen: 'UsersProfile',
                                    params: {
                                      userId: participant0?.userId,
                                      returnTo: currentRoute,
                                    },
                                  });
                                }
                              }}
                            >
                              <View style={styles.duelPlayerCard}>
                                <View style={styles.playerImageContainer}>
                                  <HexagonImage
                                    uri={player0Data?.image}
                                    size={80}
                                    borderColor="rgba(255,255,255,0.4)"
                                  />
                                </View>
                                <Text style={styles.playerNameBold}>{player0Data?.name}</Text>
                                <Text style={styles.playerNameBold}>({participant0?.side})</Text>
                                <View style={styles.votesContainer}>
                                  <Ionicons name="chatbubble-outline" size={16} color="#FFFFFF" />
                                  <Text style={styles.votesCountText}>{participant0?.score || 0} Points</Text>
                                </View>
                              </View>
                            </TouchableOpacity>

                            <View style={styles.duelVsWrap}>
                              <Text style={styles.duelVsText}>VS</Text>
                            </View>

                            <TouchableOpacity
                              activeOpacity={0.75}
                              onPress={() => {
                                if (currentUserId === participant1?.userId) {
                                  navigation.navigate('ProfileMain', { screen: 'Profile' });
                                } else {
                                  const currentRoute = route?.name || 'BattleInProgress';
                                  navigation.navigate('HomeMain', {
                                    screen: 'UsersProfile',
                                    params: {
                                      userId: participant1?.userId,
                                      returnTo: currentRoute,
                                    },
                                  });
                                }
                              }}
                            >
                              <View style={styles.duelPlayerCard}>
                                <View style={styles.playerImageContainer}>
                                  <HexagonImage
                                    uri={player1Data?.image}
                                    size={80}
                                    borderColor="rgba(255,255,255,0.4)"
                                  />
                                </View>
                                <Text style={styles.playerNameBold}>{player1Data?.name}</Text>
                                <Text style={styles.playerNameBold}>({participant1?.side})</Text>
                                <View style={styles.votesContainer}>
                                  <Ionicons name="chatbubble-outline" size={16} color="#FFFFFF" />
                                  <Text style={styles.votesCountText}>{participant1?.score || 0} Points</Text>
                                </View>
                              </View>
                            </TouchableOpacity>
                          </>
                        );
                      })()}
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <View
              style={[
                styles.infoCard,
                cardStyle,
                { shadowColor: palette.primary },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: text }]}>
                Winner Logic
              </Text>
              <Text style={[styles.infoText, textStyle]}>
                {isPrediction
                  ? 'Prediction battles rank the correct result first, with engagement used as support.'
                  : 'Opinion battles rank the winner by votes plus likes and argument engagement.'}
              </Text>
              {!!battle.resultValue && (
                <Text style={[styles.resultText, textStyle]}>
                  Current result signal: {battle.resultValue}
                </Text>
              )}
              {!!battle.winnerName && (
                <Text style={[styles.resultText, textStyle]}>Winner: {battle.winnerName}</Text>
              )}
            </View>


            <View
              style={[
                styles.infoCard,
                cardStyle,
                { shadowColor: palette.primary },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: text }]}>
                {isPrediction ? 'Make Your Prediction' : 'Choose Your Side'}
              </Text>
              {isHeadToHead && !!enforcedOpponentOption && (
                <Text style={[styles.sideRuleText, textStyle]}>
                  The creator already locked {battle.creatorChoice}. You can only
                  join on {enforcedOpponentOption}.
                </Text>
              )}

              <View style={styles.optionList}>
                {(availableOptions.length ? availableOptions : battle.options).map(
                  (option, index) => {
                    const optionImage = battle.optionImages?.[index];
                    const optionSide = String(
                      pickFirst(option?.side, option?.label, ''),
                    );
                    const isSelected =
                      selectedOption === optionSide ||
                      selectedOption === option.id ||
                      normalizeSideKey(userVotedSelection.side) ===
                      normalizeSideKey(optionSide) ||
                      userVotedSelection.optionId === String(option.id);
                    const useVotedGrayStyle = hasUserVoted && !keepActiveSelectedStyle;
                    return (
                      <TouchableOpacity
                        key={`${battle.id}-${option.id}`}
                        disabled={hasUserVoted}
                        activeOpacity={0.88}
                        style={[
                          styles.optionCard,
                          !isSelected && {
                            borderColor: '#D1D5DB',
                            backgroundColor: '#F9FAFB',
                          },
                          isSelected && styles.optionCardSelected,
                          isSelected && {
                            borderColor: useVotedGrayStyle ? '#D1D5DB' : palette.primary,
                            backgroundColor: useVotedGrayStyle ? '#F3F4F6' : palette.soft,
                          },
                        ]}
                        onPress={() => {
                          if (!hasUserVoted) {
                            setSelectedOption(option.label);
                          }
                        }}
                      >
                        <View style={styles.optionBadgeWrapper}>
                          {optionImage || option.image ? (
                            <View style={styles.optionImageWrapper}>
                              <Image
                                source={{ uri: optionImage || option.image }}
                                style={styles.optionImage}
                              />
                            </View>
                          ) : (
                            <View style={styles.addImagePlaceholder}>
                              <Ionicons name="image-outline" size={20} color="#9CA3AF" />
                            </View>
                          )}
                          <View style={styles.optionBadgeInfo}>
                            <View style={styles.optionNameBadgeRow}>
                              <Text
                                style={[
                                  styles.optionPreviewName,
                                  textStyle,
                                  isSelected && styles.optionLabelSelected,
                                  isSelected && {
                                    color: useVotedGrayStyle ? '#9CA3AF' : palette.primary,
                                  },
                                ]}
                                numberOfLines={2}
                              >
                                {option.label}
                              </Text>
                            </View>
                            {/* <View style={styles.optionMetaRow}>
                              <Text style={styles.optionMeta}>
                                {option.votes} votes
                              </Text>
                              <Text style={styles.optionMeta}>
                                {option.percentage ? `${option.percentage}%` : 'Open'}
                              </Text>
                            </View> */}
                          </View>
                        </View>
                        <View style={styles.optionPreviewRight}>
                          <View
                            style={[
                              styles.radioDot,
                              !isSelected && {
                                borderColor: '#D1D5DB',
                                backgroundColor: '#F3F4F6',
                              },
                              isSelected && styles.radioDotSelected,
                              isSelected && {
                                borderColor: useVotedGrayStyle ? '#D1D5DB' : palette.primary,
                                backgroundColor: useVotedGrayStyle ? '#D1D5DB' : palette.primary,
                              },
                            ]}
                          />
                        </View>
                      </TouchableOpacity>
                    );
                  },
                )}
              </View>

              <TextInput
                editable
                value={hasUserVoted ? commentText : argumentText}
                onChangeText={hasUserVoted ? setCommentText : setArgumentText}
                placeholder={
                  hasUserVoted
                    ? 'Write a comment...'
                    : isPrediction
                      ? 'Add your prediction reasoning'
                      : 'Add your argument'
                }
                placeholderTextColor="#9CA3AF"
                multiline
                style={[
                  styles.argumentInput,
                  textStyle,
                  cardStyle,
                  { borderColor: palette.border },
                ]}
              />

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={hasUserVoted ? handlePostComment : handleVote}
                disabled={
                  submittingVote ||
                  (!hasUserVoted && !argumentText?.trim()) ||
                  (hasUserVoted && !commentText?.trim())
                }
                style={{
                  opacity:
                    submittingVote ||
                      (!hasUserVoted && !argumentText?.trim()) ||
                      (hasUserVoted && !commentText?.trim())
                      ? 0.5
                      : 1,
                }}
              >
                <LinearGradient
                  colors={palette.buttonGradient}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.primaryButton}
                >
                  {submittingVote ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {hasUserVoted
                        ? 'Add Comment'
                        : isPrediction
                          ? 'Submit Prediction'
                          : 'Vote in Battle'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>


            <View
              style={[
                styles.infoCard,
                cardStyle,
                { shadowColor: palette.primary },
              ]}
            >
              {/* <Text style={[styles.sectionTitle, { color: text }]}>
                Battle Comments
              </Text>
              <View style={styles.commentComposer}>
                <TextInput
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="Add a comment or argument"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  style={[
                    styles.commentInput,
                    textStyle,
                    cardStyle,
                    { borderColor: palette.border },
                  ]}
                />
                <TouchableOpacity
                  style={[
                    styles.commentButton,
                    { backgroundColor: palette.primary },
                  ]}
                  onPress={handlePostComment}
                  disabled={submittingComment}
                >
                  {submittingComment && !replyingToComment ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.commentButtonText}>Post</Text>
                  )}
                </TouchableOpacity>
              </View> */}

              {battle.comments.length > 0 ? (
                battle.comments.map(comment => renderCommentItem(comment))
              ) : (
                <Text style={[styles.emptyCommentText, textStyle]}>
                  No comments yet. Start the conversation and strengthen your side.
                </Text>
              )}
            </View>

            <View style={styles.bottomActions}>
              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  cardStyle,
                  { borderColor: palette.primary },
                ]}
                onPress={() =>
                  navigation.navigate('BattleResults', {
                    battleId: battle.id || battleId,
                    battle,
                    predictionCounts: battle?.predictionCounts || {},
                    winnerUserId: battle?.winnerUserId || '',
                    winningSide: battle?.winningSide || '',
                    entryPoint: route?.params?.entryPoint || 'battle_progress',
                    profile: profile
                  })
                }
              >
                <Text
                  style={[styles.secondaryButtonText, { color: palette.primary }]}
                >
                  View Results
                </Text>
              </TouchableOpacity>

              {/* <TouchableOpacity
            style={[
              styles.secondaryButton,
              cardStyle,
              { borderColor: palette.primary },
            ]}
            onPress={() =>
              navigation.navigate('BattleReward', {
                battleId: battle.id || battleId,
                battle,
                entryPoint: route?.params?.entryPoint || 'battle_progress',
                profile: profile
              })
            }
          >
            <Text
              style={[styles.secondaryButtonText, { color: palette.primary }]}
            >
              Cred Points
            </Text>
          </TouchableOpacity> */}
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
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
    borderRadius: 15,
    width: '100%',
    // maxHeight:250,
    paddingVertical: 5,
    paddingHorizontal: 1,
    marginBottom: '5%',
    // Fix clipping issue on iOS
    overflow: Platform.OS === 'ios' ? 'hidden' : 'visible',

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
    paddingRight: 4,
    marginRight: 6,
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
    padding: 4,
    marginLeft: 6,
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
    gap: 6,
    marginLeft: 7,
    marginBottom: 8,
  },
  heroInfoText: {
    color: '#F3E8FF',
    fontSize: 12,
    fontWeight: '700',
    padding: 4
  },
  duelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 8,
    marginHorizontal: 15,
  },
  duelPlayerCard: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingTop: 12,
    paddingHorizontal: 15,
    paddingBottom: 12,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  playerImageContainer: {
    width: '100%',
    height: 120,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerNameBold: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    marginHorizontal: 4,
    marginBottom: 4,
  },
  battlePointsText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 10,
  },
  votesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
  },
  votesCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 6,
  },
  duelVsWrap: {
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  duelVsText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
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
  optionCardSelected: {
    borderColor: '#D1D5DB',
    backgroundColor: '#fffaf3',
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginRight: 10,
  },
  optionLabelSelected: {
    color: '#d7d3d3',
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
    borderColor: '#d7d3d3',
    backgroundColor: '#d7d3d3',
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
  optionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionBadgeWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionImageWrapper: {
    position: 'relative',
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FAFAFA',
  },
  optionImage: {
    width: '100%',
    height: '100%',
  },
  addImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  optionBadgeInfo: {
    flex: 1,
  },
  optionNameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  optionPreviewName: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  optionPreviewRight: {
    alignItems: 'flex-end',
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
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  replyCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginTop: 10,
  },
  repliesSection: {
    marginTop: 10,
    marginLeft: 18,
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
  replyTrigger: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  replyTriggerText: {
    fontSize: 12,
    fontWeight: '800',
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
  viewRepliesButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  viewRepliesText: {
    fontSize: 12,
    fontWeight: '800',
  },
  replyComposer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  replyComposerLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  replyInput: {
    minHeight: 88,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    textAlignVertical: 'top',
  },
  replyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  replySecondaryButton: {
    minWidth: 82,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
  },
  replySecondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  replyPrimaryButton: {
    minWidth: 82,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  replyPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
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
