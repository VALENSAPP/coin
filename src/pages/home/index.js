import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  AppState,
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  Modal,
  DeviceEventEmitter,
} from 'react-native';
import createStyles from './Style';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import Stories from '../../components/home/story.js/Stories';
import Posts from '../../components/home/posts/Posts';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { Chat, LogoIcon } from '../../assets/icons';
import { getposts } from '../../services/home';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../../components/displaytoastmessage';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { useDispatch, useSelector } from 'react-redux';
import TextGradient from '../../assets/textgradient/TextGradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProfile } from '../../services/createProfile';
import { setProfileImg } from '../../redux/actions/ProfileImgAction';
import { setUserProfile } from '../../redux/actions/UserProfileAction';
import { useAppTheme } from '../../theme/useApptheme';
import { unReadNotification, updateFcmToken } from '../../services/notifications';
import { getSocket, initializeSocket } from '../../services/socket';
import useSocket from '../../hooks/useSocket';
import { clampRGBA } from 'react-native-reanimated/lib/typescript/Colors';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SIDEBAR_WIDTH = 110;

export default function HomeScreen() {
  const styles = createStyles();
  const navigation = useNavigation();
  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [storyRefreshTick, setStoryRefreshTick] = useState(0);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [isBusinessProfile, setIsBusinessProfile] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socketReady, setSocketReady] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;

  // Track conversations to calculate unread properly
  const conversationsRef = useRef([]);

  const toast = useToast();
  const dispatch = useDispatch();
  const isFocused = useIsFocused();
  const { bgStyle, text } = useAppTheme();
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(null);


  const appState = useRef(AppState.currentState);

  // ✅ Get current user ID on mount and initialize socket
  useEffect(() => {
    const initializeUserAndSocket = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (userId) {
          setCurrentUserId(userId);
          console.log('📱 HomeScreen: Current user ID set:', userId);

          // Initialize socket with userId
          const socket = getSocket();
          if (!socket || !socket.connected) {
            console.log('🔌 HomeScreen: Initializing socket...');
            await initializeSocket(userId);
            setSocketReady(true);
          } else {
            console.log('🔌 HomeScreen: Socket already connected');
            setSocketReady(true);
          }
        }
      } catch (error) {
        console.error('❌ Error initializing user and socket:', error);
      }
    };

    initializeUserAndSocket();
  }, []);

  // ✅ Handle socket reconnection
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleConnect = () => {
      console.log('🔌 HomeScreen: Socket connected');
      setSocketReady(true);

      // Request chat box data on connection
      if (currentUserId) {
        console.log('📡 HomeScreen: Requesting chat box on connect');
        socket.emit('getUserChatBox', { userId: currentUserId });
      }
    };

    const handleDisconnect = () => {
      console.log('🔌 HomeScreen: Socket disconnected');
      setSocketReady(false);
    };

    const handleReconnect = () => {
      console.log('🔌 HomeScreen: Socket reconnected');
      setSocketReady(true);

      if (currentUserId) {
        console.log('📡 HomeScreen: Requesting chat box on reconnect');
        socket.emit('getUserChatBox', { userId: currentUserId });
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnect', handleReconnect);

    // Check if already connected
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect', handleReconnect);
    };
  }, [currentUserId]);

  // ✅ Request chat box data when screen is focused and socket is ready
  useEffect(() => {
    if (currentUserId && socketReady && isFocused) {
      const socket = getSocket();
      if (socket?.connected) {
        console.log('👁️ HomeScreen: Screen focused, requesting chat box');
        socket.emit('getUserChatBox', { userId: currentUserId });
      }
    }
  }, [currentUserId, socketReady, isFocused]);

  useFocusEffect(
    useCallback(() => {
      unreadNotification();   
    }, [])
  );

  // ✅ Listen for chat box updates (similar to userConversation in UserChat)
  useSocket('userChatBox', (data) => {
    console.log('📨 HomeScreen: Received userChatBox data');

    if (!data) {
      console.log('⚠️ HomeScreen: No data received');
      return;
    }

    let conversations = [];

    // Handle different data structures
    if (data.success && Array.isArray(data.data)) {
      conversations = data.data;
    } else if (Array.isArray(data)) {
      conversations = data;
    }

    console.log(`📊 HomeScreen: Processing ${conversations.length} conversations`);

    // Store conversations for reference
    conversationsRef.current = conversations;

    // Calculate total unread messages (excluding hidden conversations)
    const totalUnread = conversations.reduce((acc, conversation) => {
      // Skip hidden conversations
      if (conversation.isHidden === true) {
        return acc;
      }

      const unread = conversation.unreadCount || 0;
      return acc + unread;
    }, 0);

    console.log('📊 HomeScreen: Total unread messages:', totalUnread);
    setUnreadCount(totalUnread);
  }, [currentUserId]);

  // ✅ Listen for new messages in real-time (like in UserChat)
  useSocket('newMessage', (message) => {
    console.log('🔔 HomeScreen: New message received');
    console.log('📨 Message data:', {
      sender: message.sender?.id || message.senderId,
      receiver: message.receiver?.id || message.receiverId,
      type: message.type
    });

    if (!message || !currentUserId) {
      console.log('⚠️ HomeScreen: Missing message or currentUserId');
      return;
    }

    // Extract sender and receiver IDs (handle different payload structures)
    const senderId = String(message.sender?.id || message.senderId || '');
    const receiverId = String(message.receiver?.id || message.receiverId || '');
    const me = String(currentUserId);

    console.log('🔍 HomeScreen: ID Check:', {
      senderId,
      receiverId,
      currentUserId: me,
      isForMe: receiverId === me,
      isFromMe: senderId === me
    });

    // Only increment unread if message is FOR current user and NOT from them
    if (receiverId === me && senderId !== me) {
      console.log('✅ HomeScreen: Message is for me, incrementing unread count');

      // Optimistically increment unread count
      setUnreadCount(prev => {
        const newCount = prev + 1;
        console.log(`📈 HomeScreen: Unread count updated: ${prev} → ${newCount}`);
        return newCount;
      });

      // Also request fresh data from server for accuracy
      const socket = getSocket();
      if (socket?.connected) {
        console.log('📡 HomeScreen: Requesting fresh chat box data');
        socket.emit('getUserChatBox', { userId: currentUserId });
      }
    } else {
      console.log('ℹ️ HomeScreen: Message not for me or from me, ignoring');
    }
  }, [currentUserId]);

  // ✅ Listen for messageSent to refresh unread count
  useSocket('messageSent', (message) => {
    console.log('📤 HomeScreen: Message sent event received');

    if (!message || !currentUserId) return;

    const senderId = String(message.sender?.id || message.senderId || '');
    const me = String(currentUserId);

    // If current user sent the message, refresh chat box
    if (senderId === me) {
      console.log('📤 HomeScreen: Current user sent message, refreshing chat box');
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit('getUserChatBox', { userId: currentUserId });
      }
    }
  }, [currentUserId]);


  const unreadNotification = async () => {
    try {
      const response = await unReadNotification();
      if (response?.statusCode === 200) {
        const count = response?.data?.unreadCount;
        setNotificationUnreadCount(count);
      } else {
        console.warn('Unexpected status:', response?.status);
      }
    } catch (err) {
      console.log('Error in unreadNotification:', err);
    }
  };
  console.log(notificationUnreadCount, 'data gte hre kys ?')

  // ✅ Periodic refresh to catch any missed messages
  useEffect(() => {
    if (!currentUserId || !socketReady) {
      console.log('⏸️ HomeScreen: Skipping periodic refresh - not ready');
      return;
    }
    const interval = setInterval(() => {
      const socket = getSocket();
      if (socket?.connected && isFocused) {
        console.log('🔄 HomeScreen: Periodic refresh - requesting chat box');
        socket.emit('getUserChatBox', { userId: currentUserId });
      }
    }, 30000);

    return () => {
      console.log('⏰ HomeScreen: Clearing periodic refresh');
      clearInterval(interval);
    };
  }, [currentUserId, socketReady, isFocused]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
    setStoryRefreshTick(t => t + 1);

    // Refresh unread count on pull-to-refresh
    if (currentUserId && socketReady) {
      const socket = getSocket();
      if (socket?.connected) {
        console.log('🔄 HomeScreen: Manual refresh - requesting chat box');
        socket.emit('getUserChatBox', { userId: currentUserId });
      }
    }
    
    setRefreshing(false);
  }, [currentUserId, socketReady]);

  const fetchData = useCallback(async () => {
    try {
      dispatch(showLoader());
      const response = await getposts();
      if (response?.statusCode === 200) {
        console.log('✅ HomeScreen: Posts fetched successfully');
        setPosts(response.data);
      } else {
        showToastMessage(toast, 'danger', response.data.message);
      }
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.message ?? 'Something went wrong',
      );
    } finally {
      dispatch(hideLoader());
    }
  }, [dispatch, toast]);

  const fetchProfileData = useCallback(async () => {
    try {
      dispatch(showLoader());
      const id = await AsyncStorage.getItem('userId');
      if (!id) return;

      const response = await getProfile(id);
      if (response.statusCode === 200 && response.data) {
        await AsyncStorage.setItem('profile', response.data.profile || '');
        dispatch(setUserProfile(response.data.profile));

        const raw = response?.data?.image;
        dispatch(setProfileImg(raw));
        if (response?.data?.profile === 'company') {
          setIsBusinessProfile(true);
        }
      }
    } catch (err) {
      console.error('❌ Profile fetch error:', err);
    } finally {
      dispatch(hideLoader());
    }
  }, [dispatch]);

  const addFcmToken = useCallback(async () => {
    let fcmToken = await AsyncStorage.getItem('fcmToken')
    if (fcmToken) {
      try {
        dispatch(showLoader());
        const response = await updateFcmToken({ fcmToken: fcmToken });
        if (response?.statusCode === 200) {
          console.log('✅ FCM token updated successfully');
        } else {
          showToastMessage(toast, 'danger', response.data.message);
        }
      } catch (error) {
        showToastMessage(
          toast,
          'danger',
          error?.response?.message ?? 'Something went wrong',
        );
      } finally {
        dispatch(hideLoader());
      }
    }
  }, [dispatch, toast]);

  // Initial load on screen focus
  useEffect(() => {
    if (isFocused) {
      console.log('👁️ HomeScreen focused - fetching data');
      setStoryRefreshTick(t => t + 1);
      fetchData();
      fetchProfileData();

      // Request unread count when screen becomes focused
      if (currentUserId && socketReady) {
        const socket = getSocket();
        if (socket?.connected) {
          console.log('👁️ HomeScreen: Screen focused, requesting unread count');
          socket.emit('getUserChatBox', { userId: currentUserId });
        }
      }
    }
  }, [isFocused, fetchData, fetchProfileData, currentUserId, socketReady]);

  // AppState listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      console.log('📱 AppState changed:', appState.current, '→', nextAppState);

      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isFocused
      ) {
        console.log('🔄 App resumed while HomeScreen focused - refreshing');
        fetchData();
        fetchProfileData();
        setStoryRefreshTick(t => t + 1);

        // Refresh unread count on app resume
        if (currentUserId && socketReady) {
          const socket = getSocket();
          if (socket?.connected) {
            console.log('🔄 HomeScreen: App resumed, requesting unread count');
            socket.emit('getUserChatBox', { userId: currentUserId });
          }
        }
      }

      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [isFocused, fetchData, fetchProfileData, currentUserId, socketReady]);

  useEffect(() => {
    addFcmToken();
  }, [addFcmToken]);

  // Listen for payment completion
  useEffect(() => {
    if (!isFocused) return;

    console.log('🎧 HomeScreen: Setting up PAYMENT_COMPLETED listener');

    const subscription = DeviceEventEmitter.addListener('PAYMENT_COMPLETED', (data) => {
      console.log('🔔 HomeScreen: PAYMENT_COMPLETED event received!', data);

      fetchData();
      fetchProfileData();
      setStoryRefreshTick(t => t + 1);
    });

    return () => {
      console.log('🔇 HomeScreen: Removing PAYMENT_COMPLETED listener');
      subscription.remove();
    };
  }, [isFocused, fetchData, fetchProfileData]);

  useFocusEffect(
    useCallback(() => {
      // Reset sidebar when screen loses focus
      setSidebarVisible(false);
      Animated.spring(sidebarAnim, {
        toValue: SIDEBAR_WIDTH,
        useNativeDriver: true,
      }).start();
    }, []),
  );

  const toggleSidebar = () => {
    const toValue = sidebarVisible ? SIDEBAR_WIDTH : 0;
    setSidebarVisible(!sidebarVisible);

    Animated.spring(sidebarAnim, {
      toValue,
      friction: 8,
      tension: 65,
      useNativeDriver: true,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isRightEdgeSwipe = gestureState.moveX > SCREEN_WIDTH - 50;
        const isHorizontalSwipe = Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 50;

        return isHorizontalSwipe && (isRightEdgeSwipe || sidebarVisible);
      },
      onPanResponderGrant: () => {
        sidebarAnim.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        let newValue;

        if (sidebarVisible) {
          newValue = Math.max(0, Math.min(SIDEBAR_WIDTH, gestureState.dx));
        } else {
          newValue = Math.max(0, Math.min(SIDEBAR_WIDTH, SIDEBAR_WIDTH + gestureState.dx));
        }

        sidebarAnim.setValue(newValue);
      },
      onPanResponderRelease: (_, gestureState) => {
        const threshold = SIDEBAR_WIDTH / 2;
        const currentValue = sidebarAnim._value;
        const velocity = gestureState.vx;

        let shouldOpen = false;

        if (Math.abs(velocity) > 0.5) {
          shouldOpen = velocity < 0;
        } else {
          shouldOpen = currentValue < threshold;
        }

        const toValue = shouldOpen ? 0 : SIDEBAR_WIDTH;
        setSidebarVisible(shouldOpen);

        Animated.spring(sidebarAnim, {
          toValue,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
          velocity: velocity,
        }).start();
      },
    }),
  ).current;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerLeft}>
          <LogoIcon height={45} width={45} />
          <TextGradient
            style={{ fontWeight: 'bold', fontSize: 20 }}
            locations={[0, 1]}
            colors={['#513189bd', '#e54ba0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            text="VALENS"
          />
        </TouchableOpacity>
        <View style={styles.headerIcons}>
          <TouchableOpacity
            onPress={() => {
              navigation.navigate('HeartNotification');
            }}
          >
            <Icon name="notifications-outline" size={25} color="#111100" />
            {notificationUnreadCount > 0 && (
              <View style={headerBadgeStyles.badgeContainer}>
                <Text style={headerBadgeStyles.badgeText}>
                  {notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}
                </Text>
              </View>
            )}

          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('ChatMessages')}
            style={{ position: 'relative', padding: 4 }}
          >
            <Chat width={24} height={24} style={styles.headerIcon} />

            {/* Enhanced badge with animation */}
            {unreadCount > 0 && (
              <View style={headerBadgeStyles.badgeContainer}>
                <Text style={headerBadgeStyles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Story toggle button */}
          <TouchableOpacity
            onPress={toggleSidebar}
            style={sidebarStyles.toggleButton}
          >
            <Icon
              name={sidebarVisible ? "chevron-forward" : "chevron-back"}
              size={24}
              color={text}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content with Pan Responder */}
      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#783eb9a9']}
            />
          }
        >
          <Posts postData={posts} onRefresh={onRefresh} isBusinessProfile={isBusinessProfile} />
        </ScrollView>
      </View>

      {/* Modal-based Sidebar */}
      <Modal
        visible={sidebarVisible}
        transparent={true}
        animationType="none"
        onRequestClose={toggleSidebar}
        statusBarTranslucent={true}
      >
        <View style={sidebarStyles.modalContainer}>
          <TouchableOpacity
            style={sidebarStyles.overlay}
            activeOpacity={1}
            onPress={toggleSidebar}
          />

          <Animated.View
            style={[
              sidebarStyles.sidebar,
              {
                transform: [{ translateX: sidebarAnim }],
              },
              bgStyle
            ]}
          >
            <Stories
              refreshTick={storyRefreshTick}
              sidebarMode={true}
            />
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const sidebarStyles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  sidebar: {
    position: 'absolute',
    right: 0,
    top: Platform.OS == 'android' ? 40 : 57,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    borderLeftWidth: 1,
    borderLeftColor: '#dbdbdb',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 1000,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  toggleButton: {
    marginLeft: 8,
    padding: 4,
  },
});

const headerBadgeStyles = StyleSheet.create({
  badgeContainer: {
    position: 'absolute',
    right: -4,
    top: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 3,
    zIndex: 2,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});