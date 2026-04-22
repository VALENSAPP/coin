import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useAppTheme } from "../../theme/useApptheme";

const SubscriptionActivationPopup = ({
  visible,
  onClose,
  onConfirm

}) => {
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation();
  const { bgStyle, textStyle, card, text } = useAppTheme();

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      await onConfirm?.();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} pointerEvents="auto">
      <View style={styles.overlay} pointerEvents="auto">
        <View style={[styles.box, bgStyle, { backgroundColor: card }]}>

          <Text style={[styles.title, textStyle]}>Become a Private Subscriber</Text>

          <Text style={[styles.text, textStyle]}>
            A monthly fee of <Text style={{ fontWeight: "bold" }}>$19.90 </Text>
            
           will be charged to activate your private subscriber account.
          </Text>

          <Text style={[styles.sectionTitle, textStyle]}>Platform Fees</Text>

          <Text style={[styles.bullet, textStyle]}>• $19.90 Monthly Maintenance Fee</Text>
          <Text style={[styles.subText, textStyle]}>
            For hosting and operating your private subscription channel.
          </Text>

          <Text style={[styles.bullet, textStyle]}>• 5% Withdrawal Fee</Text>
          <Text style={[styles.subText, textStyle]}>
            Applied to every payout request you make.
          </Text>

          <Text style={[styles.sectionTitle, textStyle]}>Billing Authorization</Text>

          <Text style={[styles.text, textStyle]}>
            By continuing, you authorize Valens to automatically charge the monthly
            maintenance fee and deduct the 5% withdrawal fee from your payouts.
          </Text>

          <View style={styles.row}>
            <TouchableOpacity 
              style={[styles.cancelBtn, { borderColor: text }, isLoading && styles.cancelBtnDisabled]} 
              onPress={() => {
                onClose();
                navigation.navigate('MainApp', {
                  screen: 'wallet',
                  params: { screen: 'Dashboard' }
                });
              }}
              disabled={isLoading}
            >
              <Text style={[styles.cancelTxt, { color: text }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.acceptBtn, { backgroundColor: text }, isLoading && styles.acceptBtnDisabled]} 
              onPress={handleAccept}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={card || "#fff"} size="small" />
              ) : (
                <Text style={[styles.acceptTxt, { color: card || "#fff" }]}>Accept</Text>
              )}
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
    marginTop: 10,
  },
  subText: {
    fontSize: 14,
    marginLeft: 10,
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
    borderWidth: 1,
    marginRight: 10,
    alignItems: "center",
  },
  cancelBtnDisabled: {
    opacity: 0.5,
  },
  acceptBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    marginLeft: 10,
    alignItems: "center",
  },
  cancelTxt: {
    fontSize: 16,
    fontWeight: "600",
  },
  acceptTxt: {
    fontSize: 16,
    fontWeight: "600",
  },
  acceptBtnDisabled: {
    opacity: 0.7,
  },
});
