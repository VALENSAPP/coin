import React, { useState, useRef, useEffect } from 'react';
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

const UserChat = ({ route, navigation }) => {
  // Safe destructuring with fallbacks
  const routeParams = route?.params || {};
  const { userId: targetUserId, user, post, postId, reel, reelId,story } = routeParams;
  console.log(story,'whata is geet we herere in chat screeennenenneneneneneen')

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isViewerVisible, setViewerVisible] = useState(false);
  const [currentImages, setCurrentImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  // Shared item coming from share modal (post / reel)
  const initialShared = post
    ? { type: 'post', post: post, postId: postId || post?.id }
    : reel
    ? { type: 'reel', reel: reel, reelId: reelId || reel?.id }
    : story
    ? { type: 'story', story: story, storyId: story?.id }
    : null;
  const [sharedItem, setSharedItem] = useState(initialShared);

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const sheetRef = useRef(null);
  const styles = createStyles();
  const flatListRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputAnim = useRef(new Animated.Value(0)).current;
  const typingAnim = useRef(new Animated.Value(0)).current;
  const { bgStyle, textStyle, bg, text } = useAppTheme();
  const dispatch=useDispatch();

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
    setIsLoading(true);
  }, [targetUserId, navigation]);

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


  
  // Helper to create dummy messages for UI checks (reel and post previews included)
  const createDummyMessages = (senderId, receiverId) => {
    const now = Date.now();
    const peer = user || { displayName: 'Peer User', image: 'https://via.placeholder.com/40' };
    const me = { id: senderId, displayName: 'You', image: 'https://via.placeholder.com/40' };

    return [
      {
        id: `dum_text_${now}_1`,
        type: 'text',
        sender: 'peer',
        content: 'Hey — wanted to share this reel with you!',
        timestamp: new Date(now - 1000 * 60 * 60 * 4),
        senderInfo: peer,
        receiverInfo: me,
      },
      {
        id: `dum_reel_${now}_2`,
        type: 'reel_share',
        sender: 'peer',
        reel: {
          id: 'r_12345',
          user: { displayName: peer.displayName || 'Peer User', image: peer.image },
          caption: 'Cool flip I made — check it out!',
          thumbnail: 'https://via.placeholder.com/300x200.png?text=Reel+Thumbnail',
          likes: 128,
          views: 2048,
        },
        timestamp: new Date(now - 1000 * 60 * 60 * 3),
        senderInfo: peer,
        receiverInfo: me,
      },
      {
        id: `dum_text_${now}_3`,
        type: 'text',
        sender: 'user',
        content: 'Nice! Also saw this post earlier.',
        timestamp: new Date(now - 1000 * 60 * 60 * 2),
        senderInfo: me,
        receiverInfo: peer,
      },
      {
        id: `dum_post_${now}_4`,
        type: 'post_share',
        sender: 'user',
        post: {
          id: 'p_98765',
          user: { displayName: 'Creator Name', image: 'https://via.placeholder.com/40' },
          text: 'A short post text showing how this will render in chat.',
          caption: 'Longer caption for the shared post to validate truncation behavior.',
          images: [
            { url: 'https://via.placeholder.com/400x300.png?text=Post+Image+1' },
            { url: 'https://via.placeholder.com/400x300.png?text=Post+Image+2' },
          ],
          likes: 76,
          comments: 12,
        },
        timestamp: new Date(now - 1000 * 60 * 30),
        senderInfo: me,
        receiverInfo: peer,
      },
      {
        id: `dum_image_${now}_5`,
        type: 'image',
        sender: 'peer',
        images: [{ uri: 'https://shorturl.at/b9IlB' }],
        timestamp: new Date(now - 1000 * 60 * 10),
        senderInfo: peer,
        receiverInfo: me,
      },
    ];
  };


  
  // Fetch conversation messages
  const fetchConversation = async (senderId, receiverId) => {
    try {
      console.log('Fetching conversation between:', { senderId, receiverId });

      const response = await getConversationById(receiverId);

      console.log('whata cnversation data get in chat', response)

      if (response.success) {
        // Filter messages to only show conversation between these two user
        const conversationMessages = response.data.filter(msg => {
          const isBetweenUsers = (
            (msg.sender?.id === senderId && msg.receiver?.id === receiverId) ||
            (msg.sender?.id === receiverId && msg.receiver?.id === senderId)
          );

          console.log('Message filter check:', {
            messageId: msg.id,
            senderId: msg.sender?.id,
            receiverId: msg.receiver?.id,
            isBetweenUsers,
            messageType: msg.type,
            content: msg.content?.substring(0, 50)
          });

          return isBetweenUsers;
        });

        console.log('Filtered conversation messages:', conversationMessages);

        const formattedMessages = conversationMessages.map(msg => {
          const isSender = msg.sender?.id === senderId;
          const messageType = msg.type || 'text';

          // Determine the message type based on API response
          let formattedMsg = {
            id: msg.id?.toString() || `msg_${Date.now()}_${Math.random()}`,
            type: messageType.toLowerCase(),
            sender: isSender ? 'user' : 'peer',
            timestamp: new Date(msg.createdAt || Date.now()),
            senderInfo: msg.sender || {},
            receiverInfo: msg.receiver || {},
            rawData: msg, // Keep raw data for complex types
          };

          // Handle different message types
          if (messageType === 'text') {
            formattedMsg.content = msg.content || '';
          } else if (messageType === 'image') {
            formattedMsg.images = msg.images || [];
          } else if (messageType === 'video' || messageType === 'reel') {
            formattedMsg.uri = msg.video || msg.content || '';
            formattedMsg.thumbnail = msg.thumbnail || '';
          } else if (messageType === 'document' || messageType === 'file') {
            formattedMsg.file = msg.file || {
              name: msg.fileName || 'document',
              uri: msg.fileUri || msg.content || '',
              size: msg.fileSize || 0,
            };
          } else if (messageType === 'post_share' || messageType === 'POST_SHARE') {
            // Handle post shares - display post content
            formattedMsg.type = 'post_share';
            formattedMsg.post = msg.post || {};
            formattedMsg.content = msg.content;
          } else if (messageType === 'reel_share' || messageType === 'REEL_SHARE') {
            // Handle reel shares
            formattedMsg.type = 'reel_share';
            formattedMsg.reel = msg.reel || msg.post || {};
            formattedMsg.content = msg.content;
          } else if (messageType === 'story_share' || messageType === 'STORY_SHARE') {
            // Handle story shares
            formattedMsg.type = 'story_share';
            formattedMsg.story = msg.story || {};
            formattedMsg.content = msg.content;
          } else {
            // Fallback to text
            formattedMsg.type = 'text';
            formattedMsg.content = msg.content || '';
          }

          return formattedMsg;
        });

        // Sort messages by timestamp (oldest first)
        formattedMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        console.log('Final formatted messages:', formattedMessages);
        // Always include dummy messages before the fetched conversation so
        // reel/post UI can be previewed while developing, and new messages appear below.
        const dummy = createDummyMessages(senderId, receiverId);
        // Avoid duplicating dummy messages if they somehow exist already
        const filteredDummy = dummy.filter(d => !formattedMessages.some(m => m.id === d.id));
        setMessages([...filteredDummy, ...(formattedMessages || [])]);
      }
    } catch (error) {
      console.error('Error fetching conversation:', error);
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

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Send message function with API integration
  const sendMessage = async () => {
    if ((inputText.trim() === '' && !sharedItem) || isSending || !currentUserId || !targetUserId) return;

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
    };

    setMessages(prev => [...prev, tempMessage]);
    setInputText('');
    setIsSending(true);
    scrollToBottom();

    try {
      const messageData = {
        senderId: currentUserId,
        receiverId: targetUserId,
        message: messageContent,
        // include shared content if present
        shareType: sharedItem?.type,
        shareData: sharedItem?.type === 'post'
          ? { postId: sharedItem.postId, post: sharedItem.post }
          : sharedItem?.type === 'reel'
            ? { reelId: sharedItem.reelId, reel: sharedItem.reel }
            : sharedItem?.type === 'story'
              ? { storyId: sharedItem.storyId, story: sharedItem.story }
              : undefined,
      };

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

        // Optionally refresh conversation to get latest messages
        await fetchConversation(currentUserId, targetUserId);
        // clear shared item after successful send
        setSharedItem(null);
      } else {
        // Remove temporary message on failure
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        Alert.alert('Error', response.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove temporary message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleAttachment = async type => {
    if (sheetRef.current?.close) {
      sheetRef.current.close();
    }

    try {
      if (type === 'camera' && ImagePicker) {
        const image = await ImagePicker.openCamera({
          mediaType: 'photo',
          quality: 0.8,
        });
        addImageMessage([{ uri: image.path }]);
      } else if (type === 'gallery' && ImagePicker) {
        const images = await ImagePicker.openPicker({
          multiple: true,
          mediaType: 'photo',
          quality: 0.8,
        });
        const imageUris = images.map(img => ({ uri: img.path }));
        addImageMessage(imageUris);
      } else if (type === 'video' && ImagePicker) {
        const video = await ImagePicker.openPicker({
          mediaType: 'video',
        });
        addVideoMessage(video.path);
      }
      else if (type === 'document') {
        const [file] = await pick({
          type: ['application/pdf', 'application/msword', 'text/plain'],
        });
        addFileMessage(file);
      }
      else {
        Alert.alert('Feature Unavailable', 'This feature is not available on your device');
      }
    } catch (error) {
      if (error?.message !== 'User cancelled image selection') {
        Alert.alert('Error', 'Failed to select file');
      }
    }
  };

  const addImageMessage = images => {
    const imageMessage = {
      id: `img_${Date.now()}_${Math.random()}`,
      type: 'image',
      sender: 'user',
      images: images,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, imageMessage]);
    scrollToBottom();
  };

  const addVideoMessage = videoUri => {
    const videoMessage = {
      id: `vid_${Date.now()}_${Math.random()}`,
      type: 'video',
      sender: 'user',
      uri: videoUri,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, videoMessage]);
    scrollToBottom();
  };

  const addFileMessage = file => {
    const fileMessage = {
      id: `file_${Date.now()}_${Math.random()}`,
      type: 'file',
      sender: 'user',
      file: file,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, fileMessage]);
    scrollToBottom();
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

  const renderMessage = ({ item, index }) => {
    const isUser = item.sender === 'user';
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
            <View style={styles.botAvatar}>
              <Image
                source={{
                  uri: item.senderInfo?.image || user?.image || 'https://via.placeholder.com/32'
                }}
                style={styles.avatarImage}
                defaultSource={{ uri: 'https://via.placeholder.com/32' }}
              />
            </View>
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
                  <Text
                    style={[
                      styles.messageText,
                      isUser ? styles.userMessageText : styles.botMessageText,
                    ]}
                  >
                    {item.content}
                  </Text>
                </View>

                {/* Show status only for user messages */}
                {isUser && !item.isTemp && (
                  <View style={styles.messageStatus}>
                    <Text style={styles.seenIndicator}>✓✓</Text>
                    <Text style={styles.statusText}>Sent</Text>
                  </View>
                )}

                {/* Show sending indicator for temp messages */}
                {item.isTemp && (
                  <View style={styles.messageStatus}>
                    <Text style={styles.sendingText}>Sending...</Text>
                  </View>
                )}
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
              <View style={styles.imageMessage}>{renderImageGrid(item.images)}</View>
            )}

            {item.type === 'video' && (
              <TouchableOpacity
                style={styles.videoMessage}
                onPress={() => {
                  setCurrentVideo(item.uri);
                  setVideoModalVisible(true);
                }}
              >
                <Image source={{ uri: item.uri }} style={styles.videoThumbnail} resizeMode="cover" />
                <View style={styles.playButton}>
                  <LinearGradient colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.5)']} style={styles.playButtonGradient}>
                    <Text style={styles.playIcon}>▶</Text>
                  </LinearGradient>
                </View>
              </TouchableOpacity>
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
                const postData = item.post || item.rawData?.post || item.rawData || {
                  id: item.rawData?.id || item.id,
                  user: item.post?.user || item.senderInfo || {},
                  text: item.post?.text || item.content || '',
                  caption: item.post?.caption || item.content || '',
                  images: item.post?.images || item.rawData?.images || [],
                  likes: item.post?.likes || item.rawData?.likes || 0,
                  comments: item.post?.comments || item.rawData?.comments || 0,
                };

                const images = postData.images || [];

                return (
                  postData && (
                    <TouchableOpacity
                      style={[styles.sharedPostContainer, isUser && styles.userSharedPost]}
                    >
                      <View style={styles.sharedPostHeader}>
                        <View style={styles.sharedPostUserInfo}>
                          <Image
                            source={{ uri: postData.user?.image || 'https://via.placeholder.com/40' }}
                            style={styles.sharedPostAvatar}
                          />
                          <View>
                            <Text style={styles.sharedPostUserName}>
                              {postData.user?.displayName || postData.user?.name || 'Unknown User'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Post Text/Caption */}
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

                      {/* Post Images */}
                      {images.length > 0 && (
                        <View style={styles.sharedPostImageContainer}>
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
                        </View>
                      )}

                      {/* Engagement Stats */}
                      <View style={styles.sharedPostStats}>
                        <Text style={styles.sharedPostStatText}>❤️ {postData.likes || 0} likes</Text>
                        <Text style={styles.sharedPostStatText}>💬 {postData.comments || 0}</Text>
                      </View>
                    </TouchableOpacity>
                  )
                );
              })()
            )}

            {(item.type === 'reel_share' || item.type === 'reel') && (
              (() => {
                const reelData = item.reel || item.rawData?.reel || item.rawData?.post || {
                  id: item.rawData?.id || item.id,
                  user: item.reel?.user || item.senderInfo || {},
                  caption: item.reel?.caption || item.content || '',
                  thumbnail: item.reel?.thumbnail || item.thumbnail || item.rawData?.thumbnail || '',
                  likes: item.reel?.likes || item.rawData?.likes || 0,
                  views: item.reel?.views || item.rawData?.views || 0,
                };

                return (
                  reelData && (
                    <TouchableOpacity
                      style={[styles.sharedPostContainer, isUser && styles.userSharedPost]}
                    >
                      <View style={styles.sharedPostHeader}>
                        <View style={styles.sharedPostUserInfo}>
                          <Image
                            source={{
                              uri: reelData.user?.image || 'https://via.placeholder.com/40'
                            }}
                            style={styles.sharedPostAvatar}
                          />
                          <View>
                            <Text style={styles.sharedPostUserName}>
                              {reelData.user?.displayName || 'Unknown User'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Reel Caption */}
                      {reelData.caption && (
                        <Text
                          style={[styles.sharedPostText, isUser && styles.userSharedPostText]}
                          numberOfLines={2}
                        >
                          {reelData.caption}
                        </Text>
                      )}

                      {/* Reel Thumbnail */}
                      {reelData.thumbnail && (
                        <View style={styles.reelThumbnailContainer}>
                          <Image
                            source={{ uri: reelData.thumbnail }}
                            style={styles.reelThumbnail}
                            resizeMode="cover"
                          />
                          <View style={styles.reelPlayButton}>
                            <Text style={styles.reelPlayIcon}>▶</Text>
                          </View>
                        </View>
                      )}

                      {/* Reel Stats */}
                      <View style={styles.sharedPostStats}>
                        <Text style={styles.sharedPostStatText}>
                          ❤️ {reelData.likes || 0}
                        </Text>
                        <Text style={styles.sharedPostStatText}>
                          👁️ {reelData.views || 0}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )
                );
              })()
            )}
            {(item.type === 'story_share' || item.type === 'story') && (
              (() => {
                const storyData = item.story || item.rawData?.story || item.rawData || {
                  id: item.rawData?.id || item.id,
                  user: item.story?.user || item.senderInfo || {},
                  caption: item.story?.caption || item.content || '',
                  thumbnail: item.story?.thumbnail || item.story?.uri || item.rawData?.thumbnail || '',
                  views: item.story?.views || item.rawData?.views || 0,
                };

                return (
                  storyData && (
                    <TouchableOpacity style={[styles.sharedPostContainer, isUser && styles.userSharedPost]}>
                      <View style={styles.sharedPostHeader}>
                        <View style={styles.sharedPostUserInfo}>
                          <Image source={{ uri: storyData.user?.image || 'https://via.placeholder.com/40' }} style={styles.sharedPostAvatar} />
                          <View>
                            <Text style={styles.sharedPostUserName}>{storyData.user?.displayName || 'Unknown User'}</Text>
                          </View>
                        </View>
                      </View>

                      {storyData.caption && (
                        <Text style={[styles.sharedPostText, isUser && styles.userSharedPostText]} numberOfLines={2}>
                          {storyData.caption}
                        </Text>
                      )}

                      {storyData.thumbnail && (
                        <View style={styles.reelThumbnailContainer}>
                          <Image source={{ uri: storyData.thumbnail }} style={styles.reelThumbnail} resizeMode="cover" />
                        </View>
                      )}

                      <View style={styles.sharedPostStats}>
                        <Text style={styles.sharedPostStatText}>👁️ {storyData.views || 0}</Text>
                      </View>
                    </TouchableOpacity>
                  )
                );
              })()
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

  // Handle navigation to user profile safely
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

  // Note: Inline/local loading UI removed. Full-screen loader is handled
  // by dispatching `showLoader()` / `hideLoader()` via Redux (see
  // `initializeChat`). The component will render normally while the
  // global loader is visible.

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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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
                    <View style={[styles.profileImage, { backgroundColor: text }]}>
                      <View style={styles.profileGradient}>
                        {user?.image ? (
                          <Image
                            source={{ uri: user.image }}
                            style={styles.avatarImage}
                            defaultSource={{ uri: 'https://via.placeholder.com/32' }}
                          />
                        ) : (
                          <Text style={styles.profileInitial}>
                            {user?.displayName?.charAt(0)?.toUpperCase() ||
                              user?.username?.charAt(0)?.toUpperCase() || 'U'}
                          </Text>
                        )}
                      </View>
                    </View>
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
                      onContentSizeChange={scrollToBottom}
                      keyboardShouldPersistTaps="handled"
                      ListFooterComponent={renderTypingIndicator}
                      ListEmptyComponent={() => (
                        <View style={styles.emptyContainer}>
                          <Text style={styles.emptyText}>Start a conversation</Text>
                        </View>
                      )}
                      maintainVisibleContentPosition={{
                        minIndexForVisible: 0,
                        autoscrollToTopThreshold: 10,
                      }}
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
                      <TouchableOpacity
                        style={styles.attachButton}
                        onPress={() => {
                          Keyboard.dismiss();
                          setTimeout(() => sheetRef.current?.open(), 100);
                        }}
                      >
                        <LinearGradient colors={[text, text]} style={styles.attachButtonGradient}>
                          <Text style={styles.attachIcon}>+</Text>
                        </LinearGradient>
                      </TouchableOpacity>

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
                        onChangeText={setInputText}
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

              <AttachmentModal />

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
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default UserChat;

// Complete updated styles with all fixes
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

  /* Card wrapper - Fixed */
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
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
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

  /* Messages Container - Fixed */
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1157e4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    overflow: 'hidden',
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
  seenIndicator: {
    fontSize: 10,
    color: '#9CA3AF',
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

  /* Input Area - Fixed */
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
    // alignItems: 'flex-end',
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
  sharePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 8,
    marginHorizontal: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sharePreviewImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 8,
  },
  sharePreviewTextWrap: {
    flex: 1,
  },
  sharePreviewText: {
    fontSize: 13,
    color: '#374151',
  },
  shareRemoveButton: {
    marginLeft: 8,
    padding: 6,
  },
  shareRemoveText: {
    fontSize: 14,
    color: '#fff',
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
    height:100,
    width:100,
   
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
  zIndex: 1,          // keeps it above the preview
  // backgroundColor: 'rgba(0,0,0,0.3)', 
  backgroundColor:'#000',
  borderRadius: 12,
},

  /* Shared item inside message bubble */
  messageSharedContainer: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1346acff',
    backgroundColor: '#fff',
    // maxWidth: 220,
    paddingHorizontal:40,
    paddingVertical:20,
   

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

  // Reel specific styles
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
});
