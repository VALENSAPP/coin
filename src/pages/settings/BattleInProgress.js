import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  StackActions,
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Svg, { ClipPath, Polygon, Image as SvgImage, Defs } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import ImageZoom from 'react-native-image-pan-zoom';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  commentLike,
  commentUpload,
  getbattle,
  predictBattle,
  replyCommentBattle,
  voteBattle,
  battlePoint,
  voteHeadtoHead,
  voteHeadtoHeadOpponent,
} from '../../services/battle';
import { getUserCredentials } from '../../services/post';
import { useAppTheme } from '../../theme/useApptheme';
import { normalizeProfileType } from '../../utils/supportEligibility';
import HexAvatar from '../../components/home/story.js/HexAvatar';
import { Vsbanner } from '../../assets/icons';
import { useLanguage } from '../../i18n';

const isMeaningfulValue = value => {
  if (value === undefined || value === null) return false;
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

const FALLBACK_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const pickFirst = (...values) => values.find(isMeaningfulValue);

const withAlpha = (hex, alpha) => {
  if (typeof hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return `${hex}${alpha}`;
  }
  return hex;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const OPTION_IMAGE_PREVIEW_SIZE = Math.min(Math.round(SCREEN_WIDTH * 0.84), 360);

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
          x="0" y="0" width={size} height={size}
          href={{ uri }}
          clipPath="url(#hexagon)"
          preserveAspectRatio="xMidYMid slice"
        />
      ) : fallback ? fallback : null}
      <Polygon points={hexagonPoints} fill="none" stroke={borderColor} strokeWidth="2" />
    </Svg>
  );
};

const normalizeOption = (option, index) => {
  if (typeof option === 'string') {
    return { id: `${index}`, label: option, votes: 0, likes: 0, percentage: 0 };
  }
  const label = pickFirst(
    option?.side, option?.label, option?.text, option?.value,
    option?.name, option?.title, option?.option, `Option ${index + 1}`,
  );
  return {
    id: String(pickFirst(option?.id, option?._id, index)),
    label: String(label),
    side: String(label),
    votes: Number(pickFirst(option?.votes, option?.voteCount, option?._count?.votes, 0)),
    likes: Number(pickFirst(option?.likes, option?.likeCount, 0)),
    percentage: Number(pickFirst(option?.percentage, option?.votePercentage, 0)),
  };
};

const normalizeSideKey = value => String(value || '').trim().toLowerCase();

const getOptionSelectionKey = (option, index) => {
  const optionId = String(option?.id || '');
  const optionSide = normalizeSideKey(pickFirst(option?.side, option?.label, ''));
  return `option-${index}-${optionId}-${optionSide}`;
};

const getCountFromSideMap = (counts = {}, sideValue = '') => {
  if (!counts || typeof counts !== 'object') return undefined;
  const side = String(sideValue || '').trim();
  if (!side) return undefined;
  if (Object.prototype.hasOwnProperty.call(counts, side)) {
    const directValue = Number(counts[side]);
    return Number.isFinite(directValue) ? directValue : undefined;
  }
  const normalizedTarget = normalizeSideKey(side);
  const matchedKey = Object.keys(counts).find(key => normalizeSideKey(key) === normalizedTarget);
  if (!matchedKey) return undefined;
  const normalizedValue = Number(counts[matchedKey]);
  return Number.isFinite(normalizedValue) ? normalizedValue : undefined;
};

const buildSideMetrics = entries => {
  return (Array.isArray(entries) ? entries : []).reduce((acc, entry) => {
    const key = normalizeSideKey(pickFirst(entry?.side, entry?.label, entry?.option, ''));
    if (!key) return acc;
    if (!acc[key]) acc[key] = { count: 0, likes: 0 };
    acc[key].count += 1;
    acc[key].likes += Number(pickFirst(
      entry?.likesCount, entry?.likeCount,
      Array.isArray(entry?.likes) ? entry.likes.length : undefined, 0,
    ));
    return acc;
  }, {});
};

const resolveEntityId = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return String(pickFirst(value?.id, value?._id, value?.userId, value?.UserId, value?.user?.id, value?.user?._id, ''));
};

const normalizeLikeCount = (comment) => {
  if (Array.isArray(comment?.likes)) return comment.likes.length;
  const numericCount = Number(pickFirst(
    comment?.likeCount, comment?.likesCount, comment?._count?.likes, comment?.likes, 0,
  ));
  return Number.isFinite(numericCount) ? numericCount : 0;
};

const normalizeCommentLikedState = (comment, currentUserId = '') => {
  const explicitLikeState = pickFirst(
    comment?.isLiked, comment?.likedByMe, comment?.isLike, comment?.hasLiked, undefined,
  );
  if (typeof explicitLikeState === 'boolean') return explicitLikeState;
  if (typeof explicitLikeState === 'string') {
    const normalizedValue = explicitLikeState.trim().toLowerCase();
    if (normalizedValue === 'true') return true;
    if (normalizedValue === 'false') return false;
  }
  if (!currentUserId) return false;
  const likesList = Array.isArray(comment?.likes)
    ? comment.likes
    : Array.isArray(comment?.likedUsers) ? comment.likedUsers : [];
  return likesList.some((entry) => resolveEntityId(entry) === String(currentUserId));
};

const getCommentReplyEntries = comment => {
  if (Array.isArray(comment?.replies)) return comment.replies;
  if (Array.isArray(comment?.children)) return comment.children;
  return [];
};

const enrichBattleCommentLikes = (comments = [], storedId = '') =>
  (Array.isArray(comments) ? comments : []).map(comment => ({
    ...comment,
    isLiked: Array.isArray(comment?.likes) &&
      comment.likes.some(like => String(like?.userId) === String(storedId)),
    replies: enrichBattleCommentLikes(getCommentReplyEntries(comment), storedId),
  }));

const flattenReplies = (entries, currentUserId = '') =>
  (Array.isArray(entries) ? entries : []).reduce((acc, reply, index) => {
    const normalizedReply = normalizeComment(reply, index, currentUserId);
    const nestedReplies = Array.isArray(normalizedReply.replies) ? normalizedReply.replies : [];
    acc.push({ ...normalizedReply, replies: [] });
    if (nestedReplies.length > 0) acc.push(...flattenReplies(nestedReplies, currentUserId));
    return acc;
  }, []);

const normalizeComment = (comment, index = 0, currentUserId = '') => ({
  id: String(pickFirst(comment?.id, comment?._id, index)),
  parentId: String(pickFirst(comment?.parentId, comment?.parentCommentId, '')),
  message: pickFirst(comment?.message, comment?.comment, comment?.text, ''),
  likes: normalizeLikeCount(comment),
  isLiked: normalizeCommentLikedState(comment, currentUserId),
  userId: String(pickFirst(
    comment?.userId, comment?.user?.id, comment?.user?._id,
    comment?.author?.id, comment?.author?._id, comment?.authorId, '',
  )),
  authorName: pickFirst(
    comment?.user?.name, comment?.user?.displayName, comment?.user?.userName,
    comment?.author?.name, comment?.authorName, 'Valens User',
  ),
  authorHandle: pickFirst(
    comment?.user?.userName, comment?.user?.username,
    comment?.author?.userName, comment?.authorHandle, '',
  ),
  avatar: pickFirst(
    comment?.user?.avatar, comment?.user?.image, comment?.user?.profilePicture,
    comment?.author?.avatar, '',
  ),
  createdAt: pickFirst(comment?.createdAt, comment?.updatedAt, ''),
  replies: flattenReplies(getCommentReplyEntries(comment), currentUserId),
  side: '',
});

const updateCommentTree = (comments, targetId, updater) =>
  (Array.isArray(comments) ? comments : []).map(comment => {
    if (comment.id === targetId) return updater(comment);
    if (Array.isArray(comment.replies) && comment.replies.length > 0) {
      return { ...comment, replies: updateCommentTree(comment.replies, targetId, updater) };
    }
    return comment;
  });

const findCommentInTree = (comments, targetId) => {
  for (const comment of Array.isArray(comments) ? comments : []) {
    if (comment.id === targetId) return comment;
    const nestedMatch = findCommentInTree(comment.replies, targetId);
    if (nestedMatch) return nestedMatch;
  }
  return null;
};

const enrichCommentsWithVoteSide = (comments = [], votesOrPredictions = []) => {
  const userVoteMap = {};
  (Array.isArray(votesOrPredictions) ? votesOrPredictions : []).forEach(entry => {
    const userId = String(pickFirst(entry?.userId, entry?.user?.id, entry?.user?._id, ''));
    if (userId) userVoteMap[userId] = String(pickFirst(entry?.side, ''));
  });
  const enrichComment = (comment, isRoot = true) => ({
    ...comment,
    side: isRoot ? userVoteMap[comment.userId] || '' : '',
    replies: Array.isArray(comment.replies)
      ? comment.replies.map(reply => enrichComment(reply, false))
      : [],
  });
  return (Array.isArray(comments) ? comments : []).map(comment => enrichComment(comment));
};

