import React, { memo, useCallback, useRef, useState } from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import PostsScreen from '../profile/PostScreen';
import ReelsScreen from '../profile/ReelsScreen';
import TaggedScreen from '../profile/TaggedScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { LockKey, ProfileReelIcon } from '../../assets/icons';
import { useFocusEffect } from '@react-navigation/native';
import SubscribeModal from '../modals/SubscriptionModal';

const Tab = createMaterialTopTabNavigator();

const ProfileTabs = memo(({ post }) => {
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false); // 👈 track if user already subscribed

  // Memoize posts screen
  const renderPostsScreen = useCallback(
    (navProps) => <PostsScreen {...navProps} postCheck={post} />,
    [post],
  );

  // ✅ subscription confirmation handler
  const handleSubscription = () => {
    // Call your subscription API or logic here
    console.log('User subscribed successfully!');
    setIsSubscribed(true);
  };

  // ✅ wrapper component for PrivateContent
  const PrivateContentWrapper = (props) => {
    useFocusEffect(
      useCallback(() => {
        if (!isSubscribed) {
          // show modal if not subscribed
          setShowSubscribeModal(true);
        }
      }, [isSubscribed])
    );

    // Only show content if subscribed
    return isSubscribed ? (
      <ReelsScreen {...props} />
    ) : (
      // Optional: show a placeholder while modal is visible
      <></>
    );
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
            backgroundColor: '#5a2d82',
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
                color={focused ? '#5a2d82' : '#6b7280'}
              />
            ),
          }}
        >
          {renderPostsScreen}
        </Tab.Screen>

        <Tab.Screen
          name="Reels"
          component={ReelsScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <ProfileReelIcon
                fill={focused ? '#5a2d82' : '#6b7280'}
                height={24}
                width={24}
              />
            ),
          }}
        />

        {/* ✅ Private Content with Subscription Modal */}
        <Tab.Screen
          name="PrivateContent"
          component={PrivateContentWrapper}
          options={{
            tabBarIcon: ({ focused }) => (
              <LockKey
                fill={focused ? '#5a2d82' : '#6b7280'}
                height={24}
                width={24}
              />
            ),
          }}
        />

        <Tab.Screen
          name="Tagged"
          component={TaggedScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <MaterialCommunityIcons
                name={focused ? 'lightning-bolt' : 'lightning-bolt-outline'}
                size={24}
                color={focused ? '#5a2d82' : '#6b7280'}
              />
            ),
          }}
        />
      </Tab.Navigator>

      {/* ✅ Subscription Modal */}
      <SubscribeModal
        visible={showSubscribeModal}
        onClose={() => setShowSubscribeModal(false)}
        membershipPrice={19.99}
        onPaymentDone={(info) => {
          console.log('Payment info:', info);
          // call API or navigate
        }}
      />
    </>
  );
});

ProfileTabs.displayName = 'ProfileTabs';
export default ProfileTabs;