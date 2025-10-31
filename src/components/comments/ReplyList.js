import React from 'react';
import { View } from 'react-native';
import ReplyItem from './ReplyItem';

export default function ReplyList({ replies, commentId, onLike, onReply, replyTo }) {
  return (
    <View style={{ marginLeft: 44 }}>
      {replies.map(reply => (
        <ReplyItem
          key={reply.id}
          reply={reply}
          commentId={commentId}
          onLike={() => onLike(commentId, reply.id)}
          onReply={() => onReply({ commentId, replyId: reply.id, username: reply.user.name })}
          replyTo={replyTo}
        />
      ))}
    </View>
  );
} 