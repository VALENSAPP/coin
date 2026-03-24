import axiosinstance from '../../services';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loggedIn } from '../../redux/actions/LoginAction';
import { showToastMessage } from '../../components/displaytoastmessage';
import DeviceInfo from 'react-native-device-info';

export const handleLoginSuccess = async (token, dispatch, navigation, getProfileData, toast) => {
    if (token) {
        await AsyncStorage.setItem('token', token);
        getProfileData(dispatch, navigation, toast);
        // navigation.reset({ index: 0, routes: [{ name: 'MainTabNavigator' }] });
    } else {
        throw new Error('Login successful, but no token received.');
    }
};


export const signup = async (data) => {
    return axiosinstance.post('/user/register', data);
}

export const login = async (data) => {
    try {
        const deviceId = DeviceInfo.getUniqueId ? await Promise.resolve(DeviceInfo.getUniqueId()) : undefined;
        const deviceName = DeviceInfo.getDeviceName ? await DeviceInfo.getDeviceName() : undefined;
        const deviceType = DeviceInfo.getSystemName ? DeviceInfo.getSystemName() : undefined;

        const devicePayload = {
            // Prefer backend-friendly camelCase keys
            ...(deviceId ? { deviceId } : {}),
            ...(deviceName ? { deviceName } : {}),
            ...(deviceType ? { deviceType } : {}),
            // Backward compatible snake_case keys (in case backend expects these)
            ...(deviceId ? { device_id: deviceId } : {}),
            ...(deviceName ? { device_name: deviceName } : {}),
            ...(deviceType ? { device_type: deviceType } : {}),
        };
        console.log(devicePayload,'data in devieve info')
        return axiosinstance.post('/auth/login', { ...(data || {}), ...devicePayload });
    } catch (error) {
        // Fallback to normal login if device info fails for any reason
        return axiosinstance.post('/auth/login', data);
    }
}

export const forgotPassword = async (data) => {
    return axiosinstance.post('/user/forgot-password', data);
}

export const resetPassword = async (data) => {
    return axiosinstance.post('/user/reset-password', data);
}

export const verifyOtp = async (data) => {
    return axiosinstance.post('/user/verify-otp', data);
}

export const sendEmailotp = async (data) => {
    return axiosinstance.post('/user/send-email-otp', data);
}

export const verifyEmailOtp = async (data) => {
    return axiosinstance.post('/user/verify-email-otp', data);
}

export const firebasePost = async (url, data) => {
    return axiosinstance.post(`auth/${url}`, data);
}

export const refreshToken = async (token) => {
    return axiosinstance.post('auth/refresh', token);
}

export const logout = async (token) => {
    return axiosinstance.post('/auth/logout', token);
}
