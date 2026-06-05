import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  InteractionManager,
  Platform,
} from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import { useDispatch, useSelector } from 'react-redux';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { getCreditsLeft } from '../../services/wallet';
import {
  privateSetup,
  parsePrivateCircleSetup,
  isPrivateCircleApiSuccess,
} from '../../services/privatecircle';
import { goToPrivateCircleReview } from '../../pages/post/privatecircle/privateCircleFlow';
import { showToastMessage } from '../displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../theme/useApptheme';
import ActivateMissionPost from './ActivateMissionPost';
import { useLanguage } from '../../i18n';

const PostTypeModal = ({ visible, onClose, onSelect, setShowTypeModal }) => {
  const [creditsLeft, setCreditsLeft] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showBuyCreditsModal, setShowBuyCreditsModal] = useState(false);
  const [showActivateMissionModal, setShowActivateMissionModal] = useState(false);
  const sheetRef = useRef(null);
  const pendingActivateMissionAfterSheetCloseRef = useRef(false);
  const dispatch = useDispatch();
  const userProfile = useSelector(state => state.userProfile.userProfile);
  const toast = useToast();
  const navigation = useNavigation();
  const { bgStyle, textStyle, text, card } = useAppTheme(profile);
  const { t } = useLanguage();

  const resetNestedModals = useCallback(() => {
    setShowActivateMissionModal(false);
    setShowBuyCreditsModal(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let rafId;

    if (visible) {
      fetchCreditsLeft();
      loadProfileType();
      resetNestedModals();
      const interactionHandle = InteractionManager.runAfterInteractions(() => {
        if (cancelled) return;
        rafId = requestAnimationFrame(() => {
          if (!cancelled) {
            sheetRef.current?.open();
          }
        });
      });

      return () => {
        cancelled = true;
        if (rafId != null) cancelAnimationFrame(rafId);
        if (interactionHandle && typeof interactionHandle.cancel === 'function') {
          interactionHandle.cancel();
        }
      };
    }

    resetNestedModals();
    sheetRef.current?.close();
    return undefined;
  }, [visible, resetNestedModals]);

  const loadProfileType = async () => {
    const type = await AsyncStorage.getItem('profile');
    setProfile(userProfile || type);
  };

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

  const handleCrowdfundingSelect = () => {
    if (creditsLeft === null) return;

    if (creditsLeft > 0) {
      onSelect('crowdfunding');
      resetNestedModals();
      setShowTypeModal(false);
      return;
    }

    setShowBuyCreditsModal(false);
    setShowActivateMissionModal(false);
    pendingActivateMissionAfterSheetCloseRef.current = true;
    sheetRef.current?.close();
  };

  const handleLaunchBusinessMission = () => {
    setShowActivateMissionModal(false);
    requestAnimationFrame(() => setShowBuyCreditsModal(true));
  };

  const reopenMintTypeSheet = useCallback(() => {
    if (!visible) return;
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => sheetRef.current?.open());
    });
  }, [visible]);

  const handlePostTypeSheetClose = () => {
    if (pendingActivateMissionAfterSheetCloseRef.current) {
      pendingActivateMissionAfterSheetCloseRef.current = false;
      InteractionManager.runAfterInteractions(() => {
        setShowActivateMissionModal(true);
      });
      return;
    }
    resetNestedModals();
    setShowTypeModal(false);
  };

  const handleBuyCredits = () => {
    setShowBuyCreditsModal(false);
    setShowTypeModal(false);
    navigation.navigate('MainApp', {
      screen: 'wallet',
      params: { screen: 'WalletMain' },
    });
  };

  const handlePrivateCirclePress = async () => {
    try {
      dispatch(showLoader());
      const response = await privateSetup();
      console.log(response, "Private circle setup response=>>>>>>>>>>>>>>");
      if (!isPrivateCircleApiSuccess(response)) {
        showToastMessage(
          toast,
          'danger',
          response?.message ||
          t('privateCircleMint.setupError'),
        );;
        return;
      }

      const { members, count } = parsePrivateCircleSetup(response);
      resetNestedModals();
      setShowTypeModal(false);
      sheetRef.current?.close();

      InteractionManager.runAfterInteractions(() => {
        if (count > 0) {
          onSelect('private');
          goToPrivateCircleReview(navigation, {
            mode: 'mint',
            members,
            selectedIds: members.map((m) => m.id),
            selectedMembers: members,
          });
          return;
        }
        // NEW PRIVATE CIRCL
        navigation.navigate('PrivateCircleWelcome');
      });
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.data?.message ||
        error?.message ||
        t('privateCircleMint.setupError'),
      );
    } finally {
      dispatch(hideLoader());
    }
  };

  const isCompany = profile === 'company';

  return (
    <>
      <RBSheet
        ref={sheetRef}
        height={320}
        draggable={false}
        onClose={handlePostTypeSheetClose}
        customModalProps={
          Platform.OS === 'ios'
            ? { presentationStyle: 'overFullScreen' }
            : { statusBarTranslucent: true }
        }
        customStyles={{
          container: [
            {
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 20,
            },
            bgStyle,
          ],
        }}
        onRequestClose={() => { }}
        closeOnPressMask={false}
        closeOnPressBack={false}
      >
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close-outline" size={28} color={text} />
            </TouchableOpacity>

            <Text style={[styles.title, textStyle]}>
              {t('postTypeModal.title')}
            </Text>

            {/* spacing balance */}
            <View style={{ width: 28 }} />
          </View>

          <TouchableOpacity
            style={[
              styles.optionBtn,
              { backgroundColor: card, borderColor: text },
              creditsLeft === 0 && styles.disabledOption,
            ]}
            onPress={handleCrowdfundingSelect}
            disabled={creditsLeft === null}
          >
            <Text style={[styles.optionText, textStyle]}>
              {isCompany
                ? t('postTypeModal.supportLabel')
                : t('postTypeModal.missionMintLabel')}
              {' '}({t('postTypeModal.creditsLeft', { count: creditsLeft ?? 0 })})
            </Text>
            {creditsLeft === 0 && !isCompany && (
              <Text style={styles.noCreditsText}>
                {t('postTypeModal.noCreditsAvailable')}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionBtn, { backgroundColor: card, borderColor: text }]}
            onPress={() => {
              onSelect('regular');
              resetNestedModals();
              setShowTypeModal(false);
            }}
          >
            <Text style={[styles.optionText, textStyle]}>
              {t('postTypeModal.regularMintLabel')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionBtn, { backgroundColor: card, borderColor: text }]}
            activeOpacity={0.85}
            onPress={handlePrivateCirclePress}
          >
            <View style={styles.privateCircleTitleRow}>
              <Icon name="lock-closed" size={16} color={textStyle.color} />
              <Text style={[styles.privateCircleTitle, textStyle]}>
                {t('postTypeModal.privateCircleMintLabel')}
              </Text>
            </View>
            <Text style={styles.privateCircleSubtitle}>
              {t('postTypeModal.privateCircleMintSubtitle')}
            </Text>
          </TouchableOpacity>
        </View>
      </RBSheet>

      {/* Buy Credits Modal */}
      <Modal
        visible={showBuyCreditsModal}
        transparent={true}
        animationType="fade"
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
        onRequestClose={() => { }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => { }}
        >
          <View style={[styles.modalContent, bgStyle]}>
            <View style={styles.modalHeader}>
              <Icon name="wallet-outline" size={50} color={text} />
            </View>

            <Text style={[styles.modalTitle, textStyle]}>
              {t('postTypeModal.buyCreditsTitle')}
            </Text>

            <Text style={[styles.modalMessage, textStyle]}>
              {t('postTypeModal.buyCreditsMessage', {
                type: isCompany
                  ? t('postTypeModal.supportType')
                  : t('postTypeModal.missionMintType'),
              })}
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.buyButton, { backgroundColor: text, shadowColor: text }]}
                onPress={handleBuyCredits}
              >
                <Icon name="cart-outline" size={20} color="#fff" />
                <Text style={styles.buyButtonText}>
                  {t('postTypeModal.buyCreditsButton')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cancelButton, bgStyle]}
                onPress={() => {
                  setShowBuyCreditsModal(false);
                  reopenMintTypeSheet();
                }}
              >
                <Text style={[styles.cancelButtonText, textStyle]}>
                  {t('postTypeModal.cancelButton')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <ActivateMissionPost
        visible={showActivateMissionModal}
        onClose={() => {
          setShowActivateMissionModal(false);
          reopenMintTypeSheet();
        }}
        onLaunch={handleLaunchBusinessMission}
      />
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
    paddingVertical: 5,
  },
  optionBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
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
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
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
    borderColor: '#cfcfcf',
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
  privateCircleBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#B19CD9',
    backgroundColor: '#F9F7FF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  privateCircleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  privateCircleTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  privateCircleSubtitle: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 16,
  },
});
