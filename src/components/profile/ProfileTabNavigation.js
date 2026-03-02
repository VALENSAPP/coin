import React, { memo, useCallback, useEffect, useState } from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import PostsScreen from '../profile/PostScreen';
import ReelsScreen from '../profile/ReelsScreen';
import TaggedScreen from '../profile/TaggedScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { LockKey, ProfileReelIcon } from '../../assets/icons';
import { useFocusEffect } from '@react-navigation/native';
import SubscribeModal from '../modals/SubscriptionModal';
import { useAppTheme } from '../../theme/useApptheme';
import PrivateContentScreen from './PrivateContentScreen';
import { getFansubscriptionStatus } from '../../services/stirpe';

const Tab = createMaterialTopTabNavigator();

// Dummy component that triggers navigation to full screen
const ReelsTabHandler = () => {
  return <ReelsScreen />; // Return nothing as we're navigating away
};

const ProfileTabs = memo(({
  post,
  displayName,
  userData,
  dashboard,
  targetUserId,
  isSubscribed: isSubscribedProp, // Receive from parent
  loggedInUserId // Receive from parent
}) => {
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [privateKey, setPrivatKey] = useState(0);
  const [activeTab, setActiveTab] = useState('Posts');
  const [currentTabIndex, setCurrentTabIndex] = useState(0);
  const [previousTabIndex, setPreviousTabIndex] = useState(0);

  const { textStyle, text } = useAppTheme();

  // Update local subscription state when prop changes
  useEffect(() => {
    const normalizedIsSubscribed =
      isSubscribedProp === true ||
      String(isSubscribedProp || '').toUpperCase() === 'ACTIVE' ||
      String(isSubscribedProp || '').toLowerCase() === 'true';
    setIsSubscribed(normalizedIsSubscribed);
  }, [isSubscribedProp]);
  const isOwnProfile = String(loggedInUserId || '') === String(userData?.id || '');
  const targetProfileId = targetUserId || userData?.id;

  const isActiveStatus = useCallback((value) => {
    if (value === true) return true;
    return String(value || '').toUpperCase() === 'ACTIVE';
  }, []);

  const getSubscriptionStatus = useCallback(async (id) => {
    if (!id || isOwnProfile) return true;

    try {
      const response = await getFansubscriptionStatus(id);
      const data = response?.data;

      let isActive = false;
      if (
        isActiveStatus(response?.status) ||
        isActiveStatus(data?.status) ||
        isActiveStatus(data?.subscriptionStatus) ||
        isActiveStatus(data?.subscription?.status) ||
        isActiveStatus(data?.fanSubscription?.status)
      ) {
        isActive = true;
      } else if (typeof data?.isSubscribed === 'boolean') {
        isActive = data.isSubscribed;
      } else if (Array.isArray(data?.subscriptions)) {
        isActive = data.subscriptions.some((sub) => isActiveStatus(sub?.status));
      } else if (Array.isArray(data)) {
        isActive = data.some((sub) => isActiveStatus(sub?.status));
      }

      setIsSubscribed(isActive);
      return isActive;
    } catch (error) {
      console.log('Error checking fan subscription status:', error);
      setIsSubscribed(false);
      return false;
    }
  }, [isOwnProfile, isActiveStatus]);

  // Memoize posts screen
  const renderPostsScreen = useCallback(
    (navProps) => <PostsScreen {...navProps} postCheck={post} userData={userData} />,
    [post, userData],
  );

  const renderReelsScreen = useCallback(
    (navProps) => <ReelsScreen {...navProps} postCheck={post} userData={userData} />,
    [post, userData],
  );

  const renderPrivateContentScreen = useCallback(
    (navProps) => (
      <PrivateContentScreen
        {...navProps}
        postCheck={post}
        userData={userData}
        isSubscribed={isSubscribed}
        loggedInUserId={loggedInUserId}
        onSubscribePress={() => setShowSubscribeModal(true)}
      />
    ),
    [post, userData, isSubscribed, loggedInUserId],
  );

  const navigation = useNavigation();

  const handleModalClose = () => {
    setShowSubscribeModal(false);
    setCurrentTabIndex(previousTabIndex);
  };

  // ✅ subscription confirmation handler
  const handleSubscription = () => {
    setIsSubscribed(true);
    setShowSubscribeModal(false);
  };

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          tabBarShowLabel: false,
          swipeEnabled: true,
          lazy: true,
          lazyPlaceholder: () => null,
          tabBarStyle: {
            marginTop: 15,
            height: 52,
            backgroundColor: '#fff',
            elevation: 2,
            shadowOpacity: 0.08,
            shadowRadius: 4,
          },
          tabBarIndicatorStyle: {
            backgroundColor: text,
            height: 3,
            borderRadius: 2,
          },
          tabBarIconStyle: {
            justifyContent: 'center',
            alignItems: 'center',
          },
          tabBarPressColor: 'transparent',
          tabBarPressOpacity: 0.7,
        }}
      >
        <Tab.Screen
          name="Posts"
          options={{
            tabBarIcon: ({ focused }) => (
              <Ionicons
                name={focused ? 'grid' : 'grid-outline'}
                size={24}
                color={focused ? (text) : '#6b7280'}
              />
            ),
          }}
          listeners={{
            tabPress: () => {
              setPreviousTabIndex(currentTabIndex);
              setCurrentTabIndex(0);
            }
          }}
        >
          {renderPostsScreen}
        </Tab.Screen>

        {/* ✅ Reels tab now navigates to full screen */}
        <Tab.Screen
          name="Reels"
          options={{
            tabBarIcon: ({ focused }) => (
              <ProfileReelIcon
                fill={focused ? (text) : '#6b7280'}
                height={24}
                width={24}
              />
            ),
          }}
          // listeners={{
          //   tabPress: () => {
          //     setPreviousTabIndex(currentTabIndex);
          //     setCurrentTabIndex(1);
          //   }
          // }}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              setPreviousTabIndex(currentTabIndex);
              setCurrentTabIndex(1);
              // e.preventDefault(); // Prevent default tab behavior
              // navigation.navigate('FlipsScreen'); // Navigate to full screen
            },
          })}
        >
          {renderReelsScreen}
        </Tab.Screen>

        {/* ✅ Private Content with Subscription Modal */}
        <Tab.Screen
          name="PrivateContent"
          // component={
          //   loggedInUserId === userData?.id || isSubscribed
          //     ? PrivateContentScreen
          //     : PrivateContentScreen
          // }
          options={{
            tabBarIcon: ({ focused }) => (
              <LockKey
                fill={focused ? (text) : '#6b7280'}
                height={24}
                width={24}
              />
            ),
          }}
          listeners={{
            tabPress: async () => {
              setPreviousTabIndex(currentTabIndex);
              setCurrentTabIndex(2);

              if (isOwnProfile || isSubscribed) {
                setShowSubscribeModal(false);
                return;
              }

              const hasActiveSubscription = await getSubscriptionStatus(targetProfileId);
              if (hasActiveSubscription) {
                setShowSubscribeModal(false);
                return;
              }

              if (!isOwnProfile) {
                setPrivatKey(prev => prev + 1);
                setShowSubscribeModal(false);
                setTimeout(() => {
                  setShowSubscribeModal(true);
                }, 50);
              }
            },
          }}
          >
          {renderPrivateContentScreen}  
        </Tab.Screen>

        {/* <Tab.Screen
          name="Tagged"
          component={TaggedScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <MaterialCommunityIcons
                name={focused ? 'lightning-bolt' : 'lightning-bolt-outline'}
                size={24}
                color={focused ? (text) : '#6b7280'}
              />
            ),
          }}
          listeners={{
            tabPress: () => {
              setPreviousTabIndex(currentTabIndex);
              setCurrentTabIndex(3);
            }
          }}
        /> */}
      </Tab.Navigator>

      {/* ✅ Subscription Modal - Only show if not subscribed */}
      {!isSubscribed && (
        <SubscribeModal
          visible={showSubscribeModal}
          onClose={handleModalClose}
          membershipPrice={19.99}
          onPaymentDone={(info) => {
            console.log('Payment info:', info);
            handleSubscription();
          }}
          displayName={displayName}
          userData={userData}
          dashboard={dashboard}
          targetUserId={targetUserId}
        />
      )}
    </>
  );
});

ProfileTabs.displayName = 'ProfileTabs';
export default ProfileTabs;
