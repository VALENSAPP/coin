import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../../i18n';

const PrintWarningModal = ({ visible, onClose, attempts = 1 }) => {
  const { t } = useLanguage();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalIcon}>🚫</Text>
          <Text style={styles.modalTitle}>{t('subventionSetup.printWarningTitle')}</Text>
          <Text style={styles.modalText}>{t('subventionSetup.printWarningText')}</Text>
          <View style={styles.warningBox}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningText}>{t('subventionSetup.printWarningSubText')}</Text>
          </View>
          <Text style={styles.footerText}>{t('subventionSetup.printWarningFooter')}</Text>
          <TouchableOpacity style={styles.understandButton} onPress={onClose}>
            <Text style={styles.understandButtonText}>{t('subventionSetup.iUnderstand')}</Text>
          </TouchableOpacity>
          <Text style={styles.attemptCounter}>{t('subventionSetup.attempts')}: {attempts}/3</Text>
        </View>
      </View>
    </Modal>
  );
};

export default PrintWarningModal;

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 30, width: '100%', maxWidth: 400, alignItems: 'center' },
  modalIcon: { fontSize: 60, marginBottom: 16 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#dc2626', marginBottom: 16 },
  modalText: { fontSize: 16, color: '#374151', textAlign: 'center', lineHeight: 24, marginBottom: 20 },
  warningBox: { backgroundColor: '#fef3c7', padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, borderWidth: 1, borderColor: '#fbbf24' },
  warningIcon: { fontSize: 20, marginRight: 8 },
  warningText: { flex: 1, fontSize: 14, color: '#92400e', lineHeight: 20 },
  footerText: { fontSize: 16, color: '#6b7280', marginBottom: 24, textAlign: 'center' },
  understandButton: { backgroundColor: '#7c3aed', paddingVertical: 16, paddingHorizontal: 40, borderRadius: 12, width: '100%' },
  understandButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  attemptCounter: { marginTop: 16, fontSize: 14, color: '#dc2626', fontWeight: '600' },
});
