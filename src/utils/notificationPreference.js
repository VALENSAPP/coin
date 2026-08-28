import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import { Platform, PermissionsAndroid, Linking } from 'react-native';
import { updateFcmToken } from '../services/notifications';

export const NOTIFICATIONS_ENABLED_KEY = 'notificationsEnabled';

export const openNotificationSettings = () => {
  if (Platform.OS === 'ios') {
    Linking.openURL('app-settings:');
  } else {
    Linking.openSettings();
  }
};

export async function getStoredNotificationPreference() {
  const value = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
  return value === 'true';
}

export async function checkDeviceNotificationPermission() {
  try {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 33) {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        return granted ? 'granted' : 'denied';
      }
      return 'granted';
    }

    const settings = await notifee.getNotificationSettings();
    if (settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED) {
      return 'granted';
    }
    if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
      return 'denied';
    }
    return 'undetermined';
  } catch {
    return 'denied';
  }
}

export async function getNotificationEnabledState() {
  const [stored, permission] = await Promise.all([
    getStoredNotificationPreference(),
    checkDeviceNotificationPermission(),
  ]);

  return {
    enabled: stored && permission === 'granted',
    permissionStatus: permission,
  };
}

async function requestDeviceNotificationPermission(t) {
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
        },
      );

      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        return 'granted';
      }
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        return 'blocked';
      }
      return 'denied';
    }
    return 'granted';
  }

  const authStatus = await messaging().requestPermission();
  if (
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL
  ) {
    return 'granted';
  }
  return 'denied';
}

export async function enableNotifications(t) {
  let permission = await checkDeviceNotificationPermission();

  if (permission !== 'granted') {
    permission = await requestDeviceNotificationPermission(t);
    if (permission === 'blocked') {
      return { success: false, reason: 'blocked' };
    }
    if (permission !== 'granted') {
      return { success: false, reason: 'denied' };
    }
  }

  try {
    const token = await messaging().getToken();
    if (token) {
      await AsyncStorage.setItem('fcmToken', token);
      await updateFcmToken({ fcmToken: token });
    }
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'true');
    return { success: true };
  } catch {
    return { success: false, reason: 'error' };
  }
}

export async function disableNotifications() {
  await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'false');

  try {
    await messaging().deleteToken();
  } catch {
    // Token may already be removed.
  }

  await AsyncStorage.removeItem('fcmToken');

  try {
    await updateFcmToken({ fcmToken: '' });
  } catch {
    // Server update is best-effort when disabling notifications.
  }

  return { success: true };
}
