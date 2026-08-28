import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';

const WalletConnectedModal = ({
  visible,
  onClose,
  walletName,
  walletAddress,
  onContinue,
}) => {
  const { text, card, bg, bgStyle, textStyle } = useAppTheme();
  const { t } = useLanguage();

  const truncatedAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : '';

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: card }]}>
          {/* Success Icon */}
          <View style={[styles.iconContainer, { backgroundColor: bg }]}>
            <Icon name="checkmark-circle" size={64} color="#10B981" />
          </View>

          {/* Title */}
          <Text style={[styles.title, textStyle]}>
            {t('walletConnected.title')}
          </Text>

          {/* Wallet Info */}
          <View style={[styles.walletInfo, { backgroundColor: bg }]}>
            <View style={styles.walletInfoRow}>
              <Text style={[styles.label, textStyle]}>{t('walletConnected.walletLabel')}</Text>
              <Text style={[styles.value, textStyle]}>{walletName || t('walletConnected.walletFallback')}</Text>
            </View>
            <View style={styles.walletInfoRow}>
              <Text style={[styles.label, textStyle]}>{t('walletConnected.addressLabel')}</Text>
              <Text style={[styles.value, textStyle]} numberOfLines={1}>
                {truncatedAddress || walletAddress}
              </Text>
            </View>
          </View>

          {/* Description */}
          <Text style={styles.description}>{t('walletConnected.description')}</Text>

          {/* Features List */}
          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Icon name="heart" size={20} color={text} />
              <Text style={[styles.featureText, textStyle]}>
                {t('walletConnected.feature1')}
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Icon name="wallet" size={20} color={text} />
              <Text style={[styles.featureText, textStyle]}>
                {t('walletConnected.feature2')}
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Icon name="people" size={20} color={text} />
              <Text style={[styles.featureText, textStyle]}>
                {t('walletConnected.feature3')}
              </Text>
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            {onContinue && (
              <TouchableOpacity
                style={[styles.continueButton, { backgroundColor: text }]}
                onPress={onContinue}
                activeOpacity={0.8}
              >
                <Text style={styles.continueButtonText}>
                  {t('walletConnected.continueButton')}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.closeButton, { borderColor: text }]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={[styles.closeButtonText, textStyle]}>
                {onContinue ? t('walletConnected.closeButton') : t('walletConnected.gotItButton')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  walletInfo: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  walletInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.7,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    marginLeft: 10,
  },
  description: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  featuresList: {
    width: '100%',
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingLeft: 4,
  },
  featureText: {
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  continueButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default WalletConnectedModal;

