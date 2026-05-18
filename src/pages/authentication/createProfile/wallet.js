import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Dimensions,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import StepHeader from './headerSection';
import { EditProfile } from '../../../services/createProfile';
import { useToast } from 'react-native-toast-notifications';
import { useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loggedIn } from '../../../redux/actions/LoginAction';
import { useAppTheme } from '../../../theme/useApptheme';
import { useLanguage } from '../../../i18n';

const { width, height } = Dimensions.get('window');

function useModalAnimation(isVisible) {
  const translateY = useRef(new Animated.Value(height * 0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      translateY.setValue(height * 0.4);
      opacity.setValue(0);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1, duration: 220,
          easing: Easing.out(Easing.quad), useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0, damping: 12,
          stiffness: 180, mass: 0.6, useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0, duration: 180,
          easing: Easing.in(Easing.quad), useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: height * 0.05, duration: 180,
          easing: Easing.in(Easing.quad), useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, opacity, translateY]);

  return { translateY, opacity };
}

export default function WalletScreen({ route }) {
  const { profileData, serverProfile: initialProfile } = route.params;
  const [modalMessage, setModalMessage] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('creating');

  const toast = useToast();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { t } = useLanguage(); // i18n

  const modalAnim = useModalAnimation(showModal);
  const { bgStyle, textStyle } = useAppTheme();

  const handleCreateProfile = async () => {
    try {
      const formData = new FormData();
      formData.append('userName', profileData.username);
      formData.append('displayName', profileData.displayName);
      formData.append('bio', profileData.bio);
      if (profileData?.image && profileData.image.uri) {
        const img = profileData.image;
        const fileUri = Platform.OS === 'android' ? img.uri : img.uri.replace('file://', '');
        formData.append('image', { uri: fileUri, name: img.name || 'profile.jpg', type: img.type || 'image/jpeg' });
      } else if (profileData?.imageUri) {
        const uri = profileData.imageUri;
        const fileUri = Platform.OS === 'android' ? uri : uri.replace('file://', '');
        formData.append('image', { uri: fileUri, name: 'profile.jpg', type: 'image/jpeg' });
      }
      formData.append('gender', '');
      formData.append('age', '');
      formData.append('phoneNumber', '');

      const response = await EditProfile(formData);
      const code = response.statusCode;

      if (code === 200) {
        setModalType('success');
        setModalMessage(t('wallet.successTitle'));
        setTimeout(async () => {
          setShowModal(false);
          await AsyncStorage.setItem('isLoggedIn', 'true');
          dispatch(loggedIn());
        }, 5000);
      } else if (code === 500) {
        setModalType('error');
        setModalMessage(t('wallet.errorTitle'));
      } else {
        setModalType('error');
        setModalMessage(response.message || t('wallet.errorTitle'));
      }
    } catch (err) {
      setModalType('error');
      setModalMessage(err?.response?.data?.message || 'Network error. Please check your connection.');
    }
  };

  const handleRetry = () => {
    setIsRetrying(true);
    setModalType('creating');
    setShowModal(true);
    setTimeout(handleCreateProfile, 300);
  };

  useEffect(() => {
    setShowModal(true);
    setModalType('creating');
    const timer = setTimeout(handleCreateProfile, 500);
    return () => clearTimeout(timer);
  }, []);

  const renderModalContent = () => {
    if (modalType === 'creating') {
      return (
        <>
          <View style={styles.creatingIcon}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
          <Text style={styles.modalTitle}>
            {isRetrying ? t('wallet.retryingTitle') : t('wallet.creatingTitle')}
          </Text>
          <Text style={styles.modalMessage}>
            {isRetrying ? t('wallet.retryingMessage') : t('wallet.creatingMessage')}
          </Text>
          <View style={styles.dotsContainer}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
          </View>
        </>
      );
    }

    if (modalType === 'success') {
      return (
        <>
          <View style={[styles.resultIcon, styles.successIconBg]}>
            <Text style={styles.resultIconText}>✓</Text>
          </View>
          <Text style={styles.modalTitle}>{t('wallet.successTitle')}</Text>
          <Text style={styles.modalMessage}>{modalMessage}</Text>
          <View style={styles.successFooter}>
            <Text style={styles.autoCloseText}>{t('wallet.successRedirect')}</Text>
            <View style={styles.successDots}>
              <View style={[styles.successDot, styles.successDotActive]} />
              <View style={[styles.successDot, styles.successDotActive]} />
              <View style={[styles.successDot, styles.successDotActive]} />
            </View>
          </View>
        </>
      );
    }

    if (modalType === 'error') {
      return (
        <>
          <View style={[styles.resultIcon, styles.errorIconBg]}>
            <Text style={styles.resultIconText}>×</Text>
          </View>
          <Text style={styles.modalTitle}>{t('wallet.errorTitle')}</Text>
          <Text style={styles.modalMessage}>{modalMessage}</Text>
          <TouchableOpacity
            style={[styles.modalButton, styles.errorButton]}
            onPress={handleRetry}
          >
            <Text style={styles.buttonText}>{t('wallet.tryAgain')}</Text>
          </TouchableOpacity>
        </>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <StepHeader currentStep={2} />

      <Modal
        visible={showModal}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => {
          if (modalType === 'error') setShowModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalContainer,
              { opacity: modalAnim.opacity, transform: [{ translateY: modalAnim.translateY }] },
            ]}
          >
            {renderModalContent()}
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff', borderRadius: 20,
    padding: 32, alignItems: 'center', width: width * 0.85, maxWidth: 350,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16 },
      android: { elevation: 12 },
    }),
  },
  creatingIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#6366f1',
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  resultIcon: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  successIconBg: { backgroundColor: '#10b981' },
  errorIconBg: { backgroundColor: '#ef4444' },
  resultIconText: { fontSize: 36, color: '#fff', fontWeight: 'bold' },
  modalTitle: { fontSize: 24, fontWeight: '700', marginBottom: 12, textAlign: 'center', color: '#111827' },
  modalMessage: { fontSize: 16, color: '#6b7280', textAlign: 'center', lineHeight: 24 },
  modalButton: {
    paddingVertical: 14, paddingHorizontal: 24,
    borderRadius: 10, marginTop: 24, width: '100%', alignItems: 'center',
  },
  errorButton: { backgroundColor: '#ef4444' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  dotsContainer: { flexDirection: 'row', marginTop: 20, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#d1d5db' },
  dotActive: { backgroundColor: '#6366f1' },
  successFooter: { marginTop: 20, alignItems: 'center' },
  autoCloseText: { fontSize: 14, color: '#10b981', textAlign: 'center', fontWeight: '500' },
  successDots: { flexDirection: 'row', marginTop: 12, gap: 6 },
  successDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#d1fae5' },
  successDotActive: { backgroundColor: '#10b981' },
});