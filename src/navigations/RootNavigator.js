// src/navigations/MainStack.js
import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { View, ActivityIndicator, Alert, StyleSheet, Animated, Dimensions, TouchableWithoutFeedback, TouchableOpacity, Text as RNText } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { useDispatch, useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../components/displaytoastmessage';
import { findFocusedRoute, useNavigation, useNavigationState } from '@react-navigation/native';

import LoginScreen from '../pages/authentication/login';
import SignupScreen from '../pages/authentication/signup';
import OTPScreen from '../pages/authentication/OtpScreen/OTPScreen';
import ForgetPassword from '../pages/authentication/ForgotPassword/ForgotPassword';
import NewPasswordScreen from '../pages/authentication/createNewPassword/CreateNewPassword';
import CreateProfile from '../pages/authentication/createProfile';
import BusinessSetup from '../pages/authentication/BusinessSetup';
import BlockedVerification from '../pages/authentication/BlockedVerification';
import WalletScreen from '../pages/authentication/createProfile/wallet';
import MainTabNavigator from './MainTabNavigator';
import Splash from '../pages/splashSceen/Splash';
import PaymentScreen from '../pages/Stripe/PaymentScreen';
import TermsCondition from '../pages/terms&condition/TermsCondition';
import CallbackScreen from '../pages/callbackScreen';

// Import Wallet Screens
import PortfolioScreen from '../pages/wallet/PortfolioScreen';
import MarketScreen from '../pages/wallet/MarketScreen';
import WalletDashboardScreen from '../pages/wallet';
import ActivityScreen from '../pages/wallet/ActivityScreen';
import CreatorsScreen from '../pages/wallet/CreatorsScreen';
import SettingsScreen from '../pages/wallet/SettingScreen';
import ChangePassword from '../pages/wallet/ChangePassword';
import DepositeCash from '../pages/wallet/DepositeCash';
import CashOut from '../pages/wallet/CashOut';
import SendCoins from '../pages/wallet/SendCoins';
import TextGradient from '../assets/textgradient/TextGradient';
import { Text } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { createToken, getTokenByUserId, getTokenPrice } from '../services/tokens';
import { hideLoader, showLoader } from '../redux/actions/LoaderAction';
import WalletComponent from '../pages/wallet/WalletScreen';
import KYCVerification from '../pages/authentication/kycVerification';
import Usersprofile from '../pages/home/Usersprofile';
import { useAppTheme } from '../theme/useApptheme';
import SelectAccountType from '../pages/authentication/setAccountType';
import ValensWallet from '../pages/wallet/ValensWallet';
import PrivateCircle from '../components/profile/PrivateCircle';
import { useLanguage } from '../i18n';
import { lockProfile } from '../services/kycverification';
import WhiteScreen from '../pages/authentication/WhiteScreen';
import { normalizeProfileType } from '../utils/closetNavigation';

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

// Custom Drawer Content Component
const CustomDrawerContent = (props) => {
  const { bgStyle, textStyle, text } = useAppTheme();
  const { t } = useLanguage();
  const reduxProfile = useSelector(state => state.userProfile.userProfile);
  const [storedProfile, setStoredProfile] = React.useState('');
  const resolvedProfile = normalizeProfileType(
    reduxProfile && reduxProfile !== 'normal' ? reduxProfile : storedProfile || 'user',
  );
  const isCompanyProfile = resolvedProfile === 'company';
  const drawerItems = props.state.routes.map((route, index) => ({
    route,
    index,
    focused: props.state.index === index,
    options: props.descriptors[route.key]?.options || {},
  }));


  const blockProfile = React.useCallback(async () => {
    try {

      const response = await lockProfile();

      // Handle success here
    } catch (err) {
      console.log(err, 'blockProfile error');
    }
  }, []);
  useEffect(() => {
    blockProfile();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('profile').then(value => {
      if (value) setStoredProfile(value);
    });
  }, []);

  const navigateToEbookPublisher = () => {
    props.navigation.closeDrawer();
    props.navigation.navigate('MainApp', {
      screen: 'wallet',
      params: {
        screen: 'EbookPublisher',
        params: {
          type: 'private',
          format: 'ebook',
          fromRootNavigator: true,
        },
      },
    });
  };

  const navigateToWalletScreen = (screen, params) => {
    props.navigation.closeDrawer();
    props.navigation.navigate('MainApp', {
      screen: 'wallet',
      params: params ? { screen, params } : { screen },
    });
  };

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      {/* Drawer Header */}
      <View style={[{
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd'
      }, bgStyle]}>
        <TouchableOpacity onPress={() => {
          props.navigation.closeDrawer();
          props.navigation.navigate('MainApp', {
            screen: 'HomeMain',
          });
        }} activeOpacity={0.7}>
          <TextGradient
            style={{ fontWeight: "bold", fontSize: 23 }}
            locations={[0, 1]}
            colors={["#513189bd", "#e54ba0"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            text="VALENS"
          />
        </TouchableOpacity>
        <Text style={{
          fontSize: 15,
          fontWeight: 'bold',
          color: text,
          marginVertical: 5,
          marginTop: 8
        }}>
          {t('drawerNav.walletPanel')}
        </Text>
      </View>

      {/* Drawer Items with Custom Navigation */}
      {drawerItems.map(({ route, options }) => {
        if (options.drawerItemStyle?.display === 'none') return null;
        if (route.name === 'MainApp') return null;
        if (route.name === 'DrawerSubscription' || route.name === 'Privatecircle' || route.name === 'DrawerSettings') return null;
        if (route.name === 'My closet' || route.name === 'Shop') return null;

        const label =
          options.drawerLabel ??
          options.title ??
          route.name;

        const handlePress = () => {
          if (route.name === 'DrawerDashboard') navigateToWalletScreen('Dashboard');
          else if (route.name === 'DrawerWallet') navigateToWalletScreen('WalletMain');
          else if (route.name === 'DrawerActivity') navigateToWalletScreen('Activity');
          else if (route.name === 'Valens Wallet') navigateToWalletScreen('ValensWallet');
        };

        return (
          <TouchableOpacity
            key={route.key}
            onPress={handlePress}
            activeOpacity={0.75}
            style={{
              paddingHorizontal: 20,
              paddingVertical: 18,
              backgroundColor: 'transparent',
            }}
          >
            <Text style={{ fontSize: 15, color: '#000', fontWeight: '600' }}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}

        <TouchableOpacity
          onPress={() => navigateToWalletScreen(isCompanyProfile ? 'Shop' : 'MyCloset')}
        activeOpacity={0.75}
        style={{ paddingHorizontal: 20, paddingVertical: 18 }}
      >
        <Text style={{ fontSize: 15, color: '#000', fontWeight: '600' }}>
          {isCompanyProfile ? t('drawerNav.shop') : t('drawerNav.myCloset')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={navigateToEbookPublisher}
        activeOpacity={0.75}
        style={{ flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12 }}
      >
        <Ionicons name="book-outline" size={18} color={text} style={{ marginRight: 12 }} />
        <Text style={{ fontSize: 13, color: text, fontWeight: '500' }}>
          Sell Ebook
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigateToWalletScreen('SubscriptionSetup')}
        activeOpacity={0.75}
        style={{ paddingHorizontal: 20, paddingVertical: 18 }}
      >
        <Text style={{ fontSize: 15, color: '#000', fontWeight: '600' }}>
          {t('drawerNav.subscriptions')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigateToWalletScreen('Privatecircle', { skipPrivateCircleApi: true })}
        activeOpacity={0.75}
        style={{ paddingHorizontal: 20, paddingVertical: 18 }}
      >
        <Text style={{ fontSize: 15, color: '#000', fontWeight: '600' }}>
          {t('drawerNav.privateCircle')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigateToWalletScreen('Settings')}
        activeOpacity={0.75}
        style={{ paddingHorizontal: 20, paddingVertical: 18 }}
      >
        <Text style={{ fontSize: 15, color: '#000', fontWeight: '600' }}>
          {t('drawerNav.settings')}
        </Text>
      </TouchableOpacity>
    </DrawerContentScrollView>
  );
};

// Settings Stack Navigator
const SettingsStackNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="SettingsMain"
        component={SettingsScreen}
      />
      <Stack.Screen
        name="ChangePassword"
        component={ChangePassword}
      />
    </Stack.Navigator>
  );
};

// Dummy components that will never be rendered (just for drawer menu structure)
const DummyComponent = () => null;

// Screens where the global drawer should NOT open from a left-edge swipe.
const SWIPE_DISABLED_SCREENS = [
  'SelectedPost',
  'FlipsScreen',
];

/**
 * Drawer swipe reads options from descriptors, which do not refresh when only nested
 * navigators (tabs/stacks) change. Sync swipeEnabled from the actual focused leaf route.
 */
const MainAppWithDrawerSwipeSync = (props) => {
  const navigation = useNavigation();
  const focusedRouteName = useNavigationState((state) => findFocusedRoute(state)?.name);

  useLayoutEffect(() => {
    const isSwipeDisabled =
      focusedRouteName != null && SWIPE_DISABLED_SCREENS.includes(focusedRouteName);
    navigation.setOptions({
      swipeEnabled: !isSwipeDisabled,
      swipeEdgeWidth: isSwipeDisabled ? 0 : 50,
    });
  }, [navigation, focusedRouteName]);

  return <MainTabNavigator {...props} />;
};

// Global Drawer Navigator (wraps everything)
const GlobalDrawerNavigator = () => {
  const { bgStyle, textStyle, text } = useAppTheme();
  const { t } = useLanguage();
  const reduxProfile = useSelector(state => state.userProfile.userProfile);
  const [storedProfile, setStoredProfile] = React.useState('');
  const resolvedProfile = normalizeProfileType(
    reduxProfile && reduxProfile !== 'normal' ? reduxProfile : storedProfile || 'user',
  );
  const isCompanyProfile = resolvedProfile === 'company';

  useEffect(() => {
    AsyncStorage.getItem('profile').then(value => {
      if (value) setStoredProfile(value);
    });
  }, []);

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: bgStyle,
        headerTintColor: '#000',
        drawerStyle: [{
          width: 280,
        }, bgStyle],
        drawerLabelStyle: {
          fontSize: 15,
          fontWeight: '600',
        },
        drawerActiveBackgroundColor: text,
        drawerActiveTintColor: '#fff',
        drawerInactiveTintColor: '#000',
        drawerPosition: 'left',
        swipeEnabled: true,
        swipeEdgeWidth: 50,
      }}
    >
      {/* Main App — swipe toggled by MainAppWithDrawerSwipeSync from nested focus */}
      <Drawer.Screen
        name="MainApp"
        component={MainAppWithDrawerSwipeSync}
        options={{
          headerShown: false,
          drawerLabel: t('drawerNav.home'),
          drawerItemStyle: { display: 'none' },
          swipeEnabled: true,
          swipeEdgeWidth: 50,
        }}
      />

      {/* Wallet Drawer Items */}
      <Drawer.Screen
        name="DrawerDashboard"
        component={DummyComponent}
        options={{
          drawerLabel: t('drawerNav.dashboard'),
          headerShown: false,
        }}
        listeners={({ navigation }) => ({
          drawerItemPress: (e) => {
            e.preventDefault();
            navigation.closeDrawer();
            navigation.navigate('MainApp', {
              screen: 'wallet',
              params: { screen: 'Dashboard' }
            });
          },
        })}
      />
      <Drawer.Screen
        name="DrawerWallet"
        component={DummyComponent}
        options={{
          drawerLabel: t('drawerNav.buyMissionCredits'),
          headerShown: false,
        }}
        listeners={({ navigation }) => ({
          drawerItemPress: (e) => {
            e.preventDefault();
            navigation.closeDrawer();
            navigation.navigate('MainApp', {
              screen: 'wallet',
              params: { screen: 'WalletMain' }
            });
          },
        })}
      />
      <Drawer.Screen
        name="DrawerActivity"
        component={DummyComponent}
        options={{
          drawerLabel: t('drawerNav.activity'),
          headerShown: false,
        }}
        listeners={({ navigation }) => ({
          drawerItemPress: (e) => {
            e.preventDefault();
            navigation.closeDrawer();
            navigation.navigate('MainApp', {
              screen: 'wallet',
              params: { screen: 'Activity' }
            });
          },
        })}
      />
      <Drawer.Screen
        name="Valens Wallet"
        component={ValensWallet}
        options={{
          drawerLabel: t('drawerNav.valensWallet'),
          headerShown: false,
        }}
        listeners={({ navigation }) => ({
          drawerItemPress: (e) => {
            e.preventDefault();
            navigation.closeDrawer();
            navigation.navigate('MainApp', {
              screen: 'wallet',
              params: { screen: 'ValensWallet' }
            });
          },
        })}
      />
      {!isCompanyProfile && (
        <Drawer.Screen
          name="My closet"
          component={ValensWallet}
          options={{
            drawerLabel: t('drawerNav.myCloset'),
            headerShown: false,
            drawerItemStyle: { display: 'none' },
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.closeDrawer();
              navigation.navigate('MainApp', {
                screen: 'wallet',
                params: { screen: 'MyCloset' }
              });
            },
          })}
        />
      )}
      {isCompanyProfile && (
        <Drawer.Screen
          name="Shop"
          component={ValensWallet}
          options={{
            drawerLabel: t('drawerNav.shop'),
            headerShown: false,
            drawerItemStyle: { display: 'none' },
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.closeDrawer();
              navigation.navigate('MainApp', {
                screen: 'wallet',
                params: { screen: 'Shop' }
              });
            },
          })}
        />
      )}
      {/* {!isCompanyProfile && ( */}

      <Drawer.Screen
        name="DrawerSubscription"
        component={DummyComponent}
        options={{
          drawerLabel: t('drawerNav.subscriptions'),
          headerShown: false,
        }}
        listeners={({ navigation }) => ({
          drawerItemPress: (e) => {
            e.preventDefault();
            navigation.navigate('MainApp', {
              screen: 'wallet',
              params: { screen: 'SubscriptionSetup' }
            });
          },
        })}
      />
      {/* )} */}

      <Drawer.Screen
        name="Privatecircle"
        component={PrivateCircle}
        options={{
          drawerLabel: t('drawerNav.privateCircle'),
          headerShown: false,
        }}
        listeners={({ navigation }) => ({
          drawerItemPress: (e) => {
            e.preventDefault();
            navigation.closeDrawer();
            navigation.navigate('MainApp', {
              screen: 'wallet',
              params: {
                screen: 'Privatecircle',
                params: { skipPrivateCircleApi: true },
              }
            });
          },
        })}
      />

      <Drawer.Screen
        name="DrawerSettings"
        component={DummyComponent}
        options={{
          drawerLabel: t('drawerNav.settings'),
          headerShown: false,
        }}
        listeners={({ navigation }) => ({
          drawerItemPress: (e) => {
            e.preventDefault();
            navigation.closeDrawer();
            navigation.navigate('MainApp', {
              screen: 'wallet',
              params: { screen: 'Settings' }
            });
          },
        })}
      />
    </Drawer.Navigator>
  );
};

