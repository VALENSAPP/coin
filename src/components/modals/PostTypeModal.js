import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { getCreditsLeft } from '../../services/wallet';
import { showToastMessage } from '../displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';

const PostTypeModal = ({ visible, onClose, onSelect }) => {
  const [creditsLeft, setCreditsLeft] = useState(null);
  const sheetRef = useRef(null);
  const dispatch = useDispatch();
  const toast = useToast();

  useEffect(() => {
    fetchCreditsLeft();
    if (visible) {
      sheetRef.current?.open();
    } else {
      sheetRef.current?.close();
    }
  }, [visible]);

  const fetchCreditsLeft = async () => {
    try {
      dispatch(showLoader());
      const response = await getCreditsLeft();
      if (response?.statusCode === 200) {
        setCreditsLeft(response.data.hitLeft);
      } else {
        showToastMessage(toast, 'danger', response.data.message);
      }
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.message ?? 'Something went wrong',
      );
    } finally {
      dispatch(hideLoader());
    }
  };

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
          <Text style={styles.optionText}>💸 Mission Post (Credits Left - {creditsLeft})</Text>
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
