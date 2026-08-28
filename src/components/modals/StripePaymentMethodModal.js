import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';

/**
 * Modal shown when user must connect Stripe to add a payment method (payer flow).
 * "Connect to Stripe" calls the onboarding API (parent provides onConnectStripe).
 * Use on payment screens: Donation, Token Purchase, Credits, Subscription, Payment.
 */
const StripePaymentMethodModal = ({ visible, onClose, onConnectStripe }) => {
  const { text, card } = useAppTheme();
  const { t } = useLanguage();

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
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: card }]}>
          <Text style={[styles.message, { color: text }]}>
            {t('stripePaymentMethod.message')}
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: text }]}
              onPress={onClose}
            >
              <Text style={[styles.secondaryButtonText, { color: text }]}>
                {t('stripePaymentMethod.cancelButton')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: text }]}
              onPress={handleConnectStripe}
            >
              <Text style={styles.primaryButtonText}>
                {t('stripePaymentMethod.connectButton')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default StripePaymentMethodModal;

export const STRIPE_PAYMENT_METHOD_MODAL_MESSAGE =
  'Please complete the Stripe setup to add a payment method.';

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
    fontSize: 14.5,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
