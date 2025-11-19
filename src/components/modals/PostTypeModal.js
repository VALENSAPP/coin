import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { getCreditsLeft } from '../../services/wallet';
import { showToastMessage } from '../displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../theme/useApptheme';

const PostTypeModal = ({ visible, onClose, onSelect, setShowTypeModal }) => {
  const [creditsLeft, setCreditsLeft] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showBuyCreditsModal, setShowBuyCreditsModal] = useState(false);
  const sheetRef = useRef(null);
  const dispatch = useDispatch();
  const toast = useToast();
  const navigation = useNavigation();
   const { bgStyle, textStyle, text } = useAppTheme();

  useEffect(() => {
    fetchCreditsLeft();
    loadProfileType();
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

  const loadProfileType = async () => {
    const type = await AsyncStorage.getItem('profile');
    setProfile(type);
  };

  const handleCrowdfundingSelect = () => {
    if (creditsLeft === 0) {
      setShowBuyCreditsModal(true);
    } else {
      onSelect('crowdfunding');
      setShowTypeModal(false);
    }
  };

  const handleBuyCredits = () => {
    // TODO: Navigate to buy credits screen or handle purchase flow
    setShowBuyCreditsModal(false);
    setShowTypeModal(false);
    navigation.navigate('MainApp', {
      screen: 'wallet',
      params: { screen: 'WalletMain' }
    });
    // Add your navigation logic here, for example:
    // navigation.navigate('BuyCredits');
  };

  return (
    <>
      <RBSheet
        ref={sheetRef}
        height={260}
        draggable={false}
        onClose={() => setShowTypeModal(false)}
        customStyles={{
          container: [{
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            padding: 20,
          }, bgStyle],
        }}
        onRequestClose={() => { }}
        closeOnPressMask={false}
        closeOnPressBack={false}
      >
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close-outline" size={28} color="#000" />
            </TouchableOpacity>

            <Text style={[styles.title, textStyle]}>Choose Mint Type</Text>

            {/* For spacing balance */}
            <View style={{ width: 28 }} />
          </View>

          <TouchableOpacity
            style={[
              styles.optionBtn,
              creditsLeft === 0 && styles.disabledOption
            ]}
            onPress={handleCrowdfundingSelect}
          >
            <Text style={[styles.optionText, textStyle]}>
              {profile === 'company' ? '💸 Support' : '💸 Mission Mint'}
              (Credits Left - {creditsLeft ?? 0})
            </Text>
            {creditsLeft === 0 && (
              <Text style={styles.noCreditsText}>No credits available</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionBtn}
            onPress={() => {
              onSelect('regular');
              setShowTypeModal(false);
            }}
          >
            <Text style={[styles.optionText, textStyle]}>📝 Regular Mint</Text>
          </TouchableOpacity>
        </View>
      </RBSheet>

      {/* Buy Credits Modal */}
      <Modal
        visible={showBuyCreditsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => { }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => { }}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Icon name="wallet-outline" size={50} color={text} />
            </View>

            <Text style={styles.modalTitle}>No Credits Available</Text>
              <Text style={styles.modalMessage}>
                You need credits to create a {profile === 'company' ? 'Support' : 'Mission Mint'}.
                Purchase credits to continue.
              </Text>

            <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.buyButton, {backgroundColor: text, shadowColor: text}]}
                  onPress={handleBuyCredits}
                >
                  <Icon name="cart-outline" size={20} color="#fff" />
                  <Text style={styles.buyButtonText}>Buy Credits</Text>
                </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cancelButton, bgStyle]}
                onPress={() => { setShowBuyCreditsModal(false); navigation.goBack(); }}
              >
                <Text style={[styles.cancelButtonText, textStyle]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

export default PostTypeModal;

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 35,
    textAlign: 'center',
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
  disabledOption: {
    backgroundColor: '#f5f5f5',
    opacity: 0.7,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  noCreditsText: {
    fontSize: 12,
    color: '#ff3040',
    marginTop: 4,
    fontWeight: '500',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButtons: {
    width: '100%',
  },
  buyButton: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // marginBottom: 15,
  },
  closeBtn: {
    // padding: 4,
    marginTop: -30,
  },

});