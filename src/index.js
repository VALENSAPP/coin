import { NavigationContainer } from '@react-navigation/native';
import MainStack from './navigations/RootNavigator';
import { loggedOut, loggedIn } from './redux/actions/LoginAction';
import { useDispatch, useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, AppState, DeviceEventEmitter } from 'react-native';
import React, { useEffect, useRef, useState } from 'react';
import Splash from './pages/splashSceen/Splash';
import { hideLoader } from './redux/actions/LoaderAction';
import { showToastMessage } from './components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import { refreshToken } from './services/authentication';
import { ThemeProvider } from './theme/ThemeContext';
import { setUserProfile } from './redux/actions/UserProfileAction';
import { setStripeCustomerId } from './redux/actions/UserAction';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import WelcomeValensModal from './components/modals/WelcomeValensModal';
import { ensureCurrentAccountSaved } from './utils/accountSession';
import { parseProfileShareUrl } from './utils/profileShare';
import { authSesionHistory } from './services/wallet';
import { lockProfile, updatLoginModal } from './services/kycverification';
import { useLanguage } from './i18n';
import { useNotificationToast } from './utils/useNotificationToast';
import { initializeSocket } from './services/socket';
import { getUserCredentials } from './services/post';
import { getAllUser } from './services/users';
import useNotificationSetup from './utils/useNotificationSetup';
import { requestUserPermission } from './services/NotificationService';
import ProfileVerificationReminderModal from './components/modals/ProfileVerificationReminderModal';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const KYC_WELCOME_SHOWN_KEY = 'kycWelcomeShownEver';
const LEGACY_KYC_WELCOME_SHOWN_KEY = 'kycWelcomeShown';

const linking = {
  prefixes: [
    'https://api.valens.app',
    'valens://',
    'https://www.valens.app',
    'https://valens.app',
    'https://valensGoApp.com',
    'com.valens.app://',
    'com.valens://',
  ],
  config: {
    screens: {
      Home: '',
      CallbackScreen: 'callback',
      Wallet: 'wallet',
      Profile: 'profile/:id',
      User: 'u/:id',
      Share: 'share/:id',
      Post: 'postshare/:id',
      Reel: 'reelshare/:id',
      Story: 'storyshare/:id',
    },
  },
};

// Consumed once across hot-reloads so the initial URL is not replayed
let _initialUrlConsumed = false;

// ─────────────────────────────────────────────────────────────────────────────
// URL helpers (module-level, no closure dependencies)
// ─────────────────────────────────────────────────────────────────────────────

