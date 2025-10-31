import React from 'react';
import { View } from 'react-native';
import CommentItem from './CommentItem';
import ReplyList from './ReplyList';

export default function CommentList({
  comment,
  onLike,
  onReply,
  onToggleReplies,
  replyTo,
}) {
  return (
    <View>
      <CommentItem
        comment={comment}
        onLike={() => onLike(comment.id)}
        onReply={() => onReply({ commentId: comment.id, username: comment.user.name })}
        onToggleReplies={() => onToggleReplies(comment.id)}
        showReplies={comment.showReplies}
        replyCount={comment.replyCount}
      />
      {comment.showReplies && comment.replies && comment.replies.length > 0 && (
        <ReplyList
          replies={comment.replies}
          commentId={comment.id}
          onLike={onLike}
          onReply={onReply}
          replyTo={replyTo}
        />
      )}
    </View>
  );
} 