import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Linking,
  DeviceEventEmitter,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useToast } from 'react-native-toast-notifications';
import { SHOW_EXTERNAL_LINK_MODAL_EVENT } from '../../utils/externalLinkHandler';
import { showToastMessage } from '../displaytoastmessage';

export default function ExternalLinkModal() {
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [copied, setCopied] = useState(false);

  const {
    textStyle,
    cardStyle,
    mutedTextStyle,
    borderStyle,
    accent,
    icon,
    border,
    mutedText,
    bg,
    card,
  } = useAppTheme();
  
  const toast = useToast();

  useEffect(() => {
    const listener = DeviceEventEmitter.addListener(
      SHOW_EXTERNAL_LINK_MODAL_EVENT,
      (data) => {
        if (data?.url) {
          setUrl(data.url);
          setTitle(data.title || 'Continue on Web');
          setDescription(
            data.description ||
              'Please copy the link below and paste it in your web browser (Safari or Chrome), where you can continue doing the payment, and then return to the app.'
          );
          setCopied(false);
          setVisible(true);
        }
      }
    );

    return () => {
      listener.remove();
    };
  }, []);

  const handleClose = () => {
    setVisible(false);
    setCopied(false);
  };

  const handleCopyLink = () => {
    if (!url) return;
    Clipboard.setString(url);
    setCopied(true);
    showToastMessage(toast, 'success', 'Link copied to clipboard!');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleOpenBrowser = async () => {
    if (!url) return;
    try {
      await Linking.openURL(url);
      handleClose();
    } catch (error) {
      console.log('Error launching external browser:', error);
      showToastMessage(toast, 'danger', 'Unable to open browser');
    }
  };

  if (!visible) return null;

  const activeAccent = accent || '#6366F1';
  const cardBackground = card || bg || '#FFFFFF';
  const inputBackground = border ? `${border}33` : 'rgba(0, 0, 0, 0.05)';

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={handleClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <Pressable
          style={[styles.modalContent, cardStyle, { backgroundColor: cardBackground }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Close Header Button */}
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <Ionicons name="close" size={22} color={icon || mutedText} />
          </TouchableOpacity>

          {/* Title */}
          {/* <Text style={[styles.title, textStyle]}>{title}</Text> */}

          {/* Description */}
          <Text style={[styles.description, mutedTextStyle]}>
            {description}
          </Text>

          {/* URL Container */}
          <View style={[styles.urlBox, borderStyle, { backgroundColor: inputBackground }]}>
            <Text style={[styles.urlText, textStyle]} numberOfLines={2} ellipsizeMode="tail">
              {url}
            </Text>
            <TouchableOpacity
              style={[styles.copyIconButton, { backgroundColor: activeAccent }]}
              onPress={handleCopyLink}
              activeOpacity={0.8}
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={18}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>

          {/* Primary Copy Button */}
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              { backgroundColor: copied ? '#10B981' : activeAccent },
            ]}
            onPress={handleCopyLink}
            activeOpacity={0.85}
          >
            <Ionicons
              name={copied ? 'checkmark-circle-outline' : 'copy-outline'}
              size={20}
              color="#FFFFFF"
              style={styles.btnIcon}
            />
            <Text style={styles.primaryBtnText}>
              {copied ? 'Copied to Clipboard!' : 'Copy Link'}
            </Text>
          </TouchableOpacity>

          {/* Done / Dismiss */}
          {/* <TouchableOpacity style={styles.dismissBtn} onPress={handleClose}>
            <Text style={[styles.dismissText, mutedTextStyle]}>
              I'm Done / Return to App
            </Text>
          </TouchableOpacity> */}
        </Pressable>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    // padding: 6,
    zIndex: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
    marginTop: 10,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  urlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 8,
    width: '100%',
    marginBottom: 20,
  },
  urlText: {
    flex: 1,
    fontSize: 13,
    marginRight: 8,
  },
  copyIconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 48,
    borderRadius: 14,
    marginBottom: 10,
  },
  btnIcon: {
    marginRight: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  dismissBtn: {
    paddingVertical: 6,
  },
  dismissText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
