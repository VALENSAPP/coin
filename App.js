
import React from 'react';
import Main from './src';
import store from './src/redux/store/store';
import { Provider } from 'react-redux';
import { ToastProvider } from 'react-native-toast-notifications';
import Loader from './src/utils/loader';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import { StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { AppKitProvider } from '@reown/appkit-react-native';
import { appKit, wagmiAdapter } from './src/config/AppKitConfig';
import { WalletConnectSupportProvider } from './src/context/WalletConnectSupportContext';
import { ThemeProvider } from './src/theme/ThemeContext';
import { LanguageProvider } from './src/i18n';

const queryClient = new QueryClient();

const App = () => {
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