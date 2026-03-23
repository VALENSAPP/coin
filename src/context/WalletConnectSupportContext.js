import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  WalletConnectModal,
  useWalletConnectModal,
} from '@walletconnect/modal-react-native';
import ConfigUtils from '../utils/walletConnectModalConfig';
import { Platform } from 'react-native';
import { RequestModal } from '../components/modals/RequestModal';
import { showToastMessage } from '../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';

const SEPOLIA_CHAIN_ID = '0xaa36a7';

const WalletConnectSupportContext = createContext(null);

function normalizeChainIdHex(chainId) {
  if (chainId == null || chainId === '') return '';
  const s = String(chainId).trim();
  try {
    const n = BigInt(/^0x/i.test(s) ? s : s);
    return '0x' + n.toString(16);
  } catch {
    return s.toLowerCase();
  }
}

function ethValueHexFromEth(amountEth) {
  const wei = BigInt(Math.round(Number(amountEth) * 1e18));
  return '0x' + wei.toString(16);
}

/** Default Sepolia tip amount (ETH). */
export const DEFAULT_SUPPORT_AMOUNT_ETH = 0.000001;

/** Prefix Metro / JS logs so you can filter: `npx react-native start` terminal. */
const LOG = '[WC-Support]';

function WalletConnectSupportInner({ children }) {
  const toast = useToast();
  const {
    isConnected,
    provider,
    open,
    address,
    close: closeWalletModal,
    isOpen: isWalletModalOpen,
  } = useWalletConnectModal();

  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rpcResponse, setRpcResponse] = useState(null);

  /** Latest hook values for async `startSupportPayment` (avoids stale closures). */
  const modalSnapshotRef = useRef({
    isConnected,
    provider,
    address,
  });
  modalSnapshotRef.current = { isConnected, provider, address };

  /** Calls Reown `open()` — this shows the “Connect your wallet” modal. Logs to Metro. */
  const openWalletConnectModal = useCallback(async () => {
    console.log(LOG, 'open() invoked → WalletConnect modal should open');
    // iOS: let any in-flight modal animations finish so WC modal is not blocked by another RN modal.
    if (Platform.OS === 'ios') {
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
    const result = open();
    if (result != null && typeof result.then === 'function') {
      result.catch((e) => console.warn(LOG, 'open() rejected', e));
    }
    return result;
  }, [open]);

  const waitForConnection = useCallback(async (timeoutMs = 90000) => {
    console.log(LOG, 'waitForConnection: polling until isConnected…');
    const start = Date.now();
    while (!modalSnapshotRef.current.isConnected) {
      if (Date.now() - start > timeoutMs) {
        console.warn(LOG, 'waitForConnection: TIMEOUT');
        throw new Error('Wallet connection timed out. Try again.');
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    console.log(LOG, 'waitForConnection: isConnected = true');
  }, []);

  /** Provider can update one frame after isConnected; poll briefly. */
  const waitForProvider = useCallback(async (timeoutMs = 15000) => {
    console.log(LOG, 'waitForProvider: polling until provider.request…');
    const start = Date.now();
    while (!modalSnapshotRef.current.provider?.request) {
      if (Date.now() - start > timeoutMs) {
        console.warn(LOG, 'waitForProvider: TIMEOUT');
        throw new Error('Wallet provider not ready. Try again.');
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    console.log(LOG, 'waitForProvider: provider ready');
    return modalSnapshotRef.current.provider;
  }, []);

  const ensureSepolia = useCallback(async (wcProvider) => {
    if (!wcProvider?.request) {
      throw new Error('Wallet provider is not ready');
    }
    try {
      await wcProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch {
      await wcProvider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: SEPOLIA_CHAIN_ID,
            chainName: 'Sepolia',
            rpcUrls: ['https://rpc.sepolia.org'],
            nativeCurrency: {
              name: 'Sepolia ETH',
              symbol: 'ETH',
              decimals: 18,
            },
            blockExplorerUrls: ['https://sepolia.etherscan.io'],
          },
        ],
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const chainId = await wcProvider.request({ method: 'eth_chainId' });
    if (normalizeChainIdHex(chainId) !== normalizeChainIdHex(SEPOLIA_CHAIN_ID)) {
      throw new Error(
        'Please switch to Sepolia in your wallet and try again.',
      );
    }
  }, []);

  const persistConnectedWallet = useCallback(async (walletAddress) => {
    if (!walletAddress) return;
    try {
      await AsyncStorage.setItem('walletAddress', walletAddress);
      await AsyncStorage.setItem('walletChainId', '11155111');
      await AsyncStorage.setItem('walletType', 'walletconnect');
    } catch (e) {
      console.warn('WalletConnectSupport: AsyncStorage persist failed', e);
    }
  }, []);

  const startSupportPayment = useCallback(
    async (recipientAddress, options = {}) => {
      const amountEth =
        options.amountEth != null ? options.amountEth : DEFAULT_SUPPORT_AMOUNT_ETH;

      console.log(LOG, 'startSupportPayment called', {
        recipientPreview: recipientAddress
          ? `${String(recipientAddress).slice(0, 10)}…`
          : null,
        amountEth,
      });

      if (!recipientAddress) {
        console.warn(LOG, 'startSupportPayment: abort — no recipientAddress');
        showToastMessage(toast, 'danger', 'Creator wallet address is not available.');
        return;
      }

      setRpcResponse(null);
      setLoading(true);

      try {
        const snap = modalSnapshotRef.current;
        console.log(LOG, 'snapshot before connect', {
          isConnected: snap.isConnected,
          hasProvider: !!snap.provider?.request,
          address: snap.address ?? null,
        });

        const needsWalletPicker =
          !snap.isConnected || !snap.provider?.request;

        // Do not show RequestModal until after the wallet picker on iOS: two modals at once
        // prevents the Reown / WalletConnect “select wallet” UI from appearing.
        if (!needsWalletPicker) {
          setRequestModalVisible(true);
        }

        if (needsWalletPicker) {
          console.log(LOG, 'calling openWalletConnectModal() — user should see WC modal');
          await openWalletConnectModal();
          await waitForConnection();
          setRequestModalVisible(true);
        } else {
          console.log(LOG, 'already connected, skipping open()');
        }

        const wcProvider = await waitForProvider();
        if (!wcProvider?.request) {
          throw new Error('Wallet is not connected.');
        }

        console.log(LOG, 'ensureSepolia…');
        await ensureSepolia(wcProvider);

        const chainId = await wcProvider.request({ method: 'eth_chainId' });
        if (normalizeChainIdHex(chainId) !== normalizeChainIdHex(SEPOLIA_CHAIN_ID)) {
          throw new Error('Please switch to Sepolia network');
        }

        let userAddress = modalSnapshotRef.current.address;
        if (!userAddress) {
          const accounts = await wcProvider.request({ method: 'eth_accounts' });
          userAddress = accounts?.[0];
        }
        if (!userAddress) {
          throw new Error('No wallet account available');
        }

        console.log(LOG, 'sender', userAddress);

        await persistConnectedWallet(userAddress);

        const transaction = {
          from: userAddress,
          to: recipientAddress,
          value: ethValueHexFromEth(amountEth),
          chainId: SEPOLIA_CHAIN_ID,
          data: '0x',
        };

        console.log(LOG, 'eth_sendTransaction…');
        const txHash = await wcProvider.request({
          method: 'eth_sendTransaction',
          params: [transaction],
        });

        console.log(LOG, 'tx submitted', txHash);
        setRpcResponse({
          method: 'eth_sendTransaction (Sepolia)',
          result: txHash,
        });
        showToastMessage(toast, 'success', 'Support transaction submitted');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error ?? 'Unknown error');
        console.warn(LOG, 'startSupportPayment error', message, error);
        setRpcResponse({ error: message });
        showToastMessage(toast, 'danger', message);
      } finally {
        setLoading(false);
        console.log(LOG, 'startSupportPayment finished (loading cleared)');
      }
    },
    [
      openWalletConnectModal,
      waitForConnection,
      waitForProvider,
      ensureSepolia,
      persistConnectedWallet,
      toast,
    ],
  );

  const closeRequestModal = useCallback(() => {
    setRequestModalVisible(false);
    setLoading(false);
    setRpcResponse(null);
  }, []);

  const value = useMemo(
    () => ({
      isConnected,
      address,
      provider,
      open: openWalletConnectModal,
      closeWalletModal,
      isWalletModalOpen,
      openWalletConnect: openWalletConnectModal,
      startSupportPayment,
    }),
    [
      isConnected,
      address,
      provider,
      openWalletConnectModal,
      closeWalletModal,
      isWalletModalOpen,
      startSupportPayment,
    ],
  );

  return (
    <WalletConnectSupportContext.Provider value={value}>
      {children}
      <RequestModal
        isVisible={requestModalVisible}
        onClose={closeRequestModal}
        isLoading={loading}
        rpcResponse={rpcResponse ?? undefined}
      />
    </WalletConnectSupportContext.Provider>
  );
}

/**
 * Renders Reown WalletConnect modal + support payment helpers (Sepolia).
 * Place inside ToastProvider so toasts work.
 */
export function WalletConnectSupportProvider({ children }) {
  const onCopyClipboard = useCallback((value) => {
    if (value != null) {
      Clipboard.setString(String(value));
    }
  }, []);

  return (
    <>
      <WalletConnectModal
        projectId={ConfigUtils.ENV_PROJECT_ID}
        providerMetadata={ConfigUtils.providerMetadata}
        sessionParams={ConfigUtils.sessionParams}
        onCopyClipboard={onCopyClipboard}
      />
      <WalletConnectSupportInner>{children}</WalletConnectSupportInner>
    </>
  );
}

export function useWalletConnectSupport() {
  const ctx = useContext(WalletConnectSupportContext);
  if (!ctx) {
    throw new Error(
      'useWalletConnectSupport must be used within WalletConnectSupportProvider',
    );
  }
  return ctx;
}
