import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../../theme/useApptheme';

const MESSAGE = 'You must complete Stripe setup to receive subscription payments.';

/**
 * Reusable modal shown when user must connect Stripe to receive payments.
 * "Connect Stripe" calls the existing Stripe onboarding API (parent provides onConnectStripe).
 * Use on Subscriptions and any other screen that requires Stripe for receiving payments.
 */
const ConnectStripeModal = ({
  visible,
  onClose,
  onConnectStripe,
}) => {
  const { text, card } = useAppTheme();

  const handleConnectStripe = () => {
    onClose?.();
    onConnectStripe?.();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: card }]}>
          <Text style={[styles.message, { color: text }]}>{MESSAGE}</Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: text }]}
              onPress={onClose}
            >
              <Text style={[styles.secondaryButtonText, { color: text }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: text }]}
              onPress={handleConnectStripe}
            >
              <Text style={styles.primaryButtonText}>Connect Stripe</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ConnectStripeModal;
export { MESSAGE as CONNECT_STRIPE_MODAL_MESSAGE };

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContainer: {
    width: '100%',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
