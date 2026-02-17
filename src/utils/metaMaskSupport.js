import { Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MetasmaskLogin } from '../pages/authentication/socialLogin';
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
  polygon: '137',
  matic: '137',
  bsc: '56',
  binance: '56',
  arbitrum: '42161',
  optimism: '10',
  avalanche: '43114',
  base: '8453',
};

const normalizeChainId = (chainId) => {
  if (!chainId) return '1'; // ← default to Ethereum mainnet instead of ''

  const str = String(chainId).trim().toLowerCase();

  if (/^\d+$/.test(str)) return str;
  if (/^0x[0-9a-f]+$/i.test(str)) return String(parseInt(str, 16));
  if (CHAIN_ID_MAP[str]) return CHAIN_ID_MAP[str];

  return '1'; // ← fallback here too instead of ''
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

export const handleMetaMaskSupportFlow = async ({
  recipientWalletAddress,
  walletAddress,
  setWalletAddress,
  toast,
  navigation,
  dispatch,
}) => {
  const currentWalletAddress = walletAddress || await AsyncStorage.getItem('walletAddress');
  const currentWalletChainId = await AsyncStorage.getItem('walletChainId');

  if (currentWalletAddress) {
    setWalletAddress?.(currentWalletAddress);
    return openMetaMaskPayment(recipientWalletAddress, currentWalletChainId);
  }

  Alert.alert(
    'Wallet not connected',
    'Connect your MetaMask wallet to support this creator.',
    [
      { text: 'Later', style: 'cancel' },
      {
        text: 'Connect wallet',
        onPress: async () => {
          const connectedAddress = await MetasmaskLogin(toast, navigation, dispatch, {
            returnAddressOnly: true,
          });

          if (connectedAddress) {
            await AsyncStorage.setItem('walletAddress', connectedAddress);
            setWalletAddress?.(connectedAddress);
            showToastMessage(toast, 'success', 'Wallet connected successfully');
            const connectedWalletChainId = await AsyncStorage.getItem('walletChainId');
            await openMetaMaskPayment(recipientWalletAddress, connectedWalletChainId);
          }
        },
      },
    ],
    { cancelable: true },
  );

  return false;
};
