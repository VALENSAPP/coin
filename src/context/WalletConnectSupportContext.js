import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppKit,
  useAppKit,
  useAccount,
  useProvider,
  useAppKitState,
} from '@reown/appkit-react-native';
import { AppState, InteractionManager, Platform, DeviceEventEmitter } from 'react-native';
import { RequestModal } from '../components/modals/RequestModal';
import { WalletConnectedSuccessModal } from '../components/modals/WalletConnectedSuccessModal';
import { showToastMessage } from '../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import { appKit } from '../config/AppKitConfig';

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

function getProviderFromAppKit() {
  try {
    return appKit.getProvider('eip155') ?? appKit.getProvider();
  } catch {
    return null;
  }
}

/** Default Sepolia tip amount (ETH). */
export const DEFAULT_SUPPORT_AMOUNT_ETH = 0.000001;

/** Shown in the result modal unless `options.chain` is passed (e.g. `'POLYGON'`). */
export const DEFAULT_SUPPORT_CHAIN_LABEL = 'SEPOLIA';

/**
 * Shape shown in RequestModal after a successful tip tx.
 * Pass `senderId`, `receiverId`, `chain` via `startSupportPayment(addr, { ... })`.
 */
export function buildSupportPaymentResultModalPayload(txHash, options = {}) {
  const senderId =
    options.senderId != null ? String(options.senderId).trim() : '';
  const receiverId =
    options.receiverId != null ? String(options.receiverId).trim() : '';
  const chainRaw =
    options.chain != null && String(options.chain).trim() !== ''
      ? String(options.chain).trim()
      : DEFAULT_SUPPORT_CHAIN_LABEL;
  return {
    senderId,
    receiverId,
    txHash: txHash != null ? String(txHash) : '',
    chain: chainRaw.toUpperCase(),
  };
}

const LOG = '[WC-Support]';

function WalletConnectSupportInner({ children }) {
  const toast = useToast();
  const { open, close: closeWalletModal } = useAppKit();
  const { isConnected, address } = useAccount();
  const { provider } = useProvider();
  const { isOpen: isWalletModalOpen } = useAppKitState();

  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rpcResponse, setRpcResponse] = useState(null);

  const [showWalletConnectedModal, setShowWalletConnectedModal] = useState(false);
  const [connectedSuccessAddress, setConnectedSuccessAddress] = useState(undefined);
  const pendingPaymentRef = useRef(null);
  /** Set when opening AppKit for a support payment; cleared when success UI shows or flow errors/cancels. */
  const supportConnectIntentRef = useRef(null);
  const connectRevealInProgressRef = useRef(false);
  const continueToPayAfterHideRef = useRef(false);
  const showWalletConnectedModalRef = useRef(false);
  const requestModalVisibleRef = useRef(false);

  const modalSnapshotRef = useRef({
    isConnected,
    provider,
    address,
  });
  modalSnapshotRef.current = { isConnected, provider, address };

  useEffect(() => {
    showWalletConnectedModalRef.current = showWalletConnectedModal;
  }, [showWalletConnectedModal]);

  useEffect(() => {
    requestModalVisibleRef.current = requestModalVisible;
  }, [requestModalVisible]);

  // 🦊 Listen for MetaMask return from deep link handler in index.js
