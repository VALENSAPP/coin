import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
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
import { useDispatch, useSelector } from 'react-redux';
import { useAppTheme } from '../../../theme/useApptheme';
import HexAvatar from '../story.js/HexAvatar';
import { useLanguage } from '../../../i18n';
import { useNavigation } from '@react-navigation/native';

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
    currentUserId,
    postOwnerId,
    onReplyPress,
    replyingToThreadId,
    replyingToUsername,
    replyText,
    onChangeReplyText,
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

    return (
      <View
        style={[
          styles.commentCard,
          item.isOptimistic && styles.optimisticComment,
        ]}>
        <View style={styles.commentRow}>
          <TouchableOpacity
            onPress={() => {
              if (!item?.userId) return;
              navigation.navigate('UsersProfile', { userId: item.userId });
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.hexAvatarWrap}
            accessibilityRole="button"
          >
            <HexAvatar uri={item.avatar} size={28} borderWidth={1} borderColor="#e5e5e5" />
          </TouchableOpacity>
          <View style={styles.commentContent}>
            <View style={styles.commentHeader}>
              <Text style={styles.username}>{item.username}</Text>
              <Text style={styles.time}>{item.time}</Text>
            </View>
            <Text style={styles.commentText}>{item.text}</Text>
            <View style={styles.commentActionsRow}>
              <TouchableOpacity onPress={() => onReplyPress?.(item)}>
                <Text style={styles.replyButtonText}>{t('commentSheet.reply')}</Text>
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
                        votes.userVote === 'up' && styles.voteCountActive,
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
                        votes.userVote === 'down' && styles.voteCountActive,
                      ]}>
                      {votes.thumbsDown}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {hasReplies ? (
                <TouchableOpacity onPress={() => onToggleReplies?.(item.id)}>
                  <Text style={styles.replyButtonText}>
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
              <Icon name="ellipsis-vertical" size={18} color="#000" />
            </TouchableOpacity>
          )}
        </View>

        {replyingToThreadId === item.id && (
          <View style={styles.replyComposer}>
            <Text style={styles.replyingLabel}>
              {t('commentSheet.replyingTo')} {replyingToUsername || item.username}
            </Text>
            <View style={styles.inlineReplyRow}>
              <TextInput
                placeholder={t('commentSheet.writeReplyPlaceholder')}
                placeholderTextColor="#999"
                style={styles.replyInput}
                value={replyText}
                onChangeText={onChangeReplyText}
                editable={!isPosting}
              />
              <TouchableOpacity onPress={onCancelReply}>
                <Text style={styles.replyCancelText}>{t('commentSheet.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onSubmitReply}
                disabled={isPosting || !replyText.trim()}>
                {isPosting ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <Text
                    style={[
                      styles.sendText,
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
                <View key={reply.id} style={styles.replyCard}>
                  <TouchableOpacity
                    onPress={() => {
                      if (!reply?.userId) return;
                      navigation.navigate('UsersProfile', { userId: reply.userId });
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.hexAvatarWrap}
                    accessibilityRole="button"
                  >
                    <HexAvatar uri={reply.avatar} size={28} borderWidth={1} borderColor="#e5e5e5" />
                  </TouchableOpacity>
                  <View style={styles.commentContent}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.username}>{reply.username}</Text>
                      <Text style={styles.time}>{reply.time}</Text>
                    </View>
                    <Text style={styles.commentText}>{reply.text}</Text>
                    <View style={styles.commentActionsRow}>
                      <TouchableOpacity onPress={() => onReplyPress?.(reply)}>
                        <Text style={styles.replyButtonText}>{t('commentSheet.reply')}</Text>
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
                                replyVotes.userVote === 'up' && styles.voteCountActive,
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
                                replyVotes.userVote === 'down' && styles.voteCountActive,
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
                            color="#000"
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

  const isFetchingRef = useRef(false);

  const toast = useToast();
  const { t } = useLanguage();
  const profileImage = useSelector(state => state.profileImage?.profileImg);
  const { bgStyle, textStyle, text } = useAppTheme();

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

  // ─── send / edit / reply ─────────────────────────────────────────────────────

  const handleSendComment = useCallback(async () => {
    const activeText = replyingToComment ? replyText : commentText;
    if (!activeText.trim()) {
      showToastMessage(toast, 'danger', t('commentSheet.errorEmptyComment'));
      return;
    }
    if (isPosting) return;

    const trimmedComment = activeText.trim();

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
    setReplyText('');
    setExpandedReplies(prev => ({
      ...prev,
      [comment.parentId || comment.id]: true,
    }));
  }, []);

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
    setCommentText(selectedComment.text);
    setEditingComment(selectedComment);
    setIsModalVisible(false);
    setSelectedComment(null);
  }, [selectedComment]);

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
        currentUserId={currentUser?.id ?? userId}
        postOwnerId={postOwnerId}
        onReplyPress={handleReplyPress}
        replyingToThreadId={replyingToComment?.threadId}
        replyingToUsername={replyingToComment?.username}
        replyText={replyText}
        onChangeReplyText={setReplyText}
        onSubmitReply={handleSendComment}
        onCancelReply={() => {
          setReplyingToComment(null);
          setReplyText('');
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
      currentUser?.id,
      userId,
      postOwnerId,
      handleReplyPress,
      replyingToComment?.threadId,
      replyingToComment?.username,
      replyText,
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

  return (
    <View style={[styles.container, bgStyle]}>
      <Text style={styles.title}>
        {t('commentSheet.title', { count: comments.length })}
      </Text>

      {initialLoading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      ) : comments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('commentSheet.noComments')}</Text>
        </View>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={commentKeyExtractor}
          renderItem={renderCommentItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.commentsListContent}
        />
      )}

      {/* Input row */}
      <View style={[styles.inputRow, bgStyle]}>
        <View style={{ marginRight: 8 }}>
          <HexAvatar
            uri={profileImage}
            size={30}
            borderWidth={1}
            borderColor={text}
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
          placeholderTextColor="#999"
          style={styles.input}
          value={replyingToComment ? replyText : commentText}
          onChangeText={replyingToComment ? setReplyText : setCommentText}
          editable={!isPosting}
        />
        <TouchableOpacity
          onPress={handleSendComment}
          disabled={
            isPosting ||
            !(replyingToComment ? replyText.trim() : commentText.trim())
          }>
          {isPosting ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Text
              style={[
                styles.sendText,
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
              setCommentText('');
              setReplyingToComment(null);
              setReplyText('');
            }}>
            <Icon name="close-circle" size={20} color="#999" />
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
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleDeleteComment}
              disabled={selectedComment && isDeleting.has(selectedComment.id)}>
              <Text style={styles.modalButtonText}>
                {selectedComment && isDeleting.has(selectedComment.id)
                  ? t('commentSheet.deleting')
                  : t('commentSheet.deleteComment')}
              </Text>
            </TouchableOpacity>

            {selectedComment?.userId === String(currentUser?.id ?? userId) && (
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleEditComment}>
                <Text style={styles.modalButtonText}>{t('commentSheet.editComment')}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                setIsModalVisible(false);
                setSelectedComment(null);
              }}>
              <Text style={styles.modalButtonText}>{t('commentSheet.cancel')}</Text>
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
    paddingTop: 8,
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
    color: '#000',
  },
  commentCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
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
    color: '#000',
    marginRight: 6,
  },
  time: {
    fontSize: 12,
    color: '#888',
  },
  commentText: {
    fontSize: 14,
    color: '#000',
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
    color: '#007AFF',
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
    color: '#666',
    fontWeight: '500',
    opacity: 0.6,
  },
  voteCountActive: {
    color: '#007AFF',
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
    borderTopColor: '#eee',
  },
  replyingLabel: {
    fontSize: 12,
    color: '#666',
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
    borderColor: 'lightgrey',
    backgroundColor: '#f2f2f2',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#000',
  },
  replyCancelText: {
    fontSize: 13,
    color: '#666',
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
    backgroundColor: '#f8f8f8',
    padding: 10,
    marginTop: 8,
  },
  inputRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    width: '70%',
    borderWidth: 1,
    borderColor: 'lightgrey',
    backgroundColor: '#f2f2f2',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    fontSize: 14,
    color: '#000',
    marginRight: 20,
  },
  sendText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 18,
  },
  sendTextDisabled: {
    color: '#ccc',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
  },
  commentsListContent: {
    paddingBottom: 70,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    width: '80%',
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  modalButtonText: {
    fontSize: 16,
    color: '#007AFF',
    textAlign: 'center',
  },
  cancelButton: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
});
