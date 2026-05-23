import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import React from 'react';
import { useLanguage } from '../../i18n';

export default function UnverifiedProfileModal({ visible3, setVisible3 }) {
  const { t } = useLanguage();

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible3}
      onRequestClose={() => setVisible3(false)}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>{t('unverifiedProfile.title')}</Text>
          <Text style={styles.description}>{t('unverifiedProfile.description')}</Text>

          <TouchableOpacity style={styles.button} onPress={() => setVisible3(false)}>
            <Text style={styles.buttonText}>{t('unverifiedProfile.gotItButton')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end", 
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    color: "#555",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#000",
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
