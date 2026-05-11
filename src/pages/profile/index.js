import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useToast } from 'react-native-toast-notifications';
import { useDispatch } from 'react-redux';

import ProfilePersonData from '../../components/profile/ProfilePersonalData';
import HighlightStories from '../../components/profile/HighLightStories';
import ProfileTabs from '../../components/profile/ProfileTabNavigation';
import { showToastMessage } from '../../components/displaytoastmessage';
import { getPostByUser, getUserCredentials, getUserDashboard } from '../../services/post';
import { showLoader, hideLoader } from '../../redux/actions/LoaderAction';
import { useAppTheme } from '../../theme/useApptheme';
import WelcomeValensModal from '../../components/modals/WelcomeValensModal';
import { setPostPinnedState, sortPostsByPinned } from '../../utils/postPinning';

const KYC_WELCOME_SHOWN_KEY = 'kycWelcomeShownEver';
const LEGACY_KYC_WELCOME_SHOWN_KEY = 'kycWelcomeShown';

const ProfileScreen = () => {
  const [posts, setPosts] = useState([]);
  const [userId, setUserId] = useState();
  const [userDashboard, setUserDashboard] = useState();
  const [userData, setUserData] = useState();
  const [refreshing, setRefreshing] = useState(false);
  const [welcomeModalVisible, setWelcomeModalVisible] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const profileScrollY = useRef(new Animated.Value(0)).current;
  const [compactLocked, setCompactLocked] = useState(false);
  const compactLockedRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const relockMinYRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchLastYRef = useRef(0);

  const toast = useToast();
  const dispatch = useDispatch();
  const { bgStyle, textStyle } = useAppTheme();

  useEffect(() => {
    compactLockedRef.current = compactLocked;
  }, [compactLocked]);

  const fetchProfilePosts = useCallback(async (idOverride = '') => {
    const id = idOverride || userId || await AsyncStorage.getItem('userId');
    if (!id) return null;

    const postsRes = await getPostByUser(id, 'normal');
    if (postsRes?.statusCode === 200) {
      const nextPosts = sortPostsByPinned(postsRes.data || []);
      setPosts(nextPosts);
      return nextPosts;
    }

    return null;
  }, [userId]);

  // Single function to fetch posts, profile info, and dashboard in parallel
  const fetchAllData = useCallback(async () => {
    const id = await AsyncStorage.getItem('userId');
    if (!id) {
      showToastMessage(toast, 'danger', 'No userId in storage');
      return;
    }
    setUserId(id);


    dispatch(showLoader());
    try {
      const [postsRes, userRes, dashRes] = await Promise.all([
        getPostByUser(id, 'normal'),
        getUserCredentials(id),
        getUserDashboard(id),
      ]);

      // Posts
      if (postsRes.statusCode === 200) {
        setPosts(sortPostsByPinned(postsRes.data));
      } else {
        showToastMessage(
          toast,
          'danger',
          'Failed to fetch posts'
        );
      }

      // Profile data

      if (userRes.statusCode === 200) {


        let userDataToSet;
        if (userRes.data && userRes.data.user) {
          userDataToSet = userRes.data.user;
        } else if (userRes.data) {
          userDataToSet = userRes.data;
        } else {
          userDataToSet = userRes;
        }



        // Ensure the image URL is properly formatted
        if (userDataToSet?.image) {
          let formattedImageUrl = userDataToSet.image;

          // Remove any whitespace
          formattedImageUrl = formattedImageUrl.trim();

          // If it's already a full URL, use as is
          if (formattedImageUrl.startsWith('http://') || formattedImageUrl.startsWith('https://')) {
          } else if (formattedImageUrl.startsWith('/')) {
            // If it's a relative URL starting with /
            formattedImageUrl = `http://35.174.167.92:3002${formattedImageUrl}`;
          } else {
            // If it doesn't start with /, assume it's a relative path
            formattedImageUrl = `http://35.174.167.92:3002/${formattedImageUrl}`;
          }

          userDataToSet.image = formattedImageUrl;
        }
        AsyncStorage.setItem('currentUsername', userDataToSet.displayName);
        setUserData(userDataToSet);

        // Check KYC approval status and show welcome modal
        if (userDataToSet.kyc === true) {
          const hasShownWelcome = await AsyncStorage.getItem(KYC_WELCOME_SHOWN_KEY);
          const hasShownLegacy = await AsyncStorage.getItem(LEGACY_KYC_WELCOME_SHOWN_KEY);
          if (!hasShownWelcome) {
            if (hasShownLegacy) {
              await AsyncStorage.setItem(KYC_WELCOME_SHOWN_KEY, 'true');
              return;
            }
            // Show welcome modal after a short delay to ensure UI is ready
            setTimeout(() => {
              setWelcomeModalVisible(true);
              AsyncStorage.multiSet([
                [KYC_WELCOME_SHOWN_KEY, 'true'],
                [LEGACY_KYC_WELCOME_SHOWN_KEY, 'true'],
              ]);
            }, 500);
          }
        }
      } else {
        showToastMessage(
          toast,
          'danger',
          'Failed to fetch profile'
        );
      }

      // Dashboard
      if (dashRes.statusCode === 200) {
        setUserDashboard(dashRes.data.dashboardData);
      } else {
        showToastMessage(
          toast,
          'danger',
          'Failed to fetch dashboard'
        );
      }
    } catch (error) {
      console.error('Error fetching profile screen data:', error);
      showToastMessage(toast, 'danger', 'Network error');
    } finally {
      dispatch(hideLoader());
    }
  }, [dispatch, toast]);

  // Run on screen focus
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      (async () => {
        if (!isActive) return;
        await fetchAllData();
      })();
      return () => {
        isActive = false;
      };
    }, [fetchAllData])
  );

  const expandProfileHeader = useCallback(() => {
    if (!compactLockedRef.current) return;
    compactLockedRef.current = false;
    setCompactLocked(false);
  }, []);

  // Pull-to-refresh
  const onRefresh = async () => {
    if (compactLockedRef.current) {
      expandProfileHeader();
      return;
    }
    setRefreshing(true);
    await fetchAllData();
    setRefreshKey(prev => prev + 1);
    setRefreshing(false);
  };

  const handlePostPinChanged = useCallback(async (postId, pinned) => {
    if (pinned) {
      setPosts(prevPosts => setPostPinnedState(prevPosts, postId, pinned));
      return null;
    }

    try {
      return await fetchProfilePosts();
    } catch (error) {
      console.error('Error refreshing posts after unpin:', error);
      setPosts(prevPosts => setPostPinnedState(prevPosts, postId, pinned));
      return null;
    }
  }, [fetchProfilePosts]);

