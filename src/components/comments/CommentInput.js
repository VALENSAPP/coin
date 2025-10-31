import React, { useRef, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, Image, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

export default function CommentInput({ onSend, replyTo, onCancelReply }) {
  const [text, setText] = React.useState('');
  const inputRef = useRef();

  useEffect(() => {
    if (replyTo && inputRef.current) {
      inputRef.current.focus();
      setText(`@${replyTo.username} `);
    }
  }, [replyTo]);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <View style={styles.row}>
      <Image source={{ uri: 'https://randomuser.me/api/portraits/men/7.jpg' }} style={styles.avatar} />
      <View style={{ flex: 1 }}>
        {replyTo && (
          <View style={styles.replyingToRow}>
            <Text style={styles.replyingTo}>Replying to @{replyTo.username}</Text>
            <TouchableOpacity onPress={onCancelReply}>
              <Icon name="close" size={16} color="#888" />
            </TouchableOpacity>
          </View>
        )}
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Add a comment..."
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          placeholderTextColor={'#000'}
        />
      </View>
      <TouchableOpacity onPress={handleSend} disabled={!text.trim()} style={styles.buttonSend}>
        <Icon name="send" size={24} color={text.trim() ? '#3897f0' : '#bbb'} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#f8f2fd',marginBottom:25 },
  avatar: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  input: { color: '#000', backgroundColor: '#f8f2fd', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, fontSize: 15, marginTop: 2 },
  replyingToRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  replyingTo: { color: '#888', fontSize: 12, marginRight: 6 },
  buttonSend:{marginBottom:5}
}); 