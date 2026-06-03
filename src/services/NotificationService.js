// notificationService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidStyle, AndroidImportance, EventType } from '@notifee/react-native';

// SINGLETON LISTENERS (avoid duplicates)
let unsubscribeOnMessage = null;
let unsubscribeOnNotificationOpened = null;
export const PENDING_NOTIFICATION_MODAL_KEY = 'pendingNotificationModal';

const buildModalNotificationPayload = (notification = {}) => ({
    notification: {
        title: notification?.title,
        body: notification?.body,
    },
    data: notification?.data || {},
});

// ─────────────────────────────────────────────
// PERMISSION
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// TOKEN
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// NOTIFEE CHANNEL SETUP (Android only — call once at app start)
// ─────────────────────────────────────────────
export const createNotificationChannels = async () => {
    // Default channel
    await notifee.createChannel({
        id: 'default',
        name: 'Default Notifications',
        importance: AndroidImportance.HIGH,
    });

    // Expandable / rich channel
    await notifee.createChannel({
        id: 'expandable',
        name: 'Expandable Notifications',
        importance: AndroidImportance.HIGH,
    });
};

// ─────────────────────────────────────────────
// DISPLAY EXPANDABLE NOTIFICATION (local)
// ─────────────────────────────────────────────

/**
 * Show an expandable notification using notifee.
 *
 * @param {object} options
 * @param {string} options.title        - Notification title
 * @param {string} options.body         - Short body (collapsed view)
 * @param {string} [options.bigText]    - Long text shown when expanded (Android)
 * @param {string} [options.bigTitle]   - Title shown when expanded (Android)
 * @param {string} [options.imageUrl]   - Remote/local image URL → BigPictureStyle (Android)
 * @param {string} [options.subtitle]   - Subtitle shown below title (iOS)
 * @param {object} [options.data]       - Extra key/value payload
 */
export const displayExpandableNotification = async ({
    title,
    body,
    bigText,
    bigTitle,
    imageUrl,
    subtitle,
    data = {},
}) => {
    console.log('🚀 [NOTIFEE] displayExpandableNotification called with:', {
        title,
        body,
        bigText: bigText ?? '(none)',
        bigTitle: bigTitle ?? '(none)',
        imageUrl: imageUrl ?? '(none)',
        subtitle: subtitle ?? '(none)',
    });

    let androidStyle;

    if (imageUrl) {
        androidStyle = {
            type: AndroidStyle.BIGPICTURE,
            picture: imageUrl,
            ...(bigText && { largeIcon: imageUrl }),
            title: bigTitle ?? title,
            summary: bigText ?? body,
        };
        console.log('🖼️ [NOTIFEE] Using BigPictureStyle:', JSON.stringify(androidStyle, null, 2));
    } else if (bigText) {
        androidStyle = {
            type: AndroidStyle.BIGTEXT,
            text: bigText,
            title: bigTitle ?? title,
            summary: body,
        };
        console.log('📝 [NOTIFEE] Using BigTextStyle:', JSON.stringify(androidStyle, null, 2));
    } else {
        console.log('📭 [NOTIFEE] No style applied — plain notification (no bigText or imageUrl in payload)');
    }

    try {
        await notifee.displayNotification({
            title,
            body,
            subtitle,
            data,
            android: {
                channelId: 'expandable',
                importance: AndroidImportance.HIGH,
                pressAction: { id: 'default' },
                ...(androidStyle && { style: androidStyle }),
            },
            ios: {
                ...(subtitle && { subtitle }),
                threadId: 'expandable-group',
                foregroundPresentationOptions: {
                    alert: true,
                    badge: true,
                    sound: true,
                },
            },
        });
        console.log('✅ [NOTIFEE] Notification displayed successfully');
    } catch (error) {
        console.error('❌ [NOTIFEE] Failed to display notification:', error?.message || error);
    }
};

// ─────────────────────────────────────────────
// DISPLAY INCOMING FCM MESSAGE AS EXPANDABLE (foreground)
// ─────────────────────────────────────────────
const displayFcmAsExpandable = async (remoteMessage) => {
    const { notification, data } = remoteMessage;
    if (!notification) return;

    // await displayExpandableNotification({
    //     title: notification.title ?? 'New Notification',
    //     body: notification.body ?? '',
    //     // Backend can send these extra keys in `data` for richer expansion
    //     bigText: data?.big_text,
    //     bigTitle: data?.big_title,
    //     imageUrl: data?.image_url ?? notification?.android?.imageUrl,
    //     subtitle: data?.subtitle,
    //     data,
    // });
};

// ─────────────────────────────────────────────
// LISTENERS
// ─────────────────────────────────────────────
export const notificationListener = () => {

    // ── FOREGROUND ────────────────────────────────────────────────────────
    if (unsubscribeOnMessage) {
        unsubscribeOnMessage();
        unsubscribeOnMessage = null;
    }

    unsubscribeOnMessage = messaging().onMessage(async remoteMessage => {
    console.log('🔥 [FOREGROUND] Raw FCM message received:', JSON.stringify(remoteMessage, null, 2));
    // await displayFcmAsExpandable(remoteMessage);
});

    // ── BACKGROUND TAP ────────────────────────────────────────────────────
    if (unsubscribeOnNotificationOpened) {
        unsubscribeOnNotificationOpened();
        unsubscribeOnNotificationOpened = null;
    }

    unsubscribeOnNotificationOpened = messaging().onNotificationOpenedApp(remoteMessage => {
        console.log('📩 Notification opened from background', remoteMessage);
        // Navigate or handle deep-link here using remoteMessage.data
    });

    // ── QUIT STATE ────────────────────────────────────────────────────────
    messaging()
        .getInitialNotification()
        .then(remoteMessage => {
            if (remoteMessage) {
                console.log('📌 Notification opened from quit state', remoteMessage);
                // Navigate or handle deep-link here
            }
        });

    // ── NOTIFEE foreground event (user taps / dismisses local notification) ─
    notifee.onForegroundEvent(({ type, detail }) => {
        console.log('🔔 Notifee foreground event', type, detail.notification);
    });
};

// ─────────────────────────────────────────────
// BACKGROUND HANDLER (register outside React tree, e.g. index.js)
// ─────────────────────────────────────────────

/** Call this in index.js BEFORE AppRegistry.registerComponent */
export const registerBackgroundHandler = () => {
    // Firebase background handler
    messaging().setBackgroundMessageHandler(async remoteMessage => {
        console.log('📦 FCM background message', remoteMessage);
        // notifee can display it here too if needed
        // await displayFcmAsExpandable(remoteMessage);
    });

    // Notifee background event
    notifee.onBackgroundEvent(async ({ type, detail }) => {
        console.log('🔕 Notifee background event', type, detail.notification);
        if (type === EventType.PRESS && detail?.notification) {
            await AsyncStorage.setItem(
                PENDING_NOTIFICATION_MODAL_KEY,
                JSON.stringify(buildModalNotificationPayload(detail.notification)),
            );
        }
    });
};