const normalizeBattle = (raw, currentUserId = '') => {
  const creatorChoice = pickFirst(raw?.creatorChoice, raw?.creatorLockedOption, '');
  const creatorId = String(pickFirst(raw?.creatorId, raw?.createdById, raw?.creator?.id, raw?.creator?._id, ''));
  const headToHeadSides = raw?.headToHeadSides && typeof raw.headToHeadSides === 'object'
    ? raw.headToHeadSides
    : null;
  const headToHeadInvited = headToHeadSides?.invitedUser || {};
  const invitedUserId = String(pickFirst(
    raw?.invitedUser?.id,
    raw?.invitedUser?._id,
    headToHeadInvited?.userId,
    raw?.invites?.[0]?.invitedUserId,
    raw?.invites?.[0]?.invited?.id,
    raw?.invites?.[0]?.invited?._id,
    '',
  ));
  const status = String(pickFirst(raw?.status, raw?.battleStatus, 'OPEN')).toUpperCase();
  const battleType = String(pickFirst(raw?.battleType, raw?.type, 'OPINION')).toUpperCase();
  const format = String(pickFirst(raw?.format, 'POLL')).toUpperCase();
  const participantEntries = Array.isArray(raw?.participants) ? raw.participants : [];
  const predictionEntries = Array.isArray(raw?.predictions) ? raw.predictions : [];
  const voteEntries = Array.isArray(raw?.votes) ? raw.votes : [];
  const sideMetrics = buildSideMetrics(
    format === 'POLL'
      ? predictionEntries.length > 0 ? predictionEntries : participantEntries
      : voteEntries.length > 0 ? voteEntries : participantEntries,
  );
  const rawOptions = Array.isArray(raw?.options) ? raw.options : [];
  const fallbackSides = [
    pickFirst(raw?.creatorChoice, raw?.creatorLockedOption, ''),
    pickFirst(raw?.invitedUserChoice, ''),
  ].filter(Boolean);
  const derivedSides = Object.keys(sideMetrics);
  const baseOptions = rawOptions.length > 0 ? rawOptions : fallbackSides;
  const optionsSource = baseOptions.length > 0 ? baseOptions : derivedSides.length > 0 ? derivedSides : [];
  const normalizedComments = (Array.isArray(raw?.comments) ? raw.comments : []).map(
    (comment, index) => normalizeComment(comment, index, currentUserId),
  );
  const votesOrPredictionsForComments = format === 'POLL'
    ? predictionEntries.length > 0 ? predictionEntries : participantEntries
    : voteEntries.length > 0 ? voteEntries : participantEntries;
  const comments = enrichCommentsWithVoteSide(normalizedComments, votesOrPredictionsForComments);
  const options = optionsSource.map((option, index) => {
    const normalizedOption = normalizeOption(option, index);
    const sideKey = normalizeSideKey(pickFirst(normalizedOption?.side, normalizedOption?.label, ''));
    const metric = sideMetrics[sideKey] || { count: 0, likes: 0 };
    return {
      ...normalizedOption,
      votes: Number(pickFirst(normalizedOption?.votes, metric.count, 0)),
      likes: Number(pickFirst(normalizedOption?.likes, metric.likes, 0)),
    };
  });
  const calculatedTotalVotes = options.reduce((sum, option) => sum + Number(option.votes || 0), 0);
  const totalVotes = Number(pickFirst(
    raw?.totalVotes, raw?.votesCount,
    format === 'HEAD_TO_HEAD' ? raw?._count?.votes : undefined,
    format === 'POLL' ? raw?._count?.participants : undefined,
    format === 'POLL' && participantEntries.length > 0 ? participantEntries.length : undefined,
    format === 'POLL' && predictionEntries.length > 0 ? predictionEntries.length : undefined,
    format === 'HEAD_TO_HEAD' && voteEntries.length > 0 ? voteEntries.length : undefined,
    calculatedTotalVotes, 0,
  ));
  const normalizedOptions = options.map(option => ({
    ...option,
    percentage: totalVotes > 0
      ? Math.round((Number(option.votes || 0) / totalVotes) * 100)
      : Number(option.percentage || 0),
  }));

  return {
    id: String(pickFirst(raw?.id, raw?._id, raw?.battleId, '')),
    title: pickFirst(raw?.title, raw?.question, 'Untitled battle'),
    question: pickFirst(raw?.question, raw?.title, 'Untitled battle'),
    description: pickFirst(raw?.description, raw?.caption, ''),
    format, battleType, status,
    participants: participantEntries,
    predictions: predictionEntries,
    votes: voteEntries,
    options: normalizedOptions,
    totalVotes,
    primaryCount: totalVotes,
    primaryCountLabel: format === 'HEAD_TO_HEAD' ? 'votes' : 'participants',
    totalComments: Number(pickFirst(raw?.totalComments, raw?._count?.comments, comments.length, 0)),
    stake: Number(pickFirst(raw?.stakeAmount, raw?.stake, raw?.pot, 0)),
    endTime: pickFirst(raw?.endTime, raw?.endsAt, ''),
    creatorChoice,
    invitedUserChoice: String(pickFirst(raw?.invitedUserChoice, '')),
    creatorId,
    invitedUserId,
    resultValue: pickFirst(raw?.resultValue, raw?.actualResult, raw?.winningOption, ''),
    winningSide: String(pickFirst(raw?.winningSide, raw?.resultValue, raw?.actualResult, '')),
    winnerUserId: String(pickFirst(raw?.winnerUserId, raw?.winner?.id, raw?.winner?._id, '')),
    winnerName: pickFirst(raw?.winner?.name, raw?.winner?.displayName, raw?.winner?.userName, raw?.winnerName, ''),
    creator: {
      name: pickFirst(raw?.creator?.name, raw?.creator?.displayName, raw?.creator?.userName, 'Creator'),
      handle: pickFirst(raw?.creator?.userName, raw?.creator?.username, ''),
      avatar: pickFirst(raw?.creator?.avatar, raw?.creator?.image, raw?.creator?.profilePicture, ''),
    },
    invitedUser: {
      name: pickFirst(
        raw?.invitedUser?.name,
        raw?.invitedUser?.displayName,
        raw?.invitedUser?.userName,
        headToHeadInvited?.user?.name,
        headToHeadInvited?.user?.displayName,
        headToHeadInvited?.user?.userName,
        raw?.invites?.[0]?.invited?.displayName,
        raw?.invites?.[0]?.invited?.userName,
        'Opponent',
      ),
      handle: pickFirst(
        raw?.invitedUser?.userName,
        raw?.invitedUser?.username,
        headToHeadInvited?.user?.userName,
        raw?.invites?.[0]?.invited?.userName,
        '',
      ),
      avatar: pickFirst(
        raw?.invitedUser?.avatar,
        raw?.invitedUser?.image,
        raw?.invitedUser?.profilePicture,
        headToHeadInvited?.user?.avatar,
        headToHeadInvited?.user?.image,
        raw?.invites?.[0]?.invited?.image,
        '',
      ),
    },
    predictionCounts: raw?.predictionCounts && typeof raw.predictionCounts === 'object' ? raw.predictionCounts : {},
    voteCounts: raw?.voteCounts && typeof raw.voteCounts === 'object' ? raw.voteCounts : {},
    optionImages: Array.isArray(raw?.optionImages) ? raw.optionImages.filter(Boolean) : [],
    comments,
    headToHeadSides: headToHeadSides || undefined,
  };
};

const getStatusTone = (status, t) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('live') || normalized.includes('progress'))
    return { label: t('battleInProgress.statusLive'), color: '#22C55E' };
  if (normalized.includes('finish') || normalized.includes('closed') || normalized.includes('resolved'))
    return { label: t('battleInProgress.statusFinished'), color: '#4B5563' };
  if (normalized.includes('result'))
    return { label: t('battleInProgress.statusResult'), color: '#8B5CF6' };
  return { label: t('battleInProgress.statusOpen'), color: '#0F766E' };
};

const formatBattleTime = (value, t) => {
  if (!value) return t('battleInProgress.endTimeNotSet');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return t('battleInProgress.endTimeNotSet');
  return parsed.toLocaleString();
}

const formatStakeAmount = value => {
  const parsed = Number(value);
  const safeValue = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  return safeValue.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
};

const isSuccessfulResponse = response =>
  (typeof response?.status === 'number' && response.status >= 200 && response.status < 300) ||
  (typeof response?.statusCode === 'number' && response.statusCode >= 200 && response.statusCode < 300) ||
  response?.success === true ||
  response?.error === false;

