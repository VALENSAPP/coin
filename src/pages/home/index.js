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
import { updateFcmToken } from '../../services/notifications';
import { getSocket } from '../../services/socket';
import useSocket from '../../hooks/useSocket';

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
  const sidebarAnim = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;

  const toast = useToast();
  const dispatch = useDispatch();
  const isFocused = useIsFocused();
  const { bgStyle, text } = useAppTheme();
  
  // ✅ Use ref to track if we need to refresh on app resume
  const appState = useRef(AppState.currentState);

  // ✅ NEW: Get current user ID on mount
  useEffect(() => {
    const getCurrentUserId = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (userId) {
          setCurrentUserId(userId);
          console.log('📱 HomeScreen: Current user ID set:', userId);
        }
      } catch (error) {
        console.error('Error getting user ID:', error);
      }
    };

    getCurrentUserId();
  }, []);

  // ✅ NEW: Initialize socket and request unread count when user ID is available
  useEffect(() => {
    if (currentUserId && isFocused) {
      const socket = getSocket();
      if (socket?.connected) {
        console.log('🔌 HomeScreen: Requesting chat box for unread count');
        socket.emit('getUserChatBox', { userId: currentUserId });
      }
    }
  }, [currentUserId, isFocused]);

  // ✅ NEW: Listen for chat box updates to calculate unread count
  useSocket('userChatBox', (data) => {
    console.log('📨 HomeScreen: Received userChatBox data for unread calculation');
    if (data && Array.isArray(data)) {
      // Calculate total unread messages
      const totalUnread = data.reduce((acc, conversation) => {
        // Check if conversation is hidden first
        if (conversation.isHidden === true) {
          return acc;
        }
        return acc + (conversation.unreadCount || 0);
      }, 0);
      
      console.log('📊 HomeScreen: Total unread messages:', totalUnread);
      setUnreadCount(totalUnread);
    }
  }, [currentUserId]);

  // ✅ NEW: Listen for new messages to update unread count
  useSocket('newMessage', (message) => {
    console.log('🔔 HomeScreen: New message received');
    
    if (!message || !currentUserId) return;
    
    const receiverId = String(message.receiver?.id || message.receiverId || '');
    const senderId = String(message.sender?.id || message.senderId || '');
    const me = String(currentUserId);
    
    // Only increment unread if message is for current user and not from them
    if (receiverId === me && senderId !== me) {
      console.log('📬 HomeScreen: Incrementing unread count');
      
      // Request fresh chat box data for accurate count
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit('getUserChatBox', { userId: currentUserId });
      }
    }
  }, [currentUserId]);

  // ✅ NEW: Listen for messageSent to refresh unread count
  useSocket('messageSent', (message) => {
    console.log('📤 HomeScreen: Message sent event received');
    
    if (!message || !currentUserId) return;
    
    // Request fresh chat box data
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('getUserChatBox', { userId: currentUserId });
    }
  }, [currentUserId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
    setStoryRefreshTick(t => t + 1);
    
    // ✅ NEW: Refresh unread count on pull-to-refresh
    if (currentUserId) {
      const socket = getSocket();
      if (socket?.connected) {
        console.log('🔄 HomeScreen: Refreshing unread count');
        socket.emit('getUserChatBox', { userId: currentUserId });
      }
    }
    
    setRefreshing(false);
  }, [currentUserId]);

  // ✅ Move fetchData outside of useEffect so it's stable
  const fetchData = useCallback(async () => {
    try {
      dispatch(showLoader());
      const response = await getposts();
      if (response?.statusCode === 200) {
        console.log('response in get post--------', response);
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

  // ✅ Move fetchProfileData outside of useEffect so it's stable
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
        console.log('getProfilegetProfilegetProfile response--------', raw);
        dispatch(setProfileImg(raw));
        if (response?.data?.profile === 'company') {
          setIsBusinessProfile(true);
        }
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
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
          console.log('response in updateFcmToken---------------', response);
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

  // ✅ Initial load on screen focus
  useEffect(() => {
    if (isFocused) {
      console.log('HomeScreen focused - fetching data');
      setStoryRefreshTick(t => t + 1);
      fetchData();
      fetchProfileData();
      
      // ✅ NEW: Request unread count when screen becomes focused
      if (currentUserId) {
        const socket = getSocket();
        if (socket?.connected) {
          console.log('👁️ HomeScreen: Screen focused, requesting unread count');
          socket.emit('getUserChatBox', { userId: currentUserId });
        }
      }
    }
  }, [isFocused, fetchData, fetchProfileData, currentUserId]);

  // ✅ FIXED: AppState listener with proper dependencies
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      console.log('AppState changed from', appState.current, 'to', nextAppState);
      
      // When app comes to foreground AND screen is focused
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isFocused
      ) {
        console.log('App resumed while HomeScreen focused - refreshing data');
        fetchData();
        fetchProfileData();
        setStoryRefreshTick(t => t + 1);
        
        // ✅ NEW: Refresh unread count on app resume
        if (currentUserId) {
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
  }, [isFocused, fetchData, fetchProfileData, currentUserId]); // ✅ All dependencies added

  useEffect(() => {
    addFcmToken();
  }, [addFcmToken]);

  // ✅ Listen for payment completion
  useEffect(() => {
    // Only setup listener when screen is focused
    if (!isFocused) return;
    
    console.log('🎧 HomeScreen: Setting up PAYMENT_COMPLETED listener');
    
    const subscription = DeviceEventEmitter.addListener('PAYMENT_COMPLETED', (data) => {
      console.log('🔔 HomeScreen: PAYMENT_COMPLETED event received!', data);
      console.log('📞 HomeScreen: Calling fetchData and fetchProfileData');
      
      fetchData();
      fetchProfileData();
      setStoryRefreshTick(t => t + 1);
      
      console.log('✅ HomeScreen: Refresh functions called');
    });

    return () => {
      console.log('🔇 HomeScreen: Removing PAYMENT_COMPLETED listener');
      subscription.remove();
    };
  }, [isFocused]); // ✅ Only depend on isFocused

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

  // Enhanced pan responder for drag gesture
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
          </TouchableOpacity>
 
          <TouchableOpacity
            onPress={() => navigation.navigate('ChatMessages')}
            style={{ position: 'relative', padding: 4 }}
          >
            <Chat width={24} height={24} style={styles.headerIcon} />
 
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

      {/* Modal-based Sidebar - This ensures it appears above everything */}
      <Modal
        visible={sidebarVisible}
        transparent={true}
        animationType="none"
        onRequestClose={toggleSidebar}
        statusBarTranslucent={true}
      >
        <View style={sidebarStyles.modalContainer}>
          {/* Overlay */}
          <TouchableOpacity
            style={sidebarStyles.overlay}
            activeOpacity={1}
            onPress={toggleSidebar}
          />

          {/* Sidebar */}
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
    backgroundColor: 'red',
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 3,
    zIndex: 2,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth:1,
    borderColor:'#000',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});