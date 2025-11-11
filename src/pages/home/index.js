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
  const sidebarAnim = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;

  const toast = useToast();
  const dispatch = useDispatch();
  const isFocused = useIsFocused();

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
    setStoryRefreshTick(t => t + 1);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (isFocused) {
      setStoryRefreshTick(t => t + 1);
      fetchData();
      fetchProfileData();
    }
  }, [isFocused]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && isFocused) {
        fetchData();
      }
    });

    return () => subscription.remove();
  }, [isFocused, fetchData]);

  const fetchData = async () => {
    try {
      dispatch(showLoader());
      const response = await getposts();
      if (response?.statusCode === 200) {
        console.log('response in get post--------',response);
        
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
  };

  const fetchProfileData = async () => {
    try {
      dispatch(showLoader());
      const id = await AsyncStorage.getItem('userId');
      if (!id) return;

      const response = await getProfile(id);
      if (response.statusCode === 200 && response.data) {
        await AsyncStorage.setItem('profile', response.data.profile || '');
        
        const raw = response?.data?.image;
        console.log('getProfilegetProfilegetProfile response--------',raw);
        dispatch(setProfileImg(raw));
        if (response?.data?.profile === 'company') {
          setIsBusinessProfile(true);
        }
      }
    } catch (err) {
    } finally {
      dispatch(hideLoader())
    }
  };

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

          <TouchableOpacity onPress={() => navigation.navigate('ChatMessages')}>
            <Chat width={24} height={24} style={styles.headerIcon} />
          </TouchableOpacity>

          {/* Story toggle button */}
          <TouchableOpacity
            onPress={toggleSidebar}
            style={sidebarStyles.toggleButton}
          >
            <Icon
              name={sidebarVisible ? "chevron-forward" : "chevron-back"}
              size={24}
              color="#513189bd"
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
          <Posts postData={posts} onRefresh={onRefresh} isBusinessProfile={isBusinessProfile}/>
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
    backgroundColor: 'rgba(248, 242, 253, 0.98)',
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