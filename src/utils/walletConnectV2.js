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

export async function connectWallet(projectId) {
  const client = await initWalletConnect(projectId);
  const { uri, approval } = await client.connect({
    requiredNamespaces: {
      eip155: {
        methods: ['eth_sendTransaction', 'personal_sign', 'eth_signTypedData'],
        chains: ['eip155:1'],
        events: ['chainChanged', 'accountsChanged'],
      },
    },
  });

  if (uri) {
    const metamaskDeepLink = `metamask://wc?uri=${encodeURIComponent(uri)}`;
    const walletConnectDeepLink = `wc:${uri}`;
    return { uri, approval, metamaskDeepLink, walletConnectDeepLink };
  }
  return { uri: null, approval: null };
} 