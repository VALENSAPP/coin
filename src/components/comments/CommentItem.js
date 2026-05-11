import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import LikeButton from './LikeButton';
import { getTimeAgo, parseText } from '../../utils/commentUtils';
import { useLanguage } from '../../i18n';
 
export default function CommentItem({
  comment,
  onLike,
  onReply,
  onToggleReplies,
  showReplies,
  replyCount,
}) {
  const { t } = useLanguage();
 
  return (
    <View style={styles.row}>
      <TouchableOpacity>
        <Image source={{ uri: comment.user.avatar }} style={styles.avatar} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <TouchableOpacity>
            <Text style={styles.username}>{comment.user.name}</Text>
          </TouchableOpacity>
          <Text style={styles.text}> {parseText(comment.text)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.time}>{getTimeAgo(comment.timestamp)}</Text>
          <TouchableOpacity onPress={onReply}>
            <Text style={styles.reply}>{t('comments.reply')}</Text>
          </TouchableOpacity>
          {replyCount > 0 && (
            <TouchableOpacity onPress={onToggleReplies}>
              <Text style={styles.reply}>
                {showReplies
                  ? t('comments.hideReplies')
                  : t('comments.viewReplies', { count: replyCount })}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <LikeButton liked={comment.liked} count={comment.likes} onPress={onLike} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', padding: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  username: { fontWeight: 'bold', color: '#222' },
  text: { color: '#222', fontSize: 15, flexShrink: 1, flexWrap: 'wrap' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 8 },
  time: { color: '#888', fontSize: 13, marginRight: 8 },
  reply: { color: '#888', fontSize: 13, marginRight: 8 },
}); 