import React, { useCallback, useRef } from 'react';
import Main from './src';
import store from './src/redux/store/store';
import { Provider } from 'react-redux';
import { ToastProvider } from 'react-native-toast-notifications';
import Loader from './src/utils/loader';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import { Platform, StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { AppKitProvider } from '@reown/appkit-react-native';
import { appKit, wagmiAdapter } from './src/config/AppKitConfig';
import { WalletConnectSupportProvider } from './src/context/WalletConnectSupportContext';
import { ThemeProvider } from './src/theme/ThemeContext';
import { LanguageProvider } from './src/i18n';
import appsFlyer from 'react-native-appsflyer';
import {
  getTrackingStatus,
  requestTrackingPermission,
} from 'react-native-tracking-transparency';

const queryClient = new QueryClient();

// Request ATT permission on iOS 14+, then start AppsFlyer regardless of the result.
// Apple requires ATTrackingManager.requestTrackingAuthorization to be called before
// any tracking activity begins. AppsFlyer handles limited attribution automatically
// when the user denies or restricts tracking.
const initAppsFlyer = async () => {
  if (Platform.OS === 'ios') {
    try {
      const trackingStatus = await getTrackingStatus();
      if (trackingStatus === 'not-determined') {
        // Show the iOS ATT permission dialog
        const result = await requestTrackingPermission();
        console.log('ATT permission result:', result);
      } else {
        console.log('ATT permission status already set:', trackingStatus);
      }
    } catch (error) {
      // Do not bail out – always proceed to start AppsFlyer
      console.log('ATT permission error:', error);
    }
  }

  // Always initialise and start AppsFlyer regardless of ATT outcome.
  const options = {
    devKey: 'mFQ3phNqHzSU2JJxv7vA73',
    isDebug: false,
    appId: 'id6752780902',

    // iOS ATT – SDK waits this many seconds for ATT before starting
    timeToWaitForATTUserAuthorization: 10,

    // Start manually after the ATT request above completes
    manualStart: true,
  };

  appsFlyer.initSdk(
    options,

    result => {
      console.log('AppsFlyer initialized:', result);
      appsFlyer.startSdk();
    },

    error => {
      console.log('AppsFlyer initialization error:', error);
    },
  );
};

const App = () => {
  const appsFlyerInitializedRef = useRef(false);

  const handleSplashFinish = useCallback(() => {
    if (appsFlyerInitializedRef.current) return;
    appsFlyerInitializedRef.current = true;
    initAppsFlyer();
  }, []);

  return (
    <StripeProvider publishableKey="pk_live_51RinJmI6058y7xM226kIAHWD0PyowTEpFBfeQW4b0ndCGyf40mAa30h8QF2mNsjJVufEaCPXyqPO5bb0XsifW6y500MOhQvXoW">
      <SafeAreaProvider style={styles.container}>
        <ToastProvider
          placement="top"
          duration={3000}
          animationType="slide-in"
          offsetTop={10}
          textStyle={{ fontSize: 16 }}
          successColor="green"
          dangerColor="red"
          warningColor="orange"
        >
          <AppKitProvider instance={appKit}>
            <WagmiProvider config={wagmiAdapter.wagmiConfig}>
              <QueryClientProvider client={queryClient}>
                <Provider store={store}>
                  <ThemeProvider>
                    <Loader>
                      <LanguageProvider>
                        <WalletConnectSupportProvider>
                          <Main onSplashFinish={handleSplashFinish} />
                        </WalletConnectSupportProvider>
                      </LanguageProvider>
                    </Loader>
                  </ThemeProvider>
                </Provider>
              </QueryClientProvider>
            </WagmiProvider>
          </AppKitProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </StripeProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // paddingBottom: 20
  },
});

export default App;
