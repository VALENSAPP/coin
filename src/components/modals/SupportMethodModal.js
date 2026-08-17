import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSelector } from 'react-redux';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n';

const WALLET_ICONS = {
  user: require('../../assets/icons/pngicons/newWallet.png'),
  company: require('../../assets/icons/pngicons/goldenWallet-removebg.png'),
};

const withAlpha = (hex, alpha = 0.12) => {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
    return `rgba(90, 45, 130, ${alpha})`;
  }
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;
  const int = parseInt(full, 16);
  if (Number.isNaN(int)) return `rgba(90, 45, 130, ${alpha})`;
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const SupportMethodModal = ({
  visible,
  onClose,
  creatorName = 'Creator',
  onWalletSupport,
  onTipSupport,
  canSupport = true,
}) => {
  const { t } = useLanguage();
  const { isDarkMode } = useThemeContext();
  const { text, card, cardStyle, accent, mutedText, border } = useAppTheme();
  const userProfile = useSelector((state) => state.userProfile.userProfile);
  const walletIcon = useMemo(
    () => WALLET_ICONS[userProfile === 'company' ? 'company' : 'user'],
    [userProfile],
  );
  const [selectedMethod, setSelectedMethod] = useState('wallet');

  const isWalletSelected = selectedMethod === 'wallet';
  const isTipSelected = selectedMethod === 'tip';
  // Keep Connect Wallet tappable even when recipient has no wallet, so parents can show
  // the same "{{name}} has not connected a wallet" alert as the profile screen.
  const isConnectWalletEnabled = isWalletSelected;
  const isSendTipEnabled = isTipSelected;

  // Force readable contrast: brand purple/gold is for accents, not body copy in dark mode.
  const primaryText = isDarkMode ? '#F5F0FF' : (text || '#111827');
  const secondaryText = isDarkMode ? '#C8C4D0' : (mutedText || '#6B7280');
  const actionAccent = accent || '#5a2d82';
  const idleBorder = border || (isDarkMode ? '#444444' : '#E5E7EB');
  const disabledButtonBg = isDarkMode ? '#4B5563' : '#9CA3AF';
  const chevronColor = secondaryText;
  const sheetBg = card || (isDarkMode ? '#1E1E1E' : '#FFFFFF');

  useEffect(() => {
    if (!visible) return;
    // Match profile flow: always open on Wallet-to-Wallet so the user can tap Connect Wallet
    // and see the not-connected message when the recipient has no wallet.
    setSelectedMethod('wallet');
  }, [visible]);

  const walletBullets = [
    t('supportCreator.walletBullet1'),
    t('supportCreator.walletBullet2'),
    t('supportCreator.walletBullet3'),
  ];

  const tipBullets = [
    t('supportCreator.tipBullet1'),
    t('supportCreator.tipBullet2'),
  ];

  const handleWalletCardPress = () => {
    setSelectedMethod('wallet');
  };

  const handleTipCardPress = () => {
    setSelectedMethod('tip');
  };

  const handleWalletPress = () => {
    if (!isConnectWalletEnabled) return;
    onWalletSupport?.();
  };

  const handleTipPress = () => {
    if (!isSendTipEnabled) return;
    if (onTipSupport) {
      onTipSupport();
      return;
    }
    onClose?.();
  };

  const walletCardStyle = useMemo(() => {
    if (isWalletSelected) {
      return {
        borderColor: actionAccent,
        backgroundColor: withAlpha(actionAccent, isDarkMode ? 0.22 : 0.06),
      };
    }
    return {
      borderColor: idleBorder,
      backgroundColor: sheetBg,
    };
  }, [isWalletSelected, actionAccent, sheetBg, idleBorder, isDarkMode]);

  const tipCardStyle = useMemo(() => {
    if (isTipSelected) {
      return {
        borderColor: actionAccent,
        backgroundColor: withAlpha(actionAccent, isDarkMode ? 0.22 : 0.06),
      };
    }
    return {
      borderColor: idleBorder,
      backgroundColor: sheetBg,
    };
  }, [isTipSelected, actionAccent, sheetBg, idleBorder, isDarkMode]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, cardStyle, { backgroundColor: sheetBg }]}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={primaryText} />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.title, { color: primaryText }]}>
              {t('supportCreator.methodTitle', { creatorName })}
            </Text>

            <View style={[styles.heartIconWrap, { borderColor: actionAccent }]}>
              <Ionicons name="heart" size={28} color={actionAccent} />
            </View>

            <Text style={[styles.subtitle, { color: secondaryText }]}>
              {t('supportCreator.methodSubtitle')}
            </Text>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.methodCard, walletCardStyle]}
              onPress={handleWalletCardPress}
            >
              <View style={[styles.methodIconWrap, { backgroundColor: withAlpha(actionAccent, 0.14) }]}>
                <Image
                  source={walletIcon}
                  style={styles.methodIconImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.methodCopy}>
                <Text style={[styles.methodTitle, { color: primaryText }]}>
                  {t('supportCreator.walletMethodTitle')}
                </Text>
                {walletBullets.map((line, index) => (
                  <Text key={`wallet-${index}`} style={[styles.methodBullet, { color: secondaryText }]}>
                    {'\u2022'} {line}
                  </Text>
                ))}
              </View>
              <Ionicons name="chevron-forward" size={20} color={chevronColor} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.methodCard, tipCardStyle]}
              onPress={handleTipCardPress}
            >
              <View style={[styles.methodIconWrap, { backgroundColor: withAlpha(actionAccent, 0.14) }]}>
                <Ionicons name="heart-outline" size={28} color={actionAccent} />
              </View>
              <View style={styles.methodCopy}>
                <Text style={[styles.methodTitle, { color: primaryText }]}>
                  {t('supportCreator.tipMethodTitle')}
                </Text>
                {tipBullets.map((line, index) => (
                  <Text key={`tip-${index}`} style={[styles.methodBullet, { color: secondaryText }]}>
                    {'\u2022'} {line}
                  </Text>
                ))}
              </View>
              <Ionicons name="chevron-forward" size={20} color={chevronColor} />
            </TouchableOpacity>

            <View style={[styles.importantBox, { backgroundColor: withAlpha(actionAccent, isDarkMode ? 0.2 : 0.1) }]}>
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={secondaryText}
                style={styles.importantIcon}
              />
              <Text style={[styles.importantText, { color: secondaryText }]}>
                <Text style={[styles.importantLabel, { color: primaryText }]}>
                  {t('supportCreator.importantLabel')}{' '}
                </Text>
                {t('supportCreator.importantBody')}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: isConnectWalletEnabled ? actionAccent : disabledButtonBg },
              ]}
              onPress={handleWalletPress}
              disabled={!isConnectWalletEnabled}
              activeOpacity={isConnectWalletEnabled ? 0.9 : 1}
            >
              <Ionicons name="wallet-outline" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>{t('supportCreator.connectWalletButton')}</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            {isWalletSelected && !canSupport && (
              <Text style={styles.walletErrorText}>
                {t('commonSupportModal.walletNotConnected')}{' '}
                <Text style={styles.walletErrorName}>{creatorName}</Text>
                {t('commonSupportModal.onceConnected')}
              </Text>
            )}

            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: isSendTipEnabled ? actionAccent : disabledButtonBg },
              ]}
              onPress={handleTipPress}
              disabled={!isSendTipEnabled}
              activeOpacity={isSendTipEnabled ? 0.9 : 1}
            >
              <Ionicons name="heart" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>{t('supportCreator.sendTipButton')}</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.maybeLaterButton} onPress={onClose}>
              <Text style={[styles.maybeLaterText, { color: secondaryText }]}>
                {t('supportCreator.maybeLater')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default SupportMethodModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 8, 20, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 4,
    marginBottom: 4,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },
  heartIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 18,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  methodIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  methodIconImage: {
    width: 46,
    height: 46,
  },
  methodCopy: {
    flex: 1,
    paddingRight: 8,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  methodBullet: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 2,
  },
  importantBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
    marginBottom: 18,
  },
  importantIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  importantText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  importantLabel: {
    fontWeight: '700',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  actionButtonText: {
    flex: 1,
    marginLeft: 10,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  walletErrorText: {
    fontSize: 13,
    color: '#DC2626',
    marginTop: -4,
    marginBottom: 12,
    lineHeight: 18,
  },
  walletErrorName: {
    fontWeight: '700',
  },
  maybeLaterButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  maybeLaterText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
