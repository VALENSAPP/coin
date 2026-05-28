import { Platform, Alert, Linking } from 'react-native';
import { useDispatch } from 'react-redux';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';
import { showToastMessage } from '../../components/displaytoastmessage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { handleLoginSuccess, signup } from '../../services/authentication';
import { connectWallet } from '../../utils/walletConnectV2';
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { TextDecoder, TextEncoder } from 'text-encoding';
import { showLoader, hideLoader } from '../../redux/actions/LoaderAction';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { v4 as uuidv4 } from 'uuid';
const TWITTER_CLIENT_ID = 'dl9zMkpYeGhGcS1LY09iNExib3Y6MTpjaQ';
const REDIRECT_URI = 'valens://callback';
import axios from 'axios';
import { appleAuth } from '@invertase/react-native-apple-authentication';
import { getProfile } from '../../services/createProfile';
import { loggedIn } from '../../redux/actions/LoginAction';
import { persistStripeCustomerId } from '../../hooks/useStripeCustomer';
import { useToast } from 'react-native-toast-notifications';
import { ensureCurrentAccountSaved } from '../../utils/accountSession';
import { requestUserPermission } from '../../services/NotificationService';
import { setIsAddAccount } from '../../redux/actions/AddAccountAction';
import { setUserProfile } from '../../redux/actions/UserProfileAction';
import { clearSignupFormData } from '../../redux/actions/SignupFormAction';

// ─── NOTE ────────────────────────────────────────────────────────────────────
// These are non-hook utility functions. They receive `t` as a parameter from
// the calling screen (e.g. LoginScreen) so translation works without hooks.
// Usage: onGoogleButtonPress(dispatch, navigation, toast, profile, t)
// ─────────────────────────────────────────────────────────────────────────────

const codeVerifierRef = { current: null };

if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (Platform.OS == 'ios') {
  GoogleSignin.configure({
    iosClientId: '103724590021-256b5bh4tqesq7gulu0hj4oomr7a4h1c.apps.googleusercontent.com',
  });
} else {
  GoogleSignin.configure({
    webClientId:
      '103724590021-sd1nhjve9cn4mpmmo4bsodik5r3g0hpn.apps.googleusercontent.com',
  });
}


export const onGoogleButtonPress = async (dispatch, navigation, toast, profile, t) => {
  try {
    await GoogleSignin.signOut();

    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const userInfo = await GoogleSignin.signIn();

    const idToken = userInfo.idToken || userInfo.data?.idToken;

    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    const userCredential = await auth().signInWithCredential(googleCredential);
    const user = userCredential.user;

    if (user) {
      const idTokenFromUser = await user.getIdToken();
      AsyncStorage.setItem('firebaseToken', idTokenFromUser);
      const username =
        user?._user?.displayName ??
        user?.providerData?.[0]?.displayName ??
        'Unknown';
      console.log("idTokenFromUser--------------", idTokenFromUser)
      if (idToken) {
        signupReference('GOOGLE', idTokenFromUser, toast, dispatch, navigation, profile, username, t)
      }
    }
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      Alert.alert(t('socialLogin.cancelled'), t('socialLogin.googleCancelled'));
    } else if (error.code === statusCodes.IN_PROGRESS) {
      Alert.alert(t('socialLogin.inProgress'), t('socialLogin.googleInProgress'));
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      Alert.alert(t('socialLogin.error'), t('socialLogin.playServicesUnavailable'));
    } else {
      Alert.alert(t('socialLogin.error'), t('socialLogin.googleError'));
    }
  } finally {
  }
};

export const onAppleButtonPress = async (dispatch, navigation, toast, profile, t) => {
  try {
    dispatch(showLoader());
    const appleAuthRequestResponse = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
    });

    const { identityToken, nonce } = appleAuthRequestResponse;

    if (!identityToken) throw new Error(t('socialLogin.noAppleToken'));

    const appleCredential = auth.AppleAuthProvider.credential(identityToken, nonce);

    const userCredential = await auth().signInWithCredential(appleCredential);
    console.log('appleCredential------>>>>>>>>>', userCredential);

    const user = userCredential.user;
    const username =
      user?.displayName ??
      user?.providerData?.[0]?.displayName ??
      user?.providerData?.[0]?.providerUserInfo?.[1]?.displayName ??
      'Unknown';

    if (user) {
      auth().onAuthStateChanged((user) => {
        if (user) {
          user.providerData.forEach((provider) => {
            console.log('Provider: ', provider.providerId);
          });
        }
      });

      const idToken = await user.getIdToken();
      console.log('idtokennnnnnnn', idToken);

      signupReference('APPLE', idToken, toast, dispatch, navigation, profile, username, t)
    }
  } catch (error) {
    console.error('Apple login error:', error);
  }
  finally {
    dispatch(hideLoader());
  }
}

