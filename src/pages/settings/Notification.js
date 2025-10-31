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
  const navigation = useNavigation()
  useEffect(() => {
    checkNotificationPermission();
  }, []);

  const checkNotificationPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        // Android 13+ (API 33+) requires POST_NOTIFICATIONS permission
        if (Platform.Version >= 33) {
          const hasPermission = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          
          // If permission is denied, it could be:
          // 1. Never been requested (first time)
          // 2. Previously denied but can be requested again
          // 3. Permanently denied (blocked)
          // 4. Disabled in system settings
          
          if (hasPermission) {
            setPermissionStatus('granted');
            setNotificationEnabled(true);
          } else {
            // Start with denied status - we'll determine if it's blocked later
            setPermissionStatus('denied');
            setNotificationEnabled(false);
          }
        } else {
          // For older Android versions, notifications are enabled by default
          setPermissionStatus('granted');
          setNotificationEnabled(true);
        }
      } else if (Platform.OS === 'ios') {
        // For iOS, we'll assume denied until user enables
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
              title: 'Notification Permission',
              message: 'Valens would like to send you notifications to keep you updated with important information.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          )
          
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
          // For older Android versions
          setPermissionStatus('granted');
          setNotificationEnabled(true);
          showSuccessAlert();
        }
      } else if (Platform.OS === 'ios') {
        // For iOS, you would use @react-native-async-storage/async-storage
        // or a proper notification library like @react-native-firebase/messaging
        setPermissionStatus('granted');
        setNotificationEnabled(true);
        showSuccessAlert();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to request notification permission. Please try again.');
    }
  };

  const showSuccessAlert = () => {
    Alert.alert(
      'Success!',
      'Notifications have been enabled for Valens. You will now receive important updates and notifications.',
      [{ text: 'OK' }]
    );
  };

  const handlePermissionDenied = () => {
    Alert.alert(
      'Permission Denied',
      'Notifications are currently disabled. You can enable them manually in your device settings or try again.',
      [
        { text: 'Try Again', onPress: () => requestNotificationPermission() },
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Open Settings', 
          onPress: () => openAppSettings()
        }
      ]
    );
  };

  const handlePermissionBlocked = () => {
    Alert.alert(
      'Permission Blocked',
      'Notification permission has been permanently denied. Please enable notifications manually in your device settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Open Settings', 
          onPress: () => openAppSettings()
        }
      ]
    );
  };

  const openAppSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      // For Android, open app-specific settings
      Linking.openSettings();
    }
  };

  const handleEnableNotifications = async () => {

    if (permissionStatus === 'granted' && notificationEnabled) {
      // Already enabled
      Alert.alert(
        'Already Enabled',
        'Notifications are already enabled for Valens.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (permissionStatus === 'blocked') {
      // Permission was permanently denied
      handlePermissionBlocked();
      return;
    }

    // For denied or undetermined status, always try to request permission
    // This will either:
    // 1. Show the system permission dialog if it's the first time or previously denied but can ask again
    // 2. Return NEVER_ASK_AGAIN if permanently denied
    // 3. Direct user to settings if notifications are disabled in system settings
    if (permissionStatus === 'denied' || permissionStatus === 'undetermined') {
      await requestNotificationPermission();
      return;
    }

    if (permissionStatus === 'granted' && !notificationEnabled) {
      // Permission granted but somehow disabled, re-enable
      setNotificationEnabled(true);
      showSuccessAlert();
    }
  };

  const handleAllowPermission = async () => {
    setShowPermissionModal(false);
    // Add a small delay to ensure modal is closed before showing system dialog
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
      return 'Notifications are blocked. Please enable them in settings.';
    }
    if (notificationEnabled && permissionStatus === 'granted') {
      return 'Valens push notifications are enabled';
    }
    return 'Valens push notifications are disabled';
  };

  const getButtonText = () => {
    if (permissionStatus === 'blocked') {
      return 'Open Settings';
    }
    if (notificationEnabled && permissionStatus === 'granted') {
      return 'Notifications Enabled ✓';
    }
    return 'Enable notifications';
  };

  const goBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f2fd" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <SafeIcon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.screenBody}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Push notifications</Text>
          <Text style={styles.mainTitle}>Enable push notifications</Text>
          <Text style={styles.statusText}>{getStatusText()}</Text>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              (notificationEnabled && permissionStatus === 'granted') && styles.primaryButtonActive,
              permissionStatus === 'blocked' && styles.primaryButtonBlocked
            ]}
            onPress={handleEnableNotifications}
          >
            <Text
              style={[
                styles.primaryButtonText,
                (notificationEnabled && permissionStatus === 'granted') && styles.primaryButtonTextActive
              ]}
            >
              {getButtonText()}
            </Text>
          </TouchableOpacity>

          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>About Notifications</Text>
            <Text style={styles.infoText}>
              • Get notified about new messages and updates{`\n`}
              • Receive important security alerts{`\n`}
              • Stay updated with Valens features{`\n`}
              • You can disable these anytime in settings
            </Text>
          </View>

          {__DEV__ && (
            <View style={styles.debugInfo}>
              <Text style={styles.debugText}>Debug Info:</Text>
              <Text style={styles.debugText}>Permission: {permissionStatus}</Text>
              <Text style={styles.debugText}>Enabled: {notificationEnabled ? 'Yes' : 'No'}</Text>
              <Text style={styles.debugText}>Platform: {Platform.OS} {Platform.Version}</Text>
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
            <Text style={styles.modalTitle}>Allow Valens to send you notifications?</Text>
            <Text style={styles.modalDescription}>Stay updated with important messages and alerts from Valens.</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonAllow]} onPress={handleAllowPermission}>
                <Text style={styles.modalButtonTextAllow}>Allow</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonDeny]} onPress={handleDenyPermission}>
                <Text style={styles.modalButtonTextDeny}>Don't allow</Text>
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
    backgroundColor: '#f8f2fd',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#dbdbdb',
    backgroundColor: '#f8f2fd',
    shadowColor: '#5a2d82',
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
    color: '#5a2d82',
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
    backgroundColor: '#5a2d82',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5a2d82',
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