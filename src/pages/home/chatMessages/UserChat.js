import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Keyboard,
  ScrollView,
  Image,
  Modal,
  Alert,
  Platform,
  TouchableWithoutFeedback,
  Animated,
  StatusBar,
  Dimensions,
  KeyboardAvoidingView,
  SafeAreaView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { sendMessage as sendMsgAPI, getConversationById } from '../../../services/chatMessage';
import { LogoIcon } from '../../../assets/icons';
import Icon from 'react-native-vector-icons/Ionicons'
import ImagePicker from 'react-native-image-crop-picker'
import LinearGradient from 'react-native-linear-gradient';
import RBSheet from 'react-native-raw-bottom-sheet';
import ImageViewing from 'react-native-image-viewing';
import Video from 'react-native-video';
import FileViewer from 'react-native-file-viewer';
import { pick } from '@react-native-documents/picker';
import { useAppTheme } from '../../../theme/useApptheme';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../../redux/actions/LoaderAction';
import { getSocket, getConversation, sendMessage as sendSocketMessage, emitTyping, emitStopTyping, initializeSocket } from '../../../services/socket';
import useSocket from '../../../hooks/useSocket';
import { sharePost } from '../../../services/post';
import { getAllUser } from '../../../services/users';
import { parseProfileShareUrl } from '../../../utils/profileShare';
import StoryViewerModal from '../../../components/modals/StoryViewerModal';
import HexAvatar from '../../../components/home/story.js/HexAvatar';

const DEFAULT_AVATAR = require('../../../assets/icons/pngicons/user.png');
const CHAT_LINK_REGEX = /((?:[a-z][a-z0-9+.-]*:\/\/|www\.)[^\s]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/gi;

const stripTrailingLinkPunctuation = (rawLink = '') => {
  let cleanLink = String(rawLink || '');
  let trailingText = '';

  while (/[),.!?;:]+$/.test(cleanLink)) {
    if (cleanLink.endsWith(')')) {
      const openParens = (cleanLink.match(/\(/g) || []).length;
      const closeParens = (cleanLink.match(/\)/g) || []).length;
      if (closeParens <= openParens) break;
    }

    trailingText = cleanLink.slice(-1) + trailingText;
    cleanLink = cleanLink.slice(0, -1);
  }

  return { cleanLink, trailingText };
};

const normalizeChatLink = (rawLink = '') => {
  const trimmedLink = String(rawLink || '').trim();
  if (!trimmedLink) return '';

  if (/^com\.(?:valense|vallesne):\/\//i.test(trimmedLink)) {
    return trimmedLink.replace(/^com\.(?:valense|vallesne):\/\//i, 'com.valens://');
  }

  if (/^www\./i.test(trimmedLink)) {
    return `https://${trimmedLink}`;
  }

  if (
    /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/|$)/i.test(trimmedLink) &&
    !/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmedLink)
  ) {
    return `https://${trimmedLink}`;
  }

  return trimmedLink;
};

const getMessagePartsWithLinks = (message = '') => {
  const text = String(message || '');
  if (!text) return [{ type: 'text', value: '' }];

  const parts = [];
  let lastIndex = 0;
  CHAT_LINK_REGEX.lastIndex = 0;
  let match;

  while ((match = CHAT_LINK_REGEX.exec(text)) !== null) {
    const matchedText = match[0];
    const startIndex = match.index;

    if (startIndex > lastIndex) {
      parts.push({
        type: 'text',
        value: text.slice(lastIndex, startIndex),
      });
    }

    const { cleanLink, trailingText } = stripTrailingLinkPunctuation(matchedText);

    if (cleanLink) {
      parts.push({
        type: 'link',
        value: cleanLink,
        url: normalizeChatLink(cleanLink),
      });
    }

    if (trailingText) {
      parts.push({
        type: 'text',
        value: trailingText,
      });
    }

    lastIndex = startIndex + matchedText.length;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      value: text.slice(lastIndex),
    });
  }

  return parts;
};

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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FALLBACK_AVATAR =require('../../../assets/icons/pngicons/user.png');
const getAvatarSource = (avatar) =>
  avatar && typeof avatar === 'string' && avatar.trim() !== ''
    ? { uri: avatar }
    : FALLBACK_AVATAR;
   

