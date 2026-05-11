import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import LikeButton from './LikeButton';
import { getTimeAgo, parseText } from '../../utils/commentUtils';
import { useLanguage } from '../../i18n';
 
export default function ReplyItem({ reply, onLike, onReply }) {
  const { t } = useLanguage();
 
  return (
    <View style={styles.row}>
      <TouchableOpacity>
        <Image source={{ uri: reply.user.avatar }} style={styles.avatar} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <TouchableOpacity>
            <Text style={styles.username}>{reply.user.name}</Text>
          </TouchableOpacity>
          <Text style={styles.text}> {parseText(reply.text)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.time}>{getTimeAgo(reply.timestamp)}</Text>
          <TouchableOpacity onPress={onReply}>
            <Text style={styles.reply}>{t('comments.reply')}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <LikeButton liked={reply.liked} count={reply.likes} onPress={onLike} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
  avatar: { width: 30, height: 30, borderRadius: 15, marginRight: 10 },
  username: { fontWeight: 'bold', color: '#222' },
  text: { color: '#222', fontSize: 15, flexShrink: 1, flexWrap: 'wrap' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 8 },
  time: { color: '#888', fontSize: 13, marginRight: 8 },
  reply: { color: '#888', fontSize: 13, marginRight: 8 },
}); 