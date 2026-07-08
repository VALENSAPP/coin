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
import { useLanguage } from '../../i18n';

const WALLET_ICONS = {
  user: require('../../assets/icons/pngicons/newWallet.png'),
  company: require('../../assets/icons/pngicons/goldenWallet-removebg.png'),
};

const withAlpha = (hex, alpha = 0.12) => {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;
  const int = parseInt(full, 16);
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
  const { text, card, cardStyle } = useAppTheme();
  const userProfile = useSelector((state) => state.userProfile.userProfile);
  const walletIcon = useMemo(
    () => WALLET_ICONS[userProfile === 'company' ? 'company' : 'user'],
    [userProfile],
  );
  const [selectedMethod, setSelectedMethod] = useState('wallet');

  const isWalletMethodDisabled = !canSupport;
  const isWalletSelected = selectedMethod === 'wallet';
  const isTipSelected = selectedMethod === 'tip';
  const isConnectWalletEnabled = isWalletSelected && canSupport;
  const isSendTipEnabled = isTipSelected;

  useEffect(() => {
    if (!visible) return;
    setSelectedMethod(canSupport ? 'wallet' : 'tip');
  }, [visible, canSupport]);

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
    if (isWalletMethodDisabled) return;
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
    if (isWalletMethodDisabled) {
      return {
        borderColor: '#E5E7EB',
        backgroundColor: '#F3F4F6',
        opacity: 0.65,
      };
    }
    if (isWalletSelected) {
      return {
        borderColor: text,
        backgroundColor: withAlpha(text, 0.06),
      };
    }
    return {
      borderColor: '#E5E7EB',
      backgroundColor: card,
    };
  }, [isWalletMethodDisabled, isWalletSelected, text, card]);

  const tipCardStyle = useMemo(() => {
    if (isTipSelected) {
      return {
        borderColor: text,
        backgroundColor: withAlpha(text, 0.06),
      };
    }
    return {
      borderColor: '#E5E7EB',
      backgroundColor: card,
    };
  }, [isTipSelected, text, card]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, cardStyle]}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color="#1F2937" />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.title}>
              {t('supportCreator.methodTitle', { creatorName })}
            </Text>

            <View style={[styles.heartIconWrap, { borderColor: text }]}>
              <Ionicons name="heart" size={28} color={text} />
            </View>

            <Text style={styles.subtitle}>
              {t('supportCreator.methodSubtitle')}
            </Text>

            <TouchableOpacity
              activeOpacity={isWalletMethodDisabled ? 1 : 0.9}
              style={[styles.methodCard, walletCardStyle]}
              onPress={handleWalletCardPress}
              disabled={isWalletMethodDisabled}
            >
              <View style={[styles.methodIconWrap, { backgroundColor: withAlpha(text, 0.08) }]}>
                <Image
                  source={walletIcon}
                  style={styles.methodIconImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.methodCopy}>
                <Text style={styles.methodTitle}>{t('supportCreator.walletMethodTitle')}</Text>
                {walletBullets.map((line, index) => (
                  <Text key={`wallet-${index}`} style={styles.methodBullet}>
                    {'\u2022'} {line}
                  </Text>
                ))}
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.methodCard, tipCardStyle]}
              onPress={handleTipCardPress}
            >
              <View style={[styles.methodIconWrap, { backgroundColor: withAlpha(text, 0.12) }]}>
                <Ionicons name="heart-outline" size={28} color={text} />
              </View>
              <View style={styles.methodCopy}>
                <Text style={styles.methodTitle}>{t('supportCreator.tipMethodTitle')}</Text>
                {tipBullets.map((line, index) => (
                  <Text key={`tip-${index}`} style={styles.methodBullet}>
                    {'\u2022'} {line}
                  </Text>
                ))}
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={[styles.importantBox, { backgroundColor: withAlpha(text, 0.1) }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#6B7280" style={styles.importantIcon} />
              <Text style={styles.importantText}>
                <Text style={styles.importantLabel}>{t('supportCreator.importantLabel')} </Text>
                {t('supportCreator.importantBody')}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: isConnectWalletEnabled ? text : '#9CA3AF' },
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
                { backgroundColor: isSendTipEnabled ? text : '#9CA3AF' },
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
              <Text style={styles.maybeLaterText}>{t('supportCreator.maybeLater')}</Text>
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
    color: '#111827',
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
    color: '#6B7280',
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
    color: '#111827',
    marginBottom: 6,
  },
  methodBullet: {
    fontSize: 13,
    color: '#4B5563',
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
    color: '#4B5563',
    lineHeight: 19,
  },
  importantLabel: {
    fontWeight: '700',
    color: '#374151',
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
    color: '#6B7280',
    fontWeight: '600',
  },
});