useEffect(() => {
  const subscription = DeviceEventEmitter.addListener('METAMASK_RETURN', async () => {
    console.log(LOG, '🦊 METAMASK_RETURN received — attempting to resume session');

    const intent = supportConnectIntentRef.current;
    if (!intent?.recipientAddress) {
      console.warn(LOG, 'METAMASK_RETURN: no pending intent, skipping');
      return;
    }

    if (
      showWalletConnectedModalRef.current ||
      requestModalVisibleRef.current ||
      connectRevealInProgressRef.current
    ) {
      console.log(LOG, 'METAMASK_RETURN: modal already showing, skipping');
      return;
    }

    const wc = getProviderFromAppKit();
    if (!wc?.request) {
      console.warn(LOG, 'METAMASK_RETURN: no provider yet — AppState will retry');
      return;
    }

    let addr;
    try {
      let accounts = await wc.request({ method: 'eth_accounts' });
      addr = accounts?.[0];
      if (!addr) {
        accounts = await wc.request({ method: 'eth_requestAccounts' });
        addr = accounts?.[0];
      }
    } catch (e) {
      console.warn(LOG, 'METAMASK_RETURN: account read failed — AppState will retry', e);
      return;
    }

    if (!addr) {
      console.warn(LOG, 'METAMASK_RETURN: no address yet — AppState will retry');
      return;
    }

    try {
      await persistConnectedWallet(addr);
      await revealConnectedSuccessUi(addr, intent.recipientAddress, intent.options);
    } catch (e) {
      console.warn(LOG, 'METAMASK_RETURN: reveal failed', e);
    }
  });

  return () => subscription.remove();
}, [persistConnectedWallet, revealConnectedSuccessUi]);

  const openWalletConnectModal = useCallback(async () => {
    console.log(LOG, 'open() invoked → AppKit modal should open');
    if (Platform.OS === 'ios') {
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
    try {
      await AsyncStorage.setItem('pending_metamask_connect', 'true');
      open();
    } catch (e) {
      console.warn(LOG, 'open() error', e);
    }
  }, [open]);

  /**
   * Do not rely only on useAccount/useProvider during async loops — they can lag
   * one or more frames behind AppKit. Poll `appKit.getProvider` + `eth_accounts`
   * like the native stack does internally.
   */
  const waitForSessionAddressAndProvider = useCallback(async (timeoutMs = 90000) => {
    console.log(LOG, 'waitForSessionAddressAndProvider: polling AppKit provider + eth_accounts…');
    const start = Date.now();
    let lastLog = 0;

    while (Date.now() - start < timeoutMs) {
      const wc = getProviderFromAppKit();
      if (wc?.request) {
        try {
          let accounts = await wc.request({ method: 'eth_accounts' });
          let addr = accounts?.[0];
          if (!addr) {
            accounts = await wc.request({ method: 'eth_requestAccounts' });
            addr = accounts?.[0];
          }
          if (addr) {
            console.log(LOG, 'waitForSessionAddressAndProvider: success', {
              address: addr,
              preview: `${String(addr).slice(0, 8)}…${String(addr).slice(-4)}`,
              elapsedMs: Date.now() - start,
            });
            return { provider: wc, address: addr };
          }
        } catch (e) {
          console.warn(LOG, 'eth_accounts during session wait', e);
        }
      }

      const snap = modalSnapshotRef.current;
      if (snap?.address && wc?.request) {
        console.log(LOG, 'waitForSessionAddressAndProvider: success via hook address', {
          address: snap.address,
          elapsedMs: Date.now() - start,
        });
        return { provider: wc, address: snap.address };
      }

      const now = Date.now();
      if (now - lastLog > 3000) {
        lastLog = now;
        console.log(LOG, 'waitForSessionAddressAndProvider: still waiting…', {
          hasProvider: !!wc?.request,
          hookConnected: !!snap?.address,
          appKitHookIsConnected: snap?.isConnected,
        });
      }

      await new Promise((r) => setTimeout(r, 300));
    }

    console.warn(LOG, 'waitForSessionAddressAndProvider: TIMEOUT');
    throw new Error('Wallet connection timed out. Try again.');
  }, []);

  const waitForProvider = useCallback(async (timeoutMs = 15000) => {
    console.log(LOG, 'waitForProvider: polling…');
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const fromKit = getProviderFromAppKit();
      if (fromKit?.request) {
        console.log(LOG, 'waitForProvider: ready via AppKit', {
          elapsedMs: Date.now() - start,
        });
        return fromKit;
      }
      const hookProv = modalSnapshotRef.current.provider;
      if (hookProv?.request) {
        console.log(LOG, 'waitForProvider: ready via hook', {
          elapsedMs: Date.now() - start,
        });
        return hookProv;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    console.warn(LOG, 'waitForProvider: TIMEOUT');
    throw new Error('Wallet provider not ready. Try again.');
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
      console.log(LOG, 'persisted wallet', {
        preview: `${String(walletAddress).slice(0, 8)}…`,
      });
    } catch (e) {
      console.warn('WalletConnectSupport: AsyncStorage persist failed', e);
    }
  }, []);

  const runPaymentSteps = useCallback(
    async (recipientAddress, options = {}) => {
      const amountEth =
        options.amountEth != null ? options.amountEth : DEFAULT_SUPPORT_AMOUNT_ETH;

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
      console.log('tx submitted options', options);
      setRpcResponse(buildSupportPaymentResultModalPayload(txHash, options));
      showToastMessage(toast, 'success', 'Support transaction submitted');
    },
    [waitForProvider, ensureSepolia, persistConnectedWallet, toast],
  );

  const revealConnectedSuccessUi = useCallback(
    async (userAddress, recipientAddress, options) => {
      if (connectRevealInProgressRef.current) {
        console.log(LOG, 'revealConnectedSuccessUi: skip (already in progress)');
        return;
      }
      supportConnectIntentRef.current = null;
      connectRevealInProgressRef.current = true;

      try {
        pendingPaymentRef.current = { recipientAddress, options };
        setConnectedSuccessAddress(userAddress);

        try {
          console.log(LOG, 'closing AppKit modal so success UI can show…');
          await closeWalletModal();
        } catch (e) {
          console.warn(LOG, 'closeWalletModal after connect (non-fatal)', e);
        }

        await new Promise((resolve) => {
          InteractionManager.runAfterInteractions(() => resolve());
        });
        const delayMs = Platform.OS === 'ios' ? 500 : 450;
        await new Promise((r) => setTimeout(r, delayMs));

        console.log(LOG, 'setting WalletConnectedSuccessModal visible=true', {
          address: userAddress,
        });
        setShowWalletConnectedModal(true);
        showToastMessage(
          toast,
          'success',
          'Wallet connected — tap Continue to pay to confirm your tip.',
        );
      } finally {
        connectRevealInProgressRef.current = false;
      }
    },
    [closeWalletModal, toast],
  );

  /**
   * After MetaMask / external wallet returns, hooks can lag. Retry so
   * "Wallet connected" + Continue to pay still appears.
   */
  useEffect(() => {
    let timeoutId;

    const tryResumeConnect = async () => {
      const intent = supportConnectIntentRef.current;
      if (!intent?.recipientAddress) return;
      if (
        showWalletConnectedModalRef.current ||
        requestModalVisibleRef.current ||
        connectRevealInProgressRef.current
      ) {
        return;
      }

      const wc = getProviderFromAppKit();
      if (!wc?.request) return;

      let addr;
      try {
        let accounts = await wc.request({ method: 'eth_accounts' });
        addr = accounts?.[0];
        if (!addr) {
          accounts = await wc.request({ method: 'eth_requestAccounts' });
          addr = accounts?.[0];
        }
      } catch (e) {
        console.warn(LOG, 'AppState resume: account read failed', e);
        return;
      }

      if (
        !addr ||
        !supportConnectIntentRef.current ||
        showWalletConnectedModalRef.current ||
        requestModalVisibleRef.current
      ) {
        return;
      }

      const { recipientAddress, options } = supportConnectIntentRef.current;
      console.log(LOG, 'AppState active: recovering post-wallet session', {
        preview: `${String(addr).slice(0, 8)}…`,
      });

      try {
        await persistConnectedWallet(addr);
        await revealConnectedSuccessUi(addr, recipientAddress, options);
      } catch (e) {
        console.warn(LOG, 'AppState resume: reveal failed', e);
      }
    };

    const onAppStateChange = (next) => {
      if (next !== 'active') return;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        tryResumeConnect().catch((error) => {
          console.warn(LOG, 'AppState active: resume task crashed', error);
        });
      }, 450);
    };

    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => {
      sub.remove();
      clearTimeout(timeoutId);
    };
  }, [persistConnectedWallet, revealConnectedSuccessUi]);

  const startSupportPayment = useCallback(
    async (recipientAddress, options = {}) => {
      console.log(LOG, 'startSupportPayment called', {
        recipientPreview: recipientAddress
          ? `${String(recipientAddress).slice(0, 10)}…`
          : null,
      });

      if (!recipientAddress) {
        console.warn(LOG, 'startSupportPayment: abort — no recipientAddress');
        showToastMessage(toast, 'danger', 'Creator wallet address is not available.');
        return;
      }

      const snap = modalSnapshotRef.current;
      const needsWalletPicker =
        !snap.isConnected || !snap.provider?.request;

      if (!needsWalletPicker) {
        setRpcResponse(null);
        setRequestModalVisible(true);
        setLoading(true);
        try {
          await runPaymentSteps(recipientAddress, options);
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
        return;
      }

      try {
        setRpcResponse(null);
        supportConnectIntentRef.current = { recipientAddress, options };
        console.log(LOG, 'connect path: opening AppKit…');
        await openWalletConnectModal();

        const { address: userAddress } = await waitForSessionAddressAndProvider(15000);

        if (!userAddress) {
          throw new Error('No wallet account available');
        }

        await persistConnectedWallet(userAddress);
        await revealConnectedSuccessUi(userAddress, recipientAddress, options);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error ?? 'Unknown error');
        
        // ✅ Only clear intent if it's NOT a timeout — timeout means user went to MetaMask
        // and AppState/METAMASK_RETURN will recover it
        if (!message.includes('timed out')) {
          supportConnectIntentRef.current = null;
        }
        
        console.warn(LOG, 'startSupportPayment (connect) error', message, error);
        
        // ✅ Don't show error toast for timeout — MetaMask return will handle it
        if (!message.includes('timed out')) {
          showToastMessage(toast, 'danger', message);
        }
      }
    },
    [
      openWalletConnectModal,
      waitForSessionAddressAndProvider,
      persistConnectedWallet,
      revealConnectedSuccessUi,
      runPaymentSteps,
      toast,
    ],
  );

  const openPendingPaymentRequest = useCallback(async () => {
    const pending = pendingPaymentRef.current;
    if (!pending?.recipientAddress) {
      console.warn(LOG, 'openPendingPaymentRequest: no pending payment');
      pendingPaymentRef.current = null;
      return;
    }

    await new Promise((resolve) => {
      InteractionManager.runAfterInteractions(() => resolve());
    });

    console.log(LOG, 'openPendingPaymentRequest: opening payment modal');
    setRequestModalVisible(true);
    setLoading(true);
    setRpcResponse(null);

    try {
      await runPaymentSteps(pending.recipientAddress, pending.options);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? 'Unknown error');
      console.warn(LOG, 'continueToPayAfterConnect error', message, error);
      setRpcResponse({ error: message });
      showToastMessage(toast, 'danger', message);
    } finally {
      setLoading(false);
      pendingPaymentRef.current = null;
      console.log(LOG, 'openPendingPaymentRequest finished');
    }
  }, [runPaymentSteps, toast]);

  const continueToPayAfterConnect = useCallback(() => {
    if (!pendingPaymentRef.current?.recipientAddress) {
      console.warn(LOG, 'continueToPayAfterConnect: no pending payment');
      setShowWalletConnectedModal(false);
      pendingPaymentRef.current = null;
      return;
    }

    console.log(LOG, 'continueToPayAfterConnect: waiting for success modal to hide');
    continueToPayAfterHideRef.current = true;
    setShowWalletConnectedModal(false);
  }, []);

  const handleWalletConnectedModalHide = useCallback(() => {
    if (!continueToPayAfterHideRef.current) {
      return;
    }

    continueToPayAfterHideRef.current = false;
    openPendingPaymentRequest().catch((error) => {
      console.warn(LOG, 'handleWalletConnectedModalHide: failed to open payment modal', error);
    });
  }, [openPendingPaymentRequest]);

  const dismissWalletConnectedSuccess = useCallback(() => {
    console.log(LOG, 'WalletConnectedSuccessModal dismissed');
    continueToPayAfterHideRef.current = false;
    setShowWalletConnectedModal(false);
    pendingPaymentRef.current = null;
    supportConnectIntentRef.current = null;
  }, []);

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
      <WalletConnectedSuccessModal
        isVisible={showWalletConnectedModal}
        onClose={dismissWalletConnectedSuccess}
        onContinueToPay={continueToPayAfterConnect}
        onModalHide={handleWalletConnectedModalHide}
        address={connectedSuccessAddress}
      />
      <RequestModal
        isVisible={requestModalVisible}
        onClose={closeRequestModal}
        isLoading={loading}
        rpcResponse={rpcResponse ?? undefined}
      />
      <AppKit />
    </WalletConnectSupportContext.Provider>
  );
}

export function WalletConnectSupportProvider({ children }) {
  return <WalletConnectSupportInner>{children}</WalletConnectSupportInner>;
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
