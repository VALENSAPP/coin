import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';

// SINGLETON LISTENERS (avoid duplicates)
let unsubscribeOnMessage = null;
let unsubscribeOnNotificationOpened = null;

export async function requestUserPermission() {
    const authStatus = await messaging().requestPermission();
    const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
        console.log('Authorization status:', authStatus);
        getFcmToken();
    } else {
        console.log('authStatus not enabled------------');
    }
}

const getFcmToken = async () => {
    let fcmToken = await AsyncStorage.getItem('fcmToken');
    console.log(fcmToken, 'the old token');

    if (!fcmToken) {
        try {
            const token = await messaging().getToken();
            if (token) {
                console.log(token, 'the new generated token');
                await AsyncStorage.setItem('fcmToken', token);
            }
        } catch (error) {
            console.log(error, 'error raised in fcmtoken');
        }
    }
};

export const notificationListener = () => {

    // -------------------------
    // FOREGROUND LISTENER (FIXED)
    // -------------------------
    if (unsubscribeOnMessage) {
        unsubscribeOnMessage();  // prevent duplicates
        unsubscribeOnMessage = null;
    }

    unsubscribeOnMessage = messaging().onMessage(async remoteMessage => {
        console.log("🔥 received in foreground (single listener)", remoteMessage);
    });

    // -------------------------
    // BACKGROUND TAP LISTENER
    // -------------------------
    if (unsubscribeOnNotificationOpened) {
        unsubscribeOnNotificationOpened();
        unsubscribeOnNotificationOpened = null;
    }

    unsubscribeOnNotificationOpened = messaging().onNotificationOpenedApp(remoteMessage => {
        console.log("📩 Notification opened from background", remoteMessage);
    });

    // -------------------------
    // QUIT STATE (only once)
    // -------------------------
    messaging()
        .getInitialNotification()
        .then(remoteMessage => {
            if (remoteMessage) {
                console.log("📌 Notification opened from quit state", remoteMessage);
            }
        });
};
