import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';

const PostTypeModal = ({ visible, onClose, onSelect }) => {
  const sheetRef = useRef(null);

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
      height={260}
      draggable
      onClose={onClose}
      customStyles={{
        container: {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          backgroundColor: '#f8f2fd',
          padding: 20,
        },
      }}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Choose Post Type</Text>

        <TouchableOpacity
          style={styles.optionBtn}
          onPress={() => {
            onSelect('crowdfunding');
            onClose();
          }}
        >
          <Text style={styles.optionText}>💸 Mission Post</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionBtn}
          onPress={() => {
            onSelect('regular');
            onClose();
          }}
        >
          <Text style={styles.optionText}>📝 Regular Post</Text>
        </TouchableOpacity>
      </View>
    </RBSheet>
  );
};

export default PostTypeModal;

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#5a2d82',
    marginBottom: 20,
    textAlign: 'center',
    marginBottom: 35
  },
  optionBtn: {
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5a2d82',
  },
});