const UserChat = ({ route, navigation }) => {
  // Safe destructuring with fallbacks
  const routeParams = route?.params || {};
  const { userId: targetUserId, user, post, postId, reel, reelId, story, storyId } = routeParams;

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isViewerVisible, setViewerVisible] = useState(false);
  const [currentImages, setCurrentImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const initialShared = post
    ? { type: 'post', post: post, postId: postId || post?.id }
    : reel
      ? { type: 'reel', reel: reel, reelId: reelId || reel?.id }
      : story
        ? { type: 'story', story: story, storyId: storyId || story?.id }
        : null;
  console.log(initialShared, 'indidtalshare')
  console.log('Story params received:', { story, storyId, hasStory: !!story, hasStoryId: !!storyId });
  const [sharedItem, setSharedItem] = useState(initialShared);

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const sheetRef = useRef(null);
  const styles = createStyles();
  const flatListRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputAnim = useRef(new Animated.Value(0)).current;
  const typingAnim = useRef(new Animated.Value(0)).current;
  const typingTimeoutRef = useRef(null);
  const { bgStyle, textStyle, bg, text } = useAppTheme();
  const dispatch = useDispatch();
  const [socketReady, setSocketReady] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const scrollTimeoutRef = useRef(null);
  const [storyViewerVisible, setStoryViewerVisible] = useState(false);
  const [selectedStory, setSelectedStory] = useState(null);
  const seenEmitRef = useRef(new Set());

  useEffect(() => {
    seenEmitRef.current = new Set();
  }, [targetUserId]);

  // Initialize socket with userId and mark ready when connected
  useEffect(() => {
    const ensureSocketInitialized = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (!userId) {
          console.log('[UserChat] No userId found, cannot initialize socket');
          return;
        }
        const socket = getSocket();
        if (socket?.connected) {
          console.log('[UserChat] Socket already connected, ID:', socket.id);
          setSocketReady(true);
        } else {
          console.log('[UserChat] Socket not connected, initializing...');
          await initializeSocket(userId);
          const newSocket = getSocket();
          if (newSocket?.connected) {
            console.log('[UserChat] Socket initialized successfully, ID:', newSocket.id);
            setSocketReady(true);
          } else {
            console.log('[UserChat] Socket initialized but not connected yet, waiting...');
            if (newSocket) {
              newSocket.once('connect', () => {
                console.log('[UserChat] Socket connected after waiting, ID:', newSocket.id);
                setSocketReady(true);
              });
            }
          }
        }
      } catch (error) {
        console.error('[UserChat] Socket initialization error:', error);
      }
    };
    ensureSocketInitialized();
  }, []);

  // Validate required params on mount
  useEffect(() => {
    if (!targetUserId) {
      Alert.alert('Error', 'User information is missing', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
      return;
    }
    // Clear previous messages when switching to a different chat
    setMessages([]);
    // setIsLoading(true);
  }, [targetUserId, navigation]);

  // Add this at the top of UserChat component, after state declarations
  const hasSharedRef = useRef(false); // Track if we've already shared

  // Replace the auto-share useEffect with this fixed version
  useEffect(() => {
    const autoShareMedia = async () => {
      if (hasSharedRef.current) {
        console.log('❌ Auto-share already executed');
        return;
      }
      if (!initialShared || !currentUserId || !targetUserId) {
        console.log('❌ Missing required data:', { initialShared, currentUserId, targetUserId });
        return;
      }
      hasSharedRef.current = true;

      try {
        dispatch(showLoader());
        const mediaId = initialShared.postId || initialShared.reelId || initialShared.storyId;
        console.log('📤 Auto-sharing media:', {
          type: initialShared.type,
          mediaId,
          postId: initialShared.postId,
          reelId: initialShared.reelId,
          storyId: initialShared.storyId,
          fullData: initialShared
        });

        if (!mediaId) {
          console.log('❌ No media ID found in initialShared:', initialShared);
          return;
        }
        const tempId = `temp_share_${Date.now()}`;
        const tempMessage = {
          id: tempId,
          type: initialShared.type === 'post' ? 'post_share'
            : initialShared.type === 'reel' ? 'reel_share'
              : initialShared.type === 'story' ? 'story_share'
                : 'text',
          sender: 'user',
          content: '',
          timestamp: new Date(),
          isTemp: true,
          senderInfo: {
            id: currentUserId,
            displayName: 'You',
            image: null
          },
          receiverInfo: {
            id: targetUserId,
            displayName: user?.displayName || user?.username,
            image: user?.image
          },
          post: initialShared.type === 'post' ? initialShared.post : null,
          reel: initialShared.type === 'reel' ? initialShared.reel : null,
          story: initialShared.type === 'story' ? initialShared.story : null,
        };
        console.log(tempMessage, 'checktemmessage for story')

        setMessages(prev => [...prev, tempMessage]);
        setTimeout(() => scrollToBottom(), 200);
        let mediaType;
        let cleanMediaId = mediaId;

        if (initialShared.type === 'post') {
          mediaType = 'POST';
        } else if (initialShared.type === 'reel') {
          mediaType = 'REEL';
        } else if (initialShared.type === 'story') {
          mediaType = 'STORY';
          // Story IDs have format: {uuid}_0, need to remove the _0 suffix for API
          if (cleanMediaId && cleanMediaId.includes('_')) {
            cleanMediaId = cleanMediaId.split('_')[0];
            console.log('🔧 Cleaned story ID:', { original: mediaId, cleaned: cleanMediaId });
          }
        }

        const sharePayload = {
          mediaId: cleanMediaId,
          mediaType: mediaType,
          conversationType: 'MEDIA',
          sharedUserId: currentUserId,
          receiverUserId: targetUserId
        };
        console.log('📤 Calling sharePost API with:', sharePayload);
        const shareResponse = await sharePost(sharePayload);
        console.log('📥 Share API response:', shareResponse);
        if (!shareResponse.success) {
          throw new Error(shareResponse.message || 'Failed to share media');
        }
        const messageData = {
          senderId: currentUserId,
          receiverId: targetUserId,
          message: '',
          type: initialShared.type === 'post' ? 'POST_SHARE'
            : initialShared.type === 'reel' ? 'REEL_SHARE'
              : initialShared.type === 'story' ? 'STORY_SHARE'
                : 'MEDIA',
        };
        if (initialShared.type === 'post') {
          messageData.postId = initialShared.postId;
        } else if (initialShared.type === 'reel') {
          messageData.reelId = initialShared.reelId;
        } else if (initialShared.type === 'story') {
          // Use the cleaned story ID (without _0 suffix)
          messageData.storyId = cleanMediaId;
          console.log('📤 Socket message storyId:', cleanMediaId);
        }
        const socket = getSocket();
        console.log('🔌 Socket status:', { connected: socket?.connected, id: socket?.id });
        if (socket?.connected) {
          console.log('📤 Sending socket message:', messageData);
          sendSocketMessage(messageData);
          console.log('🔄 Fetching conversation after share');

          // Wait a bit for the message to be processed by the server
          await new Promise(resolve => setTimeout(resolve, 500));

          // Fetch conversation to get the updated messages
          await fetchConversation(currentUserId, targetUserId);

          // Remove temp message after fetching
          setMessages(prev => prev.filter(msg => msg.id !== tempId));
        } else {
          setMessages(prev => prev.filter(msg => msg.id !== tempId));
          throw new Error('Socket not connected. Please try again.');
        }
        setSharedItem(null);
        console.log('✅ Story shared successfully');

      } catch (error) {
        console.error('❌ Auto-share error:', error);
        Alert.alert('Error', error.message || 'Failed to share media');

        hasSharedRef.current = false;
      } finally {
        dispatch(hideLoader());
      }
    };
    if (currentUserId && targetUserId && initialShared && !hasSharedRef.current) {
      const timer = setTimeout(() => {
        autoShareMedia();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [currentUserId, targetUserId]); // Remove initialShared from deps to prevent loop

  useEffect(() => {
    return () => {
      hasSharedRef.current = false;
    };
  }, []);

  // Handle reconnection/disconnection and re-fetch on reconnect
  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      console.log('[UserChat] No socket available for reconnection handler');
      return;
    }
    const handleReconnect = () => {
      console.log('[UserChat] Socket reconnected!');
      setSocketReady(true);
      if (currentUserId && targetUserId) {
        console.log('[UserChat] Re-fetching conversation after reconnect');
        setTimeout(() => {
          try { getConversation(currentUserId, targetUserId); } catch (e) { console.log('[UserChat] getConversation error after reconnect', e?.message); }
        }, 500);
      }
    };
    const handleDisconnect = (reason) => {
      console.log('[UserChat] Socket disconnected:', reason);
      setSocketReady(false);
    };
    socket.on('reconnect', handleReconnect);
    socket.on('disconnect', handleDisconnect);
    return () => {
      socket.off('reconnect', handleReconnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [currentUserId, targetUserId]);

  // Get current user ID and fetch conversation
  useEffect(() => {
    const initializeChat = async () => {
      try {
        dispatch(showLoader());
        const userId = await AsyncStorage.getItem('userId');
        if (!userId) {
          Alert.alert('Error', 'Please log in to continue', [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]);
          return;
        }

        setCurrentUserId(userId);
        if (userId && targetUserId) {
          await fetchConversation(userId, targetUserId);
        }
      } catch (error) {
        console.error('Error initializing chat:', error);
        Alert.alert('Error', 'Failed to load chat');
      } finally {
        setIsLoading(false);
        dispatch(hideLoader());
      }
    };

    if (targetUserId) {
      initializeChat();
    }
  }, [targetUserId]);

  // Ensure conversation updates render even if socket connects late
  useEffect(() => {
    const socket = getSocket();
    console.log('[UserChat] connect effect. socketReady:', socketReady, 'socket?', !!socket, 'connected?', !!socket?.connected, 'me:', currentUserId, 'other:', targetUserId);
    if (!currentUserId || !targetUserId || !socketReady) {
      console.log('[UserChat] Skipping getConversation - not ready');
      return;
    }
    if (socket?.connected) {
      console.log('[UserChat] emit getConversation (connect effect initial)', currentUserId, '->', targetUserId);
      try { getConversation(currentUserId, targetUserId); } catch (e) { console.log('[UserChat] getConversation error initial', e?.message); }
    }
    if (socket) {
      const onConnect = () => {
        console.log('[UserChat] socket connect event -> emit getConversation', currentUserId, '->', targetUserId);
        setSocketReady(true);
        try { getConversation(currentUserId, targetUserId); } catch (e) { console.log('[UserChat] getConversation error on connect', e?.message); }
      };
      socket.on('connect', onConnect);
      return () => {
        socket.off('connect', onConnect);
      };
    }
  }, [currentUserId, targetUserId, socketReady]);

  // Periodic refresh to avoid missed events during long sessions
  useEffect(() => {
    if (!currentUserId || !targetUserId || !socketReady) {
      console.log('[UserChat] Skipping periodic refresh - not ready');
      return;
    }
    const socket = getSocket();
    let interval;
    if (socket) {
      interval = setInterval(() => {
        if (socket.connected) {
          console.log('[UserChat] periodic refresh -> emit getConversation', currentUserId, '->', targetUserId);
          try { getConversation(currentUserId, targetUserId); } catch (e) { console.log('[UserChat] periodic getConversation error', e?.message); }
        } else {
          console.log('[UserChat] periodic refresh skipped (socket not connected)');
        }
      }, 10000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentUserId, targetUserId, socketReady]);

  // Re-emit conversation on screen focus to recover missed events
  useFocusEffect(
    useCallback(() => {
      const socket = getSocket();
      console.log('[UserChat] focus effect. socketReady:', socketReady, 'socket?', !!socket, 'connected?', !!socket?.connected, 'me:', currentUserId, 'other:', targetUserId);
      if (socket?.connected && socketReady && currentUserId && targetUserId) {
        console.log('[UserChat] emit getConversation (focus)', currentUserId, '->', targetUserId);
        try { getConversation(currentUserId, targetUserId); } catch (e) { console.log('[UserChat] getConversation error focus', e?.message); }
      }
      return () => { };
    }, [currentUserId, targetUserId, socketReady])
  );

  // Listen for conversation data from socket
  useSocket('userConversation', (data) => {
    console.log('📨 Received userConversation event:', data);
    let conversationData = null;
    if (data && data.success && Array.isArray(data.data)) {
      conversationData = data.data;
    } else if (Array.isArray(data)) {
      conversationData = data;
    }
    if (conversationData && conversationData.length > 0) {
      const conversationMessages = conversationData.filter(msg => {
        const sId = String(msg.sender?.id ?? msg.senderId);
        const rId = String(msg.receiver?.id ?? msg.receiverId);
        const me = String(currentUserId);
        const other = String(targetUserId);
        return (
          (sId === me && rId === other) ||
          (sId === other && rId === me)
        );
      });
      console.log('📨 Filtered conversation messages:', conversationMessages.length);
      if (conversationMessages.length > 0) {
        processAndSetMessages(conversationMessages, currentUserId, targetUserId);
      } else {
        setMessages([]);
        setIsLoading(false);
      }
    } else {
      console.log('📨 No conversation data received');
      setMessages([]);
      setIsLoading(false);
    }
  }, [currentUserId, targetUserId]);

  // Listen for new messages in real-time (robust to payload shape and type)
  useSocket('newMessage', (message) => {
    console.log('[UserChat] ===== NEW MESSAGE EVENT =====');
    console.log('[UserChat] Raw message:', JSON.stringify(message, null, 2));
    if (!message) {
      console.log('[UserChat] Message is null/undefined');
      return;
    }
    if (!currentUserId || !targetUserId) {
      console.log('[UserChat] Missing currentUserId or targetUserId');
      return;
    }
    const getSenderId = (msg) => String(msg.sender?.id || msg.sender?._id || msg.senderId || '');
    const getReceiverId = (msg) => String(msg.receiver?.id || msg.receiver?._id || msg.receiverId || '');
    const sId = getSenderId(message);
    const rId = getReceiverId(message);
    const me = String(currentUserId);
    const other = String(targetUserId);
    console.log('[UserChat] ID Comparison:');
    console.log(' Sender ID:', sId);
    console.log(' Receiver ID:', rId);
    console.log(' Current User (me):', me);
    console.log(' Target User (other):', other);
    const isForThisConversation = ((sId === me && rId === other) || (sId === other && rId === me));
    console.log('[UserChat] Is for this conversation?', isForThisConversation);
    if (!isForThisConversation) {
      console.log('[UserChat] Message NOT for this conversation, ignoring');
      return;
    }
    console.log('[UserChat] ✅ Processing message for this conversation');
    const rawType = (message.type || 'CHAT').toUpperCase();
    let mappedType = 'text';
    switch (rawType) {
      case 'TEXT':
      case 'CHAT':
        mappedType = 'text'; break;
      case 'IMAGE':
        mappedType = 'image'; break;
      case 'VIDEO':
        mappedType = 'video'; break;
      case 'POST_SHARE':
        mappedType = 'post_share'; break;
      case 'REEL_SHARE':
        mappedType = 'reel_share'; break;
      case 'STORY_SHARE':
        mappedType = 'story_share'; break;
      case 'MEDIA':
        mappedType = message.story ? 'story_share' : 'post_share'; break;
      default:
        mappedType = 'text';
    }
    console.log('[UserChat] Mapped type:', rawType, '->', mappedType);
    const formattedMsg = {
      id: message.id?.toString() || `msg_${Date.now()}_${Math.random()}`,
      type: mappedType,
      sender: sId === me ? 'user' : 'peer',
      content: message.content || message.message || '',
      timestamp: new Date(message.createdAt || Date.now()),
      isSeen: Number(message?.isSeen ?? 0) === 1,
      seenBy: message?.seenBy || null,
      senderInfo: message.sender || { id: sId },
      receiverInfo: message.receiver || { id: rId },
      images: Array.isArray(message.images) ? message.images : undefined,
      uri: message.video || message.content || undefined,
      thumbnail: message.thumbnail || undefined,
      post: message.post,
      story: message.story,
      reel: message.reel,
    };
    console.log('[UserChat] Formatted message:', formattedMsg);
    setMessages(prev => {
      const exists = prev.some(m => m.id === formattedMsg.id);
      if (exists) {
        console.log('[UserChat] ⚠️ Message already exists, skipping');
        return prev;
      }
      console.log('[UserChat] ✅ Adding new message to state');
      const newMessages = [...prev, formattedMsg];
      newMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      return newMessages;
    });
    // Only auto-scroll for incoming messages if user is near bottom
    if (isNearBottom) {
      setTimeout(() => {
        console.log('[UserChat] Scrolling to bottom');
        scrollToBottom(false);
      }, 100);
    }
    console.log('[UserChat] ===== END NEW MESSAGE EVENT =====');
  }, [currentUserId, targetUserId]);

  // Also handle 'messageSent' as some backends emit this instead of 'newMessage'
  useSocket('messageSent', (message) => {
    if (!message || !currentUserId || !targetUserId) return;

    const sId = String(message.sender?.id ?? message.senderId);
    const rId = String(message.receiver?.id ?? message.receiverId);
    const me = String(currentUserId);
    const other = String(targetUserId);
    const isForThisConversation = (
      (sId === me && rId === other) ||
      (sId === other && rId === me)
    );
    if (!isForThisConversation) return;

    const rawType = (message.type || 'CHAT').toUpperCase();
    let mappedType = 'text';
    switch (rawType) {
      case 'TEXT':
      case 'CHAT':
        mappedType = 'text'; break;
      case 'IMAGE':
        mappedType = 'image'; break;
      case 'VIDEO':
        mappedType = 'video'; break;
      case 'POST_SHARE':
        mappedType = 'post_share'; break;
      case 'REEL_SHARE':
        mappedType = 'reel_share'; break;
      case 'STORY_SHARE':
      case 'MEDIA':
        mappedType = message.story ? 'story_share' : 'post_share'; break;
      default:
        mappedType = 'text';
    }

    const formattedMsg = {
      id: message.id?.toString() || `msg_${Date.now()}_${Math.random()}`,
      type: mappedType,
      sender: sId === currentUserId ? 'user' : 'peer',
      content: message.content || '',
      timestamp: new Date(message.createdAt || Date.now()),
      isSeen: Number(message?.isSeen ?? 0) === 1,
      seenBy: message?.seenBy || null,
      senderInfo: message.sender || {},
      receiverInfo: message.receiver || {},
      images: Array.isArray(message.images) ? message.images : undefined,
      uri: message.video || message.content || undefined,
      thumbnail: message.thumbnail || undefined,
      post: message.post,
      story: message.story,
      reel: message.reel,
    };

    setMessages(prev => {
      const exists = prev.some(m => m.id === formattedMsg.id);
      if (exists) return prev;
      return [...prev, formattedMsg];
    });
    // Only auto-scroll if user is near bottom
    if (isNearBottom) {
      scrollToBottom(false);
    }
  }, [currentUserId, targetUserId]);

  // Listen for typing indicators
  useSocket('typing', (data) => {
    if (data.userId === targetUserId) {
      setIsTyping(true);
    }
  }, [targetUserId]);

  useSocket('stopTyping', (data) => {
    if (data.userId === targetUserId) {
      setIsTyping(false);
    }
  }, [targetUserId]);

  useSocket('messageSeen', (payload) => {
    if (!payload?.messageId) return;

    setMessages(prev =>
      prev.map(message =>
        String(message.id) === String(payload.messageId)
          ? {
            ...message,
            isSeen: true,
            seenBy: payload?.seenBy || payload?.userId || payload?.data?.seenBy || null,
          }
          : message,
      ),
    );
  }, []);

  useSocket('messageSeenError', (error) => {
    console.log('[UserChat] messageSeenError:', error);
  }, []);

  // Process and set messages helper
  const processAndSetMessages = (conversationMessages, senderId, receiverId) => {
    console.log(conversationMessages, 'check new conversation message')
    const formattedMessages = conversationMessages.map(msg => {
      // Log post type for debugging
      if (msg.post) {
        console.log('Post type detected:', msg.post.type, 'Message type:', msg.type);
      }
      if (msg.story) {
        console.log('📖 Story detected in message:', msg.story, 'Message type:', msg.type);
      }
      const isSender = String(msg.sender?.id ?? msg.senderId) === String(senderId);
      const messageType = msg.type || 'CHAT';

      let formattedMsg = {
        id: msg.id?.toString() || `msg_${Date.now()}_${Math.random()}`,
        type: messageType.toLowerCase(),
        sender: isSender ? 'user' : 'peer',
        timestamp: new Date(msg.createdAt || Date.now()),
        isSeen: Number(msg?.isSeen ?? 0) === 1,
        seenBy: msg?.seenBy || null,
        senderInfo: msg.sender || {},
        receiverInfo: msg.receiver || {},
        rawData: msg,
      };

      // Handle different message types
      if (messageType === 'CHAT' || messageType === 'text') {
        formattedMsg.type = 'text';
        formattedMsg.content = msg.content || '';
      } else if (messageType === 'image' || messageType === 'IMAGE') {
        formattedMsg.type = 'image';
        formattedMsg.images = msg.images || [];
      } else if (messageType === 'video' || messageType === 'VIDEO' || messageType === 'reel') {
        formattedMsg.type = 'video';
        formattedMsg.uri = msg.video || msg.content || '';
        formattedMsg.thumbnail = msg.thumbnail || '';
      } else if (messageType === 'POST_SHARE' || messageType === 'MEDIA') {
        // Check if it's actually a story
        if (msg.story) {
          formattedMsg.type = 'story_share';
          formattedMsg.story = msg.story;
          formattedMsg.content = msg.content;
        } else if (msg.post) {
          // Check if the post is a reel type
          if (msg.post.type === 'reel') {
            formattedMsg.type = 'reel_share';
            formattedMsg.reel = msg.post;
            formattedMsg.content = msg.content;
          } else {
            // For normal posts, crowdfunding, and other post types, always show as post_share
            // This preserves user information (userName, userImage) and post metadata
            formattedMsg.type = 'post_share';
            formattedMsg.post = msg.post;
          }
        } else {
          // If both story and post are null, show as deleted/unavailable content
          console.log('⚠️ MEDIA message with no story or post data (likely expired/deleted):', msg.id);
          formattedMsg.type = 'text';
          formattedMsg.content = '❌ This content is no longer available';
          formattedMsg.isDeletedContent = true;
        }
      } else if (messageType === 'REEL_SHARE') {
        formattedMsg.type = 'reel_share';
        formattedMsg.reel = msg.reel || msg.post || {};
        formattedMsg.content = msg.content;
      } else if (messageType === 'STORY_SHARE') {
        console.log('📖 Processing STORY_SHARE message:', msg);
        formattedMsg.type = 'story_share';
        formattedMsg.story = msg.story || {};
        formattedMsg.content = msg.content;
      } else {
        formattedMsg.type = 'text';
        formattedMsg.content = msg.content || '';
      }
      return formattedMsg;
    });

    // Filter out null messages and sort by timestamp
    const validMessages = formattedMessages.filter(msg => msg !== null);
    validMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    setMessages(validMessages);
    setIsLoading(false);
    // ADD: Force scroll to bottom after setting messages (e.g., on initial load or fetch)
    setTimeout(() => {
      if (!isUserScrolling) {
        flatListRef.current?.scrollToEnd({ animated: true });
      }
    }, 100);
  };

  const isVideoUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm']; // Add more if needed
    return videoExtensions.some(ext => url.toLowerCase().endsWith(ext));
  };

  // Fetch conversation messages
  const fetchConversation = async (senderId, receiverId) => {
    try {
      console.log('🔄 fetchConversation called for:', senderId, '->', receiverId);
      const socket = getSocket();
      if (socket?.connected) {
        console.log('🔌 Socket connected, emitting getConversation');
        getConversation(senderId, receiverId);

        // Also fetch via API as fallback to ensure we get the latest messages
        console.log('📡 Also fetching via API as backup');
        const response = await getConversationById(receiverId);
        if (response.success) {
          console.log('📥 API response received:', response.data?.length, 'messages');
          const conversationMessages = response.data.filter(msg => {
            const sId = String(msg.sender?.id ?? msg.senderId);
            const rId = String(msg.receiver?.id ?? msg.receiverId);
            const me = String(senderId);
            const other = String(receiverId);
            return (
              (sId === me && rId === other) ||
              (sId === other && rId === me)
            );
          });
          console.log('📥 Filtered messages:', conversationMessages.length);
          processAndSetMessages(conversationMessages, senderId, receiverId);
        }
      } else {
        console.log('❌ Socket not connected, fetching via API only');
        const response = await getConversationById(receiverId);
        if (response.success) {
          const conversationMessages = response.data.filter(msg => {
            const sId = String(msg.sender?.id ?? msg.senderId);
            const rId = String(msg.receiver?.id ?? msg.receiverId);
            const me = String(senderId);
            const other = String(receiverId);
            return (
              (sId === me && rId === other) ||
              (sId === other && rId === me)
            );
          });
          processAndSetMessages(conversationMessages, senderId, receiverId);
        }
      }
    } catch (error) {
      console.error('❌ fetchConversation error:', error);
      Alert.alert('Error', 'Failed to load messages');
    }
  };

  // Animations
  useEffect(() => {
    if (!isLoading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(inputAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isLoading]);

  const scrollToBottom = (force = false) => {
    // Only auto-scroll if user is near bottom or if forced (e.g., user sent a message)
    if (force || isNearBottom) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  useEffect(() => {
    if (!socketReady || !currentUserId || !targetUserId || messages.length === 0) {
      return;
    }

    const socket = getSocket();
    if (!socket?.connected) return;

    messages.forEach(message => {
      const shouldEmitSeen =
        message?.id &&
        message.sender === 'peer' &&
        !message.isSeen &&
        !seenEmitRef.current.has(String(message.id));

      if (!shouldEmitSeen) return;

      seenEmitRef.current.add(String(message.id));
      socket.emit('markMessageSeen', {
        messageId: String(message.id),
        userId: currentUserId,
        otherUserId: targetUserId,
      });
    });
  }, [messages, currentUserId, targetUserId, socketReady]);

  // Track scroll position to determine if user is near bottom
  const handleScroll = (event) => {
    if (!isUserScrolling) {
      setIsUserScrolling(true);
    }
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 200);
  };

  // Handle content size change - only scroll if appropriate
  const handleContentSizeChange = () => {
    if (!isUserScrolling && isNearBottom) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 50);
    }
  };

  // Handle typing indicator
  const handleTyping = () => {
    if (!targetUserId) return;
    const socket = getSocket();
    if (socket?.connected) {
      emitTyping(targetUserId);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        console.log('⌨️ Stop typing');
        emitStopTyping(targetUserId);
      }, 2000);
    }
  };

  // Send message function with socket integration
  const sendMessage = async () => {
    if ((inputText.trim() === '' && !sharedItem) || isSending || !currentUserId || !targetUserId) {
      return;
    }

    const messageContent = inputText.trim();
    const tempId = `temp_${Date.now()}_${Math.random()}`;

    // Create temporary message for immediate UI update
    const tempMessage = {
      id: tempId,
      type: 'text',
      sender: 'user',
      content: messageContent,
      shared: sharedItem ? { ...sharedItem } : undefined,
      timestamp: new Date(),
      isTemp: true,
      senderInfo: { id: currentUserId, displayName: 'You' },
      receiverInfo: { id: targetUserId, displayName: user?.displayName || user?.username, image: user?.image }
    };

    setMessages(prev => [...prev, tempMessage]);
    setInputText('');
    setIsSending(true);
    scrollToBottom(true); // Force scroll when user sends a message

    try {
      const messageData = {
        senderId: currentUserId,
        receiverId: targetUserId,
        message: messageContent,
        type: sharedItem?.type === 'post' ? 'POST_SHARE'
          : sharedItem?.type === 'reel' ? 'REEL_SHARE'
            : sharedItem?.type === 'story' ? 'STORY_SHARE'
              : 'CHAT',
      };

      // Add shared content if present
      if (sharedItem?.type === 'post') {
        messageData.postId = sharedItem.postId;
      } else if (sharedItem?.type === 'reel') {
        messageData.reelId = sharedItem.reelId;
      } else if (sharedItem?.type === 'story') {
        messageData.storyId = sharedItem.storyId;
      }
      console.log('[UserChat] Sending message. Socket ready?', socketReady);
      const socket = getSocket();
      if (socket?.connected && socketReady) {
        console.log('[UserChat] ✅ Sending via socket');
        sendSocketMessage(messageData);
      } else {
        console.log('[UserChat] ⚠️ Socket not ready, will rely on API only');
      }

      // Always use API for confirmation
      const response = await sendMsgAPI(messageData);

      if (response.success) {
        // Replace temporary message with actual message from API
        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempId
              ? {
                ...msg,
                id: response.data?.id?.toString() || tempId,
                isTemp: false,
              }
              : msg
          )
        );

        // Clear shared item after successful send
        setSharedItem(null);

        // Force-refresh conversation to ensure it's synced
        const sock = getSocket();
        if (sock?.connected && socketReady) {
          console.log('[UserChat] Force-refreshing conversation after send');
          setTimeout(() => {
            try { getConversation(currentUserId, targetUserId); } catch (e) { console.log('[UserChat] getConversation error post-send', e?.message); }
          }, 500);
        }
      } else {
        throw new Error(response.message || 'Failed to send message');
      }
    } catch (error) {
      // Remove temporary message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      Alert.alert('Error', error.message || 'Failed to send message. Please try again.');
    } finally {
      setIsSending(false);

      // Stop typing indicator
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      const socket = getSocket();
      if (socket?.connected) {
        emitStopTyping(targetUserId);
      }
    }
  };

  const handleAttachment = async type => {
    if (sheetRef.current?.close) {
      sheetRef.current.close();
    }

    try {
      if (type === 'camera' && ImagePicker) {
        const image = await ImagePicker.openCamera({
          mediaType: 'any',
          cropping: false,
          quality: 0.8,
        });

        // Determine if it's a video or photo
        const isVideo = image.mime?.startsWith('video/') || image.path?.toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/);

        if (isVideo) {
          await sendMediaMessage([image], 'video');
        } else {
          await sendMediaMessage([image], 'photo');
        }
      } else if (type === 'gallery' && ImagePicker) {
        const media = await ImagePicker.openPicker({
          multiple: true,
          mediaType: 'any',
          cropping: false,
          quality: 0.8,
        });

        const mediaArray = Array.isArray(media) ? media : [media];

        // Separate photos and videos
        const photos = mediaArray.filter(m => !m.mime?.startsWith('video/') && !m.path?.toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/));
        const videos = mediaArray.filter(m => m.mime?.startsWith('video/') || m.path?.toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/));

        // Send photos
        if (photos.length > 0) {
          await sendMediaMessage(photos, 'photo');
        }

        // Send videos one by one
        for (const video of videos) {
          await sendMediaMessage([video], 'video');
        }
      } else if (type === 'document') {
        const [file] = await pick({
          type: ['application/pdf', 'application/msword', 'text/plain'],
        });
        await sendMediaMessage([file], 'file');
      } else {
        Alert.alert('Feature Unavailable', 'This feature is not available on your device');
      }
    } catch (error) {
      console.error('Attachment error:', error);
      if (error?.message !== 'User cancelled image selection' && error?.code !== 'E_PICKER_CANCELLED') {
        Alert.alert('Error', 'Failed to select file');
      }
    }
  };

  const sendMediaMessage = async (mediaFiles, mediaType) => {
    if (!currentUserId || !targetUserId || !mediaFiles || mediaFiles.length === 0) {
      return;
    }

    const tempId = `temp_${mediaType}_${Date.now()}_${Math.random()}`;

    try {
      // Create temporary message for immediate UI update
      const tempMessage = {
        id: tempId,
        type: mediaType === 'photo' ? 'image' : mediaType,
        sender: 'user',
        timestamp: new Date(),
        isTemp: true,
        isSending: true,
        senderInfo: { id: currentUserId, displayName: 'You' },
        receiverInfo: { id: targetUserId, displayName: user?.displayName || user?.username, image: user?.image }
      };

      if (mediaType === 'photo') {
        tempMessage.images = mediaFiles.map(m => ({ uri: m.path || m.uri }));
      } else if (mediaType === 'video') {
        tempMessage.uri = mediaFiles[0].path || mediaFiles[0].uri;
      } else if (mediaType === 'file') {
        tempMessage.file = mediaFiles[0];
      }

      setMessages(prev => [...prev, tempMessage]);
      scrollToBottom(true); // Force scroll when user sends media

      // Prepare FormData
      const formData = new FormData();
      formData.append('senderId', currentUserId);
      formData.append('receiverId', targetUserId);
      formData.append('message', '');
      formData.append('type', mediaType === 'photo' ? 'PHOTO' : mediaType === 'video' ? 'VIDEO' : 'FILE');

      // Append media files
      mediaFiles.forEach((file, index) => {
        const fileUri = Platform.OS === 'android' ? file.path || file.uri : (file.path || file.uri)?.replace('file://', '');
        const fileName = file.filename || file.name || fileUri?.split('/').pop() || `${mediaType}_${Date.now()}_${index}`;
        const fileType = file.mime || file.type || (mediaType === 'photo' ? 'image/jpeg' : mediaType === 'video' ? 'video/mp4' : 'application/octet-stream');

        formData.append('images', {
          uri: fileUri,
          name: fileName,
          type: fileType,
        });
      });

      console.log('📤 Sending media message:', { mediaType, fileCount: mediaFiles.length });

      // Send via API
      const response = await sendMsgAPI(formData);

      if (response.success) {
        console.log('✅ Media sent successfully:', response.data);

        // Replace temp message with actual message
        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempId
              ? {
                ...msg,
                id: response.data?.id?.toString() || tempId,
                isTemp: false,
                isSending: false,
                images: response.data?.images || msg.images,
                uri: response.data?.images?.[0] || msg.uri,
              }
              : msg
          )
        );

        // Send via socket if connected
        const socket = getSocket();
        if (socket?.connected && socketReady) {
          const messageData = {
            senderId: currentUserId,
            receiverId: targetUserId,
            message: '',
            type: mediaType === 'photo' ? 'PHOTO' : mediaType === 'video' ? 'VIDEO' : 'FILE',
          };
          sendSocketMessage(messageData);
        }

        // Refresh conversation to get the latest messages
        setTimeout(() => {
          fetchConversation(currentUserId, targetUserId);
        }, 500);
      } else {
        throw new Error(response.message || 'Failed to send media');
      }
    } catch (error) {
      console.error('❌ Error sending media:', error);

      // Remove temp message and show error
      setMessages(prev => prev.filter(msg => msg.id !== tempId));

      Alert.alert(
        'Failed to send',
        error?.response?.data?.message || error?.message || 'Could not send media. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const formatTime = timestamp => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffInHours = (now - date) / (1000 * 60 * 60);

      if (diffInHours < 1) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diffInHours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    } catch (error) {
      return 'Now';
    }
  };

  const getFileExtension = filename => {
    if (!filename) return 'FILE';
    return filename.split('.').pop()?.toUpperCase() || 'FILE';
  };

  const formatFileSize = bytes => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const resolveProfileUserIdFromUsername = useCallback(async (incomingUsername) => {
    const cleanUsername = decodeURIComponent(String(incomingUsername || '').trim()).replace(/^@+/, '');

    if (!cleanUsername) {
      return null;
    }

    try {
      const response = await getAllUser({ userName: cleanUsername });
      const users = response?.data?.users ?? [];
      const exactMatch = users.find((candidateUser) =>
        String(candidateUser?.userName || candidateUser?.username || '').toLowerCase() === cleanUsername.toLowerCase()
      );
      const matchedUser = exactMatch || users[0];

      return matchedUser?.id || matchedUser?._id || matchedUser?.userId || null;
    } catch (error) {
      console.log('Unable to resolve profile username from chat link:', error?.message || error);
      return null;
    }
  }, []);

  const handleLinkPress = useCallback(async (rawUrl) => {
    const normalizedUrl = normalizeChatLink(rawUrl);
    if (!normalizedUrl) return;

    const sharedProfileLink = parseProfileShareUrl(normalizedUrl);
    if (sharedProfileLink) {
      const resolvedUserId = String(sharedProfileLink.userId || '').trim()
        || await resolveProfileUserIdFromUsername(sharedProfileLink.username);

      if (resolvedUserId) {
        navigation.navigate('UsersProfile', {
          userId: String(resolvedUserId),
        });
        return;
      }
    }

    const webFallbackUrl = normalizedUrl.replace(/^com\.valens:\/\//i, 'https://valensGoApp.com/');

    try {
      const supported = await Linking.canOpenURL(normalizedUrl);
      if (supported) {
        await Linking.openURL(normalizedUrl);
        return;
      }

      if (/^https?:\/\//i.test(webFallbackUrl)) {
        await Linking.openURL(webFallbackUrl);
        return;
      }

      throw new Error('Unsupported link');
    } catch (error) {
      console.log('Unable to open chat link:', normalizedUrl, error?.message || error);
      Alert.alert('Unable to open link', 'This link could not be opened.');
    }
  }, [navigation, resolveProfileUserIdFromUsername]);

  const renderMessageText = useCallback((content, isUser) => {
    const messageParts = getMessagePartsWithLinks(content);

    return (
      <Text
        style={[
          styles.messageText,
          isUser ? styles.userMessageText : styles.botMessageText,
        ]}
      >
        {messageParts.map((part, partIndex) => {
          if (part.type === 'link') {
            return (
              <Text
                key={`link-${partIndex}`}
                style={styles.messageLinkText}
                onPress={() => handleLinkPress(part.url)}
                suppressHighlighting
              >
                {part.value}
              </Text>
            );
          }

          return (
            <Text key={`text-${partIndex}`}>
              {part.value}
            </Text>
          );
        })}
      </Text>
    );
  }, [handleLinkPress, styles.messageLinkText, styles.messageText, styles.userMessageText, styles.botMessageText]);

  const renderImageGrid = images => {
    if (!images || images.length === 0) return null;

    if (images.length === 1) {
      return (
        <TouchableOpacity
          onPress={() => {
            setCurrentImages(images);
            setCurrentIndex(0);
            setViewerVisible(true);
          }}
          style={styles.singleImageContainer}
        >
          <Image source={images[0]} style={styles.singleImage} resizeMode="cover" />
        </TouchableOpacity>
      );
    }

    if (images.length === 2) {
      return (
        <View style={styles.imageGrid}>
          {images.map((img, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => {
                setCurrentImages(images);
                setCurrentIndex(index);
                setViewerVisible(true);
              }}
            >
              <Image
                source={img}
                style={[styles.gridImage, styles.twoImagesImage]}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </View>
      );
    }


    const displayImages = images.slice(0, 4);
    const remainingCount = images.length - 4;

    return (
      <View style={styles.imageGrid}>
        {displayImages.map((img, index) => {
          const isLast = index === 3 && remainingCount > 0;
          return (
            <TouchableOpacity
              key={index}
              onPress={() => {
                setCurrentImages(images);
                setCurrentIndex(index);
                setViewerVisible(true);
              }}
            >
              <Image
                source={img}
                style={[
                  styles.gridImage,
                  index === 0 && images.length === 3
                    ? styles.threeImagesMain
                    : styles.threeImagesSide,
                ]}
                resizeMode="cover"
              />
              {isLast && (
                <View style={styles.imageOverlay}>
                  <Text style={styles.overlayText}>+{remainingCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };
  const renderVideoGrid = (videoUri, thumbnailUri) => {
    // Treat video like a single image in the grid, but add play overlay
    return (
      <TouchableOpacity
        onPress={() => {
          setCurrentVideo(videoUri);
          setViewerVisible(false); // Close image viewer if open
          setVideoModalVisible(true);
        }}
        style={styles.singleImageContainer} // Reuse image container style for consistency
      >
        <Video source={{ uri: thumbnailUri || videoUri }} style={styles.singleImage} resizeMode="cover" />
        <View style={styles.playButton}>
          <LinearGradient colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.5)']} style={styles.playButtonGradient}>
            <Text style={styles.playIcon}>▶</Text>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    );
  };


  const renderMessage = ({ item, index }) => {
    const isUser = item.sender === 'user';
    const isLastMessage = index === messages.length - 1;
    const showTime =
      index === 0 ||
      (messages[index - 1] &&
        new Date(item.timestamp).getTime() -
        new Date(messages[index - 1].timestamp).getTime() >
        300000);

    return (
      <View style={styles.messageWrapper}>
        {showTime && (
          <View style={styles.timeContainer}>
            <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
          </View>
        )}

        <View
          style={[
            styles.messageRow,
            isUser ? styles.userMessageRow : styles.botMessageRow,
          ]}
        >
          {!isUser && (
            <TouchableOpacity
              style={styles.botAvatar}
              activeOpacity={0.7}
              onPress={handleNavigateToProfile}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <HexAvatar
                uri={item.senderInfo?.image || user?.image}
                size={32}
                borderWidth={2}
                borderColor={text}
              />
            </TouchableOpacity>
          )}

          <View style={styles.messageContent}>
            {item.type === 'text' && (
              <View>
                <View
                  style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.botBubble,
                    item.isTemp && styles.tempMessage,
                    { backgroundColor: text }
                  ]}
                >
                  {renderMessageText(item.content, isUser)}
                </View>

                {/* If this message has a shared item (temp send), render compact preview */}
                {item.shared && (
                  <TouchableOpacity
                    style={styles.messageSharedContainer}
                    onPress={() => {
                      // optional: navigate to post/reel view when implemented
                    }}
                  >
                    {item.shared.type === 'post' && (
                      <Image
                        source={{ uri: item.shared.post?.media?.[0]?.url || item.shared.post?.images?.[0]?.url || item.shared.post?.image }}
                        style={styles.messageSharedImage}
                        resizeMode="cover"
                      />
                    )}

                    {item.shared.type === 'reel' && (
                      <View style={{ position: 'relative' }}>
                        <Image
                          source={{ uri: item.shared.reel?.media?.[0]?.url || item.shared.reel?.thumbnail || item.shared.reel?.image }}
                          style={styles.messageSharedImage}
                          resizeMode="cover"
                        />
                        <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.45)', padding: 6, borderRadius: 12 }}>
                          <Text style={{ color: '#fff', fontSize: 12 }}>▶</Text>
                        </View>
                      </View>
                    )}
                    {item.shared.type === 'story' && (
                      <View style={{ position: 'relative' }}>
                        <Image
                          source={{ uri: item.shared.story?.uri || item.shared.story?.media?.[0]?.url || item.shared.story?.thumbnail || item.shared.story?.image }}
                          style={styles.messageSharedImage}
                          resizeMode="cover"
                        />
                      </View>
                    )}

                    <Text style={styles.messageSharedText} numberOfLines={2}>
                      {item.shared.type === 'post'
                        ? (item.shared.post?.text || item.shared.post?.caption || 'Shared post')
                        : item.shared.type === 'reel'
                          ? (item.shared.reel?.caption || 'Shared reel')
                          : (item.shared.story?.caption || item.shared.story?.text || 'Shared story')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {item.type === 'image' && (
              <View style={styles.imageMessage}>
                {item.isSending && (
                  <View style={styles.mediaSendingOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.mediaSendingText}>Uploading...</Text>
                  </View>
                )}
                {renderImageGrid(item.images)}
              </View>
            )}

            {item.type === 'video' && (
              <View style={styles.imageMessage}>
                {item.isSending && (
                  <View style={styles.mediaSendingOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.mediaSendingText}>Uploading...</Text>
                  </View>
                )}
                {renderVideoGrid(item.uri, item.thumbnail)}
              </View>
            )}

            {item.type === 'file' && (
              <TouchableOpacity
                style={styles.fileMessage}
                onPress={() => {
                  if (FileViewer) {
                    FileViewer.open(item.file.uri).catch(() =>
                      Alert.alert('Error', 'Cannot open this file'),
                    );
                  } else {
                    Alert.alert('Feature Unavailable', 'File viewer is not available');
                  }
                }}
              >
                <LinearGradient colors={[text, text]} style={styles.fileIcon}>
                  <Text style={styles.fileIconText}>📄</Text>
                </LinearGradient>
                <View style={styles.fileDetails}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {item.file?.name || 'Unknown File'}
                  </Text>
                  <Text style={styles.fileSize}>
                    {getFileExtension(item.file?.name)} • {formatFileSize(item.file?.size)}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {(item.type === 'post_share' || item.type === 'post') && (
              (() => {
                const postData = item.post || item.rawData?.post || item.rawData || {};

                // Extract user information with proper fallbacks
                const postUser = {
                  displayName: postData.userName || postData.user?.displayName || postData.user?.name || item.senderInfo?.displayName || 'Unknown User',
                  image: postData.userImage || postData.user?.image || item.senderInfo?.image || ''
                };

                const images = postData.images || [];
                const hasVideo = images.length > 0 && isVideoUrl(images[0]?.url || images[0]);
                const postExists = postData && (postData.id || postData.text || postData.caption || images.length > 0);

                if (!postExists) {
                  return (
                    <View style={[styles.sharedPostContainer, isUser && styles.userSharedPost, styles.deletedContent]}>
                      <Text style={styles.deletedContentText}>❌ This post is no longer available</Text>
                    </View>
                  );
                }

                return (
                  <TouchableOpacity
                    style={[styles.sharedPostContainer, isUser && styles.userSharedPost]}
                    onPress={() => {
                      if (postData.id) {
                        // Navigate to PostView with the post data
                        navigation.navigate('ProfileMain', {
                          screen: 'PostView',
                          params: {
                            postData: [postData],
                            startIndex: 0,
                            userChat: true, // Add this flag to indicate coming from UserChat
                          }
                        });
                      } else {
                        Alert.alert('Error', 'Post not found');
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.sharedPostHeader}>
                      <View style={styles.sharedPostUserInfo}>
                        <Image
                          source={getAvatarSource(postUser.image)}
                          style={styles.sharedPostAvatar}
                        />
                        <View>
                          <Text style={styles.sharedPostUserName}>
                            {postUser.displayName}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {postData.text && (
                      <Text style={[styles.sharedPostText, isUser && styles.userSharedPostText]} numberOfLines={3}>
                        {postData.text}
                      </Text>
                    )}

                    {postData.caption && (
                      <Text style={[styles.sharedPostCaption, isUser && styles.userSharedPostText]} numberOfLines={2}>
                        {postData.caption}
                      </Text>
                    )}

                    {/* Post Images/Videos */}
                    {images.length > 0 && (
                      <View style={styles.sharedPostImageContainer}>
                        {hasVideo ? (
                          <View style={styles.postVideoWrapper}>
                            <Video
                              source={{ uri: images[0].url || images[0] }}
                              style={styles.sharedPostImageFull}
                              resizeMode="cover"
                              paused={true}
                              muted={true}
                              controls={false}
                              poster={images[0].thumbnail}
                              posterResizeMode="cover"
                            />
                            <View style={styles.postVideoPlayButton}>
                              <Icon name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
                            </View>
                          </View>
                        ) : (
                          <>
                            {images.slice(0, 2).map((image, idx) => (
                              <Image
                                key={idx}
                                source={{ uri: image.url || image }}
                                style={[styles.sharedPostImage, images.length === 1 && styles.sharedPostImageFull]}
                                resizeMode="cover"
                              />
                            ))}
                            {images.length > 2 && (
                              <View style={styles.sharedPostImageOverlay}>
                                <Text style={styles.sharedPostImageCount}>+{images.length - 2}</Text>
                              </View>
                            )}
                          </>
                        )}
                      </View>
                    )}

                    {/* Engagement Stats */}
                    {/* <View style={styles.sharedPostStats}>
                          <Text style={styles.sharedPostStatText}>❤️ {postData.likes || 0} likes</Text>
                          <Text style={styles.sharedPostStatText}>💬 {postData.comments || 0}</Text>
                        </View> */}
                  </TouchableOpacity>
                );
              })()
            )}

            {(item.type === 'reel_share' || item.type === 'reel') && (
              (() => {
                const reelData = item.reel || item.rawData?.reel || item.rawData?.post || {};

                // Extract proper data with fallbacks
                const reelId = reelData.id || item.rawData?.id || item.id;
                const reelVideo = reelData.video || reelData.images?.[0] || item.uri;
                const reelThumbnail = reelData.thumbnail || reelData.video || reelData.images?.[0];
                const reelUserData = reelData.user || {};
                const reelUser = reelData.userName || (typeof reelUserData === 'string' ? reelUserData : (reelUserData?.displayName || reelUserData?.name || item.senderInfo?.displayName));
                const reelAvatar = reelData.userImage || reelUserData?.image || item.senderInfo?.image;
                const reelCaption = reelData.caption || item.content || '';
                const reelLikes = reelData.likes || 0;
                const reelViews = reelData.views || '0';
                const reelComments = reelData.comments || 0;

                console.log('Reel rendering data:', {
                  reelId,
                  reelVideo,
                  reelThumbnail,
                  reelUser,
                  reelAvatar,
                  reelCaption,
                  reelLikes,
                  reelViews,
                  reelComments
                });

                const reelExists = reelId && (reelVideo || reelThumbnail);

                if (!reelExists) {
                  return (
                    <View style={[styles.sharedPostContainer, isUser && styles.userSharedPost, styles.deletedContent]}>
                      <Text style={styles.deletedContentText}>❌ This reel is no longer available</Text>
                    </View>
                  );
                }

                return (
                  <TouchableOpacity
                    style={[
                      styles.instagramReelCard,
                      isUser && styles.userSharedPost,
                      item.isTemp && styles.tempMessage
                    ]}
                    onPress={() => {
                      if (reelId) {
                        // Navigate to FlipsScreen (Reels screen) with the reel data
                        navigation.navigate('ProfileMain', {
                          screen: 'FlipsScreen',
                          params: {
                            item: reelData,
                            reelId: reelId,
                            initialIndex: 0,
                            userChat: true, // Add this flag to indicate coming from UserChat
                          }
                        });
                      } else {
                        Alert.alert('Error', 'Reel not found');
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    {/* User Header */}
                    <View style={styles.reelCardHeader}>
                      <Image
                        source={getAvatarSource(reelAvatar)}
                        style={styles.reelCardAvatar}
                      />
                      <View style={styles.reelCardUserInfo}>
                        <Text style={styles.reelCardUsername} numberOfLines={1}>
                          {reelUser || 'Unknown User'}
                        </Text>
                        <Text style={styles.reelCardLabel}>Reel</Text>
                      </View>
                    </View>

                    {/* Reel Video Thumbnail */}
                    <View style={styles.reelCardVideoContainer}>
                      <Video
                        source={{ uri: reelVideo || reelThumbnail }}
                        style={styles.reelCardVideo}
                        resizeMode="cover"
                        paused={true}
                        muted={true}
                        controls={false}
                        poster={reelThumbnail}
                        posterResizeMode="cover"
                      />
                      {/* Play Button Overlay */}
                      <View style={styles.reelCardPlayOverlay}>
                        <View style={styles.reelCardPlayButton}>
                          <Icon name="play" size={20} color="#fff" />
                        </View>
                      </View>
                      {/* Reel Icon Badge */}
                      <View style={styles.reelCardBadge}>
                        <Icon name="play-circle" size={16} color="#fff" />
                      </View>
                    </View>

                    {/* Caption */}
                    {reelCaption && reelCaption.trim() !== '' && (
                      <Text style={styles.reelCardCaption} numberOfLines={2}>
                        {reelCaption}
                      </Text>
                    )}

                    {/* Sending indicator for temp messages */}
                    {item.isTemp && (
                      <View style={styles.reelSendingOverlay}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.reelSendingText}>Sending...</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })()
            )}
            {(item.type === 'story_share' || item.type === 'story') && (
              (() => {
                // Enhanced story data extraction with better fallbacks
                const storyData = item.story || item.rawData?.story || item.rawData || {};
                console.log('📖 Story data for rendering:', storyData);

                // Get the image/video URI with multiple fallback options
                const mediaUri = storyData.uri ||
                  storyData.thumbnail ||
                  storyData.media?.[0] ||
                  storyData.media?.[0]?.url ||
                  storyData.images?.[0]?.url ||
                  storyData.images?.[0] ||
                  storyData.image ||
                  item.rawData?.uri;

                // Extract user information with proper fallbacks
                const storyUserData = storyData.user || {};
                const storyUser = {
                  displayName: storyData.userName ||
                    (typeof storyUserData === 'string' ? storyUserData :
                      (storyUserData?.displayName || storyUserData?.name ||
                        item.senderInfo?.displayName || 'Unknown User')),
                  image: storyData.userImage || storyUserData?.image ||
                    item.senderInfo?.image || ''
                };

                const caption = storyData.caption || storyData.text || item.content || '';
                const views = storyData.views?.length || storyData.viewCount || 0;
                const mediaType = storyData.type || (isVideoUrl(mediaUri) ? 'video' : 'image');
                const storyExists = storyData && (storyData.id || mediaUri);

                if (!storyExists) {
                  return (
                    <View style={[styles.sharedPostContainer, isUser && styles.userSharedPost, styles.deletedContent]}>
                      <Text style={styles.deletedContentText}>❌ This story is no longer available</Text>
                    </View>
                  );
                }

                return (
                  <TouchableOpacity
                    style={[styles.sharedPostContainer, isUser && styles.userSharedPost]}
                    onPress={() => {
                      // ✅ UPDATED: Open story viewer modal
                      if (storyExists && mediaUri) {
                        setSelectedStory({
                          ...storyData,
                          uri: mediaUri,
                          type: mediaType,
                          userName: storyUser.displayName,
                          userImage: storyUser.image,
                          caption: caption,
                        });
                        setStoryViewerVisible(true);
                      } else {
                        Alert.alert('Story Unavailable', 'This story is no longer available or has expired');
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    {/* User Header */}
                    <View style={styles.sharedPostHeader}>
                      <View style={styles.sharedPostUserInfo}>
                        <Image
                          source={getAvatarSource(storyUser.image)}
                          style={styles.sharedPostAvatar}
                        />
                        <View>
                          <Text style={styles.sharedPostUserName}>
                            {storyUser.displayName}
                          </Text>
                          <Text style={styles.sharedPostTimeText}>Story</Text>
                        </View>
                      </View>
                    </View>

                    {/* Caption (if exists) */}
                    {caption && caption.trim() !== '' && (
                      <Text
                        style={[styles.sharedPostText, isUser && styles.userSharedPostText]}
                        numberOfLines={2}
                      >
                        {caption}
                      </Text>
                    )}

                    {/* Story Media Preview */}
                    {mediaUri && (
                      <View style={styles.storyMediaContainer}>
                        {mediaType === 'video' ? (
                          <Video
                            source={{ uri: mediaUri }}
                            style={styles.storyMediaImage}
                            resizeMode="cover"
                            paused={true}
                            muted={true}
                            controls={false}
                            posterResizeMode="cover"
                          />
                        ) : (
                          <Image
                            source={{ uri: mediaUri }}
                            style={styles.storyMediaImage}
                            resizeMode="cover"
                          />
                        )}

                        {/* Story Type Badge */}
                        <View style={styles.storyBadge}>
                          <Text style={styles.storyBadgeText}>
                            {mediaType === 'video' ? '🎬' : '📷'} Story
                          </Text>
                        </View>

                        {/* Video Play Icon for video stories */}
                        {mediaType === 'video' && (
                          <View style={styles.storyPlayButton}>
                            <Text style={styles.storyPlayIcon}>▶</Text>
                          </View>
                        )}

                        {/* Tap to view overlay */}
                        <View style={styles.storyTapOverlay}>
                          <Text style={styles.storyTapText}>Tap to view</Text>
                        </View>
                      </View>
                    )}

                    {/* No Media Fallback */}
                    {!mediaUri && (
                      <View style={styles.storyNoMediaContainer}>
                        <Text style={styles.storyNoMediaIcon}>📖</Text>
                        <Text style={styles.storyNoMediaText}>Story content</Text>
                      </View>
                    )}

                    {/* Stats */}
                    <View style={styles.sharedPostStats}>
                      <Text style={styles.sharedPostStatText}>👁️ {views} views</Text>
                      {storyData.duration && (
                        <Text style={styles.sharedPostStatText}>
                          ⏱️ {Math.round(storyData.duration / 1000)}s
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })()
            )}

            {/* Show status for user messages (applies to posts/reels/stories too) */}
            {isUser && !item.isTemp && isLastMessage && (
              <View style={styles.messageStatus}>
                <SafeIcon
                  name="checkmark-done"
                  size={16}
                  color={item.isSeen ? '#3b82f6' : '#9ca3af'}
                  style={styles.seenIcon}
                />
                <Text style={styles.statusText}>
                  {item.isSeen ? 'Seen' : 'Sent'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (!isTyping) return null;

    return (
      <Animated.View style={[styles.typingContainer, { opacity: typingAnim }]}>
        <View style={styles.typingBubble}>
          <View style={styles.typingDots}>
            <View style={[styles.dot, styles.dot1]} />
            <View style={[styles.dot, styles.dot2]} />
            <View style={[styles.dot, styles.dot3]} />
          </View>
        </View>
      </Animated.View>
    );
  };

  const AttachmentModal = () => (
    <RBSheet
      ref={sheetRef}
      height={450}
      openDuration={300}
      closeDuration={200}
      draggable={true}
      closeOnPressMask={true}
      customStyles={{
        container: {
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          backgroundColor: '#ffffff',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 20,
          elevation: 20,
        },
        draggableIcon: {
          backgroundColor: '#e0e0e0',
          width: 40,
          height: 4,
          borderRadius: 2,
        },
      }}
      onRequestClose={() => sheetRef.current?.close()}
    >
      <View style={styles.attachmentModal}>
        <Text style={styles.attachmentTitle}>Share something</Text>

        <View style={styles.attachmentOptions}>
          <TouchableOpacity
            style={[styles.attachmentOption, bgStyle]}
            onPress={() => handleAttachment('camera')}
          >
            <LinearGradient colors={['#ff6b6b', '#ee5a52']} style={styles.optionIconContainer}>
              <Text style={styles.optionIcon}>📷</Text>
            </LinearGradient>
            <View style={styles.optionContent}>
              <Text style={styles.optionText}>Camera</Text>
              <Text style={styles.optionSubtext}>Take a photo</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.attachmentOption, bgStyle]}
            onPress={() => handleAttachment('gallery')}
          >
            <LinearGradient colors={['#a8edea', '#fed6e3']} style={styles.optionIconContainer}>
              <Text style={styles.optionIcon}>🖼️</Text>
            </LinearGradient>
            <View style={styles.optionContent}>
              <Text style={styles.optionText}>Photo & Video</Text>
              <Text style={styles.optionSubtext}>From gallery</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.attachmentOption, bgStyle]}
            onPress={() => handleAttachment('document')}
          >
            <LinearGradient colors={[text, text]} style={styles.optionIconContainer}>
              <Text style={styles.optionIcon}>📄</Text>
            </LinearGradient>
            <View style={styles.optionContent}>
              <Text style={styles.optionText}>Document</Text>
              <Text style={styles.optionSubtext}>PDF, DOC, TXT files</Text>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => sheetRef.current?.close()}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </RBSheet>
  );

  const handleNavigateToProfile = () => {
    if (!targetUserId) {
      Alert.alert('Error', 'User information is not available');
      return;
    }
    navigation.navigate('UsersProfile', {
      userId: targetUserId,
      user: user
    });
  };

  // Temporary: log generic socket events for testing
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const logEvent = (eventName) => (data) => {
      console.log(`[UserChat] Socket event: ${eventName}`, data);
    };
    socket.on('connect', logEvent('connect'));
    socket.on('disconnect', logEvent('disconnect'));
    socket.on('connect_error', logEvent('connect_error'));
    socket.on('reconnect', logEvent('reconnect'));
    socket.on('reconnect_error', logEvent('reconnect_error'));
    return () => {
      socket.off('connect', logEvent('connect'));
      socket.off('disconnect', logEvent('disconnect'));
      socket.off('connect_error', logEvent('connect_error'));
      socket.off('reconnect', logEvent('reconnect'));
      socket.off('reconnect_error', logEvent('reconnect_error'));
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Stop typing on unmount
      const socket = getSocket();
      if (socket?.connected && targetUserId) {
        emitStopTyping(targetUserId);
      }
    };
  }, [targetUserId]);

  if (!targetUserId) {
    return (
      <SafeAreaView style={[styles.safeArea, bgStyle]}>
        <View style={[styles.loadingContainer, bgStyle]}>
          <Text style={[styles.loadingText, textStyle]}>Invalid chat session</Text>
          <TouchableOpacity
            style={[styles.backButton, { shadowColor: text }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.backButtonText, textStyle]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <StatusBar backgroundColor={bg} barStyle="dark-content" />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* <TouchableWithoutFeedback onPress={Keyboard.dismiss}> */}
        <View style={[styles.container, bgStyle]}>
          <Animated.View style={[styles.mainContainer, { opacity: fadeAnim }, bgStyle]}>
            {/* Header */}
            <View style={[styles.headerGradient, bgStyle]}>
              <View style={styles.headerContent}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                  <SafeIcon name="arrow-back" size={24} color={text} />
                </TouchableOpacity>

                <View style={styles.logoContainer}>
                  <View style={styles.logoBackground}>
                    <LogoIcon height={80} width={80} />
                  </View>
                </View>
              </View>
            </View>

            {/* Card wrapper with proper flex */}
            <View style={[
              styles.formWrapper,
              isKeyboardVisible && { flex: 1, marginTop: -30 }
            ]}>
              <View style={[
                styles.card,
                isKeyboardVisible && {
                  minHeight: SCREEN_HEIGHT - keyboardHeight - 150,
                  maxHeight: SCREEN_HEIGHT - keyboardHeight - 150
                }
              ]}>
                {/* Header row inside card */}
                <View style={styles.chatHeaderRow}>
                  <TouchableOpacity
                    onPress={handleNavigateToProfile}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.profileImage}
                  >
                    <HexAvatar
                      uri={user?.image}
                      size={32}
                      borderWidth={2}
                      borderColor={text}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={handleNavigateToProfile}
                  >
                    <Text style={styles.chatName}>
                      {user?.displayName || user?.username || 'User'}
                    </Text>
                    <Text style={styles.chatStatus}>
                      {isTyping ? 'Typing…' : 'Active now'}
                    </Text>
                  </TouchableOpacity>
                  {/* Socket Status Indicator */}
                  {/* {socketReady ? (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981', marginLeft: 8 }} />
                    ) : (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', marginLeft: 8 }} />
                    )} */}
                </View>

                {/* Messages Container with proper flex */}
                <View style={styles.messagesContainer}>
                  <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={item => item.id}
                    renderItem={renderMessage}
                    contentContainerStyle={[
                      styles.messagesList,
                      {
                        flexGrow: 1,
                        paddingBottom: 10
                      }
                    ]}
                    showsVerticalScrollIndicator={false}
                    // onContentSizeChange={handleContentSizeChange}
                    onScroll={handleScroll}
                    scrollEnabled={true}
                    scrollEventThrottle={16}
                    keyboardShouldPersistTaps="handled"
                    ListFooterComponent={renderTypingIndicator}
                    ListEmptyComponent={() => (
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>Start a conversation</Text>
                      </View>
                    )}

                  />
                </View>

                {/* Input Area - Fixed to bottom */}
                <Animated.View
                  style={[
                    styles.inputContainer,
                    {
                      transform: [
                        {
                          translateY: inputAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [50, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={styles.inputWrapper}>
                    {/* <TouchableOpacity
                          style={styles.attachButton}
                          onPress={() => {
                            Keyboard.dismiss();
                            setTimeout(() => sheetRef.current?.open(), 100);
                          }}
                        >
                          <LinearGradient colors={[text, text]} style={styles.attachButtonGradient}>
                            <Text style={styles.attachIcon}>+</Text>
                          </LinearGradient>
                        </TouchableOpacity> */}

                    {/* Inline small shared preview inside the input */}
                    {sharedItem && (
                      <View style={styles.shareInline}>
                        {(sharedItem.type === 'post') && (
                          <Image
                            source={{ uri: sharedItem.post?.media?.[0]?.url || sharedItem.post?.images?.[0]?.url || sharedItem.post?.image }}
                            style={styles.shareInlineImage}
                            resizeMode="cover"
                          />
                        )}

                        {(sharedItem.type === 'reel') && (
                          <View style={styles.shareInlineImageWrap}>
                            <Image
                              source={{ uri: sharedItem.reel?.media?.[0]?.url || sharedItem.reel?.thumbnail || sharedItem.reel?.image }}
                              style={styles.shareInlineImage}
                              resizeMode="cover"
                            />
                            <View style={styles.shareInlinePlay}>
                              <Text style={styles.shareInlinePlayIcon}>▶</Text>
                            </View>
                          </View>
                        )}
                        {(sharedItem.type === 'story') && (
                          <View style={styles.shareInlineImageWrap}>
                            <Image
                              source={{ uri: sharedItem.story?.uri || sharedItem.story?.media?.[0]?.url || sharedItem.story?.thumbnail || sharedItem.story?.image }}
                              style={styles.shareInlineImage}
                              resizeMode="cover"
                            />
                          </View>
                        )}
                        <TouchableOpacity onPress={() => setSharedItem(null)} style={styles.shareInlineRemove}>
                          <Text style={styles.shareRemoveText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <TextInput
                      style={styles.textInput}
                      value={inputText}
                      onChangeText={(text) => {
                        setInputText(text);
                        handleTyping();
                      }}
                      placeholder={
                        sharedItem
                          ? sharedItem.type === 'post'
                            ? 'Add a message to your post...'
                            : sharedItem.type === 'reel'
                              ? 'Add a message to your reel...'
                              : sharedItem.type === 'story'
                                ? 'Add a message to your story...'
                                : 'Type a message...'
                          : 'Type a message...'
                      }
                      placeholderTextColor="#9ca3af"
                      multiline
                      textAlignVertical="top"
                      maxLength={2000}
                      editable={!isSending}
                      onFocus={() => {
                        setTimeout(() => {
                          flatListRef.current?.scrollToEnd({ animated: true });
                        }, 300);
                      }}
                    />
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      ((!inputText.trim() && !sharedItem) || isSending) && styles.disabledSendButton
                    ]}
                    onPress={sendMessage}
                    disabled={(!inputText.trim() && !sharedItem) || isSending}
                  >
                    <LinearGradient
                      colors={
                        ((inputText.trim() || sharedItem) && !isSending)
                          ? [text, text]
                          : ['#d1d5db', '#9ca3af']
                      }
                      style={styles.sendButtonGradient}
                    >
                      <Text style={styles.sendIcon}>
                        {isSending ? '⏳' : '➤'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </View>

            {/* <AttachmentModal /> */}

            <ImageViewing
              images={currentImages}
              imageIndex={currentIndex}
              visible={isViewerVisible}
              onRequestClose={() => setViewerVisible(false)}
            />

            <Modal visible={videoModalVisible} transparent>
              <View style={styles.videoModal}>
                <TouchableOpacity style={styles.videoCloseButton} onPress={() => setVideoModalVisible(false)}>
                  <Text style={styles.videoCloseIcon}>✕</Text>
                </TouchableOpacity>
                <Video source={{ uri: currentVideo }} style={styles.videoPlayer} controls resizeMode="contain" />
              </View>
            </Modal>
          </Animated.View>
        </View>
        {/* </TouchableWithoutFeedback> */}
      </KeyboardAvoidingView>
      <StoryViewerModal
        visible={storyViewerVisible}
        story={selectedStory}
        onClose={() => {
          setStoryViewerVisible(false);
          setSelectedStory(null);
        }}
        userName={selectedStory?.userName}
        userImage={selectedStory?.userImage}
      />
    </SafeAreaView>

  );
};

export default UserChat;

// Complete styles
const createStyles = () => ({
  safeArea: {
    flex: 1
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  /* Header */
  headerGradient: {
    height: SCREEN_HEIGHT * 0.20,
    position: 'relative',
    overflow: 'hidden',
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  logoContainer: {
    marginBottom: 40,
    alignItems: 'center',
    zIndex: 2,
  },
  logoBackground: {
    borderRadius: 35,
    padding: 12,
  },

  /* Card wrapper */
  formWrapper: {
    flex: 1,
    marginTop: -30,
    paddingHorizontal: 7,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 10,
    flex: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },

  /* Chat header */
  chatHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ebe7e5ff',
  },
  profileImage: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  profileInitial: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  chatName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  chatStatus: {
    fontSize: 12,
    color: '#6B7280',
  },

  /* Messages Container */
  messagesContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  messagesList: {
    paddingHorizontal: 8,
    paddingVertical: 10,
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
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 2,
    width: '100%',
  },
  userMessageRow: {
    justifyContent: 'flex-end',
    paddingLeft: 60,
  },
  botMessageRow: {
    justifyContent: 'flex-start',
    paddingRight: 60,
  },
  botAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  messageContent: {
    flexShrink: 1,
    maxWidth: '80%',
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
    minWidth: 50,
  },
  userBubble: {
    borderBottomRightRadius: 6,
  },
  botBubble: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderBottomLeftRadius: 6,
  },
  tempMessage: {
    opacity: 0.7,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    flexWrap: 'wrap',
  },
  messageLinkText: {
    color: '#BFDBFE',
    textDecorationLine: 'underline',
  },
  userMessageText: {
    color: '#ffffff',
  },
  botMessageText: {
    color: '#ffffff',
  },
  messageStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  seenIcon: {
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  sendingText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
  },

  /* Input Area */
  inputContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 4,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 0.5,
    borderTopColor: '#E5E7EB',
    position: 'relative',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
    minHeight: 48,
    maxHeight: 120,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    paddingVertical: 10,
    paddingHorizontal: 8,
    textAlignVertical: 'top',
    maxHeight: 100,
  },
  attachButton: {
    padding: 6,
    marginRight: 4,
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  attachButtonGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachIcon: {
    fontSize: 18,
    color: '#ffffff',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
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
  disabledSendButton: {
    opacity: 0.6,
  },

  // Image message styles
  imageMessage: {
    borderRadius: 18,
    overflow: 'hidden',
    marginVertical: 4,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  singleImageContainer: {
    width: 250,
    height: 250,
    margin: 1,
  },
  singleImage: {
    width: '100%',
    height: '100%',
  },
  gridImage: {
    margin: 1,
  },
  /* Inline share inside input */
  shareInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    height: 100,
    width: 100,
  },
  shareInlineImageWrap: {
    position: 'relative',
  },
  shareInlineImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  shareInlinePlay: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareInlinePlayIcon: {
    color: '#fff',
    fontSize: 12,
  },
  shareInlineRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    padding: 4,
    zIndex: 1,
    backgroundColor: '#000',
    borderRadius: 12,
  },
  shareRemoveText: {
    fontSize: 14,
    color: '#fff',
  },

  /* Shared item inside message bubble */
  messageSharedContainer: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1346acff',
    backgroundColor: '#fff',
    paddingHorizontal: 40,
    paddingVertical: 20,
  },
  messageSharedImage: {
    width: '100%',
    height: 120,
  },
  messageSharedText: {
    padding: 8,
    fontSize: 13,
    color: '#374151',
  },

  // Image message styles
  imageMessage: {
    borderRadius: 18,
    overflow: 'hidden',
    marginVertical: 4,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  singleImageContainer: {
    width: 250,
    height: 250,
    margin: 1,
  },
  singleImage: {
    width: '100%',
    height: '100%',
  },
  gridImage: {
    margin: 1,
  },
  twoImagesImage: {
    width: 124,
    height: 248,
  },
  threeImagesMain: {
    width: 248,
    height: 124,
  },
  threeImagesSide: {
    width: 124,
    height: 124,
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },

  // Video message styles
  videoMessage: {
    width: 250,
    height: 200,
    borderRadius: 18,
    overflow: 'hidden',
    marginVertical: 4,
    position: 'relative',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 2,
  },

  // File message styles
  fileMessage: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    maxWidth: 280,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileIconText: {
    fontSize: 18,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: '#6B7280',
  },

  // Attachment modal styles
  attachmentModal: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: 20,
  },
  attachmentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#262626',
    textAlign: 'center',
    marginBottom: 24,
  },
  attachmentOptions: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  attachmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionIcon: {
    fontSize: 24,
  },
  optionContent: {
    flex: 1,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#262626',
  },
  optionSubtext: {
    fontSize: 13,
    color: '#8e8e8e',
    marginTop: 2,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    marginTop: 8,
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8e8e8e',
  },

  // Typing indicator styles
  typingContainer: {
    alignSelf: 'flex-start',
    marginTop: 10,
    marginLeft: 40,
  },
  typingBubble: {
    backgroundColor: '#E5E7EB',
    borderRadius: 15,
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 2,
    backgroundColor: '#6B7280',
  },
  dot1: {
    backgroundColor: '#6B7280',
  },
  dot2: {
    backgroundColor: '#6B7280',
  },
  dot3: {
    backgroundColor: '#6B7280',
  },

  // Video modal styles
  videoModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    padding: 10,
  },
  videoCloseIcon: {
    color: '#ffffff',
    fontSize: 18,
  },
  videoPlayer: {
    width: SCREEN_WIDTH * 0.85,
    height: SCREEN_HEIGHT * 0.42,
  },

  // Shared post/reel message styles
  sharedPostContainer: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    marginVertical: 4,
    overflow: 'hidden',
    maxWidth: 280,
  },
  userSharedPost: {
    backgroundColor: '#E8F4F8',
    borderColor: '#B3D9E8',
  },
  deletedContent: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  deletedContentText: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  sharedPostHeader: {
    paddingHorizontal: 12,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sharedPostUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sharedPostAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  sharedPostUserName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  sharedPostTime: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  sharedPostText: {
    fontSize: 14,
    color: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 8,
    lineHeight: 20,
  },
  userSharedPostText: {
    color: '#1F2937',
  },
  sharedPostCaption: {
    fontSize: 12,
    color: '#6B7280',
    paddingHorizontal: 12,
    paddingBottom: 8,
    fontStyle: 'italic',
  },
  sharedPostImageContainer: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sharedPostImage: {
    width: '48%',
    height: 120,
    borderRadius: 10,
    margin: '1%',
  },
  sharedPostImageFull: {
    width: '98%',
    height: 150,
  },
  sharedPostImageOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sharedPostImageCount: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  postVideoWrapper: {
    position: 'relative',
    width: '98%',
    margin: '1%',
  },
  postVideoPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -24 }, { translateY: -24 }],
  },
  sharedPostStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#E5E7EB',
  },
  sharedPostStatText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },

  // Instagram-style Reel Card
  instagramReelCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    marginVertical: 4,
    overflow: 'hidden',
    maxWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reelCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FAFAFA',
  },
  reelCardAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  reelCardUserInfo: {
    flex: 1,
  },
  reelCardUsername: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  reelCardLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  reelCardVideoContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 9 / 16,
    backgroundColor: '#000',
    maxHeight: 350,
  },
  reelCardVideo: {
    width: '100%',
    height: '100%',
  },
  reelCardPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  reelCardPlayButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  reelCardBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  reelCardCaption: {
    fontSize: 13,
    color: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 8,
    lineHeight: 18,
  },
  reelCardStats: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#E5E7EB',
    gap: 16,
  },
  reelCardStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reelCardStatText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  reelSendingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    gap: 8,
  },
  reelSendingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Old reel styles (keep for backward compatibility)
  reelThumbnailContainer: {
    position: 'relative',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  reelThumbnail: {
    width: '100%',
    height: 140,
    borderRadius: 12,
  },
  reelPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -16 }, { translateY: -16 }],
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelPlayIcon: {
    color: '#ffffff',
    fontSize: 14,
    marginLeft: 1,
  },

  // Story specific styles (add to createStyles return object)
  storyMediaContainer: {
    position: 'relative',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  storyMediaImage: {
    width: '200',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  storyBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  storyBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  storyPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyPlayIcon: {
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 2,
  },
  storyNoMediaContainer: {
    paddingHorizontal: 16,
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    marginHorizontal: 8,
    marginVertical: 8,
    borderRadius: 12,
  },
  storyNoMediaIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  storyNoMediaText: {
    fontSize: 13,
    color: '#6B7280',
  },
  sharedPostTimeText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },

  // Media sending overlay
  mediaSendingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    zIndex: 10,
    gap: 8,
  },
  mediaSendingText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  storyTapOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  storyTapText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});
