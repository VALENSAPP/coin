import React, { memo, useCallback, useState } from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useNavigation } from '@react-navigation/native';
import PostsScreen from '../profile/PostScreen';
import ReelsScreen from '../profile/ReelsScreen';
import TaggedScreen from '../profile/TaggedScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { LockKey, ProfileReelIcon } from '../../assets/icons';
import { useFocusEffect } from '@react-navigation/native';
import SubscribeModal from '../modals/SubscriptionModal';

const Tab = createMaterialTopTabNavigator();

// Dummy component that triggers navigation to full screen
const ReelsTabHandler = () => {
  const navigation = useNavigation();

  React.useEffect(() => {
    // Navigate to FlipsScreen in full screen when this tab is focused
    navigation.navigate('FlipsScreen'); // Replace 'FlipsScreen' with your actual route name
  }, [navigation]);

  return null; // Return nothing as we're navigating away
};

const ProfileTabs = memo(({ post, displayName }) => {
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Memoize posts screen
  const renderPostsScreen = useCallback(
    (navProps) => <PostsScreen {...navProps} postCheck={post} />,
    [post],
  );

  // ✅ subscription confirmation handler
  const handleSubscription = () => {
    console.log('User subscribed successfully!');
    setIsSubscribed(true);
  };

  // ✅ wrapper component for PrivateContent
  const PrivateContentWrapper = (props) => {
    useFocusEffect(
      useCallback(() => {
        if (!isSubscribed) {
          setShowSubscribeModal(true);
        }
      }, [isSubscribed])
    );

    return isSubscribed ? <ReelsScreen {...props} /> : <></>;
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

        {/* ✅ Reels tab now navigates to full screen */}
        <Tab.Screen
          name="Reels"
          component={ReelsTabHandler}
          options={{
            tabBarIcon: ({ focused }) => (
              <ProfileReelIcon
                fill={focused ? '#5a2d82' : '#6b7280'}
                height={24}
                width={24}
              />
            ),
          }}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              e.preventDefault(); // Prevent default tab behavior
              navigation.navigate('FlipsScreen'); // Navigate to full screen
            },
          })}
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
        }}
        displayName={displayName}
      />
    </>
  );
});

ProfileTabs.displayName = 'ProfileTabs';
export default ProfileTabs;