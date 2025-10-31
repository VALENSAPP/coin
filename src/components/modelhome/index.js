import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

export default function ModalHome({ visible, onClose }) {
    console.log('ModalHome', visible);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalContent}>
          <TouchableOpacity style={styles.option}>
            <Icon name="people-outline" size={22} color="#000" style={styles.optionIcon} />
            <Text style={styles.optionText}>Vallowing</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.option}>
            <Icon name="star-outline" size={22} color="#000" style={styles.optionIcon} />
            <Text style={styles.optionText}>Favourites</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    // justifyContent: 'flex-start',
    alignItems: 'center',
  },
  modalContent: {
    marginTop: 80,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 220,
  },
  // logo: {
  //   fontFamily: 'FontsFree-Net-Billabong',
  //   fontSize: 32,
  //   color: '#000',
  //   marginBottom: 18,
  // },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    width: '100%',
  },
  optionIcon: {
    marginRight: 16,
  },
  optionText: {
    fontSize: 18,
    color: '#222',
    fontWeight: '500',
    fontFamily: 'System',
  },
});
