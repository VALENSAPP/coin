import { NavigationContainer } from '@react-navigation/native';
import MainStack from './navigations/RootNavigator';
import { loggedOut, loggedIn } from './redux/actions/LoginAction';
import { useDispatch, useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import React, { useEffect, useState } from 'react';
import messaging from '@react-native-firebase/messaging';
import Splash from './pages/splashSceen/Splash';
import { hideLoader, showLoader } from './redux/actions/LoaderAction';
import { showToastMessage } from './components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import { refreshToken } from './services/authentication';
import { ThemeProvider } from './theme/ThemeContext';
import { setUserProfile } from './redux/actions/UserProfileAction';
import { notificationListener, requestUserPermission } from './services/NotificationService';

const linking = {
  prefixes: [
    'https://www.valenscorp.com',   // Universal Link (typo fix)
    'https://valenscorp.com',        // Without www
    'com.valens://',                 // Custom scheme
  ],
  config: {
    screens: {
      Home: '',
      Callback: 'callback',          // /callback route
      Wallet: 'wallet',
    },
  },
};

export default function Main() {
  const [isLoading, setIsLoading] = useState(true);
  const userProfile = useSelector(state => state.userProfile.userProfile);
  const dispatch = useDispatch();
  const toast = useToast();
  const navigationRef = useRef(null); // Navigation reference

  useEffect(() => {
    dispatch(setUserProfile('normal'));
    fetchRefreshToken();
    requestUserPermission();
    notificationListener();
    getNotification();
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

    // Deep Link Handler
    const handleDeepLink = (event) => {
      console.log('Deep link received:');
      const url = event.url;
      console.log('Deep link received:', url);
      
      // Check if /callback route
      if (url.includes('/callback') || url.includes('://callback')) {
        try {
          // Parse URL
          const urlObj = new URL(url.replace('com.valens://', 'https://dummy.com/'));
          
          // Extract parameters
          const code = urlObj.searchParams.get('code');
          const token = urlObj.searchParams.get('token');
          const status = urlObj.searchParams.get('status');
          
          console.log('Authorization code:', code);
          console.log('Token:', token);
          console.log('Status:', status);
          
          // Handle payment success/callback
          if (code || token) {
            // Navigate to specific screen if needed
            setTimeout(() => {
              navigationRef.current?.navigate('Callback', {
                code,
                token,
                status,
              });
            }, 500);
            
            // Or show success message
            showToastMessage(toast, 'success', 'Payment completed successfully!');
          }
          
        } catch (error) {
          console.error('URL parsing error:', error);
        }
      }
    };

    // Listen for deep links when app is open
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Handle deep link when app was closed
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('Initial URL:', url);
        handleDeepLink({ url });
      }
    });

    return () => subscription.remove();
  }, [dispatch, toast]);

  const fetchRefreshToken = async () => {
    const oldToken = await AsyncStorage.getItem('refreshToken');
    try {
      dispatch(showLoader());
      const dataToSend = { refreshToken: oldToken };
      const response = await refreshToken(dataToSend);
      if (response?.statusCode === 200) {
        console.log('response in refreshtoken------->>>>>>>>>>>>>>>', response);
        await AsyncStorage.setItem('token', response.data.access_token);
        await AsyncStorage.setItem('refreshToken', response.data.refresh_token);
      } else {
        showToastMessage(toast, 'danger', response.data.message);
      }
    } catch (error) {
      // Handle error silently or show message
    } finally {
      dispatch(hideLoader());
    }
  };

  const getNotification = async () => {
    messaging().onMessage(async remoteMessage => {
      console.log("onMessage data------------------------",remoteMessage)
      // readNotificationsAtStart(remoteMessage.data.messageId)
    });

    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log("onNotificationOpenedApp data------------------------",remoteMessage)
      // readNotificationsAtStart(remoteMessage.data.messageId)
    });

    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
         console.log("getInitialNotification data------------------------",remoteMessage)
        }
      });
  }

  if (isLoading) {
    return (
      <ThemeProvider activeProfile={userProfile}>
        <Splash />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider activeProfile={userProfile}>
      <NavigationContainer 
        ref={navigationRef}  // Navigation reference add kiya
        linking={linking}
        fallback={<Splash />} // Fallback while linking resolves
      >
        <MainStack />
      </NavigationContainer>
    </ThemeProvider>
  );
}