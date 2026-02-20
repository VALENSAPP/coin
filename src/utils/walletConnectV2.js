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
  const client = await initWalletConnect(projectId);
  const { uri, approval } = await client.connect({
    requiredNamespaces: {
      eip155: {
        methods: ['eth_sendTransaction', 'personal_sign', 'eth_signTypedData'],
        chains: ['eip155:1', 'eip155:137'], // Ethereum and Polygon
        events: ['chainChanged', 'accountsChanged'],
      },
    },
  });

  if (uri) {
    // Universal WalletConnect URI - works with all WalletConnect-compatible wallets
    const universalUri = `wc:${uri}`;
    
    // Generate wallet-specific deep links for direct app opening
    const deepLinks = {
      metamask: `metamask://wc?uri=${encodeURIComponent(uri)}`,
      coinbase: `cbwallet://wc?uri=${encodeURIComponent(uri)}`,
      trust: `trust://wc?uri=${encodeURIComponent(uri)}`,
      rainbow: `rainbow://wc?uri=${encodeURIComponent(uri)}`,
      zerion: `zerion://wc?uri=${encodeURIComponent(uri)}`,
      walletconnect: universalUri,
    };

    // If walletType is specified, use that deep link, otherwise use universal
    const selectedDeepLink = walletType && deepLinks[walletType] 
      ? deepLinks[walletType] 
      : universalUri;

    return { 
      uri, 
      approval, 
      universalUri,
      metamaskDeepLink: deepLinks.metamask,
      coinbaseDeepLink: deepLinks.coinbase,
      trustDeepLink: deepLinks.trust,
      rainbowDeepLink: deepLinks.rainbow,
      zerionDeepLink: deepLinks.zerion,
      walletConnectDeepLink: universalUri,
      selectedWalletDeepLink: selectedDeepLink,
      allDeepLinks: deepLinks,
    };
  }
  return { uri: null, approval: null };
} 