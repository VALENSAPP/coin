  import { NavigationContainer } from '@react-navigation/native';
  import MainStack from './navigations/RootNavigator';
  import { loggedOut, loggedIn } from './redux/actions/LoginAction';
  import { useDispatch, useSelector } from 'react-redux';
  import AsyncStorage from '@react-native-async-storage/async-storage';
  import { Alert, Linking, AppState, DeviceEventEmitter, View, StyleSheet } from 'react-native';
  import React, { useEffect, useRef, useState } from 'react';
  import messaging from '@react-native-firebase/messaging';
  import Splash from './pages/splashSceen/Splash';
  import { hideLoader, showLoader } from './redux/actions/LoaderAction';
  import { showToastMessage } from './components/displaytoastmessage';
  import { useToast } from 'react-native-toast-notifications';
  import { refreshToken } from './services/authentication';
  import { ThemeProvider } from './theme/ThemeContext';
  import { setUserProfile } from './redux/actions/UserProfileAction';
  import { setStripeCustomerId } from './redux/actions/UserAction';
  import { notificationListener, requestUserPermission } from './services/NotificationService';
  import InAppBrowser from 'react-native-inappbrowser-reborn';
  import NotificationModal from './components/modals/NotificationModal';
  import { initializeSocket } from './services/socket';
  import { getUserCredentials } from './services/post';
  import { getAllUser } from './services/users';
  import WelcomeValensModal from './components/modals/WelcomeValensModal';
  // import { getUserCountry } from './hooks/countryLocation';

  const linking = {
    prefixes: [
      'https://www.valenscorp.com',
      'https://valenscorp.com',
      'https://www.valens.app',
      'https://valens.app',
      'com.valens://',
      'valens://',
    ],
    config: {
      screens: {
        Home: '',
        CallbackScreen: 'callback',
        Wallet: 'wallet',
      },
    },
  };

  const KYC_WELCOME_SHOWN_KEY = 'kycWelcomeShownEver';
  const LEGACY_KYC_WELCOME_SHOWN_KEY = 'kycWelcomeShown';

  export default function Main() {
    const [isLoading, setIsLoading] = useState(true);
    const [isNavigationReady, setIsNavigationReady] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [welcomeModalVisible, setWelcomeModalVisible] = useState(false);
    const [message, setMessage] = useState('');
    const userProfile = useSelector(state => state.userProfile.userProfile);
    const isLoggedIn = useSelector(state => state.login.IS_LOGGED_IN);
    const dispatch = useDispatch();
    const toast = useToast();
    const navigationRef = useRef(null);
    const appState = useRef(AppState.currentState);

    useEffect(() => {
      const setup = async () => {
        try {
          await initializeSocket();
          // const country = await getUserCountry();
          // console.log(country,'checkWhichCountryuserare........')
        } catch (e) {
          console.warn("Socket init failed", e);
        }
      };
      setup();
    }, []);

    useEffect(() => {
      requestUserPermission();
      notificationListener();
    }, []);

    const checkKycAndShowWelcomeModal = React.useCallback(async () => {
      try {
        if (!isLoggedIn) {
          setWelcomeModalVisible(false);
          return;
        }

        const [hasShownWelcome, hasShownLegacy] = await Promise.all([
          AsyncStorage.getItem(KYC_WELCOME_SHOWN_KEY),
          AsyncStorage.getItem(LEGACY_KYC_WELCOME_SHOWN_KEY),
        ]);

        if (hasShownWelcome) {
          return;
        }
        if (hasShownLegacy) {
          await AsyncStorage.setItem(KYC_WELCOME_SHOWN_KEY, 'true');
          return;
        }

        const id = await AsyncStorage.getItem('userId');
        if (!id) {
          return;
        }

        const response = await getUserCredentials(id);
        if (response?.statusCode !== 200) {
          return;
        }

        const userData = response?.data?.user || response?.data || response;
        const isKycApproved = userData?.kyc === true;

        if (isKycApproved) {
          setWelcomeModalVisible(true);
          await AsyncStorage.multiSet([
            [KYC_WELCOME_SHOWN_KEY, 'true'],
            [LEGACY_KYC_WELCOME_SHOWN_KEY, 'true'],
          ]);
        }
      } catch (error) {
        console.log('KYC polling check failed:', error?.message || error);
      }
    }, [isLoggedIn]);

    const handleWelcomeModalClose = React.useCallback(async () => {
      setWelcomeModalVisible(false);
      await AsyncStorage.multiSet([
        [KYC_WELCOME_SHOWN_KEY, 'true'],
        [LEGACY_KYC_WELCOME_SHOWN_KEY, 'true'],
      ]);
    }, []);

    useEffect(() => {
      if (!isLoggedIn) {
        return;
      }

      checkKycAndShowWelcomeModal();
      const intervalId = setInterval(() => {
        checkKycAndShowWelcomeModal();
      }, 90000);

      return () => {
        clearInterval(intervalId);
      };
    }, [checkKycAndShowWelcomeModal, isLoggedIn]);

    useEffect(() => {
      dispatch(setUserProfile('normal'));
      fetchRefreshToken();
      getNotification();

      const checkLogin = async () => {
        const loggedI = await AsyncStorage.getItem('isLoggedIn');
        if (loggedI === 'true') {
          dispatch(loggedIn());
          const storedStripeCustomerId = await AsyncStorage.getItem('stripeCustomerId');
          if (storedStripeCustomerId) {
            dispatch(setStripeCustomerId(storedStripeCustomerId));
          }
        } else {
          dispatch(loggedOut());
        }
        setTimeout(() => {
          setIsLoading(false);
        }, 1000);
      };

      checkLogin();

      // Track app state changes
      const appStateSubscription = AppState.addEventListener('change', nextAppState => {
        console.log('AppState changed:', appState.current, '->', nextAppState);
        if (nextAppState === 'active') {
          checkKycAndShowWelcomeModal();
        }
        appState.current = nextAppState;
      });

      // Deep Link Handler - FIXED FOR iOS
      const handleDeepLink = async (event) => {
        console.log('Deep link received:', event.url);
        const url = event.url;

        // Check if URL is callback
        if (url.includes('callback')) {
          console.log('🔔 Callback URL detected - closing InAppBrowser');

          try {
            // ✅ CRITICAL: Close InAppBrowser on iOS
            if (await InAppBrowser.isAvailable()) {
              await InAppBrowser.close();
              console.log('✅ InAppBrowser closed successfully');
            }
          } catch (error) {
            console.log('❌ Error closing InAppBrowser:', error);
          }

          // Parse query params to check payment status
          let status = 'success';
          try {
            const normalizedCallbackUrl = url
              .replace(/^com\.valens:\/\//i, 'https://dummy.com/')
              .replace(/^valens:\/\//i, 'https://dummy.com/');
            const urlObj = new URL(normalizedCallbackUrl);
            status = urlObj.searchParams.get('status') || 'success';
            console.log('📋 Payment status from URL:', status);
          } catch (error) {
            console.log('⚠️ Error parsing callback URL:', error);
          }

          // ✅ Emit event FIRST before hiding loader
          console.log('📢 Emitting PAYMENT_COMPLETED event with status:', status);
          DeviceEventEmitter.emit('PAYMENT_COMPLETED', {
            status: status,
            timestamp: Date.now()
          });

          // Hide loader after a small delay to ensure event is processed
          setTimeout(() => {
            dispatch(hideLoader());
            console.log('✅ Loader hidden - user back on screen');
          }, 500);

          return;
        }

        const normalizeDeepLinkUrl = (incomingUrl = '') => incomingUrl
          .replace(/^com\.valens:\/\//i, 'https://dummy.com/')
          .replace(/^valens:\/\//i, 'https://dummy.com/');

        const navigateToUserProfile = (resolvedUserId) => {
          if (!resolvedUserId || !navigationRef.current || !isNavigationReady) return;
          navigationRef.current.navigate('MainApp', {
            screen: 'HomeMain',
            params: {
              screen: 'UsersProfile',
              params: {
                userId: String(resolvedUserId),
              },
            },
          });
        };

        const resolveUserIdFromUsername = async (incomingUsername) => {
          const cleanUsername = decodeURIComponent(String(incomingUsername || '').trim()).replace(/^@+/, '');
          if (!cleanUsername) return null;
          try {
            const response = await getAllUser({ userName: cleanUsername });
            const users = response?.data?.users ?? [];
            const exactMatch = users.find((u) =>
              String(u?.userName || u?.username || '').toLowerCase() === cleanUsername.toLowerCase()
            );
            const fallbackUser = exactMatch || users[0];
            return fallbackUser?.id || fallbackUser?._id || fallbackUser?.userId || null;
          } catch (error) {
            console.log('Username resolution failed:', error?.message || error);
            return null;
          }
        };

        // Handle other deep links normally if needed
        try {
          const urlObj = new URL(normalizeDeepLinkUrl(url));
          const path = urlObj.pathname;
          const normalizedPath = String(path || '').toLowerCase();
          const postId = urlObj.searchParams.get('postId');
          const fallbackTag = urlObj.searchParams.get('af');

          if (navigationRef.current && isNavigationReady) {
            setTimeout(() => {
              if (postId && fallbackTag === 'dd') {
                navigationRef.current.navigate('MainApp', {
                  screen: 'ProfileMain',
                  params: {
                    screen: 'PostView',
                    params: {
                      userChat: true,
                      fromScreen: 'DeepLink',
                      postData: { id: String(postId) },
                    },
                  },
                });
              } else if (normalizedPath === '/profile' || normalizedPath.startsWith('/profile/')) {
                const deepLinkUserId = String(urlObj.searchParams.get('userId') || '').trim();
                const queryUsername = String(urlObj.searchParams.get('username') || '').trim();
                const pathUsername = decodeURIComponent(path.split('/').filter(Boolean)[1] || '').trim();
                const resolvedUsername = queryUsername || pathUsername;

                if (deepLinkUserId) {
                  navigateToUserProfile(deepLinkUserId);
                } else if (resolvedUsername) {
                  resolveUserIdFromUsername(resolvedUsername).then((resolvedUserId) => {
                    if (resolvedUserId) {
                      navigateToUserProfile(resolvedUserId);
                    } else if (navigationRef.current && isNavigationReady) {
                      navigationRef.current.navigate('MainApp', {
                        screen: 'ProfileMain',
                        params: {
                          screen: 'Profile',
                        },
                      });
                      showToastMessage(toast, 'danger', 'Unable to open this profile from link.');
                    }
                  });
                } else {
                  navigationRef.current.navigate('MainApp', {
                    screen: 'ProfileMain',
                    params: {
                      screen: 'Profile',
                    },
                  });
                }
              } else if (path === '/wallet') {
                navigationRef.current.navigate('Wallet');
              } else if (path === '/home' || path === '/') {
                navigationRef.current.navigate('Home');
              }
            }, 100);
          }
        } catch (error) {
          console.error('URL parsing error:', error);
        }
      };

      // Listen for deep links when app is open
      const linkingSubscription = Linking.addEventListener('url', handleDeepLink);

      // Handle deep link when app was closed
      Linking.getInitialURL().then((url) => {
        if (url) {
          console.log('Initial URL:', url);
          handleDeepLink({ url });
        }
      });

      return () => {
        linkingSubscription.remove();
        appStateSubscription.remove();
      };
    }, [dispatch, toast, isNavigationReady, checkKycAndShowWelcomeModal]);

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
      // messaging().onMessage(async remoteMessage => {
      //   setModalVisible(true);
      //   setMessage(remoteMessage.notification.body);
      // });

      messaging().onNotificationOpenedApp(remoteMessage => {
        console.log("onNotificationOpenedApp data------------------------", remoteMessage)
        setMessage(remoteMessage.notification.body);
        setModalVisible(true);
      });

      messaging()
        .getInitialNotification()
        .then(remoteMessage => {
          if (remoteMessage) {
            console.log("getInitialNotification data------------------------", remoteMessage)
            setMessage(remoteMessage.notification.body);
            setModalVisible(true);
          }
        });
    }

    const handleNavigationReady = () => {
      console.log('Navigation is ready');
      setIsNavigationReady(true);
    };

    const closeModal = () => {
      setModalVisible(false);
    };

    if (isLoading) {
      return (
        <ThemeProvider activeProfile={userProfile}>
          <Splash />
        </ThemeProvider>
      );
    }

    return (
      <>
        <ThemeProvider activeProfile={userProfile}>
          <NavigationContainer
            ref={navigationRef}
            linking={linking}
            onReady={handleNavigationReady}
            fallback={<Splash />}
          >
            <MainStack />
          </NavigationContainer>
          {
            modalVisible &&
            <NotificationModal
              visible={modalVisible}
              message={message}
              closeModal={closeModal}
            />
          }
          <WelcomeValensModal
            visible={welcomeModalVisible}
            onClose={handleWelcomeModalClose}
          />
        </ThemeProvider>
      </>
    );
  }