const handleProfileScroll = useCallback((event) => {
  const rawY = event?.nativeEvent?.contentOffset?.y ?? 0;
  const y = Math.max(0, rawY);
  profileScrollY.setValue(y);

  const dy = y - lastScrollYRef.current;
  lastScrollYRef.current = y;

  // Collapse on any upward scroll past 30px
  if (dy > 0 && y > 30 && !compactLockedRef.current) {
    compactLockedRef.current = true;
    setCompactLocked(true);
  }

  // Expand ONLY on explicit downward swipe (dy < 0 means finger moving down)
  if ((dy < -8 || rawY < -6) && compactLockedRef.current) {
    expandProfileHeader();
  }
}, [expandProfileHeader, profileScrollY]);

const handleProfileTouchStart = useCallback((event) => {
  const pageY = event?.nativeEvent?.pageY ?? 0;
  touchStartYRef.current = pageY;
  touchLastYRef.current = pageY;
}, []);

const handleProfileTouchMove = useCallback((event) => {
  if (!compactLockedRef.current) return;

  const pageY = event?.nativeEvent?.pageY ?? 0;
  const totalDragY = pageY - touchStartYRef.current;
  const frameDragY = pageY - touchLastYRef.current;
  touchLastYRef.current = pageY;

  if (totalDragY > 18 || frameDragY > 10) {
    expandProfileHeader();
  }
}, [expandProfileHeader]);

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <Animated.ScrollView
        contentContainerStyle={styles.scrollContainer}
        onScroll={handleProfileScroll}
        onTouchStart={handleProfileTouchStart}
        onTouchMove={handleProfileTouchMove}
        scrollEventThrottle={16}
        nestedScrollEnabled={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={userData?.profile == 'company' ? ['#D3B683'] : ['#7c3aed']}
          />
        }
      >
        <ProfilePersonData
          displayName={userData?.displayName}
          username={userData?.userName}
          profilepic={userData?.image}
          bio={userData?.bio}
          dashboard={userDashboard}
          userData={userData}
          compactLocked={compactLocked}

        // executeFollowAction={executeFollowAction}
        />
        <View>
          <HighlightStories userData={userData} />
        </View>
        <ProfileTabs
          post={posts}
          displayName={userData?.userName}
          userData={userData}
          dashboard={userDashboard}
          loggedInUserId={userId}
          refreshKey={refreshKey}
          onPostPinChanged={handlePostPinChanged}
          scrollEnabled={false}  
        />
      </Animated.ScrollView>
      {/* <WelcomeValensModal
        visible={welcomeModalVisible}
        onClose={async () => {
          setWelcomeModalVisible(false);
          await AsyncStorage.multiSet([
            [KYC_WELCOME_SHOWN_KEY, 'true'],
            [LEGACY_KYC_WELCOME_SHOWN_KEY, 'true'],
          ]);
        }}
      /> */}
    </SafeAreaView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 20,
  },
  scrollContainer: {
    flexGrow: 1,
  },
});