export const signInWithFirebase = async idToken => {
  try {
    const dispatch = useDispatch();
    const lookupResponse = await firebasePost('lookup', { idToken });
    console.log('-----lookupResponse-------', lookupResponse);

    const username =
      lookupResponse?.users?.[0]?.displayName ??
      lookupResponse?.users?.[0]?.providerUserInfo?.[1]?.displayName ??
      'Unknown';

    AsyncStorage.setItem('userId', lookupResponse.users[0].localId);
    AsyncStorage.setItem('username', username);
    AsyncStorage.setItem('email', lookupResponse.users[0].email);
    dispatch(loggedIn());
    dispatch(clearSignupFormData());
  } catch (err) {
    // handled elsewhere
  }
};

export async function twitterOAuthLogin(dispatch, toast, navigation, profile, t) {
  console.log('enter', REDIRECT_URI)
  const state = uuidv4();
  const codeChallenge = state;
  codeVerifierRef.current = codeChallenge;

  const authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${TWITTER_CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&scope=tweet.read%20users.read&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=plain`;

  try {
    const isAvailable = await InAppBrowser.isAvailable();
    if (isAvailable) {
      const result = await InAppBrowser.openAuth(authUrl, REDIRECT_URI, {
        dismissButtonStyle: 'cancel',
        preferredBarTintColor: '#1DA1F2',
        preferredControlTintColor: 'white',
        showTitle: false,
        enableUrlBarHiding: true,
        enableDefaultShare: false,
        forceCloseOnRedirection: true,
      });

      if (result.type === 'success' && result.url) {
        const codeMatch = result.url.match(/code=([^&]+)/);
        if (codeMatch) {
          const code = codeMatch[1];
          console.log('Authorization code:', code);
          await exchangeCodeForToken(code, dispatch, toast, navigation, profile, t);
        } else {
          showToastMessage(toast, 'danger', t('socialLogin.authCodeNotFound'));
        }
      }
    } else {
      Linking.openURL(authUrl);
    }
  } catch (error) {
    console.error('Twitter login error:', error);
    showToastMessage(toast, 'danger', t('socialLogin.twitterLoginFailed'));
  }
}

const getProfileData = async (dispatch, navigation, toast, accessToken, refreshToken, t) => {
  console.log('profile status--------after toast---------')
  try {
    dispatch(showLoader());
    const id = await AsyncStorage.getItem('userId');
    if (id) {
      const response = await getProfile(id);
      const normalizedKycStatus = String(response?.data?.kycStatus || '').toUpperCase();
      if (response.statusCode === 200 && (normalizedKycStatus === 'PENDING' || normalizedKycStatus === 'SUBMITTED' && normalizedKycStatus === 'true')) {
        requestUserPermission();
        await ensureCurrentAccountSaved({
          profile: response?.data?.profile || (await AsyncStorage.getItem('profile')) || 'normal',
          username: response?.data?.userName || response?.data?.username || (await AsyncStorage.getItem('username')),
          email: response?.data?.email || (await AsyncStorage.getItem('email')),
        });
        await AsyncStorage.setItem('isLoggedIn', 'true');
        dispatch(loggedIn());
        dispatch(clearSignupFormData());
        dispatch(setIsAddAccount(false));
        return;
      }
      else if (response.statusCode === 200 && (normalizedKycStatus === 'DECLINED' || normalizedKycStatus === 'REJECTED')) {
        showToastMessage(toast, 'danger', t('socialLogin.kycRejected'), 3500);
        navigation.navigate('CreateProfile', { profile: response.data.profile || 'user', accessToken, refreshToken, id });
      }
      else if (response.statusCode === 200 && response.data.kyc == false) {
        const profile = response.data.profile
        if (profile) {
          await AsyncStorage.setItem('profile', profile);
          dispatch(setUserProfile(profile));
        }
        navigation.navigate('CreateProfile', { profile: profile || 'user', accessToken, refreshToken, id });
      }
      else if (response.statusCode === 200 && response.data.bio == null) {
        const profile = response.data.profile
        if (profile) {
          await AsyncStorage.setItem('profile', profile);
          dispatch(setUserProfile(profile));
        }
        navigation.navigate('CreateProfile', { profile: profile || 'user', accessToken, refreshToken, id });
      }
      else {
        await persistStripeCustomerId(response?.data?.stripeCustomerId ?? null, dispatch);
        await ensureCurrentAccountSaved({
          profile: response?.data?.profile || (await AsyncStorage.getItem('profile')) || 'normal',
          username: response?.data?.userName || response?.data?.username || (await AsyncStorage.getItem('username')),
          email: response?.data?.email || (await AsyncStorage.getItem('email')),
        });
        showToastMessage(toast, 'success', t('socialLogin.loginSuccess'));
        await AsyncStorage.setItem('isLoggedIn', 'true');
        dispatch(loggedIn());
        dispatch(clearSignupFormData());
        dispatch(setIsAddAccount(false));
      }
    }
  } catch (err) {
    Alert.alert(t('socialLogin.error'), err.message || t('socialLogin.failedToFetchProfile'));
  } finally {
    dispatch(hideLoader());
  }
}

export const signupReference = async (type, idtoken, toast, dispatch, navigation, profile, userName, t) => {
  try {
    const payload = {
      registrationType: type,
      profile,
      ...(userName !== "Unknown" && { userName }),
    };

    if (type === "GOOGLE") {
      payload.googleId = idtoken;
    } else if (type === "WALLET") {
      payload.walletAddress = idtoken;
    } else if (type === "APPLE") {
      payload.appleId = idtoken;
    } else {
      payload.twitterId = idtoken
    }
    console.log("payload-----------------", payload)
    const response = await signup(payload);
    console.log('google signup', response)
    if (
      response && (response.statusCode == 200 || response.statusCode == 201)
    ) {
      if (response.data.error == true) {
        showToastMessage(toast, 'danger', response.data.msg);
      }
      else {
        await AsyncStorage.setItem('userId', response.data.id)
        if (response?.data?.userName || response?.data?.username) {
          await AsyncStorage.setItem('username', response?.data?.userName || response?.data?.username);
        }
        if (response?.data?.email) {
          await AsyncStorage.setItem('email', response?.data?.email);
        }
        await handleLoginSuccess(
          response.data.access_token,
          dispatch,
          navigation,
          getProfileData,
          toast,
          response.data.access_token,
          response.data.refresh_token,
          t,
        );
      }
    } else {
      showToastMessage(toast, 'danger', response.message);
    }
  } catch (error) {
    showToastMessage(toast, 'danger', error.message);
  }
};

// Generic wallet connection function that works for all wallet types
export const connectWalletLogin = async (toast, navigation, dispatch, t, options = {}) => {
  const returnAddressOnly = options?.returnAddressOnly === true;
  const walletType = options?.walletType || null;
  const projectId = '53707e25e6a88c4f83d2d0dba0904606';

  const walletConfigs = {
    metamask: {
      storeUrl: Platform.OS === 'ios'
        ? 'https://apps.apple.com/app/metamask/id1438144202'
        : 'https://play.google.com/store/apps/details?id=io.metamask',
      name: 'MetaMask',
    },
    coinbase: {
      storeUrl: Platform.OS === 'ios'
        ? 'https://apps.apple.com/app/coinbase-wallet/id1278383455'
        : 'https://play.google.com/store/apps/details?id=org.toshi',
      name: 'Coinbase Wallet',
    },
    trust: {
      storeUrl: Platform.OS === 'ios'
        ? 'https://apps.apple.com/app/trust-crypto-bitcoin-wallet/id1288339409'
        : 'https://play.google.com/store/apps/details?id=com.wallet.crypto.trustapp',
      name: 'Trust Wallet',
    },
    walletconnect: {
      storeUrl: null,
      name: 'WalletConnect',
    },
    rainbow: {
      storeUrl: Platform.OS === 'ios'
        ? 'https://apps.apple.com/app/rainbow-ethereum-wallet/id1457119021'
        : 'https://play.google.com/store/apps/details?id=me.rainbow',
      name: 'Rainbow',
    },
    zerion: {
      storeUrl: Platform.OS === 'ios'
        ? 'https://apps.apple.com/app/zerion-defi-wallet/id1456732568'
        : 'https://play.google.com/store/apps/details?id=io.zerion.android',
      name: 'Zerion',
    },
  };

  const walletConfig = walletType ? (walletConfigs[walletType] || walletConfigs.metamask) : { name: 'Wallet', storeUrl: null };

  dispatch(showLoader());

  try {
    const { selectedWalletDeepLink, universalUri, approval, uri } = await connectWallet(projectId, walletType);

    if (!approval) {
      showToastMessage(toast, 'danger', t('socialLogin.walletSessionFailed'));
      return;
    }

    if (uri) {
      try {
        let deepLinkToOpen = selectedWalletDeepLink || universalUri;

        if (walletType && walletType !== 'walletconnect' && deepLinkToOpen) {
          try {
            const canOpen = await Linking.canOpenURL(deepLinkToOpen);
            if (!canOpen && universalUri) {
              deepLinkToOpen = universalUri;
            }
          } catch (checkErr) {
            if (universalUri) {
              deepLinkToOpen = universalUri;
            }
          }
        }

        if (!deepLinkToOpen) {
          showToastMessage(toast, 'danger', t('socialLogin.walletDeepLinkFailed'));
          return;
        }

        await Linking.openURL(deepLinkToOpen);
      } catch (openErr) {
        if (walletConfig.storeUrl) {
          Alert.alert(
            t('socialLogin.walletNotInstalled', { name: walletConfig.name }),
            t('socialLogin.walletNotInstalledMessage', { name: walletConfig.name }),
            [
              { text: t('socialLogin.cancel'), style: 'cancel' },
              { text: t('socialLogin.install'), onPress: () => Linking.openURL(walletConfig.storeUrl) },
            ]
          );
        } else {
          Alert.alert(
            t('socialLogin.openWallet'),
            t('socialLogin.openWalletMessage'),
            [
              { text: t('socialLogin.cancel'), style: 'cancel' },
              {
                text: t('socialLogin.tryUniversalLink'),
                onPress: async () => {
                  try {
                    if (universalUri) {
                      await Linking.openURL(universalUri);
                    }
                  } catch (err) {
                    showToastMessage(toast, 'danger', t('socialLogin.installWalletHint'));
                  }
                }
              },
            ]
          );
        }
        return;
      }
    }

    const session = await approval();
    const accounts = session?.namespaces?.eip155?.accounts || [];
    console.log('All accounts from session:', accounts);

    const accountOnPreferredChain =
      accounts.find((item) => item.startsWith('eip155:137:')) ||
      accounts.find((item) => item.startsWith('eip155:1:')) ||
      accounts[0] ||
      '';

    const parts = accountOnPreferredChain.split(':');
    const connectedChainId = parts[1];
    const address = parts[2];

    console.log('Connected Chain ID:', connectedChainId);
    console.log('Connected Address:', address);

    if (connectedChainId) {
      await AsyncStorage.setItem('walletChainId', connectedChainId);
    }
    if (address) {
      await AsyncStorage.setItem('walletAddress', address);
      await AsyncStorage.setItem('walletType', walletType || 'walletconnect');
    }

    if (address && !returnAddressOnly && navigation !== 'createProfile') {
      await signupReference('WALLET', address, toast, dispatch, navigation, undefined, undefined, t);
    } else {
      return address;
    }
  } catch (err) {
    const msg = err?.data?.message || err.message || t('socialLogin.connectionFailed');
    showToastMessage(toast, 'danger', msg);
  } finally {
    dispatch(hideLoader());
  }
};

// Keep MetasmaskLogin for backward compatibility
export const MetasmaskLogin = async (toast, navigation, dispatch, t, options = {}) => {
  return connectWalletLogin(toast, navigation, dispatch, t, { ...options, walletType: 'metamask' });
};

export const exchangeCodeForToken = async (code, dispatch, toast, navigation, profile, t) => {
  try {
    const data = new URLSearchParams({
      client_id: TWITTER_CLIENT_ID,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifierRef.current,
      code,
    }).toString();

    const response = await axios.post(
      'https://api.twitter.com/2/oauth2/token',
      data,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const accessToken = response.data.access_token;
    console.log('Access token:', accessToken);

    if (accessToken) {
      await signupReference('TWITTER', accessToken, toast, dispatch, navigation, profile, undefined, t);
    } else {
      showToastMessage(toast, 'danger', t('socialLogin.twitterTokenNotFound'));
    }
  } catch (error) {
    console.error('Token exchange error:', error.response?.data || error.message);
    showToastMessage(toast, 'danger', t('socialLogin.tokenExchangeFailed'));
  }
};