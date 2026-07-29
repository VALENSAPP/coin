import React, { useEffect, useState, useCallback, useRef, memo, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Keyboard,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { formatDistanceToNow } from 'date-fns';
import {
  getComments,
  postComment,
  deleteComment,
  editComment,
  postCommentReaction,
} from '../../../services/post';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../../displaytoastmessage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Clipboard from '@react-native-clipboard/clipboard';
import { useDispatch, useSelector } from 'react-redux';
import { useAppTheme } from '../../../theme/useApptheme';
import { useThemeContext } from '../../../theme/ThemeContext';
import HexAvatar from '../story.js/HexAvatar';
import { useLanguage } from '../../../i18n';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchUsers, getAllUser } from '../../../services/users';
import {
  getActiveMention,
  insertMention,
  normalizeSearchUsers,
  resolveUserIdFromUsername,
} from '../../../utils/mentionUtils';
import { parseText } from '../../../utils/commentUtils';

const mapCommentItem = comment => ({
  id: String(comment.id),
  userId: String(comment.userId),
  username: comment.displayName || 'Unknown',
  avatar:
    comment.image || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
  text: comment.comment || '',
  time: formatDistanceToNow(new Date(comment.createdAt), {
    addSuffix: true,
  }),
  parentId: comment.parentId || null,
  replies: [],
  likeCount: comment.likeCount || 0,
  dislikeCount: comment.dislikeCount || 0,
  userReaction: comment.userReaction || null,
  commentType: comment.commentType || null,
});

const flattenCommentEntries = entries =>
  (Array.isArray(entries) ? entries : []).reduce((acc, comment) => {
    acc.push(comment);
    if (Array.isArray(comment?.replies) && comment.replies.length > 0) {
      acc.push(...flattenCommentEntries(comment.replies));
    }
    return acc;
  }, []);

const buildCommentTree = comments => {
  const flatComments = flattenCommentEntries(comments).map(mapCommentItem);
  const byId = new Map();

  flatComments.forEach(comment => {
    byId.set(comment.id, { ...comment, replies: [] });
  });

  const roots = [];

  flatComments.forEach(comment => {
    const normalizedComment = byId.get(comment.id);
    const parentId = comment.parentId ? String(comment.parentId) : '';

    if (parentId && byId.has(parentId)) {
      byId.get(parentId).replies.push(normalizedComment);
      return;
    }

    roots.push(normalizedComment);
  });

  return roots;
};

