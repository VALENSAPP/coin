import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Modal from 'react-native-modal';
import { useLanguage } from '../../i18n';

function truncateAddress(addr) {
  if (!addr || typeof addr !== 'string') return '';
  const a = addr.trim();
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/**
 * Shown after a successful wallet connection when the user is about to send a support payment.
 * Renders above other content; closes AppKit first from the caller so this is visible.
 */
export function WalletConnectedSuccessModal({
  isVisible,
  onClose,
  onContinueToPay,
  onModalHide,
  address,
}) {
  const hasAddress = !!address && typeof address === 'string';
  const { t } = useLanguage();

  return (
    <Modal
      isVisible={isVisible}
      useNativeDriver
      useNativeDriverForBackdrop
      statusBarTranslucent
      coverScreen
      backdropOpacity={0.55}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      onModalHide={onModalHide}
      onModalShow={() => {
        console.log('[WalletConnectedSuccessModal] visible', {
          hasAddress,
          preview: hasAddress ? truncateAddress(address) : null,
        });
      }}
      style={styles.modalRoot}
    >
      <View style={styles.innerContainer}>
        <Text style={styles.title}>{t('walletConnectedSuccess.title')}</Text>
        <Text style={styles.subtitle}>{t('walletConnectedSuccess.subtitle')}</Text>

        {hasAddress ? (
          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>{t('walletConnectedSuccess.addressLabel')}</Text>
            <ScrollView style={styles.addressScroll} nestedScrollEnabled>
              <Text style={styles.addressFull} selectable>
                {address.trim()}
              </Text>
            </ScrollView>
            <Text style={styles.addressHint}>{truncateAddress(address)}</Text>
          </View>
        ) : (
          <Text style={styles.missingAddress}>
            {t('walletConnectedSuccess.waitingForAddress')}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.primaryButton, !hasAddress && styles.primaryButtonDisabled]}
          onPress={() => {
            if (!hasAddress) return;
            console.log('[WalletConnectedSuccessModal] Continue to pay pressed');
            onContinueToPay();
          }}
          disabled={!hasAddress}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>{t('walletConnectedSuccess.continueButton')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
          <Text style={styles.secondaryButtonText}>{t('walletConnectedSuccess.notNowButton')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    justifyContent: 'center',
    margin: 16,
    zIndex: 9999,
  },
  innerContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: '85%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  title: {
    fontWeight: '700',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
    color: '#111',
  },
  subtitle: {
    textAlign: 'center',
    color: '#555',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },
  addressBlock: {
    marginBottom: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#f9f9f9',
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressScroll: {
    maxHeight: 72,
  },
  addressFull: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#111',
    lineHeight: 20,
  },
  addressHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  missingAddress: {
    textAlign: 'center',
    color: '#a70',
    marginBottom: 16,
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: '#3396FF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#666',
    fontSize: 15,
  },
});

export default WalletConnectedSuccessModal;
