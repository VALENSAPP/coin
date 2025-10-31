import React, { memo, useCallback } from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import PostsScreen from '../profile/PostScreen';
import ReelsScreen from '../profile/ReelsScreen';
import TaggedScreen from '../profile/TaggedScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { LockKey, ProfileReelIcon } from '../../assets/icons';

const Tab = createMaterialTopTabNavigator();

// Memoize the ProfileTabs component to prevent unnecessary re-renders
const ProfileTabs = memo(({ post }) => {
  // Memoize the PostsScreen render function to prevent recreation on every render
  const renderPostsScreen = useCallback((navProps) => (
    <PostsScreen {...navProps} postCheck={post} />
  ), [post]);

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarShowLabel: false,
        swipeEnabled: true,
        lazy: true,
        lazyPlaceholder: () => null,
        tabBarStyle: {
          marginTop: 15,
          height: 52,
          backgroundColor: '#fff',   // match card style
          elevation: 2,              // subtle shadow
          shadowOpacity: 0.08,
          shadowRadius: 4,
        },
        tabBarIndicatorStyle: {
          backgroundColor: '#5a2d82', // purple underline
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
              color={focused ? '#5a2d82' : '#6b7280'} // purple active, gray inactive
            />
          ),
        }}
      >
        {renderPostsScreen}
      </Tab.Screen>

      <Tab.Screen
        name="Reels"
        component={() => {}}
        options={{
          tabBarIcon: ({ focused }) => (
            // <Ionicons
            //   name={focused ? 'bag' : 'bag-outline'}
            //   size={24}
            //   color={focused ? '#5a2d82' : '#6b7280'}
            // />
            <ProfileReelIcon fill={focused ? '#5a2d82' : '#6b7280'} height={24} width={24}/>
          ),
        }}
      />

      <Tab.Screen
        name="PrivateContent"
        component={ReelsScreen} 
        options={{
          tabBarIcon: ({ focused }) => (
            // <Ionicons
            //   name={focused ? 'bag' : 'bag-outline'}
            //   size={24}
            //   color={focused ? '#5a2d82' : '#6b7280'}
            // />
            <LockKey fill={focused ? '#5a2d82' : '#6b7280'} height={24} width={24} />
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

  );
});

ProfileTabs.displayName = 'ProfileTabs';

export default ProfileTabs;
