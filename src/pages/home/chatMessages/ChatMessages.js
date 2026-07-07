import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ScrollView,
  Alert,
  RefreshControl,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { getAllConversations, sendMessage as sendMessageAPI } from '../../../services/chatMessage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../../theme/useApptheme';
import { getSocket, initializeSocket } from '../../../services/socket';
import useSocket from '../../../hooks/useSocket';
import { number } from 'yup';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../../../components/displaytoastmessage';
import { getHideChatConversation, chatStatusUpdate, sharePost } from '../../../services/post';
import HexAvatar from '../../../components/home/story.js/HexAvatar';
import { useLanguage } from '../../../i18n';
import { appendTrustPostShareFields } from '../../../utils/trustPost';

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

const ONLINE_PLACEHOLDER = 'https://ui-avatars.com/api/?name=User&background=e0e0e0&color=888&size=128';
const AVATAR_SIZE = 50;
const AVATAR_BORDER = 68;
const NOTE_CARD_HEIGHT = 32;

// Tab keys for the top switcher
const CHAT_TABS = {
  MESSAGES: 'messages',
  CLOSET: 'closet',
};

export default function ChatMessages() {
  const navigation = useNavigation();
  const route = useRoute();
  const [search, setSearch] = useState('');
  const [conversations, setConversations] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [socketReady, setSocketReady] = useState(false);
  const inputRef = useRef(null);
  const { bgStyle, textStyle, text } = useAppTheme();
  const toast = useToast();
  const { t } = useLanguage();
  const [isScreenFocused, setIsScreenFocused] = useState(true);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [dataSource, setDataSource] = useState('none');

  // ✅ Active tab: 'messages' | 'closet'
  const [activeTab, setActiveTab] = useState(CHAT_TABS.MESSAGES);

  const hasProcessedShareRef = useRef(false);
  // Locally hidden chats (survives socket refresh until server marks isHidden)
  const hiddenChatIdsRef = useRef(new Set());

  const handleBackPress = useCallback(() => {
    const { returnTo, returnParams, returnToTab } = route?.params || {};

    if (returnTo) {
      const parentNavigation = navigation.getParent?.();

      if (returnToTab && returnToTab !== 'HomeMain' && parentNavigation?.navigate) {
        parentNavigation.navigate(returnToTab, {
          screen: returnTo,
          params: returnParams || {},
        });
        return;
      }

      if (returnTo === 'FlipsScreen' && parentNavigation?.navigate) {
        parentNavigation.navigate('ProfileMain', {
          screen: 'FlipsScreen',
          params: returnParams || {},
        });
        return;
      }

      navigation.navigate(returnTo, returnParams || {});
      return;
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.getParent?.()?.navigate?.('HomeMain');
  }, [navigation, route?.params]);

  // ✅ Get current user ID and initialize socket on mount
  useEffect(() => {
    const initializeUserAndSocket = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (userId) {
          setCurrentUserId(userId);
          console.log('📱 ChatMessages: Current user ID set:', userId);
          
          const socket = getSocket();
          if (!socket || !socket.connected) {
            console.log('🔌 ChatMessages: Initializing socket...');
            await initializeSocket(userId);
            setSocketReady(true);
          } else {
            console.log('🔌 ChatMessages: Socket already connected');
            setSocketReady(true);
          }
        } else {
          Alert.alert(t('chatMessages.errorTitle'), t('chatMessages.loginRequired'));
        }
      } catch (error) {
        console.error('❌ Error initializing user and socket:', error);
        Alert.alert(t('chatMessages.errorTitle'), t('chatMessages.failedToLoadUser'));
      }
    };

    initializeUserAndSocket();
  }, []);

  // ✅ Handle socket reconnection
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleConnect = () => {
      console.log('🔌 ChatMessages: Socket connected');
      setSocketReady(true);
      
      if (currentUserId) {
        console.log('📡 ChatMessages: Requesting chat box on connect');
        socket.emit('getUserChatBox', { userId: currentUserId });
      }
    };

    const handleDisconnect = () => {
      console.log('🔌 ChatMessages: Socket disconnected');
      setSocketReady(false);
    };

    const handleReconnect = () => {
      console.log('🔌 ChatMessages: Socket reconnected');
      setSocketReady(true);
      
      if (currentUserId) {
        console.log('📡 ChatMessages: Requesting chat box on reconnect');
        socket.emit('getUserChatBox', { userId: currentUserId });
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnect', handleReconnect);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect', handleReconnect);
    };
  }, [currentUserId]);

  // ✅ Request chat box when user ID is available and socket is ready
  useEffect(() => {
    if (currentUserId && socketReady) {
      const socket = getSocket();
      if (socket?.connected) {
        console.log('📡 ChatMessages: Requesting initial chat box');
        socket.emit('getUserChatBox', { userId: currentUserId });
      }
    }
  }, [currentUserId, socketReady]);

  // ✅ Handle shared content from ShareModal
  useEffect(() => {
    const handleSharedContent = async () => {
      const { selectedUserIds, sharedContent, fromShareModal } = route?.params || {};
      
      if (!fromShareModal || !sharedContent || !selectedUserIds || selectedUserIds.length === 0) {
        return;
      }

      if (hasProcessedShareRef.current) {
        console.log('🚫 Shared content already processed, skipping');
        return;
      }
      
      if (!currentUserId) {
        console.log('⏳ Waiting for currentUserId to be set...');
        return;
      }

      hasProcessedShareRef.current = true;

      console.log('📤 ChatMessages: Received shared content:', {
        sharedContent,
        selectedUserIds,
        userCount: selectedUserIds.length,
        currentUserId: currentUserId
      });

      try {
        console.log('📬 Sending shared content to', selectedUserIds.length, 'user(s)');
        
        showToastMessage(
          toast,
          'success',
          t('chatMessages.sharingWith', { count: selectedUserIds.length }),
          2000
        );

        let successCount = 0;
        let failCount = 0;

        console.log('📋 Starting Step 1: sharePost API call (ONCE with all users)');
        try {
          let mediaType, mediaId;
          if (sharedContent.post) {
            mediaType = 'POST';
            mediaId = sharedContent.postId;
          } else if (sharedContent.reel) {
            mediaType = 'REEL';
            mediaId = sharedContent.reelId;
          } else if (sharedContent.story) {
            mediaType = 'STORY';
            mediaId = sharedContent.storyId;
            if (mediaId) {
              mediaId = String(mediaId).replace(/_\d+$/, '');
            }
          }

          console.log('📋 Media details:', { mediaType, mediaId });

          if (mediaType && mediaId) {
            const sharePayload = {
              mediaId: mediaId,
              mediaType: mediaType,
              conversationType: 'MEDIA',
              sharedUserId: currentUserId,
              receiverUserId: selectedUserIds
            };
            console.log('📡 Calling sharePost API ONCE with', selectedUserIds.length, 'users:', sharePayload);
            const shareResponse = await sharePost(sharePayload);
            console.log('✅ SharePost API response: Success');
          }
        } catch (shareError) {
          console.error('❌ SharePost API error:', shareError.message);
        }

        console.log('📋 Starting Step 2: Send messages to', selectedUserIds.length, 'users');
        for (let i = 0; i < selectedUserIds.length; i++) {
          const userId = selectedUserIds[i];
          
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          
          try {
            console.log(`📤 Sending message to user ${userId} (${i + 1}/${selectedUserIds.length})...`);

            const messageType = sharedContent.post ? 'POST_SHARE'
              : sharedContent.reel ? 'REEL_SHARE'
                : sharedContent.story ? 'STORY_SHARE'
                  : 'MEDIA';

            const messageData = {
              senderId: String(currentUserId),
              receiverId: String(userId),
              type: messageType,
            };

            if (sharedContent.postId) messageData.postId = sharedContent.postId;
            if (sharedContent.reelId) messageData.reelId = sharedContent.reelId;
            if (sharedContent.storyId) {
              let storyId = String(sharedContent.storyId).replace(/_\d+$/, '');
              messageData.storyId = storyId;
            }

            if (sharedContent.post) {
              Object.assign(
                messageData,
                appendTrustPostShareFields(messageData, sharedContent.post),
              );
            }

            console.log('📤 Sending message data to user', userId, ':', messageData);

            const socket = getSocket();
            if (socket?.connected) {
              socket.emit('sendMessage', messageData);
              console.log('📡 Socket sent for', userId);
            }

            try {
              const response = await sendMessageAPI(messageData);
              if (response?.success) {
                console.log(`✅ API success for ${userId}`);
                successCount++;
              } else {
                console.warn(`⚠️ API failed for ${userId}:`, response?.message);
              }
            } catch (apiErr) {
              console.error(`❌ API error for ${userId}:`, apiErr.message);
            }
          } catch (err) {
            console.error(`❌ Failed to send to user ${userId}:`, err.message);
            failCount++;
          }
        }

        console.log('✅ Completed sending to all users:', { successCount, failCount });

        const socket = getSocket();
        if (socket?.connected) {
          console.log('📡 Refreshing chat box after multi-share');
          socket.emit('getUserChatBox', { userId: currentUserId });
        }

        if (successCount > 0) {
          showToastMessage(
            toast,
            'success',
            t('chatMessages.sharedToCount', { count: successCount }),
            2000
          );
        }
        
        if (failCount > 0) {
          showToastMessage(
            toast,
            'error',
            t('chatMessages.shareFailedCount', { count: failCount }),
            2000
          );
        }

        setTimeout(() => {
          navigation.setParams({
            selectedUserIds: undefined,
            sharedContent: undefined,
            fromShareModal: undefined,
          });
        }, 500);

      } catch (error) {
        console.error('❌ Error processing shared content:', error);
        Alert.alert(t('chatMessages.errorTitle'), t('chatMessages.shareError'));
        hasProcessedShareRef.current = false;
      }
    };

    handleSharedContent();
  }, [route?.params, conversations, navigation, currentUserId, toast, t]);

  // ✅ Reset shared content processing flag when shared content is cleared
  useEffect(() => {
    const { fromShareModal } = route?.params || {};
    if (!fromShareModal) {
      hasProcessedShareRef.current = false;
    }
  }, [route?.params]);

  // ✅ Listen for chat box updates (conversation list)
  useSocket('userChatBox', (data) => {
    console.log('📨 ChatMessages: Received userChatBox data');
    
    if (!data) {
      console.log('⚠️ ChatMessages: No data received');
      return;
    }

    let conversationsData = [];
    
    if (Array.isArray(data)) {
      conversationsData = data;
    } else if (data.success && Array.isArray(data.data)) {
      conversationsData = data.data;
    }

    console.log(`📊 ChatMessages: Processing ${conversationsData.length} conversations`);
    
    const processedConversations = processConversationsData(conversationsData);
    console.log(`✅ ChatMessages: Processed ${processedConversations.length} conversations`);
    
    setConversations(processedConversations);
    setDataSource('socket');
    setIsLoading(false);
    setError(null);
  }, [currentUserId]);

  useSocket('messageSeen', (payload) => {
    if (!payload?.messageId) return;

    setConversations(prev =>
      prev.map(conversation =>
        String(conversation.lastMessageId) === String(payload.messageId)
          ? { ...conversation, lastMessageIsSeen: true }
          : conversation,
      ),
    );
  }, []);

  // ✅ Listen for new messages to update conversation list in real-time
  useSocket('newMessage', (message) => {
    console.log('🔔 ChatMessages: New message received');

    if (!message || !currentUserId) {
      console.log('⚠️ ChatMessages: Missing message or currentUserId');
      return;
    }

    const receiverId = String(message.receiver?.id || message.receiverId || '');
    const senderId = String(message.sender?.id || message.senderId || '');
    const me = String(currentUserId);

    if (receiverId === me && senderId !== me && !isScreenFocused) {
      const senderName = message.sender?.displayName || message.sender?.username || t('chatMessages.someone');

      let messagePreview = '';
      if (message.type === 'MEDIA') {
        messagePreview = t('chatMessages.sharedMedia');
      } else if (message.type === 'POST_SHARE') {
        messagePreview = t('chatMessages.sharedPost');
      } else if (message.type === 'REEL_SHARE') {
        messagePreview = t('chatMessages.sharedReel');
      } else if (message.type === 'STORY_SHARE') {
        messagePreview = t('chatMessages.sharedStory');
      } else {
        messagePreview = message.content || message.message || t('chatMessages.newMessage');
      }

      showToastMessage(
        toast,
        'success',
        `${senderName}: ${messagePreview}`,
        3000
      );
    }

    const socket = getSocket();
    if (socket?.connected) {
      console.log('📡 ChatMessages: Requesting fresh chat box after new message');
      socket.emit('getUserChatBox', { userId: currentUserId });
    }
  }, [currentUserId, toast, isScreenFocused, t]);

  // ✅ Listen for messageSent event to update conversation list
  useSocket('messageSent', (message) => {
    console.log('📤 ChatMessages: Message sent event received');

    if (!message || !currentUserId) return;

    const senderId = String(message.sender?.id || message.senderId || '');
    const me = String(currentUserId);

    if (senderId === me) {
      console.log('📤 ChatMessages: Current user sent message, refreshing');
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit('getUserChatBox', { userId: currentUserId });
      }
    }
  }, [currentUserId]);

  // ✅ Periodic refresh to catch any missed messages
  useEffect(() => {
    if (!currentUserId || !socketReady) {
      console.log('⏸️ ChatMessages: Skipping periodic refresh - not ready');
      return;
    }

    console.log('⏰ ChatMessages: Setting up periodic refresh');
    
    const interval = setInterval(() => {
      const socket = getSocket();
      if (socket?.connected && isScreenFocused) {
        console.log('🔄 ChatMessages: Periodic refresh - requesting chat box');
        socket.emit('getUserChatBox', { userId: currentUserId });
      }
    }, 10000);

    return () => {
      console.log('⏰ ChatMessages: Clearing periodic refresh');
      clearInterval(interval);
    };
  }, [currentUserId, socketReady, isScreenFocused]);

  // ✅ Track screen focus state and request fresh data when focused
  useFocusEffect(
    useCallback(() => {
      console.log('👁️ ChatMessages: Screen focused');
      setIsScreenFocused(true);

      // Refresh conversations when screen becomes active
      fetchConversations();

      if (currentUserId && socketReady) {
        const socket = getSocket();
        if (socket?.connected) {
          console.log('📡 ChatMessages: Requesting chat box on focus');
          socket.emit('getUserChatBox', { userId: currentUserId });
        }
      }

      return () => {
        console.log('👁️ ChatMessages: Screen unfocused');
        setIsScreenFocused(false);
      };
    }, [currentUserId, socketReady])
  );

  // ✅ Fetch conversations via API (only as fallback if socket data not received)
  const fetchConversations = async () => {
    if (!currentUserId) return;

    if (dataSource === 'socket') {
      console.log('✅ Already have socket data, skipping API call');
      return;
    }

    try {
      // Avoid flashing loader when list is already visible.
      if (conversations.length === 0) setIsLoading(true);

      const response = await getAllConversations();
      console.log('📥 API Response (fallback):', response);

      if (response.success && response.data) {
        const processedConversations = processConversationsData(response.data);
        console.log('⚠️ Using API data as fallback - count:', processedConversations.length);
        setConversations(processedConversations);
        setDataSource('api');
        setError(null);
      } else {
        setError(response.message || t('chatMessages.failedToLoad'));
      }
    } catch (error) {
      console.error('❌ Error fetching conversations:', error);
      setError(t('chatMessages.failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    if (!currentUserId || !socketReady) return;
    
    setRefreshing(true);
    
    const socket = getSocket();
    if (socket?.connected) {
      console.log('🔄 ChatMessages: Manual refresh - requesting chat box');
      socket.emit('getUserChatBox', { userId: currentUserId });
    }
    
    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  }, [currentUserId, socketReady]);

  const processConversationsData = (conversationsData) => {
    console.log('🔍 Processing conversations data - count:', conversationsData);

    if (!Array.isArray(conversationsData)) {
      console.warn('❌ Invalid conversations data format:', conversationsData);
      return [];
    }

    if (conversationsData.length === 0) {
      console.log('📭 No conversations in data');
      return [];
    }

    const conversationMap = new Map();
    console.log('👤 Current user ID:', currentUserId);

    conversationsData.forEach((item, index) => {
      const hasLastMessage = !!item.lastMessage;
      const hasUser = !!item.user;
      const hasSender = !!item.sender;
      const hasReceiver = !!item.receiver;

      let conversation, message, chatId;

      if (hasLastMessage && hasUser) {
        const rawChatId = String(item?.id || '').trim();
        const isHidden =
          item?.isHidden === true ||
          String(item?.isHidden || '').toLowerCase() === 'true' ||
          String(item?.isHidden || '') === '1';
        if (isHidden || (rawChatId && hiddenChatIdsRef.current.has(rawChatId))) {
          console.log(`ðŸš« Skipping hidden conversation: ${rawChatId}`);
          return;
        }
        console.log(`✅ Item ${index}: NEW FORMAT (conversation)`);

        if (item.isHidden === true) {
          console.log(`🚫 Skipping hidden conversation: ${item.id}`);
          return;
        }

        conversation = item;
        message = item.lastMessage;
        chatId = item.id;

        console.log(`  - conversation.id (chatId): ${chatId}`);
        console.log(`  - isHidden: ${item.isHidden}`);
      }
      else if (hasSender && hasReceiver) {
        console.log(`✅ Item ${index}: OLD FORMAT (message)`);

        // ✅ CHECK isHidden for old format too
        if (
          item.isHidden === true ||
          String(item?.isHidden || '').toLowerCase() === 'true' ||
          String(item?.isHidden || '') === '1'
        ) {
          console.log(`🚫 Skipping hidden message: ${item.id}`);
          return;
        }

        message = item;

        const isCurrentUserSender = message.sender.id === currentUserId;
        const chatPartner = isCurrentUserSender ? message.receiver : message.sender;
        const partnerId = chatPartner.id;

        // Prefer a stable server-provided conversation id when present.
        const serverChatId = String(
          item?.chatId ||
            item?.conversationId ||
            item?.threadId ||
            item?.roomId ||
            item?.id ||
            '',
        ).trim();

        const generatedChatId = [currentUserId, partnerId].sort().join('_');
        chatId = serverChatId || generatedChatId;
        console.log(
          `  - chatId: ${chatId} (server: ${serverChatId || 'n/a'}, generated: ${generatedChatId})`,
        );

        if (chatId && hiddenChatIdsRef.current.has(String(chatId).trim())) {
          console.log(`ðŸš« Skipping locally hidden conversation: ${chatId}`);
          return;
        }

        // Create conversation-like structure
        conversation = {
          id: chatId,
          user: chatPartner,
          unreadCount: 0,
          isHidden: item.isHidden || false
        };
      } else {
        console.warn('⚠️ Unknown format, skipping item:', item);
        return;
      }

      if (!message) {
        console.log('⚠️ No message found');
        return;
      }

      if (chatId && hiddenChatIdsRef.current.has(String(chatId))) {
        console.log(`🚫 Skipping locally hidden conversation: ${chatId}`);
        return;
      }

      const unreadCount = conversation?.unreadCount || 0;
      const isCurrentUserSender = (message.senderId || message.sender?.id) === currentUserId;
      const chatPartner = conversation.user || (isCurrentUserSender ? message.receiver : message.sender);

      if (!chatPartner?.id) {
        console.log('⚠️ No chat partner found');
        return;
      }

      const partnerId = chatPartner.id;
      const messageTime = new Date(message.createdAt);

      let previewMessage = "";

      if (message.type === "MEDIA") {
        previewMessage = isCurrentUserSender
          ? t('chatMessages.youSharedMedia')
          : t('chatMessages.sharedMedia');
      } else if (message.type === "CHAT") {
        const content = message.content || "";
        previewMessage = isCurrentUserSender
          ? `${t('chatMessages.you')}: ${content}`
          : content;
      } else if (message.type === "POST_SHARE") {
        previewMessage = isCurrentUserSender
          ? t('chatMessages.youSharedPost')
          : t('chatMessages.sharedPost');
      } else if (message.type === "REEL_SHARE") {
        previewMessage = isCurrentUserSender
          ? t('chatMessages.youSharedReel')
          : t('chatMessages.sharedReel');
      } else if (message.type === "STORY_SHARE") {
        previewMessage = isCurrentUserSender
          ? t('chatMessages.youSharedStory')
          : t('chatMessages.sharedStory');
      }

      if (
        !conversationMap.has(partnerId) ||
        messageTime > new Date(conversationMap.get(partnerId).lastMessageTime)
      ) {
        const lastMessageIsSeen = Number(message?.isSeen ?? 0) === 1;
        const conversationData = {
          id: partnerId,
          userId: partnerId,
          chatId: chatId,
          lastMessageId: message.id,
          username: chatPartner.displayName || chatPartner.username || t('chatMessages.unknownUser'),
          displayName: chatPartner.displayName,
          avatar: chatPartner.image || ONLINE_PLACEHOLDER,
          lastMessage: previewMessage,
          lastMessageTime: message.createdAt,
          timestamp: formatTimestamp(message.createdAt),
          unreadCount: unreadCount,
          isOnline: chatPartner.isOnline || false,
          sentByMe: isCurrentUserSender,
          lastMessageIsSeen,
          type: message.type,
          user: {
            id: partnerId,
            displayName: chatPartner.displayName,
            username: chatPartner.username,
            image: chatPartner.image,
          }
        };

        console.log(`  💾 Storing conversation - Partner: ${partnerId}, chatId: ${chatId}`);
        conversationMap.set(partnerId, conversationData);
      }
    });

    const result = Array.from(conversationMap.values()).sort(
      (a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
    );

    console.log(`✅ Final processed conversations: ${result.length} items`);
    return result;
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const messageDate = new Date(timestamp);
    const diffInMinutes = Math.floor((now - messageDate) / (1000 * 60));

    if (diffInMinutes < 1) {
      return t('chatMessages.timestampNow');
    } else if (diffInMinutes < 60) {
      return t('chatMessages.timestampMinutes', { count: diffInMinutes });
    } else if (diffInMinutes < 1440) {
      return t('chatMessages.timestampHours', { count: Math.floor(diffInMinutes / 60) });
    } else {
      const diffInDays = Math.floor(diffInMinutes / 1440);
      if (diffInDays === 1) {
        return t('chatMessages.timestampOneDay');
      } else if (diffInDays < 7) {
        return t('chatMessages.timestampDays', { count: diffInDays });
      } else {
        return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    }
  };

  const handleUserChat = async (item) => {
    if (!item.userId || !item.user) {
      Alert.alert(t('chatMessages.errorTitle'), t('chatMessages.unableToOpenChat'));
      return;
    }
    
    if (item.unreadCount > 0) {
      try {
        chatStatusUpdate(item.chatId)
          .then((response) => {
            console.log('✅ Chat marked as read:', response);
            
            const socket = getSocket();
            if (socket?.connected) {
              socket.emit('getUserChatBox', { userId: currentUserId });
            }
          })
          .catch((err) => {
            console.log('❌ Chat status update error:', err);
          });
      } catch (error) {
        console.log('❌ Background API Error:', error);
      }
    }

    navigation.navigate('UserChat', {
      userId: item.userId,
      user: item.user,
    });
  };

  const handleLongPress = (item) => {
    setSelectedConversation(item);
    setShowDeleteModal(true);
  };

  const handleDeleteConversation = async () => {
    console.log('🗑️ Attempting to delete conversation:', selectedConversation);

    if (!selectedConversation || !selectedConversation.chatId) {
      showToastMessage(toast, 'error', t('chatMessages.unableToDelete'), 2000);
      setShowDeleteModal(false);
      return;
    }

    setIsDeleting(true);

    try {
      console.log('🗑️ Deleting conversation with chatId:', selectedConversation.chatId);
      const response = await getHideChatConversation(selectedConversation.chatId);

      console.log('📡 Hide conversation response:', response);

      if (response.success) {
        // Store both conversation id and partner id as hidden keys, since the
        // server can return different shapes (conversation vs message list).
        if (selectedConversation.chatId != null) {
          hiddenChatIdsRef.current.add(String(selectedConversation.chatId).trim());
        }
        if (selectedConversation.id != null) {
          hiddenChatIdsRef.current.add(String(selectedConversation.id).trim());
        }

        setConversations(prev =>
          prev.filter(conv => conv.chatId !== selectedConversation.chatId)
        );

        showToastMessage(
          toast,
          'success',
          t('chatMessages.deleteSuccess'),
          2000
        );
      } else {
        showToastMessage(
          toast,
          'error',
          response.message || t('chatMessages.deleteFailed'),
          2000
        );
      }
    } catch (error) {
      console.error('❌ Error deleting conversation:', error);
      showToastMessage(
        toast,
        'error',
        t('chatMessages.deleteFailed'),
        2000
      );
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setSelectedConversation(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setSelectedConversation(null);
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
          <HexAvatar
            uri={item.avatar || ONLINE_PLACEHOLDER}
            size={48}
            borderWidth={2}
            borderColor={text}
          />
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
            {t('chatMessages.startConversation')}
          </Text>
        )}

        {item.sentByMe && (
          <SafeIcon
            name="checkmark-done"
            size={16}
            color={item.lastMessageIsSeen ? '#3b82f6' : '#9ca3af'}
            style={styles.readReceiptIcon}
          />
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

  // Only "Messages" tab conversations are regular chats for now.
  // "My closet chat" surfaces conversations flagged as closet chats
  // (adjust the `isClosetChat` check below once the backend field is finalized).
  const messagesTabConversations = conversations.filter(c => !c.isClosetChat);
  const closetTabConversations = conversations.filter(c => c.isClosetChat);

  const activeConversations = activeTab === CHAT_TABS.CLOSET
    ? closetTabConversations
    : messagesTabConversations;

  const filteredConversations = activeConversations.filter(c =>
    c.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      {/* Header */}
      <View style={[styles.header, bgStyle, { shadowColor: text }]}>
        <TouchableOpacity onPress={handleBackPress}>
          <SafeIcon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]}>{t('chatMessages.title')}</Text>
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
            placeholder={t('chatMessages.searchPlaceholder')}
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#9ca3af"
          />
        </View>
      </TouchableOpacity>

      {/* Messages / My closet chat Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => setActiveTab(CHAT_TABS.MESSAGES)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              textStyle,
              activeTab === CHAT_TABS.MESSAGES && styles.tabTextActive,
            ]}
          >
            {t('chatMessages.messagesLabel')}
          </Text>
          {activeTab === CHAT_TABS.MESSAGES && <View style={styles.tabUnderline} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => setActiveTab(CHAT_TABS.CLOSET)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              textStyle,
              activeTab === CHAT_TABS.CLOSET && styles.tabTextActive,
            ]}
          >
            {t('chatMessages.myClosetChatLabel') || 'My closet chat'}
          </Text>
          {activeTab === CHAT_TABS.CLOSET && <View style={styles.tabUnderline} />}
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
            colors={[text]}
            tintColor={text}
            title={t('chatMessages.pullToRefresh')}
            titleColor={text}
          />
        }
      >
        {isLoading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, textStyle]}>{t('chatMessages.loadingConversations')}</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: text }]}
              onPress={() => {
                const socket = getSocket();
                if (socket?.connected) {
                  socket.emit('getUserChatBox', { userId: currentUserId });
                } else {
                  fetchConversations();
                }
              }}
            >
              <Text style={styles.retryText}>{t('chatMessages.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : filteredConversations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {search
                ? t('chatMessages.noConversationsFound')
                : activeTab === CHAT_TABS.CLOSET
                  ? (t('chatMessages.noClosetChatsYet') || 'No closet chats yet')
                  : t('chatMessages.noConversationsYet')}
            </Text>
            {!search && (
              <Text style={styles.emptySubtext}>
                {activeTab === CHAT_TABS.CLOSET
                  ? (t('chatMessages.closetChatHint') || 'Chats you keep here stay separate from your main inbox')
                  : t('chatMessages.startConversationHint')}
              </Text>
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

      {/* Delete Confirmation Modal */}
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
              <Text style={[styles.modalTitle, textStyle]}>{t('chatMessages.deleteTitle')}</Text>
            </View>

            <Text style={[styles.modalMessage, textStyle]}>
              {t('chatMessages.deleteConfirm')}{' '}
              <Text style={styles.modalUsername}>{selectedConversation?.username}</Text>?
            </Text>

            <Text style={styles.modalWarning}>
              {t('chatMessages.deleteWarning')}
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCancelDelete}
                disabled={isDeleting}
              >
                <Text style={styles.cancelButtonText}>{t('chatMessages.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={handleDeleteConversation}
                disabled={isDeleting}
              >
                <Text style={styles.deleteButtonText}>
                  {isDeleting ? t('chatMessages.deleting') : t('chatMessages.delete')}
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
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e0ea',
  },
  tabButton: {
    marginRight: 24,
    paddingBottom: 8,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9ca3af',
  },
  tabTextActive: {
    color: '#5a2d82',
    fontWeight: '700',
  },
  tabUnderline: {
    marginTop: 6,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#5a2d82',
    width: '100%',
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
  readReceiptIcon: {
    marginLeft: 6,
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