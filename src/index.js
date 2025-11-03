import { NavigationContainer } from '@react-navigation/native';
import MainStack from './navigations/RootNavigator';
import { loggedOut, loggedIn } from './redux/actions/LoginAction';
import { useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import React, { useEffect, useState } from 'react';
import Splash from './pages/splashSceen/Splash';
import { hideLoader, showLoader } from './redux/actions/LoaderAction';
import { showToastMessage } from './components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import { refreshToken } from './services/authentication';

const linking = {
  prefixes: [
    'https://www.valenciacorp.com', // Universal Link
    'com.valens://',                // fallback custom scheme
  ],
  config: {
    screens: {
      Home: '',
      Callback: 'callback',
      Wallet: 'wallet',
    },
  },
};

export default function Main() {
  const [isLoading, setIsLoading] = useState(true);
  const dispatch = useDispatch();
  const toast = useToast();

  useEffect(() => {
    fetchRefreshToken();
    const checkLogin = async () => {
      const loggedI = await AsyncStorage.getItem('isLoggedIn');
      if (loggedI === 'true') {
        dispatch(loggedIn());
      } else {
        dispatch(loggedOut());
      }
      setTimeout(() => {
        setIsLoading(false);
      }, 1000);
    };
    checkLogin();
    const handleDeepLink = (event) => {
      const url = event.url;
      const codeMatch = url.match(/code=([^&]+)/);
      if (codeMatch) {
        const code = codeMatch[1];
        console.log('Authorization code:', code);
      }
    };
    const subscription = Linking.addEventListener('url', handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });
    return () => subscription.remove();
  }, [dispatch]);

  const fetchRefreshToken = async () => {
    const oldToken = await AsyncStorage.getItem('refreshToken');
    try {
      dispatch(showLoader());
      const dataToSend = { refreshToken: oldToken };
      const response = await refreshToken(dataToSend);
      if (response?.statusCode === 200) {
        await AsyncStorage.setItem('token', response.data.access_token);
        await AsyncStorage.setItem(
          'refreshToken',
          response.data.refresh_token,
        );
      }
      else {
        showToastMessage(toast, 'danger', response.data.message);
      }
    } catch (error) {
      // showToastMessage(
      //   toast,
      //   'danger',
      //   error?.response?.message ?? 'Something went wrong',
      // );
    } finally {
      dispatch(hideLoader());
    }
  };

  if (isLoading) {
    return <Splash />;
  }

  return (
    <NavigationContainer linking={linking}>
      <MainStack />
    </NavigationContainer>
  );
}