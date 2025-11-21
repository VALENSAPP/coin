import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

const SubscriptionActivationPopup = ({
  visible,
  onClose,
  onAccept,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.box}>

          <Text style={styles.title}>Become a Private Subscriber</Text>

          <Text style={styles.text}>
            A monthly fee of <Text style={{ fontWeight: "bold" }}>$19.90</Text> 
            will be charged to activate your private subscriber account.
          </Text>

          <Text style={styles.sectionTitle}>Platform Fees</Text>

          <Text style={styles.bullet}>• $19.99 Monthly Maintenance Fee</Text>
          <Text style={styles.subText}>
            For hosting and operating your private subscription channel.
          </Text>

          <Text style={styles.bullet}>• 5% Withdrawal Fee</Text>
          <Text style={styles.subText}>
            Applied to every payout request you make.
          </Text>

          <Text style={styles.sectionTitle}>Billing Authorization</Text>

          <Text style={styles.text}>
            By continuing, you authorize Valens to automatically charge the monthly
            maintenance fee and deduct the 5% withdrawal fee from your payouts.
          </Text>

          <View style={styles.row}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.acceptBtn} onPress={onClose}>
              <Text style={styles.acceptTxt}>Accept</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
};

export default SubscriptionActivationPopup;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  box: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 15,
  },
  bullet: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 10,
  },
  text: {
    fontSize: 14,
    color: "#333",
    marginTop: 10,
  },
  subText: {
    fontSize: 14,
    marginLeft: 10,
    color: "#555",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 25,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#ddd",
    marginRight: 10,
    alignItems: "center",
  },
  acceptBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#5a2d82",
    marginLeft: 10,
    alignItems: "center",
  },
  cancelTxt: {
    fontSize: 16,
    color: "#000",
    fontWeight: "600",
  },
  acceptTxt: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
});
