import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import LikeButton from './LikeButton';

export default function ReplyItem({ reply, onLike, onReply }) {
  const getTimeAgo = (ts) => {
    const diff = Math.floor((Date.now() - ts) / 60000);
    if (diff < 1) return 'now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  const parseText = (text) =>
    text.split(/([#@][\w_]+)/g).map((part, i) =>
      part.startsWith('#') ? (
        <Text key={i} style={{ color: '#385898' }}>{part}</Text>
      ) : part.startsWith('@') ? (
        <Text key={i} style={{ color: '#00376b' }}>{part}</Text>
      ) : (
        <Text key={i}>{part}</Text>
      )
    );

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
            <Text style={styles.reply}>Reply</Text>
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