const CommentItem = memo(
  ({
    item,
    onMorePress,
    onCloseSheet,
    currentUserId,
    postOwnerId,
    onReplyPress,
    replyingToThreadId,
    replyingToUsername,
    replyText,
    onChangeReplyText,
    onReplySelectionChange,
    onSubmitReply,
    onCancelReply,
    isPosting,
    expandedReplies,
    onToggleReplies,
    onThumbsUpPress,
    onThumbsDownPress,
    commentVotes,
  }) => {
    const { t } = useLanguage();
    const { cardStyle, border, mutedText, accent } = useAppTheme();
    const { isDarkMode } = useThemeContext();
    const labelColor = isDarkMode ? '#ffffff' : '#111827';
    const inputSurface = isDarkMode ? 'rgba(255,255,255,0.08)' : '#f2f2f2';
    const replySurface = isDarkMode ? 'rgba(255,255,255,0.06)' : '#f8f8f8';

    const navigation = useNavigation();
    const normalizeId = id => (id != null ? String(id).trim() : '');

    const viewerId = normalizeId(currentUserId);
    const itemUserId = normalizeId(item.userId);
    const ownerId = normalizeId(postOwnerId);

    const votes = commentVotes?.[item.id] || {
      thumbsUp: 0,
      thumbsDown: 0,
      userVote: null,
    };

    const isCommentAuthor = viewerId && itemUserId === viewerId;
    const isPostOwner = viewerId && ownerId === viewerId;
    const canModerate = isCommentAuthor || isPostOwner;
    const hasReplies = Array.isArray(item.replies) && item.replies.length > 0;
    const isExpanded = !!expandedReplies[item.id];

    const handleNavigateToProfile = useCallback(
      userId => {
        if (!userId) return;
        onCloseSheet?.();
        requestAnimationFrame(() => {
          navigation.navigate('UsersProfile', { userId });
        });
      },
      [navigation, onCloseSheet],
    );

    const toast = useToast();
    const mentionPressLock = useRef(false);

    const handleMentionPress = useCallback(
      async mentionPart => {
        if (mentionPressLock.current) return;
        const username = String(mentionPart || '')
          .replace(/^@+/, '')
          .trim();
        if (!username) return;

        mentionPressLock.current = true;
        try {
          const userId = await resolveUserIdFromUsername(username);
          if (!userId) {
            showToastMessage(toast, 'danger', t('postEditor.openProfileError'));
            return;
          }
          handleNavigateToProfile(userId);
        } catch (_) {
          showToastMessage(toast, 'danger', t('postEditor.openProfileError'));
        } finally {
          mentionPressLock.current = false;
        }
      },
      [handleNavigateToProfile, t, toast],
    );

    const TRUST_BADGE_CONFIG = {
      AGREE: { label: 'Agree Vote', color: '#059669', bg: '#ECFDF5', icon: '👍' },
      NOT_SURE: { label: 'Not Sure', color: '#D97706', bg: '#FFFBEB', icon: '🤔' },
      DISAGREE: { label: 'Disagree Vote', color: '#DC2626', bg: '#FEF2F2', icon: '👎' },
    };

    const TrustVoteBadge = ({ commentType }) => {
      const config = TRUST_BADGE_CONFIG[String(commentType || '').toUpperCase()];
      if (!config) return null;
      return (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 4,
          alignSelf: 'flex-start',
          backgroundColor: config.bg,
          borderRadius: 20,
          paddingHorizontal: 8, paddingVertical: 3,
          marginBottom: 4,
          borderWidth: 0.5,
          borderColor: config.color + '44',
        }}>
          <Text style={{ fontSize: 11 }}>{config.icon}</Text>
          <Text style={{ fontSize: 11, fontWeight: '600', color: config.color }}>
            {config.label}
          </Text>
        </View>
      );
    };

    return (
      <View
        style={[
          styles.commentCard,
          cardStyle,
          { borderColor: border },
          item.isOptimistic && styles.optimisticComment,
        ]}>
        <View style={styles.commentRow}>
          <TouchableOpacity
            onPress={() => handleNavigateToProfile(item?.userId)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.hexAvatarWrap}
            accessibilityRole="button"
          >
            <HexAvatar uri={item.avatar} size={28} borderWidth={1} borderColor={accent} />
          </TouchableOpacity>
          <View style={styles.commentContent}>
            <View style={styles.commentHeader}>
              <Text style={[styles.username, { color: labelColor }]}>{item.username}</Text>
              <Text style={[styles.time, { color: mutedText }]}>{item.time}</Text>
            </View>
            <TrustVoteBadge commentType={item.commentType} />
            <Text style={[styles.commentText, { color: labelColor }]}>
              {parseText(item.text, {
                mention: { color: accent, fontWeight: '700' },
                hashtag: { color: accent, fontWeight: '600' },
                plain: { color: labelColor },
                onMentionPress: handleMentionPress,
              })}
            </Text>
            <View style={styles.commentActionsRow}>
              <TouchableOpacity onPress={() => onReplyPress?.(item)}>
                <Text style={[styles.replyButtonText, { color: accent }]}>
                  {t('commentSheet.reply')}
                </Text>
              </TouchableOpacity>

              <View style={styles.votingContainer}>
                <TouchableOpacity
                  style={styles.voteButton}
                  onPress={() => onThumbsUpPress?.(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text
                    style={[
                      styles.voteIcon,
                      votes.userVote === 'up' && styles.voteIconActive,
                    ]}>
                    👍
                  </Text>
                  {votes.thumbsUp > 0 && (
                    <Text
                      style={[
                        styles.voteCount,
                        votes.userVote === 'up' && [styles.voteCountActive, { color: accent }],
                      ]}>
                      {votes.thumbsUp}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.voteButton}
                  onPress={() => onThumbsDownPress?.(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text
                    style={[
                      styles.voteIcon,
                      votes.userVote === 'down' && styles.voteIconActive,
                    ]}>
                    👎
                  </Text>
                  {votes.thumbsDown > 0 && (
                    <Text
                      style={[
                        styles.voteCount,
                        votes.userVote === 'down' && [styles.voteCountActive, { color: accent }],
                      ]}>
                      {votes.thumbsDown}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {hasReplies ? (
                <TouchableOpacity onPress={() => onToggleReplies?.(item.id)}>
                  <Text style={[styles.replyButtonText, { color: accent }]}>
                    {isExpanded
                      ? t('commentSheet.hideReplies')
                      : t('commentSheet.viewReplies', { count: item.replies.length })}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {canModerate && (
            <TouchableOpacity
              style={styles.starIcon}
              onPress={() => onMorePress?.(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="ellipsis-vertical" size={18} color={labelColor} />
            </TouchableOpacity>
          )}
        </View>

        {replyingToThreadId === item.id && (
          <View style={[styles.replyComposer, { borderTopColor: border }]}>
            <Text style={[styles.replyingLabel, { color: mutedText }]}>
              {t('commentSheet.replyingTo')} {replyingToUsername || item.username}
            </Text>
            <View style={styles.inlineReplyRow}>
              <TextInput
                placeholder={t('commentSheet.writeReplyPlaceholder')}
                placeholderTextColor={mutedText}
                style={[
                  styles.replyInput,
                  {
                    color: labelColor,
                    backgroundColor: inputSurface,
                    borderColor: border,
                  },
                ]}
                value={replyText}
                onChangeText={text => onChangeReplyText?.(text)}
                onSelectionChange={event =>
                  onReplySelectionChange?.(event?.nativeEvent?.selection)
                }
                editable={true}
              />
              <TouchableOpacity onPress={onCancelReply}>
                <Text style={[styles.replyCancelText, { color: mutedText }]}>
                  {t('commentSheet.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onSubmitReply}
                disabled={isPosting || !replyText.trim()}>
                {isPosting ? (
                  <ActivityIndicator size="small" color={accent} />
                ) : (
                  <Text
                    style={[
                      styles.sendText,
                      { color: accent },
                      !replyText.trim() && styles.sendTextDisabled,
                    ]}>
                    {t('commentSheet.post')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {hasReplies && isExpanded ? (
          <View style={styles.repliesSection}>
            {item.replies.map(reply => {
              const replyVotes = commentVotes?.[reply.id] || {
                thumbsUp: 0,
                thumbsDown: 0,
                userVote: null,
              };
              const replyUserId =
                reply.userId != null ? String(reply.userId).trim() : '';
              const isReplyAuthor = viewerId && replyUserId === viewerId;
              const canModerateReply = isReplyAuthor || isPostOwner;
              return (
                <View key={reply.id} style={[styles.replyCard, { backgroundColor: replySurface }]}>
                  <TouchableOpacity
                    onPress={() => handleNavigateToProfile(reply?.userId)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.hexAvatarWrap}
                    accessibilityRole="button"
                  >
                    <HexAvatar uri={reply.avatar} size={28} borderWidth={1} borderColor={accent} />
                  </TouchableOpacity>
                  <View style={styles.commentContent}>
                    <View style={styles.commentHeader}>
                      <Text style={[styles.username, { color: labelColor }]}>{reply.username}</Text>
                      <Text style={[styles.time, { color: mutedText }]}>{reply.time}</Text>
                    </View>
                    <Text style={[styles.commentText, { color: labelColor }]}>
                      {parseText(reply.text, {
                        mention: { color: accent, fontWeight: '700' },
                        hashtag: { color: accent, fontWeight: '600' },
                        plain: { color: labelColor },
                        onMentionPress: handleMentionPress,
                      })}
                    </Text>
                    <View style={styles.commentActionsRow}>
                      <TouchableOpacity onPress={() => onReplyPress?.(reply)}>
                        <Text style={[styles.replyButtonText, { color: accent }]}>
                          {t('commentSheet.reply')}
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.votingContainer}>
                        <TouchableOpacity
                          style={styles.voteButton}
                          onPress={() => onThumbsUpPress?.(reply.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Text
                            style={[
                              styles.voteIcon,
                              replyVotes.userVote === 'up' && styles.voteIconActive,
                            ]}>
                            👍
                          </Text>
                          {replyVotes.thumbsUp > 0 && (
                            <Text
                              style={[
                                styles.voteCount,
                                replyVotes.userVote === 'up' && [styles.voteCountActive, { color: accent }],
                              ]}>
                              {replyVotes.thumbsUp}
                            </Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.voteButton}
                          onPress={() => onThumbsDownPress?.(reply.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Text
                            style={[
                              styles.voteIcon,
                              replyVotes.userVote === 'down' && styles.voteIconActive,
                            ]}>
                            👎
                          </Text>
                          {replyVotes.thumbsDown > 0 && (
                            <Text
                              style={[
                                styles.voteCount,
                                replyVotes.userVote === 'down' && [styles.voteCountActive, { color: accent }],
                              ]}>
                              {replyVotes.thumbsDown}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                      {canModerateReply && (
                        <TouchableOpacity
                          style={styles.starIcon}
                          onPress={() => onMorePress?.(reply)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                          <Icon
                            name="ellipsis-vertical"
                            size={18}
                            color={labelColor}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  },
);

export default function CommentSheet({
  postId,
  currentUser,
  onClose,
  postOwnerId,
  onCommentCountUpdate,
}) {
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedComment, setSelectedComment] = useState(null);
  const [isPosting, setIsPosting] = useState(false);
  const [userId, setUserId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(new Set());
  const [editingComment, setEditingComment] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [replyingToComment, setReplyingToComment] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [expandedReplies, setExpandedReplies] = useState({});
  const [commentVotes, setCommentVotes] = useState({});
  const [mentionUsers, setMentionUsers] = useState([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [activeMention, setActiveMention] = useState(null);
  const [inputSelection, setInputSelection] = useState({ start: 0, end: 0 });
  const [replySelection, setReplySelection] = useState({ start: 0, end: 0 });
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const isFetchingRef = useRef(false);
  const mentionSearchRef = useRef(null);
  const mentionRequestIdRef = useRef(0);
  const commentTextRef = useRef('');
  const replyTextRef = useRef('');
  const inputSelectionRef = useRef({ start: 0, end: 0 });
  const replySelectionRef = useRef({ start: 0, end: 0 });
  const activeMentionRef = useRef(null);

  const toast = useToast();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const profileImage = useSelector(state => state.profileImage?.profileImg);
  const { bgStyle, card, border, mutedText, accent } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const labelColor = isDarkMode ? '#ffffff' : '#111827';
  const inputSurface = isDarkMode ? 'rgba(255,255,255,0.08)' : '#f2f2f2';

  // ─── helpers ────────────────────────────────────────────────────────────────

  const buildVotesMap = rawList =>
    rawList.reduce((map, c) => {
      const userVote =
        c.userReaction === 'LIKE'
          ? 'up'
          : c.userReaction === 'DISLIKE'
            ? 'down'
            : null;
      map[String(c.id)] = {
        thumbsUp: c.likeCount || 0,
        thumbsDown: c.dislikeCount || 0,
        userVote,
      };
      return map;
    }, {});

  const flattenRaw = rawComments =>
    (Array.isArray(rawComments) ? rawComments : []).reduce((acc, c) => {
      acc.push(c);
      if (Array.isArray(c?.replies)) acc.push(...c.replies);
      return acc;
    }, []);

  // ─── fetch ───────────────────────────────────────────────────────────────────

  const fetchComments = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    const isFirstLoad = comments.length === 0;
    if (isFirstLoad) setInitialLoading(true);

    try {
      const response = await getComments(postId);
      if (response.success) {
        const raw = response.data.comments;
        const tree = buildCommentTree(raw);
        const votes = buildVotesMap(flattenRaw(raw));

        setComments(tree);
        setCommentVotes(votes);
        onCommentCountUpdate?.(postId, tree.length);
      } else {
        showToastMessage(toast, 'danger', t('commentSheet.errorLoadFailed'));
      }
    } catch {
      showToastMessage(toast, 'danger', t('commentSheet.errorFetch'));
    } finally {
      setInitialLoading(false);
      isFetchingRef.current = false;
    }
  }, [postId, toast, onCommentCountUpdate]);

  useEffect(() => {
    if (postId) fetchComments();
    AsyncStorage.getItem('userId').then(id => setUserId(id || null));
  }, [postId, fetchComments]);

  // Manual keyboard inset — RBSheet's built-in KeyboardAvoidingView (esp. Android
  // behavior="height") fights adjustResize and makes the sheet bounce on post/dismiss.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = event => {
      const next = Math.max(0, Math.round(event?.endCoordinates?.height || 0));
      setKeyboardOffset(prev => (prev === next ? prev : next));
    };
    const onHide = () => setKeyboardOffset(prev => (prev === 0 ? prev : 0));

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const clearMentionState = useCallback(() => {
    activeMentionRef.current = null;
    setActiveMention(null);
    setMentionUsers([]);
    setMentionLoading(false);
    if (mentionSearchRef.current) {
      clearTimeout(mentionSearchRef.current);
      mentionSearchRef.current = null;
    }
  }, []);

  const runMentionSearch = useCallback(
    (text, cursor, field) => {
      const mention = getActiveMention(text, cursor);
      const query = String(mention?.query || '').trim();
      if (!mention || query.length < 1) {
        clearMentionState();
        return;
      }

      const nextActive = { ...mention, field };
      activeMentionRef.current = nextActive;
      setActiveMention(nextActive);

      if (mentionSearchRef.current) clearTimeout(mentionSearchRef.current);
      // Keep previous results visible while the next query loads (avoids flicker).
      setMentionLoading(true);
      const requestId = ++mentionRequestIdRef.current;
      const searchQuery = query;

      mentionSearchRef.current = setTimeout(async () => {
        try {
          let users = [];
          try {
            const response = await searchUsers(searchQuery);
            users = normalizeSearchUsers(response);
          } catch (_searchError) {
            users = [];
          }

          // Fallback to the same endpoint used by tag/search screens when
          // /user/search returns nothing or fails for partial queries.
          if (!users.length) {
            try {
              const fallback = await getAllUser({ userName: searchQuery });
              users = normalizeSearchUsers(fallback);
            } catch (_fallbackError) {
              users = [];
            }
          }

          if (requestId !== mentionRequestIdRef.current) return;
          const needle = searchQuery.toLowerCase();
          const filtered = users.filter(user => {
            const username = String(user.username || '').toLowerCase();
            const displayName = String(user.displayName || '').toLowerCase();
            return username.includes(needle) || displayName.includes(needle);
          });
          setMentionUsers((filtered.length ? filtered : users).slice(0, 8));
        } catch (_error) {
          if (requestId !== mentionRequestIdRef.current) return;
          setMentionUsers([]);
        } finally {
          if (requestId === mentionRequestIdRef.current) {
            setMentionLoading(false);
          }
        }
      }, 220);
    },
    [clearMentionState],
  );

  const handleCommentTextChange = useCallback(
    text => {
      commentTextRef.current = text;
      setCommentText(text);
      runMentionSearch(text, text.length, 'comment');
    },
    [runMentionSearch],
  );

  const handleReplyTextChange = useCallback(
    text => {
      replyTextRef.current = text;
      setReplyText(text);
      runMentionSearch(text, text.length, 'reply');
    },
    [runMentionSearch],
  );

  const handleSelectMention = useCallback(
    user => {
      const mention = activeMentionRef.current;
      if (!mention || !user?.username) return;
      const field = mention.field;
      const currentText =
        field === 'reply' ? replyTextRef.current : commentTextRef.current;
      const cursor =
        field === 'reply'
          ? replySelectionRef.current.start
          : inputSelectionRef.current.start;
      const { text, cursor: nextCursor } = insertMention(
        currentText,
        cursor,
        mention.startIndex,
        user.username,
      );

      if (field === 'reply') {
        replyTextRef.current = text;
        replySelectionRef.current = { start: nextCursor, end: nextCursor };
        setReplyText(text);
        setReplySelection({ start: nextCursor, end: nextCursor });
      } else {
        commentTextRef.current = text;
        inputSelectionRef.current = { start: nextCursor, end: nextCursor };
        setCommentText(text);
        setInputSelection({ start: nextCursor, end: nextCursor });
      }
      clearMentionState();
    },
    [clearMentionState],
  );

  useEffect(
    () => () => {
      if (mentionSearchRef.current) clearTimeout(mentionSearchRef.current);
    },
    [],
  );

  // ─── send / edit / reply ─────────────────────────────────────────────────────

  const handleSendComment = useCallback(async () => {
    const activeText = replyingToComment ? replyText : commentText;
    if (!activeText.trim()) {
      showToastMessage(toast, 'danger', t('commentSheet.errorEmptyComment'));
      return;
    }
    if (isPosting) return;

    const trimmedComment = activeText.trim();
    // Dismiss once up-front so editable toggles don't bounce the sheet.
    Keyboard.dismiss();
    clearMentionState();

    // ── EDIT FLOW ──────────────────────────────────────────────────────────────
    if (editingComment) {
      const oldText = editingComment.text;
      setIsPosting(true);

      setComments(prev =>
        prev.map(c =>
          c.id === editingComment.id
            ? { ...c, text: trimmedComment, time: t('commentSheet.editedJustNow') }
            : c,
        ),
      );
      setCommentText('');
      commentTextRef.current = '';
      setEditingComment(null);

      try {
        const response = await editComment(editingComment.id, trimmedComment);
        if (response.success) {
          await fetchComments();
          showToastMessage(toast, 'success', t('commentSheet.successCommentUpdated'));
        } else {
          setComments(prev =>
            prev.map(c =>
              c.id === editingComment.id ? { ...c, text: oldText } : c,
            ),
          );
          showToastMessage(toast, 'danger', t('commentSheet.errorUpdateFailed'));
        }
      } catch {
        setComments(prev =>
          prev.map(c =>
            c.id === editingComment.id ? { ...c, text: oldText } : c,
          ),
        );
        showToastMessage(toast, 'danger', t('commentSheet.errorUpdate'));
      } finally {
        setIsPosting(false);
      }
      return;
    }

    // ── REPLY FLOW ─────────────────────────────────────────────────────────────
    if (replyingToComment?.id) {
      setIsPosting(true);
      const threadId = replyingToComment.threadId || replyingToComment.id;

      setReplyText('');
      replyTextRef.current = '';
      setReplyingToComment(null);

      try {
        const response = await postComment(postId, trimmedComment, threadId);
        if (response.success) {
          setExpandedReplies(prev => ({ ...prev, [threadId]: true }));
          await fetchComments();
          showToastMessage(toast, 'success', t('commentSheet.successReplyPosted'));
        } else {
          showToastMessage(toast, 'danger', t('commentSheet.errorReplyFailed'));
        }
      } catch {
        showToastMessage(toast, 'danger', t('commentSheet.errorReply'));
      } finally {
        setIsPosting(false);
      }
      return;
    }

    // ── NEW TOP-LEVEL COMMENT ─────────────────────────────────────────────────
    const tempId = `temp-${Date.now()}`;
    const tempComment = {
      id: tempId,
      userId: currentUser?.id,
      username: currentUser?.displayName || t('commentSheet.you'),
      avatar:
        currentUser?.avatar ||
        'https://cdn-icons-png.flaticon.com/512/149/149071.png',
      text: trimmedComment,
      time: t('commentSheet.justNow'),
      replies: [],
      isOptimistic: true,
    };

    setComments(prev => [tempComment, ...prev]);
    setCommentText('');
    commentTextRef.current = '';
    onCommentCountUpdate?.(postId, comments.length + 1);
    setIsPosting(true);

    try {
      const response = await postComment(postId, trimmedComment);
      if (response.success) {
        await fetchComments();
        showToastMessage(toast, 'success', t('commentSheet.successCommentPosted'));
      } else {
        setComments(prev => prev.filter(c => c.id !== tempId));
        onCommentCountUpdate?.(postId, comments.length);
        showToastMessage(toast, 'danger', t('commentSheet.errorPostFailed'));
      }
    } catch {
      setComments(prev => prev.filter(c => c.id !== tempId));
      onCommentCountUpdate?.(postId, comments.length);
      showToastMessage(toast, 'danger', t('commentSheet.errorPost'));
    } finally {
      setIsPosting(false);
    }
  }, [
    replyingToComment,
    replyText,
    commentText,
    isPosting,
    editingComment,
    postId,
    currentUser,
    comments.length,
    fetchComments,
    onCommentCountUpdate,
    toast,
    t,
    clearMentionState,
  ]);

  // ─── moderation ──────────────────────────────────────────────────────────────

  const openActionsFor = useCallback(comment => {
    if (comment.isOptimistic) return;
    setSelectedComment(comment);
    setIsModalVisible(true);
  }, []);

  const handleReplyPress = useCallback(comment => {
    setReplyingToComment({
      id: comment.id,
      username: comment.username,
      parentId: comment.parentId,
      threadId: comment.parentId || comment.id,
    });
    replyTextRef.current = '';
    setReplyText('');
    clearMentionState();
    setExpandedReplies(prev => ({
      ...prev,
      [comment.parentId || comment.id]: true,
    }));
  }, [clearMentionState]);

  const handleToggleReplies = useCallback(commentId => {
    setExpandedReplies(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  }, []);

  const handleDeleteComment = useCallback(async () => {
    if (!selectedComment?.id) {
      showToastMessage(toast, 'danger', t('commentSheet.errorInvalidComment'));
      return;
    }

    const viewerId = String(currentUser?.id ?? userId ?? '');
    const isCommentAuthor =
      viewerId && String(selectedComment.userId) === viewerId;
    const isPostOwner =
      viewerId && postOwnerId != null && String(postOwnerId) === viewerId;

    if (!(isCommentAuthor || isPostOwner)) {
      showToastMessage(toast, 'danger', t('commentSheet.errorNoPermission'));
      return;
    }

    const commentId = selectedComment.id;
    if (isDeleting.has(commentId)) return;

    setComments(prev => prev.filter(c => c.id !== commentId));
    onCommentCountUpdate?.(postId, Math.max(0, comments.length - 1));
    setIsDeleting(prev => new Set(prev).add(commentId));
    setIsModalVisible(false);

    try {
      const response = await deleteComment(commentId, postId);
      if (response.success) {
        showToastMessage(
          toast,
          'success',
          response.data?.message || t('commentSheet.successCommentDeleted'),
        );
        await fetchComments();
      } else {
        setComments(prev => [selectedComment, ...prev]);
        onCommentCountUpdate?.(postId, comments.length);
        showToastMessage(
          toast,
          'danger',
          response.data?.message || t('commentSheet.errorDeleteFailed'),
        );
      }
    } catch {
      setComments(prev => [selectedComment, ...prev]);
      onCommentCountUpdate?.(postId, comments.length);
      showToastMessage(toast, 'danger', t('commentSheet.errorDelete'));
    } finally {
      setIsDeleting(prev => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
      setSelectedComment(null);
    }
  }, [
    selectedComment,
    currentUser?.id,
    userId,
    postOwnerId,
    isDeleting,
    postId,
    comments.length,
    fetchComments,
    onCommentCountUpdate,
    toast,
    t,
  ]);

  const handleEditComment = useCallback(() => {
    if (!selectedComment) return;
    commentTextRef.current = selectedComment.text;
    setCommentText(selectedComment.text);
    setEditingComment(selectedComment);
    setIsModalVisible(false);
    setSelectedComment(null);
  }, [selectedComment]);

  const handleCopyComment = useCallback(() => {
    const textToCopy = selectedComment?.text?.trim();
    if (!textToCopy) {
      setIsModalVisible(false);
      setSelectedComment(null);
      return;
    }

    Clipboard.setString(textToCopy);
    showToastMessage(toast, 'success', t('commentSheet.successCommentCopied'));
    setIsModalVisible(false);
    setSelectedComment(null);
  }, [selectedComment, toast, t]);

  // ─── reactions ───────────────────────────────────────────────────────────────

  const handleThumbsUpPress = useCallback(
    async commentId => {
      const current = commentVotes?.[commentId] || {
        thumbsUp: 0,
        thumbsDown: 0,
        userVote: null,
      };
      const isAlreadyVoted = current.userVote === 'up';
      const reaction = isAlreadyVoted ? 'NONE' : 'LIKE';

      setCommentVotes(prev => ({
        ...prev,
        [commentId]: {
          thumbsUp: isAlreadyVoted ? current.thumbsUp - 1 : current.thumbsUp + 1,
          thumbsDown:
            current.userVote === 'down' ? current.thumbsDown - 1 : current.thumbsDown,
          userVote: isAlreadyVoted ? null : 'up',
        },
      }));

      try {
        const response = await postCommentReaction({ commentId, reaction });
        if (!response.success) {
          showToastMessage(toast, 'danger', t('commentSheet.errorReactionFailed'));
        }
      } catch {
        showToastMessage(toast, 'danger', t('commentSheet.errorReaction'));
      }
    },
    [commentVotes, toast, t],
  );

  const handleThumbsDownPress = useCallback(
    async commentId => {
      const current = commentVotes?.[commentId] || {
        thumbsUp: 0,
        thumbsDown: 0,
        userVote: null,
      };
      const isAlreadyVoted = current.userVote === 'down';
      const reaction = isAlreadyVoted ? 'NONE' : 'DISLIKE';

      setCommentVotes(prev => ({
        ...prev,
        [commentId]: {
          thumbsUp:
            current.userVote === 'up' ? current.thumbsUp - 1 : current.thumbsUp,
          thumbsDown: isAlreadyVoted ? current.thumbsDown - 1 : current.thumbsDown + 1,
          userVote: isAlreadyVoted ? null : 'down',
        },
      }));

      try {
        const response = await postCommentReaction({ commentId, reaction });
        if (!response.success) {
          showToastMessage(toast, 'danger', t('commentSheet.errorReactionFailed'));
        }
      } catch {
        showToastMessage(toast, 'danger', t('commentSheet.errorReaction'));
      }
    },
    [commentVotes, toast, t],
  );

  // ─── list rendering ───────────────────────────────────────────────────────────

  const commentKeyExtractor = useCallback(item => item.id, []);

  const renderCommentItem = useCallback(
    ({ item }) => (
      <CommentItem
        item={item}
        onMorePress={openActionsFor}
        onCloseSheet={onClose}
        currentUserId={currentUser?.id ?? userId}
        postOwnerId={postOwnerId}
        onReplyPress={handleReplyPress}
        replyingToThreadId={replyingToComment?.threadId}
        replyingToUsername={replyingToComment?.username}
        replyText={replyText}
        onChangeReplyText={handleReplyTextChange}
        onReplySelectionChange={selection => {
          if (!selection) return;
          replySelectionRef.current = selection;
          setReplySelection(selection);
          // Skip if text update hasn't landed yet (common Android race).
          if (selection.start > replyTextRef.current.length) return;
          runMentionSearch(replyTextRef.current, selection.start, 'reply');
        }}
        onSubmitReply={handleSendComment}
        onCancelReply={() => {
          setReplyingToComment(null);
          replyTextRef.current = '';
          setReplyText('');
          clearMentionState();
        }}
        isPosting={isPosting}
        expandedReplies={expandedReplies}
        onToggleReplies={handleToggleReplies}
        onThumbsUpPress={handleThumbsUpPress}
        onThumbsDownPress={handleThumbsDownPress}
        commentVotes={commentVotes}
      />
    ),
    [
      openActionsFor,
      onClose,
      currentUser?.id,
      userId,
      postOwnerId,
      handleReplyPress,
      replyingToComment?.threadId,
      replyingToComment?.username,
      replyText,
      handleReplyTextChange,
      runMentionSearch,
      clearMentionState,
      handleSendComment,
      isPosting,
      expandedReplies,
      handleToggleReplies,
      handleThumbsUpPress,
      handleThumbsDownPress,
      commentVotes,
    ],
  );

  // ─── render ───────────────────────────────────────────────────────────────────

  // Keep input above home-indicator when keyboard is closed; lift by keyboard when open.
  const bottomPad =
    keyboardOffset > 0 ? keyboardOffset : Math.max(insets.bottom, 16);
  // Shrink mention list under the keyboard so rows stay fully visible + scrollable.
  const mentionMaxHeight = keyboardOffset > 0 ? 156 : 220;
  const collapseBodyForMention = Boolean(activeMention && keyboardOffset > 0);

  return (
    <View style={[styles.container, bgStyle, { paddingBottom: bottomPad }]}>
      <Text style={[styles.title, { color: labelColor }]}>
        {t('commentSheet.title', { count: comments.length })}
      </Text>

      <View style={[styles.body, collapseBodyForMention && styles.bodyCollapsed]}>
        {initialLoading ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="small" color={accent} />
          </View>
        ) : comments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: mutedText }]}>
              {t('commentSheet.noComments')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={commentKeyExtractor}
            renderItem={renderCommentItem}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.commentsListContent}
            style={styles.commentsList}
          />
        )}
      </View>

      {/* Mention suggestions sit in-flow above the input so they never clip under it */}
      {activeMention ? (
        <View
          style={[
            styles.mentionPanel,
            {
              backgroundColor: card,
              borderColor: border,
              maxHeight: mentionMaxHeight,
            },
          ]}
        >
          {mentionLoading && mentionUsers.length === 0 ? (
            <View style={styles.mentionStatusRow}>
              <ActivityIndicator size="small" color={accent} />
              <Text style={[styles.mentionStatusText, { color: mutedText }]}>
                {t('commentSheet.mentionSearching')}
              </Text>
            </View>
          ) : !mentionLoading && mentionUsers.length === 0 ? (
            <Text style={[styles.mentionStatusText, { color: mutedText, padding: 12 }]}>
              {activeMention.query
                ? t('commentSheet.mentionNoUsers')
                : t('commentSheet.mentionSearching')}
            </Text>
          ) : (
            <FlatList
              keyboardShouldPersistTaps="always"
              nestedScrollEnabled
              data={mentionUsers.slice(0, 8)}
              keyExtractor={item => String(item.id)}
              style={{ maxHeight: mentionMaxHeight }}
              contentContainerStyle={styles.mentionListContent}
              showsVerticalScrollIndicator
              bounces={false}
              ListHeaderComponent={
                mentionLoading ? (
                  <View style={styles.mentionLoadingHint}>
                    <ActivityIndicator size="small" color={accent} />
                  </View>
                ) : null
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.mentionRow, { borderBottomColor: border }]}
                  onPress={() => handleSelectMention(item)}
                  activeOpacity={0.75}
                >
                  <HexAvatar
                    uri={item.avatar}
                    size={28}
                    borderWidth={1}
                    borderColor={accent}
                  />
                  <View style={styles.mentionMeta}>
                    <Text style={[styles.mentionName, { color: labelColor }]} numberOfLines={1}>
                      {item.displayName}
                    </Text>
                    <Text style={[styles.mentionHandle, { color: mutedText }]} numberOfLines={1}>
                      @{item.username}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      ) : null}

      {/* Input row */}
      <View style={[styles.inputRow, bgStyle, { borderTopColor: border }]}>
        <View style={styles.inputAvatar}>
          <HexAvatar
            uri={profileImage}
            size={30}
            borderWidth={1}
            borderColor={accent}
          />
        </View>
        <TextInput
          placeholder={
            editingComment
              ? t('commentSheet.editPlaceholder')
              : replyingToComment
                ? t('commentSheet.replyPlaceholder', { username: replyingToComment.username })
                : t('commentSheet.addCommentPlaceholder')
          }
          placeholderTextColor={mutedText}
          style={[
            styles.input,
            {
              color: labelColor,
              backgroundColor: inputSurface,
              borderColor: border,
            },
          ]}
          value={replyingToComment ? replyText : commentText}
          onChangeText={
            replyingToComment ? handleReplyTextChange : handleCommentTextChange
          }
          onSelectionChange={event => {
            const selection = event?.nativeEvent?.selection;
            if (!selection) return;
            if (replyingToComment) {
              replySelectionRef.current = selection;
              setReplySelection(selection);
              if (selection.start > replyTextRef.current.length) return;
              runMentionSearch(replyTextRef.current, selection.start, 'reply');
            } else {
              inputSelectionRef.current = selection;
              setInputSelection(selection);
              if (selection.start > commentTextRef.current.length) return;
              runMentionSearch(
                commentTextRef.current,
                selection.start,
                'comment',
              );
            }
          }}
          editable={true}
        />
        <TouchableOpacity
          onPress={handleSendComment}
          disabled={
            isPosting ||
            !(replyingToComment ? replyText.trim() : commentText.trim())
          }>
          {isPosting ? (
            <ActivityIndicator size="small" color={accent} />
          ) : (
            <Text
              style={[
                styles.sendText,
                { color: accent },
                !(replyingToComment
                  ? replyText.trim()
                  : commentText.trim()) && styles.sendTextDisabled,
              ]}>
              {editingComment
                ? t('commentSheet.update')
                : replyingToComment
                  ? t('commentSheet.reply')
                  : t('commentSheet.send')}
            </Text>
          )}
        </TouchableOpacity>

        {(editingComment || replyingToComment) && (
          <TouchableOpacity
            style={{ marginLeft: 8 }}
            onPress={() => {
              setEditingComment(null);
              commentTextRef.current = '';
              setCommentText('');
              setReplyingToComment(null);
              replyTextRef.current = '';
              setReplyText('');
              clearMentionState();
            }}>
            <Icon name="close-circle" size={20} color={mutedText} />
          </TouchableOpacity>
        )}
      </View>

      {/* Action modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsModalVisible(false);
          setSelectedComment(null);
        }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: card }]}>
            <TouchableOpacity
              style={[styles.modalButton, { borderBottomColor: border, borderBottomWidth: 1 }]}
              onPress={handleCopyComment}
              disabled={!selectedComment?.text?.trim()}>
              <Text style={[styles.modalButtonText, { color: labelColor }]}>
                {t('commentSheet.copyComment')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, { borderBottomColor: border, borderBottomWidth: 1 }]}
              onPress={handleDeleteComment}
              disabled={selectedComment && isDeleting.has(selectedComment.id)}>
              <Text style={[styles.modalButtonText, { color: '#EF4444' }]}>
                {selectedComment && isDeleting.has(selectedComment.id)
                  ? t('commentSheet.deleting')
                  : t('commentSheet.deleteComment')}
              </Text>
            </TouchableOpacity>

            {selectedComment?.userId === String(currentUser?.id ?? userId) && (
              <TouchableOpacity
                style={[styles.modalButton, { borderBottomColor: border, borderBottomWidth: 1 }]}
                onPress={handleEditComment}>
                <Text style={[styles.modalButtonText, { color: labelColor }]}>
                  {t('commentSheet.editComment')}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setIsModalVisible(false);
                setSelectedComment(null);
              }}>
              <Text style={[styles.modalButtonText, { color: mutedText }]}>
                {t('commentSheet.cancel')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  bodyCollapsed: {
    flex: 0,
    height: 0,
    overflow: 'hidden',
    opacity: 0,
  },
  commentsList: {
    flex: 1,
  },
  commentCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  optimisticComment: {
    opacity: 0.6,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  hexAvatarWrap: {
    width: 32,
    height: 32,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    fontWeight: '600',
    fontSize: 14,
    marginRight: 6,
  },
  time: {
    fontSize: 12,
  },
  commentText: {
    fontSize: 14,
    marginTop: 2,
  },
  commentActionsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
    alignItems: 'center',
  },
  replyButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  votingContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  voteIcon: {
    fontSize: 16,
    opacity: 0.6,
  },
  voteIconActive: {
    opacity: 1,
  },
  voteCount: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.6,
  },
  voteCountActive: {
    fontWeight: '600',
    opacity: 1,
  },
  starIcon: {
    marginLeft: 8,
    alignSelf: 'center',
  },
  replyComposer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  replyingLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  inlineReplyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  replyCancelText: {
    fontSize: 13,
    fontWeight: '500',
  },
  repliesSection: {
    marginTop: 10,
    marginLeft: 16,
  },
  replyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    padding: 10,
    marginTop: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 0,
    borderTopWidth: 1,
  },
  inputAvatar: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    marginRight: 12,
  },
  sendText: {
    fontWeight: '600',
    fontSize: 16,
  },
  sendTextDisabled: {
    opacity: 0.4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 16,
  },
  commentsListContent: {
    paddingBottom: 12,
    flexGrow: 1,
  },
  mentionPanel: {
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 8,
    overflow: 'hidden',
  },
  mentionListContent: {
    paddingBottom: 4,
  },
  mentionLoadingHint: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  mentionStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  mentionStatusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  mentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mentionMeta: {
    flex: 1,
  },
  mentionName: {
    fontSize: 14,
    fontWeight: '700',
  },
  mentionHandle: {
    fontSize: 12,
    marginTop: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  modalContent: {
    borderRadius: 12,
    paddingVertical: 4,
    width: '80%',
    overflow: 'hidden',
  },
  modalButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  modalButtonText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
