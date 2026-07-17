import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useAppTheme } from '../../../theme/useApptheme';
import {
  getSocket,
  getClosetChatMessages,
  markClosetChatMessageSeen,
  initializeSocket,
} from '../../../services/socket';
import {
  getClosetChatMessagesApi,
  sendClosetChatMessageApi,
  markClosetChatMessageSeenApi,
} from '../../../services/chatMessage';
import useSocket from '../../../hooks/useSocket';
import { useLanguage } from '../../../i18n';
import HexAvatar from '../../../components/home/story.js/HexAvatar';

const ONLINE_PLACEHOLDER = 'https://ui-avatars.com/api/?name=User&background=e0e0e0&color=888&size=128';

// Fallback icon component
const FallbackIcon = ({ name, size = 24, color = '#000', style }) => {
  const getIconText = (iconName) => {
    switch (iconName) {
      case 'arrow-back':
        return '←';
      case 'checkmark-done':
        return '✓✓';
      case 'checkmark':
        return '✓';
      case 'send':
        return '➔';
      case 'alert-circle':
        return '⚠';
      default:
        return '•';
    }
  };

  return (
    <View style={[{
      width: size,
      height: size,
      justifyContent: 'center',
      alignItems: 'center',
    }, style]}>
      <Text style={{
        fontSize: size * 0.8,
        color: color,
        fontWeight: 'bold',
      }}>
        {getIconText(name)}
      </Text>
    </View>
  );
};

// Safe icon wrapper
const SafeIcon = ({ name, size = 24, color = '#000', style }) => {
  if (Icon) {
    try {
      return <Icon name={name} size={size} color={color} style={style} />;
    } catch (error) {
      console.warn('Error rendering icon:', error);
      return <FallbackIcon name={name} size={size} color={color} style={style} />;
    }
  }
  return <FallbackIcon name={name} size={size} color={color} style={style} />;
};

