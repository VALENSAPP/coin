import React, { memo, useCallback, useState, useRef } from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import PostsScreen from '../profile/PostScreen';
import ReelsScreen from '../profile/ReelsScreen';
import TaggedScreen from '../profile/TaggedScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { LockKey, ProfileReelIcon } from '../../assets/icons';
import SubscribeModal from '../modals/SubscriptionModal';

const Tab = createMaterialTopTabNavigator();

const ProfileTabs = memo(({ post, displayName, userData, dashboard }) => {
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [previousTabName, setPreviousTabName] = useState('Posts');
  const navigationRef = useRef(null);

  // Memoize posts screen
  const renderPostsScreen = useCallback(
    (navProps) => <PostsScreen {...navProps} postCheck={post} userData={userData} />,
    [post, userData],
  );

  const handleModalClose = () => {
    setShowSubscribeModal(false);
    
    // Navigate back to the previous tab
    if (navigationRef.current) {
      navigationRef.current.navigate(previousTabName);
    }
  };

  // ✅ subscription confirmation handler
  const handleSubscription = () => {
    console.log('User subscribed successfully!');
    setIsSubscribed(true);
    setShowSubscribeModal(false);
  };

  // ✅ wrapper component for PrivateContent
  const PrivateContentWrapper = (props) => {
    const isFocused = useIsFocused();

    React.useEffect(() => {
      if (isFocused && !isSubscribed) {
        setShowSubscribeModal(true);
      }
    }, [isFocused, isSubscribed]);

    return isSubscribed ? <ReelsScreen {...props} /> : null;
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
          listeners={({ navigation }) => ({
            tabPress: () => {
              navigationRef.current = navigation;
              setPreviousTabName('Posts');
            },
          })}
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
          listeners={({ navigation }) => ({
            tabPress: () => {
              navigationRef.current = navigation;
              setPreviousTabName('Reels');
            },
          })}
        />

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
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              navigationRef.current = navigation;
              
              if (!isSubscribed) {
                // Don't prevent default - let tab switch happen
                // Modal will show via useEffect in PrivateContentWrapper
              }
            },
          })}
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
          listeners={({ navigation }) => ({
            tabPress: () => {
              navigationRef.current = navigation;
              setPreviousTabName('Tagged');
            },
          })}
        />
      </Tab.Navigator>

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
      />
    </>
  );
});

ProfileTabs.displayName = 'ProfileTabs';
export default ProfileTabs;