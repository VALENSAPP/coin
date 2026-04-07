/**
 * Reown / WalletConnect project config for Sepolia support payments.
 * Create a project at https://cloud.reown.com and set WALLETCONNECT_PROJECT_ID in env when you add react-native-dotenv.
 * Register the same native redirect URL in the project mobile settings.
 *
 * Use the bundle-style iOS scheme so wallet handoff returns to the installed app
 * more reliably on iPhone.
 */
 
/** Replace with your Reown Cloud project ID (https://cloud.reown.com). */
export const ENV_PROJECT_ID = 'ccae686f2e085a23a5923901f21af1a1';
 
export const providerMetadata = {
  name: 'Valens',
  description: 'Valens — connect wallet for creator support',
  url: 'https://valens.app',
  icons: ['https://valenscorp.com/favicon.ico'],
  redirect: {
    native: 'com.valens.app://',
  },
};
 
export const sessionParams = {
  namespaces: {
    eip155: {
      methods: [
        'eth_chainId',
        'eth_accounts',
        'eth_sendTransaction',
        'eth_signTransaction',
        'eth_sign',
        'personal_sign',
        'eth_signTypedData',
        'wallet_switchEthereumChain',
        'wallet_addEthereumChain',
      ],
      chains: ['eip155:11155111'],
      events: ['chainChanged', 'accountsChanged'],
      rpcMap: {},
    },
  },
};
 
const ConfigUtils = {
  ENV_PROJECT_ID,
  providerMetadata,
  sessionParams,
};
 
export default ConfigUtils;