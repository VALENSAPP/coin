import React, { useLayoutEffect, useState, useEffect, useCallback, useRef, Children } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  TextInput, 
  Dimensions, 
  ScrollView, 
  Alert,
  RefreshControl,
  Modal // ✅ ADD THIS
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getAllConversations } from '../../../services/chatMessage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../../theme/useApptheme';
import { getSocket } from '../../../services/socket';
import useSocket from '../../../hooks/useSocket';
import { number } from 'yup';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../../../components/displaytoastmessage';
import { getHideChatConversation } from '../../../services/post';

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
      case 'trash-outline':
        return '🗑️';
      case 'close':
        return '✕';
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const { bgStyle, textStyle, text } = useAppTheme();
  const toast = useToast();
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  
  // ✅ ADD THESE NEW STATES FOR DELETE MODAL
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Initialize socket connection
  useEffect(() => {
    const setupSocket = async () => {
      try {
        // Request chat box data when socket connects
        if (currentUserId) {
          const socket = getSocket();
          if (socket?.connected) {
            socket.emit('getUserChatBox', { userId: currentUserId });
          }
        }
      } catch (error) {
        console.error('Failed to initialize socket:', error);
      }
    };

    setupSocket();
  }, []);

  // Listen for chat box updates (conversation list)
  useSocket('userChatBox', (data) => {
    console.log('📨 Received userChatBox data:', data);
    if (data && Array.isArray(data)) {
      const processedConversations = processConversationsData(data);
      setConversations(processedConversations);
    }
  }, [currentUserId]);

  // Listen for new messages to show toast notification
  useSocket('newMessage', (message) => {
    console.log('🔔 New message received:', message);
    
    if (!message || !currentUserId) return;
    
    // Check if message is for current user (as receiver)
    const receiverId = String(message.receiver?.id || message.receiverId || '');
    const senderId = String(message.sender?.id || message.senderId || '');
    const me = String(currentUserId);
    
    // Only show notification if current user is the receiver
    if (receiverId === me && senderId !== me) {
      const senderName = message.sender?.displayName || message.sender?.username || 'Someone';
      
      // Determine message preview
      let messagePreview = '';
      if (message.type === 'MEDIA') {
        messagePreview = 'Shared a media';
      } else if (message.type === 'POST_SHARE') {
        messagePreview = 'Shared a post';
      } else if (message.type === 'REEL_SHARE') {
        messagePreview = 'Shared a reel';
      } else if (message.type === 'STORY_SHARE') {
        messagePreview = 'Shared a story';
      } else {
        messagePreview = message.content || message.message || 'New message';
      }
      
      // Show toast notification
      showToastMessage(
        toast,
        'success',
        `${senderName}: ${messagePreview}`,
        3000
      );
      
      // Refresh conversation list to update unread count
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit('getUserChatBox', { userId: currentUserId });
      }
    }
  }, [currentUserId, toast]);

  // Listen for messageSent event as well (some backends emit this)
  useSocket('messageSent', (message) => {
    console.log('📤 Message sent event received:', message);
    
    if (!message || !currentUserId) return;
    
    // Refresh conversation list to update with the new message
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('getUserChatBox', { userId: currentUserId });
    }
  }, [currentUserId]);

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

  // Request chat box when user ID is available
  useEffect(() => {
    if (currentUserId) {
      const socket = getSocket();
      if (socket?.connected) {
        console.log('Requesting chat box for user:', currentUserId);
        socket.emit('getUserChatBox', { userId: currentUserId });
      }
    }
  }, [currentUserId]);

  // Track screen focus state
  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      
      if (currentUserId) {
        const socket = getSocket();
        if (socket?.connected) {
          socket.emit('getUserChatBox', { userId: currentUserId });
        }
        // Also fetch via API as fallback
        fetchConversations();
      }
      
      return () => {
        setIsScreenFocused(false);
      };
    }, [currentUserId])
  );

  const fetchConversations = async () => {
    if (!currentUserId) return;

    try {
      setIsLoading(true);

      const response = await getAllConversations();
      console.log(response, 'totalMessages hererereree');

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

  const onRefresh = useCallback(async () => {
    if (!currentUserId) return;

    setRefreshing(true);
    
    try {
      // Request fresh data from socket
      const socket = getSocket();
      if (socket?.connected) {
        console.log('🔄 Pull-to-refresh: Requesting chat box');
        socket.emit('getUserChatBox', { userId: currentUserId });
      }
      
      // Also fetch via API
      const response = await getAllConversations();
      console.log('🔄 Pull-to-refresh: API response', response);

      if (response.success && response.data) {
        const processedConversations = processConversationsData(response.data);
        setConversations(processedConversations);
        setError(null);
        
        // Show success feedback
        showToastMessage(
          toast,
          'success',
          'Messages refreshed',
          2000
        );
      } else {
        setError(response.message || 'Failed to refresh conversations');
      }
    } catch (error) {
      console.error('Error refreshing conversations:', error);
      showToastMessage(
        toast,
        'error',
        'Failed to refresh messages',
        2000
      );
    } finally {
      setRefreshing(false);
    }
  }, [currentUserId, toast]);

  const processConversationsData = (conversationsData) => {
    console.log(conversationsData, 'covesation datatatatatat>>>.');
    if (!Array.isArray(conversationsData)) {
      console.warn('Invalid conversations data format:', conversationsData);
      return [];
    }

    const conversationMap = new Map();
    console.log('Current user ID:', currentUserId);

    conversationsData.forEach(message => {
      console.log(message, 'message data came herrererere');
      // NEW: Handles your API structure
     const conversationId = message.id; 
      // ✅ FILTER OUT HIDDEN CONVERSATIONS
      if (message.isHidden === true) {
        console.log('Skipping hidden conversation:', message.id);
        return;
      }
      
      const unreadCount = message?.unreadCount;
      const isCurrentUserSender = message.sender?.id === currentUserId;
      const chatPartner = isCurrentUserSender ? message.receiver : message.sender;

      if (!chatPartner?.id) return;

      const partnerId = chatPartner.id;
      const messageTime = new Date(message.createdAt);

      // Last message preview logic
      let previewMessage = "";

      if (message.type === "MEDIA") {
        previewMessage = isCurrentUserSender
          ? "You shared a Media"
          : "Shared a Media";
      } else if (message.type === "CHAT") {
        if (message.post) {
          previewMessage = isCurrentUserSender
            ? "You shared a post"
            : "Shared a post";
        } else {
          const content = message.content || "";
          previewMessage = isCurrentUserSender
            ? `You: ${content}`
            : content;
        }
      }
      console.log(message, 'new messsgae');

      console.log(`Partner ${partnerId} unread count:`, unreadCount);
      if (
        !conversationMap.has(partnerId) ||
        messageTime > new Date(conversationMap.get(partnerId).lastMessageTime)
      ) {
        conversationMap.set(partnerId, {
          id: partnerId,
          userId: partnerId,
          chatId: message.chatId, // ✅ ADD CHAT ID FOR DELETION
          username: chatPartner.displayName || "Unknown User",
          displayName: chatPartner.displayName,
          avatar: chatPartner.image || ONLINE_PLACEHOLDER,
          lastMessage: previewMessage,
          lastMessageTime: message.createdAt,
          timestamp: formatTimestamp(message.createdAt),
          unreadCount: unreadCount,
          isOnline: chatPartner.isOnline || false,
          sentByMe: isCurrentUserSender,
          type: message.type,
          post: message.post,
          user: {
            id: partnerId,
            displayName: chatPartner.displayName,
            username: chatPartner.username,
            image: chatPartner.image,
          }
        });
      }
    });

    const result = Array.from(conversationMap.values()).sort(
      (a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
    );

    console.log("Processed conversations here im getting unred message :", result);
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
    } else if (diffInMinutes < 1440) {
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

    navigation.navigate('UserChat', {
      userId: item.userId,
      user: item.user
    });
  };

  // ✅ ADD LONG PRESS HANDLER
  const handleLongPress = (item) => {
    setSelectedConversation(item);
    setShowDeleteModal(true);
  };

  // ✅ ADD DELETE CONVERSATION HANDLER
  const handleDeleteConversation = async () => {
    setShowDeleteModal(false);
    // console.log(selectedConversation,'cehckSelect conversation')
    // if (!selectedConversation || !selectedConversation.chatId) {
    //   showToastMessage(toast, 'error', 'Unable to delete conversation', 2000);
    //   setShowDeleteModal(false);
    //   return;
    // }

    // setIsDeleting(true);

    // try {
    //   console.log('Deleting conversation with chatId:', selectedConversation.chatId);
    //   const response = await getHideChatConversation(selectedConversation.chatId);
      
    //   console.log('Hide conversation response:', response);

    //   if (response.success) {
    //     // Remove from local state immediately
    //     setConversations(prev => 
    //       prev.filter(conv => conv.chatId !== selectedConversation.chatId)
    //     );

    //     showToastMessage(
    //       toast,
    //       'success',
    //       'Conversation deleted successfully',
    //       2000
    //     );

    //     // Refresh from server to sync
    //     const socket = getSocket();
    //     if (socket?.connected) {
    //       socket.emit('getUserChatBox', { userId: currentUserId });
    //     }
    //   } else {
    //     showToastMessage(
    //       toast,
    //       'error',
    //       response.message || 'Failed to delete conversation',
    //       2000
    //     );
    //   }
    // } catch (error) {
    //   console.error('Error deleting conversation:', error);
    //   showToastMessage(
    //     toast,
    //     'error',
    //     'Failed to delete conversation',
    //     2000
    //   );
    // } finally {
    //   setIsDeleting(false);
    //   setShowDeleteModal(false);
    //   setSelectedConversation(null);
    // }
  };

  // ✅ ADD CANCEL HANDLER
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setSelectedConversation(null);
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

  const renderChatItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.chatItem, bgStyle, { shadowColor: text }]} 
      onPress={() => handleUserChat(item)}
      onLongPress={() => handleLongPress(item)}
      delayLongPress={500}
    >
      <View style={styles.avatarContainer}>
        <View style={styles.storyNoRing}>
          <SafeImage source={{ uri: item.avatar || ONLINE_PLACEHOLDER }} style={styles.chatAvatar} />
          {item.isOnline && <View style={styles.onlineDot} />}
        </View>
      </View>
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={[styles.username, item.unreadCount > 0 && styles.unreadMessage, textStyle]}>{item.username}</Text>
          <Text style={styles.timestamp}>{item.timestamp}</Text>
        </View>
        <View style={styles.messageRow}>
          {item.lastMessage ? (
            <Text
              style={[styles.lastMessage, item.unreadCount > 0 && styles.unreadLastMessage]}
              numberOfLines={1}
            >
              {item.lastMessage}
            </Text>
          ) : (
            <Text style={[styles.lastMessage, item.unreadCount > 0 && styles.unreadLastMessage]} numberOfLines={1}>
              Start a conversation
            </Text>
          )}

          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const filteredConversations = conversations.filter(c =>
    c.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      {/* Header */}
      <View style={[styles.header, bgStyle, { shadowColor: text }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <SafeIcon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]}>{USERNAME}</Text>
        <View style={{ flex: 1 }} />
      </View>

      {/* Search Bar */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => inputRef.current?.focus()}
        style={[styles.searchContainer, { shadowColor: text }]}
      >
        <View style={styles.searchWrapper}>
          <SafeIcon name="search" size={20} color={text} style={[styles.searchIcon, textStyle]} />
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
        <Text style={[styles.messagesTitle, textStyle]}>Messages</Text>
        <TouchableOpacity>
          {/* <Text style={styles.requestsLink}>Requests</Text> */}
        </TouchableOpacity>
      </View>

      {/* Chat List with RefreshControl */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[text]} // Android
            tintColor={text} // iOS
            title="Pull to refresh" // iOS
            titleColor={text} // iOS
          />
        }
      >
        {isLoading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, textStyle]}>Loading conversations...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={[styles.retryButton, { backgroundColor: text }]} onPress={fetchConversations}>
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

      {/* ✅ ADD DELETE CONFIRMATION MODAL */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelDelete}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, bgStyle]}>
            <View style={styles.modalHeader}>
              <SafeIcon name="trash-outline" size={32} color="#ff6b6b" />
              <Text style={[styles.modalTitle, textStyle]}>Delete Conversation</Text>
            </View>
            
            <Text style={[styles.modalMessage, textStyle]}>
              Are you sure you want to delete this conversation with{' '}
              <Text style={styles.modalUsername}>{selectedConversation?.username}</Text>?
            </Text>
            
            <Text style={styles.modalWarning}>
              This action cannot be undone.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCancelDelete}
                disabled={isDeleting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={handleDeleteConversation}
                disabled={isDeleting}
              >
                <Text style={styles.deleteButtonText}>
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#dbdbdb',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    height: 42,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    fontSize: 15,
    color: '#000',
  },
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
  },
  chatItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
    borderRadius: 12,
    marginHorizontal: 12,
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
    color: '#000',
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
  unreadLastMessage: {
    color: '#111',
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: '#5a2d82',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  separator: {
    height: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    fontSize: 16,
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
  // ✅ ADD MODAL STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 22,
  },
  modalUsername: {
    fontWeight: '700',
    color: '#5a2d82',
  },
  modalWarning: {
    fontSize: 14,
    color: '#ff6b6b',
    textAlign: 'center',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#e5e7eb',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  deleteButton: {
    backgroundColor: '#ff6b6b',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});