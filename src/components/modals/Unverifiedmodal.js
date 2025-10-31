import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import React, { useState } from "react";
export default function UnverifiedProfileModal({visible3,setVisible3}) {

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible3}
      onRequestClose={() => setVisible3(false)}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Unverified profile</Text>
          <Text style={styles.description}>
            This profile is marked as unverified due to not having any social
            accounts linked. Only interact with coins you trust.
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => setVisible3(false)}
          >
            <Text style={styles.buttonText}>Got it</Text>
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
