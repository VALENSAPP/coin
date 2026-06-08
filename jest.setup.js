jest.mock('react-native-capture-protection', () => ({
  ...require('react-native-capture-protection/jest/capture-protection-mock'),
  CaptureEventType: require('react-native-capture-protection/lib/commonjs/type')
    .CaptureEventType,
}));

jest.mock('react-native-modal', () => {
  const React = require('react');
  const { View } = require('react-native');
  function MockModal({ children, isVisible }) {
    if (!isVisible) {
      return null;
    }
    return React.createElement(View, null, children);
  }
  return { __esModule: true, default: MockModal };
});

jest.mock('./src/context/WalletConnectSupportContext', () => ({
  WalletConnectSupportProvider: ({ children }) => children,
  useWalletConnectSupport: () => ({
    startSupportPayment: jest.fn().mockResolvedValue(undefined),
    openWalletConnect: jest.fn(),
    isConnected: false,
    address: undefined,
    provider: undefined,
  }),
  DEFAULT_SUPPORT_AMOUNT_ETH: 0.000001,
}));
