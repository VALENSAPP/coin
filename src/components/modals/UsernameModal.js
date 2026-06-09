import React, { useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Alert,
  Share,
  Linking,
} from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import Clipboard from '@react-native-clipboard/clipboard';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../displaytoastmessage';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';

const UsernameModal = ({ visible, onClose, data }) => {
  const sheetRef = useRef();
  const { bgStyle } = useAppTheme();
  const toast = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    if (visible) {
      sheetRef.current?.open();
    } else {
      sheetRef.current?.close();
    }
  }, [visible]);

  const resolvedData = data?.user || data || {};
  const resolvedUserId =
    resolvedData?.id || resolvedData?.userId || resolvedData?._id || null;
  const resolvedWalletAddress = (
    resolvedData?.walletAddress ||
    resolvedData?.walletId ||
    resolvedData?.wallet ||
    ''
  ).trim();
  const resolvedUsername =
    resolvedData?.userName ||
    resolvedData?.username ||
    resolvedData?.displayName ||
    '';

  const qrShareUrl = `https://api.valens.app/profile/${resolvedUserId}?username=${encodeURIComponent(resolvedUsername)}&callbackUrl=${encodeURIComponent('com.valens://')}`;

  const getProfileShareMessage = () => {
    const profileLabel = resolvedUsername ? `@${resolvedUsername}` : 'this profile';
    return t('shareProfile.shareMessageTemplate', {
      username: toBold(profileLabel),
    });
  };

  const onShare = async () => {
    try {
      if (!resolvedUsername && !resolvedUserId) {
        Alert.alert(
          t('usernameModal.profileNotAvailableTitle'),
          t('usernameModal.profileNotAvailableMessage')
        );
        return;
      }

      await Share.share({
        url: qrShareUrl,
        message: getProfileShareMessage(),
      });
    } catch (error) {
      Alert.alert(t('usernameModal.errorTitle'), t('usernameModal.shareError') + error.message);
    }
  };

  const toBold = (str) =>
    String(str)
      .split('')
      .map((c) => {
        const code = c.codePointAt(0);
        if (code >= 65 && code <= 90) return String.fromCodePoint(code + 0x1D400 - 65);
        if (code >= 97 && code <= 122) return String.fromCodePoint(code + 0x1D41A - 97);
        if (code >= 48 && code <= 57) return String.fromCodePoint(code + 0x1D7CE - 48);
        return c;
      })
      .join('');

  const copyProfileUrl = () => {
    if (!qrShareUrl) {
      Alert.alert(
        t('usernameModal.profileNotAvailableTitle'),
        t('usernameModal.copyLinkError')
      );
      return;
    }
    Clipboard.setString(`${getProfileShareMessage()}\n${qrShareUrl}`);
    showToastMessage(toast, 'success', t('usernameModal.linkCopied'));
  };

  console.log('resolvedData:', resolvedData);
console.log('resolvedUserId:', resolvedUserId);
console.log('resolvedUsername:', resolvedUsername);
console.log('qrShareUrl:', qrShareUrl);

  return (
    <RBSheet
      ref={sheetRef}
      draggable
      height={140}
      onClose={onClose}
      customModalProps={{ statusBarTranslucent: true }}
      customStyles={{
        container: [{ borderTopLeftRadius: 10, borderTopRightRadius: 10 }, bgStyle],
        draggableIcon: { width: 80 },
      }}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={[styles.modalContainer, bgStyle]}>
          {/* Top buttons */}
          <View style={styles.topButtonsRow}>
            <TouchableOpacity style={[styles.topButton, bgStyle]} onPress={copyProfileUrl}>
              <Ionicons name="copy-outline" size={20} color="#111100" />
              <Text style={styles.topButtonText}>{t('usernameModal.copyLinkButton')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.topButton, bgStyle]} onPress={onShare}>
              <Feather name="send" size={20} color="#111100" />
              <Text style={styles.topButtonText}>{t('usernameModal.sendButton')}</Text>
            </TouchableOpacity>
          </View>

          {/* <TouchableOpacity style={[styles.optionRow, bgStyle]} onPress={copyWalletAddress}>
            <Ionicons name="wallet-outline" size={20} color="#111100" style={styles.optionIcon} />
            <Text style={styles.optionText}>{t('usernameModal.walletAddressOption')}</Text>
            <Ionicons name="copy-outline" size={18} color="#788587" style={styles.optionRightIcon} />
          </TouchableOpacity> */}
        </View>
      </TouchableOpacity>
    </RBSheet>
  );
};

export default UsernameModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    // backgroundColor: 'rgba(0,0,0,0.4)',
    // justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 30,
    gap: 12,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
    marginBottom: 10,
  },
  topButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: -12,
  },
  topButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 25,
    borderRadius: 20,
    marginHorizontal: 4,
    gap: 6,
  },
  topButtonText: {
    fontSize: 14,
    color: '#111100',
    fontWeight: '500',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginVertical: 4,
  },
  optionIcon: {
    marginRight: 10,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: '#111100',
    fontWeight: '500',
  },
  optionRightIcon: {
    marginLeft: 10,
  },
});
