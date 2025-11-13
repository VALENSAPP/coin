import React, { useEffect, useRef } from 'react';
import {
  Modal,
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Alert
} from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';

const UsernameModal = ({ visible, onClose }) => {
  const sheetRef = useRef();

  useEffect(() => {
    if (visible) {
      sheetRef.current?.open();
    } else {
      sheetRef.current?.close();
    }
  }, [visible]);

  return (
    <RBSheet
      ref={sheetRef}
      draggable
      height={300}
      onClose={onClose} // Add this line - crucial for resetting state
      customModalProps={{
        statusBarTranslucent: true,
      }}
      
      customStyles={{
        container: {
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
          backgroundColor: '#f8f2fd',
        },
        draggableIcon: {
          width: 80,
        },
      }}>
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContainer}>
          {/* Drag handle */}
          {/* <View style={styles.dragHandle} /> */}

          {/* Top buttons */}
          <View style={styles.topButtonsRow}>
            <TouchableOpacity
              style={styles.topButton}
              onPress={() => Alert.alert('Copy Link')}
            >
              <Ionicons name="copy-outline" size={20} color="#111100" />
              <Text style={styles.topButtonText}>Copy link</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.topButton}
              onPress={() => Alert.alert('Send')}
            >
              <Feather name="send" size={20} color="#111100" />
              <Text style={styles.topButtonText}>Send</Text>
            </TouchableOpacity>
          </View>

          {/* Options */}
          {/* <TouchableOpacity style={styles.optionRow} onPress={() => { }}>
            <Feather name="slack" size={20} color="#111100" style={styles.optionIcon} />
            <Text style={styles.optionText}>Dexscreener</Text>
            <Feather name="external-link" size={18} color="#788587" style={styles.optionRightIcon} />
          </TouchableOpacity> */}

          <TouchableOpacity style={styles.optionRow} onPress={() => { }}>
            <Ionicons name="person-circle-outline" size={20} color="#111100" style={styles.optionIcon} />
            <Text style={styles.optionText}>Creator contract address</Text>
            <Ionicons name="copy-outline" size={18} color="#788587" style={styles.optionRightIcon} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionRow} onPress={() => { }}>
            <Ionicons name="wallet-outline" size={20} color="#111100" style={styles.optionIcon} />
            <Text style={styles.optionText}>Base wallet address</Text>
            <Ionicons name="copy-outline" size={18} color="#788587" style={styles.optionRightIcon} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </RBSheet>
  );
};

export default UsernameModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    // backgroundColor: 'rgba(0,0,0,0.4)',
    // justifyContent: 'flex-end',
  },
  modalContainer: {
     backgroundColor: '#f8f2fd',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 30,
    gap: 12,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
    marginBottom: 10,
  },
  topButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: -12,
  },
  topButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f2fd',
    paddingVertical: 25,
    borderRadius: 20,
    marginHorizontal: 4,
    gap: 6,
  },
  topButtonText: {
    fontSize: 14,
    color: '#111100',
    fontWeight: '500',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f2fd',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginVertical: 4,
  },
  optionIcon: {
    marginRight: 10,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: '#111100',
    fontWeight: '500',
  },
  optionRightIcon: {
    marginLeft: 10,
  },
});
