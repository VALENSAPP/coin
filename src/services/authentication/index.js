import axiosinstance from '../../services';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loggedIn } from '../../redux/actions/LoginAction';
import { showToastMessage } from '../../components/displaytoastmessage';

export const handleLoginSuccess = async (token, dispatch, navigation, getProfileData) => {
    if (token) {
        await AsyncStorage.setItem('token', token);
        getProfileData(dispatch, navigation);
        // navigation.reset({ index: 0, routes: [{ name: 'MainTabNavigator' }] });
    } else {
        throw new Error('Login successful, but no token received.');
    }
};


export const signup = async (data) => {
    return axiosinstance.post('/user/register', data);
}

export const login = async (data) => {
    return axiosinstance.post('/auth/login', data);
}

export const forgotPassword = async (data) => {
    return axiosinstance.post('/user/forgot-password', data);
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