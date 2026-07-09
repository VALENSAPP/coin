import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { useToast } from 'react-native-toast-notifications';
import { useDispatch } from 'react-redux';

import ProfilePersonData from '../../components/profile/ProfilePersonalData';
import HighlightStories from '../../components/profile/HighLightStories';
import ProfileTabs from '../../components/profile/ProfileTabNavigation';
import { showToastMessage } from '../../components/displaytoastmessage';
import { getPostByUser, getUserCredentials, getUserDashboard } from '../../services/post';
import { showLoader, hideLoader } from '../../redux/actions/LoaderAction';
import { useAppTheme } from '../../theme/useApptheme';
import { BASE_URL } from '../../config/urls';
import WelcomeValensModal from '../../components/modals/WelcomeValensModal';
import { useLanguage } from '../../i18n';
import { setPostPinnedState, sortPostsByPinned } from '../../utils/postPinning';
import { useProfileHeaderCollapse } from '../../hooks/useProfileHeaderCollapse';

const KYC_WELCOME_SHOWN_KEY = 'kycWelcomeShownEver';
const LEGACY_KYC_WELCOME_SHOWN_KEY = 'kycWelcomeShown';

const ProfileScreen = () => {
  const route = useRoute();
  const initialTab = route?.params?.initialTab || route?.params?.params?.initialTab;
  const [posts, setPosts] = useState([]);
  const [userId, setUserId] = useState();
  const [userDashboard, setUserDashboard] = useState();
  const [userData, setUserData] = useState();
  const [refreshing, setRefreshing] = useState(false);
  const [welcomeModalVisible, setWelcomeModalVisible] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const {
    compactLocked,
    resetProfileHeader,
    wrapOnRefresh,
    scrollViewProps,
  } = useProfileHeaderCollapse();

  const toast = useToast();
  const dispatch = useDispatch();
  const { bgStyle, textStyle } = useAppTheme();
  const { t } = useLanguage();

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
      showToastMessage(toast, 'danger', t('profile.noUserIdError'));
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
        showToastMessage(toast, 'danger', t('profile.fetchPostsError'));
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

          formattedImageUrl = formattedImageUrl.trim();

          if (formattedImageUrl.startsWith('http://') || formattedImageUrl.startsWith('https://')) {
            // already a full URL, use as-is
          } else if (formattedImageUrl.startsWith('/')) {
            formattedImageUrl = `${BASE_URL}${formattedImageUrl}`;
          } else {
            formattedImageUrl = `${BASE_URL}/${formattedImageUrl}`;
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
        showToastMessage(toast, 'danger', t('profile.fetchProfileError'));
      }

      // Dashboard
      if (dashRes.statusCode === 200) {
        setUserDashboard(dashRes.data.dashboardData);
      } else {
        showToastMessage(toast, 'danger', t('profile.fetchDashboardError'));
      }
    } catch (error) {
      console.error('Error fetching profile screen data:', error);
      showToastMessage(toast, 'danger', t('profile.networkError'));
    } finally {
      dispatch(hideLoader());
    }
  }, [dispatch, toast, t]);

  // Run on screen focus
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      resetProfileHeader();
      (async () => {
        if (!isActive) return;
        await fetchAllData();
      })();
      return () => {
        isActive = false;
      };
    }, [fetchAllData, resetProfileHeader])
  );

  const onRefresh = wrapOnRefresh(async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshKey(prev => prev + 1);
    setRefreshing(false);
  });

  const handlePostPinChanged = useCallback(async (postId, pinned) => {
    try {
      setPosts(prevPosts => setPostPinnedState(prevPosts, postId, pinned));
      return await fetchProfilePosts();
    } catch (error) {
      console.error('Error refreshing posts after pin/unpin:', error);
      setPosts(prevPosts => setPostPinnedState(prevPosts, postId, pinned));
      return null;
    }
  }, [fetchProfilePosts]);

const profileTabsProps = useMemo(() => ({
  post: posts,
  displayName: userData?.userName,
  userData: userData,
  dashboard: userDashboard,
  loggedInUserId: userId,
  refreshKey: refreshKey,
  onPostPinChanged: handlePostPinChanged,
  scrollEnabled: false,
  initialTab,
}), [posts, userData, userDashboard, userId, refreshKey, handlePostPinChanged, initialTab]);

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <ScrollView
        {...scrollViewProps}
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={userData?.profile == 'company' ? ['#C9A15a'] : ['#7c3aed']}
          />
        }
      >
        <ProfilePersonData
          displayName={
            userData?.displayName ||
            userData?.businessName ||
            userData?.companyProfile?.businessName ||
            userData?.company?.businessName
          }
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
        <ProfileTabs {...profileTabsProps} />
      </ScrollView>
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
    paddingBottom: 120
  },
});
