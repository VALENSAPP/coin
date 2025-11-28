import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';

export async function requestUserPermission() {
    const authStatus = await messaging().requestPermission();
    const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
        console.log('Authorization status:', authStatus);
        getFcmToken();
    }
    else{
        console.log('authStatus not enabled------------');
    }
}

const getFcmToken = async () => {
    let fcmToken = await AsyncStorage.getItem('fcmToken')
    console.log(fcmToken, "the old token")
    if (!fcmToken) {
        try {
            const fcmToken = await messaging().getToken();
            if (fcmToken) {
                console.log(fcmToken, "the new generated token");
                await AsyncStorage.setItem('fcmToken', fcmToken)
            }
        }
        catch (error) {
            console.log(error, 'error raised in fcmtoken');
        }
    }
}

export const notificationListener = async () => {

    messaging().onNotificationOpenedApp(remoteMessage => {
        console.log(
            'Notification caused app to open from background state:', remoteMessage.notification,
        );
    });

    messaging().onMessage(async remoteMessage => {
        console.log("received iin foreground",remoteMessage)
    })

    // messaging()
    //     .getInitialNotification()
    //     .then(remoteMessage => {
    //         if (remoteMessage) {
    //             console.log(
    //                 'Notification caused app to open from quit state:',remoteMessage,
    //             );
    //             // alert(JSON.stringify(remoteMessage.data))
    //         }
    //     });
}