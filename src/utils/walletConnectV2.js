import AsyncStorage from '@react-native-async-storage/async-storage';
import SignClient from '@walletconnect/sign-client';

let client = null;

export async function initWalletConnect(projectId) {
  if (!client) {
    client = await SignClient.init({
      projectId,
      relayUrl: 'wss://relay.walletconnect.com',
      metadata: {
        name: 'Valens',
        description: 'Valens App',
        url: 'https://valens.com',
        icons: ['https://valens.com/icon.png'],
      },
    });
  }
  return client;
}

export async function connectWallet(projectId, walletType = null) {
  const walletConnectClient = await initWalletConnect(projectId);

  const { uri, approval } = await walletConnectClient.connect({
    requiredNamespaces: {
      eip155: {
        methods: [
          'eth_sendTransaction',
          'personal_sign',
          'eth_signTypedData'
        ],
        chains: ['eip155:1', 'eip155:137'],
        events: ['chainChanged', 'accountsChanged'],
      },
    },
  });

  // `uri` can already include the `wc:` prefix. Do not prepend again.
  const normalizedUri = uri
    ? (uri.startsWith('wc:') ? uri : `wc:${uri}`)
    : null;
  const encodedUri = normalizedUri ? encodeURIComponent(normalizedUri) : null;

  const deepLinks = {
    metamask: encodedUri ? `metamask://wc?uri=${encodedUri}` : null,
    coinbase: encodedUri ? `cbwallet://wc?uri=${encodedUri}` : null,
    // trust: `trust://wc?uri=${encodedUri}`,
    // rainbow: `rainbow://wc?uri=${encodedUri}`,
    // zerion: `zerion://wc?uri=${encodedUri}`,
    walletconnect: normalizedUri,
  };

  const selectedWalletDeepLink =
    walletType && deepLinks[walletType] ? deepLinks[walletType] : normalizedUri;

  // ✅ Set flag so deep link handler knows we're expecting a MetaMask return
  if (walletType === 'metamask') {
    await AsyncStorage.setItem('pending_metamask_connect', 'true');
  }

  return {
    connected: Boolean(approval),
    uri: normalizedUri,
    approval,
    universalUri: normalizedUri,
    metamaskDeepLink: deepLinks.metamask,
    coinbaseDeepLink: deepLinks.coinbase,
    trustDeepLink: deepLinks.trust,
    rainbowDeepLink: deepLinks.rainbow,
    zerionDeepLink: deepLinks.zerion,
    walletConnectDeepLink: normalizedUri,
    selectedWalletDeepLink,
    allDeepLinks: deepLinks,
  };
}
