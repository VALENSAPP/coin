import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  Keyboard,
  DeviceEventEmitter,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import { useToast } from 'react-native-toast-notifications';
import { useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProfilePersonData from '../../components/profile/ProfilePersonalData';
import HighlightStories from '../../components/profile/HighLightStories';
import ProfileTabs from '../../components/profile/ProfileTabNavigation';
import { showToastMessage } from '../../components/displaytoastmessage';
import { follow, getPostByUser, getUserCredentials, getUserDashboard, unfollow } from '../../services/post';
import { followers as getFollowers } from '../../services/profile';
import { showLoader, hideLoader } from '../../redux/actions/LoaderAction';
import RBSheet from 'react-native-raw-bottom-sheet';
import TokenPurchaseModal from '../../components/modals/TokenPurchaseModal';
import TokenSellModal from '../../components/modals/TokenSellModal';
import { getProfile } from '../../services/createProfile';
import { getUserTokenInfoByBlockChain } from '../../services/tokens';
import { useAppTheme } from '../../theme/useApptheme';
import { getFansubscriptionStatus } from '../../services/stirpe';
import { useLanguage } from '../../i18n';
import { setPostPinnedState, sortPostsByPinned } from '../../utils/postPinning';
import { isSameUserId, shouldOpenOwnProfile } from '../../utils/navigateToUserProfile';
import { useProfileHeaderCollapse } from '../../hooks/useProfileHeaderCollapse';

const Usersprofile = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { t } = useLanguage();
  const targetUserId = route.params?.userId || route.params?.params?.userId;
  const initialTab = route.params?.initialTab || route.params?.params?.initialTab; 

  const screenParams = route?.params?.params || route?.params || {};
  const returnTo = screenParams?.returnTo;
  const battleLiveFromRoute = Boolean(screenParams?.battleLive);

  const [posts, setPosts] = useState([]);
  const [userDashboard, setUserDashboard] = useState();
  const [userData, setUserData] = useState();
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followsMe, setFollowsMe] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [tokenAddress, setTokenAddress] = useState(null);
  const [purchaseAutoFocus, setPurchaseAutoFocus] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loggedInUserId, setLoggedInUserId] = useState(null);
  const [redirectingToOwnProfile, setRedirectingToOwnProfile] = useState(false);
  const {
    compactLocked,
    resetProfileHeader,
    wrapOnRefresh,
    scrollViewProps,
  } = useProfileHeaderCollapse();

  const toast = useToast();
  const dispatch = useDispatch();
  const purchaseSheetRef = useRef(null);
  const sellSheetRef = useRef(null);
  const { bgStyle, textStyle } = useAppTheme(userData?.profile);

  const fetchLoggedInUserId = useCallback(async () => {
    try {
      const id = await AsyncStorage.getItem('userId');
      setLoggedInUserId(id);
      return id;
    } catch (error) {
      console.error('Error fetching logged-in user ID:', error);
      return null;
    }
  }, []);

  const isActiveStatus = useCallback((value) => {
    if (value === true) return true;
    return String(value || '').toUpperCase() === 'ACTIVE';
  }, []);

  const checkSubscriptionStatus = useCallback(async (currentUserId) => {
    if (!targetUserId) return false;

    try {
      const response = await getFansubscriptionStatus(targetUserId);
      const data = response?.data;
      let hasSubscription = false;

      if (
        isActiveStatus(response?.status) ||
        isActiveStatus(data?.status) ||
        isActiveStatus(data?.subscriptionStatus) ||
        isActiveStatus(data?.subscription?.status) ||
        isActiveStatus(data?.fanSubscription?.status)
      ) {
        hasSubscription = true;
      } else if (typeof data?.isSubscribed === 'boolean') {
        hasSubscription = data.isSubscribed;
      } else if (Array.isArray(data?.subscriptions)) {
        hasSubscription = data.subscriptions.some((sub) => {
          const subscriberId = sub?.buyUserId || sub?.fanUserId || sub?.subscriberId;
          const matchesCurrentUser = currentUserId
            ? String(subscriberId || '') === String(currentUserId)
            : true;
          return matchesCurrentUser && isActiveStatus(sub?.status);
        });
      } else if (Array.isArray(data)) {
        hasSubscription = data.some((sub) => isActiveStatus(sub?.status));
      }

      setIsSubscribed(hasSubscription);
      return hasSubscription;
    } catch (error) {
      console.error('Error checking subscription status:', error);
    }

    setIsSubscribed(false);
    return false;
  }, [targetUserId, isActiveStatus]);

  const fetchProfilePosts = useCallback(async () => {
    if (!targetUserId) return null;

    const postsRes = await getPostByUser(targetUserId, 'normal');
    if (postsRes?.statusCode === 200) {
      const nextPosts = sortPostsByPinned(postsRes.data || []);
      setPosts(nextPosts);
      return nextPosts;
    }

    return null;
  }, [targetUserId]);

  const checkFollowsMe = useCallback(async (currentUserId, alreadyFollowing) => {
    if (!currentUserId || !targetUserId || alreadyFollowing) {
      setFollowsMe(false);
      return;
    }

    try {
      const followersRes = await getFollowers(currentUserId);
      const rows = followersRes?.data?.data ?? followersRes?.data ?? [];
      const followerIds = rows
        .map(rel => {
          const user =
            rel?.follower || rel?.followerUser || rel?.user || rel?.fromUser || rel?.from || null;
          return user?.id ?? user?._id ?? user?.userId ?? null;
        })
        .filter(Boolean)
        .map(id => String(id));
      setFollowsMe(followerIds.includes(String(targetUserId)));
    } catch (_error) {
      setFollowsMe(false);
    }
  }, [targetUserId]);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await getUserTokenInfoByBlockChain(targetUserId);
      if (response?.statusCode === 200 && response?.data) {
        setTokenAddress(response.data.data?.tokenAddress);
      }
    } catch (err) {
      console.error('Error fetching profile token info:', err);
    }
  }, [targetUserId]);

  const fetchAllData = useCallback(async () => {
    if (!targetUserId) {
      showToastMessage(toast, 'danger', t('usersProfile.noUserIdError'));
      return;
    }

    dispatch(showLoader());

    try {
      const currentUserId = await fetchLoggedInUserId();

      await Promise.all([
        fetchProfile(),
        checkSubscriptionStatus(currentUserId),
      ]);

      const [postsRes, userRes, dashRes] = await Promise.all([
        getPostByUser(targetUserId, 'normal'),
        getUserCredentials(targetUserId),
        getUserDashboard(targetUserId),
      ]);
      if (postsRes?.statusCode === 200) {
        setPosts(sortPostsByPinned(postsRes.data || []));
      } else {
        showToastMessage(
          toast,
          'danger',
          postsRes?.data?.message || t('usersProfile.fetchPostsError'),
        );
      }

      if (userRes?.statusCode === 200) {
        setUserData(userRes.data?.user || userRes.data);
        const following = !!userRes.data?.isFollow;
        setIsFollowing(following);
        const apiFollowsMe =
          userRes.data?.isFollowedBy ??
          userRes.data?.followsMe ??
          userRes.data?.isFollowBack;
        if (typeof apiFollowsMe === 'boolean') {
          setFollowsMe(apiFollowsMe);
        } else {
          await checkFollowsMe(currentUserId, following);
        }
      } else {
        showToastMessage(
          toast,
          'danger',
          userRes?.data?.message || t('usersProfile.fetchProfileError'),
        );
      }

      if (dashRes?.statusCode === 200) {
        setUserDashboard(dashRes.data?.dashboardData);
      } else {
        showToastMessage(
          toast,
          'danger',
          dashRes?.data?.message || t('usersProfile.fetchDashboardError'),
        );
      }
    } catch (error) {
      console.error('Error fetching profile screen data:', error);
      showToastMessage(toast, 'danger', t('usersProfile.networkError'));
    } finally {
      dispatch(hideLoader());
    }
  }, [targetUserId, toast, dispatch, fetchProfile, fetchLoggedInUserId, checkSubscriptionStatus, checkFollowsMe, t]);

  const toggleFollow = async () => {

    if (!targetUserId || followBusy) return;
    setFollowBusy(true);

    try {
      const currentlyFollowing = isFollowing === true;

      if (currentlyFollowing) {
        sellSheetRef.current?.open();
      } else {
        purchaseSheetRef.current?.open();
      }
    } catch (e) {
      console.error('Toggle follow error:', e);
      showToastMessage(toast, 'danger', t('usersProfile.followActionFailed'));
    } finally {
      setFollowBusy(false);
    }
  };

  const executeFollowAction = async () => {
    if (!targetUserId) return;

    try {
      const res = !isFollowing
        ? await follow(targetUserId)
        : await unfollow(targetUserId);

      const ok = res?.statusCode === 200 && (res?.success ?? true);

      if (!ok) {
        showToastMessage(
          toast,
          'danger',
          res?.data?.message || res?.message || t('usersProfile.followUpdateError'),
        );
        return false;
      } else {
        const serverVal = res?.data?.following;
        const resolvedFollowing = typeof serverVal === 'boolean' ? serverVal : !isFollowing;
        setIsFollowing(resolvedFollowing);
        return true;
      }
    } catch (e) {
      showToastMessage(
        toast,
        'danger',
        e?.response?.data?.message || t('usersProfile.somethingWentWrong'),
      );
      return false;
    } finally {
      setFollowBusy(false);
      onRefresh();
    }
  };

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('PAYMENT_COMPLETED', (data) => {
      console.log('✅ Payment completed event received in Usersprofile:', data);
      const paymentStatus = String(data?.status || '').toLowerCase();
      const isPaymentSuccess = !['failed', 'cancelled', 'canceled'].includes(paymentStatus);
      if (isPaymentSuccess) {
        setIsSubscribed(true);
      }
      fetchAllData();
    });

    return () => subscription.remove();
  }, [fetchAllData]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      resetProfileHeader();

      const loadData = async () => {
        if (!isActive) return;
        const currentUserId = await fetchLoggedInUserId();
        if (!isActive || !targetUserId) return;

        const openOwnProfile = await shouldOpenOwnProfile(targetUserId, currentUserId);
        if (openOwnProfile) {
          setRedirectingToOwnProfile(true);
          navigation.navigate('ProfileMain', {
            screen: 'Profile',
            params: {
              returnTo,
              ...screenParams,
            },
          });
          return;
        }

        setRedirectingToOwnProfile(false);
        await fetchAllData();
      };

      loadData();

      return () => {
        isActive = false;
      };
    }, [fetchAllData, fetchLoggedInUserId, navigation, resetProfileHeader, returnTo, screenParams, targetUserId]),
  );

  const onRefresh = wrapOnRefresh(async () => {
    setRefreshing(true);
    await fetchAllData();
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

  const handleTokenModalClose = () => {
    purchaseSheetRef.current?.close?.();
  };

  const handleTokenPurchase = async () => {
    purchaseSheetRef.current?.close?.();
  };

  const handleTokenSell = useCallback(async () => {
    sellSheetRef.current?.close();
    showToastMessage(toast, 'success', t('usersProfile.tokensSoldSuccess'));
    await fetchAllData();
  }, [fetchAllData, toast]);

  const handleModalClose = useCallback(() => {
    Keyboard.dismiss();
    setPurchaseAutoFocus(false);
  }, []);

  const isOwnProfileView = isSameUserId(loggedInUserId, targetUserId);

  if (redirectingToOwnProfile || isOwnProfileView) {
    return null;
  }

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <ScrollView
        {...scrollViewProps}
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
          />
        }
      >
        <ProfilePersonData
          displayName={userData?.displayName}
          username={userData?.userName}
          profilepic={userData?.image}
          bio={userData?.bio}
          profileType={userData?.profile}
          dashboard={userDashboard}
          fromUsersProfile={true}
          isFollowing={isFollowing}
          followsMe={followsMe}
          onToggleFollow={toggleFollow}
          followBusy={followBusy}
          targetUserId={targetUserId}
          purchaseSheetRef={purchaseSheetRef}
          userData={userData}
          executeFollowAction={executeFollowAction}
          returnByTo={returnTo}
          screenParams={screenParams}
          compactLocked={compactLocked}
         
        />

        <View>
          <HighlightStories userData={userData} />
        </View>

        <ProfileTabs
          post={posts}
          displayName={userData?.userName}
          userData={userData ? { ...userData, battleLive: battleLiveFromRoute } : userData}
          profileType={userData?.profile}
          dashboard={userDashboard}
          targetUserId={targetUserId}
          isSubscribed={isSubscribed}
          loggedInUserId={loggedInUserId}
          onPostPinChanged={handlePostPinChanged}
          scrollEnabled={false}
          initialTab={initialTab}
        />
      </ScrollView>

      {/* Token Purchase Modal */}
      <RBSheet
        ref={purchaseSheetRef}
        height={500}
        openDuration={250}
        draggable={true}
        closeOnPressMask={true}
        customModalProps={{ statusBarTranslucent: true }}
        onOpen={() => setPurchaseAutoFocus(true)}
        onClose={handleModalClose}
        customStyles={{
          container: [{
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            bottom: -30,
          }, bgStyle],
          draggableIcon: {
            backgroundColor: '#ccc',
            width: 60,
          },
        }}
      >
        <TokenPurchaseModal
          onClose={handleTokenModalClose}
          onPurchase={handleTokenPurchase}
          hasFollowing={true}
          autoFocus={purchaseAutoFocus}
          vendorid={targetUserId}
        />
      </RBSheet>

      {/* Token Sell Modal */}
      <RBSheet
        ref={sellSheetRef}
        height={550}
        openDuration={250}
        draggable={true}
        closeOnPressMask={true}
        customModalProps={{ statusBarTranslucent: true }}
        onOpen={() => setPurchaseAutoFocus(true)}
        onClose={handleModalClose}
        customStyles={{
          container: [{
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            bottom: -30,
          }, bgStyle],
          draggableIcon: {
            backgroundColor: '#ccc',
            width: 60,
          },
        }}
      >
        <TokenSellModal
          onSell={handleTokenSell}
          userId={targetUserId}
          tokenAddress={tokenAddress}
        />
      </RBSheet>
    </SafeAreaView>
  );
};

export default Usersprofile;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 20,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 120,
  },
});