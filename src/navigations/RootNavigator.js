// src/navigations/MainStack.js
import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, Alert, StyleSheet, Animated, Dimensions, TouchableWithoutFeedback, TouchableOpacity } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { useDispatch, useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../components/displaytoastmessage';
import { getFocusedRouteNameFromRoute, useNavigation } from '@react-navigation/native';

import LoginScreen from '../pages/authentication/login';
import SignupScreen from '../pages/authentication/signup';
import OTPScreen from '../pages/authentication/OtpScreen/OTPScreen';
import ForgetPassword from '../pages/authentication/ForgotPassword/ForgotPassword';
import NewPasswordScreen from '../pages/authentication/createNewPassword/CreateNewPassword';
import CreateProfile from '../pages/authentication/createProfile';
import WalletScreen from '../pages/authentication/createProfile/wallet';
import MainTabNavigator from './MainTabNavigator';
import Splash from '../pages/splashSceen/Splash';
import PaymentScreen from '../pages/Stripe/PaymentScreen';
import TermsCondition from '../pages/terms&condition/TermsCondition';

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

import { createToken, getTokenByUserId, getTokenPrice } from '../services/tokens';
import { hideLoader, showLoader } from '../redux/actions/LoaderAction';
import WalletComponent from '../pages/wallet/WalletScreen';
import KYCVerification from '../pages/authentication/kycVerification';
import Usersprofile from '../pages/home/Usersprofile';

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

// Custom Drawer Content Component
const CustomDrawerContent = (props) => {
  const navigation = useNavigation();
  
  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      {/* Drawer Header */}
      <View style={{
        padding: 15,
        backgroundColor: '#f8f2fd',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd'
      }}>
        <TouchableOpacity onPress={() => {
          props.navigation.closeDrawer();
          navigation.navigate('MainApp', {
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
          color: '#5a2d82',
          marginVertical: 5,
          marginTop: 8
        }}>
          Wallet Panel
        </Text>
      </View>

      {/* Drawer Items with Custom Navigation */}
      <DrawerItemList 
        {...props}
        onItemPress={({ route, preventDefault }) => {
          preventDefault();
          props.navigation.closeDrawer();
          
          // Navigate to wallet tab with specific screen
          if (route.name !== 'MainApp') {
            navigation.navigate('MainApp', {
              screen: 'wallet',
              params: { screen: route.name }
            });
          } else {
            navigation.navigate('MainApp', {
              screen: 'HomeMain',
            });
          }
        }}
      />
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

// Global Drawer Navigator (wraps everything)
const GlobalDrawerNavigator = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#f8f2fd',
        },
        headerTintColor: '#000',
        drawerStyle: {
          width: 280,
          backgroundColor: '#f8f2fd',
        },
        drawerLabelStyle: {
          fontSize: 15,
          fontWeight: '600',
        },
        drawerActiveBackgroundColor: '#5a2d82',
        drawerActiveTintColor: '#fff',
        drawerInactiveTintColor: '#000',
        drawerPosition: 'left',
        swipeEnabled: true,
        swipeEdgeWidth: 50,
      }}
    >
      {/* Main App (Tab Navigator) */}
      <Drawer.Screen
        name="MainApp"
        component={MainTabNavigator}
        options={{
          headerShown: false,
          drawerLabel: 'Home',
          drawerItemStyle: { display: 'none' }
        }}
      />

      {/* Wallet Drawer Items - These create the menu, navigation handled in CustomDrawerContent */}
      <Drawer.Screen
        name="DrawerDashboard"
        component={DummyComponent}
        options={{ 
          drawerLabel: 'Dashboard',
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
        name="DrawerPortfolio"
        component={DummyComponent}
        options={{ 
          drawerLabel: 'Portfolio',
          headerShown: false,
        }}
        listeners={({ navigation }) => ({
          drawerItemPress: (e) => {
            e.preventDefault();
            navigation.closeDrawer();
            navigation.navigate('MainApp', {
              screen: 'wallet',
              params: { screen: 'Portfolio' }
            });
          },
        })}
      />
      <Drawer.Screen
        name="DrawerWallet"
        component={DummyComponent}
        options={{ 
          drawerLabel: 'Wallet',
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
        name="DrawerMarket"
        component={DummyComponent}
        options={{ 
          drawerLabel: 'Market',
          headerShown: false,
        }}
        listeners={({ navigation }) => ({
          drawerItemPress: (e) => {
            e.preventDefault();
            navigation.closeDrawer();
            navigation.navigate('MainApp', {
              screen: 'wallet',
              params: { screen: 'Market' }
            });
          },
        })}
      />
      <Drawer.Screen
        name="DrawerActivity"
        component={DummyComponent}
        options={{ 
          drawerLabel: 'Activity',
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
        name="DrawerCreators"
        component={DummyComponent}
        options={{ 
          drawerLabel: 'Creators',
          headerShown: false,
        }}
        listeners={({ navigation }) => ({
          drawerItemPress: (e) => {
            e.preventDefault();
            navigation.closeDrawer();
            navigation.navigate('MainApp', {
              screen: 'wallet',
              params: { screen: 'Creators' }
            });
          },
        })}
      />
      <Drawer.Screen
        name="DrawerSettings"
        component={DummyComponent}
        options={{ 
          drawerLabel: 'Settings',
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

export default function MainStack() {
  const isLogin = useSelector(state => state.login.IS_LOGGED_IN);
  const toast = useToast();
  const dispatch = useDispatch();

  useEffect(() => {
    if (isLogin) {
      setupUserToken();
    } else {
      dispatch(hideLoader());
    }
  }, [isLogin]);

  const setupUserToken = async () => {
    try {
      dispatch(showLoader());
      const userId = await AsyncStorage.getItem('userId');
      console.log('userId for token setup:', userId);

      if (!userId) return;

      // Try creating a new token
      const response = await createToken({ userId });
      console.log('Create token response:', response);

      if (response && response.statusCode === 200) {
        await getPriceOfToken(response.data?.tokenAddress);
        AsyncStorage.setItem('PlatFormToken', response.data.tokenAddress);
        return;
      }

      // Fallback → get token by userId
      const tokenRes = await getTokenByUserId(userId);
      console.log('Get token by userId response:', tokenRes);

      if (tokenRes && tokenRes.statusCode === 200) {
        await getPriceOfToken(tokenRes.data?.data?.tokenAddress);
        AsyncStorage.setItem('PlatFormToken', tokenRes.data?.data?.tokenAddress);
      } else {
        showToastMessage(toast, 'danger', 'User token not found.');
      }
    } catch (error) {
      showToastMessage(toast, 'danger', 'Failed to setup token.');
    } finally {
      dispatch(hideLoader());
    }
  };

  const getPriceOfToken = async (tokenAddress) => {
    try {
      if (!tokenAddress) return;
      dispatch(showLoader());
      const response = await getTokenPrice({ tokenAddress });
      if (response.statusCode === 200) {
        console.log('Token price fetched:', response.data);
        await AsyncStorage.setItem('priceInUsd', JSON.stringify(response?.data?.priceInUsd));
        await AsyncStorage.setItem('priceInWei', response?.data?.priceInWei);
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to fetch token price');
    } finally {
      dispatch(hideLoader());
    }
  };

  if (!isLogin) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="OTPScreen" component={OTPScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgetPassword} />
        <Stack.Screen name="CreateNewPassword" component={NewPasswordScreen} />
        <Stack.Screen name="CreateProfile" component={CreateProfile} />
        <Stack.Screen name="kycverify" component={KYCVerification} />
        <Stack.Screen name="Wallet" component={WalletScreen} />
        <Stack.Screen name="Splash" component={Splash} />
        <Stack.Screen name="TermsCondition" component={TermsCondition} />
        <Stack.Screen name="ManageSubscription" component={PaymentScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <View style={styles.container}>
      <GlobalDrawerNavigator />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});