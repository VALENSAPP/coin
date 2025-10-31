import React, { useLayoutEffect, useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput, Dimensions, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getAllConversations } from '../../../services/chatMessage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';


// Fallback icon component
const FallbackIcon = ({ name, size = 24, color = '#000', style }) => {
  const getIconText = (iconName) => {
    switch (iconName) {
      case 'arrow-back':
        return '←';
      case 'chevron-down':
        return '▼';
      case 'create-outline':
        return '✏️';
      case 'search':
        return '🔍';
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

const USERNAME = 'Messages';
const ONLINE_PLACEHOLDER = 'https://ui-avatars.com/api/?name=User&background=e0e0e0&color=888&size=128';
const AVATAR_SIZE = 50;
const AVATAR_BORDER = 68;
const NOTE_CARD_HEIGHT = 32;

export default function ChatMessages() {
  const navigation = useNavigation();
  const [search, setSearch] = useState('');
  const [conversations, setConversations] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
   const inputRef = useRef(null);

  // Get current user ID on mount
  useEffect(() => {
    const getCurrentUserId = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (userId) {
          setCurrentUserId(userId);
        } else {
          Alert.alert('Error', 'Please log in to view messages');
        }
      } catch (error) {
        console.error('Error getting user ID:', error);
        Alert.alert('Error', 'Failed to load user information');
      }
    };

    getCurrentUserId();
  }, []);

  // Fetch conversations when component mounts or when focused
  useFocusEffect(
    useCallback(() => {
      if (currentUserId) {
        fetchConversations();
      }
    }, [currentUserId])
  );

  const fetchConversations = async () => {
    if (!currentUserId) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await getAllConversations();
      console.log(response, 'totalMessages')

      if (response.success && response.data) {
        // Process conversations to get unique chat partners
        const processedConversations = processConversationsData(response.data);
        setConversations(processedConversations);
      } else {
        setError(response.message || 'Failed to load conversations');
        setConversations([]);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setError('Failed to load conversations');
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const processConversationsData = (conversationsData) => {
    // Group conversations by chat partner
    const conversationMap = new Map();

    console.log('Processing conversations data:', conversationsData);
    console.log('Current user ID:', currentUserId);

    conversationsData.forEach(message => {
      // Determine the other user (chat partner)
      const isCurrentUserSender = message.sender?.id === currentUserId;
      const chatPartner = isCurrentUserSender ? message.receiver : message.sender;

      if (!chatPartner?.id) return; // Skip if no valid chat partner

      const partnerId = chatPartner.id;
      const messageTime = new Date(message.createdAt);

      if (!conversationMap.has(partnerId) ||
        messageTime > new Date(conversationMap.get(partnerId).lastMessageTime)) {

        conversationMap.set(partnerId, {
          id: partnerId,
          userId: partnerId, // For navigation
          username: chatPartner.displayName || chatPartner.username || 'Unknown User',
          displayName: chatPartner.displayName,
          avatar: chatPartner.image || ONLINE_PLACEHOLDER,
          lastMessage: isCurrentUserSender ? `You: ${message.content}` : message.content,
          lastMessageTime: message.createdAt,
          timestamp: formatTimestamp(message.createdAt),
          unreadCount: 0, // You can implement unread logic based on your needs
          isOnline: false, // You can implement online status if available
          sentByMe: isCurrentUserSender,
          user: {
            id: partnerId,
            displayName: chatPartner.displayName,
            username: chatPartner.username,
            image: chatPartner.image,
          }
        });
      }
    });

    const result = Array.from(conversationMap.values())
      .sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

    console.log('Processed conversations:', result);
    return result;
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const messageDate = new Date(timestamp);
    const diffInMinutes = Math.floor((now - messageDate) / (1000 * 60));

    if (diffInMinutes < 1) {
      return 'Now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m`;
    } else if (diffInMinutes < 1440) { // Less than 24 hours
      return `${Math.floor(diffInMinutes / 60)}h`;
    } else {
      const diffInDays = Math.floor(diffInMinutes / 1440);
      if (diffInDays === 1) {
        return '1d';
      } else if (diffInDays < 7) {
        return `${diffInDays}d`;
      } else {
        return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    }
  };

  const handleUserChat = (item) => {
    if (!item.userId || !item.user) {
      Alert.alert('Error', 'Unable to open chat');
      return;
    }

    // Navigate to UserChat with proper parameters
    navigation.navigate('UserChat', {
      userId: item.userId,
      user: item.user
    });
  };

  // Safe image loading with error handling
  const SafeImage = ({ source, style, ...props }) => {
    const [imageError, setImageError] = useState(false);

    if (imageError || !source?.uri) {
      return (
        <View style={[style, { backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: '#888', fontSize: 12 }}>👤</Text>
        </View>
      );
    }

    return (
      <Image
        source={source}
        style={style}
        onError={() => setImageError(true)}
        {...props}
      />
    );
  };

  const renderStoryItem = ({ item }) => (
    <View style={styles.storyItem}>
      {item.note ? (
        <View style={styles.noteCardWrap}>
          <View style={styles.noteCard}>
            <Text style={styles.noteCardText} numberOfLines={1} ellipsizeMode="tail">{item.note}</Text>
          </View>
          <View style={styles.noteTail} />
        </View>
      ) : <View style={{ height: NOTE_CARD_HEIGHT + 6 }} />}
      <View style={[styles.avatarBorder, item.isUser && styles.userBorder]}>
        <SafeImage source={{ uri: item.avatar || ONLINE_PLACEHOLDER }} style={styles.avatar} />
      </View>
      <Text style={styles.storyUsername} numberOfLines={1}>{item.username}</Text>
    </View>
  );

  const renderChatItem = ({ item }) => (
    <TouchableOpacity style={styles.chatItem} onPress={() => handleUserChat(item)}>
      <View style={styles.avatarContainer}>
        <View style={styles.storyNoRing}>
          <SafeImage source={{ uri: item.avatar || ONLINE_PLACEHOLDER }} style={styles.chatAvatar} />
          {item.isOnline && <View style={styles.onlineDot} />}
        </View>
      </View>
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={[styles.username, item.unreadCount > 0 && styles.unreadMessage]}>{item.username}</Text>
          <Text style={styles.timestamp}>{item.timestamp}</Text>
        </View>
        <View style={styles.messageRow}>
          {item.lastMessage ? (
            <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage}</Text>
          ) : (
            <Text style={styles.lastMessage} numberOfLines={1}>Start a conversation</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const filteredConversations = conversations.filter(c =>
    c.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <SafeIcon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{USERNAME}</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity>
          <SafeIcon name="create-outline" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => inputRef.current?.focus()}
        style={styles.searchContainer}
      >
        <View style={styles.searchWrapper}>
          <SafeIcon name="search" size={20} color="#5a2d82" style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search messages..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#9ca3af"
          />
        </View>
      </TouchableOpacity>

      {/* Messages/Requests Row */}
      <View style={styles.messagesRow}>
        <Text style={styles.messagesTitle}>Messages</Text>
        <TouchableOpacity>
          {/* <Text style={styles.requestsLink}>Requests</Text> */}
        </TouchableOpacity>
      </View>

      {/* Chat List */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading conversations...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchConversations}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredConversations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {search ? 'No conversations found' : 'No conversations yet'}
            </Text>
            {!search && (
              <Text style={styles.emptySubtext}>Start a conversation with someone</Text>
            )}
          </View>
        ) : (
          filteredConversations.map(item => (
            <View key={item.id}>
              {renderChatItem({ item })}
              <View style={styles.separator} />
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f2fd',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#dbdbdb',
    backgroundColor: '#f8f2fd',
    shadowColor: '#5a2d82',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#5a2d82',
    textAlign: 'center',
    flex: 1,
  },

  // Search bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    height: 42,
    shadowColor: '#5a2d82',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchWrapper: {
    flexDirection: 'row',
  },
  searchIcon: {
    marginRight: 8,
    // marginTop: 10,
    color: '#5a2d82',
  },
  searchInput: {
    fontSize: 15,
    color: '#000',
  },

  // Stories/Notes row
  storiesBar: {
    height: AVATAR_BORDER + NOTE_CARD_HEIGHT + 28,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#dbdbdb',
    backgroundColor: '#f8f2fd',
  },
  storyItem: {
    width: 76,
    alignItems: 'center',
    marginRight: 12,
  },
  storyUsername: {
    fontSize: 12,
    color: '#333',
    maxWidth: 60,
    textAlign: 'center',
    marginTop: 4,
  },
  avatarBorder: {
    borderWidth: 2,
    borderColor: '#5a2d82',
    borderRadius: AVATAR_BORDER / 2,
    padding: 2,
    marginBottom: 4,
    backgroundColor: '#fff',
  },
  userBorder: { borderColor: '#999' },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#eee',
  },
  noteCardWrap: {
    position: 'relative',
    marginBottom: 6,
  },
  noteCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 70,
    minHeight: NOTE_CARD_HEIGHT,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  noteCardText: {
    fontSize: 10,
    color: '#333',
    textAlign: 'center',
  },
  noteTail: {
    position: 'absolute',
    bottom: -3,
    left: '50%',
    marginLeft: -3,
    width: 0,
    height: 0,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 3,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#fff',
  },

  // Messages/Requests row
  messagesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  messagesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5a2d82',
  },
  requestsLink: {
    fontSize: 15,
    color: '#5a2d82',
    fontWeight: '700',
  },

  // Chat item
  chatItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#f8f2fd',
    marginBottom: 8,
    borderRadius: 12,
    marginHorizontal: 12,
    shadowColor: '#5a2d82',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  avatarContainer: {
    marginRight: 12,
  },
  storyNoRing: {
    position: 'relative',
  },
  chatAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eee',
    borderWidth: 2,
    borderColor: '#f3f0f7',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#32cd59',
    borderWidth: 2,
    borderColor: '#fff',
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
    flex: 1,
  },
  unreadMessage: {
    fontWeight: '700',
    color: '#5a2d82',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  separator: {
    height: 10,
  },

  // Loading, Error, and Empty states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    fontSize: 16,
    color: '#5a2d82',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ff6b6b',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#5a2d82',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});