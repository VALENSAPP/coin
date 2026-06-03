import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  Modal,
  DeviceEventEmitter,
  Button,
} from 'react-native';
import createStyles from './Style';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import Stories from '../../components/home/story.js/Stories';
import Posts from '../../components/home/posts/Posts';
import { DrawerActions, useFocusEffect, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
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
import { checkSubscription } from '../../services/stirpe';
import BusinessSubscriptionPrompt from '../../components/modals/BusinessSubscriptionPrompt';
import { useLanguage } from '../../i18n';
// import useScreenshotProtection from '../../hooks/useScreenshotProtection';
import StoryViewerModal from '../../components/modals/StoryViewerModal';
import { getFollowingUserStories, getStoryByUser } from '../../services/stories';
import { displayExpandableNotification } from '../../services/NotificationService';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SIDEBAR_WIDTH = 130;

const isVideoStoryMedia = value => {
  if (!value || typeof value !== 'string') return false;
  const normalized = value.toLowerCase();
  return ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'].some(ext => normalized.includes(ext))
    || normalized.includes('/video/')
    || normalized.includes('video');
};

const splitSharedStoryId = value => {
  const rawId = String(value || '').trim();
  const match = rawId.match(/^(.*)_(\d+)$/);
  return {
    rawId,
    baseId: match ? match[1] : rawId,
    mediaIndex: match ? Number(match[2]) : null,
  };
};

const getStoryOwner = (story, fallbackUserId) => {
  const owner = story?.user || {};
  return {
    id: story?.userId || owner?.id || owner?._id || fallbackUserId,
    name: owner?.displayName || owner?.userName || owner?.username || story?.userName || 'Unknown User',
    image: owner?.image || story?.userImage || '',
  };
};

const findStoryBySharedId = (storyRows, sharedStoryId, fallbackUserId = '') => {
  const { rawId, baseId, mediaIndex } = splitSharedStoryId(sharedStoryId);
  if (!baseId) return null;

  for (const story of storyRows) {
    const storyBaseId = String(story?.id || story?._id || story?.storyId || '').trim();
    const media = Array.isArray(story?.media) ? story.media : [];
    const directUri = story?.uri || story?.url || story?.storyUrl || story?.image || story?.thumbnail;
    const owner = getStoryOwner(story, fallbackUserId);

    if (storyBaseId === baseId && media.length) {
      const index = mediaIndex != null && media[mediaIndex] ? mediaIndex : 0;
      const uri = String(media[index] || '').trim();
      if (!uri) continue;

      return {
        id: rawId || `${storyBaseId}_${index}`,
        storyId: storyBaseId,
        userId: owner.id ? String(owner.id) : undefined,
        uri,
        media: [uri],
        type: isVideoStoryMedia(uri) ? 'video' : 'image',
        caption: story?.caption || story?.text || '',
        createdAt: story?.createdAt || story?.updatedAt,
        userName: owner.name,
        userImage: owner.image,
      };
    }

    if (storyBaseId === baseId && directUri) {
      const uri = String(directUri).trim();
      return {
        id: rawId || storyBaseId,
        storyId: storyBaseId,
        userId: owner.id ? String(owner.id) : undefined,
        uri,
        media: [uri],
        type: story?.type || (isVideoStoryMedia(uri) ? 'video' : 'image'),
        caption: story?.caption || story?.text || '',
        createdAt: story?.createdAt || story?.updatedAt,
        userName: owner.name,
        userImage: owner.image,
      };
    }
  }

  return null;
};

export default function HomeScreen({ route }) {
  const styles = createStyles();
  const navigation = useNavigation();
  const { t } = useLanguage();

  // useScreenshotProtection({
  //   title: t('postView.screenshotWarningTitle'),
  //   message: t('postView.screenshotWarningMessage'),
  // });

  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [storyRefreshTick, setStoryRefreshTick] = useState(0);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [isBusinessProfile, setIsBusinessProfile] = useState(false);
  const [showBusinessSubscriptionPrompt, setShowBusinessSubscriptionPrompt] = useState(false);
  const [hasCheckedBusinessSubscription, setHasCheckedBusinessSubscription] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socketReady, setSocketReady] = useState(false);
  const [linkedStory, setLinkedStory] = useState(null);
  const [linkedStoryVisible, setLinkedStoryVisible] = useState(false);
  const [openingLinkedStory, setOpeningLinkedStory] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
  const postsRef = useRef(null);

  const isInitialMountRef = useRef(true);
  const conversationsRef = useRef([]);
  
  const toast = useToast();
  const dispatch = useDispatch();
  const isFocused = useIsFocused();
  const { bgStyle, text } = useAppTheme();
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(null);

  const appState = useRef(AppState.currentState);

  const formatBadgeCount = (count) => (count > 9 ? t('home.unreadBadgeOverflow') : count);

  const extractNotificationUnreadCount = useCallback((response) => {
    if (response == null) return null;
    const data = response.data;
    if (typeof data?.unreadCount === 'number') return data.unreadCount;
    if (typeof response?.unreadCount === 'number') return response.unreadCount;
    if (typeof data === 'number') return data;
    return null;
  }, []);

  const unreadNotification = useCallback(async () => {
    try {
      const response = await unReadNotification();
      const ok =
        response?.statusCode === 200 ||
        response?.status === 200 ||
        response?.success === true;

      const count = extractNotificationUnreadCount(response);

      if (ok && typeof count === 'number') {
        setNotificationUnreadCount(count);
        return;
      }

      if (typeof count === 'number') {
        setNotificationUnreadCount(count);
        return;
      }

      if (ok) {
        setNotificationUnreadCount(0);
        return;
      }

      console.warn('Unexpected unread-count response:', response);
    } catch (err) {
      console.log('Error in unreadNotification:', err);
    }
  }, [extractNotificationUnreadCount]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      'NOTIFICATION_BADGE_REFRESH',
      () => {
        unreadNotification();
      },
    );
    return () => subscription.remove();
  }, [unreadNotification]);

  useEffect(() => {
    const initializeUserAndSocket = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (userId) {
          setCurrentUserId(userId);
          console.log('📱 HomeScreen: Current user ID set:', userId);

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

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleConnect = () => {
      console.log('🔌 HomeScreen: Socket connected');
      setSocketReady(true);

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

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect', handleReconnect);
    };
  }, [currentUserId]);

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
    }, [unreadNotification]),
  );

  useFocusEffect(
    useCallback(() => {
      if (currentUserId && socketReady) {
        const socket = getSocket();
        if (socket?.connected) {
          console.log('👁️ HomeScreen: Screen focused, requesting unread chat count');
          socket.emit('getUserChatBox', { userId: currentUserId });
        }
      }
    }, [currentUserId, socketReady]),
  );

  useSocket('userChatBox', (data) => {
    console.log('📨 HomeScreen: Received userChatBox data');

    if (!data) {
      console.log('⚠️ HomeScreen: No data received');
      return;
    }

    let conversations = [];

    if (data.success && Array.isArray(data.data)) {
      conversations = data.data;
    } else if (Array.isArray(data)) {
      conversations = data;
    }

    console.log(`📊 HomeScreen: Processing ${conversations.length} conversations`);

    conversationsRef.current = conversations;

    const totalUnread = conversations.reduce((acc, conversation) => {
      if (conversation.isHidden === true) {
        return acc;
      }
      const unread = conversation.unreadCount || 0;
      return acc + unread;
    }, 0);

    console.log('📊 HomeScreen: Total unread messages:', totalUnread);
    setUnreadCount(totalUnread);
  }, [currentUserId]);

  useSocket('newMessage', (message) => {
    console.log('🔔 HomeScreen: New message received');

    if (!message || !currentUserId) {
      console.log('⚠️ HomeScreen: Missing message or currentUserId');
      return;
    }

    const senderId = String(message.sender?.id || message.senderId || '');
    const receiverId = String(message.receiver?.id || message.receiverId || '');
    const me = String(currentUserId);

    if (receiverId === me && senderId !== me) {
      console.log('✅ HomeScreen: Message is for me, incrementing unread count');

      setUnreadCount(prev => {
        const newCount = prev + 1;
        console.log(`📈 HomeScreen: Unread count updated: ${prev} → ${newCount}`);
        return newCount;
      });

      const socket = getSocket();
      if (socket?.connected) {
        console.log('📡 HomeScreen: Requesting fresh chat box data');
        socket.emit('getUserChatBox', { userId: currentUserId });
      }
    } else {
      console.log('ℹ️ HomeScreen: Message not for me or from me, ignoring');
    }
  }, [currentUserId]);

  useSocket('messageSent', (message) => {
    console.log('📤 HomeScreen: Message sent event received');

    if (!message || !currentUserId) return;

    const senderId = String(message.sender?.id || message.senderId || '');
    const me = String(currentUserId);

    if (senderId === me) {
      console.log('📤 HomeScreen: Current user sent message, refreshing chat box');
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit('getUserChatBox', { userId: currentUserId });
      }
    }
  }, [currentUserId]);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchData(),
        currentUserId && socketReady ? (() => {
          const socket = getSocket();
          if (socket?.connected) {
            console.log('🔄 HomeScreen: Manual refresh - requesting chat box');
            socket.emit('getUserChatBox', { userId: currentUserId });
          }
        })() : Promise.resolve()
      ]);
      setStoryRefreshTick(t => t + 1);
    } finally {
      setRefreshing(false);
    }
  }, [currentUserId, socketReady, fetchData]);

  const fetchData = useCallback(async () => {
    try {
      const response = await getposts();
      if (response?.statusCode === 200) {
        console.log('✅ HomeScreen: Posts fetched successfully', response);
        setPosts(response.data);
      } else {
        showToastMessage(toast, 'danger', response.data.message);
      }
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.message ??  t('home.somethingWentWrong'),
      );
    }
  }, [toast, t]);

  const fetchProfileData = useCallback(async () => {
    try {
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
        } else {
          setIsBusinessProfile(false);
          setShowBusinessSubscriptionPrompt(false);
          setHasCheckedBusinessSubscription(false);
        }
      }
    } catch (err) {
      console.error('❌ Profile fetch error:', err);
    }
  }, [dispatch]);

  const addFcmToken = useCallback(async () => {
    let fcmToken = await AsyncStorage.getItem('fcmToken');
    if (fcmToken) {
      try {
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
          error?.response?.message ?? t('home.somethingWentWrong'),
        );
      }
    }
  }, [toast, t]);

  const checkBusinessSubscriptionStatus = useCallback(async () => {
    if (hasCheckedBusinessSubscription || !isBusinessProfile) return;

    try {
      setHasCheckedBusinessSubscription(true);
      const response = await checkSubscription();
      const status = String(response?.data?.subscription?.status || '').toUpperCase();
      const hasActiveSubscription = Boolean(response?.success) && (status === 'ACTIVE' || status === 'TRIALING');

      if (!hasActiveSubscription) {
        setShowBusinessSubscriptionPrompt(true);
      }
    } catch (error) {
      setShowBusinessSubscriptionPrompt(true);
    }
  }, [hasCheckedBusinessSubscription, isBusinessProfile]);

  useEffect(() => {
    if (isInitialMountRef.current) {
      console.log('👁️ HomeScreen initial mount - fetching data');
      isInitialMountRef.current = false;
      setStoryRefreshTick(t => t + 1);

      Promise.all([
        fetchData(),
        fetchProfileData()
      ]).catch(err => console.error('Error fetching initial data:', err));

      if (currentUserId && socketReady) {
        const socket = getSocket();
        if (socket?.connected) {
          console.log('👁️ HomeScreen: Screen focused, requesting unread count');
          socket.emit('getUserChatBox', { userId: currentUserId });
        }
      }
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      console.log('📱 AppState changed:', appState.current, '→', nextAppState);

      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isFocused
      ) {
        console.log('🔄 App resumed while HomeScreen focused - refreshing');

        Promise.all([
          fetchData(),
          fetchProfileData()
        ]).catch(err => console.error('Error on app resume:', err));

        setStoryRefreshTick(t => t + 1);

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
  }, [fetchData, fetchProfileData, isFocused, currentUserId, socketReady]);

  useEffect(() => {
    addFcmToken();
  }, [addFcmToken]);

  useEffect(() => {
    if (!isFocused || !isBusinessProfile) return;
    checkBusinessSubscriptionStatus();
  }, [isFocused, isBusinessProfile, checkBusinessSubscriptionStatus]);

const openLinkedStory = useCallback(async (sharedStoryId) => {
  const storyId = String(sharedStoryId || '').trim();
  if (!storyId || openingLinkedStory) return;

  try {
    setOpeningLinkedStory(true);
    const userId = await AsyncStorage.getItem('userId');
    const savedUsername = await AsyncStorage.getItem('username') || ''; // ← add this

    const [ownStoryResponse, followingStoryResponse] = await Promise.all([
      userId ? getStoryByUser(userId, { time: 'all' }).catch(() => null) : Promise.resolve(null),
      getFollowingUserStories().catch(() => null),
    ]);

    const ownStories = ownStoryResponse?.data
      ? (Array.isArray(ownStoryResponse.data) ? ownStoryResponse.data : [ownStoryResponse.data])
      : [];
    const followingStories = followingStoryResponse?.data
      ? (Array.isArray(followingStoryResponse.data) ? followingStoryResponse.data : [followingStoryResponse.data])
      : [];

    // ← tag own stories with userId so getStoryOwner can identify them
    const taggedOwnStories = ownStories.map(s => ({
      ...s,
      userId: s.userId || userId,
      userName: s.userName || s.user?.displayName || s.user?.userName || savedUsername,
    }));

    const matchedStory = findStoryBySharedId(
      [...taggedOwnStories, ...followingStories],
      storyId,
      userId,
    );

    if (matchedStory) {
      // if matched story belongs to current user, show "Your Drops"
      const isOwnStory = String(matchedStory.userId) === String(userId);
      setLinkedStory({
        ...matchedStory,
        userName: isOwnStory
          ? t('stories.yourDrops')   // ← "Your Drops" for own story
          : matchedStory.userName,
      });
      setLinkedStoryVisible(true);
    } else {
      showToastMessage(toast, 'danger', 'This drop is no longer available.');
    }
  } catch (error) {
    console.error('Error opening shared story link:', error);
    showToastMessage(toast, 'danger', 'Unable to open this drop.');
  } finally {
    setOpeningLinkedStory(false);
    navigation.setParams?.({ sharedStoryId: undefined });
  }
}, [navigation, openingLinkedStory, toast, t]);

  useEffect(() => {
    const sharedStoryId = route?.params?.sharedStoryId;
    if (!isFocused || !sharedStoryId) return;
    openLinkedStory(sharedStoryId);
  }, [isFocused, openLinkedStory, route?.params?.sharedStoryId]);

  // Listen for payment completion - optimized
  useEffect(() => {
    if (!isFocused) return;

    console.log('🎧 HomeScreen: Setting up PAYMENT_COMPLETED listener');

    const subscription = DeviceEventEmitter.addListener('PAYMENT_COMPLETED', (data) => {
      console.log('🔔 HomeScreen: PAYMENT_COMPLETED event received!', data);

      Promise.all([
        fetchData(),
        fetchProfileData()
      ]).catch(err => console.error('Error on payment completion:', err));

      setStoryRefreshTick(t => t + 1);
    });

    return () => {
      console.log('🔇 HomeScreen: Removing PAYMENT_COMPLETED listener');
      subscription.remove();
    };
  }, [isFocused]);

  useFocusEffect(
    useCallback(() => {
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

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      'HOME_TAB_PRESS',
      () => {
        console.log('🏠 Home tab pressed again');
        postsRef.current?.scrollToTop?.();
        onRefresh();
      }
    );

    return () => subscription.remove();
  }, [onRefresh]);

  const openGlobalDrawer = useCallback(() => {
    let parentNav = navigation;
    let attempts = 0;

    while (parentNav && attempts < 6) {
      const state = parentNav.getState?.();
      if (state?.type === 'drawer') {
        parentNav.dispatch(DrawerActions.openDrawer());
        return;
      }
      parentNav = parentNav.getParent?.();
      attempts += 1;
    }

    navigation.dispatch(DrawerActions.openDrawer());
  }, [navigation]);


  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerLeft} onPress={openGlobalDrawer}>
          <LogoIcon height={45} width={45} />
          <TextGradient
            style={{ fontWeight: 'bold', fontSize: 20 }}
            locations={[0, 1]}
            colors={['#513189bd', '#e54ba0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            text={t('home.appTitle')}
          />
        </TouchableOpacity>
        <View style={styles.headerIcons}>
          <TouchableOpacity
            style={headerBadgeStyles.iconButton}
            accessibilityLabel={t('home.notificationsLabel')}
            onPress={() => {
              navigation.navigate('HeartNotification');
            }}
          >
            <Icon name="notifications-outline" size={25} color="#111100" />
            {notificationUnreadCount > 0 && (
              <View style={headerBadgeStyles.badgeContainer}>
                <Text style={headerBadgeStyles.badgeText}>
                  {formatBadgeCount(notificationUnreadCount)}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('ChatMessages')}
            accessibilityLabel={t('home.chatLabel')}
            style={headerBadgeStyles.iconButton}
          >
            <Chat width={24} height={24} />
            {unreadCount > 0 && (
              <View style={headerBadgeStyles.badgeContainer}>
                <Text style={headerBadgeStyles.badgeText}>
                  {formatBadgeCount(unreadCount)}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={toggleSidebar}
            accessibilityLabel={sidebarVisible ? t('home.storiesCloseLabel') : t('home.storiesOpenLabel')}
            style={sidebarStyles.toggleButton}
          >
            <Icon
              name={sidebarVisible ? "chevron-forward" : "chevron-back"}
              size={24}
              color={text}
            />
          </TouchableOpacity>
        </View>
        {/* <Button title="Test Expandable" onPress={() =>
          displayExpandableNotification({
            title: 'New Message',
            body: 'John sent you a message...',
            bigText: 'John: Hey! Are you coming to the meeting tomorrow at 3pm? I wanted to discuss the Q4 report and also catch up on the project timeline. Let me know!',
            bigTitle: 'John Doe',
            subtitle: 'Direct Message',  // iOS subtitle
          })
        } /> */}
      </View>

      <BusinessSubscriptionPrompt
        visible={showBusinessSubscriptionPrompt}
        onActivate={() => {
          setShowBusinessSubscriptionPrompt(false);
          navigation.navigate('ProfileMain', { screen: 'ManageSubscription' });
        }}
        onLater={() => {
          setShowBusinessSubscriptionPrompt(false);
        }}
      />
      <StoryViewerModal
        visible={linkedStoryVisible}
        story={linkedStory}
        userName={linkedStory?.userName}
        userImage={linkedStory?.userImage}
        onClose={() => {
          setLinkedStoryVisible(false);
          setLinkedStory(null);
        }}
      />

      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        <Posts
          ref={postsRef}
          postData={posts}
          onRefresh={onRefresh}
          refreshing={refreshing}
          isBusinessProfile={isBusinessProfile}
        />
      </View>

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
              onDrawerClose={() => {
                setSidebarVisible(false);
                Animated.spring(sidebarAnim, {
                  toValue: SIDEBAR_WIDTH,
                  useNativeDriver: true,
                }).start();
              }}
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
    top: Platform.OS == 'android' ? 20 : 20,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    borderLeftWidth: 1,
    borderLeftColor: '#dbdbdb',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 1000,
    borderTopLeftRadius: 60,
    overflow: 'hidden',
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
  iconButton: {
    position: 'relative',
    padding: 4,
    marginLeft: 16,
  },
  badgeContainer: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
    zIndex: 999,
    elevation: 5,
  },

  badgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
});