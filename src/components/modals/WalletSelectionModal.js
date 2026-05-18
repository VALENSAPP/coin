import { Modal, View, Text, TouchableOpacity, StyleSheet, Image, Platform, Linking, Alert } from 'react-native';
import React from 'react';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';

const WALLETS = [
  {
    id: 'metamask',
    name: 'MetaMask',
    icon: require('../../assets/icons/pngicons/Emeta.png'),
    deepLinkScheme: 'metamask://',
    storeUrl: {
      ios: 'https://apps.apple.com/app/metamask/id1438144202',
      android: 'https://play.google.com/store/apps/details?id=io.metamask',
    },
  },
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    icon: require('../../assets/icons/pngicons/coin.png'),
    deepLinkScheme: 'cbwallet://',
    storeUrl: {
      ios: 'https://apps.apple.com/app/coinbase-wallet/id1278383455',
      android: 'https://play.google.com/store/apps/details?id=org.toshi',
    },
  },
  {
    id: 'walletconnect',
    name: 'Other Wallet (WalletConnect)',
    icon: require('../../assets/icons/pngicons/EWallet.png'),
    deepLinkScheme: 'wc://',
    storeUrl: null,
  },
];

export default function WalletSelectionModal({ visible, onClose, onSelectWallet }) {
  const { bgStyle, textStyle, text } = useAppTheme();
  const { t } = useLanguage();

  const handleWalletSelect = async (wallet) => {
    try {
      if (wallet.id === 'walletconnect') {
        onSelectWallet(wallet);
        return;
      }

      const canOpen = await Linking.canOpenURL(wallet.deepLinkScheme);

      if (canOpen) {
        Alert.alert(
          t('walletSelection.openWalletTitle', { walletName: wallet.name }),
          '',
          [
            { text: t('walletSelection.cancelButton'), style: 'cancel' },
            {
              text: t('walletSelection.openButton'),
              onPress: () => onSelectWallet(wallet),
            },
          ],
          { cancelable: true }
        );
      } else {
        Alert.alert(
          t('walletSelection.notInstalledTitle', { walletName: wallet.name }),
          t('walletSelection.notInstalledMessage', { walletName: wallet.name }),
          [
            { text: t('walletSelection.cancelButton'), style: 'cancel' },
            {
              text: t('walletSelection.installButton'),
              onPress: () => {
                const storeUrl =
                  Platform.OS === 'ios' ? wallet.storeUrl?.ios : wallet.storeUrl?.android;
                if (storeUrl) Linking.openURL(storeUrl);
              },
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert(
        t('walletSelection.openWalletTitle', { walletName: wallet.name }),
        '',
        [
          { text: t('walletSelection.cancelButton'), style: 'cancel' },
          {
            text: t('walletSelection.openButton'),
            onPress: () => onSelectWallet(wallet),
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
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContent, bgStyle]}>
          <Text style={[styles.title, textStyle]}>{t('walletSelection.title')}</Text>
          <Text style={styles.description}>{t('walletSelection.description')}</Text>

          <View style={styles.walletList}>
            {WALLETS.map((wallet) => (
              <TouchableOpacity
                key={wallet.id}
                style={[styles.walletItem, { borderColor: text }]}
                onPress={() => handleWalletSelect(wallet)}
              >
                <View style={styles.walletIconContainer}>
                  <Image source={wallet.icon} style={styles.walletIcon} resizeMode="contain" />
                </View>
                <Text style={[styles.walletName, textStyle]}>{wallet.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: text }]}
            onPress={onClose}
          >
            <Text style={[styles.cancelButtonText, textStyle]}>
              {t('walletSelection.cancelButton')}
            </Text>
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

