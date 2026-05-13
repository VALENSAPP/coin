import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  Keyboard,
  DeviceEventEmitter,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useToast } from 'react-native-toast-notifications';
import { useDispatch } from 'react-redux';
import { useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProfilePersonData from '../../components/profile/ProfilePersonalData';
import HighlightStories from '../../components/profile/HighLightStories';
import ProfileTabs from '../../components/profile/ProfileTabNavigation';
import { showToastMessage } from '../../components/displaytoastmessage';
import { follow, getPostByUser, getUserCredentials, getUserDashboard, unfollow } from '../../services/post';
import { showLoader, hideLoader } from '../../redux/actions/LoaderAction';
import RBSheet from 'react-native-raw-bottom-sheet';
import TokenPurchaseModal from '../../components/modals/TokenPurchaseModal';
import TokenSellModal from '../../components/modals/TokenSellModal';
import { getProfile } from '../../services/createProfile';
import { getUserTokenInfoByBlockChain } from '../../services/tokens';
import { useAppTheme } from '../../theme/useApptheme';
import { getFansubscriptionStatus } from '../../services/stirpe';
import { setPostPinnedState, sortPostsByPinned } from '../../utils/postPinning';

const Usersprofile = () => {
  const route = useRoute();
  const { userId: targetUserId } = route.params

  const screenParams = route?.params?.params || route?.params || {};
  const returnTo = screenParams?.returnTo;
  const battleLiveFromRoute = Boolean(screenParams?.battleLive);

  console.log(returnTo,"7777777777")

  const [posts, setPosts] = useState([]);
  const [userDashboard, setUserDashboard] = useState();
  const [userData, setUserData] = useState();
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [tokenAddress, setTokenAddress] = useState(null);
  const [purchaseAutoFocus, setPurchaseAutoFocus] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loggedInUserId, setLoggedInUserId] = useState(null);
  const [compactLocked, setCompactLocked] = useState(false);
  const profileScrollY = useRef(new Animated.Value(0)).current;
  const compactLockedRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchLastYRef = useRef(0);

  const toast = useToast();
  const dispatch = useDispatch();
  const purchaseSheetRef = useRef(null);
  const sellSheetRef = useRef(null);
  const { bgStyle, textStyle } = useAppTheme(userData?.profile);

  useEffect(() => {
    compactLockedRef.current = compactLocked;
  }, [compactLocked]);


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

  const fetchProfile = useCallback(async () => {
    try {
      const response = await getUserTokenInfoByBlockChain(targetUserId);
      if (response?.statusCode === 200 && response?.data) {
        setTokenAddress(response.data.data?.tokenAddress);
      }
      console.log(response,'data for the user profiule other ß')
    } catch (err) {
      console.error('Error fetching profile token info:', err);
    }
  }, [targetUserId]);

  const fetchAllData = useCallback(async () => {
    if (!targetUserId) {
      showToastMessage(toast, 'danger', 'No userId in route params');
      return;
    }

    dispatch(showLoader());

    try {
      const currentUserId = await fetchLoggedInUserId();
      
      await Promise.all([
        fetchProfile(),
        checkSubscriptionStatus(currentUserId)
      ]);

      const [postsRes, userRes, dashRes] = await Promise.all([
        getPostByUser(targetUserId,'normal'),
        getUserCredentials(targetUserId),
        getUserDashboard(targetUserId),
      ]);
console.log(userRes,'data in ueser profile efrafaha')
      if (postsRes?.statusCode === 200) {
        setPosts(sortPostsByPinned(postsRes.data || []));
      } else {
        showToastMessage(toast, 'danger', postsRes?.data?.message || 'Failed to fetch posts');
      }

      if (userRes?.statusCode === 200) {
        console.log('userres for postres------->>>>>>>>>>>>>>>>>>',userRes.data);
        
        setUserData(userRes.data?.user || userRes.data);
        setIsFollowing(userRes.data?.isFollow);
      } else {
        showToastMessage(toast, 'danger', userRes?.data?.message || 'Failed to fetch profile');
      }

      if (dashRes?.statusCode === 200) {
        setUserDashboard(dashRes.data?.dashboardData);
      } else {
        showToastMessage(toast, 'danger', dashRes?.data?.message || 'Failed to fetch dashboard');
      }

    } catch (error) {
      console.error('Error fetching profile screen data:', error);
      showToastMessage(toast, 'danger', 'Network error occurred');
    } finally {
      dispatch(hideLoader());
    }
  }, [targetUserId, toast, dispatch, fetchProfile, fetchLoggedInUserId, checkSubscriptionStatus]);

  const toggleFollow = async () => {
    console.log('targetUserId--------------------',targetUserId)
    console.log('followBusy--------------------',followBusy)

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
      showToastMessage(toast, 'danger', 'Action failed, please try again');
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
          res?.data?.message || res?.message || 'Unable to update follow',
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
        e?.response?.data?.message || 'Something went wrong',
      );
      return false;
    } finally {
      setFollowBusy(false);
      onRefresh();
    }
  }

  // ✅ Listen for payment completion events
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

      const loadData = async () => {
        if (!isActive) return;
        await fetchAllData();
      };

      loadData();

      return () => {
        isActive = false;
      };
    }, [fetchAllData])
  );

  const onRefresh = async () => {
    if (compactLockedRef.current) {
      expandProfileHeader();
      return;
    }
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  };

  const expandProfileHeader = useCallback(() => {
    if (!compactLockedRef.current) return;
    compactLockedRef.current = false;
    setCompactLocked(false);
  }, []);

  const handleProfileScroll = useCallback((event) => {
    const rawY = event?.nativeEvent?.contentOffset?.y ?? 0;
    const y = Math.max(0, rawY);
    profileScrollY.setValue(y);

    const dy = y - lastScrollYRef.current;
    lastScrollYRef.current = y;

    if (dy > 0 && y > 30 && !compactLockedRef.current) {
      compactLockedRef.current = true;
      setCompactLocked(true);
    }

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
    showToastMessage(toast, 'success', 'Tokens sold successfully!');
    await fetchAllData();
  }, [fetchAllData, toast]);

  const handleModalClose = useCallback(() => {
    Keyboard.dismiss();
    setPurchaseAutoFocus(false);
  }, []);

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
          <HighlightStories userData={userData}/>
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
        />
      </Animated.ScrollView>

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
  },
});
