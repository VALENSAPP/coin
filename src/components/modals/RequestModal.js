import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Modal from 'react-native-modal';
import { useLanguage } from '../../i18n';

/**
 * Pending WalletConnect / RPC UI (matches the Reown sample: loading + JSON result).
 */
export function RequestModal({
  isVisible,
  onClose,
  isLoading,
  rpcResponse,
}) {
  const { t } = useLanguage();

  return (
    <Modal
      isVisible={isVisible}
      coverScreen
      statusBarTranslucent
      avoidKeyboard
      backdropTransitionOutTiming={0}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      style={styles.modalRoot}
    >
      <View style={styles.innerContainer}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>×</Text>
        </TouchableOpacity>

        {isLoading && (
          <View style={styles.section}>
            <Text style={styles.title}>{t('requestModal.pendingTitle')}</Text>
            <Text style={styles.subtitle}>{t('requestModal.pendingSubtitle')}</Text>
            <ActivityIndicator style={styles.loader} size="large" color="#3396FF" />
          </View>
        )}

        {rpcResponse && !isLoading && (
          <ScrollView style={styles.scroll}>
            <Text style={styles.title}>{t('requestModal.resultTitle')}</Text>
            <Text style={styles.responseText} selectable>
              {JSON.stringify(rpcResponse, null, 2)}
            </Text>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  closeButton: {
    alignSelf: 'flex-end',
    height: 32,
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginBottom: 8,
  },
  closeButtonText: {
    fontSize: 22,
    lineHeight: 24,
    color: '#333',
  },
  innerContainer: {
    padding: 16,
    maxHeight: '70%',
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  section: {
    alignItems: 'center',
  },
  loader: {
    marginVertical: 24,
  },
  title: {
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    color: '#555',
    marginBottom: 8,
  },
  scroll: {
    maxHeight: 400,
  },
  responseText: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '300',
  },
});

export default RequestModal;
