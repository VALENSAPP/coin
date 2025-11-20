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
  const { userId: targetUserId, user } = routeParams;

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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  const sheetRef = useRef(null);
  const styles = createStyles();
  const flatListRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputAnim = useRef(new Animated.Value(0)).current;
  const typingAnim = useRef(new Animated.Value(0)).current;
  const { bgStyle, textStyle, bg, text } = useAppTheme();

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
      }
    };

    if (targetUserId) {
      initializeChat();
    }
  }, [targetUserId]);

  // Fetch conversation messages
  const fetchConversation = async (senderId, receiverId) => {
    try {
      console.log('Fetching conversation between:', { senderId, receiverId });
      
      const response = await getConversationById(receiverId);
      
      console.log('API Response:', response)
      
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
            content: msg.content?.substring(0, 50)
          });
          
          return isBetweenUsers;
        });
        
        console.log('Filtered conversation messages:', conversationMessages);
        
        const formattedMessages = conversationMessages.map(msg => ({
          id: msg.id?.toString() || `msg_${Date.now()}_${Math.random()}`,
          type: 'text', // You can extend this based on message content type
          sender: msg.sender?.id === senderId ? 'user' : 'peer',
          content: msg.content || '',
          timestamp: new Date(msg.createdAt || Date.now()),
          senderInfo: msg.sender || {},
          receiverInfo: msg.receiver || {},
        }));
        
        // Sort messages by timestamp (oldest first)
        formattedMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        console.log('Final formatted messages:', formattedMessages);
        setMessages(formattedMessages);
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
    if (inputText.trim() === '' || isSending || !currentUserId || !targetUserId) return;

    const messageContent = inputText.trim();
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    
    // Create temporary message for immediate UI update
    const tempMessage = {
      id: tempId,
      type: 'text',
      sender: 'user',
      content: messageContent,
      timestamp: new Date(),
      isTemp: true, // Flag to identify temporary message
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
                    {backgroundColor: text}
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

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, bgStyle]}>
        <View style={[styles.loadingContainer, bgStyle]}>
          <Text style={[styles.loadingText, textStyle]}>Loading chat...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!targetUserId) {
    return (
      <SafeAreaView style={[styles.safeArea, bgStyle]}>
        <View style={[styles.loadingContainer, bgStyle]}>
          <Text style={[styles.loadingText, textStyle]}>Invalid chat session</Text>
          <TouchableOpacity 
            style={[styles.backButton, {shadowColor: text}]} 
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
                    <View style={[styles.profileImage, {backgroundColor: text}]}> 
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

                      <TextInput
                        style={styles.textInput}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Type a message..."
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
                        (!inputText.trim() || isSending) && styles.disabledSendButton
                      ]}
                      onPress={sendMessage}
                      disabled={!inputText.trim() || isSending}
                    >
                      <LinearGradient
                        colors={
                          (inputText.trim() && !isSending) 
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
    padding: 16,
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
    borderBottomColor: '#E5E7EB',
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
    backgroundColor: '#E5E7EB',
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
    color: '#1F2937',
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
    alignItems: 'flex-end',
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
});