const normalizeDeepLinkUrl = (incomingUrl = '') =>
  String(incomingUrl || '')
    .replace(/^com\.valens\.app:\/\//i, 'https://dummy.com/')
    .replace(/^com\.valens:\/\//i, 'https://dummy.com/')
    .replace(/^valens:\/\//i, 'https://dummy.com/');

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function Main() {
  const [isLoading, setIsLoading] = useState(true);
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const [welcomeModalVisible, setWelcomeModalVisible] = useState(false);
  const [lockModal, setlockModal] = useState(false);
  const [blockedVerificationProfile, setBlockedVerificationProfile] = useState(null);
  const [verificationProfileType, setVerificationProfileType] = useState('user');
  const [message, setMessage] = useState('');
  const [isFirstLaunch, setIsFirstLaunch] = useState(null);

  const userProfile = useSelector(state => state.userProfile.userProfile);
  const isLoggedIn = useSelector(state => state.login.IS_LOGGED_IN);
  const dispatch = useDispatch();
  const toast = useToast();
  const { t } = useLanguage();

  const navigationRef = useRef(null);
  const pendingNotificationNav = useRef(false);
  const isNavigationReadyRef = useRef(false);
  const isLoggedInRef = useRef(false);
  const isLoadingRef = useRef(true);
  const appState = useRef(AppState.currentState);
  const welcomeModalCloseInFlight = useRef(false);
  const lockLogoutInFlight = useRef(false);

  const { activeNotification, showNotificationToast, dismissNotificationToast } =
    useNotificationToast();

  // ── Keep refs in sync with state ──────────────────────────────────────────
  useEffect(() => {
    requestUserPermission();
    isNavigationReadyRef.current = isNavigationReady;
    isLoggedInRef.current = isLoggedIn;
    isLoadingRef.current = isLoading;
  }, [isLoading, isLoggedIn, isNavigationReady]);

  // ── Socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    initializeSocket().catch(e => console.warn('Socket init failed', e));
  }, []);

  // ── Notifications (all FCM + Notifee wiring lives in this hook) ───────────
  useNotificationSetup({ showNotificationToast, setMessage });

  // ─────────────────────────────────────────────────────────────────────────
  // HeartNotification navigation
  // ─────────────────────────────────────────────────────────────────────────

  const navigateToHeartNotification = React.useCallback(() => {
    if (
      !navigationRef.current ||
      !isNavigationReadyRef.current ||
      !isLoggedInRef.current ||
      isLoadingRef.current
    ) {
      pendingNotificationNav.current = true;
      return;
    }
    pendingNotificationNav.current = false;
    navigationRef.current.navigate('MainApp', {
      screen: 'HomeMain',
      params: { screen: 'HeartNotification' },
    });
  }, []);

  useEffect(() => {
    if (pendingNotificationNav.current) {
      navigateToHeartNotification();
    }
  }, [isLoading, isLoggedIn, isNavigationReady, navigateToHeartNotification]);

  // ─────────────────────────────────────────────────────────────────────────
  // KYC welcome-modal logic
  // ─────────────────────────────────────────────────────────────────────────

  const checkKycAndShowWelcomeModal = React.useCallback(async () => {
    try {
      if (!isLoggedIn) {
        setWelcomeModalVisible(false);
        setlockModal(false);
        return;
      }

      const id = await AsyncStorage.getItem('userId');
      if (!id) return;

      const [hasShownWelcome, hasShownLegacy, storedProfileType] = await Promise.all([
        AsyncStorage.getItem(KYC_WELCOME_SHOWN_KEY),
        AsyncStorage.getItem(LEGACY_KYC_WELCOME_SHOWN_KEY),
        AsyncStorage.getItem('profile'),
      ]);

      const response = await getUserCredentials(id);
      console.log(response, 'fdATAresponseresponseresponseresponseresponseresponse');
      if (response?.statusCode !== 200) return;

      const userData = response?.data?.user || response?.data || response;
      const kycStatus = userData?.kycStatus !== 'APPROVED';
      const profile = userData?.profile;
      const kycApproved = userData?.kyc === true || String(userData?.kyc || '').toLowerCase() === 'true';
      const firstLogRaw =
        userData?.first_log ??
        userData?.firstLog ??
        userData?.first_login ??
        userData?.firstLogin ??
        userData?.firstLoginAfterKyc;
      const firstLog = firstLogRaw === true || String(firstLogRaw || '').toLowerCase() === 'true';

      setWelcomeModalVisible(kycApproved && firstLog);
      setlockModal(!kycApproved)
      setVerificationProfileType(profile)
    } catch (error) {
      console.log('KYC polling check failed:', error?.message || error);
    }
  }, [isLoggedIn]);

  const handleVerificationDoNow = React.useCallback(() => {
    setlockModal(false);
    if (!navigationRef.current || !isNavigationReadyRef.current) return;

    if (verificationProfileType === 'company') {
      navigationRef.current.navigate(isLoggedIn ? 'BusinessSetup' : 'BusinessSetupAuth', {
        profile: 'company',
      });
      return;
    }

    navigationRef.current.navigate(isLoggedIn ? 'kycverify' : 'KycVerifyAuth', {
      profile: 'user',
    });
  }, [isLoggedIn, verificationProfileType]);

  const handleWelcomeModalClose = async () => {
    if (welcomeModalCloseInFlight.current) return;

    welcomeModalCloseInFlight.current = true;

    try {
      const response = await updatLoginModal();


      // Hide modal after successful API call
      setWelcomeModalVisible(false);

      // Re-fetch user data immediately
      checkKycAndShowWelcomeModal();
    } catch (error) {
      console.log(
        'Failed to update first login after KYC:',
        error?.message || error,
      );
    } finally {
      welcomeModalCloseInFlight.current = false;
    }
  };

  const blockProfile = React.useCallback(async () => {
    try {
      if (lockLogoutInFlight.current) return;

      const response = await lockProfile();
      console.log(response, 'llick profilee e reposneenenene')
      const isLock = String(response?.data?.isLock ?? '').toLowerCase() === 'true';
      if (!isLock) return;

      lockLogoutInFlight.current = true;
      const storedProfileType = await AsyncStorage.getItem('profile');
      const normalizedProfileType = String(storedProfileType || verificationProfileType || '').toLowerCase();
      setVerificationProfileType(
        normalizedProfileType === 'company' || normalizedProfileType === 'business'
          ? 'company'
          : 'user',
      );
      setlockModal(false);
      setWelcomeModalVisible(false);
      setBlockedVerificationProfile(
        normalizedProfileType === 'company' || normalizedProfileType === 'business'
          ? 'company'
          : 'user',
      );
      dispatch(setUserProfile('normal'));
      await AsyncStorage.clear();
      dispatch(loggedOut());
    } catch (err) {
      lockLogoutInFlight.current = false;
      console.log(err)
    }
  }, [dispatch, verificationProfileType])

  useEffect(() => {
    if (!isLoggedIn) return;
    blockProfile();
  }, [blockProfile, isLoggedIn])

  useEffect(() => {
    if (
      !blockedVerificationProfile ||
      isLoggedIn ||
      isLoading ||
      !isNavigationReady ||
      !navigationRef.current
    ) {
      return;
    }

    navigationRef.current.navigate('BlockedVerification', {
      profile: blockedVerificationProfile,
    });
    setBlockedVerificationProfile(null);
  }, [blockedVerificationProfile, isLoading, isLoggedIn, isNavigationReady]);

  useEffect(() => {
    if (!isLoggedIn) return;
    checkKycAndShowWelcomeModal();
    const intervalId = setInterval(() => {
      checkKycAndShowWelcomeModal();
      blockProfile();
    }, 90000);

    return () => {
      clearInterval(intervalId);
    };
  }, [blockProfile, checkKycAndShowWelcomeModal, isLoggedIn]);

  // ─────────────────────────────────────────────────────────────────────────
  // Bootstrap: session check + deep-link wiring
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    dispatch(setUserProfile('normal'));

    // ── Token refresh ──────────────────────────────────────────────────────
    const fetchRefreshToken = async () => {
      const oldToken = await AsyncStorage.getItem('refreshToken');
      try {
        const response = await refreshToken({ refreshToken: oldToken });
        if (response?.statusCode === 200) {
          console.log('response in refreshtoken:', response);
          await AsyncStorage.setItem('token', response.data.access_token);
          await AsyncStorage.setItem('refreshToken', response.data.refresh_token);
        } else {
          showToastMessage(toast, 'danger', response.data.message);
        }
      } catch {
        // Silent — token refresh failures are non-fatal
      }
    };
    fetchRefreshToken();

    // ── Session validation ─────────────────────────────────────────────────
    const checkLogin = async () => {
      try {
        // ── First-launch detection
        const hasLaunchedBefore = await AsyncStorage.getItem('hasLaunchedBefore');
        if (!hasLaunchedBefore) {
          await AsyncStorage.setItem('hasLaunchedBefore', 'true');
          setIsFirstLaunch(true);
        } else {
          setIsFirstLaunch(false);
        }

        const [loggedI, deviceId] = await Promise.all([
          AsyncStorage.getItem('isLoggedIn'),
          AsyncStorage.getItem('device_id'),
        ]);

        if (loggedI !== 'true') { dispatch(loggedOut()); return; }

        const response = await authSesionHistory();
        const sessions = response?.data?.sessions || [];
        const currentSession = sessions.find(s => s.deviceId === deviceId);

        if (currentSession) {
          dispatch(loggedIn());
          await ensureCurrentAccountSaved();
          requestUserPermission();
          const storedStripeId = await AsyncStorage.getItem('stripeCustomerId');
          if (storedStripeId) dispatch(setStripeCustomerId(storedStripeId));
        } else {
          console.log('Session not found, logging out');
          await AsyncStorage.clear();
          dispatch(loggedOut());
        }
      } catch (error) {
        console.log('Error in checkLogin:', error);
        dispatch(loggedOut());
      }
    };
    checkLogin();

    // ── AppState ───────────────────────────────────────────────────────────
    const appStateSubscription = AppState.addEventListener('change', nextState => {
      console.log('AppState changed:', appState.current, '->', nextState);
      if (nextState === 'active') checkKycAndShowWelcomeModal();
      appState.current = nextState;
    });

    // ── Deep-link navigation helpers ───────────────────────────────────────
    const navigateToUserProfile = async (resolvedUserId) => {
      if (!resolvedUserId || !navigationRef.current || !isNavigationReadyRef.current) return; // 👈 use ref
      const loggedInUserId = await AsyncStorage.getItem('userId');
      const isSelf = String(loggedInUserId || '').trim() === String(resolvedUserId).trim();

      if (isSelf) {
        navigationRef.current.navigate('MainApp', {
          screen: 'ProfileMain',
          params: { screen: 'Profile' },
        });
      } else {
        navigationRef.current.navigate('MainApp', {
          screen: 'HomeMain',
          params: { screen: 'UsersProfile', params: { userId: String(resolvedUserId) } },
        });
      }
    };

    const resolveUserIdFromUsername = async (incomingUsername) => {
      const cleanUsername = decodeURIComponent(
        String(incomingUsername || '').trim()
      ).replace(/^@+/, '');
      if (!cleanUsername) return null;
      try {
        const response = await getAllUser({ userName: cleanUsername });
        const users = response?.data?.users ?? [];
        const exactMatch = users.find(
          u => String(u?.userName || u?.username || '').toLowerCase() === cleanUsername.toLowerCase()
        );
        const user = exactMatch || users[0];
        return user?.id || user?._id || user?.userId || null;
      } catch (error) {
        console.log('Username resolution failed:', error?.message || error);
        return null;
      }
    };

    /** Waits until navigation is ready, then calls doNavigate(). */
    const navigateWhenReady = (doNavigate, timeoutMs = 10_000) => {
      if (navigationRef.current && isNavigationReadyRef.current) {
        doNavigate();
        return;
      }
      const interval = setInterval(() => {
        if (navigationRef.current && isNavigationReadyRef.current) {
          clearInterval(interval);
          doNavigate();
        }
      }, 100);
      setTimeout(() => clearInterval(interval), timeoutMs);
    };

    // ── Deep-link handler ──────────────────────────────────────────────────
    const handleDeepLink = async (event) => {
      const url = String(event?.url || '').trim();
      if (!url) return;
      console.log('Deep link received:', url);

      // MetaMask return
      const isMetaMaskReturn = url === 'com.valens.app://' || url === 'com.valens.app';
      if (isMetaMaskReturn) {
        const pending = await AsyncStorage.getItem('pending_metamask_connect');
        if (pending === 'true') {
          await AsyncStorage.removeItem('pending_metamask_connect');
          console.log('🦊 Returned from MetaMask');
          DeviceEventEmitter.emit('METAMASK_RETURN', { timestamp: Date.now() });
        }
        return;
      }

      let urlObj;
      try {
        urlObj = new URL(normalizeDeepLinkUrl(url));
      } catch (error) {
        console.error('URL parsing error:', error);
        return;
      }

      const path = urlObj.pathname;
      const normalizedPath = path.toLowerCase();

      // Callback / payment
      if (normalizedPath === '/callback') {
        console.log('🔔 Callback URL detected — closing InAppBrowser');
        try {
          if (await InAppBrowser.isAvailable()) await InAppBrowser.close();
        } catch (error) {
          console.log('❌ Error closing InAppBrowser:', error);
        }

        let status = 'success';
        try {
          status = new URL(normalizeDeepLinkUrl(url)).searchParams.get('status') || 'success';
        } catch { /* ignore */ }

        console.log('📢 Emitting PAYMENT_COMPLETED with status:', status);
        DeviceEventEmitter.emit('PAYMENT_COMPLETED', { status, timestamp: Date.now() });
        setTimeout(() => dispatch(hideLoader()), 500);
        return;
      }

      // Path-based routing
      const postMatch = normalizedPath.match(/^\/postshare\/([^/?]+)/i);
      const reelMatch = normalizedPath.match(/^\/reelshare\/([^/?]+)/i);
      const storyMatch = normalizedPath.match(/^\/storyshare\/([^/?]+)/i);
      const profileMatch = normalizedPath.match(/^\/profile\/([^/?]+)/i);

      if (postMatch?.[1]) {
        const postId = decodeURIComponent(postMatch[1]);
        navigateWhenReady(() =>
          navigationRef.current?.navigate('MainApp', {
            screen: 'ProfileMain',
            params: {
              screen: 'PostView',
              params: { userChat: true, fromScreen: 'DeepLink', postData: { id: postId } },
            },
          })
        );
        return;
      }

      if (reelMatch?.[1]) {
        const reelId = decodeURIComponent(reelMatch[1]);
        navigateWhenReady(() =>
          navigationRef.current?.navigate('MainApp', {
            screen: 'HomeMain',
            params: {
              screen: 'FlipsScreen',
              params: { item: { id: reelId }, uniqueKey: `deeplink_reel_${reelId}` },
            },
          })
        );
        return;
      }

      if (storyMatch?.[1]) {
        const storyId = decodeURIComponent(storyMatch[1]);
        navigateWhenReady(() =>
          navigationRef.current?.navigate('MainApp', {
            screen: 'HomeMain',
            params: { screen: 'Home', params: { sharedStoryId: storyId } },
          })
        );
        return;
      }

      if (profileMatch?.[1]) {
        const profileId = decodeURIComponent(profileMatch[1]);
        navigateWhenReady(() => navigateToUserProfile(profileId));
        return;
      }

      // Query-param fallbacks + profile share
      const postId = urlObj.searchParams.get('postId');
      const reelId = urlObj.searchParams.get('reelId');
      const storyId = String(urlObj.searchParams.get('storyId') || '').trim();
      const fallbackTag = urlObj.searchParams.get('af');
      const sharedProfile = parseProfileShareUrl(url);

      if (postId && fallbackTag === 'dd') {
        navigateWhenReady(() =>
          navigationRef.current?.navigate('MainApp', {
            screen: 'ProfileMain',
            params: {
              screen: 'PostView',
              params: { userChat: true, fromScreen: 'DeepLink', postData: { id: String(postId) } },
            },
          })
        );
      } else if (reelId && fallbackTag === 'dd') {
        navigateWhenReady(() =>
          navigationRef.current?.navigate('MainApp', {
            screen: 'HomeMain',
            params: {
              screen: 'FlipsScreen',
              params: { item: { id: String(reelId) }, uniqueKey: `deeplink_reel_${reelId}` },
            },
          })
        );
      } else if (storyId && fallbackTag === 'dd') {
        navigateWhenReady(() =>
          navigationRef.current?.navigate('MainApp', {
            screen: 'HomeMain',
            params: { screen: 'Home', params: { sharedStoryId: storyId } },
          })
        );
      } else if (sharedProfile) {
        const userId = String(sharedProfile?.userId || '').trim()
          || (String(sharedProfile?.username || '').match(/^[0-9a-f-]{36}$/i)
            ? sharedProfile.username : '');
        const username = String(sharedProfile?.username || '').trim();

        if (userId) {
          navigateWhenReady(() => navigateToUserProfile(userId));
        } else if (username) {
          resolveUserIdFromUsername(username).then(resolvedId => {
            navigateWhenReady(() => {
              if (resolvedId) {
                navigateToUserProfile(resolvedId);
              } else {
                navigationRef.current?.navigate('MainApp', {
                  screen: 'ProfileMain',
                  params: { screen: 'Profile' },
                });
              }
            });
          });
        } else {
          navigateWhenReady(() =>
            navigationRef.current?.navigate('MainApp', {
              screen: 'ProfileMain',
              params: { screen: 'Profile' },
            })
          );
        }
      } else if (path === '/wallet') {
        navigateWhenReady(() => navigationRef.current?.navigate('Wallet'));
      } else if (path === '/home' || path === '/') {
        navigateWhenReady(() => navigationRef.current?.navigate('Home'));
      }
    };

    const linkingSubscription = Linking.addEventListener('url', handleDeepLink);

    if (!_initialUrlConsumed) {
      _initialUrlConsumed = true;
      Linking.getInitialURL().then(url => {
        if (url) {
          console.log('Initial URL:', url);
          handleDeepLink({ url });
        }
      });
    }

    return () => {
      linkingSubscription.remove();
      appStateSubscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, toast, isNavigationReady, checkKycAndShowWelcomeModal]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <ThemeProvider activeProfile={userProfile}>
        <Splash onFinish={() => setIsLoading(false)} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider activeProfile={userProfile}>
      <NavigationContainer
        ref={navigationRef}
        linking={linking}
        onReady={() => {
          console.log('Navigation is ready');
          isNavigationReadyRef.current = true;
          setIsNavigationReady(true);
        }}
      >
        <MainStack isFirstLaunch={isFirstLaunch} />
      </NavigationContainer>
      <WelcomeValensModal
        visible={welcomeModalVisible}
        onClose={handleWelcomeModalClose}
      />
      <ProfileVerificationReminderModal
        visible={lockModal}
        profileType={verificationProfileType}
        onDoNow={handleVerificationDoNow}
        onLater={() => setlockModal(false)}
      />
    </ThemeProvider>
  );
}
