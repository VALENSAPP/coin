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
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { formatDistanceToNow } from 'date-fns';
import {
  getComments,
  postComment,
  deleteComment,
  editComment,
} from '../../../services/post';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../../displaytoastmessage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch, useSelector } from 'react-redux';
import { hideLoader, showLoader } from '../../../redux/actions/LoaderAction';
import { useAppTheme } from '../../../theme/useApptheme';
import HexAvatar from '../story.js/HexAvatar';

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

const CommentItem = memo(({
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
}) => {
  const normalizeId = id => (id != null ? String(id).trim() : '');

  const viewerId = normalizeId(currentUserId);
  const itemUserId = normalizeId(item.userId);
  const ownerId = normalizeId(postOwnerId);

  const isCommentAuthor = viewerId && itemUserId === viewerId;
  const isPostOwner = viewerId && ownerId === viewerId;
  const canModerate = isCommentAuthor || isPostOwner;
  const hasReplies = Array.isArray(item.replies) && item.replies.length > 0;
  const isExpanded = !!expandedReplies[item.id];

  return (
    <View style={[styles.commentCard, item.isOptimistic && styles.optimisticComment]}>
      <View style={styles.commentRow}>
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={styles.username}>{item.username}</Text>
            <Text style={styles.time}>{item.time}</Text>
          </View>
          <Text style={styles.commentText}>{item.text}</Text>
          <View style={styles.commentActionsRow}>
            <TouchableOpacity onPress={() => onReplyPress?.(item)}>
              <Text style={styles.replyButtonText}>Reply</Text>
            </TouchableOpacity>
            {hasReplies ? (
              <TouchableOpacity onPress={() => onToggleReplies?.(item.id)}>
                <Text style={styles.replyButtonText}>
                  {isExpanded
                    ? 'Hide replies'
                    : `View replies (${item.replies.length})`}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {canModerate && (
          <TouchableOpacity
            style={styles.starIcon}
            onPress={() => onMorePress?.(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="ellipsis-vertical" size={18} color="#000" />
          </TouchableOpacity>
        )}
      </View>

      {replyingToThreadId === item.id && (
        <View style={styles.replyComposer}>
          <Text style={styles.replyingLabel}>
            Replying to {replyingToUsername || item.username}
          </Text>
          <View style={styles.inlineReplyRow}>
            <TextInput
              placeholder="Write a reply..."
              placeholderTextColor="#999"
              style={styles.replyInput}
              value={replyText}
              onChangeText={onChangeReplyText}
              editable={!isPosting}
            />
            <TouchableOpacity onPress={onCancelReply}>
              <Text style={styles.replyCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onSubmitReply}
              disabled={isPosting || !replyText.trim()}
            >
              <Text
                style={[
                  styles.sendText,
                  (isPosting || !replyText.trim()) && styles.sendTextDisabled,
                ]}
              >
                {isPosting ? 'Posting...' : 'Post'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {hasReplies && isExpanded ? (
        <View style={styles.repliesSection}>
          {item.replies.map(reply => (
            <View key={reply.id} style={styles.replyCard}>
              <Image source={{ uri: reply.avatar }} style={styles.avatar} />
              <View style={styles.commentContent}>
                <View style={styles.commentHeader}>
                  <Text style={styles.username}>{reply.username}</Text>
                  <Text style={styles.time}>{reply.time}</Text>
                </View>
                <Text style={styles.commentText}>{reply.text}</Text>
                <TouchableOpacity onPress={() => onReplyPress?.(reply)}>
                  <Text style={styles.replyButtonText}>Reply</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
});

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
  const [loading, setLoading] = useState(false);
  const [replyingToComment, setReplyingToComment] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [expandedReplies, setExpandedReplies] = useState({});

  const toast = useToast();
  const dispatch = useDispatch();
  const profileImage = useSelector(state => state.profileImage?.profileImg);
  const { bgStyle, textStyle, text } = useAppTheme();

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getComments(postId);
      if (response.success) {
        console.log('Comments fetched:', response.data.comments);

        const mappedComments = buildCommentTree(response.data.comments);
        setComments(mappedComments);
        onCommentCountUpdate?.(postId, mappedComments.length);
      } else {
        showToastMessage(toast, 'danger', 'Failed to load comments');
      }
    } catch (error) {
      showToastMessage(toast, 'danger', 'Error fetching comments');
    } finally {
      setLoading(false);
    }
  }, [postId, toast, onCommentCountUpdate]);

  useEffect(() => {
    if (postId) {
      fetchComments();
    }
    (async () => {
      const id = await AsyncStorage.getItem('userId');
      setUserId(id || null);
    })();
  }, [postId, fetchComments]);

  const handleSendComment = async () => {
    const activeText = replyingToComment ? replyText : commentText;
    if (!activeText.trim()) {
      showToastMessage(toast, 'danger', 'Please enter a comment');
      return;
    }
    if (isPosting) return;
    // dispatch(showLoader());
    const trimmedComment = activeText.trim();

    // --- EDIT FLOW ---
    if (editingComment) {
      setIsPosting(true);
      const oldText = editingComment.text;

      setComments(prev =>
        prev.map(c =>
          c.id === editingComment.id
            ? { ...c, text: trimmedComment, time: 'Edited just now' }
            : c,
        ),
      );

      try {
        const response = await editComment(editingComment.id, trimmedComment);
        if (response.success) {
          setComments(prev =>
            prev.map(c =>
              c.id === editingComment.id
                ? {
                  ...c,
                  text: response.data.comment || trimmedComment,
                  time:
                    formatDistanceToNow(
                      new Date(response.data.updatedAt || new Date()),
                      { addSuffix: true },
                    ) + ' (edited)',
                }
                : c,
            ),
          );
          showToastMessage(toast, 'success', 'Comment updated');
        } else {
          setComments(prev =>
            prev.map(c =>
              c.id === editingComment.id ? { ...c, text: oldText } : c,
            ),
          );
          showToastMessage(toast, 'danger', 'Failed to update comment');
        }
      } catch (error) {
        setComments(prev =>
          prev.map(c =>
            c.id === editingComment.id ? { ...c, text: oldText } : c,
          ),
        );
        showToastMessage(toast, 'danger', 'Error updating comment');
      } finally {
        setIsPosting(false);
        setEditingComment(null);
        setCommentText('');
        // dispatch(hideLoader());
      }
      return;
    }

    if (replyingToComment?.id) {
      setIsPosting(true);
      try {
        const response = await postComment(
          postId,
          trimmedComment,
          replyingToComment.threadId || replyingToComment.id,
        );
        if (response.success) {
          setReplyText('');
          setReplyingToComment(null);
          setExpandedReplies(prev => ({
            ...prev,
            [replyingToComment.threadId || replyingToComment.parentId || replyingToComment.id]: true,
          }));
          fetchComments();
          showToastMessage(toast, 'success', 'Reply posted successfully');
        } else {
          showToastMessage(toast, 'danger', 'Failed to post reply');
        }
      } catch (error) {
        showToastMessage(toast, 'danger', 'Error posting reply');
      } finally {
        setIsPosting(false);
        setReplyText('');
      }
      return;
    }

    // --- NEW COMMENT FLOW ---
    const tempId = `temp-${Date.now()}`;
    const tempComment = {
      id: tempId,
      userId: currentUser?.id,
      username: currentUser?.displayName || 'You',
      avatar: currentUser?.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
      text: trimmedComment,
      time: 'Just now',
      isOptimistic: true,
    };

    setComments(prev => [tempComment, ...prev]);
    setCommentText('');
    onCommentCountUpdate?.(postId, comments.length + 1);

    setIsPosting(true);

    try {
      const response = await postComment(postId, trimmedComment);
      if (response.success) {
        const realComment = {
          id: response.data.id?.toString() || `real-${Date.now()}`,
          userId: response.data.userId ?? currentUser?.id,
          username:
            response.data.displayName || currentUser?.displayName || 'You',
          avatar:
            response.data.image ||
            currentUser?.avatar ||
            'https://cdn-icons-png.flaticon.com/512/149/149071.png',
          text: response.data.comment || trimmedComment,
          time: formatDistanceToNow(
            new Date(response.data.createdAt || new Date()),
            { addSuffix: true },
          ),
        };
        fetchComments()
        setComments(prev =>
          prev.map(comment => (comment.id === tempId ? realComment : comment)),
        );
        showToastMessage(toast, 'success', 'Comment posted successfully');
      } else {
        setComments(prev => prev.filter(c => c.id !== tempId));
        onCommentCountUpdate?.(postId, comments.length);
        showToastMessage(toast, 'danger', 'Failed to post comment');
      }
    } catch (error) {
      setComments(prev => prev.filter(c => c.id !== tempId));
      onCommentCountUpdate?.(postId, comments.length);
      showToastMessage(toast, 'danger', 'Error posting comment');
    } finally {
      setIsPosting(false);
      // dispatch(hideLoader());
    }
  };

  const openActionsFor = comment => {
    if (comment.isOptimistic) return;
    setSelectedComment(comment);
    setIsModalVisible(true);
  };

  const handleReplyPress = comment => {
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
  };

  const handleToggleReplies = commentId => {
    setExpandedReplies(prev => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  const handleDeleteComment = async () => {
    if (!selectedComment?.id) {
      showToastMessage(toast, 'danger', 'Invalid comment');
      return;
    }

    const viewerId = String(currentUser?.id ?? userId ?? '');
    const isCommentAuthor =
      viewerId && String(selectedComment.userId) === viewerId;
    const isPostOwner =
      viewerId && postOwnerId != null && String(postOwnerId) === viewerId;
    if (!(isCommentAuthor || isPostOwner)) {
      showToastMessage(
        toast,
        'danger',
        'You do not have permission to delete this comment',
      );
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
          response.data?.message || 'Comment deleted',
        );
      } else {
        setComments(prev => [selectedComment, ...prev]);
        onCommentCountUpdate?.(postId, comments.length);
        showToastMessage(
          toast,
          'danger',
          response.data?.message || 'Failed to delete comment',
        );
      }
    } catch (error) {
      setComments(prev => [selectedComment, ...prev]);
      onCommentCountUpdate?.(postId, comments.length);
      showToastMessage(toast, 'danger', 'Error deleting comment');
    } finally {
      setIsDeleting(prev => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
      setSelectedComment(null);
    }
  };

  const handleEditComment = () => {
    if (!selectedComment) return;
    setCommentText(selectedComment.text);
    setEditingComment(selectedComment);
    setIsModalVisible(false);
    setSelectedComment(null);
  };

  const commentKeyExtractor = useCallback((item) => item.id, []);
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
      />
    ),
    [
      openActionsFor,
      currentUser?.id,
      userId,
      postOwnerId,
      replyingToComment?.threadId,
      replyingToComment?.username,
      replyText,
      isPosting,
      expandedReplies,
    ]
  );

  return (
    <View style={[styles.container, bgStyle]}>
      <Text style={styles.title}>Comments ({comments.length})</Text>

      {loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      ) : comments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No comments yet</Text>
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
          placeholder={replyingToComment ? `Reply to ${replyingToComment.username}...` : 'Add a comment...'}
          placeholderTextColor="#999"
          style={styles.input}
          value={replyingToComment ? replyText : commentText}
          onChangeText={replyingToComment ? setReplyText : setCommentText}
          editable={!isPosting}
        />
        <TouchableOpacity
          onPress={handleSendComment}
          disabled={isPosting || !(replyingToComment ? replyText.trim() : commentText.trim())}
        >
          <Text
            style={[
              styles.sendText,
              (isPosting || !(replyingToComment ? replyText.trim() : commentText.trim())) && styles.sendTextDisabled,
            ]}
          >
            {isPosting
              ? editingComment
                ? 'Updating...'
                : 'Posting...'
              : editingComment
                ? 'Update'
                : replyingToComment
                  ? 'Reply'
                  : 'Send'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Action modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsModalVisible(false);
          setSelectedComment(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleDeleteComment}
              disabled={selectedComment && isDeleting.has(selectedComment.id)}
            >
              <Text style={styles.modalButtonText}>
                {selectedComment && isDeleting.has(selectedComment.id)
                  ? 'Deleting...'
                  : 'Delete Comment'}
              </Text>
            </TouchableOpacity>

            {selectedComment?.userId === String(currentUser?.id ?? userId) && (
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleEditComment}
              >
                <Text style={styles.modalButtonText}>Edit Comment</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                setIsModalVisible(false);
                setSelectedComment(null);
              }}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
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
  },
  replyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
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
  inputAvatar: {
    borderWidth:1,
    borderColor:'lightgrey',
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  input: {
    // flex: 1,
    width:'70%',
    borderWidth:1,
    borderColor:'lightgrey',
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
