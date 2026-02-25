import { Modal, View, Text, TouchableOpacity, StyleSheet, Image, Platform } from "react-native";
import React from "react";
import { useAppTheme } from "../../theme/useApptheme";
import { Linking, Alert } from "react-native";

const WALLETS = [
  {
    id: 'metamask',
    name: 'MetaMask',
    icon: require('../../assets/icons/pngicons/metamask.png'),
    deepLinkScheme: 'metamask://',
    storeUrl: {
      ios: 'https://apps.apple.com/app/metamask/id1438144202',
      android: 'https://play.google.com/store/apps/details?id=io.metamask',
    },
  },
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    icon: require('../../assets/icons/pngicons/metamask.png'), // Placeholder - add Coinbase icon
    deepLinkScheme: 'cbwallet://',
    storeUrl: {
      ios: 'https://apps.apple.com/app/coinbase-wallet/id1278383455',
      android: 'https://play.google.com/store/apps/details?id=org.toshi',
    },
  },
  // {
  //   id: 'trust',
  //   name: 'Trust Wallet',
  //   icon: require('../../assets/icons/pngicons/metamask.png'), // Placeholder - add Trust Wallet icon
  //   deepLinkScheme: 'trust://',
  //   storeUrl: {
  //     ios: 'https://apps.apple.com/app/trust-crypto-bitcoin-wallet/id1288339409',
  //     android: 'https://play.google.com/store/apps/details?id=com.wallet.crypto.trustapp',
  //   },
  // },
  // {
  //   id: 'rainbow',
  //   name: 'Rainbow',
  //   icon: require('../../assets/icons/pngicons/metamask.png'), // Placeholder - add Rainbow icon
  //   deepLinkScheme: 'rainbow://',
  //   storeUrl: {
  //     ios: 'https://apps.apple.com/app/rainbow-ethereum-wallet/id1457119021',
  //     android: 'https://play.google.com/store/apps/details?id=me.rainbow',
  //   },
  // },
  // {
  //   id: 'zerion',
  //   name: 'Zerion',
  //   icon: require('../../assets/icons/pngicons/metamask.png'), // Placeholder - add Zerion icon
  //   deepLinkScheme: 'zerion://',
  //   storeUrl: {
  //     ios: 'https://apps.apple.com/app/zerion-defi-wallet/id1456732568',
  //     android: 'https://play.google.com/store/apps/details?id=io.zerion.android',
  //   },
  // },
  {
    id: 'walletconnect',
    name: 'Other Wallet (WalletConnect)',
    icon: require('../../assets/icons/pngicons/metamask.png'), // Placeholder - add WalletConnect icon
    deepLinkScheme: 'wc://',
    storeUrl: null, // WalletConnect opens a browser/modal - works with ALL WalletConnect-compatible wallets
  },
];

export default function WalletSelectionModal({ visible, onClose, onSelectWallet }) {
  const { bgStyle, textStyle, text } = useAppTheme();

  const handleWalletSelect = async (wallet) => {
    // Check if wallet app is installed by trying to open it
    try {
      // For WalletConnect, we'll use the walletConnectDeepLink from the connection
      if (wallet.id === 'walletconnect') {
        onSelectWallet(wallet);
        return;
      }

      // For other wallets, check if app is installed
      const canOpen = await Linking.canOpenURL(wallet.deepLinkScheme);
      
      if (canOpen) {
        // Show confirmation to open external wallet
        Alert.alert(
          `"Valens" wants to open "${wallet.name}"`,
          '',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open',
              onPress: () => {
                onSelectWallet(wallet);
              },
            },
          ],
          { cancelable: true }
        );
      } else {
        // Wallet not installed, offer to install
        Alert.alert(
          `${wallet.name} Not Installed`,
          `${wallet.name} is not installed. Would you like to install it?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Install',
              onPress: () => {
                const storeUrl = Platform.OS === 'ios' 
                  ? wallet.storeUrl.ios 
                  : wallet.storeUrl.android;
                if (storeUrl) {
                  Linking.openURL(storeUrl);
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      // If canOpenURL fails, still allow selection (might work anyway)
      // Show confirmation dialog anyway
      Alert.alert(
        `"Valens" wants to open "${wallet.name}"`,
        '',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open',
            onPress: () => {
              onSelectWallet(wallet);
            },
          },
        ],
        { cancelable: true }
      );
    }
  };

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContent, bgStyle]}>
          <Text style={[styles.title, textStyle]}>Connect Wallet</Text>
          <Text style={styles.description}>
            Choose a wallet to connect. All wallets use WalletConnect protocol for secure connection.
          </Text>

          <View style={styles.walletList}>
            {WALLETS.map((wallet) => (
              <TouchableOpacity
                key={wallet.id}
                style={[styles.walletItem, { borderColor: text }]}
                onPress={() => handleWalletSelect(wallet)}
              >
                <View style={styles.walletIconContainer}>
                  <Image 
                    source={wallet.icon} 
                    style={styles.walletIcon}
                    resizeMode="contain"
                  />
                </View>
                <Text style={[styles.walletName, textStyle]}>{wallet.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: text }]}
            onPress={onClose}
          >
            <Text style={[styles.cancelButtonText, textStyle]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
    textAlign: "center",
  },
  walletList: {
    marginBottom: 20,
  },
  walletItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  walletIconContainer: {
    width: 40,
    height: 40,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  walletIcon: {
    width: 40,
    height: 40,
  },
  walletName: {
    fontSize: 18,
    fontWeight: "600",
  },
  cancelButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

