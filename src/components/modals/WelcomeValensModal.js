import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import React from "react";
import { useAppTheme } from "../../theme/useApptheme";

export default function WelcomeValensModal({ visible, onClose }) {
  const { bgStyle, textStyle, text } = useAppTheme();

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContent, bgStyle]}>
          <Text style={[styles.title, textStyle]}>Welcome, you are Valens!</Text>
          <Text style={styles.description}>
            Your KYC verification has been approved. You can now explore the app and start connecting with the community.
          </Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: text }]}
            onPress={onClose}
          >
            <Text style={styles.buttonText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </View>
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

