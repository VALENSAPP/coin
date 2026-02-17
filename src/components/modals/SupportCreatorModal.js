import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useAppTheme } from '../../theme/useApptheme';

const SupportCreatorModal = ({
  visible,
  onClose,
  onSupport,
  creatorName = 'Creator',
}) => {
  const { text, card, bg } = useAppTheme();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: card }]}>
          <View style={[styles.badge, { backgroundColor: bg }]}>
            {/* <Text style={[styles.badgeText, { color: text }]}>Creator Support</Text> */}
                      <Text style={[styles.title, { color: text }]}>Support this creator?</Text>

          </View>

          {/* <Text style={[styles.title, { color: text }]}>Support this creator?</Text> */}

          <Text style={styles.description}>
            Your follow is free. If you want, you can financially support{' '}
            <Text style={styles.creatorName}>{creatorName}</Text> now.
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.supportButton, { backgroundColor: text }]}
              onPress={onSupport}
            >
              <Text style={styles.supportButtonText}>Support now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.laterButton}
              onPress={onClose}
            >
              <Text style={styles.laterButtonText}>Nah, later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default SupportCreatorModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 8, 20, 0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: '100%',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  badge: {
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginBottom: 10,
    alignItems:'center'
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign:'center'
  },
  title: {
    fontSize: 21,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: '#5E5E6A',
    textAlign: 'center',
    marginBottom: 22,
    lineHeight: 21,
  },
  creatorName: {
    fontWeight: '700',
    color: '#141414',
  },
  buttonContainer: {
    gap: 12,
  },
  supportButton: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  supportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  laterButton: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5DEEF',
    backgroundColor: '#FAF8FC',
  },
  laterButtonText: {
    fontSize: 16,
    color: '#5A5A67',
    fontWeight: '600',
  },
});
