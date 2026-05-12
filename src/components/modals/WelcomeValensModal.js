import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from "react-native";
import React from "react";
import { useAppTheme } from "../../theme/useApptheme";
import { useLanguage } from "../../i18n";

export default function WelcomeValensModal({ visible, onClose }) {
  const { bgStyle, textStyle, text } = useAppTheme();
  const { t } = useLanguage();

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.modalContent, bgStyle]} onPress={() => {}}>
          <Text style={[styles.title, textStyle]}>{t('welcomeValensModal.title')}</Text>
          <Text style={styles.description}>
            {t('welcomeValensModal.description')}
          </Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: text }]}
            onPress={onClose}
          >
            <Text style={styles.buttonText}>{t('welcomeValensModal.getStarted')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 22,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

