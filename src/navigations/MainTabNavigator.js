// src/navigations/MainTabNavigator.js
import React, { useMemo, useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute, useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../pages/home';
import ProfileScreen from '../pages/profile';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';
import heartNotification from '../pages/home/HeartNotification';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import Settings from '../pages/settings';
import UserChat from '../pages/home/chatMessages/UserChat';
import ChatMessages from '../pages/home/chatMessages/ChatMessages';
import PostScreen from '../pages/post';
import FollowersFollowingScreen from '../pages/profile/FollowersScreen';
import ProfileEditScreen from '../pages/profile/editprofile';
import PostUploadPage from '../pages/post/uploadPost/Postupload'
import PostEditorScreen from '../pages/post/uploadPost/PostEditorScreen';
import InstagramPostCreator from '../pages/post/uploadPost/EditPostSelected';
import WalletScreen from '../pages/wallet';
import DepositeCash from '../pages/wallet/DepositeCash';
import CashOut from '../pages/wallet/CashOut';
import SendCoins from '../pages/wallet/SendCoins';
import PostView from '../components/profile/PostView';
import CreatorCoin from '../pages/profile/CreatorCoin';
import ShareProfile from '../pages/profile/ShareProfile';
import SavedPosts from '../pages/settings/SavedPosts';
import InviteScreen from '../pages/profile/InviteScreen';
import SearchScreen from '../pages/search';
import QuickBuy from '../pages/settings/QuickBuy';
import CashOutScreen from '../pages/settings/CashOutScreen';
import Usersprofile from '../pages/home/Usersprofile';
import Notification from '../pages/settings/Notification';
import Favourites from '../pages/home/Favourites';
import Following from '../pages/home/Following';
import HidePosts from '../pages/settings/HidePosts';
import subscription from '../pages/settings/Subscription';
import TextGradient from '../assets/textgradient/TextGradient';
import CreateMission from '../pages/post/uploadPost/CreateMission';

// Import Wallet Drawer Screens
import PortfolioScreen from '../pages/wallet/PortfolioScreen';
import MarketScreen from '../pages/wallet/MarketScreen';
import WalletDashboardScreen from '../pages/wallet';
import ActivityScreen from '../pages/wallet/ActivityScreen';
import CreatorsScreen from '../pages/wallet/CreatorsScreen';
import SettingsScreen from '../pages/wallet/SettingScreen';
import ChangePassword from '../pages/wallet/ChangePassword';
import WalletComponent from '../pages/wallet/WalletScreen';
import ProfileSettingsScreen from '../pages/wallet/ProfileSettings';
import VerificationStatusScreen from '../pages/wallet/VerificationStatus';
import PrivacySettingsScreen from '../pages/wallet/PrivacySettings';
import TwoFactorAuthScreen from '../pages/wallet/Two-FactorAuth';
import LoginHistoryScreen from '../pages/wallet/LoginHistory';
import SubventionSetupScreen from '../pages/wallet/Subscriptions';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

export default function MainTabNavigator() {
  const profileImage = useSelector(state => state.profileImage?.profileImg);
  const navigation = useNavigation();

  const HomeStack = useMemo(() => {
    return () => (
      <Stack.Navigator screenOptions={{ headerShown: false }} >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="HeartNotification" component={heartNotification} />
        <Stack.Screen name="ChatMessages" component={ChatMessages} />
        <Stack.Screen name="Favourites" component={Favourites} />
        <Stack.Screen name="Following" component={Following} />
        <Stack.Screen name="UserChat" component={UserChat} />
        <Stack.Screen name="UsersProfile" component={Usersprofile} />
      </Stack.Navigator>
    );
  }, []);

  const ProfileStack = useMemo(() => {
    return () => (
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Profile">
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Settings" component={Settings} />
        <Stack.Screen name="FollowersFollowingScreen" component={FollowersFollowingScreen} />
        <Stack.Screen name="EditProfile" component={ProfileEditScreen} options={{ headerShown: true, headerStyle: { backgroundColor: '#f8f2fd' }, }} />
        <Stack.Screen name="PostUpload" component={PostUploadPage} options={{ headerShown: false }} />
        <Stack.Screen name="PostEditor" component={PostEditorScreen} options={{ headerShown: false }} />
        <Stack.Screen name="SelectedPost" component={InstagramPostCreator} options={{ headerShown: false }} />
        <Stack.Screen name="PostView" component={PostView} options={{ headerShown: false }} />
        <Stack.Screen name="CreatorCoin" component={CreatorCoin} options={{ headerShown: false }} />
        <Stack.Screen name="ShareProfile" component={ShareProfile} options={{ headerShown: false }} />
        <Stack.Screen name="SavedPost" component={SavedPosts} options={{ headerShown: false }} />
        <Stack.Screen name="QuickBuy" component={QuickBuy} options={{ headerShown: false }} />
        <Stack.Screen name="CashOutScreen" component={CashOutScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Invite" component={InviteScreen} options={{ headerShown: false }} />
        <Stack.Screen name="notificationEnable" component={Notification} options={{ headerShown: false }} />
        <Stack.Screen name="HidePosts" component={HidePosts} options={{ headerShown: false }} />
        <Stack.Screen name="subscription" component={subscription} options={{ headerShown: false }} />
      </Stack.Navigator>
    );
  }, []);

  // Enhanced Wallet Stack Navigator with ALL drawer screens
  const WalletStack = useMemo(() => {
    return ({ route }) => {
      const initialScreen = route?.params?.screen || 'Dashboard';

      return (
        <Stack.Navigator
          initialRouteName={initialScreen}
          screenOptions={({ navigation }) => ({
            headerShown: true,
            headerStyle: {
              backgroundColor: '#f8f2fd',
              elevation: 0,
              shadowOpacity: 0,
            },
            headerTitleStyle: {
              fontWeight: 'bold',
              color: '#111',
            },
            headerTintColor: '#111',
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => navigation.openDrawer()}
                style={{ marginLeft: 15 }}
              >
                <Ionicons name="menu" size={28} color="#5a2d82" />
              </TouchableOpacity>
            ),
            headerTitle: () => (
              <TextGradient
                style={{ fontWeight: "bold", fontSize: 20 }}
                locations={[0, 1]}
                colors={["#513189bd", "#e54ba0"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                text="VALENS"
              />
            ),
            headerTitleAlign: 'center',
          })}
        >
          {/* Original Wallet Screens */}
          <Stack.Screen
            name="WalletMain"
            component={WalletComponent}
            options={{ headerTitle: 'Wallet' }}
          />
          <Stack.Screen
            name="DepositeCash"
            component={DepositeCash}
            options={{
              headerTitle: 'Deposit',
              headerTitleAlign: 'center'
            }}
          />
          <Stack.Screen
            name="CashOut"
            component={CashOut}
            options={{
              headerTitle: 'Cash Out',
              headerTitleAlign: 'center'
            }}
          />
          <Stack.Screen
            name="SendCoin"
            component={SendCoins}
            options={{
              headerTitle: 'Send',
              headerTitleAlign: 'center',
            }}
          />

          {/* Drawer Wallet Screens - All accessible from drawer */}
          <Stack.Screen
            name="Dashboard"
            component={WalletDashboardScreen}
            options={{ headerTitle: 'Dashboard' }}
          />
          <Stack.Screen
            name="Portfolio"
            component={PortfolioScreen}
            options={{ headerTitle: 'Portfolio' }}
          />
          <Stack.Screen
            name="Market"
            component={MarketScreen}
            options={{ headerTitle: 'Market' }}
          />
          <Stack.Screen
            name="Activity"
            component={ActivityScreen}
            options={{ headerTitle: 'Activity' }}
          />
          <Stack.Screen
            name="Creators"
            component={CreatorsScreen}
            options={{ headerTitle: 'Creators' }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ headerTitle: 'Settings' }}
          />
          <Stack.Screen
            name="ChangePassword"
            component={ChangePassword}
            options={{ headerTitle: 'Change Password' }}
          />
          <Stack.Screen
            name="CreatorProfile"
            component={Usersprofile}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="VerificationStatus"
            component={VerificationStatusScreen}
            options={{ headerTitle: 'Verification Status' }}
          />
          <Stack.Screen
            name="PrivacySettings"
            component={PrivacySettingsScreen}
            options={{ headerTitle: 'Privacy Settings' }}
          />
          <Stack.Screen
            name="TwoFactorAuth"
            component={TwoFactorAuthScreen}
            options={{ headerTitle: 'Two-Factor Auth' }}
          />
          <Stack.Screen
            name="LoginHistory"
            component={LoginHistoryScreen}
            options={{ headerTitle: 'Login History' }}
          />
          <Stack.Screen
            name="SubscriptionSetup"
            component={SubventionSetupScreen}
            options={{ headerTitle: 'Subvention Program Setup' }}
          />
        </Stack.Navigator>
      );
    };
  }, []);

  const PostStack = useMemo(() => {
    return () => (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Add" component={PostScreen} />
        <Stack.Screen name="SelectedPost" component={InstagramPostCreator} options={{ headerShown: false }} />
        <Stack.Screen name="PostEditor" component={PostEditorScreen} options={{ headerShown: false }} />
        <Stack.Screen name="CreateMission" component={CreateMission} options={{ headerShown: false }} />
      </Stack.Navigator>
    );
  }, []);

  // Memoize tab bar styles
  const defaultTabBarStyle = useMemo(() => ({
    display: 'flex',
    backgroundColor: '#f8f2fd',
    borderTopWidth: 1.5,
    borderTopColor: '#dbdbdb',
    height: 50,
    position: 'absolute',
    bottom: Platform.OS == "android" ? 0 : 25,
    left: 0,
    right: 0,
    paddingTop: 5
  }), []);

  const reelsTabBarStyle = useMemo(() => ({
    backgroundColor: '#000',
    borderTopWidth: 1.5,
    borderTopColor: '#fff',
    height: 50,
    position: 'absolute',
    bottom: Platform.OS == "android" ? 0 : 25,
    left: 0,
    right: 0,
    paddingTop: 5
  }), []);

  const hiddenTabBarStyle = useMemo(() => ({
    display: 'none'
  }), []);

  // Memoize screen options function
  const getScreenOptions = useCallback(({ route, navigation }) => {
    const isFocused = navigation.isFocused();

    const baseOptions = {
      headerShown: false,
      tabBarShowLabel: false,
      tabBarActiveTintColor: route.name === 'Reels' && isFocused ? '#fff' : '#000',
      tabBarInactiveTintColor: route.name === 'Reels' && isFocused ? '#fff' : '#666',
      tabBarHideOnKeyboard: true,
      tabBarIcon: ({ focused, color, size }) => {
        const isReelsFocused = route.name === 'Reels' && isFocused;
        const iconColor = isReelsFocused ? '#fff' : color;

        switch (route.name) {
          case 'HomeMain':
            return <Ionicons name={focused ? 'home' : 'home-outline'} size={26} color={iconColor} />;
          case 'Search':
            return <Ionicons name={focused ? 'search' : 'search-outline'} size={25} color={iconColor} />;
          case 'Add':
            return <FontAwesome name={'plus-square-o'} size={28} color={iconColor} />;
          case 'wallet':
            return <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={26} color={iconColor} />;
          case 'ProfileMain':
            if (profileImage) {
              return (
                <Image
                  source={{ uri: profileImage }}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    borderWidth: focused ? 2 : 0,
                    borderColor: focused ? iconColor : 'transparent'
                  }}
                />
              );
            } else {
              return <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={26} color={iconColor} />;
            }
          default:
            return null;
        }
      },
    };

    if (route.name === 'Search' || route.name === 'wallet') {
      return {
        ...baseOptions,
        tabBarStyle: defaultTabBarStyle,
      };
    }

    return baseOptions;
  }, [profileImage, defaultTabBarStyle, reelsTabBarStyle]);

  // Memoize HomeMain options function
  const getHomeMainOptions = useCallback(({ route }) => {
    const routeName = getFocusedRouteNameFromRoute(route);

    const hideTabBarRoutes = [
      'ChatMessages', 'HeartNotification', 'Following', 'UserChat',
      'PostUpload', 'PostEditor', 'SelectedPost', 'PostView',
      'SavedPost', 'CreatorCoin', 'notificationEnable', 'HidePosts',
      'FollowersFollowingScreen', 'Settings', 'subscription',
      'QuickBuy', 'CashOutScreen', 'Invite', 'ShareProfile', 'EditProfile',
      'CreateMission'
    ];

    let currentRouteName = routeName;

    if (!currentRouteName && route.state) {
      const activeRoute = route.state.routes[route.state.index];
      currentRouteName = activeRoute?.name;
    }

    if (!currentRouteName && route.state?.routes?.[route.state.index]?.state) {
      const nestedState = route.state.routes[route.state.index].state;
      if (nestedState.routes && nestedState.routes[nestedState.index]) {
        currentRouteName = nestedState.routes[nestedState.index].name;
      }
    }

    if (!currentRouteName && navigation.getState) {
      try {
        const navState = navigation.getState();
        const currentRoute = navState.routes[navState.index];
        if (currentRoute?.state?.routes) {
          const activeNestedRoute = currentRoute.state.routes[currentRoute.state.index];
          currentRouteName = activeNestedRoute?.name;
        }
      } catch (error) {
        console.error('Error getting navigation state:', error);
      }
    }

    if (!currentRouteName) {
      if (route.name === 'ProfileMain' && route.state) {
        const profileRoute = route.state.routes[route.state.index];
        if (profileRoute?.name === 'subscription') {
          currentRouteName = 'subscription';
        }
      }
    }

    const hideTabBar = hideTabBarRoutes.includes(currentRouteName);

    return {
      tabBarStyle: hideTabBar ? hiddenTabBarStyle : defaultTabBarStyle
    };
  }, [hiddenTabBarStyle, defaultTabBarStyle]);

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator screenOptions={getScreenOptions}>
        <Tab.Screen
          name="HomeMain"
          component={HomeStack}
          options={getHomeMainOptions}
        />
        <Tab.Screen
          name="Search"
          component={SearchScreen}
          options={{
            tabBarStyle: defaultTabBarStyle
          }}
        />
        <Tab.Screen
          name="Add"
          component={PostStack}
          options={getHomeMainOptions}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              e.preventDefault();
              const state = navigation.getState();
              const currentRoute = state.routes.find(r => r.name === 'Add');
              if (currentRoute) {
                const isCurrentTab = state.index === state.routes.findIndex(r => r.name === 'Add');
                if (isCurrentTab) {
                  navigation.reset({
                    index: 0,
                    routes: [
                      {
                        name: 'Add',
                        state: {
                          routes: [{ name: 'Add', params: { fromIcon: true } }],
                          index: 0,
                        },
                      },
                    ],
                  });
                } else {
                  navigation.navigate('Add', {
                    screen: 'Add',
                    params: { fromIcon: true },
                  });
                }
              }
            },
          })}
        />
        <Tab.Screen
          name="wallet"
          component={WalletStack}
          options={{
            tabBarStyle: defaultTabBarStyle
          }}
          listeners={({ navigation, route }) => ({
            focus: () => {
              // When wallet tab is focused, check if there's a screen param
              const params = route.params;
              if (params?.screen) {
                // Navigate to the specific screen
                setTimeout(() => {
                  navigation.navigate('wallet', { screen: params.screen });
                }, 0);
              }
            },
          })}
        />
        <Tab.Screen
          name="ProfileMain"
          component={ProfileStack}
          options={getHomeMainOptions}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              e.preventDefault();
              navigation.navigate('ProfileMain', {
                screen: 'Profile',
              });
            },
          })}
        />
      </Tab.Navigator>
    </View>
  );
}