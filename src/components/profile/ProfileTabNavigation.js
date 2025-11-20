import React, { memo, useCallback, useState } from 'react';
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

const Tab = createMaterialTopTabNavigator();

// Dummy component that triggers navigation to full screen
const ReelsTabHandler = () => {
  // const navigation = useNavigation();

  // React.useEffect(() => {
  //   // Navigate to FlipsScreen in full screen when this tab is focused
  //   <ReelsScreen/>
  //   // navigation.navigate('FlipsScreen'); s// Replace 'FlipsScreen' with your actual route name
  // }, [navigation]);

  return <ReelsScreen />; // Return nothing as we're navigating away
};


const ProfileTabs = memo(({ post, displayName, userData, dashboard }) => {
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [privateKey, setPrivatKey] = useState(0);
  const [sctiveTab, setActiveTab] = useState('Posts');
  const [currentTabIndex, setCurrentTabIndex] = useState(0);
  const [previousTabIndex, setPreviousTabIndex] = useState(0);




  const { textStyle, text } = useAppTheme();

  // Memoize posts screen
  const renderPostsScreen = useCallback(
    (navProps) => <PostsScreen {...navProps} postCheck={post} userData={userData} />,
    [post, userData],
  );
  const navigation = useNavigation();

  const handleModalClose = () => {
    setShowSubscribeModal(false);

    setCurrentTabIndex(previousTabIndex``)
  };


  // ✅ subscription conf'/irmation handler
  const handleSubscription = () => {
    console.log('User subscribed successfully!');
    setIsSubscribed(false);
  };

  // ✅ wrapper component for PrivateContent
  const PrivateContentWrapper = (props) => {
    const isFocused = useIsFocused
    useCallback(() => {
      if (isFocused) {
        if (!isSubscribed) {
          setShowSubscribeModal(true);
        }
      }
    }, [isSubscribed])

    // return isSubscribed ? <ReelsScreen {...props} /> : <></>;
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
          component={ReelsScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <ProfileReelIcon
                fill={focused ? (text) : '#6b7280'}
                height={24}
                width={24}
              />
            ),
          }}
          listeners={{
            tabPress: () => {
              setPreviousTabIndex(currentTabIndex);
              setCurrentTabIndex(1);
            }
          }}
        // listeners={({ navigation }) => ({
        //   tabPress: (e) => {
        //     e.preventDefault(); // Prevent default tab behavior
        //     navigation.navigate('FlipsScreen'); // Navigate to full screen
        //   },
        // })}
        />

        {/* ✅ Private Content with Subscription Modal */}
        <Tab.Screen
          name="PrivateContent"
          component={PrivateContentWrapper}
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
            tabPress: () => {
              setPreviousTabIndex(currentTabIndex);
              setCurrentTabIndex(2);
              console.log('tab pree orr focudedd')
              if (!isSubscribed) {
                setPrivatKey(prev => prev + 1)
                setShowSubscribeModal(false);
                setTimeout(() => {
                  setShowSubscribeModal(true)
                }, 50)
              }
            },
          }}
          screenListeners={{
            state: (e) => {
              const index = e.data.state.index;
              const routeName = e.data.state.routeNames[index];

              setPreviousTab(currentTab);   // store last tab
              setCurrentTab(routeName);     // update current tab
            },
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
        />
      </Tab.Navigator>

      {/* ✅ Subscription Modal */}
      <SubscribeModal
        visible={showSubscribeModal}
        onClose={handleModalClose}
        membershipPrice={19.99}
        onPaymentDone={(info) => {
          console.log('Payment info:', info);
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