export default function UserClosetChat({ route, navigation }) {
  const routeParams = route?.params || {};
  const { threadId, otherUser, orderInfo } = routeParams;

  const { t } = useLanguage();
  const { bgStyle, textStyle, text } = useAppTheme();

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [socketReady, setSocketReady] = useState(false);

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalMessages, setTotalMessages] = useState(0);
  const [limit] = useState(20);

  const flatListRef = useRef(null);

  // Ensure socket is initialized with correct user ID
  useEffect(() => {
    const setupUserAndSocket = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (!userId) {
          Alert.alert(t('chatMessages.errorTitle') || 'Error', t('chatMessages.loginRequired') || 'Login required', [
            { text: 'OK', onPress: () => navigation.goBack() }
          ]);
          return;
        }
        setCurrentUserId(userId);

        const socket = getSocket();
        if (socket?.connected) {
          setSocketReady(true);
        } else {
          console.log('🔌 UserClosetChat: Initializing socket...');
          await initializeSocket(userId);
          setSocketReady(true);
        }
      } catch (err) {
        console.error('❌ UserClosetChat error setting up socket:', err);
        setError('Failed to setup chat session');
        setIsLoading(false);
      }
    };

    setupUserAndSocket();
  }, [navigation, t]);

  const loadMessagesViaApi = useCallback(async (pageNumber = 1) => {
    try {
      console.log(`📡 UserClosetChat: Fetching messages via API (page: ${pageNumber})`);
      const response = await getClosetChatMessagesApi(threadId, pageNumber, limit);
      console.log(`📥 API getClosetChatMessages response:`, response);
      if (response && response.success) {
        const receivedMsgs = Array.isArray(response.data)
          ? response.data
          : (response.data?.messages || []);
        const total = typeof response.data?.total === 'number'
          ? response.data.total
          : (receivedMsgs.length || 0);

        setTotalMessages(prev => Math.max(prev, total));
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => String(m.id)));
          const filteredNew = receivedMsgs.filter(m => m && m.id && !existingIds.has(String(m.id)));
          const merged = [...prev, ...filteredNew];
          merged.sort((a, b) => new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp));
          return merged;
        });

        // Mark unread received messages as seen via API
        receivedMsgs.forEach(msg => {
          const senderId = String(msg.senderId || msg.sender?.id || '');
          const isUnread = !msg.isSeen && msg.seen !== true;
          if (senderId && senderId !== String(currentUserId) && isUnread && msg.id) {
            console.log('📤 UserClosetChat: Marking message seen via API:', msg.id);
            markClosetChatMessageSeenApi(msg.id).catch(err => {
              console.warn('❌ API markClosetChatMessageSeen error:', err);
            });
          }
        });

        if (pageNumber === 1) {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 200);
        }
      }
    } catch (err) {
      console.warn('❌ Error fetching messages via API:', err);
    }
  }, [threadId, limit, currentUserId]);

  // Fetch initial messages when user ID and socket are ready
  const fetchInitialMessages = useCallback(() => {
    if (currentUserId && threadId && socketReady) {
      setIsLoading(true);
      setError(null);
      setPage(1);
      console.log('📡 UserClosetChat: Requesting page 1 messages for thread:', threadId);
      getClosetChatMessages(currentUserId, threadId, 1, limit);
      loadMessagesViaApi(1);
    }
  }, [currentUserId, threadId, socketReady, limit, loadMessagesViaApi]);

  useEffect(() => {
    fetchInitialMessages();
  }, [fetchInitialMessages]);

  // Handle reconnect to re-request thread messages
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleConnect = () => {
      setSocketReady(true);
      if (currentUserId && threadId) {
        console.log('🔄 UserClosetChat: Reconnected, re-requesting messages');
        getClosetChatMessages(currentUserId, threadId, 1, limit);
        loadMessagesViaApi(1);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('reconnect', handleConnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('reconnect', handleConnect);
    };
  }, [currentUserId, threadId, limit, loadMessagesViaApi]);

  // Helper to check if a message is a system message
  const isSystemMessage = (msg) => {
    if (!msg) return false;
    const rawType = String(msg.type || '').toUpperCase();
    const content = String(msg.message || msg.content || '').toLowerCase();
    return (
      rawType === 'SYSTEM' ||
      msg.isSystem === true ||
      content.includes('placed an order') ||
      content.includes('placed a order')
    );
  };

  // Helper to mark received unread messages as read
  const markMessagesAsSeen = useCallback((msgList) => {
    if (!currentUserId) return;
    msgList.forEach(msg => {
      const senderId = String(msg.senderId || msg.sender?.id || '');
      const isUnread = !msg.isSeen && msg.seen !== true;
      if (senderId && senderId !== String(currentUserId) && isUnread && msg.id) {
        console.log('📤 UserClosetChat: Marking message seen:', msg.id);
        markClosetChatMessageSeen(currentUserId, msg.id);
        markClosetChatMessageSeenApi(msg.id).catch(err => {
          console.warn('❌ API markClosetChatMessageSeen error:', err);
        });
      }
    });
  }, [currentUserId]);

  // SOCKET LISTENERS

  // 1. closetChatMessages (fetch success)
  useSocket('closetChatMessages', (data) => {
    console.log('📥 Received closetChatMessages:', {
      threadId: data?.threadId,
      page: data?.page,
      messagesCount: data?.messages?.length,
      total: data?.total
    });

    if (String(data?.threadId) !== String(threadId)) return;

    setIsLoading(false);
    setIsRefreshing(false);
    setError(null);

    const receivedMsgs = data?.messages || [];
    setTotalMessages(data?.total || 0);

    setMessages(prev => {
      const existingIds = new Set(prev.map(m => String(m.id)));
      const filteredNew = receivedMsgs.filter(m => !existingIds.has(String(m.id)));
      const merged = [...prev, ...filteredNew];
      merged.sort((a, b) => new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp));
      return merged;
    });

    // Mark unread received messages as seen
    markMessagesAsSeen(receivedMsgs);

    // Scroll to end on first page load
    if (data?.page === 1) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [threadId, markMessagesAsSeen]);

  // 2. closetChatMessagesError
  useSocket('closetChatMessagesError', (data) => {
    console.warn('❌ closetChatMessagesError:', data?.message);
    setError(data?.message || 'Failed to load messages');
    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  // 3. closetChatMessageSent (ack for sender)
  useSocket('closetChatMessageSent', (serverMsg) => {
    console.log('📥 closetChatMessageSent acknowledgment:', serverMsg);

    if (String(serverMsg?.threadId) !== String(threadId)) return;

    setMessages(prev => {
      // Find the first pending message that matches the text content
      const pendingIndex = prev.findIndex(m => m.isPending && m.message === serverMsg.message);
      if (pendingIndex !== -1) {
        const updated = [...prev];
        updated[pendingIndex] = {
          ...serverMsg,
          isPending: false
        };
        return updated;
      }
      
      // If no matching pending message was found, append it securely
      if (!prev.some(m => String(m.id) === String(serverMsg.id))) {
        return [...prev, serverMsg].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      }
      return prev;
    });

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [threadId]);

  // 4. closetChatNewMessage (real-time push for receiver/sender)
  useSocket('closetChatNewMessage', (newMsg) => {
    console.log('📥 closetChatNewMessage real-time push:', newMsg);

    if (String(newMsg?.threadId) !== String(threadId)) return;

    setMessages(prev => {
      // Deduplicate
      if (prev.some(m => String(m.id) === String(newMsg.id))) return prev;
      const updated = [...prev, newMsg];
      updated.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      return updated;
    });

    // Mark as seen immediately since screen is focused
    markMessagesAsSeen([newMsg]);

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [threadId, markMessagesAsSeen]);

  // 5. closetChatMessageSeen (seen status update)
  useSocket('closetChatMessageSeen', (data) => {
    console.log('📥 closetChatMessageSeen event:', data);

    if (String(data?.threadId) !== String(threadId)) return;

    setMessages(prev =>
      prev.map(msg =>
        String(msg.id) === String(data.messageId)
          ? { ...msg, isSeen: true, seen: true }
          : msg
      )
    );
  }, [threadId]);

  // 6. closetChatMessageSeenError
  useSocket('closetChatMessageSeenError', (data) => {
    console.warn('❌ closetChatMessageSeenError:', data?.message);
  }, []);

  // 7. closetChatSendError (send failed)
  useSocket('closetChatSendError', (data) => {
    console.warn('❌ closetChatSendError:', data?.message);
    Alert.alert('Send Error', data?.message || 'Failed to send closet chat message');

    // Find the latest pending message, restore its text to the text input box, and remove it from lists
    setMessages(prev => {
      const pendingMsg = prev.find(m => m.isPending);
      if (pendingMsg) {
        setInputText(pendingMsg.message);
        return prev.filter(m => m.id !== pendingMsg.id);
      }
      return prev;
    });
  }, []);

  // Send message handler
  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || !currentUserId || !threadId) return;

    // Generate optimistic tempId
    const tempId = `temp_${Date.now()}`;

    const tempMessage = {
      id: tempId,
      message: trimmed,
      senderId: currentUserId,
      createdAt: new Date().toISOString(),
      isPending: true,
      type: 'user',
      isSeen: false
    };

    // Add optimistically to messages list
    setMessages(prev => [...prev, tempMessage]);
    setInputText('');

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // Call REST API
    try {
      const response = await sendClosetChatMessageApi(threadId, trimmed);
      console.log('📥 API sendClosetChatMessage response:', response);
      if (response && response.success) {
        const serverMsg = response.data || {};
        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempId
              ? { ...serverMsg, isPending: false }
              : msg
          )
        );
      } else {
        throw new Error(response?.message || 'Failed to send message via API');
      }
    } catch (error) {
      console.warn('❌ API Send Error:', error);
      Alert.alert('Send Error', error.message || 'Failed to send closet chat message');
      
      // Restore input and remove pending message
      setMessages(prev => {
        const pendingMsg = prev.find(m => m.id === tempId);
        if (pendingMsg) {
          setInputText(pendingMsg.message);
          return prev.filter(m => m.id !== tempId);
        }
        return prev;
      });
    }
  };

  // Load older messages (pagination) on pulling down
  const handleRefreshOlder = () => {
    if (isRefreshing || messages.length >= totalMessages) return;

    setIsRefreshing(true);
    const nextPage = page + 1;
    console.log(`🔄 UserClosetChat: Fetching older messages, page ${nextPage}`);
    getClosetChatMessages(currentUserId, threadId, nextPage, limit);
    loadMessagesViaApi(nextPage);
    setPage(nextPage);
  };

  const renderMessageItem = ({ item, index }) => {
    const isMe = String(item.senderId || item.sender?.id || '') === String(currentUserId);
    const isSys = isSystemMessage(item);

    if (isSys) {
      return (
        <View style={styles.systemMsgContainer}>
          <View style={styles.systemMsgBubble}>
            <Text style={styles.systemMsgText}>{item.message || item.content}</Text>
          </View>
        </View>
      );
    }

    const timestamp = item.createdAt || item.timestamp;
    const timeString = timestamp
      ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    // Check if we should render time header (e.g. if first message, or 10 minutes after previous message)
    let showTimeHeader = false;
    if (index === 0) {
      showTimeHeader = true;
    } else {
      const prevItem = messages[index - 1];
      const prevTime = new Date(prevItem.createdAt || prevItem.timestamp);
      const currTime = new Date(timestamp);
      const diffInMs = currTime - prevTime;
      if (diffInMs > 10 * 60 * 1000) {
        showTimeHeader = true;
      }
    }

    const isLastMessage = index === messages.length - 1;

    return (
      <View style={styles.messageWrapper}>
        {showTimeHeader && (
          <View style={styles.timeContainer}>
            <Text style={styles.messageTime}>
              {new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {timeString}
            </Text>
          </View>
        )}
        <View style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
          {!isMe && (
            <View style={styles.peerAvatarWrap}>
              <HexAvatar
                uri={otherUser?.avatar || otherUser?.image || ONLINE_PLACEHOLDER}
                size={32}
                borderWidth={2}
                borderColor={text}
              />
            </View>
          )}
          <View style={styles.msgContentWrap}>
            <View style={[
              styles.msgBubble,
              isMe ? styles.msgBubbleMe : styles.msgBubblePeer,
              isMe && { backgroundColor: text },
              item.isPending && styles.tempMessage
            ]}>
              <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextPeer]}>
                {item.message || item.content}
              </Text>
            </View>
            {isMe && !item.isPending && isLastMessage && (
              <View style={styles.messageStatus}>
                <SafeIcon
                  name="checkmark-done"
                  size={16}
                  color={item.isSeen || item.seen === true ? '#3b82f6' : '#9ca3af'}
                  style={styles.seenIcon}
                />
                <Text style={styles.statusText}>
                  {item.isSeen || item.seen === true ? 'Seen' : 'Sent'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const username = otherUser?.username || otherUser?.displayName || 'Chat Partner';
  const avatarUrl = otherUser?.avatar || otherUser?.image || ONLINE_PLACEHOLDER;

  const emptyComponent = (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        No closet chats yet. Chat starts after paid orders on eligible items.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      {/* Header */}
      <View style={[styles.header, bgStyle]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <SafeIcon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <HexAvatar
            uri={avatarUrl}
            size={38}
            borderWidth={1}
            borderColor="#dbdbdb"
          />
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerTitle, textStyle]}>{username}</Text>
            {orderInfo && (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                Order: #{orderInfo.orderNumber || orderInfo.id || orderInfo.orderId || 'Info'} • {orderInfo.orderStatus || 'Active'}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Messages view */}
      <View style={styles.chatArea}>
        {isLoading && page === 1 ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={text} />
          </View>
        ) : error && messages.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchInitialMessages} style={[styles.retryBtn, { backgroundColor: text }]}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefreshOlder}
                colors={[text]}
                tintColor={text}
              />
            }
            ListEmptyComponent={emptyComponent}
          />
        )}
      </View>

      {/* Input panel */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor="#9ca3af"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <LinearGradient
              colors={inputText.trim() ? [text, text] : ['#d1d5db', '#9ca3af']}
              style={styles.sendButtonGradient}
            >
              <Text style={styles.sendIcon}>➤</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#dbdbdb',
  },
  backButton: {
    padding: 6,
    marginRight: 6,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 1,
  },
  chatArea: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    marginTop: 80,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  systemMsgContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  systemMsgBubble: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: '85%',
  },
  systemMsgText: {
    color: '#4b5563',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 2,
    width: '100%',
  },
  msgRowLeft: {
    justifyContent: 'flex-start',
    paddingRight: 60,
  },
  msgRowRight: {
    justifyContent: 'flex-end',
    paddingLeft: 60,
  },
  peerAvatarWrap: {
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  msgContentWrap: {
    flexShrink: 1,
  },
  msgBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    minWidth: 50,
  },
  msgBubbleMe: {
    borderBottomRightRadius: 6,
  },
  msgBubblePeer: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderBottomLeftRadius: 6,
  },
  msgText: {
    fontSize: 15,
    lineHeight: 20,
  },
  msgTextMe: {
    color: '#ffffff',
  },
  msgTextPeer: {
    color: '#1F2937',
  },
  messageWrapper: {
    marginBottom: 12,
    width: '100%',
  },
  timeContainer: {
    alignSelf: 'center',
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginVertical: 8,
  },
  messageTime: {
    fontSize: 11,
    color: '#6B7280',
  },
  messageStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  seenIcon: {
    marginRight: 4,
  },
  tempMessage: {
    opacity: 0.7,
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 0.5,
    borderTopColor: '#E5E7EB',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginRight: 8,
    minHeight: 48,
    maxHeight: 120,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    paddingVertical: 10,
    paddingHorizontal: 8,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginBottom: 2,
  },
  sendButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    fontSize: 16,
    color: '#ffffff',
    marginLeft: 2,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
});
