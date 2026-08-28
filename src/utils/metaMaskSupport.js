import { Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { connectWalletLogin } from '../pages/authentication/socialLogin';
import { showToastMessage } from '../components/displaytoastmessage';

export const getSupportRecipientWalletAddress = (target = {}) =>
  target?.walletId ||
  target?.walletAddress ||
  target?.wallet ||
  target?.userWalletAddress ||
  target?.userTokenAddress ||
  target?.creatorWalletAddress ||
  target?.vendorWalletAddress ||
  target?.receiverWalletAddress ||
  target?.tokenAddress ||
  null;

const CHAIN_ID_MAP = {
  ethereum: '1',
  mainnet: '1',
  sepolia: '11155111',
  polygon: '137',
  matic: '137',
  bsc: '56',
  binance: '56',
  arbitrum: '42161',
  optimism: '10',
  avalanche: '43114',
  base: '8453',
};

/** Resolves a chain id for deep links. Returns null when unknown so MetaMask uses the wallet's current network (avoids "chain 1 not found" when Mainnet is disabled and user is on Sepolia). */
const normalizeChainId = (chainId) => {
  if (chainId === undefined || chainId === null || String(chainId).trim() === '') {
    return null;
  }

  const str = String(chainId).trim().toLowerCase();

  if (/^\d+$/.test(str)) return str;
  if (/^0x[0-9a-f]+$/i.test(str)) return String(parseInt(str, 16));
  if (CHAIN_ID_MAP[str]) return CHAIN_ID_MAP[str];

  return null;
};

const openMetaMaskPayment = async (recipientWalletAddress, chainId) => {
  if (!recipientWalletAddress) {
    Alert.alert('Wallet unavailable', 'This creator wallet address is not available right now.');
    return false;
  }

  const normalizedChainId = normalizeChainId(chainId);

  // ADD THIS - check your logs
  console.log('--- MetaMask Debug ---');
  console.log('recipientWalletAddress:', recipientWalletAddress);
  console.log('chainId (raw):', chainId);
  console.log('chainId (normalized):', normalizedChainId);

  const deepLink = normalizedChainId
    ? `https://metamask.app.link/send/${recipientWalletAddress}@${normalizedChainId}`
    : `https://metamask.app.link/send/${recipientWalletAddress}`;

  console.log('deepLink:', deepLink);

  const storeUrl =
    Platform.OS === 'ios'
      ? 'https://apps.apple.com/app/metamask/id1438144202'
      : 'https://play.google.com/store/apps/details?id=io.metamask';

  try {
    await Linking.openURL(deepLink);
    return true;
  } catch (error) {
    Alert.alert(
      'MetaMask Not Installed',
      'MetaMask is not installed or cannot be opened. Would you like to install it?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Install', onPress: () => Linking.openURL(storeUrl) },
      ],
    );
    return false;
  }
};

// Generic function to open wallet payment - works for any wallet
export const openWalletPayment = async (recipientWalletAddress, chainId, walletType = 'metamask') => {
  if (!recipientWalletAddress) {
    Alert.alert('Wallet unavailable', 'This creator wallet address is not available right now.');
    return false;
  }

  const normalizedChainId = normalizeChainId(chainId);

  // Different deep link formats for different wallets
  const deepLinks = {
    metamask: normalizedChainId
      ? `https://metamask.app.link/send/${recipientWalletAddress}@${normalizedChainId}`
      : `https://metamask.app.link/send/${recipientWalletAddress}`,
    coinbase: normalizedChainId
      ? `https://go.cb-w.com/send?address=${recipientWalletAddress}&chainId=${normalizedChainId}`
      : `https://go.cb-w.com/send?address=${recipientWalletAddress}`,
    trust: normalizedChainId
      ? `trust://send?address=${recipientWalletAddress}&chainId=${normalizedChainId}`
      : `trust://send?address=${recipientWalletAddress}`,
  };

  const deepLink = deepLinks[walletType] || deepLinks.metamask;

  try {
    await Linking.openURL(deepLink);
    return true;
  } catch (error) {
    Alert.alert(
      'Wallet Not Available',
      'The wallet app could not be opened. Please make sure it is installed.',
      [{ text: 'OK' }],
    );
    return false;
  }
};

export const handleMetaMaskSupportFlow = async ({
  recipientWalletAddress,
  walletAddress,
  setWalletAddress,
  toast,
  navigation,
  dispatch,
  onShowWalletSelection, // Callback to show wallet selection modal
}) => {
  const currentWalletAddress = walletAddress || await AsyncStorage.getItem('walletAddress');
  const currentWalletChainId = await AsyncStorage.getItem('walletChainId');
  const currentWalletType = await AsyncStorage.getItem('walletType') || 'metamask';

  // Always show wallet selection modal if callback is provided
  // This allows users to choose/change their wallet even if one is already connected
  if (onShowWalletSelection) {
    onShowWalletSelection();
    return false;
  }

  // If wallet is already connected and no callback provided, proceed with payment
  if (currentWalletAddress) {
    setWalletAddress?.(currentWalletAddress);
    return openWalletPayment(recipientWalletAddress, currentWalletChainId, currentWalletType);
  }

  // Fallback: Show alert if no callback and no wallet connected
  Alert.alert(
    'Wallet not connected',
    'Connect your wallet to support this creator.',
    [
      { text: 'Later', style: 'cancel' },
      {
        text: 'Connect wallet',
        onPress: async () => {
          const connectedAddress = await connectWalletLogin(toast, navigation, dispatch, {
            returnAddressOnly: true,
            walletType: 'metamask',
          });

          if (connectedAddress) {
            await AsyncStorage.setItem('walletAddress', connectedAddress);
            await AsyncStorage.setItem('walletType', 'metamask');
            setWalletAddress?.(connectedAddress);
            showToastMessage(toast, 'success', 'Wallet connected successfully');
            const connectedWalletChainId = await AsyncStorage.getItem('walletChainId');
            await openWalletPayment(recipientWalletAddress, connectedWalletChainId, 'metamask');
          }
        },
      },
    ],
    { cancelable: true },
  );

  return false;
};
