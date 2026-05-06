import { NavigationContainer, useNavigation } from '@react-navigation/native';
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
import InAppBrowser from 'react-native-inappbrowser-reborn';
import NotificationModal from './components/modals/NotificationModal';
import { initializeSocket } from './services/socket';
import { getUserCredentials } from './services/post';
import { getAllUser } from './services/users';
import WelcomeValensModal from './components/modals/WelcomeValensModal';
import { ensureCurrentAccountSaved } from './utils/accountSession';
import { parseProfileShareUrl } from './utils/profileShare';
import { authSesionHistory } from './services/wallet';
import { updatLoginModal } from './services/kycverification';
// import { getUserCountry } from './hooks/countryLocation';

const KYC_WELCOME_SHOWN_KEY = 'kycWelcomeShownEver';
const LEGACY_KYC_WELCOME_SHOWN_KEY = 'kycWelcomeShown';

const linking = {
  prefixes: [
    'https://www.valenscorp.com',
    'https://valenscorp.com',
    'https://www.valens.app',
    'https://valens.app',
    'https://valensGoApp.com',
    'com.valens.app://',
    'com.valens://',
    // 'valens://',
  ],
  config: {
    screens: {
      Home: '',
      CallbackScreen: 'callback',
      Wallet: 'wallet',
    },
  },
};


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
  const pendingNotificationNavigation = useRef(false);
  const isNavigationReadyRef = useRef(false);
  const isLoggedInRef = useRef(false);
  const isLoadingRef = useRef(true);
  const appState = useRef(AppState.currentState);
  const welcomeModalCloseInFlight = useRef(false);

  useEffect(() => {
    isNavigationReadyRef.current = isNavigationReady;
    isLoggedInRef.current = isLoggedIn;
    isLoadingRef.current = isLoading;
  }, [isLoading, isLoggedIn, isNavigationReady]);

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

  const navigateToHeartNotification = React.useCallback(() => {
    if (
      !navigationRef.current ||
      !isNavigationReadyRef.current ||
      !isLoggedInRef.current ||
      isLoadingRef.current
    ) {
      pendingNotificationNavigation.current = true;
      return;
    }

    pendingNotificationNavigation.current = false;
    navigationRef.current.navigate('MainApp', {
      screen: 'HomeMain',
      params: {
        screen: 'HeartNotification',
      },
    });
  }, []);

  useEffect(() => {
    if (pendingNotificationNavigation.current) {
      navigateToHeartNotification();
    }
  }, [isLoading, isLoggedIn, isNavigationReady, navigateToHeartNotification]);

  const checkKycAndShowWelcomeModal = React.useCallback(async () => {
    try {
      if (!isLoggedIn) {
        setWelcomeModalVisible(false);
        return;
      }

      const id = await AsyncStorage.getItem('userId');
      if (!id) {
        return;
      }

      const hasShownWelcome = await AsyncStorage.getItem(KYC_WELCOME_SHOWN_KEY);
      const hasShownLegacy = await AsyncStorage.getItem(LEGACY_KYC_WELCOME_SHOWN_KEY);
      if (hasShownWelcome || hasShownLegacy) {
        setWelcomeModalVisible(false);
        return;
      }

      const response = await getUserCredentials(id);
      console.log(response, 'fdATA')
      if (response?.statusCode !== 200) {
        return;
      }
      const userData = response?.data?.user || response?.data || response;
      const kycApproved = userData?.kyc === true || String(userData?.kyc || '').toLowerCase() === 'true';
      const firstLogRaw =
        userData?.first_log ??
        userData?.firstLog ??
        userData?.first_login ??
        userData?.firstLogin ??
        userData?.firstLoginAfterKyc;
      const firstLog = firstLogRaw === true || String(firstLogRaw || '').toLowerCase() === 'true';

      const isKycApproved = kycApproved && firstLog;
      // const isKycApproved =
      //   canAccessPlatform === true ||
      //   String(canAccessPlatform || '').toLowerCase() === 'true';

      setWelcomeModalVisible(isKycApproved);
    } catch (error) {
      console.log('KYC polling check failed:', error?.message || error);
    }
  }, [isLoggedIn]);

  const handleWelcomeModalClose = async () => {
    if (welcomeModalCloseInFlight.current) return;
    welcomeModalCloseInFlight.current = true;

    setWelcomeModalVisible(false);

    try {
      await updatLoginModal();
    } catch (error) {
      console.log('Failed to update first login after KYC:', error?.message || error);
    } finally {
      welcomeModalCloseInFlight.current = false;
    }
  };

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
      try {
        const loggedI = await AsyncStorage.getItem('isLoggedIn');
        const deviceId = await AsyncStorage.getItem("device_id");

        if (loggedI === 'true') {

          // 🔥 Call API
          const response = await authSesionHistory();

          const sessions = response?.data?.sessions || [];

          // ✅ Check if current device exists in sessions
          const currentSession = sessions.find(
            (item) => item.deviceId === deviceId
          );
          {
            if (currentSession) {
              // ✅ Device is valid → stay logged in
              dispatch(loggedIn());

              await ensureCurrentAccountSaved();

              const storedStripeCustomerId = await AsyncStorage.getItem('stripeCustomerId');
              if (storedStripeCustomerId) {
                dispatch(setStripeCustomerId(storedStripeCustomerId));
              }

            } else {
              // ❌ Device not found → logout
              console.log("Session not found, logging out");

              await AsyncStorage.clear();
              dispatch(loggedOut());
            }
          }
        } else {
          dispatch(loggedOut());
        }

      } catch (error) {
        console.log("Error in checkLogin:", error);
        dispatch(loggedOut());
      } finally {
        setTimeout(() => {
          setIsLoading(false);
        }, 1000);
      }
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
      const url = String(event?.url || '').trim();

      if (!url) {
        return;
      }

      // At the top of handleDeepLink, after receiving com.valens.app://
      const isMetaMaskReturn = url === 'com.valens.app://' || url === 'com.valens.app';
      console.log("isMetaMaskReturn-------------", isMetaMaskReturn)
      if (isMetaMaskReturn) {
        const pendingMetamask = await AsyncStorage.getItem('pending_metamask_connect');
        console.log("pendingMetamask-------------", pendingMetamask)

        if (pendingMetamask === 'true') {
          await AsyncStorage.removeItem('pending_metamask_connect');
          console.log('🦊 Returned from MetaMask');

          // Handle MetaMask return — trigger your wallet connect completion logic here
          DeviceEventEmitter.emit('METAMASK_RETURN', { timestamp: Date.now() });
          return;
        }

        // Not from MetaMask, just a bare deep link — ignore or handle as home
        return;
      }

      const normalizeDeepLinkUrl = (incomingUrl = '') => String(incomingUrl || '')
        .replace(/^com\.valens\.app:\/\//i, 'https://dummy.com/')
        .replace(/^com\.valens:\/\//i, 'https://dummy.com/')
        .replace(/^valens:\/\//i, 'https://dummy.com/');

      let urlObj;
      try {
        urlObj = new URL(normalizeDeepLinkUrl(url));
      } catch (error) {
        console.error('URL parsing error:', error);
        return;
      }

      const path = urlObj.pathname;
      const normalizedPath = String(path || '').toLowerCase();

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
            .replace(/^com\.valens\.app:\/\//i, 'https://dummy.com/')
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

        // return;
      }

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
        const reelId = urlObj.searchParams.get('reelId');
        const storyId = String(urlObj.searchParams.get('storyId') || '').trim();
        const fallbackTag = urlObj.searchParams.get('af');
        const sharedProfileLink = parseProfileShareUrl(url);

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
            } else if (reelId && fallbackTag === 'dd') {
              navigationRef.current.navigate('MainApp', {
                screen: 'HomeMain',
                params: {
                  screen: 'FlipsScreen',
                  params: {
                    item: { id: String(reelId) },
                    uniqueKey: `deeplink_reel_${String(reelId)}`,
                  },
                },
              });
            } else if (storyId && fallbackTag === 'dd') {
              navigationRef.current.navigate('MainApp', {
                screen: 'HomeMain',
                params: {
                  screen: 'Home',
                  params: {
                    sharedStoryId: storyId,
                  },
                },
              });
            } else if (sharedProfileLink) {
              const deepLinkUserId = String(sharedProfileLink.userId || '').trim();
              const resolvedUsername = String(sharedProfileLink.username || '').trim();

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
    // Existing startup effect intentionally runs from this dependency set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    messaging().onMessage(async remoteMessage => {
      console.log("onMessage data------------------------", remoteMessage)
    });

    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log("onNotificationOpenedApp data------------------------", remoteMessage)
      setMessage(remoteMessage?.notification?.body || '');
      navigateToHeartNotification();
      // setModalVisible(true);

    });

    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log("getInitialNotification data------------------------", remoteMessage)
          setMessage(remoteMessage?.notification?.body || '');
          navigateToHeartNotification();
          // setModalVisible(true);
        }
      });
  }

  const handleNavigationReady = () => {
    console.log('Navigation is ready');
    isNavigationReadyRef.current = true;
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
