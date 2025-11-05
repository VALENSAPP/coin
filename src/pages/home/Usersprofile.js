import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Keyboard,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useToast } from 'react-native-toast-notifications';
import { useDispatch } from 'react-redux';
import { useRoute } from '@react-navigation/native';
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

const Usersprofile = () => {
  const route = useRoute();
  const { userId: targetUserId } = route.params;

  const [posts, setPosts] = useState([]);
  const [userDashboard, setUserDashboard] = useState();
  const [userData, setUserData] = useState();
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [tokenAddress, setTokenAddress] = useState(null);
  const [purchaseAutoFocus, setPurchaseAutoFocus] = useState(false);

  const toast = useToast();
  const dispatch = useDispatch();
  const purchaseSheetRef = useRef(null);
  const sellSheetRef = useRef(null);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await getUserTokenInfoByBlockChain(targetUserId);
      if (response?.statusCode === 200 && response?.data) {
        setTokenAddress(response.data.data?.tokenAddress);
      }
    } catch (err) {
      console.error('Error fetching profile token info:', err);
      // Don't show toast error for this, as it's not critical
    }
  }, [targetUserId]);

  const fetchAllData = useCallback(async () => {
    if (!targetUserId) {
      showToastMessage(toast, 'danger', 'No userId in route params');
      return;
    }

    dispatch(showLoader());

    try {
      // Fetch profile token info first
      await fetchProfile();

      const [postsRes, userRes, dashRes] = await Promise.all([
        getPostByUser(targetUserId),
        getUserCredentials(targetUserId),
        getUserDashboard(targetUserId),
      ]);

      // Handle posts
      if (postsRes?.statusCode === 200) {
        setPosts(postsRes.data || []);
      } else {
        showToastMessage(toast, 'danger', postsRes?.data?.message || 'Failed to fetch posts');
      }

      // Handle user data
      if (userRes?.statusCode === 200) {
        setUserData(userRes.data?.user || userRes.data);
        setIsFollowing(userRes.data?.isFollow);
      } else {
        showToastMessage(toast, 'danger', userRes?.data?.message || 'Failed to fetch profile');
      }

      // Handle dashboard
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
  }, [targetUserId, toast, dispatch, fetchProfile]);

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
      showToastMessage(toast, 'danger', 'Action failed, please try again');
    } finally {
      setFollowBusy(false);
    }
  };

  const executeFollowAction = async (isFollowing) => {
    console.log('isFollowing----->>>>>>>>>>>>>>>>>>>',isFollowing);
    
    if (!targetUserId) return;
    const key = String(targetUserId);

    try {
      const res = isFollowing
        ? await follow(targetUserId)
        : await unfollow(targetUserId);

      const ok = res?.statusCode === 200 && (res?.success ?? true);

      if (!ok) {
        setIsFollowing(prev => ({ ...prev, [key]: !isFollowing }));
        showToastMessage(
          toast,
          'danger',
          res?.data?.message || res?.message || 'Unable to update follow',
        );
      } else {
        const serverVal = res?.data?.following;
        if (typeof serverVal === 'boolean') {
          setIsFollowing(prev => ({ ...prev, [key]: serverVal }));
        }
        // showToastMessage(
        //   toast,
        //   'success',
        //   isFollowing ? 'Successfully Vallowed!' : 'Unfollowed',
        // );
      }
    } catch (e) {
      setIsFollowing(prev => ({ ...prev, [key]: !isFollowing }));
      showToastMessage(
        toast,
        'danger',
        e?.response?.data?.message || 'Something went wrong',
      );
    } finally {
      setFollowBusy(false);
    }
  }

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
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  };

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
  }, []);

  const handleModalClose = useCallback(() => {
    Keyboard.dismiss();
    setPurchaseAutoFocus(false);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
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
          dashboard={userDashboard}
          fromUsersProfile={true}
          isFollowing={isFollowing}
          onToggleFollow={toggleFollow}
          followBusy={followBusy}
          targetUserId={targetUserId}
          purchaseSheetRef={purchaseSheetRef}
        />

        <View>
          <HighlightStories />
        </View>

        <ProfileTabs post={posts} />
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
          container: {
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            backgroundColor: '#f8f2fd',
            bottom: -30,
          },
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
          container: {
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            backgroundColor: '#f8f2fd',
            bottom: -30,
          },
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
    backgroundColor: '#f8f2fd',
    paddingBottom: 20,
  },
  scrollContainer: {
    flexGrow: 1,
  },
});