import React, { useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Alert,
  Share
} from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import Clipboard from '@react-native-clipboard/clipboard';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../displaytoastmessage';
import { useAppTheme } from '../../theme/useApptheme';

const UsernameModal = ({ visible, onClose, data }) => {
  const sheetRef = useRef();
  const { bgStyle } = useAppTheme();
  const toast = useToast();

  useEffect(() => {
    if (visible) {
      sheetRef.current?.open();
    } else {
      sheetRef.current?.close();
    }
  }, [visible]);

  const resolvedData = data?.user || data || {};
  const resolvedUserId =
    resolvedData?.id ||
    resolvedData?.userId ||
    resolvedData?._id ||
    null;
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

  const onShare = async () => {
      try {
        if (!resolvedUsername) {
          Alert.alert('Username not available', 'Unable to share profile right now.');
          return;
        }
        const encodedUsername = encodeURIComponent(resolvedUsername);
        const result = await Share.share({
          message: `Check out @${resolvedUsername} on Valens!\nhttps://valens.app/profile/${encodedUsername}`,
        });
  
        if (result.action === Share.sharedAction) {
          if (result.activityType) {
            console.log('Shared with activity type:', result.activityType);
          } else {
            console.log('Shared successfully');
          }
        } else if (result.action === Share.dismissedAction) {
          console.log('Share dismissed');
        }
      } catch (error) {
        Alert.alert('Error', 'Error sharing content: ' + error.message);
      }
    };

  const copyUserId = () => {
    if (!resolvedUserId) {
      Alert.alert('User ID not available', 'Unable to find user ID to copy.');
      return;
    }

    Clipboard.setString(String(resolvedUserId));
    showToastMessage(toast, 'success', 'User ID copied successfully');
  };

  const copyWalletAddress = () => {
    if (!resolvedWalletAddress) {
      Alert.alert('Wallet not connected', 'Please connect your wallet first.');
      return;
    }

    Clipboard.setString(resolvedWalletAddress);
    showToastMessage(toast, 'success', 'Wallet address copied successfully');
  };

  return (
    <RBSheet
      ref={sheetRef}
      draggable
      height={230}
      onClose={onClose} // Add this line - crucial for resetting state
      customModalProps={{
        statusBarTranslucent: true,
      }}
      
      customStyles={{
        container: [{
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
        }, bgStyle],
        draggableIcon: {
          width: 80,
        },
      }}>
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={[styles.modalContainer, bgStyle]}>
          {/* Drag handle */}
          {/* <View style={styles.dragHandle} /> */}

          {/* Top buttons */}
          <View style={styles.topButtonsRow}>
            <TouchableOpacity
              style={[styles.topButton, bgStyle]}
              onPress={copyUserId}
            >
              <Ionicons name="copy-outline" size={20} color="#111100" />
              <Text style={styles.topButtonText}>Copy </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.topButton, bgStyle]}
              onPress={onShare}
            >
              <Feather name="send" size={20} color="#111100" />
              <Text style={styles.topButtonText}>Send</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.optionRow, bgStyle]} onPress={copyWalletAddress}>
            <Ionicons name="wallet-outline" size={20} color="#111100" style={styles.optionIcon} />
            <Text style={styles.optionText}>Base wallet address</Text>
            <Ionicons name="copy-outline" size={18} color="#788587" style={styles.optionRightIcon} />
          </TouchableOpacity>
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
