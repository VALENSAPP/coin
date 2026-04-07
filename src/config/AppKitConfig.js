import '@walletconnect/react-native-compat';

import { createAppKit } from '@reown/appkit-react-native';
import { WagmiAdapter } from '@reown/appkit-wagmi-react-native';
import { sepolia } from 'viem/chains';
import ConfigUtils from '../utils/walletConnectModalConfig';
import { appKitStorage } from './appKitStorage';

const projectId = ConfigUtils.ENV_PROJECT_ID;

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: [sepolia],
});

/** Singleton from `createAppKit` — safe to import for `getProvider` outside React render. */
export const appKit = createAppKit({
  projectId,
  networks: [sepolia],
  defaultNetwork: sepolia,
  adapters: [wagmiAdapter],
  storage: appKitStorage,
  metadata: {
    name: ConfigUtils.providerMetadata.name,
    description: ConfigUtils.providerMetadata.description,
    url: ConfigUtils.providerMetadata.url,
    icons: ConfigUtils.providerMetadata.icons,
    redirect: ConfigUtils.providerMetadata.redirect,
  },
});
