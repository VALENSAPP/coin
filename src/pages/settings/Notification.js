import { useNavigation } from '@react-navigation/native';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  StatusBar,
  Platform,
  PermissionsAndroid,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';

// Fallback icon component to mirror ChatMessages UI reliability
const FallbackIcon = ({ name, size = 24, color = '#000', style }) => {
  const getIconText = (iconName) => {
    switch (iconName) {
      case 'arrow-back':
        return '←';
      default:
        return '•';
    }
  };

  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.8, color: color, fontWeight: 'bold' }}>
        {getIconText(name)}
      </Text>
    </View>
  );
};

const SafeIcon = ({ name, size = 24, color = '#000', style }) => {
  if (Icon) {
    try {
      return <Icon name={name} size={size} color={color} style={style} />;
    } catch (error) {
      return <FallbackIcon name={name} size={size} color={color} style={style} />;
    }
  }
  return <FallbackIcon name={name} size={size} color={color} style={style} />;
};

const Notification = () => {
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('undetermined');
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const navigation = useNavigation();
  const { bgStyle, textStyle, bg, text } = useAppTheme();
  const { t } = useLanguage();

  useEffect(() => {
    checkNotificationPermission();
  }, []);

  const checkNotificationPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        if (Platform.Version >= 33) {
          const hasPermission = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );

          if (hasPermission) {
            setPermissionStatus('granted');
            setNotificationEnabled(true);
          } else {
            setPermissionStatus('denied');
            setNotificationEnabled(false);
          }
        } else {
          setPermissionStatus('granted');
          setNotificationEnabled(true);
        }
      } else if (Platform.OS === 'ios') {
        setPermissionStatus('undetermined');
        setNotificationEnabled(false);
      }
    } catch (error) {
      setPermissionStatus('denied');
      setNotificationEnabled(false);
    }
  };

  const requestNotificationPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        if (Platform.Version >= 33) {
          const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            {
              title: t('notificationEnable.permissionTitle'),
              message: t('notificationEnable.permissionMessage'),
              buttonNeutral: t('notificationEnable.buttonNeutral'),
              buttonNegative: t('notificationEnable.buttonNegative'),
              buttonPositive: t('notificationEnable.buttonPositive'),
            }
          );

          if (result === PermissionsAndroid.RESULTS.GRANTED) {
            setPermissionStatus('granted');
            setNotificationEnabled(true);
            showSuccessAlert();
          } else if (result === PermissionsAndroid.RESULTS.DENIED) {
            setPermissionStatus('denied');
            setNotificationEnabled(false);
            handlePermissionDenied();
          } else if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
            setPermissionStatus('blocked');
            setNotificationEnabled(false);
            handlePermissionBlocked();
          }
        } else {
          setPermissionStatus('granted');
          setNotificationEnabled(true);
          showSuccessAlert();
        }
      } else if (Platform.OS === 'ios') {
        setPermissionStatus('granted');
        setNotificationEnabled(true);
        showSuccessAlert();
      }
    } catch (error) {
      Alert.alert(t('notificationEnable.error'), t('notificationEnable.failedToRequest'));
    }
  };

  const showSuccessAlert = () => {
    Alert.alert(
      t('notificationEnable.successTitle'),
      t('notificationEnable.successMessage'),
      [{ text: t('notificationEnable.ok') }]
    );
  };

  const handlePermissionDenied = () => {
    Alert.alert(
      t('notificationEnable.permissionDeniedTitle'),
      t('notificationEnable.permissionDeniedMessage'),
      [
        { text: t('notificationEnable.tryAgain'), onPress: () => requestNotificationPermission() },
        { text: t('notificationEnable.cancel'), style: 'cancel' },
        {
          text: t('notificationEnable.openSettings'),
          onPress: () => openAppSettings(),
        },
      ]
    );
  };

  const handlePermissionBlocked = () => {
    Alert.alert(
      t('notificationEnable.permissionBlockedTitle'),
      t('notificationEnable.permissionBlockedMessage'),
      [
        { text: t('notificationEnable.cancel'), style: 'cancel' },
        {
          text: t('notificationEnable.openSettings'),
          onPress: () => openAppSettings(),
        },
      ]
    );
  };

  const openAppSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const handleEnableNotifications = async () => {
    if (permissionStatus === 'granted' && notificationEnabled) {
      Alert.alert(
        t('notificationEnable.alreadyEnabledTitle'),
        t('notificationEnable.alreadyEnabledMessage'),
        [{ text: t('notificationEnable.ok') }]
      );
      return;
    }

    if (permissionStatus === 'blocked') {
      handlePermissionBlocked();
      return;
    }

    if (permissionStatus === 'denied' || permissionStatus === 'undetermined') {
      await requestNotificationPermission();
      return;
    }

    if (permissionStatus === 'granted' && !notificationEnabled) {
      setNotificationEnabled(true);
      showSuccessAlert();
    }
  };

  const handleAllowPermission = async () => {
    setShowPermissionModal(false);
    setTimeout(() => {
      requestNotificationPermission();
    }, 300);
  };

  const handleDenyPermission = () => {
    setShowPermissionModal(false);
    setNotificationEnabled(false);
    setPermissionStatus('denied');
  };

  const getStatusText = () => {
    if (permissionStatus === 'blocked') {
      return t('notificationEnable.statusBlocked');
    }
    if (notificationEnabled && permissionStatus === 'granted') {
      return t('notificationEnable.statusEnabled');
    }
    return t('notificationEnable.statusDisabled');
  };

  const getButtonText = () => {
    if (permissionStatus === 'blocked') {
      return t('notificationEnable.openSettings');
    }
    if (notificationEnabled && permissionStatus === 'granted') {
      return t('notificationEnable.notificationsEnabledButton');
    }
    return t('notificationEnable.enableButton');
  };

  const goBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, bgStyle]} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={bg} />

      <View style={[styles.header, bgStyle, { shadowColor: text }]}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <SafeIcon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]}>{t('notificationEnable.headerTitle')}</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.screenBody}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('notificationEnable.pushNotificationsSection')}</Text>
          <Text style={styles.mainTitle}>{t('notificationEnable.mainTitle')}</Text>
          <Text style={styles.statusText}>{getStatusText()}</Text>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              { backgroundColor: text, shadowColor: text },
              (notificationEnabled && permissionStatus === 'granted') && styles.primaryButtonActive,
              permissionStatus === 'blocked' && styles.primaryButtonBlocked,
            ]}
            onPress={handleEnableNotifications}
          >
            <Text
              style={[
                styles.primaryButtonText,
                (notificationEnabled && permissionStatus === 'granted') && styles.primaryButtonTextActive,
              ]}
            >
              {getButtonText()}
            </Text>
          </TouchableOpacity>

          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>{t('notificationEnable.aboutTitle')}</Text>
            <Text style={styles.infoText}>{t('notificationEnable.aboutText')}</Text>
          </View>

          {__DEV__ && (
            <View style={styles.debugInfo}>
              <Text style={styles.debugText}>{t('notificationEnable.debugInfo')}</Text>
              <Text style={styles.debugText}>{t('notificationEnable.debugPermission')}: {permissionStatus}</Text>
              <Text style={styles.debugText}>{t('notificationEnable.debugEnabled')}: {notificationEnabled ? t('notificationEnable.yes') : t('notificationEnable.no')}</Text>
              <Text style={styles.debugText}>{t('notificationEnable.debugPlatform')}: {Platform.OS} {Platform.Version}</Text>
            </View>
          )}
        </View>
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={showPermissionModal}
        onRequestClose={() => setShowPermissionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIcon}>
              <Text style={styles.bellIcon}>🔔</Text>
            </View>
            <Text style={styles.modalTitle}>{t('notificationEnable.modalTitle')}</Text>
            <Text style={styles.modalDescription}>{t('notificationEnable.modalDescription')}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonAllow]}
                onPress={handleAllowPermission}
              >
                <Text style={styles.modalButtonTextAllow}>{t('notificationEnable.allow')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDeny]}
                onPress={handleDenyPermission}
              >
                <Text style={styles.modalButtonTextDeny}>{t('notificationEnable.dontAllow')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#dbdbdb',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  headerRight: {
    width: 40,
  },
  screenBody: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    fontWeight: '400',
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    lineHeight: 22,
  },
  primaryButton: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 24,
  },
  primaryButtonActive: {
    backgroundColor: '#4CAF50',
  },
  primaryButtonBlocked: {
    backgroundColor: '#FF9800',
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  primaryButtonTextActive: {
    color: '#fff',
  },
  infoSection: {
    marginTop: 40,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  debugInfo: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#e9ecef',
    borderRadius: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalIcon: {
    marginBottom: 16,
  },
  bellIcon: {
    fontSize: 32,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtons: {
    width: '100%',
    gap: 8,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonAllow: {
    backgroundColor: '#007AFF',
  },
  modalButtonDeny: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  modalButtonTextAllow: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  modalButtonTextDeny: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '400',
  },
});

export default Notification;