export default function BattleInProgress() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useLanguage();
  const { profile } = route.params || {};
  const resolvedProfileType = normalizeProfileType(profile);
  const { bgStyle, textStyle, cardStyle, text, card } = useAppTheme(resolvedProfileType);
  const routeBattle = useMemo(() => route?.params?.battle || {}, [route?.params?.battle]);
  const hasInitialBattleData = Object.keys(routeBattle || {}).length > 0;
  const battleId = route?.params?.battleId || routeBattle.id || routeBattle._id || routeBattle.battleId || '';
  const [currentUserId, setCurrentUserId] = useState('');
  const [battle, setBattle] = useState(() => normalizeBattle(routeBattle, ''));
  const [selectedOption, setSelectedOption] = useState(() => String(route?.params?.selectedOption || ''));
  const [optionImagePreviewVisible, setOptionImagePreviewVisible] = useState(false);
  const [optionImagePreviewUri, setOptionImagePreviewUri] = useState('');
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
  const [participantBattleStats, setParticipantBattleStats] = useState({});
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const replyInputRef = useRef(null);
  const scrollRef = useRef(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const statusPulseAnim = useRef(new Animated.Value(1)).current;

  const palette = useMemo(() => {
    const primary = text || '#bb7ef1';
    const secondary = primary.toLowerCase() === '#d3b683' ? '#b8924f' : '#cdb4f8';
    return {
      primary,
      secondary,
      surface: card || '#FFFFFF',
      textMuted: withAlpha(primary, '99'),
      border: withAlpha(primary, '22'),
      soft: withAlpha(primary, '10'),
      buttonGradient: primary.toLowerCase() === '#d3b683'
        ? ['#b8924f', '#D3B683']
        : ['#513189', '#8f54f7'],
    };
  }, [card, text]);

  const statusMeta = useMemo(
    () => getStatusTone(battle.status, t),
    [battle.status, t],
  );
  const isPrediction = battle.format === 'POLL';
  const isHeadToHead = battle.format === 'HEAD_TO_HEAD';
  const resolvedBattleId = String(pickFirst(
    battle?.id, route?.params?.battleId, routeBattle.id, routeBattle._id, routeBattle.battleId, '',
  ));

  const headToHeadAssignedSide = useMemo(() => {
    if (!isHeadToHead) return '';
    const normalizedCurrentUser = String(currentUserId || '');
    if (!normalizedCurrentUser) return '';

    const normalizedCreatorId = String(battle?.creatorId || '');
    const normalizedInvitedId = String(battle?.invitedUserId || '');
    const isParticipant =
      (normalizedCreatorId && normalizedCurrentUser === normalizedCreatorId) ||
      (normalizedInvitedId && normalizedCurrentUser === normalizedInvitedId);

    if (!isParticipant) return '';

    const sides = battle?.headToHeadSides || null;

    const resolveSideFromEntry = (entry) => String(pickFirst(
      entry?.side,
      entry?.label,
      entry?.option,
      entry?.choice,
      entry?.value,
      '',
    ));

    const scanHeadToHeadSides = (sidesObj) => {
      if (!sidesObj || typeof sidesObj !== 'object') return '';
      const values = Object.values(sidesObj);
      for (const entry of values) {
        if (!entry || typeof entry !== 'object') continue;
        const entryUserId = resolveEntityId(pickFirst(entry?.userId, entry?.user, entry?.invitedUser, entry?.creator));
        if (entryUserId && String(entryUserId) === normalizedCurrentUser) {
          const side = resolveSideFromEntry(entry);
          if (side) return side;
        }
      }
      return '';
    };

    if (sides && typeof sides === 'object') {
      if (normalizedCreatorId && normalizedCurrentUser === normalizedCreatorId) {
        const creatorEntry = pickFirst(sides?.creator, sides?.createdBy, sides?.owner, null);
        const side = String(pickFirst(
          resolveSideFromEntry(creatorEntry),
          sides?.creatorSide,
          sides?.creatorChoice,
          battle?.creatorChoice,
          '',
        ));
        if (side) return side;
      }

      if (normalizedInvitedId && normalizedCurrentUser === normalizedInvitedId) {
        const invitedEntry = pickFirst(sides?.invitedUser, sides?.invited, sides?.opponent, null);
        const explicitSide = String(pickFirst(
          resolveSideFromEntry(invitedEntry),
          sides?.invitedUserSide,
          sides?.invitedSide,
          sides?.opponentSide,
          sides?.invitedUserChoice,
          battle?.invitedUserChoice,
          '',
        ));
        if (explicitSide) return explicitSide;

        const creatorSide = String(pickFirst(
          sides?.creatorSide,
          resolveSideFromEntry(pickFirst(sides?.creator, sides?.createdBy, sides?.owner, null)),
          sides?.creatorChoice,
          battle?.creatorChoice,
          '',
        ));
        if (creatorSide) {
          const normalizedCreatorSide = normalizeSideKey(creatorSide);
          const otherOption = (Array.isArray(battle?.options) ? battle.options : []).find((option) => {
            const optionSide = String(pickFirst(option?.side, option?.label, option, ''));
            return normalizeSideKey(optionSide) && normalizeSideKey(optionSide) !== normalizedCreatorSide;
          });
          if (otherOption) {
            return String(pickFirst(otherOption?.side, otherOption?.label, otherOption, ''));
          }
        }
      }

      const scanned = scanHeadToHeadSides(sides);
      if (scanned) return scanned;
    }

    const participantMatch = (Array.isArray(battle?.participants) ? battle.participants : [])
      .find(entry => resolveEntityId(entry) === normalizedCurrentUser || String(entry?.userId || '') === normalizedCurrentUser);
    return String(pickFirst(participantMatch?.side, battle?.creatorChoice, battle?.invitedUserChoice, ''));
  }, [battle?.headToHeadSides, battle?.participants, currentUserId, isHeadToHead]);

  const isHeadToHeadOpponent = useMemo(() => {
    if (!isHeadToHead) return false;
    if (!currentUserId) return false;
    return String(currentUserId) === String(battle.invitedUserId);
  }, [battle.invitedUserId, currentUserId, isHeadToHead]);

  const isHeadToHeadCreator = useMemo(() => {
    if (!isHeadToHead) return false;
    if (!currentUserId) return false;
    return String(currentUserId) === String(battle.creatorId);
  }, [battle.creatorId, currentUserId, isHeadToHead]);

  const userVotedSelection = useMemo(() => {
    if (!currentUserId) return { side: '', optionId: '' };
    const matchByUserId = entry => String(pickFirst(
      entry?.userId, entry?.user?.id, entry?.user?._id,
      entry?.user?.userId, entry?.user?.UserId, '',
    )) === String(currentUserId);
    const submittedEntries = isPrediction
      ? (Array.isArray(battle?.predictions) ? battle.predictions : [])
      : (Array.isArray(battle?.votes) ? battle.votes : []);
    const matchedEntry = submittedEntries.find(matchByUserId);
    if (!matchedEntry) return { side: '', optionId: '' };
    return {
      side: String(pickFirst(matchedEntry?.side, matchedEntry?.label, matchedEntry?.option, '')),
      optionId: String(pickFirst(matchedEntry?.optionId, '')),
    };
  }, [battle?.predictions, battle?.votes, currentUserId, isPrediction]);

  const hasUserVoted = useMemo(
    () => Boolean(userVotedSelection.side || userVotedSelection.optionId),
    [userVotedSelection.optionId, userVotedSelection.side],
  );

  const closeOptionImagePreview = useCallback(() => {
    setOptionImagePreviewVisible(false);
    setOptionImagePreviewUri('');
  }, []);

  const openOptionImagePreview = useCallback((uri) => {
    if (uri) {
      setOptionImagePreviewUri(uri);
      setOptionImagePreviewVisible(true);
    }
  }, []);

  useEffect(() => {
    if (statusMeta.label !== 'LIVE') {
      statusPulseAnim.setValue(1);
      return undefined;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(statusPulseAnim, {
          toValue: 0.35,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(statusPulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    return () => pulse.stop();
  }, [statusMeta.label, statusPulseAnim]);

  const fetchBattle = useCallback(async (isSilent = false) => {
    if (!battleId) { setLoading(false); return; }
    if (!isSilent && !hasInitialBattleData) setLoading(true);
    try {
      const response = await getbattle({ params: { battleId } });
      console.log(response, 'dtaa in this batatlke im geting kya a gete krta hu ')
      const storedId = await AsyncStorage.getItem('userId');
      const rawBattle = response?.data?.battle || response?.data?.data || response?.data || response?.battle || routeBattle;
      const enrichedBattle = {
        ...rawBattle,
        comments: enrichBattleCommentLikes(rawBattle?.comments || [], storedId),
      };
      setBattle(normalizeBattle(enrichedBattle, storedId || currentUserId));
    } catch (error) {
      if (!routeBattle || !Object.keys(routeBattle).length) {
        Alert.alert(
          t('battleInProgress.loadingError'),
          error?.response?.data?.message || error?.message || t('battleInProgress.tryAgain'),
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [battleId, currentUserId, hasInitialBattleData, routeBattle, t]);

  useEffect(() => { getbattle(); }, []);
  useEffect(() => {
    AsyncStorage.getItem('userId').then(value => setCurrentUserId(String(value || '')));
  }, []);
  useEffect(() => { fetchBattle(); }, [fetchBattle]);
  useEffect(() => {
    const routeSelectedOption = String(route?.params?.selectedOption || '');
    if (routeSelectedOption) setSelectedOption(routeSelectedOption);
  }, [route?.params?.selectedOption]);

  useEffect(() => {
    const fetchParticipantData = async () => {
      if (!Array.isArray(battle.participants) || battle.participants.length < 2) return;
      try {
        const participant0 = battle.participants[0];
        const participant1 = battle.participants[1];
        const [res0, res1, points0, points1] = await Promise.all([
          getUserCredentials(participant0?.userId),
          getUserCredentials(participant1?.userId),
          battlePoint({ params: { userId: participant0?.userId } }),
          battlePoint({ params: { userId: participant1?.userId } }),
        ]);
        const userData0 = res0?.statusCode === 200 ? (res0.data?.user || res0.data || {}) : {};
        const userData1 = res1?.statusCode === 200 ? (res1.data?.user || res1.data || {}) : {};
        const formatImageUrl = (image) => {
          if (!image) return '';
          let url = String(image).trim();
          if (url.startsWith('http://') || url.startsWith('https://')) return url;
          else if (url.startsWith('/')) return `http://35.174.167.92:3002${url}`;
          else return `http://35.174.167.92:3002/${url}`;
        };

        const normalizePointPayload = (response) => {
          const rawData = response?.data?.data || response?.data || response || {};
          const totals = rawData?.totals || {};
          return {
            level: String(rawData?.level || 'Rookie'),
            points: Number(totals?.totalBattlePoints || rawData?.points || 0),
            credibility: Number(rawData?.credibilityScore || rawData?.credibility || 0),
          };
        };

        const stats0 = normalizePointPayload(points0);
        const stats1 = normalizePointPayload(points1);

        setParticipantUserData({
          [participant0?.userId]: {
            name: userData0?.displayName || userData0?.name || null,
            image: formatImageUrl(userData0?.image),
            userId: participant0?.userId,
          },
          [participant1?.userId]: {
            name: userData1?.displayName || userData1?.name || null,
            image: formatImageUrl(userData1?.image),
            userId: participant1?.userId,
          },
        });
        setParticipantBattleStats({
          [participant0?.userId]: stats0,
          [participant1?.userId]: stats1,
        });
      } catch (error) {
        console.error('Error fetching participant credentials:', error);
      }
    };
    fetchParticipantData();
  }, [battle.participants]);

  useEffect(() => {
    if (userVotedSelection.optionId) { setSelectedOption(userVotedSelection.optionId); return; }
    if (userVotedSelection.side) setSelectedOption(userVotedSelection.side);
  }, [userVotedSelection.optionId, userVotedSelection.side]);

  useEffect(() => {
    if (!isHeadToHead) return;
    if (!currentUserId) return;
    if (hasUserVoted) return;
    if (!Array.isArray(battle.options) || battle.options.length === 0) return;

    // For head-to-head, only auto-preselect for the invited user (opponent) to avoid
    // locking the creator into a side before they choose.
    const isInvitedUser = String(currentUserId) === String(battle.invitedUserId);
    if (!isInvitedUser) return;

    const lockedSide = String(headToHeadAssignedSide || '').trim();
    if (!lockedSide) return;

    const normalizedLockedSide = normalizeSideKey(lockedSide);
    const matchIndex = battle.options.findIndex((option) => {
      const optionSide = String(pickFirst(option?.side, option?.label, ''));
      return normalizeSideKey(optionSide) === normalizedLockedSide;
    });
    if (matchIndex < 0) return;

    const matchOption = battle.options[matchIndex];
    const nextSelection = getOptionSelectionKey(matchOption, matchIndex);
    if (!selectedOption) {
      setSelectedOption(nextSelection);
      return;
    }

    // If selectedOption is a raw side value (e.g. "A"), normalize it to the option key.
    if (normalizeSideKey(selectedOption) === normalizedLockedSide) {
      setSelectedOption(nextSelection);
    }
  }, [
    battle.creatorId,
    battle.invitedUserId,
    battle.options,
    currentUserId,
    headToHeadAssignedSide,
    hasUserVoted,
    isHeadToHead,
    selectedOption,
  ]);

  useEffect(() => {
    if (hasUserVoted && keepActiveSelectedStyle) {
      const timer = setTimeout(() => setKeepActiveSelectedStyle(false), 500);
      return () => clearTimeout(timer);
    }
  }, [hasUserVoted, keepActiveSelectedStyle]);

  useFocusEffect(useCallback(() => {
    setExpandedReplies({});
    return () => setExpandedReplies({});
  }, []));

  useEffect(() => { setExpandedReplies({}); }, [resolvedBattleId]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));
    return () => { showSubscription.remove(); hideSubscription.remove(); };
  }, []);

  const handleOpenReply = useCallback(comment => {
    setReplyingToComment({
      id: comment?.id || '',
      authorName: comment?.authorName || t('battleInProgress.fallbackUser'),
    });
    setReplyText('');
    setTimeout(() => {
      replyInputRef.current?.focus?.();
      scrollRef.current?.update?.();
    }, 120);
  }, [t]);

  const handleOpenCommentAuthorProfile = useCallback(
    userId => {
      const targetUserId = String(userId || '').trim();
      if (!targetUserId) return;

      if (targetUserId === String(currentUserId || '')) {
        navigation.navigate('ProfileMain', { screen: 'Profile' });
        return;
      }

      const currentRoute = route?.name || 'BattleInProgress';
      navigation.navigate('HomeMain', {
        screen: 'UsersProfile',
        params: {
          userId: targetUserId,
          returnTo: currentRoute,
        },
      });
    },
    [currentUserId, navigation, route?.name],
  );

  const toggleReplies = useCallback(commentId => {
    setExpandedReplies(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  }, []);

  const handleHeroCardPressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  };
  const handleHeroCardPressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  };

  const handleVote = async () => {
    const finalBattleId = resolvedBattleId || battleId;
    const selectedOptionKey = String(selectedOption || '');
    const effectiveSelectedOptionKey = selectedOptionKey;
    const trimmedArgument = argumentText.trim();

    if (!finalBattleId) {
      Alert.alert(t('battleInProgress.voteAlertMissingBattle'), t('battleInProgress.voteAlertMissingBattleMsg'));
      return;
    }
    if (!effectiveSelectedOptionKey) {
      Alert.alert(
        t('battleInProgress.voteAlertSelectOption'),
        isPrediction
          ? t('battleInProgress.voteAlertSelectPredictionMsg')
          : t('battleInProgress.voteAlertSelectVoteMsg'),
      );
      return;
    }
    const selectedBattleOption = battle.options.find((option, index) => {
      const optionSide = String(pickFirst(option?.side, option?.label, ''));
      return (
        getOptionSelectionKey(option, index) === effectiveSelectedOptionKey ||
        optionSide === effectiveSelectedOptionKey ||
        String(option?.id || '') === effectiveSelectedOptionKey
      );
    });
    const finalSelectedOption = String(pickFirst(
      selectedBattleOption?.side,
      selectedBattleOption?.label,
      effectiveSelectedOptionKey,
    ));
    let payload;
    if (isPrediction) {
      payload = {
        battleId: finalBattleId,
        side: finalSelectedOption,
        justification: trimmedArgument || 'No justification provided',
        comment: trimmedArgument,
        sourceUrl: '',
      };
    } else {
      payload = {
        battleId: finalBattleId,
        optionId: String(selectedBattleOption?.id || ''),
        side: finalSelectedOption,
        comment: trimmedArgument,
      };
    }
    setSubmittingVote(true);
    try {
      let response;
      if (isPrediction) response = await predictBattle(payload);
      else if (isHeadToHead && isHeadToHeadOpponent) {
        response = await voteHeadtoHeadOpponent({ battleId: finalBattleId, comment: trimmedArgument });
      } else if (isHeadToHead && isHeadToHeadCreator) {
        response = await voteHeadtoHead(payload);
      } else {
        response = await voteBattle(payload);
      }
      if (!isSuccessfulResponse(response)) {
        Alert.alert(
          isPrediction ? t('battleInProgress.predictionNotSubmitted') : t('battleInProgress.voteNotSubmitted'),
          response?.message || t('battleInProgress.tryAgain'),
        );
        return;
      }
      setArgumentText('');
      setKeepActiveSelectedStyle(true);
      await fetchBattle(true);

      Alert.alert(
        isPrediction ? t('battleInProgress.predictionSubmitted') : t('battleInProgress.voteSubmitted'),
        isPrediction ? t('battleInProgress.predictionSubmittedMsg') : t('battleInProgress.voteSubmittedMsg'),
      );
    } catch (error) {
      Alert.alert(
        isPrediction ? t('battleInProgress.predictionNotSubmitted') : t('battleInProgress.voteNotSubmitted'),
        error?.response?.data?.message || error?.message || t('battleInProgress.tryAgain'),
      );
    } finally {
      setSubmittingVote(false);
    }
  };

  const handlePostComment = async () => {
    const message = commentText.trim();
    if (!message || !battleId) return;
    setSubmittingComment(true);
    try {
      const response = await commentUpload({ battleId, comment: message, message });
      if (!isSuccessfulResponse(response)) {
        Alert.alert(t('battleInProgress.commentNotPosted'), response?.message || t('battleInProgress.tryAgain'));
        return;
      }
      setCommentText('');
      await fetchBattle(true);
    } catch (error) {
      Alert.alert(
        t('battleInProgress.commentNotPosted'),
        error?.response?.data?.message || error?.message || t('battleInProgress.tryAgain'),
      );
    } finally {
      setSubmittingComment(false);
    }
  };

  const handlePostReply = async () => {
    const message = replyText.trim();
    if (!message || !battleId || !replyingToComment?.id) return;
    const parentCommentId = replyingToComment.id;
    setSubmittingComment(true);
    try {
      const response = await replyCommentBattle({ battleId, comment: message, parentCommentId });
      if (!isSuccessfulResponse(response)) {
        Alert.alert(t('battleInProgress.replyNotPosted'), response?.message || t('battleInProgress.tryAgain'));
        return;
      }
      setReplyText('');
      setReplyingToComment(null);
      setExpandedReplies(prev => ({ ...prev, [parentCommentId]: false }));
      await fetchBattle(true);
    } catch (error) {
      Alert.alert(
        t('battleInProgress.replyNotPosted'),
        error?.response?.data?.message || error?.message || t('battleInProgress.tryAgain'),
      );
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCommentLike = async (commentId) => {
    if (!commentId || !battleId) return;
    const targetComment = findCommentInTree(battle.comments, commentId);
    if (!targetComment) return;
    setLikingCommentId(commentId);
    const previousCommentState = {
      isLiked: !!targetComment.isLiked,
      likes: Number.isFinite(Number(targetComment.likes)) ? Number(targetComment.likes) : 0,
    };
    setBattle(prevBattle => ({
      ...prevBattle,
      comments: updateCommentTree(prevBattle.comments, commentId, item => ({
        ...item,
        isLiked: !previousCommentState.isLiked,
        likes: previousCommentState.isLiked
          ? Math.max(previousCommentState.likes - 1, 0)
          : previousCommentState.likes + 1,
      })),
    }));
    try {
      const response = await commentLike({ battleId, commentId });
      if (!isSuccessfulResponse(response)) throw new Error('Like failed');
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
        t('battleInProgress.likeCommentFailed'),
        error?.response?.data?.message || error?.message || t('battleInProgress.tryAgain'),
      );
    } finally {
      setLikingCommentId('');
    }
  };

  const handleBackPress = () => {
    const backTarget = route.params?.returnTo;
    const returnParams = route.params?.returnParams;
    const entryPoint = route.params?.entryPoint;

    if (backTarget) {
      navigation.navigate(backTarget, returnParams);
      return;
    }

    if (entryPoint === 'notifications') {
      navigation.dispatch(StackActions.pop(1));
      navigation.getParent()?.navigate('HomeMain', {
        screen: 'HeartNotification',
      });
      return;
    }

    navigation.goBack();
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.loaderWrap, bgStyle]}>
        <ActivityIndicator size="large" color={text} />
      </SafeAreaView>
    );
  }

  // ─── render helpers ────────────────────────────────────────────────────────

  const renderReplyItem = reply => (
    <View
      key={reply.id}
      style={[styles.replyCard, { backgroundColor: withAlpha(palette.primary, '08'), borderColor: palette.border }]}
    >
      <View style={styles.commentHeader}>
        <View style={styles.commentAuthorIdentity}>
          <TouchableOpacity activeOpacity={0.75} onPress={() => handleOpenCommentAuthorProfile(reply.userId)}>
            {reply.avatar ? (
              <Image source={{ uri: reply.avatar }} style={styles.commentAvatar} />
            ) : (
              <View style={[styles.commentAvatar, styles.commentAvatarFallback]}>
                <Ionicons name="person-outline" size={16} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.commentAuthorTextWrap}>
            <View style={styles.commentAuthorTopRow}>
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.commentAuthorNameRow}
                onPress={() => handleOpenCommentAuthorProfile(reply.userId)}
              >
                <Text style={[styles.commentAuthorName, textStyle, styles.commentAuthorNameFlex]} numberOfLines={1} ellipsizeMode="tail">
                  {reply.authorName}
                </Text>
              </TouchableOpacity>
              <View style={styles.commentHeaderActions}>
                <TouchableOpacity style={styles.replyTrigger} onPress={() => handleOpenReply(reply)}>
                  <Text style={[styles.replyTriggerText, { color: palette.primary }]}>{t('battleInProgress.replyTrigger')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.commentLikeButton} onPress={() => handleCommentLike(reply.id)} disabled={likingCommentId === reply.id}>
                  {likingCommentId === reply.id ? (
                    <ActivityIndicator size="small" color={palette.primary} />
                  ) : (
                    <>
                      <Ionicons name={reply.isLiked ? 'heart' : 'heart-outline'} size={18} color={reply.isLiked ? '#E11D48' : '#6B7280'} />
                      <Text style={[styles.commentLikeText, { color: reply.isLiked ? '#E11D48' : '#6B7280' }]}>
                        {Number.isFinite(Number(reply.likes)) ? Number(reply.likes) : 0}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
            {!!reply.authorHandle && (
              <TouchableOpacity activeOpacity={0.75} onPress={() => handleOpenCommentAuthorProfile(reply.userId)}>
                <Text style={[styles.commentAuthorHandle, { color: palette.textMuted }]}>@{reply.authorHandle}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
      <Text style={[styles.commentMessage, textStyle]}>{reply.message}</Text>
      {replyingToComment?.id === reply.id && (
        <View style={styles.replyComposer}>
          <Text style={[styles.replyComposerLabel, { color: palette.textMuted }]}>
            {t('battleInProgress.replyingTo').replace('{{name}}', replyingToComment.authorName)}
          </Text>
          <TextInput
            ref={replyInputRef}
            value={replyText}
            onChangeText={setReplyText}
            placeholder={t('battleInProgress.replyPlaceholder')}
            placeholderTextColor="#9CA3AF"
            multiline
            style={[styles.replyInput, textStyle, cardStyle, { borderColor: palette.border }]}
          />
          <View style={styles.replyActions}>
            <TouchableOpacity
              style={[styles.replySecondaryButton, { borderColor: palette.border }]}
              onPress={() => { setReplyingToComment(null); setReplyText(''); }}
            >
              <Text style={[styles.replySecondaryButtonText, { color: palette.textMuted }]}>
                {t('battleInProgress.cancelReply')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.replyPrimaryButton, { backgroundColor: palette.primary }]}
              onPress={handlePostReply}
              disabled={submittingComment}
            >
              {submittingComment
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text style={styles.replyPrimaryButtonText}>{t('battleInProgress.postReply')}</Text>
              }
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
      <View key={comment.id} style={[styles.commentCard, { backgroundColor: palette.soft, borderColor: palette.border }]}>
        <View style={styles.commentHeader}>
          <View style={styles.commentAuthorIdentity}>
            <TouchableOpacity activeOpacity={0.75} onPress={() => handleOpenCommentAuthorProfile(comment.userId)}>
              {comment.avatar ? (
                <Image source={{ uri: comment.avatar }} style={styles.commentAvatar} />
              ) : (
                <View style={[styles.commentAvatar, styles.commentAvatarFallback]}>
                  <Ionicons name="person-outline" size={16} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.commentAuthorTextWrap}>
              <View style={styles.commentAuthorTopRow}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  style={styles.commentAuthorNameRow}
                  onPress={() => handleOpenCommentAuthorProfile(comment.userId)}
                >
                  <Text style={[styles.commentAuthorName, textStyle, styles.commentAuthorNameFlex]} numberOfLines={1} ellipsizeMode="tail">
                    {comment.authorName}
                  </Text>
                  {!!comment.side && (
                    <View style={[styles.commentVoteSideBadge, {
                      backgroundColor: palette.primary,
                      marginRight: Platform.OS === 'ios' ? 14 : 10,
                    }]}>
                      <Text style={styles.commentVoteSideBadgeText}>{comment.side}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <View style={styles.commentHeaderActions}>
                  <TouchableOpacity style={styles.replyTrigger} onPress={() => handleOpenReply(comment)}>
                    <Text style={[styles.replyTriggerText, { color: palette.primary }]}>{t('battleInProgress.replyTrigger')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.commentLikeButton} onPress={() => handleCommentLike(comment.id)} disabled={likingCommentId === comment.id}>
                    {likingCommentId === comment.id ? (
                      <ActivityIndicator size="small" color={palette.primary} />
                    ) : (
                      <>
                        <Ionicons name={comment.isLiked ? 'heart' : 'heart-outline'} size={18} color={comment.isLiked ? '#E11D48' : '#6B7280'} />
                        <Text style={[styles.commentLikeText, { color: comment.isLiked ? '#E11D48' : '#6B7280' }]}>
                          {Number.isFinite(Number(comment.likes)) ? Number(comment.likes) : 0}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
              {!!comment.authorHandle && (
                <TouchableOpacity activeOpacity={0.75} onPress={() => handleOpenCommentAuthorProfile(comment.userId)}>
                  <Text style={[styles.commentAuthorHandle, { color: palette.textMuted }]}>@{comment.authorHandle}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
        <Text style={[styles.commentMessage, textStyle]}>{comment.message}</Text>
        {hasReplies && !isExpanded && (
          <TouchableOpacity style={styles.viewRepliesButton} onPress={() => toggleReplies(comment.id)}>
            <Text style={[styles.viewRepliesText, { color: palette.primary }]}>
              {t('battleInProgress.viewReplies').replace('{{count}}', repliesCount)}
            </Text>
          </TouchableOpacity>
        )}
        {hasReplies && isExpanded && (
          <TouchableOpacity style={styles.viewRepliesButton} onPress={() => toggleReplies(comment.id)}>
            <Text style={[styles.viewRepliesText, { color: palette.primary }]}>
              {t('battleInProgress.hideReplies')}
            </Text>
          </TouchableOpacity>
        )}
        {replyingToComment?.id === comment.id && (
          <View style={styles.replyComposer}>
            <Text style={[styles.replyComposerLabel, { color: palette.textMuted }]}>
              {t('battleInProgress.replyingTo').replace('{{name}}', replyingToComment.authorName)}
            </Text>
            <TextInput
              ref={replyInputRef}
              value={replyText}
              onChangeText={setReplyText}
              placeholder={t('battleInProgress.replyPlaceholder')}
              placeholderTextColor="#9CA3AF"
              multiline
              style={[styles.replyInput, textStyle, cardStyle, { borderColor: palette.border }]}
            />
            <View style={styles.replyActions}>
              <TouchableOpacity
                style={[styles.replySecondaryButton, { borderColor: palette.border }]}
                onPress={() => { setReplyingToComment(null); setReplyText(''); }}
              >
                <Text style={[styles.replySecondaryButtonText, { color: palette.textMuted }]}>
                  {t('battleInProgress.cancelReply')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.replyPrimaryButton, { backgroundColor: palette.primary }]}
                onPress={handlePostReply}
                disabled={submittingComment}
              >
                {submittingComment
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={styles.replyPrimaryButtonText}>{t('battleInProgress.postReply')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}
        {Array.isArray(visibleReplies) && visibleReplies.length > 0 && (
          <View style={styles.repliesSection}>{visibleReplies.map(renderReplyItem)}</View>
        )}
      </View>
    );
  };

  // ─── render hero card ──────────────────────────────────────────────────────

  const renderHeroCard = () => (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <View style={styles.heroTopRow}>
        <View style={[styles.statusPill, { backgroundColor: withAlpha(statusMeta.color, '1F') }]}>
          <Animated.View style={[styles.statusDot, { backgroundColor: statusMeta.color, opacity: statusPulseAnim }]} />
          <Text style={[styles.statusPillText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
        </View>
        <View style={styles.timerPill}>
          <Ionicons name="time-outline" size={12} color="#000" />
          <Text style={[styles.timerPillText, { color: text }]}>{formatBattleTime(battle.endTime)}</Text>
        </View>
      </View>
      <View>
        <Text style={[styles.heroTitle, { color: text }]}>{battle.title}</Text>
      </View>
      <View>
        <View style={styles.heroInfoRow}>
          <View style={styles.heroInfoChip}>
            <Ionicons name="people-outline" size={12} color="#000" />
            <Text style={[styles.heroInfoText, { color: text }]}>{battle.primaryCount} {battle.primaryCountLabel}</Text>
          </View>
          <View style={styles.heroInfoChip}>
            <Ionicons name="calendar-outline" size={12} color="#000" />
            <Text style={[styles.heroInfoText, { color: text }]}>{battle.format === 'HEAD_TO_HEAD' ? 'Head-to-Head' : 'Battle Poll'}</Text>
          </View>
          <View style={styles.heroInfoChip}>
            <Ionicons name="flash" size={12} color="#000" />
            <Text style={[styles.heroInfoText, { color: text }]}>
              Stakes: {formatStakeAmount(battle.stake)}
            </Text>
          </View>
        </View>
      </View>
      <TouchableOpacity activeOpacity={0.9} onPressIn={handleHeroCardPressIn} onPressOut={handleHeroCardPressOut}>
        <LinearGradient
          colors={[palette.secondary, palette.primary, palette.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          {/* Creator row */}
          <TouchableOpacity
            activeOpacity={0.75}
            style={styles.heroCreatorRow}
            onPress={() => handleOpenCommentAuthorProfile(battle.creatorId)}
          >
            <HexAvatar uri={battle.creator?.avatar || FALLBACK_AVATAR} size={28} borderWidth={2} borderColor="rgba(255,255,255,0.7)" />
            <View style={{ marginLeft: 8, flexShrink: 1 }}>
              <Text style={styles.heroCreatorName} numberOfLines={1}>{battle.creator?.name}</Text>
              {!!battle.creator?.handle && (
                <Text style={styles.heroCreatorHandle} numberOfLines={1}>@{battle.creator.handle}</Text>
              )}
            </View>
          </TouchableOpacity>
          {/* Top row */}
          {/* <View style={styles.heroTopRow}>
            <View style={[styles.statusPill, { backgroundColor: withAlpha(statusMeta.color, '1F') }]}>
              <Animated.View style={[styles.statusDot, { backgroundColor: statusMeta.color, opacity: statusPulseAnim }]} />
              <Text style={[styles.statusPillText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
            </View>
            <View style={styles.timerPill}>
              <Ionicons name="time-outline" size={12} color="#fff" />
              <Text style={styles.timerPillText}>{formatBattleTime(battle.endTime, t)}</Text>
            </View>
          </View> */}

          {/* Title + description */}
          {!!isHeadToHead && (() => {
            const creatorName = String(battle?.creator?.name || '').trim();
            const creatorId = String(battle?.creatorId || battle?.creator?.id || '').trim();
            const participants = Array.isArray(battle?.participants) ? battle.participants : [];
            const opponent = participants.find(p => String(p?.userId || '') && String(p?.userId || '') !== creatorId);
            const opponentName = String(
              pickFirst(
                participantUserData?.[opponent?.userId]?.name,
                battle?.opponent?.name,
                battle?.invitedUser?.name,
                battle?.user2?.name,
                '',
              ),
            ).trim();
            if (!creatorName || !opponentName) return null;
            return (
              <Text style={styles.heroChallengeLine} numberOfLines={2}>
                <Text style={styles.heroChallengeStrong}>{creatorName}</Text>
                {' challenged '}
                <Text style={styles.heroChallengeStrong}>{opponentName}</Text>
              </Text>
            );
          })()}
          {/* <Text style={styles.heroTitle}>{battle.title}</Text> */}
          {!!battle.description && <Text style={styles.heroDescription}>{battle.description}</Text>}

          {/* Meta chips */}
          {/* <View style={styles.heroInfoRow}>
            <View style={styles.heroInfoChip}>
              <Ionicons name="people-outline" size={12} color="#fff" />
              <Text style={styles.heroInfoText}>
                {battle.primaryCount} {t(battle.primaryCountLabel === 'votes' ? 'battleInProgress.primaryLabelVotes' : 'battleInProgress.primaryLabelParticipants')}
              </Text>
            </View>
            <View style={styles.heroInfoChip}>
              <Ionicons name="calendar-outline" size={12} color="#fff" />
              <Text style={styles.heroInfoText}>
                {battle.format === 'HEAD_TO_HEAD'
                  ? t('battleInProgress.formatHeadToHead')
                  : t('battleInProgress.formatPoll')}
              </Text>
            </View>
            <View style={styles.heroInfoChip}>
              <Ionicons name="flash" size={12} color="#fff" />
              <Text style={styles.heroInfoText}>
                Stakes: {formatStakeAmount(battle.stake)}
              </Text>
            </View>
          </View> */}

          {/* Duel player cards */}
          {isHeadToHead && Array.isArray(battle.participants) && battle.participants.length >= 2 && (
            <View style={{ position: 'relative', marginBottom: 14 }}>
              <View style={styles.duelRow}>
                {(() => {
                  const p0 = battle.participants[0];
                  const p1 = battle.participants[1];
                  const d0 = participantUserData[p0?.userId] || {};
                  const d1 = participantUserData[p1?.userId] || {};
                  const sides = battle?.headToHeadSides || {};
                  const openingForUser = (userId, participant) => {
                    const safeUserId = String(userId || '');
                    const fromCreator = safeUserId && String(sides?.creator?.userId || '') === safeUserId
                      ? sides?.creator?.openingArgument
                      : '';
                    const fromInvited = safeUserId && String(sides?.invitedUser?.userId || '') === safeUserId
                      ? sides?.invitedUser?.openingArgument
                      : '';
                    return pickFirst(fromCreator, fromInvited, participant?.openingArgument, '');
                  };
                  const opening0 = openingForUser(p0?.userId, p0);
                  const opening1 = openingForUser(p1?.userId, p1);
                  const navigateToUser = (userId) => {
                    if (currentUserId === userId) navigation.navigate('ProfileMain', { screen: 'Profile' });
                    else navigation.navigate('HomeMain', {
                      screen: 'UsersProfile',
                      params: { userId, returnTo: route?.name || 'BattleInProgress' },
                    });
                  };
                  return (
                    <>
                      <TouchableOpacity activeOpacity={0.75} onPress={() => navigateToUser(p0?.userId)} style={styles.duelPlayerCard}>
                        <LinearGradient
                          colors={['rgba(59,130,246,0.38)', 'rgba(29,78,216,0.18)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.duelPlayerCardBg}
                        />
                        <View style={styles.cornerBadgeTopLeft}>
                          <Ionicons name="shield" size={16} color="#fff" />
                        </View>
                        <View style={styles.avatarBadgeWrap}>
                          <HexAvatar uri={d0?.image || FALLBACK_AVATAR} size={64} borderWidth={2} borderColor="rgba(255,255,255,0.85)" />
                          {!!participantBattleStats?.[p0?.userId]?.level && (
                            <View style={styles.playerBadge}>
                              <Ionicons name="ribbon" size={12} color="#111827" />
                              <Text style={styles.playerBadgeText} numberOfLines={1}>
                                {String(participantBattleStats[p0.userId].level).slice(0, 10)}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.playerName} numberOfLines={2}> {d0?.name || t('battleInProgress.fallbackUser')}</Text>
                        <Text style={styles.playerPoints} numberOfLines={1}>
                          {Number(participantBattleStats?.[p0?.userId]?.points || 0).toLocaleString()} pts
                        </Text>
                        <View style={styles.playerSidePill}>
                          <Text style={styles.playerSidePillText}>{p0?.side}</Text>
                        </View>
                        <View>
                          <Text style={[styles.playerName, { color: '#fff' }]}>{d0?.name || 'User'} Says:</Text>
                        </View>
                        {!!opening0 && (
                          <Text style={styles.playerOpeningArgument} numberOfLines={3}>
                            {opening0}
                          </Text>
                        )}
                      </TouchableOpacity>

                      <View style={styles.duelVsWrapOverlay}>
                        <Vsbanner height={80} width={80} />
                        <Text style={[styles.duelVsText, { position: 'absolute' }]}>VS</Text>
                      </View>

                      <TouchableOpacity activeOpacity={0.75} onPress={() => navigateToUser(p1?.userId)} style={styles.duelPlayerCard}>
                        <LinearGradient
                          colors={['rgba(244,114,182,0.38)', 'rgba(219,39,119,0.18)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.duelPlayerCardBg}
                        />
                        <View style={styles.cornerBadgeTopRight}>
                          <Ionicons name="flash" size={16} color="#fff" />
                        </View>
                        <View style={styles.avatarBadgeWrap}>
                          <HexAvatar uri={d1?.image || FALLBACK_AVATAR} size={64} borderWidth={2} borderColor="rgba(255,255,255,0.85)" />
                          {!!participantBattleStats?.[p1?.userId]?.level && (
                            <View style={styles.playerBadge}>
                              <Ionicons name="ribbon" size={12} color="#111827" />
                              <Text style={styles.playerBadgeText} numberOfLines={1}>
                                {String(participantBattleStats[p1.userId].level).slice(0, 10)}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.playerName} numberOfLines={2}>{d1?.name || t('battleInProgress.fallbackUser')}</Text>
                        <Text style={styles.playerPoints} numberOfLines={1}>
                          {Number(participantBattleStats?.[p1?.userId]?.points || 0).toLocaleString()} pts
                        </Text>
                        <View style={styles.playerSidePill}>
                          <Text style={styles.playerSidePillText}>{p1?.side}</Text>
                        </View>
                        <View>
                          <Text style={[styles.playerName, { color: '#fff' }]}>{d1?.name || 'User'} Says:</Text>
                        </View>
                        {!!opening1 && (
                          <Text style={styles.playerOpeningArgument} numberOfLines={3}>
                            {opening1}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </>
                  );
                })()}
              </View>
            </View>
          )}

          {/* Progress bar */}
          <View style={styles.progressCard}>
            {(() => {
              const options = Array.isArray(battle.options) ? battle.options : [];
              const leftOption = options[0] || {};
              const rightOption = options[1] || {};
              const leftLabel = String(pickFirst(leftOption?.label, leftOption?.side, 'Option 1'));
              const rightLabel = String(pickFirst(rightOption?.label, rightOption?.side, 'Option 2'));
              const leftSide = String(pickFirst(leftOption?.side, leftOption?.label, ''));
              const rightSide = String(pickFirst(rightOption?.side, rightOption?.label, ''));
              const leftVotes = Number(pickFirst(
                getCountFromSideMap(battle?.voteCounts, leftSide),
                getCountFromSideMap(battle?.predictionCounts, leftSide),
                getCountFromSideMap(battle?.voteCounts, leftLabel),
                getCountFromSideMap(battle?.predictionCounts, leftLabel),
                leftOption?.votes, 0,
              ));
              const rightVotes = Number(pickFirst(
                getCountFromSideMap(battle?.voteCounts, rightSide),
                getCountFromSideMap(battle?.predictionCounts, rightSide),
                getCountFromSideMap(battle?.voteCounts, rightLabel),
                getCountFromSideMap(battle?.predictionCounts, rightLabel),
                rightOption?.votes, 0,
              ));
              const total = leftVotes + rightVotes;
              const leftPct = total > 0 ? Math.round((leftVotes / total) * 100) : 0;
              const rightPct = total > 0 ? 100 - leftPct : 0;

              return (
                <>
                  <View style={styles.progressTopRow}>
                    <View>
                      <Text style={styles.progressPctLeft}>{leftPct}%</Text>
                      <Text style={styles.progressVotes}>
                        {leftVotes} {t('battleInProgress.votesLabel')}
                      </Text>
                    </View>
                    <View style={styles.progressMidCol}>
                      {total > 0 && leftPct === rightPct && (
                        <Text style={styles.progressTiedLabel}>{t('battleInProgress.tiedLabel')}</Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.progressPctRight}>{rightPct}%</Text>
                      <Text style={styles.progressVotes}>
                        {rightVotes} {t('battleInProgress.votesLabel')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarLeft, { flex: leftPct || 1 }]} />
                    <View style={[styles.progressBarRight, { flex: rightPct || 1 }]} />
                  </View>
                  <View style={styles.progressBottomRow}>
                    <View style={styles.sideTagLeft}><Text style={styles.sideTagText}>{leftLabel}</Text></View>
                    <View style={styles.sideTagRight}><Text style={styles.sideTagText}>{rightLabel}</Text></View>
                  </View>
                </>
              );
            })()}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  // ─── render how to win ─────────────────────────────────────────────────────

  const renderHowToWinCard = () => (
    <View style={[styles.howToWinCard, cardStyle, { shadowColor: palette.primary }]}>
      <Text style={[styles.howToWinTitle, { color: text }]}>
        {t('battleInProgress.howToWinTitle')}
      </Text>
      <View style={styles.howToWinRow}>
        {[
          {
            icon: 'checkmark-circle',
            color: text,
            label: t('battleInProgress.howToWinVoteLabel'),
            desc: t('battleInProgress.howToWinVoteDesc'),
          },
          {
            icon: 'chatbubble-ellipses',
            color: text,
            label: t('battleInProgress.howToWinCommentLabel'),
            desc: t('battleInProgress.howToWinCommentDesc'),
          },
          {
            icon: 'star',
            color: text,
            label: t('battleInProgress.howToWinAccurateLabel'),
            desc: t('battleInProgress.howToWinAccurateDesc'),
          },
        ].map((item, i) => (
          <View key={i} style={[styles.howToWinItem, bgStyle]}>
            <View style={[styles.howToWinIconCircle, { backgroundColor: item.color }]}>
              <Ionicons name={item.icon} size={14} color="#fff" />
            </View>
            <Text style={[styles.howToWinItemLabel, { color: item.color }]}>{item.label}</Text>
            <Text style={styles.howToWinItemDesc}>{item.desc}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  // ─── main render ──────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAwareScrollView
          style={[styles.container, bgStyle]}
          contentContainerStyle={[
            styles.contentContainer,
            styles.keyboardAwareContentContainer,
            isKeyboardVisible && styles.keyboardOpenContentContainer,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={null}
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          enableOnAndroid
          enableAutomaticScroll
          extraScrollHeight={32}
          keyboardOpeningTime={0}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBackPress} style={styles.headerIconBtn}>
              <Icon name="arrow-back-ios-new" size={20} color={text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: text }]}>
              {t('battleInProgress.screenTitle')}
            </Text>
            <TouchableOpacity
              onPress={() => { setRefreshing(true); fetchBattle(true); }}
              style={styles.headerIconBtn}
            >
              {refreshing
                ? <ActivityIndicator size="small" color={text} />
                : <Ionicons name="refresh-outline" size={20} color={text} />
              }
            </TouchableOpacity>
          </View>

          {renderHeroCard()}
          {renderHowToWinCard()}

          {/* Winner Logic */}
          <View style={[styles.infoCard, cardStyle, { shadowColor: palette.primary }]}>
            <Text style={[styles.sectionTitle, { color: text }]}>
              {t('battleInProgress.winnerLogicTitle')}
            </Text>
            <Text style={[styles.infoText, textStyle]}>
              {isPrediction
                ? t('battleInProgress.winnerLogicPrediction')
                : t('battleInProgress.winnerLogicOpinion')}
            </Text>
            {!!battle.resultValue && (
              <Text style={[styles.resultText, textStyle]}>
                {t('battleInProgress.currentResultSignal').replace('{{value}}', battle.resultValue)}
              </Text>
            )}
            {!!battle.winnerName && (
              <Text style={[styles.resultText, textStyle]}>
                {t('battleInProgress.winner').replace('{{name}}', battle.winnerName)}
              </Text>
            )}
          </View>

          {/* Choose Your Side / Make Prediction */}
          <View style={[styles.infoCard, cardStyle, { shadowColor: palette.primary }]}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: text }]}>
                {isPrediction ? t('battleInProgress.makePrediction') : t('battleInProgress.chooseYourSide')}
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  navigation.navigate('BattleVoteDetails', {
                    battleId: resolvedBattleId || battleId,
                    battle,
                    profile,
                  });
                }}
                style={[styles.viewVotesBtn, { borderColor: palette.border }]}
              >
                <Text style={[styles.viewVotesText, { color: palette.primary }]}>
                  View votes
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.optionGrid, { width: '100%' }]}>
              {battle.options.map((option, index) => {
                const optionImage = battle.optionImages?.[index];
                const optionSide = String(pickFirst(option?.side, option?.label, ''));
                const optionSelectionKey = getOptionSelectionKey(option, index);
                // Use the same selected color styling as poll battles (single theme accent),
                // instead of the legacy head-to-head blue/pink accents.
                const headToHeadAccent = { accent: palette.primary, soft: palette.soft };
                const normalizedSelected = normalizeSideKey(selectedOption);
                const normalizedOptionSide = normalizeSideKey(optionSide);
                const isSelectedByTap = selectedOption === optionSelectionKey;
                const isSelectedByInitialValue =
                  (normalizedOptionSide && normalizedSelected && normalizedOptionSide === normalizedSelected) ||
                  (option.id && selectedOption === String(option.id));
                const isSelectedByVote =
                  (userVotedSelection.optionId && userVotedSelection.optionId === String(option.id)) ||
                  (userVotedSelection.side && normalizedOptionSide && normalizeSideKey(userVotedSelection.side) === normalizedOptionSide);
                const isSelectedByAssignedSide =
                  isHeadToHead &&
                  !!headToHeadAssignedSide &&
                  normalizedOptionSide &&
                  normalizeSideKey(headToHeadAssignedSide) === normalizedOptionSide;
                const isSelected = hasUserVoted
                  ? isSelectedByVote
                  : isSelectedByAssignedSide || isSelectedByTap || isSelectedByInitialValue;
                const useVotedGrayStyle = hasUserVoted && !keepActiveSelectedStyle;
                const isHeadToHeadParticipant = isHeadToHead && (isHeadToHeadCreator || isHeadToHeadOpponent);
                // Only lock the opposite option for the invited user (opponent) when we know their assigned side.
                // The creator should be able to choose either side until they vote.
                const canLockToAssignedSide = isHeadToHeadOpponent && !!headToHeadAssignedSide;
                const isMyHeadToHeadSide =
                  canLockToAssignedSide &&
                  normalizedOptionSide &&
                  normalizeSideKey(headToHeadAssignedSide) === normalizedOptionSide;
                // Only lock options when we actually know the assigned side.
                // Otherwise allow selecting either option (same behavior as poll).
                const shouldDisable = hasUserVoted || (canLockToAssignedSide && !isMyHeadToHeadSide);
                return (
                  <TouchableOpacity
                    key={`${battle.id}-${option.id}-${index}`}
                    disabled={shouldDisable}
                    activeOpacity={0.88}
                    style={[
                      styles.optionPillCard,
                      {
                        borderColor: isSelected ? (useVotedGrayStyle ? '#D1D5DB' : headToHeadAccent.accent) : '#E5E7EB',
                        backgroundColor: isSelected
                          ? (useVotedGrayStyle ? '#F3F4F6' : headToHeadAccent.soft)
                          : '#F9FAFB',
                        opacity: shouldDisable && !isSelected ? 0.6 : 1,
                        width: '100%',
                      },
                    ]}
                    onPress={() => { if (!shouldDisable) setSelectedOption(optionSelectionKey); }}
                  >
                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={styles.optionPillAvatarWrap}
                      onPress={(e) => { e?.stopPropagation?.(); openOptionImagePreview(optionImage || option.image); }}
                    >
                      <HexAvatar
                        uri={optionImage || option.image}
                        size={36}
                        borderWidth={2}
                        borderColor={isSelected ? headToHeadAccent.accent : '#D1D5DB'}
                        fallback={
                          <View style={[
                            styles.optionPillAvatarFallback,
                            {
                              borderColor: isSelected ? (useVotedGrayStyle ? '#D1D5DB' : headToHeadAccent.accent) : '#D1D5DB',
                              backgroundColor: isSelected ? (useVotedGrayStyle ? '#E5E7EB' : headToHeadAccent.soft) : '#EDE9F6',
                            },
                          ]}>
                            <Ionicons name="person" size={18} color={isSelected ? headToHeadAccent.accent : text} />
                          </View>
                        }
                      />
                    </TouchableOpacity>
                    <Text
                      style={[
                        styles.optionPillLabel,
                        { color: isSelected ? (useVotedGrayStyle ? text : headToHeadAccent.accent) : '#374151' },
                      ]}
                      onPress={() => { if (!shouldDisable) setSelectedOption(optionSelectionKey); }}
                    >
                      {option.label}
                    </Text>
                    <View style={[
                      styles.optionPillRadio,
                      {
                        borderColor: isSelected ? (useVotedGrayStyle ? text : headToHeadAccent.accent) : '#D1D5DB',
                        backgroundColor: isSelected ? (useVotedGrayStyle ? text : headToHeadAccent.accent) : '#FFFFFF',
                        opacity: hasUserVoted && !isSelected ? 0.3 : 1,
                      },
                    ]} />
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.argumentLabel}>
              {hasUserVoted ? 'Comment' : 'Your argument'}
            </Text>
            <TextInput
              editable
              value={hasUserVoted ? commentText : argumentText}
              onChangeText={hasUserVoted ? setCommentText : setArgumentText}
              onFocus={() => scrollRef.current?.update?.()}
              placeholder={
                hasUserVoted
                  ? t('battleInProgress.commentPlaceholder')
                  : isPrediction
                    ? t('battleInProgress.predictionReasoningPlaceholder')
                    : t('battleInProgress.argumentPlaceholder')
              }
              placeholderTextColor="#9CA3AF"
              multiline
              style={[styles.argumentInput, textStyle, cardStyle, { borderColor: palette.border }]}
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
                opacity: (submittingVote || (!hasUserVoted && !argumentText?.trim()) || (hasUserVoted && !commentText?.trim())) ? 0.5 : 1,
              }}
            >
              <LinearGradient
                colors={palette.buttonGradient}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.primaryButton}
              >
                {submittingVote
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={styles.primaryButtonText}>
                    {hasUserVoted
                      ? t('battleInProgress.addComment')
                      : isPrediction
                        ? t('battleInProgress.submitPrediction')
                        : t('battleInProgress.voteInBattle')}
                  </Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Comments */}
          <View style={[styles.infoCard, cardStyle, { shadowColor: palette.primary }]}>
            {battle.comments.length > 0
              ? battle.comments.map(comment => renderCommentItem(comment))
              : (
                <Text style={[styles.emptyCommentText, textStyle]}>
                  {t('battleInProgress.noCommentsYet')}
                </Text>
              )
            }
          </View>

          {/* Bottom actions */}
          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={[styles.secondaryButton, cardStyle, { borderColor: palette.primary }]}
              onPress={() => navigation.navigate('BattleResults', {
                battleId: battle.id || battleId,
                battle,
                predictionCounts: battle?.predictionCounts || {},
                winnerUserId: battle?.winnerUserId || '',
                winningSide: battle?.winningSide || '',
                entryPoint: route?.params?.entryPoint || 'battle_progress',
                profile,
              })}
            >
              <Text style={[styles.secondaryButtonText, { color: palette.primary }]}>
                {t('battleInProgress.viewResults')}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollView>
      </TouchableWithoutFeedback>

      {/* Image preview modal */}
      <Modal
        visible={optionImagePreviewVisible}
        transparent
        animationType="fade"
        onRequestClose={closeOptionImagePreview}
      >
        <Pressable style={styles.optionImagePreviewBackdrop} onPress={closeOptionImagePreview}>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={closeOptionImagePreview}
            style={styles.optionImagePreviewCloseBtn}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <Pressable
            style={styles.optionImagePreviewZoomHost}
            onPress={(e) => e?.stopPropagation?.()}
          >
            {!!optionImagePreviewUri && (
              <ImageZoom
                cropWidth={SCREEN_WIDTH}
                cropHeight={SCREEN_HEIGHT}
                imageWidth={OPTION_IMAGE_PREVIEW_SIZE}
                imageHeight={OPTION_IMAGE_PREVIEW_SIZE}
                enableCenterFocus
              >
                <View style={styles.optionImagePreviewHexWrap}>
                  <HexAvatar
                    uri={optionImagePreviewUri || FALLBACK_AVATAR}
                    size={OPTION_IMAGE_PREVIEW_SIZE}
                    borderWidth={2}
                    borderColor="rgba(255,255,255,0.6)"
                  />
                </View>
              </ImageZoom>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, marginTop: '10%' },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1 },
  contentContainer: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 34 },
  keyboardAwareContentContainer: { flexGrow: 1 },
  keyboardOpenContentContainer: { paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerIconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },

  // ── Hero card (light lavender) ──
  heroCard: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 4,
    marginBottom: 12,
    overflow: Platform.OS === 'ios' ? 'hidden' : 'visible',
  },
  heroCreatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginBottom: 10,
  },
  heroCreatorName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  heroCreatorHandle: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statusPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(232,64,64,0.12)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, gap: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#e84040' },
  statusPillText: { fontSize: 11, fontWeight: '700', color: '#e84040', letterSpacing: 0.4 },
  timerPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(107,95,166,0.12)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, gap: 4 },
  timerPillText: { fontSize: 11, fontWeight: '600', color: "#000" },
  heroChallengeLine: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600', marginBottom: 6, marginHorizontal: 8 },
  heroChallengeStrong: { color: '#FFFFFF', fontWeight: '900' },
  heroTitle: { color: "#000", fontSize: 20, fontWeight: '800', lineHeight: 28, marginBottom: 4, marginHorizontal: 8 },
  heroDescription: { color: "#fff", fontSize: 13, lineHeight: 19, marginBottom: 8 },
  heroInfoRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  heroInfoChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(107,95,166,0.1)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  heroInfoText: { color: "#000", fontSize: 11, fontWeight: '600' },
  heroMetaRight: { alignItems: 'flex-end' },

  // Duel
  duelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, paddingLeft: 5, paddingRight: 15 },
  duelVsWrapOverlay: {
    position: 'absolute',
    top: '60%',
    left: '57%',
    marginLeft: -60,
    marginTop: -60,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  duelVsText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 1,
  },
  duelPlayerCard: { flex: 1, maxWidth: '44%', borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.32)', paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center', gap: 6, overflow: 'hidden' },
  duelPlayerCardBg: { ...StyleSheet.absoluteFillObject, borderRadius: 14 },
  avatarBadgeWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  playerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(17,24,39,0.12)', },
  playerBadgeText: { fontSize: 10, fontWeight: '800', color: '#111827', maxWidth: 72 },
  playerName: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  playerPoints: { color: 'rgba(255,255,255,0.92)', fontSize: 11, fontWeight: '700', marginTop: -2 },
  playerOpeningArgument: { color: 'rgba(255,255,255,0.95)', fontSize: 11, fontWeight: '600', textAlign: 'center', },
  playerSidePill: { backgroundColor: '#ede8fb', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  playerSidePillText: { color: '#6b5fa6', fontSize: 11, fontWeight: '600' },
  vsOverlay: { position: 'absolute', left: '50%', top: '50%', marginLeft: -18, marginTop: -18, zIndex: 10 },
  vsBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#6b3fa0', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ede8fb' },
  vsText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  // Progress
  progressCard: { borderRadius: 12, borderWidth: 1, borderColor: '#d3d1d1', padding: 12, marginBottom: 22, marginRight: 15, marginLeft: 5 },
  progressTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  progressMidCol: { alignItems: 'center', flex: 1, paddingHorizontal: 6 },
  progressTiedLabel: { fontSize: 12, fontWeight: '700', color: '#fff' },
  progressSubLabel: { fontSize: 10, color: '#fff', marginTop: 2 },
  progressPctLeft: { fontSize: 18, fontWeight: '700', color: '#22c55e' },
  progressPctRight: { fontSize: 18, fontWeight: '700', color: '#ef4444' },
  progressVotes: { fontSize: 10, color: '#fff', marginTop: 1 },
  progressBarTrack: { height: 8, borderRadius: 99, overflow: 'hidden', flexDirection: 'row', gap: 1, marginBottom: 6 },
  progressBarLeft: { backgroundColor: '#22c55e', borderTopLeftRadius: 99, borderBottomLeftRadius: 99 },
  progressBarRight: { backgroundColor: '#ef4444', borderTopRightRadius: 99, borderBottomRightRadius: 99 },
  progressBottomRow: { flexDirection: 'row', justifyContent: 'space-between' },
  sideTagLeft: { backgroundColor: '#e8f5e9', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  sideTagRight: { backgroundColor: '#fde8e8', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  sideTagText: { fontSize: 10, fontWeight: '600', color: '#374151' },

  // Stats row
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#d4ccf0' },
  statItem: { alignItems: 'center', gap: 3 },
  statValue: { fontSize: 15, fontWeight: '700', color: '#1a1040' },
  statLabel: { fontSize: 10, color: '#7c6fb0', textAlign: 'center' },

  // How to Win — horizontal
  howToWinCard: { borderRadius: 16, padding: 14, marginBottom: 14, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  howToWinTitle: { fontSize: 15, fontWeight: '800', marginBottom: 10 },
  howToWinRow: { flexDirection: 'row', gap: 8 },
  howToWinItem: { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center', gap: 5 },
  howToWinIconCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  howToWinItemLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  howToWinItemDesc: { fontSize: 10, color: '#6b7280', textAlign: 'center', lineHeight: 14 },

  // Info card
  infoCard: { borderRadius: 20, padding: 16, marginBottom: 14, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 10 },
  infoText: { fontSize: 14, lineHeight: 21, color: '#6B7280' },
  resultText: { fontSize: 13, fontWeight: '700', color: '#4B5563', marginTop: 8 },

  // Option pills
  optionGrid: { flexDirection: 'column', gap: 10, marginBottom: 6 },
  optionPillCard: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderRadius: 15, borderWidth: 1.5, paddingVertical: 8, paddingHorizontal: 10, gap: 8 },
  optionPillAvatarWrap: { flexShrink: 0 },
  optionPillAvatarFallback: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  optionPillLabel: { flex: 1, fontSize: 13, fontWeight: '700' },
  optionPillRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, flexShrink: 0 },
  argumentLabel: { fontSize: 12, fontWeight: '800', color: '#4B5563', marginTop: 10, marginBottom: 6 },

  // Argument input + button
  argumentInput: { minHeight: 90, borderRadius: 16, borderWidth: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#111827', textAlignVertical: 'top', marginTop: 14, marginBottom: 14 },
  primaryButton: { minHeight: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },

  // Comments
  commentCard: { borderRadius: 16, backgroundColor: '#F9FAFB', borderWidth: 1, padding: 14, marginBottom: 10 },
  replyCard: { borderRadius: 14, borderWidth: 1, padding: 12, marginTop: 10 },
  repliesSection: { marginTop: 10, marginLeft: 18 },
  commentHeader: { marginBottom: 8 },
  commentAuthorIdentity: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, minWidth: 0 },
  commentAuthorTopRow: { flexDirection: 'row', alignItems: 'center', minHeight: 18 },
  commentHeaderActions: { flexDirection: 'row', alignItems: 'center', flexShrink: 0, marginLeft: 6 },
  commentAvatar: { width: 34, height: 34, borderRadius: 17, marginRight: 10 },
  commentAvatarFallback: { backgroundColor: '#9CA3AF', alignItems: 'center', justifyContent: 'center' },
  commentAuthorTextWrap: { flex: 1, minWidth: 0 },
  commentAuthorNameRow: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  commentAuthorNameFlex: { flexShrink: 1, minWidth: 0 },
  commentVoteSideBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 6 },
  commentVoteSideBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600', lineHeight: 14 },
  commentAuthorName: { fontSize: 13, fontWeight: '800', color: '#111827', lineHeight: 16, includeFontPadding: false },
  commentAuthorHandle: { fontSize: 11, fontWeight: '700', color: '#6B7280', marginTop: 0, lineHeight: 14, includeFontPadding: false },
  replyTrigger: { paddingHorizontal: 6, paddingVertical: 0, borderRadius: 999, justifyContent: 'center' },
  replyTriggerText: { fontSize: 12, fontWeight: '800', lineHeight: 16, includeFontPadding: false },
  commentLikeButton: { flexDirection: 'row', alignItems: 'center', minWidth: 36, justifyContent: 'flex-end', paddingVertical: 0, marginLeft: 4 },
  commentLikeText: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginLeft: 4, lineHeight: 16 },
  commentMessage: { fontSize: 14, lineHeight: 20, color: '#374151' },
  viewRepliesButton: { alignSelf: 'flex-start', marginTop: 10 },
  viewRepliesText: { fontSize: 12, fontWeight: '800' },
  commentInlineActions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 10 },
  replyComposer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  replyComposerLabel: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  replyInput: { minHeight: 88, borderRadius: 14, borderWidth: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827', textAlignVertical: 'top' },
  replyActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  replySecondaryButton: { minWidth: 82, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 14 },
  replySecondaryButtonText: { fontSize: 13, fontWeight: '700' },
  replyPrimaryButton: { minWidth: 82, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  replyPrimaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  emptyCommentText: { fontSize: 13, lineHeight: 19, color: '#6B7280' },

  // Bottom
  bottomActions: {
    flexDirection: 'row', gap: 10,
    marginBottom: Platform.OS === 'ios' ? '10%' : '20%'
  },
  secondaryButton: { flex: 1, minHeight: 46, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  secondaryButtonText: { fontSize: 14, fontWeight: '800' },

  // Image preview modal
  optionImagePreviewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  optionImagePreviewCloseBtn: { position: 'absolute', top: 44, right: 18, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)', zIndex: 10 },
  optionImagePreviewZoomHost: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  optionImagePreviewHexWrap: { width: OPTION_IMAGE_PREVIEW_SIZE, height: OPTION_IMAGE_PREVIEW_SIZE, alignItems: 'center', justifyContent: 'center' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 },
  viewVotesBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  viewVotesText: { fontSize: 12, fontWeight: '900' },
  cornerBadgeTopLeft: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 0.2,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#7C3AED',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  cornerBadgeTopRight: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 0.2,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#DB2777',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
});
