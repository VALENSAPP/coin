import { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const ShippingDetailsModal = ({ visible, onCancel, onSubmit, text }) => {
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = carrier.trim().length > 0 && trackingNumber.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    await onSubmit({ carrier: carrier.trim(), trackingNumber: trackingNumber.trim() });
    setSubmitting(false);
    setCarrier('');
    setTrackingNumber('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={modalStyles.backdrop}>
        <View style={modalStyles.card}>
          <Text style={modalStyles.title}>Shipping details</Text>

          <Text style={modalStyles.label}>Carrier</Text>
          <TextInput
            style={modalStyles.input}
            placeholder="e.g. FedEx, UPS, USPS"
            value={carrier}
            onChangeText={setCarrier}
          />

          <Text style={modalStyles.label}>Tracking number</Text>
          <TextInput
            style={modalStyles.input}
            placeholder="e.g. 771234567890"
            value={trackingNumber}
            onChangeText={setTrackingNumber}
            keyboardType="default"
            autoCapitalize="characters"
          />

          <View style={modalStyles.actionsRow}>
            <TouchableOpacity onPress={onCancel} style={modalStyles.cancelBtn}>
              <Text style={modalStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
              style={[modalStyles.submitBtn, { backgroundColor: text, opacity: canSubmit ? 1 : 0.5 }]}
            >
              <Text style={modalStyles.submitText}>{submitting ? 'Submitting...' : 'Mark as Shipped'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 20 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
  label: { fontSize: 13, color: '#6b7280', marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18, gap: 12 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 14 },
  cancelText: { color: '#6b7280', fontWeight: '600' },
  submitBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  submitText: { color: '#fff', fontWeight: '700' },
});

export default ShippingDetailsModal;