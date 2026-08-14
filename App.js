
import React, { useEffect } from 'react';
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

// const options = {
//   devKey: 'mFQ3phNqHzSU2JJxv7vA73',
//   isDebug: true,
//   appId: 'id6752780902', // iOS only
// };

// appsFlyer.initSdk(
//   options,
//   (result) => {
//     console.log('AppFlyerrr',result);
//   },
//   (error) => {
//     console.log(error);
//   }
// );

const initAppsFlyer = async () => {
  if (Platform.OS === 'ios') {
    try {
      let status = await getTrackingStatus();
      if (status === 'not-determined') {
        status = await requestTrackingPermission();
      }
      console.log('ATT permission status:', status);

      // Do not initialize the attribution SDK on iOS 14+ unless the user has
      // explicitly authorized tracking. This prevents IDFA-based tracking when
      // permission is denied or restricted.
      if (status !== 'authorized' && status !== 'unavailable') {
        return;
      }
    } catch (error) {
      console.log('ATT permission error:', error);
      return;
    }
  }

  const options = {
    devKey: 'mFQ3phNqHzSU2JJxv7vA73',
    isDebug: false,
    appId: 'id6752780902',

    // iOS ATT
    timeToWaitForATTUserAuthorization: 10,

    // Start manually after ATT
    manualStart: true,
  };

  appsFlyer.initSdk(
    options,

    result => {
      console.log('AppsFlyer initialized:', result);
      // The iOS ATT gate above has completed before AppsFlyer is started.
      appsFlyer.startSdk();
    },

    error => {
      console.log('AppsFlyer initialization error:', error);
    },
  );
};


const App = () => {

    useEffect(() => {
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
                          <Main />
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
