import React, { useState, useRef } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, Text } from 'react-native';
import CommentList from './CommentList';
import CommentInput from './CommentInput';

const initialComments = [/* ...mock data as before... */];

export default function CommentSection({ caption, onClose, initialComments: initial = initialComments }) {
  const [comments, setComments] = useState(initial);
  const [replyTo, setReplyTo] = useState(null); // {commentId, username}
  const flatListRef = useRef();

  // Add new comment or reply
  const handleAddComment = (text) => {
    if (!text.trim()) return;
    if (replyTo) {
      setComments(prev =>
        prev.map(c =>
          c.id === replyTo.commentId
            ? {
                ...c,
                replies: [
                  ...c.replies,
                  {
                    id: 'r' + Date.now(),
                    user: { id: 'me', name: 'You', avatar: 'https://randomuser.me/api/portraits/men/7.jpg' },
                    text,
                    timestamp: Date.now(),
                    likes: 0,
                    liked: false,
                  },
                ],
                replyCount: c.replyCount + 1,
              }
            : c
        )
      );
    } else {
      setComments(prev => [
        {
          id: Date.now().toString(),
          user: { id: 'me', name: 'You', avatar: 'https://randomuser.me/api/portraits/men/7.jpg' },
          text,
          timestamp: Date.now(),
          likes: 0,
          liked: false,
          replies: [],
          replyCount: 0,
        },
        ...prev,
      ]);
    }
    setReplyTo(null);
    // Optionally scroll to bottom or new comment
  };

  // Like/unlike comment or reply
  const handleLike = (commentId, replyId = null) => {
    setComments(prev =>
      prev.map(c => {
        if (c.id === commentId) {
          if (replyId) {
            return {
              ...c,
              replies: c.replies.map(r =>
                r.id === replyId
                  ? { ...r, liked: !r.liked, likes: r.liked ? r.likes - 1 : r.likes + 1 }
                  : r
              ),
            };
          } else {
            return { ...c, liked: !c.liked, likes: c.liked ? c.likes - 1 : c.likes + 1 };
          }
        }
        return c;
      })
    );
  };

  // Toggle replies
  const handleToggleReplies = (commentId) => {
    setComments(prev =>
      prev.map(c =>
        c.id === commentId ? { ...c, showReplies: !c.showReplies } : c
      )
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        {/* Close button for modal */}
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        )}
        {/* Caption at the top if provided */}
        
          <View style={styles.captionRow}>
            <Text style={styles.captionUser}>Comments</Text>
          </View>
        <FlatList
          ref={flatListRef}
          data={comments}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <CommentList
              comment={item}
              onLike={handleLike}
              onReply={setReplyTo}
              onToggleReplies={handleToggleReplies}
              replyTo={replyTo}
            />
          )}
        />
        <CommentInput
          onSend={handleAddComment}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f2fd' },
  closeBtn: { position: 'absolute', top: 10, right: 10, zIndex: 10 },
  closeText: { fontSize: 24, color: '#222' },
  captionRow: { flexDirection: 'row', alignItems: 'center',justifyContent:'center' ,padding: 12, backgroundColor: '#f8f2fd' },
  captionUser: { fontWeight: 'bold', color: '#222', marginRight: 6 ,fontSize:20},
  captionText: { color: '#222', flex: 1 },
}); 