export default function MainStack({ isFirstLaunch }) {
  const isLogin = useSelector(state => state.login.IS_LOGGED_IN);
  const isAddAccount = useSelector(state => state.addAccount.isAddAccount);

  if (!isLogin || isAddAccount) {
    return (
      <Stack.Navigator key={isAddAccount ? 'authStack' : 'unauthStack'}
        initialRouteName={
          isAddAccount
            ? 'Login'
            : isFirstLaunch
              ? 'SelectAccountType'
              : isLogin
                ? 'WhiteScreen'
                : 'Login'
        }
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="WhiteScreen" component={WhiteScreen} />
        <Stack.Screen name="SelectAccountType" component={SelectAccountType} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="OTPScreen" component={OTPScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgetPassword} />
        <Stack.Screen name="CreateNewPassword" component={NewPasswordScreen} />
        <Stack.Screen name="CreateProfile" component={CreateProfile} />
        <Stack.Screen name="BusinessSetupAuth" component={BusinessSetup} />
        <Stack.Screen name="KycVerifyAuth" component={KYCVerification} />
        <Stack.Screen name="BlockedVerification" component={BlockedVerification} />
        <Stack.Screen name="Wallet" component={WalletScreen} />
        <Stack.Screen name="Splash" component={Splash} />
        <Stack.Screen name="TermsCondition" component={TermsCondition} />
        <Stack.Screen name="ManageSubscription" component={PaymentScreen} />
        <Stack.Screen name="CallbackScreen" component={CallbackScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator key="appStack" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AppDrawer" component={GlobalDrawerNavigator} />
      <Stack.Screen name="BusinessSetup" component={BusinessSetup} />
      <Stack.Screen name="kycverify" component={KYCVerification} />
      <Stack.Screen name="CallbackScreen" component={CallbackScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
